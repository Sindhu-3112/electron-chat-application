import Chat from './components/Chat-application/chat'
import ChatRoom from './components/ChatRoom'

function App() {
  const ipcHandle = () => window.electron.ipcRenderer.send('ping')

  return (
   <>
  <ChatRoom />
   </>
  )
}

export default App
