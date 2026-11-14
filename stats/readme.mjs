// Writes README.md. The <picture> blocks repeat a lot, so they live here once.
import { writeFileSync } from 'node:fs';

const LIVE = 'https://shailesh-stats.vercel.app';
const ME = 'https://github.com/SHAILESH-RS-UPADHYAY';

const picture = (src, alt) => `<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="${src('dark', true)}">
  <source media="(max-width: 600px)" srcset="${src('light', true)}">
  <source media="(prefers-color-scheme: dark)" srcset="${src('dark', false)}">
  <img src="${src('light', false)}" width="100%" alt="${alt}">
</picture>`;

const local = (dir, name) => (theme, narrow) => `${dir}/${name}-${theme}${narrow ? '-m' : ''}.svg`;
const live = (name) => (theme, narrow) => `${LIVE}/api/plate?name=${name}&amp;theme=${theme}${narrow ? '&amp;w=m' : ''}`;

// Flagship plates live in their own product's world, so they don't change with the page theme.
const plate = (name, href, alt) => `<a href="${href}">
  <picture>
    <source media="(max-width: 600px)" srcset="assets/plates/${name}-m.svg">
    <img src="assets/plates/${name}.svg" width="100%" alt="${alt}">
  </picture>
</a>`;

const row = (logo, name, text, links) => `<img align="left" src="assets/logos/${logo}" width="44" height="44" hspace="12" alt="">
<b>${name}</b><br>
${text} ${links.map(([label, href]) => `<a href="${href}">${label}</a>`).join(' · ')}
<br clear="left"><br>`;

const also = [
  ['autopsy.svg', 'Autopsy', 'Paste a URL, get an evidence-backed teardown of how the site is built.', [['Live', 'https://autopsy-casefile.vercel.app'], ['Code', `${ME}/autopsy`]]],
  ['tether.svg', 'Tether', 'Carries a chat from one AI assistant to another as a Markdown capsule.', [['Live', 'https://tether-capsule.vercel.app'], ['Code', `${ME}/tether`]]],
  ['panna.svg', 'Panna', 'A local RAG chatbot that shows its source and refuses when the document does not say it.', [['Code', `${ME}/panna-rag`]]],
  ['simplify-money.svg', 'Simplify Money', 'A chat backend for digital gold: reads intent, fetches live prices, logs the purchase.', [['Code', `${ME}/simplify-money-backend`]]],
  ['iota.svg', 'Iota', 'An NER engine that turns messy address strings into clean, structured JSON.', [['Code', `${ME}/iota-address-parser`]]],
  ['autoflow.svg', 'AutoFlow', 'Writes the weekly executive report on its own, from the numbers and the company goals.', [['Code', `${ME}/autoflow`]]],
  ['luq.svg', 'LÜQ', 'An emotion-aware character that responds not with words, but with presence.', [['Code', `${ME}/luq-prototype`]]],
  ['analytics.svg', 'Analytics API', 'Ingests 1.3 million e-commerce records and serves analytics in under two seconds.', [['Code', `${ME}/webvory-scalable-analytics-engine`]]],
  ['finance.svg', 'Finance API', 'A finance records API with role-based access for admins, analysts and viewers.', [['Code', `${ME}/finance-dashboard-backend`]]],
  ['food-cart.png', 'Food Cart', 'Order ahead at campus food stalls and skip the queue.', [['Live', 'https://food-cart-roan.vercel.app'], ['Code', `${ME}/food-cart`]]],
  ['devine-cdc.png', 'Devine CDC', 'The site for a child development centre in Gurugram.', [['Live', 'https://devinecdc.in'], ['Code', `${ME}/devine-cdc`]]],
];

const readme = `${picture(local('assets', 'header'), 'Shailesh Upadhyay. AI engineer building LLM systems, RAG and agents, and the full-stack products around them. CS grad (AI/ML).')}

<a href="https://shailesh-ai.codes">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/portfolio-dark.svg">
  <img src="assets/portfolio-light.svg" width="100%" alt="Open my portfolio at shailesh-ai.codes: 20 products, with screens, deep dives and my resume.">
</picture>
</a>

${picture(live('pulse'), 'My total commits and how recently the last one landed, contributions in the last 12 months, my streak, and a calendar of every day, drawn live from GitHub.')}

<br>

### Flagship projects

${plate('radar', 'work/radar.md', 'RADAR: a 24-hour scope showing its 37 scheduled runs a day, next to the score map that sends a job to the Vault or to resume tailoring.')}

An AI job engine. It reads 30 job feeds, finds funded startups on its own, checks every posting is real, scores each one against your resume and files the best in a Vault. Near-misses get an honest resume rewrite. The last click stays yours. **Next.js, Supabase, Pinecone.** <a href="https://radar-neon-theta.vercel.app">Live</a> · <a href="https://github.com/SHAILESH-RS-UPADHYAY/radar">Code</a> · <a href="work/radar.md">Case study</a>

<br>

${plate('vettly', 'work/vettly.md', 'Vettly: an 80,000 character context budget, a four provider failover chain and a seven dimension quality bar that every answer has to clear.')}

Interview prep built on your real work. It reads your resume, your GitHub, the job post and the take-home, then asks what only you could be asked and checks every answer for sounding human. **FastAPI, Python, Neon, Clerk.** <a href="https://vettly-sigma.vercel.app">Live</a> · <a href="https://github.com/SHAILESH-RS-UPADHYAY/vettly">Code</a> · <a href="work/vettly.md">Case study</a>

<br>

${plate('blueprint', 'https://blueprint-sh.vercel.app', 'Blueprint.sh: its own source drawn as an architecture sheet by its own engine.')}

Parses JavaScript, TypeScript and Python imports, finds cycles with Tarjan's algorithm and lays the graph out with ELK in a Web Worker. Your code never leaves the browser. **TypeScript, ELK, hand-written SVG.** <a href="https://blueprint-sh.vercel.app">Live</a> · <a href="${ME}/blueprint-sh">Code</a>

<br>

${plate('eves', 'work/eves.md', 'EVES: a live meeting moving through the app, from recording to a transcript in Hindi and English, to a written brief, to a prompt ready to paste.')}

A desktop app for long engineering calls. It records the meeting, transcribes it live with speaker labels, and turns it into a brief you can question and prompts you can paste. Everything stays on your machine. **React, TypeScript, Deepgram.** <a href="https://eves-jet.vercel.app">Live</a> · <a href="work/eves.md">Case study</a>

<br>

### By the numbers

${picture(live('projects'), 'Commits per week for each project since my first active week, with the four flagship projects highlighted and a total beside each.')}

${picture(live('rhythm'), 'Commits by weekday and hour in India time, with the busiest stretch of the day highlighted and a total for each weekday.')}

${picture(live('stack'), 'Languages by share of bytes across all my repositories, next to lines, modules, imports and cycles measured in each flagship project.')}

<sub>These charts are drawn from GitHub when the page loads, so a new commit shows up within a minute. <a href="${LIVE}/api/data">The numbers behind them</a>.</sub>

<br>

### Also built

<sub>Every product with its screen and links, in one place: <a href="https://shailesh-ai.codes/#products">shailesh-ai.codes</a></sub>

${also.map((a) => row(...a)).join('\n\n')}

<sub>LLMs, RAG and agents first. Python and FastAPI behind them, TypeScript and Next.js for everything people touch. Say hello on <a href="https://www.linkedin.com/in/shailesh-upadhyay-6a112624a">LinkedIn</a>.</sub>
`;

writeFileSync(new URL('../README.md', import.meta.url), readme);
console.log('README written');
