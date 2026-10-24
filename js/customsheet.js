// Schede personalizzate per giochi diversi da D&D 5e (o per regole della casa).
//
// • Il Master prepara dei modelli ("sheettpl:<id>") mettendo insieme dei campi: valori numerici con il loro
//   tiro, risorse con un massimo (PF, Stress, Speranza…), testi e tiri rapidi.
// • Alla creazione del personaggio il modello viene copiato nella scheda; il giocatore può aggiungere campi suoi.
// • Una risorsa fa da "barra della pedina", un valore da "difesa" e uno da "iniziativa": così mappa, danni,
//   iniziativa e barra in basso funzionano come per la 5e (ch.hp, ch.maxHp e ch.ac ne sono una copia).
// • La scheda 5e non cambia: le schede personalizzate esistono solo se il Master crea un modello.

const CUSTOM_FIELD_TYPES = {
  number: '🔢 Valore',
  resource: '❤️ Risorsa (con massimo)',
  text: '🏷️ Testo breve',
  longtext: '📝 Testo lungo',
  roll: '🎲 Tiro rapido'
};

function cfield(type, label, opts = {}) {
  return Object.assign({ id: uid('f'), type, label }, opts);
}

// Modelli di partenza: solo i nomi dei campi, nessun testo dei manuali
const STARTER_TEMPLATES = {
  vuota: () => ({
    name: 'Scheda base',
    fields: [
      cfield('resource', 'PF', { max: 10, value: 10, style: 'bar', hp: true }),
      cfield('number', 'Difesa', { value: 10, formula: '', defense: true }),
      cfield('number', 'Iniziativa', { value: 0, formula: '1d20+{v}', init: true }),
      cfield('longtext', 'Note', { value: '' })
    ]
  }),
  daggerheart: () => ({
    name: 'Daggerheart',
    fields: [
      cfield('text', 'Classe', { value: '' }), cfield('text', 'Sottoclasse', { value: '' }),
      cfield('text', 'Stirpe', { value: '' }), cfield('text', 'Comunità', { value: '' }),
      cfield('number', 'Livello', { value: 1, formula: '' }),
      ...['Agilità', 'Forza', 'Finezza', 'Istinto', 'Presenza', 'Conoscenza'].map(t => cfield('number', t, { value: 0, formula: '2d12+{v}' })),
      cfield('number', 'Evasione', { value: 10, formula: '', defense: true }),
      cfield('number', 'Soglia maggiore', { value: 7, formula: '' }),
      cfield('number', 'Soglia grave', { value: 14, formula: '' }),
      cfield('resource', 'PF', { max: 6, value: 6, style: 'boxes', hp: true }),
      cfield('resource', 'Stress', { max: 6, value: 0, style: 'boxes' }),
      cfield('resource', 'Speranza', { max: 6, value: 2, style: 'boxes' }),
      cfield('resource', 'Slot armatura', { max: 3, value: 3, style: 'boxes' }),
      cfield('roll', 'Tiro di Dualità', { formula: '2d12' }),
      cfield('longtext', 'Esperienze', { value: '' }),
      cfield('longtext', 'Carte dominio', { value: '' }),
      cfield('longtext', 'Armi e armatura', { value: '' }),
      cfield('longtext', 'Equipaggiamento', { value: '' })
    ]
  }),
  dnd2024: () => ({
    name: 'D&D 2024',
    fields: [
      cfield('text', 'Classe', { value: '' }), cfield('text', 'Specie', { value: '' }),
      cfield('text', 'Background', { value: '' }),
      cfield('number', 'Livello', { value: 1, formula: '' }),
      ...['FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'].map(k => cfield('number', k, { value: 10, formula: '1d20+{mod}' })),
      cfield('number', 'Bonus di competenza', { value: 2, formula: '' }),
      cfield('number', 'CA', { value: 12, formula: '', defense: true }),
      cfield('number', 'Iniziativa', { value: 0, formula: '1d20+{v}', init: true }),
      cfield('resource', 'PF', { max: 10, value: 10, style: 'bar', hp: true }),
      cfield('resource', 'Dadi vita', { max: 1, value: 1, style: 'boxes' }),
      cfield('resource', 'Ispirazione eroica', { max: 1, value: 0, style: 'boxes' }),
      cfield('text', 'Velocità', { value: '9 m' }),
      cfield('longtext', 'Talenti', { value: '' }),
      cfield('longtext', 'Maestria delle armi', { value: '' }),
      cfield('longtext', 'Incantesimi', { value: '' }),
      cfield('longtext', 'Equipaggiamento', { value: '' })
    ]
  })
};

