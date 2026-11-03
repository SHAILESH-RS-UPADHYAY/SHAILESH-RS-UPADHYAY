// Draws the live plates from summarize()'s output. Pure: same numbers in, same SVG out.
// Every plate is complete on its first frame; motion only ever sits on top of finished content.
import { readFileSync } from 'node:fs';

const FONTS = JSON.parse(readFileSync(new URL('./fonts.json', import.meta.url)));
const XRAY = JSON.parse(readFileSync(new URL('./xray.json', import.meta.url)));
const logo = (slug) => readFileSync(new URL(`../assets/logos/${slug}.svg`, import.meta.url), 'utf8');

const THEMES = {
  // One hue plus grey on purpose. Four series colours fail colour-blind separation, and rows are labelled anyway.
  dark: { bg: '#0D1117', ink: '#F0EEE6', sub: '#A8B0B9', muted: '#7D8590', line: '#262C34', empty: '#161B22', accent: '#F2B13A',
    ramp: ['#4A3715', '#7D5A14', '#B98114', '#F2B13A'], neutral: '#59626C' },
  light: { bg: '#FFFFFF', ink: '#1A1C1F', sub: '#59636E', muted: '#7D8590', line: '#E6E3DA', empty: '#F1F0EB', accent: '#B87A0F',
    ramp: ['#F5DFAE', '#E9BC62', '#CC8E1E', '#8F5F08'], neutral: '#AEB4BB' },
};

