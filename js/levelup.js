// Passaggio di livello guidato, dal 2° al 20°: per classe e razza dice cosa si ottiene, propone le scelte
// spiegando le opzioni (sottoclasse, aumenti o talento, stili, suppliche, incantesimi…) e alla fine aggiorna la scheda.
// Le scelte fatte restano in ch.classPicks; per i personaggi creati prima si recuperano al primo passaggio.

const LEVELUP_STEP_TITLES = {
  overview: 'Cosa cambia', subclass: 'Sottoclasse', hp: 'Punti ferita', asi: 'Aumento o talento',
  choices: 'Scelte di classe', spells: 'Incantesimi', summary: 'Riepilogo'
};
const OTHER_SUBCLASS = '__altra';

function openLevelUp() {
  const ch = currentSheetChar();
  if (!ch || !canEditChar(ch) || ch.level >= 20) return;
  App.levelUp = {
    charId: ch.id, step: 'overview', hpMode: 'avg', rolled: null,
    subclass: '', subclassOther: '', asiMode: 'asi', asi: ['', ''], feat: '',
    picks: {}, spells: {}, search: {}, swapOut: ''
  };
  showEl('modalLevelUp', true);
  renderLevelUp();
  if (SRD_CLASSES[ch.className]?.casting) loadSrd('spells').then(renderLevelUp).catch(() => {});
}

// "dello stregone", "del mago"; "la tua tradizione arcana", "il tuo dominio divino"
function ofClass(cls) {
  return `${cls === 'Stregone' ? 'dello' : 'del'} ${cls.toLowerCase()}`;
}

