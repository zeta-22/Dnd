// Incantesimi nella scheda: elenco, aggiunta dal regolamento, lancio con gli slot, danni, cure e concentrazione.

function spellStats(ch) {
  const ab = spellcastingAbility(ch);
  const mod = getAbilityMod(ch.abilities[ab]);
  const prof = getProficiencyBonus(ch.level);
  return { ab, mod, attack: prof + mod, dc: 8 + prof + mod };
}

// Danni dei trucchetti che crescono con il livello e dadi extra lanciando con uno slot più alto
function scaledSpellFormula(formula, sp, castLevel, charLevel) {
  const m = String(formula).match(/^(\d+)d(\d+)(.*)$/);
  if (!m) return formula;
  let count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  if (sp.lv === 0) count *= 1 + (charLevel >= 5) + (charLevel >= 11) + (charLevel >= 17);
  let extra = '';
  if (sp.up && castLevel > sp.lv) {
    const u = sp.up.match(/^(\d+)d(\d+)$/);
    if (u) {
      const add = parseInt(u[1], 10) * (castLevel - sp.lv);
      if (parseInt(u[2], 10) === sides) count += add;
      else extra = `+${add}d${u[2]}`;
    }
  }
  return `${count}d${sides}${m[3]}${extra}`;
}

// Preparazione (regole 2014): Chierico, Druido e Mago ne preparano caratteristica + livello, il Paladino
// caratteristica + metà livello (dal 2°). Gli altri incantatori conoscono i loro incantesimi e li lanciano sempre.
// Con le regole 2024 il numero viene dalla tabella della classe e il Paladino prepara già dal 1° livello.
function spellPrepMode(ch) {
  const mode = SRD_CLASSES[srdClassKey(ch.className)]?.casting?.prepares || null;
  return mode === 'half' && ch.level < 2 && campaignRules() !== '2024' ? null : mode;
}

function maxPreparedSpells(ch) {
  const rules = classSpellRules(ch);
  if (rules?.rules === '2024') return rules.spells;
  const lv = spellPrepMode(ch) === 'half' ? Math.floor(ch.level / 2) : ch.level;
  return Math.max(1, spellStats(ch).mod + lv);
}

// I trucchetti e gli incantesimi "sempre preparati" (dominio, giuramento…) non contano
function preparedSpellCount(ch) {
  return ch.spells.filter(s => {
    const sp = srdSpell(Number(s.i));
    return sp && sp.lv > 0 && s.prep && !s.always && !s.ritualOnly;
  }).length;
}

// "ritualOnly": i rituali del Libro dei segreti antichi del Warlock si lanciano solo come rituali
function isSpellReady(ch, entry, sp) {
  if (entry.ritualOnly) return false;
  return sp.lv === 0 || !spellPrepMode(ch) || Boolean(entry.prep || entry.always);
}

function hasSpellbook(ch) {
  return SRD_CLASSES[ch.className]?.casting?.ritual === 'book';
}

// Rituali: il Mago li lancia dal libro anche senza prepararli, Chierico e Druido solo se preparati, il Bardo se li conosce.
// Per le classi fuori dal regolamento base non conosciamo le regole e si lasciano lanciare; gli altri incantatori no.
function canCastAsRitual(ch, entry, sp) {
  if (!sp.rit) return false;
  if (entry.ritualOnly) return true;
  const cls = SRD_CLASSES[ch.className];
  if (!cls) return true;
  const mode = cls.casting?.ritual;
  if (mode === 'book' || mode === 'known') return true;
  if (mode === 'prepared') return isSpellReady(ch, entry, sp);
  return false;
}

function availableSlotLevels(ch, minLevel) {
  // Gli slot dell'Arcanum mistico (6°-9° del Warlock) valgono solo per gli incantesimi di quel livello
  const pact = SRD_CLASSES[ch.className]?.casting?.type === 'pact';
  const out = [];
  for (let lvl = Math.max(1, minLevel); lvl <= 9; lvl++) {
    if (pact && lvl > 5 && lvl !== minLevel) continue;
    const s = ch.spellSlots[lvl];
    if (s && s.max > s.used) out.push(lvl);
  }
  return out;
}

