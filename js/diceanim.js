// Animazione dei dadi: rotolano attraverso tutto il tavolo, si fermano sul risultato e spariscono.
// Parte per ogni tiro nuovo, sia tuo sia degli altri giocatori.

const DICE_SHAPES = {
  4: { points: '50,6 95,88 5,88', textY: 66, size: 30 },
  6: { rect: true, textY: 62, size: 38 },
  8: { points: '50,4 95,50 50,96 5,50', textY: 62, size: 32 },
  10: { points: '50,4 93,42 50,96 7,42', textY: 58, size: 30 },
  12: { points: '50,5 95,38 78,93 22,93 5,38', textY: 64, size: 32 },
  20: { points: '50,3 93,27 93,73 50,97 7,73 7,27', inner: '50,22 78,66 22,66', textY: 60, size: 28 },
  100: { points: '50,4 93,42 50,96 7,42', textY: 58, size: 24 }
};

const diceQueue = [];
let diceBusy = false;

function diceAnimationEnabled() {
  return Prefs.get('iltavolo_dice_anim', '1') === '1';
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

// Chiamata da renderRolls per ogni tiro nuovo
function queueDiceAnimation(roll) {
  if (!diceAnimationEnabled() || !roll || !Array.isArray(roll.dice) || !roll.dice.length) return;
  diceQueue.push(roll);
  // Se arrivano molti tiri insieme (es. iniziativa di tutto il gruppo) mostriamo solo gli ultimi
  while (diceQueue.length > 3) diceQueue.shift();
  if (!diceBusy) playNextDice();
}

function playNextDice() {
  const roll = diceQueue.shift();
  if (!roll) { diceBusy = false; return; }
  diceBusy = true;
  animateRollAcrossTable(roll).then(() => playNextDice());
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
      const badge = document.createElement('div');
      badge.className = 'dice-total-badge';
      const outcome = roll.vsAc ? (roll.hit ? ' · colpisce!' : ' · manca') : roll.crit && roll.nat === 20 ? ' · 20 naturale!' : roll.fumble && roll.nat === 1 ? ' · 1 naturale' : '';
      badge.innerHTML = `<span class="dice-total-label">${roll.secret ? '🔒 ' : ''}${escapeHtml(roll.by)} · ${escapeHtml(roll.label)}${outcome}</span><span class="dice-total-value">${roll.total}</span>`;
      badge.style.top = `${H * 0.42 + size * 0.75}px`;
      overlay.appendChild(badge);
      badge.animate([{ transform: 'translate(-50%, 10px) scale(0.8)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' });
      setTimeout(() => {
        const fades = [badge, ...dice.map(d => d.el)].map(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }).finished.catch(() => {}));
        Promise.all(fades).then(() => {
          badge.remove();
          dice.forEach(d => d.el.remove());
          resolve();
        });
      }, calm ? 1200 : 1500);
    });
  });
}
