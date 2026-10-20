// Stato dell'interfaccia, accesso ai dati della campagna attiva, permessi e piccoli aiuti per il DOM.

const App = {
  activeId: null,          // campagna aperta
  role: null,              // 'DM' | 'PLAYER' su questo dispositivo
  dmUnlocked: false,       // cassaforte aperta con la password giusta
  dmPassword: '',
  vault: null,             // segreti del DM (solo se sbloccato)
  viewMode: 'PLAYER',      // il DM può vedere l'anteprima di ciò che vedono i giocatori
  myCharId: null,
  sheetCharId: null,
  tab: 'tavolo',
  zoom: 1,
  zoomUserSet: false,
  fogEdit: false,
  advMode: 'normal',
  selectedTokenId: null,
  drag: null,
  fogPaint: null,
  journalFilter: 'Tutto',
  books: [],
  secretRolls: [],
  chat: [],
  ai: { checked: false, available: false, reason: '' },
  lobby: [],
  lobbyLoaded: false,
  onboardingCampId: null,
  extracted: []
};

// ---------------------------------------------------------------------------
// Dati della campagna attiva
// ---------------------------------------------------------------------------

function camp() { return App.activeId ? Campaigns[App.activeId] || null : null; }
function ent(key) { return camp()?.ents[key]; }
function entList(prefix) {
  const c = camp();
  if (!c) return [];
  return Object.keys(c.ents).filter(k => k.startsWith(prefix)).map(k => c.ents[k]).filter(Boolean);
}
function putEnt(key, data) { if (App.activeId) Sync.put(App.activeId, key, data); }
function touchEnt(key) { if (App.activeId) Sync.touch(App.activeId, key); }
function removeEnt(key) { if (App.activeId) Sync.remove(App.activeId, key); }

function getMeta() {
  const c = camp();
  if (!c) return normalizeMeta({});
  if (!c.ents.meta) c.ents.meta = normalizeMeta({});
  return c.ents.meta;
}
function getScene() {
  const c = camp();
  if (!c) return normalizeScene({});
  if (!c.ents.scene) c.ents.scene = normalizeScene({});
  return c.ents.scene;
}
function getInitMeta() {
  const c = camp();
  if (!c) return normalizeInitMeta({});
  if (!c.ents.initmeta) c.ents.initmeta = normalizeInitMeta({});
  return c.ents.initmeta;
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'it');
function getChars() { return entList('char:').sort(byName); }
function getPCs() { return getChars().filter(c => !c.isNpc); }
function getChar(id) { return id ? ent(`char:${id}`) || null : null; }
function getTokens() { return entList('token:'); }
function getToken(id) { return id ? ent(`token:${id}`) || null : null; }
function tokenForChar(charId) { return getTokens().find(t => t.charId === charId) || null; }
function getJournal() { return entList('journal:').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }
function getRolls() { return entList('roll:').sort((a, b) => (b.at || 0) - (a.at || 0)); }
function getInitEntries() {
  return entList('init:').sort((a, b) => (b.score - a.score) || (b.dexMod - a.dexMod) || String(a.name).localeCompare(String(b.name), 'it') || String(a.id).localeCompare(String(b.id)));
}

// Statistiche mostrate da una pedina: quelle dei PG vengono dalla scheda (unica fonte)
function tokenStats(tok) {
  const ch = tok?.charId ? getChar(tok.charId) : null;
  if (ch) return { name: ch.name, hp: ch.hp, maxHp: ch.maxHp, ac: ch.ac, conditions: ch.conditions || [], char: ch };
  return { name: tok.name, hp: tok.hp, maxHp: tok.maxHp, ac: tok.ac, conditions: tok.conditions || [], char: null };
}

function describeHealth(hp, maxHp) {
  if (!maxHp) return '';
  if (hp <= 0) return '💀 A terra';
  const pct = hp / maxHp;
  if (pct >= 1) return '💪 Illeso';
  if (pct > 0.5) return '🩹 Ferito';
  if (pct > 0.25) return '🩸 Gravemente ferito';
  return '☠️ Quasi morto';
}

// ---------------------------------------------------------------------------
// Ruoli e permessi
// ---------------------------------------------------------------------------

// Poteri del Master attivi (non in anteprima giocatore)
function isDM() { return App.dmUnlocked && App.viewMode === 'DM'; }
function myChar() { return getChar(App.myCharId); }
function canEditChar(ch) {
  if (!ch) return false;
  if (isDM()) return true;
  return !ch.isNpc && (ch.ownerId === DEVICE_ID || ch.id === App.myCharId);
}
function canControlToken(tok) {
  if (!tok) return false;
  if (isDM()) return true;
  return Boolean(tok.charId) && canEditChar(getChar(tok.charId));
}
function actorName() {
  if (isDM()) return 'DM';
  return myChar()?.name || 'Giocatore';
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

// Aggiorna un campo senza disturbare chi ci sta scrivendo
function setVal(el, value) {
  if (!el || document.activeElement === el) return;
  if (el.type === 'checkbox') { el.checked = Boolean(value); return; }
  const v = value === null || value === undefined ? '' : String(value);
  if (el.value !== v) el.value = v;
}

function setText(id, text) {
  const el = typeof id === 'string' ? $(id) : id;
  if (el && el.textContent !== String(text)) el.textContent = String(text);
}

function showEl(el, visible, displayClass = 'flex') {
  el = typeof el === 'string' ? $(el) : el;
  if (!el) return;
  el.classList.toggle('hidden', !visible);
  if (visible && displayClass) el.classList.add(displayClass);
}

// Non ricostruire un elenco mentre qualcuno sta scrivendo dentro: lo farà quando esce
function safeRebuild(container, build) {
  if (!container) return;
  if (container.contains(document.activeElement) && document.activeElement !== document.body) {
    container.dataset.staleRender = '1';
    if (!container.dataset.staleListener) {
      container.dataset.staleListener = '1';
      container.addEventListener('focusout', () => {
        setTimeout(() => {
          if (container.dataset.staleRender === '1' && !container.contains(document.activeElement)) {
            container.dataset.staleRender = '';
            scheduleRender();
          }
        }, 0);
      });
    }
    return;
  }
  container.dataset.staleRender = '';
  build();
}

// Porta il cursore su un campo appena compare, ma solo se l'utente non sta già scrivendo altrove
function focusSoon(id, select = false) {
  setTimeout(() => {
    const el = $(id);
    const active = document.activeElement;
    if (!el || (active && active !== document.body && active !== el && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    el.focus();
    if (select && el.select) el.select();
  }, 40);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(msg, ms = 2800) {
  const toast = $('toastNotification');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), ms);
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function slugify(text) {
  return String(text || 'campagna').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'campagna';
}

function formatMeters(squares) {
  return `${(squares * 1.5).toLocaleString('it-IT', { maximumFractionDigits: 1 })} m`;
}
