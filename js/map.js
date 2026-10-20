// Mappa tattica: sfondo, griglia, nebbia di guerra, pedine e misura dei movimenti.

let lastMapUrl = null;
let lastDefaultMapKey = null;
let fogPattern = null;
let gridBase = null;
let gridBaseTimer = null;

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function renderMap() {
  const scene = getScene();
  const dims = getSceneDims(scene);
  const stage = $('mapStage');
  const sizer = $('mapSizer');
  if (!stage || !sizer) return;
  stage.style.width = `${dims.width}px`;
  stage.style.height = `${dims.height}px`;
  stage.style.transform = `scale(${App.zoom})`;
  sizer.style.width = `${Math.round(dims.width * App.zoom)}px`;
  sizer.style.height = `${Math.round(dims.height * App.zoom)}px`;
  setText('zoomLevelText', `${Math.round(App.zoom * 100)}%`);
  renderMapBackground(dims);
  renderGridOverlay(scene, dims);
  renderFog(scene, dims);
  renderTokens();
  refreshTokenPopover();
}

function renderMapBackground(dims) {
  const img = $('customMapImage');
  const canvas = $('defaultDungeonCanvas');
  const url = ent('map')?.dataUrl || null;
  if (url) {
    if (url !== lastMapUrl) { img.src = url; lastMapUrl = url; }
    img.classList.remove('hidden');
    canvas.classList.add('hidden');
    return;
  }
  lastMapUrl = null;
  img.removeAttribute('src');
  img.classList.add('hidden');
  canvas.classList.remove('hidden');
  const key = `${dims.width}x${dims.height}`;
  if (key !== lastDefaultMapKey) {
    drawDefaultDungeonMap(canvas, dims.width, dims.height);
    lastDefaultMapKey = key;
  }
}

// Un piccolo dungeon disegnato a mano: stanze, corridoi, colonne e scale
function drawDefaultDungeonMap(canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  let seed = 1234567;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const u = w / 16;

  ctx.fillStyle = '#101612';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.012 + rnd() * 0.025})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 4);
  }

  const areas = [
    { x: 1, y: 2, w: 6, h: 8 },     // sala d'ingresso
    { x: 7, y: 5, w: 3, h: 2 },     // corridoio
    { x: 10, y: 1, w: 5, h: 5 },    // cripta nord
    { x: 10, y: 7, w: 5, h: 4 },    // cripta sud
    { x: 12, y: 6, w: 1, h: 1 }     // passaggio
  ];
  const inside = (cx, cy) => areas.some(a => cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h);

  // Pavimento a lastre
  areas.forEach(a => {
    for (let cy = a.y; cy < a.y + a.h; cy++) {
      for (let cx = a.x; cx < a.x + a.w; cx++) {
        const shade = 40 + Math.floor(rnd() * 14);
        ctx.fillStyle = `rgb(${shade - 4}, ${shade + 4}, ${shade - 2})`;
        ctx.fillRect(cx * u, cy * u, u, u);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx * u + 0.5, cy * u + 0.5, u - 1, u - 1);
        if (rnd() < 0.25) {
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.moveTo(cx * u + rnd() * u, cy * u + rnd() * u);
          ctx.lineTo(cx * u + rnd() * u, cy * u + rnd() * u);
          ctx.stroke();
        }
      }
    }
  });

  // Muri: un bordo spesso dove una casella di pavimento confina con la roccia
  ctx.strokeStyle = '#0A0D0B';
  ctx.lineWidth = 6;
  ctx.lineCap = 'square';
  const maxRows = Math.ceil(h / u);
  for (let cy = 0; cy < maxRows; cy++) {
    for (let cx = 0; cx < 16; cx++) {
      if (!inside(cx, cy)) continue;
      const x = cx * u;
      const y = cy * u;
      ctx.beginPath();
      if (!inside(cx, cy - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + u, y); }
      if (!inside(cx, cy + 1)) { ctx.moveTo(x, y + u); ctx.lineTo(x + u, y + u); }
      if (!inside(cx - 1, cy)) { ctx.moveTo(x, y); ctx.lineTo(x, y + u); }
      if (!inside(cx + 1, cy)) { ctx.moveTo(x + u, y); ctx.lineTo(x + u, y + u); }
      ctx.stroke();
    }
  }

  // Colonne
  [[2.5, 4], [5.5, 4], [2.5, 8], [5.5, 8]].forEach(([cx, cy]) => {
    ctx.fillStyle = '#5B655D';
    ctx.beginPath(); ctx.arc(cx * u, cy * u, u * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1A201C'; ctx.lineWidth = 3; ctx.stroke();
  });
  // Sarcofagi nella cripta nord
  [[11, 2], [13, 2]].forEach(([cx, cy]) => {
    ctx.fillStyle = '#6E6A5C';
    ctx.fillRect(cx * u + u * 0.2, cy * u + u * 0.15, u * 0.6, u * 1.7);
    ctx.strokeStyle = '#2A2822'; ctx.lineWidth = 2;
    ctx.strokeRect(cx * u + u * 0.2, cy * u + u * 0.15, u * 0.6, u * 1.7);
  });
  // Scale verso l'esterno
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#4B544D' : '#3C443E';
    ctx.fillRect(1 * u + 2, 9 * u + (i * u) / 5, u * 2 - 4, u / 5);
  }
  // Altare con lo smeraldo
  ctx.fillStyle = '#7A6A44';
  ctx.fillRect(12 * u + u * 0.1, 9 * u + u * 0.2, u * 0.8, u * 0.6);
  ctx.fillStyle = '#3FBF7F';
  ctx.beginPath(); ctx.arc(12.5 * u, 9.5 * u, u * 0.12, 0, Math.PI * 2); ctx.fill();
}

