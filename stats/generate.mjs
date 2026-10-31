// Draws assets/stats-{dark,light}.svg from the GitHub API: the contribution year as a heatmap
// that lights up in a wave, streaks, and the language mix. No dependencies; run with
// GITHUB_TOKEN set (the daily workflow passes its own).
import { readFileSync, writeFileSync } from 'node:fs';

const LOGIN = 'SHAILESH-RS-UPADHYAY';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('Set GITHUB_TOKEN');

const query = `query($login: String!) { user(login: $login) {
  contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
  repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
    nodes { languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } } }
} }`;
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { authorization: `bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const cal = data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const days = weeks.flat();

// Streaks: a day with no contributions yet today does not break the current streak.
let longest = 0;
let run = 0;
for (const d of days) {
  run = d.contributionCount ? run + 1 : 0;
  longest = Math.max(longest, run);
}
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount) current++;
  else if (i < days.length - 1) break;
}

// Heat levels by quartile of the active days, as GitHub's own calendar does.
const active = days.map((d) => d.contributionCount).filter(Boolean).sort((a, b) => a - b);
const q = [0.25, 0.5, 0.75].map((p) => active[Math.floor(p * (active.length - 1))] ?? 1);
const level = (n) => (n === 0 ? 0 : n <= q[0] ? 1 : n <= q[1] ? 2 : n <= q[2] ? 3 : 4);

const bytes = new Map();
for (const repo of data.user.repositories.nodes) {
  for (const { size, node } of repo.languages.edges) bytes.set(node.name, (bytes.get(node.name) ?? 0) + size);
}
const sum = [...bytes.values()].reduce((a, b) => a + b, 0);
const ranked = [...bytes].sort((a, b) => b[1] - a[1]);
const langs = ranked.slice(0, 4).map(([name, size]) => ({ name, share: size / sum }));
const rest = 1 - langs.reduce((a, l) => a + l.share, 0);
if (rest > 0.005) langs.push({ name: 'Other', share: rest });

const fonts = JSON.parse(readFileSync(new URL('./fonts.json', import.meta.url)));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = (n) => n.toLocaleString('en-US');
const pct = (s) => `${Math.max(1, Math.round(s * 100))}%`;

const PALETTES = {
  dark: { bg: '#0f1318', rim: '#262c34', ink: '#ece8df', sub: '#98a2ad', muted: '#6b7580',
    ramp: ['#1a1f26', '#4a3a1c', '#8a6420', '#c98d22', '#f2b13a'], langs: ['#f2b13a', '#9cbbe6', '#e0627a', '#8fc7a0', '#59626c'] },
  light: { bg: '#fbfaf6', rim: '#e4e0d6', ink: '#1f2328', sub: '#59636e', muted: '#8a929b',
    ramp: ['#ece9e2', '#f3d9a4', '#e6b45a', '#c98a12', '#9a6200'], langs: ['#c98a12', '#2f5f9e', '#a3243b', '#3f7d55', '#a7aeb6'] },
};

function draw(mode) {
  const c = PALETTES[mode];
  const T = 9;
  const step = 9.6;
  const x0 = 338;
  const y0 = 48;
  const css = [
    ...Object.entries(fonts).map(([name, b64]) => `@font-face{font-family:${name};src:url(data:font/woff;base64,${b64}) format('woff')}`),
    `.c{transform-box:fill-box;transform-origin:center;animation:cell ${T}s cubic-bezier(.2,.7,.2,1) infinite}`,
    '@keyframes cell{0%{opacity:0;transform:scale(.3)}12%{opacity:1;transform:scale(1)}88%{opacity:1;transform:scale(1)}96%,100%{opacity:0;transform:scale(.6)}}',
    ...weeks.map((_, i) => `.w${i}{animation-delay:${(i * 0.024).toFixed(3)}s}`),
    '.rise{animation:rise 1s cubic-bezier(.2,.7,.2,1) both}@keyframes rise{from{opacity:0;transform:translateY(10px)}}',
    ...langs.map((_, i) => `.l${i}{transform-box:fill-box;transform-origin:left center;animation:grow ${T}s cubic-bezier(.3,.7,.2,1) ${(0.5 + i * 0.12).toFixed(2)}s infinite}`),
    '@keyframes grow{0%{transform:scaleX(0)}14%,90%{transform:scaleX(1)}100%{transform:scaleX(1)}}',
  ];

  const out = [];
  const text = (font, x, y, s, size, fill, extra = '') => out.push(`<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`);
  out.push(`<rect x="0.5" y="0.5" width="879" height="299" rx="14" fill="${c.bg}" stroke="${c.rim}"/>`);

  text('Atkinson400', 32, 52, 'Last 12 months', 13, c.sub);
  text('Newsreader600', 30, 114, fmt(cal.totalContributions), 64, c.ink, 'class="rise" letter-spacing="-1"');
  text('Atkinson400', 32, 140, 'contributions', 17, c.sub);
  text('Atkinson400', 32, 178, 'Longest streak', 12, c.muted);
  text('Martian400', 32, 200, `${longest} ${longest === 1 ? 'day' : 'days'}`, 15, c.ink);
  text('Atkinson400', 170, 178, 'Current streak', 12, c.muted);
  text('Martian400', 170, 200, `${current} ${current === 1 ? 'day' : 'days'}`, 15, c.ink);

  // Month labels where a month starts.
  // A label needs three columns of room, so a partial first month is skipped.
  const starts = [];
  weeks.forEach((w, i) => {
    const m = new Date(`${w[0].date}T00:00:00Z`).getUTCMonth();
    if (!starts.length || starts.at(-1).m !== m) starts.push({ i, m });
  });
  starts.forEach(({ i, m }, k) => {
    const room = (starts[k + 1]?.i ?? weeks.length) - i;
    if (room >= 3) text('Atkinson400', (x0 + i * step).toFixed(1), y0 - 8, new Date(Date.UTC(2000, m, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), 10, c.muted);
  });
  weeks.forEach((w, i) => {
    const offset = new Date(`${w[0].date}T00:00:00Z`).getUTCDay();
    w.forEach((d, j) => {
      out.push(`<rect class="c w${i}" x="${(x0 + i * step).toFixed(1)}" y="${(y0 + (offset + j) * step).toFixed(1)}" width="7.6" height="7.6" rx="1.8" fill="${c.ramp[level(d.contributionCount)]}"><title>${d.contributionCount} on ${d.date}</title></rect>`);
    });
  });
  // Weekly rhythm under the calendar, one point per column.
  const totals = weeks.map((w) => w.reduce((a, d) => a + d.contributionCount, 0));
  const peak = Math.max(1, ...totals);
  const pts = totals.map((t, i) => [x0 + i * step + 3.8, 212 - (t / peak) * 50]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');
  const length = Math.ceil(pts.slice(1).reduce((a, [px, py], i) => a + Math.hypot(px - pts[i][0], py - pts[i][1]), 0));
  css.push(`.rhythm{stroke-dasharray:${length};animation:trace ${T}s cubic-bezier(.4,.1,.2,1) .6s infinite}`
    + `@keyframes trace{0%{stroke-dashoffset:${length}}22%,90%{stroke-dashoffset:0;opacity:1}98%,100%{stroke-dashoffset:0;opacity:0}}`
    + `.fill{animation:fill ${T}s ease-out .6s infinite}@keyframes fill{0%,12%{opacity:0}26%,90%{opacity:1}98%,100%{opacity:0}}`);
  out.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.ramp[4]}" stop-opacity=".28"/><stop offset="1" stop-color="${c.ramp[4]}" stop-opacity="0"/></linearGradient></defs>`);
  out.push(`<path class="fill" d="${line}L${pts.at(-1)[0].toFixed(1)} 212L${pts[0][0].toFixed(1)} 212Z" fill="url(#g)"/>`);
  out.push(`<path class="rhythm" d="${line}" fill="none" stroke="${c.ramp[4]}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`);
  text('Atkinson400', x0, 156, 'Weekly rhythm', 10, c.muted);

  text('Atkinson400', 732, 134, 'Less', 10, c.muted, 'text-anchor="end"');
  c.ramp.forEach((color, i) => out.push(`<rect x="${738 + i * 12}" y="125.5" width="9" height="9" rx="2" fill="${color}"/>`));
  text('Atkinson400', 802, 134, 'More', 10, c.muted);

  // Language mix as one segmented bar, then a legend.
  let x = 32;
  const width = 816;
  langs.forEach((l, i) => {
    const w = Math.max(3, l.share * width);
    out.push(`<rect class="l${i}" x="${x.toFixed(1)}" y="232" width="${(w - (i < langs.length - 1 ? 2 : 0)).toFixed(1)}" height="10" rx="3" fill="${c.langs[i]}"/>`);
    x += w;
  });
  let lx = 32;
  langs.forEach((l, i) => {
    out.push(`<rect x="${lx}" y="257" width="9" height="9" rx="2" fill="${c.langs[i]}"/>`);
    text('Atkinson400', lx + 15, 265.5, `${l.name} ${pct(l.share)}`, 12, c.sub);
    lx += 15 + `${l.name} ${pct(l.share)}`.length * 6.7 + 26;
  });
  const updated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  text('Atkinson400', 848, 265.5, `Updated ${updated}`, 10, c.muted, 'text-anchor="end"');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 300" width="880" height="300" role="img" aria-labelledby="t">`
    + `<title id="t">${fmt(cal.totalContributions)} contributions in the last 12 months. Longest streak ${longest} days, current streak ${current} days. ${langs.map((l) => `${l.name} ${pct(l.share)}`).join(', ')}.</title>`
    + `<style>${css.join('')}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>${out.join('')}</svg>`;
}

for (const mode of ['dark', 'light']) {
  writeFileSync(new URL(`../assets/stats-${mode}.svg`, import.meta.url), draw(mode));
}
console.log(`stats: ${cal.totalContributions} contributions, streaks ${longest}/${current}, ${langs.map((l) => `${l.name} ${pct(l.share)}`).join(', ')}`);