function recordSpellCast(ch, sp, castLevel, extra, asRitual) {
  if (!App.activeId) return;
  const how = asRitual ? ' come rituale (10 minuti in più)' : castLevel ? ` (slot ${castLevel}°)` : '';
  const cast = {
    id: uid('roll'), at: Date.now(), by: isDM() ? `DM (${ch.name})` : ch.name, byId: DEVICE_ID, kind: 'cast',
    label: `lancia ${sp.n}${how}${extra ? ` · ${extra}` : ''}`, formula: '', dice: [], total: asRitual ? '📿' : '✨'
  };
  putEnt(`roll:${cast.id}`, cast);
}

// Come rituale non si spende lo slot: si lancia al suo livello e servono 10 minuti in più
function castSpell(ch, spellIndex, slotLevel, asRitual = false) {
  const sp = srdSpell(spellIndex);
  if (!sp || !canEditChar(ch)) return;
  const entry = ch.spells.find(s => Number(s.i) === spellIndex) || {};
  if (asRitual ? !canCastAsRitual(ch, entry, sp) : !isSpellReady(ch, entry, sp)) {
    showToast(asRitual ? `${ch.name} non può lanciare ${sp.n} come rituale` : `📖 ${sp.n} non è preparato: si preparano dopo un riposo lungo`, 3500);
    return;
  }
  let castLevel = 0;
  if (asRitual) {
    castLevel = sp.lv;
  } else if (sp.lv > 0) {
    castLevel = slotLevel || availableSlotLevels(ch, sp.lv)[0];
    const slot = castLevel && ch.spellSlots[castLevel];
    if (!slot || slot.used >= slot.max) {
      showToast(`Nessuno slot di ${sp.lv}° livello o superiore disponibile. Imposta gli slot qui sopra o fai un riposo.`, 4000);
      return;
    }
    slot.used += 1;
  }
  if (sp.conc) {
    if (ch.concentration?.name && ch.concentration.name !== sp.n) showToast(`🔮 Smetti di concentrarti su ${ch.concentration.name}`, 3000);
    ch.concentration = { name: sp.n, i: sp.i, dc: null };
  }
  touchEnt(`char:${ch.id}`);
  const st = spellStats(ch);
  const extra = sp.save ? `TS ${sp.save} CD ${st.dc}` : '';
  recordSpellCast(ch, sp, castLevel, extra, asRitual);
  if (sp.atk) {
    performD20Roll({ label: `${sp.n} (attacco)`, bonus: st.attack, vsAc: parseInt($('inputTargetAc').value, 10) || null, by: isDM() ? `DM (${ch.name})` : ch.name });
  } else if (sp.dmg) {
    performDamageRoll({ label: `${sp.n} (${sp.dmg.t})`, formula: scaledSpellFormula(sp.dmg.f, sp, castLevel, ch.level) });
  }
  if (sp.heal) {
    const heal = rollDamageFormula(`${scaledSpellFormula(sp.heal, sp, castLevel, ch.level)}${st.mod ? formatSignedMod(st.mod) : ''}`, false);
    if (heal) recordRoll({ id: uid('roll'), at: Date.now(), by: ch.name, byId: DEVICE_ID, label: `${sp.n} (cura)`, formula: heal.formula, dice: heal.rolls, diceSides: heal.sides, bonus: heal.bonus, total: heal.total }, false);
  }
  if (asRitual) showToast(`📿 ${ch.name} lancia ${sp.n} come rituale: ${sp.ct} + 10 minuti, nessuno slot${extra ? ` · ${extra}` : ''}`, 4000);
  else if (!sp.atk && !sp.dmg && !sp.heal) showToast(`✨ ${ch.name} lancia ${sp.n}${extra ? ` · ${extra}` : ''}`, 3000);
  else if (extra) showToast(`✨ ${sp.n}: i bersagli fanno un ${extra}`, 3500);
  scheduleRender();
}

function rollSpellDamage(ch, spellIndex) {
  const sp = srdSpell(spellIndex);
  if (!sp?.dmg || !canEditChar(ch)) return;
  performDamageRoll({ label: `${sp.n} (${sp.dmg.t})`, formula: scaledSpellFormula(sp.dmg.f, sp, sp.lv, ch.level) });
}

