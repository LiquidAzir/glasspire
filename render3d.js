// =============================================================
// HollowLight — WebGL 3D renderer (top-down). Opt-in via ?gl=1
// Replaces ONLY the Canvas2D draw layer. All game logic lives in app.js.
// See RENDER3D_PLAN.md. app.js stays an IIFE and talks to us via
// window.__GL (facade) + window.__GL_DATA (data shim).
// Additive display: black = transparent, bright = emitted light.
// =============================================================
import * as THREE from 'three';
import * as Builders from './builders.js';

const RENDER3D = new URLSearchParams(location.search).has('gl')
  || (typeof localStorage !== 'undefined' && localStorage.getItem('hl_render') === 'gl');

// ---- constants (reproduce w2s: (w-cam)*28 over a 600px viewport) ----
const TILE = 28;
const SPAN = 600 / TILE;          // 21.4286 tiles across the viewport
const HALF = SPAN / 2;
const TILT = THREE.MathUtils.degToRad(22);   // camera tilt; 0 = pixel-exact flat
const ORTHO_DIST = 60;            // ortho: distance is arbitrary, doesn't change scale
const WALLH = 0.9;                // wall height in world units (1 unit = 1 tile)

// ---- module state ----
let renderer = null, scene = null, cam = null;
let worldGroup = null;            // merged floor+walls+decor mesh (one draw call), rebuilt per zone
let torch = null;                 // player torch blob
let playerMesh = null;            // armored player rig
let overlayCtx = null;            // crisp 2D overlay canvas (HP bars projected over the 3D models)
let DATA = {};                    // window.__GL_DATA
const _color = new THREE.Color();

// ---- the facade app.js sees ----
const GL = {
  enabled: false,
  // subsystem mask: true = this subsystem is rendered in 3D (app.js skips its 2D draw)
  mask: {
    world: false, town: false, ambient: false, items: false, portals: false,
    shrines: false, telegraphs: false, npcs: false, projectiles: false,
    minions: false, enemies: false, player: false, particles: false,
  },
  init, frame, onZoneChange, dispose, setMask,
};
window.__GL = GL;

let _frames = 0;
GL._dbg = () => ({
  frames: _frames,
  sceneChildren: scene ? scene.children.length : 0,
  worldVerts: worldGroup && worldGroup.children[0] && worldGroup.children[0].geometry
    ? worldGroup.children[0].geometry.getAttribute('position').count : 0,
  camPos: cam ? cam.position.toArray().map(n => +n.toFixed(2)) : null,
  camLook: cam ? [+(cam.position.x).toFixed(2), +(cam.position.z - Math.sin(TILT) * ORTHO_DIST).toFixed(2)] : null,
  playerPos: playerMesh ? playerMesh.position.toArray().map(n => +n.toFixed(2)) : null,
  playerVisible: playerMesh ? playerMesh.visible : null,
  fogDensity: scene && scene.fog ? scene.fog.density : null,
});

GL._builders = Builders;   // exposed for the construction self-test

function setMask(patch) { Object.assign(GL.mask, patch); }

// =============================================================
// INIT
// =============================================================
function init() {
  const canvas = document.getElementById('game-canvas-gl');
  if (!canvas) throw new Error('no #game-canvas-gl');
  DATA = window.__GL_DATA || {};
  Builders.setTHREE(THREE);

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,                 // transparent clear → black = see-through on additive panel
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    depth: true, stencil: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);                 // hard cap — never devicePixelRatio
  renderer.setSize(600, 600, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.sortObjects = false;
  renderer.autoClear = true;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.04);   // black fog = edge fade to transparent (the vignette)

  // tilted orthographic camera; vertical frustum divided by cos(tilt) to keep ~28px/tile after foreshortening
  const vt = HALF / Math.cos(TILT);
  cam = new THREE.OrthographicCamera(-HALF, HALF, vt, -vt, 0.1, 200);

  // player torch blob — a warm additive radial glow on the ground
  torch = makeTorch();
  scene.add(torch);

  // reveal the GL + overlay canvases (they live inside #game, still hidden until in-game)
  canvas.style.display = 'block';
  const ov = document.getElementById('game-overlay-2d');
  if (ov) { ov.style.display = 'block'; overlayCtx = ov.getContext('2d'); }

  // World, player, enemies, items, portals, shrines, NPCs render in 3D; combat FX
  // (projectiles, particles, telegraphs, minions) + town features stay 2D-composited.
  setMask({ world: true, player: true, enemies: true, items: true, portals: true, shrines: true, npcs: true });
  GL.enabled = true;
  console.log('[3D] renderer mounted (Stage 2: world + entities)');
}

