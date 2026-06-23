# HollowLight cloud save sync

A tiny Cloudflare Worker + KV namespace that stores one save per account id, so the
same character follows you across PC, phone, and the glasses. Free tier is plenty for
a single player.

## Deploy (one time, ~5 minutes)

```bash
npm install -g wrangler        # if you don't have it
wrangler login                 # opens your Cloudflare account

cd worker
wrangler kv namespace create SAVES
#   -> prints: id = "abc123..."  — paste that into wrangler.toml (kv_namespaces id)

wrangler deploy
#   -> prints your URL, e.g. https://hollowlight-saves.<you>.workers.dev
```

## Turn it on in the game

1. Paste the deployed URL into **`../config.js`**:
   ```js
   window.HOLLOWLIGHT_CONFIG = { cloudUrl: 'https://hollowlight-saves.<you>.workers.dev' };
   ```
2. Commit + push so Render redeploys the site.
3. Open the game on any device, then **Menu → Sync Save → Cloud Sync** → copy your
   **sync link** (`...?u=<id>`). Open / bookmark that exact link on your other devices
   (phone, PC, glasses) — they now share one save automatically: it pulls on load and
   pushes a few seconds after each save.

## How it works

- `GET /v1/save?u=<id>` returns the stored snapshot; `PUT` overwrites it.
- The client merges by timestamp (last device to save wins) and degrades to
  local-only if the worker is unreachable or `cloudUrl` is blank.
- The account id in the URL is the only secret — keep your `?u=` link private. It is a
  bearer token: anyone with the link can read/overwrite that one save.

## Caveats

- Single slot, last-write-wins: two devices edited at the same moment will clobber.
- KV is eventually consistent: a pull immediately after another device's push can
  occasionally return the previous value. Fine for personal single-player use.