const FLAGSHIPS = ['radar', 'eves', 'vettly', 'blueprint-sh'];
const LOGO_OF = { radar: 'radar', eves: 'eves', vettly: 'vettly', 'blueprint-sh': 'blueprint' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST = 5.5 * 3600e3;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => n.toLocaleString('en-US');
const f1 = (n) => +n.toFixed(1);
const dayLabel = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;

function ago(iso, now) {
  const min = Math.round((now - Date.parse(iso)) / 6e4);
  if (min < 2) return 'just now';
  if (min < 60) return `${min} minutes ago`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? 'an hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function canvas({ theme, W, H, title, fonts, css = '' }, body) {
  const faces = fonts.map((n) => `@font-face{font-family:${n};src:url(data:font/woff;base64,${FONTS[n]}) format('woff')}`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t"><title id="t">${esc(title)}</title>`
    + `<style>${faces}text{font-kerning:normal}.n{font-variant-numeric:tabular-nums}${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`
    + `<rect width="${W}" height="${H}" fill="${THEMES[theme].bg}"/>${body}</svg>`;
}

// Drawing helpers bound to one plate's palette.
function pen(c) {
  const parts = [];
  return {
    parts,
    t(x, y, s, { font = 'Sans', size = 13, fill = c.sub, anchor, extra = '' } = {}) {
      parts.push(`<text x="${f1(x)}" y="${f1(y)}" font-family="${font}" font-size="${size}" fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ''} ${extra}>${esc(s)}</text>`);
    },
    r(x, y, w, h, fill, rx = 0, extra = '') {
      parts.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${fill}"${rx ? ` rx="${rx}"` : ''} ${extra}/>`);
    },
    raw(s) { parts.push(s); },
    done: () => parts.join(''),
  };
}

// Quartiles of the active values, the same idea GitHub's own graph uses, so one huge day can't flatten the rest.
function levels(values) {
  const active = values.filter(Boolean).sort((a, b) => a - b);
  const q = [0.25, 0.5, 0.75].map((p) => active[Math.floor(p * (active.length - 1))] ?? 1);
  return { q, level: (n) => (!n ? -1 : n <= q[0] ? 0 : n <= q[1] ? 1 : n <= q[2] ? 2 : 3) };
}

// The stretch of the calendar worth drawing: from the first active week to now. Grows on its own over time.
function timeline(vm) {
  const firstActive = vm.calendar.findIndex((w) => w.some(([, n]) => n));
  const from = Math.max(0, Math.min(firstActive < 0 ? 0 : firstActive, vm.calendar.length - 16));
  return { from, weeks: vm.calendar.slice(from) };
}

function monthTicks(weeks) {
  const ticks = [];
  weeks.forEach((w, i) => {
    const m = +w[0][0].slice(5, 7) - 1;
    if (!ticks.length || ticks.at(-1).m !== m) ticks.push({ i, m });
  });
  return ticks.filter((t, k) => ((ticks[k + 1]?.i ?? weeks.length) - t.i) >= 2);
}

// A soft wave of light that crosses the time axis. Columns carry the delay.
const waveCss = (n) => '.w{animation:wave 11s ease-in-out infinite}@keyframes wave{0%,14%,100%{opacity:1}7%{opacity:.5}}'
  + Array.from({ length: n }, (_, i) => `.w${i}{animation-delay:${(i * 0.05).toFixed(2)}s}`).join('');

export function pulse(vm, { theme = 'dark', narrow = false, now = Date.now() } = {}) {
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 32;
  const { weeks } = timeline(vm);
  const p = pen(c);
  const T = vm.totals;
  const digits = fmt(T.commits);
  const heroSize = narrow ? 68 : 88;
  const heroW = digits.length * heroSize * 0.56;

  const when = T.last ? ago(T.last.at, now) : '';
  const where = T.last?.repo ? `in ${T.last.repo}` : 'in a private repo';
  const line = T.last ? `Latest ${when === 'just now' ? 'one just now' : when}, ${where}.` : '';
  const dot = (x, y) => p.raw(`<circle class="live" cx="${x}" cy="${y}" r="4" fill="${c.accent}"/>`);

  let y;
  p.t(pad - 3, narrow ? 72 : 92, digits, { font: 'SansBold', size: heroSize, fill: c.ink, extra: 'letter-spacing="-2"' });
  if (narrow) {
    p.t(pad, 106, 'commits, private work included.', { font: 'Newsreader', size: 22, fill: c.ink });
    dot(pad + 4, 127);
    p.t(pad + 16, 132, line, { size: 15 });
    y = 170;
  } else {
    const x = pad + heroW + 18;
    p.t(x, 60, 'commits, private work included.', { font: 'Newsreader', size: 28, fill: c.ink });
    dot(x + 4, 83);
    p.t(x + 16, 88, line, { size: 16 });
    y = 150;
  }

  const stats = [
    [fmt(T.contributions), 'contributions in 12 months'],
    [`${T.streak.current} ${T.streak.current === 1 ? 'day' : 'days'}`, T.streak.longest > T.streak.current ? `streak, best ${T.streak.longest}` : 'current streak, the longest yet'],
    [fmt(T.activeDays), 'days with a commit'],
    [fmt(T.busiest.count), `contributions on ${T.busiest.date ? dayLabel(T.busiest.date) : '-'}, the peak`],
  ];
  const tile = (W - pad * 2) / (narrow ? 2 : 4);
  stats.forEach(([v, l], i) => {
    const col = narrow ? i % 2 : i;
    const row = narrow ? Math.floor(i / 2) : 0;
    const tx = pad + col * tile;
    const ty = y + row * 62;
    p.t(tx, ty, v, { font: 'SansBold', size: narrow ? 24 : 28, fill: c.ink });
    const parts = narrow && l.length > 24 ? [l.slice(0, l.lastIndexOf(' ', 24)), l.slice(l.lastIndexOf(' ', 24) + 1)] : [l];
    parts.forEach((s, k) => p.t(tx, ty + 19 + k * 15, s, { size: narrow ? 14 : 13 }));
  });
  y += narrow ? 124 + 12 : 62;

  // The calendar. Same weeks and the same x-grid as the projects plate below it.
  const x0 = narrow ? 44 : 190;
  const cell = (W - pad - x0) / weeks.length;
  const gap = cell > 14 ? 3 : 2;
  const { q, level } = levels(weeks.flat().map(([, n]) => n));
  const top = y + 18;

  monthTicks(weeks).forEach(({ i, m }) => p.t(x0 + i * cell, y + 4, MONTHS[m], { size: 12, fill: c.muted }));
  ['Mon', 'Wed', 'Fri'].forEach((d, k) => p.t(x0 - 8, top + (2 * k + 1) * cell + cell - gap - 3, d, { size: 11, fill: c.muted, anchor: 'end' }));
  const today = weeks.at(-1).at(-1)[0];
  weeks.forEach((w, i) => {
    const offset = new Date(`${w[0][0]}T00:00:00Z`).getUTCDay();
    w.forEach(([date, n], j) => {
      const lv = level(n);
      const isToday = date === today;
      p.r(x0 + i * cell, top + (offset + j) * cell, cell - gap, cell - gap, lv < 0 ? c.empty : c.ramp[lv], cell > 14 ? 3 : 2, `class="w w${i}${isToday ? ' now' : ''}"`);
    });
  });
  const bottom = top + 7 * cell;

  // Legend carries real thresholds rather than "less / more".
  const labels = [`${fmt(1)}${q[0] > 1 ? `-${q[0]}` : ''}`, `${q[0] + 1 === q[1] ? q[1] : `${q[0] + 1}-${q[1]}`}`, `${q[1] + 1 === q[2] ? q[2] : `${q[1] + 1}-${q[2]}`}`, `${q[2] + 1}+`];
  const legendY = narrow ? bottom + 16 : top + 58;
  const lx = narrow ? x0 : pad;
  const swatch = narrow ? 58 : 29;
  if (!narrow) {
    p.t(pad, top + 10, 'Contributions a day', { size: 13, fill: c.ink });
    p.t(pad, top + 28, 'as counted by GitHub,', { size: 12, fill: c.muted });
    p.t(pad, top + 43, 'private days included', { size: 12, fill: c.muted });
  }
  c.ramp.forEach((color, i) => {
    p.r(lx + i * swatch, legendY, swatch - 3, 10, color, 2);
    p.t(lx + i * swatch, legendY + 24, labels[i], { size: 11, fill: c.muted, extra: 'class="n"' });
  });

  const ist = (ms) => new Date(ms + IST).toISOString();
  const stamp = vm.source === 'snapshot'
    ? `Snapshot from ${dayLabel(ist(Date.parse(vm.generatedAt)))}`
    : `Live from GitHub, ${dayLabel(ist(now))} ${ist(now).slice(11, 16)} IST`;
  const H = bottom + (narrow ? 70 : 34);
  p.t(W - pad, H - 12, stamp, { size: 11, fill: c.muted, anchor: 'end' });

  return canvas({
    theme, W, H,
    title: `${digits} commits. ${line} ${fmt(T.contributions)} contributions in the last 12 months, current streak ${T.streak.current} days.`,
    fonts: ['Newsreader', 'Sans', 'SansBold'],
    css: `${waveCss(weeks.length)}.live,.now{transform-box:fill-box;transform-origin:center;animation:live 2.4s ease-in-out infinite!important}@keyframes live{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.72)}}`,
  }, p.done());
}

export function projects(vm, { theme = 'dark', narrow = false } = {}) {
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 32;
  const { from, weeks } = timeline(vm);
  const p = pen(c);
  const x0 = narrow ? 138 : 190;
  const cell = (W - pad - x0) / weeks.length;
  const bySlug = new Map(vm.projects.map((r) => [r.slug, r]));
  const flagship = FLAGSHIPS.map((s) => bySlug.get(s)).filter(Boolean);
  const others = vm.projects.filter((r) => !FLAGSHIPS.includes(r.slug) && r.slug !== 'SHAILESH-RS-UPADHYAY');
  const shown = others.slice(0, narrow ? 3 : 5);
  const rest = others.slice(shown.length).concat(bySlug.get('SHAILESH-RS-UPADHYAY') ?? []);
  const sumWeekly = (rows) => rows.reduce((a, r) => a.map((n, i) => n + r.weekly[i]), Array(vm.hidden.weekly.length).fill(0));

  const rows = [
    ...flagship.map((r) => ({ name: r.name, commits: r.commits, weekly: r.weekly, color: c.accent, slug: r.slug })),
    ...shown.map((r) => ({ name: r.name, commits: r.commits, weekly: r.weekly, color: c.neutral })),
    { name: `${rest.length} more public`, commits: rest.reduce((a, r) => a + r.commits, 0), weekly: sumWeekly(rest), color: c.neutral },
    { name: `${vm.hidden.projects} private`, commits: vm.hidden.commits, weekly: vm.hidden.weekly, color: c.neutral },
  ];
  const rowH = 30;
  const barH = rowH - 7;

  const start = weeks[0][0][0];
  const since = `${MONTHS[+start.slice(5, 7) - 1]} ${start.slice(0, 4)}`;
  p.t(pad, 44, 'Where the commits went.', { font: 'Newsreader', size: narrow ? 24 : 28, fill: c.ink });
  p.t(pad, 68, narrow ? `Commits a week since ${since}. Flagships in colour.` : `Commits a week since ${since}. Each row is scaled to its own busiest week, flagships in colour.`, { size: 14 });
  const axisY = 96;
  monthTicks(weeks).forEach(({ i, m }) => p.t(x0 + i * cell, axisY, MONTHS[m], { size: 12, fill: c.muted }));

  const symbols = FLAGSHIPS.map((s) => {
    const body = logo(LOGO_OF[s]).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[^<]*<\/title>/, '');
    return `<symbol id="m-${s}" viewBox="0 0 64 64">${body}</symbol>`;
  }).join('');
  p.raw(`<defs>${symbols}</defs>`);

  let y = axisY + 10;
  rows.forEach((r) => {
    const textX = r.slug && !narrow ? pad + 24 : pad;
    if (r.slug && !narrow) p.raw(`<use href="#m-${r.slug}" x="${pad}" y="${f1(y + 3)}" width="17" height="17"/>`);
    p.t(textX, y + rowH - 11, r.name, { size: 14, fill: r.slug ? c.ink : c.sub });
    p.t(x0 - 12, y + rowH - 11, fmt(r.commits), { size: 13, fill: r.slug ? c.ink : c.sub, anchor: 'end', extra: 'class="n"' });
    const base = y + rowH - 3;
    p.r(x0, base, W - pad - x0, 1, c.line);
    // Own scale per row: the question here is when each project was alive. The total on the left says how much.
    const visible = r.weekly.slice(from);
    const peak = Math.max(1, ...visible);
    visible.forEach((n, i) => {
      if (!n) return;
      const h = Math.max(2, (n / peak) * barH);
      p.r(x0 + i * cell + 0.5, base - h, Math.max(1.5, cell - 2), h, r.color, Math.min(2, cell / 4), `class="w w${i}"`);
    });
    y += rowH;
  });
  const H = y + 34;
  p.t(pad, y + 22, `${fmt(vm.totals.commits)} commits across ${vm.totals.repos} repositories`, { size: 12, fill: c.muted });

  return canvas({ theme, W, H, title: `Commits per week by project. ${rows.map((r) => `${r.name} ${r.commits}`).join(', ')}.`, fonts: ['Newsreader', 'Sans'], css: waveCss(weeks.length) }, p.done());
}

// Shortest run of hours, wrapping past midnight, that holds at least half of the commits.
export function busiestWindow(byHour) {
  const total = byHour.reduce((a, b) => a + b, 0);
  let best = { start: 0, len: 24, sum: total };
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let len = 1; len <= 24; len++) {
      sum += byHour[(start + len - 1) % 24];
      if (sum * 2 >= total) {
        if (len < best.len || (len === best.len && sum > best.sum)) best = { start, len, sum };
        break;
      }
    }
  }
  return { ...best, share: total ? best.sum / total : 0 };
}

