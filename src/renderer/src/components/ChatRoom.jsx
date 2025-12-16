import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { v4 as uuidv4 } from 'uuid';

const storageKey = 'reactChatSession';


const getStoredSession = () => JSON.parse(localStorage.getItem(storageKey)) || { username: null, histories: { 'PUBLIC': [] } };

const setStoredSession = (data) => localStorage.setItem(storageKey, JSON.stringify(data));

function ChatRoom() {
  const [input, setInput] = useState(''); 
 
  const [sessionData, setSessionData] = useState(getStoredSession());
  const [username, setUsername] = useState(sessionData.username); 
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [activeRecipientId, setActiveRecipientId] = useState('PUBLIC');
  const [allChatMessages, setAllChatMessages] = useState(sessionData.histories);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const updateAllMessagesAndPersist = useCallback((updatedHistories) => {
    setAllChatMessages(updatedHistories);
    
    setStoredSession({ username: username, histories: updatedHistories });
  }, [username]);


  const addMessageToHistory = useCallback((message, chatId) => {
      const targetChatId = chatId || 'PUBLIC';
      setAllChatMessages(prevHistories => {
          const updatedMessagesForChat = [...(prevHistories[targetChatId] || []), message];
          const updatedHistories = { ...prevHistories, [targetChatId]: updatedMessagesForChat };
          
          
          setStoredSession({ username: username, histories: updatedHistories });
          
          return updatedHistories;
      });
  }, [username]);


  useEffect(() => {
    if (username) {
        socket.emit('registerName', username); 
    }
    
    socket.on('connect', () => {
        if (username) {
            socket.emit('registerName', username); 
        }
    });

    socket.on('updateUserList', (users) => {
        setConnectedUsers(users.filter(user => user.id !== socket.id));
    });

    socket.on('messageHistory', (history) => {
       
        setAllChatMessages(prev => {
            const updatedHistories = {...prev, 'PUBLIC': history};
            setStoredSession({ username: username, histories: updatedHistories });
            return updatedHistories;
        });
    });
    
    socket.on('receivePublicMessage', (message) => {
        
        if (message.user !== username) { 
            addMessageToHistory(message, 'PUBLIC');
        }
    });
    
    socket.on('receivePrivateMessage', (data) => {
        const { senderId, message } = data;
        
        if (senderId !== socket.id) { 
            const chatId = senderId; 
            addMessageToHistory({...message, isPrivate: true}, chatId);
        }
    });

    return () => {
      socket.off('connect');
      socket.off('updateUserList');
      socket.off('receivePublicMessage');
      socket.off('receivePrivateMessage');
      socket.off('messageHistory');
    };
  }, [username, addMessageToHistory]);


  useEffect(() => {
    scrollToBottom();
  }, [allChatMessages, activeRecipientId]);
  
  useEffect(() => {
    if (username && inputRef.current) {
        inputRef.current.focus();
    }
  }, [username]);


  const sendMessage = (e) => {
    e.preventDefault();
    
    if (input.trim() && username) {
      const messageBody = { text: input, user: username, id: uuidv4(), timestamp: new Date().toISOString() };
      
      if (activeRecipientId === 'PUBLIC') {
        socket.emit('sendPublicMessage', messageBody); 
        addMessageToHistory(messageBody, 'PUBLIC'); 
      } else {
        socket.emit('sendPrivateMessage', { recipientId: activeRecipientId, message: messageBody });
        addMessageToHistory({...messageBody, isPrivate: true}, activeRecipientId); 
      }
      
      setInput(''); 
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    const name = input.trim();
    if (name) {
      setUsername(name); 
      socket.emit('registerName', name); 
      setInput(''); 
      setStoredSession({ username: name, histories: allChatMessages });
    }
  };
  
  const handleLogout = () => {
    setUsername(null);
    setAllChatMessages({'PUBLIC': []}); 
    setActiveRecipientId('PUBLIC');
    localStorage.removeItem(storageKey); 
    socket.disconnect(); 
    socket.connect(); 
  };


  const getRecipientName = (id) => {
    if (id === 'PUBLIC') return 'Group Chat';
    const user = connectedUsers.find(u => u.id === id);
    return user ? user.name : `Offline User (${id.substring(0, 5)}...)`;
  };

  const handleRecipientChange = (id) => {
    setActiveRecipientId(id);
  };

  
  const formatTime = (isoString) => {
    if (!isoString) return 'Just now';
    
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  
  if (!username) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '100px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h1>Enter Your Name</h1>
        <form onSubmit={handleNameSubmit}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Your Name" required/>
          <button type="submit">Submit</button>
        </form>
      </div>
    );
  }

  const currentMessages = allChatMessages[activeRecipientId] || [];
 
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      
      <div style={{ width: '200px', padding: '10px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
        <h3>Users/Rooms</h3>
        <button 
            onClick={() => handleRecipientChange('PUBLIC')}
            style={{ display: 'block', width: '100%', marginBottom: '5px', fontWeight: activeRecipientId === 'PUBLIC' ? 'bold' : 'normal', textAlign: 'left' }}
        >
            Group Chat
        </button>
        <hr />
        {connectedUsers.map(user => (
            <button 
                key={user.id} 
                onClick={() => handleRecipientChange(user.id)}
                style={{ display: 'block', width: '100%', marginBottom: '5px', fontWeight: activeRecipientId === user.id ? 'bold' : 'normal', textAlign: 'left' }}
            >
                * {user.name}
            </button>
        ))}
      </div>

      {/* Main Chat Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>
                {`Chat: ${getRecipientName(activeRecipientId)}`}
            </h1>
            <button onClick={handleLogout} style={{ padding: '5px 10px', background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Logout
            </button>
        </div>
        <p>Logged in as: <strong>{username}</strong></p>

        <div style={{ flexGrow: 1, overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
          {currentMessages.map((msg) => ( 
            <div key={msg.id} style={{ marginBottom: '8px', textAlign: msg.user === username ? 'right' : 'left' }} >
              <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.8em', color: '#555' }}>
                {msg.user} {msg.isPrivate ? '(Private)' : ''}
               
              </span>
              <div style={{ display: 'inline-block', padding: '8px 12px', borderRadius: '15px', backgroundColor: msg.user === username ? '#007bff' : '#e9e9e9', color: msg.user === username ? 'white' : 'black' }}>
                {msg.text} <span style={{ fontWeight: 'normal', fontSize: '0.5em', marginLeft: '10px', color: '#000000ff' }}>
                    {formatTime(msg.timestamp)}
                </span>
              </div>
               
            </div>
          ))}
          <div ref={messagesEndRef} /> 
        </div>

        <form onSubmit={sendMessage} style={{ display: 'flex' }}>
          <input 
            ref={inputRef}
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={`Message ${getRecipientName(activeRecipientId)}...`} 
            style={{ flexGrow: 1, padding: '10px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
          />
          <button type="submit" style={{ padding: '10px 15px' }}>
            Send
          </button>
        </form>
       </div>
    </div>
  );
}

export default ChatRoom;
