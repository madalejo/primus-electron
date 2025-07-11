import { app, BrowserWindow } from 'electron'
//import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

//const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Handle USB permission requests
function setupDeviceHandlers(mainwindow: BrowserWindow) {
  // Allow the webusb api to work
  mainwindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'usb' || permission === 'media') {
      return true;
    }
    return false;
  });

  // auto-select usb devices (audio devices)
  mainwindow.webContents.session.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();

    // Look for audio devices
    let audioDevice = details.deviceList.find(device => device.deviceClass === 1);

    //if no audio device found look for PM101
    if(!audioDevice) {
      audioDevice = details.deviceList.find(device => 
        device.productName && device.productName.toLowerCase().includes('pm101'));
    }

    // if we found matching device, return ID
    if(audioDevice) {
      callback(audioDevice.deviceId);
    } else if (details.deviceList.length > 0) {
      // return the first device if cant find a specific match
      callback(details.deviceList[0].deviceId);
    } else {
      callback('');
    }
  });

  // grant permission to usb devices
  mainwindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'usb' || details.deviceType === 'hid') {
      return true;
    }
    return false;
  });
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  //set device handlers
  setupDeviceHandlers(win)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
