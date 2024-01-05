const express = require("express");
const app = express();
const PORT = 3001;

const cors = require("cors");

app.use(cors());

const server = require("http").Server(app);
const { Server } = require("socket.io");

let roomsData = new Map();

class UserData {
  constructor(username, socket) {
    this.username = username;
    this.socket = socket;
  }

  toString() {
    return `(this.username = ${this.username}, this.socket=${this.socket})`;
  }
}

const MAX_USER_NUMBER = 2;

class RoomData {
  constructor(username = null, ...user) {
    this.users = [];
    if (username !== null) {
      this.newConnect(username, ...user);
    }
  }

  newConnect(username, ...user) {
    if (this.users.length === MAX_USER_NUMBER) this.users.shift();
    this.users.push(new UserData(username, ...user));
  }
}

// create instant connection
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`${socket.id} user connected!`);
  const { username, roomname } = socket.request._query;
  console.log(username, roomname);

  if (roomsData.get(roomname) !== undefined) {
    roomsData.get(roomname).newConnect(username, socket);
  } else {
    roomsData.set(roomname, new RoomData(username, socket));
  }

  console.log(
    "users_in_room",
    roomsData.get(roomname).users.map((user) => ({
      username: user.username,
      socket_id: user.socket.id,
    }))
  );

  socket.on("offer", (data) => {
    if (roomsData.get(roomname) !== undefined) {
      roomsData.get(roomname).users.forEach((user) => {
        if (user.username !== username) user.socket.emit("remoteOffer", data);
      });
    }
  });

  socket.on("answer", (data) => {
    if (roomsData.get(roomname) !== undefined) {
      roomsData.get(roomname).users.forEach((user) => {
        if (user.username !== username) user.socket.emit("remoteAnswer", data);
      });
    }
  });

  socket.on("candidate", (data) => {
    if (roomsData.get(roomname) !== undefined) {
      roomsData.get(roomname).users.forEach((user) => {
        if (user.username !== username)
          user.socket.emit("remoteCandidate", data);
      });
    }
  });

  socket.on("disconnect", (what) => {
    console.log(what);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
