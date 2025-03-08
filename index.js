const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Game Variables
let wordsUsed = [];
let currentTurn = 0;
let players = [];
let scores = {};

// ✅ Function to check if a word is valid using a dictionary API
const isValidWord = async (word) => {
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    return response.data.length > 0;
  } catch (error) {
    return false;
  }
};

// ✅ Handle WebSocket connections
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Add new player
  if (!players.includes(socket.id)) {
    players.push(socket.id);
    scores[socket.id] = 100; // Initial Score
  }

  // Send game state to the new player
  socket.emit("gameState", { wordsUsed, currentTurn, scores, players });

  // ✅ Handling word submission
  socket.on("newWord", async ({ word, playerId }) => {
    if (players[currentTurn] !== playerId) {
      socket.emit("invalidWord", "It's not your turn!");
      return;
    }

    if (wordsUsed.includes(word)) {
      socket.emit("invalidWord", "Word has already been used!");
      return;
    }

    if (wordsUsed.length > 0 && word[0] !== wordsUsed[wordsUsed.length - 1].slice(-1)) {
      socket.emit("invalidWord", "Word must start with the last letter of the previous word!");
      return;
    }

    if (word.length < 4) {
      socket.emit("invalidWord", "Word must be at least 4 letters!");
      return;
    }

    if (!(await isValidWord(word))) {
      socket.emit("invalidWord", "Word is not in the dictionary!");
      return;
    }

    // ✅ Add word & update score
    wordsUsed.push(word);
    const lengthBonus = word.length - 4;
    const speedBonus = 5; // Placeholder (can integrate real-time timer)
    scores[playerId] -= lengthBonus + speedBonus;

    // ✅ Check win condition
    if (scores[playerId] <= 0) {
      io.emit("gameOver", { winner: playerId });
      wordsUsed = [];
      scores = {};
      players = [];
      return;
    }

    // ✅ Switch turn
    currentTurn = (currentTurn + 1) % players.length;

    io.emit("gameState", { wordsUsed, currentTurn, scores, players });
  });

  // ✅ Handle player disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    players = players.filter((p) => p !== socket.id);
    delete scores[socket.id];

    if (players.length === 0) {
      // Reset game if no players left
      wordsUsed = [];
      scores = {};
      currentTurn = 0;
    } else {
      // Move turn to next player
      currentTurn = currentTurn % players.length;
    }

    io.emit("gameState", { wordsUsed, currentTurn, scores, players });
  });
});

// ✅ Start the server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ✅ Default route
app.get("/", (req, res) => {
  res.send("Hello World!");
});
