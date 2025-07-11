import { app as r, BrowserWindow as p } from "electron";
import { fileURLToPath as u } from "node:url";
import n from "node:path";
const a = n.dirname(u(import.meta.url));
process.env.APP_ROOT = n.join(a, "..");
const l = process.env.VITE_DEV_SERVER_URL, w = n.join(process.env.APP_ROOT, "dist-electron"), v = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = l ? n.join(process.env.APP_ROOT, "public") : v;
let e;
function m(c) {
  c.webContents.session.setPermissionCheckHandler((o, s) => s === "usb" || s === "media"), c.webContents.session.on("select-usb-device", (o, s, d) => {
    o.preventDefault();
    let i = s.deviceList.find((t) => t.deviceClass === 1);
    i || (i = s.deviceList.find((t) => t.productName && t.productName.toLowerCase().includes("pm101"))), i ? d(i.deviceId) : s.deviceList.length > 0 ? d(s.deviceList[0].deviceId) : d("");
  }), c.webContents.session.setDevicePermissionHandler((o) => o.deviceType === "usb" || o.deviceType === "hid");
}
function f() {
  e = new p({
    icon: n.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: n.join(a, "preload.mjs")
    }
  }), m(e), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), l ? e.loadURL(l) : e.loadFile(n.join(v, "index.html"));
}
r.on("window-all-closed", () => {
  process.platform !== "darwin" && (r.quit(), e = null);
});
r.on("activate", () => {
  p.getAllWindows().length === 0 && f();
});
r.whenReady().then(f);
export {
  w as MAIN_DIST,
  v as RENDERER_DIST,
  l as VITE_DEV_SERVER_URL
};
