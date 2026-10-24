// Avvio dell'app, lobby delle avventure, ingresso come Master o Giocatore, intestazione e disegno.

let renderQueued = false;
let lobbyPollTimer = null;
let needsFit = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderAll();
  });
}

function renderAll() {
  applyRoleUI();
  renderSyncBadges();
  if (!App.activeId || !camp()) return;
  renderHeader();
  if (needsFit && !App.zoomUserSet && App.tab === 'tavolo') { needsFit = false; fitZoom(); } else renderMap();
  renderInitiative();
  renderRolls();
  renderSheet();
  renderJournal();
  renderDmView();
  renderSummaryBar();
  renderHandouts();
  renderMessagesBadge();
  collectUnusedImages();
  renderPersonalNotes();
  refreshSheetTypeSelects();
  renderDock();
  autoSizeTextareas();
  if (!isDM() && myChar()) ensureMyKeys();
}

// ---------------------------------------------------------------------------
// Ruoli e intestazione
// ---------------------------------------------------------------------------

function applyRoleUI() {
  const dm = isDM();
  document.body.classList.toggle('is-dm', dm);
  setText('viewModeLabel', App.dmUnlocked ? (App.viewMode === 'DM' ? 'DM' : 'Giocatore') : 'Giocatore');
  const banner = $('playerModeBanner');
  const previewing = App.dmUnlocked && App.viewMode !== 'DM';
  banner.textContent = previewing ? '👁️ Anteprima: vedi ciò che vedono i giocatori' : 'Modalità Giocatore';
  banner.classList.toggle('hidden', dm || !App.activeId);
  $('btnToggleViewMode').title = App.dmUnlocked ? 'Passa tra la tua vista da Master e l\'anteprima dei giocatori' : 'Sblocca la vista del Master con la password';
  setText('navTabVistaDm', App.dmUnlocked ? '🐉 Vista DM' : '🔒 Vista DM');
  $('campaignTitleInput').readOnly = !dm;
  $('campaignTitleInput').title = dm ? 'Clicca per rinominare la campagna' : '';
}

function renderHeader() {
  setVal($('campaignTitleInput'), getMeta().title);
  document.title = `${getMeta().title} — Il Tavolo`;
  const select = $('campaignSelect');
  if (document.activeElement !== select) {
    const list = App.lobby.length ? App.lobby : [{ id: App.activeId, meta: getMeta() }];
    select.innerHTML = list.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === App.activeId ? 'selected' : ''}>${escapeHtml(c.meta.title)}</option>`).join('');
  }
}

function syncStatusInfo() {
  const c = camp();
  const pending = Sync.pendingCount();
  switch (Sync.mode) {
    case 'cloud':
      if (c && !c.synced) return { badge: '📱 Solo su questo dispositivo', color: 'var(--brass)', short: Sync.realtime ? 'Tempo reale' : 'Cloud' };
      return pending
        ? { badge: '⏳ Salvataggio…', color: 'var(--brass)', short: Sync.realtime ? 'Tempo reale' : 'Cloud' }
        : { badge: '☁️ Sincronizzato', color: 'var(--ok)', short: Sync.realtime ? 'Tempo reale' : 'Cloud' };
    case 'connecting': return { badge: '⏳ Connessione…', color: 'var(--muted)', short: 'Connessione…' };
    case 'setup': return { badge: '⚠️ Cloud da configurare', color: 'var(--danger)', short: 'Da configurare' };
    case 'locked': return { badge: '🔐 Serve il codice del gruppo', color: 'var(--brass)', short: 'Codice gruppo' };
    case 'offline': return { badge: pending ? `📴 Offline · ${pending} modifiche in attesa` : '📴 Offline', color: 'var(--danger)', short: 'Offline' };
    default: return { badge: '✓ Salvato sul dispositivo', color: 'var(--ok)', short: 'Solo locale' };
  }
}

function renderSyncBadges() {
  const info = syncStatusInfo();
  const badge = $('saveStatusBadge');
  setText(badge, info.badge);
  badge.style.color = info.color;
  setText('headerCloudStatusLabel', info.short);
  setText('lobbyCloudStatusLabel', info.short);
  showEl('lobbyGroupCodeBox', Sync.mode === 'locked');
  if (Sync.mode === 'locked' && App.lastSyncMode !== 'locked' && App.activeId) {
    showToast('🔐 Serve il codice del gruppo per continuare a sincronizzare: inseriscilo nella Home', 6000);
  }
  App.lastSyncMode = Sync.mode;
  if (!$('modalCloudStatus').classList.contains('hidden')) renderCloudModal();
}

function renderCloudModal() {
  const head = $('cloudStatusHeadline');
  const body = $('cloudStatusBody');
  const c = camp();
  const lines = [];
  let headline;
  if (Sync.mode === 'cloud') {
    headline = Sync.realtime ? '☁️ Connesso, aggiornamenti in tempo reale' : '☁️ Connesso';
    lines.push(Sync.realtime
      ? 'Le modifiche di tutti arrivano subito su ogni dispositivo.'
      : 'Il tempo reale non è attivo: il Tavolo controlla le novità ogni 4 secondi. Funziona lo stesso, solo un po\' meno istantaneo.');
    if (c && !c.synced) lines.push('📱 Questa avventura però è salvata solo qui: caricala nel cloud dalla Vista DM per giocarla con gli altri.');
  } else if (Sync.mode === 'setup') {
    headline = '⚠️ Il database va configurato (una volta sola)';
    lines.push('Apri Supabase → SQL Editor, incolla il contenuto del file <code>supabase/setup.sql</code> del progetto e premi Run. Poi torna qui e premi “Riprova”.');
    lines.push('Nel frattempo puoi giocare su questo dispositivo: tutto viene salvato in locale.');
  } else if (Sync.mode === 'locked') {
    headline = '🔐 Serve il codice del gruppo';
    lines.push('Questo tavolo è riservato al vostro gruppo: inserisci il codice nella schermata Home (🏠). Su questo dispositivo te lo chiederà una volta sola.');
    lines.push('Nel frattempo le avventure salvate su questo dispositivo restano utilizzabili.');
  } else if (Sync.mode === 'offline') {
    headline = '📴 Cloud non raggiungibile';
    lines.push('Stai lavorando offline: le modifiche restano su questo dispositivo e partono da sole appena torna la connessione.');
  } else if (Sync.mode === 'connecting') {
    headline = '⏳ Connessione in corso…';
  } else {
    headline = '📱 Solo su questo dispositivo';
    lines.push('Il cloud non è configurato in questa versione del sito.');
  }
  const pending = Sync.pendingCount();
  if (pending) lines.push(`Modifiche in attesa di invio: ${pending}.`);
  if (Sync.lastError && Sync.mode !== 'cloud') lines.push(`<span class="text-[10px]">Dettaglio tecnico: ${escapeHtml(Sync.lastError)}</span>`);
  if (Sync.lastSyncAt) lines.push(`<span class="text-[10px]">Ultima sincronizzazione: ${new Date(Sync.lastSyncAt).toLocaleTimeString('it-IT')}</span>`);
  head.textContent = headline;
  body.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
}

function openCloudModal() {
  showEl('modalCloudStatus', true);
  renderCloudModal();
}

function switchTab(tabId) {
  App.tab = tabId;
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  ['tavolo', 'personaggio', 'diario', 'regole', 'vistadm'].forEach(s => showEl(`tab-${s}`, s === tabId));
  if (tabId === 'tavolo' && !App.zoomUserSet) requestAnimationFrame(fitZoom);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Schermo intero: sparisce la barra in alto e le schede si cambiano dal fondo
// ---------------------------------------------------------------------------

const DOCK_TABS = [
  ['tavolo', '🗺️', 'Tavolo'],
  ['personaggio', '🧝‍♀️', 'Scheda'],
  ['diario', '📖', 'Diario'],
  ['regole', '⚖️', 'Regole'],
  ['vistadm', '🐉', 'Master']
];
let dockDrag = null;
let dockSwiped = false;

function dockTabs() {
  return DOCK_TABS.filter(([id]) => id !== 'vistadm' || App.dmUnlocked);
}

function renderDock() {
  if (!App.immersive) return;
  const track = $('immersiveDockTrack');
  const tabs = dockTabs();
  const sig = tabs.map(t => t[0]).join();
  if (track.dataset.sig !== sig) {
    track.dataset.sig = sig;
    track.querySelectorAll('.dock-tab').forEach(b => b.remove());
    track.insertAdjacentHTML('beforeend', tabs.map(([id, icon, label]) => `
      <button type="button" class="dock-tab" data-dock-tab="${id}"><span class="dock-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join(''));
    track.style.setProperty('--dock-n', tabs.length);
  }
  const i = tabs.findIndex(t => t[0] === App.tab);
  track.style.setProperty('--dock-i', Math.max(0, i));
  track.classList.toggle('no-pill', i < 0);
  track.querySelectorAll('.dock-tab').forEach(b => {
    const active = b.dataset.dockTab === App.tab;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function setImmersive(on) {
  App.immersive = on;
  document.body.classList.toggle('immersive', on);
  const root = document.documentElement;
  if (on && !fullscreenElement()) {
    // Dove il browser lo permette spariscono anche le sue barre (sull'iPhone no: resta la nostra modalità)
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req) Promise.resolve(req.call(root, { navigationUI: 'hide' })).then(() => { App.immersiveFs = true; }).catch(() => {});
  } else if (!on && App.immersiveFs && fullscreenElement()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {});
  }
  if (!on) App.immersiveFs = false;
  renderDock();
  if (App.tab === 'tavolo' && !App.zoomUserSet) requestAnimationFrame(fitZoom);
  scheduleRender();
}

