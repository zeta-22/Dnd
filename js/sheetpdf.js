// Scheda del personaggio in PDF, impaginata come le schede esportate da D&D Beyond: caratteristiche a
// sinistra, tiri salvezza e abilità con i pallini, CA, PF e dadi vita al centro, privilegi a destra e
// armi in basso; poi storia, incantesimi e il testo che non è entrato nelle prime pagine.
// È disegnata da zero (niente loghi né grafiche di altri) con pdf-lib, che si scarica solo quando serve.

const PDF_W = 595.28;
const PDF_H = 841.89;
const PDF_M = 24;
const PDF_TEXT = 7.2;
const PDF_LINE = 9.4;
const PDF_WIN_ANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
let pdfLibPromise = null;

function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!pdfLibPromise) {
    pdfLibPromise = loadScriptOnce(TAVOLO_CONFIG.pdfLibUrl)
      .then(() => { if (!window.PDFLib) throw new Error('pdf-lib'); return window.PDFLib; })
      .catch(err => { pdfLibPromise = null; throw err; });
  }
  return pdfLibPromise;
}

// I caratteri standard dei PDF conoscono solo l'alfabeto occidentale: il resto si sostituisce o si toglie (emoji)
function pdfSafe(text) {
  return Array.from(String(text ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ')
    .replace(/[★☆✦]/g, '*').replace(/−/g, '-').replace(/[→⇒]/g, '->').replace(/[✓✔]/g, 'v').replace(/[✗✘]/g, 'x'))
    .filter(c => c === '\n' || (c >= ' ' && c <= '~') || (c >= ' ' && c <= 'ÿ') || PDF_WIN_ANSI.includes(c))
    .join('').replace(/ +\n/g, '\n');
}

// ---------------------------------------------------------------------------
// Disegno (coordinate dall'alto a sinistra, come sullo schermo)
// ---------------------------------------------------------------------------

function pdfNewPage(k) {
  k.page = k.doc.addPage([PDF_W, PDF_H]);
  k.pageNo += 1;
  pdfText(k, `${k.footer} · pagina ${k.pageNo}`, PDF_M, PDF_H - 18, { size: 6, color: k.c.muted, width: PDF_W - 2 * PDF_M, align: 'center' });
}

function roundedRectPath(w, h, r) {
  return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
}

function pdfBox(k, x, y, w, h, { fill = k.c.white, border = k.c.ink, width = 1.1, radius = 5 } = {}) {
  const opts = { x, y: PDF_H - y };
  if (fill) opts.color = fill;
  if (border) { opts.borderColor = border; opts.borderWidth = width; }
  k.page.drawSvgPath(roundedRectPath(w, h, Math.min(radius, w / 2, h / 2)), opts);
}

function pdfFitText(text, font, size, maxWidth) {
  let s = text;
  if (!maxWidth || font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// Riduce la dimensione finché il testo entra (per nome e valori lunghi)
function pdfFitSize(k, text, font, size, maxWidth, minSize) {
  const s = pdfSafe(text).replace(/\n/g, ' ');
  let sz = size;
  while (sz > minSize && font.widthOfTextAtSize(s, sz) > maxWidth) sz -= 0.5;
  return { text: pdfFitText(s, font, sz, maxWidth), size: sz };
}

// y è il bordo superiore del testo
function pdfText(k, text, x, y, { size = PDF_TEXT, font = k.fonts.regular, color = k.c.ink, align = 'left', width = 0, maxWidth = 0 } = {}) {
  const s = pdfFitText(pdfSafe(text).replace(/\n/g, ' '), font, size, maxWidth || (align === 'left' ? 0 : width));
  if (!s) return;
  const tw = font.widthOfTextAtSize(s, size);
  const dx = align === 'center' ? (width - tw) / 2 : align === 'right' ? width - tw : 0;
  k.page.drawText(s, { x: x + dx, y: PDF_H - y - size * 0.78, size, font, color });
}

// Etichetta piccola in maiuscolo, centrata, come sotto i riquadri delle schede di D&D Beyond
function pdfLabel(k, label, x, y, w) {
  pdfText(k, label.toUpperCase(), x, y, { size: 5.6, font: k.fonts.bold, color: k.c.ink, align: 'center', width: w });
}

function pdfLine(k, x1, y1, x2, y2, thickness = 0.6, color = k.c.muted) {
  k.page.drawLine({ start: { x: x1, y: PDF_H - y1 }, end: { x: x2, y: PDF_H - y2 }, thickness, color });
}

// Pallino di competenza: vuoto, pieno, oppure pieno con un anello (maestria)
function pdfDot(k, cx, cy, level) {
  const opts = { x: cx, y: PDF_H - cy, size: 2.8, borderColor: k.c.ink, borderWidth: 0.8, color: level ? k.c.ink : k.c.white };
  k.page.drawCircle(opts);
  if (level === 2) k.page.drawCircle({ x: cx, y: PDF_H - cy, size: 4.4, borderColor: k.c.ink, borderWidth: 0.7 });
}

// Righe di testo a capo per una certa larghezza; br = fine del paragrafo
function pdfWrap(k, text, width, size = PDF_TEXT, font = k.fonts.regular) {
  const out = [];
  pdfSafe(text).split('\n').forEach(par => {
    const words = par.split(' ').filter((w, i, arr) => w || i === arr.length - 1);
    let line = '';
    const push = (t, br) => out.push({ t, br });
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; return; }
      if (line) push(line, false);
      // Parole più lunghe della riga: si spezzano
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let n = w.length - 1;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
        push(w.slice(0, n), false);
        w = w.slice(n);
      }
      line = w;
    });
    push(line, true);
  });
  while (out.length && !out[out.length - 1].t) out.pop();
  return out;
}

