// Modello dati del Tavolo.
//
// Una campagna è un insieme di "pezzi" (entità) indicizzati da una chiave:
//   meta              titolo, password sì/no
//   scene             griglia, nebbia, dimensioni della mappa
//   map               immagine della mappa caricata dal DM
//   char:<id>         scheda personaggio (PG o PNG)
//   token:<id>        pedina sulla mappa
//   journal:<id>      voce del diario
//   roll:<id>         tiro di dado
//   init:<id>         combattente in iniziativa
//   initmeta          round e turno attivo
// I segreti del DM (note, nemici preparati) NON stanno qui ma nella cassaforte (vedi sync.js).
// Ogni pezzo si sincronizza da solo: due persone che modificano pezzi diversi non si pestano i piedi.

const Prefs = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function getOrCreateDeviceUserId() {
  let id = Prefs.get('iltavolo_device_user_id');
  if (!id) {
    id = uid('usr');
    Prefs.set('iltavolo_device_user_id', id);
  }
  return id;
}

const DEVICE_ID = getOrCreateDeviceUserId();

// Tutte le campagne conosciute da questo dispositivo: id → { id, ents, rev, synced }
const Campaigns = {};

// ---------------------------------------------------------------------------
// Valori di default e normalizzazione
// ---------------------------------------------------------------------------

const MAP_WIDTH = 800;
const DEFAULT_MAP_HEIGHT = 600;

function createEmptySpellSlots() {
  const slots = {};
  for (let lvl = 1; lvl <= 9; lvl++) slots[lvl] = { max: 0, used: 0 };
  return slots;
}

function ensureCharacterDefaults(char) {
  if (!char) return null;
  char.id = char.id || uid('char');
  char.isNpc = Boolean(char.isNpc);
  char.name = char.name || 'Senza nome';
  char.race = char.race || 'Umano';
  char.className = char.className || 'Avventuriero';
  char.level = clampInt(char.level, 1, 20, 1);
  char.background = char.background ?? '';
  char.bonusAction = char.bonusAction ?? '';
  char.maxHp = Math.max(1, parseInt(char.maxHp, 10) || 10);
  char.hp = Math.max(0, Math.min(char.maxHp, char.hp !== undefined && char.hp !== null ? (parseInt(char.hp, 10) || 0) : char.maxHp));
  char.tempHp = Math.max(0, parseInt(char.tempHp, 10) || 0);
  char.ac = parseInt(char.ac, 10) || 10;
  char.speed = char.speed !== undefined && char.speed !== null && !isNaN(Number(char.speed)) ? Number(char.speed) : 9;
  // Il vecchio formato salvava "2d8" (livello + dado): teniamo solo il tipo di dado
  const die = String(char.hitDie || 'd8').toLowerCase().match(/d(\d+)/);
  char.hitDie = die ? `d${die[1]}` : 'd8';
  char.hitDiceRemaining = char.hitDiceRemaining !== undefined && char.hitDiceRemaining !== null
    ? clampInt(char.hitDiceRemaining, 0, char.level, char.level) : char.level;
  if (!char.deathSaves || typeof char.deathSaves !== 'object') char.deathSaves = { successes: 0, failures: 0 };
  char.deathSaves.successes = clampInt(char.deathSaves.successes, 0, 3, 0);
  char.deathSaves.failures = clampInt(char.deathSaves.failures, 0, 3, 0);
  if (!char.abilities || typeof char.abilities !== 'object') char.abilities = {};
  ABILITY_KEYS.forEach(k => { char.abilities[k] = clampInt(char.abilities[k], 1, 30, 10); });
  if (!char.savingThrowsProf || typeof char.savingThrowsProf !== 'object') char.savingThrowsProf = {};
  if (!char.skillsProf || typeof char.skillsProf !== 'object') char.skillsProf = {};
  if (char.attacksText === undefined || char.attacksText === null) char.attacksText = '';
  if (!char.spellSlots || typeof char.spellSlots !== 'object') char.spellSlots = createEmptySpellSlots();
  for (let lvl = 1; lvl <= 9; lvl++) {
    const s = char.spellSlots[lvl] || {};
    const max = clampInt(s.max, 0, 9, 0);
    char.spellSlots[lvl] = { max, used: clampInt(s.used, 0, max, 0) };
  }
  if (!Array.isArray(char.conditions)) char.conditions = [];
  ['equipmentText', 'spellsText', 'featuresText', 'notes'].forEach(f => { if (typeof char[f] !== 'string') char[f] = char[f] ? String(char[f]) : ''; });
  if (char.ownerId === undefined) char.ownerId = null;
  return char;
}

