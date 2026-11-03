// Saves a scrubbed snapshot for the live endpoint to fall back on. Run with GITHUB_TOKEN set.
import { writeFileSync } from 'node:fs';
import { fetchAccount, summarize } from './data.mjs';

const vm = summarize(await fetchAccount(process.env.GITHUB_TOKEN));
writeFileSync(new URL('./snapshot.json', import.meta.url), `${JSON.stringify(vm)}\n`);
console.log(`${vm.totals.commits} commits, ${vm.totals.contributions} contributions, streak ${vm.totals.streak.current}/${vm.totals.streak.longest}`);
