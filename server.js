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
const roomMetadata = {} ;

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

 
  // socket.on('sendPublicMessage', (message) => {
  //   if (message && message.text) {
  //      message.timestamp = new Date().toISOString(); 
  //     console.log(`[PUBLIC MSG] from ${message.user} (${socket.id}): "${message.text}"`);
  //     publicMessageHistory.push(message);
  //     io.emit('receivePublicMessage', message); 
  //   }
  // });



 
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

  
socket.on('createGroup', (data) => {
    const { groupName, userIds } = data; 
    const roomId = `room_${socket.id}`;
    
     roomMetadata[roomId] = {
        creator: socket.id,
        members: userIds 
    };
    
    userIds.forEach(id => {
        io.to(id).emit('invitedToGroup', {
            roomId,
            groupName,
            creator: socket.id,
            members: userIds
        });
    });

    console.log(`[GROUP] "${groupName}" created by ${socket.id}. Room ID: ${roomId}`);
});

socket.on('joinGroupRoom', (roomId) => {
    socket.join(roomId);
    const members = roomMetadata[roomId]?.members || [];
    console.log(`[JOIN] ${socket.id}  joined group room: ${roomId}`);
});

socket.on('sendGroupMessage', (data) => {
    const { roomId, message } = data;
    
    io.to(roomId).emit('receiveGroupMessage', { roomId, message });
    console.log(`[GROUP MSG] in ${roomId}: ${message.text}`);
});




});



const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
