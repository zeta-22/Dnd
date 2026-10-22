// Schermo del Master: cassaforte dei segreti, password, appunti di sessione, bilanciamento degli scontri,
// e gestione della campagna (esporta, importa, duplica, elimina, carica nel cloud).

let vaultSaveTimer = null;

// ---------------------------------------------------------------------------
// Sblocco e cassaforte
// ---------------------------------------------------------------------------

async function unlockDm(campId, password) {
  let res = await Sync.openVault(campId, password);
  if (!res.ok && res.reason === 'no_vault') {
    // Avventura senza cassaforte (per esempio creata quando il cloud non c'era): la crea il primo Master
    const created = await Sync.ensureVault(campId, password, {});
    if (created.ok) res = await Sync.openVault(campId, password);
  }
  if (!res.ok) return res;
  App.dmUnlocked = true;
  App.dmPassword = password || '';
  App.vault = normalizeVault(res.data);
  App.role = 'DM';
  App.viewMode = 'DM';
  Prefs.set(`iltavolo_role_${campId}`, 'DM');
  Prefs.set(`iltavolo_dmpwd_${campId}`, App.dmPassword);
  startInboxPolling();
  ensureDmKeys();
  return res;
}

function lockDm() {
  if (vaultSaveTimer) { clearTimeout(vaultSaveTimer); saveVaultNow(); }
  App.dmUnlocked = false;
  App.dmPassword = '';
  App.vault = null;
  App.viewMode = 'PLAYER';
  App.fogEdit = false;
  if (App.activeId) Prefs.del(`iltavolo_dmpwd_${App.activeId}`);
  App.secretRolls = [];
  stopInboxPolling();
}

function scheduleVaultSave() {
  setText('dmVaultSaveStatus', '⏳ salvataggio…');
  clearTimeout(vaultSaveTimer);
  vaultSaveTimer = setTimeout(saveVaultNow, 700);
}

async function saveVaultNow() {
  vaultSaveTimer = null;
  if (!App.dmUnlocked || !App.vault || !App.activeId) return;
  const res = await Sync.saveVault(App.activeId, App.dmPassword, App.vault);
  setText('dmVaultSaveStatus', res.ok ? '🔒 salvato' : res.reason === 'wrong_password' ? '⚠️ password cambiata altrove' : '⚠️ non salvato, riprovo…');
  if (!res.ok && res.reason === 'offline') scheduleVaultSave();
}

function renderCampaignPwdCard() {
  const c = camp();
  const synced = Boolean(c?.synced) && Sync.isCloud();
  const locked = Boolean(getMeta().locked);
  setText('campaignPwdStatus', !c?.synced
    ? '📱 Si può impostare quando l\'avventura è nel cloud.'
    : locked ? '🔒 Attiva: chi non la conosce vede solo il titolo con il lucchetto.' : '🔓 Nessuna: chiunque usi il sito può entrare in questa avventura.');
  $('inputCampaignPwd').disabled = !synced;
  $('btnSetCampaignPwd').disabled = !synced;
  setText('btnSetCampaignPwd', locked ? 'Cambia' : 'Imposta');
  showEl('btnRemoveCampaignPwd', locked && synced, '');
}

async function changeCampaignPassword(remove) {
  if (!App.dmUnlocked || !App.activeId) return;
  const value = remove ? '' : $('inputCampaignPwd').value.trim();
  if (!remove && !value) { showToast('Scrivi la nuova password dei giocatori'); return; }
  const locked = Boolean(getMeta().locked);
  const question = remove
    ? 'Togliere la password? Chiunque usi il sito potrà entrare in questa avventura.'
    : locked ? 'Cambiare la password? Chi era già entrato dovrà inserire quella nuova.' : null;
  if (question && !window.confirm(question)) return;
  const res = await Sync.setCampaignPassword(App.activeId, App.dmPassword, value);
  if (!res.ok) { showToast(campaignPwdMessage(res.reason), 6000); return; }
  // Lo segniamo anche qui: una nostra modifica alle informazioni dell'avventura non deve cancellarlo
  getMeta().locked = Boolean(value);
  touchEnt('meta');
  $('inputCampaignPwd').value = '';
  showToast(remove ? '🔓 Password dei giocatori tolta' : '🔒 Password dei giocatori impostata: dalla al tuo gruppo', 4000);
  scheduleRender();
}

