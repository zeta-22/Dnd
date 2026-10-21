// Immagini di personaggi e pedine.
//
// • Ogni immagine viene ritagliata e ridotta a 192×192 sul dispositivo di chi la carica
//   (WebP, o JPEG dove il WebP non c'è): pesa circa 10 KB invece dei MB di una foto.
// • Sta in un pezzo a sé "img:<impronta>": la stessa immagine caricata due volte si salva una
//   volta sola, e muovere una pedina o cambiare i PF non rispedisce l'immagine.
// • char.img → il personaggio (anche sulla sua pedina) · token.img → una sola pedina ·
//   "srdimg:<n>" → tutti i mostri di quel tipo (es. tutti i goblin).
// • Le immagini che non usa più nessuno le toglie il Master dopo qualche minuto.

const IMG_SIZE = 192;
const IMG_CROP_VIEW = 260;
const IMG_GC_AGE_MS = 10 * 60 * 1000;
let imageGcAt = 0;

function imgData(hash) {
  return hash ? ent(`img:${hash}`)?.data || null : null;
}

function srdImageHash(srd) {
  return srd === undefined || srd === null ? null : ent(`srdimg:${srd}`)?.img || null;
}

// Immagine da mostrare per una pedina, in ordine: sua, del personaggio, del tipo di mostro, icona pronta
function tokenImageSrc(tok) {
  if (!tok) return null;
  const own = imgData(tok.img);
  if (own) return own;
  const ch = tok.charId ? getChar(tok.charId) : null;
  if (ch) return imgData(ch.img);
  const custom = imgData(srdImageHash(tok.srd));
  if (custom) return custom;
  return tok.srd !== undefined && tok.srd !== null ? commonMonsterIcon(tok.srd) : null;
}

function charImageSrc(ch) {
  return ch ? imgData(ch.img) : null;
}

function initEntryImageSrc(e) {
  if (e.charId) return charImageSrc(getChar(e.charId));
  return e.tokenId ? tokenImageSrc(getAllTokens().find(t => t.id === e.tokenId)) : null;
}

function avatarHtml(src, extraClass = '') {
  return src ? `<span class="avatar ${extraClass}" style="background-image:url('${src}')" aria-hidden="true"></span>` : '';
}

// ---------------------------------------------------------------------------
// Salvataggio
// ---------------------------------------------------------------------------

async function imageHash(text) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

async function storeImage(dataUrl) {
  const hash = await imageHash(dataUrl);
  if (!ent(`img:${hash}`)) putEnt(`img:${hash}`, { id: hash, data: dataUrl, at: Date.now() });
  return hash;
}

function encodeSquare(canvas) {
  const webp = canvas.toDataURL('image/webp', 0.82);
  if (webp.startsWith('data:image/webp')) return webp;
  // Senza WebP (Safari meno recente): JPEG su uno sfondo neutro al posto della trasparenza
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const g = flat.getContext('2d');
  g.fillStyle = '#d9cfb4';
  g.fillRect(0, 0, flat.width, flat.height);
  g.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', 0.85);
}

// Pulizia: immagini non più usate da nessun personaggio, pedina o tipo di mostro
function collectUnusedImages() {
  if (!isDM() || !App.activeId || Date.now() - imageGcAt < 60000) return;
  imageGcAt = Date.now();
  const used = new Set();
  entList('char:').forEach(c => c.img && used.add(c.img));
  getAllTokens().forEach(t => t.img && used.add(t.img));
  entList('srdimg:').forEach(s => s.img && used.add(s.img));
  entList('img:').forEach(img => {
    if (!used.has(img.id) && (img.at || 0) < Date.now() - IMG_GC_AGE_MS) removeEnt(`img:${img.id}`);
  });
}

// ---------------------------------------------------------------------------
// Ritaglio
// ---------------------------------------------------------------------------

// target: { kind: 'char', charId } | { kind: 'token', tokenId }
function openImagePicker(target) {
  App.imageTarget = target;
  const input = $('inputImageFile');
  input.value = '';
  input.click();
}

async function onImageFileChosen(file) {
  if (!file || !App.imageTarget) return;
  let img;
  try {
    img = await loadImage(await readFileAsDataUrl(file));
  } catch (e) {
    showToast('⚠️ Immagine non leggibile');
    return;
  }
  const base = IMG_CROP_VIEW / Math.min(img.naturalWidth, img.naturalHeight);
  App.crop = { img, zoom: 1, base, x: 0, y: 0 };
  renderCropOptions();
  $('inputCropZoom').value = '1';
  showEl('modalImageCrop', true);
  drawCrop();
}

function cropScale() { return App.crop.base * App.crop.zoom; }

// Tiene l'immagine sempre a coprire tutto il riquadro
function clampCrop() {
  const c = App.crop;
  const s = cropScale();
  const maxX = Math.max(0, (c.img.naturalWidth * s - IMG_CROP_VIEW) / 2);
  const maxY = Math.max(0, (c.img.naturalHeight * s - IMG_CROP_VIEW) / 2);
  c.x = Math.max(-maxX, Math.min(maxX, c.x));
  c.y = Math.max(-maxY, Math.min(maxY, c.y));
}

function drawCropInto(ctx, size) {
  const c = App.crop;
  const k = size / IMG_CROP_VIEW;
  const s = cropScale() * k;
  const w = c.img.naturalWidth * s;
  const h = c.img.naturalHeight * s;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(c.img, size / 2 - w / 2 + c.x * k, size / 2 - h / 2 + c.y * k, w, h);
}

