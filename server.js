const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WIDTH = 30;
const HEIGHT = 20;
const TICK_RATE = 120;

const MAX_PLAYERS = 3;

// Players currently in the game
let players = {};

// The two players currently fighting
let activePlayers = [];

// Extra players waiting for the next match
let waitingPlayers = [];

let gameStarted = false;
let gameOver = false;

const snakes = {
    1: {
        body: [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 }
        ],
        direction: { x: 1, y: 0 }
    },

    2: {
        body: [
            { x: 24, y: 10 },
            { x: 25, y: 10 },
            { x: 26, y: 10 }
        ],
        direction: { x: -1, y: 0 }
    }
};


// -------------------------
// GAME RESET
// -------------------------

function resetGame() {

    snakes[1].body = [
        { x: 5, y: 10 },
        { x: 4, y: 10 },
        { x: 3, y: 10 }
    ];

    snakes[1].direction = { x: 1, y: 0 };

    snakes[2].body = [
        { x: 24, y: 10 },
        { x: 25, y: 10 },
        { x: 26, y: 10 }
    ];

    snakes[2].direction = { x: -1, y: 0 };

    gameOver = false;
}


// -------------------------
// POSITION CHECK
// -------------------------

function samePosition(a, b) {

    return (
        a.x === b.x &&
        a.y === b.y
    );
}


// -------------------------
// MOVE SNAKE
// -------------------------

function moveSnake(snake) {

    const head = snake.body[0];

    const newHead = {
        x: head.x + snake.direction.x,
        y: head.y + snake.direction.y
    };

    // Wrap around the edges
    newHead.x = (newHead.x + WIDTH) % WIDTH;
    newHead.y = (newHead.y + HEIGHT) % HEIGHT;

    snake.body.unshift(newHead);
    snake.body.pop();

    return newHead;
}


// -------------------------
// COLLISION
// -------------------------

function hitSnake(position, snake) {

    return snake.body.some(segment =>
        samePosition(position, segment)
    );
}


// -------------------------
// SEND GAME STATE
// -------------------------

function broadcastState() {

    io.emit("gameState", {

        snakes: {
            1: snakes[1].body,
            2: snakes[2].body
        }

    });
}


// -------------------------
// SEND PLAYER STATUS
// -------------------------

function updateWaitingPlayers() {

    waitingPlayers.forEach(id => {

        const socket = io.sockets.sockets.get(id);

        if (socket) {

            socket.emit(
                "waitingForMatch"
            );
        }
    });
}


// -------------------------
// START MATCH
// -------------------------

function startMatch() {

    if (activePlayers.length < 2) {

        gameStarted = false;

        return;
    }

    resetGame();

    gameStarted = true;

    gameOver = false;

    // Reset rematch status
    activePlayers.forEach(id => {

        if (players[id]) {
            players[id].rematch = false;
        }
    });

    // Tell the two active players their numbers
    activePlayers.forEach((id, index) => {

        const socket =
            io.sockets.sockets.get(id);

        if (socket) {

            socket.emit(
                "playerNumber",
                index + 1
            );
        }
    });

    // Tell waiting players
    updateWaitingPlayers();

    io.emit("gameStart");

    broadcastState();

    console.log(
        "GAME STARTED:",
        activePlayers.length,
        "active players"
    );
}


// -------------------------
// PROMOTE WAITING PLAYER
// -------------------------

function promoteWaitingPlayer() {

    if (
        waitingPlayers.length === 0 ||
        activePlayers.length >= 2
    ) {
        return;
    }

    const newPlayer =
        waitingPlayers.shift();

    activePlayers.push(newPlayer);

    if (players[newPlayer]) {

        players[newPlayer].active = true;
        players[newPlayer].rematch = false;
    }

    const socket =
        io.sockets.sockets.get(newPlayer);

    if (socket) {

        socket.emit(
            "playerNumber",
            activePlayers.length
        );
    }

    console.log(
        "Waiting player promoted:",
        newPlayer
    );
}


// -------------------------
// GAME LOOP
// -------------------------

