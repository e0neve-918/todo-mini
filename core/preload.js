const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state'),
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  setTodos: (t) => ipcRenderer.send('set-todos', t),
  patch: (p) => ipcRenderer.send('patch-settings', p),
  setPlaced: (p) => ipcRenderer.send('set-placed', p),
  ignore: (b) => ipcRenderer.send('ignore', b),
  getPos: () => ipcRenderer.invoke('get-pos'),
  moveTo: (x, y) => ipcRenderer.send('move-to', x, y),
  togglePeek: () => ipcRenderer.send('toggle-peek'),
  openSettings: () => ipcRenderer.send('open-settings'),
  addLibrary: (place) => ipcRenderer.invoke('add-library', !!place),
  removeLibrary: (id) => ipcRenderer.send('remove-library', id),
  place: (id) => ipcRenderer.send('place', id),
  fonts: () => ipcRenderer.invoke('fonts'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  applyUpdate: () => ipcRenderer.invoke('apply-update')
});
