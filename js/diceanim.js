// Animazione dei dadi: rotolano attraverso tutto il tavolo, si fermano sul risultato e spariscono.
// Parte per ogni tiro nuovo, sia tuo sia degli altri giocatori.
//
// • Dadi 3D (predefiniti): dice-box-threejs con fisica vera. Il risultato lo decide chi tira, gli
//   altri schermi fanno rotolare i dadi in modo diverso ma li fanno fermare sugli stessi numeri.
// • Dadi semplici: animazione in SVG, usata anche quando il 3D non è disponibile.

const DICE_SHAPES = {
  4: { points: '50,6 95,88 5,88', textY: 66, size: 30 },
  6: { rect: true, textY: 62, size: 38 },
  8: { points: '50,4 95,50 50,96 5,50', textY: 62, size: 32 },
  10: { points: '50,4 93,42 50,96 7,42', textY: 58, size: 30 },
  12: { points: '50,5 95,38 78,93 22,93 5,38', textY: 64, size: 32 },
  20: { points: '50,3 93,27 93,73 50,97 7,73 7,27', inner: '50,22 78,66 22,66', textY: 60, size: 28 },
  100: { points: '50,4 93,42 50,96 7,42', textY: 58, size: 24 }
};

const DICE3D_PATH = 'vendor/dice-box-threejs/';
const DICE3D_SIDES = [4, 6, 8, 10, 12, 20, 100];
const DICE3D_MAX = 15;
// Colori predefiniti dei dadi dei giocatori (scelti in base al personaggio)
const DICE_PALETTE = ['#2e5b44', '#1f4e8c', '#8c2f1f', '#6b3fa0', '#a8740f', '#0f766e', '#9d174d', '#3f4a5a'];
const DM_DICE_COLOR = '#5b1a1a';
const SECRET_DICE_COLOR = '#4b3a86';

const diceQueue = [];
let diceBusy = false;
let dice3d = null;          // { box }
let dice3dLoading = null;
let dice3dFailed = false;
let webglOk = null;

function diceAnimationEnabled() {
  return Prefs.get('iltavolo_dice_anim', '1') === '1';
}

function diceStyle() { return Prefs.get('iltavolo_dice_style', '3d'); }
function diceSoundEnabled() { return Prefs.get('iltavolo_dice_sound', '0') === '1'; }

