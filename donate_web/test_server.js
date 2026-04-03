console.log('START TEST');
const express = require('express');
console.log('EXPRESS LOADED');
const http = require('http');
const socketIo = require('socket.io');
console.log('SOCKET.IO LOADED');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
console.log('IO INITIALIZED');
server.listen(3001, () => {
    console.log('LISTENING ON 3001');
    process.exit(0);
});
