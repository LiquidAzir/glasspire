// HollowLight cloud-save Worker — a tiny per-account key/value store on Cloudflare KV.
// GET  /v1/save?u=<id>  -> { t, data }   (data is the save snapshot, or null)
// PUT  /v1/save?u=<id>  body=<snapshot>  -> { ok: true, t }
// The account id `u` is the only secret; anyone with the id can read/write that save
// (fine for a personal single-user game). No auth, permissive CORS.

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const u = new URL(req.url);
    if (!u.pathname.endsWith('/v1/save')) return new Response('HollowLight save worker', { headers: cors });

    const id = (u.searchParams.get('u') || '').replace(/[^a-z0-9]/gi, '').slice(0, 64);
    if (!id) return json({ error: 'missing u' }, 400);
    if (!env.SAVES) return json({ error: 'KV not bound — create the SAVES namespace' }, 500);
    const key = 'save:' + id;

    if (req.method === 'GET') {
      let v;
      try { v = await env.SAVES.get(key); }
      catch (e) { return json({ error: 'kv read failed', detail: String((e && e.message) || e) }, 502); }
      return v ? new Response(v, { headers: { ...cors, 'content-type': 'application/json' } }) : json({ data: null });
    }
    if (req.method === 'PUT') {
      const body = await req.text();
      if (body.length > 500000) return json({ error: 'too large' }, 413);
      let data;
      try { data = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
      const t = (data && typeof data.t === 'number') ? data.t : Date.now();
      // Wrap the KV ops so a failure returns a readable JSON error instead of a 1101.
      try {
        // Best-effort last-write-wins: reject a PUT older than what's stored, so a
        // reordered/retried slow push can't overwrite a newer save. (KV is eventually
        // consistent, so this closes the common reorder window but isn't a hard guarantee.)
        const existing = await env.SAVES.get(key);
        if (existing) {
          try { const prev = JSON.parse(existing); if (typeof prev.t === 'number' && t < prev.t) return json({ ok: true, t: prev.t, stale: true }); } catch (e) {}
        }
        await env.SAVES.put(key, JSON.stringify({ t, data }));
      } catch (e) {
        return json({ error: 'kv write failed', detail: String((e && e.message) || e) }, 502);
      }
      return json({ ok: true, t });
    }
    return new Response('method not allowed', { status: 405, headers: cors });
  },
};
