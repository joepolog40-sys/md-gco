// Pont entre les pages et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');
const q = new URLSearchParams(location.search);
const sid = q.get('sid');

if (sid) {
  // Feuille MD d'une setlist : l'app.js de la feuille lit window.MDHOST
  const sl = ipcRenderer.sendSync('sl:get', sid);
  contextBridge.exposeInMainWorld('MDHOST', {
    sid,
    name: sl ? sl.name : '',
    data: () => (sl && sl.state) ? sl.state : { meta: { date: '' }, songs: [], rev: 0 },
    cfg: () => ipcRenderer.sendSync('cfg', sid),
    save: state => ipcRenderer.send('sheet:save', sid, state),
    home: () => ipcRenderer.send('go:home'),
    viewerUrl: () => ipcRenderer.sendSync('viewerUrl', sid),
    copy: t => ipcRenderer.send('copy', t)
  });
} else {
  // Écran d'accueil : bibliothèque + setlists
  contextBridge.exposeInMainWorld('API', {
    lib: () => ipcRenderer.sendSync('lib:get'),
    saveLib: lib => ipcRenderer.invoke('lib:save', lib),
    list: () => ipcRenderer.invoke('sl:list'),
    get: id => ipcRenderer.sendSync('sl:get', id),
    save: s => ipcRenderer.invoke('sl:save', s),
    create: base => ipcRenderer.invoke('sl:new', base),
    remove: id => ipcRenderer.invoke('sl:delete', id),
    open: id => ipcRenderer.send('go:sheet', id),
    viewerUrl: id => ipcRenderer.sendSync('viewerUrl', id),
    copy: t => ipcRenderer.send('copy', t),
    exportSetlist: id => ipcRenderer.invoke('export:setlist', id),
    exportLibrary: () => ipcRenderer.invoke('export:library'),
    importFile: () => ipcRenderer.invoke('import:file'),
    openFolder: () => ipcRenderer.invoke('open:folder'),
    openUrl: u => ipcRenderer.invoke('open:url', u),
    info: () => ipcRenderer.invoke('info')
  });
}