function renderGridOverlay(scene, dims) {
  const canvas = $('gridOverlayCanvas');
  if (!canvas) return;
  if (canvas.width !== dims.width) canvas.width = dims.width;
  if (canvas.height !== dims.height) canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setText('gridStatusText', scene.gridEnabled ? 'accesa' : 'spenta');
  setVal($('inputGridSize'), scene.gridSize);
  setVal($('inputGridSizeNumber'), scene.gridSize);
  if (!scene.gridEnabled) return;
  ctx.strokeStyle = dims.cellPx < 12 ? 'rgba(243, 231, 194, 0.14)' : 'rgba(243, 231, 194, 0.26)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= dims.cols; c++) {
    const x = Math.round(c * dims.cellPx) + 0.5;
    ctx.moveTo(x, 0); ctx.lineTo(x, dims.height);
  }
  for (let r = 0; r <= dims.rows; r++) {
    const y = Math.round(r * dims.cellPx) + 0.5;
    ctx.moveTo(0, y); ctx.lineTo(dims.width, y);
  }
  ctx.stroke();
}

function isCellFogged(scene, x, y) {
  if (!scene.fogEnabled) return false;
  return scene.fog[y * scene.fogCols + x] === '1';
}

function renderFog(scene, dims) {
  const canvas = $('fogCanvas');
  if (!canvas) return;
  if (canvas.width !== dims.width) canvas.width = dims.width;
  if (canvas.height !== dims.height) canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setText('fogStatusText', scene.fogEnabled ? 'accesa' : 'spenta');
  const editing = isDM() && App.fogEdit && scene.fogEnabled;
  canvas.classList.toggle('editing-fog', editing);
  $('tokenLayer')?.classList.toggle('fog-editing', editing);
  $('btnToggleFogBrush')?.classList.toggle('btn-felt', App.fogEdit);
  setText('fogBrushText', App.fogEdit ? 'Pennello attivo' : 'Pennello nebbia');
  if (!scene.fogEnabled) return;

  const dm = isDM();
  ctx.beginPath();
  for (let r = 0; r < dims.rows; r++) {
    for (let c = 0; c < dims.cols; c++) {
      if (scene.fog[r * dims.cols + c] !== '1') continue;
      const x0 = Math.floor(c * dims.cellPx);
      const y0 = Math.floor(r * dims.cellPx);
      ctx.rect(x0, y0, Math.ceil((c + 1) * dims.cellPx) - x0, Math.ceil((r + 1) * dims.cellPx) - y0);
    }
  }
  if (dm) {
    ctx.fillStyle = 'rgba(10, 16, 12, 0.55)';
    ctx.fill();
    if (!fogPattern) {
      const p = document.createElement('canvas');
      p.width = 10; p.height = 10;
      const pc = p.getContext('2d');
      pc.strokeStyle = 'rgba(243, 231, 194, 0.10)';
      pc.lineWidth = 2;
      pc.beginPath(); pc.moveTo(0, 10); pc.lineTo(10, 0); pc.stroke();
      fogPattern = ctx.createPattern(p, 'repeat');
    }
    ctx.fillStyle = fogPattern;
    ctx.fill();
  } else {
    const fogColor = getComputedStyle(document.documentElement).getPropertyValue('--fog').trim() || '#16211B';
    ctx.fillStyle = fogColor;
    ctx.fill();
  }
}

function getActiveTurnTokenId() {
  const meta = getInitMeta();
  if (!meta.inCombat || !meta.activeId) return null;
  const entry = ent(`init:${meta.activeId}`);
  if (!entry) return null;
  if (entry.tokenId && getToken(entry.tokenId)) return entry.tokenId;
  if (entry.charId) return tokenForChar(entry.charId)?.id || null;
  // Voci della prima versione: collegate solo per nome
  return getTokens().find(t => tokenStats(t).name === entry.name)?.id || null;
}

