// Diario condiviso della campagna.

const JOURNAL_CATEGORIES = {
  'Missioni': '🗺️',
  'Personaggi incontrati': '🧙',
  'Luoghi': '📍',
  'Bottino': '💰',
  'Domande per il DM': '❓',
  'Sessioni': '📜'
};

function addJournalEntry({ category, title, content }) {
  const entry = normalizeJournal({
    id: uid('j'), category, title, content, createdAt: Date.now(),
    date: new Date().toLocaleDateString('it-IT'), author: actorName(), authorId: DEVICE_ID
  });
  putEnt(`journal:${entry.id}`, entry);
  return entry;
}

function canEditJournalEntry(j) {
  return isDM() || j.authorId === DEVICE_ID;
}

function renderJournal() {
  const listEl = $('journalEntriesList');
  if (!listEl) return;
  const all = getJournal();
  const entries = App.journalFilter === 'Tutto' ? all : all.filter(j => j.category === App.journalFilter);
  setText('journalEntriesCountBadge', `${entries.length} ${entries.length === 1 ? 'voce' : 'voci'}`);
  document.querySelectorAll('.journal-filter-btn').forEach(b => b.classList.toggle('btn-felt', b.dataset.jfilter === App.journalFilter));
  const dm = isDM();
  safeRebuild(listEl, () => {
    if (!entries.length) {
      listEl.innerHTML = '<div class="text-xs text-[var(--muted)] italic">Nessuna voce. Usa “+ Aggiungi voce” per annotare missioni, bottino e PNG incontrati.</div>';
      return;
    }
    listEl.innerHTML = entries.map(j => {
      const icon = JOURNAL_CATEGORIES[j.category] || '📜';
      const isQuest = j.category === 'Missioni';
      const isQuestion = j.category === 'Domande per il DM';
      return `
        <article class="card-surface2 p-3 text-xs flex flex-col gap-1.5" data-journal-id="${escapeHtml(j.id)}">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                ${isQuest ? `<input type="checkbox" class="w-4 h-4 accent-[var(--felt)] journal-complete-toggle" ${j.completed ? 'checked' : ''} title="Completata" aria-label="Missione completata" />` : ''}
                <strong class="font-serif-title text-base ${j.completed ? 'line-through text-[var(--muted)]' : ''}">${escapeHtml(j.title)}</strong>
              </div>
              <div class="text-[11px] text-[var(--muted)]">${icon} ${escapeHtml(j.category)} · ${escapeHtml(j.date)}${j.author ? ` · ${escapeHtml(j.author)}` : ''}</div>
            </div>
            ${canEditJournalEntry(j) ? '<button type="button" class="btn text-[10px] py-0 px-1.5 journal-delete-btn" title="Elimina voce">🗑️</button>' : ''}
          </div>
          ${j.content ? `<p class="leading-relaxed whitespace-pre-wrap">${linkify(j.content, { kind: 'journal', id: j.id })}</p>` : ''}
          ${LINK_CATEGORIES.includes(j.category) ? citedInHtml('journal', j.id, j.title) : ''}
          ${isQuestion ? (dm
            ? `<label class="flex flex-col gap-1 pt-1 border-t border-[var(--line)]"><span class="font-bold text-[var(--brass)]">Risposta del DM</span>
                 <textarea rows="2" class="input-field w-full text-xs journal-answer-input auto-grow auto-grow-sm" placeholder="Scrivi la risposta…">${escapeHtml(j.dmAnswer)}</textarea></label>`
            : j.dmAnswer ? `<div class="pt-1 border-t border-[var(--line)]"><strong class="text-[var(--brass)]">🐉 Risposta del DM:</strong> <span class="whitespace-pre-wrap">${linkify(j.dmAnswer)}</span></div>`
              : '<div class="text-[11px] italic text-[var(--muted)]">In attesa di risposta dal DM…</div>') : ''}
        </article>`;
    }).join('');
  });
}

function initJournalEvents() {
  document.querySelectorAll('.journal-filter-btn').forEach(b => b.addEventListener('click', () => {
    App.journalFilter = b.dataset.jfilter;
    renderJournal();
  }));
  const openForm = (open) => {
    showEl('journalAddFormCard', open);
    if (open) {
      if (App.journalFilter !== 'Tutto') $('journalInputCategory').value = App.journalFilter;
      focusSoon('journalInputTitle');
    }
  };
  $('btnToggleJournalForm').addEventListener('click', () => openForm($('journalAddFormCard').classList.contains('hidden')));
  $('btnCloseJournalForm').addEventListener('click', () => openForm(false));
  $('btnSubmitJournalEntry').addEventListener('click', () => {
    if (!App.activeId) return;
    const title = $('journalInputTitle').value.trim();
    const content = $('journalInputDetails').value.trim();
    if (!title && !content) { showToast('Scrivi almeno un titolo'); return; }
    addJournalEntry({ category: $('journalInputCategory').value, title: title || content.slice(0, 50), content });
    $('journalInputTitle').value = '';
    $('journalInputDetails').value = '';
    openForm(false);
    renderJournal();
    showToast('📥 Voce aggiunta al diario');
  });

  const list = $('journalEntriesList');
  list.addEventListener('click', (e) => {
    const card = e.target.closest('[data-journal-id]');
    if (!card) return;
    const j = ent(`journal:${card.dataset.journalId}`);
    if (!j) return;
    if (e.target.closest('.journal-delete-btn') && canEditJournalEntry(j)) {
      removeEnt(`journal:${j.id}`);
      renderJournal();
    }
  });
  list.addEventListener('change', (e) => {
    const card = e.target.closest('[data-journal-id]');
    const j = card && ent(`journal:${card.dataset.journalId}`);
    if (!j) return;
    if (e.target.classList.contains('journal-complete-toggle')) {
      j.completed = e.target.checked;
      touchEnt(`journal:${j.id}`);
      renderJournal();
    }
  });
  list.addEventListener('input', debounce((e) => {
    if (!e.target.classList.contains('journal-answer-input') || !isDM()) return;
    const card = e.target.closest('[data-journal-id]');
    const j = card && ent(`journal:${card.dataset.journalId}`);
    if (!j) return;
    j.dmAnswer = e.target.value;
    touchEnt(`journal:${j.id}`);
  }, 400));
}
