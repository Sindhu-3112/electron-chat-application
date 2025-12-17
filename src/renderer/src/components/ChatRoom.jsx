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
 

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  // const activeRoom = connectedUsers.find(u => u.id === activeRecipientId);
  // const isCreator = activeRoom?.creator === socket.id;
  // const participants = activeRoom?.members || [];

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
      // Automatically join the room server-side or via emit
      socket.emit('joinGroupRoom', groupData.roomId)

      // Add group to sidebar list
      setConnectedUsers((prev) => [
        ...prev,
        {
          id: groupData.roomId,
          name: groupData.groupName,
          isGroup: true
        }
      ])
    })

    socket.on('receiveGroupMessage', (data) => {
      addMessageToHistory({ ...data.message, isGroup: true }, data.roomId)
    })

    return () => {
      socket.off('invitedToGroup')
      socket.off('receiveGroupMessage')
    }
  }, [addMessageToHistory])

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

        {/* {connectedUsers.map(user => (
        <div key={user.id} style={{display: 'flex', alignItems: 'center'}}>
            {isCreatingGroup && !user.isGroup && (
                <input 
                    type="checkbox" 
                    onChange={(e) => {
                        if(e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                        else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                    }}
                /> 
            )}
            <button onClick={() => setActiveRecipientId(user.id)}>
                {user.isGroup ? `👥 ${user.name}` : user.name}
            </button>
        </div>
    ))} */}
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
              {/* <h2>
                {activeRecipientId.startsWith('room_')&&   (
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '0.75em',
                        marginBottom: '4px',
                        color: '#555'
                      }}
                    >
                     <button>Add User +</button>
                    </div>
                  )}
              </h2> */}
               {/* <h2>
     
      {activeRecipientId.startsWith('room_') && (
        <div style={{ fontSize: '0.6em', color: '#888', marginBottom: '10px' }}>
          Participants: {participants.map(id => getRecipientName(id)).join(', ')}
          
         
          {isCreator && (
            <button 
              onClick={() => handleAddUserToGroup(activeRecipientId)}
              style={{ marginLeft: '10px', color: '#007bff', cursor: 'pointer' }}
            >
              Add User +
            </button>
          )}
        </div>
      )}
    </h2> */}
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