// =============================================================
// CAMERA — follows game.cam exactly; never recomputes the clamp
// =============================================================
function updateCamera3D(game) {
  const cx = game.cam.x + HALF;     // view-center in world tiles (matches drawWorld window)
  const cz = game.cam.y + HALF;
  // shared screen-shake set by app.js render() (px) → world units
  const sx = (game._shakeX || 0) / TILE;
  const sz = (game._shakeY || 0) / TILE;
  cam.position.set(cx + sx, Math.cos(TILT) * ORTHO_DIST, cz + sz + Math.sin(TILT) * ORTHO_DIST);
  cam.lookAt(cx + sx, 0, cz + sz);
}

// =============================================================
// WORLD GEOMETRY — built once per zone, one merged mesh (1 draw call)
// =============================================================
function onZoneChange(world) {
  if (!renderer) return;
  for (const L of ALL_LAYERS) L.clear();           // drop the previous zone's entities
  if (overlayCtx) overlayCtx.clearRect(0, 0, 600, 600);
  disposeWorld();
  if (!world || !world.grid) return;
  worldGroup = buildWorld(world);
  scene.add(worldGroup);
  // fog density: dungeons a touch tighter, town airier (lower = brighter, more visible)
  scene.fog.density = world.kind === 'town' ? 0.026 : 0.042;
}

function disposeWorld() {
  if (!worldGroup) return;
  scene.remove(worldGroup);
  worldGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  worldGroup = null;
}

