// App MD — processus principal (Electron)
// Données : un dossier « MD » dans les données de l'app (bibliothèque + setlists en fichiers JSON).
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const VIEWER_BASE = 'https://joepolog40-sys.github.io/md-gco/live/';
const MQTT = process.env.MD_MQTT ? [process.env.MD_MQTT] : ['wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];

let DIR, SL_DIR, win;
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
function writeJSON(f, v) { // écriture sûre : fichier temporaire puis renommage
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v, null, 1));
  fs.renameSync(tmp, f);
}

// ---------- stockage ----------
function initStore() {
  DIR = process.env.MD_DATA_DIR || path.join(app.getPath('userData'), 'MD');
  SL_DIR = path.join(DIR, 'setlists');
  fs.mkdirSync(SL_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIR, 'sauvegardes'), { recursive: true });
  const cfgF = path.join(DIR, 'config.json');
  let cfg = readJSON(cfgF, null);
  if (!cfg) { cfg = { installId: rid(6), ownerKey: rid(12), created: Date.now() }; writeJSON(cfgF, cfg); }
  const libF = path.join(DIR, 'bibliotheque.json');
  if (fs.existsSync(libF)) { // nouvelle bibliothèque par défaut : on met à jour les chants que tu n'as pas modifiés
    const def = readJSON(path.join(__dirname, 'default', 'bibliotheque.json'), { songs: [] }), lib = readJSON(libF, { songs: [] });
    if ((lib.version || 1) < (def.version || 1)) {
      try { fs.copyFileSync(libF, path.join(DIR, 'sauvegardes', 'bibliotheque-avant-v' + def.version + '.json')); } catch (e) {}
      const byId = new Map(lib.songs.map((x, i) => [x.id, i]));
      for (const s of def.songs) { const i = byId.get(s.id); if (i == null) lib.songs.push(s); else if (!lib.songs[i].edited) lib.songs[i] = s; }
      lib.version = def.version; writeJSON(libF, lib);
    }
  }
  if (!fs.existsSync(libF)) {
    const def = readJSON(path.join(__dirname, 'default', 'bibliotheque.json'), { songs: [] });
    writeJSON(libF, def);
    const ex = readJSON(path.join(__dirname, 'default', 'setlist-exemple.json'), null);
    if (ex) { ex.id = ex.id || rid(5); ex.topic = topicFor(ex.id, cfg); writeJSON(path.join(SL_DIR, ex.id + '.json'), ex); }
  }
  return cfg;
}
let CFG;
const topicFor = (id, c = CFG) => `md-app/${c.installId}/${id}`;
const slFile = id => path.join(SL_DIR, String(id).replace(/[^a-z0-9_-]/gi, '') + '.json');
function listSetlists() {
  return fs.readdirSync(SL_DIR).filter(f => f.endsWith('.json')).map(f => {
    const s = readJSON(path.join(SL_DIR, f), null); if (!s) return null;
    return { id: s.id, name: s.name, date: s.date || '', updated: s.updated || 0, n: (s.state && s.state.songs || []).length,
      titles: (s.state && s.state.songs || []).map(x => x.title) };
  }).filter(Boolean).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated - a.updated);
}
function getSetlist(id) { return readJSON(slFile(id), null); }
function saveSetlist(s) { s.updated = Date.now(); if (!s.topic) s.topic = topicFor(s.id); writeJSON(slFile(s.id), s); return s; }
function backupAll() { // une copie de tout par jour
  try {
    const day = new Date().toISOString().slice(0, 10), out = path.join(DIR, 'sauvegardes', day + '.json');
    if (fs.existsSync(out)) return;
    const all = { library: readJSON(path.join(DIR, 'bibliotheque.json'), null), setlists: fs.readdirSync(SL_DIR).filter(f => f.endsWith('.json')).map(f => readJSON(path.join(SL_DIR, f), null)) };
    writeJSON(out, all);
    const old = fs.readdirSync(path.join(DIR, 'sauvegardes')).sort(); while (old.length > 30) fs.unlinkSync(path.join(DIR, 'sauvegardes', old.shift()));
  } catch (e) {}
}

// ---------- fenêtres ----------
function openHome() { win.loadFile(path.join(__dirname, 'renderer', 'home.html')); }
function openSheet(id) { win.loadFile(path.join(__dirname, 'renderer', 'sheet.html'), { query: { sid: id } }); }
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600, backgroundColor: '#14161b', title: 'MD',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  openHome();
}

