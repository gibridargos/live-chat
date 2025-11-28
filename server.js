const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ------------------
// Queue for pairing
// ------------------
let queue = [];

function matchUsers() {
    if (queue.length >= 2) {
        const userA = queue.shift();
        const userB = queue.shift();

        io.sockets.sockets.get(userA).partnerId = userB;
        io.sockets.sockets.get(userB).partnerId = userA;

        io.to(userA).emit("partner_found", userB);
        io.to(userB).emit("partner_found", userA);

        sendUsersToAdmin();
        console.log("Matched:", userA, userB);
    }
}

// ------------------
// User Connection
// ------------------
io.on("connection", socket => {
    console.log("User connected:", socket.id);

    socket.on("find_partner", () => {
        queue.push(socket.id);
        matchUsers();
        sendUsersToAdmin();
    });

    socket.on("signal", data => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        queue = queue.filter(id => id !== socket.id);

        if (socket.partnerId) {
            io.to(socket.partnerId).emit("partner_left");
        }

        sendUsersToAdmin();
    });
});

// ------------------
// Admin namespace
// ------------------
const admin = io.of("/admin");

admin.on("connection", socket => {
    console.log("Admin connected");

    sendUsersToAdmin();

    socket.on("kick_user", id => {
        if (io.sockets.sockets.get(id)) {
            io.sockets.sockets.get(id).disconnect(true);
        }
        sendUsersToAdmin();
    });
});

// ------------------
// Send users list to admin
// ------------------
function sendUsersToAdmin() {
    const users = [...io.sockets.sockets.keys()];
    admin.emit("users", users);
}

// ------------------
// STATIC FILES
// ------------------
app.use(express.static("public"));

// ------------------
// LISTEN PORT (Railway)
// ------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