function subclassWithPossessive(sub, person = 2) {
  const [m, f] = person === 2 ? ['il tuo', 'la tua'] : ['il suo', 'la sua'];
  return `${sub.fem ? f : m} ${sub.title.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Il piano del livello: cosa si ottiene e cosa si sceglie
// ---------------------------------------------------------------------------

function luSubclassName(ch, lu) {
  if (ch.subclass) return ch.subclass;
  if (lu.subclass === OTHER_SUBCLASS) return lu.subclassOther.trim();
  return lu.subclass;
}

function luSubclassData(ch, lu) {
  return CLASS_PROGRESSION[ch.className]?.subclasses?.[luSubclassName(ch, lu)] || null;
}

// La sottoclasse viene scelta adesso (anche se toccava a un livello precedente)
function luSubclassIsNew(ch) {
  return !ch.subclass;
}

function needsSubclass(ch, next) {
  const prog = CLASS_PROGRESSION[ch.className];
  return Boolean(prog && !ch.subclass && next >= prog.sub.level);
}

function countUpTo(levels, lv) {
  return Object.entries(levels).reduce((s, [from, n]) => s + (lv >= Number(from) ? n : 0), 0);
}

function knowsSpell(ch, lu, englishName) {
  if (!SRD.spells) return false;
  const sp = SRD.spells.find(s => s.e === englishName);
  if (!sp) return false;
  return ch.spells.some(s => Number(s.i) === sp.i) || Object.values(lu.spells).some(list => list.includes(sp.i));
}

function proficientSkills(ch, lu) {
  const extra = lu.picks.loreSkills || [];
  return ALL_SKILL_KEYS.filter(k => (Number(ch.skillsProf[k] === true ? 1 : ch.skillsProf[k]) || 0) >= 1 || extra.includes(k));
}

function expertSkillCount(ch) {
  return ALL_SKILL_KEYS.filter(k => Number(ch.skillsProf[k]) === 2).length;
}

// Le scelte di classe da fare a questo livello. Ognuna: quante ne servono in tutto fino a `next`, meno quelle già fatte.
function classChoices(ch, lu, next) {
  const cls = ch.className;
  const sub = luSubclassName(ch, lu);
  const picks = ch.classPicks || {};
  const out = [];
  const add = (id, title, help, levels, options, opts = {}) => {
    const done = opts.done !== undefined ? opts.done : (picks[id] || []).length;
    const need = countUpTo(levels, next) - done;
    if (need <= 0) return;
    const taken = picks[id] || [];
    const list = Object.entries(options).filter(([k]) => !taken.includes(k)).map(([k, d]) => ({ k, d }));
    out.push({ id, title, help, need: Math.min(need, list.length), catchUp: countUpTo(levels, ch.level) > done, options: list, chips: opts.chips });
  };
  const styles = (keys) => Object.fromEntries(keys.map(k => [k, FIGHTING_STYLES[k]]));
  if (cls === 'Guerriero') add('fightingStyle', 'Stile di combattimento', 'Un modo di combattere in cui sei specializzato. Non puoi prendere due volte lo stesso.',
    sub === 'Campione' ? { 1: 1, 10: 1 } : { 1: 1 }, FIGHTING_STYLES);
  if (cls === 'Paladino') add('fightingStyle', 'Stile di combattimento', 'Un modo di combattere in cui sei specializzato.', { 2: 1 },
    styles(['Difesa', 'Duellare', 'Combattere con armi possenti', 'Protezione']));
  if (cls === 'Ranger') {
    add('fightingStyle', 'Stile di combattimento', 'Un modo di combattere in cui sei specializzato.', { 2: 1 }, styles(['Tiro', 'Difesa', 'Duellare', 'Combattere con due armi']));
    add('favoredEnemy', 'Nemico prescelto', 'Il tipo di creature che hai studiato e cacciato: vantaggio per seguirne le tracce e ricordare cosa sai di loro, e una loro lingua.',
      { 1: 1, 6: 1, 14: 1 }, Object.fromEntries(FAVORED_ENEMIES.map(k => [k, ''])), { chips: true });
    add('terrain', 'Terreno prescelto', 'Il territorio che conosci meglio: competenza doppia nelle prove che lo riguardano e viaggi più sicuri.',
      { 1: 1, 6: 1, 10: 1 }, Object.fromEntries(TERRAINS.map(k => [k, ''])), { chips: true });
    if (sub === 'Cacciatore') {
      Object.entries(HUNTER_CHOICES).forEach(([id, c]) => add(id, c.title, `Privilegio del Cacciatore al ${c.level}° livello: scegline una.`, { [c.level]: 1 }, c.options));
    }
  }
  if (cls === 'Bardo' && sub === 'Collegio della Sapienza') {
    const skills = ALL_SKILL_KEYS.filter(k => !(Number(ch.skillsProf[k] === true ? 1 : ch.skillsProf[k]) >= 1));
    add('loreSkills', 'Competenze bonus', 'Collegio della Sapienza: diventi competente in tre abilità a scelta (poi puoi usarle anche per la Maestria).', { 3: 3 }, Object.fromEntries(skills.map(k => [k, ''])), { chips: true });
  }
  if (cls === 'Ladro' || cls === 'Bardo') {
    const levels = cls === 'Ladro' ? { 1: 2, 6: 2 } : { 3: 2, 10: 2 };
    const taken = picks.expertise || [];
    const skills = proficientSkills(ch, lu).filter(k => Number(ch.skillsProf[k]) !== 2);
    const options = Object.fromEntries(skills.map(k => [k, '']));
    if (cls === 'Ladro' && !taken.includes('Arnesi da scasso')) options['Arnesi da scasso'] = '';
    add('expertise', 'Maestria', 'Raddoppi il bonus di competenza in queste abilità (solo tra quelle in cui sei già competente).',
      levels, options, { chips: true, done: Math.max(taken.length, expertSkillCount(ch)) });
  }
  if (cls === 'Druido' && sub === 'Circolo della Terra') {
    add('land', 'Terra del circolo', 'Il territorio in cui sei diventato druido: decide gli incantesimi del circolo, sempre preparati al 3°, 5°, 7° e 9° livello.', { 2: 1 },
      Object.fromEntries(Object.entries(LAND_CIRCLE_SPELLS).map(([k, byLv]) => [k, `Incantesimi: ${Object.values(byLv).flat().map(spellLabelByEnglish).join(', ')}.`])));
  }
  if (cls === 'Stregone') {
    add('metamagic', 'Metamagia', 'Modi di piegare i tuoi incantesimi spendendo punti stregoneria.', { 3: 2, 10: 1, 17: 1 }, METAMAGIC);
    if (sub === 'Discendenza draconica') {
      add('ancestry', 'Antenato draconico', 'Il drago da cui discendi: decide il tipo di danno di Affinità elementale.', { 1: 1 },
        Object.fromEntries(Object.entries(DRACONIC_ANCESTRY).map(([k, t]) => [k, `Danni da ${t}.`])));
    }
  }
  if (cls === 'Warlock') {
    add('pactBoon', 'Dono del patto', 'Il dono che il patrono ti concede.', { 3: 1 }, PACT_BOONS);
    const boon = (picks.pactBoon || [])[0] || (lu.picks.pactBoon || [])[0] || '';
    const eb = knowsSpell(ch, lu, 'Eldritch Blast');
    const options = {};
    Object.entries(INVOCATIONS).forEach(([k, inv]) => {
      if ((inv.lv && next < inv.lv) || (inv.pact && inv.pact !== boon) || (inv.eb && !eb)) return;
      options[k] = inv.d;
    });
    add('invocations', 'Suppliche occulte', `Poteri magici permanenti. Si vedono solo quelle che puoi prendere ora (livello, dono del patto${eb ? '' : ', e quelle su Deflagrazione occulta solo se la conosci'}).`,
      { 2: 2, 5: 1, 7: 1, 9: 1, 12: 1, 15: 1, 18: 1 }, options);
  }
  return out;
}

function spellLabelByEnglish(e) {
  const sp = SRD.spells?.find(s => s.e === e);
  return sp ? sp.n : e;
}

// Livello di incantesimo più alto che si può scegliere al livello `lv` (per il Warlock quello degli slot del patto)
function maxSpellLevelAt(cls, lv) {
  const slots = classSpellSlots(cls, lv);
  if (SRD_CLASSES[cls]?.casting?.type === 'pact') return slots.findIndex(n => n > 0) + 1;
  for (let i = 8; i >= 0; i--) if (slots[i] > 0) return i + 1;
  return 0;
}

// Gli incantesimi da scegliere a questo livello, divisi per gruppo
function spellGroups(ch, lu, next) {
  const cls = ch.className;
  if (!SRD_CLASSES[cls]?.casting) return [];
  const sub = luSubclassData(ch, lu);
  const subName = luSubclassName(ch, lu);
  const extra = sub?.extraSpells || [];
  const fromClass = sp => sp.cl.includes(cls) || extra.includes(sp.e);
  const maxLv = maxSpellLevelAt(cls, next);
  const groups = [];
  const at = (table) => (table ? (table[next - 1] || 0) - (table[ch.level - 1] || 0) : 0);

  const landCantrip = cls === 'Druido' && subName === 'Circolo della Terra' && luSubclassIsNew(ch) ? 1 : 0;
  const cantrips = at(CANTRIPS_KNOWN[cls]) + landCantrip;
  if (cantrips > 0) groups.push({ id: 'cantrips', title: 'Trucchetti nuovi', help: 'Incantesimi minori che lanci quando vuoi, senza slot.', count: cantrips, filter: sp => sp.lv === 0 && fromClass(sp) });

  // Con le regole 2024 anche bardo, stregone, warlock e ranger seguono la tabella dei preparati della classe
  const knownTable = SPELLS_KNOWN[cls] && campaignRules() === '2024' ? SPELLS_PREPARED_2024[cls] : SPELLS_KNOWN[cls];
  if (knownTable) {
    const n = at(knownTable);
    if (cls === 'Bardo' && [10, 14, 18].includes(next)) {
      groups.push({ id: 'secrets', title: 'Segreti magici', help: `Incantesimi di qualsiasi classe, fino al ${maxLv}° livello (anche trucchetti): contano come incantesimi da bardo.`, count: n, filter: sp => sp.lv <= maxLv });
    } else if (n > 0) {
      groups.push({ id: 'known', title: 'Incantesimi nuovi', help: `Dalla lista ${cls === 'Warlock' && extra.length ? 'del warlock e del tuo patrono' : ofClass(cls)}, fino al ${maxLv}° livello.`, count: n, filter: sp => sp.lv >= 1 && sp.lv <= maxLv && fromClass(sp) });
    }
    if (lu.swapOut) groups.push({ id: 'swap', title: 'Al posto di quello che dimentichi', help: `Uno dalla tua lista, fino al ${maxLv}° livello.`, count: 1, filter: sp => sp.lv >= 1 && sp.lv <= maxLv && fromClass(sp) });
  }
  if (cls === 'Mago') groups.push({ id: 'book', title: 'Due incantesimi nel libro', help: `A ogni livello il mago scrive gratis due incantesimi da mago nel libro, fino al ${maxLv}° livello. Poi scegli quali preparare dalla scheda.`, count: 2, filter: sp => sp.lv >= 1 && sp.lv <= maxLv && fromClass(sp) });
  if (cls === 'Warlock' && MYSTIC_ARCANUM[next]) {
    const lv = MYSTIC_ARCANUM[next];
    groups.push({ id: 'arcanum', title: `Arcanum mistico (${lv}°)`, help: `Un incantesimo da warlock di ${lv}° livello: lo lanci una volta per riposo lungo (nella scheda ha uno slot di ${lv}° tutto suo).`, count: 1, filter: sp => sp.lv === lv && fromClass(sp) });
  }
  if (cls === 'Bardo' && subName === 'Collegio della Sapienza' && (next === 6 || (luSubclassIsNew(ch) && next > 6))) {
    groups.push({ id: 'loreSecrets', title: 'Segreti magici aggiuntivi', help: `Due incantesimi di qualsiasi classe fino al ${maxLv}° livello (anche trucchetti), oltre a quelli che conosci.`, count: 2, filter: sp => sp.lv <= maxLv });
  }
  if ((lu.picks.pactBoon || []).includes('Patto del tomo')) {
    groups.push({ id: 'tome', title: 'Libro delle ombre', help: 'Tre trucchetti di qualsiasi classe.', count: 3, filter: sp => sp.lv === 0 });
  }
  if ((lu.picks.invocations || []).includes('Libro dei segreti antichi')) {
    groups.push({ id: 'ritualBook', title: 'Libro dei segreti antichi', help: 'Due rituali di 1° livello di qualsiasi classe: li lanci solo come rituali.', count: 2, filter: sp => sp.lv === 1 && sp.rit });
  }
  if (['Chierico', 'Druido', 'Paladino'].includes(cls) && maxLv > 0) {
    groups.push({ id: 'prepared', optional: true, title: 'Incantesimi da preparare (facoltativo)', help: `Conosci già tutta la lista: aggiungi alla scheda quelli che vuoi usare, fino al ${maxLv}° livello. Restano preparati finché c'è posto.`, count: 0, filter: sp => sp.lv >= 1 && sp.lv <= maxLv && fromClass(sp) });
  }
  return groups;
}