const hourName = (h) => { const x = (h + 24) % 24; return x === 0 ? '12 am' : x === 12 ? '12 pm' : x < 12 ? `${x} am` : `${x - 12} pm`; };

export function rhythm(vm, { theme = 'dark', narrow = false } = {}) {
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 32;
  const p = pen(c);
  const byHour = Array(24).fill(0);
  const byDay = vm.punch.map((row) => row.reduce((a, b) => a + b, 0));
  vm.punch.forEach((row) => row.forEach((n, h) => { byHour[h] += n; }));
  const total = byHour.reduce((a, b) => a + b, 0) || 1;
  const win = busiestWindow(byHour);
  const weekend = (byDay[5] + byDay[6]) / total;

  const headline = `${Math.round(win.share * 100)}% of my commits land between ${hourName(win.start)} and ${hourName(win.start + win.len)}.`;
  if (narrow) {
    const cut = headline.lastIndexOf(' ', 26);
    p.t(pad, 40, headline.slice(0, cut), { font: 'Newsreader', size: 23, fill: c.ink });
    p.t(pad, 68, headline.slice(cut + 1), { font: 'Newsreader', size: 23, fill: c.ink });
    p.t(pad, 94, `Every commit by weekday and hour, IST. ${Math.round(weekend * 100)}% on a weekend.`, { size: 13 });
  } else {
    p.t(pad, 44, headline, { font: 'Newsreader', size: 28, fill: c.ink });
    p.t(pad, 68, 'Every commit by weekday and hour, India time. The day starts at 6 am so the night stays in one piece.', { size: 14 });
  }

  const SHIFT = 6; // Column 0 is 6 am.
  const x0 = narrow ? 48 : 70;
  const side = narrow ? 0 : 142;
  const cw = (W - pad - x0 - side) / 24;
  const margTop = narrow ? 112 : 92;
  const margH = narrow ? 36 : 54;
  const top = margTop + margH + 8;
  const ch = narrow ? cw + 3 : cw;
  const { level, q } = levels(vm.punch.flat());

  // Hours along the top, weekdays down the side, the grid in between: three views of one table.
  const peakHour = Math.max(1, ...byHour);
  for (let col = 0; col < 24; col++) {
    const h = (col + SHIFT) % 24;
    const inside = ((h - win.start + 24) % 24) < win.len;
    const bh = Math.max(byHour[h] ? 2 : 0, (byHour[h] / peakHour) * margH);
    if (bh) p.r(x0 + col * cw + 1, margTop + margH - bh, cw - 3, bh, inside ? c.accent : c.neutral, Math.min(3, cw / 4));
  }
  const peakAt = byHour.indexOf(peakHour);
  const peakCol = (peakAt - SHIFT + 24) % 24;
  p.t(x0 + peakCol * cw + (cw - 2) / 2, margTop - 5, fmt(peakHour), { size: 12, fill: c.ink, anchor: 'middle', extra: 'class="n"' });

  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, row) => {
    const y = top + row * ch;
    p.t(x0 - 10, y + ch / 2 + 4, d, { size: narrow ? 11 : 12, fill: row > 4 ? c.ink : c.muted, anchor: 'end' });
    for (let col = 0; col < 24; col++) {
      const n = vm.punch[row][(col + SHIFT) % 24];
      const lv = level(n);
      p.r(x0 + col * cw, y, cw - 2, ch - 2, lv < 0 ? c.empty : c.ramp[lv], 2);
    }
  });
  const gridBottom = top + 7 * ch;
  for (const col of [0, 6, 12, 18]) p.t(x0 + col * cw, gridBottom + 16, hourName(col + SHIFT), { size: 11, fill: c.muted });

  if (!narrow) {
    const peakDay = Math.max(1, ...byDay);
    const bx = x0 + 24 * cw + 14;
    const maxW = W - pad - bx - 34;
    byDay.forEach((n, row) => {
      const y = top + row * ch;
      const bw = Math.max(n ? 2 : 0, (n / peakDay) * maxW);
      p.r(bx, y + 4, bw, ch - 10, row > 4 ? c.accent : c.neutral, 3);
      p.t(bx + bw + 6, y + ch / 2 + 4, fmt(n), { size: 12, anchor: 'start', fill: c.sub, extra: 'class="n"' });
    });
    p.t(bx, top - 12, `${Math.round(weekend * 100)}% on a weekend`, { size: 13, fill: c.ink });
  }
  // The colour scale, right-aligned under the grid.
  const sw = narrow ? 34 : 30;
  const lx = narrow ? x0 + 24 * cw - 2 - sw * 4 : x0 + 24 * cw + 14;
  const legendLabels = [q[0] > 1 ? `1-${q[0]}` : '1', q[0] + 1 === q[1] ? `${q[1]}` : `${q[0] + 1}-${q[1]}`, q[1] + 1 === q[2] ? `${q[2]}` : `${q[1] + 1}-${q[2]}`, `${q[2] + 1}+`];
  const legendTop = gridBottom + (narrow ? 26 : 6);
  c.ramp.forEach((color, i) => {
    p.r(lx + i * sw, legendTop, sw - 3, 8, color, 2);
    p.t(lx + i * sw, legendTop + 21, legendLabels[i], { size: 11, fill: c.muted, extra: 'class="n"' });
  });
  const H = legendTop + 36;
  return canvas({ theme, W, H, title: `${headline} ${Math.round(weekend * 100)}% of commits fall on a weekend.`, fonts: ['Newsreader', 'Sans'] }, p.done());
}

