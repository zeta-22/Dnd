// Colonna destra del Tavolo: iniziativa, lancia-dadi e assistente; barra del personaggio in basso.

// ---------------------------------------------------------------------------
// Tiri
// ---------------------------------------------------------------------------

function rollD20(mode) {
  const a = rollDie(20);
  if (mode !== 'adv' && mode !== 'dis') return { rolls: [a], kept: a };
  const b = rollDie(20);
  return { rolls: [a, b], kept: mode === 'adv' ? Math.max(a, b) : Math.min(a, b) };
}

const ADV_LABELS = { adv: 'vantaggio', dis: 'svantaggio' };

// Prova, tiro salvezza o tiro per colpire: d20 + bonus
function performD20Roll({ label, bonus = 0, vsAc = null, mode = App.advMode, secret = false, by = null }) {
  const d = rollD20(mode);
  const total = d.kept + bonus;
  const roll = {
    id: uid('roll'), at: Date.now(), by: by || actorName(), byId: DEVICE_ID, label: label || 'Tiro',
    formula: describeFormula(1, 20, bonus), dice: d.rolls, kept: d.kept, bonus, total,
    mode: d.rolls.length > 1 ? mode : 'normal', nat: d.kept,
    crit: d.kept === 20, fumble: d.kept === 1, vsAc: vsAc || null,
    hit: vsAc ? (d.kept === 20 || (d.kept !== 1 && total >= vsAc)) : null
  };
  recordRoll(roll, secret);
  return roll;
}

function performDamageRoll({ label, formula, crit = false, secret = false }) {
  const res = rollDamageFormula(formula, crit);
  if (!res) { showToast(`⚠️ Formula non valida: ${formula}`); return null; }
  const roll = {
    id: uid('roll'), at: Date.now(), by: actorName(), byId: DEVICE_ID, label: `${label || 'Danni'}${crit ? ' (critico)' : ''}`,
    formula: res.formula, dice: res.rolls, bonus: res.bonus, total: res.total, kind: 'damage'
  };
  recordRoll(roll, secret);
  return roll;
}

// Tiro libero dal lancia-dadi
function performDicePanelRoll(sides) {
  const count = clampInt($('inputDiceCount').value, 1, 30, 1);
  const bonus = parseInt($('inputDiceBonus').value, 10) || 0;
  const vsAc = parseInt($('inputTargetAc').value, 10) || null;
  const label = $('inputRollLabel').value.trim() || `d${sides}`;
  const secret = isDM() && $('inputSecretRoll').checked;
  if (sides === 20 && count === 1) {
    performD20Roll({ label, bonus, vsAc, secret });
    return;
  }
  const dice = [];
  for (let i = 0; i < count; i++) dice.push(rollDie(sides));
  const total = dice.reduce((s, v) => s + v, 0) + bonus;
  const roll = {
    id: uid('roll'), at: Date.now(), by: actorName(), byId: DEVICE_ID, label,
    formula: describeFormula(count, sides, bonus), dice, bonus, total
  };
  if (sides === 20 && vsAc) roll.vsAc = vsAc;
  recordRoll(roll, secret);
}

function recordRoll(roll, secret) {
  if (secret) {
    roll.secret = true;
    App.secretRolls.unshift(roll);
    App.secretRolls = App.secretRolls.slice(0, 20);
  } else if (App.activeId) {
    putEnt(`roll:${roll.id}`, roll);
    // Teniamo solo gli ultimi 40 tiri
    getRolls().slice(40).forEach(r => removeEnt(`roll:${r.id}`));
  }
  showToast(`🎲 ${roll.label}: ${roll.total}${roll.hit === true ? ' — colpito!' : roll.hit === false ? ' — mancato' : ''}${roll.crit && roll.vsAc ? ' ✨' : ''}`);
  renderRolls();
}

function describeRollDice(r) {
  const dice = (r.dice || []).join(', ');
  if (r.mode === 'adv' || r.mode === 'dis') return `${r.formula} (${ADV_LABELS[r.mode]}: ${dice} → ${r.kept})`;
  return `${r.formula}${dice ? ` [${dice}]` : ''}`;
}