// Incantesimi sempre preparati della sottoclasse (dominio, giuramento, circolo) fino a questo livello
function autoSpells(ch, lu, next) {
  if (!SRD.spells) return [];
  const sub = luSubclassData(ch, lu);
  let byLevel = sub?.spells || null;
  if (ch.className === 'Druido' && luSubclassName(ch, lu) === 'Circolo della Terra') {
    const land = (ch.classPicks?.land || [])[0] || (lu.picks.land || [])[0];
    byLevel = land ? LAND_CIRCLE_SPELLS[land] : null;
  }
  if (!byLevel) return [];
  const names = Object.entries(byLevel).filter(([lv]) => next >= Number(lv)).flatMap(([, list]) => list);
  return [...new Set(names)].map(e => SRD.spells.find(s => s.e === e)).filter(Boolean)
    .filter(sp => !ch.spells.some(s => Number(s.i) === sp.i && s.always));
}

// from: il livello a cui spettava, se arriva in ritardo (sottoclasse scelta adesso)
function luFeature(name, desc, tag, from = null) {
  return { n: name, d: desc, tag, from };
}

// I privilegi che si ottengono: classe, sottoclasse (anche quelli arretrati se la si sceglie ora), razza
function featuresGained(ch, lu, next) {
  const prog = CLASS_PROGRESSION[ch.className];
  const out = [];
  if (!prog) return out;
  (prog.features[next] || []).forEach(([n, d]) => out.push(luFeature(n, d, ch.className)));
  const subName = luSubclassName(ch, lu);
  const sub = luSubclassData(ch, lu);
  const levels = luSubclassIsNew(ch) ? prog.sub.levels.filter(l => l <= next) : prog.sub.levels.filter(l => l === next);
  if (subName && sub) {
    Object.entries(sub.features).filter(([l]) => (luSubclassIsNew(ch) ? Number(l) <= next : Number(l) === next))
      .forEach(([l, list]) => list.forEach(([n, d]) => out.push(luFeature(n, d, `${subName}${Number(l) < next ? ` (${l}° livello)` : ''}`, Number(l) < next ? Number(l) : null))));
  } else if (subName) {
    levels.forEach(l => out.push(luFeature(`Privilegio di ${subName}`, 'Controlla sul manuale cosa ottieni a questo livello e scrivilo nei Privilegi della scheda.', `${subName}${l < next ? ` (${l}° livello)` : ''}`, l < next ? l : null)));
  }
  RACE_PROGRESSION.forEach(r => { if (r.re.test(ch.race) && r.levels[next]) out.push(luFeature('Tratto razziale', r.levels[next], ch.race)); });
  return out;
}

function resourceChanges(ch, next) {
  const res = CLASS_PROGRESSION[ch.className]?.res;
  if (!res) return [];
  const before = res(ch.level);
  return res(next).map(([label, value], i) => ({ label, before: before[i][1], after: value })).filter(r => String(r.before) !== String(r.after));
}

function levelUpSteps(ch, lu) {
  const next = ch.level + 1;
  const steps = ['overview'];
  if (needsSubclass(ch, next)) steps.push('subclass');
  steps.push('hp');
  if (classAsiLevels(ch.className).includes(next)) steps.push('asi');
  if (classChoices(ch, lu, next).length) steps.push('choices');
  const canSwap = SPELLS_KNOWN[ch.className] && ch.spells.some(s => (SRD.spells ? srdSpell(Number(s.i))?.lv > 0 : true));
  if (spellGroups(ch, lu, next).length || autoSpells(ch, lu, next).length || canSwap) steps.push('spells');
  steps.push('summary');
  return steps;
}

// ---------------------------------------------------------------------------
// Punti ferita e caratteristiche
// ---------------------------------------------------------------------------

function raisedScore(score, n, max = 20) {
  return n ? Math.max(score, Math.min(max, score + n)) : score;
}

function luAsiPicks(lu, ch) {
  return classAsiLevels(ch.className).includes(ch.level + 1) && lu.asiMode === 'asi' ? lu.asi.filter(Boolean) : [];
}

// Le caratteristiche dopo il livello: aumenti scelti e Campione primordiale del barbaro al 20°
function luNewAbilities(ch, lu) {
  const out = Object.assign({}, ch.abilities);
  const picks = luAsiPicks(lu, ch);
  ABILITY_KEYS.forEach(k => { out[k] = raisedScore(out[k], picks.filter(p => p === k).length); });
  if (ch.className === 'Barbaro' && ch.level + 1 === 20) ['FOR', 'COS'].forEach(k => { out[k] = raisedScore(out[k], 4, 24); });
  return out;
}

// PF del nuovo livello. Se sale il modificatore di Costituzione vale anche per i livelli già fatti (+1 PF per ognuno);
// lo stesso per la Resilienza draconica se la discendenza si sceglie adesso.
function levelUpHp(ch, lu) {
  const die = parseInt(ch.hitDie.slice(1), 10) || 8;
  const oldMod = getAbilityMod(ch.abilities.COS);
  const newMod = getAbilityMod(luNewAbilities(ch, lu).COS);
  const dwarf = /nano/i.test(ch.race) ? 1 : 0;
  const perLevel = luSubclassData(ch, lu)?.hpPerLevel || 0;
  const base = lu.hpMode === 'roll' && lu.rolled ? lu.rolled : Math.floor(die / 2) + 1;
  const level = Math.max(1, base + newMod + dwarf) + perLevel;
  const retro = (newMod - oldMod) * ch.level + (perLevel && luSubclassIsNew(ch) ? perLevel * ch.level : 0);
  return { level, retro, total: level + retro, die, dwarf, perLevel, conRetro: (newMod - oldMod) * ch.level };
}