function getSheetTemplates() {
  return entList('sheettpl:').sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'));
}

function isCustomChar(ch) {
  return ch?.sheetType === 'custom' && Array.isArray(ch.custom?.fields);
}

function customFlagField(ch, flag) {
  return isCustomChar(ch) ? ch.custom.fields.find(f => f[flag]) || null : null;
}

function clampResource(f) {
  f.max = Math.max(0, parseInt(f.max, 10) || 0);
  f.value = Math.max(0, Math.min(f.max, parseInt(f.value, 10) || 0));
}

// Le parti comuni dell'app (pedine, barra in basso, danni) leggono ch.hp, ch.maxHp e ch.ac
function syncCustomMirror(ch) {
  if (!isCustomChar(ch)) return;
  const hp = customFlagField(ch, 'hp');
  if (hp) {
    clampResource(hp);
    ch.maxHp = Math.max(1, hp.max);
    ch.hp = hp.value;
  }
  const def = customFlagField(ch, 'defense');
  if (def) ch.ac = parseInt(def.value, 10) || 0;
  ch.tempHp = 0;
}

function customLabel(ch, flag, fallback) {
  return customFlagField(ch, flag)?.label || fallback;
}

// "1d20+{mod}", "2d12+{Agilità}" → formula pronta per i dadi
function resolveCustomFormula(formula, ch, field) {
  const byLabel = new Map((ch?.custom?.fields || []).filter(f => f.type === 'number').map(f => [normLinkText(f.label), parseInt(f.value, 10) || 0]));
  const v = parseInt(field?.value, 10) || 0;
  let out = String(formula || '').replace(/\{([^}]+)\}/g, (all, name) => {
    const key = normLinkText(name);
    if (key === 'v' || key === 'valore') return String(v);
    if (key === 'mod') return String(Math.floor((v - 10) / 2));
    return byLabel.has(key) ? String(byLabel.get(key)) : '0';
  });
  out = out.replace(/\s+/g, '').replace(/\+-/g, '-').replace(/-\+/g, '-').replace(/--/g, '+').replace(/[+-]0(?![\d])/g, '');
  return out;
}

function rollCustomField(ch, field) {
  if (!field?.formula) return;
  const formula = resolveCustomFormula(field.formula, ch, field);
  performFormulaRoll(formula, `${ch.name}: ${field.label}`);
}

function adjustCustomHp(ch, delta) {
  const hp = customFlagField(ch, 'hp');
  if (!hp) { showToast('Questa scheda non ha una risorsa per la barra della pedina: sceglila nel modello'); return; }
  hp.value = Math.max(0, Math.min(hp.max, (parseInt(hp.value, 10) || 0) + delta));
  syncCustomMirror(ch);
  touchEnt(`char:${ch.id}`);
  if (hp.value === 0 && delta < 0) showToast(`💀 ${ch.name}: ${hp.label} a zero!`);
  scheduleRender();
}

// Personaggio nuovo da un modello: i campi si copiano, così i cambi al modello non toccano le schede già fatte
function buildCustomCharFields(tpl) {
  return {
    sheetType: 'custom',
    className: tpl.name,
    race: '',
    custom: { tplId: tpl.id, tplName: tpl.name, fields: JSON.parse(JSON.stringify(tpl.fields || [])) }
  };
}

