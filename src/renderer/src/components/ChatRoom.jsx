import { useState, useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket'
import { v4 as uuidv4 } from 'uuid'

const storageKey = 'reactChatSession'
const getStoredSession = () =>
  JSON.parse(localStorage.getItem(storageKey)) || { username: null, histories: {} }
const setStoredSession = (data) => localStorage.setItem(storageKey, JSON.stringify(data))

function ChatRoom() {
  const [input, setInput] = useState('')
  const [sessionData] = useState(getStoredSession())
  const [username, setUsername] = useState(sessionData.username)
  const [connectedUsers, setConnectedUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [activeRecipientId, setActiveRecipientId] = useState(null)
  const [allChatMessages, setAllChatMessages] = useState(sessionData.histories)
  const [roomMembers, setRoomMembers] = useState({})
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [selectedNewMembers, setSelectedNewMembers] = useState([])
  const [activeMenuId, setActiveMenuId] = useState(null);

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

  

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const addMessageToHistory = useCallback(
    (message, chatId) => {
      setAllChatMessages((prevHistories) => {
        const updatedMessagesForChat = [...(prevHistories[chatId] || []), message]
        const updatedHistories = { ...prevHistories, [chatId]: updatedMessagesForChat }
        setStoredSession({ username: username, histories: updatedHistories })
        return updatedHistories
      })
    },
    [username]
  )

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

  useEffect(() => {
    socket.on('invitedToGroup', (groupData) => {
      const { roomId, groupName, creator, members } = groupData
      socket.emit('joinGroupRoom', roomId)

      setConnectedUsers((prev) => {
        // Avoid duplicates
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
      addMessageToHistory({ ...data.message, isGroup: true }, data.roomId)
    })

    return () => {
      socket.off('invitedToGroup')
      socket.off('receiveGroupMessage')
    }
  }, [addMessageToHistory])

  useEffect(() => {
    socket.on('removedFromGroup', ({ roomId }) => {
      
        setConnectedUsers(prev => prev.filter(c => c.id !== roomId));
        
       
        if (activeRecipientId === roomId) {
            setActiveRecipientId(null);
            alert("You have been removed from the group.");
        }
    });

    return () => socket.off('removedFromGroup');
}, [activeRecipientId]);


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

  const handleNameSubmit = (e) => {
    e.preventDefault()
    const name = input.trim()
    if (name) {
      setUsername(name)
      socket.emit('registerName', name)
      setInput('')
      setStoredSession({ username: name, histories: allChatMessages })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(storageKey)
    window.location.reload()
  }

  const getRecipientName = (id) => {
    const user = connectedUsers.find((u) => u.id === id)
    return user ? user.name : `Offline User (${id.substring(0, 5)})`
  }

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
        {connectedUsers.length === 0 ? (
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
              {' '}
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
            </button>
          ))
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

            

                  {/* <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
  {participants.map((m, i) => {
    const memberId = typeof m === 'string' ? m : m.id;
    const memberName = typeof m === 'string' ? getRecipientName(m) : m.name;

    return (
      <div
        key={memberId}
        onClick={() => handleParticipantAction(memberId, memberName)}
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.85em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          border: '1px solid #0056b3',
          transition: 'transform 0.1s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {memberName}
       
        {isCreator && memberId !== socket.id && (
          <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '1.1em' }}>×</span>
        )}
      </div>
    );
  })}
</div> */}

<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
  {participants.map((m) => {
    // 1. Get the member's ID and Name
    const memberId = typeof m === 'string' ? m : m.id;
    const memberName = typeof m === 'string' ? getRecipientName(m) : m.name;

    return (
      <div key={memberId} style={{ position: 'relative' }}>
        {/* THE BLUE PILL */}
        <div
          onClick={(e) => {
            e.stopPropagation(); // Stop click from closing other things
            // If already open, close it. If closed, open it.
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

        {/* THE POPOVER MENU (Only shows when activeMenuId matches) */}
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
            {/* Option 1: Open Private Chat */}
            <button 
              onClick={() => {
                setActiveRecipientId(memberId);
                setActiveMenuId(null); 
              }}
              style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
               Private Message
            </button>

            {/* Option 2: Remove (Only visible to Creator) */}
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
    );
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

              {(allChatMessages[activeRecipientId] || []).map((msg) => (
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
              ))}

              <div ref={messagesEndRef} />
            </div>

            <form
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
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ChatRoom