function buildWorld(world) {
  const grid = world.grid, W = world.w, H = world.h;
  const pal = world.palette || { wall: '#6df1ff', floor: '#221a14', accent: '#6df1ff' };
  // derive colors (emissive on additive). Gothic look: visible floor, bright torch-lit
  // wall tops, and wall sides bright enough to read as stone (not a black void).
  const floorCol = mul(pal.floor, 2.15);
  const wallTop = mul(pal.wall, 1.05);
  const wallSide = mul(pal.wall, 0.46);
  const decorCol = mul(pal.accent, 1.4);

  const isFloor = (x, y) => y >= 0 && y < H && x >= 0 && x < W && grid[y][x] === 0;
  const pos = [], col = [];

  function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c) {
    // two tris (a,b,c) (a,c,d); DoubleSide material so winding never matters in Stage 1
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = grid[y][x];
      if (g === 0) {
        // floor quad at y=0 with a faint per-tile brightness variation
        const h = ((x * 73 + y * 41) & 7) / 7;
        _color.set(floorCol).multiplyScalar(0.9 + h * 0.2);
        quad(x, 0, y,  x + 1, 0, y,  x + 1, 0, y + 1,  x, 0, y + 1, _color);
      } else if (g === 1) {
        const nearFloor = isFloor(x, y - 1) || isFloor(x, y + 1) || isFloor(x - 1, y) || isFloor(x + 1, y);
        if (!nearFloor) continue;
        // roof (top face)
        _color.set(wallTop);
        quad(x, WALLH, y,  x + 1, WALLH, y,  x + 1, WALLH, y + 1,  x, WALLH, y + 1, _color);
        // floor-facing side faces (3D walls)
        _color.set(wallSide);
        if (isFloor(x, y + 1)) quad(x, 0, y + 1,  x + 1, 0, y + 1,  x + 1, WALLH, y + 1,  x, WALLH, y + 1, _color);  // south
        if (isFloor(x, y - 1)) quad(x, 0, y,      x + 1, 0, y,      x + 1, WALLH, y,      x, WALLH, y,     _color);  // north
        if (isFloor(x - 1, y)) quad(x, 0, y,      x, 0, y + 1,      x, WALLH, y + 1,      x, WALLH, y,     _color);  // west
        if (isFloor(x + 1, y)) quad(x + 1, 0, y,  x + 1, 0, y + 1,  x + 1, WALLH, y + 1,  x + 1, WALLH, y, _color);  // east
      } else if (g === 2) {
        // decor: a short glowing pillar
        const dh = WALLH * 0.7;
        _color.set(decorCol);
        quad(x + 0.25, dh, y + 0.25,  x + 0.75, dh, y + 0.25,  x + 0.75, dh, y + 0.75,  x + 0.25, dh, y + 0.75, _color);
        quad(x + 0.25, 0, y + 0.75,   x + 0.75, 0, y + 0.75,   x + 0.75, dh, y + 0.75,   x + 0.25, dh, y + 0.75, _color);
        quad(x + 0.25, 0, y + 0.25,   x + 0.75, 0, y + 0.25,   x + 0.75, dh, y + 0.25,   x + 0.25, dh, y + 0.25, _color);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const grp = new THREE.Group();
  grp.add(mesh);
  return grp;
}

// =============================================================
// PLAYER — armored rig from builders.js. Tinted to class colour, with the
// equipped weapon model, rarity-coloured trim, and gear-look cosmetics.
// =============================================================
const WEAPON_ICON = { '⚔': 'sword', '✦': 'staff', '➹': 'bow', '☠': 'wand' };
const CLASS_WEAPON = { warrior: 'sword', mage: 'staff', ranger: 'bow', summoner: 'wand' };
const RANK = () => DATA.RARITY_RANK || { common: 0, magic: 1, rare: 2, unique: 3, mythic: 4 };

function ensurePlayer() {
  if (playerMesh) return;
  playerMesh = Builders.buildPlayer({});
  playerMesh.userData.equipKey = '';
  scene.add(playerMesh);
}

function weaponKindFor(char) {
  const w = char && char.equip && char.equip.weapon;
  if (w && DATA.ITEM_BASES) {
    const base = DATA.ITEM_BASES[w.baseId];
    if (base && WEAPON_ICON[base.icon]) return WEAPON_ICON[base.icon];
  }
  return CLASS_WEAPON[char && char.classId] || 'sword';
}
function lookDef(item) {
  if (!DATA.gearLook) return null;
  const id = DATA.gearLook(item);
  const def = id && DATA.GEAR_LOOKS && DATA.GEAR_LOOKS[id];
  return def ? { id, ...def } : null;
}
function bestRarityColor(char) {
  const rank = RANK(); let best = 'common';
  for (const it of [char.equip.weapon, char.equip.armor, char.equip.ring, char.equip.amulet]) {
    if (it && it.rarity && (rank[it.rarity] || 0) > (rank[best] || 0)) best = it.rarity;
  }
  return DATA.rarityColor ? DATA.rarityColor(best) : '#9fd8ff';
}
function clearMount(o) { while (o.children.length) o.remove(o.children[o.children.length - 1]); }

function syncPlayer(game, now) {
  ensurePlayer();
  const pm = playerMesh, ud = pm.userData, p = game.world.player, char = game.char;

  // --- tint (cheap, every frame) ---
  const cls = DATA.CLASSES && char ? DATA.CLASSES[char.classId] : null;
  ud.bodyMat.color.set((cls && cls.color) || '#8899aa').multiplyScalar(0.85); // gothic: darkened armour
  const accent = char ? bestRarityColor(char) : '#9fd8ff';
  ud.trimMat.color.set(accent);
  ud.eyeMat.color.set('#d6f4ff');

  // --- swap weapon + gear cosmetics only when equipment changes ---
  const wKind = weaponKindFor(char);
  const wpn = char && char.equip && char.equip.weapon;
  const wLook = lookDef(wpn);
  const aLook = lookDef(char && char.equip && char.equip.armor);
  const wColor = (wLook && wLook.color) || (wpn && DATA.rarityColor && DATA.rarityColor(wpn.rarity)) || accent;
  const key = wKind + '|' + wColor + '|' + (aLook ? aLook.id : '_') + '|' + (wLook ? wLook.id : '_');
  if (key !== ud.equipKey) {
    ud.equipKey = key;
    clearMount(ud.weaponMount);
    const wb = (Builders['buildWeapon_' + wKind] || Builders.buildWeapon_sword)({ color: wColor });
    ud.weaponMount.add(wb);
    clearMount(ud.backMount); clearMount(ud.headMount);
    if (aLook && aLook.body) {
      const c = aLook.color;
      if (aLook.body === 'cape' || aLook.body === 'spectral' || aLook.body === 'plate') ud.backMount.add(Builders.buildGear_cape({ color: c }));
      else if (aLook.body === 'wings') ud.backMount.add(Builders.buildGear_wings({ color: c }));
      else if (aLook.body === 'crown') ud.headMount.add(Builders.buildGear_crown({ color: c }));
      else if (aLook.body === 'halo') ud.headMount.add(Builders.buildGear_halo({ color: c }));
    }
  }

  // --- position, facing, bob + walk cycle ---
  const dx = p.x - (ud.lastX == null ? p.x : ud.lastX);
  const dy = p.y - (ud.lastY == null ? p.y : ud.lastY);
  ud.lastX = p.x; ud.lastY = p.y;
  const moving = Math.hypot(dx, dy) > 0.002;
  const bob = Math.sin(now / 200) * (moving ? 0.06 : 0.03);
  pm.position.set(p.x, bob, p.y);
  const d = p.lastDir || { x: 0, y: 1 };
  if (d.x || d.y) pm.rotation.y = Math.atan2(d.x, d.y);
  if (ud.legs) {
    const sw = moving ? Math.sin(now / 110) * 0.5 : 0;
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
    if (ud.arms) { ud.arms[0].rotation.x = -sw * 0.6; ud.arms[1].rotation.x = sw * 0.6; }
  }
  // per-child special animations (weapon orb, cape sway, halo spin…)
  ud.weaponMount.children[0] && ud.weaponMount.children[0].userData.anim && ud.weaponMount.children[0].userData.anim(ud.weaponMount.children[0], now);
  for (const mnt of [ud.backMount, ud.headMount]) for (const ch of mnt.children) ch.userData.anim && ch.userData.anim(ch, now);

  pm.visible = true;
}

// =============================================================
// TORCH — warm additive ground glow following the player
// =============================================================
function makeTorch() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,196,120,0.95)');
  grd.addColorStop(0.35, 'rgba(255,165,85,0.45)');
  grd.addColorStop(0.7, 'rgba(255,150,70,0.16)');
  grd.addColorStop(1, 'rgba(255,150,70,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), mat);
  m.rotation.x = -Math.PI / 2;     // lie flat on the ground
  m.position.y = 0.04;
  m.renderOrder = 2;
  return m;
}