function renderTokens() {
  const layer = $('tokenLayer');
  if (!layer) return;
  if (App.drag) { App.tokensStale = true; return; }
  App.tokensStale = false;
  layer.innerHTML = '';
  const scene = getScene();
  const dims = getSceneDims(scene);
  const dm = isDM();
  const activeTokenId = getActiveTurnTokenId();
  const tokenSize = Math.max(14, Math.min(140, dims.cellPx * 0.84));
  const order = { enemy: 0, npc: 1, pc: 2 };
  const tokens = getTokens().slice().sort((a, b) => order[a.type] - order[b.type]);

  tokens.forEach(tok => {
    const gx = Math.min(dims.cols - 1, tok.gridX);
    const gy = Math.min(dims.rows - 1, tok.gridY);
    if (!dm && tok.hidden) return;
    if (!dm && tok.type !== 'pc' && isCellFogged(scene, gx, gy)) return;
    const stats = tokenStats(tok);
    const el = document.createElement('div');
    el.className = `map-token token-${tok.type}`;
    if (tok.hidden && dm) el.classList.add('token-hidden-dm');
    if (stats.maxHp > 0 && stats.hp <= 0) el.classList.add('token-down');
    if (!dm && canControlToken(tok)) el.classList.add('token-mine');
    if (!canControlToken(tok)) el.classList.add('no-drag');
    if (activeTokenId && tok.id === activeTokenId) el.classList.add('active-turn-token');
    el.style.width = `${tokenSize}px`;
    el.style.height = `${tokenSize}px`;
    el.style.left = `${(gx + 0.5) * dims.cellPx - tokenSize / 2}px`;
    el.style.top = `${(gy + 0.5) * dims.cellPx - tokenSize / 2}px`;
    el.style.fontSize = `${Math.max(8, Math.round(tokenSize * 0.36))}px`;
    el.dataset.tokenId = tok.id;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', stats.name);
    el.title = stats.name;
    el.appendChild(document.createTextNode(initialsOf(stats.name)));

    const showHp = stats.maxHp > 0 && (dm || tok.type === 'pc' || stats.char);
    if (showHp && tokenSize >= 18) {
      const hpWrap = document.createElement('div');
      hpWrap.className = 'token-hp-bar';
      const hpFill = document.createElement('div');
      hpFill.className = 'token-hp-fill';
      const pct = Math.max(0, Math.min(100, Math.round((stats.hp / stats.maxHp) * 100)));
      hpFill.style.width = `${pct}%`;
      hpFill.style.background = pct > 50 ? '#38A169' : pct > 25 ? '#D69E2E' : '#E53E3E';
      hpWrap.appendChild(hpFill);
      el.appendChild(hpWrap);
    }
    if (stats.conditions.length) {
      const badge = document.createElement('div');
      badge.className = 'token-condition-badge';
      badge.textContent = stats.conditions.length;
      badge.title = stats.conditions.join(', ');
      el.appendChild(badge);
    }
    if (tokenSize >= 18) {
      const label = document.createElement('div');
      label.className = 'token-label-pill';
      label.textContent = dm && stats.maxHp > 0 ? `${stats.name} (${stats.hp}/${stats.maxHp})` : stats.name;
      el.appendChild(label);
    }
    el.addEventListener('pointerdown', onTokenPointerDown);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTokenPopover(tok.id, el); } });
    el.tabIndex = 0;
    layer.appendChild(el);
  });
}

function initialsOf(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const num = words.length > 1 && /^\d+$/.test(words[words.length - 1]) ? words.pop() : '';
  const base = words.map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return num ? `${base.substring(0, 1)}${num}` : base || '?';
}

// ---------------------------------------------------------------------------
// Coordinate e zoom
// ---------------------------------------------------------------------------

function stagePoint(clientX, clientY) {
  const rect = $('mapStage').getBoundingClientRect();
  return { x: (clientX - rect.left) / App.zoom, y: (clientY - rect.top) / App.zoom };
}

function cellAtClient(clientX, clientY, dims) {
  const p = stagePoint(clientX, clientY);
  return {
    x: Math.max(0, Math.min(dims.cols - 1, Math.floor(p.x / dims.cellPx))),
    y: Math.max(0, Math.min(dims.rows - 1, Math.floor(p.y / dims.cellPx)))
  };
}

