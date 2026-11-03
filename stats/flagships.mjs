// Draws the four flagship plates into assets/plates. Each one lives in its own product's world and only states
// facts read from that product's code. Facts are written here by hand on purpose: these repos are private or local,
// so this runs on my machine, and stats/check.mjs re-reads the source to catch anything that has drifted.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const FONTS = JSON.parse(readFileSync(new URL('./fonts.json', import.meta.url)));
const GRAPH = JSON.parse(readFileSync(new URL('./blueprint-graph.json', import.meta.url)));
const f1 = (n) => +n.toFixed(1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function plate({ W, H, title, fonts, css }, body) {
  const faces = fonts.map((n) => `@font-face{font-family:${n};src:url(data:font/woff;base64,${FONTS[n]}) format('woff')}`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t"><title id="t">${esc(title)}</title>`
    + `<style>${faces}text{font-kerning:normal}${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>${body}</svg>`;
}
function pen() {
  const a = [];
  return {
    t(x, y, s, o = {}) { a.push(`<text x="${f1(x)}" y="${f1(y)}" font-family="${o.font}" font-size="${o.size}" fill="${o.fill}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.extra ? ` ${o.extra}` : ''}>${esc(s)}</text>`); },
    r(x, y, w, h, fill, rx = 0, extra = '') { a.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${fill}"${rx ? ` rx="${rx}"` : ''}${extra ? ` ${extra}` : ''}/>`); },
    raw(s) { a.push(s); },
    done: () => a.join(''),
  };
}
function mark(slug, x, y, size) {
  const s = readFileSync(new URL(`../assets/logos/${slug}.svg`, import.meta.url), 'utf8').trim().replace(/<title>[^<]*<\/title>/, '');
  return s.replace(/^<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">`);
}
const polar = (cx, cy, r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [f1(cx + r * Math.cos(a)), f1(cy + r * Math.sin(a))]; };

// RADAR ------------------------------------------------------------------------------------------------------------
// vercel.json, in hours UTC. One turn of the sweep is one day, at a second per hour.
export const RUNS = {
  embed: Array.from({ length: 24 }, (_, h) => h + 0.75),
  discover: [1.5, 5.5, 11.5, 17.5, 23.5],
  scan: [2.5, 8.5, 14.5, 20.5],
  autopilot: [3.5, 9.5, 15.5, 21.5],
};

function radar(narrow) {
  const c = { bg: '#000401', g: '#00FF41', mid: '#0FA33A', low: '#0B5A23', faint: '#07180D', txt: '#D2FFDD', sub: '#74C48C', y: '#FACC15' };
  const W = narrow ? 440 : 880;
  const R = narrow ? 178 : 186;
  const cx = narrow ? 220 : 226;
  const cy = narrow ? 212 : 226;
  const p = pen();
  const T = { font: 'Term', fill: c.txt, size: 13 };
  const B = { font: 'TermBold', fill: c.g };

  // The scope. Every mark on it is a job that really runs.
  p.raw(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#010B05"/>`);
  const rings = { embed: R - 15, discover: R - 48, scan: R - 82, autopilot: R - 116 };
  for (const r of Object.values(rings)) p.raw(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.low}" stroke-opacity=".55"/>`);
  for (let h = 0; h < 24; h++) {
    const big = h % 6 === 0;
    const [x0, y0] = polar(cx, cy, R - (big ? 7 : 4), h * 15);
    const [x1, y1] = polar(cx, cy, R, h * 15);
    p.raw(`<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${c.g}" stroke-opacity="${big ? 1 : 0.5}" stroke-width="${big ? 2 : 1}"/>`);
  }
  for (const [h, label] of [[0, '00'], [6, '06'], [12, '12'], [18, '18']]) {
    const [x, y] = polar(cx, cy, R + 13, h * 15);
    p.t(x, y + 4, label, { ...T, size: 12, fill: c.sub, anchor: 'middle' });
  }
  // Sweep with a stepped phosphor trail, drawn pointing at midnight and turned by CSS.
  let wedge = '';
  const steps = 22;
  const trail = 105;
  for (let i = 0; i < steps; i++) {
    const a1 = -(trail / steps) * i;
    const a0 = a1 - trail / steps - 0.4;
    const [x0, y0] = polar(cx, cy, R - 2, a0);
    const [x1, y1] = polar(cx, cy, R - 2, a1);
    wedge += `<path d="M${cx} ${cy}L${x0} ${y0}A${R - 2} ${R - 2} 0 0 1 ${x1} ${y1}Z" fill="${c.g}" opacity="${(0.42 * (1 - i / steps) ** 1.7).toFixed(3)}"/>`;
  }
  const [lx, ly] = polar(cx, cy, R - 2, 0);
  p.raw(`<g class="sweep">${wedge}<path d="M${cx} ${cy}L${lx} ${ly}" stroke="#D6FFE0" stroke-width="2"/></g>`);

  const size = { embed: 2.4, discover: 4.6, scan: 5.6, autopilot: 4.6 };
  for (const [job, hours] of Object.entries(RUNS)) {
    const fill = job === 'scan' ? c.y : job === 'embed' ? c.mid : c.g;
    for (const h of hours) {
      const [x, y] = polar(cx, cy, rings[job], h * 15);
      p.raw(`<circle class="b" cx="${x}" cy="${y}" r="${size[job]}" fill="${fill}" style="animation-delay:${(h - 24).toFixed(2)}s"/>`);
    }
  }
  // Rings are labelled where they cross noon, on a chip so the trace can't run through the words.
  for (const [job, label] of [['embed', 'embed 24×'], ['discover', 'discover 5×'], ['scan', 'scan 4×'], ['autopilot', 'autopilot 4×']]) {
    const w = label.length * 6.6 + 8;
    p.r(cx - w / 2, cy + rings[job] - 8, w, 16, '#010B05');
    p.t(cx, cy + rings[job] + 4, label, { ...T, size: 11, fill: c.sub, anchor: 'middle' });
  }
  p.raw(`<circle cx="${cx}" cy="${cy}" r="50" fill="#010B05"/>`);
  p.t(cx, cy + 6, '37', { ...B, size: 44, anchor: 'middle' });
  p.t(cx, cy + 25, 'runs a day', { ...T, size: 12, fill: c.sub, anchor: 'middle' });

  // Right-hand side: what it is, then how a job earns its place.
  const x0 = narrow ? 24 : 452;
  let y = narrow ? cy + R + 42 : 50;
  p.raw(mark('radar', x0, y, 52));
  p.t(x0 + 66, y + 40, 'RADAR', { ...B, size: 40, extra: 'letter-spacing="1"' });
  y += 78;
  p.t(x0, y, 'An AI job engine that runs all day and', T);
  p.t(x0, y + 20, 'leaves you only the final click.', T);
  y += 56;

  p.t(x0, y, 'score = 0.6 × meaning + 0.4 × skills', { ...B, size: 13 });
  y += 12;
  const mapW = narrow ? 268 : 232;
  const mapH = narrow ? 170 : 158;
  const mapX = x0 + 30;
  const X = (m) => f1(mapX + (m / 100) * mapW);
  const Y = (s) => f1(y + mapH - (s / 100) * mapH);
  p.r(mapX, y, mapW, mapH, c.faint);
  p.raw(`<path d="M${X(16.7)} ${Y(100)}L${X(66.7)} ${Y(100)}L${X(100)} ${Y(50)}L${X(100)} ${Y(0)}L${X(83.3)} ${Y(0)}Z" fill="#0C6B2D"/>`);
  p.raw(`<path d="M${X(66.7)} ${Y(100)}L${X(100)} ${Y(100)}L${X(100)} ${Y(50)}Z" fill="${c.g}"/>`);
  p.t(X(100) - 7, Y(100) + 17, 'VAULT', { ...B, size: 13, fill: '#001A07', anchor: 'end' });
  p.t(X(100) - 7, Y(100) + 33, '80+', { ...T, size: 12, fill: '#001A07', anchor: 'end' });
  p.t(X(62), Y(45), 'OVERCLOCK', { ...B, size: 12, fill: c.txt, anchor: 'middle' });
  p.t(X(62), Y(45) + 15, '50-79', { ...T, size: 12, fill: c.txt, anchor: 'middle' });
  p.t(X(4), Y(0) - 9, 'below 50', { ...T, size: 11, fill: c.sub });
  for (const [m, label] of [[0, '0.32'], [50, '0.48'], [100, '0.64']]) p.t(X(m), Y(0) + 15, label, { ...T, size: 11, fill: c.sub, anchor: m === 0 ? 'start' : m === 100 ? 'end' : 'middle' });
  for (const [s, label] of [[0, '0'], [50, '50'], [100, '100']]) p.t(mapX - 6, Y(s) + (s === 100 ? 9 : s === 0 ? 0 : 4), label, { ...T, size: 11, fill: c.sub, anchor: 'end' });
  p.t(X(50), Y(0) + 31, 'cosine similarity, resume vs job', { ...T, size: 11, fill: c.sub, anchor: 'middle' });
  p.t(mapX - 22, y + mapH / 2, '% skills matched', { ...T, size: 11, fill: c.sub, anchor: 'middle', extra: `transform="rotate(-90 ${mapX - 22} ${y + mapH / 2})"` });
  // Numbers beside the map on desktop, below it on a phone.
  const stats = [['30', 'job feeds read'], ['1024-d', 'vectors matched'], ['37', 'test files']];
  if (narrow) {
    y += mapH + 66;
    stats.forEach(([v, l], i) => {
      p.t(x0 + i * 134, y, v, { ...B, size: 24 });
      p.t(x0 + i * 134, y + 18, l, { ...T, size: 11, fill: c.sub });
    });
    y += 44;
  } else {
    const sx = mapX + mapW + 18;
    stats.forEach(([v, l], i) => {
      p.t(sx, y + 18 + i * 55, v, { ...B, size: 22 });
      p.t(sx, y + 35 + i * 55, l, { ...T, size: 11, fill: c.sub });
    });
    y += mapH + 58;
  }
  const H = narrow ? y + 6 : 456;
  return plate({
    W, H,
    title: 'RADAR: a 24-hour scope showing 37 real scheduled runs a day, next to the score map that sends jobs to the Vault or to resume tailoring.',
    fonts: ['Term', 'TermBold'],
    css: `.sweep{transform-box:view-box;transform-origin:${cx}px ${cy}px;animation:spin 24s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.b{opacity:.55;transform-box:fill-box;transform-origin:center;animation:ping 24s linear infinite}@keyframes ping{0%{opacity:1;transform:scale(1.7)}10%{opacity:.8;transform:scale(1)}38%,100%{opacity:.5;transform:scale(1)}}`,
  }, `<rect width="${W}" height="${H}" fill="${c.bg}"/>${p.done()}`);
}

// EVES -------------------------------------------------------------------------------------------------------------
const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function eves(narrow) {
  const c = { bg: '#0C0818', v: '#9B6BFF', rose: '#F43F5E', cy: '#22D3EE', ink: '#EEEAFB', sub: '#A79FC6', dim: '#2B2247', wave: '#5A4A9C' };
  const W = narrow ? 440 : 880;
  const pad = narrow ? 20 : 32;
  const p = pen();
  const T = { font: 'Type', fill: c.ink, size: 15 };
  const B = { font: 'TypeBold', fill: c.ink };

  p.raw(mark('eves', pad - 4, narrow ? 22 : 26, 54));
  p.t(pad + 58, narrow ? 64 : 68, 'EVES', { ...B, size: 46 });
  let y;
  if (narrow) {
    p.t(pad, 106, 'Records the meeting, follows Hindi and', T);
    p.t(pad, 126, 'English in one sentence, and writes the', T);
    p.t(pad, 146, 'prompt your coding agent needs.', T);
    y = 178;
  } else {
    p.t(232, 50, 'Records the meeting, follows Hindi and English in one sentence,', T);
    p.t(232, 72, 'and writes the prompt your coding agent needs.', T);
    y = 110;
  }

  // A two-hour meeting as tape. The turns are a sketch, drawn from a fixed seed so the plate never changes.
  const x0 = pad + 28;
  const x1 = W - pad;
  const tape = x1 - x0;
  const rnd = seeded(11);
  const minute = tape / 120;
  let t = 0;
  let who = 0;
  const lane = (s) => y + 4 + s * 20;
  p.t(pad, lane(0) + 12, 'S1', { ...T, size: 13, fill: c.sub });
  p.t(pad, lane(1) + 12, 'S2', { ...T, size: 13, fill: c.sub });
  while (t < 120) {
    const d = Math.min(120 - t, 0.8 + rnd() * rnd() * 11);
    p.r(x0 + t * minute, lane(who), Math.max(2, d * minute - 2), 15, who ? c.cy : c.v, 2);
    t += d;
    if (rnd() > 0.12) who = 1 - who;
  }
  const waveTop = lane(2) + 6;
  const waveH = 66;
  const barW = narrow ? 3 : 4;
  const n = Math.floor(tape / barW);
  let env = 0.5;
  for (let i = 0; i < n; i++) {
    env += (rnd() - 0.5) * 0.22;
    env = Math.max(0.18, Math.min(1, env));
    const h = Math.max(3, env ** 1.3 * waveH * (0.35 + rnd() * 0.65));
    p.r(x0 + i * barW, waveTop + (waveH - h) / 2, barW - 1, h, c.wave);
  }
  const axisY = waveTop + waveH + 18;
  for (const [m, label] of [[0, '0:00'], [30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00']]) {
    p.t(x0 + m * minute, axisY, label, { ...T, size: 12, fill: c.sub, anchor: m === 0 ? 'start' : m === 120 ? 'end' : 'middle' });
  }
  // The record head rides the tape.
  p.raw(`<g class="head"><rect x="${x0 - 1}" y="${y - 2}" width="2" height="${axisY - y - 12}" fill="${c.rose}"/><circle cx="${x0}" cy="${y - 4}" r="5" fill="${c.rose}"/></g>`);
  y = axisY + 22;

  // Long meetings are condensed part by part, then everything becomes something you can act on.
  const parts = 4;
  const partW = tape / parts;
  for (let i = 0; i < parts; i++) {
    const a = x0 + i * partW + 2;
    const b = x0 + (i + 1) * partW - 2;
    p.raw(`<path d="M${f1(a)} ${y - 8}V${y}H${f1(b)}V${y - 8}" fill="none" stroke="${c.sub}" stroke-opacity=".7"/>`);
  }
  p.t(x0 + tape / 2, y + 20, narrow ? 'too long for one prompt: condensed in parts' : 'too long for one prompt, so it is condensed part by part', { ...T, size: 13, fill: c.sub, anchor: 'middle' });
  y += 58;

  // The eight pills from the app, in the app's colours. The three agent prompts share one.
  const pills = [['MAIN GOAL', '#ffcb6b'], ['HOW TO BUILD', '#7ee787'], ['3 AGENT PROMPTS', '#22d3ee'], ['FRONTEND PREVIEW', '#c678dd'], ['ACTION PLAN', '#ff79c6'], ['RISKS & QUESTIONS', '#ff5370']];
  const char = 7.2;
  const gap = narrow ? 8 : 9;
  let px = pad;
  for (const [label, colour] of pills) {
    const w = label.length * char + 18;
    if (px + w > W - pad) { px = pad; y += 36; }
    p.r(px, y - 17, w, 27, `${colour}1A`, 13, `stroke="${colour}" stroke-opacity=".75"`);
    p.t(px + w / 2, y + 1, label, { ...B, size: 12, fill: colour, anchor: 'middle' });
    px += w + gap;
  }
  y += 50;

  const stats = [['16 kHz', 'PCM to the live', 'transcriber'], ['32 kbps', 'Opus to disk,', '14.4 MB an hour'], ['5 s', 'the most a crash', 'can lose'], ['0.5-3×', 'playback with', 'pitch preserved'], ['3', 'AI brains,', 'your own keys']];
  const col = (W - pad * 2) / (narrow ? 2 : 5);
  stats.forEach(([v, a, b], i) => {
    const sx = pad + (narrow ? i % 2 : i) * col;
    const sy = y + (narrow ? Math.floor(i / 2) * 74 : 0);
    p.t(sx, sy, v, { ...B, size: 25, fill: i === 2 ? c.rose : c.ink });
    p.t(sx, sy + 19, a, { ...T, size: 13, fill: c.sub });
    p.t(sx, sy + 35, b, { ...T, size: 13, fill: c.sub });
  });
  const H = y + (narrow ? 2 * 74 + 56 : 56);
  return plate({
    W, H,
    title: 'EVES: a two-hour meeting as tape with two speakers and a moving record head, condensed part by part into goals, plans and paste-ready prompts.',
    fonts: ['Type', 'TypeBold'],
    css: `.head{animation:head 48s linear infinite}@keyframes head{to{transform:translateX(${tape}px)}}`,
  }, `<rect width="${W}" height="${H}" fill="${c.bg}"/>${p.done()}`);
}

// Vettly -----------------------------------------------------------------------------------------------------------
function vettly(narrow) {
  const c = { bg: '#F5F0E6', ink: '#1E293B', sub: '#55617A', o: '#C2410C', oLight: '#EA580C', line: '#E5DDCB', slate: '#475569', paper: '#FFFDF6' };
  const W = narrow ? 440 : 880;
  const pad = narrow ? 20 : 34;
  const p = pen();
  const T = { font: 'Outfit', fill: c.ink, size: 15 };
  const B = { font: 'OutfitBold', fill: c.ink };
  const hand = { font: 'Hand', fill: c.o, size: 21 };

  // Ruled notebook paper.
  let grid = '';
  const height = narrow ? 892 : 480;
  for (let x = 0; x <= W; x += 24) grid += `M${x} 0V${height}`;
  for (let y = 0; y <= height; y += 24) grid += `M0 ${y}H${W}`;
  p.raw(`<path d="${grid}" stroke="${c.line}" stroke-width="1" fill="none"/>`);

  p.raw(mark('vettly', pad, 26, 56));
  p.t(pad + 66, 72, 'Vettly', { font: 'Syne', size: 50, fill: c.ink, extra: 'letter-spacing="-1"' });
  const lines = narrow
    ? ['Interview prep built from what you actually', 'shipped: your resume, your GitHub, the job', 'post and the take-home.']
    : ['Interview prep built from what you actually', 'shipped: your resume, your GitHub, the job', 'post and the take-home.'];
  lines.forEach((s, i) => p.t(pad, 110 + i * 22, s, T));

  // The honesty check. Seven real dimensions, and the bar an answer has to clear.
  const dims = ['naturalness', 'specificity', 'no AI tells', 'flow', 'length', 'language', 'fresh opener'];
  const cx = narrow ? 220 : 650;
  const cy = narrow ? 322 : 158;
  const r = narrow ? 92 : 104;
  const ring = (k) => dims.map((_, i) => polar(cx, cy, r * k, (360 / 7) * i).join(' ')).join('L');
  for (const k of [0.25, 0.5, 0.75, 1]) p.raw(`<path d="M${ring(k)}Z" fill="none" stroke="${c.slate}" stroke-opacity=".22"/>`);
  dims.forEach((_, i) => { const [x, y] = polar(cx, cy, r, (360 / 7) * i); p.raw(`<path d="M${cx} ${cy}L${x} ${y}" stroke="${c.slate}" stroke-opacity=".22"/>`); });
  p.raw(`<path class="bar" d="M${ring(0.8)}Z" fill="${c.oLight}" fill-opacity=".16" stroke="${c.oLight}" stroke-width="2.5" stroke-linejoin="round"/>`);
  dims.forEach((d, i) => {
    const a = (360 / 7) * i;
    const [x, y] = polar(cx, cy, r + 15, a);
    const anchor = a === 0 ? 'middle' : a < 180 ? 'start' : 'end';
    p.t(x, y + 5, d, { ...B, size: 13, fill: c.sub, anchor });
  });
  p.t(cx, cy + 6, '8/10', { font: 'Syne', size: 24, fill: c.ink, anchor: 'middle' });

  // Handwritten margin note, the way the app annotates things.
  const nx = narrow ? 24 : 372;
  const ny = narrow ? 454 : 40;
  p.t(nx, ny, 'below 8? it gets', hand);
  p.t(nx, ny + 21, 'rewritten, 3 tries max', hand);
  if (!narrow) p.raw(`<path d="M${nx + 96} ${ny + 29}C${nx + 92} ${ny + 64} ${nx + 130} ${ny + 94} ${cx - 72} ${cy - 22}" fill="none" stroke="${c.o}" stroke-width="2" stroke-linecap="round"/><path d="M${cx - 80} ${cy - 30}l9 8-11 3" fill="none" stroke="${c.o}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);

  // Four providers, and the cap on the last hop. Real order lives in backend/ai/utils.py.
  const fx = pad;
  const fy = narrow ? 506 : 196;
  p.t(fx, fy, 'If a provider fails, the next one answers', { ...B, size: 14 });
  const stepW = narrow ? 92 : 78;
  [0, 1, 2, 3].forEach((i) => {
    const sx = fx + i * (stepW + 6);
    const sy = fy + 14 + i * 13;
    const h = 30;
    p.r(sx, sy, stepW, h, i === 0 ? c.ink : c.paper, 4, i === 0 ? '' : `stroke="${c.slate}" stroke-opacity=".55"`);
    p.t(sx + stepW / 2, sy + 20, ['1st', '2nd', '3rd', '4th'][i], { ...B, size: 13, fill: i === 0 ? c.paper : c.ink, anchor: 'middle' });
  });
  if (narrow) p.t(fx + 3 * (stepW + 6) + stepW / 2, fy + 14 + 3 * 13 - 8, '14K cap', { ...hand, size: 20, anchor: 'middle' });
  else p.t(fx + 4 * (stepW + 6) + 2, fy + 14 + 3 * 13 + 21, '14K cap', { ...hand, size: 20 });

  // The context budget: the real constants from context_engine.py, on one bar that adds up to the real cap.
  const parts = [
    { label: 'Custom context', n: 35500, note: 'assignment first', fill: c.oLight, ink: '#FFFFFF' },
    { label: 'Resume', n: 20000, note: '', fill: c.ink, ink: '#FFFFFF' },
    { label: 'GitHub', n: 12000, note: '', fill: c.slate, ink: '#FFFFFF' },
    { label: 'Prompt and interviewer', n: 12500, note: '', fill: '#D9CFB8', ink: c.ink },
  ];
  const barTop = narrow ? 648 : 348;
  p.t(pad, barTop - 28, 'One answer gets at most 80,000 characters of you', { ...B, size: narrow ? 14 : 16 });
  const bw = W - pad * 2;
  let bx = pad;
  parts.forEach((s) => {
    const w = (s.n / 80000) * bw;
    p.r(bx, barTop - 16, w - 2, 32, s.fill, 4);
    p.t(bx + 9, barTop + 5, `${(s.n / 1000).toFixed(s.n % 1000 ? 1 : 0)}K`, { ...B, size: 14, fill: s.ink });
    bx += w;
  });
  // Legend in block order, names only, so the numbers stay on the bar.
  let lx = pad;
  const ly = barTop + 40;
  parts.forEach((s, i) => {
    const text = s.note ? `${s.label}, ${s.note}` : s.label;
    if (narrow && i === 2) { lx = pad; }
    const rowY = narrow && i >= 2 ? ly + 22 : ly;
    p.r(lx, rowY - 10, 11, 11, s.fill, 2);
    p.t(lx + 16, rowY, text, { ...T, size: 13, fill: c.sub });
    lx += 16 + text.length * 6.1 + 22;
  });

  const statsY = narrow ? barTop + 110 : barTop + 88;
  const stats = [['9', 'question tracks'], ['7', 'checks on every answer'], ['4', 'providers in the chain'], ['6.5', 'pass bar in live mode']];
  const col = (W - pad * 2) / (narrow ? 2 : 4);
  stats.forEach(([v, l], i) => {
    const sx = pad + (narrow ? i % 2 : i) * col;
    const sy = statsY + (narrow ? Math.floor(i / 2) * 58 : 0);
    p.t(sx, sy, v, { font: 'Syne', size: 24, fill: c.ink });
    p.t(sx, sy + 19, l, { ...T, size: 13, fill: c.sub });
  });
  const H = narrow ? statsY + 2 * 58 + 18 : statsY + 44;
  return plate({
    W, H,
    title: 'Vettly: an 80,000 character context budget, a four provider failover chain and a seven dimension quality bar that every answer has to clear.',
    fonts: ['Syne', 'Outfit', 'OutfitBold', 'Hand'],
    css: '.bar{transform-box:fill-box;transform-origin:center;animation:breathe 7s ease-in-out infinite}@keyframes breathe{50%{transform:scale(1.035)}}',
  }, `<rect width="${W}" height="${H}" fill="${c.bg}"/>${p.done()}`);
}

// Blueprint.sh -----------------------------------------------------------------------------------------------------
function blueprint(narrow) {
  const c = { bg: '#0F3D6E', deep: '#0B3160', grid: '#BFE0FF', ink: '#EAF5FF', sub: '#A9CBEA', red: '#FF6A5C' };
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 30;
  const g = narrow ? GRAPH.down : GRAPH.right;
  const scale = (W - pad * 2) / g.width;
  const p = pen();
  const hubs = [...g.nodes].sort((a, b) => b.fanIn - a.fanIn).slice(0, 3);

  const headH = narrow ? 208 : 136;
  const sheetH = g.height * scale;
  const H = Math.round(headH + sheetH + (narrow ? 104 : 58));

  // Drafting grid: fine every 12, heavier every 60.
  let fine = '';
  let heavy = '';
  for (let x = 0; x <= W; x += 12) (x % 60 ? (fine += `M${x} 0V${H}`) : (heavy += `M${x} 0V${H}`));
  for (let y = 0; y <= H; y += 12) (y % 60 ? (fine += `M0 ${y}H${W}`) : (heavy += `M0 ${y}H${W}`));
  p.raw(`<path d="${fine}" stroke="${c.grid}" stroke-opacity=".06"/><path d="${heavy}" stroke="${c.grid}" stroke-opacity=".12"/>`);

  // Lettering in the product's real wordmark type.
  p.raw(`<text x="${pad - 1}" y="62" font-family="Shoulders" font-size="56" fill="${c.ink}">BLUEPRINT<tspan fill="${c.red}">.sh</tspan></text>`);
  p.t(pad, 90, 'Drop a codebase in. Get its architecture drawn,', { font: 'Over', size: 15, fill: c.ink });
  p.t(pad, 110, 'in your browser, with nothing uploaded.', { font: 'Over', size: 15, fill: c.ink });

  // Which files everything leans on: fan-in from the same graph as the drawing below.
  const hx = narrow ? pad : 560;
  const hy = narrow ? 138 : 32;
  p.t(hx, hy, 'most imported', { font: 'OverMono', size: 12, fill: c.sub });
  const peak = Math.max(...hubs.map((h) => h.fanIn));
  hubs.forEach((h, i) => {
    const y = hy + 10 + i * 22;
    const barMax = narrow ? 240 : 150;
    p.r(hx + 92, y + 2, (h.fanIn / peak) * barMax, 12, i === 0 ? c.red : c.ink, 1);
    p.t(hx, y + 12, `${h.label}.ts`, { font: 'OverMono', size: 12, fill: c.ink });
    p.t(hx + 92 + (h.fanIn / peak) * barMax + 6, y + 12, String(h.fanIn), { font: 'OverMono', size: 12, fill: c.sub });
  });

  // The sheet: its own source, laid out by its own engine. Folders are frames, files are parts, imports are routes.
  const ox = pad;
  const oy = headH;
  const X = (v) => f1(ox + v * scale);
  const Y = (v) => f1(oy + v * scale);
  const label = f1(10 * scale);
  for (const f of g.groups) {
    p.raw(`<rect x="${X(f.x)}" y="${Y(f.y)}" width="${f1(f.w * scale)}" height="${f1(f.h * scale)}" fill="none" stroke="${c.grid}" stroke-opacity=".55" stroke-dasharray="5 4"/>`);
    p.t(X(f.x) + 5, Y(f.y) + 12, `${f.id}/`, { font: 'OverMono', size: Math.max(9, label), fill: c.sub });
  }
  const route = (pts) => `M${pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join('L')}`;
  const edges = g.edges.map((e) => ({ ...e, d: route(e.points), len: e.points.slice(1).reduce((a, q, i) => a + Math.abs(q[0] - e.points[i][0]) + Math.abs(q[1] - e.points[i][1]), 0) * scale }));
  for (const e of edges) p.raw(`<path d="${e.d}" fill="none" stroke="${c.ink}" stroke-opacity=".62" stroke-width="1.1"${e.kind === 'type' ? ' stroke-dasharray="1.5 3"' : e.kind === 'dynamic' ? ' stroke-dasharray="5 3"' : ''}/>`);
  // One route is being re-inked by the plotter, in red pencil, on top of the finished drawing.
  const longest = edges.reduce((a, b) => (b.len > a.len ? b : a));
  const len = Math.ceil(longest.len);
  p.raw(`<path class="pen" d="${longest.d}" fill="none" stroke="${c.red}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${Math.min(46, len / 3)} ${len + 60}"/>`);
    for (const n of g.nodes) {
    const hub = hubs.includes(n);
    p.raw(`<rect x="${X(n.x)}" y="${Y(n.y)}" width="${f1(n.w * scale)}" height="${f1(n.h * scale)}" fill="${hub ? c.ink : c.bg}" stroke="${c.ink}" stroke-width="1.2"/>`);
    p.t(X(n.x + n.w / 2), Y(n.y + n.h / 2) + label * 0.34, n.label, { font: 'OverMono', size: label, fill: hub ? c.bg : c.ink, anchor: 'middle' });
  }

  // Title block, as on any real drawing. Numbers come from the graph drawn above it.
  const S = GRAPH.stats;
  const cells = [['PROJECT', 'blueprint.sh'], ['SHEET', '01/01'], ['MODULES', S.modules], ['IMPORTS', S.imports], ['CYCLES', S.cycles], ['DRAWN BY', 'itself']];
  const tbY = H - (narrow ? 88 : 44);
  const tbW = W - pad * 2;
  const perRow = narrow ? 3 : 6;
  const cw = tbW / perRow;
  const rows = Math.ceil(cells.length / perRow);
  const rh = 36;
  p.raw(`<rect x="${pad}" y="${tbY}" width="${tbW}" height="${rows * rh}" fill="${c.deep}" stroke="${c.ink}" stroke-width="1.2"/>`);
  cells.forEach(([k, v], i) => {
    const cx = pad + (i % perRow) * cw;
    const cy = tbY + Math.floor(i / perRow) * rh;
    if (i % perRow) p.raw(`<path d="M${f1(cx)} ${cy}V${cy + rh}" stroke="${c.ink}" stroke-opacity=".6"/>`);
    p.t(cx + 8, cy + 13, k, { font: 'OverMono', size: 9, fill: c.sub });
    p.t(cx + 8, cy + 29, String(v), { font: 'Shoulders', size: 16, fill: k === 'CYCLES' && !v ? c.ink : c.ink });
  });
  if (rows > 1) p.raw(`<path d="M${pad} ${tbY + rh}H${pad + tbW}" stroke="${c.ink}" stroke-opacity=".6"/>`);

  return plate({
    W, H,
    title: `Blueprint.sh: its own source as an architecture sheet, drawn by its own engine. ${S.modules} modules, ${S.imports} imports, ${S.cycles} cycles.`,
    fonts: ['Shoulders', 'Over', 'OverMono'],
    css: `.pen{animation:plot 9s linear infinite}@keyframes plot{from{stroke-dashoffset:${Math.min(46, len / 3)}}to{stroke-dashoffset:${-(len + 14)}}}`,
  }, `<rect width="${W}" height="${H}" fill="${c.bg}"/>${p.done()}`);
}

if (process.argv[1]?.endsWith('flagships.mjs')) {
  const out = new URL('../assets/plates/', import.meta.url);
  mkdirSync(out, { recursive: true });
  for (const [name, draw] of Object.entries({ radar, eves, vettly, blueprint })) {
    for (const narrow of [false, true]) writeFileSync(new URL(`${name}${narrow ? '-m' : ''}.svg`, out), draw(narrow));
  }
  console.log('plates written');
}
