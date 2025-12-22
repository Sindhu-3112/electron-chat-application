import { app, shell, BrowserWindow, Tray,  Menu, ipcMain,session , Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'
import { io } from 'socket.io-client';
// const io = require('socket.io-client');
// const socket = io('http://localhost:4000');

// const Store = require('electron-store');

import StorePackage from 'electron-store'
const Store = StorePackage.default || StorePackage
const store = new Store();
let tray
let mainWindow
let socket
let currentNotification;

app.setAppUserModelId(' com.electron.app') 
function createWindow() {

mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  socket = io('http://localhost:4000');

  socket.on('connect', () => {
    console.log('Main process connected to socket');
  });

  socket.on('newNotification', (data) => {
  // Use the exposed IPC bridge from your preload script
  window.electron.ipcRenderer.send('show-notification', {
    title: `New Message from ${data.from}`,
    body: data.text
  });
});

  socket.on('receivePrivateMessage', (data) => {
  const { senderName, message } = data;

  if (!mainWindow.isVisible() || !mainWindow.isFocused()) {
    // Check if notifications are even supported
    if (Notification.isSupported()) {
     currentNotification = new Notification({
        title: `New message from ${senderName}`,
        body: message.text,
        silent: false, 
        icon: path.join(__dirname, '../../resources/icon.png')
      });

      currentNotification.show();

      // Optional: Show window when notification is clicked
      currentNotification.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
      });
    }
  }
});


  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

   mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })

  ipcMain.handle('get-store-data', (event, key) => {
  return store.get(key);
});

ipcMain.on('set-store-data', (event, key, value) => {
  store.set(key, value);
});

ipcMain.on('clear-store', () => {
  store.clear();
});
 ipcMain.on('register-socket-user', (event, username) => {
    socket.emit('registerName', username);
  });
  ipcMain.on('show-notification', (event, arg) => {
  new Notification({
    title: arg.title,
    body: arg.body,
  }).show(); 
});
}

function createTray() {
  const trayIcon = app.isPackaged
    ? path.join(process.resourcesPath, 'robo.png')
    : path.join(__dirname, '../../resources/robo.png')

  tray = new Tray(trayIcon)
  tray.setToolTip('Activity Tracker')

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open App', click: () => mainWindow.show() }
      // { label: 'Quit', click: () => app.quit() }
    ])
  )

  tray.on('click', () => mainWindow.show())
}

app.whenReady().then(() => {
 
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
 
   createTray()

  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
   if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

   app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false, 
    path: process.execPath
  });
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
