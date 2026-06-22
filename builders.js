// =============================================================
// HollowLight — 3D model builders (pure factories).
// Convention: a builder takes (opts) and returns a THREE.Group whose
// origin is the FEET, centered on the tile, facing +Z (south, game +y).
// No scene / game-state / global access. Geometry + materials come from
// the shared geo()/mat() caches so identical shapes/colors are reused.
// THREE is injected once via setTHREE(). Per-frame positioning/scale/
// facing/affix toggles are done by the ENGINE (render3d.js), not here —
// a builder may tag toggleable affix parts on g.userData and may expose
// an optional g.userData.anim(g, now) for special per-model motion.
//
// Art direction: GOTHIC / Diablo — angular low-poly (boxes, prisms,
// tapered shapes; avoid spheres = cartoony), dark desaturated armor with
// SELECTIVE bright emissive accents (trim, eyes, weapons). The additive
// display turns black transparent, so silhouettes read by their lit edges.
// =============================================================

let T = null;
const GEO = {};
const MATS = new Map();
const scratch = {};

export function setTHREE(THREE) {
  T = THREE;
  scratch.v = new T.Vector3();
  scratch.c = new T.Color();
}

// cached geometry singleton
function geo(key, make) { return GEO[key] || (GEO[key] = make()); }
// cached opaque fogged material by hex (optionally a brightness multiplier baked into the key)
function mat(hex, k) {
  const h = (k != null && k !== 1) ? hexMul(hex, k) : hex;
  let m = MATS.get('o' + h);
  if (!m) { m = new T.MeshBasicMaterial({ color: h, fog: true }); MATS.set('o' + h, m); }
  return m;
}
// cached additive (glow) material — for auras, eyes, energy
function matAdd(hex, opacity) {
  const key = 'a' + hex + (opacity || 1);
  let m = MATS.get(key);
  if (!m) {
    m = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
    MATS.set(key, m);
  }
  return m;
}
function hexMul(hex, k) {
  scratch.c.set(hex).multiplyScalar(k);
  return '#' + scratch.c.getHexString();
}

// shared primitive geometries
const box = (w, h, d) => geo(`b${w}_${h}_${d}`, () => new T.BoxGeometry(w, h, d));
const cyl = (r1, r2, h, s) => geo(`c${r1}_${r2}_${h}_${s || 6}`, () => new T.CylinderGeometry(r1, r2, h, s || 6));
const cone = (r, h, s) => geo(`k${r}_${h}_${s || 6}`, () => new T.ConeGeometry(r, h, s || 6));
const plane = (w, h) => geo(`p${w}_${h}`, () => new T.PlaneGeometry(w, h));
const m = (g, material) => new T.Mesh(g, material);

