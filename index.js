const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ======================
// НАСТРОЙКИ
// ======================
const SIZE = 50;
const COOLDOWN = 5000;
const PIXELS_PER_MINUTE = 12;
const BATTLE_DURATION = 10 * 60 * 1000;

// ======================
// СОСТОЯНИЕ ИГРЫ
// ======================
let canvas = Array.from({ length: SIZE }, () =>
  Array.from({ length: SIZE }, () => ({
    color: "#FFFFFF",
    userId: null
  }))
);

const startTime = Date.now();

function isBattleActive() {
  return Date.now() - startTime < BATTLE_DURATION;
}

// анти-спам
let lastClick = {};
let rateLimit = {};

// ======================
// SOCKET LOGIC
// ======================
io.on("connection", (socket) => {
  console.log("User connected");

  // отправляем состояние
  socket.emit("init", {
    canvas,
    startTime,
    duration: BATTLE_DURATION
  });

  socket.on("pixel", ({ x, y, color, userId }) => {
    const now = Date.now();

    // защита
    if (!userId) return;
    if (!isBattleActive()) return;

    // координаты
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;

    // кулдаун
    if (lastClick[userId] && now - lastClick[userId] < COOLDOWN) return;
    lastClick[userId] = now;

    // лимит
    if (!rateLimit[userId]) {
      rateLimit[userId] = { count: 0, lastTime: now };
    }

    if (now - rateLimit[userId].lastTime > 60000) {
      rateLimit[userId].count = 0;
      rateLimit[userId].lastTime = now;
    }

    rateLimit[userId].count++;
    if (rateLimit[userId].count > PIXELS_PER_MINUTE) return;

    // обновление
    canvas[y][x] = { color, userId };

    io.emit("update", { x, y, color, userId });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ======================
server.listen(3000, () => {
  console.log("Server running on port 3000");
});