function rollOutcomeHtml(r) {
  const parts = [];
  if (r.crit && r.nat === 20) parts.push('<span class="badge-crit">20 naturale</span>');
  if (r.fumble && r.nat === 1) parts.push('<span class="badge-fumble">1 naturale</span>');
  if (r.vsAc) parts.push(r.hit ? `<span class="badge-hit">✓ colpisce CA ${r.vsAc}</span>` : `<span class="badge-miss">✗ manca CA ${r.vsAc}</span>`);
  return parts.join(' ');
}

function renderRolls() {
  const listEl = $('rollHistoryList');
  if (!listEl) return;
  const all = getRolls().concat(isDM() ? App.secretRolls : []).sort((a, b) => b.at - a.at).slice(0, 25);
  if (!all.length) {
    listEl.innerHTML = '<div class="text-xs text-[var(--muted)] italic py-1">Nessun tiro ancora. Prova un d20!</div>';
    showEl('lastRollDisplay', false);
    return;
  }
  listEl.innerHTML = all.map(r => `
    <div class="card-surface2 roll-entry ${r.secret ? 'secret' : ''} p-2 text-xs flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="font-bold truncate">${r.secret ? '🔒 ' : ''}${escapeHtml(r.by)} · ${escapeHtml(r.label)}</div>
        <div class="text-[11px] text-[var(--muted)]">${escapeHtml(describeRollDice(r))} ${rollOutcomeHtml(r)}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <strong class="font-serif-title text-base">${r.total}</strong>
        <div class="text-[10px] text-[var(--muted)]">${new Date(r.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>`).join('');

  const last = all[0];
  const box = $('lastRollDisplay');
  box.innerHTML = `
    <div class="min-w-0 text-xs">
      <div class="font-bold truncate">${last.secret ? '🔒 ' : ''}${escapeHtml(last.by)} · ${escapeHtml(last.label)}</div>
      <div class="text-[var(--muted)]">${escapeHtml(describeRollDice(last))}</div>
      <div>${rollOutcomeHtml(last)}</div>
    </div>
    <div class="last-roll-total">${last.total}</div>`;
  showEl(box, true);
  if (App.lastShownRollId !== last.id) {
    App.lastShownRollId = last.id;
    box.classList.remove('fresh');
    void box.offsetWidth;
    box.classList.add('fresh');
  }
}

function setAdvMode(mode) {
  App.advMode = mode;
  document.querySelectorAll('.adv-mode-btn').forEach(b => {
    const on = b.dataset.adv === mode;
    b.classList.toggle('bg-[var(--felt)]', on);
    b.classList.toggle('text-[var(--felt-ink)]', on);
    b.classList.toggle('font-bold', on);
    b.classList.toggle('text-[var(--muted)]', !on);
    b.classList.toggle('font-medium', !on);
  });
}

// ---------------------------------------------------------------------------
// Iniziativa
// ---------------------------------------------------------------------------

function rollInitiativeForChar(ch, quiet = false) {
  if (!ch) return;
  const dexMod = getAbilityMod(ch.abilities?.DES);
  const roll = performD20Roll({ label: `Iniziativa (${ch.name})`, bonus: dexMod, mode: 'normal', by: isDM() ? 'DM' : ch.name });
  const existing = getInitEntries().find(e => e.charId === ch.id);
  const tok = tokenForChar(ch.id);
  const entry = normalizeInitEntry(Object.assign(existing || { id: uid('init') }, {
    name: ch.name, score: roll.total, dexMod, charId: ch.id, tokenId: tok?.id || null, ownerId: ch.ownerId || null
  }));
  putEnt(`init:${entry.id}`, entry);
  startCombatIfNeeded();
  if (!quiet) showToast(`⚡ Iniziativa di ${ch.name}: ${roll.total}`);
}

function addTokenToInitiative(tok) {
  if (tok.charId) { rollInitiativeForChar(getChar(tok.charId)); return; }
  const existing = getInitEntries().find(e => e.tokenId === tok.id);
  const bonus = tok.initMod || 0;
  const d = rollDie(20);
  const entry = normalizeInitEntry(Object.assign(existing || { id: uid('init') }, {
    name: tok.name, score: d + bonus, dexMod: bonus, tokenId: tok.id, charId: null
  }));
  putEnt(`init:${entry.id}`, entry);
  startCombatIfNeeded();
  return entry;
}

