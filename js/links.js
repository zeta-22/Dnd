// Collegamenti nel Diario: i nomi di personaggi, voci del Diario e mappe diventano link.
//
// • Riconoscimento automatico: basta scrivere il nome esatto (maiuscole, minuscole e accenti non contano).
// • "@" apre un elenco da cui scegliere, o per creare al volo una voce nuova del Diario.
// • Ogni voce mostra dove viene citata ("Citato in").
// • I giocatori non vedono link verso cose che non devono conoscere (PNG del Master, mappe non mostrate).

const LINK_CATEGORIES = ['Personaggi incontrati', 'Luoghi', 'Missioni', 'Bottino'];
const LINK_IGNORED_NAMES = /^(senza nome|senza titolo|pedina|nemico|mappa senza nome)$/i;
let linkIndex = { sig: '', targets: [], regex: null };

function foldAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normLinkText(s) {
  return foldAccents(s).toLowerCase().trim();
}

// Testo senza accenti, con la posizione nel testo originale di ogni carattere rimasto
function foldWithMap(src) {
  let folded = '';
  const map = [];
  let i = 0;
  for (const ch of src) {
    const f = foldAccents(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(src.length);
  return { folded, map };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Tutto ciò che si può citare, visto da chi sta guardando
function linkTargets() {
  const dm = isDM();
  const stage = getStage();
  const out = [];
  getChars().forEach(c => {
    if (c.isNpc && !dm) return;
    out.push({ kind: 'char', id: c.id, name: c.name, icon: c.isNpc ? '🎭' : '🧝', label: c.isNpc ? 'PNG' : 'Personaggio' });
  });
  getJournal().filter(j => LINK_CATEGORIES.includes(j.category)).forEach(j => {
    out.push({ kind: 'journal', id: j.id, name: j.title, icon: JOURNAL_CATEGORIES[j.category] || '📜', label: j.category });
  });
  listScenes().forEach(sc => {
    if (!dm && sc.id !== stage.activeSceneId) return;
    out.push({ kind: 'scene', id: sc.id, name: sceneName(sc.id), icon: '🗺️', label: 'Mappa' });
  });
  const seen = new Set();
  return out.filter(t => {
    const n = normLinkText(t.name);
    if (n.length < 3 || LINK_IGNORED_NAMES.test(n) || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

function getLinkIndex() {
  const targets = linkTargets();
  const sig = `${isDM()}|${targets.map(t => `${t.kind}:${t.id}:${t.name}`).join('|')}`;
  if (sig !== linkIndex.sig) {
    const names = targets.map(t => foldAccents(t.name.trim())).sort((a, b) => b.length - a.length).map(escapeRegex);
    linkIndex = {
      sig,
      targets,
      byName: new Map(targets.map(t => [normLinkText(t.name), t])),
      regex: names.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(${names.join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null
    };
  }
  return linkIndex;
}

function refLinkHtml(t, text) {
  return `<a href="#" class="ref-link" data-ref-kind="${t.kind}" data-ref-id="${escapeHtml(t.id)}" title="${escapeHtml(`${t.icon} ${t.label}`)}">${escapeHtml(text)}</a>`;
}

// Testo → HTML sicuro con i nomi trasformati in link (tranne quello della voce stessa)
function linkify(text, exclude) {
  const idx = getLinkIndex();
  const src = String(text || '');
  if (!idx.regex || !src) return escapeHtml(src);
  // Si cerca nel testo senza accenti, ma il link mostra le parole come sono state scritte
  const { folded, map } = foldWithMap(src);
  let html = '';
  let last = 0;
  idx.regex.lastIndex = 0;
  for (const m of folded.matchAll(idx.regex)) {
    const t = idx.byName.get(normLinkText(m[0]));
    if (!t || (exclude && exclude.kind === t.kind && exclude.id === t.id)) continue;
    const start = map[m.index];
    const end = map[m.index + m[0].length];
    html += escapeHtml(src.slice(last, start)) + refLinkHtml(t, src.slice(start, end));
    last = end;
  }
  return html + escapeHtml(src.slice(last));
}

function mentionsTarget(text, name) {
  const n = foldAccents(name).trim();
  if (n.length < 3 || !text) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(n)}(?![\\p{L}\\p{N}_])`, 'iu').test(foldAccents(text));
}

// Voci del Diario che citano qualcosa
function citedIn(kind, id, name) {
  return getJournal().filter(j => !(kind === 'journal' && j.id === id) && (mentionsTarget(j.content, name) || mentionsTarget(j.dmAnswer, name)));
}

function citedInHtml(kind, id, name) {
  const list = citedIn(kind, id, name);
  if (!list.length) return '';
  return `<div class="text-[11px] text-[var(--muted)]">🔗 Citato in: ${list.slice(0, 12).map(j =>
    `<a href="#" class="ref-link" data-ref-kind="journal" data-ref-id="${escapeHtml(j.id)}">${escapeHtml(j.title)}</a>`).join(', ')}${list.length > 12 ? '…' : ''}</div>`;
}

// ---------------------------------------------------------------------------
// Dove porta un link
// ---------------------------------------------------------------------------

function followRef(kind, id) {
  if (kind === 'char') {
    const ch = getChar(id);
    if (!ch || (ch.isNpc && !isDM())) { showToast('Questo personaggio non c\'è più'); return; }
    App.sheetCharId = ch.id;
    switchTab('personaggio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (kind === 'journal') {
    if (!ent(`journal:${id}`)) { showToast('Questa voce del Diario non c\'è più'); return; }
    App.journalFilter = 'Tutto';
    switchTab('diario');
    renderJournal();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`[data-journal-id="${CSS.escape(id)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('ref-flash');
      void el.offsetWidth;
      el.classList.add('ref-flash');
    }));
    return;
  }
  if (kind === 'scene') {
    if (isDM()) {
      switchTab('tavolo');
      switchDmScene(id);
    } else if (getStage().activeSceneId === id) {
      switchTab('tavolo');
    } else {
      showToast('🗺️ Il Master non vi ha ancora portato su questa mappa');
    }
  }
}

// ---------------------------------------------------------------------------
// Menu "@"
// ---------------------------------------------------------------------------

function attachMentions(el) {
  if (!el || el.dataset.mentions) return;
  el.dataset.mentions = '1';
  const wrap = el.parentElement;
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const menu = document.createElement('div');
  menu.className = 'mention-menu hidden';
  menu.setAttribute('role', 'listbox');
  el.insertAdjacentElement('afterend', menu);
  let state = null;

  const close = () => { state = null; menu.classList.add('hidden'); };

  const choose = (item) => {
    if (!state || !item) return;
    let name = item.name;
    if (item.create) {
      const entry = addJournalEntry({ category: item.create, title: item.name, content: '' });
      name = entry.title;
      showToast(`${JOURNAL_CATEGORIES[item.create]} “${name}” aggiunto al Diario`);
      renderJournal();
    }
    const caret = el.selectionStart;
    el.value = `${el.value.slice(0, state.start)}${name} ${el.value.slice(caret)}`;
    const pos = state.start + name.length + 1;
    el.setSelectionRange(pos, pos);
    close();
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const render = () => {
    menu.innerHTML = state.items.map((it, i) => `
      <button type="button" class="mention-item ${i === state.idx ? 'active' : ''}" data-i="${i}" role="option">
        ${it.create
          ? `➕ Crea “${escapeHtml(it.name)}” in ${JOURNAL_CATEGORIES[it.create]} ${escapeHtml(it.create)}`
          : `${it.icon} <strong>${escapeHtml(it.name)}</strong> <span class="text-[var(--muted)]">· ${escapeHtml(it.label)}</span>`}
      </button>`).join('');
    menu.classList.toggle('hidden', !state.items.length);
  };

  el.addEventListener('input', () => {
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const m = /(?:^|[\s(«"])@([^@\n]{0,40})$/u.exec(before);
    if (!m) { close(); return; }
    const query = m[1];
    const q = normLinkText(query);
    // Prima i nomi che iniziano così, poi quelli con una parola che inizia così, poi il resto
    const rank = (t) => {
      const n = normLinkText(t.name);
      return n.startsWith(q) ? 0 : n.split(/\s+/).some(w => w.startsWith(q)) ? 1 : 2;
    };
    const found = getLinkIndex().targets.filter(t => !q || normLinkText(t.name).includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length).slice(0, 8);
    if (!found.length && /\s$/.test(query)) { close(); return; }
    const exact = found.some(t => normLinkText(t.name) === q);
    const canCreate = q.length >= 2 && !exact && query.trim().split(/\s+/).length <= 4;
    const items = found.concat(canCreate ? LINK_CATEGORIES.map(cat => ({ create: cat, name: query.trim() })) : []);
    state = { start: pos - query.length - 1, items, idx: 0 };
    render();
  });
  el.addEventListener('keydown', (e) => {
    if (!state || menu.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      state.idx = (state.idx + (e.key === 'ArrowDown' ? 1 : -1) + state.items.length) % state.items.length;
      render();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(state.items[state.idx]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });
  el.addEventListener('blur', () => setTimeout(close, 150));
  menu.addEventListener('mousedown', (e) => e.preventDefault());
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.mention-item');
    if (b && state) choose(state.items[Number(b.dataset.i)]);
  });
}

function initLinkEvents() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.ref-link');
    if (!a) return;
    e.preventDefault();
    followRef(a.dataset.refKind, a.dataset.refId);
  });
  ['journalInputDetails', 'personalNoteText', 'dmHandoutText', 'dmTextareaSessionNotes'].forEach(id => attachMentions($(id)));
}
