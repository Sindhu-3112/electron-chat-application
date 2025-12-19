// import { contextBridge } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'

// // Custom APIs for renderer
// const api = {}

// // Use `contextBridge` APIs to expose Electron APIs to
// // renderer only if context isolation is enabled, otherwise
// // just add to the DOM global.
// if (process.contextIsolated) {
//   try {
//     contextBridge.exposeInMainWorld('electron', electronAPI)
//     contextBridge.exposeInMainWorld('api', api)
//   } catch (error) {
//     console.error(error)
//   }
// } else {
//   window.electron = electronAPI
//   window.api = api
// }


// const { contextBridge, ipcRenderer } = require('electron');

// contextBridge.exposeInMainWorld('electronAPI', {
//   getStoreData: (key) => ipcRenderer.invoke('get-store-data', key),
//   setStoreData: (key, value) => ipcRenderer.send('set-store-data', key, value),
//   clearStore: () => ipcRenderer.send('clear-store')
// });

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 1. Define your custom Electron Store API
const electronStore = {
  getStoreData: (key) => ipcRenderer.invoke('get-store-data', key),
  setStoreData: (key, value) => ipcRenderer.send('set-store-data', key, value),
  clearStore: () => ipcRenderer.send('clear-store')
}

// 2. Safely expose APIs to the renderer process
if (process.contextIsolated) {
  try {
    // Expose standard toolkit APIs as window.electron
    contextBridge.exposeInMainWorld('electron', electronAPI)
    
    // Expose your store methods as window.electronAPI
    contextBridge.exposeInMainWorld('electronAPI', electronStore)
  } catch (error) {
    console.error('Failed to expose Electron APIs:', error)
  }
} else {
  // Fallback for non-isolated contexts
  window.electron = electronAPI
  window.electronAPI = electronStore
}
