// =============================================================
// HollowLight — lightweight WebGL 3D renderer. Default; opt out with ?gl=0
// Replaces ONLY the Canvas2D draw layer. All game logic lives in app.js.
// See RENDER3D_PLAN.md. app.js stays an IIFE and talks to us via
// window.__GL (facade) + window.__GL_DATA (data shim).
// Additive display: black = transparent, bright = emitted light.
// =============================================================
import * as THREE from 'three';
import * as Builders from './builders.js';
import {loadArt,artReady,artModel,buildHero,buildGate,compactObject,compactBuilder,releaseCompact,artStats} from './spire-art.js';
import {buildWorldArt} from './spire-world.js';

// 3D is the default renderer. Opt out with the in-game toggle (localStorage
// hl_render='2d') or ?gl=0; ?gl / ?gl=1 forces it on regardless.
const _params = new URLSearchParams(location.search);
const RENDER3D = _params.get('gl') === '0' ? false
  : _params.has('gl') ? true
  : (typeof localStorage === 'undefined' || localStorage.getItem('hl_render') !== '2d');

// ---- constants (reproduce w2s: (w-cam)*28 over a 600px viewport) ----
const TILE = 28;
const SPAN = 600 / TILE;          // 21.4286 tiles across the viewport
const HALF = SPAN / 2;
const TILT = THREE.MathUtils.degToRad(45);   // camera tilt from straight-down (0 = pure top-down; higher = more angled, shows wall faces + character fronts)
const ORTHO_DIST = 60;            // ortho: distance is arbitrary, doesn't change scale

// ---- module state ----
let renderer = null, scene = null, cam = null;
let worldGroup = null;            // chunked floor/walls/Blender decor, rebuilt per zone
let torch = null;                 // player torch blob
let playerMesh = null;            // armored player rig
let overlayCtx = null;            // crisp 2D overlay canvas (HP bars projected over the 3D models)
let DATA = {};                    // window.__GL_DATA
let groundShadows = null;
const shadowMatrix = new THREE.Matrix4();
const _color = new THREE.Color();
const fogCenter = new THREE.Vector2();
const foggedMaterials = new WeakSet();
let overlayBoundsDirty = true, overlayObstacles = [];
window.addEventListener('resize', () => { overlayBoundsDirty = true; });
function updateOverlayBounds() {
  if (!overlayBoundsDirty || !overlayCtx) return;
  const rect = overlayCtx.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const sx = 600 / rect.width, sy = 600 / rect.height;
  overlayObstacles = ['hud-zone', 'minimap'].map(id => document.getElementById(id)).filter(Boolean).map(el => {
    const r = el.getBoundingClientRect();
    return { left:(r.left-rect.left)*sx-5, right:(r.right-rect.left)*sx+5, top:(r.top-rect.top)*sy-5, bottom:(r.bottom-rect.top)*sy+5 };
  });
  overlayBoundsDirty = false;
}
// Ground-distance fog avoids dimming the whole scene because the orthographic
// camera is sixty units above it. This retains a gentle fade around the hero.
function applyWorldFog(root) {
  root.traverse(o => {
    for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!material || !material.fog || foggedMaterials.has(material)) continue;
      foggedMaterials.add(material);
      material.onBeforeCompile = shader => {
        shader.uniforms.spireFogCenter = { value: fogCenter };
        shader.vertexShader = 'uniform vec2 spireFogCenter;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#ifdef USE_FOG\nvec4 spireWorld = modelMatrix * vec4(transformed, 1.0);\nvFogDepth = length(spireWorld.xz - spireFogCenter);\n#endif');
      };
      material.customProgramCacheKey = () => 'spire-ground-fog-v1';
      material.needsUpdate = true;
    }
  });
}

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
  rendererInfo: renderer ? {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures} : null,
  art: artStats(),
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
GL._gear = () => { if (!playerMesh) return 'no player'; const u = playerMesh.userData;
  const cnt = (mnt) => mnt ? mnt.children.length : -1;
  return { weapon: cnt(u.weaponMount), back: cnt(u.backMount), head: cnt(u.headMount), chest: cnt(u.chestMount), aura: cnt(u.auraMount), equipKey: u.equipKey }; };
GL._pdbg = () => particleSys ? {
  inScene: scene.children.indexOf(particleSys) >= 0, visible: particleSys.visible,
  drawRange: particleSys.geometry.drawRange.count, matSize: particleSys.material.size,
  hasMap: !!particleSys.material.map, vertexColors: particleSys.material.vertexColors,
  pos0: [pPos[0], pPos[1], pPos[2]], col0: [+pCol[0].toFixed(2), +pCol[1].toFixed(2), +pCol[2].toFixed(2)],
  boundingSphere: particleSys.geometry.boundingSphere ? particleSys.geometry.boundingSphere.radius : null,
} : 'no particleSys';
// world→screen projector for app.js UI text (floating damage, hints) so it tracks
// the tilted 3D scene instead of the flat w2s mapping. Returns {x,y} px or null.
GL.project = (wx, wy, h) => { if (!cam) return null; const p = projectToScreen(wx, h || 0, wy); return p.vis ? p : null; };

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

  // Ground tiles must project to 28px on BOTH axes, matching movement, the 2D
  // fallback and overlay coordinates. Dividing here flattened the world to half
  // height and made every 3D hero and doorway appear tiny.
  const vt = HALF * Math.cos(TILT);
  cam = new THREE.OrthographicCamera(-HALF, HALF, vt, -vt, 0.1, 200);

  // player torch blob — a warm additive radial glow on the ground
  torch = makeTorch();
  scene.add(torch);

  // reveal the GL + overlay canvases (they live inside #game, still hidden until in-game)
  canvas.style.display = 'block';
  const ov = document.getElementById('game-overlay-2d');
  if (ov) { ov.style.display = 'block'; overlayCtx = ov.getContext('2d'); }

  // Everything renders in 3D except ambient atmosphere motes (no entity to align to —
  // they stay 2D-composited). Town fountain/braziers are placed by buildTownFeatures.
  setMask({ world: true, town: true, player: true, enemies: true, items: true, portals: true, shrines: true,
            npcs: true, projectiles: true, minions: true, telegraphs: true, particles: true });
  GL.enabled = true;
  console.log('[3D] renderer mounted (Stage 4: full scene)');
}