function startCombatIfNeeded() {
  const meta = getInitMeta();
  if (!meta.inCombat) {
    meta.inCombat = true;
    meta.round = 1;
    meta.activeId = null;
    touchEnt('initmeta');
  }
}

function handleRollInitiativeButton() {
  if (isDM()) {
    const missing = getPCs().filter(pc => !getInitEntries().some(e => e.charId === pc.id));
    if (!missing.length) { showToast('Tutti i PG sono già in iniziativa'); return; }
    missing.forEach(pc => rollInitiativeForChar(pc, true));
    showToast(`⚡ Iniziativa tirata per ${missing.length} PG`);
  } else {
    const ch = myChar();
    if (!ch) { showToast('Scegli prima il tuo personaggio (👤 Ruolo / PG)'); return; }
    rollInitiativeForChar(ch);
  }
  renderInitiative();
}

function addMapEnemiesToInitiative() {
  if (!isDM()) return;
  const inInit = new Set(getInitEntries().map(e => e.tokenId));
  const enemies = getTokens().filter(t => t.type !== 'pc' && !t.charId && !t.hidden && !inInit.has(t.id));
  if (!enemies.length) { showToast('Nessun nuovo nemico visibile sulla mappa'); return; }
  enemies.forEach(t => addTokenToInitiative(t));
  showToast(`👹 ${enemies.length} nemici aggiunti all'iniziativa`);
  renderInitiative();
}

function canAdvanceTurn() {
  if (isDM()) return true;
  const meta = getInitMeta();
  const active = meta.activeId ? ent(`init:${meta.activeId}`) : null;
  return Boolean(active?.charId && canEditChar(getChar(active.charId)));
}

function nextTurn() {
  if (!canAdvanceTurn()) { showToast('Solo il DM o chi è di turno può passare il turno'); return; }
  const list = getInitEntries();
  if (!list.length) { showToast('Nessuno in iniziativa'); return; }
  const meta = getInitMeta();
  const idx = list.findIndex(e => e.id === meta.activeId);
  let next = idx + 1;
  if (idx === -1) next = 0;
  else if (next >= list.length) { next = 0; meta.round += 1; }
  meta.activeId = list[next].id;
  meta.inCombat = true;
  touchEnt('initmeta');
  scheduleRender();
  announceTurn(list[next]);
}

function announceTurn(entry) {
  if (!entry) return;
  const mine = entry.charId && entry.charId === App.myCharId && !isDM();
  showToast(mine ? '⚔️ Tocca a te!' : `⚔️ Turno di ${entry.name}`);
}

function endCombat() {
  if (!isDM()) return;
  getInitEntries().forEach(e => removeEnt(`init:${e.id}`));
  putEnt('initmeta', normalizeInitMeta({ round: 1, inCombat: false, activeId: null }));
  scheduleRender();
  showToast('🏳️ Combattimento terminato');
}

function initEntryHiddenFromPlayers(e) {
  if (!e.tokenId) return false;
  const tok = getToken(e.tokenId);
  return Boolean(tok?.hidden);
}