function pdfIsHeading(t) {
  return /^===.*===$/.test(t.trim()) || /^[^.:]{2,48}:$/.test(t.trim());
}

// Scrive le righe nel riquadro finché c'è posto e restituisce il testo che avanza
function pdfFlow(k, text, x, y, w, h, size = PDF_TEXT) {
  const lines = pdfWrap(k, text, w, size);
  const lineH = size * 1.3;
  const fit = Math.max(0, Math.floor(h / lineH));
  lines.slice(0, fit).forEach((ln, i) => pdfText(k, ln.t, x, y + i * lineH, { size, font: pdfIsHeading(ln.t) ? k.fonts.bold : k.fonts.regular }));
  return lines.slice(fit).map(ln => ln.t + (ln.br ? '\n' : ' ')).join('').trim();
}

// Pagine "continua": il testo avanzato su due colonne, sezione dopo sezione.
// Con startY si comincia sulla pagina corrente, sotto quello che c'è già.
function pdfContinuation(k, name, sections, startY = null) {
  sections = sections.filter(s => String(s.text || '').trim());
  if (!sections.length) return;
  const colW = (PDF_W - 2 * PDF_M - 14) / 2;
  const top = 52;
  const bottom = PDF_H - 30;
  let col = startY === null ? 2 : 0;
  let y = startY === null ? top : startY;
  const nextColumn = () => {
    col += 1;
    if (col > 1) {
      pdfNewPage(k);
      pdfText(k, name, PDF_M, 24, { size: 13, font: k.fonts.bold, maxWidth: PDF_W - 2 * PDF_M });
      pdfLine(k, PDF_M, 42, PDF_W - PDF_M, 42, 1, k.c.ink);
      col = 0;
    }
    y = top;
  };
  const colX = () => PDF_M + col * (colW + 14);
  sections.forEach(sec => {
    if (col > 1 || y + PDF_LINE * 3 > bottom) nextColumn();
    pdfText(k, sec.title.toUpperCase(), colX(), y, { size: 7.5, font: k.fonts.bold, color: k.c.accent });
    y += PDF_LINE * 1.3;
    pdfWrap(k, sec.text, colW).forEach(ln => {
      if (y + PDF_LINE > bottom) {
        nextColumn();
        pdfText(k, /\(continua\)$/i.test(sec.title) ? sec.title.toUpperCase() : `${sec.title.toUpperCase()} (CONTINUA)`, colX(), y, { size: 7.5, font: k.fonts.bold, color: k.c.accent });
        y += PDF_LINE * 1.3;
      }
      pdfText(k, ln.t, colX(), y, { font: pdfIsHeading(ln.t) ? k.fonts.bold : k.fonts.regular });
      y += PDF_LINE;
    });
    y += PDF_LINE * 0.8;
  });
}

// ---------------------------------------------------------------------------
// Scheda D&D 5e
// ---------------------------------------------------------------------------

