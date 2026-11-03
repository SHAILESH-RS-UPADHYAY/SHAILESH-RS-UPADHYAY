// GET /api/data returns the numbers behind the charts, for anyone who would rather read them than look at them.
import { current, headers } from '../stats/live.mjs';

export default {
  async fetch() {
    return new Response(JSON.stringify(await current(), null, 1), { headers: { ...headers('application/json; charset=utf-8'), 'access-control-allow-origin': '*' } });
  },
};
