// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const cors = require('cors');

// const app = express();

// app.use(cors({ origin: '*' })); 


// const server = http.createServer(app);


// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//     methods: ["GET", "POST"]
//   }
// });


// let messageHistory = [];


// io.on('connection', (socket) => {
//   console.log(`User connected: ${socket.id}`);
//   socket.emit('messageHistory', messageHistory);
//   socket.on('sendMessage', (message) => {
    
//     if (message && message.text && message.user && message.id) {
//       console.log(`Received message from ${message.user}: ${message.text}`);
      
//      messageHistory.push(message);
    
//      io.emit('receiveMessage', message);
//     }
//   });


//   socket.on('disconnect', () => {
//     console.log(`User disconnected: ${socket.id}`);
//   });
// });

// const PORT = process.env.PORT || 4000;

// server.listen(PORT, () => {
//   console.log(`Chat server running on [http://localhost:${PORT}](http://localhost:4000)`);
// });




// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const cors = require('cors');

// const app = express();
// app.use(cors({ origin: '*' }));
// const server = http.createServer(app);

// const io = socketIo(server, {
//   cors: {
//     origin: '*',
//     methods: ["GET", "POST"]
//   }
// });

// const connectedUsers = {}; 
// let publicMessageHistory = [];


// function broadcastUserList() {
    
//     const usersArray = Object.keys(connectedUsers).map(id => ({
//         id: id,
//         name: connectedUsers[id]
//     }));
//     io.emit('updateUserList', usersArray);
// }

// io.on('connection', (socket) => {
//   console.log(`User connected: ${socket.id}`);

 
//   socket.on('registerName', (username) => {
//     connectedUsers[socket.id] = username;
//     console.log(`User ${socket.id} registered as: ${username}`);
//     broadcastUserList(); 
//   });

//   socket.emit('messageHistory', publicMessageHistory);


//   socket.on('sendPublicMessage', (message) => {
//     if (message && message.text) {
//       publicMessageHistory.push(message);
//       io.emit('receivePublicMessage', message); 
//     }
//   });

  
//   socket.on('sendPrivateMessage', (data) => {
//     const { recipientId, message } = data;
//     if (message && recipientId) {
      
//       socket.to(recipientId).emit('receivePrivateMessage', { senderId: socket.id, message });
//       socket.emit('receivePrivateMessage', { senderId: socket.id, message });
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log(`User disconnected: ${socket.id}`);
//     delete connectedUsers[socket.id]; 
//     broadcastUserList();  
//   });
// });

// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => {
//   console.log(`Chat server running on http://localhost:${PORT}`);
// });


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

const connectedUsers = {}; 
let publicMessageHistory = [];

function broadcastUserList() {
    const usersArray = Object.keys(connectedUsers).map(id => ({
        id: id,
        name: connectedUsers[id]
    }));
    io.emit('updateUserList', usersArray);
}

io.on('connection', (socket) => {
  console.log(`[CONNECT] User connected: ${socket.id}`);

  socket.on('registerName', (username) => {
    connectedUsers[socket.id] = username;
    console.log(`[REGISTER] User ${socket.id} registered as: ${username}`);
    broadcastUserList(); 
  });

  socket.emit('messageHistory', publicMessageHistory);

 
  socket.on('sendPublicMessage', (message) => {
    if (message && message.text) {
       message.timestamp = new Date().toISOString(); 
      console.log(`[PUBLIC MSG] from ${message.user} (${socket.id}): "${message.text}"`);
      publicMessageHistory.push(message);
      io.emit('receivePublicMessage', message); 
    }
  });

 
  socket.on('sendPrivateMessage', (data) => {
    const { recipientId, message } = data;
    if (message && recipientId && message.text) {
       message.timestamp = new Date().toISOString(); 
      console.log(`[PRIVATE MSG] from ${message.user} (${socket.id}) to (${recipientId}): "${message.text}"`);

      
      socket.to(recipientId).emit('receivePrivateMessage', { senderId: socket.id, message });
      

      socket.emit('receivePrivateMessage', { senderId: socket.id, message });

    } else {
      console.log("[ERROR] Invalid private message data received:", data);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUserName = connectedUsers[socket.id] || socket.id;
    console.log(`[DISCONNECT] User disconnected: ${disconnectedUserName} (${socket.id})`);
    delete connectedUsers[socket.id]; 
    broadcastUserList();  
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
