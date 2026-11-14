// node stats/publish.mjs <dir>. Draws every chart from the live numbers into <dir>, for the Charts workflow to publish.
// The README shows those files, so a visit is served by GitHub and never waits on a render. Numbers that aren't
// live draw nothing, and the last good charts stay up.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PLATES } from './plates.mjs';

const out = process.argv[2] ?? 'charts';
// A new URL every run, so the CDN can't hand back an old copy.
const res = await fetch(`https://shailesh-stats.vercel.app/api/data?at=${Date.now()}`, { signal: AbortSignal.timeout(60e3) });
if (!res.ok) throw new Error(`/api/data answered ${res.status}`);
const vm = await res.json();
if (vm.source !== 'live') throw new Error(`/api/data served a ${vm.source}, so the last charts stay up`);

mkdirSync(out, { recursive: true });
for (const [name, draw] of Object.entries(PLATES)) {
  for (const theme of ['dark', 'light']) {
    for (const narrow of [false, true]) writeFileSync(`${out}/${name}-${theme}${narrow ? '-m' : ''}.svg`, draw(vm, { theme, narrow }));
  }
}
console.log(`${vm.totals.commits} commits, numbers from ${vm.generatedAt}`);