function defaultDiceColor(charId) {
  let h = 0;
  for (const ch of String(charId || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DICE_PALETTE[h % DICE_PALETTE.length];
}

function validColor(c) { return /^#[0-9a-f]{6}$/i.test(c || ''); }

// Colore dei dadi di chi tira su questo dispositivo
function myDiceColor() {
  if (isDM()) {
    const c = Prefs.get('iltavolo_dm_dice_color');
    return validColor(c) ? c : DM_DICE_COLOR;
  }
  const ch = myChar();
  return validColor(ch?.diceColor) ? ch.diceColor : defaultDiceColor(ch?.id || DEVICE_ID);
}

function setMyDiceColor(color) {
  if (!validColor(color)) return;
  if (isDM()) { Prefs.set('iltavolo_dm_dice_color', color); return; }
  const ch = myChar();
  if (ch) { ch.diceColor = color; touchEnt(`char:${ch.id}`); }
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function dieSvg(sides, value, variant) {
  const shape = DICE_SHAPES[sides] || DICE_SHAPES[sides > 20 ? 100 : 6];
  const gradient = `g${sides}${variant}`;
  const body = shape.rect
    ? `<rect x="8" y="8" width="84" height="84" rx="16" fill="url(#${gradient})" stroke="rgba(0,0,0,0.45)" stroke-width="3"/>`
    : `<polygon points="${shape.points}" fill="url(#${gradient})" stroke="rgba(0,0,0,0.45)" stroke-width="3" stroke-linejoin="round"/>`;
  const inner = shape.inner ? `<polygon points="${shape.inner}" fill="rgba(255,255,255,0.10)" stroke="rgba(0,0,0,0.25)" stroke-width="2" stroke-linejoin="round"/>` : '';
  const colors = {
    d20: ['#F6D77A', '#B07F12'],
    normal: ['#4C9A70', '#1F4230'],
    secret: ['#9C86D9', '#4B3A86'],
    dropped: ['#8C978F', '#4A544D'],
    crit: ['#FFE38A', '#D99A00'],
    fumble: ['#F08A7E', '#8E2318']
  }[variant] || ['#4C9A70', '#1F4230'];
  return `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/>
      </linearGradient></defs>
      ${body}${inner}
      <text x="50" y="${shape.textY}" text-anchor="middle" font-family="Alegreya, serif" font-weight="700"
        font-size="${shape.size}" fill="#fff" stroke="rgba(0,0,0,0.55)" stroke-width="1.2" paint-order="stroke" class="die-value">${value}</text>
    </svg>`;
}

function dieVariant(roll, sides, idx) {
  if (roll.secret) return 'secret';
  if (sides === 20 && roll.dice.length === 2 && roll.kept !== undefined) {
    const keptIdx = roll.dice.indexOf(roll.kept);
    if (idx !== keptIdx) return 'dropped';
  }
  if (sides === 20 && roll.nat === 20 && roll.dice[idx] === 20) return 'crit';
  if (sides === 20 && roll.nat === 1 && roll.dice[idx] === 1) return 'fumble';
  return sides === 20 ? 'd20' : 'normal';
}

// Tiri i cui dadi stanno ancora rotolando: il risultato (storico, avvisi) si mostra solo quando si fermano,
// uguale per chi tira e per chi guarda
const rollingIds = new Set();
const rollWaiters = new Map();

function isRollRolling(id) {
  return rollingIds.has(id);
}

// Esegue fn quando i dadi del tiro si fermano, oppure subito se non c'è animazione
function whenRollLands(roll, fn) {
  if (!roll || !rollingIds.has(roll.id)) { fn(); return; }
  if (!rollWaiters.has(roll.id)) rollWaiters.set(roll.id, []);
  rollWaiters.get(roll.id).push(fn);
}

function rollLanded(roll) {
  if (!roll || !rollingIds.delete(roll.id)) return;
  const waiting = rollWaiters.get(roll.id) || [];
  rollWaiters.delete(roll.id);
  waiting.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  scheduleRender();
}

// Chiamata da renderRolls per ogni tiro nuovo
function queueDiceAnimation(roll) {
  if (!diceAnimationEnabled() || document.hidden || !roll || !Array.isArray(roll.dice) || !roll.dice.length) return;
  diceQueue.push(roll);
  rollingIds.add(roll.id);
  // Se arrivano molti tiri insieme (es. iniziativa di tutto il gruppo) mostriamo solo gli ultimi
  while (diceQueue.length > 3) rollLanded(diceQueue.shift());
  if (!diceBusy) playNextDice();
}

function playNextDice() {
  const roll = diceQueue.shift();
  if (!roll) { diceBusy = false; return; }
  diceBusy = true;
  // Rete di sicurezza: se l'animazione si blocca il risultato compare lo stesso
  const guard = setTimeout(() => rollLanded(roll), 12000);
  const run = canUse3d(roll)
    ? animateRoll3D(roll).catch(() => {
      // Il 3D non parte (libreria non caricata, scheda grafica non adatta…): torniamo ai dadi semplici
      dice3dFailed = true;
      return animateRollAcrossTable(roll);
    })
    : animateRollAcrossTable(roll);
  run.then(() => {
    clearTimeout(guard);
    rollLanded(roll);
    playNextDice();
  });
}

// ---------------------------------------------------------------------------
// Dadi 3D
// ---------------------------------------------------------------------------

function webglAvailable() {
  if (webglOk === null) {
    try {
      const c = document.createElement('canvas');
      webglOk = Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      webglOk = false;
    }
  }
  return webglOk;
}

function diceSidesOf(roll) {
  return roll.diceSides && roll.diceSides.length === roll.dice.length ? roll.diceSides.map(s => Math.abs(s)) : roll.dice.map(() => 20);
}

function canUse3d(roll) {
  return diceStyle() === '3d' && !dice3dFailed && !reducedMotion() && webglAvailable() && diceSidesOf(roll).every(s => DICE3D_SIDES.includes(s));
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) { existing.dataset.loaded ? resolve() : existing.addEventListener('load', resolve); return; }
    const el = document.createElement('script');
    el.src = src;
    el.dataset.src = src;
    el.onload = () => { el.dataset.loaded = '1'; resolve(); };
    el.onerror = () => { el.remove(); reject(new Error('script')); };
    document.head.appendChild(el);
  });
}

// La libreria si scarica solo al primo tiro
async function getDiceBox() {
  if (dice3d) return dice3d.box;
  if (!dice3dLoading) {
    dice3dLoading = (async () => {
      await loadScriptOnce(DICE3D_PATH + 'dice-box-threejs.umd.js');
      const DiceBox = window['dice-box-threejs'];
      if (typeof DiceBox !== 'function') throw new Error('dice-box');
      const holder = $('dice3d');
      holder.innerHTML = '';
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      // I suoni si caricano a parte (vedi ensureDiceSounds): così non possono bloccare i dadi
      const box = new DiceBox('#dice3d', {
        assetPath: DICE3D_PATH, sounds: false, volume: 60, shadows: true, theme_surface: 'green-felt',
        theme_material: 'plastic', baseScale: small ? 90 : 115, strength: small ? 1 : 1.3
      });
      await Promise.race([box.initialize(), waitMs(10000).then(() => { throw new Error('dice-box timeout'); })]);
      dice3d = { box };
      return box;
    })().finally(() => { dice3dLoading = null; });
  }
  return dice3dLoading;
}

// Alcuni browser (es. Safari su iPhone) non caricano i suoni finché non si tocca lo schermo:
// i dadi intanto rotolano muti e il suono si attiva appena è pronto
async function ensureDiceSounds(box) {
  if (!diceSoundEnabled()) { box.sounds = false; return; }
  if (box.tavoloSoundsReady) { box.sounds = true; return; }
  if (box.tavoloSoundsLoading) return;
  box.tavoloSoundsLoading = true;
  try {
    await Promise.race([box.loadSounds(), waitMs(10000).then(() => { throw new Error('sounds timeout'); })]);
    box.tavoloSoundsReady = true;
    box.sounds = diceSoundEnabled();
  } catch (e) {
    box.sounds = false;
  } finally {
    box.tavoloSoundsLoading = false;
  }
}

function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

function diceColorset(roll) {
  const color = roll.secret ? SECRET_DICE_COLOR : validColor(roll.color) ? roll.color.toLowerCase() : '#2e5b44';
  const ink = inkFor(color);
  return { name: `tavolo-${color.slice(1)}`, foreground: ink, background: color, outline: ink === '#ffffff' ? '#000000' : color, texture: 'none', material: 'plastic' };
}

// "2d6+1d20@3,4,17": i dadi dello stesso tipo vanno raggruppati, nello stesso ordine dei valori.
// Il d100 diventa un dado delle decine più un d10 delle unità.
function dice3dNotation(roll) {
  const groups = new Map();
  const push = (sides, value) => { if (!groups.has(sides)) groups.set(sides, []); groups.get(sides).push(value); };
  const sides = diceSidesOf(roll);
  let count = 0;
  roll.dice.forEach((v, i) => {
    if (count >= DICE3D_MAX) return;
    const value = Math.abs(v);
    if (sides[i] === 100) {
      push(100, Math.floor((value % 100) / 10) * 10 || 100);
      push(10, value % 10 || 10);
      count += 2;
    } else {
      push(sides[i], value);
      count += 1;
    }
  });
  const list = [...groups];
  return `${list.map(([s, vals]) => `${vals.length}d${s}`).join('+')}@${list.flatMap(([, vals]) => vals).join(',')}`;
}

function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateRoll3D(roll) {
  const box = await getDiceBox();
  ensureDiceSounds(box);
  await box.updateConfig({ theme_customColorset: diceColorset(roll) });
  const holder = $('dice3d');
  holder.classList.remove('dice3d-fade');
  holder.classList.add('dice3d-on');
  // Se la scheda va in secondo piano l'animazione si ferma: non aspettiamo all'infinito
  await Promise.race([box.roll(dice3dNotation(roll)), waitMs(9000)]);
  rollLanded(roll);
  const badge = showRollBadge(roll, window.innerHeight * 0.78);
  await waitMs(1800);
  holder.classList.add('dice3d-fade');
  await Promise.all([fadeOutBadge(badge), waitMs(450)]);
  box.clearDice();
  holder.classList.remove('dice3d-on', 'dice3d-fade');
}

// ---------------------------------------------------------------------------
// Risultato e dadi semplici
// ---------------------------------------------------------------------------

function showRollBadge(roll, top) {
  const overlay = $('diceOverlay');
  const badge = document.createElement('div');
  const nat20 = roll.crit && roll.nat === 20;
  const nat1 = roll.fumble && roll.nat === 1;
  badge.className = `dice-total-badge${nat20 ? ' is-crit' : nat1 ? ' is-fumble' : ''}`;
  const outcome = roll.vsAc ? (roll.hit ? ' · colpisce!' : ' · manca') : nat20 ? ' · 20 naturale!' : nat1 ? ' · 1 naturale' : '';
  badge.innerHTML = `<span class="dice-total-label">${roll.secret ? '🔒 ' : ''}${escapeHtml(roll.by)} · ${escapeHtml(roll.label)}${outcome}</span><span class="dice-total-value">${escapeHtml(String(roll.total))}</span>`;
  badge.style.top = `${top}px`;
  overlay.appendChild(badge);
  badge.animate([{ transform: 'translate(-50%, 10px) scale(0.8)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
  return badge;
}

function fadeOutBadge(badge) {
  return badge.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }).finished.catch(() => {}).then(() => badge.remove());
}

// Un tiro di prova solo su questo dispositivo, per vedere i propri dadi
function previewDice() {
  const ch = myChar();
  const value = rollDie(20);
  queueDiceAnimation({ id: uid('prova'), dice: [value], diceSides: [20], total: value, by: isDM() ? 'DM' : ch?.name || 'Tu', label: 'Prova', color: myDiceColor(), nat: value, crit: value === 20, fumble: value === 1 });
}

function animateRollAcrossTable(roll) {
  return new Promise((resolve) => {
    const overlay = $('diceOverlay');
    if (!overlay) { resolve(); return; }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = Math.max(54, Math.min(84, Math.round(Math.min(W, H) * 0.11)));
    const sidesList = roll.diceSides && roll.diceSides.length === roll.dice.length ? roll.diceSides : roll.dice.map(() => 20);
    const count = Math.min(8, roll.dice.length);
    const fromLeft = Math.random() < 0.5;
    const calm = reducedMotion();
    const flight = calm ? 250 : 1150;
    const dice = [];

    for (let i = 0; i < count; i++) {
      const sides = Math.abs(sidesList[i]) || 20;
      const value = Math.abs(roll.dice[i]);
      const el = document.createElement('div');
      el.className = 'die-flying';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.innerHTML = dieSvg(sides, value, dieVariant(roll, sides, i));
      overlay.appendChild(el);

      // Punto d'arrivo: una fila al centro del tavolo
      const spread = Math.min(W * 0.8, count * (size * 1.15));
      const endX = W / 2 - spread / 2 + (spread / count) * (i + 0.5) - size / 2;
      const endY = H * 0.42 - size / 2 + (Math.random() - 0.5) * size * 0.5;
      const startX = fromLeft ? -size * 1.5 : W + size * 0.5;
      const startY = H * (0.65 + Math.random() * 0.25);
      const spins = (fromLeft ? 1 : -1) * (540 + Math.random() * 540);
      const keyframes = calm
        ? [{ transform: `translate(${endX}px, ${endY}px) scale(0.6)`, opacity: 0 }, { transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 1 }]
        : [
          { transform: `translate(${startX}px, ${startY}px) rotate(0deg) scale(0.9)`, opacity: 0.4, offset: 0 },
          { transform: `translate(${startX + (endX - startX) * 0.35}px, ${H * 0.12}px) rotate(${spins * 0.4}deg) scale(1.05)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${startX + (endX - startX) * 0.7}px, ${endY + size * 0.35}px) rotate(${spins * 0.75}deg) scale(1)`, offset: 0.65 },
          { transform: `translate(${startX + (endX - startX) * 0.88}px, ${endY - size * 0.55}px) rotate(${spins * 0.92}deg) scale(1.02)`, offset: 0.82 },
          { transform: `translate(${endX}px, ${endY}px) rotate(${spins}deg) scale(1)`, opacity: 1, offset: 1 }
        ];
      const anim = el.animate(keyframes, { duration: flight + i * 60, easing: 'cubic-bezier(.25,.7,.35,1)', fill: 'forwards' });

      // Mentre rotola il numero cambia, poi si ferma sul risultato vero
      const text = el.querySelector('.die-value');
      const flicker = calm ? null : setInterval(() => { text.textContent = Math.floor(Math.random() * (sides === 100 ? 100 : sides)) + 1; }, 70);
      anim.finished.then(() => {
        if (flicker) clearInterval(flicker);
        text.textContent = value;
        el.classList.add('die-landed');
      }).catch(() => {});
      dice.push({ el, anim });
    }

    Promise.all(dice.map(d => d.anim.finished.catch(() => {}))).then(() => {
      rollLanded(roll);
      const badge = showRollBadge(roll, H * 0.42 + size * 0.75);
      setTimeout(() => {
        const fades = [fadeOutBadge(badge), ...dice.map(d => d.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }).finished.catch(() => {}))];
        Promise.all(fades).then(() => {
          dice.forEach(d => d.el.remove());
          resolve();
        });
      }, calm ? 1200 : 1500);
    });
  });
}
