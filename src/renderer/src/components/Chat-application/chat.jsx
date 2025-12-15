

import React, { useState, useEffect } from "react";
import { socket } from "../../socket";

function Chat() {
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [users, setUsers] = useState({});

  const joinChat = () => {
    socket.emit("join", username);
    setIsJoined(true);
  };

  useEffect(() => {
    
    socket.on("receive-message", (data) => {
      setChat(prev => [...prev, data]);
    });
    
    socket.on("online-users", (data) => {
      setUsers(data);
    });

    return () => {
      socket.off("receive-message");
      socket.off("online-users");
    };
  }, []);

  const sendMessage = () => {
    const data = { user: username, message };
    
    
    socket.emit("send-message", data);

    setChat(prev => [...prev, data]);
    setMessage("");
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <div style={{ width: "25%", background: "#eee", padding: "10px" }}>
        <h2>Online Users</h2>
        {Object.values(users).map((u) => <div key={u}>{u}</div>)}
      </div>

      
      <div style={{ flex: 1, padding: "20px" }}>
        {!isJoined ? (
          <div>
            <input 
              type="text" 
              placeholder="Enter name" 
              onChange={(e) => setUsername(e.target.value)} 
            />
            <button onClick={joinChat}>Join Chat</button>
          </div>
        ) : (
          <>
            <div style={{ height: "80%", overflowY: "auto" }}>
              
              {chat.map((c, i) => (
                <p key={i}><strong>{c.user}:</strong> {c.message}</p>
              ))}
            </div>
            <div style={{ display: "flex" }}>
              <input 
                style={{ flex: 1 }} 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
               
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                }}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
            <div>
              <small>Logged in as: {username}</small>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Chat;