function normalizeToken(tok) {
  if (!tok) return null;
  tok.id = tok.id || uid('tok');
  tok.name = tok.name || 'Pedina';
  tok.type = ['pc', 'enemy', 'npc'].includes(tok.type) ? tok.type : 'enemy';
  tok.gridX = Math.max(0, parseInt(tok.gridX, 10) || 0);
  tok.gridY = Math.max(0, parseInt(tok.gridY, 10) || 0);
  tok.maxHp = Math.max(0, parseInt(tok.maxHp, 10) || 0);
  tok.hp = Math.max(0, Math.min(tok.maxHp || 9999, parseInt(tok.hp, 10) || 0));
  tok.ac = parseInt(tok.ac, 10) || 10;
  tok.hidden = Boolean(tok.hidden);
  tok.charId = tok.charId || null;
  tok.initMod = parseInt(tok.initMod, 10) || 0;
  return tok;
}

function getSceneDims(scene) {
  const width = MAP_WIDTH;
  const height = clampInt(scene?.height, 200, 2400, DEFAULT_MAP_HEIGHT);
  const cols = clampInt(scene?.gridSize, 4, 120, 16);
  const cellPx = width / cols;
  const rows = Math.max(1, Math.ceil(height / cellPx - 0.001));
  return { width, height, cols, rows, cellPx };
}

// Ricampiona una nebbia (stringa di 0/1) su una nuova griglia mantenendo le zone
function resampleFog(fog, oldCols, oldRows, newCols, newRows) {
  if (!fog || !oldCols || !oldRows) return '1'.repeat(newCols * newRows);
  let out = '';
  for (let r = 0; r < newRows; r++) {
    const or = Math.min(oldRows - 1, Math.floor(((r + 0.5) / newRows) * oldRows));
    for (let c = 0; c < newCols; c++) {
      const oc = Math.min(oldCols - 1, Math.floor(((c + 0.5) / newCols) * oldCols));
      out += fog[or * oldCols + oc] === '0' ? '0' : '1';
    }
  }
  return out;
}

function normalizeScene(scene) {
  scene = scene && typeof scene === 'object' ? scene : {};
  scene.width = MAP_WIDTH;
  scene.height = clampInt(scene.height, 200, 2400, DEFAULT_MAP_HEIGHT);
  scene.gridEnabled = scene.gridEnabled !== false;
  scene.gridSize = clampInt(scene.gridSize, 4, 120, 16);
  scene.fogEnabled = scene.fogEnabled !== false;
  const { cols, rows } = getSceneDims(scene);
  // Vecchio formato: array di 192 booleani su griglia fissa 16×12
  if (Array.isArray(scene.fogCells)) {
    const legacy = scene.fogCells.slice(0, 192).map(v => (v ? '1' : '0')).join('').padEnd(192, '1');
    scene.fog = legacy;
    scene.fogCols = 16;
    scene.fogRows = 12;
    delete scene.fogCells;
  }
  if (typeof scene.fog !== 'string' || scene.fogCols !== cols || scene.fogRows !== rows || scene.fog.length !== cols * rows) {
    const valid = typeof scene.fog === 'string' && scene.fogCols > 0 && scene.fogRows > 0 && scene.fog.length === scene.fogCols * scene.fogRows;
    scene.fog = valid ? resampleFog(scene.fog, scene.fogCols, scene.fogRows, cols, rows) : '1'.repeat(cols * rows);
    scene.fogCols = cols;
    scene.fogRows = rows;
  }
  scene.mapVersion = parseInt(scene.mapVersion, 10) || 0;
  scene.hasMap = Boolean(scene.hasMap);
  return scene;
}

