const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

let players = [];
let gameState = {
    boards: [{}, {}],
    ready: [false, false],
    turn: 0, // 🔹 El jugador 1 empieza
    shipsLeft: [17, 17]
};

wss.on("connection", (ws) => {
    if (players.length >= 2) {
        ws.send(JSON.stringify({ type: "full", message: "Juego lleno" }));
        ws.close();
        return;
    }

    const playerIndex = players.length;
    players.push(ws);
    ws.send(JSON.stringify({ type: "welcome", player: playerIndex }));

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "attackClick") {
            console.log(`📌 El jugador ${playerIndex + 1} ha hecho clic en (${data.x}, ${data.y})`);

            const opponentIndex = 1 - playerIndex; // 🔹 Índice del oponente
            const hit = gameState.boards[opponentIndex][`${data.x},${data.y}`] === "X";

            if (hit) {
                console.log(`🔥 ACIERTO: el jugador ${playerIndex + 1} ha golpeado un barco en (${data.x}, ${data.y})`);
                gameState.shipsLeft[opponentIndex]--; // 🔹 Reducimos el contador de barcos del oponente
            } else {
                console.log(`💨 FALLO: el jugador ${playerIndex + 1} ha fallado en (${data.x}, ${data.y})`);
            }

            sendToPlayers({
                type: "attackResult",
                x: data.x,
                y: data.y,
                hit,
                player: playerIndex
            });

            // 🔹 Comprobar si un jugador ha ganado
            if (gameState.shipsLeft[opponentIndex] === 0) {
                sendToPlayers({ type: "gameOver", winner: playerIndex });
                return; // 🔹 Evita cambiar el turno si el juego ha terminado
            }

            // 🔹 Cambiar turno después del ataque
            gameState.turn = (gameState.turn === 0) ? 1 : 0;
            sendToPlayers({ type: "changeTurn", turn: gameState.turn });
        }

        if (data.type === "setBoard") {
            gameState.boards[playerIndex] = data.board;
            gameState.ready[playerIndex] = true;

            if (gameState.ready[0] && gameState.ready[1]) {
                console.log("¡Ambos jugadores listos! Comienza la partida.");
                sendToPlayers({ type: "gameStart", boards: gameState.boards, turn: gameState.turn });
            }
        }
    });

    ws.on("close", () => {
        players = [];
        gameState = { boards: [{}, {}], ready: [false, false], turn: 0, shipsLeft: [17, 17] };
    });
});

function sendToPlayers(message) {
    players.forEach((player) => {
        if (player.readyState === WebSocket.OPEN) {
            player.send(JSON.stringify(message));
        }
    });
}

server.listen(3000, '0.0.0.0', () => {
    console.log('Servidor corriendo en puerto 3000');
});