function setZoom(z, userSet = true) {
  const viewport = $('mapViewport');
  const old = App.zoom;
  const next = Math.max(0.25, Math.min(3, Math.round(z * 100) / 100));
  if (userSet) App.zoomUserSet = true;
  if (!viewport || next === old) { App.zoom = next; renderMap(); return; }
  const cx = (viewport.scrollLeft + viewport.clientWidth / 2) / old;
  const cy = (viewport.scrollTop + viewport.clientHeight / 2) / old;
  App.zoom = next;
  renderMap();
  viewport.scrollLeft = cx * next - viewport.clientWidth / 2;
  viewport.scrollTop = cy * next - viewport.clientHeight / 2;
}

function fitZoom() {
  const viewport = $('mapViewport');
  if (!viewport || !viewport.clientWidth) return;
  const dims = getSceneDims(getScene());
  const z = Math.min((viewport.clientWidth - 8) / dims.width, (viewport.clientHeight - 8) / dims.height);
  App.zoom = Math.max(0.25, Math.min(1.5, Math.floor(z * 100) / 100));
  renderMap();
}

// ---------------------------------------------------------------------------
// Griglia e nebbia
// ---------------------------------------------------------------------------

// Cambia il numero di colonne mantenendo nebbia e pedine dove sono.
// Durante il trascinamento dello slider si parte sempre dalla griglia iniziale.
function setGridSize(n) {
  const scene = getScene();
  const size = clampInt(n, 4, 120, 16);
  if (!gridBase) {
    const dims = getSceneDims(scene);
    gridBase = { dims, fog: scene.fog, tokens: getTokens().map(t => ({ id: t.id, x: t.gridX, y: t.gridY })) };
  }
  clearTimeout(gridBaseTimer);
  gridBaseTimer = setTimeout(() => { gridBase = null; }, 1500);
  if (size === scene.gridSize && getSceneDims(scene).cols === size) return;
  scene.gridSize = size;
  const dims = getSceneDims(scene);
  scene.fog = resampleFog(gridBase.fog, gridBase.dims.cols, gridBase.dims.rows, dims.cols, dims.rows);
  scene.fogCols = dims.cols;
  scene.fogRows = dims.rows;
  touchEnt('scene');
  gridBase.tokens.forEach(b => {
    const tok = getToken(b.id);
    if (!tok) return;
    const nx = Math.max(0, Math.min(dims.cols - 1, Math.floor(((b.x + 0.5) * gridBase.dims.cellPx) / dims.cellPx)));
    const ny = Math.max(0, Math.min(dims.rows - 1, Math.floor(((b.y + 0.5) * gridBase.dims.cellPx) / dims.cellPx)));
    if (nx !== tok.gridX || ny !== tok.gridY) {
      tok.gridX = nx;
      tok.gridY = ny;
      touchEnt(`token:${tok.id}`);
    }
  });
  renderMap();
}

function fogBrushRadius(cols) {
  if (cols <= 24) return 0;
  if (cols <= 48) return 1;
  if (cols <= 80) return 2;
  return 3;
}

function paintFogAt(cx, cy, target) {
  const scene = getScene();
  const dims = getSceneDims(scene);
  const radius = fogBrushRadius(dims.cols);
  const chars = scene.fog.split('');
  let changed = false;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= dims.cols || y >= dims.rows) continue;
      const idx = y * dims.cols + x;
      if (chars[idx] !== target) { chars[idx] = target; changed = true; }
    }
  }
  if (!changed) return;
  scene.fog = chars.join('');
  touchEnt('scene');
  renderFog(scene, dims);
}

function onFogPointerDown(e) {
  if (!isDM() || !App.fogEdit) return;
  e.preventDefault();
  const scene = getScene();
  const dims = getSceneDims(scene);
  const cell = cellAtClient(e.clientX, e.clientY, dims);
  const target = scene.fog[cell.y * dims.cols + cell.x] === '1' ? '0' : '1';
  App.fogPaint = { target, last: cell, pointerId: e.pointerId };
  e.currentTarget.setPointerCapture(e.pointerId);
  paintFogAt(cell.x, cell.y, target);
}

function onFogPointerMove(e) {
  const paint = App.fogPaint;
  if (!paint || e.pointerId !== paint.pointerId) return;
  const dims = getSceneDims(getScene());
  const cell = cellAtClient(e.clientX, e.clientY, dims);
  // Riempie anche le caselle saltate se il dito/mouse va veloce
  const steps = Math.max(Math.abs(cell.x - paint.last.x), Math.abs(cell.y - paint.last.y));
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(paint.last.x + ((cell.x - paint.last.x) * i) / steps);
    const y = Math.round(paint.last.y + ((cell.y - paint.last.y) * i) / steps);
    paintFogAt(x, y, paint.target);
  }
  paint.last = cell;
}

function onFogPointerUp() {
  if (!App.fogPaint) return;
  App.fogPaint = null;
  renderTokens();
}