function vaultReasonMessage(reason) {
  if (reason === 'wrong_password') return 'Password errata.';
  if (reason === 'offline') return 'Cloud non raggiungibile: riprova tra poco.';
  if (reason === 'not_member') return 'Serve il codice del gruppo: inseriscilo nella schermata Home.';
  return 'Non è stato possibile aprire lo schermo del Master.';
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function renderDmView() {
  const meta = getMeta();
  const unlocked = App.dmUnlocked;
  showEl('dmPasswordLockScreen', !unlocked);
  showEl('dmUnlockedContent', unlocked);
  if (!unlocked) {
    const open = !meta.hasPassword;
    setText('dmLockScreenDesc', open
      ? 'Questa avventura non ha una password: chiunque può entrare come Master.'
      : 'Questa sezione è protetta da password per evitare spoiler.');
    $('inputUnlockDmPassword').classList.toggle('hidden', open);
    setText('btnUnlockDmView', open ? '👑 Entra come Master' : '🔓 Sblocca');
    return;
  }
  if (document.activeElement !== $('dmHandoutTo')) populateHandoutTargets();
  renderCampaignPwdCard();
  setText('dmPasswordStatusBadge', meta.hasPassword ? '🔒 Protetta da password' : '🔓 Nessuna password: chiunque può fare il Master');
  setText('btnSaveDmPassword', meta.hasPassword ? '🔑 Cambia password' : '🔑 Imposta password');
  $('btnLockDmNow').classList.toggle('hidden', !meta.hasPassword);
  $('btnRemoveDmPassword').classList.toggle('hidden', !meta.hasPassword);
  setText('dmAiStatusText', !App.ai.checked ? 'Controllo in corso…' : App.ai.available
    ? '✨ Attivo: risponde alle domande e prepara le voci del diario. La chiave è al sicuro sul server Vercel.'
    : `🔎 Non configurato: funzionano la ricerca e la preparazione semplice delle voci. ${App.ai.reason || ''}`);
  showEl('dmLocalOnlyCard', !camp()?.synced && Sync.isCloud());

  setVal($('dmInputCampaignName'), meta.title);
  setVal($('dmTextareaSecretNotes'), App.vault.secretNotes);
  setVal($('dmTextareaSessionNotes'), App.vault.sessionNotes);
  renderExtractedEntries();
  renderEncounter();
}

function populateCrSelect() {
  const sel = $('dmNewEnemyCr');
  if (sel.options.length) return;
  sel.innerHTML = DMG_CR_TABLE.map(r => `<option value="${r.cr}" ${r.cr === '1/4' ? 'selected' : ''}>${r.cr} (${r.xp.toLocaleString('it-IT')} PE)</option>`).join('');
}

function partyDefaults() {
  const pcs = getPCs();
  const count = pcs.length || 4;
  const level = pcs.length ? Math.round(pcs.reduce((s, c) => s + c.level, 0) / pcs.length) : 1;
  return { count, level };
}

function renderEncounter() {
  populateCrSelect();
  const v = App.vault;
  const def = partyDefaults();
  const count = v.partyCount || def.count;
  const level = v.partyLevel || def.level;
  setVal($('dmInputPartyCount'), count);
  setVal($('dmInputPartyLevel'), level);
  const [easy, medium, hard, deadly] = getPartyThresholds(count, level);
  setText('dmThresholdEasy', `${easy.toLocaleString('it-IT')} PE`);
  setText('dmThresholdMedium', `${medium.toLocaleString('it-IT')} PE`);
  setText('dmThresholdHard', `${hard.toLocaleString('it-IT')} PE`);
  setText('dmThresholdDeadly', `${deadly.toLocaleString('it-IT')} PE`);

  const list = $('dmPreparedEnemiesList');
  safeRebuild(list, () => {
    list.innerHTML = v.enemies.length ? v.enemies.map(e => `
      <div class="card-surface2 p-2 flex flex-wrap items-center justify-between gap-2 text-xs" data-enemy-id="${escapeHtml(e.id)}">
        <label class="flex items-center gap-2 min-w-0 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 accent-[var(--felt)] enemy-include" ${e.included ? 'checked' : ''} title="Includi nel calcolo" />
          ${e.srd !== undefined && e.srd !== null ? avatarHtml(imgData(srdImageHash(e.srd)) || commonMonsterIcon(e.srd)) : ''}
          <span class="min-w-0">
            <strong class="block truncate">${e.srd !== undefined && e.srd !== null ? '📜 ' : ''}${escapeHtml(e.name)}</strong>
            <span class="text-[10px] text-[var(--muted)]">GS ${escapeHtml(e.cr)} · ${getXpByCr(e.cr).toLocaleString('it-IT')} PE · CA ${e.ac} · PF ${e.hp}</span>
          </span>
        </label>
        <span class="flex items-center gap-1.5">
          <label class="text-[10px] text-[var(--muted)] flex items-center gap-1">×
            <input type="number" min="1" max="50" value="${e.qty}" class="input-field w-12 text-center py-0 px-1 font-bold enemy-qty" aria-label="Quantità" />
          </label>
          <button type="button" class="btn text-[11px] py-0.5 px-2 enemy-to-map" title="Metti sulla mappa">🗺️</button>
          <button type="button" class="btn text-[11px] py-0.5 px-2 text-[var(--danger)] enemy-remove" title="Togli">✕</button>
        </span>
      </div>`).join('') : '<div class="text-xs text-[var(--muted)] italic">Nessun nemico preparato.</div>';
  });

  const included = v.enemies.filter(e => e.included);
  const monsters = included.reduce((s, e) => s + e.qty, 0);
  const raw = included.reduce((s, e) => s + getXpByCr(e.cr) * e.qty, 0);
  const mult = getEncounterMultiplier(monsters, count);
  const adjusted = Math.round(raw * mult);
  let label = 'Nessuno scontro';
  let color = 'var(--muted)';
  if (monsters > 0) {
    if (adjusted >= deadly) { label = 'Mortale'; color = 'var(--danger)'; }
    else if (adjusted >= hard) { label = 'Difficile'; color = 'var(--brass)'; }
    else if (adjusted >= medium) { label = 'Medio'; color = 'var(--felt)'; }
    else if (adjusted >= easy) { label = 'Facile'; color = 'var(--ok)'; }
    else { label = 'Banale'; color = 'var(--muted)'; }
  }
  const badge = $('dmVerdictDifficultyBadge');
  badge.textContent = label;
  badge.style.color = color;
  setText('dmVerdictMultiplierText', `×${String(mult).replace('.', ',')}`);
  setText('dmVerdictXpPerPlayer', `${Math.floor(raw / count).toLocaleString('it-IT')} PE`);
  setText('dmVerdictDetailText', monsters ? `${monsters} ${monsters === 1 ? 'mostro' : 'mostri'} · ${raw.toLocaleString('it-IT')} PE base · ${adjusted.toLocaleString('it-IT')} PE adattati` : 'Aggiungi i nemici e spunta quelli dello scontro.');
  $('btnSendEnemiesToMap').disabled = monsters === 0;
}

function renderExtractedEntries() {
  const container = $('sessionExtractedContainer');
  const list = $('sessionExtractedList');
  showEl(container, App.extracted.length > 0);
  safeRebuild(list, () => {
    list.innerHTML = App.extracted.map(x => `
      <div class="card-surface2 p-2 flex flex-col gap-1 text-xs" data-extract-id="${x.id}">
        <div class="flex items-center gap-2">
          <input type="checkbox" class="w-4 h-4 accent-[var(--felt)] extract-check" ${x.checked ? 'checked' : ''} aria-label="Includi" />
          <select class="input-field text-xs py-0.5 extract-category">${Object.keys(JOURNAL_CATEGORIES).map(c => `<option value="${escapeHtml(c)}" ${c === x.category ? 'selected' : ''}>${JOURNAL_CATEGORIES[c]} ${escapeHtml(c)}</option>`).join('')}</select>
          <input type="text" class="input-field flex-1 text-xs font-bold extract-title" value="${escapeHtml(x.title)}" aria-label="Titolo" />
        </div>
        <p class="text-[11px] text-[var(--muted)] leading-snug">${escapeHtml(x.content)}</p>
      </div>`).join('');
  });
}

// ---------------------------------------------------------------------------
// Appunti di sessione → voci del diario
// ---------------------------------------------------------------------------

function heuristicExtract(notes) {
  let chunks = String(notes).split(/\n+/).map(l => l.replace(/^\s*([-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (chunks.length <= 1) chunks = String(notes).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const rules = [
    ['Domande per il DM', /\?\s*$/],
    ['Bottino', /\b(mo|monet|oro|argent|rame|gemm|oggett|pozion|bottino|tesor|anell|amulet|pergamen|ricompens)/i],
    ['Missioni', /\b(mission|quest|incaric|recuper|trovar|salvar|uccider|scortar|consegnar|obiettiv|compito|indaga)/i],
    ['Personaggi incontrati', /\b(incontr|conosciut|parlat|sindac|mercant|capitan|sacerdot|oste|png|signor|chiamat|di nome|re |regina|principe)/i]
  ];
  return chunks.filter(c => c.length > 3).slice(0, 25).map(c => {
    const category = (rules.find(([, re]) => re.test(c)) || ['Sessioni'])[0];
    const words = c.replace(/[.!?]+$/, '').split(/\s+/);
    const title = words.slice(0, 7).join(' ') + (words.length > 7 ? '…' : '');
    return { category, title, content: c };
  });
}

async function prepareSessionEntries() {
  const notes = (App.vault?.sessionNotes || '').trim();
  if (!notes) { showToast('Scrivi prima gli appunti della serata'); return; }
  const btn = $('btnPrepareSessionEntries');
  btn.disabled = true;
  setText(btn, '⏳ Preparo…');
  let entries = null;
  if (await checkAiAvailability()) {
    try {
      const data = await callAi({ task: 'extract', notes: notes.slice(0, 20000) });
      if (Array.isArray(data.entries) && data.entries.length) entries = data.entries;
    } catch (e) {
      showToast('L\'IA non ha risposto: uso la preparazione semplice');
    }
  }
  if (!entries) entries = heuristicExtract(notes);
  App.extracted = entries.map(e => ({
    id: uid('x'), checked: true,
    category: JOURNAL_CATEGORIES[e.category] ? e.category : 'Sessioni',
    title: String(e.title || '').slice(0, 120) || 'Senza titolo',
    content: String(e.content || '').slice(0, 2000)
  }));
  btn.disabled = false;
  setText(btn, '✨ Prepara le voci');
  renderExtractedEntries();
}

function addExtractedToJournal() {
  const chosen = App.extracted.filter(x => x.checked);
  if (!chosen.length) { showToast('Nessuna voce selezionata'); return; }
  chosen.forEach(x => addJournalEntry({ category: x.category, title: x.title, content: x.content }));
  App.extracted = [];
  renderExtractedEntries();
  scheduleRender();
  showToast(`📥 ${chosen.length} voci aggiunte al diario`);
}

// ---------------------------------------------------------------------------
// Nemici sulla mappa
// ---------------------------------------------------------------------------

function sendEnemyGroupToMap(enemy) {
  const monster = enemy.srd !== undefined && enemy.srd !== null ? srdMonster(enemy.srd) : null;
  return numberedNames(enemy.name, enemy.qty, getTokens().map(t => t.name)).map(name => {
    const cell = findFreeCell(visibleCenterCell(), false);
    const tok = normalizeToken({
      id: uid('tok'), name, type: 'enemy', gridX: cell.x, gridY: cell.y, hp: enemy.hp, maxHp: enemy.hp, ac: enemy.ac,
      sceneId: currentSceneId(), srd: monster ? monster.i : undefined, initMod: monster ? monsterInitMod(monster) : 0
    });
    putEnt(`token:${tok.id}`, tok);
    return tok;
  });
}

function sendEnemiesWhenReady(enemies) {
  // Servono i dati dei mostri per collegare le schede: li carichiamo se non ci sono ancora
  if (enemies.some(e => e.srd !== undefined && e.srd !== null) && !SRD.monsters) {
    loadSrd('monsters').catch(() => {}).finally(() => sendEnemiesToMap(enemies));
  } else {
    sendEnemiesToMap(enemies);
  }
}

function sendEnemiesToMap(enemies) {
  const tokens = enemies.flatMap(sendEnemyGroupToMap);
  if (!tokens.length) return;
  scheduleRender();
  showToast(`🗺️ ${tokens.length} nemici sulla mappa`);
}

// ---------------------------------------------------------------------------
// Gestione della campagna
// ---------------------------------------------------------------------------

function exportCampaign() {
  const c = camp();
  if (!c) return;
  const entities = {};
  Object.keys(c.ents).forEach(k => { if (!k.startsWith('roll:')) entities[k] = c.ents[k]; });
  const dm = isDM() || App.dmUnlocked;
  downloadJson(`${slugify(getMeta().title)}.json`, {
    format: 'il-tavolo', version: 2, exportedAt: new Date().toISOString(), title: getMeta().title,
    entities, vault: dm ? App.vault : null
  });
  showToast(dm ? '💾 Campagna salvata (con i segreti del DM)' : '💾 Campagna salvata (senza i segreti del DM)');
}

async function importCampaignFile(file) {
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await readFileAsText(file));
  } catch (e) {
    showToast('⚠️ Il file non è un JSON valido');
    return;
  }
  const prepared = prepareImportedCampaign(parsed);
  if (!prepared) { showToast('⚠️ Questo file non sembra una campagna del Tavolo'); return; }
  prepared.ents.meta.hasPassword = Boolean(prepared.password);
  const id = await Sync.createCampaign(prepared.ents, prepared.password, prepared.vault);
  Prefs.set(`iltavolo_role_${id}`, 'DM');
  Prefs.set(`iltavolo_dmpwd_${id}`, prepared.password);
  showToast(`📂 “${prepared.ents.meta.title}” importata${prepared.password ? '' : ': imposta una password nella Vista DM'}`, 4000);
  await enterCampaign(id);
}

async function duplicateCampaign() {
  const c = camp();
  if (!c || !App.dmUnlocked) return;
  const ents = JSON.parse(JSON.stringify(c.ents));
  Object.keys(ents).forEach(k => { if (k.startsWith('roll:') || k.startsWith('init:')) delete ents[k]; });
  ents.initmeta = normalizeInitMeta({});
  ents.meta = normalizeMeta(Object.assign({}, ents.meta, { title: `${getMeta().title} (copia)`, createdAt: Date.now() }));
  const pwd = App.dmPassword;
  const id = await Sync.createCampaign(ents, pwd, JSON.parse(JSON.stringify(App.vault || {})));
  Prefs.set(`iltavolo_role_${id}`, 'DM');
  Prefs.set(`iltavolo_dmpwd_${id}`, pwd);
  showToast('📑 Campagna duplicata');
  await enterCampaign(id);
}

async function deleteActiveCampaign() {
  const id = App.activeId;
  if (!id || !App.dmUnlocked) return;
  const res = await Sync.deleteCampaign(id, App.dmPassword);
  if (!res.ok) { showToast(`⚠️ ${vaultReasonMessage(res.reason)}`); return; }
  ['role', 'mychar', 'dmpwd'].forEach(k => Prefs.del(`iltavolo_${k}_${id}`));
  if (Prefs.get('iltavolo_activeCampaignId') === id) Prefs.del('iltavolo_activeCampaignId');
  lockDm();
  App.activeId = null;
  showToast('🗑️ Campagna eliminata');
  openLobbyHome();
}

async function changeDmPassword(newPassword) {
  const res = await Sync.setVaultPassword(App.activeId, App.dmPassword, newPassword);
  if (!res.ok) { showToast(`⚠️ ${vaultReasonMessage(res.reason)}`); return; }
  App.dmPassword = newPassword;
  Prefs.set(`iltavolo_dmpwd_${App.activeId}`, newPassword);
  getMeta().hasPassword = Boolean(newPassword);
  $('inputSetDmPassword').value = '';
  showToast(newPassword ? '🔑 Password del Master aggiornata' : '🔓 Password rimossa');
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initDmEvents() {
  $('dmUnlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!App.activeId) return;
    const pwd = $('inputUnlockDmPassword').value;
    const res = await unlockDm(App.activeId, pwd);
    $('dmUnlockErrorMsg').textContent = res.ok ? '' : vaultReasonMessage(res.reason);
    showEl('dmUnlockErrorMsg', !res.ok, '');
    if (res.ok) {
      $('inputUnlockDmPassword').value = '';
      showToast('👑 Schermo del Master sbloccato');
      scheduleRender();
    }
  });
  $('btnLockDmNow').addEventListener('click', () => {
    lockDm();
    switchTab('tavolo');
    showToast('🔒 Schermo del Master bloccato');
    scheduleRender();
  });
  $('btnSaveDmPassword').addEventListener('click', () => {
    const pwd = $('inputSetDmPassword').value;
    if (!pwd) { showToast('Scrivi la nuova password'); return; }
    changeDmPassword(pwd);
  });
  $('btnRemoveDmPassword').addEventListener('click', () => changeDmPassword(''));

  const onTitle = (e) => {
    if (!isDM()) return;
    const meta = getMeta();
    meta.title = e.target.value.slice(0, 120) || 'Avventura senza nome';
    touchEnt('meta');
    setVal($('campaignTitleInput'), meta.title);
    setVal($('dmInputCampaignName'), meta.title);
  };
  $('dmInputCampaignName').addEventListener('input', onTitle);
  $('campaignTitleInput').addEventListener('input', onTitle);

  $('dmTextareaSecretNotes').addEventListener('input', (e) => {
    if (!App.vault) return;
    App.vault.secretNotes = e.target.value;
    scheduleVaultSave();
  });
  $('dmTextareaSessionNotes').addEventListener('input', (e) => {
    if (!App.vault) return;
    App.vault.sessionNotes = e.target.value;
    scheduleVaultSave();
  });
  $('btnPrepareSessionEntries').addEventListener('click', prepareSessionEntries);
  $('btnAddExtractedToJournal').addEventListener('click', addExtractedToJournal);
  const extractList = $('sessionExtractedList');
  const onExtractChange = (e) => {
    const row = e.target.closest('[data-extract-id]');
    const x = row && App.extracted.find(i => i.id === row.dataset.extractId);
    if (!x) return;
    if (e.target.classList.contains('extract-check')) x.checked = e.target.checked;
    if (e.target.classList.contains('extract-category')) x.category = e.target.value;
    if (e.target.classList.contains('extract-title')) x.title = e.target.value;
  };
  extractList.addEventListener('change', onExtractChange);
  extractList.addEventListener('input', onExtractChange);

  $('btnDeleteCampaignDm').addEventListener('click', () => showEl('deleteCampaignConfirmBar', true));
  $('btnConfirmDeleteCampaignNo').addEventListener('click', () => showEl('deleteCampaignConfirmBar', false));
  $('btnConfirmDeleteCampaignYes').addEventListener('click', () => { showEl('deleteCampaignConfirmBar', false); deleteActiveCampaign(); });

  // Bilanciamento
  const onParty = () => {
    if (!App.vault) return;
    App.vault.partyCount = clampInt($('dmInputPartyCount').value, 1, 12, 4);
    App.vault.partyLevel = clampInt($('dmInputPartyLevel').value, 1, 20, 1);
    scheduleVaultSave();
    renderEncounter();
  };
  $('dmInputPartyCount').addEventListener('change', onParty);
  $('dmInputPartyLevel').addEventListener('change', onParty);
  $('btnSyncPartyFromSheets').addEventListener('click', () => {
    if (!App.vault) return;
    const def = partyDefaults();
    if (!getPCs().length) { showToast('Non ci sono ancora schede PG'); return; }
    App.vault.partyCount = def.count;
    App.vault.partyLevel = def.level;
    scheduleVaultSave();
    renderEncounter();
    showToast(`🔄 ${def.count} PG di livello medio ${def.level}`);
  });
  const pickEnemy = (m) => {
    App.enemySrd = m.i;
    App.enemySrdName = m.n;
    $('dmNewEnemyName').value = m.n;
    $('dmNewEnemyCr').value = m.cr;
    $('dmNewEnemyAc').value = m.ca;
    $('dmNewEnemyHp').value = m.hp;
    $('dmNewEnemyQty').focus();
  };
  bindMonsterSearch('dmEnemySearch', 'dmEnemySearchResults', pickEnemy);
  $('btnSetCampaignPwd').addEventListener('click', () => changeCampaignPassword(false));
  $('btnRemoveCampaignPwd').addEventListener('click', () => changeCampaignPassword(true));
  renderMonsterGallery('dmMonsterGallery', pickEnemy);
  $('btnAddPreparedEnemy').addEventListener('click', () => {
    if (!App.vault) return;
    const name = $('dmNewEnemyName').value.trim() || 'Nemico';
    App.vault.enemies.push(normalizeVault({ enemies: [{
      id: uid('en'), name, cr: $('dmNewEnemyCr').value,
      ac: $('dmNewEnemyAc').value, hp: $('dmNewEnemyHp').value, qty: $('dmNewEnemyQty').value, included: true,
      srd: App.enemySrd !== null && App.enemySrd !== undefined && name === App.enemySrdName ? App.enemySrd : undefined
    }] }).enemies[0]);
    App.enemySrd = null;
    scheduleVaultSave();
    renderEncounter();
  });
  const enemyList = $('dmPreparedEnemiesList');
  enemyList.addEventListener('click', (e) => {
    const row = e.target.closest('[data-enemy-id]');
    const enemy = row && App.vault?.enemies.find(x => x.id === row.dataset.enemyId);
    if (!enemy) return;
    if (e.target.closest('.enemy-remove')) {
      App.vault.enemies = App.vault.enemies.filter(x => x !== enemy);
      scheduleVaultSave();
      renderEncounter();
    }
    if (e.target.closest('.enemy-to-map')) sendEnemiesWhenReady([enemy]);
  });
  enemyList.addEventListener('change', (e) => {
    const row = e.target.closest('[data-enemy-id]');
    const enemy = row && App.vault?.enemies.find(x => x.id === row.dataset.enemyId);
    if (!enemy) return;
    if (e.target.classList.contains('enemy-include')) enemy.included = e.target.checked;
    if (e.target.classList.contains('enemy-qty')) { enemy.qty = clampInt(e.target.value, 1, 50, 1); e.target.blur(); }
    scheduleVaultSave();
    renderEncounter();
  });
  $('btnSendEnemiesToMap').addEventListener('click', () => {
    if (!App.vault) return;
    sendEnemiesWhenReady(App.vault.enemies.filter(x => x.included));
    switchTab('tavolo');
  });

  document.querySelectorAll('.export-json-btn').forEach(b => b.addEventListener('click', exportCampaign));
  document.querySelectorAll('.import-json-input').forEach(inp => inp.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    importCampaignFile(file);
  }));
  $('btnDuplicateCampaign').addEventListener('click', duplicateCampaign);
  $('btnUploadCampaignToCloud').addEventListener('click', async () => {
    const id = App.activeId;
    if (!id || !App.dmUnlocked) return;
    const ok = await Sync.uploadCampaign(id, App.dmPassword, App.vault);
    if (!ok) { showToast(`⚠️ Caricamento non riuscito: ${Sync.lastError || 'riprova'}`); return; }
    await Sync.openCampaign(id);
    showToast('☁️ Avventura caricata nel cloud: ora puoi invitare i giocatori');
    scheduleRender();
  });
}
