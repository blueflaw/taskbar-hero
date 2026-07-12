const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inventoryBridge', {
  requestSync: () => ipcRenderer.send('request-inventory-sync'),
  onSyncData: (callback) =>
    ipcRenderer.on('inventory-sync-data', (_evt, data) => callback(data)),
  equipItem: (heroId, itemId) => ipcRenderer.send('equip-item', { heroId, itemId }),
  recruitHero: (classId) => ipcRenderer.send('recruit-hero', classId),
});