function setAllFog(value) {
  const scene = getScene();
  const dims = getSceneDims(scene);
  scene.fog = (value ? '1' : '0').repeat(dims.cols * dims.rows);
  scene.fogCols = dims.cols;
  scene.fogRows = dims.rows;
  touchEnt('scene');
  renderMap();
}

// ---------------------------------------------------------------------------
// Trascinamento delle pedine
// ---------------------------------------------------------------------------

function onTokenPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget;
  const tok = getToken(el.dataset.tokenId);
  if (!tok) return;
  const dims = getSceneDims(getScene());
  App.drag = {
    tokenId: tok.id, el, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
    moved: false, canMove: canControlToken(tok), dims,
    start: { x: Math.min(dims.cols - 1, tok.gridX), y: Math.min(dims.rows - 1, tok.gridY) }, target: null
  };
  try { el.setPointerCapture(e.pointerId); } catch (err) {}
  el.addEventListener('pointermove', onTokenPointerMove);
  el.addEventListener('pointerup', onTokenPointerUp);
  el.addEventListener('pointercancel', onTokenPointerCancel);
}

function onTokenPointerMove(e) {
  const drag = App.drag;
  if (!drag || e.pointerId !== drag.pointerId || !drag.canMove) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
    drag.moved = true;
    drag.el.classList.add('dragging');
    closeTokenPopover();
  }
  if (!drag.moved) return;
  const p = stagePoint(e.clientX, e.clientY);
  const size = drag.el.offsetWidth;
  drag.el.style.left = `${Math.max(0, Math.min(drag.dims.width, p.x)) - size / 2}px`;
  drag.el.style.top = `${Math.max(0, Math.min(drag.dims.height, p.y)) - size / 2}px`;
  drag.target = cellAtClient(e.clientX, e.clientY, drag.dims);
  showDragMeasure(drag);
}

function showDragMeasure(drag) {
  const { dims, start, target } = drag;
  const sx = (start.x + 0.5) * dims.cellPx;
  const sy = (start.y + 0.5) * dims.cellPx;
  const tx = (target.x + 0.5) * dims.cellPx;
  const ty = (target.y + 0.5) * dims.cellPx;
  const svg = $('dragMeasureSvg');
  svg.setAttribute('viewBox', `0 0 ${dims.width} ${dims.height}`);
  const origin = $('dragMeasureOrigin');
  const line = $('dragMeasureLine');
  origin.setAttribute('cx', sx); origin.setAttribute('cy', sy);
  line.setAttribute('x1', sx); line.setAttribute('y1', sy);
  line.setAttribute('x2', tx); line.setAttribute('y2', ty);
  origin.classList.remove('hidden');
  line.classList.remove('hidden');
  // Regola base 5e: ogni casella, anche in diagonale, costa 1,5 m
  const squares = Math.max(Math.abs(target.x - start.x), Math.abs(target.y - start.y));
  const tok = getToken(drag.tokenId);
  const speed = tok?.charId ? getChar(tok.charId)?.speed : null;
  const tooFar = speed && squares * 1.5 > speed;
  const badge = $('dragDistanceBadge');
  badge.textContent = `${formatMeters(squares)}${tooFar ? ' ⚠️' : ''}`;
  badge.title = tooFar ? `Oltre la velocità (${speed} m)` : '';
  badge.style.background = tooFar ? 'var(--danger)' : 'var(--brass)';
  badge.style.left = `${tx}px`;
  badge.style.top = `${ty - dims.cellPx * 0.4}px`;
  badge.classList.remove('hidden');
}

function hideDragMeasure() {
  $('dragMeasureOrigin')?.classList.add('hidden');
  $('dragMeasureLine')?.classList.add('hidden');
  $('dragDistanceBadge')?.classList.add('hidden');
}

function endTokenDrag(e) {
  const drag = App.drag;
  if (!drag) return null;
  try { drag.el.releasePointerCapture(e.pointerId); } catch (err) {}
  drag.el.removeEventListener('pointermove', onTokenPointerMove);
  drag.el.removeEventListener('pointerup', onTokenPointerUp);
  drag.el.removeEventListener('pointercancel', onTokenPointerCancel);
  App.drag = null;
  hideDragMeasure();
  return drag;
}

function onTokenPointerUp(e) {
  const drag = endTokenDrag(e);
  if (!drag) return;
  const tok = getToken(drag.tokenId);
  if (drag.moved && tok && drag.target) {
    if (tok.gridX !== drag.target.x || tok.gridY !== drag.target.y) {
      tok.gridX = drag.target.x;
      tok.gridY = drag.target.y;
      touchEnt(`token:${tok.id}`);
    }
    renderTokens();
  } else {
    if (App.tokensStale) renderTokens();
    if (tok) openTokenPopover(tok.id, document.querySelector(`.map-token[data-token-id="${CSS.escape(tok.id)}"]`) || drag.el);
  }
}