function updateTorch(game) {
  if (!torch) return;
  const p = game.world.player;
  const town = game.world.kind === 'town';
  torch.position.set(p.x, 0.04, p.y);
  torch.scale.setScalar(town ? 1.6 : 1.0);
}

// =============================================================
// ENTITY LAYERS (Stage 2) — pooled 3D objects synced to game arrays.
// Each layer maps a game entity list to builder Groups, reuses objects across
// frames (keyed by entity identity via a WeakMap) and drops them when gone.
// =============================================================
const _uidMap = new WeakMap(); let _uidSeq = 0;
function uid(e) { let id = _uidMap.get(e); if (id === undefined) { id = ++_uidSeq; _uidMap.set(e, id); } return id; }
function builderFor(fn) { return typeof Builders[fn] === 'function' ? Builders[fn] : Builders.buildPlaceholder; }
const _warned = new Set();
const _proj = new THREE.Vector3();
function projectToScreen(x, y, z) {
  _proj.set(x, y, z).project(cam);
  return { x: (_proj.x * 0.5 + 0.5) * 600, y: (1 - (_proj.y * 0.5 + 0.5)) * 600, vis: _proj.z < 1 && _proj.z > -1 };
}

function makeLayer(spec, sync) {
  const pool = new Map();        // uid -> { obj, sig, lx, lz, phase }
  const liveTmp = new Set();
  return {
    reconcile(list, now) {
      liveTmp.clear();
      if (list) for (let i = 0; i < list.length; i++) {
        const e = list[i]; if (!e) continue;
        const id = uid(e); liveTmp.add(id);
        const s = spec(e);
        let slot = pool.get(id);
        if (!slot || slot.sig !== s.sig) {
          if (slot) scene.remove(slot.obj);
          let obj;
          try { obj = builderFor(s.fn)(s.opts || {}); }
          catch (err) { if (!_warned.has(s.fn)) { _warned.add(s.fn); console.warn('[3D] builder failed:', s.fn, err.message); } obj = Builders.buildPlaceholder(s.opts || {}); }
          scene.add(obj);
          slot = { obj, sig: s.sig, lx: e.x, lz: e.y, phase: (id % 16) * 0.39 };
          pool.set(id, slot);
        }
        slot.obj.visible = true;
        sync(slot, e, now);
      }
      for (const [id, slot] of pool) if (!liveTmp.has(id)) { scene.remove(slot.obj); pool.delete(id); }
    },
    clear() { for (const [, slot] of pool) scene.remove(slot.obj); pool.clear(); },
  };
}