function createCustomCharacter(name, tplId, opts) {
  const tpl = ent(`sheettpl:${tplId}`);
  if (!tpl) return null;
  const ch = createCharacter(Object.assign({ name }, buildCustomCharFields(tpl)), opts);
  syncCustomMirror(ch);
  touchEnt(`char:${ch.id}`);
  return ch;
}

// Opzioni "tipo di scheda" per i menu di creazione (vuoto se il Master non ha modelli)
function sheetTypeOptionsHtml(tpls = getSheetTemplates()) {
  if (!tpls.length) return '';
  return '<option value="5e">⚔️ D&D 5e (la scheda completa)</option>' + tpls.map(t => `<option value="${escapeHtml(t.id)}">🧩 ${escapeHtml(t.name)}</option>`).join('');
}

function refreshSheetTypeSelects() {
  const html = sheetTypeOptionsHtml();
  fillSheetTypeSelect($('newSheetType'), html);
}

function fillSheetTypeSelect(sel, html) {
  if (!sel || document.activeElement === sel) return;
  const current = sel.value;
  if (sel.dataset.html !== html) {
    sel.innerHTML = html;
    sel.dataset.html = html;
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }
  const row = sel.closest('[data-sheet-type-row]');
  showEl(row || sel, Boolean(html), row ? 'flex' : '');
}

// Nella finestra d'ingresso l'avventura può non essere ancora aperta: i modelli si leggono a parte
async function loadOnboardingSheetTypes(campId) {
  const sel = $('onbSheetType');
  fillSheetTypeSelect(sel, '');
  sel.value = '';
  applyOnboardingSheetType();
  await refreshOnboardingSheetTypes(campId);
}

// Finché la finestra è aperta ricontrolla ogni tanto: il Master può aver appena creato un modello
async function refreshOnboardingSheetTypes(campId) {
  clearTimeout(App.onbTplTimer);
  const sel = $('onbSheetType');
  const tpls = await Sync.fetchByPrefix(campId, 'sheettpl:');
  const stepOpen = !$('modalFirstTimeOnboarding').classList.contains('hidden') && !$('onboardingStepCharacter').classList.contains('hidden');
  if (App.onboardingCampId !== campId || !stepOpen) return;
  const hadOptions = sel.options.length > 0;
  fillSheetTypeSelect(sel, sheetTypeOptionsHtml(tpls.sort((a, b) => String(a.name).localeCompare(String(b.name), 'it'))));
  if (sel.options.length && !hadOptions) sel.value = '5e';
  applyOnboardingSheetType();
  App.onbTplTimer = setTimeout(() => refreshOnboardingSheetTypes(campId), 5000);
}

function applyOnboardingSheetType() {
  const sel = $('onbSheetType');
  const custom = Boolean(sel && sel.value && sel.value !== '5e' && sel.options.length);
  $('onboardingStepCharacter')?.classList.toggle('custom-sheet', custom);
}

// ---------------------------------------------------------------------------
// Scheda del personaggio
// ---------------------------------------------------------------------------