// =============================================================
// PLAYER — a persistent armored rig. The engine tints bodyMat to the
// (darkened) class color, sets trim/eyes to rarity color, swaps the
// weapon child on g.userData.weaponMount, and toggles gear-look children.
// =============================================================
export function buildPlayer(opts) {
  const g = new T.Group();
  // unique (uncached) materials — the player is a singleton the engine recolors live,
  // so these must NOT be shared with the geo()/mat() caches.
  const armor = new T.MeshBasicMaterial({ color: '#3a4458', fog: true });        // tinted to class color
  const armorDark = mat('#171c27');                                              // fixed deep shade (cached ok)
  const trim = new T.MeshBasicMaterial({ color: '#9fd8ff', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }); // tinted to rarity
  const eye = new T.MeshBasicMaterial({ color: '#c8f0ff', fog: false, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });      // tinted to rarity

  // legs (angular greaves)
  const lL = m(box(0.18, 0.46, 0.2), armorDark); lL.position.set(-0.13, 0.23, 0);
  const rL = m(box(0.18, 0.46, 0.2), armorDark); rL.position.set(0.13, 0.23, 0);
  // torso — tapered cuirass (a box + a chest prism for the gothic angular chest)
  const torso = m(box(0.5, 0.46, 0.34), armor); torso.position.set(0, 0.7, 0);
  const chest = m(cone(0.3, 0.34, 4), armor); chest.position.set(0, 0.66, 0.16); chest.rotation.x = Math.PI / 2; chest.rotation.y = Math.PI / 4;
  // belt
  const belt = m(box(0.52, 0.08, 0.36), armorDark); belt.position.set(0, 0.46, 0);
  // pauldrons (broad angular shoulders — the gothic silhouette)
  const lP = m(cone(0.2, 0.26, 4), armor); lP.position.set(-0.34, 0.92, 0); lP.rotation.z = 0.5;
  const rP = m(cone(0.2, 0.26, 4), armor); rP.position.set(0.34, 0.92, 0); rP.rotation.z = -0.5;
  const lPt = m(box(0.32, 0.05, 0.32), trim); lPt.position.set(-0.34, 1.0, 0);
  const rPt = m(box(0.32, 0.05, 0.32), trim); rPt.position.set(0.34, 1.0, 0);
  // arms
  const lA = m(box(0.13, 0.4, 0.15), armorDark); lA.position.set(-0.32, 0.66, 0);
  const rA = m(box(0.13, 0.4, 0.15), armorDark); rA.position.set(0.32, 0.66, 0.02);
  // helmet — a faceted helm with a dark visor and glowing eyes (NOT a round head)
  const helm = m(cone(0.2, 0.3, 5), armor); helm.position.set(0, 1.12, 0); helm.rotation.y = Math.PI / 10;
  const helmBase = m(box(0.28, 0.18, 0.28), armorDark); helmBase.position.set(0, 0.98, 0);
  const visor = m(box(0.22, 0.06, 0.04), mat('#05070c')); visor.position.set(0, 1.0, 0.15);
  const eyeL = m(box(0.05, 0.05, 0.03), eye); eyeL.position.set(-0.06, 1.0, 0.17);
  const eyeR = m(box(0.05, 0.05, 0.03), eye); eyeR.position.set(0.06, 1.0, 0.17);
  // chest trim accent (rarity glow)
  const gorget = m(box(0.3, 0.06, 0.3), trim); gorget.position.set(0, 0.9, 0.02);

  g.add(lL, rL, torso, chest, belt, lP, rP, lPt, rPt, lA, rA, helm, helmBase, visor, eyeL, eyeR, gorget);

  // weapon mount at the right hand
  const weaponMount = new T.Object3D();
  weaponMount.position.set(0.4, 0.55, 0.12);
  g.add(weaponMount);

  // back mount for capes/wings
  const backMount = new T.Object3D();
  backMount.position.set(0, 0.75, -0.18);
  g.add(backMount);
  // head-top mount for crown/halo
  const headMount = new T.Object3D();
  headMount.position.set(0, 1.28, 0);
  g.add(headMount);

  g.userData = {
    weaponMount, backMount, headMount,
    bodyMat: armor,                  // engine tints to (darkened) class color
    trimMat: trim, eyeMat: eye,      // engine tints to rarity accent
    legs: [lL, rL],                  // engine animates a walk cycle
    arms: [lA, rA],
  };
  return g;
}