// position + facing (derived from movement) + per-model idle animation
function place(slot, e, now, baseY, bobAmp) {
  const obj = slot.obj;
  const bob = bobAmp ? Math.sin(now / 240 + slot.phase) * bobAmp : 0;
  obj.position.set(e.x, (baseY || 0) + bob, e.y);
  const dx = e.x - slot.lx, dz = e.y - slot.lz;
  if (Math.abs(dx) + Math.abs(dz) > 0.0008) { obj.rotation.y = Math.atan2(dx, dz); slot.lx = e.x; slot.lz = e.y; }
  if (obj.userData.anim) obj.userData.anim(obj, now);
}

const enemyLayer = makeLayer(
  e => ({ sig: (e.shape || 'skeleton') + (e.boss ? 'B' : '') + (e.elite ? 'E' : '') + (e.eliteColor || e.color || ''),
          fn: 'buildEnemy_' + (e.shape || 'skeleton'),
          opts: { color: e.eliteColor || e.color || '#cfcfcf', boss: !!e.boss } }),
  (slot, e, now) => {
    place(slot, e, now, 0, e.shape === 'plant' ? 0 : 0.03);
    slot.obj.scale.setScalar(e.boss ? 1.6 : (e.elite ? 1.18 : (e._isSplit ? 0.7 : 1)));
  }
);
const itemLayer = makeLayer(
  e => { const it = e.item || {}; const base = DATA.ITEM_BASES && DATA.ITEM_BASES[it.baseId];
         const t = base ? base.type : null;
         let fn = 'buildItem_gear';
         if (it.gold || t === 'gold') fn = 'buildItem_coin';
         else if (t === 'gem') fn = 'buildItem_gem';
         else if (t === 'consumable') fn = 'buildItem_potion';
         const color = (DATA.rarityColor && it.rarity) ? DATA.rarityColor(it.rarity) : '#ffd166';
         return { sig: fn + color, fn, opts: { color } }; },
  (slot, e, now) => place(slot, e, now, 0.12, 0)
);
const portalLayer = makeLayer(
  e => ({ sig: 'portal' + (e.kind || ''), fn: 'buildProp_portal', opts: { color: e.kind === 'next' ? '#8a6cff' : '#6df1ff' } }),
  (slot, e, now) => place(slot, e, now, 0, 0)
);
const shrineLayer = makeLayer(
  e => ({ sig: 'shrine' + (e.type || '') + (e.used ? 'U' : ''), fn: 'buildProp_shrine', opts: { color: e.used ? '#5a6470' : '#9be8ff' } }),
  (slot, e, now) => { place(slot, e, now, 0, 0); if (e.used) slot.obj.scale.setScalar(0.85); }
);
const npcLayer = makeLayer(
  e => ({ sig: 'npc' + (e.role || e.name || ''), fn: 'buildNpc', opts: { color: e.color || '#ffd9a0' } }),
  (slot, e, now) => place(slot, e, now, 0, 0.025)
);
const ALL_LAYERS = [enemyLayer, itemLayer, portalLayer, shrineLayer, npcLayer];

