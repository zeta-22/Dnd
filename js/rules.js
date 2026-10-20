// Regole e tabelle di D&D 5e (SRD 2014) e lancio dei dadi.

const ABILITY_KEYS = ['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'];
const ABILITY_LABELS = { FOR: 'Forza', DES: 'Destrezza', COS: 'Costituzione', INT: 'Intelligenza', SAG: 'Saggezza', CAR: 'Carisma' };

const DND5E_SKILLS = [
  { key: 'Acrobazia', label: 'Acrobazia', ability: 'DES' },
  { key: 'Addestrare Animali', label: 'Addestrare Animali', ability: 'SAG' },
  { key: 'Arcano', label: 'Arcano', ability: 'INT' },
  { key: 'Atletica', label: 'Atletica', ability: 'FOR' },
  { key: 'Furtività', label: 'Furtività', ability: 'DES' },
  { key: 'Indagare', label: 'Indagare', ability: 'INT' },
  { key: 'Inganno', label: 'Inganno', ability: 'CAR' },
  { key: 'Intimidire', label: 'Intimidire', ability: 'CAR' },
  { key: 'Intrattenere', label: 'Intrattenere', ability: 'CAR' },
  { key: 'Intuizione', label: 'Intuizione', ability: 'SAG' },
  { key: 'Medicina', label: 'Medicina', ability: 'SAG' },
  { key: 'Natura', label: 'Natura', ability: 'INT' },
  { key: 'Percezione', label: 'Percezione', ability: 'SAG' },
  { key: 'Persuasione', label: 'Persuasione', ability: 'CAR' },
  { key: 'Rapidità di Mano', label: 'Rapidità di Mano', ability: 'DES' },
  { key: 'Religione', label: 'Religione', ability: 'INT' },
  { key: 'Sopravvivenza', label: 'Sopravvivenza', ability: 'SAG' },
  { key: 'Storia', label: 'Storia', ability: 'INT' }
];

const DND5E_CONDITIONS = [
  { name: 'Accecato', desc: 'Non vede e fallisce automaticamente le prove che richiedono la vista. I tiri per colpire contro di lui hanno vantaggio, i suoi hanno svantaggio.' },
  { name: 'Affascinato', desc: 'Non può attaccare chi lo ha affascinato né bersagliarlo con effetti dannosi. Chi lo ha affascinato ha vantaggio nelle prove per interagire socialmente con lui.' },
  { name: 'Afferrato', desc: 'Velocità 0 e nessun bonus alla velocità. Finisce se chi afferra è incapacitato o se un effetto lo allontana dalla sua portata.' },
  { name: 'Assordato', desc: 'Non sente e fallisce automaticamente le prove che richiedono l\'udito.' },
  { name: 'Avvelenato', desc: 'Svantaggio ai tiri per colpire e alle prove di caratteristica.' },
  { name: 'Incapacitato', desc: 'Non può effettuare azioni né reazioni.' },
  { name: 'Invisibile', desc: 'Non può essere visto senza magia o sensi speciali. I tiri per colpire contro di lui hanno svantaggio, i suoi hanno vantaggio.' },
  { name: 'Paralizzato', desc: 'Incapacitato, non può muoversi né parlare. Fallisce i TS di Forza e Destrezza. Gli attacchi contro di lui hanno vantaggio e ogni colpo da entro 1,5 m è un critico.' },
  { name: 'Pietrificato', desc: 'Trasformato in pietra: incapacitato e ignaro di ciò che lo circonda. Attacchi contro con vantaggio, fallisce i TS di FOR e DES, resistenza a tutti i danni, immune a veleno e malattie.' },
  { name: 'Privo di sensi', desc: 'Incapacitato, non si muove né parla, lascia cadere ciò che tiene e cade prono. Fallisce i TS di FOR e DES; attacchi contro con vantaggio, critico se da entro 1,5 m.' },
  { name: 'Prono', desc: 'Può solo strisciare o rialzarsi (costa metà del movimento). Svantaggio ai suoi attacchi. Attacchi contro di lui: vantaggio se da entro 1,5 m, altrimenti svantaggio.' },
  { name: 'Spaventato', desc: 'Svantaggio a prove e tiri per colpire finché vede la fonte della paura; non può avvicinarsi volontariamente a essa.' },
  { name: 'Stordito', desc: 'Incapacitato, non può muoversi e parla a fatica. Fallisce i TS di Forza e Destrezza; gli attacchi contro di lui hanno vantaggio.' },
  { name: 'Trattenuto', desc: 'Velocità 0. Gli attacchi contro di lui hanno vantaggio, i suoi hanno svantaggio; svantaggio ai TS di Destrezza.' },
  { name: 'Indebolimento', desc: 'Sei livelli cumulativi: 1 svantaggio alle prove; 2 velocità dimezzata; 3 svantaggio ad attacchi e TS; 4 PF massimi dimezzati; 5 velocità 0; 6 morte. Un riposo lungo ne toglie uno.' }
];