function customFieldHtml(f, editable, ch) {
  const dis = editable ? '' : 'disabled';
  const own = f.extra ? `<button type="button" class="text-[10px] text-[var(--danger)] cf-remove-btn" title="Togli questo campo">✕</button>` : '';
  if (f.type === 'number') {
    return `<div class="card-surface2 p-2 flex flex-col items-center gap-1" data-field-id="${escapeHtml(f.id)}">
      <span class="text-[11px] font-bold text-[var(--muted)] text-center leading-tight flex items-center gap-1">${escapeHtml(f.label)}${f.defense ? ' 🛡️' : ''}${f.init ? ' ⚡' : ''} ${own}</span>
      <input type="number" class="input-field w-16 text-center font-serif-title font-bold text-base cf-value" value="${escapeHtml(String(f.value ?? 0))}" ${dis} />
      ${f.formula ? `<button type="button" class="btn btn-felt text-[10px] py-0 px-1.5 cf-roll-btn" title="${escapeHtml(resolveCustomFormula(f.formula, ch, f))}">🎲 ${escapeHtml(resolveCustomFormula(f.formula, ch, f))}</button>` : ''}
    </div>`;
  }
  if (f.type === 'resource') {
    const max = Math.max(0, parseInt(f.max, 10) || 0);
    const value = Math.max(0, Math.min(max, parseInt(f.value, 10) || 0));
    const pct = max ? Math.round((value / max) * 100) : 0;
    const body = f.style === 'boxes' && max <= 20
      ? `<div class="flex flex-wrap gap-1">${Array.from({ length: max }, (_, i) => `<button type="button" class="cf-box ${i < value ? 'on' : ''}" data-box="${i + 1}" ${dis} aria-label="${i + 1}"></button>`).join('')}</div>`
      : `<div class="w-full bg-[var(--surface)] h-2.5 rounded-full overflow-hidden border border-[var(--line)]"><div class="h-full ${pct > 50 ? 'bg-[var(--ok)]' : pct > 25 ? 'bg-[var(--brass)]' : 'bg-[var(--danger)]'}" style="width:${pct}%"></div></div>`;
    return `<div class="card-surface2 p-2.5 flex flex-col gap-1.5" data-field-id="${escapeHtml(f.id)}">
      <div class="flex items-center justify-between gap-2">
        <span class="font-bold flex items-center gap-1">${escapeHtml(f.label)}${f.hp ? ' <span title="Barra della pedina">❤️</span>' : ''} ${own}</span>
        <span class="flex items-center gap-1">
          <button type="button" class="btn text-xs py-0 px-1.5 cf-dec-btn" ${dis}>−</button>
          <strong class="font-serif-title text-base">${value}</strong><span class="text-[var(--muted)]">/</span>
          <input type="number" min="0" max="999" class="input-field w-12 text-center py-0 cf-max" value="${max}" ${dis} aria-label="Massimo" />
          <button type="button" class="btn text-xs py-0 px-1.5 cf-inc-btn" ${dis}>+</button>
        </span>
      </div>
      ${body}
    </div>`;
  }
  if (f.type === 'text') {
    return `<label class="flex flex-col gap-1" data-field-id="${escapeHtml(f.id)}"><span class="font-bold text-[var(--muted)] flex items-center gap-1">${escapeHtml(f.label)} ${own}</span>
      <input type="text" class="input-field w-full font-bold cf-text" value="${escapeHtml(f.value || '')}" ${dis} /></label>`;
  }
  if (f.type === 'longtext') {
    return `<label class="flex flex-col gap-1 sm:col-span-2" data-field-id="${escapeHtml(f.id)}"><span class="font-bold text-[var(--muted)] flex items-center gap-1">${escapeHtml(f.label)} ${own}</span>
      <textarea rows="4" class="input-field w-full text-sm leading-relaxed cf-text" ${dis}>${escapeHtml(f.value || '')}</textarea></label>`;
  }
  if (f.type === 'roll') {
    return `<span class="inline-flex items-center gap-1" data-field-id="${escapeHtml(f.id)}"><button type="button" class="btn btn-brass text-xs cf-roll-btn" title="${escapeHtml(resolveCustomFormula(f.formula, ch, f))}">🎲 ${escapeHtml(f.label)} <span class="font-mono text-[10px]">${escapeHtml(resolveCustomFormula(f.formula, ch, f))}</span></button>${own}</span>`;
  }
  return '';
}

