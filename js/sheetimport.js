// Scheda del personaggio importata da un PDF o da una foto.
//
// • Le schede compilabili (quella ufficiale, gli export di D&D Beyond…) tengono i valori nei campi del
//   modulo, non nel testo della pagina: li leggiamo con pdf.js. Le schede stampate, scansionate o
//   fotografate diventano immagini delle pagine.
// • Gemini (api/gemini.js, task "sheet") legge campi, testo e immagini e restituisce i dati già in italiano.
//   Senza IA si leggono solo i campi del modulo, qui sul dispositivo, e i testi restano come sono.
// • Prima di creare il personaggio si vede un'anteprima da correggere.

const SHEET_MAX_PAGES = 6;
const SHEET_MAX_IMAGES = 4;
const SHEET_IMAGE_WIDTH = 1300;
const SHEET_MIN_FIELDS = 8;

// Scheda ufficiale compilabile (WotC 2014): le caselle delle competenze si chiamano solo "Check Box N"
const OFFICIAL_SHEET_CHECKS = {
  11: 'ST Strength', 18: 'ST Dexterity', 19: 'ST Constitution', 20: 'ST Intelligence', 21: 'ST Wisdom', 22: 'ST Charisma',
  23: 'Acrobatics', 24: 'Animal Handling', 25: 'Arcana', 26: 'Athletics', 27: 'Deception', 28: 'History', 29: 'Insight',
  30: 'Intimidation', 31: 'Investigation', 32: 'Medicine', 33: 'Nature', 34: 'Perception', 35: 'Performance',
  36: 'Persuasion', 37: 'Religion', 38: 'Sleight of Hand', 39: 'Stealth', 40: 'Survival'
};

// Nomi dei campi (senza spazi e simboli) per la lettura senza IA
const SHEET_ABILITY_FIELDS = {
  str: 'FOR', strength: 'FOR', for: 'FOR', forza: 'FOR', dex: 'DES', dexterity: 'DES', des: 'DES', destrezza: 'DES',
  con: 'COS', constitution: 'COS', cos: 'COS', costituzione: 'COS', int: 'INT', intelligence: 'INT', intelligenza: 'INT',
  wis: 'SAG', wisdom: 'SAG', sag: 'SAG', saggezza: 'SAG', cha: 'CAR', charisma: 'CAR', car: 'CAR', carisma: 'CAR'
};
const SHEET_SAVE_FIELDS = { ststrength: 'FOR', stdexterity: 'DES', stconstitution: 'COS', stintelligence: 'INT', stwisdom: 'SAG', stcharisma: 'CAR' };
// D&D Beyond segna le competenze in campi a parte: "•" nei tiri salvezza, "P" competente, "E" maestria
const SHEET_SAVE_PROF_FIELDS = { ststrength: 'strprof', stdexterity: 'dexprof', stconstitution: 'conprof', stintelligence: 'intprof', stwisdom: 'wisprof', stcharisma: 'chaprof' };
const SHEET_SKILL_FIELDS = {
  acrobatics: 'Acrobazia', animal: 'Addestrare Animali', animalhandling: 'Addestrare Animali', arcana: 'Arcano', athletics: 'Atletica',
  deception: 'Inganno', history: 'Storia', insight: 'Intuizione', intimidation: 'Intimidire', investigation: 'Indagare',
  medicine: 'Medicina', nature: 'Natura', perception: 'Percezione', performance: 'Intrattenere', persuasion: 'Persuasione',
  religion: 'Religione', sleightofhand: 'Rapidità di Mano', stealth: 'Furtività', survival: 'Sopravvivenza'
};
const SHEET_CLASSES_EN = {
  barbarian: 'Barbaro', bard: 'Bardo', cleric: 'Chierico', druid: 'Druido', fighter: 'Guerriero', monk: 'Monaco', paladin: 'Paladino',
  ranger: 'Ranger', rogue: 'Ladro', sorcerer: 'Stregone', warlock: 'Warlock', wizard: 'Mago', artificer: 'Artefice'
};
const SHEET_RACES_EN = {
  'high elf': 'Elfo (Alto Elfo)', 'wood elf': 'Elfo (dei Boschi)', 'dark elf': 'Elfo (Drow)', drow: 'Elfo (Drow)',
  'hill dwarf': 'Nano (delle Colline)', 'mountain dwarf': 'Nano (delle Montagne)', 'rock gnome': 'Gnomo (delle Rocce)',
  'forest gnome': 'Gnomo (delle Foreste)', 'lightfoot halfling': 'Halfling (Piedelesto)', 'stout halfling': 'Halfling (Tozzo)',
  'half elf': 'Mezzelfo', 'half orc': 'Mezzorco', dragonborn: 'Dragonide', tiefling: 'Tiefling', human: 'Umano',
  elf: 'Elfo', dwarf: 'Nano', gnome: 'Gnomo', halfling: 'Halfling'
};
const SHEET_DAMAGE_EN = {
  piercing: 'perforanti', slashing: 'taglienti', bludgeoning: 'contundenti', fire: 'fuoco', cold: 'freddo', lightning: 'fulmine',
  thunder: 'tuono', acid: 'acido', poison: 'veleno', necrotic: 'necrotici', radiant: 'radiosi', force: 'forza', psychic: 'psichici'
};
// Monete inglesi (cp, sp…) → italiane (mr, ma…)
const SHEET_COINS = [['cp', 'mr'], ['sp', 'ma'], ['ep', 'me'], ['gp', 'mo'], ['pp', 'mp']];