function pdfHeader(k, ch, cells) {
  pdfBox(k, PDF_M, 24, 228, 56);
  const name = pdfFitSize(k, ch.name, k.fonts.bold, 18, 208, 9);
  pdfText(k, name.text, PDF_M + 10, 34, { size: name.size, font: k.fonts.bold });
  pdfLabel(k, 'Nome del personaggio', PDF_M, 70, 228);
  const x0 = 260;
  const w = PDF_W - PDF_M - x0;
  pdfBox(k, x0, 24, w, 56, { fill: k.c.panel });
  const cw = (w - 12) / 3;
  cells.forEach(([label, value], i) => {
    const x = x0 + 8 + (i % 3) * cw;
    const y = 30 + Math.floor(i / 3) * 25;
    pdfText(k, value || '', x, y, { size: 8.5, font: k.fonts.bold, maxWidth: cw - 8 });
    pdfLine(k, x, y + 11, x + cw - 8, y + 11);
    pdfText(k, label.toUpperCase(), x, y + 13, { size: 5.4, font: k.fonts.bold, color: k.c.muted });
  });
}

function pdfAttackRows(ch, rules) {
  const rows = [];
  ch.weapons.forEach(entry => {
    const st = weaponStats(ch, entry, rules);
    if (!st) return;
    const w = st.w;
    const notes = [w.c === 'simple' ? 'Semplice' : w.c === 'martial' ? 'Da guerra' : '',
      ...w.p.filter(p => p !== 'thrown').map(p => WEAPON_PROPERTY_LABELS[p]), w.r ? `${w.ranged ? 'gittata' : 'lancio'} ${w.r} m` : '',
      st.proficient ? '' : 'non competente'].filter(Boolean);
    rows.push([st.name, w.k === 'net' ? '—' : formatSignedMod(st.hit), [st.damage, w.t].filter(Boolean).join(' ') + (st.damage2 ? ` (2 mani ${st.damage2})` : ''), notes.join(', ')]);
  });
  parseAttacks(ch.attacksText, ch).forEach(a => rows.push([a.name, a.bonus === null ? '' : formatSignedMod(a.bonus), a.damage, '']));
  // Trucchetti d'attacco, come nella tabella di D&D Beyond
  if (SRD.spells) {
    const st = spellStats(ch);
    ch.spells.map(s => srdSpell(Number(s.i))).filter(sp => sp && sp.lv === 0 && (sp.atk || sp.dmg || sp.save)).forEach(sp => {
      rows.push([sp.n, sp.atk ? formatSignedMod(st.attack) : sp.save ? `TS ${sp.save} CD ${st.dc}` : '',
        sp.dmg ? `${scaledSpellFormula(sp.dmg.f, sp, 0, ch.level)} ${sp.dmg.t}` : '', `Trucchetto, ${sp.rg}`]);
    });
  }
  return rows;
}

// L'allineamento importato sta nelle note: nel PDF va nell'intestazione e non si ripete
const PDF_ALIGNMENT_LINE = /^Allineamento:\s*([^\n]+)\n?/im;

function pdfAlignment(ch) {
  return (String(ch.notes || '').match(PDF_ALIGNMENT_LINE) || [])[1]?.trim() || '';
}

