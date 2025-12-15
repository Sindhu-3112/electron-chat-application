const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' })); 


const server = http.createServer(app);


const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});


let messageHistory = [];


io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  
  socket.emit('messageHistory', messageHistory);


  socket.on('sendMessage', (message) => {
    
    if (message && message.text && message.user && message.id) {
      console.log(`Received message from ${message.user}: ${message.text}`);
      
     messageHistory.push(message);
    
     io.emit('receiveMessage', message);
    }
  });


  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Chat server running on [http://localhost:${PORT}](http://localhost:4000)`);
});