export function stack(vm, { theme = 'dark', narrow = false } = {}) {
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 32;
  const p = pen(c);
  const [a, b] = vm.languages;
  const pc = (s) => `${(s * 100).toFixed(1)}%`;
  const head = a ? `${pc(a.share)} ${a.name}${b ? `, then ${b.name}.` : '.'}` : '';
  p.t(pad, 44, head, { font: 'Newsreader', size: narrow ? 24 : 28, fill: c.ink });
  p.t(pad, 68, narrow ? 'Bytes across every repository.' : 'Bytes of code across every repository, private ones included.', { size: 14 });

  // Languages as ranked bars on one baseline: the way to compare parts exactly.
  const lw = narrow ? W - pad * 2 : 372;
  const labelW = 92;
  const maxW = lw - labelW - 52;
  const peak = Math.max(...vm.languages.map((l) => l.share), 0.01);
  let y = 92;
  vm.languages.forEach((l, i) => {
    p.t(pad, y + 15, l.name, { size: 14, fill: i < 2 ? c.ink : c.sub });
    const bw = Math.max(2, (l.share / peak) * maxW);
    p.r(pad + labelW, y + 3, bw, 16, i === 0 ? c.accent : c.neutral, 3);
    p.t(pad + labelW + bw + 7, y + 15, pc(l.share), { size: 13, fill: c.sub, extra: 'class="n"' });
    y += 27;
  });
  const leftBottom = y;

  // What my own tool sees in the four flagships. Measured from the source, not typed in.
  const tx = narrow ? pad : 452;
  let ty = narrow ? leftBottom + 26 : 54;
  p.t(tx, ty - (narrow ? 0 : 10), 'Inside the flagships', { font: 'SansBold', size: 15, fill: c.ink });
  p.t(tx, ty + (narrow ? 18 : 8), `Read by Blueprint.sh's own parser, ${dayLabel(XRAY.measured)}.`, { size: 12, fill: c.muted });
  ty += narrow ? 44 : 38;
  const cols = narrow ? [tx + 164, tx + 240, tx + 318, tx + 408] : [tx + 180, tx + 256, tx + 322, tx + 396];
  ['lines', 'modules', 'imports', 'cycles'].forEach((h, i) => p.t(cols[i], ty, h, { size: 12, fill: c.muted, anchor: 'end' }));
  ty += 8;
  p.r(tx, ty, (narrow ? W - pad - tx : W - pad - tx), 1, c.line);
  const symbols = Object.keys(XRAY.projects).map((s) => {
    const body = logo(LOGO_OF[s]).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[^<]*<\/title>/, '');
    return `<symbol id="x-${s}" viewBox="0 0 64 64">${body}</symbol>`;
  }).join('');
  p.raw(`<defs>${symbols}</defs>`);
  for (const [slug, m] of Object.entries(XRAY.projects)) {
    ty += 30;
    p.raw(`<use href="#x-${slug}" x="${tx}" y="${f1(ty - 15)}" width="18" height="18"/>`);
    p.t(tx + 25, ty, m.name, { size: 14, fill: c.ink });
    [m.lines, m.modules, m.imports, m.cycles].forEach((v, i) => p.t(cols[i], ty, fmt(v), { size: 14, fill: i === 3 && v === 0 ? c.muted : c.ink, anchor: 'end', extra: 'class="n"' }));
  }
  const H = Math.max(leftBottom, ty) + 26;
  return canvas({ theme, W, H, title: `${head} Blueprint.sh reads ${Object.values(XRAY.projects).map((m) => `${m.name} as ${m.modules} modules`).join(', ')}.`, fonts: ['Newsreader', 'Sans', 'SansBold'] }, p.done());
}