function pdfMainPage(k, ch, extra) {
  pdfNewPage(k);
  const rules = extra.rules;
  const alignment = pdfAlignment(ch);
  const notes = String(ch.notes || '').replace(PDF_ALIGNMENT_LINE, '').trim();
  pdfHeader(k, ch, [
    ['Classe e livello', `${ch.className} ${ch.level}`], ['Background', ch.background], ['Avventura', extra.campaign],
    ['Razza', ch.race], ['Allineamento', alignment], ['Regole', `D&D 5e ${rules}`]
  ]);
  const { bold } = k.fonts;
  const top = 90;

  // Caratteristiche
  ABILITY_KEYS.forEach((ab, i) => {
    const x = PDF_M;
    const y = top + i * 80;
    const w = 70;
    const h = 71;
    pdfBox(k, x, y, w, h);
    pdfText(k, ABILITY_LABELS[ab].toUpperCase(), x, y + 6, { size: 6.2, font: bold, align: 'center', width: w });
    pdfText(k, String(ch.abilities[ab]), x, y + 19, { size: 22, font: bold, align: 'center', width: w });
    k.page.drawEllipse({ x: x + w / 2, y: PDF_H - (y + h - 2), xScale: 17, yScale: 8, color: k.c.white, borderColor: k.c.ink, borderWidth: 1 });
    pdfText(k, formatSignedMod(getAbilityMod(ch.abilities[ab])), x, y + h - 6, { size: 8.5, font: bold, align: 'center', width: w });
  });

  // Bonus di competenza, tiri salvezza, abilità, valori passivi
  const bx = 102;
  const bw = 150;
  pdfBox(k, bx, top, bw, 22);
  k.page.drawEllipse({ x: bx + 16, y: PDF_H - (top + 11), xScale: 11, yScale: 8, color: k.c.white, borderColor: k.c.ink, borderWidth: 1 });
  pdfText(k, formatSignedMod(getProficiencyBonus(ch.level)), bx + 5, top + 7, { size: 8, font: bold, align: 'center', width: 22 });
  pdfText(k, 'BONUS DI COMPETENZA', bx + 32, top + 8, { size: 6, font: bold });

  const sy = top + 28;
  const sh = 6 * 11.5 + 18;
  pdfBox(k, bx, sy, bw, sh);
  ABILITY_KEYS.forEach((ab, i) => {
    const y = sy + 7 + i * 11.5;
    pdfDot(k, bx + 10, y + 3.5, ch.savingThrowsProf[ab] ? 1 : 0);
    pdfText(k, formatSignedMod(saveBonus(ch, ab)), bx + 16, y, { size: 7.4, font: bold, align: 'right', width: 18 });
    pdfLine(k, bx + 16, y + 8, bx + 34, y + 8);
    pdfText(k, ABILITY_LABELS[ab], bx + 39, y, { size: 7.4 });
  });
  pdfLabel(k, 'Tiri salvezza', bx, sy + sh - 9, bw);

  const ky = sy + sh + 6;
  const kh = DND5E_SKILLS.length * 11.3 + 18;
  pdfBox(k, bx, ky, bw, kh);
  DND5E_SKILLS.forEach((s, i) => {
    const y = ky + 7 + i * 11.3;
    const prof = Number(ch.skillsProf[s.key] === true ? 1 : ch.skillsProf[s.key]) || 0;
    pdfDot(k, bx + 10, y + 3.5, prof);
    pdfText(k, formatSignedMod(skillBonus(ch, s)), bx + 16, y, { size: 7.2, font: bold, align: 'right', width: 18 });
    pdfLine(k, bx + 16, y + 8, bx + 34, y + 8);
    pdfText(k, s.label, bx + 39, y, { size: 7.2, maxWidth: 82 });
    pdfText(k, s.ability, bx + bw - 30, y + 0.5, { size: 5.6, color: k.c.muted, align: 'right', width: 22 });
  });
  pdfLabel(k, 'Abilità', bx, ky + kh - 9, bw);

  const passive = key => 10 + skillBonus(ch, DND5E_SKILLS.find(s => s.key === key));
  [['Percezione passiva', passive('Percezione')], ['Intuizione passiva', passive('Intuizione')], ['Indagare passivo', passive('Indagare')]].forEach(([label, v], i) => {
    const y = ky + kh + 6 + i * 26;
    pdfBox(k, bx, y, bw, 21);
    pdfBox(k, bx + 4, y + 3, 26, 15, { radius: 3 });
    pdfText(k, String(v), bx + 4, y + 6, { size: 8.5, font: bold, align: 'center', width: 26 });
    pdfText(k, label.toUpperCase(), bx + 36, y + 8, { size: 6, font: bold });
  });

  // CA, iniziativa, velocità, PF, dadi vita, tiri contro morte, azione bonus, condizioni, monete
  const cx = 258;
  const cw = 150;
  const third = (cw - 12) / 3;
  [['Classe armatura', String(ch.ac)], ['Iniziativa', formatSignedMod(getAbilityMod(ch.abilities.DES))], ['Velocità', `${String(ch.speed).replace('.', ',')} m`]].forEach(([label, v], i) => {
    const x = cx + i * (third + 6);
    pdfBox(k, x, top, third, 48, i === 0 ? { radius: 12 } : {});
    pdfText(k, v, x, top + 9, { size: 15, font: bold, align: 'center', width: third });
    // Le etichette lunghe vanno su due righe
    const words = label.split(' ');
    if (words.length > 1 && bold.widthOfTextAtSize(label.toUpperCase(), 5.6) > third - 6) {
      pdfLabel(k, words[0], x, top + 30, third);
      pdfLabel(k, words.slice(1).join(' '), x, top + 37, third);
    } else pdfLabel(k, label, x, top + 36, third);
  });
  const hy = top + 54;
  pdfBox(k, cx, hy, cw, 58, { fill: k.c.panel });
  [['Massimi', ch.maxHp], ['Attuali', ch.hp], ['Temporanei', ch.tempHp || '—']].forEach(([label, v], i) => {
    const x = cx + 5 + i * ((cw - 10) / 3);
    const w = (cw - 10) / 3 - 4;
    pdfBox(k, x, hy + 5, w, 33, { radius: 4 });
    pdfText(k, String(v), x, hy + 11, { size: 15, font: bold, align: 'center', width: w });
    pdfText(k, label.toUpperCase(), x, hy + 40, { size: 5.2, font: bold, color: k.c.muted, align: 'center', width: w });
  });
  pdfLabel(k, 'Punti ferita', cx, hy + 49, cw);

  const dy = hy + 64;
  const half = (cw - 6) / 2;
  pdfBox(k, cx, dy, half, 50);
  pdfText(k, `Totale: ${ch.level}${ch.hitDie}`, cx + 6, dy + 8, { size: 7, font: bold });
  pdfText(k, `Rimasti: ${ch.hitDiceRemaining}`, cx + 6, dy + 20, { size: 7 });
  pdfLabel(k, 'Dadi vita', cx, dy + 40, half);
  pdfBox(k, cx + half + 6, dy, half, 50);
  [['Successi', ch.deathSaves.successes], ['Fallimenti', ch.deathSaves.failures]].forEach(([label, n], r) => {
    const y = dy + 8 + r * 13;
    pdfText(k, label.toUpperCase(), cx + half + 10, y + 1, { size: 5.2, font: bold });
    for (let i = 0; i < 3; i++) pdfDot(k, cx + half + 50 + i * 9, y + 3.5, i < n ? 1 : 0);
  });
  pdfLabel(k, 'Tiri contro morte', cx + half + 6, dy + 40, half);

  const ay = dy + 56;
  pdfBox(k, cx, ay, cw, 30);
  pdfText(k, ch.bonusAction || '—', cx + 6, ay + 6, { size: 7.4, maxWidth: cw - 12 });
  pdfLabel(k, 'Azione bonus', cx, ay + 20, cw);
  const ny = ay + 36;
  const conditions = [...ch.conditions, ch.concentration?.name ? `Concentrazione: ${ch.concentration.name}` : ''].filter(Boolean).join(', ');
  pdfBox(k, cx, ny, cw, 36);
  pdfFlow(k, conditions || 'Nessuna', cx + 6, ny + 5, cw - 12, 18);
  pdfLabel(k, 'Condizioni', cx, ny + 26, cw);

  const my = ny + 42;
  const coinW = (cw - 16) / 5;
  pdfBox(k, cx, my, cw, 38, { fill: k.c.panel });
  COIN_KEYS.forEach((key, i) => {
    const x = cx + 4 + i * (coinW + 2);
    pdfBox(k, x, my + 4, coinW, 18, { radius: 3 });
    pdfText(k, String(ch.coins[key] || 0), x, my + 9, { size: 7.5, font: bold, align: 'center', width: coinW });
    pdfText(k, key.toUpperCase(), x, my + 24, { size: 5.4, font: bold, color: k.c.muted, align: 'center', width: coinW });
  });
  pdfLabel(k, 'Monete', cx, my + 31, cw);

  const ey = my + 44;
  const eh = top + 6 * 80 - 9 - ey;
  pdfBox(k, cx, ey, cw, eh);
  const equipmentLeft = pdfFlow(k, ch.equipmentText || '', cx + 6, ey + 6, cw - 12, eh - 20);
  pdfLabel(k, 'Equipaggiamento', cx, ey + eh - 10, cw);

  // Privilegi e tratti
  const fx = 414;
  const fw = PDF_W - PDF_M - fx;
  const fh = 6 * 80 - 9;
  pdfBox(k, fx, top, fw, fh);
  // Le note seguono i privilegi: vanno nelle pagine dopo solo se qui non c'è più posto
  const featuresLeft = pdfFlow(k, [ch.featuresText, notes && `Note:\n${notes}`].filter(Boolean).join('\n\n'), fx + 6, top + 6, fw - 12, fh - 20);
  pdfLabel(k, notes ? 'Privilegi, tratti e note' : 'Privilegi, tratti e competenze', fx, top + fh - 10, fw);

  // Armi e trucchetti
  const ty = top + 6 * 80 + 2;
  const th = PDF_H - 30 - ty;
  pdfBox(k, PDF_M, ty, PDF_W - 2 * PDF_M, th);
  const cols = [[PDF_M + 8, 150, 'Nome'], [PDF_M + 160, 54, 'Colpire'], [PDF_M + 216, 132, 'Danni / tipo'], [PDF_M + 350, PDF_W - 2 * PDF_M - 356, 'Note']];
  cols.forEach(([x, w, label]) => pdfText(k, label.toUpperCase(), x, ty + 7, { size: 5.6, font: bold, color: k.c.muted, maxWidth: w }));
  const rows = pdfAttackRows(ch, rules);
  const rowH = 14;
  const maxRows = Math.floor((th - 30) / rowH);
  rows.slice(0, maxRows).forEach((row, r) => {
    const y = ty + 17 + r * rowH;
    k.page.drawRectangle({ x: PDF_M + 5, y: PDF_H - (y + rowH - 2), width: PDF_W - 2 * PDF_M - 10, height: rowH - 3, color: k.c.panel });
    row.forEach((cell, c) => pdfText(k, cell, cols[c][0], y + 2.5, { size: c === 3 ? 6.2 : 7.4, font: c < 2 ? bold : k.fonts.regular, maxWidth: cols[c][1] }));
  });
  if (!rows.length) pdfText(k, 'Nessuna arma: si aggiungono dalla scheda del Tavolo.', PDF_M + 8, ty + 20, { color: k.c.muted });
  pdfLabel(k, 'Armi e trucchetti d\'attacco', PDF_M, ty + th - 10, PDF_W - 2 * PDF_M);

  return {
    features: featuresLeft,
    equipment: equipmentLeft,
    attacks: rows.slice(maxRows).map(r => r.filter(Boolean).join(' · ')).join('\n')
  };
}