function onTokenPointerCancel(e) {
  endTokenDrag(e);
  renderTokens();
}

// ---------------------------------------------------------------------------
// Finestrella della pedina
// ---------------------------------------------------------------------------

function openTokenPopover(tokenId, anchorEl) {
  App.selectedTokenId = tokenId;
  const popover = $('tokenQuickPopover');
  popover.classList.remove('hidden');
  fillTokenPopover();
  const rect = (anchorEl && anchorEl.isConnected ? anchorEl : $('mapViewport')).getBoundingClientRect();
  const pw = popover.offsetWidth || 256;
  const ph = popover.offsetHeight || 220;
  let left = rect.right + 10;
  if (left + pw > window.innerWidth - 8) left = rect.left - pw - 10;
  if (left < 8) left = Math.max(8, Math.min(window.innerWidth - pw - 8, rect.left + rect.width / 2 - pw / 2));
  let top = rect.top + rect.height / 2 - ph / 2;
  top = Math.max(8, Math.min(window.innerHeight - ph - 8, top));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.right = 'auto';
}

function fillTokenPopover() {
  const tok = getToken(App.selectedTokenId);
  if (!tok) { closeTokenPopover(); return; }
  const dm = isDM();
  const stats = tokenStats(tok);
  const typeLabel = tok.type === 'pc' ? 'PG' : tok.type === 'npc' ? 'PNG alleato' : 'Nemico';
  setText('popoverTokenName', stats.name);
  const publicStats = dm || tok.type === 'pc' || Boolean(stats.char);
  setText('popoverTokenType', publicStats ? `${typeLabel} • CA ${stats.ac}${tok.hidden ? ' • nascosta' : ''}` : typeLabel);
  showEl('popoverHpBlock', publicStats && stats.maxHp > 0);
  setText('popoverHpText', `${stats.hp} / ${stats.maxHp}`);
  const pct = stats.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((stats.hp / stats.maxHp) * 100))) : 0;
  $('popoverHpBar').style.width = `${pct}%`;
  $('popoverHpBar').style.background = pct > 50 ? 'var(--ok)' : pct > 25 ? 'var(--brass)' : 'var(--danger)';
  const status = $('popoverHpStatus');
  status.textContent = describeHealth(stats.hp, stats.maxHp);
  showEl(status, !publicStats && stats.maxHp > 0, '');
  showEl('popoverHpControls', canControlToken(tok) && stats.maxHp > 0);
  showEl('btnPopoverOpenSheet', Boolean(stats.char), '');
  showEl('popoverDmActions', dm);
  setText('btnPopoverToggleHidden', tok.hidden ? '👁️ Mostra ai giocatori' : '👁️‍🗨️ Nascondi ai giocatori');
}

function refreshTokenPopover() {
  if (!App.selectedTokenId || $('tokenQuickPopover').classList.contains('hidden')) return;
  fillTokenPopover();
}

function closeTokenPopover() {
  App.selectedTokenId = null;
  $('tokenQuickPopover')?.classList.add('hidden');
}

function applyTokenHpDelta(tokenId, delta) {
  const tok = getToken(tokenId);
  if (!tok || !canControlToken(tok) || !delta) return;
  const ch = tok.charId ? getChar(tok.charId) : null;
  if (ch) {
    adjustCharHp(ch, delta);
  } else {
    tok.hp = Math.max(0, Math.min(tok.maxHp, tok.hp + delta));
    touchEnt(`token:${tok.id}`);
    if (tok.hp === 0 && delta < 0) showToast(`💀 ${tok.name} è a terra!`);
  }
  scheduleRender();
}

function deleteToken(tokenId) {
  const tok = getToken(tokenId);
  if (!tok) return;
  removeEnt(`token:${tok.id}`);
  getInitEntries().filter(e => e.tokenId === tok.id && !e.charId).forEach(e => removeEnt(`init:${e.id}`));
  closeTokenPopover();
  scheduleRender();
}

// ---------------------------------------------------------------------------
// Nuove pedine
// ---------------------------------------------------------------------------

function visibleCenterCell() {
  const viewport = $('mapViewport');
  const dims = getSceneDims(getScene());
  if (!viewport) return { x: Math.floor(dims.cols / 2), y: Math.floor(dims.rows / 2) };
  const vr = viewport.getBoundingClientRect();
  return cellAtClient(vr.left + vr.width / 2, vr.top + vr.height / 2, dims);
}