// ---------------------------------------------------------------------------
// Lettura del file
// ---------------------------------------------------------------------------

// I valori dei campi si leggono pagina per pagina: gli export di D&D Beyond hanno i campi
// sulle pagine ma non nell'elenco del modulo, quindi getFieldObjects() non li vede
async function readPdfFormFields(pdf) {
  const widgets = [];
  for (let i = 1; i <= Math.min(pdf.numPages, SHEET_MAX_PAGES); i++) {
    const annots = await (await pdf.getPage(i)).getAnnotations().catch(() => []);
    widgets.push(...annots.filter(a => a.subtype === 'Widget' && a.fieldName));
  }
  const names = new Set(widgets.map(a => a.fieldName.trim()));
  const official = names.has('ST Strength') && names.has('Check Box 23');
  const out = [];
  const seen = new Set();
  widgets.forEach(a => {
    let name = a.fieldName.replace(/\s+/g, ' ').trim();
    let value;
    if (a.checkBox || a.radioButton) {
      if (!a.fieldValue || a.fieldValue === 'Off' || (a.radioButton && a.fieldValue !== a.buttonValue)) return;
      const box = name.match(/^Check Box (\d+)$/i);
      if (box) {
        if (!official || !OFFICIAL_SHEET_CHECKS[box[1]]) return;
        name = `${OFFICIAL_SHEET_CHECKS[box[1]]} proficiency`;
      }
      value = a.radioButton ? String(a.fieldValue) : '✓';
    } else if (a.fieldType === 'Tx' || a.fieldType === 'Ch') {
      value = String(Array.isArray(a.fieldValue) ? a.fieldValue.join(', ') : a.fieldValue ?? '').trim();
    }
    if (!value || value === '--') return;
    if (official) {
      if (/^SlotsRemaining/i.test(name)) return;
      const slots = name.match(/^SlotsTotal (\d+)$/i);
      if (slots) name = `Spell slots level ${parseInt(slots[1], 10) - 18}`;
    }
    if (seen.has(`${name}\n${value}`)) return;
    seen.add(`${name}\n${value}`);
    out.push({ name, value });
  });
  return out;
}

function canvasToJpeg(canvas) {
  return canvas.toDataURL('image/jpeg', 0.72).split(',')[1] || '';
}

function whiteCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

async function renderPdfPages(pdf) {
  const images = [];
  for (let i = 1; i <= Math.min(pdf.numPages, SHEET_MAX_IMAGES); i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, SHEET_IMAGE_WIDTH / base.width) });
    const { canvas, ctx } = whiteCanvas(viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvasToJpeg(canvas));
  }
  return images;
}

async function imageFileToJpeg(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const { canvas, ctx } = whiteCanvas(bmp.width * scale, bmp.height * scale);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvasToJpeg(canvas);
}

async function readSheetFile(file, onStatus) {
  if (/^image\//.test(file.type)) {
    onStatus('Preparo la foto…');
    try {
      return { fields: [], text: '', images: [await imageFileToJpeg(file)] };
    } catch (e) {
      throw new Error('Non riesco ad aprire questa foto: prova con un JPEG o un PNG');
    }
  }
  onStatus('Carico il lettore PDF…');
  const pdfjs = await loadPdfJs().catch(() => { throw new Error('Non riesco a caricare il lettore PDF: controlla la connessione'); });
  onStatus('Leggo la scheda…');
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    throw new Error(e?.name === 'PasswordException' ? 'Il PDF è protetto da password: toglila e riprova' : 'Il file non sembra un PDF valido');
  }
  const fields = await readPdfFormFields(pdf);
  const pages = [];
  for (let i = 1; i <= Math.min(pdf.numPages, SHEET_MAX_PAGES); i++) pages.push(await pdfPageText(await pdf.getPage(i)));
  // Senza campi compilati la scheda è stampata o scansionata: a Gemini servono le pagine come immagini
  const images = fields.length >= SHEET_MIN_FIELDS ? [] : await renderPdfPages(pdf);
  // Le funzioni di Vercel accettano al massimo 4,5 MB
  while (images.length > 1 && images.reduce((n, img) => n + img.length, 0) > 3800000) images.pop();
  return { fields, text: pages.join('\n\n').slice(0, 30000), images };
}

// ---------------------------------------------------------------------------
// Dalla scheda ai dati del Tavolo
// ---------------------------------------------------------------------------