// Restituisce le sezioni da continuare nelle pagine dopo
function pdfStoryPage(k, ch, story, campaign) {
  const has = STORY_FIELDS.some(([key]) => String(story?.[key] || '').trim());
  if (!has) return [];
  pdfNewPage(k);
  const label = key => pdfSafe(STORY_FIELDS.find(f => f[0] === key)[1]).trim();
  pdfHeader(k, ch, [['Classe e livello', `${ch.className} ${ch.level}`], ['Background', ch.background], ['Avventura', campaign], ['Razza', ch.race], ['Allineamento', pdfAlignment(ch)], ['', '']]);
  const top = 90;
  const lw = 300;
  const rx = PDF_M + lw + 8;
  const rw = PDF_W - PDF_M - rx;
  const bottom = PDF_H - 30;
  pdfBox(k, PDF_M, top, lw, bottom - top);
  const storyLeft = pdfFlow(k, story.text || '', PDF_M + 8, top + 8, lw - 16, bottom - top - 24, 7.6);
  pdfLabel(k, label('text'), PDF_M, bottom - 12, lw);
  const boxes = ['look', 'traits', 'ideals', 'bonds', 'flaws'];
  const bh = (bottom - top - 6 * (boxes.length - 1)) / boxes.length;
  const left = [{ title: `${label('text')} (continua)`, text: storyLeft }];
  boxes.forEach((key, i) => {
    const y = top + i * (bh + 6);
    pdfBox(k, rx, y, rw, bh, { fill: i % 2 ? k.c.white : k.c.panel });
    left.push({ title: `${label(key)} (continua)`, text: pdfFlow(k, story[key] || '', rx + 6, y + 6, rw - 12, bh - 20) });
    pdfLabel(k, label(key), rx, y + bh - 10, rw);
  });
  return left;
}