function levelUpGain(ch, lu) {
  return levelUpHp(ch, lu).total;
}

const FINESSE_HINT = /arco|balestra|pugnale|stocco|spada corta|scimitarra|fionda|dard|frusta|senz'armi/i;

// Gli attacchi scritti con i numeri passano a FOR/DES quando i conti tornano, così da ora in poi si aggiornano da soli.
// Restituisce i nomi di quelli che non si riescono a collegare (armi magiche, stili di combattimento…).
function linkAttacksToAbilities(ch) {
  const prof = getProficiencyBonus(ch.level);
  const unlinked = [];
  ch.attacksText = String(ch.attacksText || '').split('\n').map(line => {
    const parts = line.split('|').map(p => p.trim());
    const raw = (parts[1] || '').replace(/\s/g, '');
    if (parts.length < 2 || !/^[+-]?\d+$/.test(raw)) return line;
    const bonus = parseInt(raw, 10);
    const fits = ['FOR', 'DES'].filter(ab => prof + getAbilityMod(ch.abilities[ab]) === bonus);
    if (!fits.length) { unlinked.push(parts[0] || 'Attacco'); return line; }
    const ab = fits.length > 1 && FINESSE_HINT.test(parts[0]) ? 'DES' : fits[0];
    const mod = getAbilityMod(ch.abilities[ab]);
    parts[1] = ab;
    const dmg = (parts[2] || '').replace(/\s/g, '');
    if (dmg && !mod && /^\d*d\d+$/i.test(dmg)) parts[2] = `${dmg}+${ab}`;
    else if (dmg && mod && dmg.endsWith(formatSignedMod(mod))) parts[2] = `${dmg.slice(0, -formatSignedMod(mod).length)}+${ab}`;
    return parts.join(' | ');
  }).join('\n');
  return unlinked;
}

// Gli slot seguono la tabella della classe e quelli aggiunti a mano restano.
// Il Warlock ha gli slot del patto tutti dello stesso livello, che sale: si spostano, compresi quelli già spesi.
function updateClassSlots(ch, before, after) {
  const from = before.findIndex(n => n > 0);
  const to = after.findIndex(n => n > 0);
  const moving = SRD_CLASSES[ch.className].casting.type === 'pact' && from >= 0 && to >= 0 && from !== to;
  const spent = moving ? Math.min(before[from], ch.spellSlots[from + 1].used) : 0;
  if (moving) ch.spellSlots[from + 1].used -= spent;
  after.forEach((n, i) => {
    const slot = ch.spellSlots[i + 1];
    slot.max = Math.min(9, Math.max(n, slot.max + n - before[i]));
    slot.used = Math.min(slot.used, slot.max);
  });
  if (moving) ch.spellSlots[to + 1].used = Math.min(ch.spellSlots[to + 1].max, ch.spellSlots[to + 1].used + spent);
}

function slotsText(slots) {
  return slots.map((n, i) => (n ? `${i + 1}°: ${n}` : '')).filter(Boolean).join(' · ') || 'nessuno';
}

// ---------------------------------------------------------------------------
// Controlli dei passi
// ---------------------------------------------------------------------------

