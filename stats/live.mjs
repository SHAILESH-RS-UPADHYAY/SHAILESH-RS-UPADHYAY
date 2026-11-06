// The numbers for the endpoints. Plates on one page all share a fetch, and if GitHub or the token fails
// the page still shows the last snapshot, labelled as a snapshot, rather than a broken image.
import { readFileSync } from 'node:fs';
import { fetchAccount, summarize } from './data.mjs';

const TTL = 30e3;
let cached = null;

function snapshot() {
  return { ...JSON.parse(readFileSync(new URL('./snapshot.json', import.meta.url))), source: 'snapshot' };
}

export function current() {
  if (cached && Date.now() - cached.at < TTL) return cached.vm;
  const token = process.env.GH_TOKEN;
  const vm = token
    ? fetchAccount(token).then((raw) => ({ ...summarize(raw), source: 'live' })).catch((err) => {
      console.error('falling back to snapshot:', err.message);
      return snapshot();
    })
    : Promise.resolve(snapshot());
  cached = { at: Date.now(), vm };
  return vm;
}

// Vercel's CDN holds a render for a minute, then keeps serving it instantly while it fetches a fresh one, so
// GitHub's image proxy never waits on a cold start and gives up. The browser and GitHub's image proxy are told not to keep it at all,
// which is what makes a new commit show up on the next page load.
export const headers = (type) => ({
  'content-type': type,
  'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
  'vercel-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=604800',
  'x-content-type-options': 'nosniff',
});