function renderCustomSheet(ch, editable) {
  const custom = isCustomChar(ch);
  $('sheetBody').classList.toggle('is-custom', custom);
  showEl('sheetCustomCard', custom);
  if (!custom) return;
  setText('sheetCustomTplName', ch.custom.tplName || 'Scheda personalizzata');
  const tpl = ent(`sheettpl:${ch.custom.tplId}`);
  const missing = tpl ? (tpl.fields || []).filter(tf => !ch.custom.fields.some(f => f.id === tf.id)) : [];
  showEl('btnCustomSyncTpl', editable && missing.length > 0, '');
  setText('btnCustomSyncTpl', `🔄 ${missing.length} ${missing.length === 1 ? 'campo nuovo' : 'campi nuovi'} dal modello`);
  showEl('btnCustomAddField', editable, '');
  const box = $('sheetCustomFields');
  safeRebuild(box, () => {
    const by = (type) => ch.custom.fields.filter(f => f.type === type);
    const section = (items, cls) => items.length ? `<div class="${cls}">${items.map(f => customFieldHtml(f, editable, ch)).join('')}</div>` : '';
    box.innerHTML = [
      section(by('text'), 'grid grid-cols-2 sm:grid-cols-4 gap-2'),
      section(by('number'), 'grid grid-cols-3 sm:grid-cols-6 gap-2'),
      section(by('resource'), 'grid grid-cols-1 sm:grid-cols-2 gap-2'),
      section(by('roll'), 'flex flex-wrap gap-1.5'),
      section(by('longtext'), 'grid grid-cols-1 sm:grid-cols-2 gap-2')
    ].join('') || '<div class="italic text-[var(--muted)]">Nessun campo: aggiungine uno con “➕ Campo”.</div>';
  });
  const conds = $('sheetCustomConditions');
  conds.innerHTML = (ch.conditions || []).map(c => `<button type="button" class="condition-btn active text-[11px] py-0.5 px-2 cf-cond-chip" data-condition="${escapeHtml(c)}" ${editable ? 'title="Tocca per togliere"' : 'disabled'}>${escapeHtml(c)}${editable ? ' ✕' : ''}</button>`).join('')
    || '<span class="text-[11px] text-[var(--muted)]">Nessuna condizione</span>';
  $('inputCustomCondition').disabled = !editable;
  $('btnAddCustomCondition').disabled = !editable;
}

function customFieldFromEvent(e) {
  const ch = currentSheetChar();
  const row = e.target.closest('[data-field-id]');
  if (!ch || !row || !isCustomChar(ch)) return {};
  return { ch, f: ch.custom.fields.find(x => x.id === row.dataset.fieldId) };
}

function saveCustom(ch) {
  syncCustomMirror(ch);
  touchEnt(`char:${ch.id}`);
}

// ---------------------------------------------------------------------------
// Modelli (schermo del Master)
// ---------------------------------------------------------------------------

function renderTemplatesCard() {
  const list = $('dmTemplatesList');
  if (!list) return;
  const tpls = getSheetTemplates();
  list.innerHTML = tpls.length ? tpls.map(t => {
    const used = getChars().filter(c => c.custom?.tplId === t.id).length;
    return `<div class="flex items-center justify-between gap-2 card-surface2 px-2 py-1.5" data-tpl-id="${escapeHtml(t.id)}">
      <span class="truncate"><strong>🧩 ${escapeHtml(t.name)}</strong> <span class="text-[var(--muted)]">· ${t.fields.length} campi${used ? ` · ${used} ${used === 1 ? 'scheda' : 'schede'}` : ''}</span></span>
      <span class="flex gap-1"><button type="button" class="btn text-[11px] py-0 px-1.5 tpl-edit-btn">✏️</button><button type="button" class="btn text-[11px] py-0 px-1.5 tpl-delete-btn">🗑️</button></span>
    </div>`;
  }).join('') : '<div class="italic text-[var(--muted)]">Nessun modello: i personaggi usano la scheda D&D 5e.</div>';
}

function openTemplateEditor(tplId, starter) {
  const tpl = tplId ? ent(`sheettpl:${tplId}`) : null;
  const base = tpl ? JSON.parse(JSON.stringify(tpl)) : Object.assign({ id: uid('tpl') }, STARTER_TEMPLATES[starter || 'vuota']());
  App.tplEdit = base;
  $('tplNameInput').value = base.name || '';
  renderTemplateEditorFields();
  showEl('modalTemplateEditor', true);
}

