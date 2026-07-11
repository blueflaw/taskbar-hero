const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskbarHero', {
  saveGame: (data) => ipcRenderer.invoke('save-game', data),
  loadGame: () => ipcRenderer.invoke('load-game'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  openInventory: () => ipcRenderer.send('open-inventory'),

  // The inventory window (via main) asks us for fresh data - we respond by
  // pushing serialized state back out on 'inventory-sync-data'.
  onProvideInventorySync: (callback) => ipcRenderer.on('provide-inventory-sync', callback),
  sendInventorySync: (data) => ipcRenderer.send('inventory-sync-data', data),

  // The inventory window asks us to equip something - we own the live Hero
  // objects, so we perform the mutation here.
  onEquipItem: (callback) =>
    ipcRenderer.on('equip-item', (_evt, payload) => callback(payload)),
});