// Chiamata quando un personaggio che si concentra subisce danni
function concentrationCheckNeeded(ch, damage) {
  if (!ch.concentration?.name || damage <= 0) return;
  if (ch.hp <= 0) {
    showToast(`🔮 ${ch.name} perde la concentrazione su ${ch.concentration.name}`, 3500);
    ch.concentration = null;
    return;
  }
  ch.concentration.dc = Math.max(10, Math.floor(damage / 2));
  showToast(`🔮 ${ch.name}: TS Costituzione CD ${ch.concentration.dc} per mantenere ${ch.concentration.name}`, 4500);
}

function rollConcentrationSave(ch) {
  if (!ch.concentration?.name) return;
  const dc = ch.concentration.dc || 10;
  const roll = performD20Roll({ label: `TS concentrazione (${ch.concentration.name})`, bonus: saveBonus(ch, 'COS'), by: ch.name });
  const name = ch.concentration.name;
  if (roll.total < dc) {
    whenRollLands(roll, () => showToast(`🔮 Concentrazione persa: ${name} finisce`, 3500));
    ch.concentration = null;
  } else {
    whenRollLands(roll, () => showToast(`🔮 Concentrazione mantenuta (${roll.total} contro CD ${dc})`, 3000));
    ch.concentration.dc = null;
  }
  touchEnt(`char:${ch.id}`);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Disegno nella scheda
// ---------------------------------------------------------------------------

// Quanti trucchetti e incantesimi contano nei limiti della classe: gli "extra" (razza, talenti, oggetti…),
// quelli sempre preparati (dominio, giuramento…) e i rituali del Libro dei segreti antichi no
function spellCounts(ch) {
  const counted = ch.spells.filter(s => !s.x && !s.always && !s.ritualOnly).map(s => srdSpell(Number(s.i))).filter(Boolean);
  const leveled = counted.filter(sp => sp.lv > 0).length;
  return { cantrips: counted.length - leveled, leveled };
}

// Trucchetti e incantesimi conosciuti; per chi prepara (chierico, druido, paladino, mago) il numero dei
// preparati è nella barra "Preparati" della lista
function spellLimitsHtml(ch, rules) {
  const c = spellCounts(ch);
  const prepares = Boolean(spellPrepMode(ch));
  const part = (label, have, max) => `<span class="${have > max ? 'font-bold text-[var(--danger)]' : have === max ? 'font-bold text-[var(--ok)]' : ''}">${label} ${have}/${max}</span>`;
  const parts = [];
  if (rules.cantrips) parts.push(part('Trucchetti', c.cantrips, rules.cantrips));
  if (rules.book) parts.push(`<span>Nel libro ${c.leveled}</span>`);
  else if (!prepares) parts.push(part(rules.kind === 'known' ? 'Incantesimi conosciuti' : 'Incantesimi preparati', c.leveled, rules.spells));
  const upTo = rules.maxLevel ? `fino al ${rules.maxLevel}° livello` : `il ${rules.cls} non ha ancora incantesimi a questo livello`;
  const over = c.cantrips > rules.cantrips || (!prepares && c.leveled > rules.spells);
  return `${parts.join(' · ')}${parts.length ? ' · ' : ''}${upTo} <span class="text-[var(--muted)]">(regole ${rules.rules})</span>
    ${over ? '<div class="font-bold text-[var(--danger)]">Hai più incantesimi di quelli che la classe permette a questo livello: togline qualcuno o segnalo come extra.</div>' : ''}`;
}

// Si può aggiungere un incantesimo della classe? Restituisce il motivo se no.
// Chi prepara ne aggiunge quanti vuole: poi sceglie quali preparare.
function spellAddProblem(ch, rules, sp) {
  if (sp.lv === 0 && !rules.cantrips) return `Il ${rules.cls} non ha trucchetti`;
  if (sp.lv > 0 && !rules.maxLevel) return `Al ${ch.level}° livello il ${rules.cls} non ha ancora incantesimi`;
  if (sp.lv > rules.maxLevel) return `Al ${ch.level}° livello il ${rules.cls} lancia incantesimi fino al ${rules.maxLevel}° livello`;
  const c = spellCounts(ch);
  if (sp.lv === 0 && c.cantrips >= rules.cantrips) return `Hai già ${c.cantrips} trucchetti su ${rules.cantrips}`;
  if (sp.lv > 0 && !spellPrepMode(ch) && c.leveled >= rules.spells) return `Hai già ${c.leveled} incantesimi su ${rules.spells}`;
  return '';
}

function spellMetaLine(sp) {
  const lvl = sp.lv === 0 ? 'Trucchetto' : `${sp.lv}° livello`;
  return `${lvl} · ${escapeHtml(sp.sc)} · ${escapeHtml(sp.ct)} · ${escapeHtml(sp.rg)} · ${escapeHtml(sp.du)}${sp.rit ? ' · rituale' : ''}`;
}

function spellDetailsHtml(sp, extra = '') {
  return `<details class="text-[11px]"><summary class="cursor-pointer text-[var(--muted)]">Dettagli</summary>
    <div class="mt-1 flex flex-col gap-1 leading-snug">
      ${extra}
      <div><strong>Componenti:</strong> ${escapeHtml(sp.co)}</div>
      <div><strong>Classi:</strong> ${escapeHtml(sp.cl.join(', '))}</div>
      <p class="whitespace-pre-wrap" lang="en">${escapeHtml(sp.d)}</p>
      ${sp.hl ? `<p class="whitespace-pre-wrap" lang="en"><strong>At Higher Levels.</strong> ${escapeHtml(sp.hl)}</p>` : ''}
    </div></details>`;
}

function renderSpellsCard(ch, editable) {
  const sel = $('sheetSpellAbility');
  if (!sel.options.length) sel.innerHTML = ABILITY_KEYS.map(k => `<option value="${k}">${k}</option>`).join('');
  setVal(sel, spellcastingAbility(ch));
  sel.disabled = !editable;
  const st = spellStats(ch);
  setText('sheetSpellStats', `Attacco ${formatSignedMod(st.attack)} · CD ${st.dc}`);
  $('btnOpenSpellPicker').disabled = !editable;

  const bar = $('sheetConcentrationBar');
  showEl(bar, Boolean(ch.concentration?.name));
  if (ch.concentration?.name) {
    bar.innerHTML = `<span class="font-bold">🔮 Concentrazione: ${escapeHtml(ch.concentration.name)}${ch.concentration.dc ? ` · serve un TS COS CD ${ch.concentration.dc}` : ''}</span>
      <span class="flex gap-1.5">
        <button type="button" class="btn btn-felt text-xs py-0.5 conc-save-btn" ${editable ? '' : 'disabled'}>🎲 TS Costituzione</button>
        <button type="button" class="btn text-xs py-0.5 conc-end-btn" ${editable ? '' : 'disabled'}>Interrompi</button>
      </span>`;
  }

  const rules = classSpellRules(ch);
  if (rules && !SRD.spells) loadSrd('spells').then(scheduleRender).catch(() => {});
  const limits = $('sheetSpellLimits');
  showEl(limits, Boolean(rules && SRD.spells), '');
  if (rules && SRD.spells) limits.innerHTML = spellLimitsHtml(ch, rules);

  const list = $('sheetSpellList');
  if (!ch.spells.length) {
    list.innerHTML = '<div class="text-[var(--muted)] italic">Nessun incantesimo. Premi “+ Aggiungi” per sceglierli dal regolamento.</div>';
    return;
  }
  if (!SRD.spells) {
    list.innerHTML = '<div class="text-[var(--muted)] italic">Carico gli incantesimi…</div>';
    loadSrd('spells').then(scheduleRender).catch(() => { list.innerHTML = `<div class="text-[var(--danger)]">${escapeHtml(srdUnavailableMessage())}</div>`; });
    return;
  }
  const entries = new Map(ch.spells.map(s => [Number(s.i), s]));
  const spells = ch.spells.map(s => srdSpell(Number(s.i))).filter(Boolean).sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n, 'it'));
  const prepares = Boolean(spellPrepMode(ch));
  let prepBar = '';
  if (prepares) {
    const count = preparedSpellCount(ch);
    const max = maxPreparedSpells(ch);
    prepBar = `<div class="card-surface2 px-3 py-2 flex flex-col gap-0.5">
      <div><strong class="${count > max ? 'text-[var(--danger)]' : 'text-[var(--felt)]'}">📖 Preparati ${count} / ${max}</strong>
        <span class="text-[var(--muted)]">· si cambiano dopo un riposo lungo · i trucchetti non contano</span></div>
      ${hasSpellbook(ch) ? '<div class="text-[11px] text-[var(--muted)]">Questo è il tuo libro: i rituali (📿) si lanciano anche senza prepararli.</div>' : ''}
      ${count > max ? '<div class="text-[11px] text-[var(--danger)]">Sono troppi: togli la spunta a qualcuno. Gli incantesimi 📌 sempre preparati (dominio, giuramento…) non contano.</div>' : ''}
    </div>`;
  }
  // I "Dettagli" aperti restano aperti quando la scheda si ridisegna
  const openDetails = new Set([...list.querySelectorAll('[data-spell] details[open]')].map(d => d.closest('[data-spell]').dataset.spell));
  let lastLevel = -1;
  list.innerHTML = prepBar + spells.map(sp => {
    const header = sp.lv !== lastLevel ? `<div class="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] pt-1">${sp.lv === 0 ? 'Trucchetti' : `${sp.lv}° livello`}</div>` : '';
    lastLevel = sp.lv;
    const entry = entries.get(sp.i) || {};
    const ready = isSpellReady(ch, entry, sp);
    const ritual = canCastAsRitual(ch, entry, sp);
    const slots = sp.lv > 0 ? availableSlotLevels(ch, sp.lv) : [];
    let slotSelect = '';
    if (sp.lv > 0 && !ready) slotSelect = `<span class="text-[10px] text-[var(--muted)]">${entry.ritualOnly ? 'solo come rituale' : 'non preparato'}</span>`;
    else if (sp.lv > 0) slotSelect = slots.length ? `<select class="input-field text-[11px] py-0 px-1 spell-slot-select" aria-label="Slot">${slots.map(l => `<option value="${l}">slot ${l}°</option>`).join('')}</select>` : '<span class="text-[10px] text-[var(--danger)]">niente slot</span>';
    const canPrep = prepares && sp.lv > 0 && !entry.ritualOnly;
    const prepToggle = canPrep && !entry.always
      ? `<input type="checkbox" class="w-4 h-4 mt-0.5 accent-[var(--felt)] spell-prep-toggle" ${entry.prep ? 'checked' : ''} ${editable ? '' : 'disabled'} title="Preparato" aria-label="Preparato" />`
      : '';
    const alwaysToggle = canPrep && editable
      ? `<label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="w-4 h-4 accent-[var(--felt)] spell-always-toggle" ${entry.always ? 'checked' : ''} />
          📌 Sempre preparato (dominio, giuramento…): non conta nel numero</label>`
      : '';
    return `${header}
      <div class="card-surface2 p-2 flex flex-col gap-1 ${ready ? '' : 'opacity-70'}" data-spell="${sp.i}">
        <div class="flex flex-wrap items-center justify-between gap-1.5">
          <div class="min-w-0 flex items-start gap-2">
            ${prepToggle}
            <div class="min-w-0">
              <strong class="font-serif-title text-sm">${escapeHtml(sp.n)}</strong>
              ${sp.conc ? '<span class="text-[10px] font-bold text-[var(--brass)]">🔮 conc.</span>' : ''}
              ${canPrep && entry.always ? '<span class="text-[10px] font-bold text-[var(--felt)]" title="Sempre preparato: non conta nel numero">📌 sempre</span>' : ''}
              ${entry.x && !canPrep ? '<span class="text-[10px] font-bold text-[var(--muted)]" title="Da razza, talento o oggetto: non conta nei limiti della classe">extra</span>' : ''}
              <div class="text-[10px] text-[var(--muted)]">${spellMetaLine(sp)}</div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            ${slotSelect}
            ${ready ? `<button type="button" class="btn btn-felt text-[11px] py-0.5 px-2 spell-cast-btn" ${editable && (sp.lv === 0 || slots.length) ? '' : 'disabled data-off'}>✨ Lancia</button>` : ''}
            ${ritual ? `<button type="button" class="btn text-[11px] py-0.5 px-2 spell-ritual-btn" title="Come rituale: nessuno slot, ${escapeHtml(sp.ct)} + 10 minuti" ${editable ? '' : 'disabled'}>📿 Rituale</button>` : ''}
            ${sp.dmg && ready ? `<button type="button" class="btn btn-brass text-[11px] py-0.5 px-2 spell-dmg-btn" ${editable ? '' : 'disabled'}>💥 ${escapeHtml(scaledSpellFormula(sp.dmg.f, sp, sp.lv, ch.level))}</button>` : ''}
            ${editable ? '<button type="button" class="btn text-[11px] py-0.5 px-1.5 spell-remove-btn" title="Togli dalla scheda">✕</button>' : ''}
          </div>
        </div>
        ${spellDetailsHtml(sp, alwaysToggle)}
      </div>`;
  }).join('');
  openDetails.forEach(i => list.querySelector(`[data-spell="${i}"] details`)?.setAttribute('open', ''));
}