async function convertSheetSource(src) {
  let aiError = '';
  if (await checkAiAvailability()) {
    try {
      const data = await callAi({ task: 'sheet', fields: src.fields.map(f => `${f.name}: ${f.value}`).join('\n'), text: src.text, images: src.images }, 90000);
      if (data.sheet) return { raw: data.sheet, viaAi: true };
      aiError = 'risposta vuota';
    } catch (e) {
      aiError = e?.name === 'AbortError' ? 'tempo scaduto' : String(e?.message || 'errore').slice(0, 160);
    }
  }
  const reason = (aiError ? `Gemini non ha risposto: ${aiError}` : (App.ai.reason || 'assistente IA non disponibile')).replace(/\.$/, '');
  if (src.fields.length >= SHEET_MIN_FIELDS) return { raw: parseSheetFields(src.fields), viaAi: false, reason };
  throw new Error(`${reason}. Senza IA si leggono solo i PDF compilabili (con i campi del modulo), e questa scheda ${src.images.length ? 'è stampata, scansionata o fotografata' : 'non ha campi compilati'}.`);
}

function fieldKey(name) {
  return normalizeSearchText(name).replace(/[^a-z0-9]/g, '');
}

function sheetNumber(value) {
  const m = String(value ?? '').replace(/[−–]/g, '-').match(/[+-]?\s*\d+/);
  return m ? parseInt(m[0].replace(/\s/g, ''), 10) : null;
}

// Sostituisce le parole inglesi note (classi, razze) lasciando il resto com'è
function translateWords(text, dict) {
  const s = String(text || '').trim();
  const exact = dict[normalizeSearchText(s).replace(/[^a-z]+/g, ' ').trim()];
  if (exact) return exact;
  return s.replace(/[A-Za-z]+/g, w => dict[w.toLowerCase()] || w);
}

function parseClassLevel(text) {
  const parts = [...String(text || '').matchAll(/([^\d/,;]+?)\s*(\d{1,2})/g)].map(m => ({ cls: translateWords(m[1], SHEET_CLASSES_EN), level: parseInt(m[2], 10) }));
  if (!parts.length) return { className: translateWords(text, SHEET_CLASSES_EN), level: null };
  return {
    className: parts.length === 1 ? parts[0].cls : parts.map(p => `${p.cls} ${p.level}`).join(' / '),
    level: parts.reduce((n, p) => n + p.level, 0)
  };
}

// "1d8+3 slashing" → formula valida per i dadi del Tavolo e tipo di danno
function splitDamage(text) {
  const s = String(text || '').trim();
  const m = s.match(/^[\dd+\-−\s]+/i);
  const formula = m ? m[0].replace(/\s+/g, '').replace(/−/g, '-').replace(/[+-]$/, '') : '';
  const valid = formula && parseDiceFormula(formula) ? formula : '';
  const rest = s.slice(valid ? m[0].length : 0).replace(/^[\s,;]+/, '');
  return { formula: valid, type: rest.replace(/[A-Za-z]+/g, w => SHEET_DAMAGE_EN[w.toLowerCase()] || w) };
}

function profMark(value) {
  const v = String(value || '').trim().toUpperCase();
  return !v || v === 'H' ? 0 : v === 'E' ? 2 : 1;
}

function parseSpeed(text) {
  const n = parseFloat(String(text || '').replace(',', '.'));
  if (isNaN(n)) return null;
  if (/\bm\b|metri/i.test(text) && !/ft|feet|piedi/i.test(text)) return n;
  return n > 20 || /ft|feet|piedi|'/i.test(text) ? n * 0.3 : n;
}