function renderTemplateEditorFields() {
  const t = App.tplEdit;
  if (!t) return;
  $('tplFieldsList').innerHTML = t.fields.map((f, i) => `
    <div class="card-surface2 p-2 flex flex-col gap-1.5" data-i="${i}">
      <div class="flex flex-wrap items-center gap-1.5">
        <select class="input-field text-xs py-0.5 tpl-f-type">${Object.entries(CUSTOM_FIELD_TYPES).map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="text" class="input-field text-xs py-0.5 flex-1 min-w-[8rem] font-bold tpl-f-label" value="${escapeHtml(f.label)}" placeholder="Nome del campo" />
        <button type="button" class="btn text-[11px] py-0 px-1.5 tpl-f-up" title="Su" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn text-[11px] py-0 px-1.5 tpl-f-down" title="Giù" ${i === t.fields.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="btn text-[11px] py-0 px-1.5 text-[var(--danger)] tpl-f-del" title="Togli">✕</button>
      </div>
      ${f.type === 'number' ? `<div class="flex flex-wrap items-center gap-2 text-[11px]">
        <label class="flex items-center gap-1">Tiro <input type="text" class="input-field text-xs py-0 w-28 font-mono tpl-f-formula" value="${escapeHtml(f.formula || '')}" placeholder="1d20+{v}" /></label>
        <label class="flex items-center gap-1">Iniziale <input type="number" class="input-field text-xs py-0 w-14 tpl-f-value" value="${escapeHtml(String(f.value ?? 0))}" /></label>
        <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="tpl-f-defense" ${f.defense ? 'checked' : ''} /> difesa 🛡️</label>
        <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="tpl-f-init" ${f.init ? 'checked' : ''} /> iniziativa ⚡</label>
      </div>` : ''}
      ${f.type === 'resource' ? `<div class="flex flex-wrap items-center gap-2 text-[11px]">
        <label class="flex items-center gap-1">Massimo <input type="number" min="0" max="999" class="input-field text-xs py-0 w-14 tpl-f-max" value="${escapeHtml(String(f.max ?? 10))}" /></label>
        <label class="flex items-center gap-1">Iniziale <input type="number" min="0" max="999" class="input-field text-xs py-0 w-14 tpl-f-value" value="${escapeHtml(String(f.value ?? f.max ?? 0))}" /></label>
        <select class="input-field text-xs py-0 tpl-f-style"><option value="bar" ${f.style !== 'boxes' ? 'selected' : ''}>barra</option><option value="boxes" ${f.style === 'boxes' ? 'selected' : ''}>caselle</option></select>
        <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" class="tpl-f-hp" ${f.hp ? 'checked' : ''} /> barra della pedina ❤️</label>
      </div>` : ''}
      ${f.type === 'roll' ? `<div class="flex items-center gap-2 text-[11px]"><label class="flex items-center gap-1">Formula <input type="text" class="input-field text-xs py-0 w-40 font-mono tpl-f-formula" value="${escapeHtml(f.formula || '')}" placeholder="2d12+{Agilità}" /></label></div>` : ''}
    </div>`).join('') || '<div class="italic text-[var(--muted)] text-xs">Nessun campo.</div>';
}

function onTemplateEditorChange(e) {
  const t = App.tplEdit;
  const row = e.target.closest('[data-i]');
  if (!t || !row) return;
  const f = t.fields[Number(row.dataset.i)];
  const cl = e.target.classList;
  if (cl.contains('tpl-f-label')) f.label = e.target.value.slice(0, 60);
  if (cl.contains('tpl-f-formula')) f.formula = e.target.value.trim().slice(0, 60);
  if (cl.contains('tpl-f-value')) f.value = parseInt(e.target.value, 10) || 0;
  if (cl.contains('tpl-f-max')) f.max = Math.max(0, parseInt(e.target.value, 10) || 0);
  if (cl.contains('tpl-f-style')) f.style = e.target.value;
  // Barra, difesa e iniziativa: una sola per modello
  ['hp', 'defense', 'init'].forEach(flag => {
    if (cl.contains(`tpl-f-${flag}`)) {
      t.fields.forEach(x => { delete x[flag]; });
      if (e.target.checked) f[flag] = true;
      renderTemplateEditorFields();
    }
  });
  if (cl.contains('tpl-f-type')) {
    f.type = e.target.value;
    if (f.type === 'resource' && f.max === undefined) { f.max = 10; f.value = 10; f.style = 'bar'; }
    if (f.type === 'number' && f.formula === undefined) f.formula = '1d20+{v}';
    if (f.type === 'roll' && !f.formula) f.formula = '1d20';
    renderTemplateEditorFields();
  }
}

