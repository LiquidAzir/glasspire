// =============================================================
// HollowLight — procedural audio (Web Audio synth, no asset files).
// app.js calls window.__AUDIO.play('hit') etc. at game events; this module
// synthesizes every sound from oscillators + noise so there are no downloads
// (important on the flaky glasses link). Music is a low-CPU generative drone.
// Autoplay policy: the AudioContext is created/resumed on the first input.
// =============================================================
(function () {
  'use strict';
  var ctx = null, master = null, comp = null, enabled = true;
  var musicGain = null, musicTimer = null, musicVoices = [];

  try { enabled = localStorage.getItem('hl_audio') !== 'off'; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // 'playback' requests a LARGER output buffer so the audio thread survives the
    // glasses' CPU contention with 3D rendering (fixes the drone/music break-up). It
    // only adds a little output latency — the synthesized sound is otherwise identical.
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
    comp = ctx.createDynamicsCompressor();   // glue + avoid clipping when sounds stack
    comp.threshold.value = -16; comp.knee.value = 24; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = 0.55;
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  ['pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach(function (ev) {
    window.addEventListener(ev, function () { ensure(); resume(); }, { passive: true });
  });

  // ---- primitives ----
  function tone(t, freq, dur, type, vol, slideTo, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  var _noiseBuf = null;
  function noiseBuffer() {
    if (_noiseBuf) return _noiseBuf;
    var n = ctx.sampleRate * 1.0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    _noiseBuf = b; return b;
  }
  function noise(t, dur, vol, filtType, filtFreq, filtSlide) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuffer();
    var f = ctx.createBiquadFilter(); f.type = filtType || 'bandpass'; f.frequency.setValueAtTime(filtFreq || 1200, t);
    if (filtSlide) f.frequency.exponentialRampToValueAtTime(Math.max(60, filtSlide), t + dur);
    f.Q.value = 0.8;
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }

  // ---- sound recipes ----
  var R = {
    attack: function (t) { noise(t, 0.10, 0.35, 'bandpass', 900, 300); tone(t, 150, 0.10, 'triangle', 0.25, 70); },
    cleave: function (t) { noise(t, 0.16, 0.34, 'bandpass', 700, 200); tone(t, 110, 0.16, 'sawtooth', 0.2, 60); },
    hit: function (t) { tone(t, 320, 0.06, 'square', 0.12, 200); noise(t, 0.05, 0.18, 'highpass', 2000); },
    enemyHit: function (t) { tone(t, 240, 0.05, 'triangle', 0.14, 150); noise(t, 0.04, 0.14, 'bandpass', 1400); },
    crit: function (t) { tone(t, 520, 0.10, 'square', 0.18, 180); tone(t + 0.02, 880, 0.10, 'square', 0.12, 300); noise(t, 0.08, 0.2, 'highpass', 2500); },
    enemyDie: function (t) { tone(t, 220, 0.32, 'sawtooth', 0.22, 50); noise(t, 0.3, 0.22, 'lowpass', 1200, 200); },
    bossDie: function (t) { tone(t, 140, 0.9, 'sawtooth', 0.3, 36); tone(t + 0.05, 90, 0.9, 'square', 0.2, 30); noise(t, 0.8, 0.3, 'lowpass', 900, 120); },
    hurt: function (t) { tone(t, 180, 0.18, 'sawtooth', 0.3, 90); noise(t, 0.12, 0.18, 'lowpass', 800); },
    levelup: function (t) { [0, 1, 2, 3].forEach(function (i) { tone(t + i * 0.09, 440 * Math.pow(1.26, i), 0.5, 'triangle', 0.22); }); },
    loot: function (t, o) { var p = (o && o.pitch) || 1; tone(t, 880 * p, 0.18, 'sine', 0.18, 1320 * p); tone(t + 0.04, 1320 * p, 0.16, 'sine', 0.12); },
    legendary: function (t) { [0, 1, 2].forEach(function (i) { tone(t + i * 0.07, 660 * Math.pow(1.5, i), 0.6, 'sine', 0.2); }); noise(t, 0.5, 0.1, 'highpass', 3000); },
    equip: function (t) { tone(t, 600, 0.05, 'square', 0.16, 900); noise(t, 0.05, 0.18, 'highpass', 3500); },
    cast: function (t, o) { var b = (o && o.base) || 440; tone(t, b, 0.22, 'sawtooth', 0.18, b * 2.4); tone(t, b * 1.5, 0.22, 'sine', 0.1, b * 3); },
    nova: function (t) { tone(t, 700, 0.35, 'sine', 0.2, 120); noise(t, 0.32, 0.2, 'bandpass', 1600, 400); },
    boss: function (t) { tone(t, 70, 1.1, 'sawtooth', 0.34, 50); tone(t + 0.04, 104, 1.1, 'square', 0.18, 70); noise(t, 0.9, 0.18, 'lowpass', 500); },
    ui: function (t) { tone(t, 520, 0.04, 'square', 0.08, 620); },
    uiBack: function (t) { tone(t, 400, 0.05, 'square', 0.08, 300); },
    potion: function (t) { tone(t, 500, 0.18, 'sine', 0.16, 1000); noise(t + 0.02, 0.12, 0.1, 'highpass', 4000); },
    gold: function (t) { [0, 1, 2].forEach(function (i) { tone(t + i * 0.03, 1200 + i * 240, 0.08, 'square', 0.1); }); },
    portal: function (t) { tone(t, 200, 0.5, 'sine', 0.18, 800); tone(t, 300, 0.5, 'sine', 0.12, 1200); noise(t, 0.5, 0.1, 'bandpass', 2000, 600); },
    shrine: function (t) { [0, 1, 2].forEach(function (i) { tone(t + i * 0.06, 523 * Math.pow(1.33, i), 0.5, 'sine', 0.16); }); },
    goblin: function (t) { [0, 1, 2, 3].forEach(function (i) { tone(t + i * 0.05, 900 + Math.sin(i) * 300, 0.07, 'square', 0.12, 700); }); },
    goblinFlee: function (t) { tone(t, 700, 0.4, 'square', 0.14, 1600); },
    error: function (t) { tone(t, 200, 0.12, 'square', 0.12, 140); },
  };

  // ---- generative ambient music: a slow dark drone + sparse bell motifs ----
  var SCALES = {
    crypts: { root: 110, steps: [0, 3, 5, 7, 10] },         // A minor pentatonic-ish, low
    overgrowth: { root: 130.8, steps: [0, 2, 4, 7, 9] },
    frostpeak: { root: 146.8, steps: [0, 2, 5, 7, 10] },
    infernal: { root: 98, steps: [0, 1, 4, 6, 8] },          // dissonant
    void: { root: 116.5, steps: [0, 2, 3, 7, 8] },
    town: { root: 174.6, steps: [0, 4, 7, 11, 14] },         // brighter, hopeful
  };
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicVoices.forEach(function (v) { try { v.stop(); } catch (e) {} });
    musicVoices = [];
    if (musicGain) musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  }
  function startDrone(scale) {
    var t = ctx.currentTime;
    [scale.root * 0.5, scale.root, scale.root * 1.5].forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createBiquadFilter();
      o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f * (1 + (i - 1) * 0.004);
      lf.type = 'lowpass'; lf.frequency.value = 380; lf.Q.value = 0.6;
      g.gain.value = i === 2 ? 0.05 : 0.10;
      o.connect(lf); lf.connect(g); g.connect(musicGain); o.start(t);
      // slow filter breathing
      var lfo = ctx.createOscillator(), lfg = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.02; lfg.gain.value = 160;
      lfo.connect(lfg); lfg.connect(lf.frequency); lfo.start(t);
      musicVoices.push(o, lfo);
    });
  }
  function scheduleBells(scale) {
    musicTimer = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      if (Math.random() < 0.55) {
        var st = scale.steps[(Math.random() * scale.steps.length) | 0];
        var oct = Math.random() < 0.4 ? 4 : 2;
        var f = scale.root * oct * Math.pow(2, st / 12);
        // Schedule the bell ~0.18s ahead (not 0.02): the bell is the only music voice
        // timed from the busy main thread, and a small lead can land "in the past" after
        // a janky frame and click. A bigger lead is safely ahead of the output buffer.
        // Every gain/start/stop time below derives from t, so the note is unchanged.
        var t = ctx.currentTime + 0.18;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
        o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 2.5);
      }
    }, 2600);
  }

  window.__AUDIO = {
    play: function (name, opt) {
      if (!enabled) return;
      var c = ensure(); if (!c) return; resume();
      var fn = R[name]; if (fn) { try { fn(c.currentTime + 0.001, opt); } catch (e) {} }
    },
    music: function (biomeId) {
      if (!enabled) { return; }
      var c = ensure(); if (!c) return; resume();
      stopMusic();
      var scale = SCALES[biomeId] || SCALES.crypts;
      musicGain.gain.cancelScheduledValues(c.currentTime);
      musicGain.gain.setValueAtTime(0.0001, c.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 2.0);
      startDrone(scale); scheduleBells(scale);
    },
    stopMusic: stopMusic,
    setEnabled: function (b) {
      enabled = !!b;
      try { localStorage.setItem('hl_audio', b ? 'on' : 'off'); } catch (e) {}
      if (!b && ctx) stopMusic();
    },
    isEnabled: function () { return enabled; },
    setVolume: function (v) { ensure(); if (master) master.gain.value = v; },
  };
})();