function renderInitiative() {
  const meta = getInitMeta();
  const listEl = $('initiativeList');
  if (!listEl) return;
  const dm = isDM();
  setText('initRoundNumber', meta.round || 1);
  const badge = $('initStatusBadge');
  badge.textContent = meta.inCombat ? (meta.activeId ? `⚔️ In combattimento` : '⚔️ Premi “Turno →” per iniziare') : 'Fuori combattimento';
  const open = Prefs.get('iltavolo_init_open', '1') === '1';
  showEl('initiativePanelBody', open);
  setText('btnToggleInitPanel', open ? '▲' : '▼');
  $('btnNextTurn').disabled = !canAdvanceTurn();

  const entries = getInitEntries().filter(e => dm || !initEntryHiddenFromPlayers(e));
  safeRebuild(listEl, () => {
    if (!entries.length) {
      listEl.innerHTML = '<div class="text-xs text-[var(--muted)] italic py-2 text-center">Nessun combattente. Premi “🎲 Tira” per entrare in iniziativa.</div>';
      return;
    }
    listEl.innerHTML = entries.map(e => {
      const active = meta.inCombat && e.id === meta.activeId;
      const mine = e.charId && e.charId === App.myCharId;
      const hidden = initEntryHiddenFromPlayers(e);
      return `
        <div class="init-row ${active ? 'active' : ''} ${mine ? 'mine' : ''}" data-init-id="${escapeHtml(e.id)}">
          <span class="init-name truncate">${active ? '▶ ' : ''}${hidden ? '👁️‍🗨️ ' : ''}${escapeHtml(e.name)}</span>
          <span class="flex items-center gap-1 flex-shrink-0">
            ${dm ? `<input type="number" class="input-field w-12 text-center py-0 px-1 text-xs font-bold init-score-input" value="${e.score}" aria-label="Punteggio di iniziativa" />
                   <button type="button" class="btn text-[10px] py-0 px-1.5 init-remove-btn" title="Togli dall'iniziativa">✕</button>`
                : `<strong>${e.score}</strong>`}
          </span>
        </div>`;
    }).join('');
  });
}

function onInitiativeListEvent(e) {
  const row = e.target.closest('[data-init-id]');
  if (!row || !isDM()) return;
  const id = row.dataset.initId;
  if (e.type === 'click' && e.target.closest('.init-remove-btn')) {
    const meta = getInitMeta();
    if (meta.activeId === id) {
      const list = getInitEntries();
      const idx = list.findIndex(x => x.id === id);
      const next = list[idx + 1] || list[0];
      meta.activeId = next && next.id !== id ? next.id : null;
      touchEnt('initmeta');
    }
    removeEnt(`init:${id}`);
    scheduleRender();
  }
  if (e.type === 'change' && e.target.classList.contains('init-score-input')) {
    const entry = ent(`init:${id}`);
    if (!entry) return;
    entry.score = parseInt(e.target.value, 10) || 0;
    touchEnt(`init:${id}`);
    scheduleRender();
  }
}

// ---------------------------------------------------------------------------
// Assistente regole
// ---------------------------------------------------------------------------

