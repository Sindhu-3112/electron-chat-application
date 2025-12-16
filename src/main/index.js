import { app, shell, BrowserWindow, Tray,  Menu, ipcMain,session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import path from 'path'

let tray
let mainWindow

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