function initDockEvents() {
  $('btnToggleImmersive').addEventListener('click', () => setImmersive(true));
  $('btnExitImmersive').addEventListener('click', () => setImmersive(false));
  $('btnDockMessages').addEventListener('click', () => $('btnOpenMessages').click());
  // Se si esce dallo schermo intero del browser (per esempio con Esc) torna anche la barra in alto
  const onFsChange = () => { if (!fullscreenElement() && App.immersiveFs) setImmersive(false); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  const track = $('immersiveDockTrack');
  track.addEventListener('click', (e) => {
    const b = e.target.closest('.dock-tab');
    if (b && !dockSwiped) switchTab(b.dataset.dockTab);
  });
  // Trascinando il dito sulla barra la scheda evidenziata scorre e si ferma sulla più vicina
  track.addEventListener('pointerdown', (e) => {
    dockSwiped = false;
    const tabs = dockTabs();
    dockDrag = { x: e.clientX, id: e.pointerId, moved: false, tabs, i: Math.max(0, tabs.findIndex(t => t[0] === App.tab)), w: track.clientWidth / tabs.length, dx: 0 };
  });
  track.addEventListener('pointermove', (e) => {
    if (!dockDrag || e.pointerId !== dockDrag.id) return;
    const dx = e.clientX - dockDrag.x;
    if (!dockDrag.moved) {
      if (Math.abs(dx) < 10) return;
      dockDrag.moved = true;
      track.setPointerCapture(e.pointerId);
      track.classList.add('dragging');
    }
    const { i, w, tabs } = dockDrag;
    dockDrag.dx = Math.max(-i * w, Math.min((tabs.length - 1 - i) * w, dx));
    track.style.setProperty('--dock-drag', `${dockDrag.dx}px`);
  });
  const endDrag = (e) => {
    if (!dockDrag || e.pointerId !== dockDrag.id) return;
    const { moved, i, w, dx, tabs } = dockDrag;
    dockDrag = null;
    track.classList.remove('dragging');
    track.style.setProperty('--dock-drag', '0px');
    if (!moved || e.type === 'pointercancel') return;
    dockSwiped = true;
    const target = tabs[Math.max(0, Math.min(tabs.length - 1, Math.round(i + dx / w)))][0];
    if (target !== App.tab) switchTab(target); else renderDock();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  Prefs.set('iltavolo_theme', next);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

async function refreshLobby() {
  App.lobby = await Sync.fetchLobby();
  App.lobbyLoaded = true;
  renderLobby();
  if (App.activeId) renderHeader();
}

function recognizedRole(entry) {
  const role = Prefs.get(`iltavolo_role_${entry.id}`);
  if (role === 'DM') return { role: 'DM' };
  const savedChar = Prefs.get(`iltavolo_mychar_${entry.id}`);
  const pc = entry.pcs.find(p => p.id === savedChar) || entry.pcs.find(p => p.ownerId === DEVICE_ID);
  if (pc) return { role: 'PLAYER', pc };
  return null;
}

function hiddenCampaigns() {
  try { return new Set(JSON.parse(Prefs.get('iltavolo_hidden_camps', '[]')) || []); } catch (e) { return new Set(); }
}

function setCampaignHidden(campId, hidden) {
  const set = hiddenCampaigns();
  if (hidden) set.add(campId); else set.delete(campId);
  Prefs.set('iltavolo_hidden_camps', JSON.stringify([...set]));
  renderLobby();
}

function lobbyCardTools(entry, rec) {
  const hidden = hiddenCampaigns().has(entry.id);
  return `<span class="flex items-center gap-1 flex-shrink-0">
    ${rec?.role === 'DM' ? '<button type="button" class="btn text-xs py-0.5 px-1.5 lobby-manage-btn" title="Gestisci: personaggi ed eliminazione">🛠️</button>' : ''}
    <button type="button" class="btn text-xs py-0.5 px-1.5 lobby-hide-btn" title="${hidden ? 'Mostra di nuovo nella mia Home' : 'Nascondi dalla mia Home'}">${hidden ? '👁️' : '🙈'}</button>
  </span>`;
}

function renderLobby() {
  const grid = $('lobbyCampaignsGrid');
  const hidden = hiddenCampaigns();
  const hiddenCount = App.lobby.filter(c => hidden.has(c.id)).length;
  const visible = App.lobby.filter(c => App.showHiddenCamps || !hidden.has(c.id));
  showEl('lobbyLoadingState', !App.lobbyLoaded, '');
  showEl('lobbyEmptyState', App.lobbyLoaded && visible.length === 0);
  setText('lobbyCampaignsCountBadge', visible.length);
  showEl('btnLobbyShowHidden', hiddenCount > 0, '');
  setText('btnLobbyShowHidden', App.showHiddenCamps ? '🙈 Nascondi di nuovo' : `👁️ Nascoste (${hiddenCount})`);
  $('btnCloseLobbyToTable').classList.toggle('hidden', !App.activeId);
  grid.innerHTML = visible.map(entry => {
    if (entry.source === 'locked') {
      return `
      <div class="card-surface2 p-4 flex flex-col justify-between gap-3 border-2 border-dashed border-[var(--line)]" data-camp-id="${escapeHtml(entry.id)}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-serif-title font-bold text-xl leading-tight">🔒 ${escapeHtml(entry.meta.title)}</h3>
            <span class="text-[11px] text-[var(--muted)]">Avventura di un altro gruppo, protetta da password</span>
          </div>
          ${lobbyCardTools(entry, null)}
        </div>
        <div class="flex justify-end pt-2 border-t border-[var(--line)]">
          <button type="button" class="btn btn-brass text-xs font-bold py-2 px-4 lobby-unlock-btn">🔑 Entra con la password</button>
        </div>
      </div>`;
    }
    const rec = recognizedRole(entry);
    let pill = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">✨ Prima volta</span>';
    let primary = '✨ Scegli Ruolo / Crea PG →';
    if (rec?.role === 'DM') {
      pill = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--brass-soft)] border border-[var(--brass)] text-[var(--ink)]">👑 Sei il Master</span>';
      primary = '👑 Entra come Master →';
    } else if (rec?.role === 'PLAYER') {
      pill = `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--surface)] border border-[var(--felt)] text-[var(--felt)]">⚔️ Il tuo PG: ${escapeHtml(rec.pc.name)}</span>`;
      primary = `⚔️ Entra con ${escapeHtml(rec.pc.name)} →`;
    }
    const source = entry.source === 'local'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--brass)] text-[var(--brass)]">📱 Solo su questo dispositivo</span>'
      : entry.source === 'cache' ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border border-[var(--line)] text-[var(--muted)]">☁️ copia offline</span>' : '';
    const current = entry.id === App.activeId ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--felt)] text-[var(--felt-ink)]">Aperta ora</span>' : '';
    return `
      <div class="card-surface2 p-4 flex flex-col justify-between gap-3 border-2 ${entry.id === App.activeId ? 'border-[var(--brass)]' : 'border-[var(--line)]'} hover:border-[var(--brass)] transition-all" data-camp-id="${escapeHtml(entry.id)}">
        <div class="flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-serif-title font-bold text-xl leading-tight">${escapeHtml(entry.meta.title)}</h3>
            <span class="text-[11px] text-[var(--muted)]">👥 ${entry.pcs.length} PG${entry.pcs.length ? `: ${escapeHtml(entry.pcs.map(p => p.name).join(', '))}` : ''} • ${entry.meta.hasPassword ? '🔒 Master protetto' : '🔓 Master libero'}${entry.meta.locked ? ' • 🔑 Con password dei giocatori' : ''}</span>
          </div>
          ${lobbyCardTools(entry, rec)}
          </div>
          <div class="flex flex-wrap items-center gap-1.5">${pill}${source}${current}</div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
          <button type="button" class="btn text-xs py-1.5 px-2.5 lobby-change-role-btn">⚙️ Cambia Ruolo</button>
          <button type="button" class="btn btn-felt text-xs font-bold py-2 px-4 lobby-enter-btn">${primary}</button>
        </div>
      </div>`;
  }).join('');
}