// Lettura senza IA: solo i campi del modulo, con i nomi della scheda ufficiale e delle più diffuse
function parseSheetFields(list) {
  const f = new Map();
  list.forEach(({ name, value }) => { const k = fieldKey(name); if (k && !f.has(k)) f.set(k, value); });
  const pick = (...keys) => keys.map(k => f.get(k)).find(Boolean) || '';
  const all = re => [...f].filter(([k]) => re.test(k)).map(([, v]) => v);
  const cls = parseClassLevel(pick('classlevel', 'classelivello', 'class', 'classe'));

  const abilities = {};
  Object.entries(SHEET_ABILITY_FIELDS).forEach(([k, ab]) => {
    const n = sheetNumber(f.get(k));
    if (abilities[ab] === undefined && n !== null) abilities[ab] = n;
  });
  const savingThrows = Object.entries(SHEET_SAVE_FIELDS).map(([k, ab]) => ({
    ability: ab, bonus: sheetNumber(f.get(k)), proficiency: profMark(f.get(`${k}proficiency`) || f.get(SHEET_SAVE_PROF_FIELDS[k])) ? 1 : 0
  }));
  const skills = Object.entries(SHEET_SKILL_FIELDS)
    .filter(([k]) => f.has(k) || f.has(`${k}proficiency`) || f.has(`${k}prof`))
    .map(([k, skill]) => ({ skill, bonus: sheetNumber(f.get(k)), proficiency: profMark(f.get(`${k}proficiency`) || f.get(`${k}prof`)) }));
  const attacks = [1, 2, 3, 4, 5, 6, 7, 8].map(n => {
    const name = pick(n === 1 ? 'wpnname' : `wpnname${n}`, `wpn${n}name`);
    const dmg = splitDamage(pick(`wpn${n}damage`));
    return name ? { name, englishName: name, bonus: sheetNumber(pick(`wpn${n}atkbonus`)), damage: dmg.formula, damageType: dmg.type } : null;
  }).filter(Boolean);
  const spellAbility = SHEET_ABILITY_FIELDS[fieldKey(all(/^spellcastingability\d*$/)[0] || '')] || null;
  const spellSlots = [...f].map(([k, v]) => [k.match(/^spellslotslevel(\d)$/), v]).filter(([m]) => m).map(([m, v]) => ({ level: parseInt(m[1], 10), max: sheetNumber(v) || 0 }));
  const spells = all(/^(spells|spellname)\d+$/).filter(v => /[a-z]/i.test(v) && v.length < 60).map(v => ({ name: v, englishName: v, level: null }));
  const coins = Object.fromEntries(SHEET_COINS.map(([k]) => [k, parseInt(String(f.get(k) || '').replace(/[.,\s]/g, ''), 10) || 0]));
  const look = [['age', 'Età'], ['height', 'Altezza'], ['weight', 'Peso'], ['eyes', 'Occhi'], ['skin', 'Carnagione'], ['hair', 'Capelli']]
    .filter(([k]) => f.get(k)).map(([k, label]) => `${label}: ${f.get(k)}`).join(' · ');
  const hd = `${pick('hd')} ${pick('hdtotal', 'hitdice', 'dadivita')} ${pick('total')}`.match(/d\s*(\d+)/i);
  // Equipaggiamento delle schede di D&D Beyond: nome, quantità e peso della riga in libbre
  const items = [...f].map(([k, v]) => [k.match(/^eqname(\d+)$/), v]).filter(([m, v]) => m && String(v).trim()).map(([m, v]) => {
    const it = itemFromText(v);
    it.qty = Math.max(1, parseInt(String(f.get(`eqqty${m[1]}`) || '').replace(/[.,\s]/g, ''), 10) || it.qty);
    const lb = parseItNumber(String(f.get(`eqweight${m[1]}`) || '').replace(/[^\d.,]/g, ''));
    if (!it.k && lb > 0) it.wt = Math.round((lb * 0.5 * 1000) / it.qty) / 1000;
    return it;
  });
  const xp = pick('xp', 'experiencepoints');

  return {
    name: pick('charactername', 'name', 'nome', 'nomepersonaggio'),
    race: translateWords(pick('race', 'razza', 'species', 'specie'), SHEET_RACES_EN),
    className: cls.className,
    level: cls.level || sheetNumber(pick('level', 'livello')),
    background: pick('background'),
    alignment: pick('alignment', 'allineamento'),
    abilities, savingThrows, skills, attacks, spellSlots, spells,
    proficiencyBonus: sheetNumber(pick('profbonus', 'proficiencybonus', 'bonuscompetenza')),
    maxHp: sheetNumber(pick('hpmax', 'maxhp', 'hitpointmaximum', 'pfmax')),
    ac: sheetNumber(pick('ac', 'armorclass', 'ca', 'classearmatura')),
    speedMeters: parseSpeed(pick('speed', 'velocita')),
    hitDie: hd ? `d${hd[1]}` : '',
    spellcastingAbility: spellAbility,
    equipment: pick('equipment', 'equipaggiamento'), items, coins,
    features: [pick('featuresandtraits', 'features'), ...all(/^featurestraits\d+$/), pick('feattraits'),
      pick('defenses') && `Difese: ${pick('defenses')}`, pick('savemodifiers') && `Tiri salvezza: ${pick('savemodifiers')}`,
      pick('additionalsenses') && `Sensi: ${pick('additionalsenses')}`].filter(Boolean).join('\n\n'),
    proficiencies: pick('proficiencieslang', 'proficiencies'),
    story: {
      text: pick('backstory', 'storia'), look, traits: pick('personalitytraits', 'tratti'),
      ideals: pick('ideals', 'ideali'), bonds: pick('bonds', 'legami'), flaws: pick('flaws', 'difetti')
    },
    notes: [...all(/^additionalnotes\d*$/), xp && `Punti esperienza: ${xp}`, pick('allies') && `Alleati: ${pick('allies')}`, pick('factionname') && `Fazione: ${pick('factionname')}`, pick('treasure') && `Tesoro: ${pick('treasure')}`].filter(Boolean).join('\n'),
    warnings: []
  };
}

function spellKey(name) {
  return normalizeSearchText(name).replace(/[^a-z0-9]+/g, ' ').trim();
}