function pdfSpellPages(k, ch) {
  const slots = Object.entries(ch.spellSlots).filter(([, s]) => s.max > 0);
  const spells = SRD.spells ? ch.spells.map(s => ({ s, sp: srdSpell(Number(s.i)) })).filter(x => x.sp).sort((a, b) => a.sp.lv - b.sp.lv || a.sp.n.localeCompare(b.sp.n, 'it')) : [];
  if (!spells.length && !slots.length && !String(ch.spellsText || '').trim()) return '';
  const rules = classSpellRules(ch);
  const prepares = Boolean(spellPrepMode(ch));
  const st = spellStats(ch);
  const { bold } = k.fonts;
  const cols = [[PDF_M + 6, 24, 'Prep.'], [PDF_M + 32, 150, 'Nome'], [PDF_M + 186, 70, 'Tempo'], [PDF_M + 258, 62, 'Gittata'], [PDF_M + 322, 110, 'Durata'], [PDF_M + 434, PDF_W - 2 * PDF_M - 438, 'Note']];
  let y = 0;
  let index = 0;
  const bottom = PDF_H - 34;
  const startPage = (first) => {
    pdfNewPage(k);
    pdfText(k, `${ch.name} · Incantesimi`, PDF_M, 24, { size: 13, font: bold, maxWidth: PDF_W - 2 * PDF_M });
    pdfLine(k, PDF_M, 42, PDF_W - PDF_M, 42, 1, k.c.ink);
    y = 50;
    if (first) {
      const w = (PDF_W - 2 * PDF_M - 12) / 3;
      [['Caratteristica da incantatore', st.ab], ['CD dei tiri salvezza', String(st.dc)], ['Bonus di attacco', formatSignedMod(st.attack)]].forEach(([label, v], i) => {
        const x = PDF_M + i * (w + 6);
        pdfBox(k, x, y, w, 36, { fill: k.c.panel });
        pdfText(k, v, x, y + 6, { size: 13, font: bold, align: 'center', width: w });
        pdfLabel(k, label, x, y + 26, w);
      });
      y += 42;
      if (slots.length) {
        pdfBox(k, PDF_M, y, PDF_W - 2 * PDF_M, 24);
        let x = PDF_M + 8;
        pdfText(k, 'SLOT', x, y + 9, { size: 6, font: bold });
        x += 26;
        slots.forEach(([lvl, s]) => {
          pdfText(k, `${lvl}°`, x, y + 8.5, { size: 7.4, font: bold });
          for (let i = 0; i < s.max; i++) pdfDot(k, x + 14 + i * 8, y + 12, i < s.used ? 1 : 0);
          x += 22 + s.max * 8;
        });
        y += 30;
      }
      if (rules) {
        const known = spellPrepMode(ch) ? `preparati ${maxPreparedSpells(ch)}` : `${rules.kind === 'known' ? 'conosciuti' : 'preparati'} ${rules.spells}`;
        const limits = `${rules.cantrips ? `trucchetti ${rules.cantrips} · ` : ''}${known}`;
        pdfText(k, `Al ${ch.level}° livello (regole ${rules.rules}): ${limits}, fino al ${rules.maxLevel}° livello.`, PDF_M, y, { size: 6.6, color: k.c.muted });
        y += 12;
      }
    }
    cols.forEach(([x, w, label]) => pdfText(k, label.toUpperCase(), x, y, { size: 5.6, font: bold, color: k.c.muted, maxWidth: w }));
    y += 10;
  };
  startPage(true);
  let lastLevel = -1;
  for (; index < spells.length; index++) {
    const { s, sp } = spells[index];
    if (y + 26 > bottom) startPage(false);
    if (sp.lv !== lastLevel) {
      lastLevel = sp.lv;
      pdfText(k, sp.lv === 0 ? 'TRUCCHETTI' : `${sp.lv}° LIVELLO`, PDF_M + 6, y + 2, { size: 6.8, font: bold, color: k.c.accent });
      y += 12;
    }
    k.page.drawRectangle({ x: PDF_M + 2, y: PDF_H - (y + 11), width: PDF_W - 2 * PDF_M - 4, height: 11, color: index % 2 ? k.c.white : k.c.panel });
    const prep = sp.lv === 0 || !prepares ? '' : s.ritualOnly ? 'R' : isSpellReady(ch, s, sp) ? '•' : 'o';
    const notes = [sp.conc ? 'Concentrazione' : '', sp.rit ? 'rituale' : '', s.always && !s.x ? 'sempre preparato' : '', s.x ? 'extra' : '', sp.save ? `TS ${sp.save}` : '', sp.atk ? 'attacco' : ''].filter(Boolean).join(', ');
    [prep, sp.n, sp.ct, sp.rg, sp.du, notes].forEach((cell, c) => pdfText(k, cell, cols[c][0], y + 2, { size: c === 1 ? 7.4 : 6.6, font: c === 1 ? bold : k.fonts.regular, maxWidth: cols[c][1] - 4 }));
    y += 12;
  }
  if (prepares) pdfText(k, `• preparato   o ${hasSpellbook(ch) ? 'nel libro, ' : ''}non preparato${spells.some(x => x.s.ritualOnly) ? '   R solo come rituale' : ''}`, PDF_M + 6, Math.min(y + 4, bottom), { size: 6, color: k.c.muted });
  return String(ch.spellsText || '').trim();
}