// ---------------------------------------------------------------------------
// Scelta degli incantesimi
// ---------------------------------------------------------------------------

function openSpellPicker() {
  const ch = currentSheetChar();
  if (!ch || !canEditChar(ch)) return;
  const classSel = $('selectSpellClass');
  if (!classSel.options.length) {
    classSel.innerHTML = '<option value="">Tutte le classi</option>' + ['Bardo', 'Chierico', 'Druido', 'Mago', 'Paladino', 'Ranger', 'Stregone', 'Warlock'].map(c => `<option value="${c}">${c}</option>`).join('');
    $('selectSpellLevel').innerHTML = '<option value="">Tutti i livelli</option><option value="0">Trucchetti</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}">${l}° livello</option>`).join('');
  }
  const rules = classSpellRules(ch);
  classSel.value = rules ? rules.cls : '';
  $('selectSpellLevel').value = '';
  $('inputSpellSearch').value = '';
  $('spellPickerExtra').checked = false;
  showEl('spellPickerExtraRow', Boolean(rules));
  showEl('modalSpellPicker', true);
  $('spellPickerResults').innerHTML = '<div class="text-[var(--muted)]">Carico gli incantesimi…</div>';
  loadSrd('spells').then(renderSpellPicker).catch(() => { $('spellPickerResults').innerHTML = `<div class="text-[var(--danger)]">${escapeHtml(srdUnavailableMessage())}</div>`; });
  focusSoon('inputSpellSearch');
}

