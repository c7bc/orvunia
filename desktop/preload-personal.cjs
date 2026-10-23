const { contextBridge, ipcRenderer } = require("electron");
const methods = [
  "state",
  "motionComplete",
  "flushComplete",
  "layout",
  "settings",
  "shortcutReset",
  "panel",
  "overlay",
  "begin",
  "end",
  "toggle",
  "position",
  "sources",
  "source",
  "capture",
  "clipboard",
  "copy",
  "quit",
  "hide",
  "minimize",
  "maximize",
  "export",
  "import",
  "modelImport",
  "repository",
  "systemAudio",
  "reminders",
  "openExternal",
  "openSupportReport",
  "openUpdate",
  "openWindowsManagement",
  "chatVisibility",
  "gaze",
  "auxiliary",
];
const api = Object.fromEntries(
  methods.map((method) => [
    method,
    (data) => ipcRenderer.invoke(`cadence:${method}`, data),
  ]),
);
api.onEvent = (callback) => {
  const fn = (_event, data) => callback(data);
  ipcRenderer.on("cadence:event", fn);
  return () => ipcRenderer.removeListener("cadence:event", fn);
};
api.onAuxiliary = (callback) => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on("cadence:auxiliary-event", listener);
  return () => ipcRenderer.removeListener("cadence:auxiliary-event", listener);
};
contextBridge.exposeInMainWorld("cadence", Object.freeze(api));