function levelUpProblem(ch, lu, step) {
  const next = ch.level + 1;
  if (step === 'subclass') {
    if (!lu.subclass) return 'Scegli la sottoclasse';
    if (lu.subclass === OTHER_SUBCLASS && !lu.subclassOther.trim()) return 'Scrivi il nome della sottoclasse';
  }
  if (step === 'hp' && lu.hpMode === 'roll' && !lu.rolled) return 'Tira il dado vita oppure scegli il valore medio';
  if (step === 'asi') {
    if (lu.asiMode === 'feat') return lu.feat.trim() ? '' : 'Scrivi il nome del talento';
    if (lu.asi.some(k => !k)) return 'Scegli i due aumenti (+1 e +1, anche alla stessa caratteristica)';
    const over = ABILITY_KEYS.find(k => ch.abilities[k] + lu.asi.filter(p => p === k).length > 20);
    if (over) return `${over} non può superare 20`;
  }
  if (step === 'choices') {
    const missing = classChoices(ch, lu, next).find(c => (lu.picks[c.id] || []).length !== c.need);
    if (missing) return `${missing.title}: scegline ${missing.need}`;
  }
  if (step === 'spells') {
    if (!SRD.spells) return 'Carico gli incantesimi…';
    const missing = spellGroups(ch, lu, next).find(g => !g.optional && (lu.spells[g.id] || []).length !== Math.min(g.count, luSpellOptions(ch, lu, g).length));
    if (missing) return `${missing.title}: scegline ${missing.count}`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function luCard(title, body, extra = '') {
  return `<div class="card-surface2 p-3 flex flex-col gap-2 ${extra}"><div class="font-bold font-serif-title text-sm">${title}</div>${body}</div>`;
}

function luFeatureList(list) {
  return list.length
    ? `<ul class="flex flex-col gap-1.5">${list.map(f => `<li><strong>${escapeHtml(f.n)}</strong> <span class="text-[10px] text-[var(--muted)]">· ${escapeHtml(f.tag)}</span><br><span class="text-[var(--muted)]">${escapeHtml(f.d)}</span></li>`).join('')}</ul>`
    : '<div class="text-[var(--muted)] italic">Nessun privilegio nuovo a questo livello: crescono PF e, se tocca, il bonus di competenza.</div>';
}

function renderLevelUpOverview(ch, lu, next, steps) {
  const prog = CLASS_PROGRESSION[ch.className];
  const hp = levelUpHp(ch, Object.assign({}, lu, { hpMode: 'avg' }));
  const profNow = getProficiencyBonus(ch.level);
  const profNext = getProficiencyBonus(next);
  const slotsNow = classSpellSlots(ch.className, ch.level);
  const slotsNext = classSpellSlots(ch.className, next);
  const grows = [
    `<li>Punti ferita: +1d${hp.die} + COS (in media +${hp.total}) e un Dado Vita in più.</li>`,
    profNext !== profNow ? `<li>Bonus di competenza: ${formatSignedMod(profNow)} → <strong>${formatSignedMod(profNext)}</strong> (attacchi, TS, abilità e incantesimi si aggiornano da soli).</li>` : '',
    ...resourceChanges(ch, next).map(r => `<li>${escapeHtml(r.label)}: ${escapeHtml(String(r.before))} → <strong>${escapeHtml(String(r.after))}</strong></li>`),
    SRD_CLASSES[ch.className]?.casting && slotsNext.join() !== slotsNow.join() ? `<li>Slot incantesimo: ${slotsText(slotsNext)}</li>` : '',
    [5, 11, 17].includes(next) ? '<li>I danni dei trucchetti salgono (già calcolato nella scheda).</li>' : ''
  ].filter(Boolean).join('');
  const plan = [];
  if (steps.includes('subclass')) plan.push(subclassWithPossessive(prog.sub));
  if (steps.includes('asi')) plan.push('un aumento di caratteristica o un talento');
  classChoices(ch, lu, next).forEach(c => plan.push(`${c.title.toLowerCase()} (${c.need})`));
  spellGroups(ch, lu, next).filter(g => !g.optional).forEach(g => plan.push(`${g.title.toLowerCase()} (${g.count})`));
  const sub = luSubclassName(ch, lu);
  return `
    <div><div class="font-serif-title text-lg font-bold">${escapeHtml(ch.name)}: livello ${ch.level} → ${next}</div>
      <div class="text-[11px] text-[var(--muted)]">${escapeHtml(ch.className)}${sub ? ` · ${escapeHtml(sub)}` : ''} · ${escapeHtml(ch.race)}</div></div>
    ${prog ? '' : '<div class="card-surface2 p-3 text-[var(--brass)] font-bold">Questa classe non è nel regolamento base: la guida fa PF, aumenti e slot. I privilegi controllali sul manuale.</div>'}
    ${luCard('📜 Cosa ottieni', luFeatureList(featuresGained(ch, lu, next)))}
    ${luCard('📈 Cosa cresce', `<ul class="flex flex-col gap-1 lu-list">${grows}</ul>`)}
    ${plan.length ? luCard('✍️ Cosa sceglierai', `<div>Nei prossimi passi: ${escapeHtml(plan.join(', '))}. Ogni opzione è spiegata.</div>`) : ''}
    <div class="text-[11px] text-[var(--muted)]">La guida segue il regolamento base di D&amp;D 5e (2014), una classe sola: il multiclasse non è gestito.</div>`;
}

function renderLevelUpSubclass(ch, lu) {
  const prog = CLASS_PROGRESSION[ch.className];
  const late = ch.level + 1 > prog.sub.level;
  const cards = Object.entries(prog.subclasses).map(([name, s]) => choiceCard('luSub', name, lu.subclass === name, name,
    `${escapeHtml(s.d)}<br>${Object.entries(s.features).map(([l, list]) => `${l}°: ${list.map(f => f[0]).join(', ')}`).map(escapeHtml).join(' · ')}`)).join('');
  return `
    <div>${escapeHtml(ch.className === 'Stregone' ? 'Lo' : 'Il')} ${escapeHtml(ch.className.toLowerCase())} sceglie <strong>${escapeHtml(subclassWithPossessive(prog.sub, 3))}</strong> al ${prog.sub.level}° livello: dà privilegi al ${prog.sub.levels.join('°, ')}° livello.
      ${late ? '<br><span class="text-[var(--brass)]">Non risulta ancora scelto: sceglilo ora e la guida aggiunge anche quello che ti spettava ai livelli precedenti.</span>' : ''}</div>
    <div class="flex flex-col gap-2">${cards}
      ${choiceCard('luSub', OTHER_SUBCLASS, lu.subclass === OTHER_SUBCLASS, 'Un\'altra dal manuale', 'Il regolamento base ne descrive una sola per classe. Se usate il Manuale del giocatore scrivi il nome: ai livelli giusti la guida ti ricorderà di controllare i privilegi.')}
      ${lu.subclass === OTHER_SUBCLASS ? `<input id="luSubOther" type="text" class="input-field w-full" placeholder="Nome della sottoclasse" value="${escapeHtml(lu.subclassOther)}" />` : ''}
    </div>`;
}

function renderLevelUpHp(ch, lu) {
  const hp = levelUpHp(ch, lu);
  const avg = levelUpGain(ch, Object.assign({}, lu, { hpMode: 'avg' }));
  const notes = [
    `Ogni livello: 1d${hp.die} (o il valore medio, ${Math.floor(hp.die / 2) + 1}) + il modificatore di Costituzione, minimo 1.`,
    hp.dwarf ? 'Robustezza nanica: +1.' : '',
    hp.perLevel ? `Resilienza draconica: +${hp.perLevel}${luSubclassIsNew(ch) ? ` (e +${hp.perLevel * ch.level} per i livelli già fatti)` : ''}.` : '',
    hp.conRetro > 0 ? `Sale il modificatore di Costituzione: +${hp.conRetro} (1 PF per ogni livello già fatto).` : ''
  ].filter(Boolean);
  return `
    <label class="card-surface2 p-3 flex items-center gap-2 cursor-pointer"><input type="radio" name="luHp" value="avg" ${lu.hpMode === 'avg' ? 'checked' : ''} class="accent-[var(--felt)]" />
      <span>Valore medio: <strong>+${avg} PF</strong> <span class="text-[11px] text-[var(--muted)]">(il più usato: niente sorprese)</span></span></label>
    <label class="card-surface2 p-3 flex flex-wrap items-center gap-2 cursor-pointer"><input type="radio" name="luHp" value="roll" ${lu.hpMode === 'roll' ? 'checked' : ''} class="accent-[var(--felt)]" />
      <span>Tira 1d${hp.die} + COS</span><button type="button" class="btn btn-brass text-xs py-0.5 lu-roll">🎲 Tira</button>
      ${lu.rolled ? `<span>uscito ${lu.rolled}: <strong>+${levelUpGain(ch, Object.assign({}, lu, { hpMode: 'roll' }))} PF</strong></span>` : ''}</label>
    <ul class="text-[11px] text-[var(--muted)] lu-list">${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
    <div>Nuovo massimo: <strong>${ch.maxHp + hp.total} PF</strong> · Dadi Vita: ${ch.level + 1}d${hp.die}</div>`;
}

function renderLevelUpAsi(ch, lu) {
  const select = (i) => `<select class="input-field lu-asi" data-i="${i}"><option value="">—</option>${ABILITY_KEYS.map(k => `<option value="${k}" ${lu.asi[i] === k ? 'selected' : ''} ${ch.abilities[k] >= 20 ? 'disabled' : ''}>+1 ${k} (${ch.abilities[k]})</option>`).join('')}</select>`;
  const after = luNewAbilities(ch, lu);
  const changed = ABILITY_KEYS.filter(k => after[k] !== ch.abilities[k]);
  return `
    <div>A questo livello puoi aumentare le caratteristiche oppure, se il Master usa la regola facoltativa dei talenti, prendere un talento.</div>
    ${choiceCard('luAsiMode', 'asi', lu.asiMode === 'asi', 'Aumento dei punteggi di caratteristica', 'Due volte +1, anche alla stessa caratteristica per fare +2. Nessuna può superare 20. Conviene alzare la caratteristica principale della classe, soprattutto per arrivare a un numero pari (il modificatore sale ogni 2 punti).')}
    ${lu.asiMode === 'asi' ? `<div class="flex flex-wrap items-center gap-2">${select(0)} ${select(1)}
      ${changed.length ? `<span class="text-[11px]">${changed.map(k => `${k} ${ch.abilities[k]} → <strong>${after[k]}</strong> (${formatSignedMod(getAbilityMod(after[k]))})`).join(' · ')}</span>` : ''}</div>` : ''}
    ${choiceCard('luAsiMode', 'feat', lu.asiMode === 'feat', 'Talento', 'Un\'abilità speciale al posto dell\'aumento. Il regolamento base ne ha uno solo (Lottatore); gli altri sono nel Manuale del giocatore. La guida lo annota nei Privilegi: i suoi effetti li applichi tu.')}
    ${lu.asiMode === 'feat' ? `<input id="luFeat" type="text" class="input-field w-full" placeholder="Nome del talento, es. Lottatore" value="${escapeHtml(lu.feat)}" />` : ''}`;
}

function renderLevelUpChoices(ch, lu) {
  const next = ch.level + 1;
  return classChoices(ch, lu, next).map(c => {
    const picked = lu.picks[c.id] || [];
    const multi = c.need > 1;
    const options = c.chips
      ? `<div class="flex flex-wrap gap-1.5">${c.options.map(o => `<label class="condition-btn ${picked.includes(o.k) ? 'active' : ''} cursor-pointer"><input type="checkbox" class="hidden lu-pick" data-choice="${c.id}" value="${escapeHtml(o.k)}" ${picked.includes(o.k) ? 'checked' : ''}/>${escapeHtml(o.k)}</label>`).join('')}</div>`
      : `<div class="flex flex-col gap-1.5">${c.options.map(o => `
          <label class="card-surface p-2 flex gap-2 cursor-pointer border-2 ${picked.includes(o.k) ? 'border-[var(--brass)]' : 'border-transparent'}">
            <input type="${multi ? 'checkbox' : 'radio'}" name="luPick-${c.id}" class="mt-0.5 accent-[var(--felt)] lu-pick" data-choice="${c.id}" value="${escapeHtml(o.k)}" ${picked.includes(o.k) ? 'checked' : ''} />
            <span class="min-w-0"><strong class="block">${escapeHtml(o.k)}</strong><span class="text-[11px] text-[var(--muted)]">${escapeHtml(o.d)}</span></span>
          </label>`).join('')}</div>`;
    return luCard(`${escapeHtml(c.title)} <span class="font-normal text-[11px] ${picked.length === c.need ? 'text-[var(--ok)]' : 'text-[var(--muted)]'}">· ${picked.length}/${c.need}</span>`,
      `<div class="text-[11px] text-[var(--muted)]">${escapeHtml(c.help)}${c.catchUp ? ' Non risultano scelte salvate dai livelli precedenti: indica anche quelle che avevi già.' : ''}</div>${options}`);
  }).join('');
}

// Gli incantesimi che si possono ancora scegliere in un gruppo
function luSpellOptions(ch, lu, group) {
  if (!SRD.spells) return [];
  const known = new Set(ch.spells.map(s => Number(s.i)));
  const elsewhere = new Set(Object.entries(lu.spells).filter(([id]) => id !== group.id).flatMap(([, list]) => list));
  return SRD.spells.filter(sp => group.filter(sp) && !known.has(sp.i) && !elsewhere.has(sp.i))
    .sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n, 'it'));
}