// Regole base usate dall'assistente anche senza IA
const DND5E_RULES_GLOSSARY = [
  { name: 'Turno', desc: 'Nel tuo turno puoi muoverti fino alla tua velocità e compiere un\'azione. Puoi anche usare un\'azione bonus (se ne hai una) e interagire gratis con un oggetto. Un round dura circa 6 secondi.' },
  { name: 'Azione bonus', desc: 'Puoi usarla solo se un privilegio, un incantesimo o un\'abilità te ne dà una. Al massimo una per turno.' },
  { name: 'Reazione', desc: 'Una risposta istantanea a un evento, anche nel turno di altri (es. attacco di opportunità). Una per round, si recupera all\'inizio del tuo turno.' },
  { name: 'Attacco di opportunità', desc: 'Quando una creatura ostile che vedi esce dalla tua portata, puoi usare la reazione per farle un attacco in mischia. Il Disimpegno lo evita.' },
  { name: 'Vantaggio e svantaggio', desc: 'Tiri due d20: con vantaggio tieni il più alto, con svantaggio il più basso. Se hai entrambi si annullano e tiri un solo dado.' },
  { name: 'Colpo critico', desc: 'Un 20 naturale al tiro per colpire colpisce sempre ed è un critico: tira due volte i dadi di danno e somma il modificatore una volta. Un 1 naturale manca sempre.' },
  { name: 'Riposo breve', desc: 'Almeno 1 ora di pausa. Puoi spendere Dadi Vita: per ognuno tira il dado e aggiungi il modificatore di Costituzione, recuperando quei PF.' },
  { name: 'Riposo lungo', desc: 'Almeno 8 ore (al massimo 2 di attività leggera). Recuperi tutti i PF, metà dei Dadi Vita spesi (minimo 1) e gli slot incantesimo. Uno ogni 24 ore.' },
  { name: 'Tiri salvezza contro morte', desc: 'A 0 PF, all\'inizio del turno tiri un d20: 10 o più è un successo, sotto 10 un fallimento. 3 successi: stabile. 3 fallimenti: morte. Un 1 conta come due fallimenti, un 20 ti riporta a 1 PF.' },
  { name: 'Danno a 0 PF', desc: 'Se subisci danno mentre sei a 0 PF ottieni un fallimento al TS contro morte (due se è un critico). Se il danno residuo raggiunge i tuoi PF massimi muori subito.' },
  { name: 'Copertura', desc: 'Mezza copertura: +2 a CA e TS di Destrezza. Tre quarti: +5. Totale: non puoi essere bersagliato direttamente.' },
  { name: 'Lottare', desc: 'Al posto di un attacco: prova di Atletica contro Atletica o Acrobazia del bersaglio (non più grande di una taglia). Se vinci il bersaglio è afferrato.' },
  { name: 'Spingere', desc: 'Al posto di un attacco: prova di Atletica contro Atletica o Acrobazia. Se vinci, spingi il bersaglio di 1,5 m o lo fai cadere prono.' },
  { name: 'Scattare', desc: 'Azione: guadagni movimento extra pari alla tua velocità per questo turno.' },
  { name: 'Disimpegno', desc: 'Azione: per il resto del turno il tuo movimento non provoca attacchi di opportunità.' },
  { name: 'Schivare', desc: 'Azione: fino al tuo prossimo turno gli attacchi contro di te hanno svantaggio (se vedi l\'attaccante) e hai vantaggio ai TS di Destrezza.' },
  { name: 'Aiutare', desc: 'Azione: un alleato ottiene vantaggio alla prossima prova per il compito che lo aiuti a fare, o al prossimo attacco contro una creatura entro 1,5 m da te.' },
  { name: 'Nascondersi', desc: 'Azione: prova di Furtività (Destrezza) contro la Percezione passiva di chi potrebbe vederti. Serve non essere visti chiaramente.' },
  { name: 'Preparare', desc: 'Azione: scegli un\'azione e un evento che la scatena; quando succede usi la reazione per compierla.' },
  { name: 'Concentrazione', desc: 'Alcuni incantesimi la richiedono: ne mantieni uno alla volta. Se subisci danno fai un TS su Costituzione con CD 10 o metà del danno (il più alto) per non perderla.' },
  { name: 'Percezione passiva', desc: '10 + modificatore di Saggezza (+ competenza se sei competente in Percezione). Il DM la usa per capire cosa noti senza tirare.' },
  { name: 'Movimento e caselle', desc: 'Una casella è 1,5 m. Con la regola base ogni passo in diagonale costa 1,5 m come quello dritto. Il terreno difficile costa il doppio.' },
  { name: 'Ispirazione', desc: 'Il DM la concede per una buona interpretazione: puoi spenderla per avere vantaggio a un tiro per colpire, TS o prova.' }
];

const DMG_XP_THRESHOLDS_BY_LEVEL = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700]
};