// Cerca a spirale la casella libera più vicina, preferendo le zone già scoperte
function findFreeCell(near, preferRevealed = true) {
  const scene = getScene();
  const dims = getSceneDims(scene);
  const occupied = new Set(getTokens().map(t => `${t.gridX},${t.gridY}`));
  const start = near || visibleCenterCell();
  let fallback = null;
  for (let radius = 0; radius < Math.max(dims.cols, dims.rows); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = start.x + dx;
        const y = start.y + dy;
        if (x < 0 || y < 0 || x >= dims.cols || y >= dims.rows || occupied.has(`${x},${y}`)) continue;
        if (!preferRevealed || !isCellFogged(scene, x, y)) return { x, y };
        if (!fallback) fallback = { x, y };
      }
    }
  }
  return fallback || { x: 0, y: 0 };
}

// Centro della zona già scoperta (o della mappa): lì compaiono le pedine dei nuovi PG
function revealedCenterCell() {
  const scene = getScene();
  const dims = getSceneDims(scene);
  const center = { x: Math.floor(dims.cols / 2), y: Math.floor(dims.rows / 2) };
  if (!scene.fogEnabled) return center;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < scene.fog.length; i++) {
    if (scene.fog[i] !== '0') continue;
    sx += i % dims.cols; sy += Math.floor(i / dims.cols); n++;
  }
  return n ? { x: Math.round(sx / n), y: Math.round(sy / n) } : center;
}

function createTokenForChar(ch) {
  if (!ch || tokenForChar(ch.id)) return;
  const cell = findFreeCell(revealedCenterCell());
  const tok = normalizeToken({ id: uid('tok'), name: ch.name, type: ch.isNpc ? 'npc' : 'pc', charId: ch.id, gridX: cell.x, gridY: cell.y, hp: ch.hp, maxHp: ch.maxHp, ac: ch.ac });
  putEnt(`token:${tok.id}`, tok);
}

function openAddTokenModal() {
  showEl('modalAddToken', true);
  focusSoon('inputNewTokenName', true);
}

function closeAddTokenModal() { showEl('modalAddToken', false); }

function confirmAddToken() {
  const name = $('inputNewTokenName').value.trim() || 'Pedina';
  const maxHp = Math.max(0, parseInt($('inputNewTokenMaxHp').value, 10) || 0);
  const hp = Math.max(0, Math.min(maxHp || 9999, parseInt($('inputNewTokenHp').value, 10) || maxHp));
  const cell = findFreeCell(visibleCenterCell(), false);
  const tok = normalizeToken({
    id: uid('tok'), name, type: $('selectNewTokenType').value, gridX: cell.x, gridY: cell.y,
    hp, maxHp, ac: parseInt($('inputNewTokenAc').value, 10) || 10, hidden: $('inputNewTokenHidden').checked
  });
  putEnt(`token:${tok.id}`, tok);
  closeAddTokenModal();
  renderMap();
  showToast(`➕ ${name} aggiunta alla mappa`);
}

// ---------------------------------------------------------------------------
// Mappa caricata dal DM
// ---------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function uploadMapImage(file) {
  if (!file || !file.type.startsWith('image/')) { showToast('⚠️ Scegli un file immagine'); return; }
  try {
    showToast('⏳ Preparo la mappa…');
    const img = await loadImage(await readFileAsDataUrl(file));
    // Riduciamo l'immagine per non appesantire la sincronizzazione
    const maxW = 1600;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#232b25';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const scene = getScene();
    scene.height = Math.max(200, Math.min(2400, Math.round((MAP_WIDTH * h) / w)));
    const dims = getSceneDims(scene);
    scene.fog = '1'.repeat(dims.cols * dims.rows);
    scene.fogCols = dims.cols;
    scene.fogRows = dims.rows;
    scene.hasMap = true;
    scene.mapVersion = (scene.mapVersion || 0) + 1;
    putEnt('map', { dataUrl });
    touchEnt('scene');
    clampTokensToScene();
    App.zoomUserSet = false;
    fitZoom();
    showToast('🗺️ Mappa caricata: la nebbia copre tutto, scopri le zone col pennello');
  } catch (err) {
    showToast('⚠️ Impossibile leggere questa immagine');
  }
}

function resetDefaultMap() {
  const scene = getScene();
  if (ent('map')) removeEnt('map');
  scene.hasMap = false;
  scene.height = DEFAULT_MAP_HEIGHT;
  normalizeScene(scene);
  touchEnt('scene');
  clampTokensToScene();
  App.zoomUserSet = false;
  fitZoom();
}

function clampTokensToScene() {
  const dims = getSceneDims(getScene());
  getTokens().forEach(t => {
    const x = Math.min(dims.cols - 1, t.gridX);
    const y = Math.min(dims.rows - 1, t.gridY);
    if (x !== t.gridX || y !== t.gridY) { t.gridX = x; t.gridY = y; touchEnt(`token:${t.id}`); }
  });
}

