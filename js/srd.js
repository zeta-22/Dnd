// Contenuti del regolamento base (SRD 5.1): mostri, incantesimi, classi e razze.
// Nomi e campi in italiano; le descrizioni lunghe restano nel testo ufficiale inglese.
// I file in data/ vengono scaricati solo quando servono.

const SRD = { monsters: null, spells: null, promises: {} };

function loadSrd(kind) {
  if (SRD[kind]) return Promise.resolve(SRD[kind]);
  if (!SRD.promises[kind]) {
    SRD.promises[kind] = fetch(`data/srd-${kind}.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(list => { SRD[kind] = list; return list; })
      .catch(err => { SRD.promises[kind] = null; throw err; });
  }
  return SRD.promises[kind];
}

function srdMonster(index) { return SRD.monsters ? SRD.monsters.find(m => m.i === index) || null : null; }
function srdSpell(index) { return SRD.spells ? SRD.spells.find(s => s.i === index) || null : null; }

function searchSrdList(list, query, limit = 12, filter = null) {
  const q = normalizeSearchText(query).trim();
  const items = filter ? list.filter(filter) : list;
  if (!q) return items.slice(0, limit);
  const scored = [];
  items.forEach(x => {
    const it = normalizeSearchText(x.n);
    const en = normalizeSearchText(x.e);
    let score = -1;
    if (it.startsWith(q) || en.startsWith(q)) score = 3;
    else if (it.split(/\s+/).some(w => w.startsWith(q)) || en.split(/\s+/).some(w => w.startsWith(q))) score = 2;
    else if (it.includes(q) || en.includes(q)) score = 1;
    if (score >= 0) scored.push({ x, score });
  });
  return scored.sort((a, b) => b.score - a.score || a.x.n.localeCompare(b.x.n, 'it')).slice(0, limit).map(s => s.x);
}

function srdUnavailableMessage() {
  return location.protocol === 'file:'
    ? 'I dati del regolamento si caricano solo dal sito pubblicato (non aprendo il file dal computer).'
    : 'Non riesco a caricare i dati del regolamento: controlla la connessione.';
}

// ---------------------------------------------------------------------------
// Scheda del mostro
// ---------------------------------------------------------------------------

function monsterInitMod(m) { return getAbilityMod(m.ab[1]); }

function monsterStatBlockHtml(m, { actions = true } = {}) {
  const abil = ABILITY_KEYS.map((k, i) => `<div class="text-center"><div class="text-[10px] font-bold text-[var(--muted)]">${k}</div><div class="font-bold">${m.ab[i]} <span class="text-[var(--muted)] font-normal">(${formatSignedMod(getAbilityMod(m.ab[i]))})</span></div></div>`).join('');
  const line = (label, value) => value ? `<div><strong>${label}</strong> ${escapeHtml(value)}</div>` : '';
  const abilityRow = (a, idx, kind) => {
    const buttons = actions && (a.hit !== undefined || a.dmg) ? `
      <span class="inline-flex flex-wrap gap-1 ml-1">
        ${a.hit !== undefined ? `<button type="button" class="btn btn-felt text-[11px] py-0 px-1.5 monster-attack-btn" data-kind="${kind}" data-idx="${idx}">🎯 ${formatSignedMod(a.hit)}</button>` : ''}
        ${(a.dmg || []).map((d, j) => `<button type="button" class="btn btn-brass text-[11px] py-0 px-1.5 monster-damage-btn" data-kind="${kind}" data-idx="${idx}" data-dmg="${j}">💥 ${escapeHtml(d.f)}${d.t ? ` ${escapeHtml(d.t)}` : ''}</button>`).join('')}
        ${a.dc ? `<span class="text-[10px] font-bold text-[var(--danger)]">TS ${escapeHtml(a.dc)}</span>` : ''}
      </span>` : (a.dc ? ` <span class="text-[10px] font-bold text-[var(--danger)]">TS ${escapeHtml(a.dc)}</span>` : '');
    return `<div class="py-0.5"><strong>${escapeHtml(a.n)}.</strong>${buttons}
      <details class="text-[11px] text-[var(--muted)]"><summary class="cursor-pointer">testo</summary><p class="mt-0.5 leading-snug" lang="en">${escapeHtml(a.d)}</p></details></div>`;
  };
  return `
    <div class="text-xs flex flex-col gap-1.5 monster-statblock" data-monster="${m.i}">
      <div class="text-[11px] italic text-[var(--muted)]">${escapeHtml(m.ty)} ${escapeHtml(m.sz.toLowerCase())}, ${escapeHtml(m.al)}</div>
      <div class="grid grid-cols-3 gap-1 text-center">
        <div class="card-surface2 p-1"><div class="text-[10px] text-[var(--muted)]">CA</div><strong>${m.ca}</strong></div>
        <div class="card-surface2 p-1"><div class="text-[10px] text-[var(--muted)]">PF</div><strong>${m.hp}</strong> <span class="text-[10px] text-[var(--muted)]">(${escapeHtml(m.hd)})</span></div>
        <div class="card-surface2 p-1"><div class="text-[10px] text-[var(--muted)]">Sfida</div><strong>${escapeHtml(m.cr)}</strong></div>
      </div>
      ${line('Velocità', m.sp)}
      <div class="grid grid-cols-6 gap-0.5">${abil}</div>
      ${line('Tiri salvezza', m.sv)}${line('Abilità', m.sk)}${line('Vulnerabilità', m.vul)}${line('Resistenze', m.res)}
      ${line('Immunità ai danni', m.imm)}${line('Immunità alle condizioni', m.cim)}${line('Sensi', m.se)}${line('Linguaggi', m.la)}
      ${m.tr.length ? `<div class="pt-1 border-t border-[var(--line)]">${m.tr.map((a, i) => abilityRow(a, i, 'tr')).join('')}</div>` : ''}
      ${m.act.length ? `<div class="pt-1 border-t border-[var(--line)]"><div class="font-bold text-[var(--brass)]">Azioni</div>${m.act.map((a, i) => abilityRow(a, i, 'act')).join('')}</div>` : ''}
      ${m.leg.length ? `<div class="pt-1 border-t border-[var(--line)]"><div class="font-bold text-[var(--brass)]">Azioni leggendarie</div>${m.leg.map((a, i) => abilityRow(a, i, 'leg')).join('')}</div>` : ''}
    </div>`;
}

// ---------------------------------------------------------------------------
// Classi e razze (per la creazione guidata e il passaggio di livello)
// ---------------------------------------------------------------------------

const ALL_SKILL_KEYS = DND5E_SKILLS.map(s => s.key);

const SRD_CLASSES = {
  Barbaro: { die: 12, saves: ['FOR', 'COS'], skills: { n: 2, from: ['Addestrare Animali', 'Atletica', 'Intimidire', 'Natura', 'Percezione', 'Sopravvivenza'] }, ac: 'barbarian', bonus: 'Ira', features: 'Ira (2 al giorno, +2 ai danni), Difesa senza armatura (CA 10 + DES + COS).', weapons: ['greataxe', 'handaxe'] },
  Bardo: { die: 8, saves: ['DES', 'CAR'], skills: { n: 3, from: ALL_SKILL_KEYS }, casting: { ability: 'CAR', type: 'full', ritual: 'known' }, bonus: 'Ispirazione bardica', features: 'Incantesimi, Ispirazione bardica (d6).', weapons: ['rapier', 'dagger'] },
  Chierico: { die: 8, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Intuizione', 'Medicina', 'Persuasione', 'Religione', 'Storia'] }, casting: { ability: 'SAG', type: 'full', prepares: 'full', ritual: 'prepared' }, bonus: '', features: 'Incantesimi, Dominio divino.', weapons: ['mace', 'lightcrossbow'] },
  Druido: { die: 8, saves: ['INT', 'SAG'], skills: { n: 2, from: ['Addestrare Animali', 'Arcano', 'Intuizione', 'Medicina', 'Natura', 'Percezione', 'Religione', 'Sopravvivenza'] }, casting: { ability: 'SAG', type: 'full', prepares: 'full', ritual: 'prepared' }, bonus: '', features: 'Druidico, Incantesimi.', weapons: ['scimitar'] },
  Guerriero: { die: 10, saves: ['FOR', 'COS'], skills: { n: 2, from: ['Acrobazia', 'Addestrare Animali', 'Atletica', 'Intimidire', 'Intuizione', 'Percezione', 'Sopravvivenza', 'Storia'] }, bonus: 'Recuperare energie', features: 'Stile di combattimento, Recuperare energie (1d10 + livello PF, azione bonus).', weapons: ['longsword', 'lightcrossbow'] },
  Ladro: { die: 8, saves: ['DES', 'INT'], skills: { n: 4, from: ['Acrobazia', 'Atletica', 'Furtività', 'Indagare', 'Inganno', 'Intimidire', 'Intrattenere', 'Intuizione', 'Percezione', 'Persuasione', 'Rapidità di Mano'] }, bonus: 'Azione scaltra (dal 2° livello)', features: 'Maestria (2 abilità: segnale nella vista Completa), Attacco furtivo (1d6), Gergo ladresco.', weapons: ['shortsword', 'shortbow'] },
  Mago: { die: 6, saves: ['INT', 'SAG'], skills: { n: 2, from: ['Arcano', 'Indagare', 'Intuizione', 'Medicina', 'Religione', 'Storia'] }, casting: { ability: 'INT', type: 'full', prepares: 'full', ritual: 'book' }, bonus: '', features: 'Incantesimi (libro degli incantesimi), Recupero arcano.', weapons: ['dagger'] },
  Monaco: { die: 8, saves: ['FOR', 'DES'], skills: { n: 2, from: ['Acrobazia', 'Atletica', 'Furtività', 'Intuizione', 'Religione', 'Storia'] }, ac: 'monk', bonus: 'Colpo senz\'armi (Arti marziali)', features: 'Difesa senza armatura (CA 10 + DES + SAG), Arti marziali (d4).', weapons: ['unarmed', 'shortsword'] },
  Paladino: { die: 10, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Atletica', 'Intimidire', 'Intuizione', 'Medicina', 'Persuasione', 'Religione'] }, casting: { ability: 'CAR', type: 'half', prepares: 'half' }, bonus: '', features: 'Percezione del divino, Imposizione delle mani (5 × livello PF).', weapons: ['longsword', 'javelin'] },
  Ranger: { die: 10, saves: ['FOR', 'DES'], skills: { n: 3, from: ['Addestrare Animali', 'Atletica', 'Furtività', 'Indagare', 'Intuizione', 'Natura', 'Percezione', 'Sopravvivenza'] }, casting: { ability: 'SAG', type: 'half' }, bonus: '', features: 'Nemico prescelto, Esploratore nato.', weapons: ['longbow', 'shortsword'] },
  Stregone: { die: 6, saves: ['COS', 'CAR'], skills: { n: 2, from: ['Arcano', 'Inganno', 'Intimidire', 'Intuizione', 'Persuasione', 'Religione'] }, casting: { ability: 'CAR', type: 'full' }, bonus: '', features: 'Incantesimi, Origine stregonesca.', weapons: ['dagger', 'lightcrossbow'] },
  Warlock: { die: 8, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Arcano', 'Indagare', 'Inganno', 'Intimidire', 'Natura', 'Religione', 'Storia'] }, casting: { ability: 'CAR', type: 'pact' }, bonus: '', features: 'Patrono ultraterreno, Magia del patto (gli slot si recuperano col riposo breve).', weapons: ['dagger', 'lightcrossbow'] }
};

const SRD_RACES = {
  Dragonide: { speed: 9, bonus: { FOR: 2, CAR: 1 }, traits: 'Discendenza draconica, Arma a soffio, Resistenza ai danni.' },
  'Elfo (Alto Elfo)': { speed: 9, bonus: { DES: 2, INT: 1 }, skills: ['Percezione'], traits: 'Scurovisione, Sensi acuti, Retaggio fatato, Trance, un trucchetto da mago.' },
  'Gnomo (delle Rocce)': { speed: 7.5, bonus: { INT: 2, COS: 1 }, traits: 'Scurovisione, Astuzia gnomesca, Conoscenze dell\'artefice.' },
  'Halfling (Piedelesto)': { speed: 7.5, bonus: { DES: 2, CAR: 1 }, traits: 'Fortunato, Coraggioso, Agilità halfling, Furtività innata.' },
  Mezzelfo: { speed: 9, bonus: { CAR: 2 }, freeBonus: 2, freeSkills: 2, traits: 'Scurovisione, Retaggio fatato, Versatilità nelle abilità.' },
  Mezzorco: { speed: 9, bonus: { FOR: 2, COS: 1 }, skills: ['Intimidire'], traits: 'Scurovisione, Minaccioso, Tenacia implacabile, Attacchi selvaggi.' },
  'Nano (delle Colline)': { speed: 7.5, bonus: { COS: 2, SAG: 1 }, hpPerLevel: 1, traits: 'Scurovisione, Resilienza nanica, Robustezza nanica (+1 PF per livello).' },
  Tiefling: { speed: 9, bonus: { CAR: 2, INT: 1 }, traits: 'Scurovisione, Resistenza infernale (fuoco), Eredità infernale.' },
  Umano: { speed: 9, bonus: { FOR: 1, DES: 1, COS: 1, INT: 1, SAG: 1, CAR: 1 }, traits: 'Versatile: +1 a tutte le caratteristiche.' }
};

const SRD_BACKGROUNDS = {
  Accolito: ['Intuizione', 'Religione'], Artigiano: ['Intuizione', 'Persuasione'], Ciarlatano: ['Inganno', 'Rapidità di Mano'],
  Criminale: ['Furtività', 'Inganno'], 'Eroe popolare': ['Addestrare Animali', 'Sopravvivenza'], Eremita: ['Medicina', 'Religione'],
  Forestiero: ['Atletica', 'Sopravvivenza'], Intrattenitore: ['Acrobazia', 'Intrattenere'], Marinaio: ['Atletica', 'Percezione'],
  Monello: ['Furtività', 'Rapidità di Mano'], Nobile: ['Persuasione', 'Storia'], Saggio: ['Arcano', 'Storia'], Soldato: ['Atletica', 'Intimidire']
};

const FULL_CASTER_SLOTS = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const HALF_CASTER_SLOTS = [[], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3],
  [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];

// Nome della classe del regolamento da come lo scrive il giocatore ("Maga", "wizard", "Mago (Invocazione)")
const CLASS_NAME_ALIASES = {
  barbara: 'Barbaro', barda: 'Bardo', chierica: 'Chierico', druida: 'Druido', guerriera: 'Guerriero', ladra: 'Ladro', maga: 'Mago',
  monaca: 'Monaco', paladina: 'Paladino', stregona: 'Stregone', strega: 'Stregone', barbarian: 'Barbaro', bard: 'Bardo',
  cleric: 'Chierico', druid: 'Druido', fighter: 'Guerriero', rogue: 'Ladro', wizard: 'Mago', monk: 'Monaco', paladin: 'Paladino',
  sorcerer: 'Stregone'
};

function srdClassKey(name) {
  const first = normalizeSearchText(name).trim().split(/[^a-z]+/)[0] || '';
  return Object.keys(SRD_CLASSES).find(c => normalizeSearchText(c) === first) || CLASS_NAME_ALIASES[first] || null;
}

// Con più classi ("Guerriero 3 / Ladro 2") servono tutte, per esempio per le competenze nelle armi
function srdClassKeys(name) {
  return String(name || '').split('/').map(srdClassKey).filter(Boolean);
}

// Slot per livello d'incantesimo (array di 9) per una classe a un certo livello.
// Con le regole 2024 paladino e ranger hanno già 2 slot al 1° livello.
function classSpellSlots(className, level, rules = campaignRules()) {
  const cls = SRD_CLASSES[srdClassKey(className)];
  const out = new Array(9).fill(0);
  if (!cls?.casting) return out;
  const lv = clampInt(level, 1, 20, 1);
  if (cls.casting.type === 'pact') {
    const count = lv === 1 ? 1 : lv <= 10 ? 2 : lv <= 16 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(lv / 2));
    out[slotLevel - 1] = count;
    // Arcanum mistico: uno slot di 6°-9° solo per l'incantesimo dell'arcanum, si recupera col riposo lungo
    Object.entries(MYSTIC_ARCANUM).forEach(([from, spellLv]) => { if (lv >= Number(from)) out[spellLv - 1] = 1; });
    return out;
  }
  const table = cls.casting.type === 'full' ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS;
  const row = cls.casting.type === 'half' && lv === 1 && rules === '2024' ? [2] : table[lv - 1];
  row.forEach((n, i) => { out[i] = n; });
  return out;
}

function classAsiLevels(className) {
  if (className === 'Guerriero') return [4, 6, 8, 12, 14, 16, 19];
  if (className === 'Ladro') return [4, 8, 10, 12, 16, 19];
  return [4, 8, 12, 16, 19];
}

// Caratteristica da incantatore: dalla classe, oppure quella scelta nella scheda
function spellcastingAbility(ch) {
  if (ch.spellAbility && ABILITY_KEYS.includes(ch.spellAbility)) return ch.spellAbility;
  return SRD_CLASSES[srdClassKey(ch.className)]?.casting?.ability || 'INT';
}

// ---------------------------------------------------------------------------
// Quanti incantesimi si scelgono a ogni livello (Manuale del Giocatore 2014 e 2024)
// ---------------------------------------------------------------------------

// Trucchetti e incantesimi conosciuti (2014) stanno in classes.js: CANTRIPS_KNOWN e SPELLS_KNOWN.
// 2024: incantesimi preparati per livello, dalla tabella di ogni classe
const PREPARED_FULL_2024 = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const PREPARED_HALF_2024 = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const SPELLS_PREPARED_2024 = {
  Bardo: PREPARED_FULL_2024, Chierico: PREPARED_FULL_2024, Druido: PREPARED_FULL_2024,
  Mago: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  Stregone: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  Paladino: PREPARED_HALF_2024, Ranger: PREPARED_HALF_2024
};

// null se la classe non è un incantatore del regolamento. Il mago tiene un libro (book incantesimi)
// e ne prepara "spells"; gli altri hanno in scheda solo quelli conosciuti o preparati.
function classSpellRules(ch, rules = campaignRules()) {
  const cls = srdClassKey(ch.className);
  const casting = !String(ch.className || '').includes('/') && SRD_CLASSES[cls]?.casting;
  if (!casting) return null;
  const lv = clampInt(ch.level, 1, 20, 1);
  const mod = getAbilityMod(ch.abilities?.[casting.ability]);
  // Il Warlock sceglie fino al livello degli slot del patto: gli slot dell'Arcanum mistico (6°-9°) sono a parte
  const slots = classSpellSlots(cls, lv, rules);
  const maxLevel = casting.type === 'pact' ? slots.findIndex(n => n > 0) + 1 : slots.reduce((m, n, i) => (n ? i + 1 : m), 0);
  const out = { cls, rules, ability: casting.ability, cantrips: CANTRIPS_KNOWN[cls]?.[lv - 1] || 0, maxLevel, book: cls === 'Mago' ? 6 + 2 * (lv - 1) : 0 };
  if (rules === '2024') return Object.assign(out, { spells: SPELLS_PREPARED_2024[cls][lv - 1], kind: 'prepared', how: 'tabella della classe' });
  if (SPELLS_KNOWN[cls]) return Object.assign(out, { spells: SPELLS_KNOWN[cls][lv - 1], kind: 'known', how: 'tabella della classe' });
  if (cls === 'Paladino') return Object.assign(out, { spells: lv < 2 ? 0 : Math.max(1, mod + Math.floor(lv / 2)), kind: 'prepared', how: `${casting.ability} ${formatSignedMod(mod)} + metà livello` });
  return Object.assign(out, { spells: Math.max(1, mod + lv), kind: 'prepared', how: `${casting.ability} ${formatSignedMod(mod)} + livello` });
}

// ---------------------------------------------------------------------------
// Armi del regolamento base: tiro per colpire e danni li calcola il personaggio
// ---------------------------------------------------------------------------

// k chiave · n/e nome italiano e inglese · c semplice, da guerra o colpo senz'armi · ranged arma a distanza
// d dado del danno · v dado a due mani (versatile) · t tipo di danno · p proprietà · r gittata in metri
const SRD_WEAPONS = [
  { k: 'club', n: 'Randello', e: 'Club', c: 'simple', d: '1d4', t: 'contundenti', p: ['light'] },
  { k: 'dagger', n: 'Pugnale', e: 'Dagger', c: 'simple', d: '1d4', t: 'perforanti', p: ['finesse', 'light', 'thrown'], r: '6/18' },
  { k: 'greatclub', n: 'Randello pesante', e: 'Greatclub', c: 'simple', d: '1d8', t: 'contundenti', p: ['twohanded'] },
  { k: 'handaxe', n: 'Ascia', e: 'Handaxe', c: 'simple', d: '1d6', t: 'taglienti', p: ['light', 'thrown'], r: '6/18' },
  { k: 'javelin', n: 'Giavellotto', e: 'Javelin', c: 'simple', d: '1d6', t: 'perforanti', p: ['thrown'], r: '9/36' },
  { k: 'lighthammer', n: 'Martello leggero', e: 'Light Hammer', c: 'simple', d: '1d4', t: 'contundenti', p: ['light', 'thrown'], r: '6/18' },
  { k: 'mace', n: 'Mazza', e: 'Mace', c: 'simple', d: '1d6', t: 'contundenti', p: [] },
  { k: 'quarterstaff', n: 'Bastone ferrato', e: 'Quarterstaff', c: 'simple', d: '1d6', v: '1d8', t: 'contundenti', p: ['versatile'] },
  { k: 'sickle', n: 'Falcetto', e: 'Sickle', c: 'simple', d: '1d4', t: 'taglienti', p: ['light'] },
  { k: 'spear', n: 'Lancia', e: 'Spear', c: 'simple', d: '1d6', v: '1d8', t: 'perforanti', p: ['thrown', 'versatile'], r: '6/18' },
  { k: 'lightcrossbow', n: 'Balestra leggera', e: 'Light Crossbow', c: 'simple', ranged: true, d: '1d8', t: 'perforanti', p: ['ammunition', 'loading', 'twohanded'], r: '24/96' },
  { k: 'dart', n: 'Dardo', e: 'Dart', c: 'simple', ranged: true, d: '1d4', t: 'perforanti', p: ['finesse', 'thrown'], r: '6/18' },
  { k: 'shortbow', n: 'Arco corto', e: 'Shortbow', c: 'simple', ranged: true, d: '1d6', t: 'perforanti', p: ['ammunition', 'twohanded'], r: '24/96' },
  { k: 'sling', n: 'Fionda', e: 'Sling', c: 'simple', ranged: true, d: '1d4', t: 'contundenti', p: ['ammunition'], r: '9/36' },
  { k: 'battleaxe', n: 'Ascia da battaglia', e: 'Battleaxe', c: 'martial', d: '1d8', v: '1d10', t: 'taglienti', p: ['versatile'] },
  { k: 'flail', n: 'Mazzafrusto', e: 'Flail', c: 'martial', d: '1d8', t: 'contundenti', p: [] },
  { k: 'glaive', n: 'Falcione', e: 'Glaive', c: 'martial', d: '1d10', t: 'taglienti', p: ['heavy', 'reach', 'twohanded'] },
  { k: 'greataxe', n: 'Ascia bipenne', e: 'Greataxe', c: 'martial', d: '1d12', t: 'taglienti', p: ['heavy', 'twohanded'] },
  { k: 'greatsword', n: 'Spadone', e: 'Greatsword', c: 'martial', d: '2d6', t: 'taglienti', p: ['heavy', 'twohanded'] },
  { k: 'halberd', n: 'Alabarda', e: 'Halberd', c: 'martial', d: '1d10', t: 'taglienti', p: ['heavy', 'reach', 'twohanded'] },
  { k: 'lance', n: 'Lancia da cavaliere', e: 'Lance', c: 'martial', d: '1d12', t: 'perforanti', p: ['reach', 'special'] },
  { k: 'longsword', n: 'Spada lunga', e: 'Longsword', c: 'martial', d: '1d8', v: '1d10', t: 'taglienti', p: ['versatile'] },
  { k: 'maul', n: 'Maglio', e: 'Maul', c: 'martial', d: '2d6', t: 'contundenti', p: ['heavy', 'twohanded'] },
  { k: 'morningstar', n: 'Morning star', e: 'Morningstar', c: 'martial', d: '1d8', t: 'perforanti', p: [] },
  { k: 'pike', n: 'Picca', e: 'Pike', c: 'martial', d: '1d10', t: 'perforanti', p: ['heavy', 'reach', 'twohanded'] },
  { k: 'rapier', n: 'Stocco', e: 'Rapier', c: 'martial', d: '1d8', t: 'perforanti', p: ['finesse'] },
  { k: 'scimitar', n: 'Scimitarra', e: 'Scimitar', c: 'martial', d: '1d6', t: 'taglienti', p: ['finesse', 'light'] },
  { k: 'shortsword', n: 'Spada corta', e: 'Shortsword', c: 'martial', d: '1d6', t: 'perforanti', p: ['finesse', 'light'] },
  { k: 'trident', n: 'Tridente', e: 'Trident', c: 'martial', d: '1d6', v: '1d8', t: 'perforanti', p: ['thrown', 'versatile'], r: '6/18' },
  { k: 'warpick', n: 'Piccone da guerra', e: 'War Pick', c: 'martial', d: '1d8', t: 'perforanti', p: [] },
  { k: 'warhammer', n: 'Martello da guerra', e: 'Warhammer', c: 'martial', d: '1d8', v: '1d10', t: 'contundenti', p: ['versatile'] },
  { k: 'whip', n: 'Frusta', e: 'Whip', c: 'martial', d: '1d4', t: 'taglienti', p: ['finesse', 'reach'] },
  { k: 'blowgun', n: 'Cerbottana', e: 'Blowgun', c: 'martial', ranged: true, d: '1', t: 'perforanti', p: ['ammunition', 'loading'], r: '7,5/30' },
  { k: 'handcrossbow', n: 'Balestra a mano', e: 'Hand Crossbow', c: 'martial', ranged: true, d: '1d6', t: 'perforanti', p: ['ammunition', 'light', 'loading'], r: '9/36' },
  { k: 'heavycrossbow', n: 'Balestra pesante', e: 'Heavy Crossbow', c: 'martial', ranged: true, d: '1d10', t: 'perforanti', p: ['ammunition', 'heavy', 'loading', 'twohanded'], r: '30/120' },
  { k: 'longbow', n: 'Arco lungo', e: 'Longbow', c: 'martial', ranged: true, d: '1d8', t: 'perforanti', p: ['ammunition', 'heavy', 'twohanded'], r: '45/180' },
  { k: 'net', n: 'Rete', e: 'Net', c: 'martial', ranged: true, d: '', t: '', p: ['special', 'thrown'], r: '1,5/4,5' },
  { k: 'unarmed', n: 'Colpo senz\'armi', e: 'Unarmed Strike', c: 'unarmed', d: '1', t: 'contundenti', p: [] }
];
const WEAPON_PROPERTY_LABELS = {
  finesse: 'accurata', light: 'leggera', heavy: 'pesante', thrown: 'da lancio', twohanded: 'a due mani', versatile: 'versatile',
  ammunition: 'munizioni', loading: 'ricarica', reach: 'portata', special: 'speciale'
};
const WEAPON_GROUPS = [
  ['Armi semplici da mischia', w => w.c === 'simple' && !w.ranged], ['Armi semplici a distanza', w => w.c === 'simple' && w.ranged],
  ['Armi da guerra da mischia', w => w.c === 'martial' && !w.ranged], ['Armi da guerra a distanza', w => w.c === 'martial' && w.ranged],
  ['Senz\'armi', w => w.c === 'unarmed']
];
// Competenze nelle armi per classe: "simple", "martial", "martial:<proprietà>" o la chiave di un'arma
const CLASS_WEAPON_PROFS = {
  2014: {
    Bardo: ['simple', 'handcrossbow', 'longsword', 'rapier', 'shortsword'], Chierico: ['simple'], Warlock: ['simple'],
    Druido: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'],
    Ladro: ['simple', 'handcrossbow', 'longsword', 'rapier', 'shortsword'], Monaco: ['simple', 'shortsword'],
    Mago: ['dagger', 'dart', 'sling', 'quarterstaff', 'lightcrossbow'], Stregone: ['dagger', 'dart', 'sling', 'quarterstaff', 'lightcrossbow']
  },
  2024: {
    Bardo: ['simple'], Chierico: ['simple'], Druido: ['simple'], Mago: ['simple'], Stregone: ['simple'], Warlock: ['simple'],
    Ladro: ['simple', 'martial:finesse', 'martial:light'], Monaco: ['simple', 'martial:light']
  }
};
const ALL_WEAPONS_CLASSES = ['Barbaro', 'Guerriero', 'Paladino', 'Ranger'];

function srdWeapon(key) {
  return SRD_WEAPONS.find(w => w.k === key) || null;
}

// Riconosce un'arma dal nome scritto sulla scheda ("Longsword +1", "Spada Corta", "Crossbow, Light")
function findSrdWeapon(...names) {
  for (const name of names) {
    const key = normalizeSearchText(name).replace(/\+\d/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
    if (!key) continue;
    const hit = SRD_WEAPONS.find(w => [w.n, w.e].some(x => normalizeSearchText(x).replace(/[^a-z]/g, '') === key))
      || SRD_WEAPONS.find(w => normalizeSearchText(w.e).split(' ').reverse().join('').replace(/[^a-z]/g, '') === key);
    if (hit) return hit;
  }
  return null;
}

// Addestramento nelle armi della razza (nani ed elfi delle regole 2014)
function raceWeaponProfs(race) {
  const r = normalizeSearchText(race);
  if (/nano|dwarf/.test(r)) return ['battleaxe', 'handaxe', 'lighthammer', 'warhammer'];
  if (/drow/.test(r)) return ['rapier', 'shortsword', 'handcrossbow'];
  if (/\belf/.test(r) && !/half|mezz/.test(r)) return ['longsword', 'shortsword', 'shortbow', 'longbow'];
  return [];
}

function weaponProficient(ch, w, rules) {
  if (w.c === 'unarmed') return true;
  const profs = raceWeaponProfs(ch.race);
  srdClassKeys(ch.className).forEach(cls => {
    profs.push(...(ALL_WEAPONS_CLASSES.includes(cls) ? ['simple', 'martial'] : CLASS_WEAPON_PROFS[rules]?.[cls] || CLASS_WEAPON_PROFS[2014][cls] || []));
  });
  return profs.some(x => x === w.c || x === w.k || (x.startsWith(`${w.c}:`) && w.p.includes(x.split(':')[1])));
}

// Arti marziali del monaco: dado e armi che può usare con la Destrezza
function martialArtsDie(level, rules) {
  const step = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
  return rules === '2024' ? ['1d6', '1d8', '1d10', '1d12'][step] : ['1d4', '1d6', '1d8', '1d10'][step];
}

function isMonkWeapon(w, rules) {
  if (w.c === 'unarmed') return true;
  if (w.ranged || w.p.includes('heavy') || w.p.includes('twohanded')) return false;
  return w.c === 'simple' || (rules === '2024' ? w.p.includes('light') : w.k === 'shortsword');
}

function dieSides(die) {
  const m = String(die).match(/^(\d+)d(\d+)$/);
  return m ? parseInt(m[1], 10) * parseInt(m[2], 10) : parseInt(die, 10) || 0;
}

function damageWithBonus(die, bonus) {
  if (!die) return '';
  if (/^\d+$/.test(die)) return String(Math.max(0, parseInt(die, 10) + bonus));
  return bonus ? `${die}${formatSignedMod(bonus)}` : die;
}

// Tiro per colpire e danni di un'arma del personaggio ({ k, magic, prof, name })
function weaponStats(ch, entry, rules = campaignRules()) {
  const w = srdWeapon(entry.k);
  if (!w) return null;
  const mods = { FOR: getAbilityMod(ch.abilities.FOR), DES: getAbilityMod(ch.abilities.DES) };
  const monk = srdClassKeys(ch.className).includes('Monaco') && isMonkWeapon(w, rules);
  let ability = w.ranged ? 'DES' : 'FOR';
  if (w.p.includes('finesse') || monk) ability = mods.DES > mods.FOR ? 'DES' : 'FOR';
  const magic = clampInt(entry.magic, 0, 3, 0);
  const proficient = typeof entry.prof === 'boolean' ? entry.prof : weaponProficient(ch, w, rules);
  const bonus = mods[ability] + magic;
  const monkDie = monk ? martialArtsDie(ch.level, rules) : '';
  const bigger = die => (monkDie && dieSides(monkDie) > dieSides(die) ? monkDie : die);
  return {
    w, ability, proficient, magic,
    name: entry.name || `${w.n}${magic ? ` +${magic}` : ''}`,
    hit: bonus + (proficient ? getProficiencyBonus(ch.level) : 0),
    damage: damageWithBonus(bigger(w.d), bonus),
    damage2: w.v ? damageWithBonus(bigger(w.v), bonus) : ''
  };
}

function weaponOptionsHtml(selected = '') {
  return WEAPON_GROUPS.map(([label, test]) => `<optgroup label="${label}">${SRD_WEAPONS.filter(test)
    .map(w => `<option value="${w.k}" ${w.k === selected ? 'selected' : ''}>${escapeHtml(w.n)} (${w.d ? escapeHtml(w.d) : '—'})</option>`).join('')}</optgroup>`).join('');
}

// Campo di ricerca dei mostri con elenco di risultati cliccabili
// Icone pronte dei mostri comuni (vedi bestiary.js), con lo sfondo colorato per famiglia
const BESTIARY_COLORS = { Umanoidi: ['#a8743d', '#4a2f14'], 'Non morti': ['#6f6a8f', '#24212f'], Bestie: ['#5f8f45', '#22381a'], Mostri: ['#a23a3a', '#3d1212'] };
const bestiaryIconCache = new Map();

function commonMonsterIcon(srd) {
  const i = Number(srd);
  if (bestiaryIconCache.has(i)) return bestiaryIconCache.get(i);
  const m = typeof COMMON_MONSTERS !== 'undefined' ? COMMON_MONSTERS.find(x => x.i === i) : null;
  let url = null;
  if (m) {
    const [c1, c2] = BESTIARY_COLORS[m.g] || BESTIARY_COLORS.Mostri;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs><rect width="512" height="512" fill="url(#g)"/><path transform="translate(80 80) scale(0.6875)" fill="#f6eedb" d="${m.d}"/></svg>`;
    url = `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}`;
  }
  bestiaryIconCache.set(i, url);
  return url;
}

function renderMonsterGallery(containerId, onPick) {
  const box = $(containerId);
  if (!box || box.dataset.ready) return;
  box.dataset.ready = '1';
  const groups = [...new Set(COMMON_MONSTERS.map(m => m.g))];
  box.innerHTML = groups.map(g => `
    <div class="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mt-1">${escapeHtml(g)}</div>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">${COMMON_MONSTERS.filter(m => m.g === g).map(m => `
      <button type="button" class="monster-tile" data-i="${m.i}" title="${escapeHtml(m.n)} · GS ${escapeHtml(m.cr)}">
        <span class="avatar avatar-lg" style="background-image:url('${commonMonsterIcon(m.i)}')"></span>
        <span class="truncate w-full">${escapeHtml(m.n)}</span>
        <span class="text-[9px] font-normal text-[var(--muted)]">GS ${escapeHtml(m.cr)}</span>
      </button>`).join('')}</div>`).join('');
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('.monster-tile');
    if (!b) return;
    try {
      await loadSrd('monsters');
    } catch (err) {
      showToast(srdUnavailableMessage(), 4000);
      return;
    }
    const m = srdMonster(Number(b.dataset.i));
    if (m) onPick(m);
  });
}