// ---------- échanges avec les pages ----------
ipcMain.on('lib:get', e => { e.returnValue = readJSON(path.join(DIR, 'bibliotheque.json'), { songs: [] }); });
ipcMain.handle('lib:save', (e, lib) => { writeJSON(path.join(DIR, 'bibliotheque.json'), lib); return true; });
ipcMain.handle('sl:list', () => listSetlists());
ipcMain.on('sl:get', (e, id) => { e.returnValue = getSetlist(id); });
ipcMain.handle('sl:save', (e, s) => saveSetlist(s));
ipcMain.handle('sl:new', (e, base) => { const id = rid(5); return saveSetlist(Object.assign({ id, created: Date.now(), name: 'Nouvelle setlist', date: '', state: { meta: { date: '' }, songs: [], rev: Date.now() } }, base || {}, { id, topic: topicFor(id) })); });
ipcMain.handle('sl:delete', (e, id) => { // va dans la corbeille de l'app, pas supprimé pour de bon
  const f = slFile(id); if (!fs.existsSync(f)) return false;
  const bin = path.join(DIR, 'corbeille'); fs.mkdirSync(bin, { recursive: true });
  fs.renameSync(f, path.join(bin, id + '-' + Date.now() + '.json')); return true;
});
ipcMain.on('cfg', (e, id) => { e.returnValue = { mqtt: MQTT, topic: topicFor(id), ownerHash: crypto.createHash('sha256').update(CFG.ownerKey).digest('hex') }; });
ipcMain.on('viewerUrl', (e, id) => { e.returnValue = VIEWER_BASE + '#t=' + encodeURIComponent(topicFor(id)); });
let saveT = {}, pend = {};
ipcMain.on('sheet:save', (e, id, state) => { // depuis la feuille MD
  const s = getSetlist(id); if (!s) return; s.state = state; pend[id] = s;
  clearTimeout(saveT[id]); saveT[id] = setTimeout(() => { saveSetlist(s); delete pend[id]; }, 300);
});
function flush() { for (const id in pend) { clearTimeout(saveT[id]); try { saveSetlist(pend[id]); } catch (e) {} delete pend[id]; } }
ipcMain.on('go:home', () => { flush(); openHome(); });
ipcMain.on('go:sheet', (e, id) => openSheet(id));
ipcMain.on('copy', (e, t) => clipboard.writeText(String(t || '')));
ipcMain.handle('open:folder', () => shell.openPath(DIR));
ipcMain.handle('open:url', (e, u) => { if (/^https?:/.test(u)) shell.openExternal(u); });
ipcMain.handle('export:setlist', async (e, id) => {
  const s = getSetlist(id); if (!s) return false;
  const r = await dialog.showSaveDialog(win, { defaultPath: (s.name || 'setlist').replace(/[\\/:*?"<>|]/g, '-') + '.mdset', filters: [{ name: 'Setlist MD', extensions: ['mdset', 'json'] }] });
  if (r.canceled) return false; writeJSON(r.filePath, s); return true;
});
ipcMain.handle('export:library', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'Bibliothèque MD.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return false; writeJSON(r.filePath, readJSON(path.join(DIR, 'bibliotheque.json'), {})); return true;
});
// Import : setlist .mdset, bibliothèque .json, ou feuille MD .html (sauvegarde 💾)
ipcMain.handle('import:file', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Setlist, feuille MD ou bibliothèque', extensions: ['mdset', 'json', 'html', 'htm'] }] });
  if (r.canceled) return [];
  const out = [];
  for (const f of r.filePaths) {
    try {
      const txt = fs.readFileSync(f, 'utf8');
      if (/\.html?$/i.test(f)) {
        const m = txt.match(/<script id="data"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) { out.push({ file: f, error: 'pas de données MD dans ce fichier' }); continue; }
        const st = JSON.parse(m[1]);
        out.push({ file: f, kind: 'sheet', state: st, name: (st.meta && st.meta.date) || path.basename(f, path.extname(f)) });
      } else {
        const j = JSON.parse(txt);
        if (j.state && j.state.songs) out.push({ file: f, kind: 'setlist', setlist: j });
        else if (Array.isArray(j.songs) && !j.meta) out.push({ file: f, kind: 'library', songs: j.songs });
        else if (j.songs) out.push({ file: f, kind: 'sheet', state: j, name: (j.meta && j.meta.date) || path.basename(f) });
        else out.push({ file: f, error: 'format inconnu' });
      }
    } catch (e) { out.push({ file: f, error: String(e.message || e) }); }
  }
  return out;
});
ipcMain.handle('info', () => ({ dir: DIR, version: app.getVersion() }));

app.whenReady().then(() => {
  CFG = initStore();
  backupAll();
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  else Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', flush);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