function normalizeMeta(meta) {
  meta = meta && typeof meta === 'object' ? meta : {};
  meta.title = String(meta.title || 'Avventura senza nome').slice(0, 120);
  meta.createdAt = Number(meta.createdAt) || Date.now();
  meta.hasPassword = Boolean(meta.hasPassword);
  return meta;
}

function normalizeJournal(j) {
  if (!j) return null;
  j.id = j.id || uid('j');
  j.category = j.category || 'Sessioni';
  j.title = j.title || 'Senza titolo';
  j.content = j.content || '';
  j.date = j.date || new Date().toLocaleDateString('it-IT');
  j.createdAt = Number(j.createdAt) || 0;
  j.completed = Boolean(j.completed);
  j.dmAnswer = j.dmAnswer || '';
  return j;
}

function normalizeInitEntry(e) {
  if (!e) return null;
  e.id = e.id || uid('init');
  e.name = e.name || '???';
  e.score = parseInt(e.score, 10) || 0;
  e.dexMod = parseInt(e.dexMod, 10) || 0;
  return e;
}

function normalizeInitMeta(m) {
  m = m && typeof m === 'object' ? m : {};
  m.round = Math.max(1, parseInt(m.round, 10) || 1);
  m.inCombat = Boolean(m.inCombat);
  m.activeId = m.activeId || null;
  return m;
}

function normalizeEntity(key, data) {
  if (data === null || data === undefined) return data;
  if (key === 'meta') return normalizeMeta(data);
  if (key === 'scene') return normalizeScene(data);
  if (key === 'initmeta') return normalizeInitMeta(data);
  if (key.startsWith('char:')) return ensureCharacterDefaults(data);
  if (key.startsWith('token:')) return normalizeToken(data);
  if (key.startsWith('journal:')) return normalizeJournal(data);
  if (key.startsWith('init:')) return normalizeInitEntry(data);
  return data;
}

function normalizeVault(v) {
  v = v && typeof v === 'object' ? v : {};
  v.secretNotes = typeof v.secretNotes === 'string' ? v.secretNotes : '';
  v.sessionNotes = typeof v.sessionNotes === 'string' ? v.sessionNotes : '';
  v.enemies = Array.isArray(v.enemies) ? v.enemies : [];
  v.enemies.forEach(e => {
    e.id = e.id || uid('en');
    e.name = e.name || 'Nemico';
    e.cr = DMG_CR_TABLE.some(r => r.cr === String(e.cr)) ? String(e.cr) : '1/4';
    e.ac = parseInt(e.ac, 10) || 10;
    e.hp = Math.max(1, parseInt(e.hp, 10) || 1);
    e.qty = clampInt(e.qty, 1, 50, 1);
    e.included = e.included !== false;
  });
  v.partyCount = v.partyCount ? clampInt(v.partyCount, 1, 12, 4) : null;
  v.partyLevel = v.partyLevel ? clampInt(v.partyLevel, 1, 20, 1) : null;
  return v;
}

// ---------------------------------------------------------------------------
// Creazione di campagne
// ---------------------------------------------------------------------------

function createInitialFog(scene, revealRect) {
  const { cols, rows } = getSceneDims(scene);
  let fog = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const revealed = revealRect && c >= revealRect.c0 && c <= revealRect.c1 && r >= revealRect.r0 && r <= revealRect.r1;
      fog += revealed ? '0' : '1';
    }
  }
  return fog;
}