// Dal bonus scritto sulla scheda si ricava la competenza; i segni sulla scheda contano di più
// (un'aura del paladino alza tutti i TS senza dare competenza), la maestria si vede solo dal bonus
function importedProficiencies(entries, keyOf, modOf, prof) {
  const out = {};
  const marked = entries.some(e => Number(e?.proficiency) > 0);
  entries.forEach(e => {
    const key = e && keyOf(e);
    if (!key) return;
    const bonus = parseInt(e.bonus, 10);
    const diff = isNaN(bonus) ? null : bonus - modOf(key);
    const fromBonus = diff === null ? 0 : diff >= 2 * prof ? 2 : diff >= prof ? 1 : 0;
    let level = marked ? clampInt(e.proficiency, 0, 2, 0) : fromBonus;
    if (level === 1 && fromBonus === 2) level = 2;
    if (level) out[key] = Math.max(level, out[key] || 0);
  });
  return out;
}

async function buildImportedCharacter(raw, rules = campaignRules()) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
  const list = v => (Array.isArray(v) ? v : []);
  const warnings = list(raw.warnings).map(w => str(w, 200)).filter(Boolean).slice(0, 8);

  const level = clampInt(raw.level, 1, 20, 1);
  const abilities = {};
  ABILITY_KEYS.forEach(k => { abilities[k] = clampInt(raw.abilities?.[k], 1, 30, 10); });
  const sheetProf = parseInt(raw.proficiencyBonus, 10);
  const prof = sheetProf >= 2 && sheetProf <= 6 ? sheetProf : getProficiencyBonus(level);
  const modOf = ab => getAbilityMod(abilities[ab]);

  let className = str(raw.className, 80) || 'Avventuriero';
  const baseClass = className.includes('/') ? null : srdClassKey(className);
  // Con la sola classe base funzionano slot, armi e passaggio di livello; il resto finisce nei privilegi
  const classExtra = baseClass && className.replace(/^\S+\s*/, '') ? `Classe: ${className}` : '';
  if (baseClass) className = baseClass;
  const race = str(raw.race, 80);

  const savingThrowsProf = {};
  Object.keys(importedProficiencies(list(raw.savingThrows), e => (ABILITY_KEYS.includes(e.ability) ? e.ability : null), modOf, prof))
    .forEach(k => { savingThrowsProf[k] = true; });
  const skillsProf = importedProficiencies(list(raw.skills), e => (ALL_SKILL_KEYS.includes(e.skill) ? e.skill : null),
    key => modOf(DND5E_SKILLS.find(s => s.key === key).ability), prof);

  // Incantesimi: quelli del regolamento base diventano lanciabili, gli altri restano nel testo
  const wanted = list(raw.spells).filter(s => s && (s.name || s.englishName)).slice(0, 80);
  const srd = wanted.length ? await loadSrd('spells').catch(() => null) : null;
  const byName = new Map();
  (srd || []).forEach(s => { byName.set(spellKey(s.e), s); byName.set(spellKey(s.n), s); });
  const spellRules = classSpellRules({ className, level, abilities }, rules);
  // Chi prepara (chierico, druido, paladino, mago): i preparati seguono la scheda, altrimenti i primi che ci stanno
  const caster = { className, level, abilities, spellAbility: ABILITY_KEYS.includes(raw.spellcastingAbility) ? raw.spellcastingAbility : null, spells: [] };
  const prepares = Boolean(spellPrepMode(caster));
  const maxPrepared = prepares ? maxPreparedSpells(caster) : 0;
  const flagged = wanted.some(s => typeof s.prepared === 'boolean');
  const spells = [];
  const matchedSpells = [];
  const otherSpells = [];
  wanted.forEach(s => {
    const hit = byName.get(spellKey(s.englishName)) || byName.get(spellKey(s.name));
    if (!hit) {
      const lv = parseInt(s.level, 10);
      otherSpells.push(`${str(s.name || s.englishName, 80)}${lv === 0 ? ' (trucchetto)' : lv > 0 ? ` (${lv}° livello)` : ''}`);
      return;
    }
    if (spells.some(x => x.i === hit.i)) return;
    const entry = { i: hit.i, prep: true, always: false };
    // Fuori dall'elenco della classe (razza, talenti…): sempre pronto e non conta nei limiti
    if (spellRules && !hit.cl.includes(spellRules.cls)) Object.assign(entry, { x: true, always: true });
    else if (prepares && hit.lv > 0) {
      entry.prep = flagged ? s.prepared === true : spells.filter(x => x.prep && !x.always && srdSpell(x.i)?.lv > 0).length < maxPrepared;
    }
    spells.push(entry);
    matchedSpells.push(`${hit.n}${entry.x ? ' (extra)' : ''}`);
  });
  if (wanted.length && !srd) warnings.push('Non sono riuscito a caricare l\'elenco degli incantesimi: li trovi scritti nella scheda, aggiungili da “📖 Incantesimi”.');

  // Armi del manuale: tiro e danni li calcola la scheda; la competenza segue quella scritta sulla scheda
  const spellNames = new Set(wanted.flatMap(s => [spellKey(s.name), spellKey(s.englishName)]).filter(Boolean));
  const who = { abilities, level, className, race };
  const weapons = [];
  const otherAttacks = [];
  list(raw.attacks).slice(0, 12).forEach(a => {
    const name = str(a?.name, 80).replace(/\|/g, '/');
    if (!name) return;
    const dmg = splitDamage(a.damage);
    const w = findSrdWeapon(a.englishName, name);
    if (w) {
      const entry = { k: w.k, magic: clampInt((`${a.englishName || ''} ${name}`.match(/\+([1-3])\b/) || [])[1], 0, 3, 0), prof: null, name: '' };
      const auto = weaponStats(who, entry, rules);
      const bonus = parseInt(a.bonus, 10);
      if (!isNaN(bonus) && bonus !== auto.hit) {
        const flip = weaponStats(who, Object.assign({}, entry, { prof: !auto.proficient }), rules);
        if (flip.hit === bonus) entry.prof = flip.proficient;
      }
      const st = weaponStats(who, entry, rules);
      const diff = [];
      if (!isNaN(bonus) && bonus !== st.hit) diff.push(`colpire ${formatSignedMod(bonus)} sulla scheda, ${formatSignedMod(st.hit)} calcolato`);
      if (dmg.formula && dmg.formula !== st.damage && dmg.formula !== st.damage2) diff.push(`danni ${dmg.formula} sulla scheda, ${st.damage} calcolati`);
      if (diff.length) warnings.push(`${st.name}: ${diff.join('; ')}. Controlla l'arma nella scheda (magica? competenza? stile di combattimento?).`);
      weapons.push(entry);
      return;
    }
    // I trucchetti d'attacco (es. Dardo di Fuoco) stanno già negli incantesimi
    if (spellNames.has(spellKey(name)) || spellNames.has(spellKey(a.englishName))) return;
    const type = str(a.damageType, 40) || dmg.type;
    const bonus = parseInt(a.bonus, 10);
    otherAttacks.push(`${name}${type ? ` (${type})` : ''} | ${isNaN(bonus) ? '' : formatSignedMod(bonus)} | ${dmg.formula}`);
  });

  const spellSlots = createEmptySpellSlots();
  list(raw.spellSlots).forEach(s => {
    const lvl = parseInt(s?.level, 10);
    if (lvl >= 1 && lvl <= 9) spellSlots[lvl] = { max: clampInt(s.max, 0, 9, 0), used: 0 };
  });
  if (!Object.values(spellSlots).some(s => s.max) && baseClass) {
    classSpellSlots(baseClass, level, rules).forEach((n, i) => { spellSlots[i + 1] = { max: n, used: 0 }; });
  }

  const die = str(raw.hitDie, 20).match(/d\s*(\d+)/i);
  const speed = Number(raw.speedMeters);
  const maxHp = clampInt(raw.maxHp, 0, 999, 0);
  const ac = clampInt(raw.ac, 0, 40, 0);
  if (!maxHp) warnings.push('Non ho trovato i PF massimi: controllali.');
  if (!ac) warnings.push('Non ho trovato la Classe Armatura: controllala.');
  const story = {};
  STORY_FIELDS.forEach(([key]) => { const v = str(raw.story?.[key]); if (v) story[key] = v; });

  return {
    warnings, matchedSpells, otherSpells, hasStory: Object.keys(story).length > 0,
    fields: {
      name: str(raw.name, 80), race, className, level, background: str(raw.background, 80),
      bonusAction: str(raw.bonusAction, 120),
      maxHp: maxHp || 10, hp: maxHp || 10, ac: ac || 10,
      speed: speed > 0 && speed <= 60 ? Math.round(speed * 2) / 2 : (SRD_RACES[str(raw.race)]?.speed || 9),
      hitDie: die ? `d${die[1]}` : `d${SRD_CLASSES[baseClass]?.die || 8}`, hitDiceRemaining: level,
      abilities, savingThrowsProf, skillsProf, weapons, attacksText: otherAttacks.join('\n'), spells, spellSlots,
      spellAbility: ABILITY_KEYS.includes(raw.spellcastingAbility) ? raw.spellcastingAbility : null,
      spellsText: otherSpells.map(s => `• ${s}`).join('\n'),
      // Una riga per oggetto; quelli del manuale prendono peso e costo dal manuale
      items: [...list(raw.items), ...itemsFromText(str(raw.equipment, 20000))].slice(0, 300).map(normalizeItem),
      coins: Object.fromEntries(SHEET_COINS.map(([en, it]) => [it, clampInt(raw.coins?.[en], 0, 9999999, 0)])),
      featuresText: [classExtra, str(raw.features, 20000), raw.proficiencies ? `Competenze e linguaggi:\n${str(raw.proficiencies, 2000)}` : ''].filter(Boolean).join('\n\n'),
      notes: [raw.alignment ? `Allineamento: ${str(raw.alignment, 60)}` : '', str(raw.notes, 3000)].filter(Boolean).join('\n'),
      story
    }
  };
}

