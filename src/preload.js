const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hudApi', {
  getState: () => ipcRenderer.invoke('hud:get-state'),
  refreshNow: () => ipcRenderer.invoke('hud:refresh-now'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch),
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  openMuseLogin: () => ipcRenderer.invoke('muse:open-login'),
  clearMuseSession: () => ipcRenderer.invoke('muse:clear-session'),
  showContextMenu: () => ipcRenderer.invoke('hud:show-context-menu'),
  resizeHud: (width, height) => ipcRenderer.invoke('hud:resize', { width, height }),
  onStateUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('hud:state-updated', handler);
    return () => ipcRenderer.removeListener('hud:state-updated', handler);
  },
  onConfigUpdated: (callback) => {
    const handler = (_event, cfg) => callback(cfg);
    ipcRenderer.on('config:updated', handler);
    return () => ipcRenderer.removeListener('config:updated', handler);
  }
});
