import { useState, useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket'
import { v4 as uuidv4 } from 'uuid'

// const storageKey = 'reactChatSession'
// const getStoredSession = () =>
//   JSON.parse(localStorage.getItem(storageKey)) || { username: null, histories: {} }
// const setStoredSession = (data) => localStorage.setItem(storageKey, JSON.stringify(data))

function ChatRoom() {
  const [input, setInput] = useState('')
  // const [sessionData] = useState(getStoredSession())
  const [username, setUsername] =useState(null);
  const [connectedUsers, setConnectedUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [activeRecipientId, setActiveRecipientId] = useState(null)
  // const [allChatMessages, setAllChatMessages] = useState(sessionData.histories)
  const [allChatMessages,setAllChatMessages] = useState({})
  const [roomMembers, setRoomMembers] = useState({})
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [selectedNewMembers, setSelectedNewMembers] = useState([])
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [disabledGroups, setDisabledGroups] = useState([]);


  const currentGroupMembers = roomMembers[activeRecipientId] || []
  const availableUsersToAdd = connectedUsers.filter(
    (user) =>
      !user.isGroup &&
      !currentGroupMembers.some((member) => member.id === user.id) &&
      user.id !== socket.id
  )

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)


  const activeRoom = connectedUsers.find((u) => u.id === activeRecipientId)
  const isCreator = activeRoom?.isGroup && activeRoom?.creator === socket.id
  const participants = roomMembers[activeRecipientId] || activeRoom?.members || []

 
  const saveToElectronStore = async (newUsername, newHistories) => {
  if (!window.electronAPI) return;
  await window.electronAPI.setStoreData('username', newUsername);
  await window.electronAPI.setStoreData('histories', newHistories);
};
const saveToStore = async (newUsername, newHistories) => {
  const data = { username: newUsername, histories: newHistories };

  if (window.electronAPI) {
    // ELECTRON: Save to physical file
    await window.electronAPI.setStoreData('reactChatSession', data);
  } else {
    // BROWSER: Save to browser storage
    localStorage.setItem('reactChatSession', JSON.stringify(data));
  }
};



  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const addMessageToHistory = useCallback(
  (message, chatId) => {
    setAllChatMessages((prevHistories) => {
      const updatedMessagesForChat = [...(prevHistories[chatId] || []), message];
      const updatedHistories = { ...prevHistories, [chatId]: updatedMessagesForChat };

       saveToStore(username, updatedHistories); // ✅ persist to Electron Store

      return updatedHistories;
    });
  },
  [username]
);

  
  // To update group members when users added or removed from group
  useEffect(() => {
    socket.on('updateRoomParticipants', ({ roomId, members }) => {
      setRoomMembers((prev) => ({
        ...prev,
        [roomId]: members
      }))
    })

    return () => {
      socket.off('updateRoomParticipants')
    }
  }, [])

  //To send username to the socket server and handle incoming events

  useEffect(() => {
    if (username) socket.emit('registerName', username)

    socket.on('connect', () => {
      if (username) socket.emit('registerName', username)
    })

    socket.on('updateUserList', (users) => {
      setConnectedUsers(users.filter((user) => user.id !== socket.id))
    })

    socket.on('receivePrivateMessage', (data) => {
      const { senderId, message } = data
      if (senderId !== socket.id) {
        addMessageToHistory({ ...message, isPrivate: true }, senderId)
      }
       if (senderId !== activeRecipientId) {
    setUnreadCounts((prev) => ({
      ...prev,
      [senderId]: (prev[senderId] || 0) + 1
    }));
  }
    })
    

    return () => {
      socket.off('connect')
      socket.off('updateUserList')
      socket.off('receivePrivateMessage')
    }
  }, [username, addMessageToHistory])

  useEffect(() => {
    scrollToBottom()
  }, [allChatMessages, activeRecipientId])
  
  //To handle when new user added to the existing group
  useEffect(() => {
    socket.on('invitedToGroup', (groupData) => {
      socket.emit('joinGroupRoom', groupData.roomId)

      setConnectedUsers((prev) => {
        if (prev.find((u) => u.id === groupData.roomId)) return prev
        return [
          ...prev,
          {
            id: groupData.roomId,
            name: groupData.groupName,
            isGroup: true,
            creator: groupData.creator,
            members: groupData.members
          }
        ]
      })
    })
    
  
    socket.on('updateRoomParticipants', ({ roomId, members }) => {
      setRoomMembers((prev) => ({ ...prev, [roomId]: members }))

      setConnectedUsers((prev) =>
        prev.map((user) =>
          user.id === roomId ? { ...user, members: members.map((m) => m.id) } : user
        )
      )
    })
  }, [])

   //To handle when user entered the group previous messages are not loaded
  useEffect(() => {
    socket.on('invitedToGroup', (groupData) => {
      const { roomId, groupName, creator, members } = groupData
      socket.emit('joinGroupRoom', roomId)

      setConnectedUsers((prev) => {
       
        if (prev.find((u) => u.id === roomId)) return prev

        return [
          ...prev,
          {
            id: roomId,
            name: groupName,
            isGroup: true,
            creator: creator,
            members: members
          }
        ]
      })
    })

    socket.on('receiveGroupMessage', (data) => {
      const { roomId, message } = data;

  if (roomId !== activeRecipientId) {
    setUnreadCounts((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] || 0) + 1
    }));
  }
      addMessageToHistory({ ...data.message, isGroup: true }, data.roomId)
    })

    return () => {
      socket.off('invitedToGroup')
      socket.off('receiveGroupMessage')
    }
  }, [addMessageToHistory])

  //To handle when the user removed from the group