// ---------------------------------------------------------------------------
// Finestra di importazione
// ---------------------------------------------------------------------------

function startSheetImport(file, purpose, campId) {
  const token = (App.sheetImportToken || 0) + 1;
  App.sheetImportToken = token;
  App.sheetImport = { token, purpose, campId };
  setText('sheetImportFileName', file.name || 'Scheda');
  showEl('modalSheetImport', true);
  runSheetImport(file, token);
}

async function runSheetImport(file, token) {
  const live = () => App.sheetImport?.token === token && !$('modalSheetImport').classList.contains('hidden');
  const status = text => { if (live()) renderSheetImportStatus(text); };
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('Il file è troppo grande (massimo 25 MB)');
    const src = await readSheetFile(file, status);
    if (!live()) return;
    if (App.ai.available) status(src.images.length ? 'Gemini legge le pagine della scheda e le traduce… (può volerci fino a un minuto)' : 'Gemini traduce la scheda in italiano…');
    const conv = await convertSheetSource(src);
    if (!live()) return;
    status('Preparo il personaggio…');
    const built = await buildImportedCharacter(conv.raw, campaignRules(App.sheetImport.campId));
    if (!live()) return;
    Object.assign(App.sheetImport, built, { viaAi: conv.viaAi, reason: conv.reason || '' });
    renderSheetImportPreview();
  } catch (e) {
    if (live()) renderSheetImportError(String(e?.message || e));
  }
}

