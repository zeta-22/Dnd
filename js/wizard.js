// Creazione guidata del personaggio (classi e razze del regolamento base). Il passaggio di livello è in levelup.js.

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const WIZARD_STEPS = ['Chi sei', 'Classe', 'Caratteristiche', 'Abilità', 'Riepilogo'];
// Ordine consigliato delle caratteristiche per ogni classe: la serie standard parte già così
const CLASS_ABILITY_ORDER = {
  Barbaro: ['FOR', 'COS', 'DES', 'SAG', 'CAR', 'INT'], Bardo: ['CAR', 'DES', 'COS', 'SAG', 'INT', 'FOR'],
  Chierico: ['SAG', 'COS', 'FOR', 'CAR', 'DES', 'INT'], Druido: ['SAG', 'COS', 'DES', 'INT', 'CAR', 'FOR'],
  Guerriero: ['FOR', 'COS', 'DES', 'SAG', 'CAR', 'INT'], Ladro: ['DES', 'COS', 'SAG', 'INT', 'CAR', 'FOR'],
  Mago: ['INT', 'COS', 'DES', 'SAG', 'CAR', 'FOR'], Monaco: ['DES', 'SAG', 'COS', 'FOR', 'INT', 'CAR'],
  Paladino: ['FOR', 'CAR', 'COS', 'SAG', 'DES', 'INT'], Ranger: ['DES', 'SAG', 'COS', 'FOR', 'INT', 'CAR'],
  Stregone: ['CAR', 'COS', 'DES', 'SAG', 'INT', 'FOR'], Warlock: ['CAR', 'COS', 'DES', 'SAG', 'INT', 'FOR']
};

function suggestedAssign(cls) {
  const order = CLASS_ABILITY_ORDER[cls] || ABILITY_KEYS;
  return Object.fromEntries(order.map((k, i) => [k, STANDARD_ARRAY[i]]));
}

function newWizardState(purpose, campId) {
  return {
    step: 0, purpose, campId, name: '', race: 'Umano', cls: 'Guerriero', level: 1, method: 'standard',
    assign: suggestedAssign('Guerriero'),
    points: { FOR: 8, DES: 8, COS: 8, INT: 8, SAG: 8, CAR: 8 },
    rolled: [], rollAssign: {}, freeBonus: [], background: 'Soldato', classSkills: [], freeSkills: []
  };
}

function openCharWizard(purpose, campId) {
  App.wiz = newWizardState(purpose, campId);
  showEl('modalCharWizard', true);
  renderWizard();
}

function closeCharWizard() {
  showEl('modalCharWizard', false);
  App.wiz = null;
}

// Punteggi prima dei bonus razziali
function wizardBaseScores(w) {
  if (w.method === 'point') return Object.assign({}, w.points);
  if (w.method === 'roll') {
    const out = {};
    ABILITY_KEYS.forEach(k => { out[k] = w.rolled[w.rollAssign[k]] ?? 8; });
    return out;
  }
  return Object.assign({}, w.assign);
}

function wizardFinalScores(w) {
  const base = wizardBaseScores(w);
  const race = SRD_RACES[w.race];
  ABILITY_KEYS.forEach(k => { base[k] = Math.min(20, base[k] + (race.bonus[k] || 0) + (w.freeBonus.includes(k) ? 1 : 0)); });
  return base;
}

function wizardFixedSkills(w) {
  return [...new Set([...(SRD_BACKGROUNDS[w.background] || []), ...(SRD_RACES[w.race].skills || [])])];
}

function wizardHp(w, scores) {
  const cls = SRD_CLASSES[w.cls];
  const con = getAbilityMod(scores.COS);
  const perLevel = Math.floor(cls.die / 2) + 1 + con;
  const extra = (SRD_RACES[w.race].hpPerLevel || 0) * w.level;
  return Math.max(1, cls.die + con + (w.level - 1) * perLevel + extra);
}

function wizardAc(w, scores) {
  const cls = SRD_CLASSES[w.cls];
  const dex = getAbilityMod(scores.DES);
  if (cls.ac === 'barbarian') return 10 + dex + getAbilityMod(scores.COS);
  if (cls.ac === 'monk') return 10 + dex + getAbilityMod(scores.SAG);
  return 10 + dex;
}

// Armi iniziali della classe, già calcolate sul personaggio che si sta creando
function wizardWeaponsText(w, scores) {
  const ch = { abilities: scores, level: w.level, className: w.cls, race: w.race };
  return SRD_CLASSES[w.cls].weapons.map(k => weaponStats(ch, { k }, campaignRules(w.campId)))
    .map(st => `${st.name} ${formatSignedMod(st.hit)} (${st.damage})`).join(' · ');
}