// =============================================================
// CAMERA — follows game.cam exactly; never recomputes the clamp
// =============================================================
let _viewCX = 0, _viewCZ = 0;       // view-center in world tiles (for off-screen culling)
function updateCamera3D(game) {
  const cx = game.cam.x + HALF;     // view-center in world tiles (matches drawWorld window)
  const cz = game.cam.y + HALF;
  _viewCX = cx; _viewCZ = cz;
  fogCenter.set(game.world.player.x,game.world.player.y);
  // shared screen-shake set by app.js render() (px) → world units
  const sx = (game._shakeX || 0) / TILE;
  const sz = (game._shakeY || 0) / TILE;
  cam.position.set(cx + sx, Math.cos(TILT) * ORTHO_DIST, cz + sz + Math.sin(TILT) * ORTHO_DIST);
  cam.lookAt(cx + sx, 0, cz + sz);
}

// =============================================================
// WORLD GEOMETRY — baked once per zone with off-screen chunk culling
// =============================================================
function onZoneChange(world) {
  if (!renderer) return;
  overlayBoundsDirty = true;
  for (const L of ALL_LAYERS) L.clear();           // drop the previous zone's entities
  if (overlayCtx) overlayCtx.clearRect(0, 0, 600, 600);
  if (townGroup) { scene.remove(townGroup); releaseCompact(townGroup); townGroup = null; }
  disposeWorld();
  if (!world || !world.grid) return;
  worldGroup = buildWorldArt(world);
  applyWorldFog(worldGroup);
  scene.add(worldGroup);
  townGroup = buildTownFeatures(world);
  if (townGroup) { applyWorldFog(townGroup); scene.add(townGroup); }
  // fog density: dungeons a touch tighter, town airier (lower = brighter, more visible)
  scene.fog.density = world.kind === 'town' ? 0.038 : 0.065;
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

// =============================================================
// PLAYER — armored rig from builders.js. Tinted to class colour, with the
// equipped weapon model, rarity-coloured trim, and gear-look cosmetics.
// =============================================================
const WEAPON_ICON = { '⚔': 'sword', '✦': 'staff', '➹': 'bow', '☠': 'wand' };
const CLASS_WEAPON = { warrior: 'sword', mage: 'staff', ranger: 'bow', summoner: 'wand' };
const RANK = () => DATA.RARITY_RANK || { common: 0, magic: 1, rare: 2, unique: 3, mythic: 4 };

function ensurePlayer(char) {
  const classId = (char && char.classId) || 'warrior';
  if (playerMesh && playerMesh.userData.classId === classId && !!playerMesh.userData.bakedArt === !!artModel('hero_core_' + classId)) return;
  if (playerMesh) { scene.remove(playerMesh); playerMesh = null; }   // class changed (new game) -> rebuild
  const fn = Builders['buildPlayer_' + classId] || Builders.buildPlayer;
  playerMesh = buildHero(classId) || fn({ classId });
  const u = playerMesh.userData;
  u.classId = classId;
  u.equipKey = '';
  u.weaponBasePosition = u.weaponMount.position.clone();
  u.weaponBaseScale = u.weaponMount.scale.clone();
  if (u.eyeMat) u.eyeMat.color.set('#d6f4ff');       // constant — set once
  applyWorldFog(playerMesh); scene.add(playerMesh);
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
// transmog: a chosen look id overrides the item's own appearance (color/fx/body);
// the item's rarity still drives tier ornamentation + aura.
function resolveLook(item, mogId) {
  const id = mogId || (DATA.gearLook && DATA.gearLook(item));
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
function rankOf(it) { return it && it.rarity ? (RANK()[it.rarity] || 0) : 0; }   // 0 common .. 4 mythic
function bestRank(char) {
  let b = 0;
  for (const it of [char.equip.weapon, char.equip.armor, char.equip.ring, char.equip.amulet]) b = Math.max(b, rankOf(it));
  return b;
}
const BACK_LOOK = { cape: 'buildGear_cape', wings: 'buildGear_wings', spectral: 'buildGear_spectral', plate: 'buildGear_plate' };
const HEAD_LOOK = { crown: 'buildGear_crown', halo: 'buildGear_halo' };
function clearMount(o) { while (o.children.length) o.remove(o.children[o.children.length - 1]); }

function syncPlayer(game, now) {
  const char = game.char;
  ensurePlayer(char);                                  // builds/swaps the class-specific rig
  const pm = playerMesh, ud = pm.userData, p = game.world.player;

  // --- equipment signature; visuals below rebuild only when equipment changes ---
  const cls = DATA.CLASSES && char ? DATA.CLASSES[char.classId] : null;
  const accent = char ? bestRarityColor(char) : '#9fd8ff';
  const wKind = weaponKindFor(char);
  const wpn = char && char.equip && char.equip.weapon;
  const arm = char && char.equip && char.equip.armor;
  const mog = (char && char.transmog) || {};
  const wLook = resolveLook(wpn, mog.weapon), aLook = resolveLook(arm, mog.armor);
  const wColor = (wLook && wLook.color) || (wpn && DATA.rarityColor && DATA.rarityColor(wpn.rarity)) || accent;
  const wFx = wLook && wLook.fx ? wLook.fx : null;            // elemental signature (fire/ice/void/…)
  const wTier = rankOf(wpn), aTier = rankOf(arm);
  const wPrism = !!(wpn && wpn.rarity === 'mythic');
  const aPrism = !!(arm && arm.rarity === 'mythic');
  const aBody = aLook && aLook.body ? aLook.body : null;
  const ac = (aLook && aLook.color) || accent;
  const top = char ? bestRank(char) : 0;                      // 3 = a legendary equipped, 4 = a mythic
  const key = [char && char.classId, accent, wKind, wColor, wFx, wTier, wPrism, aBody, ac, aTier, aPrism, top, mog.weapon, mog.armor].join('|');
  if (key !== ud.equipKey) {
    ud.equipKey = key;
    if (ud.bodyMat) ud.bodyMat.color.set((cls && cls.color) || '#8899aa').multiplyScalar(0.85); // gothic: darkened armour
    if (ud.trimMat) ud.trimMat.color.set(accent);
    // weapon — type + tier + element + prismatic
    clearMount(ud.weaponMount);
    ud.weaponMount.add((Builders['buildWeapon_' + wKind] || Builders.buildWeapon_sword)({ color: wColor, fx: wFx, tier: wTier, prismatic: wPrism }));
    // armor body cosmetic (cape/wings/spectral/plate -> back; crown/halo -> head)
    clearMount(ud.backMount); clearMount(ud.headMount);
    if (aBody) {
      const backFn = BACK_LOOK[aBody], headFn = HEAD_LOOK[aBody];
      if (backFn) ud.backMount.add((Builders[backFn] || Builders.buildGear_cape)({ color: ac, prismatic: aPrism }));
      else if (headFn && Builders[headFn]) ud.headMount.add(Builders[headFn]({ color: ac, prismatic: aPrism }));
    }
    // tier armor kit on the chest (rare+)
    clearMount(ud.chestMount);
    if (aTier >= 2 && Builders.buildArmorKit) ud.chestMount.add(Builders.buildArmorKit({ tier: aTier, color: ac, prismatic: aPrism }));
    // legendary / mythic character aura at the feet
    clearMount(ud.auraMount);
    if (top >= 3 && Builders.buildAura) ud.auraMount.add(Builders.buildAura({ color: accent, prismatic: top >= 4, tier: top }));
    applyWorldFog(pm);
  }

  // --- reset transient cast transforms (cast anims mutate these; nothing else does) ---
  pm.rotation.x = 0; pm.rotation.z = 0; pm.scale.setScalar(1);
  ud.weaponMount.rotation.set(0, 0, 0);
  ud.weaponMount.position.copy(ud.weaponBasePosition);
  ud.weaponMount.scale.copy(ud.weaponBaseScale);

  // --- position, facing, bob + walk cycle ---
  const dx = p.x - (ud.lastX == null ? p.x : ud.lastX);
  const dy = p.y - (ud.lastY == null ? p.y : ud.lastY);
  ud.lastX = p.x; ud.lastY = p.y;
  const moving = Math.hypot(dx, dy) > 0.002;
  const bob = 0.04 + Math.abs(Math.sin(now / 200)) * (moving ? 0.04 : 0.012);
  pm.position.set(p.x, bob, p.y);
  const d = p.lastDir || { x: 0, y: 1 };
  if (d.x || d.y) pm.rotation.y = Math.atan2(d.x, d.y);
  const sw = moving ? Math.sin(now / 110) * 0.5 : 0;
  if (ud.legs && ud.legs.length >= 2) { ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw; }   // walk cycle (legged classes)
  if (ud.arms && ud.arms.length >= 2) { ud.arms[0].rotation.x = -sw * 0.6; ud.arms[1].rotation.x = sw * 0.6; ud.arms[0].rotation.z = 0; ud.arms[1].rotation.z = 0; }
  if (ud.anim) ud.anim(pm, now, moving);               // class-specific idle/move motion (robe sway, mote orbit)
  // per-child special animations (weapon FX, cape sway, halo spin, aura, kit…)
  if (!degrade) for (const mnt of [ud.weaponMount, ud.backMount, ud.headMount, ud.chestMount, ud.auraMount])
    for (const ch of mnt.children) if (ch.userData.anim) ch.userData.anim(ch, now);

  // --- skill cast animation overlay: distinct per-skill body motion + a 3D flourish ---
  if (!ud.castFxMount) { ud.castFxMount = new THREE.Object3D(); pm.add(ud.castFxMount); }
  const cast = p.castAnim;
  if (cast) {
    const prog = Math.max(0, Math.min(1, cast.t / (cast.dur || 0.6)));
    // build the flourish mesh once per cast instance
    if (ud.castFxUid !== cast.uid) {
      ud.castFxUid = cast.uid;
      clearMount(ud.castFxMount);
      const fxFn = Builders['buildCastFx_' + cast.id];
      if (fxFn) { try { ud.castFxMount.add(fxFn({ color: cast.color })); } catch (e) {} }
      applyWorldFog(ud.castFxMount);
    }
    ud.castFxMount.visible = true;
    // body animation — rig manipulation (spin, leap, lunge, raise…)
    const animFn = Builders.CAST_ANIMS && Builders.CAST_ANIMS[cast.id];
    if (animFn) { try { animFn(prog, pm, ud, now, moving); } catch (e) {} }
    // Older cast choreography positions a root-level weapon. Art-kit weapons
    // now follow the wrist, so the animated arm owns their position instead.
    if (ud.bakedArt) ud.weaponMount.position.copy(ud.weaponBasePosition);
    // drive flourish children by cast progress (deterministic 0..1)
    for (const ch of ud.castFxMount.children) if (ch.userData && ch.userData.castAnim) { try { ch.userData.castAnim(ch, prog, now); } catch (e) {} }
  } else if (ud.castFxUid != null) {
    ud.castFxUid = null;
    clearMount(ud.castFxMount);
    ud.castFxMount.visible = false;
  }

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
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
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
  torch.scale.setScalar(town ? 1.05 : 0.8);
}

// One inexpensive contact-shadow draw anchors every visible character to the
// floor. These are flat silhouettes, not real-time shadow maps.
function updateGroundShadows(game) {
  if(!groundShadows){
    const geometry=new THREE.CircleGeometry(1,12);geometry.rotateX(-Math.PI/2);
    const material=new THREE.MeshBasicMaterial({color:0x06080c,transparent:true,opacity:.32,depthWrite:false});
    groundShadows=new THREE.InstancedMesh(geometry,material,96);groundShadows.frustumCulled=false;scene.add(groundShadows);
  }
  let count=0;
  const add=(x,z,r)=>{if(count>=96||Math.abs(x-_viewCX)>HALF+2||Math.abs(z-_viewCZ)>HALF+3)return;shadowMatrix.makeScale(r,1,r*.72);shadowMatrix.setPosition(x,.037,z);groundShadows.setMatrixAt(count++,shadowMatrix);};
  add(game.world.player.x,game.world.player.y,.43);
  for(const e of game.enemies||[])if(e.hp>0)add(e.x,e.y,e.boss?.8:.4);
  for(const e of game.world.npcs||[])add(e.x+.5,e.y+.5,.4);
  for(const e of game.minions||[])add(e.x,e.y,.32);
  groundShadows.count=count;groundShadows.instanceMatrix.needsUpdate=true;
}

// =============================================================
// ENTITY LAYERS (Stage 2) — pooled 3D objects synced to game arrays.
// Each layer maps a game entity list to builder Groups, reuses objects across
// frames (keyed by entity identity via a WeakMap) and drops them when gone.
// =============================================================
const _uidMap = new WeakMap(); let _uidSeq = 0;
function uid(e) { let id = _uidMap.get(e); if (id === undefined) { id = ++_uidSeq; _uidMap.set(e, id); } return id; }
function builderFor(fn) {
  const original=typeof Builders[fn]==='function'?Builders[fn]:Builders.buildPlaceholder;
  const named={buildEnemy_skeleton:'skeleton',buildEnemy_hunched:'ghoul',buildEnemy_ghost:'wraith',buildProp_shrine:'shrine'}[fn];
  return opts=>{
    if(fn==='buildProp_portal'&&artReady())return buildGate(opts.color)||compactBuilder(fn,original,opts);
    if(fn==='buildNpc'&&artReady()){
      if(opts.role==='waypoint'){const stone=artModel('shrine');if(stone){const g=new THREE.Group();g.add(stone);return g;}}
      const roles={vendor:'ranger',stash:'mage',quests:'paladin',mystery:'summoner',mercenary:'warrior',gambler:'ranger'};
      const classId=roles[opts.role]||'warrior';
      return compactBuilder('npc-art-'+classId,()=>buildHero(classId),{});
    }
    if(named&&artReady()){const mesh=artModel(named);if(mesh){const g=new THREE.Group();g.add(mesh);return g;}}
    return compactBuilder(fn,original,opts);
  };
}
const _warned = new Set();
const _proj = new THREE.Vector3();
function projectToScreen(x, y, z) {
  _proj.set(x, y, z).project(cam);
  return { x: (_proj.x * 0.5 + 0.5) * 600, y: (1 - (_proj.y * 0.5 + 0.5)) * 600, vis: _proj.z < 1 && _proj.z > -1 };
}

// makeLayer(sigFn, descFn, sync): sigFn(e) returns a cheap primitive string compared
// every frame on the hot path; descFn(e) builds the heavy {fn|factory, opts} descriptor
// ONLY when the sig changes (rebuild). No per-frame object/opts allocation in steady state.
function makeLayer(sigFn, descFn, sync) {
  const pool = new Map();        // uid -> { obj, sig, lx, lz, phase }
  const liveTmp = new Set();
  return {
    reconcile(list, now) {
      liveTmp.clear();
      if (list) for (let i = 0; i < list.length; i++) {
        const e = list[i]; if (!e) continue;
        const id = uid(e); liveTmp.add(id);
        const sig = sigFn(e);
        let slot = pool.get(id);
        if (!slot || slot.sig !== sig) {
          if (slot) { scene.remove(slot.obj); disposeObj(slot.obj); }
          const d = descFn(e);
          let obj;
          try { obj = d.factory ? d.factory(d.opts || {}) : builderFor(d.fn)(d.opts || {}); }
          catch (err) { if (!_warned.has(d.fn)) { _warned.add(d.fn); console.warn('[3D] builder failed:', d.fn, err.message); } obj = Builders.buildPlaceholder(d.opts || {}); }
          applyWorldFog(obj); scene.add(obj);
          slot = { obj, sig, lx: e.x, lz: e.y, phase: (id % 16) * 0.39 };
          pool.set(id, slot);
        }
        slot.obj.visible = true;
        sync(slot, e, now);
      }
      for (const [id, slot] of pool) if (!liveTmp.has(id)) { scene.remove(slot.obj); disposeObj(slot.obj); pool.delete(id); }
    },
    clear() { for (const [, slot] of pool) { scene.remove(slot.obj); disposeObj(slot.obj); } pool.clear(); },
  };
}

// dispose ONLY objects that own unique (uncached) GPU resources — flagged with
// userData._dispose (e.g. telegraphs). Builder Groups share the geo()/mat() caches
// and must never be disposed.
function disposeObj(obj) {
  if (!obj || !obj.userData || !obj.userData._dispose) return;
  obj.traverse(o => {
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    if (o.geometry) o.geometry.dispose();
  });
}

// position + facing (derived from movement) + per-model idle animation. Off-screen
// entities are hidden (visible=false) so they cost no draw calls.
function place(slot, e, now, baseY, bobAmp, ox, oz) {
  const obj = slot.obj;
  const px = e.x + (ox || 0), pz = e.y + (oz || 0);   // ox/oz = tile-center offset (NPCs store corner coords)
  if (Math.abs(px - _viewCX) > HALF + 3.5 || Math.abs(pz - _viewCZ) > HALF + 6) { obj.visible = false; return; }
  const bob = bobAmp ? Math.sin(now / 240 + slot.phase) * bobAmp : 0;
  obj.position.set(px, (baseY || 0) + bob, pz);
  const dx = e.x - slot.lx, dz = e.y - slot.lz;
  if (Math.abs(dx) + Math.abs(dz) > 0.0008) { obj.rotation.y = Math.atan2(dx, dz); slot.lx = e.x; slot.lz = e.y; }
  if (!degrade && obj.userData.anim) obj.userData.anim(obj, now);
}

// NOTE: boss scale is owned ENTIRELY by the engine (scale.setScalar below). Builders
// are NOT passed opts.boss, so the five self-scaling shapes don't double-scale.
const enemyLayer = makeLayer(
  e => (e.shape || 'skeleton') + (e.boss ? 'B' : '') + (e.elite ? 'E' : '') + (e.eliteColor || e.color || ''),
  e => ({ fn: 'buildEnemy_' + (e.shape || 'skeleton'), opts: { color: e.eliteColor || e.color || '#cfcfcf' } }),
  (slot, e, now) => {
    place(slot, e, now, 0.055, e.shape === 'plant' ? 0 : 0.015);
    slot.obj.scale.setScalar(e.boss ? 1.6 : (e.champion ? 1.42 : (e.elite ? 1.18 : (e.hazard ? 0.85 : (e._isSplit ? 0.7 : 1)))));
  }
);
const itemLayer = makeLayer(
  e => { const it = e.item || {}; return (it.baseId || '') + (it.rarity || '') + (it.gold ? 'G' : ''); },
  e => { const it = e.item || {}; const base = DATA.ITEM_BASES && DATA.ITEM_BASES[it.baseId];
         const t = base ? base.type : null;
         let fn = 'buildItem_gear';
         if (it.gold || t === 'gold') fn = 'buildItem_coin';
         else if (t === 'gem') fn = 'buildItem_gem';
         else if (t === 'consumable') fn = 'buildItem_potion';
         const color = (DATA.rarityColor && it.rarity) ? DATA.rarityColor(it.rarity) : '#ffd166';
         return { fn, opts: { color } }; },
  (slot, e, now) => place(slot, e, now, 0.12, 0)
);
const portalLayer = makeLayer(
  e => 'portal' + (e.kind || ''),
  e => ({ fn: 'buildProp_portal', opts: { color: e.kind === 'next' ? '#8a6cff' : '#6df1ff' } }),
  (slot, e, now) => place(slot, e, now, 0, 0)
);
const shrineLayer = makeLayer(
  e => 'shrine' + (e.type || '') + (e.used ? 'U' : ''),
  e => ({ fn: 'buildProp_shrine', opts: { color: e.used ? '#5a6470' : (e.color || '#9be8ff') } }),
  (slot, e, now) => { place(slot, e, now, 0, 0); if (e.used) slot.obj.scale.setScalar(0.85); }
);
const npcLayer = makeLayer(
  e => 'npc' + (e.role || e.name || ''),
  e => ({ fn: 'buildNpc', opts: { role:e.role, color: e.color || '#ffd9a0' } }),
  (slot, e, now) => place(slot, e, now, 0.055, 0.015, 0.5, 0.5)   // NPC coords are tile corners -> center
);
// projectiles — pooled glowing models, oriented to travel direction, mid-air
const PROJ_FN = { arrow: 'buildProjectile_arrow', bolt: 'buildProjectile_bolt', bone: 'buildProjectile_bone' };
const projectileLayer = makeLayer(
  e => (e.kind || 'soul') + (e.color || ''),
  e => ({ fn: PROJ_FN[e.kind] || 'buildProjectile_soul', opts: { color: e.color || '#fff' } }),
  (slot, e, now) => {
    const obj = slot.obj;
    obj.position.set(e.x, 0.5, e.y);
    if (e.dx || e.dy) obj.rotation.y = Math.atan2(e.dx, e.dy);
    if (!degrade && obj.userData.anim) obj.userData.anim(obj, now);
  }
);
const minionLayer = makeLayer(
  e => e._hireling ? 'hire' + (e.htype || '') : 'minion',
  e => e._hireling
    ? { fn: 'buildHireling', opts: { color: e.color || '#cdd6e6', weapon: e.htype === 'marksman' ? 'bow' : e.htype === 'sorceress' ? 'staff' : 'sword' } }
    : { fn: 'buildMinion', opts: { color: '#c489ff' } },
  (slot, e, now) => {
    place(slot, e, now, 0, 0.04);
    slot.obj.scale.setScalar(e._hireling ? 1.0 : (e.ttl != null && e.ttl < 3 ? 0.85 * (0.6 + 0.4 * (e.ttl / 3)) : 0.85));
  }
);

// telegraphs — flat additive ground ring + filling danger disc, sized by radius.
// The camera tilt turns the flat circle into the foreshortened ellipse for free.
function makeTelegraphMesh() {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 36), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 36), fillMat); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.03;
  g.add(ring, fill);
  g.userData = { _dispose: true, ring, fill, ringMat, fillMat };
  return g;
}
const telegraphLayer = makeLayer(
  () => 'tg',
  () => ({ factory: makeTelegraphMesh, opts: {} }),
  (slot, e, now) => {
    const obj = slot.obj, ud = obj.userData;
    const prog = Math.min(1, e.age / e.windup);
    const R = e.radius || 2;
    obj.position.set(e.x, 0, e.y);
    obj.scale.set(R, 1, R);
    ud.fill.scale.setScalar(Math.max(0.001, prog));
    ud.ringMat.color.set(e.color || '#ff3344'); ud.fillMat.color.set(e.color || '#ff3344');
    ud.ringMat.opacity = 0.5 + 0.3 * Math.sin(e.age * 18);
    ud.fillMat.opacity = 0.18 + 0.24 * prog;
  }
);
const ALL_LAYERS = [enemyLayer, itemLayer, portalLayer, shrineLayer, npcLayer, projectileLayer, minionLayer, telegraphLayer];

