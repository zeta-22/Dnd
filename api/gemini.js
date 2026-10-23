// Funzione serverless di Vercel: fa da tramite verso Google Gemini tenendo la chiave sul server.
//
// Variabili d'ambiente (Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY  obbligatoria: la chiave presa da https://aistudio.google.com/apikey
//   GEMINI_MODEL    facoltativa: il modello da usare (predefinito: gemini-flash-latest)
//
// GET  /api/gemini → { configured: true|false }
// POST /api/gemini { task: 'ask', question, context, history }   → { text }
// POST /api/gemini { task: 'extract', notes }                     → { entries: [{ category, title, content }] }
// POST /api/gemini { task: 'sheet', fields, text, images }         → { sheet: { name, className, abilities, … } }

const DEFAULT_MODEL = 'gemini-flash-latest';
const CATEGORIES = ['Missioni', 'Personaggi incontrati', 'Luoghi', 'Bottino', 'Domande per il DM', 'Sessioni'];
const ABILITIES = ['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'];
const SKILLS = ['Acrobazia', 'Addestrare Animali', 'Arcano', 'Atletica', 'Furtività', 'Indagare', 'Inganno', 'Intimidire', 'Intrattenere',
  'Intuizione', 'Medicina', 'Natura', 'Percezione', 'Persuasione', 'Rapidità di Mano', 'Religione', 'Sopravvivenza', 'Storia'];
const MAX_SHEET_IMAGES = 4;
const RATE_LIMIT = 20;            // richieste al minuto per indirizzo (per istanza)
const recentRequests = new Map();

const ASK_PROMPT = [
  'Sei l\'assistente regole di un tavolo di Dungeons & Dragons 5ª edizione (regole 2014) usato da un gruppo di amici italiani.',
  'Rispondi esattamente alla domanda, in italiano: la prima frase deve già contenere la risposta (se la domanda è sì/no, comincia con "Sì" o "No").',
  'Poi aggiungi al massimo due o tre frasi utili per applicarla al tavolo. Niente introduzioni, niente elenchi, non ripetere la domanda.',
  'Gli estratti dei manuali e del glossario sono solo materiale da consultare: usali per verificare la regola, ma non riassumerli, non elencarli e non copiarne le frasi. Ignora quelli che non c\'entrano.',
  'Se negli estratti la risposta non c\'è, rispondi con ciò che sai delle regole di D&D 5e.',
  'Se hai usato un manuale, chiudi con il riferimento tra parentesi, per esempio (Manuale del Giocatore, p. 192).',
  'Se la regola è ambigua o opzionale dillo in una frase e suggerisci di decidere con il DM. Non inventare regole. Usa i nomi italiani ufficiali di regole, condizioni e incantesimi.'
].join(' ');

const EXTRACT_PROMPT = [
  'Trasforma gli appunti di una sessione di D&D in voci per il diario della campagna, in italiano.',
  `Ogni voce ha una categoria tra: ${CATEGORIES.join(', ')}.`,
  'Crea una voce per ogni fatto utile da ricordare (missioni ricevute o completate, personaggi incontrati, oggetti e monete trovati, domande aperte per il DM).',
  'Titolo breve (al massimo 8 parole), contenuto di 1-3 frasi. Aggiungi sempre una voce "Sessioni" con il riassunto della serata. Al massimo 15 voci.'
].join(' ');