function renderChat() {
  const box = $('geminiChatMessagesBox');
  if (!box) return;
  const intro = `<div class="chat-msg bot"><strong>Assistente:</strong> Ciao! Chiedimi una regola, una condizione o qualcosa che c'è nei manuali PDF che hai caricato in “Regole &amp; PDF”.</div>`;
  box.innerHTML = intro + App.chat.map((m, i) => {
    if (m.role === 'user') return `<div class="chat-msg user">${escapeHtml(m.text)}</div>`;
    const sources = (m.sources || []).map(s => `<span class="src-link" data-book-id="${escapeHtml(s.bookId)}" data-page="${s.page}">📖 ${escapeHtml(s.title)} p. ${s.page}</span>`).join(' · ');
    return `<div class="chat-msg bot">${m.pending ? '<em>Sto cercando…</em>' : escapeHtml(m.text)}${sources ? `<div class="mt-1 text-[11px]">${sources}</div>` : ''}${m.note ? `<div class="mt-1 text-[10px] text-[var(--muted)]">${escapeHtml(m.note)}</div>` : ''}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
  const badge = $('geminiApiKeyStatusBadge');
  if (badge) badge.textContent = !App.ai.checked ? '…' : App.ai.available ? '✨ IA attiva' : '🔎 Ricerca locale';
}

async function submitAssistantQuestion(question) {
  const q = question.trim();
  if (!q) return;
  App.chat.push({ role: 'user', text: q });
  const pending = { role: 'bot', text: '', pending: true };
  App.chat.push(pending);
  renderChat();
  try {
    const answer = await askAssistant(q, App.chat.filter(m => !m.pending).slice(-8, -1));
    Object.assign(pending, { pending: false, text: answer.text, sources: answer.sources, note: answer.note });
  } catch (err) {
    Object.assign(pending, { pending: false, text: 'Non sono riuscito a rispondere. Riprova tra poco.' });
  }
  renderChat();
}

// ---------------------------------------------------------------------------
// Barra del personaggio in basso
// ---------------------------------------------------------------------------

function summaryChar() {
  if (isDM()) return getChar(App.sheetCharId);
  return myChar();
}

function renderSummaryBar() {
  const bar = $('activeCharSummaryBar');
  const ch = App.activeId ? summaryChar() : null;
  if (!bar) return;
  if (!ch) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.classList.add('flex');
  const conds = ch.conditions.length ? `<span>|</span><span class="text-[var(--danger)] font-bold">⚠️ ${escapeHtml(ch.conditions.join(', '))}</span>` : '';
  const down = ch.hp <= 0 ? `<span>|</span><span class="text-[var(--danger)] font-bold">💀 TS morte ${ch.deathSaves.successes}✓ ${ch.deathSaves.failures}✗</span>` : '';
  $('activeCharSummaryText').innerHTML = `
    <strong class="font-serif-title text-base text-[var(--ok)]">${escapeHtml(ch.name)}</strong>
    <span>|</span><span>PF <strong>${ch.hp}/${ch.maxHp}</strong>${ch.tempHp ? ` <span class="text-[var(--muted)]">(+${ch.tempHp} temp.)</span>` : ''}</span>
    <span>|</span><span>CA <strong>${ch.ac}</strong></span>${conds}${down}`;
  const editable = canEditChar(ch);
  $('btnCharHpMinus').disabled = !editable;
  $('btnCharHpPlus').disabled = !editable;
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initTableEvents() {
  document.querySelectorAll('.dice-btn').forEach(btn => btn.addEventListener('click', () => performDicePanelRoll(parseInt(btn.dataset.sides, 10))));
  $('btnClearRolls').addEventListener('click', () => {
    if (!isDM()) return;
    getRolls().forEach(r => removeEnt(`roll:${r.id}`));
    App.secretRolls = [];
    renderRolls();
  });
  $('btnToggleModPanel').addEventListener('click', () => $('diceModPanel').classList.toggle('hidden'));
  document.querySelectorAll('.adv-mode-btn').forEach(b => b.addEventListener('click', () => setAdvMode(b.dataset.adv)));
  $('btnQuickResetMod').addEventListener('click', () => {
    $('inputDiceCount').value = 1;
    $('inputDiceBonus').value = 0;
    $('inputTargetAc').value = '';
    $('inputRollLabel').value = '';
    $('inputSecretRoll').checked = false;
    setAdvMode('normal');
  });

  $('btnRollMyInitiative').addEventListener('click', handleRollInitiativeButton);
  $('btnNextTurn').addEventListener('click', nextTurn);
  $('btnAddMapEnemiesInit').addEventListener('click', addMapEnemiesToInitiative);
  $('btnEndCombat').addEventListener('click', endCombat);
  $('btnToggleInitPanel').addEventListener('click', () => {
    Prefs.set('iltavolo_init_open', Prefs.get('iltavolo_init_open', '1') === '1' ? '0' : '1');
    renderInitiative();
  });
  $('initiativeList').addEventListener('click', onInitiativeListEvent);
  $('initiativeList').addEventListener('change', onInitiativeListEvent);

  $('geminiChatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('inputGeminiQuery');
    const q = input.value;
    input.value = '';
    submitAssistantQuestion(q);
  });
  $('geminiChatMessagesBox').addEventListener('click', (e) => {
    const link = e.target.closest('.src-link');
    if (link) openBookAtPage(link.dataset.bookId, parseInt(link.dataset.page, 10) || 1);
  });

  $('btnCharHpMinus').addEventListener('click', () => { const ch = summaryChar(); if (canEditChar(ch)) adjustCharHp(ch, -1); });
  $('btnCharHpPlus').addEventListener('click', () => { const ch = summaryChar(); if (canEditChar(ch)) adjustCharHp(ch, 1); });
  $('btnGoToSheet').addEventListener('click', () => {
    const ch = summaryChar();
    if (ch) App.sheetCharId = ch.id;
    switchTab('personaggio');
  });
}
