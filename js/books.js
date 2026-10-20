// Manuali PDF (salvati solo su questo dispositivo), ricerca nelle regole e assistente.

let pdfJsPromise = null;
const bookUrls = {};

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TAVOLO_CONFIG.pdfJsUrl;
    s.onload = () => {
      if (!window.pdfjsLib) { reject(new Error('pdf.js')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = TAVOLO_CONFIG.pdfJsWorkerUrl;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { pdfJsPromise = null; reject(new Error('pdf.js')); };
    document.head.appendChild(s);
  });
  return pdfJsPromise;
}

async function loadBooks() {
  App.books = (await idbGetAll('books')).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

function setIndexingStatus(text, pct) {
  showEl('pdfIndexingStatusBox', text !== null);
  if (text === null) return;
  setText('pdfIndexingStatusText', text);
  $('pdfIndexingBarFill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

async function indexPdfFiles(files) {
  const list = Array.from(files || []).filter(f => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
  if (!list.length) return;
  let pdfjs;
  try {
    setIndexingStatus('Carico il lettore PDF…', 2);
    pdfjs = await loadPdfJs();
  } catch (e) {
    setIndexingStatus(null);
    showToast('⚠️ Non riesco a caricare il lettore PDF: controlla la connessione');
    return;
  }
  for (const file of list) {
    const title = file.name.replace(/\.pdf$/i, '');
    try {
      const blob = file.slice(0, file.size, 'application/pdf');
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
        pages.push(text);
        if (i % 3 === 0 || i === pdf.numPages) setIndexingStatus(`Indicizzo “${title}”: pagina ${i} di ${pdf.numPages}`, (i / pdf.numPages) * 100);
      }
      const book = { id: uid('book'), title, size: file.size, pageCount: pdf.numPages, addedAt: Date.now(), pages, blob };
      const saved = await idbPut('books', book);
      if (!saved) throw new Error('spazio');
      App.books.push(book);
      const textChars = pages.reduce((n, p) => n + p.length, 0);
      showToast(textChars < pdf.numPages * 20
        ? `⚠️ “${title}” sembra una scansione: si può leggere ma la ricerca non troverà testo`
        : `📚 “${title}” indicizzato (${pdf.numPages} pagine)`, 4000);
    } catch (err) {
      showToast(`⚠️ Non sono riuscito a indicizzare “${title}”`, 4000);
    }
  }
  setIndexingStatus(null);
  renderBooks();
}

async function deleteBook(bookId) {
  await idbDelete('books', bookId);
  App.books = App.books.filter(b => b.id !== bookId);
  if (bookUrls[bookId]) { URL.revokeObjectURL(bookUrls[bookId]); delete bookUrls[bookId]; }
  if ($('pdfReaderModalBox').dataset.bookId === bookId) closeBookReader();
  renderBooks();
}

function bookUrl(book) {
  if (!bookUrls[book.id] && book.blob) bookUrls[book.id] = URL.createObjectURL(book.blob);
  return bookUrls[book.id];
}

function openBookAtPage(bookId, page = 1) {
  const book = App.books.find(b => b.id === bookId);
  if (!book) { showToast('Questo PDF non è su questo dispositivo'); return; }
  const url = `${bookUrl(book)}#page=${page}`;
  const box = $('pdfReaderModalBox');
  box.dataset.bookId = bookId;
  setText('pdfReaderTitle', `${book.title} — pagina ${page}`);
  // Cambiare solo l'ancora non ricarica il PDF: svuotiamo prima l'iframe
  const iframe = $('pdfReaderIframe');
  iframe.src = 'about:blank';
  setTimeout(() => { iframe.src = url; }, 30);
  $('pdfReaderOpenNewTab').href = url;
  showEl(box, true);
  switchTab('regole');
  setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function closeBookReader() {
  const box = $('pdfReaderModalBox');
  box.dataset.bookId = '';
  $('pdfReaderIframe').src = 'about:blank';
  showEl(box, false);
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function renderBooks() {
  const listEl = $('indexedPdfsList');
  if (!listEl) return;
  listEl.innerHTML = App.books.length ? App.books.map(b => `
    <div class="card-surface2 p-3 flex items-center justify-between gap-2 text-xs" data-book-id="${escapeHtml(b.id)}">
      <div class="min-w-0">
        <div class="font-bold truncate">📖 ${escapeHtml(b.title)}</div>
        <div class="text-[11px] text-[var(--muted)]">${b.pageCount} pagine · ${formatSize(b.size || 0)}</div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" class="btn btn-felt text-xs py-0.5 px-2 book-open-btn">Apri</button>
        <button type="button" class="btn text-xs py-0.5 px-2 text-[var(--danger)] book-delete-btn" title="Togli da questo dispositivo">🗑️</button>
      </div>
    </div>`).join('') : '<div class="text-xs text-[var(--muted)] italic">Nessun PDF. Carica i tuoi manuali o appunti: potrai cercarci dentro e l\'assistente li userà per rispondere.</div>';
}

function renderGlossary() {
  const grid = $('rulesGlossaryGrid');
  if (!grid || grid.childElementCount) return;
  grid.innerHTML = DND5E_CONDITIONS.map(c => `
    <details class="card-surface2 p-2.5 text-xs">
      <summary class="font-bold cursor-pointer">⚠️ ${escapeHtml(c.name)}</summary>
      <p class="mt-1.5 leading-relaxed text-[var(--ink)]">${escapeHtml(c.desc)}</p>
    </details>`).join('');
}

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------

const SEARCH_STOPWORDS = new Set('il lo la i gli le un uno una di da del dello della dei degli delle in con su per tra fra a al allo alla ai agli alle e o ed che chi cosa come quando quanto quale quali cui non si mi ti ci vi ne se ma anche piu più molto poco sono sei siamo siete essere ha hanno ho hai abbiamo avere fa fare puo può posso possono deve devono questo questa questi queste quello quella nel nello nella nei negli nelle sul sullo sulla sui sugli sulle col coi funziona funzionano regola regole dnd d&d the of and to is how what does'.split(' '));

const SEARCH_SYNONYMS = {
  stun: 'stordito', stunned: 'stordito', grapple: 'lottare afferrato', grappled: 'afferrato', prone: 'prono',
  opportunity: 'opportunita', rest: 'riposo', exhaustion: 'indebolimento', advantage: 'vantaggio', disadvantage: 'svantaggio',
  concentration: 'concentrazione', poisoned: 'avvelenato', frightened: 'spaventato', charmed: 'affascinato',
  invisible: 'invisibile', paralyzed: 'paralizzato', restrained: 'trattenuto', incapacitated: 'incapacitato',
  unconscious: 'privo sensi', blinded: 'accecato', deafened: 'assordato', petrified: 'pietrificato', dash: 'scattare',
  dodge: 'schivare', disengage: 'disimpegno', help: 'aiutare', hide: 'nascondersi', ready: 'preparare', cover: 'copertura',
  critical: 'critico', crit: 'critico', death: 'morte', save: 'salvezza', spell: 'incantesimo', slot: 'slot',
  ts: 'salvezza', pf: 'punti ferita', ca: 'classe armatura', aoo: 'opportunita'
};

function normalizeSearchText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function searchTerms(query) {
  const words = normalizeSearchText(query).split(/[^a-z0-9]+/).filter(Boolean);
  const expanded = [];
  words.forEach(w => {
    if (SEARCH_SYNONYMS[w]) expanded.push(...SEARCH_SYNONYMS[w].split(' '));
    else expanded.push(w);
  });
  const terms = [...new Set(expanded.filter(w => (w.length >= 3 || /^\d+$/.test(w)) && !SEARCH_STOPWORDS.has(w)))];
  // Radice semplice: "attacchi" e "attacco" trovano entrambi "attacc"
  return terms.map(t => (t.length > 5 ? t.slice(0, t.length - 2) : t));
}

function countOccurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1 && n < 50) { n++; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

function bookNorm(book) {
  if (!book._norm) book._norm = book.pages.map(normalizeSearchText);
  return book._norm;
}

function makeSnippet(text, normText, terms, radius = 160) {
  let pos = -1;
  for (const t of terms) { pos = normText.indexOf(t); if (pos !== -1) break; }
  if (pos === -1) pos = 0;
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius * 1.6);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

function highlightSnippet(snippet, terms) {
  const usable = terms.filter(t => t.length >= 3).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!usable.length) return escapeHtml(snippet);
  // Un solo passaggio sul testo originale, così non si evidenzia dentro i tag già inseriti
  const re = new RegExp(`((?:${usable.join('|')})[a-zà-ù]*)`, 'gi');
  let html = '';
  let last = 0;
  const plain = snippet.normalize('NFC');
  const folded = normalizeSearchText(plain);
  let m;
  while ((m = re.exec(folded)) !== null) {
    // normalizeSearchText toglie solo gli accenti: le posizioni coincidono con il testo NFC
    html += escapeHtml(plain.slice(last, m.index)) + '<mark>' + escapeHtml(plain.slice(m.index, m.index + m[0].length)) + '</mark>';
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return html + escapeHtml(plain.slice(last));
}

function searchRules(query, limit = 6) {
  const terms = searchTerms(query);
  const result = { terms, glossary: [], pages: [] };
  if (!terms.length) return result;
  const glossary = DND5E_CONDITIONS.map(c => Object.assign({ kind: 'Condizione' }, c)).concat(DND5E_RULES_GLOSSARY.map(r => Object.assign({ kind: 'Regola' }, r)));
  result.glossary = glossary.map(g => {
    const name = normalizeSearchText(g.name);
    const desc = normalizeSearchText(g.desc);
    let score = 0;
    terms.forEach(t => { if (name.includes(t)) score += 4; if (desc.includes(t)) score += 1; });
    return { item: g, score };
  }).filter(x => x.score >= Math.min(2, terms.length)).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.item);

  const totalPages = App.books.reduce((n, b) => n + b.pageCount, 0) || 1;
  const df = {};
  terms.forEach(t => {
    df[t] = 0;
    App.books.forEach(b => bookNorm(b).forEach(p => { if (p.includes(t)) df[t]++; }));
  });
  const hits = [];
  App.books.forEach(book => {
    bookNorm(book).forEach((p, idx) => {
      let score = 0;
      let matched = 0;
      terms.forEach(t => {
        const c = countOccurrences(p, t);
        if (c) { matched++; score += Math.log(1 + c) * Math.log(1 + totalPages / (1 + df[t])); }
      });
      if (!matched) return;
      if (matched === terms.length) score *= 1.6;
      hits.push({ book, page: idx + 1, score });
    });
  });
  hits.sort((a, b) => b.score - a.score);
  // Termini rari prima, per centrare gli estratti sulla parte più utile
  const rareFirst = terms.slice().sort((a, b) => df[a] - df[b]);
  result.pages = hits.slice(0, limit).map(h => ({
    bookId: h.book.id, title: h.book.title, page: h.page, score: h.score,
    snippet: makeSnippet(h.book.pages[h.page - 1], bookNorm(h.book)[h.page - 1], rareFirst),
    text: h.book.pages[h.page - 1]
  }));
  return result;
}

function renderSearchResults(query) {
  const box = $('rulesSearchResults');
  const res = searchRules(query, 8);
  if (!res.terms.length) { box.innerHTML = '<div class="text-xs text-[var(--muted)]">Scrivi qualche parola in più.</div>'; return; }
  const parts = [];
  res.glossary.forEach(g => parts.push(`
    <div class="card-surface2 p-2.5 text-xs search-hit"><strong>${g.kind === 'Condizione' ? '⚠️' : '📘'} ${escapeHtml(g.name)}</strong>
      <p class="mt-1 leading-relaxed">${highlightSnippet(g.desc, res.terms)}</p></div>`));
  res.pages.forEach(p => parts.push(`
    <div class="card-surface2 p-2.5 text-xs search-hit flex flex-col gap-1">
      <div class="flex items-center justify-between gap-2">
        <strong class="truncate">📖 ${escapeHtml(p.title)} — p. ${p.page}</strong>
        <button type="button" class="btn text-[11px] py-0 px-2 src-link-btn" data-book-id="${escapeHtml(p.bookId)}" data-page="${p.page}">Apri</button>
      </div>
      <p class="leading-relaxed text-[var(--muted)]">${highlightSnippet(p.snippet, res.terms)}</p>
    </div>`));
  box.innerHTML = parts.join('') || `<div class="text-xs text-[var(--muted)]">Nessun risultato.${App.books.length ? '' : ' Carica i manuali in PDF per cercare anche lì.'}</div>`;
}

// ---------------------------------------------------------------------------
// Assistente (Gemini tramite la funzione Vercel, oppure ricerca locale)
// ---------------------------------------------------------------------------

async function checkAiAvailability(force = false) {
  if (App.ai.checked && !force) return App.ai.available;
  if (location.protocol === 'file:') {
    App.ai = { checked: true, available: false, reason: 'Apri il sito pubblicato su Vercel per usare l\'IA (dal file locale funziona solo la ricerca).' };
    return false;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(TAVOLO_CONFIG.aiEndpoint, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    const data = res.ok ? await res.json() : null;
    App.ai = data?.configured
      ? { checked: true, available: true, reason: '' }
      : { checked: true, available: false, reason: data ? 'Manca la chiave: aggiungi GEMINI_API_KEY nelle variabili d\'ambiente del progetto Vercel e rifai il deploy.' : 'La funzione /api/gemini non risponde (sito non pubblicato su Vercel?).' };
  } catch (e) {
    App.ai = { checked: true, available: false, reason: 'La funzione /api/gemini non è raggiungibile.' };
  }
  return App.ai.available;
}

async function callAi(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(TAVOLO_CONFIG.aiEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) App.ai = { checked: true, available: false, reason: 'Manca la chiave GEMINI_API_KEY su Vercel.' };
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildAiContext(found) {
  const parts = [];
  found.glossary.forEach(g => parts.push(`[Glossario] ${g.name}: ${g.desc}`));
  found.pages.slice(0, 5).forEach(p => {
    const norm = normalizeSearchText(p.text);
    const snippet = makeSnippet(p.text, norm, found.terms, 1200);
    parts.push(`[${p.title}, p. ${p.page}]\n${snippet}`);
  });
  return parts.join('\n\n').slice(0, 24000);
}

async function askAssistant(question, history) {
  const found = searchRules(question, 6);
  const sources = found.pages.slice(0, 3).map(p => ({ bookId: p.bookId, title: p.title, page: p.page }));
  if (await checkAiAvailability()) {
    try {
      const data = await callAi({
        task: 'ask', question, context: buildAiContext(found),
        history: (history || []).filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: String(m.text).slice(0, 1500) }))
      });
      if (data.text) return { text: data.text, sources };
    } catch (e) {
      return Object.assign(localAnswer(found), { sources, note: 'L\'IA non ha risposto, ecco cosa ho trovato da solo.' });
    }
  }
  return Object.assign(localAnswer(found), { sources, note: App.ai.reason ? `Senza IA: ${App.ai.reason}` : '' });
}

function localAnswer(found) {
  const lines = [];
  found.glossary.forEach(g => lines.push(`📘 ${g.name}: ${g.desc}`));
  if (found.pages.length) {
    lines.push(found.glossary.length ? '\nNei tuoi PDF:' : 'Nei tuoi PDF ho trovato:');
    found.pages.slice(0, 3).forEach(p => lines.push(`• ${p.title}, p. ${p.page}: ${p.snippet}`));
  }
  if (!lines.length) {
    return { text: App.books.length
      ? 'Non ho trovato niente su questo. Prova con altre parole (es. il nome italiano della regola).'
      : 'Non ho trovato niente nel glossario. Carica i manuali in “Regole & PDF” e potrò cercare anche lì.' };
  }
  return { text: lines.join('\n') };
}

function initBooksEvents() {
  $('inputUploadPdf').addEventListener('change', (e) => {
    const files = e.target.files;
    indexPdfFiles(files).finally(() => { e.target.value = ''; });
  });
  $('indexedPdfsList').addEventListener('click', (e) => {
    const card = e.target.closest('[data-book-id]');
    if (!card) return;
    if (e.target.closest('.book-open-btn')) openBookAtPage(card.dataset.bookId, 1);
    if (e.target.closest('.book-delete-btn')) deleteBook(card.dataset.bookId);
  });
  $('btnClosePdfReader').addEventListener('click', closeBookReader);
  $('rulesSearchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    renderSearchResults($('inputRulesSearch').value);
  });
  $('rulesSearchResults').addEventListener('click', (e) => {
    const btn = e.target.closest('.src-link-btn');
    if (btn) openBookAtPage(btn.dataset.bookId, parseInt(btn.dataset.page, 10) || 1);
  });
}
