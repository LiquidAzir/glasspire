/* =============================================================
   HOLLOWLIGHT — action RPG for Meta Ray-Ban Display
   Single-file vanilla JS. Canvas 2D for the game world,
   DOM screens for menus. Persistent character via localStorage.
   ============================================================= */
(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const CFG = {
    appName: 'HollowLight',
    storageKey: 'hollowlight_save_v2',
    legacyStorageKey: 'glasspire_save_v2',  // pre-rename key — read for backwards compat
    canvas: 600,
    tile: 28,                 // pixels per tile
    viewTiles: 21,            // 21 * 28 ≈ 588, with 6px margin per side
    playerSpeed: 10,          // tiles/sec — fast but controllable in corridors
    stepImpulse: 0.18,        // sec — minimum movement time per tap (~1.8 tiles per tap)
    comboWindow: 500,         // ms — tight window for the 3-tap dash (quick taps only)
    comboHold: 1500,          // ms — generous gap allowed between 4-tap combo swipes (slow EMG)
    minComboGap: 30,          // ms — to reject key repeat ghosts
    biomeFloors: 4,           // floors per biome before boss
    autoAttackPad: 0.15,      // tile padding on attack range for forgiveness
    maxLevel: 99,             // hard cap on character level; excess XP becomes paragon XP
    paragonXpMul: 1.4,        // paragon XP bar scales 40% slower than the level cap bar
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
      skills: ['whirlwind', 'leapslam', 'warcry', 'shieldwall'],
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
      skills: ['frostnova', 'chainlightning', 'meteor', 'blinkstrike'],
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
      skills: ['multishot', 'poisontrap', 'piercingshot', 'volley'],
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
      skills: ['raisedead', 'souldrain', 'corpseexplosion', 'boneprison'],
      activeSkill: 'raisedead',
      activeSkillCost: 20,
    },
  };

  const SKILLS = {
    // Warrior skills
    whirlwind: { name: 'Whirlwind', cooldown: 6, cost: 12,
      desc: 'Spin to hit every enemy within 2.2 tiles for 220% weapon damage.' },
    leapslam: { name: 'Leap Slam', cooldown: 7, cost: 14,
      desc: 'Leap forward 3 tiles and slam the ground, dealing 280% damage in a 2-tile radius on landing.' },
    warcry: { name: 'War Cry', cooldown: 12, cost: 10,
      desc: 'Roar with fury — gain +50% damage for 8 seconds and stagger all enemies within 2.5 tiles.' },
    shieldwall: { name: 'Shield Wall', cooldown: 15, cost: 8,
      desc: 'Brace yourself — reduce all incoming damage by 70% for 5 seconds. Immovable.' },

    // Mage skills
    frostnova: { name: 'Frost Nova', cooldown: 8, cost: 24,
      desc: 'Frost shockwave hits all enemies within 3.5 tiles for 180% damage and freezes them briefly.' },
    chainlightning: { name: 'Chain Lightning', cooldown: 5, cost: 20,
      desc: 'Lightning bolt bounces between up to 5 enemies within 4 tiles, dealing 150% damage to each.' },
    meteor: { name: 'Meteor', cooldown: 14, cost: 35,
      desc: 'Call a meteor to a spot 3 tiles ahead. After 0.6s it impacts for 400% damage in a 2.5-tile radius.' },
    blinkstrike: { name: 'Blink Strike', cooldown: 4, cost: 15,
      desc: 'Teleport to the nearest enemy and blast them for 300% damage. Chains to a second target if one is nearby.' },

    // Ranger skills
    multishot: { name: 'Multishot', cooldown: 5, cost: 18,
      desc: 'Fire five arrows in a fan. Each does 80% weapon damage.' },
    poisontrap: { name: 'Poison Trap', cooldown: 9, cost: 16,
      desc: 'Drop a toxic cloud at your position. Enemies in the 2-tile zone take 60% damage every 0.5s for 5 seconds.' },
    piercingshot: { name: 'Piercing Shot', cooldown: 6, cost: 22,
      desc: 'Fire a powerful bolt that pierces all enemies in a line, dealing 250% weapon damage to each.' },
    volley: { name: 'Arrow Volley', cooldown: 10, cost: 26,
      desc: 'Rain 12 arrows over a 3-tile area around you, each dealing 120% damage. Great for crowds.' },

    // Summoner skills
    raisedead: { name: 'Raise Dead', cooldown: 10, cost: 20,
      desc: 'Summon two skeleton warriors to fight for you for 12 seconds.' },
    souldrain: { name: 'Soul Drain', cooldown: 7, cost: 18,
      desc: 'Drain life from the nearest enemy for 3 seconds, dealing 100% damage/sec and healing you for 50% of damage dealt.' },
    corpseexplosion: { name: 'Corpse Explosion', cooldown: 8, cost: 22,
      desc: 'Detonate all recent corpse positions within 5 tiles, dealing 200% damage in a 1.8-tile radius around each.' },
    boneprison: { name: 'Bone Prison', cooldown: 11, cost: 20,
      desc: 'Imprison the nearest enemy in bone — they are stunned for 4 seconds and take 150% damage on impact.' },

    // ===== Legendary-granted skills (only available with specific unique item equipped) =====
    demonslash: { name: 'Demon Slash', cooldown: 5, cost: 18, granted: true,
      desc: '(Demonslayer) Sweeping crescent of red flame: 350% damage in a 2.5-tile arc, sets all hit enemies on fire.' },
    starfall: { name: 'Star Fall', cooldown: 12, cost: 32, granted: true,
      desc: '(Starfall Staff) Three meteors fall around your target: 250% damage each in 1.5-tile radius.' },
    typhoonshot: { name: 'Typhoon Shot', cooldown: 7, cost: 24, granted: true,
      desc: '(Typhoon Bow) Unleash a piercing storm: 8 arrows fanning forward, each doing 130% damage.' },
    soulharvest: { name: 'Soul Harvest', cooldown: 9, cost: 22, granted: true,
      desc: '(Soulreaper) Drain souls from all enemies within 4 tiles: 200% damage and heals you for 30% of damage dealt.' },
  };

  // ===== SKILL RUNES — one augment per skill, chosen on the Skill screen =====
  // Universal archetypes covering the classic damage / uptime / sustain axes.
  // Applied centrally so every skill (class + legendary) supports them.
  const RUNES = {
    empowered: { name: 'Empowered', icon: '◆', desc: '+35% damage, +25% cooldown', dmgMul: 1.35, cdMul: 1.25 },
    swift:     { name: 'Swift',     icon: '»', desc: '-35% cooldown, -15% damage', dmgMul: 0.85, cdMul: 0.65 },
    efficient: { name: 'Efficient', icon: '✧', desc: '-50% mana cost',            costMul: 0.5 },
  };
  function getSkillRune(skillId) {
    const c = game.char;
    if (!c || !c.skillRunes) return null;
    const rid = c.skillRunes[skillId];
    return rid ? RUNES[rid] : null;
  }

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
    { id: 'voidspire', name: 'The Void Spire',    shortName: 'VOIDSPIRE',
      palette: { wall: '#b388ff', floor: '#0d0d1a', accent: '#00e5ff' },
      enemies: ['voidling', 'nullweaver', 'crystalsentinel'],
      boss: 'voidlord',
      unlocked: false },
  ];

  // Difficulty tiers — replay biomes harder for better loot. Each tier scales
  // enemy HP/damage and grants a flat item-level + reward bonus.
  const DIFFICULTIES = {
    normal:    { name: 'Normal',    short: 'N',  color: '#9bbf95', hpMul: 1,   dmgMul: 1,   xpMul: 1,   ilvlBonus: 0, lootMul: 1 },
    nightmare: { name: 'Nightmare', short: 'NM', color: '#ffc857', hpMul: 2.2, dmgMul: 1.8, xpMul: 1.5, ilvlBonus: 3, lootMul: 1.3 },
    hell:      { name: 'Hell',      short: 'H',  color: '#ff4d6d', hpMul: 4,   dmgMul: 2.8, xpMul: 2.2, ilvlBonus: 7, lootMul: 1.7 },
  };
  const DIFFICULTY_ORDER = ['normal', 'nightmare', 'hell'];
  function curDifficulty() {
    return DIFFICULTIES[(game.save && game.save.difficulty) || 'normal'] || DIFFICULTIES.normal;
  }

  // Permanent gold-sink upgrades — bought once per level, escalating cost.
  const UPGRADES = {
    pickup:   { name: 'Lodestone',       icon: '◎', max: 4, perLevel: '+0.6 tile pickup radius', baseCost: 150 },
    xpgain:   { name: "Sage's Insight",  icon: '✦', max: 5, perLevel: '+10% experience',         baseCost: 200 },
    goldfind: { name: 'Midas Touch',     icon: '⊛', max: 5, perLevel: '+15% gold found',         baseCost: 200 },
    potions:  { name: 'Potion Belt',     icon: '+', max: 3, perLevel: '+1 potion capacity',      baseCost: 250 },
  };
  function upgradeLevel(key) {
    return (game.save && game.save.upgrades && game.save.upgrades[key]) || 0;
  }
  function upgradeCost(key) {
    return UPGRADES[key].baseCost * (upgradeLevel(key) + 1);
  }
  function potionCapacity() {
    return 3 + upgradeLevel('potions');
  }

  const ENEMIES = {
    // crypts
    skeleton: { name: 'Skeleton',   glyph: '☠', color: '#cfcfcf', hp: 22,  dmg: 6,  speed: 2.2, range: 1.1, attackKind: 'melee', xp: 8,  goldRange: [1, 4],
      trait: null, shape: 'skeleton' },
    ghoul:    { name: 'Ghoul',      glyph: 'ɣ', color: '#9bbf95', hp: 35,  dmg: 9,  speed: 2.8, range: 1.1, attackKind: 'melee', xp: 12, goldRange: [2, 5],
      trait: 'lunge', shape: 'hunched' },
    wraith:   { name: 'Wraith',     glyph: '∽', color: '#c489ff', hp: 18,  dmg: 7,  speed: 2.0, range: 4.5, attackKind: 'ranged-soul', xp: 14, goldRange: [3, 6],
      trait: 'phase', shape: 'ghost', projColor: '#c489ff' },
    lich:     { name: 'Lich Lord',  glyph: '✪', color: '#ff4d6d', hp: 360, dmg: 14, speed: 1.8, range: 5.5, attackKind: 'ranged-soul', xp: 80, goldRange: [40, 80], boss: true,
      trait: 'summon', shape: 'caster', projColor: '#ff4d6d' },

    // overgrowth
    spider:   { name: 'Spider',     glyph: '✶', color: '#51e6a4', hp: 26,  dmg: 8,  speed: 3.5, range: 1.0, attackKind: 'melee', xp: 10, goldRange: [2, 4],
      trait: 'swarm', shape: 'spider' },
    thorn:    { name: 'Thornling',  glyph: '✲', color: '#9be57c', hp: 40,  dmg: 10, speed: 1.6, range: 1.1, attackKind: 'melee', xp: 14, goldRange: [3, 6],
      trait: 'thorns', shape: 'plant' },
    wisp:     { name: 'Wisp',       glyph: '∗', color: '#ffe066', hp: 14,  dmg: 6,  speed: 3.4, range: 4.0, attackKind: 'ranged-soul', xp: 12, goldRange: [3, 6],
      trait: 'erratic', shape: 'orb', projColor: '#ffe066' },
    druid:    { name: 'Old Druid',  glyph: '❦', color: '#51e6a4', hp: 480, dmg: 18, speed: 2.0, range: 4.5, attackKind: 'ranged-soul', xp: 120, goldRange: [60, 120], boss: true,
      trait: 'heal', shape: 'caster', projColor: '#51e6a4' },

    // frost
    wolf:     { name: 'Frostwolf',  glyph: '✦', color: '#bcd9ee', hp: 32,  dmg: 11, speed: 4.0, range: 1.0, attackKind: 'melee', xp: 14, goldRange: [3, 6],
      trait: 'pack', shape: 'beast' },
    frostgiant: { name: 'Frost Giant', glyph: '✷', color: '#ffffff', hp: 70, dmg: 16, speed: 1.5, range: 1.2, attackKind: 'melee', xp: 22, goldRange: [5, 12],
      trait: 'slam', shape: 'giant' },
    icebat:   { name: 'Ice Bat',    glyph: '✺', color: '#a0e0ff', hp: 18,  dmg: 9,  speed: 3.6, range: 1.0, attackKind: 'melee', xp: 12, goldRange: [3, 6],
      trait: 'flyby', shape: 'bat' },
    wyrm:     { name: 'Ice Wyrm',   glyph: '♅', color: '#a0e0ff', hp: 620, dmg: 22, speed: 2.4, range: 5.5, attackKind: 'ranged-soul', xp: 180, goldRange: [80, 160], boss: true,
      trait: 'breath', shape: 'wyrm', projColor: '#a0e0ff' },

    // infernal
    imp:      { name: 'Imp',        glyph: '✦', color: '#ff7043', hp: 28,  dmg: 12, speed: 3.4, range: 3.5, attackKind: 'ranged-soul', xp: 16, goldRange: [4, 8],
      trait: 'blink', shape: 'imp', projColor: '#ff7043' },
    hellhound:{ name: 'Hellhound',  glyph: '☼', color: '#ff4d6d', hp: 56,  dmg: 16, speed: 4.0, range: 1.1, attackKind: 'melee', xp: 20, goldRange: [5, 10],
      trait: 'charge', shape: 'beast' },
    demon:    { name: 'Demon',      glyph: '⛧', color: '#ff4d6d', hp: 92,  dmg: 20, speed: 2.4, range: 1.2, attackKind: 'melee', xp: 28, goldRange: [6, 14],
      trait: 'cleave', shape: 'giant' },
    archdemon:{ name: 'Archdemon',  glyph: '⛤', color: '#ff4d6d', hp: 900, dmg: 28, speed: 2.6, range: 4.5, attackKind: 'ranged-soul', xp: 280, goldRange: [120, 240], boss: true,
      trait: 'multiatk', shape: 'demon', projColor: '#ff4d6d' },

    // void spire
    voidling:       { name: 'Voidling',         glyph: '◬', color: '#b388ff', hp: 42,  dmg: 16, speed: 3.8, range: 1.0, attackKind: 'melee', xp: 22, goldRange: [5, 10],
      trait: 'split', shape: 'void' },
    nullweaver:     { name: 'Nullweaver',       glyph: '◎', color: '#00e5ff', hp: 34,  dmg: 14, speed: 2.8, range: 5.0, attackKind: 'ranged-soul', xp: 26, goldRange: [6, 12],
      trait: 'silence', shape: 'weaver', projColor: '#00e5ff' },
    crystalsentinel:{ name: 'Crystal Sentinel', glyph: '⬡', color: '#e0e0ff', hp: 110, dmg: 22, speed: 1.8, range: 1.3, attackKind: 'melee', xp: 34, goldRange: [8, 16],
      trait: 'reflect', shape: 'crystal' },
    voidlord:       { name: 'Void Lord',        glyph: '☆', color: '#b388ff', hp: 1200, dmg: 34, speed: 2.8, range: 5.5, attackKind: 'ranged-soul', xp: 400, goldRange: [180, 360], boss: true,
      trait: 'voidpulse', shape: 'voidlord', projColor: '#b388ff' },
    // Treasure Goblin — flees instead of fighting; kill it before it escapes for a jackpot.
    goblin:         { name: 'Treasure Goblin',  glyph: '$', color: '#ffd24a', hp: 60, dmg: 0, speed: 3.4, range: 0, attackKind: 'none', xp: 20, goldRange: [0, 0],
      trait: 'flee', shape: 'goblin' },
    // THE HOLLOW KING — the campaign's final boss (reached via the Hollow Throne).
    hollowking:     { name: 'The Hollow King',  glyph: '♔', color: '#b388ff', hp: 2600, dmg: 40, speed: 2.6, range: 6.0, attackKind: 'ranged-soul', xp: 900, goldRange: [400, 800], boss: true,
      trait: 'multiatk', shape: 'hollowking', projColor: '#c489ff' },
  };

  // Bestiary lore — flavor text shown once an enemy has been discovered (killed).
  const BESTIARY_LORE = {
    skeleton:        'Bones knit together by crypt-magic. They feel no pain and ask for none.',
    ghoul:           'Once mourners, now feeders. They lunge at the warmth of the living.',
    wraith:          'A grudge that outlived its body. It phases through stone to reach you.',
    lich:            'The Crypts\' undying master. His soul-bolts have unmade braver heroes.',
    spider:          'Ruin-weavers the size of hounds. They hunt in skittering swarms.',
    thorn:           'A walking bramble that bleeds sap and spite. Strikes back when struck.',
    wisp:            'A drifting ember of the old grove, erratic and quick to scald.',
    druid:           'Keeper of the Overgrowth, mending his own wounds faster than you can open them.',
    wolf:            'Frost-furred pack hunters. One is danger; the pack is death.',
    frostgiant:      'A glacier given fists. Its ground-slam shatters footing and bone alike.',
    icebat:          'Shrieking shards of ice on the wing. They strafe and vanish.',
    wyrm:            'The Frozen Peaks coil around this ancient serpent\'s frozen breath.',
    imp:             'Cinder-imps blink through the smoke, flinging fire from nowhere.',
    hellhound:       'It charges in a line of flame. Do not be standing in that line.',
    demon:           'Brute infernals that cleave through ranks in a single swing.',
    archdemon:       'A warlord of the Infernal Depths. Its many arms strike all at once.',
    voidling:        'Torn from the space between stars. Slain, it splits and splits again.',
    nullweaver:      'It unravels intent itself, silencing a hero\'s arts mid-cast.',
    crystalsentinel: 'A faceted guardian that turns your own blows back upon you.',
    voidlord:        'The Spire\'s heart and hunger. Reality bends, then breaks, around it.',
  };

  // ITEM BASES — weapon, armor, ring, amulet
  const ITEM_BASES = {
    // ===== WEAPONS — Swords (Warrior) =====
    'rusted-sword':       { type: 'weapon', name: 'Rusted Sword',       icon: '⚔', base: { dmg: 4 },  ilvl: 1, glyph: 'wep' },
    'iron-sword':         { type: 'weapon', name: 'Iron Sword',         icon: '⚔', base: { dmg: 8 },  ilvl: 4, glyph: 'wep' },
    'runed-blade':        { type: 'weapon', name: 'Runed Blade',        icon: '⚔', base: { dmg: 14 }, ilvl: 8, glyph: 'wep' },
    'glassfang':          { type: 'weapon', name: 'Glassfang',          icon: '⚔', base: { dmg: 18 }, ilvl: 11, glyph: 'wep' },
    'spire-cleaver':      { type: 'weapon', name: 'Spire Cleaver',      icon: '⚔', base: { dmg: 24 }, ilvl: 14, glyph: 'wep' },
    'shatterpoint':       { type: 'weapon', name: 'Shatterpoint',       icon: '⚔', base: { dmg: 30 }, ilvl: 17, glyph: 'wep' },
    'prism-edge':         { type: 'weapon', name: 'Prism Edge',         icon: '⚔', base: { dmg: 36, hp: 20 }, ilvl: 20, glyph: 'wep' },

    // ===== WEAPONS — Staves (Mage) =====
    'apprentice-staff':   { type: 'weapon', name: 'Apprentice Staff',   icon: '✦', base: { dmg: 4, mp: 4 }, ilvl: 1, glyph: 'wep' },
    'crystal-staff':      { type: 'weapon', name: 'Crystal Staff',      icon: '✦', base: { dmg: 9, mp: 8 }, ilvl: 5, glyph: 'wep' },
    'arcane-staff':       { type: 'weapon', name: 'Arcane Staff',       icon: '✦', base: { dmg: 15, mp: 14 }, ilvl: 9, glyph: 'wep' },
    'vitreous-scepter':   { type: 'weapon', name: 'Vitreous Scepter',   icon: '✦', base: { dmg: 20, mp: 18 }, ilvl: 12, glyph: 'wep' },
    'spire-conductor':    { type: 'weapon', name: 'Spire Conductor',    icon: '✦', base: { dmg: 26, mp: 24 }, ilvl: 15, glyph: 'wep' },
    'crystalweave-staff': { type: 'weapon', name: 'Crystalweave Staff', icon: '✦', base: { dmg: 32, mp: 30 }, ilvl: 18, glyph: 'wep' },
    'glasspire-focus':    { type: 'weapon', name: 'Hollowlight Focus',    icon: '✦', base: { dmg: 38, mp: 40 }, ilvl: 21, glyph: 'wep' },

    // ===== WEAPONS — Bows (Ranger) =====
    'short-bow':          { type: 'weapon', name: 'Short Bow',          icon: '➹', base: { dmg: 3 }, ilvl: 1, glyph: 'wep' },
    'recurve-bow':        { type: 'weapon', name: 'Recurve Bow',        icon: '➹', base: { dmg: 6 }, ilvl: 4, glyph: 'wep' },
    'longbow':            { type: 'weapon', name: 'Longbow',            icon: '➹', base: { dmg: 11 }, ilvl: 8, glyph: 'wep' },
    'silkstring-bow':     { type: 'weapon', name: 'Silkstring Bow',     icon: '➹', base: { dmg: 15 }, ilvl: 11, glyph: 'wep' },
    'glassthorn-bow':     { type: 'weapon', name: 'Glassthorn Bow',     icon: '➹', base: { dmg: 20 }, ilvl: 14, glyph: 'wep' },
    'refracted-arc':      { type: 'weapon', name: 'Refracted Arc',      icon: '➹', base: { dmg: 26 }, ilvl: 17, glyph: 'wep' },
    'prismatic-longbow':  { type: 'weapon', name: 'Prismatic Longbow',  icon: '➹', base: { dmg: 32 }, ilvl: 20, glyph: 'wep' },

    // ===== WEAPONS — Wands (Summoner) =====
    'bone-wand':          { type: 'weapon', name: 'Bone Wand',          icon: '☠', base: { dmg: 4 }, ilvl: 1, glyph: 'wep' },
    'death-wand':         { type: 'weapon', name: 'Death Wand',         icon: '☠', base: { dmg: 8 }, ilvl: 4, glyph: 'wep' },
    'lich-scepter':       { type: 'weapon', name: 'Lich Scepter',       icon: '☠', base: { dmg: 13 }, ilvl: 8, glyph: 'wep' },
    'hollowed-femur':     { type: 'weapon', name: 'Hollowed Femur',     icon: '☠', base: { dmg: 17, mp: 6 }, ilvl: 11, glyph: 'wep' },
    'soulglass-rod':      { type: 'weapon', name: 'Soulglass Rod',      icon: '☠', base: { dmg: 22, mp: 10 }, ilvl: 14, glyph: 'wep' },
    'spire-phylactery':   { type: 'weapon', name: 'Spire Phylactery',   icon: '☠', base: { dmg: 28, mp: 14 }, ilvl: 17, glyph: 'wep' },
    'void-conduit':       { type: 'weapon', name: 'Void Conduit',       icon: '☠', base: { dmg: 34, mp: 20 }, ilvl: 20, glyph: 'wep' },

    // ===== ARMOR — Heavy (Warrior-favored) =====
    'leather':            { type: 'armor', name: 'Leather Vest',        icon: '◇', base: { def: 4 },  ilvl: 1 },
    'chain':              { type: 'armor', name: 'Chain Mail',          icon: '◇', base: { def: 9 },  ilvl: 4 },
    'plate':              { type: 'armor', name: 'Plate Mail',          icon: '◇', base: { def: 16 }, ilvl: 8 },
    'shard-plate':        { type: 'armor', name: 'Shard Plate',         icon: '◇', base: { def: 22 }, ilvl: 12 },
    'vitrified-cuirass':  { type: 'armor', name: 'Vitrified Cuirass',   icon: '◇', base: { def: 28, hp: 10 }, ilvl: 15 },
    'glasspire-aegis':    { type: 'armor', name: 'Hollowlight Aegis',     icon: '◇', base: { def: 36, hp: 20 }, ilvl: 19 },

    // ===== ARMOR — Light (Ranger-favored) =====
    'hide-tunic':         { type: 'armor', name: 'Hide Tunic',          icon: '◇', base: { def: 3 },  ilvl: 1 },
    'scout-leather':      { type: 'armor', name: 'Scout Leather',       icon: '◇', base: { def: 7 },  ilvl: 4 },
    'shadow-vest':        { type: 'armor', name: 'Shadow Vest',         icon: '◇', base: { def: 12 }, ilvl: 8 },
    'serpent-scale':      { type: 'armor', name: 'Serpent Scale',        icon: '◇', base: { def: 16 }, ilvl: 11 },
    'mirrorweave':        { type: 'armor', name: 'Mirrorweave',         icon: '◇', base: { def: 20 }, ilvl: 14 },
    'refracted-cloak':    { type: 'armor', name: 'Refracted Cloak',     icon: '◇', base: { def: 26 }, ilvl: 18 },

    // ===== ARMOR — Robes (Mage/Summoner-favored) =====
    'robe':               { type: 'armor', name: 'Acolyte Robe',        icon: '◇', base: { def: 3, mp: 10 }, ilvl: 1 },
    'mage-robe':          { type: 'armor', name: 'Mage Robe',           icon: '◇', base: { def: 6, mp: 20 }, ilvl: 5 },
    'arcane-vestment':    { type: 'armor', name: 'Arcane Vestment',     icon: '◇', base: { def: 9, mp: 28 }, ilvl: 9 },
    'glassweave-robe':    { type: 'armor', name: 'Glassweave Robe',     icon: '◇', base: { def: 12, mp: 36 }, ilvl: 13 },
    'spire-mantle':       { type: 'armor', name: 'Spire Mantle',        icon: '◇', base: { def: 16, mp: 44 }, ilvl: 17 },
    'crystalline-shroud': { type: 'armor', name: 'Crystalline Shroud',  icon: '◇', base: { def: 20, mp: 55 }, ilvl: 20 },

    // ===== HELMETS =====
    'iron-helm':          { type: 'armor', name: 'Iron Helm',           icon: '◆', base: { def: 3 },  ilvl: 2 },
    'shard-crown':        { type: 'armor', name: 'Shard Crown',         icon: '◆', base: { def: 6 },  ilvl: 6 },
    'vitreous-helm':      { type: 'armor', name: 'Vitreous Helm',       icon: '◆', base: { def: 10 }, ilvl: 10 },
    'prism-circlet':      { type: 'armor', name: 'Prism Circlet',       icon: '◆', base: { def: 5, mp: 12 }, ilvl: 8 },
    'glasspire-crown':    { type: 'armor', name: 'Hollowlight Crown',     icon: '◆', base: { def: 14, hp: 15 }, ilvl: 14 },
    'hollow-diadem':      { type: 'armor', name: 'Hollow Diadem',       icon: '◆', base: { def: 8, mp: 22 }, ilvl: 16 },

    // ===== SHIELDS (armor type) =====
    'wooden-buckler':     { type: 'armor', name: 'Wooden Buckler',      icon: '⊡', base: { def: 5 },  ilvl: 2 },
    'iron-kite':          { type: 'armor', name: 'Iron Kite Shield',    icon: '⊡', base: { def: 10 }, ilvl: 5 },
    'glass-tower':        { type: 'armor', name: 'Glass Tower Shield',  icon: '⊡', base: { def: 16, hp: 10 }, ilvl: 9 },
    'mirror-ward':        { type: 'armor', name: 'Mirror Ward',         icon: '⊡', base: { def: 22, hp: 15 }, ilvl: 13 },
    'spirewall':          { type: 'armor', name: 'Spirewall',           icon: '⊡', base: { def: 30, hp: 25 }, ilvl: 18 },

    // ===== BOOTS =====
    'worn-boots':         { type: 'armor', name: 'Worn Boots',          icon: '◈', base: { def: 2 },  ilvl: 1 },
    'iron-greaves':       { type: 'armor', name: 'Iron Greaves',        icon: '◈', base: { def: 5 },  ilvl: 5 },
    'glass-treads':       { type: 'armor', name: 'Glass Treads',        icon: '◈', base: { def: 8 },  ilvl: 9 },
    'windwalkers':        { type: 'armor', name: 'Windwalkers',         icon: '◈', base: { def: 6 },  ilvl: 7 },
    'spire-striders':     { type: 'armor', name: 'Spire Striders',      icon: '◈', base: { def: 12, hp: 10 }, ilvl: 14 },
    'crystalline-sabatons':{ type: 'armor', name: 'Crystalline Sabatons', icon: '◈', base: { def: 16, hp: 15 }, ilvl: 18 },

    // ===== RINGS =====
    'copper-ring':        { type: 'ring', name: 'Copper Ring',           icon: '○', base: {}, ilvl: 1 },
    'silver-ring':        { type: 'ring', name: 'Silver Ring',           icon: '○', base: {}, ilvl: 5 },
    'gold-ring':          { type: 'ring', name: 'Gold Ring',             icon: '○', base: {}, ilvl: 9 },
    'glass-band':         { type: 'ring', name: 'Glass Band',            icon: '○', base: {}, ilvl: 3 },
    'prism-ring':         { type: 'ring', name: 'Prism Ring',            icon: '○', base: { mp: 6 }, ilvl: 7 },
    'shard-loop':         { type: 'ring', name: 'Shard Loop',            icon: '○', base: { hp: 8 }, ilvl: 6 },
    'spire-signet':       { type: 'ring', name: 'Spire Signet',          icon: '○', base: {}, ilvl: 12 },
    'void-ring':          { type: 'ring', name: 'Void Ring',             icon: '○', base: { mp: 12 }, ilvl: 14 },
    'crystalline-band':   { type: 'ring', name: 'Crystalline Band',      icon: '○', base: { hp: 15 }, ilvl: 16 },
    'glassheart-ring':    { type: 'ring', name: 'Glassheart Ring',       icon: '○', base: {}, ilvl: 19 },

    // ===== AMULETS =====
    'iron-amulet':        { type: 'amulet', name: 'Iron Amulet',        icon: '◈', base: {}, ilvl: 2 },
    'jade-amulet':        { type: 'amulet', name: 'Jade Amulet',        icon: '◈', base: {}, ilvl: 6 },
    'star-amulet':        { type: 'amulet', name: 'Star Amulet',        icon: '◈', base: {}, ilvl: 10 },
    'glass-pendant':      { type: 'amulet', name: 'Glass Pendant',      icon: '◈', base: { mp: 6 }, ilvl: 4 },
    'shard-talisman':     { type: 'amulet', name: 'Shard Talisman',     icon: '◈', base: { hp: 10 }, ilvl: 8 },
    'spire-locket':       { type: 'amulet', name: 'Spire Locket',       icon: '◈', base: {}, ilvl: 13 },
    'prismatic-choker':   { type: 'amulet', name: 'Prismatic Choker',   icon: '◈', base: { mp: 14 }, ilvl: 15 },
    'void-amulet':        { type: 'amulet', name: 'Void Amulet',        icon: '◈', base: { hp: 20 }, ilvl: 17 },
    'glasspire-heart':    { type: 'amulet', name: 'Hollowlight Heart',    icon: '◈', base: {}, ilvl: 20 },
    'eye-of-the-spire':   { type: 'amulet', name: 'Eye of the Spire',  icon: '◈', base: { hp: 15, mp: 15 }, ilvl: 22 },

    // ===== LEGENDARY WEAPONS =====
    'demonslayer':        { type: 'weapon', name: 'Demonslayer',         icon: '⚔', base: { dmg: 42, hp: 30, str: 3 }, ilvl: 23, glyph: 'wep', grantsSkill: 'demonslash', legendary: true, look: 'demon' },
    'frostbite-edge':     { type: 'weapon', name: 'Frostbite Edge',      icon: '⚔', base: { dmg: 38, def: 8 },  ilvl: 21, glyph: 'wep', legendary: true, look: 'frost' },
    'starfall-staff':     { type: 'weapon', name: 'Starfall Staff',      icon: '✦', base: { dmg: 44, mp: 50, int: 3 }, ilvl: 23, glyph: 'wep', grantsSkill: 'starfall', legendary: true, look: 'star' },
    'voidweaver':         { type: 'weapon', name: 'Voidweaver',          icon: '✦', base: { dmg: 40, mp: 35 }, ilvl: 22, glyph: 'wep', legendary: true, look: 'void' },
    'typhoon-bow':        { type: 'weapon', name: 'Typhoon Bow',         icon: '➹', base: { dmg: 38, dex: 3 }, ilvl: 23, glyph: 'wep', grantsSkill: 'typhoonshot', legendary: true, look: 'storm' },
    'shadowpiercer':      { type: 'weapon', name: 'Shadowpiercer',       icon: '➹', base: { dmg: 34, crit: 8 }, ilvl: 21, glyph: 'wep', legendary: true, look: 'shadow' },
    'soulreaper':         { type: 'weapon', name: 'Soulreaper',          icon: '☠', base: { dmg: 40, mp: 25, hp: 15 }, ilvl: 23, glyph: 'wep', grantsSkill: 'soulharvest', legendary: true, look: 'soul' },
    'gravecaller':        { type: 'weapon', name: 'Gravecaller',         icon: '☠', base: { dmg: 36, mp: 18 }, ilvl: 21, glyph: 'wep', legendary: true, look: 'bone' },
    // ----- new legendary weapons -----
    'emberforge-maul':    { type: 'weapon', name: 'Emberforge Maul',     icon: '⚔', base: { dmg: 48, str: 4 }, ilvl: 24, glyph: 'wep', legendary: true, look: 'flame' },
    'tempest-spire':      { type: 'weapon', name: 'Tempest Spire',       icon: '✦', base: { dmg: 41, mp: 45, dex: 2 }, ilvl: 24, glyph: 'wep', legendary: true, look: 'storm' },
    'duskfang':           { type: 'weapon', name: 'Duskfang',            icon: '☠', base: { dmg: 39, crit: 6, mp: 20 }, ilvl: 23, glyph: 'wep', legendary: true, look: 'shadow' },

    // ===== LEGENDARY ARMOR =====
    'dragonscale-plate':  { type: 'armor', name: 'Dragonscale Plate',    icon: '◇', base: { def: 42, hp: 30 }, ilvl: 22, legendary: true, look: 'wings' },
    'abyssal-robe':       { type: 'armor', name: 'Abyssal Robe',         icon: '◇', base: { def: 24, mp: 65 }, ilvl: 22, legendary: true, look: 'cape' },
    'nightstalker-coat':  { type: 'armor', name: 'Nightstalker Coat',    icon: '◇', base: { def: 30, dex: 2 }, ilvl: 21, legendary: true, look: 'cape' },
    'bonelord-mantle':    { type: 'armor', name: 'Bonelord Mantle',      icon: '◇', base: { def: 26, mp: 40, hp: 20 }, ilvl: 22, legendary: true, look: 'spectral' },
    'seraph-aegis':       { type: 'armor', name: 'Seraph Aegis',         icon: '◇', base: { def: 40, hp: 25, mp: 25 }, ilvl: 24, legendary: true, look: 'wings' },

    // ===== LEGENDARY HELMETS =====
    'crown-of-ashes':     { type: 'armor', name: 'Crown of Ashes',       icon: '◆', base: { def: 18, dmg: 5 }, ilvl: 20, legendary: true, look: 'crown' },
    'mindshatter-circlet':{ type: 'armor', name: 'Mindshatter Circlet',  icon: '◆', base: { def: 12, mp: 30, int: 2 }, ilvl: 19, legendary: true, look: 'halo' },
    'halo-of-the-first':  { type: 'armor', name: 'Halo of the First',    icon: '◆', base: { def: 16, hp: 18, mp: 18 }, ilvl: 24, legendary: true, look: 'halo' },

    // ===== LEGENDARY SHIELDS =====
    'aegis-of-the-spire': { type: 'armor', name: 'Aegis of the Spire',  icon: '⊡', base: { def: 38, hp: 35 }, ilvl: 21, legendary: true, look: 'plate' },

    // ===== LEGENDARY BOOTS =====
    'voidstep-boots':     { type: 'armor', name: 'Voidstep Boots',       icon: '◈', base: { def: 14, dex: 2 }, ilvl: 19, legendary: true, look: 'spectral' },
    'flamewalk-greaves':  { type: 'armor', name: 'Flamewalk Greaves',    icon: '◈', base: { def: 18, hp: 20, str: 1 }, ilvl: 21, legendary: true, look: 'plate' },

    // ===== LEGENDARY RINGS =====
    'ring-of-the-archdemon': { type: 'ring', name: 'Ring of the Archdemon', icon: '○', base: { dmg: 6, crit: 5 }, ilvl: 22, legendary: true, look: 'demon' },
    'frostfire-band':     { type: 'ring', name: 'Frostfire Band',        icon: '○', base: { mp: 18, hp: 10 }, ilvl: 20, legendary: true, look: 'frost' },
    'blood-signet':       { type: 'ring', name: 'Blood Signet',          icon: '○', base: { hp: 25, vit: 3 }, ilvl: 21, legendary: true, look: 'demon' },
    'starlight-loop':     { type: 'ring', name: 'Starlight Loop',        icon: '○', base: { mp: 14, crit: 4, int: 2 }, ilvl: 23, legendary: true, look: 'star' },

    // ===== LEGENDARY AMULETS =====
    'heart-of-the-wyrm':  { type: 'amulet', name: 'Heart of the Wyrm',  icon: '◈', base: { hp: 30, def: 8, vit: 2 }, ilvl: 22, legendary: true, look: 'frost' },
    'pendant-of-souls':   { type: 'amulet', name: 'Pendant of Souls',   icon: '◈', base: { mp: 25, dmg: 4, int: 2 }, ilvl: 21, legendary: true, look: 'soul' },
    'stormcaller-chain':  { type: 'amulet', name: 'Stormcaller Chain',   icon: '◈', base: { dmg: 6, aspd: 8, dex: 2 }, ilvl: 23, legendary: true, look: 'storm' },
    'oblivion-tear':      { type: 'amulet', name: 'Oblivion Tear',       icon: '◈', base: { dmg: 8, mp: 20, hp: 20 }, ilvl: 24, legendary: true, look: 'void' },

    // ===== CONSUMABLES =====
    'sanctuary-scroll':   { type: 'consumable', name: 'Sanctuary Scroll', icon: '✉', base: {}, ilvl: 1 },
    'glass-tear':         { type: 'consumable', name: 'Glass Tear',       icon: '◊', base: {}, ilvl: 1 },
    'health-potion':      { type: 'consumable', name: 'Health Potion',    icon: '♥', base: {}, ilvl: 1 },

    // ===== GEMS (socket into items for permanent bonus) =====
    'ruby':       { type: 'gem', name: 'Ruby',       icon: '◆', base: {}, ilvl: 1, gemId: 'ruby' },
    'sapphire':   { type: 'gem', name: 'Sapphire',   icon: '◆', base: {}, ilvl: 1, gemId: 'sapphire' },
    'emerald':    { type: 'gem', name: 'Emerald',    icon: '◆', base: {}, ilvl: 1, gemId: 'emerald' },
    'topaz':      { type: 'gem', name: 'Topaz',      icon: '◆', base: {}, ilvl: 1, gemId: 'topaz' },
    'diamond':    { type: 'gem', name: 'Diamond',    icon: '◆', base: {}, ilvl: 1, gemId: 'diamond' },
  };

  // ============================================================
  // GEMS — slotted into items for permanent stat bonuses
  // ============================================================
  const GEMS = {
    ruby:     { name: 'Ruby',     color: '#ff4d6d', desc: '+5 Damage',  dmg: 5 },
    sapphire: { name: 'Sapphire', color: '#6df1ff', desc: '+12 Mana',   mp: 12 },
    emerald:  { name: 'Emerald', color: '#51e6a4', desc: '+4 Armor',   def: 4 },
    topaz:    { name: 'Topaz',    color: '#ffd166', desc: '+15 Life',   hp: 15 },
    diamond:  { name: 'Diamond',  color: '#ffffff', desc: '+3% Crit',   crit: 3 },
  };

  // ============================================================
  // PASSIVE SKILL TREE — universal passives, 1 tome per unlock
  // Unlocked after level 10. Effects are applied in derived() and on-kill hook.
  // ============================================================
  const PASSIVES = {
    toughness:   { name: 'Toughness',   desc: '+25% Max HP',           icon: '♥' },
    vigor:       { name: 'Vigor',       desc: '+25% Max MP',           icon: '✦' },
    sharp_eye:   { name: 'Sharp Eye',   desc: '+8% Crit Chance',       icon: '◎' },
    ferocity:    { name: 'Ferocity',    desc: '+15% Damage',           icon: '⚔' },
    fortify:     { name: 'Fortify',     desc: '+30 Armor',             icon: '◇' },
    alacrity:    { name: 'Alacrity',    desc: '+15% Attack Speed',     icon: '⚡' },
    greedy:      { name: 'Greedy',      desc: '+30% Gold per Kill',    icon: '$' },
    scholar:     { name: 'Scholar',     desc: '+30% XP per Kill',      icon: '★' },
    bloodletter: { name: 'Bloodletter', desc: 'Heal 3 HP per Kill',    icon: '+' },
    mana_reaver: { name: 'Mana Reaver', desc: 'Restore 4 MP per Kill', icon: '✧' },
  };

  // ============================================================
  // ITEM SETS — wear 3 matching pieces for the bonus
  // Pieces must be in: weapon, armor, ring, or amulet slots (only 4 equip slots)
  // ============================================================
  const SETS = {
    cryptwarden: {
      name: "Cryptwarden's Pact",
      pieces: ['iron-sword', 'plate', 'iron-amulet'],
      bonusDesc: '3pc: +20% Damage, +25 Armor, +40 HP',
      bonus: { dmgMul: 0.2, def: 25, hp: 40 },
    },
    archon: {
      name: "Archon's Mantle",
      pieces: ['arcane-staff', 'mage-robe', 'prism-ring'],
      bonusDesc: '3pc: +25% Damage, +50 MP',
      bonus: { dmgMul: 0.25, mp: 50 },
    },
    shadowstalker: {
      name: "Shadowstalker's Edge",
      pieces: ['longbow', 'shadow-vest', 'gold-ring'],
      bonusDesc: '3pc: +8% Crit, +20% Attack Speed',
      bonus: { crit: 8, aspdMul: 0.2 },
    },
    bonelord: {
      name: "Bonelord's Regalia",
      pieces: ['lich-scepter', 'arcane-vestment', 'glass-pendant'],
      bonusDesc: '3pc: +20% Damage, +40 MP, +20 HP',
      bonus: { dmgMul: 0.2, mp: 40, hp: 20 },
    },
  };

  // ============================================================
  // SHRINES — temporary buff pickups placed in dungeons
  // ============================================================
  const SHRINES = {
    fury:    { name: 'Shrine of Fury',    color: '#ff6644', icon: '⚔', duration: 30, effect: 'damage', desc: '2× Damage 30s' },
    arcane:  { name: 'Shrine of Arcana',  color: '#6df1ff', icon: '✦', duration: 30, effect: 'mana',   desc: 'Full MP + 2× regen 30s' },
    warding: { name: 'Shrine of Warding', color: '#ffd166', icon: '◇', duration: 15, effect: 'invuln', desc: 'Invulnerable 15s' },
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

  const RARITY_TIERS = ['common', 'magic', 'rare', 'unique', 'mythic'];
  const RARITY_WEIGHTS = [[ 'common', 70 ], [ 'magic', 22 ], [ 'rare', 7 ], [ 'unique', 1 ], [ 'mythic', 0.2 ]];
  // Rank used to compare rarities (e.g. for "is this an upgrade" glow, mythic > unique).
  const RARITY_RANK = { common: 0, magic: 1, rare: 2, unique: 3, mythic: 4 };

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
    keys: {},                     // held keys (current state)
    tapped: {},                   // tap queue — survives until tickPlayer processes it
    moveX: 0, moveY: 0,           // current movement vector
    comboBuffer: [],
    lastKeyTime: 0,
    floatingTexts: [],
    particles: [],
    enemies: [],
    projectiles: [],
    telegraphs: [],               // boss AoE wind-up markers (dodgeable)
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
    rift: null,   // { active, level, kills, killsNeeded, timeLeft } during a Greater Rift run
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
    // clear held keys and impulse when leaving the game screen to prevent stuck movement
    if (game.screen === 'game' && id !== 'game') {
      game.keys = {};
      game.tapped = {};
      if (game.world && game.world.player) {
        game.world.player._impulseT = 0;
        game.world.player._impulseX = 0;
        game.world.player._impulseY = 0;
      }
      // snapshot world position so player resumes here on next load
      saveGame();
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
  // When a list re-renders after an action (buy/sell/etc.), keep the cursor where it was
  // instead of snapping back to the top. Capture the focused row's position, then restore it.
  function listFocusIndex(listEl) {
    if (!listEl || !document.activeElement) return -1;
    return Array.from(listEl.querySelectorAll('.focusable')).indexOf(document.activeElement);
  }
  function listFocusRestore(listEl, idx) {
    if (!listEl || idx < 0) return;
    const items = Array.from(listEl.querySelectorAll('.focusable:not([disabled])'));
    if (!items.length) return;
    const el = items[Math.min(idx, items.length - 1)];
    if (el) { try { el.focus(); } catch (e) {} }
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
  function makeStarterItem(baseId) {
    const base = ITEM_BASES[baseId];
    return {
      id: 'i_' + Math.random().toString(36).slice(2, 9),
      baseId,
      rarity: 'common',
      affixes: [],
      ilvl: 1,
      sockets: 0,
      gems: [],
      name: base.name,
    };
  }
  // Create a gem-type inventory item (for vendor & drops)
  function makeGemItem(gemId) {
    if (!GEMS[gemId] || !ITEM_BASES[gemId]) return null;
    return {
      id: 'g_' + Math.random().toString(36).slice(2, 9),
      baseId: gemId,
      rarity: 'magic',
      affixes: [],
      ilvl: 1,
      sockets: 0,
      gems: [],
      name: GEMS[gemId].name,
    };
  }
  function starterGear(classId) {
    // each class gets a thematic weapon + armor to start
    const weapons = {
      warrior: 'rusted-sword',
      mage: 'apprentice-staff',
      ranger: 'short-bow',
      summoner: 'bone-wand',
    };
    const armors = {
      warrior: 'leather',
      mage: 'robe',
      ranger: 'leather',
      summoner: 'robe',
    };
    return {
      weapon: makeStarterItem(weapons[classId]),
      armor: makeStarterItem(armors[classId]),
    };
  }
  function defaultSave(classId) {
    const cls = CLASSES[classId];
    const gear = starterGear(classId);
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
        gold: 10,
        equip: { weapon: gear.weapon, armor: gear.armor, ring: null, amulet: null },
        inventory: [gear.weapon, gear.armor],
        potions: 3,
        sanctuaryScrolls: 0,  // consumable: warp to town from anywhere
        tomes: 0,             // currency for passive skill unlocks
        passives: {},         // unlocked passives map: { [passiveId]: true }
        glassTears: 0,        // consumable: reroll an item's affixes at vendor
        craftDust: 0,         // crafting material from salvaging items at the Keeper
        paragonLevel: 0,      // post-cap progression level
        paragonXp: 0,         // XP toward next paragon level
        paragonPoints: 0,     // unspent paragon points
        paragonStats: { str: 0, int: 0, dex: 0, vit: 0 }, // allocated paragon stat bonuses
        selectedSkill: cls.skills[0],  // track which skill is active
        skillRunes: {},        // { [skillId]: runeId } — chosen augment per skill
        autoPotion: true,      // auto-drink a potion when HP drops below threshold
        autoPotionPct: 0.35,   // fraction of max HP that triggers an auto-potion
        hardcore: false,       // one life — permadeath when true (set at class select)
        transmog: { weapon: null, armor: null },  // appearance overrides (look id or null = item's own)
        hireling: null,        // recruited companion: { type, level } or null
        sigils: 0,             // Nightmare Sigils — consumed to open keyed Nightmare dungeons
      },
      stash: [],
      unlockedBiomes: { crypts: true, overgrowth: false, frostpeak: false, infernal: false, voidspire: false },
      bossesKilled: {},
      bestiary: {},   // { [enemyId]: killCount } — populated as enemies are slain
      bestRift: 0,    // deepest Greater Rift level cleared
      difficulty: 'normal',     // currently selected difficulty tier
      maxDifficulty: 'normal',  // highest unlocked tier
      upgrades: { pickup: 0, xpgain: 0, goldfind: 0, potions: 0 },  // permanent gold-sink perks
      quest: null,    // active bounty
      questsCompleted: 0,
      wardrobe: {},   // { [lookId]: true } — appearance looks the player has discovered
      gameWon: false, // true once the Hollow King (final boss) is defeated
      worldState: null,    // persisted location for resume on reload
      savedDungeon: null,  // dungeon to return to after using Sanctuary Scroll
      mysteryVendor: null, // { day: number, baseId: string, bought: bool }
    };
  }

  // ---- Hardcore mode (opt-in permadeath) + Roll of Honor ----
  let _hardcorePick = false;
  const HONOR_KEY = 'hl_honor';
  function getHonor() { try { return JSON.parse(localStorage.getItem(HONOR_KEY) || '[]'); } catch (e) { return []; } }
  function recordHonor(c) {
    const list = getHonor();
    list.unshift({ cls: c.classId, level: c.level || 1, paragon: c.paragonLevel || 0, gold: c.gold || 0, t: Date.now() });
    while (list.length > 30) list.pop();
    try { localStorage.setItem(HONOR_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function renderHonor() {
    const box = $('honor-list'); if (!box) return;
    const list = getHonor();
    if (!list.length) { box.innerHTML = '<p style="opacity:0.6;text-align:center;padding:24px;">No heroes have fallen… yet.<br>Begin a Hardcore run to test your courage.</p>'; return; }
    box.innerHTML = list.map(function (h) {
      const cls = (CLASSES[h.cls] && CLASSES[h.cls].name) || h.cls;
      const pg = h.paragon ? ' · P' + h.paragon : '';
      const when = new Date(h.t).toLocaleDateString();
      return '<div class="nav-item" style="display:flex;justify-content:space-between;gap:10px;"><span>&#9760; ' + cls + ' &middot; Lv ' + (h.level || 1) + pg + '</span><span style="opacity:0.5;">' + when + '</span></div>';
    }).join('');
  }
  function refreshHardcoreLabel() { const b = $('hardcore-toggle'); if (b) b.innerHTML = (_hardcorePick ? '&#9760; Hardcore: ON' : '&#9760; Hardcore: OFF'); }

  function loadSave() {
    try {
      // Read the current key; fall back to the pre-rename key so old saves carry over.
      // The next saveGame() rewrites under the new key automatically.
      const raw = localStorage.getItem(CFG.storageKey) || localStorage.getItem(CFG.legacyStorageKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== 2) return null;
      // migrate: give starter gear if player has nothing equipped (old saves)
      if (obj.char && !obj.char.equip.weapon) {
        const gear = starterGear(obj.char.classId);
        obj.char.equip.weapon = gear.weapon;
        obj.char.equip.armor = gear.armor;
        if (!obj.char.inventory) obj.char.inventory = [];
        obj.char.inventory.push(gear.weapon, gear.armor);
      }
      // migrate: add selectedSkill for old saves
      if (obj.char && !obj.char.selectedSkill) {
        obj.char.selectedSkill = CLASSES[obj.char.classId].skills[0];
      }
      // migrate: add voidspire biome for old saves
      if (obj.unlockedBiomes && !('voidspire' in obj.unlockedBiomes)) {
        obj.unlockedBiomes.voidspire = false;
      }
      // migrate: add sanctuaryScrolls for old saves
      if (obj.char && obj.char.sanctuaryScrolls === undefined) {
        obj.char.sanctuaryScrolls = 0;
      }
      // migrate: add tomes/passives for old saves
      if (obj.char && obj.char.tomes === undefined) obj.char.tomes = 0;
      if (obj.char && !obj.char.passives) obj.char.passives = {};
      // migrate: ensure worldState/savedDungeon fields exist
      if (obj.worldState === undefined) obj.worldState = null;
      if (obj.savedDungeon === undefined) obj.savedDungeon = null;
      // migrate: paragon system + glass tears + mystery vendor
      if (obj.char && obj.char.glassTears === undefined)   obj.char.glassTears = 0;
      if (obj.char && obj.char.paragonLevel === undefined) obj.char.paragonLevel = 0;
      if (obj.char && obj.char.paragonXp === undefined)    obj.char.paragonXp = 0;
      if (obj.char && obj.char.paragonPoints === undefined) obj.char.paragonPoints = 0;
      if (obj.char && !obj.char.paragonStats) obj.char.paragonStats = { str: 0, int: 0, dex: 0, vit: 0 };
      if (obj.mysteryVendor === undefined) obj.mysteryVendor = null; // { day, baseId, bought }
      // migrate: auto-potion settings for old saves
      if (obj.char && obj.char.autoPotion === undefined) obj.char.autoPotion = true;
      if (obj.char && obj.char.autoPotionPct === undefined) obj.char.autoPotionPct = 0.35;
      // migrate: bestiary kill log for old saves
      if (!obj.bestiary) obj.bestiary = {};
      // migrate: crafting dust material for old saves
      if (obj.char && obj.char.craftDust === undefined) obj.char.craftDust = 0;
      // migrate: best rift level for old saves
      if (obj.bestRift === undefined) obj.bestRift = 0;
      // migrate: per-skill runes for old saves
      if (obj.char && !obj.char.skillRunes) obj.char.skillRunes = {};
      // migrate: difficulty tiers for old saves
      if (!obj.difficulty) obj.difficulty = 'normal';
      if (!obj.maxDifficulty) obj.maxDifficulty = 'normal';
      // migrate: permanent upgrades for old saves
      if (!obj.upgrades) obj.upgrades = { pickup: 0, xpgain: 0, goldfind: 0, potions: 0 };
      // migrate: feature-batch fields for old saves
      if (!obj.bossesKilled) obj.bossesKilled = {};
      if (!obj.wardrobe) obj.wardrobe = {};
      if (obj.gameWon === undefined) obj.gameWon = false;
      if (obj.char && !obj.char.transmog) obj.char.transmog = { weapon: null, armor: null };
      if (obj.char && obj.char.hireling === undefined) obj.char.hireling = null;
      if (obj.char && obj.char.sigils === undefined) obj.char.sigils = 0;
      // Reconcile equipped item references with inventory entries by id.
      // JSON round-trips lose object identity, so equip.weapon and the inventory
      // copy are different objects after load. Re-link them so isEquipped works.
      if (obj.char && obj.char.inventory && obj.char.equip) {
        const byId = {};
        for (const it of obj.char.inventory) { if (it && it.id) byId[it.id] = it; }
        for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
          const eq = obj.char.equip[slot];
          if (eq && eq.id && byId[eq.id]) {
            // Point equip slot at the inventory's copy
            obj.char.equip[slot] = byId[eq.id];
          } else if (eq && eq.id && !byId[eq.id]) {
            // Equipped item not in inventory — add it (legacy saves may have this)
            obj.char.inventory.push(eq);
          }
        }
      }
      return obj;
    } catch (e) { return null; }
  }

  function saveGame() {
    if (!game.save) return;
    // Snapshot current world position so player can resume on next load
    if (game.world && game.world.player) {
      if (game.world.kind === 'town') {
        game.save.worldState = { kind: 'town' };
      } else if (game.world.kind === 'dungeon' && game.activeBiomeId) {
        game.save.worldState = {
          kind: 'dungeon',
          biomeId: game.activeBiomeId,
          floor: game.activeFloor,
          x: game.world.player.x,
          y: game.world.player.y,
        };
      }
    }
    try {
      localStorage.setItem(CFG.storageKey, JSON.stringify(game.save));
    } catch (e) { console.warn('save failed', e); }
  }

  // ============================================================
  // CHARACTER STATS — derive secondary stats from base + equip
  // ============================================================
  function derived(char) {
    const cls = CLASSES[char.classId];
    const baseDmg = cls.damage;
    let dmg = baseDmg;
    let def = 0;
    let hpMax = cls.hp + Math.max(0, char.stats.vit - 2) * 10 + (char.level - 1) * 6;
    let mpMax = cls.mp + Math.max(0, char.stats.int - 2) * 6 + (char.level - 1) * 4;
    let crit = 5;
    let aspd = cls.attackSpeed;
    let bonusStats = { str: 0, int: 0, dex: 0, vit: 0 };
    // Track contribution sources for character-sheet breakdown
    let gearDmg = 0, gearDef = 0;
    let affixDmg = 0;
    let gemDmg = 0, gemDef = 0, gemHp = 0, gemMp = 0;

    function applyItem(it) {
      if (!it) return;
      const base = ITEM_BASES[it.baseId];
      if (!base) return;
      if (base.base.dmg) { dmg += base.base.dmg; gearDmg += base.base.dmg; }
      if (base.base.def) { def += base.base.def; gearDef += base.base.def; }
      if (base.base.mp)  mpMax += base.base.mp;
      for (const af of (it.affixes || [])) {
        if (af.key === 'dmg')  { dmg += af.val; affixDmg += af.val; }
        else if (af.key === 'def')  def += af.val;
        else if (af.key === 'hp')   hpMax += af.val;
        else if (af.key === 'mp')   mpMax += af.val;
        else if (af.key === 'crit') crit += af.val;
        else if (af.key === 'aspd') aspd *= 1 + af.val / 100;
        else if (af.key in bonusStats) bonusStats[af.key] += af.val;
      }
      // Socketed gem bonuses
      for (const gemId of (it.gems || [])) {
        const gem = GEMS[gemId];
        if (!gem) continue;
        if (gem.dmg)  { dmg += gem.dmg; gemDmg += gem.dmg; }
        if (gem.def)  { def += gem.def; gemDef += gem.def; }
        if (gem.hp)   { hpMax += gem.hp; gemHp += gem.hp; }
        if (gem.mp)   { mpMax += gem.mp; gemMp += gem.mp; }
        if (gem.crit) crit += gem.crit;
      }
    }
    applyItem(char.equip.weapon);
    applyItem(char.equip.armor);
    applyItem(char.equip.ring);
    applyItem(char.equip.amulet);

    // Paragon stat bonuses (added on top of base + gear bonuses)
    const para = char.paragonStats || { str: 0, int: 0, dex: 0, vit: 0 };
    const totalStr = char.stats.str + bonusStats.str + para.str;
    const totalInt = char.stats.int + bonusStats.int + para.int;
    const totalDex = char.stats.dex + bonusStats.dex + para.dex;
    const totalVit = char.stats.vit + bonusStats.vit + para.vit;

    // stat-derived
    const statStrDmg = Math.max(0, totalStr - 2);
    const statDexDmg = Math.floor(totalDex / 2);
    const statIntDmg = (cls.id === 'mage' || cls.id === 'summoner')
      ? Math.floor(totalInt / 2) : 0;
    dmg += statStrDmg + statDexDmg + statIntDmg;
    crit += Math.floor(totalDex / 2);
    hpMax += totalVit * 6;
    const statsDmg = statStrDmg + statDexDmg + statIntDmg;

    // ===== Passive skill tree bonuses =====
    let dmgMul = 1, aspdMul = 1, hpMul = 1, mpMul = 1;
    const passives = char.passives || {};
    if (passives.toughness)  hpMul *= 1.25;
    if (passives.vigor)      mpMul *= 1.25;
    if (passives.sharp_eye)  crit += 8;
    if (passives.ferocity)   dmgMul *= 1.15;
    if (passives.fortify)    def  += 30;
    if (passives.alacrity)   aspdMul *= 1.15;

    // ===== Item set bonuses (3-piece) =====
    const setB = computeSetBonuses(char);
    if (setB.dmgMul)  dmgMul  *= (1 + setB.dmgMul);
    if (setB.aspdMul) aspdMul *= (1 + setB.aspdMul);
    if (setB.def)     def     += setB.def;
    if (setB.hp)      hpMax   += setB.hp;
    if (setB.mp)      mpMax   += setB.mp;
    if (setB.crit)    crit    += setB.crit;

    // ===== Active shrine damage buff =====
    if (game.activeBuffs && game.activeBuffs.damage > 0) dmgMul *= 2;

    const preMulDmg = dmg;

    // Apply final multipliers
    dmg   = Math.floor(dmg   * dmgMul);
    aspd  = aspd  * aspdMul;
    hpMax = Math.floor(hpMax * hpMul);
    mpMax = Math.floor(mpMax * mpMul);

    // War Cry buff: +50% damage
    const warcry = (game.world && game.world.player && game.world.player.warcryBuff > 0);
    if (warcry) dmg = Math.floor(dmg * 1.5);

    // Enfeebling curse: -30% damage while active
    const weakened = (game.world && game.world.player && game.world.player.curses && game.world.player.curses.weaken > 0);
    if (weakened) dmg = Math.floor(dmg * 0.7);

    // ===== DPS calculation =====
    // Expected damage per swing factors in crit chance × crit multiplier (1.8x)
    const critDmgMul = 1.8;
    const critFrac = Math.min(100, crit) / 100;
    const avgPerHit = dmg * (1 + critFrac * (critDmgMul - 1));
    const dps = Math.round(avgPerHit * aspd);

    const breakdown = {
      baseDmg, gearDmg, affixDmg, gemDmg, statsDmg,
      dmgMul, finalDmg: dmg, preMulDmg, warcry,
      gearDef, gemDef, gemHp, gemMp,
      critDmgPct: Math.round(critDmgMul * 100),
      avgPerHit: Math.round(avgPerHit), dps,
    };

    return { dmg, def, hpMax, mpMax, crit, aspd, bonusStats, breakdown };
  }

  // Count how many pieces of each set the player has equipped, return summed bonus
  function computeSetBonuses(char) {
    const out = { dmgMul: 0, aspdMul: 0, def: 0, hp: 0, mp: 0, crit: 0 };
    const equipped = [char.equip.weapon, char.equip.armor, char.equip.ring, char.equip.amulet]
      .filter(x => x && x.baseId).map(x => x.baseId);
    for (const setId in SETS) {
      const s = SETS[setId];
      let count = 0;
      for (const piece of s.pieces) if (equipped.includes(piece)) count++;
      if (count >= 3) {
        const b = s.bonus;
        if (b.dmgMul)  out.dmgMul  += b.dmgMul;
        if (b.aspdMul) out.aspdMul += b.aspdMul;
        if (b.def)     out.def     += b.def;
        if (b.hp)      out.hp      += b.hp;
        if (b.mp)      out.mp      += b.mp;
        if (b.crit)    out.crit    += b.crit;
      }
    }
    return out;
  }

  // Return list of active set IDs (for UI display)
  function activeSets(char) {
    const equipped = [char.equip.weapon, char.equip.armor, char.equip.ring, char.equip.amulet]
      .filter(x => x && x.baseId).map(x => x.baseId);
    const active = [];
    for (const setId in SETS) {
      const s = SETS[setId];
      let count = 0;
      for (const piece of s.pieces) if (equipped.includes(piece)) count++;
      active.push({ id: setId, def: s, count });
    }
    return active;
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
  // Paragon XP cost scales gently: same curve as max level but a bit slower
  function xpForParagon(pLv) {
    return Math.floor(xpForLevel(CFG.maxLevel) * CFG.paragonXpMul * (1 + pLv * 0.05));
  }
  function gainXp(amount) {
    const c = game.char;
    // Sage's Insight upgrade — +10% XP per level
    const xpUp = upgradeLevel('xpgain');
    if (xpUp > 0) amount = Math.floor(amount * (1 + 0.1 * xpUp));
    floatText(`+${amount} XP`, game.world.player.x, game.world.player.y, 'xp');

    // Normal levels first
    while (c.level < CFG.maxLevel && amount > 0) {
      const need = xpForLevel(c.level) - c.xp;
      if (amount < need) {
        c.xp += amount;
        amount = 0;
      } else {
        amount -= need;
        c.xp = 0;
        c.level += 1;
        sfx('levelup');
        c.statPoints += 3;
        applyDerivedToChar();
        c.hp = c.hpMax;
        c.mp = c.mpMax;
        navigateTo('levelup');
        $('levelup-sub').textContent =
          `You are now level ${c.level}. +3 stat points. HP/MP restored.`;
      }
    }

    // At cap: route remaining XP into paragon
    if (c.level >= CFG.maxLevel && amount > 0) {
      // Ensure paragon fields exist on legacy char
      if (c.paragonLevel === undefined) c.paragonLevel = 0;
      if (c.paragonXp === undefined) c.paragonXp = 0;
      if (c.paragonPoints === undefined) c.paragonPoints = 0;
      if (!c.paragonStats) c.paragonStats = { str: 0, int: 0, dex: 0, vit: 0 };
      c.paragonXp += amount;
      while (c.paragonXp >= xpForParagon(c.paragonLevel)) {
        c.paragonXp -= xpForParagon(c.paragonLevel);
        c.paragonLevel += 1;
        c.paragonPoints += 1;
        showHudToast(`Paragon Level ${c.paragonLevel}! +1 point`);
        applyDerivedToChar();
      }
    }
    saveGame();
    updateHud();
  }

  // ============================================================
  // ITEM GENERATION
  // ============================================================
  function rollAffix(rarity, ilvl) {
    // Mythic draws from the full (unique-tier) affix pool, rolled at a premium.
    const poolRarity = rarity === 'mythic' ? 'unique' : rarity;
    const pool = AFFIXES.filter(a => a.rarities.includes(poolRarity));
    const a = pick(pool) || AFFIXES[0]; // guard against an empty pool
    let val = 1 + Math.floor(rand() * Math.min(a.max, 1 + ilvl));
    if (rarity === 'mythic') val = Math.ceil(val * 1.4);
    return { key: a.key, label: a.label, val };
  }

  function rollItem(ilvl, rarityOverride, opts) {
    opts = opts || {};
    // Exclude consumables and gems — those are vendor-only or special drops.
    // Named legendaries are drop-only (opts.noLegendary keeps them out of vendor stock).
    const eligible = Object.keys(ITEM_BASES).filter(k =>
      ITEM_BASES[k].ilvl <= ilvl + 1 &&
      ITEM_BASES[k].type !== 'consumable' &&
      ITEM_BASES[k].type !== 'gem' &&
      !(opts.noLegendary && ITEM_BASES[k].legendary));
    if (eligible.length === 0) return null;
    // Named legendaries are rare in normal drops (~6%) but common from premium
    // boss/vault slots (~50%); everything else pulls from the normal pool.
    const legBases = eligible.filter(k => ITEM_BASES[k].legendary);
    const normBases = eligible.filter(k => !ITEM_BASES[k].legendary);
    const legChance = opts.preferLegendary ? 0.5 : 0.06;
    let baseId;
    if (legBases.length && normBases.length && roll(legChance)) baseId = pick(legBases);
    else baseId = pick(normBases.length ? normBases : eligible);
    const base = ITEM_BASES[baseId];
    // Named legendary bases always roll at legendary tier (small chance to ascend to mythic),
    // so they keep their identity instead of becoming a random rare/common.
    let rarity = rarityOverride || chance(RARITY_WEIGHTS);
    if (base.legendary && rarity !== 'mythic') rarity = roll(0.12) ? 'mythic' : 'unique';
    const affixCount = rarity === 'common' ? 0
                      : rarity === 'magic'  ? 1
                      : rarity === 'rare'   ? (1 + irand(1, 2))
                      : rarity === 'mythic' ? 5
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
    // Roll sockets: rare = 40% for 1 socket, 10% for 2; unique = 70% for 1, 30% for 2
    let sockets = 0;
    const equipType = (base.type === 'weapon' || base.type === 'armor' || base.type === 'ring' || base.type === 'amulet');
    if (equipType) {
      if (rarity === 'rare')   sockets = roll(0.4) ? (roll(0.25) ? 2 : 1) : 0;
      if (rarity === 'unique') sockets = roll(0.7) ? (roll(0.4)  ? 2 : 1) : 0;
      if (rarity === 'mythic') sockets = roll(0.5) ? 3 : 2;
    }
    return {
      id: 'i_' + Math.random().toString(36).slice(2, 9),
      baseId,
      rarity,
      affixes,
      ilvl,
      sockets,
      gems: [],
      name: buildItemName(base, rarity, affixes),
    };
  }

  function buildItemName(base, rarity, affixes) {
    // Named legendary bases keep their identity at any tier
    if (base.legendary) return base.name;
    if (rarity === 'common') return base.name;
    if (rarity === 'magic') {
      const af = affixes[0];
      const prefix = af ? prefixForAffix(af.key) : '';
      return `${prefix} ${base.name}`.trim();
    }
    if (rarity === 'rare') {
      return rareName(base.name);
    }
    if (rarity === 'mythic') {
      return mythicName(base.name);
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
    return pick(['Hollow Crown', 'Hollow Dawn', 'Sigil of the First', 'Tear of the Lich', 'Eye of the Wyrm']);
  }
  function mythicName(base) {
    const a = pick(['Worldbreaker', 'Starless', 'Apex', 'The Last', 'Godfall', 'Eternity\'s']);
    const b = pick(['Verdict', 'Requiem', 'Ascendance', 'Paragon', 'Genesis', 'Oblivion']);
    return `${a} ${b}`;
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
      { id: 'vendor',     name: 'Trader',         glyph: '☉', color: '#ffc857', x: 4,  y: 4,  role: 'vendor' },
      { id: 'stash',      name: 'Keeper',         glyph: '◈', color: '#6df1ff', x: 16, y: 4,  role: 'stash' },
      { id: 'quests',     name: 'Captain',        glyph: '✦', color: '#c489ff', x: 4,  y: 12, role: 'quests' },
      { id: 'waypoint',   name: 'Waystone',       glyph: '✪', color: '#51e6a4', x: 16, y: 12, role: 'waypoint' },
      { id: 'mystery',    name: 'Mystery Merchant', glyph: '?', color: '#ff77ff', x: 10, y: 14, role: 'mystery' },
      { id: 'mercenary',  name: 'Sellsword Captain', glyph: '⚔', color: '#cdd6e6', x: 13, y: 6, role: 'mercenary' },
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
      player: { x: 10.5, y: 9.5, dir: 0, atkCd: 0, skillCd: 0, lastDir: { x: 0, y: 1 }, attackingFor: 0, _impulseT: 0, _impulseX: 0, _impulseY: 0 },
      npcs,
      palette: { wall: '#ffc857', floor: '#221a14', accent: '#6df1ff' },
      portals: [],
    };
  }

  // Procedural dungeon: rooms-and-corridors
  function generateDungeon(biome, floor, opts) {
    opts = opts || {};
    // Bigger maps that grow with depth — deeper floors / rifts feel grander
    const sizeBoost = Math.min(20, Math.max(0, floor - 1) * 2);
    const W = 58 + sizeBoost, H = 58 + sizeBoost;
    const grid = makeGrid(W, H, 1);
    const rooms = [];
    const tries = Math.floor(W * H / 22);   // scale attempts to area
    for (let i = 0; i < tries; i++) {
      // Mix of small chambers, medium rooms, and grand halls
      const sizeRoll = rand();
      let rw, rh;
      if (sizeRoll < 0.26) { rw = irand(6, 8);  rh = irand(6, 8); }        // small chambers
      else if (sizeRoll < 0.70) { rw = irand(8, 12); rh = irand(8, 12); }  // medium rooms
      else { rw = irand(12, 18); rh = irand(11, 16); }                     // grand halls
      const rx = irand(1, W - rw - 2);
      const ry = irand(1, H - rh - 2);
      const r = { x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1), shape: 'rect', special: null };
      // overlap check (with 1-tile margin so walls separate rooms)
      let overlap = false;
      for (const o of rooms) {
        if (rx - 1 < o.x + o.w && rx + rw + 1 > o.x && ry - 1 < o.y + o.h && ry + rh + 1 > o.y) {
          overlap = true; break;
        }
      }
      if (!overlap) rooms.push(r);   // carved below, after shapes are assigned
    }
    // ----- Assign varied shapes (spawn & exit rooms stay rectangular) -----
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (i === 0 || i === rooms.length - 1 || r.w < 7 || r.h < 7) { r.shape = 'rect'; continue; }
      const sr = rand();
      r.shape = sr < 0.50 ? 'rect' : sr < 0.74 ? 'ellipse' : sr < 0.90 ? 'cross' : 'hall';
    }
    // ----- Designate special rooms (arena + vault) among the middle rooms -----
    if (rooms.length >= 5) {
      const middle = [];
      for (let i = 1; i < rooms.length - 1; i++) middle.push(i);
      // Arena = the largest middle room, reshaped into a grand rotunda
      let arenaIdx = -1, arenaArea = 0;
      for (const i of middle) { const a = rooms[i].w * rooms[i].h; if (a > arenaArea) { arenaArea = a; arenaIdx = i; } }
      if (arenaIdx >= 0 && arenaArea >= 90) { rooms[arenaIdx].special = 'arena'; rooms[arenaIdx].shape = 'ellipse'; }
      // Vault = a different middle room holding guaranteed loot behind guardians
      const vaultCandidates = middle.filter(i => i !== arenaIdx);
      if (vaultCandidates.length && (opts.isRift || rand() < 0.7)) {
        rooms[vaultCandidates[irand(0, vaultCandidates.length - 1)]].special = 'vault';
      }
    }
    // ----- Carve each room according to its shape -----
    function carveRoom(r) {
      const { x, y, w, h, cx, cy, shape } = r;
      if (shape === 'ellipse') {
        const rxr = w / 2, ryr = h / 2;
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) {
            const ndx = (xx + 0.5 - (x + w / 2)) / rxr;
            const ndy = (yy + 0.5 - (y + h / 2)) / ryr;
            if (ndx * ndx + ndy * ndy <= 1.05) grid[yy][xx] = 0;
          }
      } else if (shape === 'cross') {
        const bh = Math.max(1, (h >> 1) - 1), bw = Math.max(1, (w >> 1) - 1);
        for (let yy = Math.max(1, cy - bh); yy <= Math.min(H - 2, cy + bh); yy++)
          for (let xx = x; xx < x + w; xx++) grid[yy][xx] = 0;
        for (let yy = y; yy < y + h; yy++)
          for (let xx = Math.max(1, cx - bw); xx <= Math.min(W - 2, cx + bw); xx++) grid[yy][xx] = 0;
      } else {
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) grid[yy][xx] = 0;
      }
    }
    for (const r of rooms) carveRoom(r);
    // Helper: carve a floor tile if within bounds (keep 1-tile border)
    function carve(cx, cy) {
      if (cx > 0 && cx < W - 1 && cy > 0 && cy < H - 1) grid[cy][cx] = 0;
    }
    // Helper: carve a 3-wide L-shape corridor between two points
    function carveCorridor(ax, ay, bx, by) {
      let x = ax, y = ay;
      while (x !== bx) {
        carve(x, y - 1); carve(x, y); carve(x, y + 1);
        x += Math.sign(bx - x);
      }
      while (y !== by) {
        carve(x - 1, y); carve(x, y); carve(x + 1, y);
        y += Math.sign(by - y);
      }
      // 3x3 corner junction
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          carve(x + dx, y + dy);
    }
    // Connect rooms sequentially (guarantees full connectivity)
    for (let i = 1; i < rooms.length; i++) {
      carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
    }
    // Add extra "loop" corridors between random non-adjacent rooms for intricate layouts
    const extraConnections = Math.floor(rooms.length * 0.5);
    for (let i = 0; i < extraConnections; i++) {
      const a = rooms[irand(0, rooms.length - 1)];
      const b = rooms[irand(0, rooms.length - 1)];
      if (a === b) continue;
      carveCorridor(a.cx, a.cy, b.cx, b.cy);
    }
    // Interior features — only convert existing floor, never the center (corridors meet there)
    function placeFeature(px, py, val) {
      if (px <= 0 || px >= W - 1 || py <= 0 || py >= H - 1) return;
      if (grid[py][px] !== 0) return;
      grid[py][px] = val;
    }
    for (const r of rooms) {
      if (r.special) continue;  // special rooms are decorated separately
      const area = r.w * r.h;
      if (r.shape === 'hall' && r.w >= 9 && r.h >= 7) {
        // Colonnade — two rows of evenly spaced pillars flanking a central aisle
        for (let px = r.x + 2; px < r.x + r.w - 2; px += 2) {
          if (Math.abs(px - r.cx) < 2) continue; // keep the aisle clear
          placeFeature(px, r.cy - 2, 1);
          placeFeature(px, r.cy + 2, 1);
        }
      } else if (area >= 72 && rand() < 0.45) {
        // Crystal landmark — a small cluster of glowing decor offset from center
        const ox = r.cx + (rand() < 0.5 ? -1 : 1) * irand(1, 2);
        const oy = r.cy + (rand() < 0.5 ? -1 : 1) * irand(1, 2);
        placeFeature(ox, oy, 2);
        placeFeature(ox + 1, oy, 2);
        placeFeature(ox, oy + 1, 2);
        if (rand() < 0.5) placeFeature(ox + 1, oy + 1, 2);
      } else if (area >= 42 && rand() < 0.4) {
        // A couple scattered pillars/crystals for cover
        for (let p = 0; p < irand(1, 3); p++) {
          const px = r.x + irand(2, r.w - 3), py = r.y + irand(2, r.h - 3);
          if (Math.abs(px - r.cx) < 2 && Math.abs(py - r.cy) < 2) continue;
          placeFeature(px, py, rand() < 0.5 ? 1 : 2);
        }
      }
    }
    // Pick spawn (player) and exit
    const first = rooms[0];
    const last = rooms[rooms.length - 1];
    const isBossFloor = !opts.noBoss && floor === CFG.biomeFloors;
    const enemyLevel = opts.enemyLevel != null ? opts.enemyLevel : floor;

    const portals = [];
    if (opts.isRift) {
      // Rift descend portal — locked until enough enemies are cleared
      portals.push({
        x: last.cx + 0.5, y: last.cy + 0.5,
        kind: 'rift-next', label: '→ Descend (locked)', locked: true,
      });
    } else if (!isBossFloor) {
      portals.push({
        x: last.cx + 0.5, y: last.cy + 0.5,
        kind: 'next', label: `→ Floor ${floor + 1}`,
      });
    }
    portals.push({
      x: first.cx - 1.5, y: first.cy + 0.5,
      kind: 'town', label: opts.isRift ? '→ Leave Rift' : '→ Sanctuary',
    });

    // Floor-safe spawn — find an open floor tile inside a room (shapes leave wall corners)
    function floorSpotIn(r) {
      for (let t = 0; t < 14; t++) {
        const gx = r.x + 1 + Math.floor(rand() * Math.max(1, r.w - 2));
        const gy = r.y + 1 + Math.floor(rand() * Math.max(1, r.h - 2));
        if (gx > 0 && gx < W - 1 && gy > 0 && gy < H - 1 && grid[gy][gx] === 0) return { x: gx + 0.5, y: gy + 0.5 };
      }
      return { x: r.cx + 0.5, y: r.cy + 0.5 }; // center is always floor
    }

    // Place enemies (capped so big maps stay performant)
    const enemies = [];
    const enemyPool = biome.enemies;
    const perMin = opts.enemyPerRoom ? opts.enemyPerRoom[0] : 1;
    const perMax = opts.enemyPerRoom ? opts.enemyPerRoom[1] : 3;
    const ENEMY_CAP = 46;
    for (const r of rooms.slice(1)) {
      if (r === last && isBossFloor) continue;  // boss room handled below
      if (enemies.length >= ENEMY_CAP) break;
      let n;
      if (r.special === 'arena')      n = perMax + 3 + irand(0, 2);   // dense pack
      else if (r.special === 'vault') n = 2;                          // guardians
      else { n = irand(perMin, perMax); if (r.w * r.h >= 120) n += 1; } // grand halls feel full
      for (let i = 0; i < n && enemies.length < ENEMY_CAP; i++) {
        const sp = floorSpotIn(r);
        const e = makeEnemy(pick(enemyPool), sp.x, sp.y, enemyLevel);
        if (r.special === 'vault' || (r.special === 'arena' && i < 2)) makeElite(e);  // champions
        enemies.push(e);
      }
    }
    // Boss
    if (isBossFloor) {
      enemies.push(makeEnemy(opts.bossId || biome.boss, last.cx + 0.5, last.cy + 0.5, floor + 2));
      game.bossAlive = true; game.bossKilled = false;
    } else {
      game.bossAlive = false;
    }

    // Vault loot — guaranteed rare/unique items on the ground, depth- & difficulty-scaled
    const loot = [];
    const vaultRoom = rooms.find(r => r.special === 'vault');
    if (vaultRoom) {
      const lootCount = 2 + (rand() < 0.5 ? 1 : 0);
      const ilvl = Math.max(1, enemyLevel + 1 + (curDifficulty().ilvlBonus || 0));
      for (let i = 0; i < lootCount; i++) {
        const vr = rand() < 0.04 ? 'mythic' : (rand() < 0.25 ? 'unique' : 'rare');
        const item = rollItem(ilvl, vr, { preferLegendary: vr === 'unique' || vr === 'mythic' });
        if (item) { const sp = floorSpotIn(vaultRoom); loot.push({ x: sp.x, y: sp.y, item, age: 0 }); }
      }
    }

    // Shrines — the arena always has one; plus 1-2 scattered elsewhere
    const shrines = [];
    const shrineTypeIds = Object.keys(SHRINES);
    function placeShrine(sx, sy) {
      const gx = Math.floor(sx), gy = Math.floor(sy);
      if (gx <= 0 || gx >= W - 1 || gy <= 0 || gy >= H - 1) return;
      if (grid[gy][gx] !== 0) grid[gy][gx] = 0; // clear any feature
      shrines.push({ x: sx, y: sy, type: shrineTypeIds[irand(0, shrineTypeIds.length - 1)], used: false });
    }
    const arenaRoom = rooms.find(r => r.special === 'arena');
    if (arenaRoom) placeShrine(arenaRoom.cx + 0.5, arenaRoom.cy + 0.5);
    if (rooms.length > 2) {
      const candidates = rooms.slice(1).filter(r => r !== last && r.special !== 'arena' && r.special !== 'vault');
      if (candidates.length) {
        const numShrines = irand(1, Math.min(2, candidates.length));
        const used = new Set();
        for (let i = 0; i < numShrines; i++) {
          let p = irand(0, candidates.length - 1), tries = 0;
          while (used.has(p) && tries++ < 6) p = irand(0, candidates.length - 1);
          if (used.has(p)) continue;
          used.add(p);
          const r = candidates[p];
          placeShrine(r.cx + 0.5 + (rand() - 0.5) * 1.5, r.cy + 0.5 + (rand() - 0.5) * 1.5);
        }
      }
    }

    return {
      kind: 'dungeon',
      name: opts.isRift ? `GREATER RIFT ${floor}` : `${biome.shortName} — Floor ${floor}${isBossFloor ? ' (Boss)' : ''}`,
      grid, w: W, h: H,
      player: { x: first.cx + 0.5, y: first.cy + 0.5, dir: 0, atkCd: 0, skillCd: 0, lastDir: { x: 0, y: 1 }, attackingFor: 0, _impulseT: 0, _impulseX: 0, _impulseY: 0 },
      enemies,
      npcs: [],
      rooms,
      portals,
      shrines,
      loot,
      palette: biome.palette,
      biomeId: biome.id,
      floor,
      isBoss: isBossFloor,
      isRift: !!opts.isRift,
    };
  }

  function makeEnemy(id, x, y, levelHint) {
    const base = ENEMIES[id];
    const lvlScale = 1 + Math.max(0, levelHint - 1) * 0.18;
    const diff = curDifficulty();   // difficulty tier scales HP/damage/XP
    const e = {
      id,
      x, y,
      hp: Math.floor(base.hp * lvlScale * diff.hpMul),
      hpMax: Math.floor(base.hp * lvlScale * diff.hpMul),
      dmg: Math.floor(base.dmg * lvlScale * diff.dmgMul),
      speed: base.speed,
      range: base.range,
      attackKind: base.attackKind,
      xp: Math.floor(base.xp * lvlScale * diff.xpMul),
      goldRange: base.goldRange,
      name: base.name,
      color: base.color,
      glyph: base.glyph,
      trait: base.trait || null,
      shape: base.shape || null,
      projColor: base.projColor || '#c489ff',
      atkCd: 0.8 + rand() * 0.6,
      hitFlash: 0,
      frozen: 0,
      stagger: 0,
      boss: !!base.boss,
      ilvl: levelHint,
      // trait state
      traitCd: 0,
      lunging: 0,
      charging: 0,
      phased: 0,
      // elite state
      elite: false,
      eliteAffix: null,
      eliteColor: null,
    };
    // 8% chance for a non-boss to become an elite — significantly tougher with affix
    if (!e.boss && id !== 'goblin' && roll(0.08)) makeElite(e);
    return e;
  }

  // ---- Treasure Goblin: spawns rarely, flees, and drops a jackpot if killed in time ----
  function spawnGoblin(levelHint) {
    if (!game.world || game.world.kind !== 'dungeon') return;
    const p = game.world.player, W = game.world.w, H = game.world.h, grid = game.world.grid;
    for (let tries = 0; tries < 50; tries++) {
      const gx = irand(1, W - 2), gy = irand(1, H - 2);
      if (grid[gy][gx] !== 0) continue;
      const x = gx + 0.5, y = gy + 0.5;
      const dd = Math.hypot(x - p.x, y - p.y);
      if (dd < 4 || dd > 11) continue;           // not on the player, but reachable
      const e = makeEnemy('goblin', x, y, levelHint || (game.char ? game.char.level : 1));
      e.isGoblin = true; e.fleeTimer = 15; e.elite = false;
      game.enemies.push(e);
      sfx('goblin');
      showHudToast('A Treasure Goblin appears — kill it before it escapes!');
      floatText('Treasure Goblin!', x, y - 0.6, 'loot');
      return e;
    }
  }
  function moveEnemyFlee(e, fx, fy, sp) {
    const grid = game.world.grid, W = game.world.w, H = game.world.h;
    const ok = (nx, ny) => { const gx = Math.floor(nx), gy = Math.floor(ny); return gx >= 0 && gx < W && gy >= 0 && gy < H && grid[gy][gx] === 0; };
    const nx = e.x + fx * sp, ny = e.y + fy * sp;
    if (ok(nx, ny)) { e.x = nx; e.y = ny; return; }
    if (ok(nx, e.y)) { e.x = nx; return; }        // slide along walls
    if (ok(e.x, ny)) { e.y = ny; return; }
    // cornered — try turning perpendicular to slip away
    for (const [ax, ay] of [[fy, -fx], [-fy, fx]]) {
      const px = e.x + ax * sp, py = e.y + ay * sp;
      if (ok(px, py)) { e.x = px; e.y = py; return; }
    }
  }
  function tickGoblin(e, dt, dx, dy, d, idx) {
    e.fleeTimer = (e.fleeTimer == null ? 15 : e.fleeTimer) - dt;
    if (rand() < 0.5) addParticle({ x: e.x + (rand() - 0.5) * 0.4, y: e.y, vx: (rand() - 0.5) * 2, vy: -1 - rand(), color: '#ffd24a', life: 0.5, age: 0, size: 2 });
    const len = d || 1;
    const fx = -dx / len, fy = -dy / len;          // run directly away from the player
    moveEnemyFlee(e, fx, fy, e.speed * dt);
    e.lastDir = { x: fx, y: fy };
    if (e.fleeTimer <= 0) {                          // escaped — no reward
      sfx('goblinFlee');
      burst(e.x, e.y, '#8a6cff', 18);
      floatText('Escaped!', e.x, e.y - 0.6, 'loot');
      showHudToast('The Treasure Goblin escaped with its loot!');
      game.enemies.splice(idx, 1);
    }
  }

  // ---- Dungeon event: ambush — a sudden horde spawns; surviving it drops a cache ----
  function tickAmbush(dt) {
    const w = game.world; if (!w || !w.ambush || !w.ambush.armed) return;
    w.ambush.delay -= dt;
    if (w.ambush.delay <= 0) { w.ambush.armed = false; spawnAmbush(); }
  }
  function spawnAmbush() {
    const w = game.world; if (!w || w.kind !== 'dungeon') return;
    const p = w.player, grid = w.grid;
    const biome = BIOMES.find(b => b.id === game.activeBiomeId);
    const pool = (biome && biome.enemies) || ['skeleton'];
    const lvl = (game.char ? game.char.level : 1) + (game.activeFloor || 1);
    const want = 6 + irand(2, 5);
    let spawned = 0;
    for (let i = 0; i < want * 4 && spawned < want; i++) {
      const ang = rand() * PI2, rd = 2.5 + rand() * 3;
      const x = p.x + Math.cos(ang) * rd, y = p.y + Math.sin(ang) * rd;
      const gx = Math.floor(x), gy = Math.floor(y);
      if (gx < 1 || gx >= w.w - 1 || gy < 1 || gy >= w.h - 1 || grid[gy][gx] !== 0) continue;
      const e = makeEnemy(pick(pool), x, y, lvl);
      e._ambush = true;
      game.enemies.push(e);
      burst(x, y, '#ff4d6d', 12);
      spawned++;
    }
    w.ambush.remaining = spawned;
    if (spawned > 0) {
      sfx('boss'); game.screenShake = 0.4;
      showZoneToast('AMBUSH!');
      floatText('Ambush!', p.x, p.y - 1, 'crit');
    }
  }

  // Promote an enemy to an elite (champion) with a random affix. Reused by the
  // normal spawn roll and by the Greater Rift (which forces more elites).
  function makeElite(e) {
    if (e.boss || e.elite) return e;
    const aff = pick(Object.keys(ELITE_AFFIXES));
    const def = ELITE_AFFIXES[aff];
    e.elite = true;
    e.eliteAffix = aff;
    e.eliteColor = def.color;
    e.hp = Math.floor(e.hp * (def.hpMul || 2.2));
    e.hpMax = e.hp;
    e.dmg = Math.floor(e.dmg * (def.dmgMul || 1.4));
    e.xp = Math.floor(e.xp * 2);
    e.goldRange = [e.goldRange[0] * 2, e.goldRange[1] * 2];
    if (def.speedMul) e.speed *= def.speedMul;
    return e;
  }

  // ============================================================
  // ELITE AFFIXES — special properties for elite (champion) enemies
  // Apply to ~8% of normal enemies. Always drop rare loot + bonus tome chance.
  // ============================================================
  const ELITE_AFFIXES = {
    burning:   { color: '#ff6644', label: 'Burning',  hpMul: 2.2, dmgMul: 1.4, onHit: 'burn' },
    frozen:    { color: '#6df1ff', label: 'Frozen',   hpMul: 2.2, dmgMul: 1.4, onHit: 'frozen' },
    vampiric:  { color: '#ff4d6d', label: 'Vampiric', hpMul: 2.4, dmgMul: 1.3, onHit: 'lifesteal' },
    swift:     { color: '#ffd166', label: 'Swift',    hpMul: 1.8, dmgMul: 1.2, speedMul: 1.5 },
    iron:      { color: '#cccccc', label: 'Iron',     hpMul: 3.5, dmgMul: 1.6 },
    // ===== Curse affixes — debuff the PLAYER on hit =====
    cursed:     { color: '#c489ff', label: 'Cursed',     hpMul: 2.2, dmgMul: 1.2, curse: 'manaburn' },
    crippling:  { color: '#5b8cff', label: 'Crippling',  hpMul: 2.4, dmgMul: 1.2, curse: 'slow' },
    enfeebling: { color: '#9be57c', label: 'Enfeebling', hpMul: 2.4, dmgMul: 1.2, curse: 'weaken' },
  };
  // Curse definitions — what each player debuff does + how it reads in the HUD.
  const CURSES = {
    manaburn: { name: 'Mana Burn', icon: '✦', color: '#c489ff', dur: 0 },   // instant, no timer
    slow:     { name: 'Slowed',    icon: '«', color: '#5b8cff', dur: 3.0 },
    weaken:   { name: 'Weakened',  icon: '▽', color: '#9be57c', dur: 4.0 },
  };
  // Apply a cursing elite's debuff to the player.
  function applyCurse(curseId) {
    const p = game.world && game.world.player;
    if (!p) return;
    if (!p.curses) p.curses = {};
    if (curseId === 'manaburn') {
      const drain = Math.ceil(game.char.mpMax * 0.2);
      game.char.mp = Math.max(0, game.char.mp - drain);
      floatText(`-${drain} MP`, p.x, p.y - 0.6, 'xp');
      burst(p.x, p.y, '#c489ff', 8);
    } else {
      const def = CURSES[curseId];
      if (!def) return;
      p.curses[curseId] = def.dur;
      floatText(def.name.toUpperCase(), p.x, p.y - 0.6, 'crit');
      burst(p.x, p.y, def.color, 8);
    }
  }
  // Returns the curse id an enemy carries (cursing elite), or null.
  function enemyCurse(e) {
    if (e && e.elite && e.eliteAffix) {
      const aff = ELITE_AFFIXES[e.eliteAffix];
      if (aff && aff.curse) return aff.curse;
    }
    return null;
  }
  // Enemy deals damage to the player, applying any curse the attacker carries.
  function enemyHitPlayer(e, dmg) {
    damagePlayer(dmg);
    if (game.char.hp <= 0) return;
    const curse = enemyCurse(e);
    if (curse) applyCurse(curse);
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
  function clearSkillEffects() {
    game.pendingMeteors = [];
    game.poisonZones = [];
    game.soulDrains = [];
    game.corpsePositions = [];
    game.telegraphs = [];
  }
  function enterTown() {
    game.world = generateTown();
    if (window.__GL) window.__GL.onZoneChange(game.world);
    if (window.__AUDIO) window.__AUDIO.music('town');
    game.enemies = [];
    game.projectiles = [];
    game.items = [];
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    clearSkillEffects();
    game.activeBuffs = {}; // shrine buffs don't persist across zones
    game.activeBiomeId = null;
    game.activeFloor = 0;
    game.rift = null;  // any active rift ends when you reach town (e.g. on death)
    // Refill potions to capacity on returning to town (Potion Belt raises the cap)
    if (game.char) game.char.potions = Math.max(game.char.potions || 0, potionCapacity());
    snapCamera();
    navigateTo('game');
    showZoneToast('SANCTUARY');
    applyDerivedToChar(); // recompute stats since buff might have been adding damage
    updateHud();
  }
  function enterBiome(biomeId, floor) {
    floor = floor || 1;
    const biome = BIOMES.find(b => b.id === biomeId);
    if (!biome) return;
    game.world = generateDungeon(biome, floor);
    if (window.__GL) window.__GL.onZoneChange(game.world);
    if (window.__AUDIO) window.__AUDIO.music(biome.musicId || biome.id);
    game.enemies = game.world.enemies; game.world.enemies = null;
    game.projectiles = [];
    game.items = game.world.loot || []; game.world.loot = null;  // vault loot on the ground
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    clearSkillEffects();
    game.activeBuffs = {}; // shrine buffs don't persist across zones
    game.rift = null;       // entering a normal biome is never a rift
    game.activeBiomeId = biomeId;
    game.activeFloor = floor;
    // Rare Treasure Goblin sighting (not on boss floors)
    if (!game.world.isBoss && roll(0.08)) spawnGoblin(floor);
    // Chance of an ambush event a few seconds in (not floor 1, not boss floors)
    if (!game.world.isBoss && floor > 1 && roll(0.16)) game.world.ambush = { armed: true, delay: 5 + rand() * 6, remaining: 0 };
    spawnHireling();   // recruited companion joins the descent
    // Tag the zone name with the difficulty tier (non-Normal)
    const diffId = game.save.difficulty || 'normal';
    if (diffId !== 'normal') game.world.name += ` [${DIFFICULTIES[diffId].short}]`;
    snapCamera();
    navigateTo('game');
    showZoneToast(`${biome.shortName} — FLOOR ${floor}${diffId !== 'normal' ? ' · ' + DIFFICULTIES[diffId].name.toUpperCase() : ''}`);
    applyDerivedToChar();
    updateHud();
  }

  // ============================================================
  // THE HOLLOW THRONE — the campaign's final battle against the Hollow King
  // ============================================================
  function enterThrone() {
    const biome = BIOMES.find(b => b.id === 'voidspire') || BIOMES[BIOMES.length - 1];
    game.world = generateDungeon(biome, CFG.biomeFloors, { bossId: 'hollowking', throne: true });
    game.world.name = 'THE HOLLOW THRONE';
    game.world.isThrone = true;
    if (window.__GL) window.__GL.onZoneChange(game.world);
    if (window.__AUDIO) window.__AUDIO.music('void');
    game.enemies = game.world.enemies; game.world.enemies = null;
    // focus the arena on the King + a small honor guard (he summons more in the fight)
    {
      const king = game.enemies.find(e => e.id === 'hollowking');
      const guard = game.enemies.filter(e => e.id !== 'hollowking').slice(0, 6);
      game.enemies = king ? [king].concat(guard) : guard;
    }
    game.projectiles = [];
    game.items = game.world.loot || []; game.world.loot = null;
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    clearSkillEffects();
    game.activeBuffs = {};
    game.rift = null;
    game.activeBiomeId = 'voidspire';
    game.activeFloor = CFG.biomeFloors;
    spawnHireling();
    snapCamera();
    navigateTo('game');
    showZoneToast('THE HOLLOW THRONE');
    applyDerivedToChar();
    updateHud();
  }

  // ============================================================
  // KEYED NIGHTMARE DUNGEONS — consume a Sigil to open a modified, harder
  // dungeon with rolled modifiers and boosted loot.
  // ============================================================
  const NIGHTMARE_MODS = {
    empowered: { name: 'Empowered', color: '#ff4d6d', apply: e => { e.dmg = Math.floor(e.dmg * 1.3); } },
    frenzied:  { name: 'Frenzied',  color: '#ffd166', apply: e => { e.speed *= 1.3; } },
    teeming:   { name: 'Teeming',   color: '#9be57c', apply: null },   // handled at spawn
    brutal:    { name: 'Brutal',    color: '#ff8c42', apply: e => { e.hp = Math.floor(e.hp * 1.4); e.hpMax = e.hp; } },
  };
  function rollNightmareMods() {
    const keys = Object.keys(NIGHTMARE_MODS), n = roll(0.5) ? 2 : 1, chosen = [];
    while (chosen.length < n) { const k = pick(keys); if (chosen.indexOf(k) < 0) chosen.push(k); }
    return chosen;
  }
  function enterNightmare() {
    const c = game.char;
    if (!c.sigils || c.sigils < 1) { showHudToast('No Nightmare Sigils.'); sfx('error'); return; }
    c.sigils -= 1;
    const unlocked = BIOMES.filter(b => game.save.unlockedBiomes[b.id]);
    const biome = pick(unlocked.length ? unlocked : [BIOMES[0]]);
    const floor = Math.min(CFG.biomeFloors - 1, 3 + irand(0, 2));
    const mods = rollNightmareMods();
    game.world = generateDungeon(biome, floor, { nightmare: true });
    game.world.name = 'NIGHTMARE — ' + biome.shortName;
    game.world.nightmare = { mods: mods };
    if (window.__GL) window.__GL.onZoneChange(game.world);
    if (window.__AUDIO) window.__AUDIO.music(biome.musicId || biome.id);
    game.enemies = game.world.enemies; game.world.enemies = null;
    // Teeming: ~50% more monsters
    if (mods.indexOf('teeming') >= 0) {
      const pool = biome.enemies, extra = Math.floor(game.enemies.length * 0.5);
      for (let i = 0, tries = 0; i < extra && tries < extra * 4; tries++) {
        const gx = irand(1, game.world.w - 2), gy = irand(1, game.world.h - 2);
        if (game.world.grid[gy][gx] !== 0) continue;
        game.enemies.push(makeEnemy(pick(pool), gx + 0.5, gy + 0.5, floor)); i++;
      }
    }
    // Flat Nightmare boost + per-mod effects + richer loot level
    for (const e of game.enemies) {
      e.hp = Math.floor(e.hp * 1.7); e.hpMax = e.hp;
      e.dmg = Math.floor(e.dmg * 1.35);
      e.ilvl = (e.ilvl || floor) + 4;
      for (const mk of mods) { const md = NIGHTMARE_MODS[mk]; if (md && md.apply) md.apply(e); }
    }
    game.projectiles = []; game.items = game.world.loot || []; game.world.loot = null;
    game.minions = []; game.particles = []; game.floatingTexts = []; ambientParticles.length = 0;
    clearSkillEffects(); game.activeBuffs = {}; game.rift = null;
    game.activeBiomeId = biome.id; game.activeFloor = floor;
    spawnHireling();
    snapCamera(); navigateTo('game');
    showZoneToast('NIGHTMARE · ' + mods.map(m => NIGHTMARE_MODS[m].name).join(' · '));
    applyDerivedToChar(); updateHud();
  }

  // ============================================================
  // GREATER RIFT — endless, scaling challenge dungeon with a timer
  // ============================================================
  const RIFT_BASE_TIME = 150;   // seconds for the first rift level
  const RIFT_TIME_BONUS = 30;   // extra seconds added when you descend
  // Build a mixed enemy pool drawn from every biome the player has unlocked.
  function riftEnemyPool() {
    const pool = [];
    BIOMES.forEach(b => {
      if (game.save.unlockedBiomes[b.id]) pool.push(...b.enemies);
    });
    if (pool.length === 0) pool.push(...BIOMES[0].enemies);
    return pool;
  }
  function enterRift(level) {
    level = level || 1;
    const pool = riftEnemyPool();
    const palette = { wall: '#b388ff', floor: '#140b20', accent: '#00e5ff' };
    const synth = { id: 'voidspire', shortName: 'RIFT', enemies: pool, boss: null, palette };
    const enemyLevel = Math.max(1, game.char.level + level * 2);
    const world = generateDungeon(synth, level, {
      isRift: true, noBoss: true, enemyLevel, enemyPerRoom: [2, 4],
    });
    // Rifts run dense & deadly — promote some enemies to elites for flavor and reward
    world.enemies.forEach(e => {
      if (!e.elite && roll(0.18)) makeElite(e);
    });
    game.world = world;
    if (window.__GL) window.__GL.onZoneChange(game.world);
    game.enemies = game.world.enemies; game.world.enemies = null;
    game.projectiles = [];
    game.items = game.world.loot || []; game.world.loot = null;  // vault loot on the ground
    game.minions = [];
    game.particles = [];
    game.floatingTexts = [];
    ambientParticles.length = 0;
    clearSkillEffects();
    game.activeBuffs = {};
    game.activeBiomeId = null;   // ephemeral — keeps saveGame from persisting the rift
    game.activeFloor = 0;
    // Rift run state — timer accumulates across descents
    const carryTime = (level > 1 && game.rift) ? game.rift.timeLeft + RIFT_TIME_BONUS : RIFT_BASE_TIME;
    game.rift = {
      active: true,
      level,
      kills: 0,
      killsNeeded: Math.max(6, Math.floor(game.enemies.length * 0.7)),
      timeLeft: carryTime,
    };
    spawnHireling();   // companion joins the rift run
    snapCamera();
    navigateTo('game');
    showZoneToast(`GREATER RIFT ${level}`);
    applyDerivedToChar();
    updateHud();
  }
  // Reveal the rift descend portal once enough enemies have fallen.
  function riftCheckProgress() {
    if (!game.rift || !game.rift.active) return;
    if (game.rift.kills < game.rift.killsNeeded) return;
    const portal = (game.world.portals || []).find(p => p.kind === 'rift-next' && p.locked);
    if (portal) {
      portal.locked = false;
      portal.label = `→ Descend to Rift ${game.rift.level + 1}`;
      showHudToast('RIFT PORTAL OPEN!');
      floatText('RIFT PORTAL OPEN', game.world.player.x, game.world.player.y - 1, 'crit');
    }
  }
  function tickRift(dt) {
    if (!game.rift || !game.rift.active) return;
    if (!game.world || !game.world.isRift) return;
    game.rift.timeLeft -= dt;
    if (game.rift.timeLeft <= 0) {
      game.rift.timeLeft = 0;
      endRift(false);
    }
  }
  // End a rift run. `banked` = reached via the leave portal (success); otherwise
  // the timer collapsed. Either way, rewards scale with the deepest level reached.
  function endRift(banked) {
    if (!game.rift) { enterTown(); return; }
    const level = game.rift.level;
    const c = game.char;
    // Rewards scale with depth
    const gold = level * 60;
    const dust = level * 3;
    const tears = Math.max(1, Math.floor(level / 3));
    c.gold += gold;
    c.craftDust = (c.craftDust || 0) + dust;
    c.glassTears = (c.glassTears || 0) + tears;
    // Track personal best
    let newBest = false;
    if (level > (game.save.bestRift || 0)) { game.save.bestRift = level; newBest = true; }
    game.rift.active = false;
    game.rift = null;
    saveGame();
    enterTown();
    showHudToast(`${banked ? 'Rift banked' : 'Rift collapsed'} at level ${level} · +${gold}g +${dust} dust +${tears} tear${tears === 1 ? '' : 's'}${newBest ? ' · NEW BEST!' : ''}`);
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
    setupTouchControls();
  }

  // ============================================================
  // TOUCH CONTROLS — virtual D-pad + pinch button for phone play.
  // Each button dispatches synthetic events through onKeyDown/onKeyUp,
  // so all existing combo / impulse / cooldown logic works unchanged.
  // Glasses keyboard input is completely untouched.
  // ============================================================
  function setupTouchControls() {
    const root = document.getElementById('touch-controls');
    if (!root) return;
    // Restore the user's preference (persists across sessions; old key for back-compat)
    const saved = localStorage.getItem('hollowlight_touch_enabled') || localStorage.getItem('glasspire_touch_enabled');
    if (saved === '1') showTouchControls(true);
    // Wire every touch button: press = synthetic keydown, release = synthetic keyup
    const buttons = root.querySelectorAll('[data-touch-key]');
    buttons.forEach(btn => {
      const key = btn.dataset.touchKey;
      const press = (ev) => {
        ev.preventDefault();
        // build minimal synthetic event compatible with onKeyDown
        onKeyDown({ key, repeat: false, preventDefault: () => {} });
      };
      const release = (ev) => {
        ev.preventDefault();
        onKeyUp({ key });
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend',   release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      // Also wire mouse events so it works on desktop browsers with mouse
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup',   release);
      btn.addEventListener('mouseleave', release);
    });
  }

  function showTouchControls(on) {
    const root = document.getElementById('touch-controls');
    if (!root) return;
    if (on) root.classList.remove('hidden');
    else    root.classList.add('hidden');
    localStorage.setItem('hollowlight_touch_enabled', on ? '1' : '0');
  }
  function toggleTouchControls() {
    const root = document.getElementById('touch-controls');
    if (!root) return;
    const isOn = !root.classList.contains('hidden');
    showTouchControls(!isOn);
  }

  function onKeyDown(e) {
    const key = e.key;
    const inGame = (game.screen === 'game');

    // Block arrow key repeats everywhere — they cause stuck movement in game
    // (stale held-key state from EMG wristband persists across screen transitions)
    // and janky navigation in menus. Held-movement uses game.keys + keyup instead.
    // Enter/Escape repeats are allowed through for menu selection reliability.
    if (e.repeat && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) return;

    // D-pad code picker — intercept arrow keys so they edit the code instead of
    // moving menu focus. Pinch (Enter) submits.
    if (game.screen === 'code-picker') {
      if (key === 'ArrowUp')    { cyclePickerChar(+1); e.preventDefault(); return; }
      if (key === 'ArrowDown')  { cyclePickerChar(-1); e.preventDefault(); return; }
      if (key === 'ArrowLeft')  { movePickerCursor(-1); e.preventDefault(); return; }
      if (key === 'ArrowRight') { movePickerCursor(+1); e.preventDefault(); return; }
      if (key === 'Enter')      { submitCodePicker(); e.preventDefault(); return; }
      if (key === 'Escape')     { navigateBack(); e.preventDefault(); return; }
      // Other keys (e.g. tab) — let them fall through to default
    }

    if (key === 'Escape') {
      if (inGame) {
        navigateTo('menu');
      } else {
        navigateBack();
      }
      e.preventDefault(); return;
    }

    if (inGame) {
      // Block all input during the menu-return guard period (200ms after returning from menu)
      if (game._menuReturnGuardUntil && performance.now() < game._menuReturnGuardUntil) { e.preventDefault(); return; }
      // record arrow taps into combo buffer (4-tap patterns won't fire accidentally)
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
        const now = performance.now();
        const ch = key.replace('Arrow','').toLowerCase();
        // gap filter to reject key-repeat ghosts
        if (game.comboBuffer.length === 0 || (now - game.lastKeyTime) > CFG.minComboGap) {
          // only reset the sequence after a long pause — slow EMG swipes still chain
          if ((now - game.lastKeyTime) > CFG.comboHold) game.comboBuffer.length = 0;
          game.comboBuffer.push({ ch, t: now });
          game.lastKeyTime = now;
          tryCombo();
          // If combo navigated away from game (e.g. opened menu), bail out —
          // don't set movement keys for the final combo tap direction
          if (game.screen !== 'game') { e.preventDefault(); return; }
        }
      }
      // movement keys — set both current state AND tap queue
      // tap queue ensures sub-frame taps (keydown+keyup between frames) are never lost
      if (key === 'ArrowUp')    { game.keys.up = true;    game.tapped.up = true;    e.preventDefault(); }
      if (key === 'ArrowDown')  { game.keys.down = true;  game.tapped.down = true;  e.preventDefault(); }
      if (key === 'ArrowLeft')  { game.keys.left = true;  game.tapped.left = true;  e.preventDefault(); }
      if (key === 'ArrowRight') { game.keys.right = true; game.tapped.right = true; e.preventDefault(); }
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
    // Always clear key state on release regardless of screen —
    // prevents stuck keys when returning to game from menu
    if (e.key === 'ArrowUp')    game.keys.up = false;
    if (e.key === 'ArrowDown')  game.keys.down = false;
    if (e.key === 'ArrowLeft')  game.keys.left = false;
    if (e.key === 'ArrowRight') game.keys.right = false;
  }

  function tryCombo() {
    const b = game.comboBuffer;
    if (b.length < 3) return;
    // prune entries older than the generous hold window (keep enough history that a
    // 4-tap sequence spanning up to comboHold*2 is never pruned mid-match)
    const now = b[b.length - 1].t;
    while (b.length > 0 && (now - b[0].t) > CFG.comboHold * 3) b.shift();

    let matched = false;

    // 4-tap patterns: intentional wiggle. Uses the generous hold window so the
    // slower swipe cadence on the EMG wristband still chains into a combo.
    if (b.length >= 4) {
      const last4 = b.slice(-4).map(e => e.ch).join(',');
      const span = b[b.length - 1].t - b[b.length - 4].t;
      if (span <= CFG.comboHold * 2) {
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
  function drinkPotion(auto) {
    const c = game.char;
    if (c.potions <= 0) { if (!auto) showHudToast('No potions.'); return; }
    if (c.hp >= c.hpMax) { if (!auto) showHudToast('Already full.'); return; }
    c.potions -= 1;
    sfx('potion');
    const heal = Math.floor(c.hpMax * 0.4);
    c.hp = Math.min(c.hpMax, c.hp + heal);
    floatText(`+${heal}`, game.world.player.x, game.world.player.y, 'heal');
    showHudToast(auto ? `Auto-potion. ${c.potions} left.` : `Potion used. ${c.potions} left.`);
    saveGame();
    updateHud();
  }
  // Auto-drink a potion when HP falls below the configured threshold.
  function checkAutoPotion() {
    const c = game.char;
    if (!c || !c.autoPotion) return;
    if (c.hp <= 0 || c.potions <= 0) return;
    if (c.hp <= c.hpMax * (c.autoPotionPct || 0.35)) {
      drinkPotion(true);
    }
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
    if (game.nearbyShrine) { activateShrine(game.nearbyShrine); return; }
    if (game.nearbyItem) { pickupItem(game.nearbyItem); return; }
    castActiveSkill();
  }

  function activateShrine(sh) {
    const def = SHRINES[sh.type];
    if (!def || sh.used) return;
    sh.used = true;
    game.activeBuffs = game.activeBuffs || {};
    // Set the timer for this buff type (overwrites if already active — fresh duration)
    game.activeBuffs[def.effect] = def.duration;
    // Special activation effects
    if (def.effect === 'mana') {
      game.char.mp = game.char.mpMax; // instant full mana
    }
    // Recompute derived stats so damage buff applies immediately
    applyDerivedToChar();
    showHudToast(`${def.name}: ${def.desc}`);
    // Burst of particles in shrine color
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 2.5;
      addParticle({
        x: sh.x, y: sh.y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        color: def.color, life: 0.8 + Math.random() * 0.4, age: 0, size: 3,
      });
    }
    game.screenShake = Math.max(game.screenShake, 0.15);
  }

  function openNpc(npc) {
    if (npc.role === 'vendor') { openVendor(); }
    else if (npc.role === 'stash') { openStash(); }
    else if (npc.role === 'quests') { openQuests(); }
    else if (npc.role === 'waypoint') { openWaypoint(); }
    else if (npc.role === 'mystery') { openMysteryVendor(); }
    else if (npc.role === 'mercenary') { openMercenary(); }
  }

  function activatePortal(p) {
    if (p.kind === 'next') {
      const next = game.activeFloor + 1;
      enterBiome(game.activeBiomeId, next);
    } else if (p.kind === 'rift-next') {
      if (p.locked) { showHudToast('Clear more enemies to open the portal.'); return; }
      enterRift((game.rift ? game.rift.level : 0) + 1);
    } else if (p.kind === 'town') {
      // Leaving via a rift's portal banks the run for rewards
      if (game.world && game.world.isRift && game.rift && game.rift.active) {
        endRift(true);
      } else {
        enterTown();
      }
    }
  }

  // ============================================================
  // ACTIVE SKILL
  // ============================================================
  function getActiveSkillId() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const available = getAvailableSkills();
    // Use player's selected skill if it's available (class skill OR granted by equipped item)
    if (c.selectedSkill && available.includes(c.selectedSkill)) return c.selectedSkill;
    return cls.skills[0];
  }

  // List of skills the player can choose from: class skills + any granted by equipped unique items
  function getAvailableSkills() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const skills = cls.skills.slice();
    for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
      const it = c.equip[slot];
      if (!it) continue;
      const base = ITEM_BASES[it.baseId];
      if (base && base.grantsSkill && SKILLS[base.grantsSkill] && !skills.includes(base.grantsSkill)) {
        skills.push(base.grantsSkill);
      }
    }
    return skills;
  }

  function castActiveSkill() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const skillId = getActiveSkillId();
    const skill = SKILLS[skillId];
    const p = game.world.player;
    // Nullweaver silence check
    if (p.silenced && p.silenced > 0) { showHudToast('SILENCED!'); return; }
    if (p.skillCd > 0) { showHudToast(`Skill cooling: ${p.skillCd.toFixed(1)}s`); return; }
    const rune = getSkillRune(skillId);
    const cost = Math.round((skill.cost || cls.activeSkillCost) * (rune ? (rune.costMul || 1) : 1));
    if (c.mp < cost) { showHudToast('Not enough mana'); return; }
    c.mp -= cost;
    p.skillCd = skill.cooldown * (rune ? (rune.cdMul || 1) : 1);
    // Skill damage multiplier from the equipped rune — read by hitEnemy + spawnProjectile.
    // try/finally guarantees it resets even if a skill takes an early return.
    game._skillDmgMul = rune ? (rune.dmgMul || 1) : 1;
    try {
    if (skillId === 'whirlwind') {
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
    else if (skillId === 'leapslam') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 2.8);
      const dir = p.lastDir.x || p.lastDir.y ? p.lastDir : { x: 0, y: 1 };
      // Leap forward 3 tiles (stop at walls)
      let tx = p.x, ty = p.y;
      for (let i = 1; i <= 12; i++) {
        const cx = p.x + dir.x * 3 * (i / 12);
        const cy = p.y + dir.y * 3 * (i / 12);
        const gx = Math.floor(clamp(cx, 0, game.world.w - 1));
        const gy = Math.floor(clamp(cy, 0, game.world.h - 1));
        if (game.world.grid[gy][gx] !== 0) break;
        tx = cx; ty = cy;
      }
      // trail particles from old pos to new pos
      for (let i = 0; i < 8; i++) {
        pushParticle(lerp(p.x, tx, i / 8), lerp(p.y, ty, i / 8), '#ff4d6d', 0.3);
      }
      p.x = tx; p.y = ty;
      // AOE slam on landing
      const radius = 2.0;
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      for (const e of targets) { hitEnemy(e, dmg, d.crit); e.stagger = Math.max(e.stagger, 0.5); }
      // ground slam particles
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * PI2;
        addParticle({
          x: p.x + Math.cos(a) * 0.3, y: p.y + Math.sin(a) * 0.3,
          vx: Math.cos(a) * 5, vy: Math.sin(a) * 5,
          color: i % 2 === 0 ? '#ff4d6d' : '#ffc857', life: 0.4 + rand() * 0.2, age: 0, size: 2 + rand() * 2,
        });
      }
      burst(p.x, p.y, '#ffffff', 14);
      game.screenShake = Math.max(game.screenShake, 0.3);
    }
    else if (skillId === 'warcry') {
      const d = derived(c);
      // Buff: +50% damage for 8 seconds (stored on player)
      p.warcryBuff = 8.0;
      // Stagger nearby enemies
      const radius = 2.5;
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      for (const e of targets) { e.stagger = Math.max(e.stagger, 1.5); }
      // Expanding shockwave ring
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * PI2;
        addParticle({
          x: p.x + Math.cos(a) * 0.5, y: p.y + Math.sin(a) * 0.5,
          vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
          color: '#ffc857', life: 0.4 + rand() * 0.2, age: 0, size: 2.5 + rand() * 1.5,
        });
      }
      burst(p.x, p.y, '#ffc857', 12);
      game.screenShake = Math.max(game.screenShake, 0.18);
      showHudToast('+50% Damage for 8s!');
    }
    else if (skillId === 'frostnova') {
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
    else if (skillId === 'chainlightning') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 1.5);
      const maxBounces = 5;
      const bounceRange = 4.0;
      // Find first target — closest enemy
      let targets = [];
      let lastPos = { x: p.x, y: p.y };
      const hitSet = new Set();
      for (let bounce = 0; bounce < maxBounces; bounce++) {
        let near = null, nd = Infinity;
        for (const e of game.enemies) {
          if (hitSet.has(e)) continue;
          const dd = dist(e, lastPos);
          if (dd <= bounceRange && dd < nd) { near = e; nd = dd; }
        }
        if (!near) break;
        hitSet.add(near);
        targets.push(near);
        // Draw lightning bolt particles between lastPos and target
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const lx = lerp(lastPos.x, near.x, t) + (rand() - 0.5) * 0.3;
          const ly = lerp(lastPos.y, near.y, t) + (rand() - 0.5) * 0.3;
          addParticle({
            x: lx, y: ly, vx: (rand() - 0.5) * 2, vy: (rand() - 0.5) * 2,
            color: i % 2 === 0 ? '#ffffff' : '#6df1ff', life: 0.3 + rand() * 0.2, age: 0, size: 1.5 + rand(),
          });
        }
        hitEnemy(near, dmg, d.crit);
        burst(near.x, near.y, '#6df1ff', 8);
        lastPos = { x: near.x, y: near.y };
      }
      if (targets.length === 0) {
        // No targets — zap forward
        const dir = p.lastDir.x || p.lastDir.y ? p.lastDir : { x: 0, y: 1 };
        for (let i = 0; i < 8; i++) {
          addParticle({
            x: p.x + dir.x * i * 0.5, y: p.y + dir.y * i * 0.5,
            vx: (rand() - 0.5) * 2, vy: (rand() - 0.5) * 2,
            color: '#6df1ff', life: 0.2 + rand() * 0.15, age: 0, size: 1.5,
          });
        }
      }
      game.screenShake = Math.max(game.screenShake, 0.12);
    }
    else if (skillId === 'meteor') {
      const d = derived(c);
      // Bake the rune multiplier in now — impact is delayed, after the mul resets
      const dmg = Math.floor(d.dmg * 4.0 * (game._skillDmgMul || 1));
      const dir = p.lastDir.x || p.lastDir.y ? p.lastDir : { x: 0, y: 1 };
      const targetX = p.x + dir.x * 3;
      const targetY = p.y + dir.y * 3;
      // Delayed impact — store meteor for detonation
      if (!game.pendingMeteors) game.pendingMeteors = [];
      game.pendingMeteors.push({
        x: targetX, y: targetY, dmg, crit: d.crit, delay: 0.6, radius: 2.5,
      });
      // Warning circle particles (red glow at target)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI2;
        addParticle({
          x: targetX + Math.cos(a) * 1.2, y: targetY + Math.sin(a) * 1.2,
          vx: 0, vy: -0.5,
          color: '#ff7043', life: 0.55, age: 0, size: 2,
        });
      }
      showHudToast('Meteor incoming!');
    }
    else if (skillId === 'multishot') {
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
    else if (skillId === 'poisontrap') {
      const d = derived(c);
      // Bake the rune multiplier in now — the zone ticks damage later
      const dmg = Math.floor(d.dmg * 0.6 * (game._skillDmgMul || 1));
      // Place a poison zone at current position
      if (!game.poisonZones) game.poisonZones = [];
      game.poisonZones.push({
        x: p.x, y: p.y, radius: 2.0, dmg, crit: d.crit,
        ttl: 5.0, tickTimer: 0, tickInterval: 0.5,
      });
      // Drop effect
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI2;
        addParticle({
          x: p.x + Math.cos(a) * 0.8, y: p.y + Math.sin(a) * 0.8,
          vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5,
          color: '#9be57c', life: 0.5 + rand() * 0.3, age: 0, size: 2 + rand(),
        });
      }
      burst(p.x, p.y, '#51e6a4', 10);
      showHudToast('Trap placed!');
    }
    else if (skillId === 'piercingshot') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 2.5);
      const dir = p.lastDir.x || p.lastDir.y ? p.lastDir : { x: 0, y: 1 };
      // Fire a piercing projectile (special kind that doesn't stop on hit)
      game.projectiles.push({
        x: p.x, y: p.y, dx: dir.x, dy: dir.y,
        speed: 14, dmg, color: '#51e6a4', kind: 'piercing', friendly: true,
        life: 2.0, age: 0, piercing: true, hitList: new Set(),
      });
      // Big muzzle flash
      burst(p.x + dir.x * 0.4, p.y + dir.y * 0.4, '#51e6a4', 12);
      burst(p.x + dir.x * 0.4, p.y + dir.y * 0.4, '#ffffff', 6);
      game.screenShake = Math.max(game.screenShake, 0.08);
    }
    else if (skillId === 'raisedead') {
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
    else if (skillId === 'souldrain') {
      const d = derived(c);
      // Start a soul drain channel (ticks over 3 seconds)
      // Find nearest enemy
      let near = null, nd = Infinity;
      for (const e of game.enemies) {
        const dd = dist(e, p);
        if (dd <= 5.0 && dd < nd) { near = e; nd = dd; }
      }
      if (near) {
        if (!game.soulDrains) game.soulDrains = [];
        game.soulDrains.push({
          target: near, dmg: Math.floor(d.dmg * 1.0 * (game._skillDmgMul || 1)), crit: d.crit,
          ttl: 3.0, tickTimer: 0, tickInterval: 0.4,
        });
        burst(p.x, p.y, '#c489ff', 8);
        showHudToast('Draining soul...');
      } else {
        showHudToast('No target in range');
        // Refund partial mana
        c.mp += Math.floor(cost * 0.5);
        p.skillCd = 1.0; // short cd on miss
      }
    }
    else if (skillId === 'corpseexplosion') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 2.0);
      const radius = 1.8;
      // Get recent corpse positions (stored when enemies die)
      const corpses = (game.corpsePositions || []).filter(cp => dist(cp, p) <= 5.0);
      if (corpses.length === 0) {
        showHudToast('No corpses nearby');
        c.mp += Math.floor(cost * 0.5);
        p.skillCd = 1.0;
      } else {
        let totalHits = 0;
        for (const cp of corpses) {
          const targets = game.enemies.filter(e => dist(e, cp) <= radius);
          for (const e of targets) { hitEnemy(e, dmg, d.crit); totalHits++; }
          // Explosion effect at each corpse
          burst(cp.x, cp.y, '#c489ff', 16);
          burst(cp.x, cp.y, '#ff4d6d', 10);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * PI2;
            addParticle({
              x: cp.x, y: cp.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4,
              color: '#c489ff', life: 0.35 + rand() * 0.2, age: 0, size: 2 + rand() * 2,
            });
          }
        }
        game.corpsePositions = (game.corpsePositions || []).filter(cp => dist(cp, p) > 5.0);
        game.screenShake = Math.max(game.screenShake, 0.25);
        if (totalHits > 0) showHudToast(`${corpses.length} corpse(s) detonated!`);
      }
    }
    // --- Shield Wall (Warrior) ---
    else if (skillId === 'shieldwall') {
      p.shieldWall = 5.0; // seconds of 70% damage reduction
      showHudToast('Shield Wall! 70% DR for 5s');
      // defensive particle ring
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * PI2;
        addParticle({
          x: p.x + Math.cos(a) * 1.2, y: p.y + Math.sin(a) * 1.2,
          vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5,
          color: '#ffc857', life: 1.0 + rand() * 0.5, age: 0, size: 2 + rand(),
        });
      }
      burst(p.x, p.y, '#ffc857', 12);
      game.screenShake = Math.max(game.screenShake, 0.08);
    }
    // --- Blink Strike (Mage) ---
    else if (skillId === 'blinkstrike') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 3.0);
      // find nearest enemy within 6 tiles
      let near = null, nd = 6;
      for (const e of game.enemies) {
        const dd = dist(e, p);
        if (dd < nd) { nd = dd; near = e; }
      }
      if (!near) {
        showHudToast('No target in range');
        c.mp += Math.floor(cost * 0.7);
        p.skillCd = 1.0;
      } else {
        // trail from old position
        const ox = p.x, oy = p.y;
        // teleport next to target
        const ang = Math.atan2(p.y - near.y, p.x - near.x);
        p.x = near.x + Math.cos(ang) * 0.6;
        p.y = near.y + Math.sin(ang) * 0.6;
        // blink trail particles
        for (let i = 0; i < 8; i++) {
          pushParticle(lerp(ox, p.x, i / 8), lerp(oy, p.y, i / 8), '#6df1ff', 0.4);
        }
        // hit primary target
        hitEnemy(near, dmg, d.crit);
        burst(near.x, near.y, '#6df1ff', 14);
        game.screenShake = Math.max(game.screenShake, 0.15);
        // chain to second target if nearby
        let second = null, sd = 3;
        for (const e of game.enemies) {
          if (e === near || e.hp <= 0) continue;
          const dd = dist(e, p);
          if (dd < sd) { sd = dd; second = e; }
        }
        if (second) {
          hitEnemy(second, Math.floor(dmg * 0.6), d.crit);
          burst(second.x, second.y, '#6df1ff', 8);
          // lightning between targets
          for (let i = 0; i < 5; i++) {
            addParticle({
              x: lerp(near.x, second.x, i / 5) + (rand() - 0.5) * 0.3,
              y: lerp(near.y, second.y, i / 5) + (rand() - 0.5) * 0.3,
              vx: (rand() - 0.5) * 2, vy: (rand() - 0.5) * 2,
              color: '#ffffff', life: 0.2, age: 0, size: 1.5,
            });
          }
        }
      }
    }
    // --- Arrow Volley (Ranger) ---
    else if (skillId === 'volley') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 1.2);
      const radius = 3.0;
      // rain 12 arrows in the area around the player
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      for (const e of targets) {
        hitEnemy(e, dmg, d.crit);
        hitEnemy(e, dmg, d.crit); // double-hit simulates multiple arrows
      }
      // visual: arrows raining down
      for (let i = 0; i < 12; i++) {
        const a = rand() * PI2;
        const r = rand() * radius;
        const tx = p.x + Math.cos(a) * r;
        const ty = p.y + Math.sin(a) * r;
        addParticle({
          x: tx, y: ty - 2, vx: 0, vy: 6,
          color: '#51e6a4', life: 0.3 + rand() * 0.15, age: 0, size: 2,
        });
      }
      burst(p.x, p.y, '#51e6a4', 10);
      burst(p.x, p.y, '#ffffff', 6);
      game.screenShake = Math.max(game.screenShake, 0.18);
      if (targets.length > 0) showHudToast(`Volley hit ${targets.length} enemies!`);
    }
    // --- Bone Prison (Summoner) ---
    else if (skillId === 'boneprison') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 1.5);
      // find nearest enemy within 5 tiles
      let near = null, nd = 5;
      for (const e of game.enemies) {
        const dd = dist(e, p);
        if (dd < nd) { nd = dd; near = e; }
      }
      if (!near) {
        showHudToast('No target in range');
        c.mp += Math.floor(cost * 0.7);
        p.skillCd = 1.0;
      } else {
        // deal impact damage and stun
        hitEnemy(near, dmg, d.crit);
        near.frozen = Math.max(near.frozen || 0, 4.0); // 4s stun
        near.stagger = Math.max(near.stagger || 0, 4.0);
        // bone cage visual — ring of bone particles
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * PI2;
          addParticle({
            x: near.x + Math.cos(a) * 0.7, y: near.y + Math.sin(a) * 0.7,
            vx: 0, vy: -1.5 - rand(),
            color: i % 2 === 0 ? '#c489ff' : '#ffffff', life: 1.5 + rand() * 0.5, age: 0, size: 2 + rand(),
          });
        }
        burst(near.x, near.y, '#c489ff', 12);
        game.screenShake = Math.max(game.screenShake, 0.1);
      }
    }
    // ===== LEGENDARY-GRANTED SKILLS =====
    else if (skillId === 'demonslash') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 3.5);
      const radius = 2.5;
      const dir = (p.lastDir.x || p.lastDir.y) ? p.lastDir : { x: 0, y: 1 };
      const faceAng = Math.atan2(dir.y, dir.x);
      const targets = game.enemies.filter(e => {
        const dx = e.x - p.x, dy = e.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius) return false;
        const ang = Math.atan2(dy, dx);
        let diff = Math.abs(ang - faceAng);
        if (diff > Math.PI) diff = PI2 - diff;
        return diff < 1.2; // ~140° cone
      });
      for (const e of targets) {
        hitEnemy(e, dmg, d.crit);
        applyStatus(e, 'burn', { dmg: Math.max(2, Math.floor(d.dmg * 0.15)), dt: 4 });
      }
      // crescent sweep particles
      for (let i = 0; i < 18; i++) {
        const a = faceAng + (i - 9) * 0.12;
        const r = 1.0 + rand() * 1.5;
        addParticle({
          x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
          vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5,
          color: i % 2 === 0 ? '#ff4d6d' : '#ffaa00', life: 0.4 + rand() * 0.2, age: 0, size: 3,
        });
      }
      burst(p.x + dir.x * 1.2, p.y + dir.y * 1.2, '#ff4d6d', 14);
      game.screenShake = Math.max(game.screenShake, 0.22);
    }
    else if (skillId === 'starfall') {
      const d = derived(c);
      // Bake the rune multiplier in now — meteors land later via setTimeout
      const baseDmg = Math.floor(d.dmg * 2.5 * (game._skillDmgMul || 1));
      // Find nearest enemy as the strike center (else 3 tiles ahead)
      let cx = p.x, cy = p.y;
      const dir = (p.lastDir.x || p.lastDir.y) ? p.lastDir : { x: 0, y: 1 };
      let near = null, nd = 6;
      for (const e of game.enemies) { const dd = dist(e, p); if (dd < nd) { nd = dd; near = e; } }
      if (near) { cx = near.x; cy = near.y; } else { cx += dir.x * 3; cy += dir.y * 3; }
      // 3 meteors at offsets
      const offsets = [[0,0],[-1.2,0.6],[1.0,-0.4]];
      for (let m = 0; m < offsets.length; m++) {
        const mx = cx + offsets[m][0], my = cy + offsets[m][1];
        setTimeout(() => {
          const targets = game.enemies.filter(e => dist(e, { x: mx, y: my }) <= 1.5);
          for (const e of targets) hitEnemy(e, baseDmg, d.crit);
          burst(mx, my, '#ffaa00', 18);
          burst(mx, my, '#ffffff', 8);
          game.screenShake = Math.max(game.screenShake, 0.18);
          for (let i = 0; i < 14; i++) {
            const a = rand() * PI2;
            const sp = 1 + rand() * 2.5;
            addParticle({
              x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              color: i % 2 === 0 ? '#ffaa00' : '#ffd166', life: 0.5 + rand() * 0.3, age: 0, size: 3,
            });
          }
        }, 200 + m * 150);
      }
    }
    else if (skillId === 'typhoonshot') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 1.3);
      const dir = (p.lastDir.x || p.lastDir.y) ? p.lastDir : { x: 0, y: 1 };
      const baseAng = Math.atan2(dir.y, dir.x);
      // Fan of 8 arrows over ~70°
      for (let i = 0; i < 8; i++) {
        const a = baseAng + (i - 3.5) * 0.15;
        spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), 14, dmg, '#cfe7c0', 'arrow', true);
      }
      burst(p.x, p.y, '#cfe7c0', 10);
    }
    else if (skillId === 'soulharvest') {
      const d = derived(c);
      const dmg = Math.floor(d.dmg * 2.0);
      const radius = 4;
      const targets = game.enemies.filter(e => dist(e, p) <= radius);
      let totalDealt = 0;
      for (const e of targets) {
        const hpBefore = e.hp;
        hitEnemy(e, dmg, d.crit);
        const dealt = hpBefore - e.hp;
        totalDealt += dealt;
        // soul tether particle
        for (let i = 0; i < 5; i++) {
          pushParticle(lerp(p.x, e.x, i / 5), lerp(p.y, e.y, i / 5), '#c489ff', 0.4);
        }
      }
      const heal = Math.floor(totalDealt * 0.3);
      if (heal > 0) {
        c.hp = Math.min(c.hpMax, c.hp + heal);
        floatText(`+${heal}`, p.x, p.y - 0.4, 'heal');
      }
      burst(p.x, p.y, '#c489ff', 14);
    }
    } finally {
      game._skillDmgMul = 1;
    }
    updateHud();
  }

  // ============================================================
  // STATUS EFFECTS — burn / poison / freeze stacks on enemies
  // ============================================================
  function applyStatus(e, type, params) {
    if (!e || e.hp <= 0) return;
    if (!e.statusEffects) e.statusEffects = {};
    const s = e.statusEffects;
    if (type === 'burn') {
      // Refresh duration; keep highest tick damage
      const dmg = Math.max((s.burn && s.burn.dmg) || 0, params.dmg);
      const dt  = Math.max((s.burn && s.burn.dt)  || 0, params.dt);
      s.burn = { dmg, dt, tick: 0 };
    } else if (type === 'poison') {
      const cur = s.poison;
      if (cur) {
        cur.stacks = Math.min(5, (cur.stacks || 1) + 1);
        cur.dt = Math.max(cur.dt, params.dt);
        cur.dmg = Math.max(cur.dmg, params.dmg);
      } else {
        s.poison = { dmg: params.dmg, dt: params.dt, stacks: 1, tick: 0 };
      }
    } else if (type === 'frozen') {
      // Use existing e.frozen (already a numeric timer) so existing AI checks keep working
      e.frozen = Math.max(e.frozen || 0, params.dt || 0);
    }
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
    // attack swing / cast sound (per attack)
    const ak = cls.attackKind;
    if (ak === 'cleave') sfxT('cleave', 90);
    else if (ak && ak.indexOf('projectile') === 0) sfxT('cast', 90, { base: ak === 'projectile-arrow' ? 620 : ak === 'projectile-bone' ? 360 : 460 });
    else sfxT('attack', 90);

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

  // ---- audio helpers (throttled so simultaneous events don't stack into noise) ----
  const _sfxLast = {};
  function sfx(name, opt) { if (window.__AUDIO) window.__AUDIO.play(name, opt); }
  function sfxT(name, ms, opt) { const t = performance.now(); if (!_sfxLast[name] || t - _sfxLast[name] >= (ms || 60)) { _sfxLast[name] = t; sfx(name, opt); } }

  function hitEnemy(e, baseDmg, critPct) {
    const isCrit = roll((critPct || 5) / 100);
    const runeMul = game._skillDmgMul || 1;  // active only during a rune-augmented skill cast
    const dmg = Math.max(1, Math.floor(baseDmg * runeMul * (isCrit ? 1.8 : 1) * (0.85 + rand() * 0.3)));
    e.hp -= dmg;
    if (isCrit) sfxT('crit', 55); else sfxT('enemyHit', 45);
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
    // Passive trait: Thornling reflects thorn damage on hit
    if (e.trait === 'thorns' && e.hp > 0) {
      const thornDmg = Math.floor(dmg * 0.25);
      if (thornDmg > 0) {
        damagePlayer(thornDmg);
        burst(e.x, e.y, '#9be57c', 4);
      }
    }
    // Passive trait: Crystal Sentinel reflects 15% damage as a projectile
    if (e.trait === 'reflect' && e.hp > 0) {
      const p = game.world.player;
      const rdx = p.x - e.x, rdy = p.y - e.y;
      const rd = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rd > 0.1) {
        spawnProjectile(e.x, e.y, rdx / rd, rdy / rd, 8, Math.floor(dmg * 0.15), '#e0e0ff', 'soul', false);
        burst(e.x, e.y, '#e0e0ff', 6);
      }
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    sfx(e.boss ? 'bossDie' : 'enemyDie');
    burst(e.x, e.y, e.color, e.boss ? 35 : 20);
    burst(e.x, e.y, '#ffffff', e.boss ? 12 : 5);
    game.screenShake = Math.max(game.screenShake, e.boss ? 0.45 : 0.12);
    // Treasure Goblin JACKPOT — a burst of gold + a handful of high-rarity items
    if (e.isGoblin) {
      sfx('gold'); sfx('legendary');
      const lvl = game.char ? game.char.level : 1;
      const bonusGold = irand(120, 280) + lvl * 12;
      game.char.gold += bonusGold;
      floatText('+' + bonusGold + 'g', e.x, e.y - 0.9, 'loot');
      burst(e.x, e.y, '#ffd24a', 44);
      const drops = 3 + irand(0, 2);
      for (let i = 0; i < drops; i++) {
        const r = roll(0.2) ? 'unique' : (roll(0.5) ? 'rare' : 'magic');
        const item = rollItem(Math.max(1, (e.ilvl || lvl) + 2), r, { preferLegendary: r === 'unique' });
        if (item) {
          const a = rand() * PI2, rd = 0.4 + rand() * 0.7;
          game.items.push({ x: e.x + Math.cos(a) * rd, y: e.y + Math.sin(a) * rd, item, age: 0 });
        }
      }
    }
    // Ambush event: clearing the last ambusher drops a survival cache
    if (e._ambush && game.world && game.world.ambush) {
      const amb = game.world.ambush;
      amb.remaining = Math.max(0, (amb.remaining || 1) - 1);
      if (amb.remaining === 0) {
        showHudToast('Ambush survived — cache dropped!');
        sfx('legendary');
        const lvl = game.char ? game.char.level : 1;
        game.char.gold += irand(40, 120);
        for (let i = 0; i < 3; i++) {
          const r = roll(0.12) ? 'unique' : (roll(0.5) ? 'rare' : 'magic');
          const item = rollItem(Math.max(1, (e.ilvl || lvl)), r, { preferLegendary: r === 'unique' });
          if (item) { const a = rand() * PI2, rd = 0.4 + rand() * 0.6; game.items.push({ x: e.x + Math.cos(a) * rd, y: e.y + Math.sin(a) * rd, item, age: 0 }); }
        }
        burst(e.x, e.y, '#ffd24a', 30);
        game.world.ambush = null;
      }
    }
    // Bestiary: record the kill (first kill "discovers" the entry)
    if (game.save) {
      if (!game.save.bestiary) game.save.bestiary = {};
      game.save.bestiary[e.id] = (game.save.bestiary[e.id] || 0) + 1;
    }
    // Greater Rift: count progress toward opening the descend portal
    if (game.rift && game.rift.active && game.world && game.world.isRift) {
      game.rift.kills++;
      riftCheckProgress();
    }
    // Voidling split: spawns 2 smaller copies on death (only if not already a split)
    if (e.trait === 'split' && !e._isSplit && game.enemies.length < 24) {
      for (let i = 0; i < 2; i++) {
        const ang = rand() * PI2;
        const cx = e.x + Math.cos(ang) * 0.8, cy = e.y + Math.sin(ang) * 0.8;
        const cgx = Math.floor(cx), cgy = Math.floor(cy);
        // Only spawn on valid floor
        if (cgx < 0 || cgx >= game.world.w || cgy < 0 || cgy >= game.world.h || game.world.grid[cgy][cgx] !== 0) continue;
        const child = makeEnemy('voidling', cx, cy, Math.max(1, e.ilvl - 1));
        child.hp = Math.floor(child.hp * 0.4);
        child.hpMax = child.hp;
        child.dmg = Math.floor(child.dmg * 0.5);
        child.xp = Math.floor(child.xp * 0.3);
        child._isSplit = true; // prevent infinite splitting
        game.enemies.push(child);
        burst(child.x, child.y, '#b388ff', 6);
      }
    }
    // Store corpse position for Corpse Explosion skill (max 12 positions)
    if (!game.corpsePositions) game.corpsePositions = [];
    game.corpsePositions.push({ x: e.x, y: e.y });
    if (game.corpsePositions.length > 12) game.corpsePositions.shift();

    // Apply passive multipliers to XP and gold
    const passives = game.char.passives || {};
    const diff = curDifficulty();   // difficulty boosts gold + drop item level
    const dropIlvlBonus = diff.ilvlBonus || 0;
    let xp = e.xp;
    let gold = Math.floor(irand(e.goldRange[0], e.goldRange[1]) * (e.boss ? 3 : 1) * (diff.lootMul || 1));
    if (passives.scholar) xp = Math.floor(xp * 1.3);
    if (passives.greedy)  gold = Math.floor(gold * 1.3);
    // Midas Touch upgrade — +15% gold per level
    const gf = upgradeLevel('goldfind');
    if (gf > 0) gold = Math.floor(gold * (1 + 0.15 * gf));
    gainXp(xp);
    game.char.gold += gold;
    floatText(`+${gold}g`, e.x + 0.3, e.y - 0.2, 'loot');

    // On-kill passive effects
    if (passives.bloodletter && game.char.hp < game.char.hpMax) {
      game.char.hp = Math.min(game.char.hpMax, game.char.hp + 3);
    }
    if (passives.mana_reaver && game.char.mp < game.char.mpMax) {
      game.char.mp = Math.min(game.char.mpMax, game.char.mp + 4);
    }

    // Skill Tome drops — unlock currency for passive tree (more from bosses/elites)
    const tomeChance = e.boss ? 0.6 : (e.elite ? 0.25 : 0.04);
    if (roll(tomeChance)) {
      game.char.tomes = (game.char.tomes || 0) + 1;
      floatText('+1 Skill Tome', e.x, e.y - 0.9, 'crit');
    }

    // Gem drops (5% normal, 25% elite, 100% boss — random gem type)
    const gemChance = e.boss ? 1.0 : (e.elite ? 0.25 : 0.05);
    if (roll(gemChance)) {
      const gemId = pick(Object.keys(GEMS));
      const gemItem = makeGemItem(gemId);
      if (gemItem) {
        game.items.push({ x: e.x + (rand() - 0.5) * 0.4, y: e.y + 0.2, item: gemItem, age: 0 });
        setTimeout(() => floatText(`${GEMS[gemId].name} gem`, e.x, e.y - 0.6, 'loot'), 200);
      }
    }

    // Glass Tear drops — reroll material. Rare from everything; common from bosses.
    const tearChance = e.boss ? 1.0 : (e.elite ? 0.12 : 0.015);
    if (roll(tearChance)) {
      game.char.glassTears = (game.char.glassTears || 0) + 1;
      floatText('+1 Glass Tear', e.x, e.y - 1.1, 'crit');
    }

    // Elite enemies always drop a rare item + bonus burst
    if (e.elite && !e.boss) {
      const item = rollItem(Math.max(1, e.ilvl + 1 + dropIlvlBonus), 'rare');
      if (item) {
        game.items.push({ x: e.x, y: e.y, item, age: 0 });
        setTimeout(() => floatText(item.name, e.x, e.y - 0.7, 'loot'), 250);
      }
      // Elite-color particle burst
      for (let i = 0; i < 14; i++) {
        const a = rand() * PI2;
        const sp = 1 + rand() * 2;
        addParticle({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          color: e.eliteColor || '#ffd166', life: 0.6 + rand() * 0.3, age: 0, size: 3 });
      }
    }

    // Item drops — bosses get treasure hoard, normal enemies have a chance
    if (e.boss) {
      // Boss treasure hoard: 2-3 items spread around the kill point
      const bossDropCount = 2 + (roll(0.5) ? 1 : 0);
      // The guaranteed legendary slot has a chance to ascend to mythic
      const rarities = ['rare', 'rare', roll(0.12) ? 'mythic' : 'unique'];
      for (let di = 0; di < bossDropCount; di++) {
        const r = rarities[di] || 'rare';
        const item = rollItem(Math.max(1, e.ilvl + 1 + dropIlvlBonus), r, { preferLegendary: r === 'unique' || r === 'mythic' });
        if (item) {
          const ox = (di - 1) * 0.6; // spread items left/center/right
          game.items.push({ x: e.x + ox, y: e.y + 0.3, item, age: 0 });
          // staggered floating text for each drop
          setTimeout(() => {
            const rarCol = r === 'unique' ? '#ffaa00' : '#c77dff';
            floatText(item.name, e.x + ox, e.y - 0.5 - di * 0.4, 'loot');
          }, 300 + di * 400);
        }
      }
      // Boss kill announcement
      floatText('BOSS SLAIN!', e.x, e.y - 1.2, 'crit');
      // treasure burst particles
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 2;
        addParticle({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          color: pick(['#ffc857', '#ffaa00', '#c77dff', '#6df1ff']), life: 0.8 + Math.random() * 0.5, age: 0, size: 3 });
      }
    } else if (roll(0.09)) {
      // Normal-enemy drop — rarer overall, and most common (white) junk is discarded
      // so the inventory stays clean. Magic-and-better always drop.
      const item = rollItem(Math.max(1, e.ilvl + dropIlvlBonus), null);
      if (item && (item.rarity !== 'common' || roll(0.2))) {
        game.items.push({ x: e.x, y: e.y, item, age: 0 });
      }
    }

    // Nightmare dungeon bonuses: extra high-tier drop + a chance for elites to drop a Sigil
    if (game.world && game.world.nightmare && !e._isSplit) {
      if (roll(0.35)) {
        const it = rollItem(Math.max(1, (e.ilvl || 1)), roll(0.3) ? 'rare' : 'magic');
        if (it) game.items.push({ x: e.x + (rand() - 0.5) * 0.6, y: e.y + 0.3, item: it, age: 0 });
      }
      if (e.elite && roll(0.3)) { game.char.sigils = (game.char.sigils || 0) + 1; floatText('+ Sigil', e.x, e.y - 0.8, 'loot'); }
    }

    // Quest progress
    if (game.save.quest && game.save.quest.target === e.id) {
      game.save.quest.progress = Math.min(game.save.quest.required, game.save.quest.progress + 1);
    }

    // Boss flag
    if (e.boss) {
      game.bossKilled = true;
      // bosses drop Nightmare Sigils (key for the Nightmare dungeons)
      if (roll(0.6)) { game.char.sigils = (game.char.sigils || 0) + 1; showHudToast('+1 Nightmare Sigil'); floatText('+ Sigil', e.x, e.y - 0.8, 'loot'); }
      // THE HOLLOW KING — campaign victory
      if (e.id === 'hollowking') {
        game.bossAlive = false;
        game.save.gameWon = true;
        game.char.gold += 2500;
        for (let i = 0; i < 4; i++) {           // grand finale loot: 1 mythic + 3 legendaries
          const it = rollItem(Math.max(1, e.ilvl + 2), i === 0 ? 'mythic' : 'unique', { preferLegendary: true });
          if (it) game.items.push({ x: e.x + (i - 1.5) * 0.6, y: e.y + 0.3, item: it, age: 0 });
        }
        saveGame(); sfx('legendary');
        if (window.__AUDIO) window.__AUDIO.stopMusic();
        setTimeout(() => { if (game.char && game.char.hp > 0) navigateTo('victory'); }, 1300);
        return;   // skip the normal biome-unlock / portal handling
      }
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
      // Unlock the next difficulty tier on a boss kill
      const curIdx = DIFFICULTY_ORDER.indexOf(game.save.difficulty || 'normal');
      const maxIdx = DIFFICULTY_ORDER.indexOf(game.save.maxDifficulty || 'normal');
      if (curIdx >= maxIdx && curIdx + 1 < DIFFICULTY_ORDER.length) {
        game.save.maxDifficulty = DIFFICULTY_ORDER[curIdx + 1];
        showHudToast(`${DIFFICULTIES[game.save.maxDifficulty].name.toUpperCase()} DIFFICULTY UNLOCKED!`);
      }
    }

    // remove from list
    const i = game.enemies.indexOf(e);
    if (i >= 0) game.enemies.splice(i, 1);

    saveGame();
  }

  // ============================================================
  // PROJECTILES
  // ============================================================
  function spawnProjectile(x, y, dx, dy, speed, dmg, color, kind, friendly, srcCurse) {
    // Bake the active skill-rune damage multiplier into friendly projectiles at
    // spawn time (they resolve later, when the multiplier has reset to 1).
    const finalDmg = friendly ? Math.floor(dmg * (game._skillDmgMul || 1)) : dmg;
    game.projectiles.push({
      x, y, dx, dy, speed, dmg: finalDmg, color, kind, friendly,
      curse: srcCurse || null,   // curse an enemy projectile applies to the player on hit
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
        if (p.piercing) {
          // Piercing projectile — hits each enemy once, doesn't stop
          // Use snapshot to avoid issues with array modification during iteration
          const snapshot = game.enemies.slice();
          for (const e of snapshot) {
            if (e.hp <= 0) continue;
            if (p.hitList.has(e)) continue;
            if (dist(e, p) < 0.45) {
              p.hitList.add(e);
              hitEnemy(e, p.dmg, derived(game.char).crit);
              burst(p.x, p.y, p.color, 6);
              // Trail particles behind piercing shot
              addParticle({
                x: p.x, y: p.y, vx: -p.dx * 2, vy: -p.dy * 2,
                color: '#ffffff', life: 0.2, age: 0, size: 2,
              });
            }
          }
        } else {
          // Find first hit — don't iterate with for-of since hitEnemy can splice
          let hitTarget = null;
          for (let ei = 0; ei < game.enemies.length; ei++) {
            if (dist(game.enemies[ei], p) < 0.45) { hitTarget = game.enemies[ei]; break; }
          }
          if (hitTarget) {
            hitEnemy(hitTarget, p.dmg, derived(game.char).crit);
            game.projectiles.splice(i, 1);
            burst(p.x, p.y, p.color, 8);
            removed = true;
          }
        }
        if (removed) continue;
      } else {
        const pl = game.world.player;
        if (dist(pl, p) < 0.45) {
          damagePlayer(p.dmg);
          if (p.curse && game.char.hp > 0) applyCurse(p.curse);  // cursing elite's projectile
          game.projectiles.splice(i, 1);
          burst(p.x, p.y, p.color, 8);
          continue;
        }
      }
      if (p.age > p.life) game.projectiles.splice(i, 1);
    }
  }

  // ============================================================
  // BOSS MECHANICS — telegraphed AoE, enrage timer, add-summon phases
  // ============================================================
  const BOSS_ENRAGE_TIME = 75;   // seconds before a boss enrages
  // Spawn a dodgeable ground-marker AoE. After `windup` seconds it detonates,
  // damaging the player only if they're still inside the radius.
  function spawnTelegraph(x, y, radius, windup, dmg, color) {
    if (!game.telegraphs) game.telegraphs = [];
    game.telegraphs.push({ x, y, radius, windup, age: 0, dmg, color: color || '#ff4d6d' });
  }
  function tickTelegraphs(dt) {
    if (!game.telegraphs || !game.telegraphs.length) return;
    const p = game.world && game.world.player;
    for (let i = game.telegraphs.length - 1; i >= 0; i--) {
      const tg = game.telegraphs[i];
      tg.age += dt;
      if (tg.age >= tg.windup) {
        // Detonate
        if (p) {
          const dx = p.x - tg.x, dy = p.y - tg.y;
          if (dx * dx + dy * dy <= tg.radius * tg.radius) {
            damagePlayer(tg.dmg);
          }
        }
        burst(tg.x, tg.y, tg.color, 22);
        game.screenShake = Math.max(game.screenShake, 0.28);
        game.telegraphs.splice(i, 1);
      }
    }
  }
  // Per-boss special behaviors layered on top of its trait. Returns nothing;
  // mutates the boss + world. Called each tick for boss enemies.
  function tickBoss(e, dt, d, p) {
    // --- Enrage timer ---
    e.fightTime = (e.fightTime || 0) + dt;
    if (!e.enraged && e.fightTime >= BOSS_ENRAGE_TIME) {
      e.enraged = true;
      e.dmg = Math.floor(e.dmg * 1.6);
      e.speed *= 1.25;
      showHudToast(`${e.name} ENRAGES!`);
      floatText('ENRAGED', e.x, e.y - 1.2, 'crit');
      burst(e.x, e.y, '#ff2b3c', 30);
    }
    // --- Add-summon phases at 66% and 33% HP ---
    const frac = e.hp / e.hpMax;
    if (e.addsPhase === undefined) e.addsPhase = 0;
    if ((frac <= 0.66 && e.addsPhase < 1) || (frac <= 0.33 && e.addsPhase < 2)) {
      e.addsPhase = frac <= 0.33 ? 2 : 1;
      summonBossAdds(e);
    }
    // --- Telegraphed ground smash: periodic, dodgeable AoE aimed at the player ---
    if (d < 9) {
      e.smashCd = (e.smashCd || (3 + rand() * 2)) - dt;
      if (e.smashCd <= 0) {
        e.smashCd = (e.enraged ? 4 : 6) + rand() * 2;
        // mark the player's CURRENT spot — they must move out of it
        spawnTelegraph(p.x, p.y, 2.2, 1.0, Math.floor(e.dmg * 1.6), e.eliteColor || e.projColor || '#ff4d6d');
      }
    }
  }
  function summonBossAdds(e) {
    const biome = BIOMES.find(b => b.id === game.world.biomeId);
    const pool = (biome && biome.enemies) || ['skeleton'];
    const count = 2 + (roll(0.5) ? 1 : 0);
    let spawned = 0;
    // Higher cap than trash spawns — boss reinforcements are a key fight beat
    for (let i = 0; i < count && game.enemies.length < 42; i++) {
      const ang = rand() * PI2;
      const sx = e.x + Math.cos(ang) * 2, sy = e.y + Math.sin(ang) * 2;
      const gx = Math.floor(sx), gy = Math.floor(sy);
      if (gx <= 0 || gx >= game.world.w || gy <= 0 || gy >= game.world.h || game.world.grid[gy][gx] !== 0) continue;
      game.enemies.push(makeEnemy(pick(pool), sx, sy, e.ilvl));
      burst(sx, sy, e.color, 10);
      spawned++;
    }
    if (spawned) { showHudToast(`${e.name} summons reinforcements!`); }
  }

  // ============================================================
  // ENEMY AI
  // ============================================================
  function tickEnemies(dt) {
    if (!game.world || game.world.kind !== 'dungeon') return;
    const p = game.world.player;
    // Iterate backwards by index so mid-loop killEnemy() splices don't skip the next enemy.
    for (let _i = game.enemies.length - 1; _i >= 0; _i--) {
      const e = game.enemies[_i];
      if (!e) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.frozen = Math.max(0, e.frozen - dt);
      e.stagger = Math.max(0, e.stagger - dt);
      e.atkCd = Math.max(0, e.atkCd - dt);
      e.traitCd = Math.max(0, e.traitCd - dt);
      e.lunging = Math.max(0, e.lunging - dt);
      e.charging = Math.max(0, e.charging - dt);
      e.phased = Math.max(0, e.phased - dt);

      // Elite passive affix effects (visual + lifesteal)
      if (e.elite && e.eliteAffix) {
        if (e.eliteAffix === 'burning' && rand() < 0.25) {
          addParticle({ x: e.x + (rand() - 0.5) * 0.6, y: e.y - 0.2, vx: 0, vy: -1.5 - rand(),
            color: rand() < 0.5 ? '#ff6644' : '#ffaa00', life: 0.5 + rand() * 0.3, age: 0, size: 2 });
        } else if (e.eliteAffix === 'frozen' && rand() < 0.2) {
          addParticle({ x: e.x + (rand() - 0.5) * 0.6, y: e.y - 0.2, vx: (rand() - 0.5) * 1.5, vy: -0.5 - rand(),
            color: '#6df1ff', life: 0.5 + rand() * 0.3, age: 0, size: 2 });
        } else if (e.eliteAffix === 'vampiric') {
          // Slowly regenerate
          e.hp = Math.min(e.hpMax, e.hp + dt * 1.5);
        }
      }

      // Tick status effects (burn DoT, poison DoT-stacks)
      if (e.statusEffects) {
        const s = e.statusEffects;
        if (s.burn) {
          s.burn.dt -= dt;
          s.burn.tick = (s.burn.tick || 0) + dt;
          if (s.burn.tick >= 0.5) {
            s.burn.tick = 0;
            const dmg = Math.max(1, Math.floor(s.burn.dmg * 0.5));
            e.hp -= dmg;
            floatText(`${dmg}`, e.x + (rand() - 0.5) * 0.3, e.y - 0.5, 'crit');
            // small flame particle
            addParticle({ x: e.x + (rand() - 0.5) * 0.3, y: e.y - 0.2, vx: 0, vy: -1.5,
              color: rand() < 0.5 ? '#ff6644' : '#ffaa00', life: 0.4, age: 0, size: 2 });
            if (e.hp <= 0) { killEnemy(e); continue; }
          }
          if (s.burn.dt <= 0) s.burn = null;
        }
        if (s.poison) {
          s.poison.dt -= dt;
          s.poison.tick = (s.poison.tick || 0) + dt;
          if (s.poison.tick >= 0.5) {
            s.poison.tick = 0;
            const dmg = Math.max(1, Math.floor(s.poison.dmg * 0.5 * s.poison.stacks));
            e.hp -= dmg;
            floatText(`${dmg}`, e.x + (rand() - 0.5) * 0.3, e.y - 0.5, 'crit');
            addParticle({ x: e.x + (rand() - 0.5) * 0.3, y: e.y - 0.2, vx: 0, vy: -1.0,
              color: '#51e6a4', life: 0.5, age: 0, size: 2 });
            if (e.hp <= 0) { killEnemy(e); continue; }
          }
          if (s.poison.dt <= 0) s.poison = null;
        }
      }

      if (e.frozen > 0) continue;
      if (e.stagger > 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Treasure Goblin: only ever flees + escapes — never runs the normal chase/attack AI
      if (e.isGoblin) { tickGoblin(e, dt, dx, dy, d, _i); continue; }
      // Boss mechanics (enrage / summon / telegraphed smash) run before awareness cull
      if (e.boss) tickBoss(e, dt, d, p);
      if (d > 12) continue; // out of awareness

      // --- Trait-based special behaviors (fired before basic AI) ---
      if (e.trait && e.traitCd <= 0) {
        switch (e.trait) {
          case 'lunge': // Ghoul: lunges forward dealing bonus damage
            if (d < 4 && d > 1.5) {
              e.lunging = 0.3;
              const lx = dx / d * 2.5, ly = dy / d * 2.5;
              tryMove(e, lx, ly);
              if (dist(e, p) < 1.2) { enemyHitPlayer(e, Math.floor(e.dmg * 1.4)); burst(p.x, p.y, e.color, 10); }
              e.traitCd = 3.5 + rand();
              e.atkCd = 1.0;
              continue;
            }
            break;
          case 'phase': // Wraith: teleports near player periodically
            if (d > 3) {
              const ang = rand() * PI2;
              const nx = p.x + Math.cos(ang) * 2.5, ny = p.y + Math.sin(ang) * 2.5;
              const gx = Math.floor(nx), gy = Math.floor(ny);
              if (gx > 0 && gx < game.world.w && gy > 0 && gy < game.world.h && game.world.grid[gy][gx] === 0) {
                burst(e.x, e.y, e.color, 8);
                e.x = nx; e.y = ny;
                e.phased = 0.3;
                burst(e.x, e.y, e.color, 8);
              }
              e.traitCd = 4.0 + rand() * 2;
            }
            break;
          case 'summon': // Lich boss: spawns a skeleton minion
            if (game.enemies.length < 20) {
              const ang = rand() * PI2;
              const sx = e.x + Math.cos(ang) * 2, sy = e.y + Math.sin(ang) * 2;
              const sgx = Math.floor(sx), sgy = Math.floor(sy);
              // Only spawn on valid floor tiles
              if (sgx > 0 && sgx < game.world.w && sgy > 0 && sgy < game.world.h && game.world.grid[sgy][sgx] === 0) {
                game.enemies.push(makeEnemy('skeleton', sx, sy, e.ilvl));
                burst(sx, sy, '#cfcfcf', 10);
              }
              e.traitCd = 6.0 + rand() * 3;
            }
            break;
          case 'swarm': // Spider: bursts of speed when close
            if (d < 5 && d > 1.5) {
              const speed = e.speed * dt * 2.5;
              tryMove(e, dx / d * speed, dy / d * speed);
              e.traitCd = 2.0;
            }
            break;
          case 'thorns': // Thornling: damages player on being hit (handled in hitEnemy), also roots briefly
            break; // passive — see hitEnemy
          case 'erratic': // Wisp: jitters randomly between shots, hard to predict
            {
              const jx = (rand() - 0.5) * e.speed * dt * 3;
              const jy = (rand() - 0.5) * e.speed * dt * 3;
              tryMove(e, jx, jy);
              e.traitCd = 0.3;
            }
            break;
          case 'heal': // Old Druid boss: heals self periodically
            if (e.hp < e.hpMax * 0.8) {
              const healAmt = Math.floor(e.hpMax * 0.06);
              e.hp = Math.min(e.hpMax, e.hp + healAmt);
              burst(e.x, e.y, '#51e6a4', 12);
              floatText(`+${healAmt}`, e.x, e.y - 0.5, 'heal');
              e.traitCd = 5.0 + rand() * 2;
            }
            break;
          case 'pack': // Frostwolf: speeds up when other wolves are nearby
            {
              let packCount = 0;
              for (let pi = 0, pl = game.enemies.length; pi < pl; pi++) {
                const ally = game.enemies[pi];
                if (ally !== e && ally.id === 'wolf') {
                  const pdx = ally.x - e.x, pdy = ally.y - e.y;
                  if (pdx * pdx + pdy * pdy < 16) packCount++;
                }
              }
              if (packCount > 0) e.speed = ENEMIES.wolf.speed * (1 + packCount * 0.2);
              else e.speed = ENEMIES.wolf.speed;
              e.traitCd = 2.0; // check less frequently
            }
            break;
          case 'slam': // Frost Giant: ground slam AoE when in range
            if (d < 2.0) {
              enemyHitPlayer(e, Math.floor(e.dmg * 1.5));
              burst(e.x, e.y, '#ffffff', 14);
              game.screenShake = 0.2;
              // stun nearby other enemies too (collateral)
              e.traitCd = 5.0 + rand() * 2;
              e.atkCd = 2.0;
              continue;
            }
            break;
          case 'flyby': // Ice Bat: swoops past, damages, then retreats
            if (d < 3 && d > 1.0) {
              // swoop toward player
              const speed = e.speed * dt * 3;
              tryMove(e, dx / d * speed, dy / d * speed);
              if (dist(e, p) < 1.1) {
                enemyHitPlayer(e, e.dmg);
                burst(p.x, p.y, e.color, 6);
                // bounce away
                tryMove(e, -dx / d * 2, -dy / d * 2);
                e.traitCd = 2.5 + rand();
                e.atkCd = 1.5;
                continue;
              }
            }
            break;
          case 'breath': // Ice Wyrm boss: fires 3 projectiles in a spread
            if (d < e.range && d > 2) {
              for (let i = -1; i <= 1; i++) {
                const ang = Math.atan2(dy, dx) + i * 0.3;
                spawnProjectile(e.x, e.y, Math.cos(ang), Math.sin(ang), 5.5, e.dmg, e.projColor, 'soul', false);
              }
              e.traitCd = 3.5 + rand();
              e.atkCd = 2.5;
            }
            break;
          case 'blink': // Imp: teleports to a random spot after attacking
            if (e.atkCd <= 0.1 && d < e.range) {
              // attack then blink away
              spawnProjectile(e.x, e.y, dx / d, dy / d, 7, e.dmg, e.projColor, 'soul', false);
              const ang = rand() * PI2;
              const bx = e.x + Math.cos(ang) * 3, by = e.y + Math.sin(ang) * 3;
              const gx = Math.floor(bx), gy = Math.floor(by);
              if (gx > 0 && gx < game.world.w && gy > 0 && gy < game.world.h && game.world.grid[gy][gx] === 0) {
                burst(e.x, e.y, e.projColor, 6);
                e.x = bx; e.y = by;
                burst(e.x, e.y, e.projColor, 6);
              }
              e.traitCd = 3.0 + rand();
              e.atkCd = 2.0;
              continue;
            }
            break;
          case 'charge': // Hellhound: charges in a straight line at high speed
            if (d < 6 && d > 2) {
              e.charging = 0.4;
              const speed = e.speed * dt * 4;
              tryMove(e, dx / d * speed, dy / d * speed);
              if (dist(e, p) < 1.2) {
                enemyHitPlayer(e, Math.floor(e.dmg * 1.3));
                burst(p.x, p.y, e.color, 10);
                e.atkCd = 1.5;
              }
              e.traitCd = 4.0 + rand();
              continue;
            }
            break;
          case 'cleave': // Demon: hits in an arc, damages even if slightly off
            if (d < 1.8) {
              enemyHitPlayer(e, Math.floor(e.dmg * 1.2));
              burst(p.x, p.y, e.color, 10);
              // screen shake for impact
              game.screenShake = Math.max(game.screenShake, 0.15);
              e.traitCd = 2.5;
              e.atkCd = 1.8;
              continue;
            }
            break;
          case 'multiatk': // Archdemon boss: fires 5 projectiles in a fan
            if (d < e.range && d > 2) {
              for (let i = -2; i <= 2; i++) {
                const ang = Math.atan2(dy, dx) + i * 0.2;
                spawnProjectile(e.x, e.y, Math.cos(ang), Math.sin(ang), 6, Math.floor(e.dmg * 0.7), e.projColor, 'soul', false);
              }
              e.traitCd = 4.0 + rand() * 2;
              e.atkCd = 2.5;
            }
            break;
          case 'split': // Voidling: on death splits into 2 smaller voidlings (handled in killEnemy)
            break; // passive — see killEnemy
          case 'silence': // Nullweaver: periodically disables player skills briefly
            if (d < e.range) {
              const wp = game.world.player;
              wp.silenced = 2.5;
              burst(p.x, p.y, '#00e5ff', 10);
              floatText('SILENCED', p.x, p.y - 0.6, 'crit');
              e.traitCd = 8.0 + rand() * 3;
            }
            break;
          case 'reflect': // Crystal Sentinel: reflects a portion of damage back (handled in hitEnemy)
            break; // passive — see hitEnemy
          case 'voidpulse': // Void Lord boss: AoE pulse that damages in radius
            if (d < 5) {
              damagePlayer(Math.floor(e.dmg * 0.6));
              burst(e.x, e.y, '#b388ff', 20);
              game.screenShake = 0.25;
              // emit ring particles
              for (let i = 0; i < 12; i++) {
                const ang = i * PI2 / 12;
                addParticle({
                  x: e.x + Math.cos(ang) * 3, y: e.y + Math.sin(ang) * 3,
                  vx: Math.cos(ang) * 2, vy: Math.sin(ang) * 2,
                  color: '#b388ff', life: 0.8, age: 0, size: 2,
                });
              }
              e.traitCd = 5.0 + rand() * 2;
            }
            break;
        }
      }

      // --- Base AI: movement + basic attacks ---
      if (e.attackKind === 'melee') {
        if (d > e.range * 0.9) {
          let speedMul = 1;
          if (e.charging > 0) speedMul = 3;
          const speed = e.speed * dt * speedMul;
          tryMove(e, dx / d * speed, dy / d * speed);
        } else if (e.atkCd <= 0) {
          enemyHitPlayer(e, e.dmg);
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
          spawnProjectile(e.x, e.y, dx / d, dy / d, 6.5, e.dmg, e.projColor || '#c489ff', 'soul', false, enemyCurse(e));
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
  // ---- Hireling companion: a permanent recruited ally that fights beside you ----
  const HIRELING_TYPES = {
    sellsword: { name: 'Sellsword', desc: 'A steel-clad mercenary. Tanky melee bruiser.', color: '#cdd6e6', weapon: 'sword', hp: 130, dmg: 14, speed: 3.2, range: 1.2, ranged: false, cost: 500 },
    marksman:  { name: 'Marksman',  desc: 'A keen-eyed hunter. Rapid ranged fire.',       color: '#7dffb0', weapon: 'bow',   hp: 80,  dmg: 11, speed: 3.5, range: 6.5, ranged: true, projColor: '#caa15a', cost: 650 },
    sorceress: { name: 'Sorceress', desc: 'An arcane adept. Heavy ranged spells.',        color: '#c489ff', weapon: 'staff', hp: 75,  dmg: 18, speed: 3.0, range: 5.2, ranged: true, projColor: '#c489ff', cost: 800 },
  };
  function hirelingUpgradeCost(level) { return 300 + (level - 1) * 250; }
  function spawnHireling() {
    const h = game.char && game.char.hireling;
    if (!h || !HIRELING_TYPES[h.type] || !game.world || game.world.kind !== 'dungeon') return;
    const t = HIRELING_TYPES[h.type];
    const p = game.world.player;
    const mul = 1 + (h.level - 1) * 0.25 + ((game.char.level || 1) - 1) * 0.08;
    game.minions.push({
      x: p.x - 0.8, y: p.y + 0.6, hp: Math.floor(t.hp * mul), hpMax: Math.floor(t.hp * mul),
      dmg: Math.floor(t.dmg * mul), speed: t.speed, range: t.range, atkCd: 0, target: null,
      ttl: Infinity, _hireling: true, htype: h.type, color: t.color, ranged: t.ranged,
      projColor: t.projColor, lastDir: { x: 0, y: 1 },
    });
  }
  function tickHireling(m, dt) {
    const p = game.world.player;
    let near = null, nd = Infinity;
    for (const e of game.enemies) {
      if (dist(e, p) > 10) continue;            // leash engagement to near the player
      const d = dist(e, m); if (d < nd) { nd = d; near = e; }
    }
    if (!near) {                                 // no foe in range — keep pace with the player
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
      if (d > 2.2) { tryMove(m, dx / d * m.speed * dt, dy / d * m.speed * dt); m.lastDir = { x: dx, y: dy }; }
      return;
    }
    const dx = near.x - m.x, dy = near.y - m.y, d = Math.hypot(dx, dy);
    m.lastDir = { x: dx, y: dy };
    if (d > m.range * 0.9) {
      tryMove(m, dx / d * m.speed * dt, dy / d * m.speed * dt);
    } else if (m.atkCd <= 0) {
      if (m.ranged) {
        const a = Math.atan2(dy, dx);
        spawnProjectile(m.x, m.y, Math.cos(a), Math.sin(a), 9, m.dmg, m.projColor || '#fff', m.htype === 'marksman' ? 'arrow' : 'bolt', true);
        m.atkCd = 1.1;
      } else {
        hitEnemy(near, m.dmg, 8); m.atkCd = 0.9;
      }
    }
  }

  function tickMinions(dt) {
    for (let i = game.minions.length - 1; i >= 0; i--) {
      const m = game.minions[i];
      m.atkCd = Math.max(0, m.atkCd - dt);
      if (m._hireling) { tickHireling(m, dt); continue; }   // permanent ally — no ttl, follows player
      m.ttl -= dt;
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
    // Shrine of Warding: total invulnerability
    if (game.activeBuffs && game.activeBuffs.invuln > 0) {
      floatText('WARDED', game.world.player.x, game.world.player.y - 0.4, 'heal');
      return;
    }
    const d = derived(game.char);
    let dmg = Math.max(1, Math.floor(rawDmg - d.def * 0.5));
    // Shield Wall: 70% damage reduction
    const p = game.world.player;
    if (p.shieldWall && p.shieldWall > 0) {
      dmg = Math.max(1, Math.floor(dmg * 0.3));
    }
    game.char.hp -= dmg;
    sfxT('hurt', 120);
    floatText(`-${dmg}`, game.world.player.x + (rand() - 0.5) * 0.3, game.world.player.y - 0.4, 'crit');
    game.screenShake = Math.max(game.screenShake, 0.1);
    game.damageFlash = 0.15; // red flash timer
    burst(game.world.player.x, game.world.player.y, '#ff4d6d', 6);
    updateHud();
    // Auto-potion: try to heal before checking death so it can save the player.
    if (game.char.hp > 0) checkAutoPotion();
    if (game.char.hp <= 0) onDeath();
  }
  function onDeath() {
    game.char.hp = 0;
    sfx('boss');                 // a grim low knell on death
    if (window.__AUDIO) window.__AUDIO.stopMusic();
    if (game.char.hardcore) {
      // permadeath — the hero is gone forever; enshrine them and wipe the save
      recordHonor(game.char);
      game._permadeath = true;
      try { localStorage.removeItem(CFG.storageKey); localStorage.removeItem('glasspire_save_v2'); } catch (e) {}
      game.save = null;
    } else {
      game._permadeath = false;
      saveGame();
    }
    navigateTo('death');
  }

  // ============================================================
  // FLOATING TEXT / PARTICLES
  // ============================================================
  function floatText(text, wx, wy, kind) {
    game.floatingTexts.push({ text, wx, wy, kind: kind || 'dmg', age: 0, life: 0.9 });
  }
  const MAX_PARTICLES = 100;
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
      if (t.age >= t.life) {
        game.floatingTexts[i] = game.floatingTexts[game.floatingTexts.length - 1];
        game.floatingTexts.pop();
      }
    }
    // particles (swap-and-pop for O(1) removal)
    const parts = game.particles;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      if (p.age >= p.life) {
        parts[i] = parts[parts.length - 1];
        parts.pop();
      }
    }
    game.screenShake = Math.max(0, game.screenShake - dt);
    game.damageFlash = Math.max(0, game.damageFlash - dt);
  }

  // ============================================================
  // MOVEMENT — step impulse ensures each tap moves a meaningful distance
  // ============================================================
  function tickPlayer(dt) {
    const p = game.world.player;

    // Guard: for 200ms after returning from a menu/overlay, force-clear ALL movement
    // state. This catches any stale EMG gestures or key events from menu navigation.
    if (game._menuReturnGuardUntil && performance.now() < game._menuReturnGuardUntil) {
      game.keys = {};
      game.tapped = {};
      p._impulseT = 0;
      p._impulseX = 0;
      p._impulseY = 0;
      return; // skip this tick — require a fresh input after guard expires
    }
    game._menuReturnGuardUntil = 0; // clear expired guard

    let vx = 0, vy = 0;

    // Track active input — check BOTH held keys AND tap queue
    // The tap queue catches sub-frame taps (keydown+keyup between frames)
    if (game.keys.up    || game.tapped.up)    vy -= 1;
    if (game.keys.down  || game.tapped.down)  vy += 1;
    if (game.keys.left  || game.tapped.left)  vx -= 1;
    if (game.keys.right || game.tapped.right) vx += 1;

    // Clear tap queue now that we've read it
    game.tapped = {};

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
        const slowMul = (p.curses && p.curses.slow > 0) ? 0.5 : 1;  // Crippling curse
        const sp = CFG.playerSpeed * dt * slowMul;
        tryMove(p, mx * sp, my * sp);
      }
      // Only consume impulse when keys are released AND no tap queued
      if (vx === 0 && vy === 0) {
        p._impulseT -= dt;
      }
    }

    p.skillCd = Math.max(0, p.skillCd - dt);
    if (p.dashCd !== undefined) p.dashCd = Math.max(0, p.dashCd - dt);
    p.attackingFor = Math.max(0, p.attackingFor - dt);

    // passive mana regen (2× while Shrine of Arcana is active)
    if (game.char.mp < game.char.mpMax) {
      const manaMul = (game.activeBuffs && game.activeBuffs.mana > 0) ? 2 : 1;
      game.char.mp = Math.min(game.char.mpMax, game.char.mp + dt * 2.2 * manaMul);
    }

    // Tick active shrine buffs (count down each one)
    if (game.activeBuffs) {
      for (const k in game.activeBuffs) {
        game.activeBuffs[k] -= dt;
        if (game.activeBuffs[k] <= 0) {
          delete game.activeBuffs[k];
          // Recompute stats when damage buff ends so damage drops back
          if (k === 'damage') applyDerivedToChar();
          showHudToast(`${k === 'damage' ? 'Fury' : k === 'mana' ? 'Arcana' : 'Warding'} shrine faded.`);
        }
      }
    }

    // War Cry buff countdown
    if (p.warcryBuff !== undefined && p.warcryBuff > 0) {
      p.warcryBuff -= dt;
      if (p.warcryBuff <= 0) { p.warcryBuff = 0; showHudToast('War Cry faded.'); }
    }
    // Shield Wall buff countdown
    if (p.shieldWall !== undefined && p.shieldWall > 0) {
      p.shieldWall -= dt;
      if (p.shieldWall <= 0) { p.shieldWall = 0; showHudToast('Shield Wall ended.'); }
    }
    // Silence debuff countdown (from Nullweaver)
    if (p.silenced !== undefined && p.silenced > 0) {
      p.silenced -= dt;
      if (p.silenced <= 0) p.silenced = 0;
    }
    // Curse debuff countdowns (Crippling slow, Enfeebling weaken)
    if (p.curses) {
      for (const k in p.curses) {
        if (p.curses[k] > 0) {
          p.curses[k] -= dt;
          if (p.curses[k] <= 0) {
            delete p.curses[k];
            if (k === 'weaken') applyDerivedToChar();  // restore damage
          }
        }
      }
    }
  }

  // ============================================================
  // SKILL EFFECT TICKS (meteors, poison zones, soul drains)
  // ============================================================
  function tickSkillEffects(dt) {
    const p = game.world ? game.world.player : null;
    if (!p) return;

    // --- Pending Meteors ---
    if (game.pendingMeteors) {
      for (let i = game.pendingMeteors.length - 1; i >= 0; i--) {
        const m = game.pendingMeteors[i];
        m.delay -= dt;
        // Warning particles while waiting
        if (m.delay > 0 && rand() < 0.4) {
          addParticle({
            x: m.x + (rand() - 0.5) * 1.5, y: m.y + (rand() - 0.5) * 1.5,
            vx: 0, vy: -2, color: '#ff7043', life: 0.3, age: 0, size: 1.5,
          });
        }
        if (m.delay <= 0) {
          // IMPACT
          const targets = game.enemies.filter(e => dist(e, m) <= m.radius);
          for (const e of targets) hitEnemy(e, m.dmg, m.crit);
          // Massive explosion
          burst(m.x, m.y, '#ff7043', 30);
          burst(m.x, m.y, '#ffc857', 20);
          burst(m.x, m.y, '#ffffff', 10);
          for (let j = 0; j < 16; j++) {
            const a = (j / 16) * PI2;
            addParticle({
              x: m.x, y: m.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
              color: j % 2 === 0 ? '#ff7043' : '#ffc857', life: 0.5 + rand() * 0.3, age: 0, size: 3 + rand() * 2,
            });
          }
          game.screenShake = Math.max(game.screenShake, 0.4);
          game.pendingMeteors.splice(i, 1);
        }
      }
    }

    // --- Poison Zones ---
    if (game.poisonZones) {
      for (let i = game.poisonZones.length - 1; i >= 0; i--) {
        const z = game.poisonZones[i];
        z.ttl -= dt;
        z.tickTimer += dt;
        // Ambient particles
        if (rand() < 0.3) {
          const a = rand() * PI2;
          const r = rand() * z.radius;
          addParticle({
            x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r,
            vx: 0, vy: -0.8 - rand(), color: '#9be57c', life: 0.4 + rand() * 0.3, age: 0, size: 1.5 + rand(),
          });
        }
        // Damage tick
        if (z.tickTimer >= z.tickInterval) {
          z.tickTimer = 0;
          const targets = game.enemies.filter(e => dist(e, z) <= z.radius);
          for (const e of targets) hitEnemy(e, z.dmg, z.crit);
        }
        if (z.ttl <= 0) game.poisonZones.splice(i, 1);
      }
    }

    // --- Soul Drain channels ---
    if (game.soulDrains) {
      for (let i = game.soulDrains.length - 1; i >= 0; i--) {
        const sd = game.soulDrains[i];
        sd.ttl -= dt;
        sd.tickTimer += dt;
        const target = sd.target;
        // Check if target is still alive and in range
        if (!target || target.hp <= 0 || dist(target, p) > 6.0 || sd.ttl <= 0) {
          game.soulDrains.splice(i, 1);
          continue;
        }
        // Visual beam particles
        if (rand() < 0.6) {
          const t = rand();
          addParticle({
            x: lerp(p.x, target.x, t), y: lerp(p.y, target.y, t),
            vx: (rand() - 0.5), vy: (rand() - 0.5),
            color: '#c489ff', life: 0.25, age: 0, size: 1.5,
          });
        }
        // Damage tick
        if (sd.tickTimer >= sd.tickInterval) {
          sd.tickTimer = 0;
          hitEnemy(target, sd.dmg, sd.crit);
          // Heal player for 50% of damage dealt
          const heal = Math.floor(sd.dmg * 0.5);
          game.char.hp = Math.min(game.char.hpMax, game.char.hp + heal);
          floatText(`+${heal}`, p.x, p.y - 0.4, 'heal');
        }
      }
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
    // Portal — larger radius for fast D-pad movement
    let pn = null, pd = 2.0;
    if (game.world.portals) {
      for (const po of game.world.portals) {
        const d = dist(po, p);
        if (d < pd) { pd = d; pn = po; }
      }
    }
    game.nearbyPortal = pn;
    // Shrine — large pinch radius for fast D-pad movement
    let sn = null, sdist = 1.8;
    if (game.world.shrines) {
      for (const sh of game.world.shrines) {
        if (sh.used) continue;
        const d = dist(sh, p);
        if (d < sdist) { sdist = d; sn = sh; }
      }
    }
    game.nearbyShrine = sn;
    // Item — auto-pickup if close (Lodestone upgrade widens the radius)
    const pickRadius = 0.6 + 0.6 * upgradeLevel('pickup');
    let it = null, idx = -1;
    for (let i = 0; i < game.items.length; i++) {
      const gi = game.items[i];
      if (dist(gi, p) < pickRadius) { it = gi; idx = i; break; }
    }
    if (it && game.char.inventory.length < 24) {
      game.items.splice(idx, 1);
      game.char.inventory.push(it.item);
      collectLook(it.item);   // unlock its appearance for the Wardrobe
      const rr = it.item && it.item.rarity;
      if (rr === 'unique' || rr === 'mythic') sfx('legendary');
      else sfx('loot', { pitch: rr === 'rare' ? 1.25 : rr === 'magic' ? 1.12 : 1 });
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
    // instant camera — no lag, player is always centered
    game.cam.x = tx;
    game.cam.y = ty;
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
      } else if (biomeId === 'voidspire') {
        a.color = rand() > 0.5 ? '#b388ff' : '#00e5ff';
        a.vy = (rand() - 0.5) * 0.4; a.vx = (rand() - 0.5) * 0.4;
        a.kind = 'void'; a.size = 1 + rand() * 2; a.alpha = 0.2 + rand() * 0.25;
        a.life = 2 + rand() * 3;
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
      if (p.kind === 'void') {
        p.vx = Math.sin(p.age * 1.5 + p.y) * 0.25;
        p.vy = Math.cos(p.age * 1.2 + p.x) * 0.25;
      }
      if (p.age >= p.life) {
        ambientParticles[i] = ambientParticles[ambientParticles.length - 1];
        ambientParticles.pop();
      }
    }
  }
  function drawAmbient() {
    for (const p of ambientParticles) {
      const s = w2s(p.x, p.y);
      if (s.x < -20 || s.x > 620 || s.y < -20 || s.y > 620) continue;
      const t = 1 - p.age / p.life;
      const fadeIn = Math.min(1, p.age * 4);
      const alpha = p.alpha * t * fadeIn;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'snow') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size * 0.5, 0, PI2);
        ctx.fill();
      } else if (p.kind === 'leaf') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 1.5);
        ctx.fillRect(-p.size * 0.5, -1, p.size, 2);
        ctx.restore();
      } else if (p.kind === 'void') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 0.8);
        const sz = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -sz); ctx.lineTo(sz, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, p.size * 0.5, 0, PI2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!ctx || !game.world) return;
    // Shared screen-shake so the 2D layer and the 3D camera move together during the migration.
    const shake = game.screenShake;
    game._shakeX = shake > 0 ? (rand() - 0.5) * shake * 16 : 0;
    game._shakeY = shake > 0 ? (rand() - 0.5) * shake * 16 : 0;
    const gl = window.__GL;
    if (gl && gl.enabled) {
      render2D();                          // only the subsystems NOT owned by 3D (per gl.mask)
      gl.frame(game, performance.now());   // the 3D-owned subsystems
      return;
    }
    render2D();
  }

  // The original Canvas2D pipeline. When the 3D renderer is active it draws only the
  // subsystems whose mask bit is false, so a half-ported scene composites correctly.
  function render2D() {
    const W = CFG.canvas, H = CFG.canvas;
    ctx.clearRect(0, 0, W, H);
    const gl = window.__GL;
    const M = (gl && gl.enabled) ? gl.mask : null;
    const draw2D = k => !M || !M[k];      // draw the 2D version unless 3D owns it

    ctx.save();
    ctx.translate(game._shakeX || 0, game._shakeY || 0);

    if (draw2D('world'))       drawWorld();
    if (draw2D('town'))        drawTownFeatures();
    if (draw2D('ambient'))     drawAmbient();
    if (draw2D('items'))       drawItems();
    if (draw2D('portals'))     drawPortals();
    if (draw2D('shrines'))     drawShrines();
    if (draw2D('telegraphs'))  drawTelegraphs();
    if (draw2D('npcs'))        drawNpcs();
    if (draw2D('projectiles')) drawProjectiles();
    if (draw2D('minions'))     drawMinions();
    if (draw2D('enemies'))     drawEnemies();
    if (draw2D('player'))      drawPlayer();
    if (draw2D('particles'))   drawParticles();
    drawInteractionHints();
    if (draw2D('world'))       drawVignette();   // 3D world supplies its own fog/torch vignette

    ctx.restore();

    drawFloatingTexts();
    drawMinimap();
  }

  function w2s(wx, wy) {
    return { x: (wx - game.cam.x) * CFG.tile, y: (wy - game.cam.y) * CFG.tile };
  }

  // UI projection for text/labels that hover over world entities. When the 3D
  // renderer is active, project through its camera (height h in tiles) so labels
  // track the tilted scene; otherwise fall back to the flat 2D mapping.
  function w2sUI(wx, wy, h) {
    const gl = window.__GL;
    if (gl && gl.enabled && gl.project) { const p = gl.project(wx, wy, h || 0); if (p) return p; }
    return w2s(wx, wy);
  }

  function drawWorld() {
    const w = game.world;
    const t = CFG.tile;
    const startX = Math.max(0, Math.floor(game.cam.x));
    const startY = Math.max(0, Math.floor(game.cam.y));
    const endX = Math.min(w.w, Math.ceil(game.cam.x + CFG.canvas / t) + 1);
    const endY = Math.min(w.h, Math.ceil(game.cam.y + CFG.canvas / t) + 1);
    const biome = w.biomeId || 'town';
    const isFloorAt = (nx, ny) => ny >= 0 && ny < w.h && nx >= 0 && nx < w.w && w.grid[ny][nx] === 0;

    // ---- WALL FILL — solid walls with biome-specific textures ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] !== 0 && w.grid[y][x] !== 2) {
          const s = w2s(x, y);
          const hash = (x * 73 + y * 41) & 0xFF;
          const hash2 = (x * 137 + y * 59) & 0xFF;

          // Only draw walls that are adjacent to visible floor
          const nearFloor = isFloorAt(x,y-1)||isFloorAt(x,y+1)||isFloorAt(x-1,y)||isFloorAt(x+1,y);
          if (!nearFloor) continue;

          switch (biome) {
            case 'crypts':
            case 'town':
              // Dark stone bricks with mortar lines
              ctx.fillStyle = '#1a2233';
              ctx.fillRect(s.x, s.y, t, t);
              // Brick pattern (2 rows of offset bricks)
              ctx.strokeStyle = '#0d1520';
              ctx.lineWidth = 1;
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.moveTo(s.x, s.y + t * 0.5); ctx.lineTo(s.x + t, s.y + t * 0.5); // horizontal mortar
              ctx.moveTo(s.x + t * 0.5, s.y); ctx.lineTo(s.x + t * 0.5, s.y + t * 0.5); // top brick split
              ctx.moveTo(s.x + t * 0.25, s.y + t * 0.5); ctx.lineTo(s.x + t * 0.25, s.y + t); // bottom brick split left
              ctx.moveTo(s.x + t * 0.75, s.y + t * 0.5); ctx.lineTo(s.x + t * 0.75, s.y + t); // bottom brick split right
              ctx.stroke();
              ctx.globalAlpha = 1;
              // Occasional skull carving
              if (hash % 18 === 0 && biome === 'crypts') {
                ctx.fillStyle = '#3a4a5a';
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t * 0.4, t * 0.15, 0, PI2); ctx.fill();
                ctx.fillRect(s.x + t * 0.4, s.y + t * 0.5, t * 0.2, t * 0.15);
                ctx.globalAlpha = 1;
              }
              break;

            case 'overgrowth':
              // Crumbling stone covered in moss and vines
              ctx.fillStyle = '#1a3020';
              ctx.fillRect(s.x, s.y, t, t);
              // Irregular stone blocks
              ctx.strokeStyle = '#0d1a10';
              ctx.lineWidth = 1.2;
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              ctx.moveTo(s.x + t * 0.3, s.y); ctx.lineTo(s.x + t * 0.35, s.y + t * 0.55);
              ctx.moveTo(s.x, s.y + t * 0.4); ctx.lineTo(s.x + t, s.y + t * 0.45);
              ctx.moveTo(s.x + t * 0.7, s.y + t * 0.4); ctx.lineTo(s.x + t * 0.65, s.y + t);
              ctx.stroke();
              ctx.globalAlpha = 1;
              // Moss growth on top
              if (hash % 3 === 0) {
                ctx.fillStyle = '#2d7a3a';
                ctx.globalAlpha = 0.5;
                for (let i = 0; i < 3; i++) {
                  const mx = s.x + ((hash2 + i * 37) % t);
                  const my = s.y + ((hash + i * 23) % (t * 0.5));
                  ctx.beginPath(); ctx.arc(mx, my, 2 + (hash2 % 3), 0, PI2); ctx.fill();
                }
                ctx.globalAlpha = 1;
              }
              // Hanging vine from wall edge
              if (hash % 9 === 0 && isFloorAt(x, y + 1)) {
                ctx.strokeStyle = '#3a9a4a';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                const vx = s.x + (hash % t);
                ctx.moveTo(vx, s.y + t);
                ctx.quadraticCurveTo(vx + 2, s.y + t + 10, vx - 2, s.y + t + 18);
                ctx.stroke();
                // tiny leaf
                ctx.fillStyle = '#4aba5a';
                ctx.beginPath(); ctx.arc(vx - 2, s.y + t + 18, 2, 0, PI2); ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'frostpeak':
              // Ice-covered rock with frost patterns
              ctx.fillStyle = '#1a2535';
              ctx.fillRect(s.x, s.y, t, t);
              // Ice layer on surface
              ctx.fillStyle = '#3a6080';
              ctx.globalAlpha = 0.4;
              ctx.fillRect(s.x + 2, s.y + 2, t - 4, t - 4);
              ctx.globalAlpha = 1;
              // Frost crystal formations
              if (hash % 4 === 0) {
                ctx.strokeStyle = '#a0e0ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                const cx = s.x + t * 0.5, cy = s.y + t * 0.5;
                for (let i = 0; i < 4; i++) {
                  const a = (hash2 + i * 60) * Math.PI / 180;
                  ctx.moveTo(cx, cy);
                  ctx.lineTo(cx + Math.cos(a) * t * 0.4, cy + Math.sin(a) * t * 0.4);
                  // branch
                  const bx = cx + Math.cos(a) * t * 0.25;
                  const by = cy + Math.sin(a) * t * 0.25;
                  ctx.moveTo(bx, by);
                  ctx.lineTo(bx + Math.cos(a + 0.7) * t * 0.15, by + Math.sin(a + 0.7) * t * 0.15);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              // Icicle hanging from bottom edge
              if (hash % 6 === 0 && isFloorAt(x, y + 1)) {
                ctx.fillStyle = '#80c8ee';
                ctx.globalAlpha = 0.6;
                const ix = s.x + (hash % (t - 6)) + 3;
                ctx.beginPath();
                ctx.moveTo(ix - 2, s.y + t);
                ctx.lineTo(ix, s.y + t + 8 + (hash2 % 6));
                ctx.lineTo(ix + 2, s.y + t);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'infernal':
              // Charred obsidian with glowing magma veins
              ctx.fillStyle = '#1a0808';
              ctx.fillRect(s.x, s.y, t, t);
              // Obsidian cracks
              ctx.strokeStyle = '#2a1010';
              ctx.lineWidth = 1.5;
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.moveTo(s.x + hash % t, s.y); ctx.lineTo(s.x + hash2 % t, s.y + t);
              ctx.stroke();
              ctx.globalAlpha = 1;
              // Glowing magma vein
              if (hash % 5 === 0) {
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(s.x + (hash % (t-4)) + 2, s.y);
                ctx.quadraticCurveTo(s.x + t * 0.5, s.y + t * 0.5, s.x + (hash2 % (t-4)) + 2, s.y + t);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              // Ember glow near floor edge
              if (hash % 8 === 0 && isFloorAt(x, y + 1)) {
                ctx.fillStyle = '#ff6600';
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t, 4, 0, PI2); ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'voidspire':
              // Alien crystalline void stone
              ctx.fillStyle = '#0a0a1a';
              ctx.fillRect(s.x, s.y, t, t);
              // Purple veins running through
              ctx.strokeStyle = '#6a3aaa';
              ctx.lineWidth = 1;
              ctx.globalAlpha = 0.5;
              ctx.beginPath();
              ctx.moveTo(s.x, s.y + (hash % t));
              ctx.bezierCurveTo(s.x + t * 0.3, s.y + t * 0.2, s.x + t * 0.7, s.y + t * 0.8, s.x + t, s.y + (hash2 % t));
              ctx.stroke();
              ctx.globalAlpha = 1;
              // Floating crystal shards
              if (hash % 5 === 0) {
                ctx.fillStyle = '#b388ff';
                ctx.globalAlpha = 0.4;
                ctx.save();
                ctx.translate(s.x + t * 0.5, s.y + t * 0.5);
                ctx.rotate(hash * 0.05);
                ctx.fillRect(-3, -6, 6, 12);
                ctx.restore();
                ctx.globalAlpha = 1;
              }
              // Void rune markings
              if (hash % 12 === 0) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t * 0.5, t * 0.25, 0, Math.PI * 1.3);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              break;
          }
        }
      }
    }

    // ---- Floor tiles with biome-specific detail ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] === 0) {
          const s = w2s(x, y);
          const hash = (x * 73 + y * 41) & 0xFF;
          const hash2 = (x * 137 + y * 59) & 0xFF;

          // base floor fill
          ctx.fillStyle = w.palette.floor;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(s.x, s.y, t, t);
          ctx.globalAlpha = 1;

          switch (biome) {
            case 'town':
              // Warm sanctuary flagstones — an amber-lit plaza, not a cold dungeon
              ctx.fillStyle = '#2c2114';
              ctx.globalAlpha = 0.55;
              ctx.fillRect(s.x, s.y, t, t);
              ctx.globalAlpha = 1;
              // neat square paving with warm mortar
              ctx.strokeStyle = '#5a4326';
              ctx.globalAlpha = 0.4;
              ctx.lineWidth = 1;
              ctx.strokeRect(s.x + 1.5, s.y + 1.5, t - 3, t - 3);
              ctx.globalAlpha = 1;
              // occasional inlaid accent tile (cyan/gold sanctuary motif)
              if (hash % 7 === 0) {
                ctx.fillStyle = (hash2 % 2 === 0) ? '#6df1ff' : '#ffc857';
                ctx.globalAlpha = 0.10;
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t * 0.5, t * 0.13, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'crypts':
              // Flagstone floor with mortar gaps
              ctx.strokeStyle = '#2a3a4a';
              ctx.globalAlpha = 0.2;
              ctx.lineWidth = 0.8;
              // Large flagstone pattern (offset per row)
              if (y % 2 === 0) {
                ctx.strokeRect(s.x + 1, s.y + 1, t - 2, t - 2);
              } else {
                ctx.strokeRect(s.x - t * 0.3 + 1, s.y + 1, t - 2, t - 2);
              }
              ctx.globalAlpha = 1;
              // Worn surface marks
              if (hash % 5 === 0) {
                ctx.fillStyle = '#1a2a3a';
                ctx.globalAlpha = 0.15;
                ctx.fillRect(s.x + hash % (t-8) + 2, s.y + hash2 % (t-4) + 2, 6 + hash % 4, 2);
                ctx.globalAlpha = 1;
              }
              // Bone fragments scattered
              if (hash % 13 === 0 && biome === 'crypts') {
                ctx.strokeStyle = '#8a8a7a';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                ctx.moveTo(s.x + t * 0.2, s.y + t * 0.6);
                ctx.lineTo(s.x + t * 0.5, s.y + t * 0.65);
                ctx.stroke();
                // tiny skull
                if (hash2 % 3 === 0) {
                  ctx.beginPath();
                  ctx.arc(s.x + t * 0.55, s.y + t * 0.63, 2, 0, PI2);
                  ctx.stroke();
                }
                ctx.globalAlpha = 1;
              }
              break;

            case 'overgrowth':
              // Overgrown stone tiles breaking through dirt
              ctx.fillStyle = '#1a3318';
              ctx.globalAlpha = 0.3;
              ctx.fillRect(s.x, s.y, t, t);
              ctx.globalAlpha = 1;
              // Cracked paving with grass through cracks
              if (hash % 3 !== 0) {
                ctx.strokeStyle = '#2a4a20';
                ctx.lineWidth = 0.7;
                ctx.globalAlpha = 0.3;
                ctx.strokeRect(s.x + 2, s.y + 2, t - 4, t - 4);
                ctx.globalAlpha = 1;
              }
              // Grass tufts
              if (hash % 4 === 0) {
                ctx.strokeStyle = '#4aba5a';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                const gx = s.x + (hash % (t - 8)) + 4;
                const gy = s.y + (hash2 % (t - 6)) + t * 0.5;
                ctx.beginPath();
                ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 6);
                ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3, gy - 5);
                ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 2, gy - 7);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              // Small mushrooms
              if (hash % 11 === 0) {
                ctx.fillStyle = '#ff9944';
                ctx.globalAlpha = 0.5;
                const mx = s.x + (hash2 % (t - 6)) + 3;
                const my = s.y + (hash % (t - 8)) + 6;
                // stem
                ctx.fillRect(mx, my, 2, 4);
                // cap
                ctx.beginPath(); ctx.arc(mx + 1, my, 3, Math.PI, 0); ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Flower
              if (hash % 17 === 0) {
                ctx.fillStyle = '#ffc857';
                ctx.globalAlpha = 0.5;
                const fx = s.x + hash2 % (t - 4) + 2;
                const fy = s.y + hash % (t - 4) + 2;
                for (let i = 0; i < 5; i++) {
                  const a = i * PI2 / 5;
                  ctx.beginPath();
                  ctx.arc(fx + Math.cos(a) * 2, fy + Math.sin(a) * 2, 1.2, 0, PI2);
                  ctx.fill();
                }
                ctx.globalAlpha = 1;
              }
              break;

            case 'frostpeak':
              // Frozen stone with ice patches
              ctx.fillStyle = '#1a2535';
              ctx.globalAlpha = 0.2;
              ctx.fillRect(s.x, s.y, t, t);
              ctx.globalAlpha = 1;
              // Ice patch on floor
              if (hash % 4 === 0) {
                ctx.fillStyle = '#4a8ab0';
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                ctx.ellipse(s.x + t * 0.5, s.y + t * 0.5, t * 0.35, t * 0.25, hash * 0.1, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Snow dusting
              if (hash % 3 === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.08;
                ctx.fillRect(s.x + hash % (t-6), s.y + hash2 % (t-3), 4 + hash % 5, 2 + hash2 % 2);
                ctx.globalAlpha = 1;
              }
              // Frost crystal on floor
              if (hash % 9 === 0) {
                ctx.strokeStyle = '#a0e0ff';
                ctx.lineWidth = 0.8;
                ctx.globalAlpha = 0.3;
                const cx = s.x + t * 0.5, cy = s.y + t * 0.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                  const a = i * Math.PI / 3 + hash2 * 0.02;
                  ctx.moveTo(cx, cy);
                  ctx.lineTo(cx + Math.cos(a) * t * 0.3, cy + Math.sin(a) * t * 0.3);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              break;

            case 'infernal':
              // Charred stone with glowing cracks
              ctx.fillStyle = '#1a0505';
              ctx.globalAlpha = 0.25;
              ctx.fillRect(s.x, s.y, t, t);
              ctx.globalAlpha = 1;
              // Lava crack network
              if (hash % 4 === 0) {
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 1.2;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.moveTo(s.x + hash % t, s.y + hash2 % (t * 0.5));
                ctx.lineTo(s.x + t * 0.5, s.y + t * 0.5);
                ctx.lineTo(s.x + hash2 % t, s.y + t * 0.5 + hash % (t * 0.5));
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              // Charred debris/ash piles
              if (hash % 7 === 0) {
                ctx.fillStyle = '#3a2020';
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.ellipse(s.x + hash2 % (t-6) + 3, s.y + hash % (t-6) + 3, 4, 2.5, 0, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Lava pool (rare)
              if (hash % 19 === 0) {
                ctx.fillStyle = '#ff6600';
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.ellipse(s.x + t * 0.5, s.y + t * 0.5, t * 0.3, t * 0.2, 0, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'voidspire':
              // Alien glass-like floor with floating runes
              ctx.fillStyle = '#0a0a18';
              ctx.globalAlpha = 0.3;
              ctx.fillRect(s.x, s.y, t, t);
              ctx.globalAlpha = 1;
              // Glowing grid lines (like a circuit board)
              ctx.strokeStyle = '#3a2a6a';
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = 0.25;
              ctx.strokeRect(s.x + 1, s.y + 1, t - 2, t - 2);
              ctx.globalAlpha = 1;
              // Void energy pools
              if (hash % 6 === 0) {
                ctx.fillStyle = '#b388ff';
                ctx.globalAlpha = 0.16;
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t * 0.5, t * 0.25, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Floating rune glyph
              if (hash % 14 === 0) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                const rx = s.x + t * 0.5, ry = s.y + t * 0.5;
                ctx.moveTo(rx, ry - 4);
                ctx.lineTo(rx + 4, ry + 3);
                ctx.lineTo(rx - 4, ry + 3);
                ctx.closePath();
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              // Star-like sparkle
              if (hash % 10 === 0) {
                ctx.fillStyle = '#e0e0ff';
                ctx.globalAlpha = 0.4;
                const sx2 = s.x + hash % (t-4) + 2;
                const sy2 = s.y + hash2 % (t-4) + 2;
                ctx.fillRect(sx2 - 0.5, sy2 - 2, 1, 4);
                ctx.fillRect(sx2 - 2, sy2 - 0.5, 4, 1);
                ctx.globalAlpha = 1;
              }
              break;
          }
        }
      }
    }

    // ---- Biome ambient decorations (torches, crystals, etc.) on wall edges ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] !== 0 && w.grid[y][x] !== 2) {
          const hash = (x * 73 + y * 41) & 0xFF;
          const adjacentFloor = isFloorAt(x, y + 1); // wall with floor below
          if (!adjacentFloor) continue;
          const s = w2s(x, y);

          switch (biome) {
            case 'crypts':
              // Wall-mounted torches
              if (hash % 10 === 0) {
                const tx = s.x + t * 0.5, ty = s.y + t - 2;
                // bracket
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(tx - 1, ty - 4, 2, 5);
                // flame
                ctx.fillStyle = '#ff9933';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(tx, ty - 10);
                ctx.quadraticCurveTo(tx + 3, ty - 6, tx + 2, ty - 4);
                ctx.lineTo(tx - 2, ty - 4);
                ctx.quadraticCurveTo(tx - 3, ty - 6, tx, ty - 10);
                ctx.fill();
                // glow
                ctx.fillStyle = '#ff6600';
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.arc(tx, ty - 6, 6, 0, PI2); ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Cobwebs in corners
              if (hash % 15 === 0 && isFloorAt(x - 1, y)) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.5;
                ctx.globalAlpha = 0.12;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y + t);
                ctx.quadraticCurveTo(s.x + 4, s.y + t - 6, s.x, s.y + t - 12);
                ctx.moveTo(s.x, s.y + t);
                ctx.quadraticCurveTo(s.x + 6, s.y + t - 4, s.x + 12, s.y + t);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              break;

            case 'overgrowth':
              // Glowing mushroom clusters on wall base
              if (hash % 7 === 0) {
                const mx = s.x + (hash % (t - 10)) + 5;
                const my = s.y + t;
                // stems
                ctx.fillStyle = '#3a6a3a';
                ctx.fillRect(mx - 1, my - 6, 2, 6);
                ctx.fillRect(mx + 3, my - 4, 2, 4);
                // glowing caps
                ctx.fillStyle = '#44dd88';
                ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(mx, my - 7, 3, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(mx + 4, my - 5, 2.5, Math.PI, 0); ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Hanging roots
              if (hash % 8 === 0) {
                ctx.strokeStyle = '#5a3a1a';
                ctx.lineWidth = 1.2;
                ctx.globalAlpha = 0.4;
                for (let r = 0; r < 2; r++) {
                  const rx = s.x + 5 + r * 12 + (hash % 5);
                  ctx.beginPath();
                  ctx.moveTo(rx, s.y + t);
                  ctx.quadraticCurveTo(rx + 1, s.y + t + 7, rx - 1, s.y + t + 12 + (hash % 5));
                  ctx.stroke();
                }
                ctx.globalAlpha = 1;
              }
              break;

            case 'frostpeak':
              // Ice crystal formations jutting from walls
              if (hash % 6 === 0) {
                ctx.fillStyle = '#80c8ee';
                ctx.globalAlpha = 0.5;
                const ix = s.x + (hash % (t - 8)) + 4;
                const iy = s.y + t;
                // crystal cluster (3 shards)
                ctx.beginPath();
                ctx.moveTo(ix - 3, iy); ctx.lineTo(ix - 1, iy - 10); ctx.lineTo(ix + 1, iy); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(ix + 1, iy); ctx.lineTo(ix + 3, iy - 7); ctx.lineTo(ix + 5, iy); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(ix - 5, iy); ctx.lineTo(ix - 4, iy - 6); ctx.lineTo(ix - 3, iy); ctx.fill();
                // shimmer
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.5;
                ctx.beginPath(); ctx.arc(ix - 1, iy - 8, 1, 0, PI2); ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Snow pile at base
              if (hash % 9 === 0) {
                ctx.fillStyle = '#d0e8f8';
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.ellipse(s.x + t * 0.5, s.y + t + 2, t * 0.4, 3, 0, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'infernal':
              // Wall-mounted fire brazier
              if (hash % 8 === 0) {
                const bx = s.x + t * 0.5, by = s.y + t;
                // brazier bowl
                ctx.fillStyle = '#3a2020';
                ctx.beginPath();
                ctx.moveTo(bx - 5, by - 3); ctx.lineTo(bx - 3, by);
                ctx.lineTo(bx + 3, by); ctx.lineTo(bx + 5, by - 3);
                ctx.fill();
                // fire (static shape)
                ctx.fillStyle = '#ff4400';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(bx, by - 12);
                ctx.quadraticCurveTo(bx + 4, by - 7, bx + 3, by - 3);
                ctx.lineTo(bx - 3, by - 3);
                ctx.quadraticCurveTo(bx - 4, by - 7, bx, by - 12);
                ctx.fill();
                // inner yellow
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.moveTo(bx, by - 9);
                ctx.quadraticCurveTo(bx + 2, by - 6, bx + 1.5, by - 3);
                ctx.lineTo(bx - 1.5, by - 3);
                ctx.quadraticCurveTo(bx - 2, by - 6, bx, by - 9);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              break;

            case 'voidspire':
              // Floating void crystal
              if (hash % 7 === 0) {
                const cx = s.x + t * 0.5, cy = s.y + t - 4;
                ctx.fillStyle = '#b388ff';
                ctx.globalAlpha = 0.6;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(hash * 0.05);
                // diamond crystal
                ctx.beginPath();
                ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0);
                ctx.closePath(); ctx.fill();
                ctx.restore();
                ctx.globalAlpha = 1;
              }
              // Void tendril
              if (hash % 11 === 0) {
                ctx.strokeStyle = '#6a3aaa';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.35;
                const tx2 = s.x + hash % (t - 4) + 2;
                ctx.beginPath();
                ctx.moveTo(tx2, s.y + t);
                ctx.quadraticCurveTo(tx2 + 3, s.y + t + 8, tx2 + 1, s.y + t + 16);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
              break;
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
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.2, 0, PI2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    // ---- Walls — batched line-art edges ----
    ctx.strokeStyle = w.palette.wall;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] !== 0 && w.grid[y][x] !== 2) {
          const s = w2s(x, y);
          const top = isFloorAt(x, y - 1);
          const bottom = isFloorAt(x, y + 1);
          const left = isFloorAt(x - 1, y);
          const right = isFloorAt(x + 1, y);
          if (top) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + t, s.y); }
          if (bottom) { ctx.moveTo(s.x, s.y + t); ctx.lineTo(s.x + t, s.y + t); }
          if (left) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + t); }
          if (right) { ctx.moveTo(s.x + t, s.y); ctx.lineTo(s.x + t, s.y + t); }
        }
      }
    }
    ctx.stroke();
    ctx.lineCap = 'butt';

    // ---- Decor blocks (town fountain etc) ----
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] === 2) {
          const s = w2s(x, y);
          ctx.fillStyle = w.palette.accent;
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(s.x + t / 2, s.y + t / 2, t * 0.6, 0, PI2);
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.fillRect(s.x + 6, s.y + 6, t - 12, t - 12);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = w.palette.accent;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(s.x + 5, s.y + 5, t - 10, t - 10);
          // inner diamond shape
          ctx.beginPath();
          ctx.moveTo(s.x + t / 2, s.y + 4);
          ctx.lineTo(s.x + t - 4, s.y + t / 2);
          ctx.lineTo(s.x + t / 2, s.y + t - 4);
          ctx.lineTo(s.x + 4, s.y + t / 2);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // ---- WALL EXTRUSION — perimeter walls get visible height + a shaded south face ----
    // (drawn last so the front faces sit over the floor tile directly below each wall)
    const FACE = ({
      crypts:    ['#141a28', '#080b14'],
      town:      ['#2a2012', '#130d07'],
      overgrowth:['#13210f', '#080e06'],
      frostpeak: ['#1b2735', '#0b1019'],
      infernal:  ['#27110c', '#0f0604'],
      voidspire: ['#170f24', '#08050f'],
    })[biome] || ['#141a28', '#080b14'];
    const WH = 11;                       // apparent wall height in px
    const wallAt = (nx, ny) => ny >= 0 && ny < w.h && nx >= 0 && nx < w.w && w.grid[ny][nx] === 1;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (w.grid[y][x] !== 1) continue;
        const nearFloor = isFloorAt(x, y - 1) || isFloorAt(x, y + 1) || isFloorAt(x - 1, y) || isFloorAt(x + 1, y);
        if (!nearFloor) continue;
        const s = w2s(x, y);
        // top-edge highlight — the wall's roof catches the overhead light
        ctx.fillStyle = 'rgba(200,220,255,0.05)';
        ctx.fillRect(s.x, s.y, t, 2);
        // south-facing front face, only where open floor lies below
        if (isFloorAt(x, y + 1)) {
          ctx.fillStyle = FACE[0];
          ctx.fillRect(s.x, s.y + t, t, Math.ceil(WH * 0.55));
          ctx.fillStyle = FACE[1];
          ctx.fillRect(s.x, s.y + t + Math.ceil(WH * 0.55), t, Math.floor(WH * 0.45));
          // lit lip where the roof meets the face
          ctx.fillStyle = 'rgba(190,215,255,0.18)';
          ctx.fillRect(s.x, s.y + t, t, 1.5);
          // contact shadow grounding the wall on the floor
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.fillRect(s.x, s.y + t + WH, t, 3);
          // close the side of the face at run-ends (where no wall continues east/west)
          if (!wallAt(x - 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(s.x, s.y + t, 1.5, WH); }
          if (!wallAt(x + 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(s.x + t - 1.5, s.y + t, 1.5, WH); }
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
      const isRiftPortal = p.kind === 'rift-next';
      const col = p.kind === 'town' ? '#ffc857' : (isRiftPortal ? '#b388ff' : '#6df1ff');
      const spin = now / 1200;
      ctx.save();
      ctx.translate(s.x, s.y);
      // ground glow — large so player can see it from a distance
      // locked rift portal renders dimmer until enough enemies are slain
      ctx.fillStyle = col;
      ctx.globalAlpha = (isRiftPortal && p.locked) ? 0.06 : 0.15;
      ctx.beginPath();
      ctx.ellipse(0, 6, t * 0.9, t * 0.35, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // spinning rune ring
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = spin + i * (Math.PI / 4);
        const r = t * 0.6;
        const rx = Math.cos(a) * r, ry = Math.sin(a) * r * 0.7;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, PI2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // outer ring
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, t * 0.65, 0, PI2);
      ctx.stroke();
      // inner ring
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, t * 0.4, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // center icon — larger
      ctx.fillStyle = col;
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const icon = p.kind === 'town' ? '⌂' : (isRiftPortal ? (p.locked ? '🔒' : '✷') : '▼');
      ctx.fillText(icon, 0, -1);
      ctx.restore();
    }
  }

  function drawTelegraphs() {
    if (!game.telegraphs || !game.telegraphs.length) return;
    const t = CFG.tile;
    for (const tg of game.telegraphs) {
      const s = w2s(tg.x, tg.y);
      const prog = Math.min(1, tg.age / tg.windup);   // 0 → 1 as it charges
      const R = tg.radius * t;
      ctx.save();
      ctx.translate(s.x, s.y);
      // outer warning ring (full radius)
      ctx.strokeStyle = tg.color;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tg.age * 18);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.62, 0, 0, PI2);
      ctx.stroke();
      // filling danger zone — grows to full as detonation nears
      ctx.globalAlpha = 0.18 + 0.22 * prog;
      ctx.fillStyle = tg.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * prog, R * 0.62 * prog, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  function drawShrines() {
    if (!game.world.shrines) return;
    const now = performance.now();
    for (const sh of game.world.shrines) {
      if (sh.used) continue;
      const def = SHRINES[sh.type];
      if (!def) continue;
      const s = w2s(sh.x, sh.y);
      const t = CFG.tile;
      const col = def.color;
      const pulse = 0.5 + 0.5 * Math.sin(now / 350);
      ctx.save();
      ctx.translate(s.x, s.y);
      // Ground glow — large halo so player spots it
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.12 + 0.06 * pulse;
      ctx.beginPath();
      ctx.ellipse(0, 6, t * 0.85, t * 0.32, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Pillar base (diamond shape)
      ctx.fillStyle = '#1a1a22';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -t * 0.5);
      ctx.lineTo(t * 0.32, 0);
      ctx.lineTo(0, t * 0.35);
      ctx.lineTo(-t * 0.32, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Inner glow
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.3 + 0.3 * pulse;
      ctx.beginPath();
      ctx.arc(0, -t * 0.08, t * 0.18, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Icon
      ctx.fillStyle = col;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, -t * 0.08);
      ctx.restore();
    }
  }

  // Sanctuary-only atmosphere: a glowing plaza, a grand central fountain, brazier light.
  function drawTownFeatures() {
    if (!game.world || game.world.kind !== 'town') return;
    const now = performance.now();
    const t = CFG.tile;
    // Fountain sits at the town centre (grid 10,8)
    const fc = w2s(10.5, 8.5);

    // ---- Plaza: faint concentric rings radiating from the fountain ----
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = '#ffc857';
      ctx.globalAlpha = 0.05 + 0.02 * Math.sin(now / 1500 + i);
      ctx.beginPath();
      ctx.ellipse(fc.x, fc.y, i * t * 1.7, i * t * 1.7 * 0.62, 0, 0, PI2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---- Brazier light pools at the four corner pillars ----
    const braziers = [[3, 3], [17, 3], [3, 13], [17, 13]];
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i];
      const s = w2s(b[0] + 0.5, b[1] + 0.5);
      const flick = 0.7 + 0.3 * Math.sin(now / 190 + i * 1.7);
      ctx.fillStyle = '#ff9a3c';
      ctx.globalAlpha = 0.16 * flick;
      ctx.beginPath(); ctx.arc(s.x, s.y, t * 1.1, 0, PI2); ctx.fill();
      ctx.globalAlpha = 0.85 * flick;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(s.x, s.y - 2, 3, 0, PI2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- Grand fountain ----
    ctx.save();
    ctx.translate(fc.x, fc.y);
    const R = t * 0.9;
    // ground glow
    ctx.fillStyle = '#6df1ff';
    ctx.globalAlpha = 0.13;
    ctx.beginPath(); ctx.ellipse(0, 5, R * 1.3, R * 0.8, 0, 0, PI2); ctx.fill();
    // stone basin rim
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 5, R, R * 0.55, 0, 0, PI2); ctx.stroke();
    // water surface
    ctx.fillStyle = '#15485a';
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(0, 5, R * 0.82, R * 0.42, 0, 0, PI2); ctx.fill();
    ctx.globalAlpha = 1;
    // animated ripple rings on the water
    for (let i = 0; i < 2; i++) {
      const ph = ((now / 1200) + i * 0.5) % 1;
      ctx.strokeStyle = '#9befff';
      ctx.globalAlpha = 0.45 * (1 - ph);
      ctx.lineWidth = 1.5;
      const rr = R * 0.18 + R * 0.6 * ph;
      ctx.beginPath(); ctx.ellipse(0, 5, rr, rr * 0.5, 0, 0, PI2); ctx.stroke();
    }
    // shimmering central jet
    const jh = 16 + Math.sin(now / 300) * 3;
    const grad = ctx.createLinearGradient(0, 5 - jh, 0, 5);
    grad.addColorStop(0, 'rgba(155,239,255,0)');
    grad.addColorStop(1, 'rgba(155,239,255,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(-2, 5 - jh, 4, jh);
    // sparkle at the top of the jet
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 180);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 5 - jh, 2.2, 0, PI2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
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
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.ellipse(0, 10, 18, 7, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // body — pixel-art figure
      const bob = Math.sin(now / 800 + n.x * 2) * 1.2;
      // torso
      ctx.fillStyle = n.color;
      ctx.fillRect(-4, -8 + bob, 8, 12);
      // head
      ctx.beginPath();
      ctx.arc(0, -12 + bob, 5, 0, PI2);
      ctx.fill();
      // shoulders
      ctx.fillRect(-7, -6 + bob, 14, 3);
      // role indicator icon (floating above)
      ctx.fillStyle = n.color;
      ctx.globalAlpha = 1;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 6;
      ctx.fillText(n.glyph, 0, -22 + bob);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      // name plate — large enough for glasses waveguide
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(n.name).width;
      const npH = 18, npY = 16;
      ctx.fillStyle = 'rgba(8,8,16,0.92)';
      ctx.fillRect(-(tw + 14) / 2, npY, tw + 14, npH);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(-(tw + 14) / 2, npY, tw + 14, npH);
      ctx.globalAlpha = 1;
      // text glow for additive display readability
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = n.color;
      ctx.fillText(n.name, 0, npY + npH / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // The most impressive equipped look's color (mythic shimmers prismatic).
  function auraColorFor(c, now) {
    let anyMythic = false, col = null;
    for (const sl of ['weapon', 'armor', 'ring', 'amulet']) {
      const it = c.equip[sl]; if (!it) continue;
      if (it.rarity === 'mythic') anyMythic = true;
      const lk = gearLook(it);
      if (lk && GEAR_LOOKS[lk] && !col) col = GEAR_LOOKS[lk].color;
    }
    if (anyMythic) return mythicShimmer(now, 0);
    return col;
  }
  // Orbiting motes + ground ring driven by equipped legendary/mythic gear.
  function drawGearAura(c, now) {
    let anyMythic = false, col = null;
    for (const sl of ['weapon', 'armor', 'ring', 'amulet']) {
      const it = c.equip[sl]; if (!it) continue;
      if (it.rarity === 'mythic') anyMythic = true;
      const lk = gearLook(it);
      if (lk && GEAR_LOOKS[lk] && !col) col = GEAR_LOOKS[lk].color;
    }
    if (!col && !anyMythic) return;
    const base = anyMythic ? mythicShimmer(now, 0) : col;
    const n = anyMythic ? 5 : 3;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < n; i++) {
      const ang = now / 700 + i * PI2 / n;
      const ox = Math.cos(ang) * 16, oy = Math.sin(ang) * 8 - 2;
      ctx.fillStyle = anyMythic ? mythicShimmer(now, i) : base;
      ctx.beginPath(); ctx.arc(ox, oy, anyMythic ? 2 : 1.6, 0, PI2); ctx.fill();
    }
    ctx.globalAlpha = 0.2 + 0.1 * Math.sin(now / 350);
    ctx.strokeStyle = base; ctx.lineWidth = anyMythic ? 2 : 1.4;
    ctx.beginPath(); ctx.ellipse(0, 9, anyMythic ? 18 : 15, anyMythic ? 7 : 6, 0, 0, PI2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Cosmetics drawn BEHIND the body (cape, wings, spectral aura).
  function drawArmorBack(look, bob, now) {
    const def = GEAR_LOOKS[look];
    if (!def || def.slot !== 'armor') return;
    const col = def.color;
    if (def.body === 'cape') {
      const sway = Math.sin(now / 400) * 2;
      ctx.fillStyle = col; ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-5, -3 + bob); ctx.lineTo(5, -3 + bob);
      ctx.lineTo(4 + sway, 9 + bob); ctx.lineTo(-4 + sway, 9 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.moveTo(0, -3 + bob); ctx.lineTo(2 + sway * 0.5, 8 + bob); ctx.lineTo(-2 + sway * 0.5, 8 + bob); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (def.body === 'wings') {
      const flap = Math.sin(now / 300) * 0.3;
      ctx.fillStyle = col; ctx.globalAlpha = 0.5;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * 3, -3 + bob);
        ctx.quadraticCurveTo(d * (13 + flap * 6), -8 + bob, d * 11, 2 + bob);
        ctx.quadraticCurveTo(d * 8, -1 + bob, d * 3, 0 + bob);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (def.body === 'spectral') {
      ctx.fillStyle = col; ctx.globalAlpha = 0.16 + 0.06 * Math.sin(now / 300);
      ctx.beginPath(); ctx.ellipse(0, 0 + bob, 9, 12, 0, 0, PI2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Cosmetics drawn ABOVE/OVER the body (crown, halo, heavy pauldrons).
  function drawArmorFront(look, bob, now) {
    const def = GEAR_LOOKS[look];
    if (!def || def.slot !== 'armor') return;
    const col = def.color;
    if (def.body === 'crown') {
      const cy = -15 + bob;
      ctx.fillStyle = col; ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-4, cy + 3); ctx.lineTo(-4, cy); ctx.lineTo(-2, cy + 1.5); ctx.lineTo(0, cy - 1.5);
      ctx.lineTo(2, cy + 1.5); ctx.lineTo(4, cy); ctx.lineTo(4, cy + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 250);
      ctx.beginPath(); ctx.arc(0, cy + 1, 1, 0, PI2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (def.body === 'halo') {
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(now / 300);
      ctx.beginPath(); ctx.ellipse(0, -16 + bob, 5, 1.8, 0, 0, PI2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (def.body === 'plate') {
      ctx.fillStyle = col; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(-8, -4 + bob); ctx.lineTo(-7, -9 + bob); ctx.lineTo(-5, -4 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -4 + bob); ctx.lineTo(7, -9 + bob); ctx.lineTo(5, -4 + bob); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Elemental FX emitted from the weapon.
  function drawWeaponFx(look, wx, wy, now) {
    const def = GEAR_LOOKS[look];
    if (!def || def.slot !== 'weapon') return;
    const col = def.color, fx = def.fx;
    ctx.save();
    ctx.translate(wx, wy);
    if (fx === 'fire' || fx === 'wisp' || fx === 'void' || fx === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 500) + i / 3) % 1;
        const yy = -ph * 12, xx = Math.sin(now / 200 + i * 2) * 2;
        ctx.fillStyle = col; ctx.globalAlpha = 0.6 * (1 - ph);
        ctx.beginPath(); ctx.arc(xx, yy, 1.8 * (1 - ph * 0.5), 0, PI2); ctx.fill();
      }
    } else if (fx === 'ice') {
      ctx.fillStyle = col; ctx.globalAlpha = 0.65;
      for (let i = 0; i < 3; i++) {
        const ang = now / 400 + i * PI2 / 3;
        ctx.save(); ctx.translate(Math.cos(ang) * 4, Math.sin(ang) * 4); ctx.rotate(ang);
        ctx.fillRect(-0.6, -2, 1.2, 4); ctx.restore();
      }
    } else if (fx === 'spark') {
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 100);
      for (let i = 0; i < 2; i++) {
        const a = now / 120 + i * Math.PI;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5 - 4); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.world.player;
    const cls = CLASSES[game.char.classId];
    const c = game.char;
    const s = w2s(p.x, p.y);
    const now = performance.now();
    ctx.save();
    ctx.translate(s.x, s.y);

    // Determine equipped item rarities for glow effects
    const wepItem = c.equip.weapon;
    const armItem = c.equip.armor;
    const wepRarity = wepItem ? wepItem.rarity : 'common';
    const armRarity = armItem ? armItem.rarity : 'common';
    const hasUniqueGear = (RARITY_RANK[wepRarity] || 0) >= 3 || (RARITY_RANK[armRarity] || 0) >= 3;
    const hasRareGear = wepRarity === 'rare' || armRarity === 'rare';

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

    // Look-driven cosmetics align to the sprite's bob
    const bob = Math.sin(now / 220) * 1.5;
    const armorLook = gearLook(armItem);
    const weaponLook = gearLook(wepItem);

    // Gear aura — legendary/mythic & elemental looks (orbiting motes + ring)
    drawGearAura(c, now);
    // Rare gear with no fancier look still gets a simple pulsing ring
    if (hasRareGear && !hasUniqueGear && !armorLook && !weaponLook) {
      ctx.strokeStyle = rarityColor('rare');
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(now / 400);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // soft layered ground shadow — grounds the hero for a 3D feel
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.ellipse(0, 10.5, 14, 5, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(0, 10, 10, 3.4, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // rim-light ground glow — tinted by the best equipped look
    const auraCol = auraColorFor(c, now);
    const glowCol = auraCol || (hasRareGear ? rarityColor('rare') : cls.color);
    ctx.fillStyle = glowCol;
    ctx.globalAlpha = 0.2 + (p.attackingFor > 0 ? 0.15 : 0) + (auraCol ? 0.12 : 0);
    ctx.beginPath();
    ctx.ellipse(0, 9, 14, 5, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // cape / wings behind the body
    drawArmorBack(armorLook, bob, now);

    // sprite — procedural pixel-art figure
    drawCharSprite(cls.color, cls.id, p.lastDir.x, p.lastDir.y, p.attackingFor > 0);

    // crown / halo / pauldrons over the body, and weapon elemental FX
    drawArmorFront(armorLook, bob, now);
    drawWeaponFx(weaponLook, p.lastDir.x >= 0 ? 7 : -7, -7 + bob, now);

    ctx.restore();
  }

  function drawCharSprite(color, classId, dirX, dirY, attacking) {
    const now = performance.now();
    const bob = Math.sin(now / 220) * 1.5;
    const isWalking = (game.keys.up || game.keys.down || game.keys.left || game.keys.right);
    const walk = isWalking ? Math.sin(now / 120) * 2 : 0;
    const c = game.char;
    const wepItem = c.equip.weapon;
    const armItem = c.equip.armor;
    const wepBase = wepItem ? ITEM_BASES[wepItem.baseId] : null;
    const wepRarity = wepItem ? wepItem.rarity : 'common';
    const armRarity = armItem ? armItem.rarity : 'common';
    const wepColor = rarityColor(wepRarity);
    const armColor = armRarity !== 'common' ? rarityColor(armRarity) : color;
    const armTier = RARITY_RANK[armRarity] || 0;   // common 0 … unique 3 … mythic 4
    const wepTier = RARITY_RANK[wepRarity] || 0;

    // legs (animated when walking) — armor tinted
    ctx.fillStyle = armRarity !== 'common' ? armColor : color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-4, 4 + bob, 3, 7 + walk * 0.5);
    ctx.fillRect(1, 4 + bob, 3, 7 - walk * 0.5);
    ctx.globalAlpha = 1;

    // torso — shows armor rarity
    ctx.fillStyle = color;
    ctx.fillRect(-5, -4 + bob, 10, 9);
    // armor overlay (based on equipped armor tier — unique & mythic share the premium look)
    if (armTier >= 3) {
      ctx.fillStyle = armColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-5, -4 + bob, 10, 9);
      // armor detail lines
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(-4, -1 + bob); ctx.lineTo(4, -1 + bob);
      ctx.moveTo(-4, 2 + bob); ctx.lineTo(4, 2 + bob);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (armTier === 2) {
      ctx.fillStyle = armColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(-5, -4 + bob, 10, 9);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(-3, -2 + bob, 6, 6);
      ctx.globalAlpha = 1;
    }

    // shoulders / pauldrons — bigger/glowing with better armor
    ctx.fillStyle = armRarity !== 'common' ? armColor : color;
    const pSize = armTier >= 3 ? 5 : (armTier === 2 ? 4.5 : 4);
    ctx.fillRect(-8, -4 + bob, pSize, pSize);
    ctx.fillRect(4, -4 + bob, pSize, pSize);
    // pauldron spikes for unique/mythic (skipped when a 'plate' look already adds them)
    const armLookDef = armItem ? GEAR_LOOKS[gearLook(armItem)] : null;
    if (armTier >= 3 && !(armLookDef && armLookDef.body === 'plate')) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-7, -4 + bob); ctx.lineTo(-6, -8 + bob); ctx.lineTo(-5, -4 + bob); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, -4 + bob); ctx.lineTo(6, -8 + bob); ctx.lineTo(7, -4 + bob); ctx.fill();
      ctx.globalAlpha = 1;
    }

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

    // volume shading — overhead light fades the body from lit (top) to shadow (bottom)
    const vg = ctx.createLinearGradient(0, -14 + bob, 0, 7 + bob);
    vg.addColorStop(0, 'rgba(255,255,255,0.16)');
    vg.addColorStop(0.5, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vg;
    ctx.fillRect(-8, -14 + bob, 16, 21);

    // Weapon rendering — based on actual equipped weapon type
    const armX = dirX >= 0 ? 7 : -7;
    const swingAngle = attacking ? Math.sin(now / 60) * 0.8 : -0.3;
    const wepIcon = wepBase ? wepBase.icon : null;

    if (wepIcon === '⚔' || (!wepBase && classId === 'warrior')) {
      // SWORD — blade with crossguard, rarity colors the blade
      ctx.save();
      ctx.translate(armX, -2 + bob);
      ctx.rotate(swingAngle);
      // blade
      ctx.strokeStyle = wepRarity === 'common' ? '#c0c0d0' : wepColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -14);
      ctx.stroke();
      // blade edge highlight
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1, -2); ctx.lineTo(1, -13);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // crossguard
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#888888';
      ctx.fillRect(-4, -2, 8, 2.5);
      // pommel
      ctx.beginPath(); ctx.arc(0, 2, 1.5, 0, PI2); ctx.fill();
      // tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-1.2, -14); ctx.lineTo(0, -17); ctx.lineTo(1.2, -14);
      ctx.fill();
      ctx.restore();
    } else if (wepIcon === '✦' || (!wepBase && classId === 'mage')) {
      // STAFF — tall staff with glowing orb/crystal on top
      ctx.save();
      ctx.translate(armX, 0 + bob);
      // shaft
      ctx.strokeStyle = wepTier >= 3 ? '#c0a0ff' : '#a0a0c0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -12);
      ctx.stroke();
      // staff head — ornate top piece
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#6df1ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      // orb
      ctx.beginPath();
      ctx.arc(0, -14, wepTier >= 3 ? 4 : 3.5, 0, PI2);
      ctx.fill();
      // inner sparkle
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200);
      ctx.beginPath();
      ctx.arc(0, -14, 1.5, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // prongs around orb for rare+
      if (wepTier >= 2) {
        ctx.strokeStyle = wepColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -11); ctx.lineTo(-2, -14);
        ctx.moveTo(3, -11); ctx.lineTo(2, -14);
        ctx.stroke();
      }
      ctx.restore();
    } else if (wepIcon === '➹' || (!wepBase && classId === 'ranger')) {
      // BOW — curved limbs with string, rarity affects color
      ctx.save();
      ctx.translate(armX, -2 + bob);
      // bow limbs
      ctx.strokeStyle = wepRarity !== 'common' ? wepColor : '#8b6b3a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, -1.2, 1.2);
      ctx.stroke();
      // limb tips
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#aa8844';
      ctx.beginPath();
      ctx.arc(10 * Math.cos(-1.2), 10 * Math.sin(-1.2), 1.5, 0, PI2); ctx.fill();
      ctx.beginPath();
      ctx.arc(10 * Math.cos(1.2), 10 * Math.sin(1.2), 1.5, 0, PI2); ctx.fill();
      // bowstring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      const pull = attacking ? 3 : 0;
      ctx.beginPath();
      ctx.moveTo(10 * Math.cos(-1.2), 10 * Math.sin(-1.2));
      if (attacking) {
        ctx.lineTo(-pull, 0);
      }
      ctx.lineTo(10 * Math.cos(1.2), 10 * Math.sin(1.2));
      ctx.stroke();
      // arrow nocked (when attacking)
      if (attacking) {
        ctx.strokeStyle = wepRarity !== 'common' ? wepColor : '#dddddd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-pull, 0); ctx.lineTo(8, 0);
        ctx.stroke();
        // arrowhead
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(8, -2); ctx.lineTo(11, 0); ctx.lineTo(8, 2); ctx.fill();
      }
      ctx.restore();
    } else if (wepIcon === '☠' || (!wepBase && classId === 'summoner')) {
      // WAND / BONE WAND — short twisted rod with skull/gem
      ctx.save();
      ctx.translate(armX, 0 + bob);
      ctx.rotate(attacking ? Math.sin(now / 80) * 0.3 : 0);
      // twisted shaft
      ctx.strokeStyle = wepRarity !== 'common' ? wepColor : '#7a5a9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      // wavy line for twisted appearance
      ctx.quadraticCurveTo(1.5, -1, -1, -5);
      ctx.quadraticCurveTo(1, -8, 0, -10);
      ctx.stroke();
      // skull top
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#c489ff';
      ctx.beginPath();
      ctx.arc(0, -12, 3.5, 0, PI2);
      ctx.fill();
      // skull detail
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-1.2, -12.5, 1, 0, PI2);
      ctx.arc(1.2, -12.5, 1, 0, PI2);
      ctx.fill();
      // jaw
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#c489ff';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-2, -10, 4, 2);
      ctx.globalAlpha = 1;
      // soul glow for rare+
      if (wepTier >= 2) {
        ctx.fillStyle = wepColor;
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 250);
        ctx.beginPath(); ctx.arc(0, -12, 5, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // attack arc effect — colored by weapon rarity
    if (attacking) {
      const arcCol = wepRarity !== 'common' ? wepColor : color;
      ctx.strokeStyle = arcCol;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      const arcAngle = Math.atan2(dirY, dirX);
      ctx.beginPath();
      ctx.arc(0, 0 + bob, 16, arcAngle - 0.8, arcAngle + 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
    const C = CFG.canvas;
    for (const e of game.enemies) {
      const s = w2s(e.x, e.y);
      // viewport cull — big maps can hold many enemies; only draw what's on-screen
      if (s.x < -50 || s.x > C + 50 || s.y < -50 || s.y > C + 50) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      const isBoss = e.boss;
      const isElite = e.elite;
      const scale = isBoss ? 1.5 : (e._isSplit ? 0.7 : 1);
      const bob = Math.sin(now / 280 + e.x * 5) * 1.2;

      // soft layered ground shadow — grounds the figure for a 3D feel
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.20;
      ctx.beginPath();
      ctx.ellipse(0, 9.5 * scale, 12 * scale, 5 * scale, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      ctx.ellipse(0, 9 * scale, 8 * scale, 3.2 * scale, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Elite glow halo (pulsing ring underneath)
      if (isElite && e.eliteColor) {
        const pulse = 0.5 + 0.4 * Math.sin(now / 280);
        ctx.fillStyle = e.eliteColor;
        ctx.globalAlpha = 0.18 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, 14 * scale, 0, PI2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Enraged boss aura — angry red pulsing ring
      if (e.enraged) {
        const pulse = 0.6 + 0.4 * Math.sin(now / 120);
        ctx.strokeStyle = '#ff2b3c';
        ctx.globalAlpha = 0.5 * pulse;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 17 * scale, 0, PI2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // phased/charging glow
      if (e.phased > 0) ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 80);
      if (e.charging > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 50);

      // flash white on hit
      const col = e.hitFlash > 0 ? '#ffffff' : e.color;

      // pixel-art body — shape-specific rendering
      ctx.fillStyle = col;

      const shape = e.shape || (e.attackKind === 'melee' ? 'hunched' : 'ghost');
      switch (shape) {
        case 'skeleton': // bony thin figure with visible ribs
          ctx.fillRect(-2 * scale, -4 * scale + bob, 4 * scale, 10 * scale); // spine
          ctx.beginPath(); ctx.arc(0, -6 * scale + bob, 3.5 * scale, 0, PI2); ctx.fill(); // skull
          ctx.fillRect(-6 * scale, -3 * scale + bob, 2 * scale, 7 * scale); // left arm
          ctx.fillRect(4 * scale, -3 * scale + bob, 2 * scale, 7 * scale); // right arm
          // ribs
          ctx.fillRect(-4 * scale, -2 * scale + bob, 8 * scale, 1.5 * scale);
          ctx.fillRect(-3.5 * scale, 0.5 * scale + bob, 7 * scale, 1.5 * scale);
          // empty eye sockets
          ctx.fillStyle = '#ff0000';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(-2 * scale, -7 * scale + bob, 1.5 * scale, 1.5 * scale);
          ctx.fillRect(0.5 * scale, -7 * scale + bob, 1.5 * scale, 1.5 * scale);
          ctx.globalAlpha = 1;
          break;

        case 'hunched': // crouching bestial shape (ghouls)
          ctx.beginPath();
          ctx.ellipse(0, -1 * scale + bob, 6 * scale, 5 * scale, 0.2, 0, PI2);
          ctx.fill(); // hunched body
          ctx.beginPath(); ctx.arc(-3 * scale, -5 * scale + bob, 3 * scale, 0, PI2); ctx.fill(); // head forward
          // claws
          ctx.fillRect(-7 * scale, 1 * scale + bob, 2.5 * scale, 4 * scale);
          ctx.fillRect(5 * scale, 1 * scale + bob, 2.5 * scale, 4 * scale);
          // drooling eye
          ctx.fillStyle = '#ffe066';
          ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.arc(-3 * scale, -5.5 * scale + bob, 1.2 * scale, 0, PI2); ctx.fill();
          ctx.globalAlpha = 1;
          break;

        case 'ghost': // floating translucent wispy shape (wraiths)
          ctx.globalAlpha = 0.6 + 0.2 * Math.sin(now / 300);
          ctx.beginPath();
          ctx.moveTo(0, -10 * scale + bob);
          ctx.quadraticCurveTo(6 * scale, -4 * scale + bob, 4 * scale, 4 * scale + bob);
          ctx.quadraticCurveTo(2 * scale, 8 * scale + bob + Math.sin(now / 200) * 2, 0, 6 * scale + bob);
          ctx.quadraticCurveTo(-2 * scale, 8 * scale + bob + Math.sin(now / 250) * 2, -4 * scale, 4 * scale + bob);
          ctx.quadraticCurveTo(-6 * scale, -4 * scale + bob, 0, -10 * scale + bob);
          ctx.fill();
          // eerie face
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.arc(-1.5 * scale, -5 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
          ctx.beginPath(); ctx.arc(1.5 * scale, -5 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
          ctx.globalAlpha = 1;
          break;

        case 'spider': // eight-legged crawling shape
          ctx.beginPath(); ctx.ellipse(0, 0 + bob, 5 * scale, 3.5 * scale, 0, 0, PI2); ctx.fill(); // abdomen
          ctx.beginPath(); ctx.arc(0, -4 * scale + bob, 2.5 * scale, 0, PI2); ctx.fill(); // head
          // legs (4 per side, angled)
          ctx.lineWidth = 1.5 * scale; ctx.strokeStyle = col;
          for (let i = 0; i < 4; i++) {
            const ly = -2 + i * 2;
            const lAng = Math.sin(now / 150 + i) * 0.3;
            ctx.beginPath(); ctx.moveTo(-4 * scale, ly * scale + bob);
            ctx.lineTo(-8 * scale - Math.cos(lAng) * 2, (ly + 2) * scale + bob);
            ctx.stroke();
            ctx.beginPath(); ctx.moveTo(4 * scale, ly * scale + bob);
            ctx.lineTo(8 * scale + Math.cos(lAng) * 2, (ly + 2) * scale + bob);
            ctx.stroke();
          }
          // multiple eyes
          ctx.fillStyle = '#ff0000';
          ctx.globalAlpha = 0.8;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath(); ctx.arc(i * 1.2 * scale, -4.5 * scale + bob, 0.7 * scale, 0, PI2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;

        case 'plant': // spiky thornling
          // body (bulbous)
          ctx.beginPath(); ctx.ellipse(0, 0 + bob, 5 * scale, 6 * scale, 0, 0, PI2); ctx.fill();
          // thorns radiating outward
          ctx.strokeStyle = col; ctx.lineWidth = 2 * scale;
          for (let i = 0; i < 8; i++) {
            const a = i * PI2 / 8 + Math.sin(now / 500) * 0.1;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 4 * scale, Math.sin(a) * 5 * scale + bob);
            ctx.lineTo(Math.cos(a) * 8 * scale, Math.sin(a) * 9 * scale + bob);
            ctx.stroke();
          }
          // center eye
          ctx.fillStyle = '#ffe066'; ctx.beginPath();
          ctx.arc(0, -1 * scale + bob, 2 * scale, 0, PI2); ctx.fill();
          break;

        case 'orb': // floating glowing wisp orb
          ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now / 180);
          ctx.beginPath(); ctx.arc(0, bob, 5 * scale, 0, PI2); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.arc(0, bob, 2.5 * scale, 0, PI2); ctx.fill();
          // trailing particles
          ctx.globalAlpha = 0.3;
          ctx.beginPath(); ctx.arc(Math.sin(now / 200) * 3, 4 + bob, 2 * scale, 0, PI2); ctx.fill();
          ctx.globalAlpha = 1;
          break;

        case 'beast': // four-legged wolf/hound shape
          // body horizontal
          ctx.fillRect(-6 * scale, -2 * scale + bob, 12 * scale, 5 * scale);
          // head
          ctx.beginPath(); ctx.arc(6 * scale, -3 * scale + bob, 3.5 * scale, 0, PI2); ctx.fill();
          // legs (animated)
          const legPhase = now / 120;
          ctx.fillRect(-5 * scale, 3 * scale + bob + Math.sin(legPhase) * 1.5, 2 * scale, 4 * scale);
          ctx.fillRect(-1 * scale, 3 * scale + bob + Math.sin(legPhase + 2) * 1.5, 2 * scale, 4 * scale);
          ctx.fillRect(2 * scale, 3 * scale + bob + Math.sin(legPhase + 4) * 1.5, 2 * scale, 4 * scale);
          ctx.fillRect(5 * scale, 3 * scale + bob + Math.sin(legPhase + 6) * 1.5, 2 * scale, 4 * scale);
          // eye
          ctx.fillStyle = '#ff4d6d';
          ctx.beginPath(); ctx.arc(7.5 * scale, -3.5 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
          break;

        case 'giant': // large humanoid (frost giant, demon)
          ctx.fillRect(-6 * scale, -5 * scale + bob, 12 * scale, 12 * scale); // massive torso
          ctx.beginPath(); ctx.arc(0, -8 * scale + bob, 5 * scale, 0, PI2); ctx.fill(); // head
          ctx.fillRect(-10 * scale, -4 * scale + bob, 4 * scale, 9 * scale); // left arm
          ctx.fillRect(6 * scale, -4 * scale + bob, 4 * scale, 9 * scale); // right arm
          // menacing eyes
          ctx.fillStyle = '#ff0000'; ctx.globalAlpha = 0.9;
          ctx.fillRect(-2 * scale, -9 * scale + bob, 1.5 * scale, 2 * scale);
          ctx.fillRect(0.5 * scale, -9 * scale + bob, 1.5 * scale, 2 * scale);
          ctx.globalAlpha = 1;
          break;

        case 'bat': // winged flapping creature
          {
            const wingFlap = Math.sin(now / 100) * 0.5;
            // body (small)
            ctx.beginPath(); ctx.ellipse(0, bob, 3 * scale, 2.5 * scale, 0, 0, PI2); ctx.fill();
            // wings
            ctx.beginPath();
            ctx.moveTo(0, -1 * scale + bob);
            ctx.quadraticCurveTo(-8 * scale, (-5 + wingFlap * 4) * scale + bob, -10 * scale, 0 + bob);
            ctx.lineTo(-3 * scale, 1 * scale + bob);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -1 * scale + bob);
            ctx.quadraticCurveTo(8 * scale, (-5 + wingFlap * 4) * scale + bob, 10 * scale, 0 + bob);
            ctx.lineTo(3 * scale, 1 * scale + bob);
            ctx.fill();
            // eyes
            ctx.fillStyle = '#ff4d6d'; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(-1 * scale, -0.5 * scale + bob, 0.8 * scale, 0, PI2); ctx.fill();
            ctx.beginPath(); ctx.arc(1 * scale, -0.5 * scale + bob, 0.8 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'wyrm': // serpentine dragon
          {
            // sinuous body segments
            for (let i = 0; i < 6; i++) {
              const seg = i * 3;
              const sx = Math.sin(now / 300 + i * 0.8) * 2 * scale;
              ctx.beginPath();
              ctx.arc(sx, (-6 + seg) * scale + bob, (4 - i * 0.4) * scale, 0, PI2);
              ctx.fill();
            }
            // horns
            ctx.fillRect(-4 * scale, -10 * scale + bob, 2 * scale, 3 * scale);
            ctx.fillRect(2 * scale, -10 * scale + bob, 2 * scale, 3 * scale);
            // glowing eyes
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(-1.5 * scale, -7 * scale + bob, 1.2 * scale, 0, PI2); ctx.fill();
            ctx.beginPath(); ctx.arc(1.5 * scale, -7 * scale + bob, 1.2 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'imp': // small winged fire creature
          {
            ctx.beginPath(); ctx.ellipse(0, bob, 3.5 * scale, 4 * scale, 0, 0, PI2); ctx.fill(); // body
            ctx.beginPath(); ctx.arc(0, -4.5 * scale + bob, 2.5 * scale, 0, PI2); ctx.fill(); // head
            // tiny wings
            const wf = Math.sin(now / 80) * 0.4;
            ctx.beginPath();
            ctx.moveTo(-2 * scale, -2 * scale + bob);
            ctx.lineTo(-7 * scale, (-4 + wf * 3) * scale + bob);
            ctx.lineTo(-3 * scale, 0 + bob);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2 * scale, -2 * scale + bob);
            ctx.lineTo(7 * scale, (-4 + wf * 3) * scale + bob);
            ctx.lineTo(3 * scale, 0 + bob);
            ctx.fill();
            // horns
            ctx.fillRect(-2.5 * scale, -7 * scale + bob, 1.5 * scale, 2.5 * scale);
            ctx.fillRect(1 * scale, -7 * scale + bob, 1.5 * scale, 2.5 * scale);
            ctx.fillStyle = '#ffe066'; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(0, -4.5 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'demon': // large winged demon (archdemon boss)
          {
            ctx.fillRect(-7 * scale, -5 * scale + bob, 14 * scale, 13 * scale); // torso
            ctx.beginPath(); ctx.arc(0, -8 * scale + bob, 5 * scale, 0, PI2); ctx.fill(); // head
            // large wings
            ctx.beginPath();
            ctx.moveTo(-5 * scale, -4 * scale + bob);
            ctx.lineTo(-14 * scale, -10 * scale + bob);
            ctx.lineTo(-12 * scale, 2 * scale + bob);
            ctx.lineTo(-5 * scale, 0 + bob);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(5 * scale, -4 * scale + bob);
            ctx.lineTo(14 * scale, -10 * scale + bob);
            ctx.lineTo(12 * scale, 2 * scale + bob);
            ctx.lineTo(5 * scale, 0 + bob);
            ctx.fill();
            // horns
            ctx.fillRect(-5 * scale, -13 * scale + bob, 2 * scale, 5 * scale);
            ctx.fillRect(3 * scale, -13 * scale + bob, 2 * scale, 5 * scale);
            // fire eyes
            ctx.fillStyle = '#ffe066'; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(-2 * scale, -8.5 * scale + bob, 1.5 * scale, 0, PI2); ctx.fill();
            ctx.beginPath(); ctx.arc(2 * scale, -8.5 * scale + bob, 1.5 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'caster': // robed magic user (lich, druid bosses)
          {
            // robe/cloak shape
            ctx.beginPath();
            ctx.moveTo(0, -10 * scale + bob);
            ctx.lineTo(6 * scale, 0 + bob);
            ctx.lineTo(5 * scale, 8 * scale + bob);
            ctx.lineTo(-5 * scale, 8 * scale + bob);
            ctx.lineTo(-6 * scale, 0 + bob);
            ctx.closePath();
            ctx.fill();
            // hood
            ctx.beginPath(); ctx.arc(0, -8 * scale + bob, 4 * scale, Math.PI, 0); ctx.fill();
            // staff (line)
            ctx.strokeStyle = col; ctx.lineWidth = 2 * scale;
            ctx.beginPath(); ctx.moveTo(6 * scale, -6 * scale + bob); ctx.lineTo(8 * scale, 6 * scale + bob); ctx.stroke();
            // orb on staff
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
            ctx.beginPath(); ctx.arc(6 * scale, -7 * scale + bob, 2 * scale, 0, PI2); ctx.fill();
            // glowing eyes under hood
            ctx.fillStyle = e.color; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(-1.5 * scale, -7 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
            ctx.beginPath(); ctx.arc(1.5 * scale, -7 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'void': // shifting amorphous void creature
          {
            ctx.globalAlpha = 0.7 + 0.2 * Math.sin(now / 200);
            // shifting blob shape
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = i * PI2 / 8 + now / 1000;
              const r = (4 + Math.sin(now / 200 + i * 2) * 1.5) * scale;
              if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + bob);
              else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + bob);
            }
            ctx.closePath(); ctx.fill();
            // void eye
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(0, -1 * scale + bob, 2 * scale, 0, PI2); ctx.fill();
            ctx.fillStyle = '#0d0d1a'; ctx.beginPath(); ctx.arc(0, -1 * scale + bob, 1 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'weaver': // geometric nullweaver with rotating rings
          {
            // central diamond body
            ctx.beginPath();
            ctx.moveTo(0, -7 * scale + bob);
            ctx.lineTo(5 * scale, 0 + bob);
            ctx.lineTo(0, 7 * scale + bob);
            ctx.lineTo(-5 * scale, 0 + bob);
            ctx.closePath(); ctx.fill();
            // rotating ring
            ctx.strokeStyle = col; ctx.lineWidth = 1.5 * scale;
            ctx.beginPath();
            ctx.ellipse(0, bob, 7 * scale, 7 * scale, now / 1000, 0, PI2);
            ctx.stroke();
            // inner eye
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(0, bob, 2 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'crystal': // geometric hexagonal crystal sentinel
          {
            // hexagon body
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = i * PI2 / 6 - Math.PI / 6;
              const r = 6 * scale;
              if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + bob);
              else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + bob);
            }
            ctx.closePath(); ctx.fill();
            // inner hex (darker)
            ctx.fillStyle = '#8888cc';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = i * PI2 / 6 + now / 2000;
              const r = 3 * scale;
              if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + bob);
              else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + bob);
            }
            ctx.closePath(); ctx.fill();
            // glow point
            ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 300);
            ctx.beginPath(); ctx.arc(0, bob, 1.5 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        case 'voidlord': // massive void entity with tentacles
          {
            // main body orb
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(0, bob, 7 * scale, 0, PI2); ctx.fill();
            // tentacles
            ctx.strokeStyle = col; ctx.lineWidth = 2.5 * scale; ctx.globalAlpha = 0.6;
            for (let i = 0; i < 6; i++) {
              const a = i * PI2 / 6 + now / 800;
              const r1 = 7 * scale, r2 = 13 * scale;
              const wobble = Math.sin(now / 250 + i * 2) * 2;
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 + bob);
              ctx.quadraticCurveTo(
                Math.cos(a + 0.3) * (r1 + r2) / 2 + wobble,
                Math.sin(a + 0.3) * (r1 + r2) / 2 + bob,
                Math.cos(a) * r2, Math.sin(a) * r2 + bob
              );
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
            // crown of eyes
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 5; i++) {
              const a = i * PI2 / 5 + now / 1200;
              ctx.beginPath(); ctx.arc(Math.cos(a) * 3.5 * scale, Math.sin(a) * 3.5 * scale + bob, 1.2 * scale, 0, PI2); ctx.fill();
            }
            // central void eye
            ctx.fillStyle = '#0d0d1a';
            ctx.beginPath(); ctx.arc(0, bob, 3 * scale, 0, PI2); ctx.fill();
            ctx.fillStyle = '#b388ff'; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(0, bob, 1.5 * scale, 0, PI2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;

        default: // fallback — basic melee/ranged shapes
          if (e.attackKind === 'melee') {
            ctx.fillRect(-4 * scale, -3 * scale + bob, 8 * scale, 8 * scale);
            ctx.beginPath(); ctx.arc(0, -6 * scale + bob, 4 * scale, 0, PI2); ctx.fill();
            ctx.fillRect(-8 * scale, -2 * scale + bob, 3 * scale, 6 * scale);
            ctx.fillRect(5 * scale, -2 * scale + bob, 3 * scale, 6 * scale);
          } else {
            ctx.beginPath();
            ctx.moveTo(0, -10 * scale + bob);
            ctx.lineTo(5 * scale, 2 * scale + bob);
            ctx.lineTo(3 * scale, 8 * scale + bob);
            ctx.lineTo(-3 * scale, 8 * scale + bob);
            ctx.lineTo(-5 * scale, 2 * scale + bob);
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -8 * scale + bob, 4 * scale, 0, PI2); ctx.fill();
          }
          break;
      }

      // frozen overlay
      if (e.frozen > 0) {
        ctx.strokeStyle = '#6df1ff';
        ctx.lineWidth = 1.8;
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
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(e.name.toUpperCase(), 0, barY - 10);
        ctx.fillStyle = '#fff';
        ctx.fillText(e.name.toUpperCase(), 0, barY - 10);
      }
      // Elite label (smaller than boss)
      if (isElite && !isBoss) {
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        const label = `${(e.eliteAffix || '').toUpperCase()} ${e.name.toUpperCase()}`;
        ctx.strokeText(label, 0, barY - 8);
        ctx.fillStyle = e.eliteColor || '#ffd166';
        ctx.fillText(label, 0, barY - 8);
      }
      // Status effect icons (small chips above HP bar)
      if (e.statusEffects) {
        let iconX = -barW / 2;
        const iconY = barY - (isElite || isBoss ? 18 : 8);
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (e.statusEffects.burn) {
          ctx.fillStyle = '#ff6644';
          ctx.fillText('🔥', iconX, iconY); iconX += 10;
        }
        if (e.statusEffects.poison) {
          ctx.fillStyle = '#51e6a4';
          ctx.fillText(`☠${e.statusEffects.poison.stacks}`, iconX, iconY); iconX += 14;
        }
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

  function drawItemShape(icon, col, pulse, now) {
    // Draw a distinct shape based on item type icon
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    switch (icon) {
      case '⚔': // Sword
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.stroke(); // blade
        ctx.fillRect(-4, 2, 8, 2); // crossguard
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(-1, -8); ctx.lineTo(0, -11); ctx.lineTo(1, -8); ctx.fill(); // tip
        ctx.globalAlpha = 1;
        break;
      case '✦': // Staff
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -6); ctx.stroke(); // shaft
        ctx.beginPath(); ctx.arc(0, -8, 3.5, 0, PI2); ctx.fill(); // orb
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(0, -8, 1.5, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case '➹': // Bow
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(-2, 0, 8, -1.3, 1.3); ctx.stroke(); // limbs
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-2 + 8 * Math.cos(-1.3), 8 * Math.sin(-1.3));
        ctx.lineTo(-2 + 8 * Math.cos(1.3), 8 * Math.sin(1.3));
        ctx.stroke(); // string
        break;
      case '☠': // Wand
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(1.5, 0, 0, -5); ctx.stroke(); // twisted shaft
        ctx.beginPath(); ctx.arc(0, -7, 3, 0, PI2); ctx.fill(); // skull
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-1, -7.5, 0.8, 0, PI2); ctx.arc(1, -7.5, 0.8, 0, PI2); ctx.fill();
        break;
      case '◇': // Armor (chestplate shape)
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(6, -4); ctx.lineTo(6, 4);
        ctx.lineTo(3, 7); ctx.lineTo(-3, 7); ctx.lineTo(-6, 4);
        ctx.lineTo(-6, -4); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000'; ctx.globalAlpha = 0.3;
        ctx.fillRect(-3, -3, 6, 5); // inner
        ctx.globalAlpha = 1;
        break;
      case '◆': // Helmet
        ctx.beginPath();
        ctx.arc(0, 0, 6, Math.PI, 0); ctx.fill(); // dome
        ctx.fillRect(-6, 0, 12, 3); // brim
        // visor slit
        ctx.fillStyle = '#000'; ctx.globalAlpha = 0.5;
        ctx.fillRect(-3, -2, 6, 2);
        ctx.globalAlpha = 1;
        break;
      case '⊡': // Shield
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, -4); ctx.lineTo(6, 4);
        ctx.lineTo(0, 8); ctx.lineTo(-6, 4); ctx.lineTo(-6, -4);
        ctx.closePath(); ctx.fill();
        // shield boss
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case '◈': // Boots (or amulet — same icon)
        // draw as gem/amulet shape
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(0, -1, 1.5, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case '○': // Ring
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, PI2); ctx.stroke();
        // gemstone on top
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, -5, 2, 0, PI2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(0, -5.5, 0.8, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      default: // fallback diamond
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0);
        ctx.closePath(); ctx.fill();
        break;
    }
  }

  function drawItems() {
    const now = performance.now();
    const C = CFG.canvas;
    for (const gi of game.items) {
      const s = w2s(gi.x, gi.y);
      if (s.x < -40 || s.x > C + 40 || s.y < -40 || s.y > C + 40) continue;  // viewport cull
      const pulse = 0.7 + 0.3 * Math.sin(now / 220 + gi.x);
      const float = Math.sin(now / 400 + gi.y * 3) * 2;
      ctx.save();
      ctx.translate(s.x, s.y + float);
      const r = ITEM_BASES[gi.item.baseId];
      const isMythic = gi.item.rarity === 'mythic';
      const col = isMythic ? mythicShimmer(now, gi.x) : rarityColor(gi.item.rarity);
      // ground glow
      ctx.fillStyle = col;
      ctx.globalAlpha = (isMythic ? 0.2 : 0.12) * pulse;
      ctx.beginPath();
      ctx.ellipse(0, 8 - float, isMythic ? 16 : 12, isMythic ? 5 : 4, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // rarity beam (for rare+ items)
      if (gi.item.rarity === 'rare' || gi.item.rarity === 'unique' || isMythic) {
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.15 + 0.12 * Math.sin(now / 300);
        ctx.lineWidth = isMythic ? 3 : (gi.item.rarity === 'unique' ? 2.5 : 1.5);
        ctx.beginPath();
        ctx.moveTo(0, isMythic ? -28 : -22);
        ctx.lineTo(0, 12);
        ctx.stroke();
        // unique/mythic: add side beams
        if (gi.item.rarity === 'unique' || isMythic) {
          ctx.beginPath();
          ctx.moveTo(-4, -16); ctx.lineTo(0, isMythic ? -28 : -22); ctx.lineTo(4, -16);
          ctx.stroke();
        }
        // mythic: a second crossing beam for a prismatic burst
        if (isMythic) {
          ctx.strokeStyle = mythicShimmer(now, gi.x + 2);
          ctx.beginPath();
          ctx.moveTo(-7, -18); ctx.lineTo(7, -18);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // Draw the actual item shape
      drawItemShape(r ? r.icon : '◆', col, pulse, now);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      const t = 1 - p.age / p.life;
      const s = w2s(p.x, p.y);
      if (s.x < -10 || s.x > 610 || s.y < -10 || s.y > 610) continue;
      ctx.globalAlpha = clamp(t * t, 0, 1);
      ctx.fillStyle = p.color;
      const sizeT = p.size * (0.5 + 0.5 * t);
      if (p.size > 2) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 4);
        ctx.beginPath();
        ctx.moveTo(0, -sizeT);
        ctx.lineTo(sizeT * 0.6, 0);
        ctx.lineTo(0, sizeT);
        ctx.lineTo(-sizeT * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, sizeT, 0, PI2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawInteractionHints() {
    if (!game.world) return;
    const now = performance.now();
    const showHint = (wx, wy, label) => {
      const s = w2sUI(wx, wy, 1.2);
      const bounce = Math.sin(now / 300) * 2;
      ctx.save();
      ctx.translate(s.x, s.y - 28 + bounce);
      ctx.font = 'bold 11px sans-serif';
      const padX = 10, h = 20;
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
      ctx.stroke();
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
    } else if (game.nearbyShrine) {
      const def = SHRINES[game.nearbyShrine.type];
      if (def) showHint(game.nearbyShrine.x, game.nearbyShrine.y - 0.4, `PINCH · ${def.name}`);
    }
  }

  function drawFloatingTexts() {
    const layer = $('floating-text');
    if (!layer) return;
    for (const t of game.floatingTexts) {
      const s = w2sUI(t.wx, t.wy, 1.35);
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
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  // Vignette — subtle darkness at screen edges + damage flash
  let _vignetteGrad = null;
  function drawVignette() {
    const W = CFG.canvas;
    const isTown = game.world && game.world.kind === 'town';
    // Player-centred torch light — bright near the hero, fading to darkness at the edges
    let cx = W / 2, cy = W / 2;
    if (game.world && game.world.player) {
      const ps = w2s(game.world.player.x, game.world.player.y);
      cx = ps.x; cy = ps.y;
    }
    const outerDark = isTown ? 0.32 : 0.6;
    // Cache the gradient — the player is screen-centred most frames (camera follows),
    // so this is rebuilt only when the light actually moves (map edges) or the zone changes.
    const kcx = Math.round(cx), kcy = Math.round(cy);
    if (!drawVignette._g || drawVignette._kx !== kcx || drawVignette._ky !== kcy || drawVignette._kd !== outerDark) {
      const g2 = ctx.createRadialGradient(kcx, kcy, W * 0.09, kcx, kcy, W * 0.6);
      g2.addColorStop(0,    'rgba(0,0,0,0)');
      g2.addColorStop(0.55, 'rgba(0,0,0,' + (outerDark * 0.28).toFixed(3) + ')');
      g2.addColorStop(1,    'rgba(0,0,0,' + outerDark.toFixed(3) + ')');
      drawVignette._g = g2; drawVignette._kx = kcx; drawVignette._ky = kcy; drawVignette._kd = outerDark;
    }
    ctx.fillStyle = drawVignette._g;
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
    return ({ common: '#cfcfcf', magic: '#6db4ff', rare: '#ffe066', unique: '#ff8c42', mythic: '#f062ff' })[r] || '#fff';
  }
  // Mythic items shimmer through a prismatic gradient over time.
  function mythicShimmer(now, offset) {
    const hues = ['#f062ff', '#6df1ff', '#ffd166', '#ff4d6d', '#9bff8a'];
    const f = ((now / 600) + (offset || 0)) % hues.length;
    return hues[Math.floor(f)];
  }

  // ---- Gear "looks": legendary/mythic items visibly transform the character ----
  // weapon looks add an elemental FX to the weapon + tint the aura;
  // armor looks add a body cosmetic (cape / wings / crown / halo / etc).
  const GEAR_LOOKS = {
    // weapon elemental signatures
    flame:    { color: '#ff6a2c', slot: 'weapon', fx: 'fire' },
    demon:    { color: '#ff3355', slot: 'weapon', fx: 'fire' },
    frost:    { color: '#9be8ff', slot: 'weapon', fx: 'ice' },
    void:     { color: '#b388ff', slot: 'weapon', fx: 'void' },
    storm:    { color: '#7fd4ff', slot: 'weapon', fx: 'spark' },
    shadow:   { color: '#9a6cff', slot: 'weapon', fx: 'smoke' },
    soul:     { color: '#7dffb0', slot: 'weapon', fx: 'wisp' },
    star:     { color: '#ffe27a', slot: 'weapon', fx: 'spark' },
    bone:     { color: '#e8e2cf', slot: 'weapon', fx: 'wisp' },
    // armor body cosmetics
    cape:     { color: '#9a6cff', slot: 'armor', body: 'cape' },
    wings:    { color: '#ff8c42', slot: 'armor', body: 'wings' },
    crown:    { color: '#ffd166', slot: 'armor', body: 'crown' },
    halo:     { color: '#9be8ff', slot: 'armor', body: 'halo' },
    spectral: { color: '#7dffb0', slot: 'armor', body: 'spectral' },
    plate:    { color: '#cfd6e6', slot: 'armor', body: 'plate' },
    // generic rarity-driven defaults (items with no specific look)
    __legend: { color: '#ff8c42', slot: 'aura' },
    __mythic: { color: '#f062ff', slot: 'aura', prismatic: true },
  };
  // Resolve the look id for an equipped item (base look, else rarity default).
  function gearLook(item) {
    if (!item) return null;
    const base = ITEM_BASES[item.baseId];
    if (base && base.look && GEAR_LOOKS[base.look]) return base.look;
    if (item.rarity === 'mythic') return '__mythic';
    if (item.rarity === 'unique') return '__legend';
    return null;
  }

  // ---- Wardrobe / Transmog: collect selectable appearances; apply to equipped gear ----
  function lookIsWeaponAppearance(id) { const d = GEAR_LOOKS[id]; return !!(d && d.slot === 'weapon' && d.fx); }
  function lookIsArmorAppearance(id) { const d = GEAR_LOOKS[id]; return !!(d && d.slot === 'armor' && d.body); }
  function collectLook(item) {
    if (!item || !game.save) return;
    const id = gearLook(item);
    if (!id) return;
    if (lookIsWeaponAppearance(id) || lookIsArmorAppearance(id)) {
      if (!game.save.wardrobe) game.save.wardrobe = {};
      game.save.wardrobe[id] = true;
    }
  }
  function scanWardrobe() {
    if (!game.char) return;
    const c = game.char;
    const all = [c.equip.weapon, c.equip.armor, c.equip.ring, c.equip.amulet]
      .concat(c.inventory || []).concat((game.save && game.save.stash) || []);
    for (const it of all) collectLook(it);
  }
  function renderWardrobe() {
    const c = game.char; if (!c) return;
    if (!c.transmog) c.transmog = { weapon: null, armor: null };
    const wb = (game.save && game.save.wardrobe) || {};
    const capId = s => s.charAt(0).toUpperCase() + s.slice(1);
    const mk = (slot, id, label, color, active) =>
      '<button class="nav-item focusable" data-action="wardrobe-set" data-slot="' + slot + '" data-look="' + id + '" style="display:flex;justify-content:space-between;align-items:center;' + (active ? 'outline:2px solid ' + (color || '#6df1ff') + ';outline-offset:-2px;' : '') + '">' +
      '<span>' + label + (active ? ' ✓' : '') + '</span>' +
      (color ? '<span style="width:14px;height:14px;border-radius:3px;background:' + color + ';box-shadow:0 0 6px ' + color + ';"></span>' : '') + '</button>';
    let wh = mk('weapon', 'default', "Default (item's own)", '', !c.transmog.weapon);
    let aw = 0;
    for (const id in GEAR_LOOKS) if (lookIsWeaponAppearance(id) && wb[id]) { wh += mk('weapon', id, capId(id) + ' · ' + GEAR_LOOKS[id].fx, GEAR_LOOKS[id].color, c.transmog.weapon === id); aw++; }
    if (!aw) wh += '<p style="font-size:11px;opacity:0.5;padding:4px;">Find weapons with elemental looks (e.g. Frostbite Edge) to unlock more.</p>';
    $('wardrobe-weapon').innerHTML = wh;
    let ah = mk('armor', 'default', "Default (item's own)", '', !c.transmog.armor);
    let aa = 0;
    for (const id in GEAR_LOOKS) if (lookIsArmorAppearance(id) && wb[id]) { ah += mk('armor', id, capId(id), GEAR_LOOKS[id].color, c.transmog.armor === id); aa++; }
    if (!aa) ah += '<p style="font-size:11px;opacity:0.5;padding:4px;">Find armor with looks (cape, wings, halo…) to unlock more.</p>';
    $('wardrobe-armor').innerHTML = ah;
  }
  function openMercenary() { navigateTo('mercenary'); }
  function renderMercenary() {
    const box = $('mercenary-content'); if (!box) return;
    const c = game.char; const h = c.hireling;
    let html = '<p style="font-size:11px;opacity:0.6;text-align:center;">Hire a companion to fight at your side in the depths.</p>';
    if (h && HIRELING_TYPES[h.type]) {
      const t = HIRELING_TYPES[h.type];
      const mul = 1 + (h.level - 1) * 0.25 + ((c.level || 1) - 1) * 0.08;
      const upCost = hirelingUpgradeCost(h.level);
      html += '<div class="nav-item" style="flex-direction:column;align-items:flex-start;gap:2px;"><div style="color:' + t.color + ';font-weight:bold;">&#9876; ' + t.name + ' &middot; Lv ' + h.level + '</div>'
        + '<div style="font-size:11px;opacity:0.7;">HP ' + Math.floor(t.hp * mul) + ' &middot; DMG ' + Math.floor(t.dmg * mul) + ' &middot; ' + (t.ranged ? 'Ranged' : 'Melee') + '</div></div>';
      html += '<button class="nav-item focusable" data-action="hireling-upgrade">Upgrade to Lv ' + (h.level + 1) + ' &mdash; ' + upCost + 'g</button>';
      html += '<button class="nav-item focusable" data-action="hireling-dismiss">Dismiss Companion</button>';
    } else {
      for (const id in HIRELING_TYPES) {
        const t = HIRELING_TYPES[id];
        html += '<button class="nav-item focusable" data-action="hireling-recruit" data-type="' + id + '" style="flex-direction:column;align-items:flex-start;gap:2px;">'
          + '<div style="color:' + t.color + ';font-weight:bold;">&#9876; ' + t.name + ' &mdash; ' + t.cost + 'g</div>'
          + '<div style="font-size:11px;opacity:0.7;">' + t.desc + ' &middot; HP ' + t.hp + ' DMG ' + t.dmg + '</div></button>';
      }
    }
    html += '<div style="font-size:12px;opacity:0.7;text-align:center;margin-top:8px;">Gold: ' + c.gold + '</div>';
    box.innerHTML = html;
  }
  function renderVictory() {
    const c = game.char; const box = $('victory-stats');
    if (!box || !c) return;
    const cls = (CLASSES[c.classId] && CLASSES[c.classId].name) || c.classId;
    box.innerHTML = cls + ' &middot; Level ' + c.level + (c.paragonLevel ? ' &middot; Paragon ' + c.paragonLevel : '')
      + (c.hardcore ? '<br><span style="color:#ff6b85;">&#9760; Hardcore Hero</span>' : '');
  }

  function itemTypeLabel(base) {
    // Check type first for non-equipment categories
    if (base.type === 'gem') return 'Gem';
    if (base.type === 'consumable') return 'Consumable';
    const icon = base.icon;
    if (icon === '⚔') return 'Sword';
    if (icon === '✦') return 'Staff';
    if (icon === '➹') return 'Bow';
    if (icon === '☠') return 'Wand';
    if (icon === '◇') return 'Armor';
    if (icon === '◆') return 'Helmet';
    if (icon === '⊡') return 'Shield';
    if (icon === '◈') return base.type === 'amulet' ? 'Amulet' : 'Boots';
    if (icon === '○') return 'Ring';
    return base.type;
  }

  function renderItemIcon(icon, color, rarity) {
    // Returns an SVG string for the item icon used in inventory UI
    const w = 28, h = 28;
    const cx = w/2, cy = h/2;
    const glow = (rarity === 'unique' || rarity === 'mythic') ? `filter="url(#glow)"` : (rarity === 'rare' ? `filter="url(#glowSm)"` : '');
    let shape = '';
    switch (icon) {
      case '⚔': // Sword
        shape = `<line x1="${cx}" y1="${cy+8}" x2="${cx}" y2="${cy-8}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" ${glow}/>` +
          `<line x1="${cx-4}" y1="${cy+2}" x2="${cx+4}" y2="${cy+2}" stroke="${color}" stroke-width="2"/>` +
          `<polygon points="${cx-1},${cy-8} ${cx},${cy-11} ${cx+1},${cy-8}" fill="#fff" opacity="0.7"/>`;
        break;
      case '✦': // Staff
        shape = `<line x1="${cx}" y1="${cy+8}" x2="${cx}" y2="${cy-4}" stroke="${color}" stroke-width="2" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy-7}" r="4" fill="${color}" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy-7}" r="1.5" fill="#fff" opacity="0.7"/>`;
        break;
      case '➹': // Bow
        shape = `<path d="M${cx-2},${cy-7} Q${cx+6},${cy} ${cx-2},${cy+7}" fill="none" stroke="${color}" stroke-width="2.5" ${glow}/>` +
          `<line x1="${cx-2}" y1="${cy-6}" x2="${cx-2}" y2="${cy+6}" stroke="#fff" stroke-width="0.8" opacity="0.6"/>`;
        break;
      case '☠': // Wand
        shape = `<path d="M${cx},${cy+6} Q${cx+2},${cy} ${cx},${cy-4}" fill="none" stroke="${color}" stroke-width="2" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy-6}" r="3.5" fill="${color}" ${glow}/>` +
          `<circle cx="${cx-1}" cy="${cy-6.5}" r="0.8" fill="#000"/>` +
          `<circle cx="${cx+1}" cy="${cy-6.5}" r="0.8" fill="#000"/>`;
        break;
      case '◇': // Armor
        shape = `<polygon points="${cx},${cy-8} ${cx+6},${cy-4} ${cx+6},${cy+3} ${cx+3},${cy+7} ${cx-3},${cy+7} ${cx-6},${cy+3} ${cx-6},${cy-4}" fill="${color}" ${glow}/>` +
          `<rect x="${cx-3}" y="${cy-3}" width="6" height="4" fill="#000" opacity="0.3"/>`;
        break;
      case '◆': // Helmet
        shape = `<path d="M${cx-6},${cy+2} L${cx-6},${cy-2} Q${cx},${cy-9} ${cx+6},${cy-2} L${cx+6},${cy+2} Z" fill="${color}" ${glow}/>` +
          `<rect x="${cx-3}" y="${cy-1}" width="6" height="2" fill="#000" opacity="0.4"/>`;
        break;
      case '⊡': // Shield
        shape = `<polygon points="${cx},${cy-8} ${cx+6},${cy-4} ${cx+6},${cy+3} ${cx},${cy+8} ${cx-6},${cy+3} ${cx-6},${cy-4}" fill="${color}" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#fff" opacity="0.35"/>`;
        break;
      case '◈': // Boots/Amulet (diamond gem)
        shape = `<polygon points="${cx},${cy-6} ${cx+5},${cy} ${cx},${cy+6} ${cx-5},${cy}" fill="${color}" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy-1}" r="1.5" fill="#fff" opacity="0.4"/>`;
        break;
      case '○': // Ring
        shape = `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${color}" stroke-width="2.5" ${glow}/>` +
          `<circle cx="${cx}" cy="${cy-5}" r="2.2" fill="${color}"/>` +
          `<circle cx="${cx}" cy="${cy-5.5}" r="0.8" fill="#fff" opacity="0.6"/>`;
        break;
      default:
        shape = `<polygon points="${cx},${cy-6} ${cx+6},${cy} ${cx},${cy+6} ${cx-6},${cy}" fill="${color}" ${glow}/>`;
    }
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glowSm"><feGaussianBlur stdDeviation="1.2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      ${shape}
    </svg>`;
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
    const skillName = SKILLS[getActiveSkillId()].name;
    $('hud-skill-name').textContent = skillName;
    const cdEl = $('hud-skill-cd');
    const p = game.world ? game.world.player : null;
    if (p) {
      if (p.skillCd > 0) { cdEl.textContent = p.skillCd.toFixed(1) + 's'; cdEl.classList.remove('ready'); }
      else { cdEl.textContent = 'READY'; cdEl.classList.add('ready'); }
    }
    $('hud-zone').textContent = game.world ? game.world.name : '—';
    // Greater Rift timer + progress
    const riftEl = $('hud-rift');
    if (riftEl) {
      if (game.rift && game.rift.active) {
        const t = Math.max(0, Math.ceil(game.rift.timeLeft));
        const low = t <= 20;
        const prog = Math.min(game.rift.kills, game.rift.killsNeeded);
        riftEl.classList.remove('hidden');
        riftEl.classList.toggle('low', low);
        riftEl.innerHTML = `⏱ ${t}s · ${prog}/${game.rift.killsNeeded}`;
      } else {
        riftEl.classList.add('hidden');
      }
    }
    // Active shrine buffs (icon + remaining seconds)
    const buffsEl = $('hud-buffs');
    if (buffsEl) {
      const buffs = game.activeBuffs || {};
      const labelFor = { damage: { icon: '⚔', name: 'Fury',    color: '#ff6644' },
                         mana:   { icon: '✦', name: 'Arcana',  color: '#6df1ff' },
                         invuln: { icon: '◇', name: 'Warding', color: '#ffd166' } };
      let html = '';
      for (const k in buffs) {
        const m = labelFor[k];
        if (!m) continue;
        const t = Math.max(0, Math.ceil(buffs[k]));
        html += `<div class="hud-buff" style="border-color:${m.color};color:${m.color}">${m.icon} ${m.name} ${t}s</div>`;
      }
      // Active curses (player debuffs) — shown as red-tinted timed chips
      const pl = game.world && game.world.player;
      if (pl && pl.curses) {
        for (const k in pl.curses) {
          const def = CURSES[k];
          if (!def || pl.curses[k] <= 0) continue;
          const t = Math.max(0, Math.ceil(pl.curses[k]));
          html += `<div class="hud-buff hud-curse" style="border-color:${def.color};color:${def.color}">${def.icon} ${def.name} ${t}s</div>`;
        }
      }
      buffsEl.innerHTML = html;
    }
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
    if (id === 'class-select') refreshHardcoreLabel();
    if (id === 'honor') renderHonor();
    if (id === 'wardrobe') renderWardrobe();
    if (id === 'mercenary') renderMercenary();
    if (id === 'victory') renderVictory();
    if (id === 'death') {
      const hc = game._permadeath;
      const gl = $('death-glyph'), ti = $('death-title'), su = $('death-sub'), bt = $('death-return-btn');
      if (gl) gl.textContent = hc ? '☠' : '✶';
      if (ti) ti.textContent = hc ? 'Fallen forever.' : 'You have fallen.';
      if (su) su.textContent = hc ? 'Your Hardcore hero is gone — but enshrined in the Roll of Honor.' : 'Your soul drifts back to the Sanctuary.';
      if (bt) bt.textContent = hc ? 'Return to Title' : 'Return to Town';
    }
    if (id === 'inventory') renderInventory();
    if (id === 'character') renderCharacter();
    if (id === 'skills') renderSkills();
    if (id === 'passives') renderPassives();
    if (id === 'gem-socket') renderGemSocket();
    if (id === 'mystery-vendor') renderMysteryVendor();
    if (id === 'quests') renderQuests();
    if (id === 'bestiary') renderBestiary();
    if (id === 'upgrades') renderUpgrades();
    if (id === 'menu') {
      const inRift = !!(game.world && game.world.isRift);
      // only show "Return to Town" if we're in a dungeon (or "Leave Rift" in a rift)
      const btn = $('menu-town-btn');
      if (game.world && game.world.kind === 'dungeon') {
        btn.textContent = inRift ? 'Leave Rift (bank rewards)' : 'Return to Town';
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
      // Passives button — only show after level 10, with tome count badge
      const passivesBtn = $('menu-passives-btn');
      if (game.char && game.char.level >= 10) {
        const tomes = game.char.tomes || 0;
        passivesBtn.textContent = tomes > 0 ? `Passives (${tomes} tome${tomes === 1 ? '' : 's'})` : 'Passives';
        passivesBtn.classList.remove('hidden');
      } else {
        passivesBtn.classList.add('hidden');
      }
      // Sanctuary Scroll button — only in a normal dungeon (not rifts), shows count
      const scrollBtn = $('menu-scroll-btn');
      if (game.world && game.world.kind === 'dungeon' && !inRift) {
        const count = game.char.sanctuaryScrolls || 0;
        scrollBtn.textContent = count > 0
          ? `Use Sanctuary Scroll (${count})`
          : 'Sanctuary Scroll (0 — buy from vendor)';
        if (count > 0) scrollBtn.classList.remove('disabled');
        else scrollBtn.classList.add('disabled');
        scrollBtn.classList.remove('hidden');
      } else {
        scrollBtn.classList.add('hidden');
      }
      // Return-to-Dungeon button — only in town when a saved dungeon exists
      const returnBtn = $('menu-return-dungeon-btn');
      if (game.world && game.world.kind === 'town' && game.save && game.save.savedDungeon) {
        const sd = game.save.savedDungeon;
        const biome = BIOMES.find(b => b.id === sd.biomeId);
        const biomeName = biome ? biome.shortName : 'Dungeon';
        returnBtn.textContent = `Return to ${biomeName} Floor ${sd.floor}`;
        returnBtn.classList.remove('hidden');
      } else {
        returnBtn.classList.add('hidden');
      }
      // Update touch-controls toggle button label to reflect current state
      const tBtn = $('menu-touch-toggle-btn');
      if (tBtn) {
        const tRoot = document.getElementById('touch-controls');
        const isOn = tRoot && !tRoot.classList.contains('hidden');
        tBtn.textContent = `Touch Controls: ${isOn ? 'ON' : 'OFF'}`;
      }
      // Update auto-potion toggle button label
      const apBtn = $('menu-autopotion-btn');
      if (apBtn && game.char) {
        const pct = Math.round((game.char.autoPotionPct || 0.35) * 100);
        apBtn.textContent = game.char.autoPotion ? `Auto-Potion: ON (${pct}%)` : 'Auto-Potion: OFF';
      }
      // Update 3D renderer toggle label (3D is the default)
      const rBtn = $('menu-render-btn');
      if (rBtn) rBtn.textContent = (localStorage.getItem('hl_render') !== '2d') ? 'Graphics: 3D' : 'Graphics: 2D';
      const sBtn = $('menu-sound-btn');
      if (sBtn) sBtn.textContent = 'Sound: ' + (!window.__AUDIO || window.__AUDIO.isEnabled() ? 'ON' : 'OFF');
    }
    if (id === 'sync') {
      // Reset all fields on entry so the user starts with a clean slate
      const exBox = document.getElementById('sync-export-box');
      const imBox = document.getElementById('sync-import-box');
      if (exBox) exBox.value = '';
      if (imBox) imBox.value = '';
      const codeBox = document.getElementById('sync-short-code');
      if (codeBox) { codeBox.textContent = ''; codeBox.classList.add('muted'); }
      const shortInput = document.getElementById('sync-short-input');
      if (shortInput) shortInput.value = '';
    }
    if (id === 'code-picker') {
      renderCodePicker();
    }
    if (id === 'vendor') renderVendor();
    if (id === 'stash') renderStash();
    if (id === 'waypoint') renderWaypoint();
    if (id === 'game') {
      // ensure no stale movement state when returning to game (e.g. from menu)
      game.keys = {};
      game.tapped = {};
      if (game.world && game.world.player) {
        game.world.player._impulseT = 0;
        game.world.player._impulseX = 0;
        game.world.player._impulseY = 0;
      }
      // Set time-based guard — block ALL input for 200ms after returning to game.
      // This catches any stale EMG wristband gestures or lingering key events.
      game._menuReturnGuardUntil = performance.now() + 200;
      updateHud();
    }
  }

  function renderTitle() {
    const cont = $('title-continue');
    if (game.save) cont.classList.remove('disabled');
    else cont.classList.add('disabled');
    // Build the drifting ember field once (cosmetic — plain Math.random is fine)
    const field = $('title-embers');
    if (field && !field.childElementCount) {
      const colors = ['#6df1ff', '#c489ff', '#ffc857', '#9bd0ff', '#ff77ff'];
      for (let i = 0; i < 16; i++) {
        const e = document.createElement('div');
        e.className = 'ember';
        const sz = (1.4 + Math.random() * 3).toFixed(1);
        const col = colors[(Math.random() * colors.length) | 0];
        const dur = 7 + Math.random() * 9;
        e.style.left = (Math.random() * 100).toFixed(1) + '%';
        e.style.width = e.style.height = sz + 'px';
        e.style.background = col;
        e.style.boxShadow = `0 0 ${Math.round(5 + sz * 2)}px ${col}`;
        e.style.animationDuration = dur.toFixed(1) + 's';
        e.style.animationDelay = (-Math.random() * dur).toFixed(1) + 's';
        field.appendChild(e);
      }
    }
  }

  function renderInventory() {
    const c = game.char;
    $('inv-gold').textContent = c.gold;
    setEquip('eq-weapon', c.equip.weapon);
    setEquip('eq-armor', c.equip.armor);
    setEquip('eq-ring', c.equip.ring);
    setEquip('eq-amulet', c.equip.amulet);
    const list = $('inv-list'); list.innerHTML = '';
    // Consumables & materials are counters (not bag items) — surface them here so
    // bought potions etc. are visible. Auto-used as needed; not manually equippable.
    const consum = document.createElement('div');
    consum.className = 'inv-consumables';
    consum.innerHTML =
      `<div class="consum-chip"><span style="color:var(--crimson)">♥</span> <b>${c.potions || 0}</b> Potion${(c.potions || 0) === 1 ? '' : 's'}</div>` +
      `<div class="consum-chip"><span style="color:var(--gold)">✉</span> <b>${c.sanctuaryScrolls || 0}</b> Scroll${(c.sanctuaryScrolls || 0) === 1 ? '' : 's'}</div>` +
      `<div class="consum-chip"><span class="rarity-unique">◊</span> <b>${c.glassTears || 0}</b> Tear${(c.glassTears || 0) === 1 ? '' : 's'}</div>` +
      `<div class="consum-chip"><span class="rarity-unique">✦</span> <b>${c.tomes || 0}</b> Tome${(c.tomes || 0) === 1 ? '' : 's'}</div>` +
      `<div class="consum-chip"><span class="rarity-unique">✧</span> <b>${c.craftDust || 0}</b> Dust</div>`;
    list.appendChild(consum);
    if (c.inventory.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'quest-card empty';
      empty.textContent = 'No gear in your bags.';
      list.appendChild(empty);
      return;
    }
    c.inventory.forEach((it, idx) => {
      const base = ITEM_BASES[it.baseId];
      if (!base) return; // skip corrupted items
      const row = document.createElement('button');
      row.className = 'inv-row focusable';
      row.dataset.action = 'inv-open';
      row.dataset.idx = idx;
      const equipped = isEquipped(it);
      const rCol = rarityColor(it.rarity);
      // Create mini canvas icon for item
      const iconHtml = renderItemIcon(base.icon, rCol, it.rarity);
      row.innerHTML = `
        <div class="inv-icon" style="border-color:${rCol}40;box-shadow:0 0 6px ${rCol}30, inset 0 2px 4px rgba(0,0,0,0.3)">${iconHtml}</div>
        <div class="inv-meta">
          <div class="inv-name rarity-${it.rarity}">${it.name}</div>
          <div class="inv-sub">${itemTypeLabel(base)} · ilvl ${it.ilvl}</div>
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
    if (!it) return false;
    const e = game.char.equip;
    // Compare by id (reference equality breaks after JSON save/load round-trips)
    const match = slot => slot && (slot === it || (slot.id && it.id && slot.id === it.id));
    return match(e.weapon) || match(e.armor) || match(e.ring) || match(e.amulet);
  }

  function renderCharacter() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const d = derived(c);
    $('char-portrait').innerHTML = `<span style="color:${cls.color};text-shadow:0 0 16px ${cls.color}">${cls.glyph}</span>`;
    const stats = $('char-stats');
    const b = d.breakdown || {};
    // Build a compact damage breakdown sub-line under Damage
    const dmgParts = [];
    if (b.baseDmg)   dmgParts.push(`${b.baseDmg} base`);
    if (b.gearDmg)   dmgParts.push(`+${b.gearDmg} gear`);
    if (b.affixDmg)  dmgParts.push(`+${b.affixDmg} affix`);
    if (b.gemDmg)    dmgParts.push(`+${b.gemDmg} gems`);
    if (b.statsDmg)  dmgParts.push(`+${b.statsDmg} stats`);
    if (b.dmgMul && b.dmgMul !== 1) dmgParts.push(`× ${b.dmgMul.toFixed(2)}`);
    const dmgBreakdown = dmgParts.length > 1 ? `<div class="stat-sub">${dmgParts.join(' · ')}</div>` : '';
    const para = c.paragonStats || { str: 0, int: 0, dex: 0, vit: 0 };
    const fmtStat = (base, bonus, p) => {
      const total = base + bonus + p;
      const extras = [];
      if (bonus) extras.push(`+${bonus} gear`);
      if (p)     extras.push(`+${p} paragon`);
      return extras.length ? `${total}<div class="stat-sub">${base} base · ${extras.join(' · ')}</div>` : `${total}`;
    };
    const atCap = c.level >= CFG.maxLevel;
    const xpLine = atCap
      ? `MAX (Paragon ${c.paragonLevel || 0})`
      : `${c.xp} / ${xpForLevel(c.level)}`;
    const rows = [
      ['Class',    cls.name],
      ['Level',    c.level + (atCap ? ' ★' : '')],
      ['XP',       xpLine],
      ['Damage',   `${d.dmg}${dmgBreakdown}`],
      ['DPS',      `${b.dps || 0}<div class="stat-sub">${b.avgPerHit || 0} avg/hit × ${d.aspd.toFixed(2)} aps</div>`],
      ['Armor',    d.def],
      ['HP',       `${Math.ceil(c.hp)} / ${d.hpMax}`],
      ['MP',       `${Math.ceil(c.mp)} / ${d.mpMax}`],
      ['Crit',     `${d.crit}% · ${b.critDmgPct || 180}% dmg`],
      ['Atk Spd',  d.aspd.toFixed(2)],
      ['Gold',     c.gold + 'g'],
      ['STR',      fmtStat(c.stats.str, d.bonusStats.str, para.str)],
      ['INT',      fmtStat(c.stats.int, d.bonusStats.int, para.int)],
      ['DEX',      fmtStat(c.stats.dex, d.bonusStats.dex, para.dex)],
      ['VIT',      fmtStat(c.stats.vit, d.bonusStats.vit, para.vit)],
    ];
    stats.innerHTML = rows.map(([k, v]) => `<div class="stat-row"><span class="stat-label">${k}</span><span class="stat-value">${v}</span></div>`).join('');
    // Show active item sets (any partial progress)
    const sets = activeSets(c).filter(s => s.count > 0);
    if (sets.length > 0) {
      const setsHtml = sets.map(s => {
        const isActive = s.count >= 3;
        const cls = isActive ? 'rarity-unique' : 'rarity-magic';
        return `<div class="stat-row"><span class="stat-label ${cls}">${s.def.name} (${s.count}/3)</span><span class="stat-value">${isActive ? s.def.bonusDesc : 'Need ' + (3 - s.count) + ' more'}</span></div>`;
      }).join('');
      stats.innerHTML += `<div class="stat-row" style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px"><span class="stat-label">Item Sets</span></div>` + setsHtml;
    }
    // Show unlocked passives count
    const passiveCount = Object.keys(c.passives || {}).length;
    if (passiveCount > 0 || c.level >= 10) {
      stats.innerHTML += `<div class="stat-row"><span class="stat-label">Passives</span><span class="stat-value">${passiveCount} / ${Object.keys(PASSIVES).length} unlocked · ${c.tomes || 0} tomes</span></div>`;
    }
    // Paragon section — only shown once at cap
    if (atCap) {
      const need = xpForParagon(c.paragonLevel || 0);
      const cur = c.paragonXp || 0;
      const pct = Math.min(100, Math.floor(100 * cur / need));
      stats.innerHTML += `
        <div class="stat-row" style="margin-top:8px;border-top:1px solid rgba(255,200,87,0.25);padding-top:8px">
          <span class="stat-label rarity-unique">Paragon</span>
          <span class="stat-value">Lvl ${c.paragonLevel || 0} · ${c.paragonPoints || 0} pts</span>
        </div>
        <div class="stat-row" style="background:transparent;padding:2px 12px">
          <span class="stat-label" style="font-size:10px">Next: ${cur}/${need} XP (${pct}%)</span>
        </div>
      `;
    }
    const pts = $('char-points-row');
    pts.innerHTML = '';
    // Regular stat-point spend buttons (level-up gains)
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
    // Paragon-point spend buttons (separate, only when paragon points exist)
    if ((c.paragonPoints || 0) > 0) {
      const label = document.createElement('div');
      label.className = 'skill-header rarity-unique';
      label.textContent = `Spend Paragon Points (${c.paragonPoints})`;
      pts.appendChild(label);
      const make = (k) => {
        const b = document.createElement('button');
        b.className = 'nav-item focusable';
        b.dataset.action = 'spend-paragon';
        b.dataset.stat = k;
        b.innerHTML = `+1 ${k.toUpperCase()} <span class="pts">${(c.paragonStats || {})[k] || 0} allocated</span>`;
        return b;
      };
      ['str','int','dex','vit'].forEach(k => pts.appendChild(make(k)));
    }
  }

  function spendParagon(k) {
    const c = game.char;
    if (!c.paragonPoints || c.paragonPoints <= 0) { showHudToast('No paragon points.'); return; }
    if (!c.paragonStats) c.paragonStats = { str: 0, int: 0, dex: 0, vit: 0 };
    if (!(k in c.paragonStats)) return;
    c.paragonStats[k] += 1;
    c.paragonPoints -= 1;
    applyDerivedToChar();
    saveGame();
    renderCharacter();
    updateHud();
    showHudToast(`+1 Paragon ${k.toUpperCase()}`);
  }

  function renderSkills() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    const activeId = getActiveSkillId();
    const available = getAvailableSkills();
    const el = $('skills-content');
    el.innerHTML = '<div class="skill-header">Select Active Skill:</div>';
    for (const skillId of available) {
      const s = SKILLS[skillId];
      if (!s) continue;
      const isActive = skillId === activeId;
      const isGranted = !cls.skills.includes(skillId);
      const runeId = c.skillRunes && c.skillRunes[skillId];
      const rune = runeId ? RUNES[runeId] : null;
      const card = document.createElement('button');
      card.className = 'skill-card focusable' + (isActive ? ' skill-active' : '');
      card.dataset.action = 'select-skill';
      card.dataset.skill = skillId;
      const grantBadge = isGranted ? ' <span class="rarity-unique">(Legendary)</span>' : '';
      const runeBadge = rune ? ` <span class="rune-badge">${rune.icon} ${rune.name}</span>` : '';
      card.innerHTML = `
        <div class="skill-name">${s.name}${isActive ? ' ★' : ''}${grantBadge}${runeBadge}</div>
        <div class="skill-desc">${s.desc}</div>
        <div class="skill-meta">Cooldown: ${s.cooldown}s · Mana: ${s.cost}</div>
      `;
      el.appendChild(card);
    }
    // Rune picker for the active skill
    const aS = SKILLS[activeId];
    if (aS) {
      const sec = document.createElement('div');
      sec.className = 'rune-section';
      const curRune = c.skillRunes && c.skillRunes[activeId];
      let chips = `<button class="rune-chip focusable${!curRune ? ' rune-on' : ''}" data-action="set-rune" data-skill="${activeId}" data-rune="">None</button>`;
      for (const rid in RUNES) {
        const r = RUNES[rid];
        const on = curRune === rid;
        chips += `<button class="rune-chip focusable${on ? ' rune-on' : ''}" data-action="set-rune" data-skill="${activeId}" data-rune="${rid}">
          <span class="rune-chip-name">${r.icon} ${r.name}</span><span class="rune-chip-desc">${r.desc}</span>
        </button>`;
      }
      sec.innerHTML = `<div class="skill-header">Rune — ${aS.name}:</div><div class="rune-chips">${chips}</div>`;
      el.appendChild(sec);
    }
  }

  function renderPassives() {
    const c = game.char;
    $('passives-tomes').textContent = c.tomes || 0;
    const el = $('passives-content');
    el.innerHTML = '';
    if (c.level < 10) {
      const lock = document.createElement('div');
      lock.className = 'quest-card empty';
      lock.textContent = `Locked. Reach level 10 to unlock passives (currently ${c.level}).`;
      el.appendChild(lock);
      return;
    }
    const header = document.createElement('div');
    header.className = 'skill-header';
    header.textContent = `Spend tomes to unlock passives. Each costs 1 tome.`;
    el.appendChild(header);
    const unlocked = c.passives || {};
    for (const pid in PASSIVES) {
      const p = PASSIVES[pid];
      const isUnlocked = !!unlocked[pid];
      const canAfford = (c.tomes || 0) > 0;
      const card = document.createElement('button');
      card.className = 'skill-card focusable' + (isUnlocked ? ' skill-active' : '');
      if (!isUnlocked && !canAfford) card.className += ' disabled';
      card.dataset.action = 'unlock-passive';
      card.dataset.passive = pid;
      const status = isUnlocked
        ? '★ UNLOCKED'
        : canAfford ? 'PINCH to unlock (1 tome)' : 'Need 1 tome';
      card.innerHTML = `
        <div class="skill-name">${p.icon} ${p.name}${isUnlocked ? ' ★' : ''}</div>
        <div class="skill-desc">${p.desc}</div>
        <div class="skill-meta">${status}</div>
      `;
      el.appendChild(card);
    }
  }

  function unlockPassive(passiveId) {
    if (!PASSIVES[passiveId]) return;
    const c = game.char;
    if (c.level < 10) { showHudToast('Reach level 10 first.'); return; }
    if (!c.passives) c.passives = {};
    if (c.passives[passiveId]) { showHudToast('Already unlocked.'); return; }
    if ((c.tomes || 0) < 1) { showHudToast('No tomes — kill enemies to find more.'); return; }
    c.tomes -= 1;
    c.passives[passiveId] = true;
    applyDerivedToChar();
    saveGame();
    showHudToast(`${PASSIVES[passiveId].name} unlocked!`);
    renderPassives();
    updateHud();
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
        <div class="quest-reward">Reward: ${q.rewardGold}g + ${q.rewardXp} XP + bonus item</div>
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
    const list = $('vendor-list');
    const _keepFocus = listFocusIndex(list);
    list.innerHTML = '';
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
    } else if (game.vendorMode === 'reroll') {
      document.querySelector('[data-action="vendor-tab-reroll"]').classList.add('active');
      const header = document.createElement('div');
      header.className = 'skill-header';
      const tears = c.glassTears || 0;
      header.innerHTML = `Reroll affixes on rare or unique items.<br><span style="color:var(--text-dim)">Cost: gold + 1 Glass Tear. You have <span class="rarity-unique">${tears} Glass Tear${tears === 1 ? '' : 's'}</span>.</span>`;
      list.appendChild(header);
      // List rare/unique/mythic items in inventory that have at least 1 affix
      let any = false;
      c.inventory.forEach((it, idx) => {
        const base = ITEM_BASES[it.baseId];
        if (!base) return;
        if (it.rarity !== 'rare' && it.rarity !== 'unique' && it.rarity !== 'mythic') return;
        if (!it.affixes || it.affixes.length === 0) return;
        any = true;
        const cost = rerollCost(it);
        const canAfford = c.gold >= cost && tears > 0;
        const row = document.createElement('button');
        row.className = 'inv-row focusable' + (canAfford ? '' : ' disabled');
        row.dataset.action = 'vendor-reroll';
        row.dataset.idx = idx;
        const affixSummary = it.affixes.map(a => `+${a.val} ${a.label}`).join(', ');
        row.innerHTML = `
          <div class="inv-icon">${base.icon}</div>
          <div class="inv-meta">
            <div class="inv-name rarity-${it.rarity}">${it.name}</div>
            <div class="inv-sub">${affixSummary}</div>
          </div>
          <div class="inv-equipped" style="color:var(--gold)">${cost}g + 1◊</div>
        `;
        list.appendChild(row);
      });
      if (!any) {
        const empty = document.createElement('div');
        empty.className = 'quest-card empty';
        empty.textContent = 'No rare or unique items to reroll.';
        list.appendChild(empty);
      }
    } else {
      document.querySelector('[data-action="vendor-tab-sell"]').classList.add('active');
      c.inventory.forEach((it, idx) => {
        const base = ITEM_BASES[it.baseId];
        if (!base) return;
        const equipped = isEquipped(it);
        const price = Math.max(1, Math.floor(itemCost(it) * 0.4));
        const row = document.createElement('button');
        row.className = 'inv-row focusable' + (equipped ? ' disabled' : '');
        row.dataset.action = 'vendor-sell';
        row.dataset.idx = idx;
        // Equipped items show "EQ" instead of price and can't be sold
        const tagHtml = equipped
          ? `<div class="inv-equipped">EQ</div>`
          : `<div class="inv-equipped" style="color:var(--gold)">${price}g</div>`;
        row.innerHTML = `
          <div class="inv-icon">${base.icon}</div>
          <div class="inv-meta">
            <div class="inv-name rarity-${it.rarity}">${it.name}</div>
            <div class="inv-sub">${base.type} · ilvl ${it.ilvl}</div>
          </div>
          ${tagHtml}
        `;
        list.appendChild(row);
      });
      if (list.innerHTML === '') list.innerHTML = '<div class="quest-card empty">Nothing to sell.</div>';
    }
    listFocusRestore(list, _keepFocus);
  }

  function rerollCost(it) {
    const tier = it.rarity === 'unique' ? 200 : 80;
    return tier + (it.ilvl || 1) * 8;
  }

  function rerollItem(idx) {
    const c = game.char;
    const it = c.inventory[idx];
    if (!it) return;
    if (it.rarity !== 'rare' && it.rarity !== 'unique' && it.rarity !== 'mythic') { showHudToast('Only rare or better items.'); return; }
    if (!it.affixes || it.affixes.length === 0) { showHudToast('No affixes to reroll.'); return; }
    const cost = rerollCost(it);
    if (c.gold < cost) { showHudToast('Not enough gold.'); return; }
    if ((c.glassTears || 0) < 1) { showHudToast('Need 1 Glass Tear.'); return; }
    c.gold -= cost;
    c.glassTears -= 1;
    // Reroll affixes: keep same count, fresh keys/values appropriate to rarity
    const ilvl = it.ilvl || 1;
    const newAffixes = [];
    const usedKeys = new Set();
    for (let i = 0; i < it.affixes.length; i++) {
      let af = rollAffix(it.rarity, ilvl);
      let tries = 0;
      while (usedKeys.has(af.key) && tries++ < 6) af = rollAffix(it.rarity, ilvl);
      if (usedKeys.has(af.key)) continue;
      usedKeys.add(af.key);
      newAffixes.push(af);
    }
    it.affixes = newAffixes;
    // Refresh name only for rare items (rare names depend on affixes).
    // Unique names are randomly generated and shouldn't change on reroll —
    // it would feel like a different item. Preserve the existing unique name.
    const base = ITEM_BASES[it.baseId];
    if (base && it.rarity === 'rare') {
      it.name = buildItemName(base, it.rarity, newAffixes);
    }
    applyDerivedToChar();
    saveGame();
    renderVendor();
    updateHud();
    showHudToast(`Rerolled: ${newAffixes.map(a => `+${a.val} ${a.label}`).join(', ')}`);
  }

  function itemCost(it) {
    // Consumables have fixed prices
    if (it.baseId === 'health-potion') return 25;
    if (it.baseId === 'sanctuary-scroll') return 75;
    // Gems have a fixed price by type
    const base = ITEM_BASES[it.baseId];
    if (base && base.type === 'gem') return 60;
    const tier = { common: 1, magic: 4, rare: 12, unique: 40, mythic: 90 }[it.rarity] || 1;
    const socketBonus = (it.sockets || 0) * 8;
    const gemBonus = (it.gems || []).length * 5;
    return 6 + it.ilvl * 4 * tier + (it.affixes ? it.affixes.length * 3 : 0) + socketBonus + gemBonus;
  }

  function refreshVendorOffer() {
    game.vendorOffer = [];
    const lv = Math.max(1, game.char.level);
    // Always offer Health Potions — top up before a dive
    game.vendorOffer.push({
      id: 'hp_' + Math.random().toString(36).slice(2, 9),
      baseId: 'health-potion', rarity: 'magic', affixes: [], ilvl: 1, sockets: 0, gems: [],
      name: 'Health Potion', _consumable: true,
    });
    // Always offer Sanctuary Scrolls — essential utility item
    game.vendorOffer.push({
      id: 'sc_' + Math.random().toString(36).slice(2, 9),
      baseId: 'sanctuary-scroll',
      rarity: 'magic',
      affixes: [],
      ilvl: 1,
      sockets: 0,
      gems: [],
      name: 'Sanctuary Scroll',
      _consumable: true,
    });
    // Offer one random gem (rotates each refresh)
    const gemId = pick(Object.keys(GEMS));
    const gemItem = makeGemItem(gemId);
    if (gemItem) game.vendorOffer.push(gemItem);
    // Vendor sells drop-able gear but never named legendaries (those stay drop-only)
    for (let i = 0; i < 4; i++) game.vendorOffer.push(rollItem(lv + irand(0, 2), null, { noLegendary: true }));
  }

  function renderStash() {
    const list = $('stash-list');
    const _keepFocus = listFocusIndex(list);
    list.innerHTML = '';
    document.querySelectorAll('#stash .vendor-tab').forEach(t => t.classList.remove('active'));
    const craftHeader = $('craft-header');
    if (craftHeader) craftHeader.classList.add('hidden');
    const c = game.char;
    if (game.stashMode === 'craft') {
      renderCraft();
      return;
    }
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
    listFocusRestore(list, _keepFocus);
  }

  // ===== CRAFTING BENCH (at the Keeper) =====
  const SALVAGE_YIELD = { common: 1, magic: 3, rare: 6, unique: 15, mythic: 35 };
  const CRAFT_SOCKET_COST = 8;
  const CRAFT_SOCKET_MAX = 2;
  const CRAFT_RARITY_NEXT = { common: 'magic', magic: 'rare' };
  function craftUpgradeCost(it) {
    return it.rarity === 'common' ? 5 : it.rarity === 'magic' ? 12 : 0;
  }
  // Number of affixes an item should carry once upgraded to a given rarity.
  function targetAffixCount(rarity) {
    return rarity === 'magic' ? 1 : rarity === 'rare' ? 3 : 0;
  }
  function isCraftable(it) {
    const base = ITEM_BASES[it.baseId];
    return base && (base.type === 'weapon' || base.type === 'armor' || base.type === 'ring' || base.type === 'amulet');
  }

  function renderCraft() {
    const list = $('stash-list');
    const _keepFocus = listFocusIndex(list);
    list.innerHTML = '';
    document.querySelector('[data-action="stash-tab-craft"]').classList.add('active');
    const c = game.char;
    const dust = c.craftDust || 0;
    const header = $('craft-header');
    if (header) {
      header.classList.remove('hidden');
      header.innerHTML = `Salvage gear into <span class="rarity-unique">Glass Dust</span>, then upgrade rarity or add sockets.<br>
        <span style="color:var(--text-dim)">You have <span class="rarity-unique">${dust}</span> Glass Dust.</span>`;
    }
    let any = false;
    c.inventory.forEach((it, idx) => {
      if (!isCraftable(it)) return;
      any = true;
      const base = ITEM_BASES[it.baseId];
      const equipped = isEquipped(it);
      const sockets = it.sockets || 0;
      const card = document.createElement('div');
      card.className = 'craft-card';
      const sub = `${base.type} · ilvl ${it.ilvl} · ${sockets} socket${sockets === 1 ? '' : 's'}${equipped ? ' · EQ' : ''}`;
      let buttons = '';
      // Salvage (non-equipped only)
      if (!equipped) {
        const yld = SALVAGE_YIELD[it.rarity] || 1;
        buttons += `<button class="craft-btn focusable danger" data-action="craft-salvage" data-idx="${idx}">Salvage +${yld}</button>`;
      }
      // Upgrade rarity
      const nextR = CRAFT_RARITY_NEXT[it.rarity];
      if (nextR) {
        const cost = craftUpgradeCost(it);
        const afford = dust >= cost;
        buttons += `<button class="craft-btn focusable${afford ? '' : ' disabled'}" data-action="craft-upgrade" data-idx="${idx}"${afford ? '' : ' tabindex="-1"'}>→ ${nextR} (${cost})</button>`;
      }
      // Add socket
      if (sockets < CRAFT_SOCKET_MAX) {
        const afford = dust >= CRAFT_SOCKET_COST;
        buttons += `<button class="craft-btn focusable${afford ? '' : ' disabled'}" data-action="craft-socket" data-idx="${idx}"${afford ? '' : ' tabindex="-1"'}>+Socket (${CRAFT_SOCKET_COST})</button>`;
      }
      card.innerHTML = `
        <div class="craft-info">
          <div class="inv-icon">${base.icon}</div>
          <div class="inv-meta"><div class="inv-name rarity-${it.rarity}">${it.name}</div><div class="inv-sub">${sub}</div></div>
        </div>
        <div class="craft-actions">${buttons}</div>
      `;
      list.appendChild(card);
    });
    if (!any) list.innerHTML = '<div class="quest-card empty">No gear to craft. Pick up some equipment first.</div>';
    listFocusRestore(list, _keepFocus);
  }

  function craftSalvage(idx) {
    const c = game.char;
    const it = c.inventory[idx];
    if (!it || !isCraftable(it)) return;
    if (isEquipped(it)) { showHudToast('Unequip it first.'); return; }
    const yld = SALVAGE_YIELD[it.rarity] || 1;
    // Return any socketed gems to the inventory so they aren't destroyed
    let gemsBack = 0;
    if (it.gems && it.gems.length) {
      it.gems.forEach(gemId => {
        const g = makeGemItem(gemId);
        if (g) { c.inventory.push(g); gemsBack++; }
      });
    }
    const removeId = it.id;
    c.inventory = c.inventory.filter(x => !(x && x.id === removeId));
    c.craftDust = (c.craftDust || 0) + yld;
    saveGame();
    renderCraft();
    updateHud();
    showHudToast(`Salvaged for ${yld} dust${gemsBack ? ` (+${gemsBack} gem${gemsBack === 1 ? '' : 's'} returned)` : ''}.`);
  }

  function craftUpgrade(idx) {
    const c = game.char;
    const it = c.inventory[idx];
    if (!it || !isCraftable(it)) return;
    const nextR = CRAFT_RARITY_NEXT[it.rarity];
    if (!nextR) { showHudToast('Already at max craftable rarity.'); return; }
    const cost = craftUpgradeCost(it);
    if ((c.craftDust || 0) < cost) { showHudToast(`Need ${cost} Glass Dust.`); return; }
    c.craftDust -= cost;
    it.rarity = nextR;
    // Add affixes (with unique keys) up to the new tier's target count
    if (!it.affixes) it.affixes = [];
    const used = new Set(it.affixes.map(a => a.key));
    const target = targetAffixCount(nextR);
    let guard = 0;
    while (it.affixes.length < target && guard++ < 30) {
      const af = rollAffix(nextR, it.ilvl || 1);
      if (used.has(af.key)) continue;
      used.add(af.key);
      it.affixes.push(af);
    }
    const base = ITEM_BASES[it.baseId];
    if (base) it.name = buildItemName(base, it.rarity, it.affixes);
    applyDerivedToChar();
    saveGame();
    renderCraft();
    updateHud();
    showHudToast(`Upgraded to ${nextR}: ${it.name}`);
  }

  function craftAddSocket(idx) {
    const c = game.char;
    const it = c.inventory[idx];
    if (!it || !isCraftable(it)) return;
    if ((it.sockets || 0) >= CRAFT_SOCKET_MAX) { showHudToast('Max sockets reached.'); return; }
    if ((c.craftDust || 0) < CRAFT_SOCKET_COST) { showHudToast(`Need ${CRAFT_SOCKET_COST} Glass Dust.`); return; }
    c.craftDust -= CRAFT_SOCKET_COST;
    it.sockets = (it.sockets || 0) + 1;
    saveGame();
    renderCraft();
    updateHud();
    showHudToast('Added a socket.');
  }

  function renderWaypoint() {
    const el = $('waypoint-content');
    el.innerHTML = '';
    // Difficulty selector — Normal / Nightmare / Hell
    const maxIdx = DIFFICULTY_ORDER.indexOf(game.save.maxDifficulty || 'normal');
    const diffWrap = document.createElement('div');
    diffWrap.className = 'diff-selector';
    let diffChips = '<div class="diff-label">DIFFICULTY</div><div class="diff-chips">';
    DIFFICULTY_ORDER.forEach((did, i) => {
      const d = DIFFICULTIES[did];
      const unlocked = i <= maxIdx;
      const on = (game.save.difficulty || 'normal') === did;
      diffChips += `<button class="diff-chip focusable${on ? ' diff-on' : ''}${unlocked ? '' : ' locked'}"
        ${unlocked ? `data-action="set-difficulty" data-diff="${did}"` : 'tabindex="-1"'}
        style="${on ? `border-color:${d.color};color:${d.color}` : ''}">${unlocked ? d.name : '🔒 ' + d.name}</button>`;
    });
    diffChips += '</div>';
    diffWrap.innerHTML = diffChips;
    el.appendChild(diffWrap);
    // Greater Rift — endgame endless mode, unlocked after the first boss falls
    const riftUnlocked = !!game.save.unlockedBiomes.overgrowth;
    const best = game.save.bestRift || 0;
    const riftCard = document.createElement('button');
    riftCard.className = 'waypoint-card rift-card focusable' + (riftUnlocked ? '' : ' locked');
    if (riftUnlocked) { riftCard.dataset.action = 'enter-rift'; } else { riftCard.tabIndex = -1; }
    riftCard.innerHTML = `
      <div class="waypoint-glyph" style="color:#b388ff;text-shadow:0 0 12px #b388ff">${riftUnlocked ? '✷' : '?'}</div>
      <div class="waypoint-meta">
        <div class="waypoint-name" style="color:${riftUnlocked ? '#d9c2ff' : '#9a9ab0'};text-shadow:0 0 8px #b388ff">Greater Rift</div>
        <div class="waypoint-sub">${riftUnlocked ? (best > 0 ? `Endless · Best: Level ${best}` : 'Endless · Beat the timer, go deep') : 'Locked — defeat the first boss'}</div>
      </div>
    `;
    el.appendChild(riftCard);
    // The Hollow Throne — the campaign's final battle, unlocked once all biome bosses fall
    const throneUnlocked = BIOMES.every(b => (game.save.bossesKilled[b.id] || 0) > 0);
    const won = !!game.save.gameWon;
    const throneCard = document.createElement('button');
    throneCard.className = 'waypoint-card rift-card focusable' + (throneUnlocked ? '' : ' locked');
    if (throneUnlocked) { throneCard.dataset.action = 'enter-throne'; } else { throneCard.tabIndex = -1; }
    throneCard.innerHTML = `
      <div class="waypoint-glyph" style="color:#ff3df0;text-shadow:0 0 14px #c489ff">${throneUnlocked ? '♔' : '🔒'}</div>
      <div class="waypoint-meta">
        <div class="waypoint-name" style="color:${throneUnlocked ? '#e7c2ff' : '#9a9ab0'};text-shadow:0 0 10px #c489ff">The Hollow Throne</div>
        <div class="waypoint-sub">${throneUnlocked ? (won ? 'The Hollow King stirs once more…' : 'Face the Hollow King — the final battle') : 'Locked — defeat all five biome bosses'}</div>
      </div>`;
    el.appendChild(throneCard);
    // Nightmare Dungeon — keyed by Sigils (dropped by bosses)
    const sigils = game.char.sigils || 0;
    const nmCard = document.createElement('button');
    nmCard.className = 'waypoint-card rift-card focusable' + (sigils > 0 ? '' : ' locked');
    if (sigils > 0) { nmCard.dataset.action = 'enter-nightmare'; } else { nmCard.tabIndex = -1; }
    nmCard.innerHTML = `
      <div class="waypoint-glyph" style="color:#ff6a2c;text-shadow:0 0 12px #ff6a2c">${sigils > 0 ? '✦' : '🔒'}</div>
      <div class="waypoint-meta">
        <div class="waypoint-name" style="color:${sigils > 0 ? '#ffc6a0' : '#9a9ab0'};text-shadow:0 0 8px #ff6a2c">Nightmare Dungeon</div>
        <div class="waypoint-sub">${sigils > 0 ? `Sigils: ${sigils} · Rolled modifiers · tougher foes, richer loot` : 'Locked — bosses drop Nightmare Sigils'}</div>
      </div>`;
    el.appendChild(nmCard);
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
      const nameColor = unlocked ? '#ffffff' : '#9a9ab0';
      card.innerHTML = `
        <div class="waypoint-glyph" style="color:${b.palette.wall};text-shadow:0 0 12px ${b.palette.wall}">${unlocked ? '✦' : '?'}</div>
        <div class="waypoint-meta">
          <div class="waypoint-name" style="color:${nameColor};text-shadow:0 0 6px ${b.palette.wall}">${b.name}</div>
          <div class="waypoint-sub">${unlocked ? 'Discovered' : 'Locked — defeat boss to unlock'}</div>
        </div>
      `;
      el.appendChild(card);
    });
  }

  function renderBestiary() {
    const el = $('bestiary-content');
    if (!el) return;
    el.innerHTML = '';
    const bestiary = (game.save && game.save.bestiary) || {};
    // Count discovery progress across all enemies
    const allIds = Object.keys(ENEMIES);
    const discovered = allIds.filter(id => (bestiary[id] || 0) > 0).length;
    const prog = $('bestiary-progress');
    if (prog) prog.textContent = `${discovered} / ${allIds.length}`;

    // Build one section per biome: its enemies, then its boss.
    BIOMES.forEach(b => {
      const ids = (b.enemies || []).slice();
      if (b.boss) ids.push(b.boss);

      const section = document.createElement('div');
      section.className = 'bestiary-section';
      const head = document.createElement('div');
      head.className = 'bestiary-biome';
      head.style.color = b.palette.wall;
      head.style.textShadow = `0 0 8px ${b.palette.wall}`;
      head.textContent = b.name;
      section.appendChild(head);

      ids.forEach(id => {
        const def = ENEMIES[id];
        if (!def) return;
        const kills = bestiary[id] || 0;
        const known = kills > 0;
        const row = document.createElement('div');
        row.className = 'bestiary-entry' + (known ? '' : ' unknown') + (def.boss ? ' boss' : '');
        const glyphColor = known ? def.color : '#3a3a4a';
        const name = known ? def.name : '???';
        const lore = known ? (BESTIARY_LORE[id] || '') : 'Slay one to record its tale.';
        row.innerHTML = `
          <div class="bestiary-glyph" style="color:${glyphColor};${known ? `text-shadow:0 0 8px ${def.color}` : ''}">${known ? def.glyph : '?'}</div>
          <div class="bestiary-meta">
            <div class="bestiary-name">${name}${def.boss ? ' <span class="bestiary-boss-tag">BOSS</span>' : ''}</div>
            <div class="bestiary-lore">${lore}</div>
          </div>
          <div class="bestiary-kills">${known ? '×' + kills : ''}</div>
        `;
        section.appendChild(row);
      });
      el.appendChild(section);
    });
  }

  function renderUpgrades() {
    const el = $('upgrades-content');
    if (!el) return;
    el.innerHTML = '';
    const goldEl = $('upgrades-gold');
    if (goldEl) goldEl.textContent = `${game.char.gold}g`;
    for (const key in UPGRADES) {
      const u = UPGRADES[key];
      const lvl = upgradeLevel(key);
      const maxed = lvl >= u.max;
      const cost = upgradeCost(key);
      const afford = game.char.gold >= cost;
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      // pip row showing levels filled
      let pips = '';
      for (let i = 0; i < u.max; i++) pips += `<span class="up-pip${i < lvl ? ' on' : ''}"></span>`;
      const btn = maxed
        ? `<div class="upgrade-maxed">MAX</div>`
        : `<button class="upgrade-buy focusable${afford ? '' : ' disabled'}" data-action="buy-upgrade" data-key="${key}"${afford ? '' : ' tabindex="-1"'}>${cost}g</button>`;
      card.innerHTML = `
        <div class="upgrade-icon">${u.icon}</div>
        <div class="upgrade-meta">
          <div class="upgrade-name">${u.name} <span class="upgrade-lvl">Lv ${lvl}/${u.max}</span></div>
          <div class="upgrade-desc">${u.perLevel}</div>
          <div class="up-pips">${pips}</div>
        </div>
        ${btn}
      `;
      el.appendChild(card);
    }
  }

  function buyUpgrade(key) {
    const u = UPGRADES[key];
    if (!u) return;
    const lvl = upgradeLevel(key);
    if (lvl >= u.max) { showHudToast('Already maxed.'); return; }
    const cost = upgradeCost(key);
    if (game.char.gold < cost) { showHudToast('Not enough gold.'); return; }
    game.char.gold -= cost;
    if (!game.save.upgrades) game.save.upgrades = { pickup: 0, xpgain: 0, goldfind: 0, potions: 0 };
    game.save.upgrades[key] = lvl + 1;
    // Potion Belt immediately tops up your flasks
    if (key === 'potions') game.char.potions = potionCapacity();
    applyDerivedToChar();
    saveGame();
    renderUpgrades();
    updateHud();
    showHudToast(`${u.name} → Lv ${lvl + 1}`);
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
        // Resume at last known location if saved
        const ws = game.save.worldState;
        if (ws && ws.kind === 'dungeon' && ws.biomeId) {
          enterBiome(ws.biomeId, ws.floor || 1);
          // restore exact player position within the dungeon
          if (game.world && game.world.player && typeof ws.x === 'number') {
            game.world.player.x = ws.x;
            game.world.player.y = ws.y;
            snapCamera();
          }
        } else {
          enterTown();
        }
        return;
      case 'title-new':
        navigateTo('class-select'); return;
      case 'title-about':
        navigateTo('about'); return;
      case 'title-honor':
        navigateTo('honor'); return;
      case 'title-sync':
        navigateTo('sync'); return;
      case 'toggle-hardcore':
        _hardcorePick = !_hardcorePick; refreshHardcoreLabel(); sfx('ui'); return;

      // class select
      case 'pick-class': {
        const id = el.dataset.class;
        game.save = defaultSave(id);
        loadIntoSession(game.save);
        game.char.hardcore = _hardcorePick;   // one-life mode chosen on this screen
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
      case 'menu-wardrobe': navigateTo('wardrobe'); return;
      case 'wardrobe-set': {
        const slot = el.dataset.slot, look = el.dataset.look;
        if (game.char && game.char.transmog) {
          game.char.transmog[slot] = (look === 'default') ? null : look;
          sfx('equip'); saveGame(); renderWardrobe();
        }
        return;
      }
      case 'hireling-recruit': {
        const type = el.dataset.type, t = HIRELING_TYPES[type];
        if (!t) return;
        if (game.char.gold < t.cost) { showHudToast('Not enough gold.'); sfx('error'); return; }
        game.char.gold -= t.cost;
        game.char.hireling = { type, level: 1 };
        sfx('levelup'); saveGame(); renderMercenary();
        showHudToast(t.name + ' recruited! They join you in the depths.');
        return;
      }
      case 'hireling-upgrade': {
        const h = game.char.hireling; if (!h) return;
        const cost = hirelingUpgradeCost(h.level);
        if (game.char.gold < cost) { showHudToast('Not enough gold.'); sfx('error'); return; }
        game.char.gold -= cost; h.level += 1;
        sfx('levelup'); saveGame(); renderMercenary();
        return;
      }
      case 'hireling-dismiss': {
        game.char.hireling = null;
        game.minions = game.minions.filter(m => !m._hireling);
        sfx('uiBack'); saveGame(); renderMercenary();
        showHudToast('Companion dismissed.');
        return;
      }
      case 'menu-skills': navigateTo('skills'); return;
      case 'menu-passives': navigateTo('passives'); return;
      case 'menu-quests': navigateTo('quests'); return;
      case 'menu-bestiary': navigateTo('bestiary'); return;
      case 'menu-upgrades': navigateTo('upgrades'); return;
      case 'buy-upgrade': buyUpgrade(el.dataset.key); return;
      case 'menu-town':
        if (game.world && game.world.isRift && game.rift && game.rift.active) {
          // In a rift, leaving banks the run for rewards
          endRift(true);
          game.history = [];
        } else if (game.world && game.world.kind === 'dungeon') {
          enterTown();
          // close the open menu screen
          game.history = [];
        }
        return;
      case 'menu-use-scroll':
        if (game.world && game.world.isRift) {
          showHudToast('Use the Leave Rift portal to exit a rift.');
        } else if (game.world && game.world.kind === 'dungeon' && game.char.sanctuaryScrolls > 0) {
          // Snapshot dungeon state so player can return here later
          game.save.savedDungeon = {
            biomeId: game.activeBiomeId,
            floor: game.activeFloor,
            x: game.world.player.x,
            y: game.world.player.y,
          };
          game.char.sanctuaryScrolls -= 1;
          saveGame();
          enterTown();
          game.history = [];
          showHudToast(`Sanctuary Scroll used. ${game.char.sanctuaryScrolls} left.`);
        } else if (game.char.sanctuaryScrolls <= 0) {
          showHudToast('No Sanctuary Scrolls. Buy from vendor.');
        }
        return;
      case 'menu-return-dungeon':
        if (game.save.savedDungeon && game.world && game.world.kind === 'town') {
          const sd = game.save.savedDungeon;
          enterBiome(sd.biomeId, sd.floor);
          // restore player to exact spot
          if (game.world && game.world.player && typeof sd.x === 'number') {
            game.world.player.x = sd.x;
            game.world.player.y = sd.y;
            snapCamera();
          }
          game.save.savedDungeon = null;
          saveGame();
          game.history = [];
          showHudToast('Returned to dungeon.');
        }
        return;
      case 'menu-title':
        saveGame();
        navigateTo('title');
        return;
      case 'menu-touch-toggle':
        toggleTouchControls();
        // Update the menu button label to reflect new state
        {
          const tBtn = $('menu-touch-toggle-btn');
          const tRoot = document.getElementById('touch-controls');
          const isOn = tRoot && !tRoot.classList.contains('hidden');
          if (tBtn) tBtn.textContent = `Touch Controls: ${isOn ? 'ON' : 'OFF'}`;
          showHudToast(`Touch controls ${isOn ? 'enabled' : 'disabled'}.`);
        }
        return;
      case 'menu-autopotion-toggle':
        {
          const c = game.char;
          // Cycle: OFF -> 25% -> 35% -> 50% -> OFF
          const cycle = [
            { on: false, pct: 0.35 },
            { on: true,  pct: 0.25 },
            { on: true,  pct: 0.35 },
            { on: true,  pct: 0.50 },
          ];
          // find current index
          let idx = 0;
          if (c.autoPotion) {
            const p = c.autoPotionPct;
            idx = p <= 0.25 ? 1 : (p >= 0.5 ? 3 : 2);
          }
          const next = cycle[(idx + 1) % cycle.length];
          c.autoPotion = next.on;
          c.autoPotionPct = next.pct;
          saveGame();
          const apBtn = $('menu-autopotion-btn');
          const pctLabel = Math.round(c.autoPotionPct * 100);
          if (apBtn) apBtn.textContent = c.autoPotion ? `Auto-Potion: ON (${pctLabel}%)` : 'Auto-Potion: OFF';
          showHudToast(c.autoPotion ? `Auto-potion ON at ${pctLabel}% HP.` : 'Auto-potion OFF.');
        }
        return;
      case 'menu-render-toggle':
        {
          // 3D is the default; toggle persists per-device ('2d' = opt out) and reloads.
          const is3D = localStorage.getItem('hl_render') !== '2d';
          localStorage.setItem('hl_render', is3D ? '2d' : 'gl');
          saveGame();
          showHudToast(is3D ? 'Switching to 2D…' : 'Switching to 3D…');
          setTimeout(() => location.reload(), 350);
        }
        return;
      case 'menu-sound-toggle':
        {
          const on = !(window.__AUDIO && window.__AUDIO.isEnabled());
          if (window.__AUDIO) { window.__AUDIO.setEnabled(on); if (on) { sfx('ui'); window.__AUDIO.music(game.world && game.world.kind === 'town' ? 'town' : (game.activeBiomeId || 'crypts')); } }
          const sb = $('menu-sound-btn'); if (sb) sb.textContent = 'Sound: ' + (on ? 'ON' : 'OFF');
          showHudToast('Sound ' + (on ? 'on' : 'off') + '.');
        }
        return;
      case 'menu-sync':
        navigateTo('sync');
        return;

      // save sync — export / import
      case 'sync-export':
        syncExport();
        return;
      case 'sync-import':
        syncImport();
        return;
      case 'sync-short-export':
        syncShortExport();
        return;
      case 'sync-short-import':
        syncShortImport();
        return;
      case 'open-code-picker':
        openCodePicker();
        return;
      case 'picker-submit':
        submitCodePicker();
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
      case 'item-socket':
        openGemSocket(parseInt(el.dataset.idx, 10));
        return;
      case 'socket-gem':
        socketGem(parseInt(el.dataset.gemIdx, 10));
        return;

      // character — spend stat
      case 'spend-stat':
        spendStat(el.dataset.stat);
        return;
      case 'spend-paragon':
        spendParagon(el.dataset.stat);
        return;

      // skills — select active skill
      case 'select-skill': {
        const skillId = el.dataset.skill;
        if (SKILLS[skillId]) {
          game.char.selectedSkill = skillId;
          saveGame();
          renderSkills();
          updateHud();
          showHudToast(`Skill: ${SKILLS[skillId].name}`);
        }
        return;
      }

      // skill rune — choose an augment for a skill ('' clears it)
      case 'set-rune': {
        const skillId = el.dataset.skill;
        const runeId = el.dataset.rune;
        if (!game.char.skillRunes) game.char.skillRunes = {};
        if (runeId && RUNES[runeId]) {
          game.char.skillRunes[skillId] = runeId;
          showHudToast(`${SKILLS[skillId].name}: ${RUNES[runeId].name} rune`);
        } else {
          delete game.char.skillRunes[skillId];
          showHudToast(`${SKILLS[skillId].name}: rune removed`);
        }
        saveGame();
        renderSkills();
        return;
      }

      // passives — unlock a passive node
      case 'unlock-passive': {
        unlockPassive(el.dataset.passive);
        return;
      }

      // vendor
      case 'vendor-tab-buy':    game.vendorMode = 'buy';    renderVendor(); return;
      case 'vendor-tab-sell':   game.vendorMode = 'sell';   renderVendor(); return;
      case 'vendor-tab-reroll': game.vendorMode = 'reroll'; renderVendor(); return;
      case 'vendor-buy':        vendorBuy(parseInt(el.dataset.idx, 10)); return;
      case 'vendor-sell':       vendorSell(parseInt(el.dataset.idx, 10)); return;
      case 'vendor-reroll':     rerollItem(parseInt(el.dataset.idx, 10)); return;

      // mystery vendor
      case 'mystery-buy':       mysteryBuy(); return;

      // stash
      case 'stash-tab-deposit':  game.stashMode = 'deposit';  renderStash(); return;
      case 'stash-tab-withdraw': game.stashMode = 'withdraw'; renderStash(); return;
      case 'stash-tab-craft':    game.stashMode = 'craft';    renderStash(); return;
      case 'stash-deposit':      stashDeposit(parseInt(el.dataset.idx, 10)); return;
      case 'stash-withdraw':     stashWithdraw(parseInt(el.dataset.idx, 10)); return;

      // crafting bench (at the Keeper)
      case 'craft-salvage':  craftSalvage(parseInt(el.dataset.idx, 10)); return;
      case 'craft-upgrade':  craftUpgrade(parseInt(el.dataset.idx, 10)); return;
      case 'craft-socket':   craftAddSocket(parseInt(el.dataset.idx, 10)); return;

      // waypoint
      case 'travel':
        enterBiome(el.dataset.biome, 1);
        game.history = [];
        return;
      case 'enter-rift':
        enterRift(1);
        game.history = [];
        return;
      case 'enter-throne':
        enterThrone();
        game.history = [];
        return;
      case 'enter-nightmare':
        enterNightmare();
        game.history = [];
        return;
      case 'set-difficulty': {
        const did = el.dataset.diff;
        const maxIdx = DIFFICULTY_ORDER.indexOf(game.save.maxDifficulty || 'normal');
        if (DIFFICULTIES[did] && DIFFICULTY_ORDER.indexOf(did) <= maxIdx) {
          game.save.difficulty = did;
          saveGame();
          renderWaypoint();
          showHudToast(`Difficulty: ${DIFFICULTIES[did].name}`);
        }
        return;
      }

      // quests
      case 'turn-in-quest': turnInQuest(); return;

      // levelup / death
      case 'levelup-ok': navigateBack(); return;
      case 'victory-return':
        enterTown(); game.history = []; return;
      case 'death-return':
        if (game._permadeath) { game._permadeath = false; navigateTo('title'); return; }
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
    // Check if this item belongs to a set
    let setInfo = '';
    for (const setId in SETS) {
      const s = SETS[setId];
      if (s.pieces.includes(it.baseId)) {
        // Count how many other pieces of this set the player has equipped
        const equipped = [game.char.equip.weapon, game.char.equip.armor, game.char.equip.ring, game.char.equip.amulet]
          .filter(x => x && x.baseId).map(x => x.baseId);
        const equippedCount = s.pieces.filter(p => equipped.includes(p)).length;
        setInfo = `<div class="item-affix rarity-unique">Set: ${s.name} (${equippedCount}/3)</div><div class="item-affix" style="opacity:0.8">${s.bonusDesc}</div>`;
        break;
      }
    }
    // Socket display
    let socketInfo = '';
    if (it.sockets && it.sockets > 0) {
      const gems = it.gems || [];
      const slots = [];
      for (let i = 0; i < it.sockets; i++) {
        const g = gems[i];
        if (g && GEMS[g]) slots.push(`<span style="color:${GEMS[g].color}">◆ ${GEMS[g].name} (${GEMS[g].desc})</span>`);
        else slots.push(`<span style="color:#666">◯ empty</span>`);
      }
      socketInfo = `<div class="item-affix">Sockets:</div>${slots.map(s => `<div class="item-affix" style="padding-left:12px">${s}</div>`).join('')}`;
    }

    // Compare with currently equipped item of same slot
    let compareInfo = '';
    if (!isEquipped(it) && (base.type === 'weapon' || base.type === 'armor' || base.type === 'ring' || base.type === 'amulet')) {
      const slot = base.type;
      const equipped = game.char.equip[slot];
      if (equipped && equipped.id !== it.id) {
        // Compute deltas: simulate stats with new item in slot, diff against current
        const curD = derived(game.char);
        // Temporarily swap and recompute
        const orig = game.char.equip[slot];
        game.char.equip[slot] = it;
        const newD = derived(game.char);
        game.char.equip[slot] = orig;
        const fmtDelta = (k, label, suffix) => {
          const a = newD[k], b = curD[k];
          if (a === b) return '';
          const diff = a - b;
          const cls = diff > 0 ? 'delta-up' : 'delta-down';
          const sign = diff > 0 ? '+' : '';
          return `<div class="item-affix ${cls}">${sign}${diff}${suffix || ''} ${label}</div>`;
        };
        // DPS delta from breakdown
        const dpsDelta = (newD.breakdown.dps || 0) - (curD.breakdown.dps || 0);
        const dpsCls = dpsDelta > 0 ? 'delta-up' : dpsDelta < 0 ? 'delta-down' : '';
        const dpsSign = dpsDelta > 0 ? '+' : '';
        const dpsLine = dpsDelta !== 0
          ? `<div class="item-affix ${dpsCls}" style="font-weight:700">${dpsSign}${dpsDelta} DPS</div>`
          : '';
        compareInfo = `
          <div class="item-affix" style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.12);padding-top:6px;color:var(--text-dim);font-size:11px">vs equipped (${equipped.name}):</div>
          ${dpsLine}
          ${fmtDelta('dmg', 'damage')}
          ${fmtDelta('def', 'armor')}
          ${fmtDelta('hpMax', 'HP')}
          ${fmtDelta('mpMax', 'MP')}
          ${fmtDelta('crit', 'crit', '%')}
        `;
      }
    }

    card.innerHTML = `
      <div class="item-name rarity-${it.rarity}">${it.name}</div>
      <div class="item-type">${base.type} · ilvl ${it.ilvl} · ${it.rarity.toUpperCase()}</div>
      ${baseLines.map(l => `<div class="item-affix">${l}</div>`).join('')}
      ${(it.affixes || []).map(a => `<div class="item-affix">+${a.val} ${a.label}</div>`).join('')}
      ${socketInfo}
      ${setInfo}
      ${compareInfo}
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
    // Socket gem action — only if item has empty sockets AND inventory has at least one gem
    const hasEmptySocket = it.sockets && (it.gems || []).length < it.sockets;
    const hasGemInInventory = game.char.inventory.some(x => x && ITEM_BASES[x.baseId] && ITEM_BASES[x.baseId].type === 'gem');
    if (hasEmptySocket && hasGemInInventory) {
      actions.innerHTML += `<button class="nav-item focusable" data-action="item-socket" data-idx="${idx}">Socket Gem</button>`;
    }
    actions.innerHTML += `<button class="nav-item focusable danger" data-action="item-drop" data-idx="${idx}">Drop</button>`;
    navigateTo('item-detail');
  }

  function openGemSocket(itemIdx) {
    game.socketingItemIdx = itemIdx;
    navigateTo('gem-socket');
  }

  function renderGemSocket() {
    const targetItem = game.char.inventory[game.socketingItemIdx];
    const list = $('gem-socket-list');
    const headerEl = $('gem-socket-header');
    if (!targetItem) {
      list.innerHTML = '<div class="quest-card empty">Item no longer available.</div>';
      headerEl.textContent = '';
      return;
    }
    const tBase = ITEM_BASES[targetItem.baseId];
    const slotsUsed = (targetItem.gems || []).length;
    const slotsFree = (targetItem.sockets || 0) - slotsUsed;
    headerEl.textContent = `${targetItem.name} — ${slotsFree} empty socket${slotsFree === 1 ? '' : 's'}`;
    list.innerHTML = '';
    let any = false;
    game.char.inventory.forEach((it, idx) => {
      if (!it) return;
      const base = ITEM_BASES[it.baseId];
      if (!base || base.type !== 'gem') return;
      const gem = GEMS[base.gemId];
      if (!gem) return;
      any = true;
      const row = document.createElement('button');
      row.className = 'inv-row focusable';
      row.dataset.action = 'socket-gem';
      row.dataset.gemIdx = idx;
      row.innerHTML = `
        <div class="inv-icon" style="color:${gem.color}">${base.icon}</div>
        <div class="inv-meta">
          <div class="inv-name" style="color:${gem.color}">${gem.name}</div>
          <div class="inv-sub">${gem.desc}</div>
        </div>
      `;
      list.appendChild(row);
    });
    if (!any) list.innerHTML = '<div class="quest-card empty">No gems in inventory. Kill enemies for more.</div>';
  }

  function socketGem(gemInvIdx) {
    const targetItem = game.char.inventory[game.socketingItemIdx];
    const gemItem = game.char.inventory[gemInvIdx];
    if (!targetItem || !gemItem) { showHudToast('Item not found.'); return; }
    const gemBase = ITEM_BASES[gemItem.baseId];
    if (!gemBase || gemBase.type !== 'gem' || !gemBase.gemId) { showHudToast('Not a gem.'); return; }
    if (!targetItem.gems) targetItem.gems = [];
    if (targetItem.gems.length >= (targetItem.sockets || 0)) { showHudToast('No empty sockets.'); return; }
    targetItem.gems.push(gemBase.gemId);
    // Remove the gem from inventory — must remove by id since indexes shift
    const gemId = gemItem.id;
    const targetId = targetItem.id;
    game.char.inventory = game.char.inventory.filter(x => !(x && x.id === gemId));
    // Update socketingItemIdx since indexes may have shifted
    game.socketingItemIdx = game.char.inventory.findIndex(x => x && x.id === targetId);
    applyDerivedToChar();
    saveGame();
    showHudToast(`${GEMS[gemBase.gemId].name} socketed.`);
    renderGemSocket();
    updateHud();
  }
  function slotOf(it) {
    const t = ITEM_BASES[it.baseId].type;
    return t;
  }
  function equipItemAt(idx) {
    const it = game.char.inventory[idx]; if (!it) return;
    const slot = slotOf(it);
    game.char.equip[slot] = it;
    sfx('equip');
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
    // Health Potion: increment counter, stays in vendor (capped to avoid hoarding)
    if (it.baseId === 'health-potion') {
      const cap = 12;
      if ((game.char.potions || 0) >= cap) { showHudToast(`Potion belt full (${cap} max).`); return; }
      game.char.gold -= cost;
      game.char.potions = (game.char.potions || 0) + 1;
      showHudToast(`Health Potion bought. Have ${game.char.potions}.`);
      saveGame();
      renderVendor();
      updateHud();
      return;
    }
    // Sanctuary Scroll: increment counter, stays in vendor (always available)
    if (it.baseId === 'sanctuary-scroll') {
      game.char.gold -= cost;
      game.char.sanctuaryScrolls = (game.char.sanctuaryScrolls || 0) + 1;
      showHudToast(`Sanctuary Scroll acquired! Have ${game.char.sanctuaryScrolls}.`);
      saveGame();
      renderVendor();
      return;
    }
    if (game.char.inventory.length >= 24) { showHudToast('Inventory full.'); return; }
    game.char.gold -= cost;
    game.char.inventory.push(it);
    game.vendorOffer.splice(idx, 1);
    saveGame();
    renderVendor();
  }
  function vendorSell(idx) {
    const it = game.char.inventory[idx];
    if (!it) return;
    if (isEquipped(it)) { showHudToast('Unequip first.'); return; }
    const price = Math.max(2, Math.floor(itemCost(it) * 0.5));
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
        line: `Bounty: Kill ${required} ${targetName}s in ${biome.name}. Reward: ${quest.rewardGold}g + ${quest.rewardXp} XP + bonus item.`,
        options: [
          { label: 'Accept', cb: () => { game.save.quest = quest; saveGame(); showHudToast('Quest accepted!'); navigateBack(); } },
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
          ? `Well done! Claim: ${q.rewardGold}g + ${q.rewardXp} XP + bonus item.`
          : `Progress: ${q.progress}/${q.required} ${q.targetName}s. Reward: ${q.rewardGold}g + ${q.rewardXp} XP + item.`,
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
    // Bonus item reward for quest completion (magic or rare quality)
    const bonusRarity = roll(0.3) ? 'rare' : 'magic';
    const bonusItem = rollItem(Math.max(1, game.char.level), bonusRarity);
    if (bonusItem && game.char.inventory.length < 24) {
      game.char.inventory.push(bonusItem);
    }
    game.save.questsCompleted += 1;
    game.save.quest = null;
    saveGame();
    // Explicit reward breakdown
    const rewardLines = [`+${q.rewardGold} Gold`, `+${q.rewardXp} XP`];
    if (bonusItem) rewardLines.push(`+ ${bonusItem.name}`);
    showHudToast(`QUEST COMPLETE! ${rewardLines.join(' | ')}`);
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
  function openMysteryVendor() { rollMysteryVendor(); navigateTo('mystery-vendor'); }

  // ============================================================
  // MYSTERY VENDOR — daily-rotating unique item
  // ============================================================
  function currentDayIndex() {
    // Local-day index; changes once per real-world day for the player
    const ms = Date.now() - new Date().getTimezoneOffset() * 60000;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  }
  // Seeded RNG so the same day produces the same item across renders
  function seededPick(seed, arr) {
    // Mulberry-style hash on the integer seed
    let h = (seed | 0) ^ 0x9E3779B9;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
    h ^= h >>> 16;
    const u = (h >>> 0) / 0x100000000;
    return arr[Math.floor(u * arr.length) % arr.length];
  }
  function rollMysteryVendor() {
    if (!game.save) return;
    const today = currentDayIndex();
    if (game.save.mysteryVendor && game.save.mysteryVendor.day === today) return; // already rolled today
    // Pick a unique-tier item base deterministically for this day
    const uniqueBases = Object.keys(ITEM_BASES).filter(k => {
      const b = ITEM_BASES[k];
      return b && (b.type === 'weapon' || b.type === 'armor' || b.type === 'ring' || b.type === 'amulet')
        && b.ilvl >= 18; // Legendary tier
    });
    const baseId = seededPick(today, uniqueBases);
    game.save.mysteryVendor = { day: today, baseId, bought: false };
    saveGame();
  }
  function mysteryPrice(item) {
    // High premium: ~5x normal cost
    const baseCost = itemCost(item);
    return Math.max(500, Math.floor(baseCost * 5));
  }
  function renderMysteryVendor() {
    if (!game.save) return;
    rollMysteryVendor();
    const c = game.char;
    $('mystery-gold').textContent = c.gold;
    const el = $('mystery-content');
    el.innerHTML = '';
    const mv = game.save.mysteryVendor;
    if (!mv || !ITEM_BASES[mv.baseId]) {
      el.innerHTML = '<div class="quest-card empty">The merchant has nothing today.</div>';
      return;
    }
    // Build the day's item — always unique rarity, 4 affixes (rollItem rule)
    const base = ITEM_BASES[mv.baseId];
    // Use a deterministic seeded item by re-rolling each call? Simpler: roll a fresh unique item each render
    // but cache the displayed item on the save record so affixes don't change between renders
    if (!mv.itemData) {
      const item = rollItem(Math.max(15, base.ilvl), 'unique');
      // Override baseId so it's our chosen item
      if (item) {
        item.baseId = mv.baseId;
        item.ilvl = base.ilvl;
        item.name = buildItemName(base, 'unique', item.affixes);
        mv.itemData = item;
        saveGame();
      }
    }
    const item = mv.itemData;
    const header = document.createElement('div');
    header.className = 'skill-header';
    header.innerHTML = `Today's offering. Stock rotates once per day.<br><span style="color:var(--text-dim)">Day ${mv.day}</span>`;
    el.appendChild(header);

    const price = mysteryPrice(item);
    const row = document.createElement('button');
    if (mv.bought) {
      row.className = 'inv-row disabled';
      row.innerHTML = `
        <div class="inv-icon">${base.icon}</div>
        <div class="inv-meta">
          <div class="inv-name rarity-${item.rarity}">${item.name}</div>
          <div class="inv-sub">SOLD — return tomorrow</div>
        </div>
        <div class="inv-equipped">SOLD</div>
      `;
    } else {
      const canAfford = c.gold >= price;
      row.className = 'inv-row focusable' + (canAfford ? '' : ' disabled');
      row.dataset.action = 'mystery-buy';
      const affixList = (item.affixes || []).map(a => `+${a.val} ${a.label}`).join(', ');
      const socketStr = item.sockets ? ` · ${item.sockets} socket${item.sockets === 1 ? '' : 's'}` : '';
      row.innerHTML = `
        <div class="inv-icon">${base.icon}</div>
        <div class="inv-meta">
          <div class="inv-name rarity-${item.rarity}">${item.name}</div>
          <div class="inv-sub">${base.type} · ilvl ${item.ilvl}${socketStr}</div>
          <div class="inv-sub" style="opacity:0.8">${affixList}</div>
        </div>
        <div class="inv-equipped" style="color:var(--gold)">${price}g</div>
      `;
    }
    el.appendChild(row);
  }
  function mysteryBuy() {
    if (!game.save) return;
    const mv = game.save.mysteryVendor;
    if (!mv || !mv.itemData) return;
    if (mv.bought) { showHudToast('Already bought today.'); return; }
    const price = mysteryPrice(mv.itemData);
    if (game.char.gold < price) { showHudToast('Not enough gold.'); return; }
    if (game.char.inventory.length >= 24) { showHudToast('Inventory full.'); return; }
    game.char.gold -= price;
    // Clone the item so the save record stays for "SOLD" display
    const purchased = JSON.parse(JSON.stringify(mv.itemData));
    purchased.id = 'i_' + Math.random().toString(36).slice(2, 9); // fresh id
    game.char.inventory.push(purchased);
    mv.bought = true;
    saveGame();
    renderMysteryVendor();
    updateHud();
    showHudToast(`Acquired: ${purchased.name}`);
  }

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
    if (!game.char.transmog) game.char.transmog = { weapon: null, armor: null };  // migrate older saves
    if (!game.save.wardrobe) game.save.wardrobe = {};
    scanWardrobe();   // unlock appearances already owned (equipped/inventory/stash)
    applyDerivedToChar();
  }

  // ============================================================
  // SAVE SYNC — manual export / import to move saves between devices
  // ============================================================
  function syncExport() {
    const box = document.getElementById('sync-export-box');
    if (!box) return;
    const raw = localStorage.getItem(CFG.storageKey);
    if (!raw) {
      box.value = '(no save on this device yet — play first)';
      showHudToast('No save to export.');
      return;
    }
    // Encode with a small wrapper so an Import knows it's a valid HollowLight save
    const wrapper = { app: 'hollowlight', v: 1, ts: Date.now(), payload: raw };
    let code;
    try {
      // base64 of the JSON wrapper — easier to copy/paste (no quotes inside)
      code = btoa(unescape(encodeURIComponent(JSON.stringify(wrapper))));
    } catch (e) {
      code = JSON.stringify(wrapper); // fallback to plain JSON if btoa fails
    }
    box.value = code;
    // Try to also copy to clipboard for convenience (may fail in restricted browsers)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code);
        showHudToast('Code copied to clipboard.');
      } else {
        box.select();
        showHudToast('Code generated — long-press to copy.');
      }
    } catch (e) {
      showHudToast('Code generated — select & copy manually.');
    }
  }

  function syncImport() {
    const box = document.getElementById('sync-import-box');
    if (!box) return;
    const raw = (box.value || '').trim();
    if (!raw) { showHudToast('Paste a code first.'); return; }
    let parsed = null;
    // Try base64-wrapped first
    try {
      const json = decodeURIComponent(escape(atob(raw)));
      parsed = JSON.parse(json);
    } catch (e) {
      // Fall back to direct JSON parse
      try { parsed = JSON.parse(raw); } catch (e2) { parsed = null; }
    }
    if (!parsed || !parsed.payload) {
      showHudToast('Invalid code. Make sure you copied the whole thing.');
      return;
    }
    // Validate the inner payload is a real HollowLight save
    let payloadObj;
    try { payloadObj = JSON.parse(parsed.payload); } catch (e) { payloadObj = null; }
    if (!payloadObj || payloadObj.v !== 2 || !payloadObj.char) {
      showHudToast('Code is not a valid HollowLight save.');
      return;
    }
    // Overwrite localStorage and reload the page so all state is fresh
    try {
      localStorage.setItem(CFG.storageKey, parsed.payload);
      showHudToast('Save imported. Reloading...');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      showHudToast('Save failed: storage error.');
    }
  }

  // ----- Short-code sync via dpaste.com (public free paste service) -----
  // Export: POST save → service returns a short URL → extract slug → show to user
  // Import: GET https://dpaste.com/<slug>.txt → install
  // If the service is unavailable we fall back to suggesting the long-code path.
  const SHORT_CODE_BASE = 'https://dpaste.com';

  function setShortCodeBox(text, isMuted) {
    const box = document.getElementById('sync-short-code');
    if (!box) return;
    box.textContent = text;
    box.classList.toggle('muted', !!isMuted);
  }

  async function syncShortExport() {
    const raw = localStorage.getItem(CFG.storageKey);
    if (!raw) { setShortCodeBox('No save on this device yet.', true); showHudToast('No save to export.'); return; }
    setShortCodeBox('Generating code...', true);
    try {
      // Wrap with a header so import can validate it's a HollowLight save
      const wrapper = { app: 'hollowlight', v: 1, ts: Date.now(), payload: raw };
      const body = JSON.stringify(wrapper);
      // dpaste.com API: POST form-encoded `content=...` to /api/v2/ → returns plain-text URL
      const form = new URLSearchParams();
      form.set('content', body);
      form.set('syntax', 'text');
      form.set('expiry_days', '30');
      const resp = await fetch(SHORT_CODE_BASE + '/api/v2/', {
        method: 'POST',
        body: form,
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const url = (await resp.text()).trim();
      // The response is a URL like https://dpaste.com/AbC1234 — pull out the slug
      const match = url.match(/dpaste\.com\/([A-Za-z0-9]+)/);
      if (!match) throw new Error('Bad response: ' + url);
      const code = match[1];
      setShortCodeBox(code, false);
      // Best-effort clipboard copy
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
          showHudToast(`Code ${code} copied. Expires in 30 days.`);
        } else {
          showHudToast(`Your code: ${code}`);
        }
      } catch (e) { showHudToast(`Your code: ${code}`); }
    } catch (e) {
      setShortCodeBox('Service unavailable — use the long-code fallback below.', true);
      showHudToast('Could not reach sync service. Try the long-code option.');
    }
  }

  async function syncShortImport() {
    const input = document.getElementById('sync-short-input');
    if (!input) return;
    let code = (input.value || '').trim();
    if (!code) { showHudToast('Enter a code first.'); return; }
    // If user pasted a full URL, extract just the slug
    const m = code.match(/dpaste\.com\/([A-Za-z0-9]+)/);
    if (m) code = m[1];
    // Slug is alphanumeric only — strip stray whitespace/punctuation
    code = code.replace(/[^A-Za-z0-9]/g, '');
    if (!code) { showHudToast('Code looks invalid.'); return; }
    showHudToast('Fetching code ' + code + '...');
    try {
      const resp = await fetch(`${SHORT_CODE_BASE}/${code}.txt`);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = (await resp.text()).trim();
      // Validate it's a HollowLight wrapper (accept the old 'glasspire' tag too)
      let wrapper;
      try { wrapper = JSON.parse(text); } catch (e) { wrapper = null; }
      if (!wrapper || !wrapper.payload || (wrapper.app !== 'hollowlight' && wrapper.app !== 'glasspire')) {
        showHudToast('Code did not return a valid HollowLight save.');
        return;
      }
      let payloadObj;
      try { payloadObj = JSON.parse(wrapper.payload); } catch (e) { payloadObj = null; }
      if (!payloadObj || payloadObj.v !== 2 || !payloadObj.char) {
        showHudToast('Save payload is invalid.');
        return;
      }
      localStorage.setItem(CFG.storageKey, wrapper.payload);
      showHudToast('Save imported. Reloading...');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      showHudToast('Could not fetch code. Check the code and your connection.');
    }
  }

  // ----- D-pad code picker (glasses-friendly text entry) -----
  // dpaste.com codes use a-z A-Z 0-9 (case-sensitive). Order chosen so lowercase
  // letters (the most common) sit at the start of the cycle.
  const PICKER_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const PICKER_LEN = 7;

  function openCodePicker() {
    // Prefill from the text input if the user already started typing
    const prefill = (document.getElementById('sync-short-input')?.value || '').trim();
    const code = [];
    for (let i = 0; i < PICKER_LEN; i++) {
      const c = prefill[i];
      code.push((c && PICKER_CHARS.indexOf(c) >= 0) ? c : 'a');
    }
    game.codePicker = { code, cursor: 0 };
    navigateTo('code-picker');
  }

  function renderCodePicker() {
    const cp = game.codePicker; if (!cp) return;
    const container = document.getElementById('code-picker-slots');
    if (!container) return;
    container.innerHTML = cp.code.map((c, i) =>
      `<div class="picker-slot ${i === cp.cursor ? 'active' : ''}">${c}</div>`
    ).join('');
    const status = document.getElementById('code-picker-status');
    if (status) status.textContent = `Slot ${cp.cursor + 1} of ${PICKER_LEN}`;
  }

  function cyclePickerChar(dir) {
    const cp = game.codePicker; if (!cp) return;
    const c = cp.code[cp.cursor];
    let idx = PICKER_CHARS.indexOf(c);
    if (idx < 0) idx = 0;
    idx = (idx + dir + PICKER_CHARS.length) % PICKER_CHARS.length;
    cp.code[cp.cursor] = PICKER_CHARS[idx];
    renderCodePicker();
  }

  function movePickerCursor(dir) {
    const cp = game.codePicker; if (!cp) return;
    cp.cursor = Math.max(0, Math.min(cp.code.length - 1, cp.cursor + dir));
    renderCodePicker();
  }

  function submitCodePicker() {
    const cp = game.codePicker; if (!cp) { navigateBack(); return; }
    const code = cp.code.join('');
    // Drop the code into the regular input box, then reuse the existing
    // syncShortImport flow so all validation/error handling is shared.
    const input = document.getElementById('sync-short-input');
    if (input) input.value = code;
    navigateBack();
    setTimeout(() => syncShortImport(), 50);
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
      tickTelegraphs(dt);
      tickSkillEffects(dt);
      tickEffects(dt);
      tickAmbient(dt);
      tickRift(dt);
      tickAmbush(dt);
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
    // expose for debugging (old alias kept for back-compat)
    window.__hollowlight = window.__glasspire = { game, enterBiome, enterTown, CLASSES, BIOMES };
  }

  // Data shim for the optional WebGL 3D renderer (render3d.js). Set at top-level so it
  // exists before the deferred module self-inits. The 3D layer reads only this — no logic crosses over.
  window.__GL_DATA = { rarityColor, mythicShimmer, gearLook, GEAR_LOOKS, ITEM_BASES, CLASSES, ENEMIES, SHRINES, BIOMES, RARITY_RANK, CFG };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