function openLobbyHome() {
  showEl('homeLobbyScreen', true);
  closeTokenPopover();
  renderLobby();
  refreshLobby();
  clearInterval(lobbyPollTimer);
  lobbyPollTimer = setInterval(() => { if (Sync.isCloud()) refreshLobby(); }, 15000);
}

function closeLobbyHome() {
  showEl('homeLobbyScreen', false);
  clearInterval(lobbyPollTimer);
  lobbyPollTimer = null;
}

async function joinGroupFromLobby() {
  const code = $('inputGroupCode').value.trim();
  const err = $('groupCodeError');
  if (!code) return;
  $('btnJoinGroup').disabled = true;
  const res = await Sync.joinGroup(code);
  $('btnJoinGroup').disabled = false;
  if (!res.ok) {
    err.textContent = {
      wrong_code: '❌ Codice sbagliato: controlla di averlo scritto giusto (maiuscole e minuscole non contano).',
      anon_disabled: '⚠️ Su Supabase vanno attivati gli accessi anonimi (Authentication → Sign In / Providers → Allow anonymous sign-ins).',
      offline: '📴 Non riesco a raggiungere il cloud: controlla la connessione e riprova.'
    }[res.reason] || '⚠️ Non sono riuscito a entrare, riprova tra poco.';
    showEl(err, true, '');
    return;
  }
  showEl(err, false);
  $('inputGroupCode').value = '';
  showToast('🔓 Benvenuto al tavolo!');
  if (App.activeId && Sync.isCloud()) await Sync.openCampaign(App.activeId);
  await refreshLobby();
  scheduleRender();
  const invited = App.pendingInvite;
  App.pendingInvite = null;
  if (invited && App.lobby.some(c => c.id === invited)) handleSelectAdventureFromLobby(invited, false);
}

