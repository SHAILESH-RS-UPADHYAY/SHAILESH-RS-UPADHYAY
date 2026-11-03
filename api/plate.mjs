// GET /api/plate?name=pulse&theme=dark&w=m renders one live plate as SVG. name=repo&repo=tether draws one project.
import { PLATES, repo } from '../stats/plates.mjs';
import { current, headers } from '../stats/live.mjs';

export default {
  async fetch(request) {
    const q = new URL(request.url).searchParams;
    const name = q.get('name') ?? '';
    const draw = name === 'repo' ? repo : Object.hasOwn(PLATES, name) ? PLATES[name] : null;
    const opts = { theme: q.get('theme') === 'light' ? 'light' : 'dark', narrow: q.get('w') === 'm', slug: q.get('repo') };
    const svg = draw && draw(await current(), opts);
    if (!svg) return new Response('Unknown plate', { status: 404 });
    return new Response(svg, { headers: headers('image/svg+xml; charset=utf-8') });
  },
};