function luSpellResultsHtml(ch, lu, group) {
  const picked = lu.spells[group.id] || [];
  const pool = luSpellOptions(ch, lu, group);
  const query = lu.search[group.id] || '';
  const shown = searchSrdList(pool, query, 40).filter(sp => !picked.includes(sp.i));
  const row = (sp, on) => `<label class="card-surface p-1.5 flex items-start gap-2 cursor-pointer border ${on ? 'border-[var(--brass)]' : 'border-transparent'}">
      <input type="checkbox" class="mt-0.5 w-4 h-4 accent-[var(--felt)] lu-spell-pick" data-group="${group.id}" value="${sp.i}" ${on ? 'checked' : ''} />
      <span class="min-w-0"><strong class="font-serif-title">${escapeHtml(sp.n)}</strong> ${sp.conc ? '<span class="text-[10px] text-[var(--brass)]">🔮</span>' : ''}${sp.rit ? '<span class="text-[10px]">📿</span>' : ''}
        <span class="block text-[10px] text-[var(--muted)]">${spellMetaLine(sp)}</span></span></label>`;
  const selected = picked.map(i => srdSpell(i)).filter(Boolean);
  return `${selected.map(sp => row(sp, true)).join('')}${shown.map(sp => row(sp, false)).join('') || (selected.length ? '' : '<div class="text-[var(--muted)]">Nessun incantesimo da scegliere.</div>')}`;
}

function renderLevelUpSpells(ch, lu) {
  if (!SRD.spells) return '<div class="text-[var(--muted)]">Carico gli incantesimi…</div>';
  const next = ch.level + 1;
  const groups = spellGroups(ch, lu, next);
  const auto = autoSpells(ch, lu, next);
  const knownList = SPELLS_KNOWN[ch.className]
    ? ch.spells.map(s => srdSpell(Number(s.i))).filter(sp => sp && sp.lv > 0).sort((a, b) => a.lv - b.lv || a.n.localeCompare(b.n, 'it'))
    : [];
  const swap = knownList.length ? luCard('🔁 Cambiare un incantesimo (facoltativo)', `
      <div class="text-[11px] text-[var(--muted)]">Chi conosce gli incantesimi, a ogni livello può dimenticarne uno e impararne un altro al suo posto.</div>
      <select id="luSwapOut" class="input-field"><option value="">Non cambio niente</option>${knownList.map(sp => `<option value="${sp.i}" ${String(lu.swapOut) === String(sp.i) ? 'selected' : ''}>Dimentico ${escapeHtml(sp.n)} (${sp.lv}°)</option>`).join('')}</select>`) : '';
  const autoCard = auto.length ? luCard('📌 Sempre preparati', `<div>Arrivano da ${escapeHtml(luSubclassName(ch, lu))} e non contano nel numero dei preparati: <strong>${auto.map(sp => escapeHtml(sp.n)).join(', ')}</strong>.</div>`) : '';
  return autoCard + swap + groups.map(g => {
    const picked = lu.spells[g.id] || [];
    const need = Math.min(g.count, luSpellOptions(ch, lu, g).length);
    const counter = g.optional ? `${picked.length} scelti` : `${picked.length}/${need}`;
    return luCard(`${escapeHtml(g.title)} <span class="font-normal text-[11px] ${!g.optional && picked.length === need ? 'text-[var(--ok)]' : 'text-[var(--muted)]'}">· ${counter}</span>`, `
      <div class="text-[11px] text-[var(--muted)]">${escapeHtml(g.help)}</div>
      <input type="search" class="input-field w-full lu-spell-search" data-group="${g.id}" placeholder="🔎 Cerca per nome (italiano o inglese)…" value="${escapeHtml(lu.search[g.id] || '')}" />
      <div id="luSpellRes-${g.id}" class="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">${luSpellResultsHtml(ch, lu, g)}</div>`);
  }).join('');
}