// ---------------------------------------------------------------------------
// Gestione dalla Home (solo per il Master): personaggi ed eliminazione
// ---------------------------------------------------------------------------

function openLobbyManage(campId) {
  const entry = App.lobby.find(c => c.id === campId);
  if (!entry) return;
  App.manageCampId = campId;
  setText('lobbyManageTitle', `🛠️ ${entry.meta.title}`);
  const remembered = Prefs.get(`iltavolo_dmpwd_${campId}`);
  showEl('lobbyManagePwdRow', entry.meta.hasPassword && !remembered, 'flex');
  $('inputLobbyManagePwd').value = '';
  setText('lobbyManageError', '');
  renderLobbyManageChars();
  showEl('modalLobbyManage', true);
}

function renderLobbyManageChars() {
  const entry = App.lobby.find(c => c.id === App.manageCampId);
  const box = $('lobbyManageChars');
  if (!entry) { box.innerHTML = ''; return; }
  box.innerHTML = entry.pcs.length ? entry.pcs.map(pc => `
    <div class="flex items-center justify-between gap-2 card-surface2 px-2 py-1" data-char-id="${escapeHtml(pc.id)}">
      <span class="truncate font-bold">${escapeHtml(pc.name)}</span>
      <button type="button" class="btn text-[11px] py-0 px-1.5 text-[var(--danger)] lobby-char-delete-btn">🗑️ Togli</button>
    </div>`).join('') : '<div class="italic text-[var(--muted)]">Nessun personaggio.</div>';
}

async function verifyLobbyDmPassword(campId) {
  const entry = App.lobby.find(c => c.id === campId);
  const pwd = $('inputLobbyManagePwd').value || Prefs.get(`iltavolo_dmpwd_${campId}`) || '';
  if (!entry?.meta.hasPassword) return { ok: true, pwd: pwd || '' };
  const res = await Sync.openVault(campId, pwd || '');
  if (!res.ok) {
    setText('lobbyManageError', vaultReasonMessage(res.reason));
    showEl('lobbyManagePwdRow', true, 'flex');
    return { ok: false };
  }
  return { ok: true, pwd };
}

async function deleteCharacterFromLobby(charId) {
  const campId = App.manageCampId;
  const entry = App.lobby.find(c => c.id === campId);
  const pc = entry?.pcs.find(p => p.id === charId);
  if (!pc || !window.confirm(`Togliere ${pc.name} dall'avventura? Spariscono anche la sua pedina e i suoi messaggi.`)) return;
  const auth = await verifyLobbyDmPassword(campId);
  if (!auth.ok) return;
  let res;
  if (campId === App.activeId && getChar(charId)) {
    deleteCharacter(getChar(charId));
    res = { ok: true };
  } else {
    res = await Sync.deleteCharacterEverywhere(campId, charId);
  }
  if (!res.ok) { setText('lobbyManageError', vaultReasonMessage(res.reason)); return; }
  entry.pcs = entry.pcs.filter(p => p.id !== charId);
  renderLobbyManageChars();
  renderLobby();
  showToast(`🗑️ ${pc.name} tolto dall'avventura`);
}

async function deleteCampaignFromLobby() {
  const campId = App.manageCampId;
  const entry = App.lobby.find(c => c.id === campId);
  if (!entry || !window.confirm(`Eliminare per sempre “${entry.meta.title}” per tutti i giocatori? Non si può annullare.`)) return;
  const auth = await verifyLobbyDmPassword(campId);
  if (!auth.ok) return;
  if (campId === App.activeId) {
    if (App.dmUnlocked) lockDm();
    resetCampaignState();
    App.activeId = null;
  }
  const res = await Sync.deleteCampaign(campId, auth.pwd);
  if (!res.ok) { setText('lobbyManageError', vaultReasonMessage(res.reason)); return; }
  ['role', 'mychar', 'dmpwd'].forEach(k => Prefs.del(`iltavolo_${k}_${campId}`));
  if (Prefs.get('iltavolo_activeCampaignId') === campId) Prefs.del('iltavolo_activeCampaignId');
  showEl('modalLobbyManage', false);
  App.manageCampId = null;
  showToast('🗑️ Avventura eliminata');
  await refreshLobby();
}

