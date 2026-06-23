// HollowLight runtime config (plain <script>, loaded before app.js).
//
// AUTOMATIC CLOUD SAVE SYNC (optional — play one character across PC, phone, glasses):
//   1. Deploy the Cloudflare Worker in /worker (see worker/README.md — ~5 min, free tier).
//   2. Paste its URL below, e.g. cloudUrl: 'https://hollowlight-saves.you.workers.dev'
//   3. Commit + redeploy the site.
// Then every device that opens the game with the same ?u=<id> in the URL shares one
// save automatically (pull on load, push a few seconds after each save). Copy your
// personal sync link from Menu -> Sync Save -> Cloud Sync and open it on each device.
//
// Leave cloudUrl blank to keep saves local-only (the Export/Import codes still work).
//
// This reuses your existing GlassRealm save Worker — it's a generic per-id key/value
// store, and HollowLight mints its own independent account id ('hollowlight.uid'), so
// the two games never collide (and each rejects the other's save shape on load). Deploy
// the dedicated Worker in /worker and swap this URL if you'd rather keep them isolated.
window.HOLLOWLIGHT_CONFIG = { cloudUrl: 'https://glassrealm-saves.liquidazir.workers.dev' };