// enemy HP bars on the crisp overlay canvas, positioned by projecting the model
// through the camera (so they track the tilted view, not flat w2s).
function drawEnemyOverlays(game) {
  const octx = overlayCtx; if (!octx) return;
  octx.clearRect(0, 0, 600, 600);
  if (!GL.mask.enemies || !game.enemies) return;
  for (const e of game.enemies) {
    if (e.hp == null || e.hpMax == null) continue;
    const sc = e.boss ? 1.6 : (e.elite ? 1.18 : 1);
    const p = projectToScreen(e.x, 1.55 * sc, e.y);
    if (!p.vis || p.x < -40 || p.x > 640 || p.y < -40 || p.y > 640) continue;
    const pct = Math.max(0, Math.min(1, e.hp / e.hpMax));
    if (pct >= 1 && !e.boss && !e.elite) continue;     // hide full-HP trash bars (less clutter)
    const w = e.boss ? 46 : (e.elite ? 30 : 22), h = e.boss ? 5 : 3;
    const x = p.x - w / 2, y = p.y;
    octx.fillStyle = 'rgba(0,0,0,0.6)'; octx.fillRect(x - 1, y - 1, w + 2, h + 2);
    octx.fillStyle = e.boss ? '#ff4d6d' : (e.elite ? (e.eliteColor || '#ffd166') : '#ff6b85');
    octx.fillRect(x, y, w * pct, h);
    if (e.frozen) { octx.fillStyle = 'rgba(140,210,255,0.55)'; octx.fillRect(x, y, w * pct, h); }
  }
}

// =============================================================
// FRAME — called by app.js render() when GL.enabled
// =============================================================
function frame(game, now) {
  if (!renderer || !game || !game.world) return;
  _frames++;
  updateCamera3D(game);
  if (GL.mask.player) { syncPlayer(game, now); updateTorch(game); }
  else if (playerMesh) playerMesh.visible = false;
  if (GL.mask.enemies) enemyLayer.reconcile(game.enemies, now);
  if (GL.mask.items)   itemLayer.reconcile(game.items, now);
  if (GL.mask.portals) portalLayer.reconcile(game.world.portals, now);
  if (GL.mask.shrines) shrineLayer.reconcile(game.world.shrines, now);
  if (GL.mask.npcs)    npcLayer.reconcile(game.world.npcs, now);
  renderer.render(scene, cam);
  drawEnemyOverlays(game);
}

// =============================================================
function dispose() {
  disposeWorld();
  if (renderer) renderer.dispose();
  GL.enabled = false;
}

// ---- helpers ----
function mul(hex, k) {
  _color.set(hex).multiplyScalar(k);
  return '#' + _color.getHexString();
}

// ---- self-init (don't rely on app.js to call us) ----
if (RENDER3D) {
  try { init(); } catch (e) { console.error('[3D] init failed — staying on 2D', e); GL.enabled = false; }
}