//   useEffect(() => {
//     socket.on('removedFromGroup', ({ roomId }) => {
      
//         setConnectedUsers(prev => prev.filter(c => c.id !== roomId));
        
       
//         if (activeRecipientId === roomId) {
//             setActiveRecipientId(null);
//             alert("You have been removed from the group.");
//         }
//     });

//     return () => socket.off('removedFromGroup');
// }, [activeRecipientId]);

useEffect(() => {
  socket.on('removedFromGroup', ({ roomId }) => {
    // DO NOT filter connectedUsers anymore. 
    // Just mark it as disabled.
    setDisabledGroups((prev) => [...prev, roomId]);
    
    // Optional: alert the user
    if (activeRecipientId === roomId) {
       alert("You have been removed from this group. You can still view history.");
    }
  });

  return () => socket.off('removedFromGroup');
}, [activeRecipientId]);
useEffect(() => {
  if (activeRecipientId) {
    setUnreadCounts((prev) => ({
      ...prev,
      [activeRecipientId]: 0
    }));
  }
}, [activeRecipientId]);



 // To handle creating a new group with selected user and named the group


useEffect(() => {
  const loadData = async () => {
    let session;

    if (window.electronAPI) {
      // ELECTRON: Load from file
      session = await window.electronAPI.getStoreData('reactChatSession');
    } else {
      // BROWSER: Load from localStorage
      const localData = localStorage.getItem('reactChatSession');
      session = localData ? JSON.parse(localData) : null;
    }

    if (session) {
      if (session.username) setUsername(session.username);
      if (session.histories) setAllChatMessages(session.histories);
    }
    setIsLoaded(true);
  };

  loadData();
}, []);

useEffect(() => {
    socket.on('groupDisabled', ({ roomId }) => {
        setDisabledGroups(prev => [...prev, roomId]);
    });

    return () => socket.off('groupDisabled');
}, []);

useEffect(() => {
  socket.on('newNotification', (data) => {
    console.log("Notification received:", data); // You are seeing this now

    // 1. Check if the browser supports notifications
    if (!("Notification" in window)) return;

    // 2. Request permission if not already granted
    if (Notification.permission === "granted") {
      new Notification(`New Message from ${data.from}`, {
        body: data.text,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(`New Message from ${data.from}`, { body: data.text });
        }
      });
    }
  });

  return () => socket.off('newNotification');
}, [socket]);