// ---- particle system: one THREE.Points for ALL particles (single draw call) ----
let particleSys = null, pPos = null, pCol = null;
const PCAP = 800;
function makeSpriteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function ensureParticles() {
  if (particleSys) return;
  const geo = new THREE.BufferGeometry();
  pPos = new Float32Array(PCAP * 3); pCol = new Float32Array(PCAP * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  // NOTE: Three.js skips size-attenuation for orthographic cameras, so `size` is in
  // PIXELS here (not world units). 0.3 would be invisible — use a px-scale sprite size.
  const mat = new THREE.PointsMaterial({ size: 14, map: makeSpriteTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, vertexColors: true, sizeAttenuation: false, fog: false });
  GL._psys = () => particleSys;
  particleSys = new THREE.Points(geo, mat);
  particleSys.frustumCulled = false; particleSys.renderOrder = 3;
  scene.add(particleSys);
}
function syncParticles(game) {
  ensureParticles();
  const list = game.particles; let n = 0;
  const cap = degrade ? (PCAP >> 1) : PCAP;
  if (list) for (let i = 0; i < list.length && n < cap; i++) {
    const p = list[i]; const t = 1 - p.age / p.life; if (t <= 0) continue;
    const af = t * t > 1 ? 1 : t * t;
    // parse the hex color once per particle; only the alpha scale changes per frame
    if (p._r === undefined) { _color.set(p.color || '#fff'); p._r = _color.r; p._g = _color.g; p._b = _color.b; }
    pPos[n * 3] = p.x; pPos[n * 3 + 1] = 0.45; pPos[n * 3 + 2] = p.y;
    pCol[n * 3] = p._r * af; pCol[n * 3 + 1] = p._g * af; pCol[n * 3 + 2] = p._b * af;
    n++;
  }
  const g = particleSys.geometry;
  g.setDrawRange(0, n);
  g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
  particleSys.visible = n > 0;
}

// ---- town features: a gothic Sanctuary — buildings ring the plaza (spires rise
// over the perimeter walls), atmosphere props fill the square. Town grid is 21x17;
// interior 1..19 x 1..15; camera is to the SOUTH (high z), so tall buildings go
// NORTH/sides and only low props go on the near (south) edge. ----
let townGroup = null;
function buildTownFeatures(world) {
  if (!world || world.kind !== 'town') return null;
  const g = new THREE.Group();
  const N = 0, S = Math.PI, E = -Math.PI / 2, Wd = Math.PI / 2;   // facing toward the plaza
  function place(fn, x, z, rotY, color) {
    if (typeof Builders[fn] !== 'function') return;
    let o; try { o = Builders[fn]({ color }); } catch (e) { return; }
    o.position.set(x, 0, z);
    if (rotY) o.rotation.y = rotY;
    g.add(o);
  }
  // centrepiece fountain
  place('buildProp_fountain', 10.5, 8.5, 0, '#6df1ff');
  // NORTH (far): grand cathedral, flanking houses + banners
  place('buildTown_cathedral', 10.5, -1.3, N, '#ffd27a');
  place('buildTown_banner', 8.2, 0.3, N, '#7a2030');
  place('buildTown_banner', 12.8, 0.3, N, '#7a2030');
  place('buildTown_house', 4.6, -0.8, N, '#ffb858');
  place('buildTown_house2', 16.4, -0.8, N, '#ffb858');
  // WEST: shop (by the Trader) + guild hall (by the Captain)
  place('buildTown_shop', -1.2, 4.0, Wd, '#ffc857');
  place('buildTown_guildhall', -1.3, 12.0, Wd, '#c489ff');
  // EAST: vault (by the Keeper) + tavern
  place('buildTown_vault', 21.2, 4.0, E, '#6df1ff');
  place('buildTown_tavern', 21.3, 12.0, E, '#ffb858');
  // SOUTH (near camera — keep it low/sparse): mystery caravan + a side gate
  place('buildTown_tent', 14.0, 16.7, S, '#ff77ff');
  place('buildTown_gate', 4.0, 17.0, S, '#ffb858');
  // plaza lamp posts (warm light)
  place('buildTown_lamppost', 6.5, 6.0, N, '#ffb858');
  place('buildTown_lamppost', 14.5, 6.0, N, '#ffb858');
  place('buildTown_lamppost', 6.5, 11.0, N, '#ffb858');
  place('buildTown_lamppost', 14.5, 11.0, N, '#ffb858');
  // scattered atmosphere
  place('buildTown_well', 7.4, 8.5, N, '#9befff');
  place('buildTown_deadtree', 3.0, 7.0, N, '#51e6a4');
  place('buildTown_deadtree', 17.6, 9.4, N, '#51e6a4');
  place('buildTown_gravestones', 17.2, 14.6, N, '#9bffd0');
  place('buildTown_crates', 2.6, 4.2, N, '#ffb858');
  place('buildTown_crates', 18.4, 13.4, N, '#ffb858');
  // corner braziers (kept from before — extra warm light)
  for (const b of [[3, 3], [17, 3], [3, 13], [17, 13]]) place('buildDecor', b[0] + 0.5, b[1] + 0.5, 0, '#ff9a3c');

  // Static architecture: three blend groups replace hundreds of separate meshes.
  return compactObject(g);
}

// ---- perf governor: drop expensive per-model anims + halve particles when busy ----
let degrade = false;
function updateGovernor(game) {
  const load = (game.enemies ? game.enemies.length : 0)
    + (game.minions ? game.minions.length : 0)
    + (game.projectiles ? game.projectiles.length : 0)
    + ((game.particles ? game.particles.length : 0) >> 4);
  degrade = load > 46;
}

// Overlays on the crisp overlay canvas, positioned by projecting through the camera
// (so they track the tilted view): enemy HP bars + portal labels (the latter lost from
// the 2D drawPortals when portals moved to 3D).
function drawOverlays(game) {
  const octx = overlayCtx; if (!octx) return;
  octx.clearRect(0, 0, 600, 600);
  updateOverlayBounds();
  // Consistent role labels make the hub navigable without visiting every NPC
  // to discover what each silhouette does. Short labels avoid crowded names.
  if(GL.mask.npcs && game.world && game.world.kind==='town'){
    const labels={vendor:'Trader',stash:'Vault',quests:'Bounties',waypoint:'Waystone',mystery:'Mystery',mercenary:'Hirelings',gambler:'Gambler'};
    octx.font='600 12px sans-serif';octx.textAlign='center';octx.textBaseline='middle';
    for(const npc of game.world.npcs||[]){
      // The active character already has a contextual pinch pill above them.
      if(npc===game.nearbyNpc)continue;
      const label=labels[npc.role]||npc.name,p=projectToScreen(npc.x+.5,2.05,npc.y+.5);
      if(!p.vis||p.x<20||p.x>580||p.y<44||p.y>440)continue;
      const width=octx.measureText(label).width+10;
      for(const box of overlayObstacles)if(p.x+width/2>box.left&&p.x-width/2<box.right&&p.y+9>box.top&&p.y-9<box.bottom)p.y=box.bottom+12;
      octx.fillStyle='rgba(5,10,14,.86)';octx.fillRect(p.x-width/2,p.y-9,width,18);
      octx.fillStyle='#ded3b2';octx.fillText(label,p.x,p.y);
    }
  }
  // --- enemy HP bars ---
  if (GL.mask.enemies && game.enemies) for (const e of game.enemies) {
    if (e.hp == null || !(e.hpMax > 0)) continue;                 // guard hpMax 0/undefined -> no NaN bar
    const sc = e.boss ? 1.6 : (e.elite ? 1.18 : (e._isSplit ? 0.7 : 1));
    const p = projectToScreen(e.x, 1.3 * sc + 0.45, e.y);         // size-aware: sits just above the model head
    if (!p.vis || p.x < -40 || p.x > 640 || p.y < -40 || p.y > 640) continue;
    const pct = Math.max(0, Math.min(1, e.hp / e.hpMax));
    if (pct >= 1 && !e.boss && !e.elite) continue;               // hide full-HP trash bars (less clutter)
    const w = e.boss ? 46 : (e.elite ? 30 : 22), h = e.boss ? 5 : 3;
    const x = p.x - w / 2, y = p.y;
    octx.fillStyle = 'rgba(0,0,0,0.6)'; octx.fillRect(x - 1, y - 1, w + 2, h + 2);
    octx.fillStyle = e.boss ? '#ff4d6d' : (e.elite ? (e.eliteColor || '#ffd166') : '#ff6b85');
    octx.fillRect(x, y, w * pct, h);
    if (e.frozen) { octx.fillStyle = 'rgba(140,210,255,0.55)'; octx.fillRect(x, y, w * pct, h); }
  }
  // --- portal labels ---
  if (GL.mask.portals && game.world && game.world.portals) {
    octx.font = 'bold 11px sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    for (const pt of game.world.portals) {
      if (!pt.label) continue;
      if (!game.nearbyNpc && pt === game.nearbyPortal) continue;
      const p = projectToScreen(pt.x, 1.7, pt.y);
      if (!p.vis || p.x < -80 || p.x > 680 || p.y < -20 || p.y > 620) continue;
      const tw = octx.measureText(pt.label).width;
      octx.fillStyle = 'rgba(0,0,0,0.55)'; octx.fillRect(p.x - tw / 2 - 4, p.y - 8, tw + 8, 16);
      octx.fillStyle = pt.kind === 'next' ? '#b79dff' : '#9fe8ff';
      octx.fillText(pt.label, p.x, p.y);
    }
  }
}

