const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {};
let games = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "login":
        players[data.playerId] = { ws, wins: 0 };
        ws.send(JSON.stringify({ type: "login", success: true }));
        break;

      case "joinGame":
        let gameId = findOrCreateGame(data.playerId);
        players[data.playerId].gameId = gameId;
        broadcastGameState(gameId);
        break;

      case "makeMove":
        let game = games[players[data.playerId].gameId];
        game.moves[data.playerId] = data.move;
        if (Object.keys(game.moves).length === 2) {
          evaluateGame(game);
        }
        broadcastGameState(game.id);
        break;

      case "logout":
        delete players[data.playerId];
        break;

      default:
        break;
    }
  });

  ws.on("close", () => {
    for (let playerId in players) {
      if (players[playerId].ws === ws) {
        delete players[playerId];
        break;
      }
    }
  });
});

function findOrCreateGame(playerId) {
  for (let gameId in games) {
    if (games[gameId].players.length === 1) {
      games[gameId].players.push(playerId);
      return gameId;
    }
  }
  let newGameId = `game${Object.keys(games).length + 1}`;
  games[newGameId] = { id: newGameId, players: [playerId], moves: {} };
  return newGameId;
}

function evaluateGame(game) {
  const [player1, player2] = game.players;
  const move1 = game.moves[player1];
  const move2 = game.moves[player2];
  if (move1 === move2) {
    game.result = "draw";
  } else if (
    (move1 === "rock" && move2 === "scissors") ||
    (move1 === "scissors" && move2 === "paper") ||
    (move1 === "paper" && move2 === "rock")
  ) {
    game.result = `${player1} wins`;
    players[player1].wins += 1;
  } else {
    game.result = `${player2} wins`;
    players[player2].wins += 1;
  }
  game.moves = {};
}

function broadcastGameState(gameId) {
  const game = games[gameId];
  const message = JSON.stringify({
    type: "gameUpdate",
    game: {
      players: game.players,
      result: game.result || null,
      playerWins: game.players.map((player) => ({
        player,
        wins: players[player].wins,
      })),
    },
  });

  game.players.forEach((playerId) => {
    if (players[playerId]) {
      players[playerId].ws.send(message);
    }
  });
}

app.use(express.static("public"));

server.listen(8080, () => {
  console.log("Server is listening on port 8080");
});