function campaignPwdMessage(reason) {
  return {
    wrong_password: '❌ Password sbagliata.',
    anon_disabled: '⚠️ Su Supabase vanno attivati gli accessi anonimi (Authentication → Sign In / Providers → Allow anonymous sign-ins).',
    not_signed_in: '⚠️ Su Supabase vanno attivati gli accessi anonimi (Authentication → Sign In / Providers → Allow anonymous sign-ins).',
    offline: '📴 Cloud non raggiungibile: riprova tra poco.',
    not_member: '🔐 Prima serve il codice del gruppo.',
    old_db: '⚠️ Per le password delle avventure va rieseguito supabase/setup.sql su Supabase.',
    local: '📱 Questa avventura è salvata solo su questo dispositivo: caricala nel cloud per proteggerla.',
    no_vault: '⚠️ Apri prima la Vista DM di questa avventura.'
  }[reason] || '⚠️ Non è andata, riprova tra poco.';
}

function openCampaignPasswordPrompt(campId) {
  const entry = App.lobby.find(c => c.id === campId);
  App.pwdCampId = campId;
  setText('campaignPasswordTitle', `🔒 ${entry?.meta.title || 'Avventura protetta'}`);
  $('inputCampaignPassword').value = '';
  setText('campaignPasswordError', '');
  showEl('modalCampaignPassword', true);
  focusSoon('inputCampaignPassword');
}

async function submitCampaignPassword() {
  const campId = App.pwdCampId;
  if (!campId) return;
  const btn = $('btnConfirmCampaignPassword');
  btn.disabled = true;
  const res = await Sync.joinCampaign(campId, $('inputCampaignPassword').value);
  btn.disabled = false;
  if (!res.ok) { setText('campaignPasswordError', campaignPwdMessage(res.reason)); return; }
  showEl('modalCampaignPassword', false);
  App.pwdCampId = null;
  showToast('🔓 Benvenuto nell\'avventura!');
  await refreshLobby();
  if (App.lobby.some(c => c.id === campId && c.source !== 'locked')) handleSelectAdventureFromLobby(campId, false);
}

async function handleSelectAdventureFromLobby(campId, forceWizard) {
  const entry = App.lobby.find(c => c.id === campId);
  if (!entry) return;
  if (entry.source === 'locked') { openCampaignPasswordPrompt(campId); return; }
  if (!forceWizard) {
    const rec = recognizedRole(entry);
    if (rec?.role === 'DM') {
      const pwd = Prefs.get(`iltavolo_dmpwd_${campId}`);
      if (pwd !== null || !entry.meta.hasPassword) {
        if (await enterAsMaster(campId, pwd || '', { silentError: true })) return;
      }
    } else if (rec?.role === 'PLAYER') {
      if (await enterAsPlayer(campId, rec.pc.id)) return;
    }
  }
  openOnboardingModal(campId);
}

// ---------------------------------------------------------------------------
// Ingresso in una campagna
// ---------------------------------------------------------------------------

function resetCampaignState() {
  App.dmUnlocked = false;
  App.dmPassword = '';
  App.vault = null;
  App.viewMode = 'PLAYER';
  App.role = null;
  App.myCharId = null;
  App.sheetCharId = null;
  App.selectedTokenId = null;
  App.fogEdit = false;
  App.extracted = [];
  App.secretRolls = [];
  App.lastActiveInitId = null;
  App.lastShownRollId = null;
  App.dmSceneId = null;
  App.rollsPrimed = false;
  App.seenRollIds = new Set();
  App.zoomUserSet = false;
  App.joinedAt = Date.now();
  stopInboxPolling();
  clearMessageCaches();
  clearPrivateCaches();
  closeTokenPopover();
}

async function ensureCampaignLoaded(campId) {
  if (App.activeId === campId && camp()) return true;
  resetCampaignState();
  Sync.lastLocked = null;
  const c = await Sync.openCampaign(campId);
  if (!c) {
    App.activeId = null;
    if (Sync.lastLocked === campId) {
      await refreshLobby();
      openCampaignPasswordPrompt(campId);
      return false;
    }
    showToast('⚠️ Avventura non trovata: forse è stata eliminata');
    refreshLobby();
    return false;
  }
  App.activeId = campId;
  Prefs.set('iltavolo_activeCampaignId', campId);
  App.role = Prefs.get(`iltavolo_role_${campId}`);
  const saved = Prefs.get(`iltavolo_mychar_${campId}`);
  const mine = getChar(saved) || getPCs().find(ch => ch.ownerId === DEVICE_ID);
  App.myCharId = mine?.id || null;
  App.lastActiveInitId = getInitMeta().activeId;
  return true;
}

function finishEnter(message) {
  showEl('modalFirstTimeOnboarding', false);
  closeLobbyHome();
  refreshLobby();
  needsFit = true;
  if (App.tab !== 'tavolo') switchTab('tavolo');
  scheduleRender();
  requestAnimationFrame(() => { App.zoomUserSet = false; fitZoom(); });
  if (message) showToast(message);
}

async function enterCampaign(campId) {
  if (!(await ensureCampaignLoaded(campId))) return false;
  if (App.role === 'DM') {
    const res = await unlockDm(campId, Prefs.get(`iltavolo_dmpwd_${campId}`) || '');
    if (!res.ok) App.role = null;
  }
  finishEnter();
  return true;
}

async function enterAsMaster(campId, password, { silentError = false } = {}) {
  if (!(await ensureCampaignLoaded(campId))) return false;
  const res = await unlockDm(campId, password);
  if (!res.ok) {
    if (!silentError) {
      $('onboardingMasterPwdError').textContent = vaultReasonMessage(res.reason);
      showEl('onboardingMasterPwdError', true, '');
    }
    return false;
  }
  finishEnter('👑 Bentornato, Master!');
  return true;
}

