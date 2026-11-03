// Reads the account from GitHub and reduces it to the numbers the plates draw.
// summarize() is the privacy boundary: a private repo is only ever named if it is in FEATURED.
const LOGIN = 'SHAILESH-RS-UPADHYAY';
const IST = 5.5 * 3600e3; // India has no DST, so a fixed offset is correct all year.

// Private repos the owner chose to show. Anything else private is only counted, never named.
export const FEATURED = ['radar', 'eves', 'vettly'];

export const NAMES = {
  radar: 'RADAR', eves: 'EVES', vettly: 'Vettly', 'blueprint-sh': 'Blueprint.sh',
  tether: 'Tether', autopsy: 'Autopsy', autoflow: 'AutoFlow', 'panna-rag': 'Panna',
  'webvory-scalable-analytics-engine': 'Analytics API', 'devine-cdc': 'Devine CDC',
  'simplify-money-backend': 'Simplify Money', 'iota-address-parser': 'Iota',
  'finance-dashboard-backend': 'Finance API', 'food-cart': 'Food Cart', 'luq-prototype': 'LÜQ',
  [LOGIN]: 'This profile',
};

async function gql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'profile-plates' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const { data, errors } = await res.json();
  if (errors) throw new Error(errors.map((e) => e.message).join('; '));
  return data;
}

// One query per repo, in parallel: a single query across every repo took 9.5 s, far too slow for a live image.
const HISTORY = `query($repo: ID!, $id: ID!, $after: String) { node(id: $repo) { ... on Repository {
  defaultBranchRef { target { ... on Commit { history(author: {id: $id}, first: 100, after: $after) {
    pageInfo { hasNextPage endCursor } nodes { authoredDate } } } } } } } }`;

export async function fetchAccount(token) {
  const { user: u } = await gql(token, `query($login: String!) { user(login: $login) {
    id
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) { nodes {
      id name isPrivate
      languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
    } }
  } }`, { login: LOGIN });

  const repos = await Promise.all(u.repositories.nodes.map(async (r) => {
    const dates = [];
    let after = null;
    do {
      const { node } = await gql(token, HISTORY, { repo: r.id, id: u.id, after });
      const page = node.defaultBranchRef?.target?.history;
      dates.push(...(page?.nodes ?? []).map((n) => n.authoredDate));
      after = page?.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    return { name: r.name, private: r.isPrivate, dates, languages: r.languages.edges.map((e) => ({ name: e.node.name, size: e.size })) };
  }));
  return { calendar: u.contributionsCollection.contributionCalendar, repos };
}

function shares(languages) {
  const sum = languages.reduce((a, l) => a + l.size, 0) || 1;
  return languages.slice(0, 4).map((l) => ({ name: l.name, share: +(l.size / sum).toFixed(3) }));
}

const istDay = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
const round = (n, d = 3) => +n.toFixed(d);

export function summarize({ calendar, repos }, now = Date.now()) {
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  const today = istDay(now);

  // Weekly counts share the calendar's columns, so bars and heatmap cells line up on the page.
  const weekCount = calendar.weeks.length;
  const first = Date.parse(`${calendar.weeks[0].contributionDays[0].date}T00:00:00Z`);
  const firstSunday = first - new Date(first).getUTCDay() * 864e5;
  const weekly = (dates) => {
    const w = Array(weekCount).fill(0);
    for (const d of dates) {
      const i = Math.floor((Date.parse(`${istDay(Date.parse(d))}T00:00:00Z`) - firstSunday) / (7 * 864e5));
      if (i >= 0 && i < weekCount) w[i]++;
    }
    return w;
  };

  const named = [];
  const hidden = { projects: 0, commits: 0, dates: [] };
  let last = null;
  const punch = Array.from({ length: 7 }, () => Array(24).fill(0));
  const months = new Map();
  const lang = new Map();
  const active = new Set();

  for (const r of repos) {
    const visible = !r.private || FEATURED.includes(r.name);
    if (!r.dates.length) continue;
    for (const d of r.dates) {
      const ms = Date.parse(d);
      const t = new Date(ms + IST);
      punch[(t.getUTCDay() + 6) % 7][t.getUTCHours()]++; // Monday first
      const ym = t.toISOString().slice(0, 7);
      months.set(ym, (months.get(ym) ?? 0) + 1);
      active.add(t.toISOString().slice(0, 10));
      if (!last || ms > last.ms) last = { ms, repo: visible ? NAMES[r.name] ?? r.name : null };
    }
    for (const { name, size } of r.languages) lang.set(name, (lang.get(name) ?? 0) + size);
    if (visible) {
      named.push({ slug: r.name, name: NAMES[r.name] ?? r.name, private: r.private, commits: r.dates.length, weekly: weekly(r.dates),
        first: istDay(Math.min(...r.dates.map(Date.parse))), last: istDay(Math.max(...r.dates.map(Date.parse))),
        languages: shares(r.languages) });
    } else {
      hidden.projects++;
      hidden.commits += r.dates.length;
      hidden.dates.push(...r.dates);
    }
  }
  named.sort((a, b) => b.commits - a.commits);

  // Streaks count contribution days from the same calendar GitHub draws, so they can't disagree with it.
  // Today with nothing yet doesn't break the run: the day isn't over.
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount) current++;
    else if (days[i].date !== today && i !== days.length - 1) break;
  }
  const busiest = days.reduce((a, d) => (d.contributionCount > a.count ? { date: d.date, count: d.contributionCount } : a), { date: null, count: 0 });

  const sum = [...lang.values()].reduce((a, b) => a + b, 0) || 1;
  const ranked = [...lang].sort((a, b) => b[1] - a[1]);
  const languages = ranked.slice(0, 6).map(([name, size]) => ({ name, share: round(size / sum) }));
  const rest = ranked.slice(6).reduce((a, [, s]) => a + s, 0) / sum;
  if (rest > 0.002) languages.push({ name: 'Other', share: round(rest) });

  const totalCommits = repos.reduce((a, r) => a + r.dates.length, 0);
  const allMonths = [...months.keys()].sort();
  const monthList = [];
  if (allMonths.length) {
    const end = istDay(now).slice(0, 7);
    let [y, m] = end.split('-').map(Number);
    for (let i = 0; i < 18; i++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      monthList.unshift({ ym, commits: months.get(ym) ?? 0 });
      if (--m === 0) { m = 12; y--; }
    }
  }

  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      commits: totalCommits,
      contributions: calendar.totalContributions,
      repos: repos.filter((r) => r.dates.length).length,
      activeDays: active.size,
      streak: { current, longest },
      busiest,
      last: last && { at: new Date(last.ms).toISOString(), repo: last.repo },
    },
    calendar: calendar.weeks.map((w) => w.contributionDays.map((d) => [d.date, d.contributionCount])),
    projects: named,
    hidden: { projects: hidden.projects, commits: hidden.commits, weekly: weekly(hidden.dates) },
    punch,
    months: monthList,
    languages,
  };
}
