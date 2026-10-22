// Scheda personaggio.

const SHEET_FIELDS = {
  sheetInputName: { field: 'name', type: 'text' },
  sheetInputRace: { field: 'race', type: 'text' },
  sheetInputClass: { field: 'className', type: 'text' },
  sheetInputLevel: { field: 'level', type: 'int', min: 1, max: 20 },
  sheetInputBackground: { field: 'background', type: 'text' },
  sheetInputBonusAction: { field: 'bonusAction', type: 'text' },
  sheetInputHp: { field: 'hp', type: 'int', min: 0, max: 9999 },
  sheetInputMaxHp: { field: 'maxHp', type: 'int', min: 1, max: 9999 },
  sheetInputAc: { field: 'ac', type: 'int', min: 0, max: 40 },
  sheetInputSpeed: { field: 'speed', type: 'float', min: 0, max: 60 },
  sheetInputHitDie: { field: 'hitDie', type: 'text' },
  sheetTextareaAttacks: { field: 'attacksText', type: 'text' },
  sheetTextareaEquipment: { field: 'equipmentText', type: 'text' },
  sheetTextareaSpells: { field: 'spellsText', type: 'text' },
  sheetTextareaFeatures: { field: 'featuresText', type: 'text' },
  sheetTextareaNotes: { field: 'notes', type: 'text' }
};

function currentSheetChar() {
  const chars = getChars();
  let ch = getChar(App.sheetCharId);
  if (!ch) {
    ch = (!isDM() && myChar()) || (isDM() ? chars[0] : null) || null;
    App.sheetCharId = ch?.id || null;
  }
  return ch;
}

function sheetViewMode() {
  return Prefs.get('iltavolo_sheet_view', 'simple') === 'complete' ? 'complete' : 'simple';
}

function skillBonus(ch, skill) {
  const prof = Number(ch.skillsProf[skill.key] === true ? 1 : ch.skillsProf[skill.key]) || 0;
  return getAbilityMod(ch.abilities[skill.ability]) + prof * getProficiencyBonus(ch.level);
}

function saveBonus(ch, ab) {
  return getAbilityMod(ch.abilities[ab]) + (ch.savingThrowsProf[ab] ? getProficiencyBonus(ch.level) : 0);
}

function parseAttacks(text) {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split('|').map(p => p.trim());
    const bonus = parseInt(String(parts[1] || '').replace(/\s/g, ''), 10);
    return { name: parts[0] || 'Attacco', bonus: isNaN(bonus) ? null : bonus, damage: parts[2] || '' };
  });
}

// ---------------------------------------------------------------------------
// Punti ferita
// ---------------------------------------------------------------------------

function adjustCharHp(ch, delta) {
  if (!ch || !delta) return;
  if (delta < 0) {
    let dmg = -delta;
    if (ch.tempHp > 0) {
      const absorbed = Math.min(ch.tempHp, dmg);
      ch.tempHp -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      if (ch.hp === 0 && !ch.isNpc) {
        ch.deathSaves.failures = Math.min(3, ch.deathSaves.failures + 1);
        showToast(ch.deathSaves.failures >= 3 ? `☠️ ${ch.name} è morto…` : `💀 ${ch.name} subisce danno a 0 PF: un fallimento al TS contro morte`);
      } else {
        const overflow = dmg - ch.hp;
        ch.hp = Math.max(0, ch.hp - dmg);
        concentrationCheckNeeded(ch, dmg);
        if (ch.hp === 0) {
          showToast(overflow >= ch.maxHp ? `☠️ ${ch.name}: il danno in eccesso supera i PF massimi, morte istantanea!` : `💀 ${ch.name} è a 0 PF!`);
        }
      }
    }
  } else {
    if (ch.hp === 0) ch.deathSaves = { successes: 0, failures: 0 };
    ch.hp = Math.min(ch.maxHp, ch.hp + delta);
  }
  touchEnt(`char:${ch.id}`);
  scheduleRender();
}