function renderSheetImportStatus(text) {
  $('sheetImportBody').innerHTML = `<div class="card-surface2 p-6 text-center text-sm font-bold">⏳ ${escapeHtml(text)}</div>`;
  showEl('btnConfirmSheetImport', false);
}

function renderSheetImportError(message) {
  $('sheetImportBody').innerHTML = `
    <div class="card-surface2 p-4 text-sm flex flex-col gap-1.5">
      <strong class="text-[var(--danger)]">⚠️ Non sono riuscito a leggere la scheda</strong>
      <p>${escapeHtml(message)}</p>
      <p class="text-xs text-[var(--muted)]">Prova con un altro file, oppure chiudi e usa la creazione guidata.</p>
    </div>`;
  showEl('btnConfirmSheetImport', false);
}

function renderSheetImportPreview() {
  const st = App.sheetImport;
  const f = st.fields;
  const input = (key, label, value, attrs = '') => `<label class="font-bold text-[var(--muted)]">${label}
    <input data-f="${key}" class="input-field w-full mt-1 font-bold" value="${escapeHtml(String(value))}" ${attrs} /></label>`;
  const longText = (label, text) => (text ? `
    <details class="card-surface2 p-2.5"><summary class="font-bold cursor-pointer">${label}</summary>
      <p class="mt-1.5 whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</p></details>` : '');
  const skills = Object.entries(f.skillsProf).map(([k, v]) => `${k}${v === 2 ? ' ★' : ''}`);
  const slots = Object.entries(f.spellSlots).filter(([, s]) => s.max).map(([l, s]) => `${l}°: ${s.max}`);
  const story = STORY_FIELDS.filter(([key]) => f.story[key]).map(([key, label]) => `${label}\n${f.story[key]}`).join('\n\n');
  $('sheetImportBody').innerHTML = `
    <div class="text-[11px] ${st.viaAi ? 'text-[var(--muted)]' : 'font-bold text-[var(--danger)]'}">${st.viaAi
      ? '✨ Letta e tradotta da Gemini: controlla i numeri prima di confermare.'
      : `📋 Letta dai campi del PDF senza IA, quindi i testi restano nella lingua della scheda (${escapeHtml(st.reason)}).`}</div>
    ${st.warnings.length ? `<div class="card-surface2 p-2.5 border border-[var(--brass)] flex flex-col gap-0.5">${st.warnings.map(w => `<span>⚠️ ${escapeHtml(w)}</span>`).join('')}</div>` : ''}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="col-span-2">${input('name', 'Nome *', f.name, 'type="text"')}</div>
      ${input('race', 'Razza', f.race, 'type="text"')}
      ${input('className', 'Classe', f.className, 'type="text"')}
      ${input('level', 'Livello', f.level, 'type="number" min="1" max="20"')}
      ${input('background', 'Background', f.background, 'type="text"')}
      ${input('maxHp', 'PF massimi', f.maxHp, 'type="number" min="1" max="999"')}
      ${input('ac', 'CA', f.ac, 'type="number" min="1" max="40"')}
      ${input('speed', 'Velocità (m)', f.speed, 'type="number" min="0" max="60" step="0.5"')}
      ${input('hitDie', 'Dado vita', f.hitDie, 'type="text"')}
    </div>
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">${ABILITY_KEYS.map(k => `
      <label class="card-surface2 p-1.5 font-bold"><span class="block text-[10px] text-[var(--muted)]">${k}</span>
        <input data-ab="${k}" type="number" min="1" max="30" class="input-field w-full text-center font-bold py-0.5 px-1" value="${f.abilities[k]}" /></label>`).join('')}</div>
    <div class="card-surface2 p-3 flex flex-col gap-1.5 leading-relaxed">
      <div><strong>Tiri salvezza competenti:</strong> ${escapeHtml(ABILITY_KEYS.filter(k => f.savingThrowsProf[k]).join(', ') || '—')}</div>
      <div><strong>Abilità:</strong> ${escapeHtml(skills.join(', ') || '—')}${skills.some(s => s.endsWith('★')) ? ' <span class="text-[var(--muted)]">(★ maestria)</span>' : ''}</div>
      <div><strong>Armi:</strong> ${escapeHtml(f.weapons.map(e => weaponStats(f, e, campaignRules(st.campId))).map(w => `${w.name} ${formatSignedMod(w.hit)} (${w.damage || '—'})`).join(' · ') || '—')}
        <span class="text-[var(--muted)]">· tiro e danni li calcola la scheda</span></div>
      ${f.attacksText ? `<div><strong>Altri attacchi:</strong> <span class="font-mono whitespace-pre-wrap">${escapeHtml(f.attacksText)}</span></div>` : ''}
      ${st.matchedSpells.length ? `<div><strong>Incantesimi (${st.matchedSpells.length}):</strong> ${escapeHtml(st.matchedSpells.join(', '))}</div>` : ''}
      ${st.otherSpells.length ? `<div><strong>Altri incantesimi</strong> <span class="text-[var(--muted)]">(non sono nel regolamento base: restano scritti nella scheda)</span>: ${escapeHtml(st.otherSpells.join(', '))}</div>` : ''}
      ${slots.length ? `<div><strong>Slot incantesimo:</strong> ${slots.join(' · ')}</div>` : ''}
      <div><strong>Monete:</strong> ${escapeHtml(COIN_KEYS.filter(k => f.coins[k]).map(k => `${f.coins[k]} ${k}`).join(', ') || 'nessuna')}</div>
    </div>
    ${longText(`🎒 Equipaggiamento (${f.items.length})`, f.items.map(it => `${it.qty !== 1 ? `${it.qty} × ` : ''}${it.name}${it.note ? ` — ${it.note}` : ''}`).join('\n'))}
    ${longText('⭐ Privilegi, tratti e competenze', f.featuresText)}
    ${longText('📝 Note', f.notes)}
    ${st.hasStory ? `${longText('📜 Storia e personalità', story)}
    <label class="flex items-start gap-2 cursor-pointer"><input id="sheetImportStory" type="checkbox" checked class="mt-0.5 accent-[var(--felt)]" />
      <span><strong>Importa anche la storia e la personalità.</strong> Saranno visibili a tutti: dalla scheda puoi renderle “solo io e il Master”.</span></label>` : ''}
    <div class="text-[11px] text-[var(--muted)]">Tutto si potrà cambiare anche dopo, dalla scheda del personaggio.</div>`;
  setText('btnConfirmSheetImport', st.purpose === 'onboarding' ? '⚔️ Crea ed entra' : '✅ Crea il personaggio');
  showEl('btnConfirmSheetImport', true);
}

