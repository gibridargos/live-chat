const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------
// Queue for pairing
// ------------------
let queue = [];

function matchUsers() {
    if (queue.length >= 2) {
        const userA = queue.shift();
        const userB = queue.shift();

        // ular bir-birini bilsin
        io.sockets.sockets.get(userA).partnerId = userB;
        io.sockets.sockets.get(userB).partnerId = userA;

        io.to(userA).emit("partner_found", userB);
        io.to(userB).emit("partner_found", userA);

        console.log("Matched:", userA, userB);

        // Admin panelga yangilangan user list jo’natish
        sendUsersToAdmin();
    }
}

// ------------------
// User Connection
// ------------------
io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // Foydalanuvchi partner izlaydi
    socket.on("find_partner", () => {
        queue.push(socket.id);
        matchUsers();
        sendUsersToAdmin();
    });

    // WebRTC signal almashish
    socket.on("signal", data => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal
        });
    });

    // Foydalanuvchi chiqib ketganda
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        queue = queue.filter(id => id !== socket.id);

        // partneri bo’lsa unga aytamiz
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

    // Admin ulanishi bilan ro’yxat yuborish
    sendUsersToAdmin();

    // Admin foydalanuvchini kick qilsa
    socket.on("kick_user", id => {
        if (io.sockets.sockets.get(id)) {
            io.sockets.sockets.get(id).disconnect(true);
            console.log("User kicked:", id);
        }
        sendUsersToAdmin();
    });
});

// Admin panelga foydalanuvchilar ro'yxati yuborish
function sendUsersToAdmin() {
    const users = Array.from(io.sockets.sockets.keys());
    admin.emit("users", users);
}

// ------------------
app.use(express.static("public"));
// ------------------

server.listen(3000, () => console.log("Server running on port 3000"));