// Controlla il passo corrente: restituisce un messaggio se manca qualcosa
function wizardProblem(w) {
  if (w.step === 0 && !w.name.trim()) return 'Dai un nome al personaggio';
  if (w.step === 2) {
    if (w.method === 'standard' && new Set(Object.values(w.assign)).size !== 6) return 'Usa ogni valore della serie una sola volta';
    if (w.method === 'point' && pointBuySpent(w) > 27) return 'Hai speso più di 27 punti';
    if (w.method === 'roll' && (w.rolled.length !== 6 || new Set(Object.values(w.rollAssign)).size !== 6 || Object.keys(w.rollAssign).length !== 6)) return 'Tira i dadi e assegna ogni risultato a una caratteristica';
    const free = SRD_RACES[w.race].freeBonus || 0;
    if (free && w.freeBonus.length !== free) return `Scegli ${free} caratteristiche per il +1 del Mezzelfo`;
  }
  if (w.step === 3) {
    const need = SRD_CLASSES[w.cls].skills.n;
    if (w.classSkills.length !== need) return `Scegli ${need} abilità della classe`;
    const free = SRD_RACES[w.race].freeSkills || 0;
    if (free && w.freeSkills.length !== free) return `Scegli ${free} abilità libere del Mezzelfo`;
  }
  return '';
}

function pointBuySpent(w) {
  return ABILITY_KEYS.reduce((s, k) => s + POINT_BUY_COST[w.points[k]], 0);
}

function choiceCard(name, value, checked, title, body) {
  return `<label class="card-surface2 p-2.5 flex gap-2 cursor-pointer border-2 ${checked ? 'border-[var(--brass)]' : 'border-transparent'}">
    <input type="radio" name="${name}" value="${escapeHtml(value)}" class="mt-0.5 accent-[var(--felt)]" ${checked ? 'checked' : ''} />
    <span class="min-w-0"><strong class="font-serif-title text-sm block">${escapeHtml(title)}</strong><span class="text-[11px] text-[var(--muted)]">${body}</span></span>
  </label>`;
}

