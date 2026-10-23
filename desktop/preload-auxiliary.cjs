const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("auxiliary", Object.freeze({
  invoke: value => ipcRenderer.invoke("cadence:auxiliary", value),
  onEvent(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("cadence:auxiliary-event", listener);
    return () => ipcRenderer.removeListener("cadence:auxiliary-event", listener);
  },
}));