//To handle creating the group 
 
 const handleCreateGroupSubmit = () => {
    if (selectedUsers.length > 0) {
      const groupName = prompt('Enter Group Name:')
      if (groupName) {
        socket.emit('createGroup', {
          groupName,
          userIds: [...selectedUsers, socket.id]
        })
        setIsCreatingGroup(false)
        setSelectedUsers([])
      }
    }
  }
  //To handle sending messages to private and group chat from the input box

  const sendMessage = (e) => {
    e.preventDefault()
    if (input.trim() && username && activeRecipientId) {
      const messageBody = {
        text: input,
        user: username,
        id: uuidv4(),
        timestamp: new Date().toISOString()
      }

      if (activeRecipientId.startsWith('room_')) {
        socket.emit('sendGroupMessage', { roomId: activeRecipientId, message: messageBody })
      } else {
        socket.emit('sendPrivateMessage', { recipientId: activeRecipientId, message: messageBody })
        addMessageToHistory({ ...messageBody, isPrivate: true }, activeRecipientId)
      }
      setInput('')
    }
  }

  useEffect(() => {
  // Listen for data forwarded from main.js
  const handleMainMessage = (event, data) => {
    addMessageToHistory(data.message, data.senderId);
  };

  if (window.electronAPI) {
    window.electronAPI.onSocketData(handleMainMessage);
  }
}, [addMessageToHistory]);

  
  //To handle user name submission
  const handleNameSubmit = (e) => {
  e.preventDefault();
  const name = input.trim();

  if (name) {
    setUsername(name);
    socket.emit('registerName', name);
     window.electronAPI.registerSocketUser(name);
     saveToStore(name, allChatMessages); // ✅
  }
};

 
   const handleLogout = () => {
    setUsername(null);
    setAllChatMessages({ 'PUBLIC': [] });
    window.electronAPI.clearStore();
    window.location.reload();
  };
  //To get recipient name either group or private chat
  const getRecipientName = (id) => {
    const user = connectedUsers.find((u) => u.id === id)
    return user ? user.name :'unknown user'
  }
  //To format time from ISO string to readable format which is used for timestamp
  const formatTime = (isoString) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleParticipantAction = (memberId, memberName) => {
 
  if (memberId === socket.id) return;

  if (isCreator) {
   
    const choice = window.confirm(
      `Options for ${memberName}:\n\n- Click OK to REMOVE from group\n- Click CANCEL to Open Private Chat`
    );

    if (choice) {
      
      socket.emit('updateGroupMembers', {
        roomId: activeRecipientId,
        userId: memberId,
        action: 'remove',
      });
    } else {
      
      setActiveRecipientId(memberId);
    }
  } else {
    
    setActiveRecipientId(memberId);
  }
};

 if (!isLoaded) return <div>Loading...</div>;
  // To display welcome screen initially when chat box not opened
  if (!username) {
    return (
      <div
        style={{
          padding: '20px',
          maxWidth: '400px',
          margin: '100px auto',
          border: '1px solid #ccc',
          borderRadius: '8px',
          textAlign: 'center'
        }}
      >
        <h1>Welcome </h1>
        <form onSubmit={handleNameSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter Your Name"
            style={{ width: '90%', padding: '10px', marginBottom: '10px' }}
            required
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px',
              background: '#007bff',
              color: '#fff',
              border: 'none'
            }}
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '250px',
          padding: '15px',
          borderRight: '1px solid #ccc',
          backgroundColor: '#f4f4f4'
        }}
      >
        <h3>Chats</h3>
        <button onClick={() => setIsCreatingGroup(!isCreatingGroup)}>
          {isCreatingGroup ? 'Cancel Group' : 'Create Group'}
        </button>

        {isCreatingGroup && (
          <button onClick={handleCreateGroupSubmit} style={{ color: 'black' }}>
            ({selectedUsers.length}) User Added
          </button>
        )}
        <hr />
        {/* {connectedUsers.length === 0 ? (
          <p style={{ color: 'gray' }}>No users</p>
        ) : (
          connectedUsers.map((user) => (
            
            <button
              key={user.id}
              onClick={() => setActiveRecipientId(user.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                marginBottom: '5px',
                textAlign: 'left',
                background: activeRecipientId === user.id ? '#007bff' : 'transparent',
                color: activeRecipientId === user.id ? 'white' : 'black',
                border: '1px solid #ddd',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
            
              {isCreatingGroup && !user.isGroup && (
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) setSelectedUsers([...selectedUsers, user.id])
                    else setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                  }}
                />
              )}
              {user.name}

               {unreadCounts[user.id] > 0 && activeRecipientId !== user.id && (
      <span
        style={{
          backgroundColor: '#007bff', 
          color: 'white',
          borderRadius: '50%',
          padding: '2px 8px',
          fontSize: '12px',
          fontWeight: 'bold',
          minWidth: '20px',
          textAlign: 'center'
        }}
      >
        {unreadCounts[user.id]}
      </span>
    )}
            </button>
          ))
        )} */}
        {connectedUsers.length === 0 ? (
  <p style={{ color: 'gray' }}>No users</p>
) : (
  connectedUsers.map((user) => {
    const isDisabled = disabledGroups.includes(user.id);

    return (
      <button
        key={user.id}
        onClick={() => setActiveRecipientId(user.id)}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px',
          marginBottom: '5px',
          textAlign: 'left',
          background: activeRecipientId === user.id ? '#007bff' : 'transparent',
          color: activeRecipientId === user.id ? 'white' : isDisabled ? '#888' : 'black',
          border: '1px solid #ddd',
          borderRadius: '5px',
          cursor: 'pointer',
          borderLeft: isDisabled ? '5px solid #ccc' : '1px solid #ddd',
          opacity: isDisabled ? 0.7 : 1
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Checkbox for Group Creation - Only shows if not a group and not disabled */}
            {isCreatingGroup && !user.isGroup && !isDisabled && (
              <input
                type="checkbox"
                style={{ marginRight: '10px' }}
                onChange={(e) => {
                  if (e.target.checked) setSelectedUsers([...selectedUsers, user.id])
                  else setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                }}
              />
            )}
            
            <span>
              {user.name} 
              {isDisabled && <small style={{ marginLeft: '5px', fontStyle: 'italic' }}>(Removed)</small>}
            </span>
          </div>

          {/* Unread Message Badge */}
          {unreadCounts[user.id] > 0 && activeRecipientId !== user.id && (
            <span
              style={{
                backgroundColor: activeRecipientId === user.id ? 'white' : '#007bff',
                color: activeRecipientId === user.id ? '#007bff' : 'white',
                borderRadius: '8px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                minWidth: '18px',
                textAlign: 'center'
              }}
            >
              {unreadCounts[user.id]}
            </span>
          )}
        </div>
      </button>
    );
  })
)}

      </div>

      {/* Main Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2>
            {' '}
            Welcome <b>{username}</b>
          </h2>
          <div>
            <button
              onClick={handleLogout}
              style={{
                padding: '5px 10px',
                background: '#ff4d4d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Content Logic */}
        {!activeRecipientId ? (
          <div
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#fdfdfd'
            }}
          >
            <h1 style={{ color: '#555' }}>Hello, {username}!</h1>
            <p
              style={{ fontStyle: 'italic', color: '#888', maxWidth: '400px', textAlign: 'center' }}
            >
              Welcome To The Chat Application
            </p>
            <p style={{ marginTop: '20px', color: '#aaa' }}>
              Select a user from the sidebar to start chatting.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#fff' }}
            >
              <h2>Chat: {getRecipientName(activeRecipientId)}</h2>

              {activeRecipientId.startsWith('room_') && (
                <div style={{ fontSize: '0.85em', color: '#888' }}>
                  <strong>Members: </strong>

            

                 

<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
  {participants.map((m) => {
   
    const memberId = typeof m === 'string' ? m : m.id;
    const memberName = typeof m === 'string' ? getRecipientName(m) : m.name;

    return (
      <div key={memberId} style={{ position: 'relative' }}>
      
        <div
          onClick={(e) => {
            e.stopPropagation(); 
           
            setActiveMenuId(activeMenuId === memberId ? null : memberId);
          }}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '5px 15px',
            borderRadius: '20px',
            fontSize: '0.85em',
            cursor: 'pointer',
            border: '1px solid #0056b3',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {memberName} {memberId !== socket.id && <span style={{ marginLeft: '8px', fontSize: '0.7em' }}>▼</span>}
        </div>

      
        {activeMenuId === memberId && memberId !== socket.id && (
          <div style={{
            position: 'absolute',
            top: '35px',
            left: '0',
            backgroundColor: 'white',
            boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            zIndex: 100,
            minWidth: '160px',
            border: '1px solid #ddd',
            overflow: 'hidden'
          }}>
            
            <button 
              onClick={() => {
                setActiveRecipientId(memberId);
                setActiveMenuId(null); 
              }}
              style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
               Private Message
            </button>

          
            {isCreator && (
              <button 
                onClick={() => {
                  socket.emit('updateGroupMembers', { 
                    roomId: activeRecipientId, 
                    userId: memberId, 
                    action: 'remove' 
                  });
                  setActiveMenuId(null); 
                }}
                style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'left', border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}
              >
                Remove 
              </button>
            )}
          </div>
        )}
      </div>
    )
  })}
</div>



                  {isCreator && (
                    <button
                      onClick={() => setIsAddingMember(true)}
                      style={{ marginLeft: '15px', color: '#007bff', cursor: 'pointer' }}
                    >
                      Add User +
                    </button>
                  )}
                </div>
              )}

              {isAddingMember && (
                <div
                  onClick={() => setIsAddingMember(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '10px',
                      width: '300px',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}
                  >
                    <h3>Select Users to Add</h3>
                    <hr />

                    {availableUsersToAdd.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          if (selectedNewMembers.includes(user.id)) {
                            setSelectedNewMembers(selectedNewMembers.filter((id) => id !== user.id))
                          } else {
                            setSelectedNewMembers([...selectedNewMembers, user.id])
                          }
                        }}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          alignItems: 'center',
                          background: selectedNewMembers.includes(user.id)
                            ? '#f0f7ff'
                            : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNewMembers.includes(user.id)}
                          readOnly
                          style={{ marginRight: '10px' }}
                        />
                        <span style={{ color: 'black' }}>{user.name}</span>
                      </div>
                    ))}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '20px'
                      }}
                    >
                      <button
                        onClick={() => {
                          setIsAddingMember(false)
                          setSelectedNewMembers([])
                        }}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: '#666'
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        disabled={selectedNewMembers.length === 0}
                        onClick={() => {
                          selectedNewMembers.forEach((id) => {
                            socket.emit('updateGroupMembers', {
                              roomId: activeRecipientId,
                              userId: id,
                              action: 'add'
                            })
                          })

                          setIsAddingMember(false)
                          setSelectedNewMembers([])
                        }}
                        style={{
                          padding: '8px 15px',
                          background: '#007bff',
                          color: 'white',
                          borderRadius: '5px',
                          border: 'none',
                          cursor: selectedNewMembers.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: selectedNewMembers.length === 0 ? 0.5 : 1
                        }}
                      >
                        Add {selectedNewMembers.length} Users
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* {(allChatMessages[activeRecipientId] || []).map((msg,index) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: '10px',
                    textAlign: msg.user === username ? 'right' : 'left'
                  }}
                >
                  {activeRecipientId.startsWith('room_') && msg.user !== username && (
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '0.75em',
                        marginBottom: '4px',
                        color: '#555'
                      }}
                    >
                      {msg.user}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '10px 15px',
                      borderRadius: '18px',
                      backgroundColor: msg.user === username ? '#007bff' : '#e9e9e9',
                      color: msg.user === username ? 'white' : 'black',
                      maxWidth: '70%',
                      position: 'relative'
                    }}
                  >
                    {msg.text}
                    <div
                      style={{
                        fontSize: '0.65em',
                        marginTop: '4px',
                        textAlign: 'right',
                        opacity: 0.7
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))} */}

              {(allChatMessages[activeRecipientId] || []).map((msg, index) => (
  msg.isSystem ? (
    /* WhatsApp-style System Message */
    <div key={index} style={{ 
      textAlign: 'center', 
      margin: '15px 0', 
      width: '100%' 
    }}>
      <span style={{ 
        backgroundColor: '#e1f3fb', // Light blue background
        color: '#54656f',           // Dark gray text
        padding: '5px 12px', 
        borderRadius: '8px',
        fontSize: '0.8em',
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
      }}>
        {msg.text}
      </span>
    </div>
  ) : (
    /* Your existing Chat Bubble Logic */
   <div
                  key={msg.id}
                  style={{
                    marginBottom: '10px',
                    textAlign: msg.user === username ? 'right' : 'left'
                  }}
                >
                  {activeRecipientId.startsWith('room_') && msg.user !== username && (
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '0.75em',
                        marginBottom: '4px',
                        color: '#555'
                      }}
                    >
                      {msg.user}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '10px 15px',
                      borderRadius: '18px',
                      backgroundColor: msg.user === username ? '#007bff' : '#e9e9e9',
                      color: msg.user === username ? 'white' : 'black',
                      maxWidth: '70%',
                      position: 'relative'
                    }}
                  >
                    {msg.text}
                    <div
                      style={{
                        fontSize: '0.65em',
                        marginTop: '4px',
                        textAlign: 'right',
                        opacity: 0.7
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
  )
))}




              <div ref={messagesEndRef} />
            </div>

             {/* In your message input rendering logic */}
{disabledGroups.includes(activeRecipientId) ? (
  <div style={{ padding: '10px', backgroundColor: '#eee', textAlign: 'center', color: '#666' }}>
    You are no longer a member of this group. You can only view the history.
  </div>
) : (
  <form onSubmit={sendMessage}>
    <input 
      value={input} 
      onChange={(e) => setInput(e.target.value)} 
      placeholder="Type a message..." 
    />
    <button type="submit">Send</button>
  </form>
)}

            {/* <form
              onSubmit={sendMessage}
              style={{ padding: '20px', borderTop: '1px solid #ccc', display: 'flex' }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flexGrow: 1,
                  padding: '12px',
                  borderRadius: '25px',
                  border: '1px solid #ccc',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  marginLeft: '10px',
                  padding: '10px 20px',
                  borderRadius: '25px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </form> */}
          </>
        )}
      </div>
    </div>
  )
}

export default ChatRoom