function renderSpellPicker() {
  const ch = currentSheetChar();
  if (!ch || !SRD.spells) return;
  // Con una classe del regolamento si sceglie dal suo elenco, fino al livello che può lanciare
  const rules = classSpellRules(ch);
  const limited = rules && !$('spellPickerExtra').checked;
  if (limited) $('selectSpellClass').value = rules.cls;
  $('selectSpellClass').disabled = Boolean(limited);
  const limits = $('spellPickerLimits');
  showEl(limits, Boolean(rules), '');
  if (rules) limits.innerHTML = spellLimitsHtml(ch, rules);
  const cls = $('selectSpellClass').value;
  const lv = $('selectSpellLevel').value;
  const known = new Set(ch.spells.map(s => Number(s.i)));
  const res = searchSrdList(SRD.spells, $('inputSpellSearch').value, 60, sp => (!cls || sp.cl.includes(cls)) && (lv === '' || sp.lv === Number(lv)) && (!limited || sp.lv <= rules.maxLevel));
  const addButton = sp => {
    const problem = limited ? spellAddProblem(ch, rules, sp) : '';
    return problem
      ? `<span class="text-[10px] font-bold text-[var(--muted)] text-right max-w-[9rem]">${escapeHtml(problem)}</span>`
      : `<button type="button" class="btn btn-felt text-[11px] py-0.5 px-2 spell-add-btn">+ ${limited || !rules ? 'Aggiungi' : 'Aggiungi extra'}</button>`;
  };
  $('spellPickerResults').innerHTML = res.length ? res.map(sp => `
    <div class="card-surface2 p-2 flex flex-col gap-1" data-spell="${sp.i}">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0"><strong class="font-serif-title text-sm">${escapeHtml(sp.n)}</strong> <span class="text-[10px] text-[var(--muted)]">${escapeHtml(sp.e)}</span>
          <div class="text-[10px] text-[var(--muted)]">${spellMetaLine(sp)}</div></div>
        ${known.has(sp.i) ? '<span class="text-[11px] font-bold text-[var(--ok)]">✓ nella scheda</span>' : addButton(sp)}
      </div>
      ${spellDetailsHtml(sp)}
    </div>`).join('') : `<div class="text-[var(--muted)]">${limited && !rules.maxLevel && !rules.cantrips ? `Al ${ch.level}° livello il ${escapeHtml(rules.cls)} non ha ancora incantesimi.` : 'Nessun incantesimo trovato.'}</div>`;
}