function gameTick() {

    if (
        !gameStarted ||
        gameOver ||
        activePlayers.length < 2
    ) {
        return;
    }

    const head1 =
        moveSnake(snakes[1]);

    const head2 =
        moveSnake(snakes[2]);

    let dead1 = false;
    let dead2 = false;


    // Hit the other snake

    if (
        hitSnake(
            head1,
            snakes[2]
        )
    ) {

        dead1 = true;
    }

    if (
        hitSnake(
            head2,
            snakes[1]
        )
    ) {

        dead2 = true;
    }


    // Head-on collision

    if (
        samePosition(
            head1,
            head2
        )
    ) {

        dead1 = true;
        dead2 = true;
    }


    broadcastState();


    // GAME OVER

    if (dead1 || dead2) {

        gameOver = true;
        gameStarted = false;

        if (
            dead1 &&
            dead2
        ) {

            io.emit(
                "gameResult",
                "DRAW"
            );

        } else if (dead1) {

            io.emit(
                "gameResult",
                "RED"
            );

        } else {

            io.emit(
                "gameResult",
                "GREEN"
            );
        }

        updateWaitingPlayers();

        console.log("GAME OVER");
    }
}


// -------------------------
// CONNECTION
// -------------------------

io.on(
    "connection",
    socket => {

        console.log(
            "Player connected:",
            socket.id
        );


        // -------------------------
        // JOIN GAME
        // -------------------------

        socket.on(
            "joinGame",
            () => {

                // Already joined
                if (
                    players[socket.id]
                ) {

                    return;
                }


                // Maximum of 3 connected players
                if (
                    Object.keys(players).length >= MAX_PLAYERS
                ) {

                    socket.emit("full");

                    return;
                }


                players[socket.id] = {

                    active: false,

                    rematch: false
                };


                // First two players become active

                if (
                    activePlayers.length < 2
                ) {

                    activePlayers.push(
                        socket.id
                    );

                    players[
                        socket.id
                    ].active = true;


                    socket.emit(
                        "playerNumber",
                        activePlayers.length
                    );


                    // Start as soon as two players exist

                    if (
                        activePlayers.length === 2
                    ) {

                        startMatch();
                    }

                } else {

                    // Third player waits

                    waitingPlayers.push(
                        socket.id
                    );

                    socket.emit(
                        "waitingForMatch"
                    );

                    console.log(
                        "Player waiting:",
                        socket.id
                    );
                }
            }
        );


        // -------------------------
        // MOVEMENT
        // -------------------------

        socket.on(
            "direction",
            direction => {

                const player =
                    players[socket.id];

                if (
                    !player ||
                    !player.active ||
                    !gameStarted ||
                    gameOver
                ) {

                    return;
                }


                const playerIndex =
                    activePlayers.indexOf(
                        socket.id
                    );


                if (
                    playerIndex === -1
                ) {

                    return;
                }


                const playerNumber =
                    playerIndex + 1;

                const snake =
                    snakes[playerNumber];


                if (!direction) {
                    return;
                }


                // Prevent instant reverse

                if (
                    direction.x ===
                    -snake.direction.x &&
                    direction.y ===
                    -snake.direction.y
                ) {

                    return;
                }


                snake.direction = {

                    x: direction.x,

                    y: direction.y
                };
            }
        );


        // -------------------------
        // REMATCH
        // -------------------------

        socket.on(
            "rematch",
            () => {

                const player =
                    players[socket.id];


                // Only active players
                // can request rematch

                if (
                    !player ||
                    !player.active ||
                    !gameOver
                ) {

                    return;
                }


                player.rematch = true;


                socket.emit(
                    "rematchWaiting"
                );


                const bothReady =
                    activePlayers.length === 2 &&
                    activePlayers.every(
                        id =>
                            players[id] &&
                            players[id].rematch
                    );


                if (bothReady) {

                    startMatch();
                }
            }
        );


        // -------------------------
        // DISCONNECT
        // -------------------------

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Player disconnected:",
                    socket.id
                );


                const wasActive =
                    activePlayers.includes(
                        socket.id
                    );


                // Remove from active players

                activePlayers =
                    activePlayers.filter(
                        id =>
                            id !== socket.id
                    );


                // Remove from waiting players

                waitingPlayers =
                    waitingPlayers.filter(
                        id =>
                            id !== socket.id
                    );


                delete players[
                    socket.id
                ];


                // If active player leaves,
                // the current match ends

                if (wasActive) {

                    gameStarted = false;
                    gameOver = false;

                    io.emit(
                        "opponentLeft"
                    );


                    // Bring waiting player
                    // into the active match

                    promoteWaitingPlayer();


                    // If we now have two,
                    // start a fresh match

                    if (
                        activePlayers.length === 2
                    ) {

                        startMatch();
                    }
                }


                // Tell remaining waiting players
                updateWaitingPlayers();
            }
        );
    }
);


// -------------------------
// START SERVER
// -------------------------

setInterval(
    gameTick,
    TICK_RATE
);


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

        console.log(
            "🐍 Snake Duel running at http://localhost:3000"
        );
    }
);