function onTemplateEditorClick(e) {
  const t = App.tplEdit;
  const row = e.target.closest('[data-i]');
  if (!t || !row) return;
  const i = Number(row.dataset.i);
  if (e.target.closest('.tpl-f-del')) t.fields.splice(i, 1);
  else if (e.target.closest('.tpl-f-up') && i > 0) [t.fields[i - 1], t.fields[i]] = [t.fields[i], t.fields[i - 1]];
  else if (e.target.closest('.tpl-f-down') && i < t.fields.length - 1) [t.fields[i + 1], t.fields[i]] = [t.fields[i], t.fields[i + 1]];
  else return;
  renderTemplateEditorFields();
}

function saveTemplate() {
  const t = App.tplEdit;
  if (!t || !isDM()) return;
  t.name = $('tplNameInput').value.trim().slice(0, 60) || 'Scheda personalizzata';
  t.fields = t.fields.filter(f => String(f.label || '').trim());
  t.fields.forEach(f => { f.label = f.label.trim(); if (f.type === 'resource') clampResource(f); });
  putEnt(`sheettpl:${t.id}`, t);
  showEl('modalTemplateEditor', false);
  App.tplEdit = null;
  showToast(`🧩 Modello “${t.name}” salvato: ora si può scegliere quando si crea un personaggio`, 4000);
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initCustomSheetEvents() {
  const box = $('sheetCustomFields');
  box.addEventListener('click', (e) => {
    const { ch, f } = customFieldFromEvent(e);
    if (!ch || !f) return;
    if (e.target.closest('.cf-roll-btn')) { rollCustomField(ch, f); return; }
    if (!canEditChar(ch)) return;
    if (e.target.closest('.cf-remove-btn')) {
      if (!window.confirm(`Togliere il campo “${f.label}” da questa scheda?`)) return;
      ch.custom.fields = ch.custom.fields.filter(x => x !== f);
    } else if (e.target.closest('.cf-dec-btn') || e.target.closest('.cf-inc-btn')) {
      f.value = Math.max(0, Math.min(f.max, (parseInt(f.value, 10) || 0) + (e.target.closest('.cf-inc-btn') ? 1 : -1)));
    } else if (e.target.closest('.cf-box')) {
      // Tocco sull'ultima casella piena: la svuota; altrimenti riempie fino a lì
      const n = Number(e.target.closest('.cf-box').dataset.box);
      f.value = (parseInt(f.value, 10) || 0) === n ? n - 1 : n;
    } else return;
    saveCustom(ch);
    scheduleRender();
  });
  box.addEventListener('change', (e) => {
    const { ch, f } = customFieldFromEvent(e);
    if (!ch || !f || !canEditChar(ch)) return;
    if (e.target.classList.contains('cf-value')) f.value = parseInt(e.target.value, 10) || 0;
    else if (e.target.classList.contains('cf-max')) { f.max = Math.max(0, parseInt(e.target.value, 10) || 0); clampResource(f); }
    else if (e.target.classList.contains('cf-text')) f.value = e.target.value.slice(0, 20000);
    else return;
    saveCustom(ch);
    e.target.blur?.();
    scheduleRender();
  });
  $('btnCustomSyncTpl').addEventListener('click', () => {
    const ch = currentSheetChar();
    const tpl = ch && ent(`sheettpl:${ch.custom?.tplId}`);
    if (!tpl || !canEditChar(ch)) return;
    (tpl.fields || []).filter(tf => !ch.custom.fields.some(f => f.id === tf.id)).forEach(tf => ch.custom.fields.push(JSON.parse(JSON.stringify(tf))));
    saveCustom(ch);
    scheduleRender();
  });
  $('btnCustomAddField').addEventListener('click', () => showEl('customAddFieldRow', $('customAddFieldRow').classList.contains('hidden')));
  $('btnConfirmCustomField').addEventListener('click', () => {
    const ch = currentSheetChar();
    const label = $('customFieldLabel').value.trim();
    if (!ch || !isCustomChar(ch) || !canEditChar(ch)) return;
    if (!label) { showToast('Dai un nome al campo'); return; }
    const type = $('customFieldType').value;
    const extra = { extra: true, value: type === 'number' ? 0 : type === 'resource' ? 5 : '' };
    if (type === 'number') extra.formula = '1d20+{v}';
    if (type === 'resource') Object.assign(extra, { max: 5, style: 'boxes' });
    if (type === 'roll') extra.formula = $('customFieldFormula').value.trim() || '1d20';
    ch.custom.fields.push(cfield(type, label.slice(0, 60), extra));
    $('customFieldLabel').value = '';
    $('customFieldFormula').value = '';
    showEl('customAddFieldRow', false);
    saveCustom(ch);
    scheduleRender();
  });
  $('customFieldType').addEventListener('change', (e) => showEl('customFieldFormula', e.target.value === 'roll', ''));

  const addCondition = () => {
    const ch = currentSheetChar();
    const name = $('inputCustomCondition').value.trim();
    if (!ch || !name || !canEditChar(ch)) return;
    if (!ch.conditions.includes(name)) ch.conditions.push(name.slice(0, 40));
    $('inputCustomCondition').value = '';
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  };
  $('btnAddCustomCondition').addEventListener('click', addCondition);
  $('inputCustomCondition').addEventListener('keydown', (e) => { if (e.key === 'Enter') addCondition(); });
  $('sheetCustomConditions').addEventListener('click', (e) => {
    const chip = e.target.closest('.cf-cond-chip');
    const ch = currentSheetChar();
    if (!chip || !ch || !canEditChar(ch)) return;
    setCondition({ obj: ch, key: `char:${ch.id}` }, chip.dataset.condition, false);
    scheduleRender();
  });

  // Modelli
  $('btnNewTemplate').addEventListener('click', () => openTemplateEditor(null, $('newTemplateStarter').value));
  $('dmTemplatesList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-tpl-id]');
    if (!row || !isDM()) return;
    if (e.target.closest('.tpl-edit-btn')) openTemplateEditor(row.dataset.tplId);
    if (e.target.closest('.tpl-delete-btn')) {
      const tpl = ent(`sheettpl:${row.dataset.tplId}`);
      if (tpl && window.confirm(`Eliminare il modello “${tpl.name}”? Le schede già create restano come sono.`)) removeEnt(`sheettpl:${tpl.id}`);
      scheduleRender();
    }
  });
  $('tplFieldsList').addEventListener('change', onTemplateEditorChange);
  $('tplFieldsList').addEventListener('input', (e) => { if (e.target.classList.contains('tpl-f-label') || e.target.classList.contains('tpl-f-formula')) onTemplateEditorChange(e); });
  $('tplFieldsList').addEventListener('click', onTemplateEditorClick);
  $('btnTplAddField').addEventListener('click', () => {
    if (!App.tplEdit) return;
    App.tplEdit.fields.push(cfield('number', '', { value: 0, formula: '1d20+{v}' }));
    renderTemplateEditorFields();
    const inputs = document.querySelectorAll('#tplFieldsList .tpl-f-label');
    inputs[inputs.length - 1]?.focus();
  });
  $('btnTplSave').addEventListener('click', saveTemplate);
  $('btnTplCancel').addEventListener('click', () => { showEl('modalTemplateEditor', false); App.tplEdit = null; });
  $('onbSheetType').addEventListener('change', applyOnboardingSheetType);
}