function initSpellEvents() {
  $('btnOpenSpellPicker').addEventListener('click', openSpellPicker);
  $('btnCloseSpellPicker').addEventListener('click', () => showEl('modalSpellPicker', false));
  $('modalSpellPicker').addEventListener('click', (e) => { if (e.target.id === 'modalSpellPicker') showEl('modalSpellPicker', false); });
  $('inputSpellSearch').addEventListener('input', debounce(renderSpellPicker, 120));
  $('selectSpellClass').addEventListener('change', renderSpellPicker);
  $('selectSpellLevel').addEventListener('change', renderSpellPicker);
  $('spellPickerExtra').addEventListener('change', () => {
    if ($('spellPickerExtra').checked) $('selectSpellClass').value = '';
    renderSpellPicker();
  });
  $('spellPickerResults').addEventListener('click', (e) => {
    const btn = e.target.closest('.spell-add-btn');
    const row = btn && e.target.closest('[data-spell]');
    const ch = currentSheetChar();
    if (!row || !ch || !canEditChar(ch)) return;
    const sp = srdSpell(Number(row.dataset.spell));
    if (!sp) return;
    const rules = classSpellRules(ch);
    const extra = Boolean(rules && $('spellPickerExtra').checked);
    if (rules && !extra) {
      const problem = spellAddProblem(ch, rules, sp);
      if (problem) { showToast(problem); return; }
    }
    // Chi prepara gli incantesimi li trova già preparati finché c'è posto; gli extra (razza, talenti…) sono sempre pronti e non contano
    const max = maxPreparedSpells(ch);
    const prep = extra || !spellPrepMode(ch) || sp.lv === 0 || preparedSpellCount(ch) < max;
    ch.spells.push(extra ? { i: sp.i, prep: true, always: true, x: true } : { i: sp.i, prep, always: false });
    if (!prep) showToast(`📖 ${sp.n} ${hasSpellbook(ch) ? 'è nel libro' : 'è nella scheda'}, ma non preparato: ne hai già ${max}. Scegli quali preparare dalla scheda.`, 4500);
    touchEnt(`char:${ch.id}`);
    renderSpellPicker();
    scheduleRender();
  });
  $('sheetSpellAbility').addEventListener('change', (e) => {
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    ch.spellAbility = e.target.value;
    touchEnt(`char:${ch.id}`);
    e.target.blur();
    scheduleRender();
  });
  $('sheetSpellList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-spell]');
    const ch = currentSheetChar();
    if (!row || !ch || !canEditChar(ch)) return;
    const i = Number(row.dataset.spell);
    if (e.target.closest('.spell-cast-btn')) castSpell(ch, i, parseInt(row.querySelector('.spell-slot-select')?.value, 10) || null);
    if (e.target.closest('.spell-ritual-btn')) castSpell(ch, i, null, true);
    if (e.target.closest('.spell-dmg-btn')) rollSpellDamage(ch, i);
    if (e.target.closest('.spell-remove-btn')) {
      ch.spells = ch.spells.filter(s => Number(s.i) !== i);
      touchEnt(`char:${ch.id}`);
      scheduleRender();
    }
  });
  $('sheetSpellList').addEventListener('change', (e) => {
    const row = e.target.closest('[data-spell]');
    const ch = currentSheetChar();
    const entry = row && ch && ch.spells.find(s => Number(s.i) === Number(row.dataset.spell));
    if (!entry || !canEditChar(ch)) return;
    if (e.target.classList.contains('spell-prep-toggle')) {
      entry.prep = e.target.checked;
    } else if (e.target.classList.contains('spell-always-toggle')) {
      entry.always = e.target.checked;
      if (entry.always) entry.prep = true;
    } else return;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  });
  $('sheetConcentrationBar').addEventListener('click', (e) => {
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    if (e.target.closest('.conc-save-btn')) rollConcentrationSave(ch);
    if (e.target.closest('.conc-end-btn')) {
      ch.concentration = null;
      touchEnt(`char:${ch.id}`);
      scheduleRender();
    }
  });
}