function pdfDnd5eCharacter(k, ch, extra) {
  const left = pdfMainPage(k, ch, extra);
  const storyLeft = pdfStoryPage(k, ch, extra.story, extra.campaign);
  const otherSpells = pdfSpellPages(k, ch);
  pdfContinuation(k, ch.name, [
    { title: 'Privilegi, tratti e note (continua)', text: left.features },
    { title: 'Equipaggiamento (continua)', text: left.equipment },
    { title: 'Altri attacchi', text: left.attacks },
    { title: 'Altri incantesimi', text: otherSpells },
    ...storyLeft
  ]);
}

// ---------------------------------------------------------------------------
// Schede personalizzate: valori e risorse in riquadri, testi lunghi a seguire
// ---------------------------------------------------------------------------

function pdfCustomCharacter(k, ch, extra) {
  pdfNewPage(k);
  const fields = ch.custom.fields;
  const short = fields.filter(f => f.type === 'number' || f.type === 'resource' || f.type === 'text' || f.type === 'roll');
  pdfHeader(k, ch, [['Scheda', ch.custom.tplName || 'Personalizzata'], ['Avventura', extra.campaign], ['', ''], ['', ''], ['', ''], ['', '']]);
  const colsN = 4;
  const w = (PDF_W - 2 * PDF_M - (colsN - 1) * 6) / colsN;
  let y = 90;
  short.forEach((f, i) => {
    const x = PDF_M + (i % colsN) * (w + 6);
    if (i && i % colsN === 0) y += 46;
    const value = f.type === 'resource' ? `${f.value} / ${f.max}` : f.type === 'roll' ? f.formula : f.type === 'number' ? String(f.value ?? '') : f.value;
    pdfBox(k, x, y, w, 40, { fill: f.type === 'resource' ? k.c.panel : k.c.white });
    const fit = pdfFitSize(k, value || '—', k.fonts.bold, f.type === 'text' ? 10 : 14, w - 10, 6);
    pdfText(k, fit.text, x, y + 9, { size: fit.size, font: k.fonts.bold, align: 'center', width: w });
    pdfLabel(k, f.label, x, y + 30, w);
  });
  // I testi lunghi seguono sotto i riquadri, e poi nelle pagine dopo se serve
  pdfContinuation(k, ch.name, [
    ...fields.filter(f => f.type === 'longtext').map(f => ({ title: f.label, text: f.value })),
    { title: 'Note', text: ch.notes }
  ], short.length ? y + 52 : 90);
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

async function buildSheetsPdf(chars) {
  const PDFLib = await loadPdfLib();
  await loadSrd('spells').catch(() => null);
  const doc = await PDFLib.PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(PDFLib.StandardFonts.Helvetica),
    bold: await doc.embedFont(PDFLib.StandardFonts.HelveticaBold)
  };
  const { rgb } = PDFLib;
  const campaign = getMeta().title;
  const k = {
    doc, fonts, page: null, pageNo: 0, footer: '',
    c: { ink: rgb(0.12, 0.12, 0.12), muted: rgb(0.42, 0.42, 0.42), panel: rgb(0.91, 0.91, 0.9), white: rgb(1, 1, 1), accent: rgb(0.5, 0.14, 0.12) }
  };
  doc.setTitle(pdfSafe(chars.length === 1 ? `${chars[0].name} - scheda del personaggio` : `${campaign} - schede dei personaggi`));
  doc.setCreator('Il Tavolo');
  doc.setProducer('Il Tavolo (pdf-lib)');
  for (const ch of chars) {
    k.footer = pdfSafe(`Il Tavolo · ${campaign} · ${ch.name} · ${new Date().toLocaleDateString('it-IT')}`);
    // La storia privata entra solo se chi scarica la può leggere (il giocatore con il PIN, il Master)
    const view = await storyForView(ch).catch(() => null);
    const extra = { campaign, rules: campaignRules(), story: view && !view.locked ? view.data || {} : {} };
    if (isCustomChar(ch)) pdfCustomCharacter(k, ch, extra);
    else pdfDnd5eCharacter(k, ch, extra);
  }
  return doc.save();
}