// ---------------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------------

function initMapEvents() {
  $('btnZoomIn').addEventListener('click', () => setZoom(App.zoom * 1.25));
  $('btnZoomOut').addEventListener('click', () => setZoom(App.zoom / 1.25));
  $('btnZoomFit').addEventListener('click', () => { App.zoomUserSet = false; fitZoom(); });
  $('mapViewport').addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(App.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });
  window.addEventListener('resize', debounce(() => { if (!App.zoomUserSet) fitZoom(); }, 200));

  $('btnToggleGrid').addEventListener('click', () => {
    if (!isDM()) return;
    const scene = getScene();
    scene.gridEnabled = !scene.gridEnabled;
    touchEnt('scene');
    renderMap();
  });
  const onGridInput = (e) => { if (isDM()) setGridSize(e.target.value); };
  $('inputGridSize').addEventListener('input', onGridInput);
  $('inputGridSizeNumber').addEventListener('change', onGridInput);
  $('btnToggleFog').addEventListener('click', () => {
    if (!isDM()) return;
    const scene = getScene();
    scene.fogEnabled = !scene.fogEnabled;
    touchEnt('scene');
    renderMap();
  });
  $('btnToggleFogBrush').addEventListener('click', () => {
    App.fogEdit = !App.fogEdit;
    if (App.fogEdit && !getScene().fogEnabled) {
      getScene().fogEnabled = true;
      touchEnt('scene');
    }
    renderMap();
    if (App.fogEdit) showToast('🖌️ Trascina sulla mappa: partendo da una zona coperta la scopri, altrimenti la copri');
  });
  $('btnFogCoverAll').addEventListener('click', () => { if (isDM()) setAllFog(true); });
  $('btnFogRevealAll').addEventListener('click', () => { if (isDM()) setAllFog(false); });
  $('inputUploadMap').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && isDM()) uploadMapImage(file);
  });
  $('btnResetDefaultMap').addEventListener('click', () => { if (isDM()) resetDefaultMap(); });

  const fog = $('fogCanvas');
  fog.addEventListener('pointerdown', onFogPointerDown);
  fog.addEventListener('pointermove', onFogPointerMove);
  fog.addEventListener('pointerup', onFogPointerUp);
  fog.addEventListener('pointercancel', onFogPointerUp);

  $('btnAddTokenModal').addEventListener('click', () => { if (isDM()) openAddTokenModal(); });
  $('btnCloseAddTokenModal').addEventListener('click', closeAddTokenModal);
  $('btnCancelAddToken').addEventListener('click', closeAddTokenModal);
  $('btnConfirmAddToken').addEventListener('click', confirmAddToken);
  $('selectNewTokenType').addEventListener('change', (e) => {
    if (e.target.value === 'pc' && $('inputNewTokenName').value === 'Goblin') $('inputNewTokenName').value = 'Alleato';
  });
  $('modalAddToken').addEventListener('click', (e) => { if (e.target.id === 'modalAddToken') closeAddTokenModal(); });

  $('btnCloseTokenPopover').addEventListener('click', closeTokenPopover);
  const hpDelta = () => Math.max(1, parseInt($('inputPopoverHpDelta').value, 10) || 1);
  $('btnPopoverDamage').addEventListener('click', () => applyTokenHpDelta(App.selectedTokenId, -hpDelta()));
  $('btnPopoverHeal').addEventListener('click', () => applyTokenHpDelta(App.selectedTokenId, hpDelta()));
  $('btnPopoverOpenSheet').addEventListener('click', () => {
    const tok = getToken(App.selectedTokenId);
    if (!tok?.charId) return;
    App.sheetCharId = tok.charId;
    closeTokenPopover();
    switchTab('personaggio');
  });
  $('btnPopoverToggleHidden').addEventListener('click', () => {
    const tok = getToken(App.selectedTokenId);
    if (!tok || !isDM()) return;
    tok.hidden = !tok.hidden;
    touchEnt(`token:${tok.id}`);
    scheduleRender();
  });
  $('btnPopoverDeleteToken').addEventListener('click', () => {
    if (isDM() && App.selectedTokenId) deleteToken(App.selectedTokenId);
  });
  $('btnPopoverAddInit').addEventListener('click', () => {
    const tok = getToken(App.selectedTokenId);
    if (tok && isDM()) { addTokenToInitiative(tok); closeTokenPopover(); }
  });
  document.addEventListener('pointerdown', (e) => {
    const pop = $('tokenQuickPopover');
    if (pop.classList.contains('hidden')) return;
    if (pop.contains(e.target) || e.target.closest?.('.map-token')) return;
    closeTokenPopover();
  });
}