const DMG_CR_TABLE = [
  { cr: '0', xp: 10 }, { cr: '1/8', xp: 25 }, { cr: '1/4', xp: 50 }, { cr: '1/2', xp: 100 },
  { cr: '1', xp: 200 }, { cr: '2', xp: 450 }, { cr: '3', xp: 700 }, { cr: '4', xp: 1100 },
  { cr: '5', xp: 1800 }, { cr: '6', xp: 2300 }, { cr: '7', xp: 2900 }, { cr: '8', xp: 3900 },
  { cr: '9', xp: 5000 }, { cr: '10', xp: 5900 }, { cr: '11', xp: 7200 }, { cr: '12', xp: 8400 },
  { cr: '13', xp: 10000 }, { cr: '14', xp: 11500 }, { cr: '15', xp: 13000 }, { cr: '16', xp: 15000 },
  { cr: '17', xp: 18000 }, { cr: '18', xp: 20000 }, { cr: '19', xp: 22000 }, { cr: '20', xp: 25000 },
  { cr: '21', xp: 33000 }, { cr: '22', xp: 41000 }, { cr: '23', xp: 50000 }, { cr: '24', xp: 62000 },
  { cr: '25', xp: 75000 }, { cr: '26', xp: 90000 }, { cr: '27', xp: 105000 }, { cr: '28', xp: 120000 },
  { cr: '29', xp: 135000 }, { cr: '30', xp: 155000 }
];

const ENCOUNTER_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

function getXpByCr(crString) {
  const found = DMG_CR_TABLE.find(item => item.cr === String(crString));
  return found ? found.xp : 0;
}

// DMG 2014, cap. 3: il moltiplicatore dipende dal numero di mostri e si sposta
// di un gradino per gruppi piccoli (meno di 3 PG) o grandi (6 o più).
function getEncounterMultiplier(monsterCount, partySize) {
  if (monsterCount <= 0) return 1;
  let idx = monsterCount === 1 ? 1 : monsterCount === 2 ? 2 : monsterCount <= 6 ? 3 : monsterCount <= 10 ? 4 : monsterCount <= 14 ? 5 : 6;
  if (partySize < 3) idx += 1;
  else if (partySize >= 6) idx -= 1;
  return ENCOUNTER_MULTIPLIERS[Math.max(0, Math.min(ENCOUNTER_MULTIPLIERS.length - 1, idx))];
}

function getPartyThresholds(partyCount, avgLevel) {
  const lvl = clampInt(avgLevel, 1, 20, 1);
  const count = clampInt(partyCount, 1, 12, 1);
  return DMG_XP_THRESHOLDS_BY_LEVEL[lvl].map(v => v * count);
}

function getAbilityMod(score) {
  const val = Number(score);
  return Math.floor(((isNaN(val) ? 10 : val) - 10) / 2);
}
function formatSignedMod(mod) { return mod >= 0 ? `+${mod}` : `${mod}`; }
function getProficiencyBonus(level) { return Math.ceil(clampInt(level, 1, 20, 1) / 4) + 1; }

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Dadi
// ---------------------------------------------------------------------------

function rollDie(sides) {
  const s = Math.max(2, Math.floor(sides));
  if (window.crypto?.getRandomValues) {
    // Scarta i valori che renderebbero il risultato non uniforme
    const limit = Math.floor(0x100000000 / s) * s;
    const buf = new Uint32Array(1);
    do { window.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return (buf[0] % s) + 1;
  }
  return Math.floor(Math.random() * s) + 1;
}

// "2d6+1d4+3", "d8", "1d8 + 3", "-1" → { dice: [{count, sides, sign}], bonus }
function parseDiceFormula(formula) {
  const clean = String(formula || '').toLowerCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
  if (!clean) return null;
  const termRe = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
  const dice = [];
  let bonus = 0;
  let consumed = 0;
  let m;
  while ((m = termRe.exec(clean)) !== null) {
    if (m.index !== consumed) return null;
    consumed = termRe.lastIndex;
    if (m[3]) {
      const count = m[2] === '' ? 1 : parseInt(m[2], 10);
      const sides = parseInt(m[3], 10);
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      dice.push({ count, sides, sign: m[1] === '-' ? -1 : 1 });
    } else {
      bonus += (m[4] === '-' ? -1 : 1) * parseInt(m[5], 10);
    }
  }
  if (consumed !== clean.length || (dice.length === 0 && clean.indexOf('d') !== -1)) return null;
  return { dice, bonus };
}

// Tira una formula di danno; con crit raddoppia il numero di dadi.
function rollDamageFormula(formula, crit) {
  const parsed = parseDiceFormula(formula);
  if (!parsed) return null;
  const rolls = [];
  let total = parsed.bonus;
  parsed.dice.forEach(d => {
    const count = crit ? d.count * 2 : d.count;
    for (let i = 0; i < count; i++) {
      const v = rollDie(d.sides);
      rolls.push(v * d.sign);
      total += v * d.sign;
    }
  });
  return { rolls, bonus: parsed.bonus, total: Math.max(0, total), formula: String(formula).replace(/\s+/g, '') };
}

function describeFormula(count, sides, bonus) {
  return `${count}d${sides}${bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ''}`;
}