// =============================================================
// FRAME — called by app.js render() when GL.enabled
// =============================================================
function frame(game, now) {
  if (!renderer || !game || !game.world) return;
  _frames++;
  updateGovernor(game);
  updateCamera3D(game);
  updateGroundShadows(game);
  if (GL.mask.player) { syncPlayer(game, now); updateTorch(game); }
  else if (playerMesh) playerMesh.visible = false;
  if (GL.mask.enemies)     enemyLayer.reconcile(game.enemies, now);
  if (GL.mask.minions)     minionLayer.reconcile(game.minions, now);
  if (GL.mask.items)       itemLayer.reconcile(game.items, now);
  if (GL.mask.portals)     portalLayer.reconcile(game.world.portals, now);
  if (GL.mask.shrines)     shrineLayer.reconcile(game.world.shrines, now);
  if (GL.mask.npcs)        npcLayer.reconcile(game.world.npcs, now);
  if (GL.mask.projectiles) projectileLayer.reconcile(game.projectiles, now);
  if (GL.mask.telegraphs)  telegraphLayer.reconcile(game.telegraphs, now);
  if (GL.mask.particles)   syncParticles(game);
  if (!degrade && townGroup && townGroup.userData.tick) townGroup.userData.tick(now);
  renderer.render(scene, cam);
  drawOverlays(game);
}

