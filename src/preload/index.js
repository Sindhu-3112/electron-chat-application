

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 1. Define your custom Electron Store and Notification API
const electronStore = {
  getStoreData: (key) => ipcRenderer.invoke('get-store-data', key),
  setStoreData: (key, value) => ipcRenderer.send('set-store-data', key, value),
  clearStore: () => ipcRenderer.send('clear-store'),
   deleteMessagePermanently: (chatPartnerId, messageId) => 
    ipcRenderer.send('delete-message-permanently', { chatPartnerId, messageId }),

  
  // NEW: Tell the main process to register this user on its background socket
  registerSocketUser: (username) => ipcRenderer.send('register-socket-user', username),
  
  // NEW: Listen for messages that the main process received while window was hidden
  onSocketData: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('socket-data', subscription);
    return () => ipcRenderer.removeListener('socket-data', subscription);
  }
}

// 2. Safely expose APIs to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', electronStore)
  } catch (error) {
    console.error('Failed to expose Electron APIs:', error)
  }
} else {
  window.electron = electronAPI
  window.electronAPI = electronStore
}
