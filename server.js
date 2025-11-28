const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let queue = []; // kutayotganlar ro'yxati

function matchUsers() {
    while (queue.length >= 2) {
        const userA = queue.shift();
        const userB = queue.shift();

        const socketA = io.sockets.sockets.get(userA);
        const socketB = io.sockets.sockets.get(userB);

        if (!socketA || !socketB) continue;

        socketA.partnerId = userB;
        socketB.partnerId = userA;

        socketA.emit("partner_found", userB);
        socketB.emit("partner_found", userA);

        console.log("Matched:", userA, userB);
    }
}

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // user yangi partner izlaydi
    socket.on("find_partner", () => {
        // avval eski partnerdan ajratamiz
        if (socket.partnerId) {
            io.to(socket.partnerId).emit("partner_left");
            const partner = io.sockets.sockets.get(socket.partnerId);
            if (partner) partner.partnerId = null;
            socket.partnerId = null;
        }

        // queue ga qo'shamiz
        if (!queue.includes(socket.id)) {
            queue.push(socket.id);
        }

        matchUsers();
    });

    // WebRTC signal
    socket.on("signal", data => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal
        });
    });

    // disconnect
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        queue = queue.filter(id => id !== socket.id);

        if (socket.partnerId) {
            io.to(socket.partnerId).emit("partner_left");
            const partner = io.sockets.sockets.get(socket.partnerId);
            if (partner) partner.partnerId = null;
        }
    });
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));