// =============================================================
function dispose() {
  for (const L of ALL_LAYERS) L.clear();                 // disposes pooled telegraphs
  if (townGroup) { scene.remove(townGroup); releaseCompact(townGroup); townGroup = null; }
  disposeWorld();
  if(groundShadows){scene.remove(groundShadows);groundShadows.geometry.dispose();groundShadows.material.dispose();groundShadows=null;}
  if (particleSys) {
    scene.remove(particleSys); particleSys.geometry.dispose();
    if (particleSys.material.map) particleSys.material.map.dispose(); particleSys.material.dispose();
    particleSys = null;
  }
  if (torch) {
    scene.remove(torch); torch.geometry.dispose();
    if (torch.material.map) torch.material.map.dispose(); torch.material.dispose();
    torch = null;
  }
  if (playerMesh) {
    scene.remove(playerMesh);
    const ud = playerMesh.userData;  // dispose ONLY the rig's unique recolor materials (never the cached weapon/gear mats)
    if (ud.bodyMat) ud.bodyMat.dispose();
    if (ud.trimMat) ud.trimMat.dispose();
    if (ud.eyeMat) ud.eyeMat.dispose();
    playerMesh = null;
  }
  if (renderer) renderer.dispose();
  GL.enabled = false;
}

// ---- self-init (don't rely on app.js to call us) ----
if (RENDER3D) {
  try { init(); } catch (e) { console.error('[3D] init failed — staying on 2D', e); GL.enabled = false; }
  GL.ready=loadArt().then(ok=>{const game=window.__hollowlight && window.__hollowlight.game;if(ok&&GL.enabled&&game&&game.world)onZoneChange(game.world);return ok;});
}
