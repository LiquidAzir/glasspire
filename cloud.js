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
  var pushTimer = 0, lastSent = '';

  function fetchTimeout(u, opts, ms) {
    var c = new AbortController();
    var id = setTimeout(function () { c.abort(); }, ms);
    opts = opts || {}; opts.signal = c.signal;
    return fetch(u, opts).finally(function () { clearTimeout(id); });
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
    // Push a snapshot object to the cloud (debounced 2.5s; skips no-op repeats).
    push: function (obj) {
      if (!enabled || !obj) return;
      var body;
      try { body = JSON.stringify(obj); } catch (e) { return; }
      if (body === lastSent) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () {
        lastSent = body;
        fetchTimeout(url(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: body }, 6000)
          .catch(function () { if (lastSent === body) lastSent = ''; });  // retry next save, but don't wipe a newer in-flight push's dedup
      }, 2500);
    },
  };
})();