const SHEET_PROMPT = [
  'Leggi la scheda di un personaggio di Dungeons & Dragons 5ª edizione e riportane i dati in italiano per un\'app da tavolo.',
  'Puoi ricevere i campi compilati di un modulo PDF ("nome campo: valore"), il testo delle pagine e le immagini delle pagine: usa tutto quello che c\'è.',
  'Traduci con i nomi ufficiali italiani della 5e: classi (Fighter = Guerriero, Rogue = Ladro, Wizard = Mago, Cleric = Chierico, Sorcerer = Stregone…), razze, background, incantesimi, privilegi, oggetti e tipi di danno. Il nome del personaggio e gli altri nomi propri restano come sono.',
  'Abilità: Acrobatics = Acrobazia, Animal Handling = Addestrare Animali, Arcana = Arcano, Athletics = Atletica, Deception = Inganno, History = Storia, Insight = Intuizione, Intimidation = Intimidire, Investigation = Indagare, Medicine = Medicina, Nature = Natura, Perception = Percezione, Performance = Intrattenere, Persuasion = Persuasione, Religion = Religione, Sleight of Hand = Rapidità di Mano, Stealth = Furtività, Survival = Sopravvivenza.',
  'Caratteristiche: STR = FOR, DEX = DES, CON = COS, INT = INT, WIS = SAG, CHA = CAR. Riporta i punteggi (es. 16), non i modificatori.',
  'Per tiri salvezza e abilità riporta il bonus totale scritto sulla scheda (null se non c\'è) e la competenza segnata: 0 nessuna, 1 competente, 2 maestria.',
  'className è solo il nome della classe, senza sottoclasse (la sottoclasse va nei privilegi); con più classi scrivi "Guerriero 3 / Ladro 2". level è la somma dei livelli.',
  'Velocità in metri: piedi × 0,3 (30 ft = 9 m). Dado vita nella forma "d8".',
  'Attacchi: il danno solo come formula di dadi (es. "1d8+3"), il tipo di danno a parte.',
  'Incantesimi: tutti quelli conosciuti o preparati, con il nome italiano ufficiale, il nome inglese originale e il livello (0 per i trucchetti). Slot: il numero massimo per livello.',
  'Traduci anche i testi (equipaggiamento e monete, privilegi e tratti, competenze e linguaggi, storia, aspetto, tratti caratteriali, ideali, legami, difetti) in un italiano naturale, senza togliere informazioni utili e senza aggiungerne.',
  'Non inventare: se un dato manca lascia una stringa vuota, 0 o null. In "warnings" elenca brevemente, in italiano, le parti illeggibili o dubbie.'
].join(' ');

const STRING = { type: 'STRING' };
const INTEGER = { type: 'INTEGER' };
const NULLABLE_INTEGER = { type: 'INTEGER', nullable: true };
const SHEET_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: STRING, race: STRING, className: STRING, level: INTEGER, background: STRING, alignment: STRING,
    abilities: { type: 'OBJECT', properties: Object.fromEntries(ABILITIES.map(k => [k, INTEGER])), required: ABILITIES },
    proficiencyBonus: NULLABLE_INTEGER, maxHp: INTEGER, ac: INTEGER, speedMeters: { type: 'NUMBER' }, hitDie: STRING,
    savingThrows: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { ability: { type: 'STRING', enum: ABILITIES }, bonus: NULLABLE_INTEGER, proficiency: INTEGER }, required: ['ability', 'proficiency'] }
    },
    skills: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { skill: { type: 'STRING', enum: SKILLS }, bonus: NULLABLE_INTEGER, proficiency: INTEGER }, required: ['skill', 'proficiency'] }
    },
    attacks: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { name: STRING, bonus: NULLABLE_INTEGER, damage: STRING, damageType: STRING }, required: ['name'] }
    },
    bonusAction: STRING,
    spellcastingAbility: { type: 'STRING', enum: ABILITIES, nullable: true },
    spellSlots: { type: 'ARRAY', items: { type: 'OBJECT', properties: { level: INTEGER, max: INTEGER }, required: ['level', 'max'] } },
    spells: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: STRING, englishName: STRING, level: INTEGER }, required: ['name', 'level'] } },
    equipment: STRING, features: STRING, proficiencies: STRING,
    story: { type: 'OBJECT', properties: { text: STRING, look: STRING, traits: STRING, ideals: STRING, bonds: STRING, flaws: STRING } },
    notes: STRING,
    warnings: { type: 'ARRAY', items: STRING }
  },
  required: ['name', 'className', 'level', 'abilities', 'maxHp', 'ac']
};

function clip(value, max) {
  return String(value || '').slice(0, max);
}

