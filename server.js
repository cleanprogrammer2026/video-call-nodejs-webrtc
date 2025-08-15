const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // If you host behind a proxy/HTTPS, configure CORS/origins as needed
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  // Join room
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    const clients = io.sockets.adapter.rooms.get(roomId) || new Set();
    // Let others in the room know a new peer arrived
    socket.to(roomId).emit("peer-joined", { socketId: socket.id });
    // Let the joiner know who’s already in
    socket.emit("peers-in-room", { peers: [...clients].filter(id => id !== socket.id) });
  });

  // Relay signaling messages within the room
  socket.on("signal", ({ roomId, to, data }) => {
    if (to) {
      // direct to a specific peer (recommended)
      io.to(to).emit("signal", { from: socket.id, data });
    } else {
      // broadcast (not recommended for multi-peer)
      socket.to(roomId).emit("signal", { from: socket.id, data });
    }
  });

  socket.on("leave", ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit("peer-left", { socketId: socket.id });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("peer-left", { socketId: socket.id });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