async function enterAsPlayer(campId, charId) {
  if (!(await ensureCampaignLoaded(campId))) return false;
  const ch = getChar(charId);
  if (!ch) return false;
  if (App.dmUnlocked) lockDm();
  ch.ownerId = DEVICE_ID;
  touchEnt(`char:${ch.id}`);
  if (!tokenForChar(ch.id)) createTokenForChar(ch);
  App.myCharId = ch.id;
  App.sheetCharId = ch.id;
  App.role = 'PLAYER';
  Prefs.set(`iltavolo_role_${campId}`, 'PLAYER');
  Prefs.set(`iltavolo_mychar_${campId}`, ch.id);
  Prefs.del(`iltavolo_dmpwd_${campId}`);
  finishEnter(`⚔️ Entrato come ${ch.name}!`);
  return true;
}

function openOnboardingModal(campId) {
  const entry = App.lobby.find(c => c.id === campId) || (Campaigns[campId] && { id: campId, meta: normalizeMeta(Campaigns[campId].ents.meta), pcs: [] });
  if (!entry) return;
  App.onboardingCampId = campId;
  setText('onboardingCampaignSubtitle', `Avventura: ${entry.meta.title}`);
  setText('onboardingMasterDesc', entry.meta.hasPassword
    ? 'Gestisci mappa, nebbia e mostri. Serve la password del Master.'
    : 'Gestisci mappa, nebbia e mostri. Questa avventura non ha password.');
  showEl('onboardingMasterPwdWrap', entry.meta.hasPassword);
  showEl('onboardingMasterPwdError', false, '');
  $('inputOnboardingMasterPwd').value = '';
  showEl('onboardingStepRole', true, 'grid');
  showEl('onboardingStepCharacter', false);
  showEl('modalFirstTimeOnboarding', true);
}

function openOnboardingCharacterStep() {
  const entry = App.lobby.find(c => c.id === App.onboardingCampId);
  showEl('onboardingStepRole', false);
  showEl('onboardingStepCharacter', true);
  loadOnboardingSheetTypes(App.onboardingCampId);
  const pcs = entry?.pcs || [];
  showEl('onboardingExistingCharsSection', pcs.length > 0);
  $('onboardingExistingCharsList').innerHTML = pcs.map(pc => {
    const taken = pc.ownerId && pc.ownerId !== DEVICE_ID;
    return `
      <div class="card-surface p-2.5 flex items-center justify-between gap-2 text-xs" data-pc-id="${escapeHtml(pc.id)}">
        <div class="truncate">
          <strong class="font-serif-title text-base block truncate">${escapeHtml(pc.name)}</strong>
          <span class="text-[11px] text-[var(--muted)]">${taken ? 'Usato da un altro dispositivo' : pc.ownerId === DEVICE_ID ? 'Il tuo personaggio' : 'Libero'}</span>
        </div>
        <button type="button" class="btn btn-felt text-xs py-1 px-2.5 onb-play-btn">Gioca</button>
      </div>`;
  }).join('');
  focusSoon('onbCharName');
}

async function createCharFromOnboarding() {
  const name = $('onbCharName').value.trim();
  if (!name) { showToast('Dai un nome al tuo eroe'); $('onbCharName').focus(); return; }
  const campId = App.onboardingCampId;
  const sheetType = $('onbSheetType').value;
  if (!(await ensureCampaignLoaded(campId))) return;
  if (App.dmUnlocked) lockDm();
  if (sheetType && sheetType !== '5e' && ent(`sheettpl:${sheetType}`)) {
    const custom = createCustomCharacter(name, sheetType);
    $('onbCharName').value = '';
    await enterAsPlayer(campId, custom.id);
    return;
  }
  const abilities = {};
  ABILITY_KEYS.forEach(k => { abilities[k] = clampInt($(`onbStat${k}`).value, 1, 30, 10); });
  const maxHp = clampInt($('onbCharHp').value, 1, 999, 10);
  const ch = createCharacter({
    name, race: $('onbCharRace').value.trim(), className: $('onbCharClass').value.trim(),
    level: clampInt($('onbCharLevel').value, 1, 20, 1), maxHp, hp: maxHp, ac: clampInt($('onbCharAc').value, 1, 40, 10),
    bonusAction: $('onbCharBonus').value.trim(), abilities, attacksText: $('onbCharAttack').value.trim()
  });
  $('onbCharName').value = '';
  await enterAsPlayer(campId, ch.id);
}

async function createAdventureFromLobby(sample = false) {
  const title = sample ? 'Le Cripte di Smeraldo' : $('inputLobbyNewAdvTitle').value.trim();
  const pwd = sample ? '' : $('inputLobbyNewAdvPassword').value;
  if (!title) {
    setText('lobbyCreateError', 'Dai un nome all\'avventura');
    showEl('lobbyCreateError', true, '');
    return;
  }
  showEl('lobbyCreateError', false, '');
  const ents = buildNewCampaignEntities(title, { sample, hasPassword: Boolean(pwd) });
  const id = await Sync.createCampaign(ents, pwd, sample ? buildSampleVault() : normalizeVault({}));
  Prefs.set(`iltavolo_role_${id}`, 'DM');
  Prefs.set(`iltavolo_dmpwd_${id}`, pwd);
  $('inputLobbyNewAdvTitle').value = '';
  $('inputLobbyNewAdvPassword').value = '';
  showEl('lobbyCreateAdventureBox', false);
  await refreshLobby();
  const playerPwd = sample ? '' : $('inputLobbyNewAdvPlayerPwd').value.trim();
  $('inputLobbyNewAdvPlayerPwd').value = '';
  const ok = await enterAsMaster(id, pwd, { silentError: true });
  if (!ok) showToast('⚠️ Avventura creata, ma non riesco ad aprirla: riprova dalla lobby');
  if (ok && playerPwd) {
    const res = await Sync.setCampaignPassword(id, pwd, playerPwd);
    // Lo segniamo anche qui: una nostra modifica alle informazioni dell'avventura non deve cancellarlo
    if (res.ok && App.activeId === id) { getMeta().locked = true; touchEnt('meta'); }
    showToast(res.ok ? '🔒 Password dei giocatori impostata: dalla al tuo gruppo insieme al link' : campaignPwdMessage(res.reason), 5000);
  }
  if (ok && !Campaigns[id]?.synced && Sync.mode !== 'local') showToast('📱 Avventura salvata su questo dispositivo: la caricherai nel cloud quando sarà disponibile', 4500);
}

