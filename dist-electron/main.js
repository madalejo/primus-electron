import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function setupDeviceHandlers(mainwindow) {
  mainwindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === "usb" || permission === "media") {
      return true;
    }
    return false;
  });
  mainwindow.webContents.session.on("select-usb-device", (event, details, callback) => {
    event.preventDefault();
    let audioDevice = details.deviceList.find((device) => device.deviceClass === 1);
    if (!audioDevice) {
      audioDevice = details.deviceList.find((device) => device.productName && device.productName.toLowerCase().includes("pm101"));
    }
    if (audioDevice) {
      callback(audioDevice.deviceId);
    } else if (details.deviceList.length > 0) {
      callback(details.deviceList[0].deviceId);
    } else {
      callback("");
    }
  });
  mainwindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === "usb" || details.deviceType === "hid") {
      return true;
    }
    return false;
  });
}
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  setupDeviceHandlers(win);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
