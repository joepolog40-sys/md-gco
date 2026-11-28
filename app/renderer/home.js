// Écran d'accueil : setlists + bibliothèque de chants
'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = o => JSON.parse(JSON.stringify(o));
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const KINDS = [['intro', 'Intro / instru'], ['couplet', 'Couplet'], ['prerefrain', 'Pré-refrain'], ['refrain', 'Refrain'], ['pont', 'Pont'], ['tag', 'Tag'], ['fin', 'Fin']];
const KCOL = { intro: '#00BFC6', couplet: '#92BB32', prerefrain: '#5a5fd0', refrain: '#23852B', pont: '#ED8800', tag: '#9AA9A6', fin: '#E60000' };
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const longDate = iso => { if (!iso) return ''; const d = new Date(iso + 'T12:00'); return isNaN(d) ? iso : `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; };
const rid = () => Math.random().toString(36).slice(2, 8);
const slug = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'chant';
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
const totalBars = s => (s.sections || []).reduce((a, q) => a + (+q.bars || 0), 0);
const durOf = s => { const b = totalBars(s), bpm = parseFloat(s.bpm) || 0, m = +(String(s.meter || '4/4').split('/')[0]) || 4; if (!b || !bpm) return ''; const sec = Math.round(b * m * 60 / bpm); return `≈ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const strip = s => s.replace(/\(\d+×\)/g, '');

let LIB = API.lib(); if (!Array.isArray(LIB.songs)) LIB.songs = [];
let SETS = [], CUR = null, SONG = null, tab = localStorage.getItem('home:tab') || 'sets';
const saveLib = () => API.saveLib(LIB);

// ---------- onglets ----------
function setTab(t) {
  tab = t; localStorage.setItem('home:tab', t);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  if (t === 'lib') renderLib(); else renderSets();
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

// ================= SETLISTS =================
async function loadSets(selectId) {
  SETS = await API.list();
  const want = selectId || localStorage.getItem('home:set');
  CUR = want && SETS.find(s => s.id === want) ? API.get(want) : SETS[0] ? API.get(SETS[0].id) : null;
  renderSets();
}
function renderSets() {
  $('#setList').innerHTML = SETS.length ? SETS.map(s => `
    <button class="setcard${CUR && CUR.id === s.id ? ' on' : ''}" data-id="${s.id}">
      <b>${esc(s.name || 'Sans titre')}</b>
      <span class="d">${esc(longDate(s.date) || 'pas de date')} · ${s.n} chant${s.n > 1 ? 's' : ''}</span>
      <span class="t">${esc(s.titles.slice(0, 6).join(' · '))}</span>
    </button>`).join('') : '<p class="empty">Aucune setlist pour l\'instant.</p>';
  document.querySelectorAll('.setcard').forEach(b => b.onclick = () => { CUR = API.get(b.dataset.id); localStorage.setItem('home:set', CUR.id); renderSets(); });
  renderSetDetail();
}
let saveT = null;
function saveCur(now) {
  if (!CUR) return;
  const st = CUR.state;
  st.songs.forEach((s, i) => s.n = i + 1);
  st.meta = st.meta || {}; st.meta.date = CUR.date ? longDate(CUR.date) : (st.meta.date || '');
  if (CUR.theme !== undefined) st.meta.theme = CUR.theme;
  st.rev = Date.now();
  clearTimeout(saveT);
  const go = async () => { await API.save(CUR); const i = SETS.findIndex(x => x.id === CUR.id); if (i >= 0) { SETS[i] = Object.assign(SETS[i], { name: CUR.name, date: CUR.date, n: st.songs.length, titles: st.songs.map(x => x.title) }); } renderSetListOnly(); };
  if (now) return go(); saveT = setTimeout(go, 350);
}
function renderSetListOnly() {
  const keep = CUR && CUR.id; const html = SETS.map(s => `<button class="setcard${keep === s.id ? ' on' : ''}" data-id="${s.id}"><b>${esc(s.name || 'Sans titre')}</b><span class="d">${esc(longDate(s.date) || 'pas de date')} · ${s.n} chant${s.n > 1 ? 's' : ''}</span><span class="t">${esc(s.titles.slice(0, 6).join(' · '))}</span></button>`).join('');
  $('#setList').innerHTML = html;
  document.querySelectorAll('.setcard').forEach(b => b.onclick = () => { CUR = API.get(b.dataset.id); localStorage.setItem('home:set', CUR.id); renderSets(); });
}
function renderSetDetail() {
  const el = $('#setDetail');
  if (!CUR) { el.innerHTML = '<div class="hero"><h2>Bienvenue 👋</h2><p>Crée ta première setlist : tu choisis les chants dans ta bibliothèque, tu ajustes, et tu ouvres la feuille MD pour le live.</p><button class="primary" id="bHeroNew">＋ Nouvelle setlist</button></div>'; $('#bHeroNew').onclick = newSet; return; }
  const st = CUR.state, songs = st.songs;
  const tot = songs.reduce((a, s) => { const d = durOf(s); if (!d) return a; const [m, x] = d.replace('≈ ', '').split(':'); return a + (+m) * 60 + (+x); }, 0);
  el.innerHTML = `
  <div class="sethead">
    <input class="title" id="sName" value="${esc(CUR.name)}" placeholder="Nom de la setlist">
    <div class="row">
      <label>Date <input type="date" id="sDate" value="${esc(CUR.date || '')}"></label>
      <label class="grow">Thème / remarque <input id="sTheme" value="${esc(CUR.theme ?? st.meta.theme ?? '')}" placeholder="ex. Série de Noël · L'espérance"></label>
    </div>
    <div class="actions">
      <button class="primary big" id="bOpen">🎛 Ouvrir la feuille MD</button>
      <button id="bLink" title="Copier le lien à envoyer aux musiciens">📱 Lien musiciens</button>
      <button id="bDup">⧉ Dupliquer</button>
      <button id="bExp">⬇︎ Exporter</button>
      <button id="bDel" class="danger">🗑 Supprimer</button>
    </div>
  </div>
  <div class="songshead"><h3>Chants <small>${songs.length} · ${tot ? '≈ ' + Math.round(tot / 60) + ' min' : ''}</small></h3><button class="primary" id="bAdd">＋ Ajouter des chants</button></div>
  <ol class="songs" id="songs">${songs.map((s, i) => songRow(s, i)).join('') || '<li class="empty">Aucun chant. Clique « Ajouter des chants » pour piocher dans ta bibliothèque.</li>'}</ol>`;
  $('#sName').oninput = e => { CUR.name = e.target.value; saveCur(); };
  $('#sDate').onchange = e => { CUR.date = e.target.value; if (!CUR.name || /^Nouvelle setlist/.test(CUR.name)) { CUR.name = longDate(CUR.date); $('#sName').value = CUR.name; } saveCur(); };
  $('#sTheme').oninput = e => { CUR.theme = e.target.value; saveCur(); };
  $('#bOpen').onclick = async () => { await saveCur(true); API.open(CUR.id); };
  $('#bLink').onclick = () => { API.copy(API.viewerUrl(CUR.id)); toast('Lien copié : envoie-le aux musiciens (WhatsApp…)'); };
  $('#bDup').onclick = async () => { const c = clone(CUR); delete c.id; delete c.topic; c.name = CUR.name + ' (copie)'; const n = await API.create(c); await loadSets(n.id); toast('Setlist dupliquée'); };
  $('#bExp').onclick = async () => { if (await API.exportSetlist(CUR.id)) toast('Setlist exportée'); };
  const del = $('#bDel'); del.onclick = async () => { if (!del.classList.contains('arm')) { del.classList.add('arm'); del.textContent = '🗑 Confirmer ?'; setTimeout(() => { del.classList.remove('arm'); del.textContent = '🗑 Supprimer'; }, 3000); return; } await API.remove(CUR.id); localStorage.removeItem('home:set'); await loadSets(); toast('Setlist supprimée (récupérable dans le dossier « corbeille »)'); };
  $('#bAdd').onclick = openPick;
  bindRows();
}
function songRow(s, i) {
  const kinds = (s.sections || []).map(q => `<i style="background:${KCOL[q.kind] || '#888'}" title="${esc(q.name)}"></i>`).join('');
  return `<li class="srow" draggable="true" data-i="${i}">
    <span class="grip" title="Glisser pour déplacer">⋮⋮</span>
    <span class="num">${i + 1}</span>
    <div class="sinfo"><b>${esc(s.title)}</b><span class="secbar">${kinds}</span><small>${(s.sections || []).length} sections · ${totalBars(s)} mes. ${durOf(s) ? '· ' + durOf(s) : ''}${s.libId ? '' : ' · <em>pas dans la bibliothèque</em>'}</small></div>
    <label class="mini">Tona <select data-k="${i}">${KEYS.map(k => `<option${k === s.key ? ' selected' : ''}>${k}</option>`).join('')}${KEYS.includes(s.key) || !s.key ? '' : `<option selected>${esc(s.key)}</option>`}</select></label>
    <label class="mini">BPM <input data-b="${i}" value="${esc(s.bpm || '')}" size="4"></label>
    <div class="rbtn">
      <button data-up="${i}" title="Monter">↑</button><button data-dn="${i}" title="Descendre">↓</button>
      <button data-tolib="${i}" title="Enregistrer ce chant (avec tes réglages) dans la bibliothèque">↥ Biblio</button>
      <button data-rm="${i}" class="danger" title="Retirer de la setlist">✕</button>
    </div></li>`;
}
function bindRows() {
  const songs = CUR.state.songs;
  const re = () => { renderSetDetail(); saveCur(); };
  document.querySelectorAll('[data-k]').forEach(e => e.onchange = () => { songs[+e.dataset.k].key = e.value; saveCur(); });
  document.querySelectorAll('[data-b]').forEach(e => e.oninput = () => { songs[+e.dataset.b].bpm = e.value.trim(); saveCur(); });
  document.querySelectorAll('[data-up]').forEach(e => e.onclick = () => { const i = +e.dataset.up; if (i > 0) { [songs[i - 1], songs[i]] = [songs[i], songs[i - 1]]; re(); } });
  document.querySelectorAll('[data-dn]').forEach(e => e.onclick = () => { const i = +e.dataset.dn; if (i < songs.length - 1) { [songs[i + 1], songs[i]] = [songs[i], songs[i + 1]]; re(); } });
  document.querySelectorAll('[data-rm]').forEach(e => e.onclick = () => {
    if (!e.classList.contains('arm')) { e.classList.add('arm'); e.textContent = 'Retirer ?'; setTimeout(() => { e.classList.remove('arm'); e.textContent = '✕'; }, 2500); return; }
    songs.splice(+e.dataset.rm, 1); re();
  });
  document.querySelectorAll('[data-tolib]').forEach(e => e.onclick = () => {
    const s = songs[+e.dataset.tolib], c = toLib(s);
    const j = LIB.songs.findIndex(x => x.id === s.libId);
    if (j >= 0) LIB.songs[j] = c; else { LIB.songs.push(c); s.libId = c.id; }
    saveLib(); saveCur(); renderSetDetail(); toast(j >= 0 ? 'Bibliothèque mise à jour avec cette version' : 'Ajouté à la bibliothèque');
  });
  // glisser-déposer
  let from = null;
  document.querySelectorAll('.srow').forEach(li => {
    li.ondragstart = e => { from = +li.dataset.i; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; };
    li.ondragend = () => li.classList.remove('drag');
    li.ondragover = e => { e.preventDefault(); li.classList.add('over'); };
    li.ondragleave = () => li.classList.remove('over');
    li.ondrop = e => { e.preventDefault(); li.classList.remove('over'); const to = +li.dataset.i; if (from == null || from === to) return; const [m] = songs.splice(from, 1); songs.splice(to, 0, m); from = null; re(); };
  });
}
function toLib(s) { // copie « propre » d'un chant pour la bibliothèque
  const c = clone(s); c.id = s.libId || ('lib-' + slug(s.title) + '-' + rid());
  delete c.libId; delete c.n; delete c.slot; (c.sections || []).forEach(q => { q.t = null; }); return c;
}
function fromLib(L) { // copie d'un chant de la bibliothèque dans la setlist
  const c = clone(L); c.libId = L.id;
  const used = new Set(CUR.state.songs.map(x => x.id)); let id = slug(L.title); while (used.has(id)) id = slug(L.title) + '-' + rid();
  c.id = id; c.n = CUR.state.songs.length + 1; return c;
}
async function newSet() {
  const prev = SETS[0] && API.get(SETS[0].id);
  const pm = prev && prev.state && prev.state.meta || {};
  const meta = { date: '', theme: '', series: '', services: pm.services || [], schedule: [], team: pm.team || [], run: [], decide: [], signals: pm.signals || [] };
  const n = await API.create({ name: 'Nouvelle setlist', date: '', state: { meta, songs: [], rev: Date.now() } });
  await loadSets(n.id); setTimeout(() => { const i = $('#sDate'); i && i.focus(); }, 50);
}
$('#bNewSet').onclick = newSet;

// ---------- choix des chants ----------
function openPick() { $('#pick').hidden = false; $('#pickQ').value = ''; renderPick(); setTimeout(() => $('#pickQ').focus(), 30); }
function libFilter(q) { const n = norm(q).trim(); const L = LIB.songs.slice().sort((a, b) => norm(a.title).localeCompare(norm(b.title))); if (!n) return L; return L.filter(s => norm(s.title + ' ' + (s.orig || '') + ' ' + (s.key || '') + ' ' + (s.tags || []).join(' ')).includes(n)); }
function renderPick() {
  const inSet = new Map(); CUR.state.songs.forEach(s => s.libId && inSet.set(s.libId, (inSet.get(s.libId) || 0) + 1));
  $('#pickList').innerHTML = libFilter($('#pickQ').value).map(s => `<button class="pk${inSet.get(s.id) ? ' in' : ''}" data-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.key || '?')} · ${esc(s.bpm || '–')} BPM · ${(s.sections || []).length} sect.</span>${inSet.get(s.id) ? '<em>✓ dans la setlist</em>' : ''}</button>`).join('') || '<p class="empty">Aucun chant trouvé.</p>';
  document.querySelectorAll('.pk').forEach(b => b.onclick = () => { const L = LIB.songs.find(x => x.id === b.dataset.id); CUR.state.songs.push(fromLib(L)); saveCur(); renderPick(); toast('« ' + L.title + ' » ajouté'); });
}
$('#pickQ').oninput = renderPick;
$('#pickX').onclick = () => { $('#pick').hidden = true; renderSetDetail(); };
$('#pick').onclick = e => { if (e.target.id === 'pick') $('#pickX').onclick(); };

// ================= BIBLIOTHÈQUE =================
function renderLib() {
  const L = libFilter($('#libQ').value);
  $('#libCount').textContent = `${L.length} / ${LIB.songs.length} chants`;
  $('#libList').innerHTML = L.map(s => `<button class="libcard${SONG && SONG.id === s.id ? ' on' : ''}" data-id="${esc(s.id)}"><b>${esc(s.title)}</b><span>${esc(s.key || '?')} · ${esc(s.bpm || '–')} BPM · ${(s.sections || []).length} sect.${s.fromFiche ? ' · fiche' : ''}</span></button>`).join('');
  document.querySelectorAll('.libcard').forEach(b => b.onclick = () => { SONG = LIB.songs.find(x => x.id === b.dataset.id); renderLib(); });
  renderSong();
}
$('#libQ').oninput = renderLib;
$('#bNewSong').onclick = () => { const s = { id: 'lib-nouveau-' + rid(), title: 'Nouveau chant', orig: '', key: 'G', bpm: '72', meter: '4/4', lead: '', sections: [{ name: 'Intro', kind: 'intro', bars: 4, nash: '1', i0: 2, i1: 3, call: '', cue: '', note: '', mark: 'none', t: null }], bass: [], drums: [], tips: [], next: '' }; LIB.songs.push(s); SONG = s; saveLib(); $('#libQ').value = ''; renderLib(); setTimeout(() => $('#gTitle') && $('#gTitle').select(), 30); };
let libT = null; const libSave = () => { clearTimeout(libT); libT = setTimeout(saveLib, 400); };
function renderSong() {
  const el = $('#songDetail'); const s = SONG;
  if (!s) { el.innerHTML = `<div class="hero"><h2>📚 Ta bibliothèque</h2><p>${LIB.songs.length} chants. Choisis-en un à gauche pour le voir ou le modifier.</p><p class="muted">Ce que tu changes ici sert de point de départ quand tu ajoutes le chant à une setlist. Les setlists déjà faites ne bougent pas.</p></div>`; return; }
  el.innerHTML = `
  <div class="sethead">
    <input class="title" id="gTitle" value="${esc(s.title)}">
    <div class="row">
      <label>Titre original <input id="gOrig" value="${esc(s.orig || '')}"></label>
      <label>Tona <select id="gKey">${KEYS.map(k => `<option${k === s.key ? ' selected' : ''}>${k}</option>`).join('')}${KEYS.includes(s.key) || !s.key ? '' : `<option selected>${esc(s.key)}</option>`}</select></label>
      <label>BPM <input id="gBpm" value="${esc(s.bpm || '')}" size="5"></label>
      <label>Mesure <input id="gMeter" value="${esc(s.meter || '4/4')}" size="4"></label>
      <label>Lead <input id="gLead" value="${esc(s.lead || '')}" size="8"></label>
    </div>
    <div class="actions">
      ${CUR ? `<button class="primary" id="gToSet">＋ Ajouter à « ${esc(CUR.name)} »</button>` : ''}
      <button id="gDup">⧉ Dupliquer</button>
      <button id="gDel" class="danger">🗑 Supprimer</button>
    </div>
    ${s.fromFiche ? '<p class="muted">Créé depuis ta fiche Nashville : les mesures sont estimées (1 chiffre ≈ 1 mesure). Vérifie-les.</p>' : ''}
  </div>
  <div class="songshead"><h3>Sections <small>${totalBars(s)} mes. ${durOf(s)}</small></h3><button id="gAddSec">＋ Section</button></div>
  <div class="secs">${(s.sections || []).map((q, i) => `
    <div class="sec" style="--c:${KCOL[q.kind] || '#888'}">
      <div class="secl">
        <select data-f="kind" data-i="${i}">${KINDS.map(([k, n]) => `<option value="${k}"${k === q.kind ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <input data-f="name" data-i="${i}" value="${esc(q.name)}" placeholder="Nom">
        <label class="mini">Mes. <input data-f="bars" data-i="${i}" value="${esc(q.bars)}" size="3"></label>
      </div>
      <textarea data-f="nash" data-i="${i}" rows="${Math.max(1, String(q.nash || '').split('\n').length)}" placeholder="Degrés Nashville (Entrée = nouvelle ligne)">${esc(q.nash || '')}</textarea>
      <input data-f="call" data-i="${i}" value="${esc(q.call || '')}" placeholder="Remarque MD (ex. COUPLET · doux)">
      <div class="secr"><button data-sup="${i}" title="Monter">↑</button><button data-sdn="${i}" title="Descendre">↓</button><button data-sdup="${i}" title="Dupliquer">⧉</button><button data-sdel="${i}" class="danger" title="Supprimer">✕</button></div>
    </div>`).join('')}</div>`;
  const f = (id, k) => $(id).oninput = e => { s[k] = e.target.value; libSave(); if (k === 'title') renderLibListOnly(); };
  f('#gTitle', 'title'); f('#gOrig', 'orig'); f('#gBpm', 'bpm'); f('#gMeter', 'meter'); f('#gLead', 'lead');
  $('#gKey').onchange = e => { s.key = e.target.value; libSave(); renderLibListOnly(); };
  if ($('#gToSet')) $('#gToSet').onclick = () => { CUR.state.songs.push(fromLib(s)); saveCur(); toast('Ajouté à « ' + CUR.name + ' »'); };
  $('#gDup').onclick = () => { const c = clone(s); c.id = 'lib-' + slug(s.title) + '-' + rid(); c.title = s.title + ' (copie)'; LIB.songs.push(c); SONG = c; saveLib(); renderLib(); };
  const del = $('#gDel'); del.onclick = () => { if (!del.classList.contains('arm')) { del.classList.add('arm'); del.textContent = '🗑 Confirmer ?'; setTimeout(() => { del.classList.remove('arm'); del.textContent = '🗑 Supprimer'; }, 3000); return; } LIB.songs = LIB.songs.filter(x => x !== s); SONG = null; saveLib(); renderLib(); toast('Chant retiré de la bibliothèque (les setlists le gardent)'); };
  $('#gAddSec').onclick = () => { s.sections.push({ name: 'Refrain', kind: 'refrain', bars: 8, nash: '', i0: 5, i1: 5, call: '', cue: '', note: '', mark: 'none', t: null }); libSave(); renderSong(); };
  document.querySelectorAll('[data-f]').forEach(e => { const ev = e.tagName === 'SELECT' ? 'onchange' : 'oninput'; e[ev] = () => { const q = s.sections[+e.dataset.i], k = e.dataset.f; q[k] = k === 'bars' ? Math.max(1, parseInt(e.value) || 1) : e.value; if (k === 'kind') { e.closest('.sec').style.setProperty('--c', KCOL[q.kind]); } if (k === 'nash') e.rows = Math.max(1, e.value.split('\n').length); libSave(); }; });
  const mv = (i, d) => { const S = s.sections, j = i + d; if (j < 0 || j >= S.length) return; [S[i], S[j]] = [S[j], S[i]]; libSave(); renderSong(); };
  document.querySelectorAll('[data-sup]').forEach(b => b.onclick = () => mv(+b.dataset.sup, -1));
  document.querySelectorAll('[data-sdn]').forEach(b => b.onclick = () => mv(+b.dataset.sdn, 1));
  document.querySelectorAll('[data-sdup]').forEach(b => b.onclick = () => { const i = +b.dataset.sdup; s.sections.splice(i + 1, 0, clone(s.sections[i])); libSave(); renderSong(); });
  document.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '?'; setTimeout(() => { b.classList.remove('arm'); b.textContent = '✕'; }, 2500); return; } s.sections.splice(+b.dataset.sdel, 1); libSave(); renderSong(); });
}
function renderLibListOnly() { const L = libFilter($('#libQ').value); $('#libList').innerHTML = L.map(x => `<button class="libcard${SONG && SONG.id === x.id ? ' on' : ''}" data-id="${esc(x.id)}"><b>${esc(x.title)}</b><span>${esc(x.key || '?')} · ${esc(x.bpm || '–')} BPM · ${(x.sections || []).length} sect.</span></button>`).join(''); document.querySelectorAll('.libcard').forEach(b => b.onclick = () => { SONG = LIB.songs.find(y => y.id === b.dataset.id); renderLib(); }); }

// ================= IMPORT / DOSSIER =================
$('#bFolder').onclick = () => API.openFolder();
$('#bImport').onclick = async () => {
  const res = await API.importFile(); let n = 0, last = null; const errs = [];
  for (const r of res) {
    if (r.error) { errs.push(r.file.split(/[\\/]/).pop() + ' : ' + r.error); continue; }
    if (r.kind === 'library') { let add = 0; r.songs.forEach(s => { if (!LIB.songs.some(x => x.id === s.id)) { LIB.songs.push(s); add++; } }); await saveLib(); toast(add + ' chant(s) ajouté(s) à la bibliothèque'); n++; continue; }
    const st = r.kind === 'setlist' ? r.setlist.state : r.state;
    // les chants inconnus rejoignent aussi la bibliothèque
    st.songs.forEach(s => { if (!s.libId) { const ex = LIB.songs.find(x => norm(x.title) === norm(s.title)); if (ex) s.libId = ex.id; else { const c = toLib(s); LIB.songs.push(c); s.libId = c.id; } } });
    await saveLib();
    const base = r.kind === 'setlist' ? Object.assign(clone(r.setlist), { id: undefined, topic: undefined }) : { name: r.name, date: '', state: st };
    const made = await API.create(base); last = made.id; n++;
  }
  if (last) await loadSets(last);
  if (errs.length) toast('Pas importé : ' + errs.join(' · ')); else if (n) toast('Import terminé');
};

// démarrage
loadSets().then(() => setTab(tab));