function buildNewCampaignEntities(title, options = {}) {
  const scene = normalizeScene({ gridSize: 16, height: DEFAULT_MAP_HEIGHT, fogEnabled: true, gridEnabled: true });
  const ents = {
    meta: normalizeMeta({ title, createdAt: Date.now(), hasPassword: Boolean(options.hasPassword) }),
    scene,
    initmeta: normalizeInitMeta({})
  };
  if (!options.sample) {
    scene.fog = createInitialFog(scene, { c0: 1, c1: 6, r0: 2, r1: 9 });
    return ents;
  }
  scene.fog = createInitialFog(scene, { c0: 1, c1: 6, r0: 2, r1: 9 });
  const elena = ensureCharacterDefaults({
    id: uid('char'), name: 'Elena', race: 'Elfa', className: 'Ladra', level: 2, background: 'Criminale',
    bonusAction: 'Azione scaltra', hp: 17, maxHp: 17, ac: 15, speed: 9, hitDie: 'd8',
    abilities: { FOR: 10, DES: 18, COS: 14, INT: 14, SAG: 12, CAR: 10 },
    savingThrowsProf: { DES: true, INT: true },
    skillsProf: { 'Furtività': 2, 'Acrobazia': 1, 'Percezione': 1, 'Rapidità di Mano': 2, 'Indagare': 1 },
    attacksText: 'Spada corta | +6 | 1d6+4\nArco corto | +6 | 1d6+4',
    equipmentText: 'Zaino, attrezzi da scasso, corda (15 m), 2 torce, 15 mo.',
    featuresText: 'Attacco furtivo (1d6), Azione scaltra, Gergo ladresco.'
  });
  const goblinA = { id: uid('tok'), name: 'Goblin', type: 'enemy', gridX: 11, gridY: 4, hp: 7, maxHp: 7, ac: 15, hidden: false, initMod: 2 };
  const goblinB = { id: uid('tok'), name: 'Goblin Arciere', type: 'enemy', gridX: 12, gridY: 7, hp: 7, maxHp: 7, ac: 13, hidden: true, initMod: 2 };
  const elenaTok = { id: uid('tok'), name: elena.name, type: 'pc', charId: elena.id, gridX: 3, gridY: 5, hp: elena.hp, maxHp: elena.maxHp, ac: elena.ac };
  const quest = { id: uid('j'), category: 'Missioni', title: 'Recuperare il Sigillo', content: 'Trovare il sigillo di smeraldo nelle cripte sotto la cappella.', date: new Date().toLocaleDateString('it-IT'), createdAt: Date.now(), completed: false, dmAnswer: '', author: 'DM' };
  ents[`char:${elena.id}`] = elena;
  [goblinA, goblinB, elenaTok].forEach(t => { ents[`token:${t.id}`] = normalizeToken(t); });
  ents[`journal:${quest.id}`] = normalizeJournal(quest);
  return ents;
}

function buildSampleVault() {
  return normalizeVault({
    secretNotes: 'Il sigillo che cercano è un falso: quello vero lo ha il sacerdote del villaggio.\nIl Goblin Arciere è nascosto dietro la colonna (pedina nascosta).',
    enemies: [{ id: uid('en'), name: 'Goblin', cr: '1/4', ac: 15, hp: 7, qty: 2, included: true }],
    partyCount: 4, partyLevel: 2
  });
}

// ---------------------------------------------------------------------------
// Conversione dal vecchio formato (file .json della prima versione)
// ---------------------------------------------------------------------------

function isLegacyCampaignObject(obj) {
  return obj && typeof obj === 'object' && !obj.entities && (Array.isArray(obj.chars) || Array.isArray(obj.tokens) || obj.scene || obj.dmState);
}