function luPicksSummary(ch, lu) {
  const next = ch.level + 1;
  const lines = classChoices(ch, lu, next).map(c => `${c.title}: ${(lu.picks[c.id] || []).join(', ')}`);
  const spells = Object.entries(lu.spells).flatMap(([, list]) => list).map(i => srdSpell(i)?.n).filter(Boolean);
  if (spells.length) lines.push(`Incantesimi nuovi: ${spells.join(', ')}`);
  if (lu.swapOut) lines.push(`Incantesimo dimenticato: ${srdSpell(Number(lu.swapOut))?.n || ''}`);
  const auto = autoSpells(ch, lu, next);
  if (auto.length) lines.push(`Sempre preparati: ${auto.map(sp => sp.n).join(', ')}`);
  return lines;
}

function renderLevelUpSummary(ch, lu) {
  const next = ch.level + 1;
  const hp = levelUpHp(ch, lu);
  const after = luNewAbilities(ch, lu);
  const changed = ABILITY_KEYS.filter(k => after[k] !== ch.abilities[k]);
  const sub = luSubclassName(ch, lu);
  const unlinked = linkAttacksToAbilities(Object.assign({}, ch));
  const slotsNow = classSpellSlots(ch.className, ch.level);
  const slotsNext = classSpellSlots(ch.className, next);
  const items = [
    `PF: <strong>+${hp.total}</strong> (massimo ${ch.maxHp} → ${ch.maxHp + hp.total}) · Dadi Vita ${next}d${hp.die}`,
    `Bonus di competenza: ${formatSignedMod(getProficiencyBonus(next))}`,
    changed.length ? `Caratteristiche: ${changed.map(k => `${k} ${ch.abilities[k]} → ${after[k]}`).join(', ')}` : '',
    lu.asiMode === 'feat' && lu.feat.trim() && classAsiLevels(ch.className).includes(next) ? `Talento: ${escapeHtml(lu.feat.trim())}` : '',
    needsSubclass(ch, next) && sub ? `Sottoclasse: ${escapeHtml(sub)}` : '',
    SRD_CLASSES[ch.className]?.casting && slotsNext.join() !== slotsNow.join() ? `Slot incantesimo: ${slotsText(slotsNext)}` : '',
    ...luPicksSummary(ch, lu).map(escapeHtml)
  ].filter(Boolean);
  const feats = featuresGained(ch, lu, next);
  return `
    ${luCard(`⬆️ Livello ${next}`, `<ul class="flex flex-col gap-1 lu-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`)}
    ${feats.length ? luCard('📜 Privilegi nuovi', `${luFeatureList(feats)}<div class="text-[11px] text-[var(--muted)]">Vengono aggiunti ai Privilegi della scheda, con le scelte fatte.</div>`) : ''}
    ${unlinked.length ? `<div class="card-surface2 p-3 text-[11px]"><strong class="text-[var(--brass)]">⚠️ Attacchi da controllare a mano:</strong> ${escapeHtml(unlinked.join(', '))}.
      I loro numeri non tornano con FOR o DES (arma magica, stile di combattimento…), quindi non si aggiornano da soli.</div>` : ''}`;
}

// Toglie le scelte che non valgono più, per esempio una supplica dopo aver cambiato dono del patto
function pruneLevelUpPicks(ch, lu) {
  const next = ch.level + 1;
  classChoices(ch, lu, next).forEach(c => {
    if (lu.picks[c.id]) lu.picks[c.id] = lu.picks[c.id].filter(k => c.options.some(o => o.k === k)).slice(0, c.need);
  });
  if (!SRD.spells) return;
  const groups = spellGroups(ch, lu, next);
  Object.keys(lu.spells).forEach(id => {
    const g = groups.find(x => x.id === id);
    if (!g) { delete lu.spells[id]; return; }
    const ok = new Set(luSpellOptions(ch, lu, g).map(sp => sp.i));
    lu.spells[id] = lu.spells[id].filter(i => ok.has(i));
  });
}

function renderLevelUp() {
  const lu = App.levelUp;
  const ch = lu && getChar(lu.charId);
  if (!ch) return;
  pruneLevelUpPicks(ch, lu);
  const steps = levelUpSteps(ch, lu);
  if (!steps.includes(lu.step)) lu.step = 'overview';
  const idx = steps.indexOf(lu.step);
  setText('levelUpStepLabel', `Passo ${idx + 1} di ${steps.length}`);
  setText('levelUpTitle', LEVELUP_STEP_TITLES[lu.step]);
  $('btnLevelUpBack').classList.toggle('invisible', idx === 0);
  setText('btnApplyLevelUp', idx === steps.length - 1 ? `⬆️ Sali al livello ${ch.level + 1}` : 'Avanti →');
  setText('levelUpProblem', '');
  const render = {
    overview: () => renderLevelUpOverview(ch, lu, ch.level + 1, steps), subclass: () => renderLevelUpSubclass(ch, lu),
    hp: () => renderLevelUpHp(ch, lu), asi: () => renderLevelUpAsi(ch, lu), choices: () => renderLevelUpChoices(ch, lu),
    spells: () => renderLevelUpSpells(ch, lu), summary: () => renderLevelUpSummary(ch, lu)
  }[lu.step];
  $('levelUpBody').innerHTML = render();
}

// ---------------------------------------------------------------------------
// Applicazione alla scheda
// ---------------------------------------------------------------------------

function applyLevelUp() {
  const lu = App.levelUp;
  const ch = lu && getChar(lu.charId);
  if (!ch || !canEditChar(ch)) return;
  pruneLevelUpPicks(ch, lu);
  const steps = levelUpSteps(ch, lu);
  const problem = steps.map(s => levelUpProblem(ch, lu, s)).find(Boolean);
  if (problem) { showToast(problem); return; }
  const next = ch.level + 1;
  const gain = levelUpGain(ch, lu);
  const abilities = luNewAbilities(ch, lu);
  const choices = classChoices(ch, lu, next);
  const groups = spellGroups(ch, lu, next);
  const auto = autoSpells(ch, lu, next);
  const feats = featuresGained(ch, lu, next);
  const subName = needsSubclass(ch, next) ? luSubclassName(ch, lu) : '';
  const isFeat = classAsiLevels(ch.className).includes(next) && lu.asiMode === 'feat';

  // Prima di cambiare livello e caratteristiche, finché i numeri degli attacchi tornano con quelli di adesso
  const unlinked = linkAttacksToAbilities(ch);
  const slotsBefore = classSpellSlots(ch.className, ch.level);
  ch.level = next;
  ch.maxHp += gain;
  ch.hp = Math.min(ch.maxHp, ch.hp + gain);
  ch.hitDiceRemaining = Math.min(ch.level, ch.hitDiceRemaining + 1);
  ch.abilities = abilities;
  if (SRD_CLASSES[ch.className]?.casting) updateClassSlots(ch, slotsBefore, classSpellSlots(ch.className, ch.level));
  if (subName) ch.subclass = subName;

  // Scelte di classe: restano salvate e alcune cambiano la scheda
  ch.classPicks = ch.classPicks || {};
  choices.forEach(c => { ch.classPicks[c.id] = [...(ch.classPicks[c.id] || []), ...(lu.picks[c.id] || [])]; });
  (lu.picks.expertise || []).forEach(k => { if (ALL_SKILL_KEYS.includes(k)) ch.skillsProf[k] = 2; });
  (lu.picks.loreSkills || []).forEach(k => { if (!(Number(ch.skillsProf[k]) >= 1)) ch.skillsProf[k] = 1; });
  if (ch.className === 'Ladro' && next === 15) ch.savingThrowsProf.SAG = true;
  if (ch.className === 'Monaco' && next === 14) ABILITY_KEYS.forEach(k => { ch.savingThrowsProf[k] = true; });

  // Incantesimi
  if (lu.swapOut) ch.spells = ch.spells.filter(s => Number(s.i) !== Number(lu.swapOut));
  groups.forEach(g => (lu.spells[g.id] || []).forEach(i => {
    const sp = srdSpell(i);
    if (!sp || ch.spells.some(s => Number(s.i) === i)) return;
    if (g.id === 'ritualBook') { ch.spells.push({ i, prep: false, always: false, ritualOnly: true }); return; }
    const prep = !spellPrepMode(ch) || sp.lv === 0 || preparedSpellCount(ch) < maxPreparedSpells(ch);
    ch.spells.push({ i, prep, always: false });
  }));
  auto.forEach(sp => {
    const entry = ch.spells.find(s => Number(s.i) === sp.i);
    if (entry) { entry.always = true; entry.prep = true; } else ch.spells.push({ i: sp.i, prep: true, always: true });
  });

  // Nei Privilegi della scheda resta scritto cosa è arrivato a questo livello
  const lines = [
    ...feats.map(f => `${f.n}${f.from ? ` (dal ${f.from}° livello)` : ''}: ${f.d}`),
    ...choices.map(c => `${c.title}: ${(lu.picks[c.id] || []).map(k => {
      const d = c.options.find(o => o.k === k)?.d;
      return d ? `${k} (${d})` : k;
    }).join('; ')}`),
    isFeat ? `Talento: ${lu.feat.trim()}` : ''
  ].filter(Boolean);
  if (lines.length) {
    const head = `— Livello ${next}${ch.subclass ? ` · ${ch.subclass}` : ''} —`;
    ch.featuresText = `${String(ch.featuresText || '').trimEnd()}${ch.featuresText ? '\n\n' : ''}${head}\n${lines.join('\n')}`;
  }

  touchEnt(`char:${ch.id}`);
  showEl('modalLevelUp', false);
  App.levelUp = null;
  showToast(`⬆️ ${ch.name} è ora di livello ${ch.level} (+${gain} PF)${unlinked.length ? ` · ⚠️ controlla a mano: ${unlinked.join(', ')}` : ''}`, unlinked.length ? 6000 : 3500);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function levelUpGo(delta) {
  const lu = App.levelUp;
  const ch = lu && getChar(lu.charId);
  if (!ch) return;
  const steps = levelUpSteps(ch, lu);
  const idx = steps.indexOf(lu.step);
  if (delta > 0) {
    const problem = levelUpProblem(ch, lu, lu.step);
    if (problem) { setText('levelUpProblem', problem); showToast(problem); return; }
    if (idx === steps.length - 1) { applyLevelUp(); return; }
  }
  lu.step = steps[Math.max(0, Math.min(steps.length - 1, idx + delta))];
  renderLevelUp();
  $('modalLevelUp').scrollTop = 0;
}

function initLevelUpEvents() {
  $('btnLevelUp').addEventListener('click', openLevelUp);
  $('btnCloseLevelUp').addEventListener('click', () => { showEl('modalLevelUp', false); App.levelUp = null; });
  $('btnApplyLevelUp').addEventListener('click', () => levelUpGo(1));
  $('btnLevelUpBack').addEventListener('click', () => levelUpGo(-1));
  const body = $('levelUpBody');
  body.addEventListener('change', (e) => {
    const lu = App.levelUp;
    const ch = lu && getChar(lu.charId);
    if (!ch) return;
    const t = e.target;
    if (t.name === 'luHp') lu.hpMode = t.value;
    else if (t.name === 'luSub') lu.subclass = t.value;
    else if (t.name === 'luAsiMode') lu.asiMode = t.value;
    else if (t.classList.contains('lu-asi')) lu.asi[parseInt(t.dataset.i, 10)] = t.value;
    else if (t.id === 'luSwapOut') { lu.swapOut = t.value; delete lu.spells.swap; }
    else if (t.classList.contains('lu-pick')) {
      const c = classChoices(ch, lu, ch.level + 1).find(x => x.id === t.dataset.choice);
      let list = lu.picks[t.dataset.choice] || [];
      if (t.type === 'radio') list = [t.value];
      else if (t.checked) list = c && list.length >= c.need ? list : [...list, t.value];
      else list = list.filter(v => v !== t.value);
      lu.picks[t.dataset.choice] = list;
    } else if (t.classList.contains('lu-spell-pick')) {
      const g = spellGroups(ch, lu, ch.level + 1).find(x => x.id === t.dataset.group);
      let list = lu.spells[t.dataset.group] || [];
      const i = Number(t.value);
      if (t.checked) list = g && !g.optional && list.length >= g.count ? list : [...list, i];
      else list = list.filter(v => v !== i);
      lu.spells[t.dataset.group] = list;
    } else return;
    renderLevelUp();
  });
  body.addEventListener('input', (e) => {
    const lu = App.levelUp;
    const ch = lu && getChar(lu.charId);
    if (!ch) return;
    const t = e.target;
    if (t.id === 'luSubOther') lu.subclassOther = t.value;
    if (t.id === 'luFeat') lu.feat = t.value;
    if (t.classList.contains('lu-spell-search')) {
      lu.search[t.dataset.group] = t.value;
      const g = spellGroups(ch, lu, ch.level + 1).find(x => x.id === t.dataset.group);
      const box = $(`luSpellRes-${t.dataset.group}`);
      if (g && box) box.innerHTML = luSpellResultsHtml(ch, lu, g);
    }
    setText('levelUpProblem', '');
  });
  body.addEventListener('click', (e) => {
    const lu = App.levelUp;
    const ch = lu && getChar(lu.charId);
    if (!ch || !e.target.closest('.lu-roll')) return;
    lu.rolled = rollDie(parseInt(ch.hitDie.slice(1), 10) || 8);
    lu.hpMode = 'roll';
    renderLevelUp();
  });
}
