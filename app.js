/* =============================================================
   GLASSPIRE — action RPG for Meta Ray-Ban Display
   Single-file vanilla JS. Canvas 2D for the game world,
   DOM screens for menus. Persistent character via localStorage.
   ============================================================= */
(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const CFG = {
    appName: 'Glasspire',
    storageKey: 'glasspire_save_v2',
    canvas: 600,
    tile: 28,                 // pixels per tile
    viewTiles: 21,            // 21 * 28 ≈ 588, with 6px margin per side
    playerSpeed: 12,          // tiles/sec — fast for glasses D-pad
    stepImpulse: 0.22,        // sec — minimum movement time per tap (guarantees ~2.5 tiles per tap)
    comboWindow: 500,         // ms — taps within this count as a combo sequence
    minComboGap: 30,          // ms — to reject key repeat ghosts
    biomeFloors: 4,           // floors per biome before boss
    autoAttackPad: 0.15,      // tile padding on attack range for forgiveness
  };

  // ============================================================
  // UTILS
  // ============================================================
  const rand = Math.random;
  const PI2 = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx*dx + dy*dy; };
  const dist  = (a, b) => Math.sqrt(dist2(a, b));
  const pick  = arr => arr[Math.floor(rand() * arr.length)];
  const irand = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const roll  = p => rand() < p;

  function chance(table) {
    // table = [[item, weight], ...]
    let total = 0;
    for (const [, w] of table) total += w;
    let r = rand() * total;
    for (const [item, w] of table) { r -= w; if (r <= 0) return item; }
    return table[0][0];
  }

  // ============================================================
  // STATIC DATA
  // ============================================================
  const CLASSES = {
    warrior: {
      id: 'warrior',
      name: 'Warrior',
      color: '#ff4d6d',
      glyph: '⚔',
      stats: { str: 8, int: 2, dex: 4, vit: 8 },
      hp: 120, mp: 30,
      attackRange: 1.2,
      attackSpeed: 1.05,      // attacks/sec
      damage: 12,
      attackKind: 'cleave',   // hits all enemies in arc
      activeSkill: 'whirlwind',
      activeSkillCost: 12,
    },
    mage: {
      id: 'mage',
      name: 'Mage',
      color: '#6df1ff',
      glyph: '✦',
      stats: { str: 2, int: 9, dex: 4, vit: 4 },
      hp: 70, mp: 100,
      attackRange: 5.0,
      attackSpeed: 1.2,
      damage: 9,
      attackKind: 'projectile-bolt',
      activeSkill: 'frostnova',
      activeSkillCost: 24,
    },
    ranger: {
      id: 'ranger',
      name: 'Ranger',
      color: '#51e6a4',
      glyph: '➹',
      stats: { str: 3, int: 4, dex: 9, vit: 5 },
      hp: 85, mp: 50,
      attackRange: 6.0,
      attackSpeed: 1.6,
      damage: 7,
      attackKind: 'projectile-arrow',
      activeSkill: 'multishot',
      activeSkillCost: 18,
    },
    summoner: {
      id: 'summoner',
      name: 'Summoner',
      color: '#c489ff',
      glyph: '☠',
      stats: { str: 2, int: 7, dex: 3, vit: 5 },
      hp: 80, mp: 80,
      attackRange: 4.5,
      attackSpeed: 1.0,
      damage: 6,
      attackKind: 'projectile-bone',
      activeSkill: 'raisedead',
      activeSkillCost: 20,
    },
  };

  const SKILLS = {
    whirlwind: { name: 'Whirlwind', cooldown: 6,
      desc: 'Spin to hit every enemy within 2.2 tiles for 220% weapon damage.' },
    frostnova: { name: 'Frost Nova', cooldown: 8,
      desc: 'Frost shockwave hits all enemies within 3.5 tiles for 180% damage and freezes them briefly.' },
    multishot: { name: 'Multishot', cooldown: 5,
      desc: 'Fire five arrows in a fan. Each does 80% weapon damage.' },
    raisedead: { name: 'Raise Dead', cooldown: 10,
      desc: 'Summon two skeleton warriors to fight for you for 12 seconds.' },
  };

  const BIOMES = [
    { id: 'crypts',   name: 'The Crypts',          shortName: 'CRYPTS',
      palette: { wall: '#6df1ff', floor: '#1a2a3a', accent: '#c489ff' },
      enemies: ['skeleton', 'ghoul', 'wraith'],
      boss: 'lich',
      unlocked: true },
    { id: 'overgrowth', name: 'Overgrown Ruins',   shortName: 'OVERGROWTH',
      palette: { wall: '#51e6a4', floor: '#1a2a1a', accent: '#ffc857' },
      enemies: ['spider', 'thorn', 'wisp'],
      boss: 'druid',
      unlocked: false },
    { id: 'frostpeak', name: 'Frozen Peaks',       shortName: 'FROSTPEAK',
      palette: { wall: '#a0e0ff', floor: '#1a1f2a', accent: '#ffffff' },
      enemies: ['wolf', 'frostgiant', 'icebat'],
      boss: 'wyrm',
      unlocked: false },
    { id: 'infernal', name: 'Infernal Depths',     shortName: 'INFERNAL',
      palette: { wall: '#ff7043', floor: '#2a1010', accent: '#ffc857' },
      enemies: ['imp', 'hellhound', 'demon'],
      boss: 'archdemon',
      unlocked: false },
  ];

  const ENEMIES = {
    // crypts
    skeleton: { name: 'Skeleton',   glyph: '☠', color: '#cfcfcf', hp: 22,  dmg: 6,  speed: 2.2, range: 1.1, attackKind: 'melee', xp: 8,  goldRange: [1, 4] },
    ghoul:    { name: 'Ghoul',      glyph: 'ɣ', color: '#9bbf95', hp: 35,  dmg: 9,  speed: 2.8, range: 1.1, attackKind: 'melee', xp: 12, goldRange: [2, 5] },
    wraith:   { name: 'Wraith',     glyph: '∽', color: '#c489ff', hp: 18,  dmg: 7,  speed: 2.0, range: 4.5, attackKind: 'ranged-soul', xp: 14, goldRange: [3, 6] },
    lich:     { name: 'Lich Lord',  glyph: '✪', color: '#ff4d6d', hp: 360, dmg: 14, speed: 1.8, range: 5.5, attackKind: 'ranged-soul', xp: 80, goldRange: [40, 80], boss: true },

    // overgrowth
    spider:   { name: 'Spider',     glyph: '✶', color: '#51e6a4', hp: 26,  dmg: 8,  speed: 3.5, range: 1.0, attackKind: 'melee', xp: 10, goldRange: [2, 4] },
    thorn:    { name: 'Thornling',  glyph: '✲', color: '#9be57c', hp: 40,  dmg: 10, speed: 1.6, range: 1.1, attackKind: 'melee', xp: 14, goldRange: [3, 6] },
    wisp:     { name: 'Wisp',       glyph: '∗', color: '#ffe066', hp: 14,  dmg: 6,  speed: 3.4, range: 4.0, attackKind: 'ranged-soul', xp: 12, goldRange: [3, 6] },
    druid:    { name: 'Old Druid',  glyph: '❦', color: '#51e6a4', hp: 480, dmg: 18, speed: 2.0, range: 4.5, attackKind: 'ranged-soul', xp: 120, goldRange: [60, 120], boss: true },

    // frost
    wolf:     { name: 'Frostwolf',  glyph: '✦', color: '#bcd9ee', hp: 32,  dmg: 11, speed: 4.0, range: 1.0, attackKind: 'melee', xp: 14, goldRange: [3, 6] },
    frostgiant: { name: 'Frost Giant', glyph: '✷', color: '#ffffff', hp: 70, dmg: 16, speed: 1.5, range: 1.2, attackKind: 'melee', xp: 22, goldRange: [5, 12] },
    icebat:   { name: 'Ice Bat',    glyph: '✺', color: '#a0e0ff', hp: 18,  dmg: 9,  speed: 3.6, range: 1.0, attackKind: 'melee', xp: 12, goldRange: [3, 6] },
    wyrm:     { name: 'Ice Wyrm',   glyph: '♅', color: '#a0e0ff', hp: 620, dmg: 22, speed: 2.4, range: 5.5, attackKind: 'ranged-soul', xp: 180, goldRange: [80, 160], boss: true },

    // infernal
    imp:      { name: 'Imp',        glyph: '✦', color: '#ff7043', hp: 28,  dmg: 12, speed: 3.4, range: 3.5, attackKind: 'ranged-soul', xp: 16, goldRange: [4, 8] },
    hellhound:{ name: 'Hellhound',  glyph: '☼', color: '#ff4d6d', hp: 56,  dmg: 16, speed: 4.0, range: 1.1, attackKind: 'melee', xp: 20, goldRange: [5, 10] },
    demon:    { name: 'Demon',      glyph: '⛧', color: '#ff4d6d', hp: 92,  dmg: 20, speed: 2.4, range: 1.2, attackKind: 'melee', xp: 28, goldRange: [6, 14] },
    archdemon:{ name: 'Archdemon',  glyph: '⛤', color: '#ff4d6d', hp: 900, dmg: 28, speed: 2.6, range: 4.5, attackKind: 'ranged-soul', xp: 280, goldRange: [120, 240], boss: true },
  };

  // ITEM BASES — weapon, armor, ring, amulet
  const ITEM_BASES = {
    // weapons (class-flavored but cross-usable)
    'rusted-sword':   { type: 'weapon', name: 'Rusted Sword',   icon: '⚔', base: { dmg: 4 },  ilvl: 1, glyph: 'wep' },
    'iron-sword':     { type: 'weapon', name: 'Iron Sword',     icon: '⚔', base: { dmg: 8 },  ilvl: 4, glyph: 'wep' },
    'runed-blade':    { type: 'weapon', name: 'Runed Blade',    icon: '⚔', base: { dmg: 14 }, ilvl: 8, glyph: 'wep' },
    'apprentice-staff': { type: 'weapon', name: 'Apprentice Staff', icon: '✦', base: { dmg: 4, mp: 4 }, ilvl: 1, glyph: 'wep' },
    'crystal-staff':  { type: 'weapon', name: 'Crystal Staff',  icon: '✦', base: { dmg: 9, mp: 8 }, ilvl: 5, glyph: 'wep' },
    'arcane-staff':   { type: 'weapon', name: 'Arcane Staff',   icon: '✦', base: { dmg: 15, mp: 14 }, ilvl: 9, glyph: 'wep' },
    'short-bow':      { type: 'weapon', name: 'Short Bow',      icon: '➹', base: { dmg: 3 }, ilvl: 1, glyph: 'wep' },
    'recurve-bow':    { type: 'weapon', name: 'Recurve Bow',    icon: '➹', base: { dmg: 6 }, ilvl: 4, glyph: 'wep' },
    'longbow':        { type: 'weapon', name: 'Longbow',        icon: '➹', base: { dmg: 11 }, ilvl: 8, glyph: 'wep' },
    'bone-wand':      { type: 'weapon', name: 'Bone Wand',      icon: '☠', base: { dmg: 4 }, ilvl: 1, glyph: 'wep' },
    'death-wand':     { type: 'weapon', name: 'Death Wand',     icon: '☠', base: { dmg: 8 }, ilvl: 4, glyph: 'wep' },
    'lich-scepter':   { type: 'weapon', name: 'Lich Scepter',   icon: '☠', base: { dmg: 13 }, ilvl: 8, glyph: 'wep' },

    // armor
    'leather':        { type: 'armor', name: 'Leather Vest',  icon: '◇', base: { def: 4 },  ilvl: 1 },
    'chain':          { type: 'armor', name: 'Chain Mail',    icon: '◇', base: { def: 9 },  ilvl: 4 },
    'plate':          { type: 'armor', name: 'Plate Mail',    icon: '◇', base: { def: 16 }, ilvl: 8 },
    'robe':           { type: 'armor', name: 'Acolyte Robe',  icon: '◇', base: { def: 3, mp: 10 }, ilvl: 1 },
    'mage-robe':      { type: 'armor', name: 'Mage Robe',     icon: '◇', base: { def: 6, mp: 20 }, ilvl: 5 },

    // rings & amulets
    'copper-ring':    { type: 'ring', name: 'Copper Ring',    icon: '○', base: {}, ilvl: 1 },
    'silver-ring':    { type: 'ring', name: 'Silver Ring',    icon: '○', base: {}, ilvl: 5 },
    'gold-ring':      { type: 'ring', name: 'Gold Ring',      icon: '○', base: {}, ilvl: 9 },
    'iron-amulet':    { type: 'amulet', name: 'Iron Amulet',  icon: '◈', base: {}, ilvl: 2 },
    'jade-amulet':    { type: 'amulet', name: 'Jade Amulet',  icon: '◈', base: {}, ilvl: 6 },
    'star-amulet':    { type: 'amulet', name: 'Star Amulet',  icon: '◈', base: {}, ilvl: 10 },
  };

  // affixes by rarity tier
  const AFFIXES = [
    { key: 'dmg',  label: 'Damage', max: 8,  rarities: ['magic','rare','unique'] },
    { key: 'def',  label: 'Armor',  max: 8,  rarities: ['magic','rare','unique'] },
    { key: 'hp',   label: 'Life',   max: 20, rarities: ['magic','rare','unique'] },
    { key: 'mp',   label: 'Mana',   max: 12, rarities: ['magic','rare','unique'] },
    { key: 'str',  label: 'Strength', max: 4, rarities: ['rare','unique'] },
    { key: 'int',  label: 'Intellect', max: 4, rarities: ['rare','unique'] },
    { key: 'dex',  label: 'Dexterity', max: 4, rarities: ['rare','unique'] },
    { key: 'vit',  label: 'Vitality',  max: 4, rarities: ['rare','unique'] },
    { key: 'crit', label: 'Crit %',  max: 8, rarities: ['rare','unique'] },
    { key: 'aspd', label: 'Attack Speed %', max: 12, rarities: ['rare','unique'] },
  ];

  const RARITY_TIERS = ['common', 'magic', 'rare', 'unique'];
  const RARITY_WEIGHTS = [[ 'common', 70 ], [ 'magic', 22 ], [ 'rare', 7 ], [ 'unique', 1 ]];

  // ============================================================
  // GAME STATE
  // ============================================================
  const game = {
    screen: 'title',
    history: [],
    save: null,                   // persisted character + meta
    char: null,                   // alias to save.char
    world: null,                  // current world (town or dungeon)
    paused: false,
    keys: {},                     // held keys
    moveX: 0, moveY: 0,           // current movement vector
    comboBuffer: [],
    lastKeyTime: 0,
    floatingTexts: [],
    particles: [],
    enemies: [],
    projectiles: [],
    items: [],                    // ground loot
    minions: [],                  // summoner pets
    deathFlash: 0,
    damageFlash: 0,
    screenShake: 0,
    lastTime: 0,
    cam: { x: 0, y: 0 },
    bossAlive: false,
    bossKilled: false,
    timeInZone: 0,
    activeBiomeId: null,
    activeFloor: 0,
    nearbyNpc: null,
    nearbyPortal: null,
    nearbyItem: null,
    vendorOffer: [],
    vendorMode: 'buy',
    stashMode: 'deposit',
    selectedItemId: null,
    activeQuestKills: {},
  };

  // ============================================================
  // DOM REFS
  // ============================================================
  const screens = {};
  function $(id) { return document.getElementById(id); }
  function collectScreens() {
    document.querySelectorAll('.screen').forEach(s => { if (s.id) screens[s.id] = s; });
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  function navigateTo(id, opts) {
    opts = opts || {};
    if (opts.addToHistory !== false && game.screen && game.screen !== id) {
      game.history.push(game.screen);
    }
    // clear held keys when leaving the game screen to prevent stuck movement
    if (game.screen === 'game' && id !== 'game') {
      game.keys = {};
    }
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    if (screens[id]) {
      screens[id].classList.remove('hidden');
      game.screen = id;
      onScreenEnter(id);
      focusFirst(screens[id]);
    }
  }
  function navigateBack() {
    if (game.history.length === 0) return;
    const prev = game.history.pop();
    navigateTo(prev, { addToHistory: false });
  }
  function focusFirst(container) {
    const el = container.querySelector('.focusable:not([disabled]):not(.hidden)');
    if (el) setTimeout(() => el.focus(), 0);
  }
  function moveFocus(dir) {
    const container = screens[game.screen];
    if (!container) return;
    const list = Array.from(container.querySelectorAll('.focusable:not([disabled]):not(.hidden)'));
    if (list.length === 0) return;
    const cur = document.activeElement;
    let i = list.indexOf(cur);
    if (i === -1) { list[0].focus(); return; }
    const next = (dir === 'up' || dir === 'left')
      ? (i > 0 ? i - 1 : list.length - 1)
      : (i < list.length - 1 ? i + 1 : 0);
    list[next].focus();
    const sp = list[next].closest('.content, .inv-list');
    if (sp) list[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ============================================================
  // SAVE / LOAD
  // ============================================================
  function defaultSave(classId) {
    const cls = CLASSES[classId];
    return {
      v: 2,
      classId,
      char: {
        classId,
        name: cls.name,
        level: 1,
        xp: 0,
        statPoints: 0,
        stats: Object.assign({}, cls.stats),
        hp: cls.hp, hpMax: cls.hp,
        mp: cls.mp, mpMax: cls.mp,
        gold: 0,
        equip: { weapon: null, armor: null, ring: null, amulet: null },
        inventory: [],
        potions: 3,
      },
      stash: [],
      unlockedBiomes: { crypts: true, overgrowth: false, frostpeak: false, infernal: false },
      bossesKilled: {},
      quest: null,    // active bounty
      questsCompleted: 0,
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== 2) return null;
      return obj;
    } catch (e) { return null; }
  }

  function saveGame() {
    if (!game.save) return;
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify(game.save));
    } catch (e) { console.warn('save failed', e); }
  }

  // ============================================================
  // CHARACTER STATS — derive secondary stats from base + equip
  // ============================================================
  function derived(char) {
    const cls = CLASSES[char.classId];
    let dmg = cls.damage;
    let def = 0;
    let hpMax = cls.hp + Math.max(0, char.stats.vit - 2) * 10 + (char.level - 1) * 6;
    let mpMax = cls.mp + Math.max(0, char.stats.int - 2) * 6 + (char.level - 1) * 4;
    let crit = 5;
    let aspd = cls.attackSpeed;
    let bonusStats = { str: 0, int: 0, dex: 0, vit: 0 };

    function applyItem(it) {
      if (!it) return;
      const base = ITEM_BASES[it.baseId];
      if (!base) return;
      if (base.base.dmg) dmg += base.base.dmg;
      if (base.base.def) def += base.base.def;
      if (base.base.mp)  mpMax += base.base.mp;
      for (const af of (it.affixes || [])) {
        if (af.key === 'dmg')  dmg += af.val;
        else if (af.key === 'def')  def += af.val;
        else if (af.key === 'hp')   hpMax += af.val;
        else if (af.key === 'mp')   mpMax += af.val;
        else if (af.key === 'crit') crit += af.val;
        else if (af.key === 'aspd') aspd *= 1 + af.val / 100;
        else if (af.key in bonusStats) bonusStats[af.key] += af.val;
      }
    }
    applyItem(char.equip.weapon);
    applyItem(char.equip.armor);
    applyItem(char.equip.ring);
    applyItem(char.equip.amulet);

    // stat-derived
    dmg += Math.max(0, char.stats.str + bonusStats.str - 2);
    dmg += Math.floor((char.stats.dex + bonusStats.dex) / 2);
    crit += Math.floor((char.stats.dex + bonusStats.dex) / 2);
    if (cls.id === 'mage' || cls.id === 'summoner') {
      dmg += Math.floor((char.stats.int + bonusStats.int) / 2);
    }
    hpMax += (char.stats.vit + bonusStats.vit) * 6;

    return { dmg, def, hpMax, mpMax, crit, aspd, bonusStats };
  }

  function applyDerivedToChar() {
    const d = derived(game.char);
    game.char.hpMax = d.hpMax;
    game.char.mpMax = d.mpMax;
    if (game.char.hp > d.hpMax) game.char.hp = d.hpMax;
    if (game.char.mp > d.mpMax) game.char.mp = d.mpMax;
  }

  // ============================================================
  // XP / LEVEL
  // ============================================================
  function xpForLevel(lv) { return Math.floor(40 * Math.pow(lv, 1.55)); }
  function gainXp(amount) {
    const c = game.char;
    c.xp += amount;
    floatText(`+${amount} XP`, game.world.player.x, game.world.player.y, 'xp');
    while (c.xp >= xpForLevel(c.level)) {
      c.xp -= xpForLevel(c.level);
      c.level += 1;
      c.statPoints += 3;
      applyDerivedToChar();
      c.hp = c.hpMax;
      c.mp = c.mpMax;
      navigateTo('levelup');
      $('levelup-sub').textContent =
        `You are now level ${c.level}. +3 stat points. HP/MP restored.`;
    }
    saveGame();
    updateHud();
  }

  // ============================================================
  // ITEM GENERATION
  // ============================================================
  function rollAffix(rarity, ilvl) {
    const pool = AFFIXES.filter(a => a.rarities.includes(rarity));
    const a = pick(pool);
    const val = 1 + Math.floor(rand() * Math.min(a.max, 1 + ilvl));
    return { key: a.key, label: a.label, val };
  }

  function rollItem(ilvl, rarityOverride) {
    const eligible = Object.keys(ITEM_BASES).filter(k => ITEM_BASES[k].ilvl <= ilvl + 1);
    if (eligible.length === 0) return null;
    const baseId = pick(eligible);
    const base = ITEM_BASES[baseId];
    const rarity = rarityOverride || chance(RARITY_WEIGHTS);
    const affixCount = rarity === 'common' ? 0
                      : rarity === 'magic'  ? 1
                      : rarity === 'rare'   ? (1 + irand(1, 2))
                      : 4;
    const affixes = [];
    const usedKeys = new Set();
    for (let i = 0; i < affixCount; i++) {
      let af = rollAffix(rarity, ilvl);
      let tries = 0;
      while (usedKeys.has(af.key) && tries++ < 6) af = rollAffix(rarity, ilvl);
      if (usedKeys.has(af.key)) continue;
      usedKeys.add(af.key);
      affixes.push(af);
    }
    return {
      id: 'i_' + Math.random().toString(36).slice(2, 9),
      baseId,
      rarity,
      affixes,
      ilvl,
      name: buildItemName(base, rarity, affixes),
    };
  }

  function buildItemName(base, rarity, affixes) {
    if (rarity === 'common') return base.name;
    if (rarity === 'magic') {
      const af = affixes[0];
      const prefix = af ? prefixForAffix(af.key) : '';
      return `${prefix} ${base.name}`.trim();
    }
    if (rarity === 'rare') {
      return rareName(base.name);
    }
    // unique
    return uniqueName(base.name);
  }
  function prefixForAffix(k) {
    return ({
      dmg: 'Sharp', def: 'Sturdy', hp: 'Vital', mp: 'Arcane',
      str: 'Brutish', int: 'Wise', dex: 'Keen', vit: 'Hardy',
      crit: 'Lucky', aspd: 'Hasted',
    })[k] || 'Glassbound';
  }
  function rareName(base) {
    const a = pick(['Doomshard', 'Vexstone', 'Glassbite', 'Hexglass', 'Nightprism', 'Sunfracture', 'Soulwhisper']);
    const b = pick(['of the Crypt', 'of Embers', 'of Frost', 'of the Veil', 'of the Pyre', 'of Echoes']);
    return `${a} ${b}`;
  }
  function uniqueName(base) {
    return pick(['Glasspire Heart', 'Hollow Dawn', 'Sigil of the First', 'Tear of the Lich', 'Eye of the Wyrm']);
  }

  // ============================================================
  // WORLD GENERATION
  // ============================================================
  function makeGrid(w, h, fill) {
    const g = new Array(h);
    for (let y = 0; y < h; y++) {
      g[y] = new Array(w);
      for (let x = 0; x < w; x++) g[y][x] = fill;
    }
    return g;
  }

  function generateTown() {
    const W = 21, H = 17;
    const grid = makeGrid(W, H, 1);   // 1 = wall
    // Carve interior
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) grid[y][x] = 0;

    // A small plaza-like layout: center fountain, NPC stalls around
    const npcs = [
      { id: 'vendor',     name: 'Trader',     glyph: '☉', color: '#ffc857', x: 4,  y: 4,  role: 'vendor' },
      { id: 'stash',      name: 'Keeper',     glyph: '◈', color: '#6df1ff', x: 16, y: 4,  role: 'stash' },
      { id: 'quests',     name: 'Captain',    glyph: '✦', color: '#c489ff', x: 4,  y: 12, role: 'quests' },
      { id: 'waypoint',   name: 'Waystone',   glyph: '✪', color: '#51e6a4', x: 16, y: 12, role: 'waypoint' },
    ];
    // Center "fountain" decoration (block)
    grid[8][10] = 2; // 2 = decor
    // Corner pillars for atmosphere
    grid[3][3] = 2;
    grid[3][17] = 2;
    grid[13][3] = 2;
    grid[13][17] = 2;
    // Small alcoves near NPC stalls
    grid[4][7] = 2;
    grid[4][13] = 2;
    grid[12][7] = 2;
    grid[12][13] = 2;

    return {
      kind: 'town',
      name: 'Sanctuary',
      grid, w: W, h: H,
      player: { x: 10.5, y: 9.5, dir: 0, atkCd: 0, skillCd: 0, lastDir: { x: 0, y: 1 }, attackingFor: 0 },
      npcs,
      palette: { wall: '#ffc857', floor: '#221a14', accent: '#6df1ff' },
      portals: [],
    };
  }

  // Procedural dungeon: rooms-and-corridors
  function generateDungeon(biome, floor) {
    const W = 36, H = 36;
    const grid = makeGrid(W, H, 1);
    const rooms = [];
    const tries = 28;
    for (let i = 0; i < tries; i++) {
      const rw = irand(5, 9);
      const rh = irand(5, 9);
      const rx = irand(1, W - rw - 2);
      const ry = irand(1, H - rh - 2);
      const r = { x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) };
      // overlap check (with 1-tile margin)
      let overlap = false;
      for (const o of rooms) {
        if (rx - 1 < o.x + o.w && rx + rw + 1 > o.x && ry - 1 < o.y + o.h && ry + rh + 1 > o.y) {
          overlap = true; break;
        }
      }
      if (!overlap) {
        rooms.push(r);
        for (let y = ry; y < ry + rh; y++)
          for (let x = rx; x < rx + rw; x++)
            grid[y][x] = 0;
      }
    }
    // Connect rooms by L-shaped corridors
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      let x = a.cx, y = a.cy;
      while (x !== b.cx) { grid[y][x] = 0; x += Math.sign(b.cx - x); }
      while (y !== b.cy) { grid[y][x] = 0; y += Math.sign(b.cy - y); }
    }
    // Pick spawn (player) and exit
    const first = rooms[0];
    const last = rooms[rooms.length - 1];
    const isBossFloor = floor === CFG.biomeFloors;

    const portals = [];
    if (!isBossFloor) {
      portals.push({
        x: last.cx + 0.5, y: last.cy + 0.5,
        kind: 'next', label: `→ Floor ${floor + 1}`,
      });
    }
    portals.push({
      x: first.cx - 1.5, y: first.cy + 0.5,
      kind: 'town', label: '→ Sanctuary',
    });

    // Place enemies
    const enemies = [];
    const enemyPool = biome.enemies;
    const baseCount = 6 + floor * 2;
    for (const r of rooms.slice(1)) {
      const n = irand(1, 3);
      for (let i = 0; i < n; i++) {
        const ex = r.x + 1 + Math.floor(rand() * (r.w - 2)) + 0.5;
        const ey = r.y + 1 + Math.floor(rand() * (r.h - 2)) + 0.5;
        const id = pick(enemyPool);
        enemies.push(makeEnemy(id, ex, ey, floor));
      }
    }
    // Boss
    if (isBossFloor) {
      enemies.push(makeEnemy(biome.boss, last.cx + 0.5, last.cy + 0.5, floor + 2));
      game.bossAlive = true; game.bossKilled = false;
    } else {
      game.bossAlive = false;
    }

    return {
      kind: 'dungeon',
      name: `${biome.shortName} — Floor ${floor}${isBossFloor ? ' (Boss)' : ''}`,
      grid, w: W, h: H,
      player: { x: first.cx + 0.5, y: first.cy + 0.5, dir: 0, atkCd: 0, skillCd: 0, lastDir: { x: 0, y: 1 }, attackingFor: 0 },
      enemies,
      npcs: [],
      rooms,
      portals,
      palette: biome.palette,
      biomeId: biome.id,
      floor,
      isBoss: isBossFloor,
    };
  }

  function makeEnemy(id, x, y, levelHint) {
    const base = ENEMIES[id];
    const lvlScale = 1 + Math.max(0, levelHint - 1) * 0.18;
    return {
      id,
      x, y,
      hp: Math.floor(base.hp * lvlScale),
      hpMax: Math.floor(base.hp * lvlScale),
      dmg: Math.floor(base.dmg * lvlScale),
      speed: base.speed,
      range: base.range,
      attackKind: base.attackKind,
      xp: Math.floor(base.xp * lvlScale),
      goldRange: base.goldRange,
      name: base.name,
      color: base.color,
      glyph: base.glyph,
      atkCd: 0.8 + rand() * 0.6,
      hitFlash: 0,
      frozen: 0,
      stagger: 0,
      boss: !!base.boss,
      ilvl: levelHint,
    };
  }

  // ============================================================
  // ENTERING WORLDS
  // ============================================================
  function snapCamera() {
    // instantly position camera on player (no lerp) for zone transitions
    const p = game.world.player;
    const halfW = CFG.canvas / 2 / CFG.tile;
    const halfH = CFG.canvas / 2 / CFG.tile;
    game.cam.x = clamp(p.x - halfW, 0, Math.max(0, game.world.w - halfW * 2));
    game.cam.y = clamp(p.y - halfH, 0, Math.max(0, game.world.h - halfH * 2));
  }
  function enterTown() {
    game.world = generateTown();
    game.enemies = [];
    game.projectiles = [];
    game.items = [];
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    game.activeBiomeId = null;
    game.activeFloor = 0;
    snapCamera();
    navigateTo('game');
    showZoneToast('SANCTUARY');
    updateHud();
  }
  function enterBiome(biomeId, floor) {
    floor = floor || 1;
    const biome = BIOMES.find(b => b.id === biomeId);
    if (!biome) return;
    game.world = generateDungeon(biome, floor);
    game.enemies = game.world.enemies; game.world.enemies = null;
    game.projectiles = [];
    game.items = [];
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    game.activeBiomeId = biomeId;
    game.activeFloor = floor;
    snapCamera();
    navigateTo('game');
    showZoneToast(`${biome.shortName} — FLOOR ${floor}`);
    updateHud();
  }

  // ============================================================
  // INPUT
  // ============================================================
  function setupInput() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (el) handleAction(el.dataset.action, el);
    });
  }

  function onKeyDown(e) {
    if (e.repeat) {
      // for in-game allow held-key auto move; for menus block repeat to keep nav clean
      if (game.screen !== 'game') return;
    }
    const key = e.key;
    const inGame = (game.screen === 'game');

    if (key === 'Escape') {
      if (inGame) {
        navigateTo('menu');
      } else {
        navigateBack();
      }
      e.preventDefault(); return;
    }

    if (inGame) {
      // record arrow taps into combo buffer (4-tap patterns won't fire accidentally)
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key) && !e.repeat) {
        const now = performance.now();
        const ch = key.replace('Arrow','').toLowerCase();
        // gap filter to reject key-repeat ghosts
        if (game.comboBuffer.length === 0 || (now - game.lastKeyTime) > CFG.minComboGap) {
          if ((now - game.lastKeyTime) > CFG.comboWindow) game.comboBuffer.length = 0;
          game.comboBuffer.push({ ch, t: now });
          game.lastKeyTime = now;
          tryCombo();
        }
      }
      // movement keys
      if (key === 'ArrowUp')    { game.keys.up = true;    e.preventDefault(); }
      if (key === 'ArrowDown')  { game.keys.down = true;  e.preventDefault(); }
      if (key === 'ArrowLeft')  { game.keys.left = true;  e.preventDefault(); }
      if (key === 'ArrowRight') { game.keys.right = true; e.preventDefault(); }
      if (key === 'Enter')      { onPinch(); e.preventDefault(); }
      return;
    }

    // Menu screens
    switch (key) {
      case 'ArrowUp':    moveFocus('up');    e.preventDefault(); break;
      case 'ArrowDown':  moveFocus('down');  e.preventDefault(); break;
      case 'ArrowLeft':  moveFocus('left');  e.preventDefault(); break;
      case 'ArrowRight': moveFocus('right'); e.preventDefault(); break;
      case 'Enter':
        if (document.activeElement && document.activeElement.classList.contains('focusable')) {
          document.activeElement.click();
        }
        e.preventDefault();
        break;
    }
  }
  function onKeyUp(e) {
    if (game.screen !== 'game') return;
    if (e.key === 'ArrowUp')    game.keys.up = false;
    if (e.key === 'ArrowDown')  game.keys.down = false;
    if (e.key === 'ArrowLeft')  game.keys.left = false;
    if (e.key === 'ArrowRight') game.keys.right = false;
  }

  function tryCombo() {
    const b = game.comboBuffer;
    if (b.length < 3) return;
    // prune stale entries outside combo window
    const now = b[b.length - 1].t;
    while (b.length > 0 && (now - b[0].t) > CFG.comboWindow * 2) b.shift();

    let matched = false;

    // 4-tap patterns: require intentional wiggle so normal movement never triggers
    if (b.length >= 4) {
      const last4 = b.slice(-4).map(e => e.ch).join(',');
      const span = b[b.length - 1].t - b[b.length - 4].t;
      if (span <= CFG.comboWindow * 2) {
        if (last4 === 'up,down,up,down')       { matched = true; openInGameMenu(); }
        else if (last4 === 'left,right,left,right') { matched = true; drinkPotion(); }
      }
    }

    // 3-tap same direction = dash in THAT direction (must be quick)
    if (!matched && b.length >= 3) {
      const last3 = b.slice(-3).map(e => e.ch);
      const span3 = b[b.length - 1].t - b[b.length - 3].t;
      if (span3 <= CFG.comboWindow && last3[0] === last3[1] && last3[1] === last3[2]) {
        const dir = last3[0];
        const dashDir = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} }[dir];
        if (dashDir) { matched = true; tryDash(dashDir.x, dashDir.y); }
      }
    }

    if (matched) {
      game.comboBuffer.length = 0;
    }
  }

  function openInGameMenu() { navigateTo('menu'); }
  function drinkPotion() {
    const c = game.char;
    if (c.potions <= 0) { showHudToast('No potions.'); return; }
    if (c.hp >= c.hpMax) { showHudToast('Already full.'); return; }
    c.potions -= 1;
    const heal = Math.floor(c.hpMax * 0.4);
    c.hp = Math.min(c.hpMax, c.hp + heal);
    floatText(`+${heal}`, game.world.player.x, game.world.player.y, 'heal');
    showHudToast(`Potion used. ${c.potions} left.`);
    saveGame();
    updateHud();
  }
  function tryDash(dirX, dirY) {
    const p = game.world.player;
    if (p.dashCd && p.dashCd > 0) return;
    // use provided direction (from triple-tap), fallback to last facing
    const dx = dirX !== undefined ? dirX : p.lastDir.x;
    const dy = dirY !== undefined ? dirY : p.lastDir.y;
    if (dx === 0 && dy === 0) return; // no direction
    // teleport forward 3.5 tiles — but stop at first wall
    const steps = 10;
    let nx = p.x, ny = p.y;
    for (let i = 1; i <= steps; i++) {
      const tx = p.x + dx * 3.5 * (i / steps);
      const ty = p.y + dy * 3.5 * (i / steps);
      const gx = Math.floor(clamp(tx, 0, game.world.w - 1));
      const gy = Math.floor(clamp(ty, 0, game.world.h - 1));
      if (game.world.grid[gy][gx] !== 0) break;
      nx = tx; ny = ty;
    }
    if (nx === p.x && ny === p.y) return; // no movement possible
    // particle trail
    for (let i = 0; i < 10; i++) {
      pushParticle(lerp(p.x, nx, i / 10), lerp(p.y, ny, i / 10), '#6df1ff', 0.4);
    }
    p.x = nx; p.y = ny;
    p.dashCd = 2.0;
  }

  // ============================================================
  // PINCH: context-sensitive
  // ============================================================
  function onPinch() {
    if (game.nearbyNpc) { openNpc(game.nearbyNpc); return; }
    if (game.nearbyPortal) { activatePortal(game.nearbyPortal); return; }
    if (game.nearbyItem) { pickupItem(game.nearbyItem); return; }
    castActiveSkill();
  }

  function openNpc(npc) {
    if (npc.role === 'vendor') { openVendor(); }
    else if (npc.role === 'stash') { openStash(); }
    else if (npc.role === 'quests') { openQuests(); }
    else if (npc.role === 'waypoint') { openWaypoint(); }
  }

  function activatePortal(p) {
    if (p.kind === 'next') {
      const next = game.activeFloor + 1;
      enterBiome(game.activeBiomeId, next);
    } else if (p.kind === 'town') {
      enterTown();
    }
  }

  // ============================================================
  // ACTIVE SKILL
  // ============================================================
  function castActiveSkill() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const skill = SKILLS[cls.activeSkill];
    const p = game.world.player;
    if (p.skillCd > 0) { showHudToast(`Skill cooling: ${p.skillCd.toFixed(1)}s`); return; }
    if (c.mp < cls.activeSkillCost) { showHudToast('Not enough mana'); return; }
    c.mp -= cls.activeSkillCost;
    p.skillCd = skill.cooldown;

    if (cls.activeSkill === 'whirlwind') {
      const radius = 2.4;
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 2.2);
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      for (const e of targets) hitEnemy(e, dmg, d.crit);
      // ring of particles spinning outward
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * PI2;
        const r = 0.8 + rand() * 0.6;
        addParticle({
          x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
          vx: Math.cos(a) * 4, vy: Math.sin(a) * 4,
          color: '#ff4d6d', life: 0.3 + rand() * 0.2, age: 0, size: 2 + rand() * 2,
        });
      }
      burst(p.x, p.y, '#ffffff', 10);
      game.screenShake = Math.max(game.screenShake, 0.22);
    }
    else if (cls.activeSkill === 'frostnova') {
      const radius = 3.5;
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 1.8);
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      for (const e of targets) { hitEnemy(e, dmg, d.crit); if (e.hp > 0) e.frozen = Math.max(e.frozen, 1.8); }
      // expanding frost ring
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * PI2;
        const sp = 4 + rand() * 3;
        addParticle({
          x: p.x, y: p.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          color: i % 3 === 0 ? '#ffffff' : '#6df1ff', life: 0.5 + rand() * 0.3, age: 0, size: 2 + rand() * 2,
        });
      }
      game.screenShake = Math.max(game.screenShake, 0.15);
    }
    else if (cls.activeSkill === 'multishot') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 0.8);
      const dir = p.lastDir.x || p.lastDir.y ? p.lastDir : { x: 0, y: 1 };
      const baseAng = Math.atan2(dir.y, dir.x);
      for (let i = -2; i <= 2; i++) {
        const a = baseAng + i * 0.12;
        spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), 11, dmg, '#51e6a4', 'arrow', true);
      }
      // muzzle flash
      burst(p.x + dir.x * 0.3, p.y + dir.y * 0.3, '#51e6a4', 8);
    }
    else if (cls.activeSkill === 'raisedead') {
      for (let i = 0; i < 2; i++) {
        const angle = rand() * PI2;
        game.minions.push({
          x: p.x + Math.cos(angle) * 0.6,
          y: p.y + Math.sin(angle) * 0.6,
          hp: 40, hpMax: 40,
          dmg: Math.floor(derived(c).dmg * 0.5),
          ttl: 12,
          speed: 3.2,
          atkCd: 0,
          range: 1.0,
          target: null,
        });
      }
      // summoning circle effect
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI2;
        addParticle({
          x: p.x + Math.cos(a) * 0.8, y: p.y + Math.sin(a) * 0.8,
          vx: 0, vy: -1 - rand() * 2,
          color: '#c489ff', life: 0.6 + rand() * 0.4, age: 0, size: 1.5 + rand(),
        });
      }
      burst(p.x, p.y, '#c489ff', 12);
    }
    updateHud();
  }

  // ============================================================
  // COMBAT — auto-attack tick
  // ============================================================
  function autoAttackTick(dt) {
    const p = game.world.player;
    p.atkCd = Math.max(0, p.atkCd - dt);
    if (p.atkCd > 0) return;
    if (game.world.kind === 'town') return;
    const c = game.char;
    const cls = CLASSES[c.classId];
    const d = derived(c);
    const interval = 1 / d.aspd;

    // pick nearest enemy in range
    const range = cls.attackRange + CFG.autoAttackPad;
    let near = null, nd = Infinity;
    for (const e of game.enemies) {
      const dd = dist(e, p);
      if (dd <= range && dd < nd) { near = e; nd = dd; }
    }
    if (!near) return;

    // face the target
    const dx = near.x - p.x, dy = near.y - p.y;
    const len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    p.lastDir.x = dx / len; p.lastDir.y = dy / len;
    p.attackingFor = 0.12;

    if (cls.attackKind === 'cleave') {
      // hit all enemies within shorter arc range
      const arc = 1.6;
      const cleaveTargets = game.enemies.filter(e => dist(e, p) <= arc);
      for (const e of cleaveTargets) hitEnemy(e, d.dmg, d.crit);
      // sweeping arc particles
      const atkAngle = Math.atan2(dy, dx);
      for (let i = 0; i < 8; i++) {
        const a = atkAngle + (i - 4) * 0.2;
        const r = 0.6 + rand() * 0.5;
        addParticle({
          x: p.x + Math.cos(a) * r,
          y: p.y + Math.sin(a) * r,
          vx: Math.cos(a) * 2, vy: Math.sin(a) * 2,
          color: CLASSES[c.classId].color, life: 0.2 + rand() * 0.15, age: 0, size: 2 + rand(),
        });
      }
      burst(p.x + dx / len * 0.6, p.y + dy / len * 0.6, CLASSES[c.classId].color, 5);
    }
    else if (cls.attackKind === 'projectile-bolt') {
      spawnProjectile(p.x, p.y, dx / len, dy / len, 11, d.dmg, '#6df1ff', 'bolt', true);
    }
    else if (cls.attackKind === 'projectile-arrow') {
      spawnProjectile(p.x, p.y, dx / len, dy / len, 13, d.dmg, '#cfe7c0', 'arrow', true);
    }
    else if (cls.attackKind === 'projectile-bone') {
      spawnProjectile(p.x, p.y, dx / len, dy / len, 9, d.dmg, '#c489ff', 'bone', true);
    }

    p.atkCd = interval;
  }

  function hitEnemy(e, baseDmg, critPct) {
    const isCrit = roll((critPct || 5) / 100);
    const dmg = Math.max(1, Math.floor(baseDmg * (isCrit ? 1.8 : 1) * (0.85 + rand() * 0.3)));
    e.hp -= dmg;
    e.hitFlash = 0.18;
    e.stagger = Math.max(e.stagger, 0.12);
    floatText(`${dmg}`, e.x + (rand() - 0.5) * 0.3, e.y - 0.4, isCrit ? 'crit' : 'dmg');
    // hit spark particles (small — projectile collisions add their own burst)
    if (isCrit) {
      burst(e.x, e.y, '#ffc857', 10);
      game.screenShake = Math.max(game.screenShake, 0.1);
    } else {
      // minimal sparks for non-crit to avoid particle overload
      for (let i = 0; i < 3; i++) {
        const a = rand() * PI2;
        addParticle({
          x: e.x, y: e.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2,
          color: '#ffffff', life: 0.15 + rand() * 0.1, age: 0, size: 1 + rand(),
        });
      }
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    burst(e.x, e.y, e.color, e.boss ? 35 : 20);
    burst(e.x, e.y, '#ffffff', e.boss ? 12 : 5);
    game.screenShake = Math.max(game.screenShake, e.boss ? 0.45 : 0.12);
    gainXp(e.xp);
    const gold = irand(e.goldRange[0], e.goldRange[1]) * (e.boss ? 3 : 1);
    game.char.gold += gold;
    floatText(`+${gold}g`, e.x + 0.3, e.y - 0.2, 'loot');

    // Item drops — bosses + chance from normal
    const dropP = e.boss ? 1 : 0.15;
    if (roll(dropP)) {
      const item = rollItem(Math.max(1, e.ilvl), e.boss ? 'rare' : null);
      if (item) {
        game.items.push({ x: e.x, y: e.y, item, age: 0 });
      }
    }
    // gold piles for cosmetic pickup not needed — auto-credited

    // Quest progress
    if (game.save.quest && game.save.quest.target === e.id) {
      game.save.quest.progress = Math.min(game.save.quest.required, game.save.quest.progress + 1);
    }

    // Boss flag
    if (e.boss) {
      game.bossKilled = true;
      const biomeId = game.activeBiomeId;
      game.save.bossesKilled[biomeId] = (game.save.bossesKilled[biomeId] || 0) + 1;
      // unlock next biome
      const idx = BIOMES.findIndex(b => b.id === biomeId);
      if (idx >= 0 && idx + 1 < BIOMES.length) {
        const nxt = BIOMES[idx + 1].id;
        if (!game.save.unlockedBiomes[nxt]) {
          game.save.unlockedBiomes[nxt] = true;
          showHudToast(`UNLOCKED: ${BIOMES[idx + 1].name}`);
        }
      }
      // place a return-to-town portal where the boss fell
      game.world.portals.push({ x: e.x, y: e.y, kind: 'town', label: '→ Sanctuary' });
    }

    // remove from list
    const i = game.enemies.indexOf(e);
    if (i >= 0) game.enemies.splice(i, 1);

    saveGame();
  }

  // ============================================================
  // PROJECTILES
  // ============================================================
  function spawnProjectile(x, y, dx, dy, speed, dmg, color, kind, friendly) {
    game.projectiles.push({
      x, y, dx, dy, speed, dmg, color, kind, friendly,
      life: 1.6, age: 0,
    });
  }
  function tickProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      const p = game.projectiles[i];
      p.age += dt;
      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;
      let removed = false;
      // wall collision
      const gy = Math.floor(p.y), gx = Math.floor(p.x);
      if (gy < 0 || gy >= game.world.h || gx < 0 || gx >= game.world.w ||
          game.world.grid[gy][gx] !== 0) {
        game.projectiles.splice(i, 1); continue;
      }
      if (p.friendly) {
        for (const e of game.enemies) {
          if (dist(e, p) < 0.45) {
            hitEnemy(e, p.dmg, derived(game.char).crit);
            game.projectiles.splice(i, 1);
            burst(p.x, p.y, p.color, 8);
            removed = true;
            break;
          }
        }
        if (removed) continue;
      } else {
        const pl = game.world.player;
        if (dist(pl, p) < 0.45) {
          damagePlayer(p.dmg);
          game.projectiles.splice(i, 1);
          burst(p.x, p.y, p.color, 8);
          continue;
        }
      }
      if (p.age > p.life) game.projectiles.splice(i, 1);
    }
  }

  // ============================================================
  // ENEMY AI
  // ============================================================
  function tickEnemies(dt) {
    if (!game.world || game.world.kind !== 'dungeon') return;
    const p = game.world.player;
    for (const e of game.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.frozen = Math.max(0, e.frozen - dt);
      e.stagger = Math.max(0, e.stagger - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);
      if (e.frozen > 0) continue;
      if (e.stagger > 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 12) continue; // out of awareness

      // melee: chase to range. ranged: keep distance, attack from range.
      if (e.attackKind === 'melee') {
        if (d > e.range * 0.9) {
          const speed = e.speed * dt;
          tryMove(e, dx / d * speed, dy / d * speed);
        } else if (e.atkCd <= 0) {
          // melee swing
          damagePlayer(e.dmg);
          burst(p.x, p.y, '#ff4d6d', 6);
          e.atkCd = 1.2;
        }
      } else {
        // ranged: try to maintain mid-range
        const ideal = e.range * 0.7;
        if (d > ideal + 0.5) {
          const speed = e.speed * dt;
          tryMove(e, dx / d * speed, dy / d * speed);
        } else if (d < ideal - 0.5) {
          const speed = e.speed * dt * 0.6;
          tryMove(e, -dx / d * speed, -dy / d * speed);
        }
        if (d < e.range && e.atkCd <= 0) {
          spawnProjectile(e.x, e.y, dx / d, dy / d, 6.5, e.dmg, '#c489ff', 'soul', false);
          e.atkCd = 2.0 + rand() * 0.6;
        }
      }
    }
  }

  function tryMove(ent, vx, vy) {
    const w = game.world;
    const nx = ent.x + vx, ny = ent.y + vy;
    const gx = Math.floor(nx), gy = Math.floor(ny);
    const ex = Math.floor(ent.x), ey = Math.floor(ent.y);
    // X-axis movement
    if (gx >= 0 && gx < w.w && ey >= 0 && ey < w.h && w.grid[ey][gx] === 0) ent.x = nx;
    // Y-axis movement (re-check with updated ent.x)
    const ex2 = Math.floor(ent.x);
    if (gy >= 0 && gy < w.h && ex2 >= 0 && ex2 < w.w && w.grid[gy][ex2] === 0) ent.y = ny;
  }

  // ============================================================
  // MINION AI (summoner pets)
  // ============================================================
  function tickMinions(dt) {
    for (let i = game.minions.length - 1; i >= 0; i--) {
      const m = game.minions[i];
      m.ttl -= dt;
      m.atkCd = Math.max(0, m.atkCd - dt);
      if (m.ttl <= 0) { burst(m.x, m.y, '#c489ff', 10); game.minions.splice(i, 1); continue; }
      // find target
      let near = null, nd = Infinity;
      for (const e of game.enemies) {
        const d = dist(e, m); if (d < nd) { nd = d; near = e; }
      }
      m.target = near;
      if (!near) continue;
      const dx = near.x - m.x, dy = near.y - m.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > m.range * 0.95) {
        tryMove(m, dx / d * m.speed * dt, dy / d * m.speed * dt);
      } else if (m.atkCd <= 0) {
        hitEnemy(near, m.dmg, 5);
        m.atkCd = 0.9;
      }
    }
  }

  // ============================================================
  // PLAYER DAMAGE / DEATH
  // ============================================================
  function damagePlayer(rawDmg) {
    if (game.char.hp <= 0) return; // already dead — prevent multiple death triggers
    const d = derived(game.char);
    const dmg = Math.max(1, Math.floor(rawDmg - d.def * 0.5));
    game.char.hp -= dmg;
    floatText(`-${dmg}`, game.world.player.x + (rand() - 0.5) * 0.3, game.world.player.y - 0.4, 'crit');
    game.screenShake = Math.max(game.screenShake, 0.1);
    game.damageFlash = 0.15; // red flash timer
    burst(game.world.player.x, game.world.player.y, '#ff4d6d', 6);
    updateHud();
    if (game.char.hp <= 0) onDeath();
  }
  function onDeath() {
    game.char.hp = 0;
    saveGame();
    navigateTo('death');
  }

  // ============================================================
  // FLOATING TEXT / PARTICLES
  // ============================================================
  function floatText(text, wx, wy, kind) {
    game.floatingTexts.push({ text, wx, wy, kind: kind || 'dmg', age: 0, life: 0.9 });
  }
  const MAX_PARTICLES = 180;
  function addParticle(p) {
    if (game.particles.length < MAX_PARTICLES) game.particles.push(p);
  }
  function burst(wx, wy, color, count) {
    // cap total particles to prevent performance degradation
    const room = MAX_PARTICLES - game.particles.length;
    const actual = Math.min(count, Math.max(0, room - 1));
    for (let i = 0; i < actual; i++) {
      const a = rand() * PI2;
      const sp = 1.5 + rand() * 3.5;
      game.particles.push({
        x: wx + (rand() - 0.5) * 0.2,
        y: wy + (rand() - 0.5) * 0.2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand() * 1.5,
        color, life: 0.35 + rand() * 0.4, age: 0,
        size: 1 + rand() * 2.5,
      });
    }
    // add a brief white flash at center for impact
    if (game.particles.length < MAX_PARTICLES) {
      game.particles.push({
        x: wx, y: wy, vx: 0, vy: 0,
        color: '#ffffff', life: 0.12, age: 0, size: 4,
      });
    }
  }
  function pushParticle(wx, wy, color, life) {
    if (game.particles.length >= MAX_PARTICLES) return;
    game.particles.push({ x: wx, y: wy, vx: 0, vy: 0, color, life, age: 0, size: 2 });
  }
  function tickEffects(dt) {
    // floating text
    for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
      const t = game.floatingTexts[i];
      t.age += dt;
      if (t.age >= t.life) game.floatingTexts.splice(i, 1);
    }
    // particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      if (p.age >= p.life) game.particles.splice(i, 1);
    }
    game.screenShake = Math.max(0, game.screenShake - dt);
    game.damageFlash = Math.max(0, game.damageFlash - dt);
  }

  // ============================================================
  // MOVEMENT — step impulse ensures each tap moves a meaningful distance
  // ============================================================
  function tickPlayer(dt) {
    const p = game.world.player;
    let vx = 0, vy = 0;

    // Track active input direction
    if (game.keys.up)    vy -= 1;
    if (game.keys.down)  vy += 1;
    if (game.keys.left)  vx -= 1;
    if (game.keys.right) vx += 1;

    // Step impulse: when a key is pressed, guarantee movement for at least stepImpulse seconds
    // even if the key is released immediately (common with glasses D-pad taps)
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      p._impulseX = vx / len;
      p._impulseY = vy / len;
      p._impulseT = CFG.stepImpulse;
    }

    // Apply movement: either from held keys or remaining impulse
    if (p._impulseT > 0) {
      const mx = p._impulseX || 0;
      const my = p._impulseY || 0;
      if (mx !== 0 || my !== 0) {
        p.lastDir.x = mx; p.lastDir.y = my;
        const sp = CFG.playerSpeed * dt;
        tryMove(p, mx * sp, my * sp);
      }
      // Only consume impulse when keys are released
      if (vx === 0 && vy === 0) {
        p._impulseT -= dt;
      }
    }

    p.skillCd = Math.max(0, p.skillCd - dt);
    if (p.dashCd !== undefined) p.dashCd = Math.max(0, p.dashCd - dt);
    p.attackingFor = Math.max(0, p.attackingFor - dt);

    // passive mana regen
    if (game.char.mp < game.char.mpMax) {
      game.char.mp = Math.min(game.char.mpMax, game.char.mp + dt * 2.2);
    }
  }

  function tickInteraction() {
    if (!game.world) return;
    const p = game.world.player;
    // NPC nearby
    let near = null, nd = 1.4;
    if (game.world.npcs) {
      for (const n of game.world.npcs) {
        const d = dist({ x: n.x + 0.5, y: n.y + 0.5 }, p);
        if (d < nd) { nd = d; near = n; }
      }
    }
    game.nearbyNpc = near;
    // Portal
    let pn = null, pd = 0.9;
    if (game.world.portals) {
      for (const po of game.world.portals) {
        const d = dist(po, p);
        if (d < pd) { pd = d; pn = po; }
      }
    }
    game.nearbyPortal = pn;
    // Item — auto-pickup if close
    let it = null, idx = -1;
    for (let i = 0; i < game.items.length; i++) {
      const gi = game.items[i];
      if (dist(gi, p) < 0.6) { it = gi; idx = i; break; }
    }
    if (it && game.char.inventory.length < 24) {
      game.items.splice(idx, 1);
      game.char.inventory.push(it.item);
      floatText(`+ ${it.item.name}`, it.x, it.y - 0.4, 'loot');
      saveGame();
    }
    game.nearbyItem = null;
  }

  function pickupItem() { /* handled by tickInteraction auto-pickup */ }

  // ============================================================
  // CAMERA — smooth lerp so it doesn't jerk at boundaries
  // ============================================================
  function updateCamera() {
    const p = game.world.player;
    const halfW = CFG.canvas / 2 / CFG.tile;
    const halfH = CFG.canvas / 2 / CFG.tile;
    let tx = p.x - halfW;
    let ty = p.y - halfH;
    tx = clamp(tx, 0, Math.max(0, game.world.w - halfW * 2));
    ty = clamp(ty, 0, Math.max(0, game.world.h - halfH * 2));
    // smooth follow — fast enough to feel locked but prevents jerky snaps
    const speed = 0.18; // lower = smoother, higher = snappier
    game.cam.x += (tx - game.cam.x) * speed;
    game.cam.y += (ty - game.cam.y) * speed;
  }

  // ============================================================
  // RENDER
  // ============================================================
  let ctx;
  function setupRender() {
    const canvas = $('game-canvas');
    canvas.width = CFG.canvas; canvas.height = CFG.canvas;
    ctx = canvas.getContext('2d');
  }

  // ============================================================
  // AMBIENT PARTICLES (biome atmosphere)
  // ============================================================
  const ambientParticles = [];
  function tickAmbient(dt) {
    const biomeId = game.world && game.world.biomeId;
    const isTown = game.world && game.world.kind === 'town';
    // spawn
    if (ambientParticles.length < 35) {
      const cx = game.cam.x + CFG.canvas / CFG.tile / 2;
      const cy = game.cam.y + CFG.canvas / CFG.tile / 2;
      const a = {
        x: cx + (rand() - 0.5) * 22,
        y: cy + (rand() - 0.5) * 22,
        vx: 0, vy: 0,
        size: 1 + rand() * 2,
        life: 3 + rand() * 4, age: 0,
        alpha: 0.15 + rand() * 0.25,
        kind: 'dot',
        color: '#ffffff',
      };
      if (biomeId === 'crypts') {
        a.color = '#c489ff'; a.vy = -0.3 - rand() * 0.3; a.kind = 'wisp';
        a.size = 1.5 + rand(); a.alpha = 0.2 + rand() * 0.15;
      } else if (biomeId === 'overgrowth') {
        a.color = '#51e6a4'; a.vy = 0.2 + rand() * 0.3; a.vx = (rand() - 0.5) * 0.4;
        a.kind = 'leaf'; a.size = 2 + rand(); a.alpha = 0.25;
      } else if (biomeId === 'frostpeak') {
        a.color = '#ffffff'; a.vy = 0.5 + rand() * 0.5; a.vx = (rand() - 0.5) * 0.3;
        a.kind = 'snow'; a.size = 1.5 + rand() * 1.5; a.alpha = 0.3 + rand() * 0.2;
      } else if (biomeId === 'infernal') {
        a.color = '#ff7043'; a.vy = -0.6 - rand() * 0.4; a.vx = (rand() - 0.5) * 0.5;
        a.kind = 'ember'; a.size = 1 + rand() * 1.5; a.alpha = 0.4 + rand() * 0.3;
      } else if (isTown) {
        a.color = '#ffc857'; a.vy = -0.15 - rand() * 0.2; a.kind = 'firefly';
        a.size = 1.5; a.alpha = 0.2 + rand() * 0.2;
      }
      ambientParticles.push(a);
    }
    // tick
    for (let i = ambientParticles.length - 1; i >= 0; i--) {
      const p = ambientParticles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'firefly') {
        p.vx = Math.sin(p.age * 2 + p.x) * 0.3;
      }
      if (p.age >= p.life) ambientParticles.splice(i, 1);
    }
  }
  function drawAmbient() {
    for (const p of ambientParticles) {
      const s = w2s(p.x, p.y);
      if (s.x < -20 || s.x > 620 || s.y < -20 || s.y > 620) continue;
      const t = 1 - p.age / p.life;
      const fadeIn = Math.min(1, p.age * 4);
      const alpha = p.alpha * t * fadeIn;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'ember' || p.kind === 'wisp') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
      }
      if (p.kind === 'snow') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size * 0.5, 0, PI2);
        ctx.fill();
      } else if (p.kind === 'leaf') {
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 1.5);
        ctx.fillRect(-p.size * 0.5, -1, p.size, 2);
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size * 0.5, 0, PI2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function render() {
    if (!ctx || !game.world) return;
    const W = CFG.canvas, H = CFG.canvas;
    ctx.clearRect(0, 0, W, H);

    // screen shake
    const shake = game.screenShake;
    let sx = 0, sy = 0;
    if (shake > 0) {
      sx = (rand() - 0.5) * shake * 16;
      sy = (rand() - 0.5) * shake * 16;
    }
    ctx.save();
    ctx.translate(sx, sy);

    drawWorld();
    drawAmbient();
    drawItems();
    drawPortals();
    drawNpcs();
    drawProjectiles();
    drawMinions();
    drawEnemies();
    drawPlayer();
    drawParticles();
    drawInteractionHints();
    drawVignette();

    ctx.restore();

    drawFloatingTexts();
    drawMinimap();
  }

  function w2s(wx, wy) {
    return { x: (wx - game.cam.x) * CFG.tile, y: (wy - game.cam.y) * CFG.tile };
  }

  function drawWorld() {
    const w = game.world;
    const t = CFG.tile;
    const startX = Math.max(0, Math.floor(game.cam.x));
    const startY = Math.max(0, Math.floor(game.cam.y));
    const endX = Math.min(w.w, Math.ceil(game.cam.x + CFG.canvas / t) + 1);
    const endY = Math.min(w.h, Math.ceil(game.cam.y + CFG.canvas / t) + 1);
    const biome = w.biomeId || 'town';
    const now = performance.now();

    // ---- Floor tiles with procedural patterns ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] === 0) {
          const s = w2s(x, y);
          // base floor fill
          ctx.fillStyle = w.palette.floor;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(s.x, s.y, t, t);
          ctx.globalAlpha = 1;

          // Biome-specific floor details (stone cracks, tiles, etc.)
          const hash = (x * 73 + y * 41) & 0xFF;
          if (biome === 'crypts' || biome === 'town') {
            // stone floor — grid lines
            ctx.strokeStyle = w.palette.wall;
            ctx.globalAlpha = 0.08;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(s.x + 0.5, s.y + 0.5, t - 1, t - 1);
            // random cracks
            if (hash % 7 === 0) {
              ctx.globalAlpha = 0.12;
              ctx.beginPath();
              ctx.moveTo(s.x + t * 0.2, s.y + t * 0.3);
              ctx.lineTo(s.x + t * 0.6, s.y + t * 0.7);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (biome === 'overgrowth') {
            // mossy patches
            if (hash % 5 === 0) {
              ctx.fillStyle = '#2a5a2a';
              ctx.globalAlpha = 0.25;
              ctx.beginPath();
              ctx.arc(s.x + t * 0.5, s.y + t * 0.5, t * 0.3, 0, PI2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            // vine tendrils
            if (hash % 11 === 0) {
              ctx.strokeStyle = '#3a8a3a';
              ctx.globalAlpha = 0.2;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(s.x, s.y + t * (hash % 3) * 0.3);
              ctx.quadraticCurveTo(s.x + t * 0.5, s.y + t * 0.5, s.x + t, s.y + t * 0.7);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          } else if (biome === 'frostpeak') {
            // ice crystal patterns
            if (hash % 8 === 0) {
              ctx.strokeStyle = '#a0e0ff';
              ctx.globalAlpha = 0.12;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              const cx = s.x + t * 0.5, cy = s.y + t * 0.5;
              for (let a = 0; a < 6; a++) {
                const angle = a * Math.PI / 3;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * t * 0.35, cy + Math.sin(angle) * t * 0.35);
              }
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          } else if (biome === 'infernal') {
            // lava cracks
            if (hash % 6 === 0) {
              ctx.strokeStyle = '#ff4400';
              ctx.globalAlpha = 0.25 + 0.1 * Math.sin(now / 500 + hash);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(s.x + t * 0.1, s.y + t * 0.5);
              ctx.lineTo(s.x + t * 0.4, s.y + t * 0.3);
              ctx.lineTo(s.x + t * 0.8, s.y + t * 0.6);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    // ---- Floor accent sparkles ----
    ctx.fillStyle = w.palette.accent;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] === 0 && ((x * 73 + y * 41) % 17 === 0)) {
          const s = w2s(x + 0.4, y + 0.6);
          const twinkle = 0.1 + 0.1 * Math.sin(now / 800 + x * 3.7 + y * 2.3);
          ctx.globalAlpha = twinkle;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.2, 0, PI2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    // ---- Walls — line-art glow edges with corners ----
    ctx.strokeStyle = w.palette.wall;
    ctx.lineWidth = 2;
    ctx.shadowColor = w.palette.wall;
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] !== 0 && w.grid[y][x] !== 2) {
          const s = w2s(x, y);
          const isFloor = (nx, ny) =>
            ny >= 0 && ny < w.h && nx >= 0 && nx < w.w && w.grid[ny][nx] === 0;
          const top = isFloor(x, y - 1);
          const bottom = isFloor(x, y + 1);
          const left = isFloor(x - 1, y);
          const right = isFloor(x + 1, y);
          if (top) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + t, s.y); ctx.stroke(); }
          if (bottom) { ctx.beginPath(); ctx.moveTo(s.x, s.y + t); ctx.lineTo(s.x + t, s.y + t); ctx.stroke(); }
          if (left) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + t); ctx.stroke(); }
          if (right) { ctx.beginPath(); ctx.moveTo(s.x + t, s.y); ctx.lineTo(s.x + t, s.y + t); ctx.stroke(); }
          // corner accents where two edges meet
          if (top && left)   { ctx.fillStyle = w.palette.wall; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, PI2); ctx.fill(); ctx.globalAlpha = 1; }
          if (top && right)  { ctx.fillStyle = w.palette.wall; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(s.x + t, s.y, 2.5, 0, PI2); ctx.fill(); ctx.globalAlpha = 1; }
          if (bottom && left) { ctx.fillStyle = w.palette.wall; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(s.x, s.y + t, 2.5, 0, PI2); ctx.fill(); ctx.globalAlpha = 1; }
          if (bottom && right){ ctx.fillStyle = w.palette.wall; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(s.x + t, s.y + t, 2.5, 0, PI2); ctx.fill(); ctx.globalAlpha = 1; }
        }
      }
    }
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';

    // ---- Decor blocks (town fountain etc) ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] === 2) {
          const s = w2s(x, y);
          // animated fountain glow
          const pulse = 0.5 + 0.3 * Math.sin(now / 600);
          ctx.fillStyle = w.palette.accent;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(s.x + t / 2, s.y + t / 2, t * 0.6, 0, PI2);
          ctx.fill();
          ctx.globalAlpha = pulse * 0.5;
          ctx.fillRect(s.x + 6, s.y + 6, t - 12, t - 12);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = w.palette.accent;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = w.palette.accent;
          ctx.shadowBlur = 8;
          ctx.strokeRect(s.x + 5, s.y + 5, t - 10, t - 10);
          // inner diamond shape
          ctx.beginPath();
          ctx.moveTo(s.x + t / 2, s.y + 4);
          ctx.lineTo(s.x + t - 4, s.y + t / 2);
          ctx.lineTo(s.x + t / 2, s.y + t - 4);
          ctx.lineTo(s.x + 4, s.y + t / 2);
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  function drawPortals() {
    if (!game.world.portals) return;
    const now = performance.now();
    for (const p of game.world.portals) {
      const s = w2s(p.x, p.y);
      const t = CFG.tile;
      const col = p.kind === 'town' ? '#ffc857' : '#6df1ff';
      const pulse = 0.6 + 0.4 * Math.sin(now / 400);
      const spin = now / 1200;
      ctx.save();
      ctx.translate(s.x, s.y);
      // ground glow
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.12 * pulse;
      ctx.beginPath();
      ctx.ellipse(0, 6, t * 0.55, t * 0.2, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // spinning rune ring
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = col;
      ctx.shadowBlur = 16 * pulse;
      for (let i = 0; i < 6; i++) {
        const a = spin + i * (Math.PI / 3);
        const r = t * 0.42;
        const rx = Math.cos(a) * r, ry = Math.sin(a) * r * 0.7;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a + now / 300);
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, PI2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // outer ring
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.arc(0, 0, t * 0.45, 0, PI2);
      ctx.stroke();
      // inner ring
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, t * 0.28, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // center icon
      ctx.fillStyle = col;
      ctx.shadowBlur = 20;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'town' ? '⌂' : '▼', 0, -1);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawNpcs() {
    if (!game.world.npcs) return;
    const now = performance.now();
    for (const n of game.world.npcs) {
      const s = w2s(n.x + 0.5, n.y + 0.5);
      ctx.save();
      ctx.translate(s.x, s.y);
      // ambient glow circle on ground
      ctx.fillStyle = n.color;
      ctx.globalAlpha = 0.08 + 0.04 * Math.sin(now / 1200 + n.x);
      ctx.beginPath();
      ctx.ellipse(0, 10, 18, 7, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // body — pixel-art figure
      const bob = Math.sin(now / 800 + n.x * 2) * 1.2;
      // torso
      ctx.fillStyle = n.color;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 12;
      ctx.fillRect(-4, -8 + bob, 8, 12);
      // head
      ctx.beginPath();
      ctx.arc(0, -12 + bob, 5, 0, PI2);
      ctx.fill();
      // shoulders
      ctx.fillRect(-7, -6 + bob, 14, 3);
      ctx.shadowBlur = 0;
      // role indicator icon (floating above)
      ctx.fillStyle = n.color;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 500 + n.y);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.glyph, 0, -22 + bob);
      ctx.globalAlpha = 1;
      // name plate
      ctx.fillStyle = 'rgba(8,8,16,0.85)';
      const tw = ctx.measureText(n.name).width;
      ctx.fillRect(-(tw + 12) / 2, 14, tw + 12, 15);
      ctx.strokeStyle = n.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-(tw + 12) / 2, 14, tw + 12, 15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(n.name, 0, 22);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.world.player;
    const cls = CLASSES[game.char.classId];
    const s = w2s(p.x, p.y);
    const now = performance.now();
    ctx.save();
    ctx.translate(s.x, s.y);

    // player light radius (subtle radial glow) — cached gradient
    if (!drawPlayer._grad || drawPlayer._gradColor !== cls.color) {
      drawPlayer._grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
      drawPlayer._grad.addColorStop(0, cls.color.slice(0, 7) + '18');
      drawPlayer._grad.addColorStop(1, 'rgba(0,0,0,0)');
      drawPlayer._gradColor = cls.color;
    }
    ctx.fillStyle = drawPlayer._grad;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, PI2);
    ctx.fill();

    // soft ground shadow
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(0, 10, 12, 4, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // rim-light ground glow
    ctx.fillStyle = cls.color;
    ctx.globalAlpha = 0.2 + (p.attackingFor > 0 ? 0.15 : 0);
    ctx.beginPath();
    ctx.ellipse(0, 9, 14, 5, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // sprite — procedural pixel-art figure
    drawCharSprite(cls.color, cls.id, p.lastDir.x, p.lastDir.y, p.attackingFor > 0);

    ctx.restore();
  }

  function drawCharSprite(color, classId, dirX, dirY, attacking) {
    const now = performance.now();
    const bob = Math.sin(now / 220) * 1.5;
    const isWalking = (game.keys.up || game.keys.down || game.keys.left || game.keys.right);
    const walk = isWalking ? Math.sin(now / 120) * 2 : 0;

    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    // legs (animated when walking)
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-4, 4 + bob, 3, 7 + walk * 0.5);
    ctx.fillRect(1, 4 + bob, 3, 7 - walk * 0.5);
    ctx.globalAlpha = 1;

    // torso
    ctx.fillStyle = color;
    ctx.fillRect(-5, -4 + bob, 10, 9);
    // darker inner torso
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-3, -2 + bob, 6, 6);
    ctx.globalAlpha = 1;

    // shoulders / pauldrons
    ctx.fillStyle = color;
    ctx.fillRect(-8, -4 + bob, 4, 4);
    ctx.fillRect(4, -4 + bob, 4, 4);

    // head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 5, 0, PI2);
    ctx.fill();
    // face highlight
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(-1, -10 + bob, 2, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // class-specific weapon / accessory
    const armX = dirX >= 0 ? 7 : -7;
    if (classId === 'warrior') {
      // sword
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8;
      const swingAngle = attacking ? Math.sin(now / 60) * 0.8 : -0.3;
      ctx.save();
      ctx.translate(armX, -2 + bob);
      ctx.rotate(swingAngle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -14);
      ctx.stroke();
      // crossguard
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(4, -2);
      ctx.stroke();
      ctx.restore();
    } else if (classId === 'mage') {
      // staff with orb
      ctx.strokeStyle = '#a0a0c0';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(armX, 0 + bob);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -12);
      ctx.stroke();
      // orb on top
      ctx.fillStyle = '#6df1ff';
      ctx.shadowColor = '#6df1ff';
      ctx.shadowBlur = 10 + 4 * Math.sin(now / 300);
      ctx.beginPath();
      ctx.arc(0, -14, 3.5, 0, PI2);
      ctx.fill();
      ctx.restore();
    } else if (classId === 'ranger') {
      // bow
      ctx.strokeStyle = '#8b6b3a';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(armX, -2 + bob);
      ctx.beginPath();
      ctx.arc(0, 0, 10, -1.2, 1.2);
      ctx.stroke();
      // bowstring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(10 * Math.cos(-1.2), 10 * Math.sin(-1.2));
      ctx.lineTo(10 * Math.cos(1.2), 10 * Math.sin(1.2));
      ctx.stroke();
      ctx.restore();
    } else if (classId === 'summoner') {
      // skull staff
      ctx.strokeStyle = '#7a5a9a';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(armX, 0 + bob);
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -10);
      ctx.stroke();
      // skull
      ctx.fillStyle = '#c489ff';
      ctx.shadowColor = '#c489ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -12, 3.5, 0, PI2);
      ctx.fill();
      // eye sockets
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-1.2, -12.5, 1, 0, PI2);
      ctx.arc(1.2, -12.5, 1, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // attack arc effect
    if (attacking) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.7;
      const arcAngle = Math.atan2(dirY, dirX);
      ctx.beginPath();
      ctx.arc(0, 0 + bob, 16, arcAngle - 0.8, arcAngle + 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // facing direction indicator
    if (dirX || dirY) {
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const lx = dirX / len * 12, ly = dirY / len * 12;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(lx, ly + bob, 1.5, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // cached enemy HP bar gradients (boss vs normal — fixed widths)
  let _hpGradBoss = null, _hpGradNorm = null;
  function drawEnemies() {
    const now = performance.now();
    for (const e of game.enemies) {
      const s = w2s(e.x, e.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      const isBoss = e.boss;
      const scale = isBoss ? 1.5 : 1;
      const bob = Math.sin(now / 280 + e.x * 5) * 1.2;

      // shadow
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 9 * scale, 10 * scale, 4 * scale, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // flash white on hit
      const col = e.hitFlash > 0 ? '#ffffff' : e.color;

      // pixel-art body
      ctx.shadowColor = col;
      ctx.shadowBlur = isBoss ? 16 : 10;
      ctx.fillStyle = col;

      // draw based on enemy type
      if (e.attackKind === 'melee') {
        // melee enemies — chunky body shape
        // torso
        ctx.fillRect(-4 * scale, -3 * scale + bob, 8 * scale, 8 * scale);
        // head
        ctx.beginPath();
        ctx.arc(0, -6 * scale + bob, 4 * scale, 0, PI2);
        ctx.fill();
        // arms (threatening pose)
        ctx.fillRect(-8 * scale, -2 * scale + bob, 3 * scale, 6 * scale);
        ctx.fillRect(5 * scale, -2 * scale + bob, 3 * scale, 6 * scale);
        // menacing eye glow
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
        ctx.beginPath();
        ctx.arc(-1.5 * scale, -6.5 * scale + bob, 1 * scale, 0, PI2);
        ctx.arc(1.5 * scale, -6.5 * scale + bob, 1 * scale, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // ranged enemies — slender/floating look
        // body (more ethereal)
        ctx.beginPath();
        ctx.moveTo(0, -10 * scale + bob);
        ctx.lineTo(5 * scale, 2 * scale + bob);
        ctx.lineTo(3 * scale, 8 * scale + bob);
        ctx.lineTo(-3 * scale, 8 * scale + bob);
        ctx.lineTo(-5 * scale, 2 * scale + bob);
        ctx.closePath();
        ctx.fill();
        // head / orb
        ctx.beginPath();
        ctx.arc(0, -8 * scale + bob, 4 * scale, 0, PI2);
        ctx.fill();
        // energy core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200);
        ctx.beginPath();
        ctx.arc(0, -2 * scale + bob, 2 * scale, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0;

      // frozen overlay
      if (e.frozen > 0) {
        ctx.strokeStyle = '#6df1ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#6df1ff';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.7;
        // ice crystal ring
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + now / 2000;
          const r = 13 * scale;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // HP bar with better styling
      const barW = isBoss ? 42 : 24;
      const barH = isBoss ? 5 : 3;
      const barY = isBoss ? -24 * scale : -16 * scale;
      const pct = clamp(e.hp / e.hpMax, 0, 1);
      // background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
      // fill — gradient from red to dark red (cached)
      if (pct > 0) {
        if (isBoss) {
          if (!_hpGradBoss) {
            _hpGradBoss = ctx.createLinearGradient(-21, 0, 21, 0);
            _hpGradBoss.addColorStop(0, '#ff4d6d');
            _hpGradBoss.addColorStop(1, '#cc1133');
          }
          ctx.fillStyle = _hpGradBoss;
        } else {
          if (!_hpGradNorm) {
            _hpGradNorm = ctx.createLinearGradient(-12, 0, 12, 0);
            _hpGradNorm.addColorStop(0, '#ff6b85');
            _hpGradNorm.addColorStop(1, '#cc4455');
          }
          ctx.fillStyle = _hpGradNorm;
        }
        ctx.fillRect(-barW / 2, barY, barW * pct, barH);
      }
      // highlight line on HP bar
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-barW / 2, barY, barW * pct, 1);

      // boss name
      if (isBoss) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e.name.toUpperCase(), 0, barY - 10);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  function drawMinions() {
    const now = performance.now();
    for (const m of game.minions) {
      const s = w2s(m.x, m.y);
      const bob = Math.sin(now / 200 + m.x * 3) * 1;
      ctx.save();
      ctx.translate(s.x, s.y);
      // ground shadow
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.ellipse(0, 7, 7, 3, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // ethereal skeleton body
      ctx.shadowColor = '#c489ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#c489ff';
      // ribcage body
      ctx.fillRect(-3, -2 + bob, 6, 7);
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-1, 0 + bob, 2, 4);
      ctx.globalAlpha = 1;
      // skull
      ctx.fillStyle = '#c489ff';
      ctx.beginPath();
      ctx.arc(0, -5 + bob, 4, 0, PI2);
      ctx.fill();
      // eye sockets
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200);
      ctx.beginPath();
      ctx.arc(-1.5, -5.5 + bob, 1, 0, PI2);
      ctx.arc(1.5, -5.5 + bob, 1, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // TTL indicator (fading border)
      if (m.ttl < 3) {
        ctx.strokeStyle = '#c489ff';
        ctx.globalAlpha = 0.3 * (m.ttl / 3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, PI2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  function drawProjectiles() {
    const now = performance.now();
    for (const p of game.projectiles) {
      const s = w2s(p.x, p.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      if (p.kind === 'arrow') {
        const a = Math.atan2(p.dy, p.dx);
        ctx.rotate(a);
        // arrow shaft
        ctx.fillRect(-8, -1, 14, 2);
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(6, -3);
        ctx.lineTo(10, 0);
        ctx.lineTo(6, 3);
        ctx.closePath();
        ctx.fill();
        // fletching
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(-8, -2, 3, 1);
        ctx.fillRect(-8, 1, 3, 1);
        ctx.globalAlpha = 1;
      } else if (p.kind === 'bolt') {
        // magic bolt — spinning diamond
        const spin = now / 100;
        ctx.rotate(spin);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        // inner glow
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'bone') {
        // bone projectile — spinning bone
        const spin = now / 80;
        ctx.rotate(spin);
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.beginPath();
        ctx.arc(-6, 0, 2.5, 0, PI2);
        ctx.arc(6, 0, 2.5, 0, PI2);
        ctx.fill();
      } else {
        // generic soul/enemy projectile
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, PI2);
        ctx.fill();
        // trailing core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  function drawItems() {
    const now = performance.now();
    for (const gi of game.items) {
      const s = w2s(gi.x, gi.y);
      const pulse = 0.7 + 0.3 * Math.sin(now / 220 + gi.x);
      const float = Math.sin(now / 400 + gi.y * 3) * 2;
      ctx.save();
      ctx.translate(s.x, s.y + float);
      const r = ITEM_BASES[gi.item.baseId];
      const col = rarityColor(gi.item.rarity);
      // ground glow
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.12 * pulse;
      ctx.beginPath();
      ctx.ellipse(0, 8 - float, 12, 4, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // rarity beam (for rare+ items)
      if (gi.item.rarity === 'rare' || gi.item.rarity === 'unique') {
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(now / 300);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, 12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // item icon with glow
      ctx.shadowColor = col;
      ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = col;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r ? r.icon : '◆', 0, 0);
      // white highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3 * pulse;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(r ? r.icon : '◆', 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      const t = 1 - p.age / p.life;
      const s = w2s(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = clamp(t * t, 0, 1); // quadratic fade for smoother decay
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * t;
      ctx.fillStyle = p.color;
      // varied shapes
      const sizeT = p.size * (0.5 + 0.5 * t); // shrink over life
      if (p.size > 2) {
        // larger particles are diamond shapes
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 4);
        ctx.beginPath();
        ctx.moveTo(0, -sizeT);
        ctx.lineTo(sizeT * 0.6, 0);
        ctx.lineTo(0, sizeT);
        ctx.lineTo(-sizeT * 0.6, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // smaller particles are circles
        ctx.beginPath();
        ctx.arc(s.x, s.y, sizeT, 0, PI2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawInteractionHints() {
    if (!game.world) return;
    const now = performance.now();
    const showHint = (wx, wy, label) => {
      const s = w2s(wx, wy);
      const bounce = Math.sin(now / 300) * 2;
      ctx.save();
      ctx.translate(s.x, s.y - 28 + bounce);
      ctx.font = '10px sans-serif';
      const padX = 10, h = 18;
      const tw = ctx.measureText(label).width;
      const w = tw + padX * 2;
      // pill background
      const radius = 9;
      ctx.fillStyle = 'rgba(8,8,20,0.9)';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + radius, -h / 2);
      ctx.lineTo(w / 2 - radius, -h / 2);
      ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + radius);
      ctx.lineTo(w / 2, h / 2 - radius);
      ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - radius, h / 2);
      ctx.lineTo(-w / 2 + radius, h / 2);
      ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - radius);
      ctx.lineTo(-w / 2, -h / 2 + radius);
      ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + radius, -h / 2);
      ctx.closePath();
      ctx.fill();
      // border glow
      ctx.strokeStyle = '#6df1ff';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#6df1ff';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // text
      ctx.fillStyle = '#6df1ff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      // small arrow pointing down
      ctx.beginPath();
      ctx.moveTo(-4, h / 2);
      ctx.lineTo(0, h / 2 + 4);
      ctx.lineTo(4, h / 2);
      ctx.fillStyle = 'rgba(8,8,20,0.9)';
      ctx.fill();
      ctx.restore();
    };
    if (game.nearbyNpc) {
      showHint(game.nearbyNpc.x + 0.5, game.nearbyNpc.y + 0.5, `PINCH · ${game.nearbyNpc.name}`);
    } else if (game.nearbyPortal) {
      showHint(game.nearbyPortal.x, game.nearbyPortal.y, `PINCH ${game.nearbyPortal.label}`);
    }
  }

  function drawFloatingTexts() {
    const layer = $('floating-text');
    if (!layer) return;
    for (const t of game.floatingTexts) {
      const s = w2s(t.wx, t.wy);
      const k = t.age / t.life;
      const yOff = -38 * k;
      const scale = t.kind === 'crit' ? 1 + (1 - k) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - k, 1.5); // smoother fade
      ctx.translate(s.x, s.y + yOff);
      ctx.scale(scale, scale);
      const fontSize = t.kind === 'crit' ? 17 : t.kind === 'xp' ? 11 : 13;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      const c = ({ dmg: '#ffffff', crit: '#ffc857', heal: '#51e6a4', xp: '#6df1ff', loot: '#ffc857' })[t.kind] || '#fff';
      // dark outline for readability
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = t.kind === 'crit' ? 8 : 3;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  // Vignette — subtle darkness at screen edges + damage flash
  let _vignetteGrad = null;
  function drawVignette() {
    const W = CFG.canvas;
    // darkness vignette — cached gradient
    if (!_vignetteGrad) {
      _vignetteGrad = ctx.createRadialGradient(W / 2, W / 2, W * 0.28, W / 2, W / 2, W * 0.55);
      _vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      _vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    }
    ctx.fillStyle = _vignetteGrad;
    ctx.fillRect(0, 0, W, W);
    // red damage flash overlay
    if (game.damageFlash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${game.damageFlash * 1.2})`;
      ctx.fillRect(0, 0, W, W);
    }
    // low HP warning pulse (uses cached gradient for shape, alpha for intensity)
    if (game.char && game.char.hp < game.char.hpMax * 0.25 && game.char.hp > 0) {
      if (!drawVignette._hpGrad) {
        drawVignette._hpGrad = ctx.createRadialGradient(W / 2, W / 2, W * 0.2, W / 2, W / 2, W * 0.5);
        drawVignette._hpGrad.addColorStop(0, 'rgba(255,30,50,0)');
        drawVignette._hpGrad.addColorStop(1, 'rgba(255,30,50,0.07)');
      }
      ctx.globalAlpha = 0.57 + 0.43 * Math.sin(performance.now() / 300);
      ctx.fillStyle = drawVignette._hpGrad;
      ctx.fillRect(0, 0, W, W);
      ctx.globalAlpha = 1;
    }
  }

  function rarityColor(r) {
    return ({ common: '#cfcfcf', magic: '#6db4ff', rare: '#ffe066', unique: '#ff8c42' })[r] || '#fff';
  }

  // ============================================================
  // MINIMAP
  // ============================================================
  function drawMinimap() {
    const mm = $('minimap'); if (!mm) return;
    const mctx = mm.getContext('2d');
    const w = mm.width, h = mm.height;
    mctx.clearRect(0, 0, w, h);
    if (!game.world) return;
    const W = game.world.w, H = game.world.h;
    const cellW = w / W, cellH = h / H;
    // floor tiles
    mctx.fillStyle = 'rgba(109, 241, 255, 0.35)';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (game.world.grid[y][x] === 0) {
          mctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }
    // npcs — gold diamonds
    if (game.world.npcs) {
      mctx.fillStyle = '#ffc857';
      for (const n of game.world.npcs) {
        mctx.beginPath();
        const nx = n.x * cellW + cellW / 2, ny = n.y * cellH + cellH / 2;
        mctx.arc(nx, ny, 2.5, 0, PI2);
        mctx.fill();
      }
    }
    // enemies — red dots
    mctx.fillStyle = '#ff4d6d';
    for (const e of game.enemies) {
      mctx.beginPath();
      mctx.arc(e.x * cellW, e.y * cellH, 1.5, 0, PI2);
      mctx.fill();
    }
    // portals — pulsing green
    if (game.world.portals) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
      mctx.fillStyle = `rgba(81, 230, 164, ${0.5 + 0.5 * pulse})`;
      for (const p of game.world.portals) {
        mctx.beginPath();
        mctx.arc(p.x * cellW, p.y * cellH, 2.5, 0, PI2);
        mctx.fill();
      }
    }
    // player — white with glow
    const p = game.world.player;
    const px = p.x * cellW, py = p.y * cellH;
    mctx.shadowColor = '#ffffff';
    mctx.shadowBlur = 4;
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(px, py, 2.5, 0, PI2);
    mctx.fill();
    // player view direction
    mctx.strokeStyle = 'rgba(255,255,255,0.4)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(px, py);
    mctx.lineTo(px + p.lastDir.x * 6, py + p.lastDir.y * 6);
    mctx.stroke();
    mctx.shadowBlur = 0;
  }

  // ============================================================
  // HUD
  // ============================================================
  function updateHud() {
    if (!game.char) return;
    const c = game.char;
    $('hud-name').textContent = CLASSES[c.classId].name;
    $('hud-level').textContent = c.level;
    $('hud-hp-fill').style.height = clamp(100 * c.hp / c.hpMax, 0, 100).toFixed(1) + '%';
    $('hud-hp-label').textContent = Math.max(0, Math.ceil(c.hp));
    $('hud-mp-fill').style.height = clamp(100 * c.mp / c.mpMax, 0, 100).toFixed(1) + '%';
    $('hud-mp-label').textContent = Math.max(0, Math.ceil(c.mp));
    $('hud-xp-fill').style.width = clamp(100 * c.xp / xpForLevel(c.level), 0, 100).toFixed(1) + '%';
    const skillName = SKILLS[CLASSES[c.classId].activeSkill].name;
    $('hud-skill-name').textContent = skillName;
    const cdEl = $('hud-skill-cd');
    const p = game.world ? game.world.player : null;
    if (p) {
      if (p.skillCd > 0) { cdEl.textContent = p.skillCd.toFixed(1) + 's'; cdEl.classList.remove('ready'); }
      else { cdEl.textContent = 'READY'; cdEl.classList.add('ready'); }
    }
    $('hud-zone').textContent = game.world ? game.world.name : '—';
  }
  function showZoneToast(msg) { showHudToast(msg); }
  function showHudToast(msg) {
    const t = $('hud-toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(showHudToast._tid);
    showHudToast._tid = setTimeout(() => t.classList.remove('visible'), 2200);
  }

  // ============================================================
  // SCREEN-SPECIFIC RENDERS
  // ============================================================
  function onScreenEnter(id) {
    if (id === 'title') renderTitle();
    if (id === 'class-select') {}
    if (id === 'inventory') renderInventory();
    if (id === 'character') renderCharacter();
    if (id === 'skills') renderSkills();
    if (id === 'quests') renderQuests();
    if (id === 'menu') {
      // only show "Return to Town" if we're in a dungeon
      const btn = $('menu-town-btn');
      if (game.world && game.world.kind === 'dungeon') btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    }
    if (id === 'vendor') renderVendor();
    if (id === 'stash') renderStash();
    if (id === 'waypoint') renderWaypoint();
    if (id === 'game') updateHud();
  }

  function renderTitle() {
    const cont = $('title-continue');
    if (game.save) cont.classList.remove('disabled');
    else cont.classList.add('disabled');
  }

  function renderInventory() {
    const c = game.char;
    $('inv-gold').textContent = c.gold;
    setEquip('eq-weapon', c.equip.weapon);
    setEquip('eq-armor', c.equip.armor);
    setEquip('eq-ring', c.equip.ring);
    setEquip('eq-amulet', c.equip.amulet);
    const list = $('inv-list'); list.innerHTML = '';
    if (c.inventory.length === 0) {
      list.innerHTML = '<div class="quest-card empty">No items.</div>';
      return;
    }
    c.inventory.forEach((it, idx) => {
      const base = ITEM_BASES[it.baseId];
      const row = document.createElement('button');
      row.className = 'inv-row focusable';
      row.dataset.action = 'inv-open';
      row.dataset.idx = idx;
      const equipped = isEquipped(it);
      row.innerHTML = `
        <div class="inv-icon">${base.icon}</div>
        <div class="inv-meta">
          <div class="inv-name rarity-${it.rarity}">${it.name}</div>
          <div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div>
        </div>
        ${equipped ? '<div class="inv-equipped">EQ</div>' : ''}
      `;
      list.appendChild(row);
    });
  }

  function setEquip(slotId, item) {
    const el = $(slotId);
    const v = el.querySelector('.equip-value');
    if (!item) { v.textContent = '—'; v.className = 'equip-value'; }
    else {
      v.textContent = item.name;
      v.className = 'equip-value rarity-' + item.rarity;
    }
  }

  function isEquipped(it) {
    const e = game.char.equip;
    return e.weapon === it || e.armor === it || e.ring === it || e.amulet === it;
  }

  function renderCharacter() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const d = derived(c);
    $('char-portrait').innerHTML = `<span style="color:${cls.color};text-shadow:0 0 16px ${cls.color}">${cls.glyph}</span>`;
    const stats = $('char-stats');
    const rows = [
      ['Class',    cls.name],
      ['Level',    c.level],
      ['XP',       `${c.xp} / ${xpForLevel(c.level)}`],
      ['Damage',   d.dmg],
      ['Armor',    d.def],
      ['HP',       `${Math.ceil(c.hp)} / ${d.hpMax}`],
      ['MP',       `${Math.ceil(c.mp)} / ${d.mpMax}`],
      ['Crit',     d.crit + '%'],
      ['Atk Spd',  d.aspd.toFixed(2)],
      ['Gold',     c.gold + 'g'],
      ['STR',      c.stats.str + d.bonusStats.str],
      ['INT',      c.stats.int + d.bonusStats.int],
      ['DEX',      c.stats.dex + d.bonusStats.dex],
      ['VIT',      c.stats.vit + d.bonusStats.vit],
    ];
    stats.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`).join('');
    const pts = $('char-points-row');
    pts.innerHTML = '';
    if (c.statPoints > 0) {
      const make = (k) => {
        const b = document.createElement('button');
        b.className = 'nav-item focusable';
        b.dataset.action = 'spend-stat';
        b.dataset.stat = k;
        b.innerHTML = `+1 ${k.toUpperCase()} <span class="pts">${c.statPoints} pts</span>`;
        return b;
      };
      ['str','int','dex','vit'].forEach(k => pts.appendChild(make(k)));
    }
  }

  function renderSkills() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const s = SKILLS[cls.activeSkill];
    const el = $('skills-content');
    el.innerHTML = `
      <div class="skill-card">
        <div class="skill-name">${s.name}</div>
        <div class="skill-desc">${s.desc}</div>
      </div>
      <div class="quest-card empty">More skills unlock as you progress.</div>
    `;
  }

  function renderQuests() {
    const el = $('quests-content');
    el.innerHTML = '';
    const q = game.save.quest;
    if (q) {
      const done = q.progress >= q.required;
      const card = document.createElement('div');
      card.className = 'quest-card';
      card.innerHTML = `
        <div class="quest-name">${q.name}</div>
        <div class="quest-prog ${done ? 'done' : ''}">${q.progress} / ${q.required} ${done ? '— complete!' : ''}</div>
        <div class="quest-reward">Reward: ${q.rewardGold}g + ${q.rewardXp} XP</div>
      `;
      el.appendChild(card);
      if (done) {
        const btn = document.createElement('button');
        btn.className = 'nav-item focusable';
        btn.dataset.action = 'turn-in-quest';
        btn.textContent = 'Turn In';
        el.appendChild(btn);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'quest-card empty';
      empty.textContent = 'No active quest. Visit the Captain in Sanctuary.';
      el.appendChild(empty);
    }
    const summary = document.createElement('div');
    summary.className = 'quest-card';
    summary.innerHTML = `<div class="quest-name">Bounties Completed</div><div class="quest-prog">${game.save.questsCompleted}</div>`;
    el.appendChild(summary);
  }

  function renderVendor() {
    const c = game.char;
    $('vendor-gold').textContent = c.gold;
    const list = $('vendor-list'); list.innerHTML = '';
    document.querySelectorAll('.vendor-tab').forEach(t => t.classList.remove('active'));
    if (game.vendorMode === 'buy') {
      document.querySelector('[data-action="vendor-tab-buy"]').classList.add('active');
      if (!game.vendorOffer || game.vendorOffer.length === 0) refreshVendorOffer();
      game.vendorOffer.forEach((it, idx) => {
        const base = ITEM_BASES[it.baseId];
        const cost = itemCost(it);
        const row = document.createElement('button');
        row.className = 'inv-row focusable';
        row.dataset.action = 'vendor-buy';
        row.dataset.idx = idx;
        row.innerHTML = `
          <div class="inv-icon">${base.icon}</div>
          <div class="inv-meta">
            <div class="inv-name rarity-${it.rarity}">${it.name}</div>
            <div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div>
          </div>
          <div class="inv-equipped" style="color:var(--gold)">${cost}g</div>
        `;
        list.appendChild(row);
      });
    } else {
      document.querySelector('[data-action="vendor-tab-sell"]').classList.add('active');
      c.inventory.forEach((it, idx) => {
        if (isEquipped(it)) return;
        const base = ITEM_BASES[it.baseId];
        const price = Math.max(1, Math.floor(itemCost(it) * 0.4));
        const row = document.createElement('button');
        row.className = 'inv-row focusable';
        row.dataset.action = 'vendor-sell';
        row.dataset.idx = idx;
        row.innerHTML = `
          <div class="inv-icon">${base.icon}</div>
          <div class="inv-meta">
            <div class="inv-name rarity-${it.rarity}">${it.name}</div>
            <div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div>
          </div>
          <div class="inv-equipped" style="color:var(--gold)">${price}g</div>
        `;
        list.appendChild(row);
      });
      if (list.innerHTML === '') list.innerHTML = '<div class="quest-card empty">Nothing to sell.</div>';
    }
  }

  function itemCost(it) {
    const tier = { common: 1, magic: 4, rare: 12, unique: 40 }[it.rarity] || 1;
    return 6 + it.ilvl * 4 * tier + (it.affixes ? it.affixes.length * 3 : 0);
  }

  function refreshVendorOffer() {
    game.vendorOffer = [];
    const lv = Math.max(1, game.char.level);
    for (let i = 0; i < 6; i++) game.vendorOffer.push(rollItem(lv + irand(0, 2)));
  }

  function renderStash() {
    const list = $('stash-list'); list.innerHTML = '';
    document.querySelectorAll('#stash .vendor-tab').forEach(t => t.classList.remove('active'));
    const c = game.char;
    if (game.stashMode === 'deposit') {
      document.querySelector('[data-action="stash-tab-deposit"]').classList.add('active');
      c.inventory.forEach((it, idx) => {
        if (isEquipped(it)) return;
        const base = ITEM_BASES[it.baseId];
        const row = document.createElement('button');
        row.className = 'inv-row focusable';
        row.dataset.action = 'stash-deposit';
        row.dataset.idx = idx;
        row.innerHTML = `<div class="inv-icon">${base.icon}</div><div class="inv-meta"><div class="inv-name rarity-${it.rarity}">${it.name}</div><div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div></div>`;
        list.appendChild(row);
      });
      if (list.innerHTML === '') list.innerHTML = '<div class="quest-card empty">Inventory is empty.</div>';
    } else {
      document.querySelector('[data-action="stash-tab-withdraw"]').classList.add('active');
      game.save.stash.forEach((it, idx) => {
        const base = ITEM_BASES[it.baseId];
        const row = document.createElement('button');
        row.className = 'inv-row focusable';
        row.dataset.action = 'stash-withdraw';
        row.dataset.idx = idx;
        row.innerHTML = `<div class="inv-icon">${base.icon}</div><div class="inv-meta"><div class="inv-name rarity-${it.rarity}">${it.name}</div><div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div></div>`;
        list.appendChild(row);
      });
      if (list.innerHTML === '') list.innerHTML = '<div class="quest-card empty">Stash is empty.</div>';
    }
  }

  function renderWaypoint() {
    const el = $('waypoint-content');
    el.innerHTML = '';
    BIOMES.forEach(b => {
      const unlocked = game.save.unlockedBiomes[b.id];
      const card = document.createElement('button');
      card.className = 'waypoint-card focusable' + (unlocked ? '' : ' locked');
      if (unlocked) {
        card.dataset.action = 'travel';
        card.dataset.biome = b.id;
      } else {
        card.tabIndex = -1;
      }
      card.innerHTML = `
        <div class="waypoint-glyph" style="color:${b.palette.wall};text-shadow:0 0 12px ${b.palette.wall}">${unlocked ? '✦' : '?'}</div>
        <div class="waypoint-meta">
          <div class="waypoint-name">${b.name}</div>
          <div class="waypoint-sub">${unlocked ? 'Discovered' : 'Locked — kill the boss before to unlock'}</div>
        </div>
      `;
      el.appendChild(card);
    });
  }

  // ============================================================
  // ACTIONS (DOM)
  // ============================================================
  function handleAction(action, el) {
    switch (action) {
      case 'back': navigateBack(); return;

      // title
      case 'title-continue':
        if (!game.save) return;
        loadIntoSession(game.save);
        enterTown();
        return;
      case 'title-new':
        navigateTo('class-select'); return;
      case 'title-about':
        navigateTo('about'); return;

      // class select
      case 'pick-class': {
        const id = el.dataset.class;
        game.save = defaultSave(id);
        loadIntoSession(game.save);
        // top up to derived maxima after equipment/stat bonuses applied
        game.char.hp = game.char.hpMax;
        game.char.mp = game.char.mpMax;
        saveGame();
        enterTown();
        return;
      }

      // menu
      case 'menu-resume': navigateBack(); return;
      case 'menu-inventory': navigateTo('inventory'); return;
      case 'menu-character': navigateTo('character'); return;
      case 'menu-skills': navigateTo('skills'); return;
      case 'menu-quests': navigateTo('quests'); return;
      case 'menu-town':
        if (game.world && game.world.kind === 'dungeon') {
          enterTown();
          // close the open menu screen
          game.history = [];
        }
        return;
      case 'menu-title':
        saveGame();
        navigateTo('title');
        return;

      // inventory
      case 'inv-open':
        showItemDetail(parseInt(el.dataset.idx, 10));
        return;
      case 'item-equip':
        equipItemAt(parseInt(el.dataset.idx, 10));
        navigateBack();
        return;
      case 'item-unequip':
        unequipSlot(el.dataset.slot);
        navigateBack();
        return;
      case 'item-drop':
        dropItemAt(parseInt(el.dataset.idx, 10));
        navigateBack();
        return;

      // character — spend stat
      case 'spend-stat':
        spendStat(el.dataset.stat);
        return;

      // vendor
      case 'vendor-tab-buy':   game.vendorMode = 'buy';  renderVendor(); return;
      case 'vendor-tab-sell':  game.vendorMode = 'sell'; renderVendor(); return;
      case 'vendor-buy':       vendorBuy(parseInt(el.dataset.idx, 10)); return;
      case 'vendor-sell':      vendorSell(parseInt(el.dataset.idx, 10)); return;

      // stash
      case 'stash-tab-deposit':  game.stashMode = 'deposit';  renderStash(); return;
      case 'stash-tab-withdraw': game.stashMode = 'withdraw'; renderStash(); return;
      case 'stash-deposit':      stashDeposit(parseInt(el.dataset.idx, 10)); return;
      case 'stash-withdraw':     stashWithdraw(parseInt(el.dataset.idx, 10)); return;

      // waypoint
      case 'travel':
        enterBiome(el.dataset.biome, 1);
        game.history = [];
        return;

      // quests
      case 'turn-in-quest': turnInQuest(); return;

      // levelup / death
      case 'levelup-ok': navigateBack(); return;
      case 'death-return':
        respawn();
        return;
    }
  }

  // ============================================================
  // ITEM ACTIONS
  // ============================================================
  function showItemDetail(idx) {
    game.selectedItemId = idx;
    const it = game.char.inventory[idx]; if (!it) return;
    const base = ITEM_BASES[it.baseId];
    const card = $('item-card');
    let baseLines = [];
    if (base.base.dmg) baseLines.push(`+${base.base.dmg} damage`);
    if (base.base.def) baseLines.push(`+${base.base.def} armor`);
    if (base.base.mp)  baseLines.push(`+${base.base.mp} mana`);
    card.innerHTML = `
      <div class="item-name rarity-${it.rarity}">${it.name}</div>
      <div class="item-type">${base.type} · ilvl ${it.ilvl} · ${it.rarity.toUpperCase()}</div>
      ${baseLines.map(l => `<div class="item-affix">${l}</div>`).join('')}
      ${(it.affixes || []).map(a => `<div class="item-affix">+${a.val} ${a.label}</div>`).join('')}
      <div class="item-flavor">"Forged of glass that remembers."</div>
    `;
    const actions = $('item-actions');
    actions.innerHTML = '';
    if (isEquipped(it)) {
      const slot = slotOf(it);
      actions.innerHTML = `<button class="nav-item focusable" data-action="item-unequip" data-slot="${slot}">Unequip</button>`;
    } else if (base.type === 'weapon' || base.type === 'armor' || base.type === 'ring' || base.type === 'amulet') {
      actions.innerHTML = `<button class="nav-item focusable" data-action="item-equip" data-idx="${idx}">Equip</button>`;
    }
    actions.innerHTML += `<button class="nav-item focusable danger" data-action="item-drop" data-idx="${idx}">Drop</button>`;
    navigateTo('item-detail');
  }
  function slotOf(it) {
    const t = ITEM_BASES[it.baseId].type;
    return t;
  }
  function equipItemAt(idx) {
    const it = game.char.inventory[idx]; if (!it) return;
    const slot = slotOf(it);
    game.char.equip[slot] = it;
    applyDerivedToChar();
    saveGame(); updateHud();
  }
  function unequipSlot(slot) {
    game.char.equip[slot] = null;
    applyDerivedToChar();
    saveGame(); updateHud();
  }
  function dropItemAt(idx) {
    const it = game.char.inventory[idx]; if (!it) return;
    if (isEquipped(it)) unequipSlot(slotOf(it));
    game.char.inventory.splice(idx, 1);
    saveGame(); updateHud();
  }
  function spendStat(k) {
    const c = game.char;
    if (c.statPoints <= 0) return;
    c.stats[k] += 1;
    c.statPoints -= 1;
    applyDerivedToChar();
    renderCharacter();
    saveGame(); updateHud();
  }

  // ============================================================
  // VENDOR / STASH
  // ============================================================
  function vendorBuy(idx) {
    const it = game.vendorOffer[idx];
    if (!it) return;
    const cost = itemCost(it);
    if (game.char.gold < cost) { showHudToast('Not enough gold.'); return; }
    if (game.char.inventory.length >= 24) { showHudToast('Inventory full.'); return; }
    game.char.gold -= cost;
    game.char.inventory.push(it);
    game.vendorOffer.splice(idx, 1);
    saveGame();
    renderVendor();
  }
  function vendorSell(idx) {
    const it = game.char.inventory[idx];
    if (!it || isEquipped(it)) return;
    const price = Math.max(1, Math.floor(itemCost(it) * 0.4));
    game.char.gold += price;
    game.char.inventory.splice(idx, 1);
    saveGame();
    renderVendor();
  }
  function stashDeposit(idx) {
    const it = game.char.inventory[idx]; if (!it || isEquipped(it)) return;
    game.char.inventory.splice(idx, 1);
    game.save.stash.push(it);
    saveGame();
    renderStash();
  }
  function stashWithdraw(idx) {
    if (game.char.inventory.length >= 24) { showHudToast('Inventory full.'); return; }
    const it = game.save.stash[idx]; if (!it) return;
    game.save.stash.splice(idx, 1);
    game.char.inventory.push(it);
    saveGame();
    renderStash();
  }

  // ============================================================
  // QUESTS
  // ============================================================
  function openQuests() {
    // Captain dialog: offer or report a quest
    if (!game.save.quest) {
      // generate a bounty quest scaled to character level
      const lv = game.char.level;
      const unlockedBiomes = BIOMES.filter(b => game.save.unlockedBiomes[b.id]);
      const biome = pick(unlockedBiomes);
      const target = pick(biome.enemies);
      const targetName = ENEMIES[target].name;
      const required = 4 + Math.min(6, Math.floor(lv / 2));
      const quest = {
        name: `Cull the ${targetName}s`,
        target,
        targetName,
        required,
        progress: 0,
        rewardGold: 30 + lv * 8,
        rewardXp: 40 + lv * 12,
        biomeId: biome.id,
      };
      // show dialog
      showDialog({
        portrait: '✦',
        portraitColor: '#c489ff',
        title: 'Captain',
        line: `Hunter, I have a bounty: clear ${required} ${targetName}s in ${biome.name}.`,
        options: [
          { label: 'Accept', cb: () => { game.save.quest = quest; saveGame(); showHudToast('Quest accepted.'); navigateBack(); } },
          { label: 'Decline', cb: () => navigateBack() },
        ],
      });
    } else {
      const q = game.save.quest;
      const done = q.progress >= q.required;
      showDialog({
        portrait: '✦',
        portraitColor: '#c489ff',
        title: 'Captain',
        line: done
          ? `Well done. The ${q.targetName}s lie still. Take this.`
          : `You've felled ${q.progress} of ${q.required} ${q.targetName}s. Press on.`,
        options: done
          ? [{ label: 'Turn In', cb: () => { turnInQuest(); navigateBack(); } }]
          : [{ label: 'Onward', cb: () => navigateBack() }],
      });
    }
  }
  function turnInQuest() {
    const q = game.save.quest; if (!q) return;
    if (q.progress < q.required) return;
    game.char.gold += q.rewardGold;
    gainXp(q.rewardXp);
    game.save.questsCompleted += 1;
    game.save.quest = null;
    saveGame();
    showHudToast(`Quest complete! +${q.rewardGold}g`);
  }

  // ============================================================
  // DIALOG
  // ============================================================
  function showDialog({ portrait, portraitColor, title, line, options }) {
    $('dialog-title').textContent = title;
    const port = $('dialog-portrait');
    port.innerHTML = `<span style="color:${portraitColor};text-shadow:0 0 14px ${portraitColor}">${portrait}</span>`;
    $('dialog-line').textContent = line;
    const opts = $('dialog-options');
    opts.innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'nav-item focusable';
      b.textContent = o.label;
      b.addEventListener('click', o.cb);
      opts.appendChild(b);
    });
    navigateTo('dialog');
  }

  function openVendor()   { refreshVendorOffer(); navigateTo('vendor'); }
  function openStash()    { navigateTo('stash'); }
  function openWaypoint() { navigateTo('waypoint'); }

  // ============================================================
  // DEATH / RESPAWN
  // ============================================================
  function respawn() {
    game.char.hp = game.char.hpMax;
    game.char.mp = game.char.mpMax;
    // small gold penalty
    game.char.gold = Math.floor(game.char.gold * 0.85);
    saveGame();
    enterTown();
  }

  // ============================================================
  // SESSION LOAD
  // ============================================================
  function loadIntoSession(save) {
    game.save = save;
    game.char = save.char;
    applyDerivedToChar();
  }

  // ============================================================
  // GAME LOOP
  // ============================================================
  function frame(now) {
    let dt = (now - (game.lastTime || now)) / 1000;
    game.lastTime = now;
    dt = Math.min(0.05, dt);

    if (game.screen === 'game' && game.world && game.char && game.char.hp > 0) {
      tickPlayer(dt);
      autoAttackTick(dt);
      tickEnemies(dt);
      tickMinions(dt);
      tickProjectiles(dt);
      tickEffects(dt);
      tickAmbient(dt);
      tickInteraction();
      updateCamera();
      render();
      // periodic HUD updates
      if ((frame._hudT = (frame._hudT || 0) + dt) > 0.1) {
        frame._hudT = 0;
        updateHud();
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    collectScreens();
    setupInput();
    setupRender();
    game.save = loadSave();
    if (game.save && game.save.v === 2) {
      // session ready (continue available)
    }
    navigateTo('title', { addToHistory: false });
    requestAnimationFrame(frame);
    // expose for debugging
    window.__glasspire = { game, enterBiome, enterTown, CLASSES, BIOMES };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