// A project's own activity, for the top of its README. Only named repos exist in the data, so a hidden one is a 404.
export function repo(vm, { theme = 'dark', narrow = false, slug } = {}) {
  const r = vm.projects.find((x) => x.slug === slug);
  if (!r) return null;
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const pad = narrow ? 16 : 24;
  const p = pen(c);
  const { from, weeks } = timeline(vm);
  const firstWeek = r.weekly.findIndex(Boolean);
  const start = Math.max(from, Math.min(firstWeek < 0 ? from : firstWeek, r.weekly.length - 8));
  const visible = r.weekly.slice(start);
  const shownWeeks = vm.calendar.slice(start);

  const numW = narrow ? 118 : 168;
  p.t(pad - 1, narrow ? 50 : 58, fmt(r.commits), { font: 'SansBold', size: narrow ? 40 : 52, fill: c.ink, extra: 'letter-spacing="-1"' });
  p.t(pad, narrow ? 68 : 80, r.commits === 1 ? 'commit' : 'commits', { size: 13 });
  p.t(pad, narrow ? 84 : 96, r.first === r.last ? dayLabel(r.first) : `${dayLabel(r.first)} to ${dayLabel(r.last)}`, { size: 12, fill: c.muted });

  const x0 = pad + numW;
  const cell = (W - pad - x0) / visible.length;
  const peak = Math.max(1, ...visible);
  const barTop = 20;
  const barH = narrow ? 58 : 66;
  const base = barTop + barH;
  p.r(x0, base, W - pad - x0, 1, c.line);
  visible.forEach((n, i) => {
    if (!n) return;
    const h = Math.max(2, (n / peak) * barH);
    p.r(x0 + i * cell + 0.5, base - h, Math.max(2, cell - 2), h, c.accent, Math.min(3, cell / 4), `class="w w${i}"`);
  });
  monthTicks(shownWeeks).forEach(({ i, m }) => p.t(x0 + i * cell, base + 15, MONTHS[m], { size: 11, fill: c.muted }));
  p.t(W - pad, barTop - 6, `busiest week: ${fmt(peak)}`, { size: 11, fill: c.muted, anchor: 'end' });

  const langY = base + 34;
  let lx = pad;
  const langs = r.languages ?? [];
  const barW = W - pad * 2;
  const shades = [1, 0.7, 0.45, 0.28];
  langs.forEach((l, i) => {
    const w = Math.max(2, l.share * barW);
    p.r(lx, langY, Math.max(1, w - 2), 8, c.accent, 3, `opacity="${shades[i]}"`);
    lx += w;
  });
  let tx = pad;
  langs.forEach((l, i) => {
    const label = `${l.name} ${(l.share * 100).toFixed(l.share < 0.1 ? 1 : 0)}%`;
    p.r(tx, langY + 18, 9, 9, c.accent, 2, `opacity="${shades[i]}"`);
    p.t(tx + 14, langY + 27, label, { size: 12 });
    tx += 14 + label.length * 6.3 + 16;
  });
  const H = langY + 40;
  return canvas({ theme, W, H, title: `${r.name}: ${fmt(r.commits)} commits, ${langs.map((l) => `${l.name} ${Math.round(l.share * 100)}%`).join(', ')}.`, fonts: ['Sans', 'SansBold'], css: waveCss(visible.length) }, p.done());
}

export const PLATES = { pulse, projects, rhythm, stack };
