// =============================================================
// HollowLight — WebGL 3D renderer (top-down). Opt-in via ?gl=1
// Replaces ONLY the Canvas2D draw layer. All game logic lives in app.js.
// See RENDER3D_PLAN.md. app.js stays an IIFE and talks to us via
// window.__GL (facade) + window.__GL_DATA (data shim).
// Additive display: black = transparent, bright = emitted light.
// =============================================================
import * as THREE from 'three';

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
let playerMesh = null;            // Stage-1 placeholder rig
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

function setMask(patch) { Object.assign(GL.mask, patch); }

// =============================================================
// INIT
// =============================================================
function init() {
  const canvas = document.getElementById('game-canvas-gl');
  if (!canvas) throw new Error('no #game-canvas-gl');
  DATA = window.__GL_DATA || {};

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
  scene.fog = new THREE.FogExp2(0x000000, 0.055);   // black fog = edge fade to transparent (the vignette)

  // tilted orthographic camera; vertical frustum divided by cos(tilt) to keep ~28px/tile after foreshortening
  const vt = HALF / Math.cos(TILT);
  cam = new THREE.OrthographicCamera(-HALF, HALF, vt, -vt, 0.1, 200);

  // player torch blob — a warm additive radial glow on the ground
  torch = makeTorch();
  scene.add(torch);

  // reveal the GL + overlay canvases (they live inside #game, still hidden until in-game)
  canvas.style.display = 'block';
  const ov = document.getElementById('game-overlay-2d');
  if (ov) ov.style.display = 'block';

  // Stage 1: world + player are 3D; everything else composites in 2D on top.
  setMask({ world: true, player: true });
  GL.enabled = true;
  console.log('[3D] renderer mounted (Stage 1: world + player)');
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
  disposeWorld();
  if (!world || !world.grid) return;
  worldGroup = buildWorld(world);
  scene.add(worldGroup);
  // fog density: dungeons tighter/darker, town airier
  scene.fog.density = world.kind === 'town' ? 0.035 : 0.06;
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
  // derive colors (emissive on additive; dark floor, lit wall tops, dark wall sides)
  const floorCol = mul(pal.floor, 1.7);
  const wallTop = mul(pal.wall, 0.78);
  const wallSide = mul(pal.wall, 0.28);
  const decorCol = mul(pal.accent, 1.0);

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
// PLAYER — Stage-1 placeholder (boxy hero), tinted by class color
// =============================================================
function ensurePlayer() {
  if (playerMesh) return;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x6df1ff, fog: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.42), bodyMat);
  body.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bodyMat);
  head.position.y = 0.92;
  // bright facing nub so direction reads from above
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), faceMat);
  face.position.set(0, 0.92, 0.22);
  g.add(body, head, face);
  g.userData.bodyMat = bodyMat;
  playerMesh = g;
  scene.add(g);
}

function syncPlayer(game, now) {
  ensurePlayer();
  const p = game.world.player;
  const cls = (DATA.CLASSES && game.char) ? DATA.CLASSES[game.char.classId] : null;
  if (cls && cls.color) playerMesh.userData.bodyMat.color.set(cls.color);
  const bob = Math.sin(now / 220) * 0.04;
  playerMesh.position.set(p.x, bob, p.y);
  // face the last-moved direction
  const d = p.lastDir || { x: 0, y: 1 };
  if (d.x || d.y) playerMesh.rotation.y = Math.atan2(d.x, d.y);
  playerMesh.visible = true;
}

// =============================================================
// TORCH — warm additive ground glow following the player
// =============================================================
function makeTorch() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,180,100,0.9)');
  grd.addColorStop(0.5, 'rgba(255,150,70,0.25)');
  grd.addColorStop(1, 'rgba(255,150,70,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mat);
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
// FRAME — called by app.js render() when GL.enabled
// =============================================================
function frame(game, now) {
  if (!renderer || !game || !game.world) return;
  _frames++;
  updateCamera3D(game);
  if (GL.mask.player) { syncPlayer(game, now); updateTorch(game); }
  else if (playerMesh) playerMesh.visible = false;
  renderer.render(scene, cam);
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
