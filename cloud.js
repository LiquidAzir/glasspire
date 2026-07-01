// =============================================================
// HollowLight — optional automatic cloud save sync.
// Dormant unless config.js sets HOLLOWLIGHT_CONFIG.cloudUrl. Plain <script>
// (loaded before app.js) that exposes window.__CLOUD, mirroring window.__AUDIO.
//
// The account id lives in the URL (?u=...) so a keyboard-less device (the glasses)
// only has to open one bookmarked link to share a save; otherwise we mint + persist
// one locally and expose a sharable link to open on the other devices.
// Strategy: app.js pulls the cloud save on boot (last-write-wins by timestamp) and
// pushes a debounced copy on every save. Network failures degrade to local-only —
// the game never breaks if the Worker is down or unconfigured.
// =============================================================
(function () {
  'use strict';
  var UIDKEY = 'hollowlight.uid';

  function makeId() {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
    for (var i = 0; i < 14; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }

  var cfg = (typeof window !== 'undefined' && window.HOLLOWLIGHT_CONFIG) || {};
  var base = (cfg.cloudUrl || '').replace(/\/+$/, '');
  var enabled = !!base;

  // Resolve the account id: an explicit ?u= in the URL wins (the sharable link) and is
  // remembered; otherwise reuse the stored one, or mint a fresh random 14-char id.
  var uid = '';
  try {
    var p = new URLSearchParams(location.search).get('u');
    var clean = p ? p.replace(/[^a-z0-9]/gi, '').slice(0, 64) : '';
    // A ?u= that sanitizes to empty (e.g. "?u=---") must NOT poison storage with '' —
    // treat it like a missing param and fall back to the stored / freshly-minted id.
    if (clean) { uid = clean; localStorage.setItem(UIDKEY, uid); }
    else { uid = localStorage.getItem(UIDKEY) || ''; if (!uid) { uid = makeId(); localStorage.setItem(UIDKEY, uid); } }
  } catch (e) { uid = uid || makeId(); }

  function url() { return base + '/v1/save?u=' + encodeURIComponent(uid); }
  /* cloud-write-reduce-v1 — content-deduped, throttled, backoff-aware cloud push.
     Keeps glasspire off the shared glassrealm-saves KV free-tier daily write cap by
     zeroing the `t` timestamp in the dedup signature, throttling non-flush pushes to
     >=60s apart, cooling down ~60s after a failed write, and marking synced ONLY on
     a successful put. Flush (hide/pagehide) bypasses throttle; explicit (manual)
     punches through backoff. Local saves are untouched (localStorage stays instant). */
  var pushTimer = 0, lastSig = '', lastPushAt = 0, backoffUntil = 0, pendingObj = null, pendingFlush = false, pendingExplicit = false;
  var THROTTLE_MS = 60000, BACKOFF_MS = 60000, DEBOUNCE_MS = 2500;

  function sigOf(obj) {
    var body;
    try { body = JSON.stringify(obj); } catch (e) { return null; }
    // Zero the timestamp so unchanged state (e.g. mobile screen-lock storms that only
    // bump `t`) produces the same signature and is deduped → no KV write.
    return body.replace(/"t"\s*:\s*\d+/g, '"t":0');
  }

  function fetchTimeout(u, opts, ms) {
    var c = new AbortController();
    var id = setTimeout(function () { c.abort(); }, ms);
    opts = opts || {}; opts.signal = c.signal;
    return fetch(u, opts).finally(function () { clearTimeout(id); });
  }

  // Actually perform the PUT. Resolves true on a 200 success, false otherwise.
  function doPut(sig, body) {
    return fetchTimeout(url(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: body }, 6000)
      .then(function (r) {
        if (r && r.ok) {
          lastSig = sig;        // mark synced ONLY after a successful put
          lastPushAt = Date.now();
          backoffUntil = 0;
          return true;
        }
        backoffUntil = Date.now() + BACKOFF_MS;   // cool down ~60s after a failed write (e.g. daily-cap 503)
        return false;
      })
      .catch(function () {
        backoffUntil = Date.now() + BACKOFF_MS;
        return false;
      });
  }

  // Schedule (or reschedule) the debounced push. Keeps the latest obj/flags so rapid
  // bursts coalesce into one write after DEBOUNCE_MS.
  function scheduleDebounced(obj, flush, explicit, delay) {
    pendingObj = obj; pendingFlush = flush; pendingExplicit = explicit;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { runPush(pendingObj, pendingFlush, pendingExplicit); }, delay == null ? DEBOUNCE_MS : delay);
  }

  // The debounced push body: re-evaluates dedup/throttle/backoff at fire time.
  function runPush(obj, flush, explicit) {
    if (!enabled || !obj) { pendingObj = null; return; }
    var sig = sigOf(obj);
    if (sig == null) { pendingObj = null; return; }
    if (sig === lastSig) { pendingObj = null; return; }       // unchanged → no write (even on flush)
    var now = Date.now();
    if (!explicit && backoffUntil && now < backoffUntil) {    // backoff: reschedule for when the cooldown ends
      scheduleDebounced(obj, flush, explicit, backoffUntil - now); return;
    }
    if (!flush && lastPushAt && now - lastPushAt < THROTTLE_MS) {  // throttle non-flush to 1/min
      scheduleDebounced(obj, flush, explicit, THROTTLE_MS - (now - lastPushAt)); return;
    }
    pendingObj = null;
    var body;
    try { body = JSON.stringify(obj); } catch (e) { return; }
    doPut(sig, body);
  }

  window.__CLOUD = {
    enabled: enabled,
    uid: uid,
    // The link to open/bookmark on another device to share this save.
    link: function () {
      try { return location.origin + location.pathname + '?u=' + uid; }
      catch (e) { return '?u=' + uid; }
    },
    // Pull the cloud save snapshot (or null on miss / error / timeout).
    pull: function () {
      if (!enabled) return Promise.resolve(null);
      return fetchTimeout(url(), { cache: 'no-store' }, 4500)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.data ? j.data : null; })
        .catch(function () { return null; });
    },
    // Switch this device to a chosen memorable account code (the shared "save slot").
    // Persists it and reloads under ?u=<code> so the app re-inits + pulls that save.
    // Enter the SAME code on every device to share one save.
    setCode: function (code) {
      var clean = (code || '').replace(/[^a-z0-9]/gi, '').slice(0, 40).toLowerCase();
      if (!clean) return false;
      try { localStorage.setItem(UIDKEY, clean); } catch (e) {}
      try { location.href = location.origin + location.pathname + '?u=' + clean; }
      catch (e) { try { location.reload(); } catch (e2) {} }
      return true;
    },
    // Push a snapshot object to the cloud. Back-compat: push(obj) === push(obj,false,false).
    //   flush=true  → bypass throttle (used on visibilitychange/pagehide); still deduped.
    //   explicit=true → bypass backoff (used by a manual "save to cloud" action).
    push: function (obj, flush, explicit) {
      if (!enabled || !obj) return;
      flush = !!flush; explicit = !!explicit;
      var sig = sigOf(obj);
      if (sig == null) return;
      if (sig === lastSig) return;                            // unchanged → no write, even on flush
      var now = Date.now();
      if (!explicit && backoffUntil && now < backoffUntil) {  // backoff: reschedule for the cooldown tail
        scheduleDebounced(obj, flush, explicit, backoffUntil - now); return;
      }
      if (!flush && lastPushAt && now - lastPushAt < THROTTLE_MS) {  // throttle non-flush to >=60s apart
        scheduleDebounced(obj, flush, explicit, THROTTLE_MS - (now - lastPushAt)); return;
      }
      scheduleDebounced(obj, flush, explicit);               // debounced 2.5s (rapid bursts coalesce)
    },
    // Mark an object as already synced (e.g. after adopting a cloud pull) so we don't
    // immediately echo it back as a fresh write. Sets lastSig from the obj's sig.
    markSynced: function (obj) {
      if (!enabled || !obj) return;
      var sig = sigOf(obj);
      if (sig != null) { lastSig = sig; lastPushAt = Date.now(); backoffUntil = 0; }
    },
  };
})();
