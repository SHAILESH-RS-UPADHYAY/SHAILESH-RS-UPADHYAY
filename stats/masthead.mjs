// Draws assets/header-*.svg: name, bio and portrait, with one orbit per flagship project.
// The portrait is lifted from stats/portrait.txt so it only has to live in one place.
import { readFileSync, writeFileSync } from 'node:fs';

const FONTS = JSON.parse(readFileSync(new URL('./fonts.json', import.meta.url)));
const PORTRAIT = readFileSync(new URL('./portrait.txt', import.meta.url), 'utf8').trim();
const faces = ['Newsreader', 'Sans'].map((n) => `@font-face{font-family:${n};src:url(data:font/woff;base64,${FONTS[n]}) format('woff')}`).join('');

const THEMES = {
  dark: { ink: '#F0ECE4', sub: '#9AA4AE', line: '#30363D', disc: ['#26303D', '#121821'], k: '#F5F0E6', b: '#9B6BFF',
    orbits: ['#00FF41', '#9B6BFF', '#EA580C', '#5AA9F0'] },
  light: { ink: '#1F2328', sub: '#59636E', line: '#D0D7DE', disc: ['#E9EEF4', '#D5DDE6'], k: '#1E293B', b: '#6D28D9',
    orbits: ['#0FA33A', '#6D28D9', '#EA580C', '#0F3D6E'] },
};
const FLAGSHIPS = [['radar', 'RADAR'], ['eves', 'EVES'], ['vettly', 'Vettly'], ['blueprint', 'Blueprint.sh']];
const BIO = ['CS grad (AI/ML) who builds reliable backends,', 'automates the repetitive stuff, and geeks out', 'over AI research.'];

function mark(slug, x, y, size, c) {
  const s = readFileSync(new URL(`../assets/logos/${slug}.svg`, import.meta.url), 'utf8').trim()
    .replace(/<title>[^<]*<\/title>/, '').replace(/<style>.*?<\/style>/, '')
    .replaceAll('class="k"', `fill="${c.k}"`).replaceAll('class="b"', `fill="${c.b}"`);
  return s.replace(/^<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">`);
}

function draw(theme, narrow) {
  const c = THEMES[theme];
  const W = narrow ? 440 : 880;
  const H = narrow ? 560 : 340;
  const r = narrow ? 104 : 128;
  const cx = narrow ? 220 : 690;
  const cy = narrow ? 136 : 170;
  const out = [];
  // Each arc starts a quarter turn from the last, so the first frame is already balanced.
  const orbit = (i, radius, width, dash) => {
    const whole = 2 * Math.PI * radius;
    out.push(`<circle class="o${i}" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${c.orbits[i]}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="${dash} ${(whole - dash).toFixed(1)}" stroke-dashoffset="${(-(whole / 4) * i).toFixed(1)}"/>`);
  };
  out.push(`<defs><radialGradient id="dg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${c.disc[0]}"/><stop offset="1" stop-color="${c.disc[1]}"/></radialGradient><clipPath id="cl"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#dg)"/>`);
  const size = (r / 128) * 268;
  out.push(`<g clip-path="url(#cl)"><g class="b"><image href="${PORTRAIT}" x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}"/></g></g>`);
  [[r + 8, 2.4, 180], [r + 15, 2.2, 130], [r + 22, 2, 90], [r + 29, 1.6, 56]].forEach(([radius, width, dash], i) => orbit(i, radius, width, dash));

  const left = narrow ? 16 : 3;
  const top = narrow ? 322 : 122;
  out.push(`<text x="${left - 1}" y="${top}" font-family="Newsreader" font-size="${narrow ? 50 : 58}" fill="${c.ink}" letter-spacing="-.6">Shailesh Upadhyay</text>`);
  const size2 = narrow ? 19 : 20;
  BIO.forEach((line, i) => out.push(`<text x="${left}" y="${top + (narrow ? 40 : 46) + i * 28}" font-family="Sans" font-size="${size2}" fill="${c.sub}">${line}</text>`));

  // The four projects this profile is about, in their own marks.
  const rowY = top + (narrow ? 140 : 142);
  out.push(`<line x1="${left}" y1="${rowY - 12}" x2="${narrow ? W - 16 : 500}" y2="${rowY - 12}" stroke="${c.line}"/>`);
  const step = narrow ? 102 : 124;
  FLAGSHIPS.forEach(([slug, name], i) => {
    const x = left + i * step;
    out.push(mark(slug, x, rowY, 26, c));
    out.push(`<text x="${x + 32}" y="${rowY + 18}" font-family="Sans" font-size="${narrow ? 13 : 14}" fill="${c.ink}">${name}</text>`);
  });

  const css = `text{font-kerning:normal}@keyframes spin{to{transform:rotate(360deg)}}@keyframes back{to{transform:rotate(-360deg)}}@keyframes breathe{50%{transform:translateY(-3px)}}`
    + `.b{animation:breathe 6s ease-in-out infinite}.o0,.o1,.o2,.o3{transform-origin:${cx}px ${cy}px}.o0{animation:spin 18s linear infinite}.o1{animation:back 26s linear infinite}.o2{animation:spin 34s linear infinite}.o3{animation:back 44s linear infinite}`
    + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t"><title id="t">Shailesh Upadhyay. ${BIO.join(' ')}</title><style>${faces}${css}</style>${out.join('')}</svg>`;
}

for (const theme of ['dark', 'light']) {
  for (const narrow of [false, true]) writeFileSync(new URL(`../assets/header-${theme}${narrow ? '-m' : ''}.svg`, import.meta.url), draw(theme, narrow));
}
console.log('masthead written');
