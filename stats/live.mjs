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

// Vercel's CDN holds a render for a minute and serves it stale while it refreshes, but only while the region still has
// a copy. A quiet night evicts it and the next request waits on GitHub, so the README doesn't embed these endpoints: it
// shows the files the Charts workflow publishes. Browsers are told not to keep a render at all.
export const headers = (type) => ({
  'content-type': type,
  'cache-control': 'no-cache, no-store, must-revalidate, max-age=0',
  'vercel-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=604800',
  'x-content-type-options': 'nosniff',
});
