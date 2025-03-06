const socket = new WebSocket("ws://13.60.171.213:3000");

let playerIndex = null;
let myBoard = {};
let enemyBoard = {};
let gameStarted = false;
let myTurn = false;

const ships = [
    { name: "Barco 1", size: 2 },
    { name: "Barco 2", size: 3 },
    { name: "Barco 3", size: 3 },
    { name: "Barco 4", size: 4 },
    { name: "Barco 5", size: 5 },
];

const startButton = document.getElementById("startGame");
const statusText = document.getElementById("status");

function createBoard(boardId, isClickable) {
    const board = document.getElementById(boardId);
    board.innerHTML = "";

    for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.id = `${boardId === "myBoard" ? "my" : "enemy"}-${x}-${y}`;

            if (boardId === "myBoard" && !gameStarted) {
                cell.ondragover = (event) => highlightCells(event, x, y);
                cell.ondragleave = () => clearHighlight();
                cell.ondrop = (event) => {
                    dropShip(event, x, y);
                    clearHighlight();
                };
            }
            

            if (boardId === "enemyBoard" && isClickable) {
                cell.onclick = () => {
                    if (myTurn) {
                        attackCell(x, y);
                    }
                };
            }

            board.appendChild(cell);
        }
    }
}


function highlightCells(event, x, y) {
    event.preventDefault();
    clearHighlight(); // Primero limpia cualquier sombreado previo

    const shipData = event.dataTransfer.getData("text/plain");
    if (!shipData) return;

    const [size, orientation] = shipData.split("-").map(item => isNaN(item) ? item : parseInt(item));

    for (let i = 0; i < size; i++) {
        let posX = orientation === "horizontal" ? x : x + i;
        let posY = orientation === "horizontal" ? y + i : y;

        if (posX < 10 && posY < 10) {
            const cell = document.getElementById(`my-${posX}-${posY}`);
            if (cell) cell.classList.add("highlight");
        }
    }
}


function clearHighlight() {
    document.querySelectorAll(".highlight").forEach(cell => cell.classList.remove("highlight"));
}





function attackCell(x, y) {
    if (!gameStarted || !myTurn) return;

    const cell = document.getElementById(`enemy-${x}-${y}`);
    if (cell.classList.contains("hit") || cell.classList.contains("miss")) return;

    socket.send(JSON.stringify({ type: "attackClick", x, y }));
    myTurn = false;
    statusText.innerText = "Esperando al rival...";
}

function dropShip(event, x, y) {
    event.preventDefault();
    const size = parseInt(event.dataTransfer.getData("text/plain").split("-")[0]);
    const orientation = event.dataTransfer.getData("text/plain").split("-")[1]; // "horizontal" o "vertical"

    for (let i = 0; i < size; i++) {
        let posX = orientation === "horizontal" ? x : x + i;
        let posY = orientation === "horizontal" ? y + i : y;

        if (posX >= 10 || posY >= 10 || myBoard[`${posX},${posY}`]) {
            alert("No hay espacio para el barco aquí.");
            return;
        }
    }

    for (let i = 0; i < size; i++) {
        let posX = orientation === "horizontal" ? x : x + i;
        let posY = orientation === "horizontal" ? y + i : y;

        myBoard[`${posX},${posY}`] = "X";
        document.getElementById(`my-${posX}-${posY}`).classList.add("ship");
    }

    removePlacedShip(size);
    if (Object.keys(myBoard).length === 17) {
        startButton.disabled = false;
    }
}

function removePlacedShip(size) {
    const ships = document.querySelectorAll(".ship-container");
    for (let ship of ships) {
        if (parseInt(ship.dataset.size) === size) {
            ship.remove();
            break;
        }
    }
}