function shortRest(ch) {
  if (ch.hitDiceRemaining <= 0) { showToast('Nessun Dado Vita rimasto: serve un riposo lungo'); return; }
  if (ch.hp >= ch.maxHp) { showToast('Hai già tutti i PF'); return; }
  const sides = parseInt(ch.hitDie.slice(1), 10) || 8;
  const conMod = getAbilityMod(ch.abilities.COS);
  const v = rollDie(sides);
  const heal = Math.max(0, v + conMod);
  ch.hitDiceRemaining -= 1;
  ch.hp = Math.min(ch.maxHp, ch.hp + heal);
  if (heal > 0) ch.deathSaves = { successes: 0, failures: 0 };
  touchEnt(`char:${ch.id}`);
  recordRoll({ id: uid('roll'), at: Date.now(), by: ch.name, byId: DEVICE_ID, label: 'Dado Vita (riposo breve)', formula: describeFormula(1, sides, conMod), dice: [v], diceSides: [sides], bonus: conMod, total: heal }, false);
  showToast(`⛺ ${ch.name} recupera ${heal} PF`);
  scheduleRender();
}

function longRest(ch) {
  ch.hp = ch.maxHp;
  ch.tempHp = 0;
  ch.hitDiceRemaining = Math.min(ch.level, ch.hitDiceRemaining + Math.max(1, Math.floor(ch.level / 2)));
  for (let lvl = 1; lvl <= 9; lvl++) ch.spellSlots[lvl].used = 0;
  ch.deathSaves = { successes: 0, failures: 0 };
  ch.conditions = ch.conditions.filter(c => c !== 'Indebolimento');
  ch.concentration = null;
  touchEnt(`char:${ch.id}`);
  showToast(`🌙 ${ch.name} si è riposato: PF, Dadi Vita e slot recuperati`);
  scheduleRender();
}

