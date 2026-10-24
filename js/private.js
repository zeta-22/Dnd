// Note personali e storia del personaggio.
//
// • PIN personale: la chiave (AES-GCM) si ricava dal PIN con PBKDF2. Sul personaggio restano solo il
//   "sale" e una prova cifrata per riconoscere il PIN giusto; su ogni dispositivo il PIN si chiede una volta.
// • Note personali "note:<id>": cifrate con la chiave del PIN, le legge solo chi le scrive (nemmeno il Master).
// • Storia del personaggio: in chiaro se è per tutti. Se è "solo io e il Master" è cifrata due volte:
//   con la chiave del PIN del giocatore e con la chiave pubblica del Master, la cui chiave privata sta
//   nella cassaforte (si apre solo con la password del Master).

const PIN_ITERATIONS = 150000;
const STORY_FIELDS = [
  ['text', '📜 Storia', 'Da dove viene, cosa gli è successo, perché è partito all\'avventura…', 5],
  ['look', '🪞 Aspetto', 'Età, altezza, segni particolari, come si veste…', 2],
  ['traits', '🎭 Tratti caratteriali', 'Come si comporta, abitudini, modi di dire…', 2],
  ['ideals', '⭐ Ideali', 'In cosa crede, cosa lo guida…', 2],
  ['bonds', '🔗 Legami', 'Persone, luoghi o cose a cui tiene…', 2],
  ['flaws', '💢 Difetti', 'Debolezze, paure, vizi…', 2]
];
const pinKeys = new Map();          // charId → CryptoKey
const privateCache = new Map();     // "id:versione" → contenuto decifrato
let pinRequest = null;              // { ch, resolve }
let storySaveTimer = null;

// ---------------------------------------------------------------------------
// Chiave del PIN
// ---------------------------------------------------------------------------

async function derivePinKey(pin, saltB64) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBuf(saltB64), iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function aesEncrypt(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: bufToB64(iv), ct: bufToB64(ct) };
}

