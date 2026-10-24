// Dispense e messaggi privati.
//
// • Dispense per tutti: pezzo "handout:<id>" in chiaro, le vedono tutti i membri del tavolo.
// • Dispense e messaggi dal Master a un giocatore: cifrati con la chiave pubblica del suo personaggio
//   (ECDH P-256 + AES-GCM). La chiave privata resta solo sul dispositivo del giocatore.
// • Messaggi dal giocatore al Master: vanno in una casella del database che si legge solo con la password del Master.

const decryptedCache = new Map();
let inboxTimer = null;
let handoutsSignature = '';

function clearMessageCaches() {
  decryptedCache.clear();
  handoutsSignature = '';
}

// ---------------------------------------------------------------------------
// Crittografia
// ---------------------------------------------------------------------------

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function cryptoAvailable() { return Boolean(window.crypto?.subtle); }

async function deriveAesKey(privateJwk, publicJwk) {
  const priv = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const pub = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptFor(publicJwk, obj) {
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const ephPriv = await crypto.subtle.exportKey('jwk', eph.privateKey);
  const epk = await crypto.subtle.exportKey('jwk', eph.publicKey);
  const key = await deriveAesKey(ephPriv, publicJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { epk, iv: bufToB64(iv), ct: bufToB64(ct) };
}

async function decryptWith(privateJwk, enc) {
  const key = await deriveAesKey(privateJwk, enc.epk);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(enc.iv) }, key, b64ToBuf(enc.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

function myKeyStorageKey(charId) { return `iltavolo_key_${App.activeId}_${charId}`; }

// Il personaggio del giocatore pubblica la sua chiave pubblica; la privata resta in questo browser
async function ensureMyKeys() {
  const ch = myChar();
  if (!ch || isDM() || !cryptoAvailable() || App.ensuringKeys) return;
  const stored = Prefs.get(myKeyStorageKey(ch.id));
  if (stored && ch.pubKey) return;
  App.ensuringKeys = true;
  try {
    let pair = stored ? JSON.parse(stored) : null;
    if (!pair) {
      const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      pair = { priv: await crypto.subtle.exportKey('jwk', keys.privateKey), pub: await crypto.subtle.exportKey('jwk', keys.publicKey) };
      Prefs.set(myKeyStorageKey(ch.id), JSON.stringify(pair));
    }
    const current = getChar(ch.id);
    if (current && JSON.stringify(current.pubKey) !== JSON.stringify(pair.pub)) {
      current.pubKey = pair.pub;
      touchEnt(`char:${current.id}`);
    }
  } catch (e) {
    // Senza crittografia i messaggi privati semplicemente non arrivano su questo dispositivo
  } finally {
    App.ensuringKeys = false;
  }
}

async function decryptEntity(ent) {
  if (!ent?.enc) return ent;
  if (decryptedCache.has(ent.id)) return decryptedCache.get(ent.id);
  const stored = Prefs.get(myKeyStorageKey(ent.to));
  let result = null;
  if (stored) {
    try { result = Object.assign({}, ent, await decryptWith(JSON.parse(stored).priv, ent.enc)); } catch (e) { result = null; }
  }
  decryptedCache.set(ent.id, result);
  return result;
}

// ---------------------------------------------------------------------------
// Dati
// ---------------------------------------------------------------------------

function getHandouts() { return entList('handout:').sort((a, b) => (b.at || 0) - (a.at || 0)); }
function getDmMessages() { return entList('msg:').sort((a, b) => (a.at || 0) - (b.at || 0)); }

function handoutVisibleToMe(h) {
  if (isDM()) return h.to === 'all';
  return h.to === 'all' || h.to === App.myCharId;
}

function sentStore() {
  if (!App.vault) return [];
  if (!Array.isArray(App.vault.sent)) App.vault.sent = [];
  return App.vault.sent;
}

function playerOutboxKey() { return `iltavolo_outbox_${App.activeId}`; }
function playerOutbox() {
  try { return JSON.parse(Prefs.get(playerOutboxKey(), '[]')) || []; } catch (e) { return []; }
}

function lastReadKey() { return `iltavolo_msgread_${App.activeId}_${isDM() ? 'dm' : App.myCharId}`; }

// ---------------------------------------------------------------------------
// Invio
// ---------------------------------------------------------------------------

async function sendHandout({ to, title, text, image }) {
  if (!isDM()) return false;
  const base = { id: uid('ho'), at: Date.now(), from: 'DM', to };
  const payload = { title: title.slice(0, 120), text: text.slice(0, 20000), image: image || null };
  if (to === 'all') {
    putEnt(`handout:${base.id}`, Object.assign(base, payload));
  } else {
    const ch = getChar(to);
    if (!ch?.pubKey) { showToast('Questo giocatore non è ancora entrato con il suo personaggio: non posso cifrare la dispensa'); return false; }
    putEnt(`handout:${base.id}`, Object.assign(base, { enc: await encryptFor(ch.pubKey, payload) }));
    sentStore().push({ id: base.id, at: base.at, to, kind: 'handout', title: payload.title, text: payload.text });
    trimSentAndSave();
  }
  return true;
}

async function sendDmMessage(charId, text) {
  const ch = getChar(charId);
  if (!isDM() || !ch) return false;
  if (!ch.pubKey) { showToast(`${ch.name} non è ancora entrato con il suo personaggio: non posso scrivergli in privato`); return false; }
  const id = uid('msg');
  const at = Date.now();
  putEnt(`msg:${id}`, { id, at, from: 'DM', to: charId, enc: await encryptFor(ch.pubKey, { text: text.slice(0, 4000) }) });
  sentStore().push({ id, at, to: charId, kind: 'msg', text: text.slice(0, 4000) });
  trimSentAndSave();
  return true;
}

function trimSentAndSave() {
  const sent = sentStore();
  if (sent.length > 150) sent.splice(0, sent.length - 150);
  scheduleVaultSave();
}

async function sendPlayerMessage(text) {
  const ch = myChar();
  if (!ch || !App.activeId) return false;
  const msg = { id: uid('wh'), at: Date.now(), text: text.slice(0, 4000) };
  const res = await Sync.whisperDm(App.activeId, msg.id, ch.name, ch.id, msg.text);
  if (!res.ok) {
    const why = { offline: 'serve la connessione al cloud', local: 'questa avventura è salvata solo su questo dispositivo' }[res.reason];
    showToast(`⚠️ Messaggio non inviato${why ? `: ${why}` : ''}`);
    return false;
  }
  const out = playerOutbox();
  out.push(msg);
  Prefs.set(playerOutboxKey(), JSON.stringify(out.slice(-100)));
  return true;
}

// ---------------------------------------------------------------------------
// Casella del Master
// ---------------------------------------------------------------------------

async function refreshDmInbox() {
  if (!App.dmUnlocked || !App.activeId) return;
  const res = await Sync.listDmInbox(App.activeId, App.dmPassword);
  if (res.ok) {
    const before = (App.dmInbox || []).length;
    App.dmInbox = res.items || [];
    if (App.dmInbox.length !== before) renderMessagesBadge();
    if (!$('modalMessages').classList.contains('hidden')) renderMessagesPanel();
  }
}

function startInboxPolling() {
  clearInterval(inboxTimer);
  inboxTimer = setInterval(refreshDmInbox, 10000);
  refreshDmInbox();
}

function stopInboxPolling() {
  clearInterval(inboxTimer);
  inboxTimer = null;
  App.dmInbox = [];
}

// ---------------------------------------------------------------------------
// Interfaccia
// ---------------------------------------------------------------------------

async function threadForPlayer(charId) {
  // Conversazione vista dal Master con un giocatore, o dal giocatore con il Master
  const items = [];
  if (isDM()) {
    (App.dmInbox || []).filter(m => m.fromChar === charId).forEach(m => items.push({ at: m.at, mine: false, text: m.text, id: m.id, inbox: true }));
    sentStore().filter(m => m.to === charId && m.kind === 'msg').forEach(m => items.push({ at: m.at, mine: true, text: m.text }));
  } else {
    for (const m of getDmMessages().filter(x => x.to === App.myCharId)) {
      const d = await decryptEntity(m);
      items.push({ at: m.at, mine: false, text: d ? d.text : '🔒 Messaggio non leggibile su questo dispositivo' });
    }
    playerOutbox().forEach(m => items.push({ at: m.at, mine: true, text: m.text }));
  }
  return items.sort((a, b) => a.at - b.at);
}

async function unreadCount() {
  if (!App.activeId) return 0;
  const since = Number(Prefs.get(lastReadKey(), '0')) || 0;
  if (isDM()) return (App.dmInbox || []).filter(m => m.at > since).length;
  if (!App.myCharId) return 0;
  return getDmMessages().filter(m => m.to === App.myCharId && m.at > since).length;
}

async function renderMessagesBadge() {
  const n = await unreadCount();
  ['messagesUnreadBadge', 'dockUnreadBadge'].forEach(id => {
    const badge = $(id);
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.classList.toggle('hidden', n === 0);
  });
}

async function renderMessagesPanel() {
  const dm = isDM();
  const select = $('messagesPlayerSelect');
  showEl(select, dm, '');
  if (dm) {
    const pcs = getPCs();
    const current = select.value;
    select.innerHTML = pcs.map(c => {
      const unread = (App.dmInbox || []).filter(m => m.fromChar === c.id).length;
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.pubKey ? '' : ' (non ancora entrato)'}${unread ? ` · ${unread} msg` : ''}</option>`;
    }).join('') || '<option value="">Nessun giocatore</option>';
    if (pcs.some(c => c.id === current)) select.value = current;
  }
  const charId = dm ? select.value : App.myCharId;
  setText('messagesWithLabel', dm ? 'Conversazione privata con il giocatore' : 'Conversazione privata con il Master');
  const box = $('messagesThread');
  if (!charId) { box.innerHTML = '<div class="text-[var(--muted)] italic">Scegli prima il tuo personaggio.</div>'; return; }
  const items = await threadForPlayer(charId);
  box.innerHTML = items.length ? items.map(m => `
    <div class="chat-msg ${m.mine ? 'user' : 'bot'}">${escapeHtml(m.text)}<div class="text-[9px] opacity-70 mt-0.5">${new Date(m.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${m.inbox ? ` · <button type="button" class="underline inbox-delete-btn" data-id="${escapeHtml(m.id)}">elimina</button>` : ''}</div></div>`).join('')
    : '<div class="text-[var(--muted)] italic">Nessun messaggio. Quello che scrivi qui lo legge solo il destinatario.</div>';
  box.scrollTop = box.scrollHeight;
  Prefs.set(lastReadKey(), String(Date.now()));
  renderMessagesBadge();
}

async function renderHandouts() {
  const list = $('handoutList');
  if (!list) return;
  const visible = [];
  for (const h of getHandouts()) {
    if (!handoutVisibleToMe(h)) continue;
    const d = await decryptEntity(h);
    if (d) visible.push(d);
  }
  showEl('handoutSection', visible.length > 0);
  const sent = App.dmUnlocked ? sentStore().filter(s => s.kind === 'handout') : [];
  const signature = JSON.stringify([visible.map(h => h.id), App.dmUnlocked, sent.map(s => s.id), getHandouts().map(h => h.id)]);
  if (signature === handoutsSignature) return;
  handoutsSignature = signature;
  list.innerHTML = visible.map(h => `
    <article class="card-surface2 p-3 text-xs flex flex-col gap-1.5">
      <div class="flex items-start justify-between gap-2">
        <strong class="font-serif-title text-base">${escapeHtml(h.title || 'Dispensa')}</strong>
        <span class="text-[10px] text-[var(--muted)]">${h.to === 'all' ? '👥 per tutti' : '🔒 solo per te'} · ${new Date(h.at).toLocaleDateString('it-IT')}</span>
      </div>
      ${h.image ? `<img src="${escapeHtml(h.image)}" alt="" class="max-h-64 w-auto rounded border border-[var(--line)] self-start" />` : ''}
      ${h.text ? `<p class="whitespace-pre-wrap leading-relaxed">${linkify(h.text)}</p>` : ''}
    </article>`).join('');
  // Il Master vede le dispense mandate
  const sentList = $('dmHandoutSentList');
  if (sentList && App.dmUnlocked) {
    const publicOnes = getHandouts().filter(h => h.to === 'all').map(h => ({ id: h.id, at: h.at, title: h.title, toLabel: 'tutti' }));
    const privateOnes = sent.map(s => ({ id: s.id, at: s.at, title: s.title, toLabel: getChar(s.to)?.name || 'giocatore' }));
    const all = publicOnes.concat(privateOnes).sort((a, b) => b.at - a.at);
    sentList.innerHTML = all.length ? all.map(h => `
      <div class="flex items-center justify-between gap-2 card-surface2 px-2 py-1" data-handout="${escapeHtml(h.id)}">
        <span class="truncate">📜 ${escapeHtml(h.title || 'Dispensa')} <span class="text-[var(--muted)]">→ ${escapeHtml(h.toLabel)}</span></span>
        <button type="button" class="btn text-[10px] py-0 px-1.5 handout-delete-btn" title="Ritira la dispensa">🗑️</button>
      </div>`).join('') : '<div class="text-[var(--muted)] italic">Nessuna dispensa mandata.</div>';
  }
}

// Quando arriva una dispensa nuova per me la mostro subito
async function announceNewHandouts(keys) {
  for (const k of keys.filter(k => k.startsWith('handout:'))) {
    const h = ent(k);
    if (!h || !handoutVisibleToMe(h) || h.at < (App.joinedAt || 0)) continue;
    const d = await decryptEntity(h);
    if (d) showHandoutPopup(d);
  }
}

function showHandoutPopup(h) {
  setText('handoutPopupTitle', h.title || 'Dispensa dal Master');
  $('handoutPopupBody').innerHTML = `${h.image ? `<img src="${escapeHtml(h.image)}" alt="" class="max-h-[50vh] w-auto rounded border border-[var(--line)] mx-auto" />` : ''}${h.text ? `<p class="whitespace-pre-wrap leading-relaxed">${linkify(h.text)}</p>` : ''}`;
  setText('handoutPopupFrom', h.to === 'all' ? '📜 Dal Master, per tutto il gruppo' : '🔒 Dal Master, solo per te');
  showEl('modalHandout', true);
}

function populateHandoutTargets() {
  const sel = $('dmHandoutTo');
  const current = sel.value;
  sel.innerHTML = '<option value="all">👥 Tutti i giocatori</option>' + getPCs().map(c => `<option value="${escapeHtml(c.id)}" ${c.pubKey ? '' : 'disabled'}>🔒 Solo ${escapeHtml(c.name)}${c.pubKey ? '' : ' (non ancora entrato)'}</option>`).join('');
  if ([...sel.options].some(o => o.value === current && !o.disabled)) sel.value = current;
}

async function readHandoutImage(file) {
  const img = await loadImage(await readFileAsDataUrl(file));
  const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

function initMessageEvents() {
  $('btnOpenMessages').addEventListener('click', () => { showEl('modalMessages', true); if (isDM()) refreshDmInbox(); renderMessagesPanel(); });
  $('btnCloseMessages').addEventListener('click', () => showEl('modalMessages', false));
  $('modalMessages').addEventListener('click', (e) => { if (e.target.id === 'modalMessages') showEl('modalMessages', false); });
  $('messagesPlayerSelect').addEventListener('change', renderMessagesPanel);
  $('messagesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('messagesInput');
    const text = input.value.trim();
    if (!text) return;
    const ok = isDM() ? await sendDmMessage($('messagesPlayerSelect').value, text) : await sendPlayerMessage(text);
    if (ok) { input.value = ''; renderMessagesPanel(); }
  });
  $('messagesThread').addEventListener('click', async (e) => {
    const btn = e.target.closest('.inbox-delete-btn');
    if (!btn || !isDM()) return;
    await Sync.deleteDmInbox(App.activeId, App.dmPassword, btn.dataset.id);
    await refreshDmInbox();
    renderMessagesPanel();
  });
  $('btnCloseHandoutPopup').addEventListener('click', () => showEl('modalHandout', false));
  $('modalHandout').addEventListener('click', (e) => { if (e.target.id === 'modalHandout') showEl('modalHandout', false); });
  $('dmHandoutImage').addEventListener('change', () => setText('dmHandoutImageName', $('dmHandoutImage').files?.[0]?.name || ''));

  $('dmHandoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('dmHandoutTitle').value.trim();
    const text = $('dmHandoutText').value.trim();
    const file = $('dmHandoutImage').files?.[0];
    if (!title && !text && !file) { showToast('Scrivi qualcosa o allega un\'immagine'); return; }
    let image = null;
    if (file) {
      try { image = await readHandoutImage(file); } catch (err) { showToast('⚠️ Immagine non leggibile'); return; }
    }
    const ok = await sendHandout({ to: $('dmHandoutTo').value, title: title || 'Dispensa', text, image });
    if (!ok) return;
    $('dmHandoutTitle').value = '';
    $('dmHandoutText').value = '';
    autoSizeTextarea($('dmHandoutText'));
    $('dmHandoutImage').value = '';
    setText('dmHandoutImageName', '');
    showToast('📜 Dispensa mandata');
    renderHandouts();
  });
  $('dmHandoutSentList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-handout]');
    if (!row || !e.target.closest('.handout-delete-btn') || !isDM()) return;
    const id = row.dataset.handout;
    if (ent(`handout:${id}`)) removeEnt(`handout:${id}`);
    if (App.vault) { App.vault.sent = sentStore().filter(s => s.id !== id); scheduleVaultSave(); }
    renderHandouts();
  });
}