// =============================================================
// WEAPONS — distinct silhouettes; opts.color = rarity color, opts.tier
// =============================================================
export function buildWeapon_sword(opts) {
  const c = opts.color || '#c8d0e0';
  const g = new T.Group();
  const steel = mat(c, 0.9), edge = matAdd(c, 0.85), guard = mat('#8a8f9c');
  const blade = m(box(0.06, 0.62, 0.02), steel); blade.position.y = 0.42;
  const fuller = m(box(0.02, 0.5, 0.025), edge); fuller.position.y = 0.42;  // glowing centre line
  const tip = m(cone(0.05, 0.14, 4), steel); tip.position.y = 0.78;
  const cross = m(box(0.28, 0.06, 0.06), guard); cross.position.y = 0.1;
  const grip = m(box(0.05, 0.16, 0.05), mat('#2a2018')); grip.position.y = 0;
  const pommel = m(box(0.08, 0.08, 0.08), guard); pommel.position.y = -0.09;
  g.add(blade, fuller, tip, cross, grip, pommel);
  g.rotation.z = -0.25;
  return g;
}
export function buildWeapon_staff(opts) {
  const c = opts.color || '#9be8ff';
  const g = new T.Group();
  const shaft = m(cyl(0.04, 0.05, 0.95, 6), mat('#3a2e22'));
  shaft.position.y = 0.45;
  const orb = m(geo('orb', () => new T.IcosahedronGeometry(0.13, 0)), matAdd(c, 0.95));
  orb.position.y = 1.0;
  const cage = m(cone(0.14, 0.22, 4), mat(c, 0.7)); cage.position.y = 0.96;
  g.add(shaft, cage, orb);
  g.userData.anim = (grp, now) => { orb.scale.setScalar(1 + Math.sin(now / 220) * 0.12); };
  return g;
}
export function buildWeapon_bow(opts) {
  const c = opts.color || '#caa15a';
  const g = new T.Group();
  const limb = m(geo('bowlimb', () => new T.TorusGeometry(0.42, 0.035, 4, 10, Math.PI * 1.1)), mat(c, 0.85));
  limb.rotation.z = Math.PI / 2;
  limb.position.y = 0.42;
  const grip = m(box(0.07, 0.2, 0.07), mat('#2a2018')); grip.position.y = 0.42;
  g.add(limb, grip);
  return g;
}
export function buildWeapon_wand(opts) {
  const c = opts.color || '#c489ff';
  const g = new T.Group();
  const shaft = m(cyl(0.035, 0.05, 0.5, 6), mat('#2a223a')); shaft.position.y = 0.25;
  const skull = m(box(0.16, 0.16, 0.14), mat('#d8d2c0')); skull.position.y = 0.56;
  const e1 = m(box(0.04, 0.04, 0.03), matAdd(c, 1)); e1.position.set(-0.04, 0.57, 0.08);
  const e2 = m(box(0.04, 0.04, 0.03), matAdd(c, 1)); e2.position.set(0.04, 0.57, 0.08);
  g.add(shaft, skull, e1, e2);
  return g;
}

// =============================================================
// GEAR LOOKS — attach to back/head mounts. opts.color = look color
// =============================================================
export function buildGear_cape(opts) {
  const c = opts.color || '#6a2030';
  const g = new T.Group();
  const cape = m(plane(0.6, 0.85), mat(c, 0.8));
  cape.position.set(0, -0.35, -0.02);
  g.add(cape);
  g.userData.anim = (grp, now) => { cape.rotation.x = 0.12 + Math.sin(now / 400) * 0.06; };
  return g;
}
export function buildGear_wings(opts) {
  const c = opts.color || '#caa15a';
  const g = new T.Group();
  const wL = m(cone(0.34, 0.7, 3), mat(c, 0.7)); wL.position.set(-0.28, -0.1, -0.05); wL.rotation.set(Math.PI / 2, 0, 0.5); wL.scale.set(1, 0.3, 1);
  const wR = m(cone(0.34, 0.7, 3), mat(c, 0.7)); wR.position.set(0.28, -0.1, -0.05); wR.rotation.set(Math.PI / 2, 0, -0.5); wR.scale.set(1, 0.3, 1);
  g.add(wL, wR);
  g.userData.anim = (grp, now) => { const f = Math.sin(now / 280) * 0.18; wL.rotation.z = 0.5 + f; wR.rotation.z = -0.5 - f; };
  return g;
}
export function buildGear_crown(opts) {
  const c = opts.color || '#ffd166';
  const g = new T.Group();
  const band = m(cyl(0.16, 0.16, 0.07, 6), matAdd(c, 0.9));
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const sp = m(cone(0.04, 0.12, 3), matAdd(c, 0.95));
    const a = (i / 5) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.13);
    g.add(sp);
  }
  return g;
}
export function buildGear_halo(opts) {
  const c = opts.color || '#9be8ff';
  const g = new T.Group();
  const ring = m(geo('halo', () => new T.TorusGeometry(0.2, 0.025, 4, 16)), matAdd(c, 0.85));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.1;
  g.add(ring);
  g.userData.anim = (grp, now) => { ring.rotation.z = now / 1400; };
  return g;
}

// =============================================================
// PLACEHOLDER — registered for every key not yet authored, so the
// pipeline is complete and measurable. A tinted angular prism.
// =============================================================
export function buildPlaceholder(opts) {
  const g = new T.Group();
  const body = m(geo('ph', () => new T.OctahedronGeometry(0.4, 0)), mat(opts && opts.color ? opts.color : '#888'));
  body.position.y = 0.5; body.scale.y = 1.4;
  g.add(body);
  return g;
}

// expose the cache for the engine (warm-up / disposal if needed)
export const _cache = { GEO, MATS };