async function aesDecrypt(key, enc) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(enc.iv) }, key, b64ToBuf(enc.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

function pinStorageKey(charId) { return `iltavolo_pin_${App.activeId}_${charId}`; }

async function rememberPinKey(ch, key) {
  pinKeys.set(ch.id, key);
  try { Prefs.set(pinStorageKey(ch.id), bufToB64(await crypto.subtle.exportKey('raw', key))); } catch (e) {}
}

// La chiave già pronta su questo dispositivo, senza chiedere niente
async function knownPinKey(ch) {
  if (!ch?.pinSalt || !ch.pinCheck || !cryptoAvailable()) return null;
  if (pinKeys.has(ch.id)) return pinKeys.get(ch.id);
  const raw = Prefs.get(pinStorageKey(ch.id));
  if (!raw) return null;
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBuf(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
    await aesDecrypt(key, ch.pinCheck);
    pinKeys.set(ch.id, key);
    return key;
  } catch (e) {
    // PIN cambiato da un altro dispositivo
    Prefs.del(pinStorageKey(ch.id));
    return null;
  }
}

// Chiede il PIN se serve (o lo fa scegliere la prima volta). → CryptoKey oppure null se annullato
async function requirePinKey(ch) {
  if (!cryptoAvailable()) { showToast('⚠️ Questo browser non permette la cifratura: aggiornalo o usa un altro browser', 4500); return null; }
  const known = await knownPinKey(ch);
  if (known) return known;
  return new Promise((resolve) => {
    if (pinRequest) pinRequest.resolve(null);
    pinRequest = { ch, resolve };
    const first = !ch.pinSalt;
    setText('pinModalTitle', first ? `🔐 Scegli il PIN di ${ch.name}` : `🔐 PIN di ${ch.name}`);
    setText('pinModalText', first
      ? 'Il PIN protegge le tue note personali e la storia privata: senza PIN nessuno può leggerle, nemmeno il Master. Te lo chiederà una volta su ogni dispositivo. Se lo dimentichi non si possono recuperare.'
      : 'Scrivi il tuo PIN personale per aprire le note e la storia privata su questo dispositivo.');
    showEl('pinRepeatRow', first, '');
    showEl('btnPinForgot', !first, '');
    $('inputPin').value = '';
    $('inputPinRepeat').value = '';
    setText('pinError', '');
    showEl('modalPin', true);
    focusSoon('inputPin');
  });
}

function finishPinRequest(key) {
  showEl('modalPin', false);
  const req = pinRequest;
  pinRequest = null;
  if (req) req.resolve(key);
}

async function submitPin() {
  const req = pinRequest;
  if (!req) return;
  const ch = getChar(req.ch.id) || req.ch;
  const pin = $('inputPin').value;
  if (pin.length < 4) { setText('pinError', 'Il PIN deve avere almeno 4 caratteri'); return; }
  $('btnPinConfirm').disabled = true;
  try {
    if (!ch.pinSalt) {
      if (pin !== $('inputPinRepeat').value) { setText('pinError', 'I due PIN non coincidono'); return; }
      const salt = bufToB64(crypto.getRandomValues(new Uint8Array(16)));
      const key = await derivePinKey(pin, salt);
      ch.pinSalt = salt;
      ch.pinCheck = await aesEncrypt(key, { ok: 'iltavolo' });
      touchEnt(`char:${ch.id}`);
      await rememberPinKey(ch, key);
      finishPinRequest(key);
      return;
    }
    const key = await derivePinKey(pin, ch.pinSalt);
    try {
      await aesDecrypt(key, ch.pinCheck);
    } catch (e) {
      setText('pinError', 'PIN sbagliato');
      return;
    }
    await rememberPinKey(ch, key);
    finishPinRequest(key);
  } finally {
    $('btnPinConfirm').disabled = false;
  }
}

// PIN dimenticato: si ricomincia, e quello che era cifrato con il vecchio PIN non si legge più
function resetPin() {
  const req = pinRequest;
  if (!req) return;
  const ch = getChar(req.ch.id);
  if (!ch || !window.confirm('Ricominciare con un nuovo PIN? Le note personali e la storia privata scritte finora andranno perse.')) return;
  entList('note:').filter(n => n.charId === ch.id).forEach(n => removeEnt(`note:${n.id}`));
  delete ch.pinSalt;
  delete ch.pinCheck;
  if (ch.storyPrivate) { ch.storyPrivate = false; ch.storyEnc = null; ch.story = {}; }
  touchEnt(`char:${ch.id}`);
  pinKeys.delete(ch.id);
  Prefs.del(pinStorageKey(ch.id));
  finishPinRequest(null);
  requirePinKey(ch).then(() => scheduleRender());
}

async function decryptCached(id, version, key, enc) {
  const k = `${id}:${version}`;
  if (privateCache.has(k)) return privateCache.get(k);
  const value = await aesDecrypt(key, enc);
  privateCache.set(k, value);
  return value;
}

function clearPrivateCaches() {
  pinKeys.clear();
  privateCache.clear();
}

// ---------------------------------------------------------------------------
// Chiavi del Master: la privata nella cassaforte, la pubblica nelle informazioni dell'avventura
// ---------------------------------------------------------------------------

async function ensureDmKeys() {
  if (!App.dmUnlocked || !App.vault || !cryptoAvailable()) return;
  try {
    if (!App.vault.dmKey?.priv) {
      const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      App.vault.dmKey = { priv: await crypto.subtle.exportKey('jwk', keys.privateKey), pub: await crypto.subtle.exportKey('jwk', keys.publicKey) };
      scheduleVaultSave();
    }
    const meta = getMeta();
    if (JSON.stringify(meta.dmPubKey) !== JSON.stringify(App.vault.dmKey.pub)) {
      meta.dmPubKey = App.vault.dmKey.pub;
      touchEnt('meta');
    }
  } catch (e) {
    // Senza crittografia la storia privata resta semplicemente non disponibile
  }
}

// ---------------------------------------------------------------------------
// Storia del personaggio
// ---------------------------------------------------------------------------

function canMakeStoryPrivate(ch) {
  return !isDM() && ch.id === App.myCharId;
}

async function storyForView(ch) {
  // → { data, editable, locked: 'pin' | 'others' | null }
  if (!ch.storyPrivate) return { data: ch.story || {}, editable: canEditChar(ch), locked: null };
  const version = ch.storyEnc?.at || 0;
  if (isDM()) {
    if (!App.vault?.dmKey?.priv || !ch.storyEnc?.dm) return { data: null, editable: false, locked: 'dm' };
    try {
      const data = privateCache.get(`story-dm:${ch.id}:${version}`) || await decryptWith(App.vault.dmKey.priv, ch.storyEnc.dm);
      privateCache.set(`story-dm:${ch.id}:${version}`, data);
      return { data, editable: false, locked: null };
    } catch (e) {
      return { data: null, editable: false, locked: 'dm' };
    }
  }
  if (ch.id !== App.myCharId) return { data: null, editable: false, locked: 'others' };
  const key = await knownPinKey(ch);
  if (!key) return { data: null, editable: false, locked: 'pin' };
  try {
    return { data: await decryptCached(`story:${ch.id}`, version, key, ch.storyEnc.own), editable: true, locked: null };
  } catch (e) {
    return { data: null, editable: false, locked: 'pin' };
  }
}

async function renderStoryCard(ch) {
  const card = $('sheetStoryCard');
  if (!card || !ch) return;
  if (card.contains(document.activeElement) && document.activeElement.classList.contains('story-field')) return;
  const view = await storyForView(ch);
  if (currentSheetChar()?.id !== ch.id) return;
  const priv = Boolean(ch.storyPrivate);
  $('storyVisibility').value = priv ? 'private' : 'all';
  $('storyVisibility').disabled = !canMakeStoryPrivate(ch);
  setText('storyVisibilityHint', priv
    ? (isDM() ? '🔒 Privata: la leggete solo tu e il giocatore' : ch.id === App.myCharId ? '🔒 La leggete solo tu e il Master' : '🔒 Privata')
    : '👥 Visibile a tutto il gruppo');
  const body = $('sheetStoryFields');
  if (view.locked) {
    body.innerHTML = {
      pin: '<div class="flex flex-wrap items-center gap-2"><span>🔒 La tua storia privata è protetta dal PIN.</span><button type="button" class="btn btn-felt text-xs story-unlock-btn">🔓 Apri con il PIN</button></div>',
      others: `<div class="italic text-[var(--muted)]">🔒 ${escapeHtml(ch.name)} ha tenuto la sua storia privata: la conosce solo il Master.</div>`,
      dm: '<div class="italic text-[var(--muted)]">🔒 Storia privata: non riesco ad aprirla con la chiave del Master.</div>'
    }[view.locked];
    return;
  }
  const data = view.data || {};
  body.innerHTML = STORY_FIELDS.map(([field, label, placeholder, rows]) => `
    <label class="flex flex-col gap-1"><span class="font-bold text-[var(--muted)]">${label}</span>
      <textarea class="input-field w-full text-xs story-field" data-field="${field}" rows="${rows}" placeholder="${escapeHtml(placeholder)}" ${view.editable ? '' : 'readonly'}>${escapeHtml(data[field] || '')}</textarea>
    </label>`).join('');
  if (view.editable) body.querySelectorAll('.story-field').forEach(attachMentions);
}

function readStoryFields() {
  const out = {};
  document.querySelectorAll('#sheetStoryFields .story-field').forEach(t => { out[t.dataset.field] = t.value.slice(0, 8000); });
  return out;
}

async function saveStory(ch) {
  const data = readStoryFields();
  if (!ch.storyPrivate) {
    if (!canEditChar(ch)) return;
    ch.story = data;
    touchEnt(`char:${ch.id}`);
    return;
  }
  if (ch.id !== App.myCharId) return;
  const key = await knownPinKey(ch);
  const dmPub = getMeta().dmPubKey;
  if (!key || !dmPub) return;
  const at = Date.now();
  ch.storyEnc = { at, own: await aesEncrypt(key, data), dm: await encryptFor(dmPub, data) };
  privateCache.set(`story:${ch.id}:${at}`, data);
  touchEnt(`char:${ch.id}`);
}

async function changeStoryVisibility(ch, value) {
  if (!canMakeStoryPrivate(ch)) return;
  if (value === 'private' && !ch.storyPrivate) {
    if (!getMeta().dmPubKey) {
      showToast('🔒 Per la storia privata il Master deve prima aprire la Vista DM almeno una volta', 5000);
      $('storyVisibility').value = 'all';
      return;
    }
    const key = await requirePinKey(ch);
    if (!key) { $('storyVisibility').value = 'all'; return; }
    const data = Object.assign({}, ch.story || {}, readStoryFields());
    const at = Date.now();
    ch.storyEnc = { at, own: await aesEncrypt(key, data), dm: await encryptFor(getMeta().dmPubKey, data) };
    ch.storyPrivate = true;
    ch.story = {};
    touchEnt(`char:${ch.id}`);
    showToast('🔒 Ora la tua storia la leggete solo tu e il Master');
  } else if (value === 'all' && ch.storyPrivate) {
    const key = await requirePinKey(ch);
    if (!key) { $('storyVisibility').value = 'private'; return; }
    let data = {};
    try { data = await aesDecrypt(key, ch.storyEnc.own); } catch (e) {}
    ch.story = data;
    ch.storyPrivate = false;
    ch.storyEnc = null;
    touchEnt(`char:${ch.id}`);
  }
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Note personali
// ---------------------------------------------------------------------------

function myNotes() {
  const ch = myChar();
  return ch ? entList('note:').filter(n => n.charId === ch.id).sort((a, b) => (b.upd || b.at) - (a.upd || a.at)) : [];
}

async function renderPersonalNotes() {
  const section = $('personalNotesSection');
  if (!section) return;
  const ch = myChar();
  const show = Boolean(ch) && !isDM();
  showEl(section, show);
  if (!show) return;
  const list = $('personalNotesList');
  if (section.contains(document.activeElement) && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const notes = myNotes();
  const key = await knownPinKey(ch);
  showEl('personalNotesLocked', !key, 'flex');
  showEl('personalNotesForm', Boolean(key));
  setText('personalNotesLockedText', ch.pinSalt
    ? `🔒 ${notes.length} ${notes.length === 1 ? 'nota protetta' : 'note protette'} dal tuo PIN.`
    : 'Scrivi qui quello che vuoi ricordare solo per te: le note vengono cifrate con un PIN che scegli tu.');
  setText('btnUnlockNotes', ch.pinSalt ? '🔓 Apri le mie note' : '🔐 Scegli il PIN e inizia');
  if (!key) { list.innerHTML = ''; return; }
  const items = [];
  for (const n of notes) {
    try {
      items.push(Object.assign({ id: n.id, at: n.upd || n.at }, await decryptCached(`note:${n.id}`, n.upd || n.at, key, n.enc)));
    } catch (e) {
      items.push({ id: n.id, at: n.at, title: '🔒 Nota non leggibile con questo PIN', text: '', broken: true });
    }
  }
  list.innerHTML = items.length ? items.map(n => `
    <article class="card-surface2 p-3 text-xs flex flex-col gap-1.5" data-note-id="${escapeHtml(n.id)}">
      <div class="flex items-start justify-between gap-2">
        <strong class="font-serif-title text-base">${escapeHtml(n.title || 'Nota')}</strong>
        <span class="text-[10px] text-[var(--muted)] whitespace-nowrap">${new Date(n.at).toLocaleDateString('it-IT')}</span>
      </div>
      ${n.text ? `<p class="whitespace-pre-wrap leading-relaxed">${linkify(n.text)}</p>` : ''}
      <div class="flex flex-wrap gap-1.5 justify-end">
        ${n.broken ? '' : '<button type="button" class="btn text-[11px] py-0.5 note-edit-btn">✏️ Modifica</button><button type="button" class="btn text-[11px] py-0.5 note-share-btn" title="Copia la nota nel Diario del gruppo">📤 Condividi nel Diario</button>'}
        <button type="button" class="btn text-[11px] py-0.5 text-[var(--danger)] note-delete-btn">🗑️</button>
      </div>
    </article>`).join('') : '<div class="text-xs italic text-[var(--muted)]">Nessuna nota. Quello che scrivi qui lo leggi solo tu.</div>';
}

async function savePersonalNote() {
  const ch = myChar();
  if (!ch) return;
  const title = $('personalNoteTitle').value.trim();
  const text = $('personalNoteText').value.trim();
  if (!title && !text) { showToast('Scrivi qualcosa nella nota'); return; }
  const key = await requirePinKey(ch);
  if (!key) return;
  const id = App.editingNoteId && ent(`note:${App.editingNoteId}`) ? App.editingNoteId : uid('note');
  const prev = ent(`note:${id}`);
  const now = Date.now();
  const payload = { title: title.slice(0, 160), text: text.slice(0, 20000) };
  putEnt(`note:${id}`, { id, charId: ch.id, at: prev?.at || now, upd: now, enc: await aesEncrypt(key, payload) });
  privateCache.set(`note:${id}:${now}`, payload);
  App.editingNoteId = null;
  $('personalNoteTitle').value = '';
  $('personalNoteText').value = '';
  autoSizeTextarea($('personalNoteText'));
  setText('btnSavePersonalNote', '💾 Salva nota');
  $('personalNoteText').blur();
  showToast('📓 Nota salvata: la leggi solo tu');
  renderPersonalNotes();
}

async function onPersonalNotesClick(e) {
  const row = e.target.closest('[data-note-id]');
  const ch = myChar();
  if (!row || !ch) return;
  const note = ent(`note:${row.dataset.noteId}`);
  if (!note) return;
  if (e.target.closest('.note-delete-btn')) {
    if (!window.confirm('Eliminare questa nota?')) return;
    removeEnt(`note:${note.id}`);
    renderPersonalNotes();
    return;
  }
  const key = await knownPinKey(ch);
  if (!key) return;
  const data = await decryptCached(`note:${note.id}`, note.upd || note.at, key, note.enc);
  if (e.target.closest('.note-edit-btn')) {
    App.editingNoteId = note.id;
    $('personalNoteTitle').value = data.title || '';
    $('personalNoteText').value = data.text || '';
    autoSizeTextarea($('personalNoteText'));
    setText('btnSavePersonalNote', '💾 Salva modifiche');
    focusSoon('personalNoteText');
  }
  if (e.target.closest('.note-share-btn')) {
    // Apre il modulo del Diario già compilato: si sceglie la categoria e si conferma
    openJournalForm(true);
    $('journalInputTitle').value = data.title || '';
    $('journalInputDetails').value = data.text || '';
    autoSizeTextarea($('journalInputDetails'));
    $('journalAddFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('📤 Scegli la categoria e premi “Aggiungi”: la nota resta anche tra le tue', 4000);
  }
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initPrivateEvents() {
  $('btnPinConfirm').addEventListener('click', submitPin);
  $('btnPinCancel').addEventListener('click', () => finishPinRequest(null));
  $('btnPinForgot').addEventListener('click', resetPin);
  ['inputPin', 'inputPinRepeat'].forEach(id => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); }));

  $('storyVisibility').addEventListener('change', (e) => {
    const ch = currentSheetChar();
    if (ch) changeStoryVisibility(ch, e.target.value);
  });
  $('sheetStoryFields').addEventListener('input', (e) => {
    if (!e.target.classList.contains('story-field')) return;
    const ch = currentSheetChar();
    if (!ch) return;
    clearTimeout(storySaveTimer);
    storySaveTimer = setTimeout(() => saveStory(ch), 600);
  });
  $('sheetStoryFields').addEventListener('focusout', (e) => {
    if (!e.target.classList.contains('story-field') || !storySaveTimer) return;
    clearTimeout(storySaveTimer);
    storySaveTimer = null;
    const ch = currentSheetChar();
    if (ch) saveStory(ch);
  });
  $('sheetStoryFields').addEventListener('click', async (e) => {
    if (!e.target.closest('.story-unlock-btn')) return;
    const ch = currentSheetChar();
    if (ch && await requirePinKey(ch)) scheduleRender();
  });

  $('btnUnlockNotes').addEventListener('click', async () => {
    const ch = myChar();
    if (ch && await requirePinKey(ch)) renderPersonalNotes();
  });
  $('btnSavePersonalNote').addEventListener('click', savePersonalNote);
  $('personalNotesList').addEventListener('click', onPersonalNotesClick);
}