function rollDeathSave(ch) {
  const d = rollDie(20);
  let msg;
  if (d === 20) {
    ch.hp = 1;
    ch.deathSaves = { successes: 0, failures: 0 };
    msg = `✨ 20 naturale! ${ch.name} torna in piedi con 1 PF`;
  } else if (d === 1) {
    ch.deathSaves.failures = Math.min(3, ch.deathSaves.failures + 2);
    msg = `💀 1 naturale: due fallimenti`;
  } else if (d >= 10) {
    ch.deathSaves.successes = Math.min(3, ch.deathSaves.successes + 1);
    msg = `✓ Successo (${d})`;
  } else {
    ch.deathSaves.failures = Math.min(3, ch.deathSaves.failures + 1);
    msg = `✗ Fallimento (${d})`;
  }
  if (ch.deathSaves.successes >= 3) msg += ` — ${ch.name} è stabile`;
  if (ch.deathSaves.failures >= 3) msg += ` — ${ch.name} è morto…`;
  touchEnt(`char:${ch.id}`);
  recordRoll({ id: uid('roll'), at: Date.now(), by: ch.name, byId: DEVICE_ID, label: 'TS contro morte', formula: '1d20', dice: [d], diceSides: [20], bonus: 0, total: d, nat: d, crit: d === 20, fumble: d === 1 }, false);
  showToast(msg, 3500);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function renderSheetCharSelect() {
  const select = $('sheetCharSelect');
  if (!select || document.activeElement === select) return;
  const chars = getChars();
  const ch = currentSheetChar();
  const dm = isDM();
  const options = chars.filter(c => dm || !c.isNpc).map(c => {
    const own = canEditChar(c);
    const suffix = c.isNpc ? ' (PNG)' : !dm && !own ? ' (sola lettura)' : c.id === App.myCharId && !dm ? ' (tu)' : '';
    return `<option value="${escapeHtml(c.id)}" ${ch && c.id === ch.id ? 'selected' : ''}>${escapeHtml(c.name)}${suffix}</option>`;
  });
  select.innerHTML = options.join('') || '<option value="">Nessun personaggio</option>';
}

function renderSheet() {
  renderSheetCharSelect();
  const ch = currentSheetChar();
  showEl('sheetEmptyState', !ch);
  showEl('sheetBody', Boolean(ch), 'grid');
  if (!ch) {
    showEl('sheetReadOnlyBanner', false);
    showEl('deleteSheetConfirmBar', false);
    $('btnDeleteSheet').classList.add('hidden');
    return;
  }
  const editable = canEditChar(ch);
  const complete = sheetViewMode() === 'complete';
  showEl('sheetReadOnlyBanner', !editable, '');
  $('btnDeleteSheet').classList.toggle('hidden', !editable);

  setText('sheetCardMainTitle', ch.isNpc ? 'Scheda PNG' : 'Scheda Avventuriero');
  const portrait = $('sheetPortrait');
  const src = charImageSrc(ch);
  portrait.classList.toggle('has-image', Boolean(src));
  portrait.style.backgroundImage = src ? `url("${src}")` : '';
  portrait.disabled = !editable;
  portrait.title = editable ? 'Tocca per scegliere l\'immagine del personaggio' : '';
  setText('sheetPortraitInitials', src ? '' : editable ? '📷' : initialsOf(ch.name));
  showEl('btnRemovePortrait', editable && Boolean(src), '');
  setText('sheetCharTypeBadge', ch.isNpc ? 'PNG' : 'PG');
  Object.entries(SHEET_FIELDS).forEach(([id, def]) => setVal($(id), ch[def.field]));
  setText('sheetHitDiceRemainingBadge', `${ch.hitDiceRemaining}/${ch.level}`);
  setText('guideBonusActionHighlight', ch.bonusAction || 'nessuna (dipende dalla classe)');

  // PF
  const pct = ch.maxHp > 0 ? Math.round((ch.hp / ch.maxHp) * 100) : 0;
  setText('sheetHpPercentBadge', ch.tempHp ? `${pct}% · +${ch.tempHp} temp.` : `${pct}%`);
  const fill = $('sheetHpBarFill');
  fill.style.width = `${pct}%`;
  fill.style.background = pct > 50 ? 'var(--ok)' : pct > 25 ? 'var(--brass)' : 'var(--danger)';

  // Tiri salvezza contro morte
  showEl('sheetDeathSavesBox', ch.hp <= 0 && !ch.isNpc);
  document.querySelectorAll('.death-save-dot').forEach(dot => {
    const idx = parseInt(dot.dataset.dsIndex, 10);
    const type = dot.dataset.dsType;
    const count = type === 'success' ? ch.deathSaves.successes : ch.deathSaves.failures;
    dot.classList.toggle(type === 'success' ? 'active-success' : 'active-failure', idx <= count);
  });

  // Caratteristiche
  document.querySelectorAll('[data-ability-input]').forEach(inp => setVal(inp, ch.abilities[inp.dataset.abilityInput]));
  ABILITY_KEYS.forEach(ab => setText(`sheetMod_${ab}`, formatSignedMod(getAbilityMod(ch.abilities[ab]))));
  setText('sheetInitModDisplay', formatSignedMod(getAbilityMod(ch.abilities.DES)));
  setText('sheetProfBonusDisplay', formatSignedMod(getProficiencyBonus(ch.level)));
  const perception = DND5E_SKILLS.find(s => s.key === 'Percezione');
  setText('sheetPassivePerceptionDisplay', 10 + skillBonus(ch, perception));

  renderSheetAttacks(ch, editable);
  renderSpellSlots(ch, editable, complete);
  renderSpellsCard(ch, editable);
  renderConditions(ch, editable);

  // Vista semplice / completa
  const simpleBtn = $('btnSheetViewSimple');
  const completeBtn = $('btnSheetViewComplete');
  [[simpleBtn, !complete], [completeBtn, complete]].forEach(([btn, on]) => {
    btn.classList.toggle('bg-[var(--felt)]', on);
    btn.classList.toggle('text-[var(--felt-ink)]', on);
    btn.classList.toggle('font-bold', on);
    btn.classList.toggle('text-[var(--muted)]', !on);
  });
  showEl('sheetSimpleTurnGuide', !complete);
  showEl('sheetCompleteSkillsColumn', complete);
  showEl('sheetCompleteTextAreas', complete);
  showEl('sheetBackgroundFieldWrap', complete, '');
  if (complete) {
    renderSavingThrows(ch, editable);
    renderSkills(ch, editable);
  }

  // Sola lettura per le schede degli altri
  $('sheetBody').querySelectorAll('input, textarea, select, button').forEach(el => { el.disabled = !editable; });
  $('btnSwitchToCompleteFromGuide').disabled = false;
  $('btnLevelUp').classList.toggle('hidden', !editable || ch.level >= 20);
  $('btnSheetRollInit').disabled = !editable;
  ['btnShortRest', 'btnLongRest'].forEach(id => { $(id).disabled = !editable; });
}

function renderSheetAttacks(ch, editable) {
  const list = $('sheetGeneratedAttacksList');
  const attacks = parseAttacks(ch.attacksText);
  list.innerHTML = attacks.length ? attacks.map((a, i) => `
    <div class="card-surface2 p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <strong class="font-serif-title text-sm">${escapeHtml(a.name)}</strong>
      <div class="flex items-center gap-1.5">
        ${a.bonus !== null ? `<button type="button" class="btn btn-felt text-xs py-0.5 px-2 attack-roll-btn" data-attack-index="${i}" ${editable ? '' : 'disabled'}>🎯 ${formatSignedMod(a.bonus)}</button>` : ''}
        ${a.damage ? `<button type="button" class="btn btn-brass text-xs py-0.5 px-2 damage-roll-btn" data-attack-index="${i}" ${editable ? '' : 'disabled'}>💥 ${escapeHtml(a.damage)}</button>` : ''}
      </div>
    </div>`).join('') : '<div class="text-xs text-[var(--muted)] italic">Nessun attacco. Scrivine uno per riga qui sotto, es. “Spada lunga | +5 | 1d8+3”.</div>';
}

function renderSpellSlots(ch, editable, complete) {
  const grid = $('sheetSpellSlotsGrid');
  safeRebuild(grid, () => {
    const levels = [];
    for (let lvl = 1; lvl <= 9; lvl++) {
      const s = ch.spellSlots[lvl];
      if (!complete && s.max === 0) continue;
      levels.push(lvl);
    }
    if (!levels.length) {
      grid.innerHTML = '<div class="text-xs text-[var(--muted)] italic sm:col-span-3">Nessuno slot impostato. Se il tuo personaggio lancia incantesimi, aprili nella vista “Completa”.</div>';
      return;
    }
    grid.innerHTML = levels.map(lvl => {
      const s = ch.spellSlots[lvl];
      const pips = Array.from({ length: s.max }, (_, i) => `<button type="button" class="spell-slot-pip ${i < s.used ? 'used' : ''}" data-slot-level="${lvl}" data-slot-index="${i + 1}" title="${i < s.used ? 'Usato' : 'Disponibile'}" ${editable ? '' : 'disabled'}>✓</button>`).join('');
      return `
        <div class="card-surface2 p-2 flex flex-col gap-1.5 text-xs">
          <div class="flex items-center justify-between">
            <strong>Livello ${lvl}</strong>
            <label class="flex items-center gap-1 text-[10px] text-[var(--muted)]">max
              <input type="number" min="0" max="9" value="${s.max}" class="input-field w-10 text-center py-0 px-1 font-bold slot-max-input" data-slot-level="${lvl}" ${editable ? '' : 'disabled'} />
            </label>
          </div>
          <div class="flex flex-wrap gap-1">${pips || '<span class="text-[10px] text-[var(--muted)]">—</span>'}</div>
        </div>`;
    }).join('');
  });
}

function renderConditions(ch, editable) {
  const wrap = $('sheetConditionsButtons');
  wrap.innerHTML = DND5E_CONDITIONS.map(c => `<button type="button" class="condition-btn ${ch.conditions.includes(c.name) ? 'active' : ''}" data-condition="${escapeHtml(c.name)}" title="${escapeHtml(c.desc)}" ${editable ? '' : 'disabled'}>${escapeHtml(conditionLabel(ch, c.name))}</button>`).join('');
  const info = $('sheetActiveConditionsInfo');
  const active = DND5E_CONDITIONS.filter(c => ch.conditions.includes(c.name));
  showEl(info, active.length > 0);
  safeRebuild(info, () => {
    info.innerHTML = active.map(c => `
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 flex-1"><strong class="text-[var(--danger)]">${escapeHtml(c.name)}:</strong> ${escapeHtml(c.desc)}</div>
        <label class="flex items-center gap-1 text-[10px] text-[var(--muted)]">Durata
          <select class="input-field text-xs py-0.5 cond-duration" data-condition="${escapeHtml(c.name)}" ${editable ? '' : 'disabled'}>${durationOptionsHtml(ch.conditionRounds[c.name])}</select>
        </label>
      </div>`).join('') + '<div class="text-[10px] text-[var(--muted)]">La durata scende di uno all\'inizio di ogni tuo turno in combattimento.</div>';
  });
}

function renderSavingThrows(ch, editable) {
  $('sheetSavingThrowsList').innerHTML = ABILITY_KEYS.map(ab => `
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-2">
        <button type="button" class="skill-prof-btn ${ch.savingThrowsProf[ab] ? 'prof' : ''} save-prof-btn" data-save="${ab}" title="Competenza" aria-label="Competenza nel TS di ${ABILITY_LABELS[ab]}" ${editable ? '' : 'disabled'}></button>
        ${ABILITY_LABELS[ab]}
      </span>
      <button type="button" class="btn text-xs py-0.5 px-2 font-bold save-roll-btn" data-save="${ab}" ${editable ? '' : 'disabled'}>${formatSignedMod(saveBonus(ch, ab))} 🎲</button>
    </div>`).join('');
}

function renderSkills(ch, editable) {
  $('sheetSkillsList').innerHTML = DND5E_SKILLS.map(s => {
    const prof = Number(ch.skillsProf[s.key] === true ? 1 : ch.skillsProf[s.key]) || 0;
    const title = prof === 2 ? 'Maestria' : prof === 1 ? 'Competente' : 'Non competente';
    return `
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 min-w-0">
          <button type="button" class="skill-prof-btn ${prof === 1 ? 'prof' : prof === 2 ? 'expert' : ''} skill-prof-toggle" data-skill="${escapeHtml(s.key)}" title="${title} (tocca per cambiare)" aria-label="${title}" ${editable ? '' : 'disabled'}></button>
          <span class="truncate">${escapeHtml(s.label)} <span class="text-[10px] text-[var(--muted)]">${s.ability}</span></span>
        </span>
        <button type="button" class="btn text-xs py-0.5 px-2 font-bold skill-roll-btn" data-skill="${escapeHtml(s.key)}" ${editable ? '' : 'disabled'}>${formatSignedMod(skillBonus(ch, s))} 🎲</button>
      </div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------

function createCharacter(fields, { isNpc = false, own = true } = {}) {
  const ch = ensureCharacterDefaults(Object.assign({ id: uid('char') }, fields, { isNpc }));
  if (own && !isNpc) ch.ownerId = DEVICE_ID;
  putEnt(`char:${ch.id}`, ch);
  if (!isNpc) createTokenForChar(ch);
  return ch;
}

function deleteCharacter(ch) {
  if (!ch || !canEditChar(ch)) return;
  getAllTokens().filter(t => t.charId === ch.id).forEach(t => removeEnt(`token:${t.id}`));
  getInitEntries().filter(e => e.charId === ch.id).forEach(e => removeEnt(`init:${e.id}`));
  // I messaggi e le dispense cifrati per lui non li potrebbe più leggere nessuno
  ['msg:', 'handout:'].forEach(prefix => entList(prefix).filter(m => m.to === ch.id).forEach(m => removeEnt(prefix + m.id)));
  removeEnt(`char:${ch.id}`);
  if (App.myCharId === ch.id) {
    App.myCharId = null;
    Prefs.del(`iltavolo_mychar_${App.activeId}`);
  }
  App.sheetCharId = null;
  showToast(`🗑️ Scheda di ${ch.name} eliminata`);
  scheduleRender();
}

function onSheetFieldInput(e) {
  const def = SHEET_FIELDS[e.target.id];
  const ch = currentSheetChar();
  if (!def || !ch || !canEditChar(ch)) return;
  let value = e.target.value;
  if (def.type === 'int' || def.type === 'float') {
    if (value === '' || value === '-') return;
    value = def.type === 'int' ? parseInt(value, 10) : parseFloat(String(value).replace(',', '.'));
    if (isNaN(value)) return;
    value = Math.max(def.min, Math.min(def.max, value));
  }
  ch[def.field] = value;
  if (def.field === 'maxHp') ch.hp = Math.min(ch.hp, ch.maxHp);
  if (def.field === 'hp') ch.hp = Math.min(ch.hp, ch.maxHp);
  if (def.field === 'level') ch.hitDiceRemaining = Math.min(ch.hitDiceRemaining, ch.level);
  touchEnt(`char:${ch.id}`);
  scheduleRender();
}

function onSheetClick(e) {
  const ch = currentSheetChar();
  if (!ch || !canEditChar(ch)) return;
  const t = e.target;

  const abilityBtn = t.closest('[data-ability-roll]');
  if (abilityBtn) {
    const ab = abilityBtn.dataset.abilityRoll;
    performD20Roll({ label: `Prova di ${ABILITY_LABELS[ab]}`, bonus: getAbilityMod(ch.abilities[ab]), by: isDM() ? `DM (${ch.name})` : ch.name });
    return;
  }
  const attackBtn = t.closest('.attack-roll-btn');
  if (attackBtn) {
    const a = parseAttacks(ch.attacksText)[parseInt(attackBtn.dataset.attackIndex, 10)];
    if (!a) return;
    const vsAc = parseInt($('inputTargetAc').value, 10) || null;
    const roll = performD20Roll({ label: a.name, bonus: a.bonus || 0, vsAc, by: isDM() ? `DM (${ch.name})` : ch.name });
    App.lastAttack = { charId: ch.id, name: a.name, crit: roll.crit, at: Date.now() };
    return;
  }
  const dmgBtn = t.closest('.damage-roll-btn');
  if (dmgBtn) {
    const a = parseAttacks(ch.attacksText)[parseInt(dmgBtn.dataset.attackIndex, 10)];
    if (!a) return;
    const last = App.lastAttack;
    const crit = Boolean(last && last.crit && last.charId === ch.id && last.name === a.name && Date.now() - last.at < 120000);
    performDamageRoll({ label: `Danni ${a.name}`, formula: a.damage, crit });
    if (crit) App.lastAttack = null;
    return;
  }
  const pip = t.closest('.spell-slot-pip');
  if (pip) {
    const lvl = parseInt(pip.dataset.slotLevel, 10);
    const idx = parseInt(pip.dataset.slotIndex, 10);
    const slot = ch.spellSlots[lvl];
    slot.used = slot.used >= idx ? idx - 1 : idx;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
    return;
  }
  const cond = t.closest('.condition-btn');
  if (cond) {
    const name = cond.dataset.condition;
    setCondition({ obj: ch, key: `char:${ch.id}` }, name, !ch.conditions.includes(name));
    scheduleRender();
    return;
  }
  const saveProf = t.closest('.save-prof-btn');
  if (saveProf) {
    const ab = saveProf.dataset.save;
    ch.savingThrowsProf[ab] = !ch.savingThrowsProf[ab];
    touchEnt(`char:${ch.id}`);
    scheduleRender();
    return;
  }
  const saveRoll = t.closest('.save-roll-btn');
  if (saveRoll) {
    const ab = saveRoll.dataset.save;
    performD20Roll({ label: `TS ${ABILITY_LABELS[ab]}`, bonus: saveBonus(ch, ab), by: isDM() ? `DM (${ch.name})` : ch.name });
    return;
  }
  const skillProf = t.closest('.skill-prof-toggle');
  if (skillProf) {
    const key = skillProf.dataset.skill;
    const cur = Number(ch.skillsProf[key] === true ? 1 : ch.skillsProf[key]) || 0;
    ch.skillsProf[key] = (cur + 1) % 3;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
    return;
  }
  const skillRoll = t.closest('.skill-roll-btn');
  if (skillRoll) {
    const skill = DND5E_SKILLS.find(s => s.key === skillRoll.dataset.skill);
    if (skill) performD20Roll({ label: skill.label, bonus: skillBonus(ch, skill), by: isDM() ? `DM (${ch.name})` : ch.name });
    return;
  }
  const dot = t.closest('.death-save-dot');
  if (dot) {
    const field = dot.dataset.dsType === 'success' ? 'successes' : 'failures';
    const idx = parseInt(dot.dataset.dsIndex, 10);
    ch.deathSaves[field] = ch.deathSaves[field] >= idx ? idx - 1 : idx;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  }
}

function setSheetView(mode) {
  Prefs.set('iltavolo_sheet_view', mode);
  renderSheet();
}

function initSheetEvents() {
  Object.keys(SHEET_FIELDS).forEach(id => $(id).addEventListener('input', onSheetFieldInput));
  // Al termine della modifica riallinea il campo ai valori ammessi
  Object.keys(SHEET_FIELDS).forEach(id => $(id).addEventListener('change', () => { $(id).blur(); scheduleRender(); }));
  document.querySelectorAll('[data-ability-input]').forEach(inp => inp.addEventListener('input', () => {
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch) || inp.value === '') return;
    ch.abilities[inp.dataset.abilityInput] = clampInt(inp.value, 1, 30, 10);
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  }));
  $('tab-personaggio').addEventListener('click', onSheetClick);
  $('sheetSpellSlotsGrid').addEventListener('change', (e) => {
    if (!e.target.classList.contains('slot-max-input')) return;
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    const slot = ch.spellSlots[parseInt(e.target.dataset.slotLevel, 10)];
    slot.max = clampInt(e.target.value, 0, 9, 0);
    slot.used = Math.min(slot.used, slot.max);
    touchEnt(`char:${ch.id}`);
    e.target.blur();
    scheduleRender();
  });

  $('sheetCharSelect').addEventListener('change', (e) => { App.sheetCharId = e.target.value || null; e.target.blur(); scheduleRender(); });
  $('btnSheetViewSimple').addEventListener('click', () => setSheetView('simple'));
  $('btnSheetViewComplete').addEventListener('click', () => setSheetView('complete'));
  $('btnSwitchToCompleteFromGuide').addEventListener('click', () => setSheetView('complete'));

  const withChar = (fn) => () => { const ch = currentSheetChar(); if (ch && canEditChar(ch)) fn(ch); };
  $('btnSheetHpMinus').addEventListener('click', withChar(ch => adjustCharHp(ch, -1)));
  $('btnSheetHpPlus').addEventListener('click', withChar(ch => adjustCharHp(ch, 1)));
  $('btnShortRest').addEventListener('click', withChar(shortRest));
  $('btnLongRest').addEventListener('click', withChar(longRest));
  $('btnRollDeathSave').addEventListener('click', withChar(rollDeathSave));
  $('btnSheetRollInit').addEventListener('click', withChar(ch => { rollInitiativeForChar(ch); scheduleRender(); }));
  $('btnClearAllConditions').addEventListener('click', withChar(ch => { ch.conditions = []; ch.conditionRounds = {}; touchEnt(`char:${ch.id}`); scheduleRender(); }));
  $('sheetActiveConditionsInfo').addEventListener('change', (e) => {
    if (!e.target.classList.contains('cond-duration')) return;
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    setCondition({ obj: ch, key: `char:${ch.id}` }, e.target.dataset.condition, true, parseInt(e.target.value, 10) || 0);
    e.target.blur();
    scheduleRender();
  });

  $('btnNewPcSheet').addEventListener('click', () => {
    if (!App.activeId) return;
    const dm = isDM();
    const ch = createCharacter({ name: 'Nuovo eroe', race: 'Umano', className: 'Guerriero', level: 1, maxHp: 10, ac: 12 }, { own: !dm });
    if (!dm && !App.myCharId) {
      App.myCharId = ch.id;
      Prefs.set(`iltavolo_mychar_${App.activeId}`, ch.id);
    }
    App.sheetCharId = ch.id;
    scheduleRender();
    focusSoon('sheetInputName', true);
  });
  $('btnNewNpcSheet').addEventListener('click', () => {
    if (!isDM()) return;
    const ch = createCharacter({ name: 'Nuovo PNG', race: 'Umano', className: 'Popolano', level: 1, maxHp: 8, ac: 10 }, { isNpc: true, own: false });
    App.sheetCharId = ch.id;
    scheduleRender();
    focusSoon('sheetInputName', true);
  });
  $('btnDeleteSheet').addEventListener('click', () => showEl('deleteSheetConfirmBar', true));
  $('btnConfirmDeleteSheetNo').addEventListener('click', () => showEl('deleteSheetConfirmBar', false));
  $('btnConfirmDeleteSheetYes').addEventListener('click', () => {
    showEl('deleteSheetConfirmBar', false);
    deleteCharacter(currentSheetChar());
  });
}
