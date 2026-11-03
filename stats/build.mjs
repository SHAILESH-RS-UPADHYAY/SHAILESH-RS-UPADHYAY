// Fetches the account, keeps a scrubbed snapshot for the live endpoint to fall back on, and renders the plates
// to assets/live so they can be previewed and used before the endpoint exists. Run with GITHUB_TOKEN set.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fetchAccount, summarize } from './data.mjs';
import { PLATES } from './plates.mjs';

const snapshotUrl = new URL('./snapshot.json', import.meta.url);
const token = process.env.GITHUB_TOKEN;
const vm = token ? summarize(await fetchAccount(token)) : { ...JSON.parse(readFileSync(snapshotUrl)), source: 'snapshot' };
if (token) writeFileSync(snapshotUrl, `${JSON.stringify(vm)}\n`);

const out = new URL('../assets/live/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, plate] of Object.entries(PLATES)) {
  for (const theme of ['dark', 'light']) {
    for (const narrow of [false, true]) {
      const svg = plate({ ...vm, source: 'snapshot' }, { theme, narrow });
      writeFileSync(new URL(`${name}-${theme}${narrow ? '-m' : ''}.svg`, out), svg);
    }
  }
}
console.log(`${vm.totals.commits} commits, ${vm.totals.contributions} contributions, streak ${vm.totals.streak.current}/${vm.totals.streak.longest}`);
