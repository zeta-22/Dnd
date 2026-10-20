// Funzione serverless di Vercel: fa da tramite verso Google Gemini tenendo la chiave sul server.
//
// Variabili d'ambiente (Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY  obbligatoria: la chiave presa da https://aistudio.google.com/apikey
//   GEMINI_MODEL    facoltativa: il modello da usare (predefinito: gemini-flash-latest)
//
// GET  /api/gemini → { configured: true|false }
// POST /api/gemini { task: 'ask', question, context, history }   → { text }
// POST /api/gemini { task: 'extract', notes }                     → { entries: [{ category, title, content }] }

const DEFAULT_MODEL = 'gemini-flash-latest';
const CATEGORIES = ['Missioni', 'Personaggi incontrati', 'Bottino', 'Domande per il DM', 'Sessioni'];
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
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    parsed = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : { entries: [] };
  }
  const entries = (Array.isArray(parsed.entries) ? parsed.entries : []).slice(0, 25).map(e => ({
    category: CATEGORIES.includes(e.category) ? e.category : 'Sessioni',
    title: clip(e.title, 120),
    content: clip(e.content, 2000)
  }));
  return { status: 200, json: { entries } };
}

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
    const result = body.task === 'extract' ? await handleExtract(key, body) : await handleAsk(key, body);
    res.status(result.status).json(result.json);
  } catch (err) {
    res.status(err.status === 429 ? 429 : 502).json({ error: clip(err.message, 300) });
  }
};