function convertLegacyCampaign(old) {
  const ents = {};
  const title = old.title || old.name || 'Campagna importata';
  const password = String(old.dmState?.password || '');
  ents.meta = normalizeMeta({ title, createdAt: Number(old.updatedAt) || Date.now(), hasPassword: password !== '' });
  const scene = Object.assign({}, old.scene || {});
  const mapDataUrl = scene.mapDataUrl;
  delete scene.mapDataUrl;
  if (mapDataUrl) scene.hasMap = true;
  ents.scene = normalizeScene(scene);
  if (mapDataUrl) ents.map = { dataUrl: mapDataUrl };
  (old.chars || []).forEach(c => { if (c?.id) ents[`char:${c.id}`] = ensureCharacterDefaults(Object.assign({}, c)); });
  (old.tokens || []).forEach(t => { if (t?.id) ents[`token:${t.id}`] = normalizeToken(Object.assign({}, t)); });
  (old.journal || []).forEach(j => { if (j?.id) ents[`journal:${j.id}`] = normalizeJournal(Object.assign({}, j)); });
  (old.init || []).forEach(e => { if (e?.id) ents[`init:${e.id}`] = normalizeInitEntry(Object.assign({}, e)); });
  const activeIdx = parseInt(old.initMeta?.activeIndex, 10) || 0;
  ents.initmeta = normalizeInitMeta({ round: old.initMeta?.round, inCombat: old.initMeta?.inCombat, activeId: (old.init || [])[activeIdx]?.id || null });
  const vault = normalizeVault({
    secretNotes: old.dmState?.secretNotes || '',
    enemies: old.enemies || [],
    partyCount: old.dmState?.partyCount,
    partyLevel: old.dmState?.partyAvgLevel
  });
  return { ents, vault, password };
}

// Prepara un file importato (nuovo o vecchio formato) come nuova campagna con id nuovo
function prepareImportedCampaign(obj) {
  if (obj && obj.format === 'il-tavolo' && obj.entities && typeof obj.entities === 'object') {
    const ents = {};
    Object.keys(obj.entities).forEach(k => {
      if (typeof k === 'string' && k.length < 200 && obj.entities[k] !== null) ents[k] = normalizeEntity(k, obj.entities[k]);
    });
    ents.meta = normalizeMeta(ents.meta);
    ents.scene = normalizeScene(ents.scene);
    ents.initmeta = normalizeInitMeta(ents.initmeta);
    return { ents, vault: normalizeVault(obj.vault || {}), password: '' };
  }
  if (isLegacyCampaignObject(obj)) return convertLegacyCampaign(obj);
  return null;
}

// ---------------------------------------------------------------------------
// IndexedDB: copia locale delle campagne, cassaforti locali, PDF
// ---------------------------------------------------------------------------

const IDB_NAME = 'IlTavolo_v2';
const IDB_VERSION = 1;
const LEGACY_IDB_NAME = 'IlTavoloDnD5e_DB';
let idbPromise = null;

function openIdb() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        ['campaigns', 'vaults', 'books'].forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return idbPromise;
}

async function idbGetAll(store) {
  const db = await openIdb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}

async function idbGet(store, id) {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, 'readonly').objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

async function idbPut(store, value) {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (e) { resolve(false); }
  });
}

async function idbDelete(store, id) {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) { resolve(false); }
  });
}

// Recupera le campagne salvate dalla prima versione dell'app su questo dispositivo
async function readLegacyLocalCampaigns() {
  if (Prefs.get('iltavolo_legacy_imported') === '1') return [];
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(LEGACY_IDB_NAME);
      req.onupgradeneeded = () => {
        // Il database non esisteva: annulla la creazione
        req.transaction.abort();
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('campaigns')) { db.close(); resolve([]); return; }
        const getReq = db.transaction('campaigns', 'readonly').objectStore('campaigns').getAll();
        getReq.onsuccess = () => { db.close(); resolve(getReq.result || []); };
        getReq.onerror = () => { db.close(); resolve([]); };
      };
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}

async function sha256Hex(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Contesti non sicuri (raro): hash semplice, la cassaforte locale resta comunque sul dispositivo
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return 'weak_' + h.toString(16);
  }
}