function drawCrop() {
  if (!App.crop) return;
  clampCrop();
  const canvas = $('cropCanvas');
  drawCropInto(canvas.getContext('2d'), IMG_CROP_VIEW);
}

function renderCropOptions() {
  const t = App.imageTarget;
  const tok = t?.kind === 'token' ? getToken(t.tokenId) : null;
  const ch = t?.kind === 'char' ? getChar(t.charId) : tok?.charId ? getChar(tok.charId) : null;
  const m = tok && !ch && tok.srd !== undefined && tok.srd !== null ? srdMonster(tok.srd) : null;
  showEl('cropScopeRow', Boolean(m), 'flex');
  if (m) {
    setText('cropScopeAllLabel', `Tutti i “${m.n}” di questa avventura`);
    $('cropScopeAll').checked = true;
  }
  setText('cropTargetLabel', ch ? `Immagine di ${ch.name}` : tok ? `Immagine della pedina “${tok.name}”` : 'Immagine');
}

async function confirmCrop() {
  const t = App.imageTarget;
  if (!App.crop || !t) return;
  const out = document.createElement('canvas');
  out.width = IMG_SIZE;
  out.height = IMG_SIZE;
  drawCropInto(out.getContext('2d'), IMG_SIZE);
  const hash = await storeImage(encodeSquare(out));
  applyImage(t, hash, $('cropScopeAll').checked);
  closeCrop();
  scheduleRender();
}

// hash null = togli l'immagine
function applyImage(target, hash, forAllOfType) {
  if (target.kind === 'char' || (target.kind === 'token' && getToken(target.tokenId)?.charId)) {
    const ch = getChar(target.kind === 'char' ? target.charId : getToken(target.tokenId).charId);
    if (!ch || !canEditChar(ch)) return;
    ch.img = hash || null;
    touchEnt(`char:${ch.id}`);
    return;
  }
  const tok = getToken(target.tokenId);
  if (!tok || !isDM()) return;
  const typed = tok.srd !== undefined && tok.srd !== null;
  if (typed && forAllOfType) {
    if (hash) putEnt(`srdimg:${tok.srd}`, { img: hash });
    else if (ent(`srdimg:${tok.srd}`)) removeEnt(`srdimg:${tok.srd}`);
    // La pedina segue l'immagine del suo tipo
    if (tok.img) { tok.img = null; touchEnt(`token:${tok.id}`); }
  } else {
    tok.img = hash || null;
    touchEnt(`token:${tok.id}`);
  }
}

function removeTargetImage() {
  const t = App.imageTarget;
  if (!t) return;
  applyImage(t, null, $('cropScopeAll').checked);
  closeCrop();
  scheduleRender();
}

function closeCrop() {
  showEl('modalImageCrop', false);
  App.crop = null;
}

function initImageEvents() {
  $('inputImageFile').addEventListener('change', (e) => onImageFileChosen(e.target.files?.[0]));
  $('inputCropZoom').addEventListener('input', (e) => {
    if (!App.crop) return;
    App.crop.zoom = Number(e.target.value) || 1;
    drawCrop();
  });
  const canvas = $('cropCanvas');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!App.crop) return;
    drag = { x: e.clientX, y: e.clientY, ox: App.crop.x, oy: App.crop.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || !App.crop) return;
    const k = IMG_CROP_VIEW / canvas.getBoundingClientRect().width;
    App.crop.x = drag.ox + (e.clientX - drag.x) * k;
    App.crop.y = drag.oy + (e.clientY - drag.y) * k;
    drawCrop();
  });
  ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { drag = null; }));
  canvas.addEventListener('wheel', (e) => {
    if (!App.crop) return;
    e.preventDefault();
    App.crop.zoom = Math.max(1, Math.min(4, App.crop.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    $('inputCropZoom').value = String(App.crop.zoom);
    drawCrop();
  }, { passive: false });
  $('btnConfirmCrop').addEventListener('click', confirmCrop);
  $('btnCancelCrop').addEventListener('click', closeCrop);
  $('btnChangeCropImage').addEventListener('click', () => { $('inputImageFile').value = ''; $('inputImageFile').click(); });

  $('sheetPortrait').addEventListener('click', () => {
    const ch = currentSheetChar();
    if (ch && canEditChar(ch)) openImagePicker({ kind: 'char', charId: ch.id });
  });
  $('btnRemovePortrait').addEventListener('click', () => {
    const ch = currentSheetChar();
    if (!ch || !canEditChar(ch)) return;
    ch.img = null;
    touchEnt(`char:${ch.id}`);
    scheduleRender();
  });
  $('btnPopoverImage').addEventListener('click', () => {
    const tok = getToken(App.selectedTokenId);
    if (tok) openImagePicker({ kind: 'token', tokenId: tok.id });
  });
  $('btnPopoverRemoveImage').addEventListener('click', () => {
    const tok = getToken(App.selectedTokenId);
    if (!tok) return;
    App.imageTarget = { kind: 'token', tokenId: tok.id };
    // Senza immagine propria si torna a quella del tipo; se c'è solo quella, si toglie per tutti
    const typed = tok.srd !== undefined && tok.srd !== null;
    applyImage(App.imageTarget, null, !tok.img && typed);
    scheduleRender();
  });
}
