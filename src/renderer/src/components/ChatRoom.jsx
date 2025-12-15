

import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(''); 
  const [username, setUsername] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    
    socket.on('messageHistory', (history) => {
      setMessages(history);
    });

    socket.on('receiveMessage', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });
    
    
    scrollToBottom(); 

    return () => {
      socket.off('receiveMessage');
      socket.off('messageHistory');
    };
  }, [messages]); 


  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && username) {
      const messageBody = { 
        text: input, 
        user: username, 
        id: Date.now() 
      };
      socket.emit('sendMessage', messageBody); 
      setInput(''); 
    }
  };

  
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      setUsername(input.trim()); 
      setInput(''); 
    }
  };


    if (!username) {
   
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '100px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h1>Enter Your Name</h1>
        <form onSubmit={handleNameSubmit}>
            <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)}  
                style={{ marginBottom: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#f0f0f0', width: '100%' }} 
                placeholder="Your Name"
                required
            />
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Submit
          </button>
        </form>
      </div>
    );
  }


 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '10px' }}>Electron React Chat Room</h1>
      
   
      <div>
       <p>Logged in as: <strong>{username}</strong></p>

      <div style={{ flexGrow: 1, overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '8px', textAlign: msg.user === username ? 'right' : 'left' }} >
            <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.8em', color: '#555' }}>
              {msg.user}
            </span>
            <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: '15px', backgroundColor: msg.user === username ? '#007bff' : '#e9e9e9', color: msg.user === username ? 'white' : 'black' }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> 
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex' }}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." style={{ flexGrow: 1, padding: '10px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: '10px 15px', borderRadius: '4px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
          Send
        </button>
      </form>
     </div>
    </div>
  );
}

export default ChatRoom;
