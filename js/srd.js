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
  Barbaro: { die: 12, saves: ['FOR', 'COS'], skills: { n: 2, from: ['Addestrare Animali', 'Atletica', 'Intimidire', 'Natura', 'Percezione', 'Sopravvivenza'] }, ac: 'barbarian', bonus: 'Ira', features: 'Ira (2 al giorno, +2 ai danni), Difesa senza armatura (CA 10 + DES + COS).', attack: 'Ascia bipenne | +{FOR} | 1d12{FORmod}' },
  Bardo: { die: 8, saves: ['DES', 'CAR'], skills: { n: 3, from: ALL_SKILL_KEYS }, casting: { ability: 'CAR', type: 'full' }, bonus: 'Ispirazione bardica', features: 'Incantesimi, Ispirazione bardica (d6).', attack: 'Stocco | +{DES} | 1d8{DESmod}' },
  Chierico: { die: 8, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Intuizione', 'Medicina', 'Persuasione', 'Religione', 'Storia'] }, casting: { ability: 'SAG', type: 'full' }, bonus: '', features: 'Incantesimi, Dominio divino.', attack: 'Mazza | +{FOR} | 1d6{FORmod}' },
  Druido: { die: 8, saves: ['INT', 'SAG'], skills: { n: 2, from: ['Addestrare Animali', 'Arcano', 'Intuizione', 'Medicina', 'Natura', 'Percezione', 'Religione', 'Sopravvivenza'] }, casting: { ability: 'SAG', type: 'full' }, bonus: '', features: 'Druidico, Incantesimi.', attack: 'Scimitarra | +{DES} | 1d6{DESmod}' },
  Guerriero: { die: 10, saves: ['FOR', 'COS'], skills: { n: 2, from: ['Acrobazia', 'Addestrare Animali', 'Atletica', 'Intimidire', 'Intuizione', 'Percezione', 'Sopravvivenza', 'Storia'] }, bonus: 'Recuperare energie', features: 'Stile di combattimento, Recuperare energie (1d10 + livello PF, azione bonus).', attack: 'Spada lunga | +{FOR} | 1d8{FORmod}' },
  Ladro: { die: 8, saves: ['DES', 'INT'], skills: { n: 4, from: ['Acrobazia', 'Atletica', 'Furtività', 'Indagare', 'Inganno', 'Intimidire', 'Intrattenere', 'Intuizione', 'Percezione', 'Persuasione', 'Rapidità di Mano'] }, bonus: 'Azione scaltra (dal 2° livello)', features: 'Maestria (2 abilità: segnale nella vista Completa), Attacco furtivo (1d6), Gergo ladresco.', attack: 'Spada corta | +{DES} | 1d6{DESmod}' },
  Mago: { die: 6, saves: ['INT', 'SAG'], skills: { n: 2, from: ['Arcano', 'Indagare', 'Intuizione', 'Medicina', 'Religione', 'Storia'] }, casting: { ability: 'INT', type: 'full' }, bonus: '', features: 'Incantesimi (libro degli incantesimi), Recupero arcano.', attack: 'Pugnale | +{DES} | 1d4{DESmod}' },
  Monaco: { die: 8, saves: ['FOR', 'DES'], skills: { n: 2, from: ['Acrobazia', 'Atletica', 'Furtività', 'Intuizione', 'Religione', 'Storia'] }, ac: 'monk', bonus: 'Colpo senz\'armi (Arti marziali)', features: 'Difesa senza armatura (CA 10 + DES + SAG), Arti marziali (d4).', attack: 'Colpo senz\'armi | +{DES} | 1d4{DESmod}' },
  Paladino: { die: 10, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Atletica', 'Intimidire', 'Intuizione', 'Medicina', 'Persuasione', 'Religione'] }, casting: { ability: 'CAR', type: 'half' }, bonus: '', features: 'Percezione del divino, Imposizione delle mani (5 × livello PF).', attack: 'Spada lunga | +{FOR} | 1d8{FORmod}' },
  Ranger: { die: 10, saves: ['FOR', 'DES'], skills: { n: 3, from: ['Addestrare Animali', 'Atletica', 'Furtività', 'Indagare', 'Intuizione', 'Natura', 'Percezione', 'Sopravvivenza'] }, casting: { ability: 'SAG', type: 'half' }, bonus: '', features: 'Nemico prescelto, Esploratore nato.', attack: 'Arco lungo | +{DES} | 1d8{DESmod}' },
  Stregone: { die: 6, saves: ['COS', 'CAR'], skills: { n: 2, from: ['Arcano', 'Inganno', 'Intimidire', 'Intuizione', 'Persuasione', 'Religione'] }, casting: { ability: 'CAR', type: 'full' }, bonus: '', features: 'Incantesimi, Origine stregonesca.', attack: 'Pugnale | +{DES} | 1d4{DESmod}' },
  Warlock: { die: 8, saves: ['SAG', 'CAR'], skills: { n: 2, from: ['Arcano', 'Indagare', 'Inganno', 'Intimidire', 'Natura', 'Religione', 'Storia'] }, casting: { ability: 'CAR', type: 'pact' }, bonus: '', features: 'Patrono ultraterreno, Magia del patto (gli slot si recuperano col riposo breve).', attack: 'Pugnale | +{DES} | 1d4{DESmod}' }
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

// Slot per livello d'incantesimo (array di 9) per una classe a un certo livello
function classSpellSlots(className, level) {
  const cls = SRD_CLASSES[className];
  const out = new Array(9).fill(0);
  if (!cls?.casting) return out;
  const lv = clampInt(level, 1, 20, 1);
  if (cls.casting.type === 'pact') {
    const count = lv === 1 ? 1 : lv <= 10 ? 2 : lv <= 16 ? 3 : 4;
    const slotLevel = Math.min(5, Math.ceil(lv / 2));
    out[slotLevel - 1] = count;
    return out;
  }
  const table = cls.casting.type === 'full' ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS;
  table[lv - 1].forEach((n, i) => { out[i] = n; });
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
  return SRD_CLASSES[ch.className]?.casting?.ability || 'INT';
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
