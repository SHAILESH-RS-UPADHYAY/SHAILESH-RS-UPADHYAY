// node stats/check.mjs. Fails loudly if a private repo's name could leak or a number could drift.
// When the flagship repos are checked out next door it also re-reads their source, so the plates can't go stale quietly.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { summarize, FEATURED } from './data.mjs';
import { PLATES, busiestWindow } from './plates.mjs';
import { RUNS } from './flagships.mjs';

const NOW = Date.parse('2026-11-04T06:00:00Z');
const day = (i) => new Date(Date.parse('2026-10-18T00:00:00Z') + i * 864e5).toISOString().slice(0, 10);
const calendar = {
  totalContributions: 9,
  weeks: [0, 1, 2].map((w) => ({ contributionDays: Array.from({ length: w === 2 ? 4 : 7 }, (_, d) => ({ date: day(w * 7 + d), contributionCount: w === 2 ? 1 : 0 })) })),
};
const raw = {
  calendar,
  repos: [
    { name: 'secret-client-work', private: true, dates: ['2026-11-03T10:00:00Z', '2026-11-04T05:00:00Z'], languages: [{ name: 'Rust', size: 10 }] },
    { name: FEATURED[0], private: true, dates: ['2026-11-01T10:00:00Z'], languages: [{ name: 'TypeScript', size: 30 }] },
    { name: 'public-thing', private: false, dates: ['2026-11-03T18:40:00Z'], languages: [{ name: 'TypeScript', size: 60 }] },
    { name: 'never-committed', private: true, dates: [], languages: [] },
  ],
};
const vm = summarize(raw, NOW);

// Privacy: the one rule that must never break, in the data and in every rendered plate.
const everything = JSON.stringify(vm) + Object.values(PLATES).flatMap((p) => ['dark', 'light'].flatMap((theme) => [false, true].map((narrow) => p(vm, { theme, narrow, now: NOW })))).join('');
assert(!everything.includes('secret-client-work'), 'a private repo name leaked');
assert(!everything.includes('never-committed'), 'an empty private repo name leaked');
assert(vm.totals.last.repo === null, 'the latest commit was in a hidden repo, so it must stay unnamed');
assert(/in a private repo/.test(PLATES.pulse(vm, { now: NOW })), 'pulse should say "a private repo"');

// Counting.
assert.equal(vm.totals.commits, 4);
assert.equal(vm.hidden.commits, 2);
assert.equal(vm.hidden.projects, 1);
assert.equal(vm.projects.length, 2);
assert.equal(vm.totals.repos, 3, 'a repo with no commits of mine is not counted');

// 18:40 UTC on the 3rd is 00:10 on the 4th in India.
const pub = vm.projects.find((p) => p.slug === 'public-thing');
assert.equal(pub.last, '2026-11-04');
assert.equal(vm.punch[2][0], 1, 'Wednesday 00:00 IST');

// Weekly bars use the calendar's columns.
assert.equal(pub.weekly.length, calendar.weeks.length);
assert.equal(pub.weekly[2], 1);

// Streak: today with nothing yet does not break the run.
assert.equal(vm.totals.streak.current, 4);
const quiet = structuredClone(calendar);
quiet.weeks[2].contributionDays.at(-1).contributionCount = 0;
assert.equal(summarize({ ...raw, calendar: quiet }, NOW).totals.streak.current, 3);

// The busiest window can wrap past midnight.
const hours = Array(24).fill(0);
hours[23] = 5; hours[0] = 5; hours[12] = 1;
assert.deepEqual([busiestWindow(hours).start, busiestWindow(hours).len], [23, 2]);

// Text is escaped on its way into the SVG.
const nasty = summarize({ ...raw, repos: [{ name: '<script>', private: false, dates: ['2026-11-03T10:00:00Z'], languages: [{ name: 'A&B', size: 1 }] }] }, NOW);
const svg = Object.values(PLATES).map((p) => p(nasty, { now: NOW })).join('');
assert(!svg.includes('<script>'), 'markup in a repo name must be escaped');

// Facts on the flagship plates, against the source they came from.
const local = (p) => new URL(`../../${p}`, import.meta.url);
if (existsSync(local('radar/vercel.json'))) {
  const crons = JSON.parse(readFileSync(local('radar/vercel.json'))).crons;
  const hoursOf = (path) => crons.filter((c) => c.path === path).map((c) => { const [m, h] = c.schedule.split(' '); return +h + +m / 60; }).sort((a, b) => a - b);
  assert.deepEqual(hoursOf('/api/cron/embed'), RUNS.embed);
  assert.deepEqual(hoursOf('/api/cron/discover'), RUNS.discover);
  assert.deepEqual(hoursOf('/api/cron'), RUNS.scan);
  assert.deepEqual(hoursOf('/api/cron/autopilot'), RUNS.autopilot);
  assert.equal(crons.length, 37);

  const count = (file, re) => [...readFileSync(local(file), 'utf8').matchAll(re)].length;
  assert.equal(count('radar/src/lib/scraper/adapters.ts', /^\s+case '[a-z]+':$/gm), 14, 'ATS adapters');
  assert.equal(count('radar/src/types/index.ts', /^ {2}'[a-z_]+',$/gm) >= 16, true, 'job boards');
  const matcher = readFileSync(local('radar/src/lib/ai/matcher.ts'), 'utf8');
  assert(matcher.includes('RADAR_SIM_FLOOR || 0.32') && matcher.includes('RADAR_SIM_CEIL || 0.64'), 'similarity band');
  assert(/vectorScore \* 0\.6|\(1 - skillWeight\)/.test(matcher) && /\* 100 \* 0\.4|skillWeight = \(0\.4 /.test(matcher), 'score weights');
  const tests = execFileSync('git', ['-C', local('radar').pathname.slice(1), 'ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => /\.test\.tsx?$/.test(f)).length;
  assert.equal(tests, 37, 'RADAR test files');
}
if (existsSync(local('vettly/backend/ai/context_engine.py'))) {
  const ctx = readFileSync(local('vettly/backend/ai/context_engine.py'), 'utf8');
  for (const b of ['RESUME_BUDGET = 20000', 'CUSTOM_BUDGET = 35000', 'GITHUB_BUDGET = 12000']) assert(ctx.includes(b), b);
  const val = readFileSync(local('vettly/backend/ai/answer_validator.py'), 'utf8');
  for (const b of ['MAX_ITERATIONS = 3', 'PASSING_SCORE = 8.0', 'QUICK_PASSING_SCORE = 6.5', 'context[:80000]']) assert(val.includes(b), b);
  assert(readFileSync(local('vettly/backend/ai/utils.py'), 'utf8').includes('[:14000]'), 'last provider cap');
}
if (existsSync(local('eves/popup/app.js'))) {
  const app = readFileSync(local('eves/popup/app.js'), 'utf8');
  for (const b of ['sampleRate: 16000', 'audioBitsPerSecond: 32000', 'rec.start(5000)']) assert(app.includes(b), b);
  assert.equal(count8(readFileSync(local('eves/src/components/brain/SpatialPills.tsx'), 'utf8')), 8, 'prompt pills');
}
function count8(s) { return [...s.matchAll(/\{ id: '/g)].length; }

console.log('check passed');