function renderWizard() {
  const w = App.wiz;
  if (!w) return;
  setText('wizardStepLabel', `Passo ${w.step + 1} di ${WIZARD_STEPS.length}`);
  setText('wizardTitle', WIZARD_STEPS[w.step]);
  $('btnWizardBack').classList.toggle('invisible', w.step === 0);
  setText('btnWizardNext', w.step === WIZARD_STEPS.length - 1 ? '⚔️ Crea il personaggio' : 'Avanti →');
  const body = $('wizardBody');
  const scores = wizardFinalScores(w);

  if (w.step === 0) {
    body.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label class="sm:col-span-2 font-bold text-[var(--muted)]">Nome
          <input id="wizName" type="text" class="input-field w-full font-serif-title font-bold text-base mt-1" value="${escapeHtml(w.name)}" placeholder="Es. Thorin Scudodiquercia" /></label>
        <label class="font-bold text-[var(--muted)]">Livello
          <select id="wizLevel" class="input-field w-full mt-1">${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}" ${w.level === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      </div>
      <div class="font-bold text-[var(--muted)]">Razza</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${Object.entries(SRD_RACES).map(([n, r]) =>
        choiceCard('wizRace', n, w.race === n, n, `${Object.entries(r.bonus).map(([k, v]) => `${k} +${v}`).join(', ')}${r.freeBonus ? `, +1 a ${r.freeBonus} a scelta` : ''} · velocità ${String(r.speed).replace('.', ',')} m<br>${escapeHtml(r.traits)}`)).join('')}</div>`;
  } else if (w.step === 1) {
    body.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${Object.entries(SRD_CLASSES).map(([n, c]) =>
      choiceCard('wizClass', n, w.cls === n, n, `Dado vita d${c.die} · TS ${c.saves.join(', ')}${c.casting ? ` · incantesimi (${c.casting.ability})` : ''}<br>${escapeHtml(c.features)}`)).join('')}</div>`;
  } else if (w.step === 2) {
    const race = SRD_RACES[w.race];
    const methods = [['standard', 'Serie standard'], ['point', 'Acquisto a punti (27)'], ['roll', 'Tira 4d6']];
    let editor = '';
    if (w.method === 'standard') {
      editor = ABILITY_KEYS.map(k => `<select class="input-field text-center font-bold wiz-assign" data-ab="${k}">${STANDARD_ARRAY.map(v => `<option value="${v}" ${w.assign[k] === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`);
    } else if (w.method === 'point') {
      editor = ABILITY_KEYS.map(k => `<div class="flex items-center justify-center gap-1"><button type="button" class="btn text-xs py-0 px-1.5 wiz-point" data-ab="${k}" data-d="-1">−</button><strong class="w-6 text-center">${w.points[k]}</strong><button type="button" class="btn text-xs py-0 px-1.5 wiz-point" data-ab="${k}" data-d="1">+</button></div>`);
    } else {
      editor = ABILITY_KEYS.map(k => `<select class="input-field text-center font-bold wiz-roll-assign" data-ab="${k}"><option value="">—</option>${w.rolled.map((v, i) => `<option value="${i}" ${w.rollAssign[k] === i ? 'selected' : ''}>${v}</option>`).join('')}</select>`);
    }
    body.innerHTML = `
      <div class="flex flex-wrap gap-1.5">${methods.map(([m, l]) => `<button type="button" class="btn text-xs wiz-method ${w.method === m ? 'btn-felt' : ''}" data-m="${m}">${l}</button>`).join('')}</div>
      ${w.method === 'point' ? `<div class="text-[11px] font-bold ${pointBuySpent(w) > 27 ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}">Punti spesi: ${pointBuySpent(w)} di 27 (ogni caratteristica da 8 a 15)</div>` : ''}
      ${w.method === 'roll' ? `<div class="flex items-center gap-2"><button type="button" class="btn btn-brass text-xs wiz-roll">🎲 Tira 4d6 (tieni i 3 più alti) ×6</button><span class="text-[11px] text-[var(--muted)]">${w.rolled.length ? `Risultati: ${w.rolled.join(', ')}` : ''}</span></div>` : ''}
      ${w.method === 'standard' ? '<div class="text-[11px] text-[var(--muted)]">Assegna 15, 14, 13, 12, 10 e 8: ogni valore una volta. Partono già messi come conviene alla classe scelta.</div>' : ''}
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        ${ABILITY_KEYS.map((k, i) => `<div class="card-surface2 p-2 flex flex-col gap-1">
          <span class="font-bold text-[var(--muted)]">${k}</span>${editor[i]}
          <span class="text-[11px]">${race.bonus[k] || w.freeBonus.includes(k) ? `razza +${(race.bonus[k] || 0) + (w.freeBonus.includes(k) ? 1 : 0)} → ` : ''}<strong>${scores[k]}</strong> (${formatSignedMod(getAbilityMod(scores[k]))})</span>
        </div>`).join('')}
      </div>
      ${race.freeBonus ? `<div><div class="font-bold text-[var(--muted)] mb-1">Mezzelfo: +1 a due caratteristiche (non CAR)</div><div class="flex flex-wrap gap-1.5">${ABILITY_KEYS.filter(k => k !== 'CAR').map(k => `<label class="condition-btn ${w.freeBonus.includes(k) ? 'active' : ''} cursor-pointer"><input type="checkbox" class="hidden wiz-free-bonus" data-ab="${k}" ${w.freeBonus.includes(k) ? 'checked' : ''}/>${k}</label>`).join('')}</div></div>` : ''}`;
  } else if (w.step === 3) {
    const cls = SRD_CLASSES[w.cls];
    const fixed = wizardFixedSkills(w);
    const race = SRD_RACES[w.race];
    body.innerHTML = `
      <label class="font-bold text-[var(--muted)]">Background (dà 2 abilità)
        <select id="wizBackground" class="input-field w-full mt-1">${Object.entries(SRD_BACKGROUNDS).map(([n, s]) => `<option value="${escapeHtml(n)}" ${w.background === n ? 'selected' : ''}>${escapeHtml(n)} (${escapeHtml(s.join(', '))})</option>`).join('')}</select></label>
      <div class="text-[11px] text-[var(--muted)]">Già competente in: <strong>${escapeHtml(fixed.join(', ') || '—')}</strong></div>
      <div><div class="font-bold text-[var(--muted)] mb-1">Abilità del ${escapeHtml(w.cls)}: scegline ${cls.skills.n} (${w.classSkills.length}/${cls.skills.n})</div>
        <div class="flex flex-wrap gap-1.5">${cls.skills.from.filter(s => !fixed.includes(s)).map(s => `<label class="condition-btn ${w.classSkills.includes(s) ? 'active' : ''} cursor-pointer"><input type="checkbox" class="hidden wiz-class-skill" data-skill="${escapeHtml(s)}" ${w.classSkills.includes(s) ? 'checked' : ''}/>${escapeHtml(s)}</label>`).join('')}</div></div>
      ${race.freeSkills ? `<div><div class="font-bold text-[var(--muted)] mb-1">Mezzelfo: ${race.freeSkills} abilità a scelta (${w.freeSkills.length}/${race.freeSkills})</div>
        <div class="flex flex-wrap gap-1.5">${ALL_SKILL_KEYS.filter(s => !fixed.includes(s) && !w.classSkills.includes(s)).map(s => `<label class="condition-btn ${w.freeSkills.includes(s) ? 'active' : ''} cursor-pointer"><input type="checkbox" class="hidden wiz-free-skill" data-skill="${escapeHtml(s)}" ${w.freeSkills.includes(s) ? 'checked' : ''}/>${escapeHtml(s)}</label>`).join('')}</div></div>` : ''}`;
  } else {
    const cls = SRD_CLASSES[w.cls];
    const slots = classSpellSlots(w.cls, w.level, campaignRules(w.campId)).map((n, i) => n ? `${i + 1}°: ${n}` : '').filter(Boolean).join(' · ');
    const skills = [...wizardFixedSkills(w), ...w.classSkills, ...w.freeSkills];
    body.innerHTML = `
      <div class="card-surface2 p-3 flex flex-col gap-1.5">
        <div class="font-serif-title font-bold text-lg">${escapeHtml(w.name)}</div>
        <div>${escapeHtml(w.race)} · ${escapeHtml(w.cls)} di ${w.level}° livello · ${escapeHtml(w.background)}</div>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">${ABILITY_KEYS.map(k => `<div class="card-surface p-1"><div class="text-[10px] text-[var(--muted)]">${k}</div><strong>${scores[k]}</strong> <span class="text-[10px]">(${formatSignedMod(getAbilityMod(scores[k]))})</span></div>`).join('')}</div>
        <div><strong>PF</strong> ${wizardHp(w, scores)} · <strong>CA</strong> ${wizardAc(w, scores)} (senza armatura: aggiornala se ne indossi una) · <strong>Velocità</strong> ${String(SRD_RACES[w.race].speed).replace('.', ',')} m · <strong>Dado vita</strong> d${cls.die}</div>
        <div><strong>Tiri salvezza:</strong> ${cls.saves.join(', ')}</div>
        <div><strong>Abilità:</strong> ${escapeHtml(skills.join(', '))}</div>
        ${slots ? `<div><strong>Slot incantesimo:</strong> ${slots} · aggiungi gli incantesimi dalla scheda (“📖 Incantesimi”)</div>` : ''}
        <div><strong>Armi:</strong> ${escapeHtml(wizardWeaponsText(w, scores))} <span class="text-[var(--muted)]">(altre le aggiungi dalla scheda)</span></div>
      </div>`;
  }
  const problem = wizardProblem(w);
  setText('wizardProblem', problem);
}

function readWizardStepInputs() {
  const w = App.wiz;
  if (!w) return;
  if (w.step === 0) {
    w.name = $('wizName')?.value || '';
    w.level = clampInt($('wizLevel')?.value, 1, 20, 1);
  }
  if (w.step === 3 && $('wizBackground')) w.background = $('wizBackground').value;
}

async function finishCharWizard() {
  const w = App.wiz;
  const scores = wizardFinalScores(w);
  const cls = SRD_CLASSES[w.cls];
  const race = SRD_RACES[w.race];
  const skillsProf = {};
  [...wizardFixedSkills(w), ...w.classSkills, ...w.freeSkills].forEach(s => { skillsProf[s] = 1; });
  const savingThrowsProf = {};
  cls.saves.forEach(s => { savingThrowsProf[s] = true; });
  const slots = classSpellSlots(w.cls, w.level, campaignRules(w.campId));
  const spellSlots = {};
  slots.forEach((n, i) => { spellSlots[i + 1] = { max: n, used: 0 }; });
  const maxHp = wizardHp(w, scores);
  const fields = {
    name: w.name.trim(), race: w.race, className: w.cls, level: w.level, background: w.background, bonusAction: cls.bonus,
    maxHp, hp: maxHp, ac: wizardAc(w, scores), speed: race.speed, hitDie: `d${cls.die}`, hitDiceRemaining: w.level,
    abilities: scores, savingThrowsProf, skillsProf, spellSlots, spellAbility: cls.casting?.ability || null,
    weapons: cls.weapons.map(k => ({ k })),
    featuresText: `${w.race}: ${race.traits}\n${w.cls}: ${cls.features}`
  };
  closeCharWizard();
  await addNewCharacter(w.purpose, w.campId, fields);
}

// Crea il personaggio (creazione guidata o scheda importata): al primo ingresso si entra con lui
async function addNewCharacter(purpose, campId, fields) {
  if (purpose === 'onboarding') {
    if (!(await ensureCampaignLoaded(campId))) return;
    if (App.dmUnlocked) lockDm();
    const ch = createCharacter(fields);
    await enterAsPlayer(campId, ch.id);
    return;
  }
  const dm = isDM();
  const ch = createCharacter(fields, { own: !dm });
  if (!dm && !App.myCharId) {
    App.myCharId = ch.id;
    Prefs.set(`iltavolo_mychar_${App.activeId}`, ch.id);
  }
  App.sheetCharId = ch.id;
  switchTab('personaggio');
  showToast(`⚔️ ${ch.name} è pronto all'avventura!`);
}

function onWizardInput(e) {
  const w = App.wiz;
  if (!w) return;
  const t = e.target;
  if (t.name === 'wizRace') { w.race = t.value; w.freeBonus = []; w.freeSkills = []; w.classSkills = []; }
  if (t.name === 'wizClass') {
    w.cls = t.value;
    w.classSkills = [];
    if (!w.assignTouched) w.assign = suggestedAssign(w.cls);
  }
  if (t.classList.contains('wiz-assign')) {
    // Scambia i valori per tenere la serie sempre completa
    const ab = t.dataset.ab;
    const v = parseInt(t.value, 10);
    w.assignTouched = true;
    const other = ABILITY_KEYS.find(k => k !== ab && w.assign[k] === v);
    if (other) w.assign[other] = w.assign[ab];
    w.assign[ab] = v;
  }
  if (t.classList.contains('wiz-roll-assign')) {
    const ab = t.dataset.ab;
    if (t.value === '') delete w.rollAssign[ab];
    else {
      const idx = parseInt(t.value, 10);
      ABILITY_KEYS.forEach(k => { if (k !== ab && w.rollAssign[k] === idx) delete w.rollAssign[k]; });
      w.rollAssign[ab] = idx;
    }
  }
  const toggle = (list, value, max) => {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else if (list.length < max) list.push(value);
  };
  if (t.classList.contains('wiz-free-bonus')) toggle(w.freeBonus, t.dataset.ab, SRD_RACES[w.race].freeBonus || 0);
  if (t.classList.contains('wiz-class-skill')) toggle(w.classSkills, t.dataset.skill, SRD_CLASSES[w.cls].skills.n);
  if (t.classList.contains('wiz-free-skill')) toggle(w.freeSkills, t.dataset.skill, SRD_RACES[w.race].freeSkills || 0);
  if (t.id === 'wizBackground') { w.background = t.value; w.classSkills = w.classSkills.filter(s => !wizardFixedSkills(w).includes(s)); }
  if (['wizName', 'wizLevel'].includes(t.id)) { readWizardStepInputs(); setText('wizardProblem', wizardProblem(w)); return; }
  renderWizard();
}

function onWizardClick(e) {
  const w = App.wiz;
  if (!w) return;
  const m = e.target.closest('.wiz-method');
  if (m) { w.method = m.dataset.m; renderWizard(); return; }
  const p = e.target.closest('.wiz-point');
  if (p) {
    const ab = p.dataset.ab;
    const next = Math.max(8, Math.min(15, w.points[ab] + parseInt(p.dataset.d, 10)));
    w.points[ab] = next;
    renderWizard();
    return;
  }
  if (e.target.closest('.wiz-roll')) {
    w.rolled = Array.from({ length: 6 }, () => {
      const dice = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => b - a);
      return dice[0] + dice[1] + dice[2];
    });
    w.rollAssign = {};
    renderWizard();
  }
}

function initWizardEvents() {
  $('btnCloseWizard').addEventListener('click', closeCharWizard);
  $('wizardBody').addEventListener('change', onWizardInput);
  $('wizardBody').addEventListener('input', (e) => { if (e.target.id === 'wizName') onWizardInput(e); });
  $('wizardBody').addEventListener('click', onWizardClick);
  $('btnWizardBack').addEventListener('click', () => { readWizardStepInputs(); if (App.wiz.step > 0) { App.wiz.step -= 1; renderWizard(); } });
  $('btnWizardNext').addEventListener('click', () => {
    readWizardStepInputs();
    const problem = wizardProblem(App.wiz);
    if (problem) { setText('wizardProblem', problem); showToast(problem); return; }
    if (App.wiz.step === WIZARD_STEPS.length - 1) { finishCharWizard(); return; }
    App.wiz.step += 1;
    renderWizard();
  });
  $('btnOnbWizard').addEventListener('click', () => openCharWizard('onboarding', App.onboardingCampId));
  $('btnSheetWizard').addEventListener('click', () => { if (App.activeId) openCharWizard('sheet', App.activeId); });
}