async function copyInviteLink() {
  const base = `${location.origin}${location.pathname}`;
  const url = App.activeId ? `${base}?camp=${encodeURIComponent(App.activeId)}` : base;
  try {
    await navigator.clipboard.writeText(url);
    showToast(App.activeId ? '🔗 Link d\'invito copiato: mandalo ai giocatori' : '🔗 Link del Tavolo copiato');
  } catch (e) {
    window.prompt('Copia questo link e mandalo ai giocatori:', url);
  }
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initAppEvents() {
  initDockEvents();
  initAutoSizeEvents();
  $('btnOpenLobbyHome').addEventListener('click', openLobbyHome);
  $('btnCloseLobbyToTable').addEventListener('click', closeLobbyHome);
  document.querySelectorAll('.nav-tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.querySelectorAll('[data-goto-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.gotoTab)));
  $('btnToggleTheme').addEventListener('click', toggleTheme);
  $('btnOpenSupabaseModal').addEventListener('click', openCloudModal);
  $('btnLobbyOpenCloud').addEventListener('click', openCloudModal);
  $('btnCloseCloudModal').addEventListener('click', () => showEl('modalCloudStatus', false));
  $('modalCloudStatus').addEventListener('click', (e) => { if (e.target.id === 'modalCloudStatus') showEl('modalCloudStatus', false); });
  $('groupCodeForm').addEventListener('submit', (e) => { e.preventDefault(); joinGroupFromLobby(); });
  $('btnCloudRetry').addEventListener('click', async () => {
    await Sync.connect();
    if (App.activeId && Sync.isCloud()) await Sync.openCampaign(App.activeId);
    await refreshLobby();
    scheduleRender();
  });

  $('btnToggleViewMode').addEventListener('click', async () => {
    if (!App.activeId) return;
    if (App.dmUnlocked) {
      App.viewMode = App.viewMode === 'DM' ? 'PLAYER' : 'DM';
      App.fogEdit = false;
      closeTokenPopover();
      showToast(App.viewMode === 'DM' ? '🐉 Vista del Master' : '👁️ Anteprima: ora vedi la mappa come i giocatori');
      scheduleRender();
      return;
    }
    if (!getMeta().hasPassword) {
      const res = await unlockDm(App.activeId, '');
      if (res.ok) { showToast('👑 Ora sei il Master'); scheduleRender(); return; }
    }
    $('inputModalVerifyDmPwd').value = '';
    showEl('modalVerifyDmError', false, '');
    showEl('modalVerifyDmPassword', true);
    focusSoon('inputModalVerifyDmPwd');
  });
  const closeVerify = () => showEl('modalVerifyDmPassword', false);
  $('btnCloseVerifyDmModal').addEventListener('click', closeVerify);
  $('btnCancelVerifyDmModal').addEventListener('click', closeVerify);
  const confirmVerify = async () => {
    const res = await unlockDm(App.activeId, $('inputModalVerifyDmPwd').value);
    if (!res.ok) {
      setText('modalVerifyDmError', vaultReasonMessage(res.reason));
      showEl('modalVerifyDmError', true, '');
      return;
    }
    closeVerify();
    showToast('👑 Vista del Master sbloccata');
    scheduleRender();
  };
  $('btnConfirmVerifyDmModal').addEventListener('click', confirmVerify);
  $('inputModalVerifyDmPwd').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmVerify(); });

  $('btnSwitchRoleOrChar').addEventListener('click', async () => {
    if (!App.activeId) { openLobbyHome(); return; }
    if (!App.lobbyLoaded) await refreshLobby();
    openOnboardingModal(App.activeId);
  });
  $('btnNewCampaign').addEventListener('click', () => {
    openLobbyHome();
    showEl('lobbyCreateAdventureBox', true);
    focusSoon('inputLobbyNewAdvTitle');
  });
  $('campaignSelect').addEventListener('change', (e) => {
    const id = e.target.value;
    e.target.blur();
    if (id && id !== App.activeId) handleSelectAdventureFromLobby(id, false);
  });

  // Lobby
  $('campaignPasswordForm').addEventListener('submit', (e) => { e.preventDefault(); submitCampaignPassword(); });
  $('btnCancelCampaignPassword').addEventListener('click', () => { showEl('modalCampaignPassword', false); App.pwdCampId = null; });
  $('lobbyCampaignsGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-camp-id]');
    if (!card) return;
    if (e.target.closest('.lobby-unlock-btn')) openCampaignPasswordPrompt(card.dataset.campId);
    if (e.target.closest('.lobby-hide-btn')) { setCampaignHidden(card.dataset.campId, !hiddenCampaigns().has(card.dataset.campId)); return; }
    if (e.target.closest('.lobby-manage-btn')) { openLobbyManage(card.dataset.campId); return; }
    if (e.target.closest('.lobby-enter-btn')) handleSelectAdventureFromLobby(card.dataset.campId, false);
    if (e.target.closest('.lobby-change-role-btn')) handleSelectAdventureFromLobby(card.dataset.campId, true);
  });
  $('btnLobbyShowHidden').addEventListener('click', () => { App.showHiddenCamps = !App.showHiddenCamps; renderLobby(); });
  $('btnCloseLobbyManage').addEventListener('click', () => showEl('modalLobbyManage', false));
  $('lobbyManageChars').addEventListener('click', (e) => {
    const row = e.target.closest('[data-char-id]');
    if (row && e.target.closest('.lobby-char-delete-btn')) deleteCharacterFromLobby(row.dataset.charId);
  });
  $('btnLobbyDeleteCampaign').addEventListener('click', deleteCampaignFromLobby);
  $('btnLobbyNewAdventure').addEventListener('click', () => {
    showEl('lobbyCreateAdventureBox', true);
    focusSoon('inputLobbyNewAdvTitle');
  });
  $('btnCancelLobbyCreateAdventure').addEventListener('click', () => showEl('lobbyCreateAdventureBox', false));
  $('btnConfirmLobbyCreateAdventure').addEventListener('click', () => createAdventureFromLobby(false));
  $('inputLobbyNewAdvPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') createAdventureFromLobby(false); });
  $('btnLobbyCreateSample').addEventListener('click', () => createAdventureFromLobby(true));
  $('btnLobbyCopyInviteLink').addEventListener('click', copyInviteLink);

  // Primo ingresso
  $('btnCloseOnboardingModal').addEventListener('click', () => showEl('modalFirstTimeOnboarding', false));
  $('btnChooseRolePlayer').addEventListener('click', openOnboardingCharacterStep);
  $('btnBackToRoleStep').addEventListener('click', () => { showEl('onboardingStepCharacter', false); showEl('onboardingStepRole', true, 'grid'); });
  const chooseMaster = () => enterAsMaster(App.onboardingCampId, $('inputOnboardingMasterPwd').value);
  $('btnChooseRoleMaster').addEventListener('click', chooseMaster);
  $('inputOnboardingMasterPwd').addEventListener('keydown', (e) => { if (e.key === 'Enter') chooseMaster(); });
  $('onboardingExistingCharsList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-pc-id]');
    if (row && e.target.closest('.onb-play-btn')) enterAsPlayer(App.onboardingCampId, row.dataset.pcId);
  });
  $('btnConfirmCreateOnbChar').addEventListener('click', createCharFromOnboarding);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeTokenPopover();
    ['modalAddToken', 'modalVerifyDmPassword', 'modalCloudStatus', 'modalSpellPicker', 'modalLevelUp', 'modalMessages', 'modalHandout', 'modalImageCrop', 'modalCampaignPassword', 'modalLobbyManage', 'modalTemplateEditor'].forEach(id => showEl(id, false));
    if (!$('modalPin').classList.contains('hidden')) finishPinRequest(null);
  });
  window.addEventListener('pagehide', () => { if (App.activeId) Sync.saveLocalNow(App.activeId); });
}

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

function readInviteParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('camp');
    if (id) window.history.replaceState({}, document.title, window.location.pathname);
    return id;
  } catch (e) {
    return null;
  }
}

async function startApp() {
  const invited = readInviteParam();
  initAppEvents();
  initMapEvents();
  initTableEvents();
  initSheetEvents();
  initSpellEvents();
  initWizardEvents();
  initLevelUpEvents();
  initJournalEvents();
  initBooksEvents();
  initDmEvents();
  initMessageEvents();
  initImageEvents();
  initPrivateEvents();
  initLinkEvents();
  initCustomSheetEvents();
  setAdvMode('normal');
  renderGlossary();
  renderChat();
  renderLobby();

  Sync.onStatusChange = debounce(renderSyncBadges, 100);
  Sync.onRemoteChange = (campId, keys) => {
    if (campId !== App.activeId) return;
    if (keys.includes('initmeta')) {
      const meta = getInitMeta();
      if (meta.activeId && meta.activeId !== App.lastActiveInitId) {
        const entry = ent(`init:${meta.activeId}`);
        if (entry?.charId && entry.charId === App.myCharId && !isDM()) showToast('⚔️ Tocca a te!', 4000);
      }
      App.lastActiveInitId = meta.activeId;
    }
    const current = currentSceneId();
    if (keys.includes(sceneKey(current)) || keys.includes(mapKey(current))) needsFit = true;
    if (keys.includes('stage')) {
      needsFit = true;
      if (!isDM()) {
        App.zoomUserSet = false;
        closeTokenPopover();
        showToast(`🗺️ Il Master vi porta in: ${sceneName(getStage().activeSceneId)}`, 3500);
      }
    }
    if (keys.includes('meta') && !$('homeLobbyScreen').classList.contains('hidden')) refreshLobby();
    announceNewHandouts(keys);
    if (keys.some(k => k.startsWith('msg:')) && !$('modalMessages').classList.contains('hidden')) renderMessagesPanel();
    scheduleRender();
  };
  Sync.onCampaignLocked = async (campId) => {
    if (campId !== App.activeId) return;
    await Sync.closeCampaign();
    resetCampaignState();
    App.activeId = null;
    showToast('🔒 La password di questa avventura è cambiata: chiedila al Master', 5000);
    openLobbyHome();
    await refreshLobby();
    openCampaignPasswordPrompt(campId);
  };
  Sync.onCampaignGone = async (campId) => {
    if (campId !== App.activeId) return;
    await Sync.forgetCampaign(campId);
    resetCampaignState();
    App.activeId = null;
    showToast('🗑️ Il Master ha eliminato questa avventura', 4000);
    openLobbyHome();
  };

  loadBooks().then(renderBooks);
  await Sync.init();
  await refreshLobby();
  checkAiAvailability().then(() => { renderChat(); if (App.activeId) renderDmView(); });

  if (invited) {
    if (App.lobby.some(c => c.id === invited)) handleSelectAdventureFromLobby(invited, false);
    else if (Sync.mode === 'locked') { App.pendingInvite = invited; showToast('🔐 Inserisci il codice del gruppo per entrare nell\'avventura', 5000); }
    else showToast('⚠️ Non trovo l\'avventura del link d\'invito', 4000);
  }
}

document.addEventListener('DOMContentLoaded', startApp);