function closeSheetImport() {
  showEl('modalSheetImport', false);
  App.sheetImport = null;
}

async function confirmSheetImport() {
  const st = App.sheetImport;
  if (!st?.fields) return;
  const body = $('sheetImportBody');
  const f = Object.assign({}, st.fields, { abilities: Object.assign({}, st.fields.abilities) });
  body.querySelectorAll('[data-f]').forEach(inp => { f[inp.dataset.f] = inp.value.trim(); });
  body.querySelectorAll('[data-ab]').forEach(inp => { f.abilities[inp.dataset.ab] = clampInt(inp.value, 1, 30, 10); });
  if (!f.name) { showToast('Dai un nome al tuo eroe'); body.querySelector('[data-f="name"]')?.focus(); return; }
  f.level = clampInt(f.level, 1, 20, 1);
  f.hitDiceRemaining = f.level;
  f.maxHp = clampInt(f.maxHp, 1, 999, 10);
  f.hp = f.maxHp;
  f.ac = clampInt(f.ac, 1, 40, 10);
  f.speed = Math.max(0, Math.min(60, parseFloat(String(f.speed).replace(',', '.')) || 9));
  if (!$('sheetImportStory')?.checked) delete f.story;
  closeSheetImport();
  await addNewCharacter(st.purpose, st.campId, f);
}

function initSheetImportEvents() {
  document.querySelectorAll('.sheet-import-input').forEach(inp => inp.addEventListener('change', () => {
    const file = inp.files?.[0];
    inp.value = '';
    if (!file) return;
    // Il pulsante "Un altro file" della finestra riusa lo scopo dell'importazione in corso
    const purpose = inp.dataset.purpose || App.sheetImport?.purpose;
    const campId = inp.dataset.purpose ? (purpose === 'onboarding' ? App.onboardingCampId : App.activeId) : App.sheetImport?.campId;
    if (purpose && campId) startSheetImport(file, purpose, campId);
  }));
  $('btnCloseSheetImport').addEventListener('click', closeSheetImport);
  $('btnConfirmSheetImport').addEventListener('click', confirmSheetImport);
}
