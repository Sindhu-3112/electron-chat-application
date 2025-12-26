const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');


const app = express();
app.use(cors({ origin: '*' }));
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: 'https://electron-chat-application-3.onrender.com',
    //  origin: '*',
    methods: ["GET", "POST"],
    credentials: true
  }
});

const connectedUsers = {}; 
let publicMessageHistory = [];
const roomMetadata = {} ;
const users = {};

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
    //  io.emit("user_list", Object.values(users)); 
    broadcastUserList(); 
  });

  socket.emit('messageHistory', publicMessageHistory);
 socket.on('sendPrivateMessage', (data) => {
    const { recipientId, message } = data;
    if (message && recipientId && message.text) {
       message.timestamp = new Date().toISOString();
        const senderName = connectedUsers[socket.id]; 
      console.log(`[PRIVATE MSG] from ${message.user} (${socket.id}) to (${recipientId}): "${message.text}"`);

      
      socket.to(recipientId).emit('receivePrivateMessage', { senderId: socket.id, senderName: connectedUsers[socket.id], message });
      
       io.to(recipientId).emit('newNotification', {
      from: senderName,
      text: message.text,
      chatId: socket.id 
    });
     console.log(`[NOTIFICATION DEBUG] Private notification sent to ${recipientId} from ${senderName}`);

      socket.emit('receivePrivateMessage', { senderId: socket.id, message });

    } else {
      console.log("[ERROR] Invalid private message data received:", data);
    }
  });

  socket.on('disconnect', () => {
    const disconnectedUserName = connectedUsers[socket.id] || socket.id;
    console.log(`[DISCONNECT] User disconnected: ${disconnectedUserName} (${socket.id})`);
    delete connectedUsers[socket.id]; 
    //  io.emit("user_list", Object.values(users));
    broadcastUserList();  
  });

  
socket.on('createGroup', (data) => {
    const { groupName, userIds } = data; 
    const roomId = `room_${socket.id}`;
    
     roomMetadata[roomId] = {
        creator: socket.id,
         admins: [socket.id], 
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
socket.on('toggleAdmin', (data) => {
    const { roomId, userId, action } = data; // action: 'add' or 'remove'
    const room = roomMetadata[roomId];

    // Only existing admins (including creator) can promote/demote others
    if (room && room.admins.includes(socket.id)) {
        if (action === 'add' && !room.admins.includes(userId)) {
            room.admins.push(userId);
        } else if (action === 'remove' && userId !== room.creator) {
            // Demote user, but never allow demoting the creator
            room.admins = room.admins.filter(id => id !== userId);
        }

        // Notify everyone in the room about the updated admin list
        io.to(roomId).emit('updateAdminList', { roomId, admins: room.admins });
    }
});


socket.on('joinGroupRoom', (roomId) => {
    socket.join(roomId);
     const memberIds = roomMetadata[roomId]?.members || [];
    const memberDetails = memberIds.map(id => ({
        id: id,
        name: connectedUsers[id] || "Unknown User"
    }));
  io.to(roomId).emit('updateRoomParticipants', { 
        roomId, 
        members: memberDetails 
    });
    console.log(`[JOIN] ${socket.id}  joined group room: ${roomId}`);
});

socket.on('sendGroupMessage', (data) => {
    const { roomId, message } = data;
    
    io.to(roomId).emit('receiveGroupMessage', { roomId, message });
    console.log(`[GROUP MSG] in ${roomId}: ${message.text}`);

     socket.to(roomId).emit('newNotification', {
      from: `${message.user} (Group)`,
      text: message.text,
      chatId: roomId
    });
     console.log(`[NOTIFICATION DEBUG] Group notification sent to room ${roomId} from ${message.user}`);
});


socket.on('invitedToGroup', (groupData) => {
    const { roomId, groupName, creator, members } = groupData;
    socket.emit('joinGroupRoom', roomId);
    console.log(`[INVITE] ${socket.id} invited to group "${groupName}" (${roomId})`);
   
    setAllChatMessages(prev => ({
        ...prev,
        [roomId]: [] 
    }));

   
    setConnectedUsers(prev => {
        if (prev.find(u => u.id === roomId)) return prev;
        return [...prev, { id: roomId, name: groupName, isGroup: true, creator, members }];
    });
});

socket.on('updateGroupMembers', (data) => {
    const { roomId, userId, action } = data;
    const room = roomMetadata[roomId];

    
    if (room && room.creator === socket.id) {
        
        if (action === 'add') {
             const addedUserName = connectedUsers[userId] || "A user";
             const adminName = connectedUsers[socket.id];
     io.to(roomId).emit('receiveGroupMessage', { 
        roomId, 
        message: {
            text: `${adminName} added  ${addedUserName}`,
            user: "System",
            timestamp: new Date().toISOString(),
            isSystem: true 
        }
    });
    console.log (`USER ADDED  ${addedUserName} `);
          
            const targetSocket = io.sockets.sockets.get(userId);
            
            if (targetSocket) {
                targetSocket.join(roomId); 
                
                if (!room.members.includes(userId)) {
                    room.members.push(userId);
                }

                
                io.to(userId).emit('invitedToGroup', { 
                    roomId, 
                    groupName: room.groupName, 
                    creator: room.creator, 
                    members: room.members 
                });
            }
        }
        
       
if (action === 'remove') {
    const removedUserName = connectedUsers[userId] || "A user";
    const adminName = connectedUsers[socket.id];
     io.to(roomId).emit('receiveGroupMessage', { 
        roomId, 
        message: {
            text: `${adminName} removed ${removedUserName}`,
            user: "System",
            timestamp: new Date().toISOString(),
            isSystem: true 
        }
    });
    console.log (`USER REMOVED  ${removedUserName} `);
    room.members = room.members.filter(id => id !== userId);
    
   
    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) {
        targetSocket.leave(roomId); 
    }

    
    io.to(userId).emit('removedFromGroup', { roomId });

   
    const updatedDetails = room.members.map(id => ({
        id, name: connectedUsers[id] || "Unknown"
    }));
    io.to(roomId).emit('updateRoomParticipants', { roomId, members: updatedDetails });
}

       
        const updatedDetails = room.members.map(id => ({
            id, name: connectedUsers[id] || "Unknown"
        }));
        io.to(roomId).emit('updateRoomParticipants', { roomId, members: updatedDetails });
    }
});

socket.on('delete_message', ({ messageId, recipientId, type }) => {
  if (type === 'everyone') {
    const recipientSocket = users[recipientId]?.socketId;
    if (recipientSocket) {
      // Tell the RECIPIENT that the message from 'username' (the sender) is deleted
      io.to(recipientSocket).emit('message_deleted', { 
        messageId, 
        chatPartnerId: username // The recipient looks in the sender's chat history
      });
    }
  }
  
  // Always tell the SENDER to update their own UI and Store
  socket.emit('message_deleted', { 
    messageId, 
    chatPartnerId: recipientId 
  });
});





});




const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