async function downloadSheetsPdf(chars, filename, btn) {
  if (!chars.length) { showToast('Nessuna scheda da scaricare'); return; }
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Preparo il PDF…'; }
  try {
    const bytes = await buildSheetsPdf(chars);
    downloadBlob(filename, new Blob([bytes], { type: 'application/pdf' }));
    showToast(chars.length === 1 ? `📄 Scheda di ${chars[0].name} scaricata` : `📄 ${chars.length} schede scaricate in un PDF`);
  } catch (err) {
    console.error(err);
    showToast(location.protocol === 'file:' || /script|pdf-lib/.test(String(err?.message))
      ? '⚠️ Non riesco a preparare il PDF: controlla la connessione e riprova'
      : '⚠️ Qualcosa è andato storto preparando il PDF', 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

function initSheetPdfEvents() {
  $('btnSheetPdf').addEventListener('click', (e) => {
    const ch = currentSheetChar();
    if (ch) downloadSheetsPdf([ch], `${slugify(ch.name)}-scheda.pdf`, e.currentTarget);
  });
  $('btnDmSheetsPdf').addEventListener('click', (e) => {
    if (!isDM()) return;
    const pcs = getPCs();
    downloadSheetsPdf(pcs, `${slugify(getMeta().title)}-schede.pdf`, e.currentTarget);
  });
}