function tooManyRequests(ip) {
  const now = Date.now();
  const list = (recentRequests.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  recentRequests.set(ip, list);
  if (recentRequests.size > 5000) recentRequests.clear();
  return list.length > RATE_LIMIT;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers['x-forwarded-host'] || new URL(origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
}

async function callGemini(key, payload) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini ha risposto ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) {
    const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'vuota';
    throw new Error(`Risposta di Gemini vuota (${reason})`);
  }
  return text;
}

function parseJsonReply(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
  }
}

async function handleAsk(key, body) {
  const question = clip(body.question, 2000).trim();
  if (!question) return { status: 400, json: { error: 'Domanda mancante' } };
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
  const contents = history
    .filter(m => m && m.text)
    .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: clip(m.text, 1500) }] }));
  // Gemini vuole che la conversazione inizi con l'utente
  while (contents.length && contents[0].role !== 'user') contents.shift();
  contents.push({
    role: 'user',
    // La domanda va per ultima, così il modello risponde a quella e non agli estratti
    parts: [{ text: `Estratti da consultare (possono essere incompleti o non pertinenti):\n${clip(body.context, 12000) || '(nessuno)'}\n\nDomanda: ${question}\nRispondi solo a questa domanda.` }]
  });
  const text = await callGemini(key, {
    systemInstruction: { parts: [{ text: ASK_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
  });
  return { status: 200, json: { text } };
}

async function handleExtract(key, body) {
  const notes = clip(body.notes, 20000).trim();
  if (!notes) return { status: 400, json: { error: 'Appunti mancanti' } };
  const text = await callGemini(key, {
    systemInstruction: { parts: [{ text: EXTRACT_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: notes }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          entries: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                category: { type: 'STRING', enum: CATEGORIES },
                title: { type: 'STRING' },
                content: { type: 'STRING' }
              },
              required: ['category', 'title', 'content']
            }
          }
        },
        required: ['entries']
      }
    }
  });
  const parsed = parseJsonReply(text) || { entries: [] };
  const entries = (Array.isArray(parsed.entries) ? parsed.entries : []).slice(0, 25).map(e => ({
    category: CATEGORIES.includes(e.category) ? e.category : 'Sessioni',
    title: clip(e.title, 120),
    content: clip(e.content, 2000)
  }));
  return { status: 200, json: { entries } };
}

async function handleSheet(key, body) {
  const fields = clip(body.fields, 20000).trim();
  const text = clip(body.text, 30000).trim();
  // Immagini JPEG delle pagine in base64, già ridotte dal browser
  const images = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_SHEET_IMAGES)
    .filter(img => typeof img === 'string' && img.length < 2000000 && /^[A-Za-z0-9+/]+=*$/.test(img));
  if (!fields && !text && !images.length) return { status: 400, json: { error: 'Scheda vuota' } };
  const intro = [
    fields && `Campi compilati del modulo PDF:\n${fields}`,
    text && `Testo delle pagine:\n${text}`,
    images.length && `Seguono le immagini di ${images.length} pagine della scheda.`
  ].filter(Boolean).join('\n\n');
  const reply = await callGemini(key, {
    systemInstruction: { parts: [{ text: SHEET_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: intro }, ...images.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } }))] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: SHEET_SCHEMA }
  });
  const sheet = parseJsonReply(reply);
  if (!sheet || typeof sheet !== 'object') throw new Error('Gemini non ha restituito una scheda leggibile');
  return { status: 200, json: { sheet } };
}

const TASKS = { ask: handleAsk, extract: handleExtract, sheet: handleSheet };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.GEMINI_API_KEY;

  if (req.method === 'GET') {
    res.status(200).json({ configured: Boolean(key) });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metodo non consentito' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Richiesta non consentita' });
    return;
  }
  if (!key) {
    res.status(503).json({ error: 'GEMINI_API_KEY non configurata' });
    return;
  }
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (tooManyRequests(ip)) {
    res.status(429).json({ error: 'Troppe richieste, aspetta un minuto' });
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  try {
    const task = Object.hasOwn(TASKS, body.task) ? TASKS[body.task] : handleAsk;
    const result = await task(key, body);
    res.status(result.status).json(result.json);
  } catch (err) {
    res.status(err.status === 429 ? 429 : 502).json({ error: clip(err.message, 300) });
  }
};
