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
    playerSpeed: 10,          // tiles/sec — fast but controllable in corridors
    stepImpulse: 0.18,        // sec — minimum movement time per tap (~1.8 tiles per tap)
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
    { id: 'voidspire', name: 'The Void Spire',    shortName: 'VOIDSPIRE',
      palette: { wall: '#b388ff', floor: '#0d0d1a', accent: '#00e5ff' },
      enemies: ['voidling', 'nullweaver', 'crystalsentinel'],
      boss: 'voidlord',
      unlocked: false },
  ];

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
    'glasspire-focus':    { type: 'weapon', name: 'Glasspire Focus',    icon: '✦', base: { dmg: 38, mp: 40 }, ilvl: 21, glyph: 'wep' },

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
    'glasspire-aegis':    { type: 'armor', name: 'Glasspire Aegis',     icon: '◇', base: { def: 36, hp: 20 }, ilvl: 19 },

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
    'glasspire-crown':    { type: 'armor', name: 'Glasspire Crown',     icon: '◆', base: { def: 14, hp: 15 }, ilvl: 14 },
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
    'glasspire-heart':    { type: 'amulet', name: 'Glasspire Heart',    icon: '◈', base: {}, ilvl: 20 },
    'eye-of-the-spire':   { type: 'amulet', name: 'Eye of the Spire',  icon: '◈', base: { hp: 15, mp: 15 }, ilvl: 22 },

    // ===== LEGENDARY WEAPONS =====
    'demonslayer':        { type: 'weapon', name: 'Demonslayer',         icon: '⚔', base: { dmg: 42, hp: 30, str: 3 }, ilvl: 23, glyph: 'wep' },
    'frostbite-edge':     { type: 'weapon', name: 'Frostbite Edge',      icon: '⚔', base: { dmg: 38, def: 8 },  ilvl: 21, glyph: 'wep' },
    'starfall-staff':     { type: 'weapon', name: 'Starfall Staff',      icon: '✦', base: { dmg: 44, mp: 50, int: 3 }, ilvl: 23, glyph: 'wep' },
    'voidweaver':         { type: 'weapon', name: 'Voidweaver',          icon: '✦', base: { dmg: 40, mp: 35 }, ilvl: 22, glyph: 'wep' },
    'typhoon-bow':        { type: 'weapon', name: 'Typhoon Bow',         icon: '➹', base: { dmg: 38, dex: 3 }, ilvl: 23, glyph: 'wep' },
    'shadowpiercer':      { type: 'weapon', name: 'Shadowpiercer',       icon: '➹', base: { dmg: 34, crit: 8 }, ilvl: 21, glyph: 'wep' },
    'soulreaper':         { type: 'weapon', name: 'Soulreaper',          icon: '☠', base: { dmg: 40, mp: 25, hp: 15 }, ilvl: 23, glyph: 'wep' },
    'gravecaller':        { type: 'weapon', name: 'Gravecaller',         icon: '☠', base: { dmg: 36, mp: 18 }, ilvl: 21, glyph: 'wep' },

    // ===== ELITE ARMOR =====
    'dragonscale-plate':  { type: 'armor', name: 'Dragonscale Plate',    icon: '◇', base: { def: 42, hp: 30 }, ilvl: 22 },
    'abyssal-robe':       { type: 'armor', name: 'Abyssal Robe',         icon: '◇', base: { def: 24, mp: 65 }, ilvl: 22 },
    'nightstalker-coat':  { type: 'armor', name: 'Nightstalker Coat',    icon: '◇', base: { def: 30, dex: 2 }, ilvl: 21 },
    'bonelord-mantle':    { type: 'armor', name: 'Bonelord Mantle',      icon: '◇', base: { def: 26, mp: 40, hp: 20 }, ilvl: 22 },

    // ===== ELITE HELMETS =====
    'crown-of-ashes':     { type: 'armor', name: 'Crown of Ashes',       icon: '◆', base: { def: 18, dmg: 5 }, ilvl: 20 },
    'mindshatter-circlet':{ type: 'armor', name: 'Mindshatter Circlet',  icon: '◆', base: { def: 12, mp: 30, int: 2 }, ilvl: 19 },

    // ===== ELITE SHIELDS =====
    'aegis-of-the-spire': { type: 'armor', name: 'Aegis of the Spire',  icon: '⊡', base: { def: 38, hp: 35 }, ilvl: 21 },

    // ===== ELITE BOOTS =====
    'voidstep-boots':     { type: 'armor', name: 'Voidstep Boots',       icon: '◈', base: { def: 14, dex: 2 }, ilvl: 19 },
    'flamewalk-greaves':  { type: 'armor', name: 'Flamewalk Greaves',    icon: '◈', base: { def: 18, hp: 20, str: 1 }, ilvl: 21 },

    // ===== LEGENDARY RINGS =====
    'ring-of-the-archdemon': { type: 'ring', name: 'Ring of the Archdemon', icon: '○', base: { dmg: 6, crit: 5 }, ilvl: 22 },
    'frostfire-band':     { type: 'ring', name: 'Frostfire Band',        icon: '○', base: { mp: 18, hp: 10 }, ilvl: 20 },
    'blood-signet':       { type: 'ring', name: 'Blood Signet',          icon: '○', base: { hp: 25, vit: 3 }, ilvl: 21 },

    // ===== LEGENDARY AMULETS =====
    'heart-of-the-wyrm':  { type: 'amulet', name: 'Heart of the Wyrm',  icon: '◈', base: { hp: 30, def: 8, vit: 2 }, ilvl: 22 },
    'pendant-of-souls':   { type: 'amulet', name: 'Pendant of Souls',   icon: '◈', base: { mp: 25, dmg: 4, int: 2 }, ilvl: 21 },
    'stormcaller-chain':  { type: 'amulet', name: 'Stormcaller Chain',   icon: '◈', base: { dmg: 6, aspd: 8, dex: 2 }, ilvl: 23 },
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
  function makeStarterItem(baseId) {
    const base = ITEM_BASES[baseId];
    return {
      id: 'i_' + Math.random().toString(36).slice(2, 9),
      baseId,
      rarity: 'common',
      affixes: [],
      ilvl: 1,
      name: base.name,
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
        selectedSkill: cls.skills[0],  // track which skill is active
      },
      stash: [],
      unlockedBiomes: { crypts: true, overgrowth: false, frostpeak: false, infernal: false, voidspire: false },
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

    // War Cry buff: +50% damage
    if (game.world && game.world.player && game.world.player.warcryBuff > 0) {
      dmg = Math.floor(dmg * 1.5);
    }

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
  function clearSkillEffects() {
    game.pendingMeteors = [];
    game.poisonZones = [];
    game.soulDrains = [];
    game.corpsePositions = [];
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
    clearSkillEffects();
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
    clearSkillEffects();
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
  function getActiveSkillId() {
    const c = game.char;
    const cls = CLASSES[c.classId];
    // Use player's selected skill, fall back to class default
    if (c.selectedSkill && SKILLS[c.selectedSkill]) return c.selectedSkill;
    return cls.skills[0];
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
    const cost = skill.cost || cls.activeSkillCost;
    if (c.mp < cost) { showHudToast('Not enough mana'); return; }
    c.mp -= cost;
    p.skillCd = skill.cooldown;

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
      const dmg = Math.floor(d.dmg * 4.0);
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
      const dmg = Math.floor(d.dmg * 0.6);
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
          target: near, dmg: Math.floor(d.dmg * 1.0), crit: d.crit,
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
    burst(e.x, e.y, e.color, e.boss ? 35 : 20);
    burst(e.x, e.y, '#ffffff', e.boss ? 12 : 5);
    game.screenShake = Math.max(game.screenShake, e.boss ? 0.45 : 0.12);
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
      e.traitCd = Math.max(0, e.traitCd - dt);
      e.lunging = Math.max(0, e.lunging - dt);
      e.charging = Math.max(0, e.charging - dt);
      e.phased = Math.max(0, e.phased - dt);
      if (e.frozen > 0) continue;
      if (e.stagger > 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 12) continue; // out of awareness

      // --- Trait-based special behaviors (fired before basic AI) ---
      if (e.trait && e.traitCd <= 0) {
        switch (e.trait) {
          case 'lunge': // Ghoul: lunges forward dealing bonus damage
            if (d < 4 && d > 1.5) {
              e.lunging = 0.3;
              const lx = dx / d * 2.5, ly = dy / d * 2.5;
              tryMove(e, lx, ly);
              if (dist(e, p) < 1.2) { damagePlayer(Math.floor(e.dmg * 1.4)); burst(p.x, p.y, e.color, 10); }
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
              for (const ally of game.enemies) {
                if (ally !== e && ally.id === 'wolf' && dist(ally, e) < 4) packCount++;
              }
              if (packCount > 0) e.speed = ENEMIES.wolf.speed * (1 + packCount * 0.2);
              else e.speed = ENEMIES.wolf.speed;
              e.traitCd = 1.0;
            }
            break;
          case 'slam': // Frost Giant: ground slam AoE when in range
            if (d < 2.0) {
              damagePlayer(Math.floor(e.dmg * 1.5));
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
                damagePlayer(e.dmg);
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
                damagePlayer(Math.floor(e.dmg * 1.3));
                burst(p.x, p.y, e.color, 10);
                e.atkCd = 1.5;
              }
              e.traitCd = 4.0 + rand();
              continue;
            }
            break;
          case 'cleave': // Demon: hits in an arc, damages even if slightly off
            if (d < 1.8) {
              damagePlayer(Math.floor(e.dmg * 1.2));
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
          spawnProjectile(e.x, e.y, dx / d, dy / d, 6.5, e.dmg, e.projColor || '#c489ff', 'soul', false);
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
    let dmg = Math.max(1, Math.floor(rawDmg - d.def * 0.5));
    // Shield Wall: 70% damage reduction
    const p = game.world.player;
    if (p.shieldWall && p.shieldWall > 0) {
      dmg = Math.max(1, Math.floor(dmg * 0.3));
    }
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
      if (p.kind === 'ember' || p.kind === 'wisp' || p.kind === 'void') {
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
      } else if (p.kind === 'void') {
        // Pulsing diamond shapes for void biome
        ctx.translate(s.x, s.y);
        ctx.rotate(p.age * 0.8);
        const sz = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -sz); ctx.lineTo(sz, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz, 0);
        ctx.closePath(); ctx.fill();
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
                ctx.quadraticCurveTo(vx + Math.sin(now/800) * 3, s.y + t + 10, vx - 2, s.y + t + 18);
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
                ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 600 + hash);
                ctx.shadowColor = '#ff4400';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.moveTo(s.x + (hash % (t-4)) + 2, s.y);
                ctx.quadraticCurveTo(s.x + t * 0.5, s.y + t * 0.5, s.x + (hash2 % (t-4)) + 2, s.y + t);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
              }
              // Ember glow near floor edge
              if (hash % 8 === 0 && isFloorAt(x, y + 1)) {
                ctx.fillStyle = '#ff6600';
                ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now / 400 + hash2);
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
                ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 700 + hash);
                ctx.save();
                ctx.translate(s.x + t * 0.5, s.y + t * 0.5);
                ctx.rotate(hash * 0.05 + now / 3000);
                ctx.fillRect(-3, -6, 6, 12);
                ctx.restore();
                ctx.globalAlpha = 1;
              }
              // Void rune markings
              if (hash % 12 === 0) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 1000 + hash2);
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
            case 'crypts':
            case 'town':
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
                ctx.globalAlpha = 0.2 + 0.12 * Math.sin(now / 600 + hash * 0.3);
                ctx.shadowColor = '#ff4400';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.moveTo(s.x + hash % t, s.y + hash2 % (t * 0.5));
                ctx.lineTo(s.x + t * 0.5, s.y + t * 0.5);
                ctx.lineTo(s.x + hash2 % t, s.y + t * 0.5 + hash % (t * 0.5));
                ctx.stroke();
                ctx.shadowBlur = 0;
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
                ctx.globalAlpha = 0.25 + 0.1 * Math.sin(now / 400 + hash);
                ctx.shadowColor = '#ff4400';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.ellipse(s.x + t * 0.5, s.y + t * 0.5, t * 0.3, t * 0.2, 0, 0, PI2);
                ctx.fill();
                ctx.shadowBlur = 0;
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
                ctx.globalAlpha = 0.12 + 0.08 * Math.sin(now / 500 + hash);
                ctx.beginPath();
                ctx.arc(s.x + t * 0.5, s.y + t * 0.5, t * 0.25, 0, PI2);
                ctx.fill();
                ctx.globalAlpha = 1;
              }
              // Floating rune glyph
              if (hash % 14 === 0) {
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.2 + 0.15 * Math.sin(now / 900 + hash2);
                ctx.beginPath();
                const rx = s.x + t * 0.5, ry = s.y + t * 0.5;
                // small triangle rune
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
                ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 350 + hash2 * 0.7);
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
                // flame (animated)
                const flicker = Math.sin(now / 100 + hash) * 1.5;
                ctx.fillStyle = '#ff9933';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(tx, ty - 10 + flicker);
                ctx.quadraticCurveTo(tx + 3, ty - 6, tx + 2, ty - 4);
                ctx.lineTo(tx - 2, ty - 4);
                ctx.quadraticCurveTo(tx - 3, ty - 6, tx, ty - 10 + flicker);
                ctx.fill();
                // glow
                ctx.fillStyle = '#ff6600';
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 12;
                ctx.globalAlpha = 0.2 + 0.1 * Math.sin(now / 150 + hash);
                ctx.beginPath(); ctx.arc(tx, ty - 6, 6, 0, PI2); ctx.fill();
                ctx.shadowBlur = 0;
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
                ctx.globalAlpha = 0.6 + 0.2 * Math.sin(now / 600 + hash);
                ctx.shadowColor = '#44dd88';
                ctx.shadowBlur = 6;
                ctx.beginPath(); ctx.arc(mx, my - 7, 3, Math.PI, 0); ctx.fill();
                ctx.beginPath(); ctx.arc(mx + 4, my - 5, 2.5, Math.PI, 0); ctx.fill();
                ctx.shadowBlur = 0;
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
                  ctx.quadraticCurveTo(rx + Math.sin(now/600+r) * 2, s.y + t + 7, rx - 1, s.y + t + 12 + (hash % 5));
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
                ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 400 + hash);
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
                // fire (animated)
                const f1 = Math.sin(now / 80 + hash) * 2;
                const f2 = Math.cos(now / 120 + hash) * 1.5;
                ctx.fillStyle = '#ff4400';
                ctx.shadowColor = '#ff4400';
                ctx.shadowBlur = 10;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(bx, by - 12 + f1);
                ctx.quadraticCurveTo(bx + 4 + f2, by - 7, bx + 3, by - 3);
                ctx.lineTo(bx - 3, by - 3);
                ctx.quadraticCurveTo(bx - 4 - f2, by - 7, bx, by - 12 + f1);
                ctx.fill();
                // inner yellow
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.moveTo(bx, by - 9 + f1 * 0.5);
                ctx.quadraticCurveTo(bx + 2, by - 6, bx + 1.5, by - 3);
                ctx.lineTo(bx - 1.5, by - 3);
                ctx.quadraticCurveTo(bx - 2, by - 6, bx, by - 9 + f1 * 0.5);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
              }
              break;

            case 'voidspire':
              // Floating void crystal
              if (hash % 7 === 0) {
                const cx = s.x + t * 0.5, cy = s.y + t - 4;
                const floatY = Math.sin(now / 500 + hash) * 3;
                ctx.fillStyle = '#b388ff';
                ctx.shadowColor = '#b388ff';
                ctx.shadowBlur = 8;
                ctx.globalAlpha = 0.6;
                ctx.save();
                ctx.translate(cx, cy + floatY);
                ctx.rotate(now / 2000 + hash);
                // diamond crystal
                ctx.beginPath();
                ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0);
                ctx.closePath(); ctx.fill();
                ctx.restore();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
              }
              // Void tendril
              if (hash % 11 === 0) {
                ctx.strokeStyle = '#6a3aaa';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.35;
                const tx = s.x + hash % (t - 4) + 2;
                ctx.beginPath();
                ctx.moveTo(tx, s.y + t);
                ctx.quadraticCurveTo(tx + Math.sin(now/400+hash) * 5, s.y + t + 8, tx + Math.sin(now/600+hash) * 3, s.y + t + 16);
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
          const top = isFloorAt(x, y - 1);
          const bottom = isFloorAt(x, y + 1);
          const left = isFloorAt(x - 1, y);
          const right = isFloorAt(x + 1, y);
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
    const hasUniqueGear = wepRarity === 'unique' || armRarity === 'unique';
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

    // Unique gear: orbiting particles
    if (hasUniqueGear) {
      const uCol = rarityColor('unique');
      ctx.shadowColor = uCol;
      ctx.shadowBlur = 6;
      ctx.fillStyle = uCol;
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 3; i++) {
        const ang = now / 800 + i * PI2 / 3;
        const ox = Math.cos(ang) * 16, oy = Math.sin(ang) * 8;
        ctx.beginPath();
        ctx.arc(ox, oy, 1.5, 0, PI2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // Rare gear: pulsing aura ring
    if (hasRareGear && !hasUniqueGear) {
      const rCol = rarityColor('rare');
      ctx.strokeStyle = rCol;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(now / 400);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, PI2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // soft ground shadow
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(0, 10, 12, 4, 0, 0, PI2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // rim-light ground glow — color changes with unique gear
    const glowCol = hasUniqueGear ? rarityColor('unique') : (hasRareGear ? rarityColor('rare') : cls.color);
    ctx.fillStyle = glowCol;
    ctx.globalAlpha = 0.2 + (p.attackingFor > 0 ? 0.15 : 0) + (hasUniqueGear ? 0.1 : 0);
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
    const c = game.char;
    const wepItem = c.equip.weapon;
    const armItem = c.equip.armor;
    const wepBase = wepItem ? ITEM_BASES[wepItem.baseId] : null;
    const wepRarity = wepItem ? wepItem.rarity : 'common';
    const armRarity = armItem ? armItem.rarity : 'common';
    const wepColor = rarityColor(wepRarity);
    const armColor = armRarity !== 'common' ? rarityColor(armRarity) : color;

    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    // legs (animated when walking) — armor tinted
    ctx.fillStyle = armRarity !== 'common' ? armColor : color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-4, 4 + bob, 3, 7 + walk * 0.5);
    ctx.fillRect(1, 4 + bob, 3, 7 - walk * 0.5);
    ctx.globalAlpha = 1;

    // torso — shows armor rarity
    ctx.fillStyle = color;
    ctx.fillRect(-5, -4 + bob, 10, 9);
    // armor overlay (based on equipped armor rarity)
    if (armRarity === 'unique') {
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
    } else if (armRarity === 'rare') {
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
    const pSize = armRarity === 'unique' ? 5 : (armRarity === 'rare' ? 4.5 : 4);
    ctx.fillRect(-8, -4 + bob, pSize, pSize);
    ctx.fillRect(4, -4 + bob, pSize, pSize);
    // pauldron spike for unique
    if (armRarity === 'unique') {
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
      ctx.shadowColor = wepColor;
      ctx.shadowBlur = wepRarity === 'unique' ? 14 : (wepRarity === 'rare' ? 10 : 6);
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
      ctx.strokeStyle = wepRarity === 'unique' ? '#c0a0ff' : '#a0a0c0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -12);
      ctx.stroke();
      // staff head — ornate top piece
      ctx.fillStyle = wepRarity !== 'common' ? wepColor : '#6df1ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowColor = wepRarity !== 'common' ? wepColor : '#6df1ff';
      ctx.shadowBlur = 10 + 4 * Math.sin(now / 300);
      // orb
      ctx.beginPath();
      ctx.arc(0, -14, wepRarity === 'unique' ? 4 : 3.5, 0, PI2);
      ctx.fill();
      // inner sparkle
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 200);
      ctx.beginPath();
      ctx.arc(0, -14, 1.5, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // prongs around orb for rare+
      if (wepRarity === 'rare' || wepRarity === 'unique') {
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
      ctx.shadowColor = wepColor;
      ctx.shadowBlur = wepRarity === 'unique' ? 10 : 4;
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
      ctx.shadowColor = wepRarity !== 'common' ? wepColor : '#c489ff';
      ctx.shadowBlur = 8 + (wepRarity === 'unique' ? 6 : 0);
      ctx.beginPath();
      ctx.arc(0, -12, 3.5, 0, PI2);
      ctx.fill();
      // skull detail
      ctx.fillStyle = '#000';
      ctx.shadowBlur = 0;
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
      if (wepRarity === 'rare' || wepRarity === 'unique') {
        ctx.fillStyle = wepColor;
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 250);
        ctx.beginPath(); ctx.arc(0, -12, 5, 0, PI2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // attack arc effect — colored by weapon rarity
    if (attacking) {
      const arcCol = wepRarity !== 'common' ? wepColor : color;
      ctx.strokeStyle = arcCol;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = arcCol;
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
      const scale = isBoss ? 1.5 : (e._isSplit ? 0.7 : 1);
      const bob = Math.sin(now / 280 + e.x * 5) * 1.2;

      // shadow
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 9 * scale, 10 * scale, 4 * scale, 0, 0, PI2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // phased/charging glow
      if (e.phased > 0) ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 80);
      if (e.charging > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 50);

      // flash white on hit
      const col = e.hitFlash > 0 ? '#ffffff' : e.color;

      // pixel-art body — shape-specific rendering
      ctx.shadowColor = col;
      ctx.shadowBlur = isBoss ? 16 : 10;
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

  function drawItemShape(icon, col, pulse, now) {
    // Draw a distinct shape based on item type icon
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10 * pulse;
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
    ctx.shadowBlur = 0;
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
        ctx.lineWidth = gi.item.rarity === 'unique' ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(0, 12);
        ctx.stroke();
        // unique: add side beams
        if (gi.item.rarity === 'unique') {
          ctx.beginPath();
          ctx.moveTo(-4, -16); ctx.lineTo(0, -22); ctx.lineTo(4, -16);
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

  function itemTypeLabel(base) {
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
    const glow = rarity === 'unique' ? `filter="url(#glow)"` : (rarity === 'rare' ? `filter="url(#glowSm)"` : '');
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
    const skillName = SKILLS[getActiveSkillId()].name;
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
    const activeId = getActiveSkillId();
    const el = $('skills-content');
    el.innerHTML = '<div class="skill-header">Select Active Skill:</div>';
    for (const skillId of cls.skills) {
      const s = SKILLS[skillId];
      const isActive = skillId === activeId;
      const card = document.createElement('button');
      card.className = 'skill-card focusable' + (isActive ? ' skill-active' : '');
      card.dataset.action = 'select-skill';
      card.dataset.skill = skillId;
      card.innerHTML = `
        <div class="skill-name">${s.name}${isActive ? ' ★' : ''}</div>
        <div class="skill-desc">${s.desc}</div>
        <div class="skill-meta">Cooldown: ${s.cooldown}s · Mana: ${s.cost}</div>
      `;
      el.appendChild(card);
    }
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
      tickSkillEffects(dt);
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
