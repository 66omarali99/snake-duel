const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const status = document.getElementById("status");

const joinButton =
    document.getElementById("join");

const rematchButton =
    document.getElementById("rematch");

const GRID_SIZE = 20;

let playerNumber = 0;

let snakes = {
    1: [],
    2: []
};

let gameRunning = false;


// -------------------------
// DRAW GAME
// -------------------------

function draw() {

    ctx.fillStyle = "#222";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawSnake(
        snakes[1],
        "#40ff60"
    );

    drawSnake(
        snakes[2],
        "#ff4040"
    );
}


function drawSnake(
    snake,
    color
) {

    ctx.fillStyle = color;

    snake.forEach(
        (segment, index) => {

            ctx.fillRect(
                segment.x * GRID_SIZE,
                segment.y * GRID_SIZE,
                GRID_SIZE - 1,
                GRID_SIZE - 1
            );


            // Head

            if (index === 0) {

                ctx.fillStyle =
                    "white";

                ctx.fillRect(
                    segment.x * GRID_SIZE + 6,
                    segment.y * GRID_SIZE + 6,
                    7,
                    7
                );

                ctx.fillStyle =
                    color;
            }
        }
    );
}


// -------------------------
// JOIN GAME
// -------------------------

joinButton.addEventListener(
    "click",
    () => {

        socket.emit(
            "joinGame"
        );

        joinButton.disabled = true;

        status.textContent =
            "Joining...";
    }
);


// -------------------------
// PLAYER NUMBER
// -------------------------

socket.on(
    "playerNumber",
    number => {

        playerNumber = number;


        if (number === 1) {

            status.textContent =
                "You are GREEN 🟩. Waiting for Player 2...";

        } else if (number === 2) {

            status.textContent =
                "You are RED 🟥. Waiting for game...";

        }
    }
);


// -------------------------
// WAITING PLAYER
// -------------------------

socket.on(
    "waitingForMatch",
    () => {

        playerNumber = 0;

        gameRunning = false;

        rematchButton.disabled = true;

        status.textContent =
            "Waiting for the next match... ⏳";
    }
);


// -------------------------
// GAME START
// -------------------------

socket.on(
    "gameStart",
    () => {

        gameRunning = true;

        rematchButton.disabled =
            true;

        status.textContent =
            "FIGHT! 🐍";
    }
);


// -------------------------
// GAME STATE
// -------------------------

socket.on(
    "gameState",
    state => {

        snakes =
            state.snakes;

        draw();
    }
);


// -------------------------
// GAME RESULT
// -------------------------

socket.on(
    "gameResult",
    result => {

        gameRunning = false;

        rematchButton.disabled =
            false;


        if (result === "GREEN") {

            status.textContent =
                playerNumber === 1
                    ? "YOU WIN! 🟩🏆"
                    : "GREEN WINS! 🟩";

        } else if (
            result === "RED"
        ) {

            status.textContent =
                playerNumber === 2
                    ? "YOU WIN! 🟥🏆"
                    : "RED WINS! 🟥";

        } else {

            status.textContent =
                "DRAW! 💥";
        }
    }
);


// -------------------------
// REMATCH
// -------------------------

rematchButton.addEventListener(
    "click",
    () => {

        rematchButton.disabled =
            true;

        status.textContent =
            "Waiting for opponent to rematch...";

        socket.emit(
            "rematch"
        );
    }
);


// -------------------------
// REMATCH WAITING
// -------------------------

socket.on(
    "rematchWaiting",
    () => {

        status.textContent =
            "Rematch requested. Waiting for opponent...";
    }
);


// -------------------------
// OPPONENT LEFT
// -------------------------

socket.on(
    "opponentLeft",
    () => {

        gameRunning = false;

        status.textContent =
            "Opponent left. Waiting for another player...";

        rematchButton.disabled =
            true;
    }
);


// -------------------------
// GAME FULL
// -------------------------

socket.on(
    "full",
    () => {

        status.textContent =
            "Game is full.";
    }
);


// -------------------------
// SEND DIRECTION
// -------------------------

function sendDirection(
    direction
) {

    if (!gameRunning) {
        return;
    }

    socket.emit(
        "direction",
        direction
    );
}


// -------------------------
// KEYBOARD CONTROLS
// -------------------------

document.addEventListener(
    "keydown",
    event => {

        let direction = null;

        const key =
            event.key.toLowerCase();


        // WASD works for BOTH PC players

        if (key === "w") {

            direction = {
                x: 0,
                y: -1
            };
        }

        if (key === "s") {

            direction = {
                x: 0,
                y: 1
            };
        }

        if (key === "a") {

            direction = {
                x: -1,
                y: 0
            };
        }

        if (key === "d") {

            direction = {
                x: 1,
                y: 0
            };
        }


        if (direction) {

            event.preventDefault();

            sendDirection(
                direction
            );
        }
    }
);


// -------------------------
// PHONE CONTROLS
// -------------------------

document.querySelectorAll(
    "#controls button"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const direction =
                    button.dataset.direction;


                if (
                    direction === "up"
                ) {

                    sendDirection({
                        x: 0,
                        y: -1
                    });
                }


                if (
                    direction === "down"
                ) {

                    sendDirection({
                        x: 0,
                        y: 1
                    });
                }


                if (
                    direction === "left"
                ) {

                    sendDirection({
                        x: -1,
                        y: 0
                    });
                }


                if (
                    direction === "right"
                ) {

                    sendDirection({
                        x: 1,
                        y: 0
                    });
                }
            }
        );
    }
);


draw();