function bindMonsterSearch(inputId, resultsId, onPick) {
  const input = $(inputId);
  const box = $(resultsId);
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) { box.innerHTML = ''; return; }
    try {
      await loadSrd('monsters');
    } catch (e) {
      box.innerHTML = `<div class="text-[11px] text-[var(--danger)]">${escapeHtml(srdUnavailableMessage())}</div>`;
      return;
    }
    const res = searchSrdList(SRD.monsters, q, 10);
    box.innerHTML = res.length ? res.map(m => `
      <button type="button" class="btn text-xs justify-between w-full srd-pick" data-i="${m.i}">
        <span class="truncate">${escapeHtml(m.n)}${m.n !== m.e ? ` <span class="text-[var(--muted)]">· ${escapeHtml(m.e)}</span>` : ''}</span>
        <span class="text-[10px] text-[var(--muted)] whitespace-nowrap">GS ${escapeHtml(m.cr)} · CA ${m.ca} · PF ${m.hp}</span>
      </button>`).join('') : '<div class="text-[11px] text-[var(--muted)]">Nessun mostro trovato.</div>';
  }, 150);
  input.addEventListener('input', run);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.srd-pick');
    const m = b && srdMonster(Number(b.dataset.i));
    if (!m) return;
    box.innerHTML = '';
    input.value = '';
    onPick(m);
  });
}

// Nomi numerati per più copie dello stesso mostro: "Goblin 1", "Goblin 2"…
function numberedNames(base, qty, existingNames) {
  const used = new Set(existingNames);
  const names = [];
  let n = 1;
  for (let i = 0; i < qty; i++) {
    let name = qty > 1 || used.has(base) ? `${base} ${n}` : base;
    while (used.has(name)) { n++; name = `${base} ${n}`; }
    used.add(name);
    names.push(name);
    n++;
  }
  return names;
}