function createShipElements() {
    const shipContainer = document.getElementById("shipContainer");
    shipContainer.innerHTML = "";

    ships.forEach(ship => {
        const shipElement = document.createElement("div");
        shipElement.classList.add("ship-container");
        shipElement.dataset.size = ship.size;
        shipElement.dataset.orientation = "horizontal"; // 🔹 Inicia en horizontal

        // 🔹 Agregar las partes del barco
        for (let i = 0; i < ship.size; i++) {
            const shipPart = document.createElement("div");
            shipPart.classList.add("ship-part");
            shipElement.appendChild(shipPart);
        }

        shipElement.setAttribute("draggable", true);

        shipElement.addEventListener("dragstart", (event) => {
            const shipSize = shipElement.dataset.size;
            const shipOrientation = shipElement.dataset.orientation;
            event.dataTransfer.setData("text/plain", `${shipSize}-${shipOrientation}`);
            
            console.log(`🚢 Arrastrando barco de tamaño ${shipSize} con orientación ${shipOrientation}`);
        });

        // 🔹 Permitir rotar con clic derecho
        shipElement.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            rotateShip(shipElement);
        });

        shipContainer.appendChild(shipElement);
    });
}



function rotateShip(shipElement) {
    const currentOrientation = shipElement.dataset.orientation;
    const newOrientation = currentOrientation === "horizontal" ? "vertical" : "horizontal";

    shipElement.dataset.orientation = newOrientation;

    if (newOrientation === "vertical") {
        shipElement.classList.add("vertical");
    } else {
        shipElement.classList.remove("vertical");
    }
}


startButton.addEventListener("click", () => {
    if (playerIndex !== null) {
        socket.send(JSON.stringify({ type: "setBoard", board: myBoard }));
        startButton.style.display = "none";
    }
});


socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "welcome") {
        playerIndex = data.player;
        statusText.innerText = `Eres el Jugador ${playerIndex + 1}. Esperando al otro...`;
    }

    if (data.type === "gameStart") {
        gameStarted = true;
        myTurn = data.turn === playerIndex;
        statusText.innerText = myTurn ? "¡Tu turno!" : "Esperando al rival...";
        document.getElementById("shipContainer").style.display = "none";
        document.getElementById("enemyBoard").style.display = "grid";
        document.querySelector(".tableros h2").textContent = "Tablero Enemigo";


        enemyBoard = data.boards[1 - playerIndex];

        renderShips("enemyBoard", enemyBoard);
        renderShips("myBoard", myBoard);

        createBoard("enemyBoard", true);
        if (playerIndex === 0) {
            document.body.style.backgroundColor = myTurn ? "#f0fdff" : "#A2A2A2"; // Azul claro y gris
        } else {
            document.body.style.backgroundColor = myTurn ? "#fce7e7" : "#A2A2A2"; // Rojo claro y gris
        }

    }

    if (data.type === "changeTurn") {
        myTurn = data.turn === playerIndex;
        statusText.innerText = myTurn ? "¡Tu turno!" : "Esperando al rival...";
        if (playerIndex === 0) {
            document.body.style.backgroundColor = myTurn ? "#f0fdff" : "#A2A2A2"; // Azul claro y gris
        } else {
            document.body.style.backgroundColor = myTurn ? "#fce7e7" : "#A2A2A2"; // Rojo claro y gris
        }
    }

    if (data.type === "attackResult") {
        const { x, y, hit, player } = data;
        if (player === playerIndex) {
            const cell = document.getElementById(`enemy-${x}-${y}`);
            cell.classList.add(hit ? "hit" : "miss");
        } else {
            const cell = document.getElementById(`my-${x}-${y}`);
            cell.classList.add(hit ? "hit" : "miss");
        }
    }
};

function renderShips(boardId, boardData) {
    for (let key in boardData) {
        const [x, y] = key.split(",");
        const cell = document.getElementById(`${boardId === "myBoard" ? "my" : "enemy"}-${x}-${y}`);
        if (cell) {
            cell.classList.add("ship");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM completamente cargado");

    createBoard("myBoard", false);
    createBoard("enemyBoard", false);
    createShipElements(); // 🔹 Ahora los barcos también se crean automáticamente

    console.log("Tableros y barcos creados");
});

