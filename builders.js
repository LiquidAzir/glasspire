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
  const c = (opts && opts.color) || '#c8d0e0';
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
  const c = (opts && opts.color) || '#9be8ff';
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
  const c = (opts && opts.color) || '#caa15a';
  const g = new T.Group();
  const limb = m(geo('bowlimb', () => new T.TorusGeometry(0.42, 0.035, 4, 10, Math.PI * 1.1)), mat(c, 0.85));
  limb.rotation.z = Math.PI / 2;
  limb.position.y = 0.42;
  const grip = m(box(0.07, 0.2, 0.07), mat('#2a2018')); grip.position.y = 0.42;
  g.add(limb, grip);
  return g;
}
export function buildWeapon_wand(opts) {
  const c = (opts && opts.color) || '#c489ff';
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
  const c = (opts && opts.color) || '#6a2030';
  const g = new T.Group();
  const cape = m(plane(0.6, 0.85), mat(c, 0.8));
  cape.position.set(0, -0.35, -0.02);
  g.add(cape);
  g.userData.anim = (grp, now) => { cape.rotation.x = 0.12 + Math.sin(now / 400) * 0.06; };
  return g;
}
export function buildGear_wings(opts) {
  const c = (opts && opts.color) || '#caa15a';
  const g = new T.Group();
  const wL = m(cone(0.34, 0.7, 3), mat(c, 0.7)); wL.position.set(-0.28, -0.1, -0.05); wL.rotation.set(Math.PI / 2, 0, 0.5); wL.scale.set(1, 0.3, 1);
  const wR = m(cone(0.34, 0.7, 3), mat(c, 0.7)); wR.position.set(0.28, -0.1, -0.05); wR.rotation.set(Math.PI / 2, 0, -0.5); wR.scale.set(1, 0.3, 1);
  g.add(wL, wR);
  g.userData.anim = (grp, now) => { const f = Math.sin(now / 280) * 0.18; wL.rotation.z = 0.5 + f; wR.rotation.z = -0.5 - f; };
  return g;
}
export function buildGear_crown(opts) {
  const c = (opts && opts.color) || '#ffd166';
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
  const c = (opts && opts.color) || '#9be8ff';
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


// =============================================================
// CREATURES / PROPS / ITEMS / NPC / DECOR — authored by the model workflow
// (gothic low-poly, additive-display native). See RENDER3D_PLAN.md.
// =============================================================

export function buildEnemy_skeleton(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#cfc8b0';
  const bone = mat(c, 0.55);
  const boneDark = mat(c, 0.32);
  const eye = matAdd('#ff5a3c');
  const glint = matAdd('#dfffff', 0.7);

  // thin legs
  const legL = m(box(0.08, 0.5, 0.08), boneDark); legL.position.set(-0.11, 0.25, 0);
  const legR = m(box(0.08, 0.5, 0.08), boneDark); legR.position.set(0.11, 0.25, 0);
  const pelvis = m(box(0.3, 0.1, 0.16), bone); pelvis.position.set(0, 0.55, 0);

  // spine + ribcage (stacked rib slats)
  const spine = m(box(0.07, 0.42, 0.07), boneDark); spine.position.set(0, 0.8, -0.02);
  const rib1 = m(box(0.34, 0.05, 0.18), bone); rib1.position.set(0, 0.7, 0.02);
  const rib2 = m(box(0.32, 0.05, 0.18), bone); rib2.position.set(0, 0.82, 0.02);
  const rib3 = m(box(0.28, 0.05, 0.17), bone); rib3.position.set(0, 0.94, 0.02);

  // shoulders + thin arms
  const shoulders = m(box(0.4, 0.08, 0.14), boneDark); shoulders.position.set(0, 1.04, 0);
  const armL = m(box(0.07, 0.42, 0.07), boneDark); armL.position.set(-0.22, 0.84, 0.04);
  const armR = m(box(0.07, 0.42, 0.07), boneDark); armR.position.set(0.22, 0.84, 0.06);

  // chipped blade in right hand
  const hilt = m(box(0.05, 0.1, 0.05), boneDark); hilt.position.set(0.24, 0.6, 0.1);
  const blade = m(box(0.06, 0.46, 0.03), glint); blade.position.set(0.24, 0.86, 0.12); blade.rotation.z = 0.06;
  const tip = m(cone(0.05, 0.12, 4), glint); tip.position.set(0.235, 1.13, 0.12);

  // skull with glowing sockets
  const skull = m(box(0.24, 0.24, 0.22), bone); skull.position.set(0, 1.22, 0);
  const jaw = m(box(0.18, 0.07, 0.16), boneDark); jaw.position.set(0, 1.09, 0.02);
  const eyeL = m(box(0.06, 0.06, 0.04), eye); eyeL.position.set(-0.06, 1.24, 0.12);
  const eyeR = m(box(0.06, 0.06, 0.04), eye); eyeR.position.set(0.06, 1.24, 0.12);

  g.add(legL, legR, pelvis, spine, rib1, rib2, rib3, shoulders, armL, armR, hilt, blade, tip, skull, jaw, eyeL, eyeR);

  g.userData.anim = (g, now) => {
    const s = Math.sin(now / 360);
    armR.rotation.x = -0.25 + s * 0.12;
    hilt.position.y = 0.6 + s * 0.02;
    blade.position.y = 0.86 + s * 0.02;
    tip.position.y = 1.13 + s * 0.02;
    skull.rotation.z = s * 0.04;
  };
  return g;
}

export function buildEnemy_hunched(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#7a8a5e';
  const flesh = mat(c, 0.5);
  const fleshDark = mat(c, 0.3);
  const claw = matAdd('#e8ffd0', 0.75);
  const eye = matAdd('#aaff44');

  // bent crouched legs
  const legL = m(box(0.14, 0.3, 0.16), fleshDark); legL.position.set(-0.16, 0.16, -0.02); legL.rotation.x = 0.25;
  const legR = m(box(0.14, 0.3, 0.16), fleshDark); legR.position.set(0.16, 0.16, -0.02); legR.rotation.x = 0.25;
  const footL = m(box(0.16, 0.06, 0.24), fleshDark); footL.position.set(-0.16, 0.03, 0.08);
  const footR = m(box(0.16, 0.06, 0.24), fleshDark); footR.position.set(0.16, 0.03, 0.08);

  // hunched torso, tilted forward, with humped spine
  const torso = m(box(0.46, 0.4, 0.34), flesh); torso.position.set(0, 0.52, 0.04); torso.rotation.x = 0.4;
  const hump = m(box(0.34, 0.22, 0.2), fleshDark); hump.position.set(0, 0.66, -0.16);
  const spineRidge = m(cone(0.08, 0.2, 4), fleshDark); spineRidge.position.set(0, 0.72, -0.18); spineRidge.rotation.x = -0.5;

  // oversized clawed arms reaching forward
  const upperL = m(box(0.14, 0.34, 0.14), flesh); upperL.position.set(-0.28, 0.5, 0.1); upperL.rotation.x = 0.7;
  const upperR = m(box(0.14, 0.34, 0.14), flesh); upperR.position.set(0.28, 0.5, 0.1); upperR.rotation.x = 0.7;
  const foreL = m(box(0.12, 0.32, 0.12), fleshDark); foreL.position.set(-0.3, 0.34, 0.32); foreL.rotation.x = 1.2;
  const foreR = m(box(0.12, 0.32, 0.12), fleshDark); foreR.position.set(0.3, 0.34, 0.32); foreR.rotation.x = 1.2;
  const clawL = m(cone(0.07, 0.26, 4), claw); clawL.position.set(-0.3, 0.22, 0.5); clawL.rotation.x = 1.7;
  const clawR = m(cone(0.07, 0.26, 4), claw); clawR.position.set(0.3, 0.22, 0.5); clawR.rotation.x = 1.7;

  // sunken head with glowing eyes
  const head = m(box(0.26, 0.2, 0.24), fleshDark); head.position.set(0, 0.66, 0.24);
  const eyeL = m(box(0.05, 0.05, 0.04), eye); eyeL.position.set(-0.06, 0.68, 0.36);
  const eyeR = m(box(0.05, 0.05, 0.04), eye); eyeR.position.set(0.06, 0.68, 0.36);

  g.add(legL, legR, footL, footR, torso, hump, spineRidge, upperL, upperR, foreL, foreR, clawL, clawR, head, eyeL, eyeR);

  g.userData.anim = (g, now) => {
    const s = Math.sin(now / 280);
    foreL.rotation.x = 1.2 + s * 0.18;
    foreR.rotation.x = 1.2 - s * 0.18;
    clawL.position.z = 0.5 + s * 0.04;
    clawR.position.z = 0.5 - s * 0.04;
    head.position.y = 0.66 + Math.sin(now / 400) * 0.015;
  };
  return g;
}

export function buildEnemy_ghost(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#8fb6c8';
  const shroud = matAdd(c, 0.42);
  const shroudFaint = matAdd(c, 0.24);
  const hood = mat(c, 0.28);
  const eye = matAdd('#dffaff');

  const float = new T.Group(); float.position.y = 0.5;

  // tapered tattered body (wide hood -> narrow trailing wisp)
  const upper = m(cyl(0.26, 0.34, 0.4, 6), shroud); upper.position.set(0, 0.5, 0);
  const lower = m(cyl(0.3, 0.14, 0.46, 6), shroudFaint); lower.position.set(0, 0.1, 0);

  // ragged hem prongs trailing below
  const hem1 = m(cone(0.1, 0.34, 4), shroudFaint); hem1.position.set(-0.14, -0.18, 0.04); hem1.rotation.x = Math.PI;
  const hem2 = m(cone(0.1, 0.4, 4), shroudFaint); hem2.position.set(0.02, -0.24, -0.04); hem2.rotation.x = Math.PI;
  const hem3 = m(cone(0.1, 0.3, 4), shroudFaint); hem3.position.set(0.16, -0.16, 0.06); hem3.rotation.x = Math.PI;

  // hollow hood
  const hoodTop = m(cone(0.26, 0.34, 6), hood); hoodTop.position.set(0, 0.82, 0);
  const hollow = m(box(0.2, 0.18, 0.04), mat(c, 0.12)); hollow.position.set(0, 0.66, 0.2);
  const eyeL = m(box(0.05, 0.06, 0.03), eye); eyeL.position.set(-0.06, 0.68, 0.22);
  const eyeR = m(box(0.05, 0.06, 0.03), eye); eyeR.position.set(0.06, 0.68, 0.22);

  // wispy arms
  const armL = m(cyl(0.05, 0.09, 0.34, 5), shroudFaint); armL.position.set(-0.3, 0.44, 0.04); armL.rotation.z = 0.4;
  const armR = m(cyl(0.05, 0.09, 0.34, 5), shroudFaint); armR.position.set(0.3, 0.44, 0.04); armR.rotation.z = -0.4;

  float.add(upper, lower, hem1, hem2, hem3, hoodTop, hollow, eyeL, eyeR, armL, armR);
  g.add(float);

  g.userData.anim = (g, now) => {
    const drift = Math.sin(now / 700);
    float.position.y = 0.5 + drift * 0.07;
    hem1.rotation.z = Math.sin(now / 500) * 0.12;
    hem2.rotation.z = Math.sin(now / 500 + 1) * 0.12;
    hem3.rotation.z = Math.sin(now / 500 + 2) * 0.12;
    armL.rotation.z = 0.4 + Math.sin(now / 600) * 0.1;
    armR.rotation.z = -0.4 - Math.sin(now / 600) * 0.1;
  };
  return g;
}

export function buildEnemy_caster(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.5 : 1;
  const g = new T.Group();
  // dark robe shade + grim accent + glow
  const robe = mat(c, 0.4);
  const robeDeep = mat(c, 0.24);
  const wood = mat('#2a2018');
  const glow = matAdd(c, 0.95);
  const glowHot = matAdd('#ffffff', 0.9);

  // long tapered robe (wide hem, narrow at the chest) — the body, no legs
  const hem = m(cyl(0.16 * s, 0.42 * s, 0.78 * s, 6), robeDeep); hem.position.y = 0.39 * s;
  const torso = m(cyl(0.13 * s, 0.18 * s, 0.34 * s, 6), robe); torso.position.y = 0.92 * s;
  // hood — a faceted cowl (cone) with a dark inner box and a sliver of glowing face
  const hood = m(cone(0.2 * s, 0.34 * s, 5), robe); hood.position.y = 1.24 * s; hood.rotation.y = Math.PI / 5;
  const hoodInner = m(box(0.16 * s, 0.16 * s, 0.04 * s), mat(c, 0.16)); hoodInner.position.set(0, 1.14 * s, 0.13 * s);
  const face = m(box(0.07 * s, 0.1 * s, 0.02 * s), glow); face.position.set(0, 1.14 * s, 0.15 * s);
  const eyeL = m(box(0.025 * s, 0.025 * s, 0.02 * s), glowHot); eyeL.position.set(-0.03 * s, 1.16 * s, 0.16 * s);
  const eyeR = m(box(0.025 * s, 0.025 * s, 0.02 * s), glowHot); eyeR.position.set(0.03 * s, 1.16 * s, 0.16 * s);
  // arms drawn together to hold the staff out in front
  const armL = m(box(0.07 * s, 0.32 * s, 0.08 * s), robe); armL.position.set(-0.18 * s, 0.92 * s, 0.06 * s); armL.rotation.x = 0.5; armL.rotation.z = 0.25;
  const armR = m(box(0.07 * s, 0.32 * s, 0.08 * s), robe); armR.position.set(0.18 * s, 0.92 * s, 0.06 * s); armR.rotation.x = 0.5; armR.rotation.z = -0.25;
  // gnarled staff — a leaning shaft with a kinked head and a glowing tip orb
  const staff = m(cyl(0.025 * s, 0.035 * s, 1.0 * s, 5), wood); staff.position.set(0.24 * s, 0.7 * s, 0.18 * s); staff.rotation.x = 0.18;
  const knuckle = m(box(0.06 * s, 0.06 * s, 0.06 * s), wood); knuckle.position.set(0.27 * s, 1.16 * s, 0.26 * s); knuckle.rotation.z = 0.5;
  const cage = m(cone(0.11 * s, 0.18 * s, 4), robeDeep); cage.position.set(0.28 * s, 1.28 * s, 0.28 * s);
  const tip = m(geo('casterTip', () => new T.IcosahedronGeometry(0.09, 0)), glow); tip.position.set(0.28 * s, 1.34 * s, 0.28 * s); tip.scale.setScalar(s);
  const tipCore = m(box(0.04 * s, 0.04 * s, 0.04 * s), glowHot); tipCore.position.set(0.28 * s, 1.34 * s, 0.28 * s);

  g.add(hem, torso, hood, hoodInner, face, eyeL, eyeR, armL, armR, staff, knuckle, cage, tip, tipCore);

  g.userData.anim = (grp, now) => {
    const p = Math.sin(now / 320);
    tip.scale.setScalar(s * (1 + p * 0.18));
    tipCore.scale.setScalar(1 + p * 0.3);
    // slow ominous lean of the hood
    hood.rotation.z = Math.sin(now / 900) * 0.05;
  };
  return g;
}

export function buildEnemy_weaver(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.6 : 1;
  const g = new T.Group();
  const ringMat = mat(c, 0.55);
  const ringDeep = mat(c, 0.35);
  const eyeGlow = matAdd(c, 0.95);
  const pupil = matAdd('#ffffff', 1);

  // floats off the ground — body hovers around y ~ 0.7..0.9 (scaled)
  const cx = 0.85 * s;

  // central glowing eye — a faceted lens with a dim iris box and a hot core
  const eyeBall = m(geo('weaverEye', () => new T.IcosahedronGeometry(0.16, 0)), eyeGlow);
  eyeBall.position.y = cx; eyeBall.scale.setScalar(s);
  const iris = m(box(0.11 * s, 0.13 * s, 0.05 * s), mat(c, 0.18)); iris.position.set(0, cx, 0.13 * s);
  const core = m(box(0.05 * s, 0.07 * s, 0.04 * s), pupil); core.position.set(0, cx, 0.16 * s);

  // concentric angular rings (octagon torii) on different axes — the eldritch construct
  const r1 = m(geo('weaverRing1', () => new T.TorusGeometry(0.34, 0.03, 4, 8)), ringMat);
  r1.position.y = cx; r1.rotation.x = Math.PI / 2;
  const r2 = m(geo('weaverRing2', () => new T.TorusGeometry(0.5, 0.035, 4, 8)), ringDeep);
  r2.position.y = cx; r2.rotation.set(Math.PI / 2, 0, 0.4);
  const r3 = m(geo('weaverRing3', () => new T.TorusGeometry(0.66, 0.03, 4, 6)), ringMat);
  r3.position.y = cx; r3.rotation.set(0.5, 0.3, 0);
  r1.scale.setScalar(s); r2.scale.setScalar(s); r3.scale.setScalar(s);

  // a few sharp shards riding the outer ring for a jagged silhouette
  const shards = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const sh = m(cone(0.05 * s, 0.16 * s, 3), eyeGlow);
    sh.position.set(Math.cos(a) * 0.66 * s, cx, Math.sin(a) * 0.66 * s);
    sh.rotation.z = -a;
    g.add(sh); shards.push(sh);
  }

  g.add(r1, r2, r3, eyeBall, iris, core);

  g.userData.anim = (grp, now) => {
    // counter-rotating rings
    r1.rotation.z = now / 900;
    r2.rotation.z = 0.4 - now / 1300;
    r3.rotation.y = 0.3 + now / 1100;
    // pulsing eye + bob
    const p = Math.sin(now / 380);
    core.scale.setScalar(1 + p * 0.3);
    eyeBall.scale.setScalar(s * (1 + p * 0.08));
    const y = cx + Math.sin(now / 700) * 0.06;
    eyeBall.position.y = y; iris.position.y = y; core.position.y = y;
    r1.position.y = y; r2.position.y = y; r3.position.y = y;
    for (let i = 0; i < shards.length; i++) shards[i].position.y = y;
  };
  return g;
}

export function buildEnemy_beast(opts) {
  const c = (opts && opts.color) || '#7a2230';
  const g = new T.Group();
  const body = mat(c, 0.5);
  const dark = mat(c, 0.34);
  const eyeMat = matAdd((opts && opts.eye) || '#ff5a2a');
  // Lean spine/torso, slightly raised hindquarters -> menacing crouch.
  const torso = m(box(0.36, 0.3, 0.86), body); torso.position.set(0, 0.5, 0.02);
  const haunch = m(box(0.42, 0.36, 0.34), dark); haunch.position.set(0, 0.52, -0.34);
  const chest = m(box(0.4, 0.34, 0.3), body); chest.position.set(0, 0.5, 0.36);
  // Neck angled forward + snouted head at the +Z end.
  const neck = m(box(0.26, 0.24, 0.28), dark); neck.position.set(0, 0.56, 0.5); neck.rotation.x = -0.35;
  const head = m(box(0.3, 0.26, 0.3), body); head.position.set(0, 0.62, 0.66);
  const snout = m(box(0.16, 0.15, 0.26), dark); snout.position.set(0, 0.56, 0.88);
  const jaw = m(box(0.14, 0.07, 0.2), mat(c, 0.42)); jaw.position.set(0, 0.49, 0.86);
  // Glowing eyes + pointed ears.
  const eyeL = m(box(0.06, 0.06, 0.04), eyeMat); eyeL.position.set(-0.09, 0.66, 0.82);
  const eyeR = m(box(0.06, 0.06, 0.04), eyeMat); eyeR.position.set(0.09, 0.66, 0.82);
  const earL = m(cone(0.07, 0.2, 4), dark); earL.position.set(-0.1, 0.82, 0.6);
  const earR = m(cone(0.07, 0.2, 4), dark); earR.position.set(0.1, 0.82, 0.6);
  // Four legs (faceted boxes). Group each so anim can swing from the hip.
  function leg(x, z, fwd) {
    const lg = new T.Group(); lg.position.set(x, 0.42, z);
    const upper = m(box(0.11, 0.34, 0.13), dark); upper.position.set(0, -0.17, 0);
    const paw = m(box(0.13, 0.08, 0.18), body); paw.position.set(0, -0.36, 0.03);
    lg.add(upper, paw); lg.userData.fwd = fwd; return lg;
  }
  const flL = leg(-0.15, 0.42, true);
  const flR = leg(0.15, 0.42, false);
  const blL = leg(-0.16, -0.4, false);
  const blR = leg(0.16, -0.4, true);
  // Low, stiff tail trailing -Z, pivot group for sway.
  const tail = new T.Group(); tail.position.set(0, 0.5, -0.5);
  const t1 = m(box(0.09, 0.09, 0.26), dark); t1.position.set(0, 0.02, -0.13);
  const t2 = m(cone(0.06, 0.22, 4), body); t2.position.set(0, 0.04, -0.32); t2.rotation.x = Math.PI / 2;
  tail.add(t1, t2);
  g.add(torso, haunch, chest, neck, head, snout, jaw, eyeL, eyeR, earL, earR, flL, flR, blL, blR, tail);
  g.userData.legs = [flL, flR, blL, blR];
  g.userData.tail = tail;
  g.userData.head = head;
  g.userData.anim = (grp, now) => {
    const t = now / 220;
    const legs = grp.userData.legs;
    for (let i = 0; i < legs.length; i++) {
      const ph = legs[i].userData.fwd ? 0 : Math.PI;
      legs[i].rotation.x = Math.sin(t + ph) * 0.5;
    }
    grp.userData.tail.rotation.y = Math.sin(now / 400) * 0.45;
    grp.userData.tail.rotation.x = -0.15 + Math.sin(now / 520) * 0.1;
    grp.userData.head.position.y = 0.62 + Math.sin(now / 500) * 0.02;
  };
  return g;
}

export function buildEnemy_spider(opts) {
  const c = (opts && opts.color) || '#3b2a52';
  const g = new T.Group();
  const body = mat(c, 0.5);
  const dark = mat(c, 0.32);
  const eyeMat = matAdd((opts && opts.eye) || '#b06cff');
  // Body sits low and wide so legs can splay down to the ground (feet at y=0).
  // Bulbous faceted abdomen (rear) + smaller cephalothorax/head (front, +Z).
  const abdomen = m(box(0.5, 0.34, 0.56), body); abdomen.position.set(0, 0.36, -0.22);
  const hump = m(cone(0.28, 0.26, 5), dark); hump.position.set(0, 0.52, -0.26); hump.rotation.x = Math.PI;
  const head = m(box(0.3, 0.24, 0.3), dark); head.position.set(0, 0.32, 0.24);
  // Two fangs jutting forward.
  const fangL = m(cone(0.04, 0.14, 4), body); fangL.position.set(-0.07, 0.24, 0.42); fangL.rotation.x = Math.PI / 2;
  const fangR = m(cone(0.04, 0.14, 4), body); fangR.position.set(0.07, 0.24, 0.42); fangR.rotation.x = Math.PI / 2;
  // Glowing eye cluster on the head front.
  const eyePos = [[-0.08, 0.38, 0.39], [0.08, 0.38, 0.39], [-0.04, 0.32, 0.4], [0.04, 0.32, 0.4]];
  for (let i = 0; i < eyePos.length; i++) {
    const sz = i < 2 ? 0.05 : 0.035;
    const e = m(box(sz, sz, 0.03), eyeMat); e.position.set(eyePos[i][0], eyePos[i][1], eyePos[i][2]); g.add(e);
  }
  // Eight angular legs: hip group at body height; upper box angles out, lower cone drops to the floor.
  // The leg group's baseY is the body joint; the lower cone reaches down to y~=0 so feet touch the tile.
  const baseY = 0.36;
  const legs = [];
  function buildLeg(side, z, spread) {
    const lg = new T.Group(); lg.position.set(0.16 * side, baseY, z);
    // Upper segment angles outward and slightly up at the knee.
    const upper = m(box(0.07, 0.06, 0.28), dark);
    upper.position.set(0.16 * side, 0.05, 0);
    upper.rotation.z = -0.5 * side;
    upper.rotation.y = spread * side;
    // Lower segment is a downward-pointing cone whose tip plants on the ground (group-local y ~= -baseY).
    const lower = m(cone(0.045, 0.4, 4), body);
    lower.position.set(0.3 * side, -baseY + 0.2, spread * 0.16 * side);
    lower.rotation.z = 0.32 * side;
    lg.add(upper, lower); return lg;
  }
  const cfg = [[-1, 0.22, 0.5], [1, 0.22, 0.5], [-1, 0.06, 0.18], [1, 0.06, 0.18], [-1, -0.1, -0.18], [1, -0.1, -0.18], [-1, -0.26, -0.5], [1, -0.26, -0.5]];
  for (let i = 0; i < cfg.length; i++) {
    const lg = buildLeg(cfg[i][0], cfg[i][1], cfg[i][2]);
    lg.userData.ph = i * 0.8; legs.push(lg); g.add(lg);
  }
  g.add(abdomen, hump, head, fangL, fangR);
  g.userData.legs = legs;
  g.userData.anim = (grp, now) => {
    const lg = grp.userData.legs;
    for (let i = 0; i < lg.length; i++) {
      const s = Math.sin(now / 130 + lg[i].userData.ph);
      lg[i].rotation.x = s * 0.16;
      lg[i].position.y = 0.36 + Math.abs(s) * 0.02;
    }
  };
  return g;
}

export function buildEnemy_bat(opts) {
  const c = (opts && opts.color) || '#4a3a66';
  const g = new T.Group();
  const body = mat(c, 0.46);
  const memb = mat(c, 0.6);
  const eyeMat = matAdd((opts && opts.eye) || '#ff3860');
  // Crouched bat: lowest geometry sits at y=0. The engine adds its own float/bob.
  const BASE = 0.12;
  // Tiny faceted body.
  const torso = m(box(0.16, 0.22, 0.16), body); torso.position.set(0, BASE + 0.11, 0);
  const head = m(box(0.14, 0.13, 0.14), body); head.position.set(0, BASE + 0.27, 0.05);
  // Pointed ears.
  const earL = m(cone(0.04, 0.12, 4), body); earL.position.set(-0.05, BASE + 0.38, 0.04);
  const earR = m(cone(0.04, 0.12, 4), body); earR.position.set(0.05, BASE + 0.38, 0.04);
  // Glowing eyes.
  const eyeL = m(box(0.04, 0.04, 0.03), eyeMat); eyeL.position.set(-0.04, BASE + 0.28, 0.12);
  const eyeR = m(box(0.04, 0.04, 0.03), eyeMat); eyeR.position.set(0.04, BASE + 0.28, 0.12);
  // Two large membrane wings: pivot groups so they flap from the shoulder.
  function wing(side) {
    const w = new T.Group(); w.position.set(0.07 * side, BASE + 0.15, 0);
    const inner = m(box(0.3, 0.16, 0.02), memb); inner.position.set(0.18 * side, 0, 0);
    const outer = m(cone(0.14, 0.34, 3), memb); outer.position.set(0.4 * side, -0.02, 0); outer.rotation.z = Math.PI / 2 * side; outer.scale.set(1, 1, 0.15);
    const claw = m(cone(0.03, 0.1, 4), body); claw.position.set(0.55 * side, 0.05, 0); claw.rotation.z = -0.4 * side;
    w.add(inner, outer, claw); return w;
  }
  const wL = wing(-1);
  const wR = wing(1);
  // Small feet tucked under, resting at the ground.
  const feet = m(box(0.12, 0.05, 0.08), body); feet.position.set(0, BASE - 0.085, -0.02);
  g.add(torso, head, earL, earR, eyeL, eyeR, wL, wR, feet);
  g.userData.wL = wL; g.userData.wR = wR;
  g.userData.anim = (grp, now) => {
    const f = Math.sin(now / 90);
    grp.userData.wL.rotation.z = -f * 0.9;
    grp.userData.wR.rotation.z = f * 0.9;
  };
  return g;
}

export function buildEnemy_imp(opts) {
  const c = (opts && opts.color) || '#a8324a';
  const g = new T.Group();
  const skin = mat(c, 0.5);
  const skinDark = mat(c, 0.32);
  const horn = mat('#6b5a44');
  const eye = matAdd('#ffd24a', 1);
  const fang = matAdd('#fff0d8', 0.9);
  // squat legs
  const lL = m(box(0.12, 0.18, 0.13), skinDark); lL.position.set(-0.11, 0.09, 0.02);
  const rL = m(box(0.12, 0.18, 0.13), skinDark); rL.position.set(0.11, 0.09, 0.02);
  // pot-bellied body
  const body = m(box(0.36, 0.3, 0.3), skin); body.position.set(0, 0.4, 0);
  const belly = m(cone(0.2, 0.22, 5), skin); belly.position.set(0, 0.36, 0.1); belly.rotation.x = Math.PI / 2;
  // hunched little head
  const head = m(box(0.26, 0.22, 0.24), skin); head.position.set(0, 0.64, 0.03);
  // two glowing eyes
  const eyeL = m(box(0.06, 0.06, 0.03), eye); eyeL.position.set(-0.07, 0.66, 0.16);
  const eyeR = m(box(0.06, 0.06, 0.03), eye); eyeR.position.set(0.07, 0.66, 0.16);
  // fanged grin
  const f1 = m(box(0.03, 0.05, 0.02), fang); f1.position.set(-0.04, 0.57, 0.15);
  const f2 = m(box(0.03, 0.05, 0.02), fang); f2.position.set(0.04, 0.57, 0.15);
  // two curved horns (stacked cones angled outward)
  const hL = m(cone(0.05, 0.18, 4), horn); hL.position.set(-0.1, 0.82, 0); hL.rotation.set(0.2, 0, 0.5);
  const hR = m(cone(0.05, 0.18, 4), horn); hR.position.set(0.1, 0.82, 0); hR.rotation.set(0.2, 0, -0.5);
  // tiny bat wings
  const wL = m(cone(0.16, 0.34, 3), skinDark); wL.position.set(-0.24, 0.46, -0.08); wL.rotation.set(Math.PI / 2, 0, 0.7); wL.scale.set(1, 0.28, 1);
  const wR = m(cone(0.16, 0.34, 3), skinDark); wR.position.set(0.24, 0.46, -0.08); wR.rotation.set(Math.PI / 2, 0, -0.7); wR.scale.set(1, 0.28, 1);
  // little arms
  const aL = m(box(0.08, 0.2, 0.09), skinDark); aL.position.set(-0.22, 0.42, 0.04);
  const aR = m(box(0.08, 0.2, 0.09), skinDark); aR.position.set(0.22, 0.42, 0.04);
  g.add(lL, rL, body, belly, head, eyeL, eyeR, f1, f2, hL, hR, wL, wR, aL, aR);
  g.userData.anim = (grp, now) => {
    const f = Math.sin(now / 160) * 0.4;
    wL.rotation.z = 0.7 + f; wR.rotation.z = -0.7 - f;
  };
  return g;
}

export function buildEnemy_giant(opts) {
  const c = (opts && opts.color) || '#5f7d96';
  const g = new T.Group();
  const hide = mat(c, 0.5);
  const hideDark = mat(c, 0.32);
  const plate = mat(c, 0.6);
  const eye = matAdd('#bff0ff', 1);
  // thick legs
  const lL = m(box(0.26, 0.56, 0.28), hideDark); lL.position.set(-0.2, 0.28, 0);
  const rL = m(box(0.26, 0.56, 0.28), hideDark); rL.position.set(0.2, 0.28, 0);
  // heavy boots
  const bL = m(box(0.3, 0.14, 0.34), hide); bL.position.set(-0.2, 0.07, 0.03);
  const bR = m(box(0.3, 0.14, 0.34), hide); bR.position.set(0.2, 0.07, 0.03);
  // massive torso (tapered up to broad shoulders)
  const torso = m(box(0.62, 0.56, 0.42), hide); torso.position.set(0, 0.86, 0);
  const chestPlate = m(box(0.5, 0.34, 0.1), plate); chestPlate.position.set(0, 0.92, 0.22);
  // broad angular shoulders
  const shL = m(cone(0.22, 0.3, 4), plate); shL.position.set(-0.42, 1.12, 0); shL.rotation.z = 0.6;
  const shR = m(cone(0.22, 0.3, 4), plate); shR.position.set(0.42, 1.12, 0); shR.rotation.z = -0.6;
  // thick arms
  const aL = m(box(0.2, 0.5, 0.22), hideDark); aL.position.set(-0.46, 0.82, 0.02);
  const aR = m(box(0.2, 0.5, 0.22), hideDark); aR.position.set(0.46, 0.82, 0.02);
  // heavy fists
  const fL = m(box(0.26, 0.24, 0.26), hide); fL.position.set(-0.46, 0.5, 0.06);
  const fR = m(box(0.26, 0.24, 0.26), hide); fR.position.set(0.46, 0.5, 0.06);
  // small sunken head
  const head = m(box(0.26, 0.24, 0.26), hide); head.position.set(0, 1.24, 0.02);
  const eyeL = m(box(0.05, 0.04, 0.03), eye); eyeL.position.set(-0.06, 1.26, 0.15);
  const eyeR = m(box(0.05, 0.04, 0.03), eye); eyeR.position.set(0.06, 1.26, 0.15);
  g.add(lL, rL, bL, bR, torso, chestPlate, shL, shR, aL, aR, fL, fR, head, eyeL, eyeR);
  g.userData.anim = (grp, now) => {
    const s = Math.sin(now / 520) * 0.07;
    aL.rotation.x = s; aR.rotation.x = -s;
    fL.position.x = -0.46 + Math.sin(now / 520) * 0.01;
  };
  return g;
}

export function buildEnemy_demon(opts) {
  const c = (opts && opts.color) || '#7a1f2b';
  const g = new T.Group();
  const hide = mat(c, 0.45);
  const hideDark = mat(c, 0.28);
  const horn = mat('#3a2a22');
  const core = matAdd('#ff7326', 0.95);
  const eye = matAdd('#ff4020', 1);
  // digitigrade legs
  const lL = m(box(0.2, 0.6, 0.22), hideDark); lL.position.set(-0.2, 0.32, -0.02);
  const rL = m(box(0.2, 0.6, 0.22), hideDark); rL.position.set(0.2, 0.32, -0.02);
  // clawed feet
  const fL = m(cone(0.12, 0.2, 4), hide); fL.position.set(-0.2, 0.06, 0.14); fL.rotation.x = 1.4;
  const fR = m(cone(0.12, 0.2, 4), hide); fR.position.set(0.2, 0.06, 0.14); fR.rotation.x = 1.4;
  // tall tapered torso
  const torso = m(box(0.56, 0.62, 0.4), hide); torso.position.set(0, 1.0, 0);
  const abs = m(cone(0.3, 0.5, 4), hide); abs.position.set(0, 0.78, 0.05); abs.rotation.x = Math.PI;
  // glowing infernal chest core
  const chestCore = m(geo('demonCore', () => new T.OctahedronGeometry(0.13, 0)), core); chestCore.position.set(0, 1.06, 0.22);
  // broad jagged shoulders
  const shL = m(cone(0.22, 0.34, 4), hideDark); shL.position.set(-0.4, 1.3, 0); shL.rotation.z = 0.7;
  const shR = m(cone(0.22, 0.34, 4), hideDark); shR.position.set(0.4, 1.3, 0); shR.rotation.z = -0.7;
  // clawed arms
  const aL = m(box(0.16, 0.56, 0.18), hideDark); aL.position.set(-0.46, 0.96, 0.04); aL.rotation.z = 0.15;
  const aR = m(box(0.16, 0.56, 0.18), hideDark); aR.position.set(0.46, 0.96, 0.04); aR.rotation.z = -0.15;
  const clL = m(cone(0.1, 0.26, 4), hide); clL.position.set(-0.5, 0.62, 0.1); clL.rotation.x = 0.4;
  const clR = m(cone(0.1, 0.26, 4), hide); clR.position.set(0.5, 0.62, 0.1); clR.rotation.x = 0.4;
  // horned head
  const head = m(box(0.3, 0.28, 0.28), hide); head.position.set(0, 1.5, 0.03);
  const eyeL = m(box(0.06, 0.05, 0.03), eye); eyeL.position.set(-0.08, 1.52, 0.18);
  const eyeR = m(box(0.06, 0.05, 0.03), eye); eyeR.position.set(0.08, 1.52, 0.18);
  // big curved horns
  const hL = m(cone(0.07, 0.4, 4), horn); hL.position.set(-0.14, 1.74, -0.02); hL.rotation.set(-0.3, 0, 0.7);
  const hR = m(cone(0.07, 0.4, 4), horn); hR.position.set(0.14, 1.74, -0.02); hR.rotation.set(-0.3, 0, -0.7);
  // large folded wings (membrane cones + bony top spar)
  const wL = m(cone(0.42, 0.95, 3), hideDark); wL.position.set(-0.42, 1.1, -0.16); wL.rotation.set(Math.PI / 2, 0, 0.6); wL.scale.set(1, 0.32, 1);
  const wR = m(cone(0.42, 0.95, 3), hideDark); wR.position.set(0.42, 1.1, -0.16); wR.rotation.set(Math.PI / 2, 0, -0.6); wR.scale.set(1, 0.32, 1);
  const sparL = m(cyl(0.03, 0.04, 0.7, 4), horn); sparL.position.set(-0.5, 1.34, -0.18); sparL.rotation.z = 0.9;
  const sparR = m(cyl(0.03, 0.04, 0.7, 4), horn); sparR.position.set(0.5, 1.34, -0.18); sparR.rotation.z = -0.9;
  g.add(lL, rL, fL, fR, torso, abs, chestCore, shL, shR, aL, aR, clL, clR, head, eyeL, eyeR, hL, hR, wL, wR, sparL, sparR);
  g.userData.anim = (grp, now) => {
    const f = Math.sin(now / 360) * 0.22;
    wL.rotation.z = 0.6 + f; wR.rotation.z = -0.6 - f;
    sparL.rotation.z = 0.9 + f; sparR.rotation.z = -0.9 - f;
    chestCore.scale.setScalar(1 + Math.sin(now / 240) * 0.18);
    grp.position.y = Math.sin(now / 520) * 0.025;
  };
  return g;
}

export function buildEnemy_plant(opts) {
  const c = (opts && opts.color) || '#5fae4a';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.5 : 1;
  const g = new T.Group();
  const body = mat(c, 0.45);
  const dark = mat(c, 0.28);
  const thorn = mat(c, 0.6);
  const maw = matAdd('#ff5a2a', 0.9);
  const eye = matAdd('#ffd14a', 1);

  // rooted base — squat bulb/pod fused to the ground (base sits exactly at y=0)
  const root = m(cone(0.42 * s, 0.3 * s, 5), dark); root.position.y = 0.15 * s; root.rotation.y = 0.4;
  const bulb = m(cyl(0.34 * s, 0.42 * s, 0.42 * s, 6), body); bulb.position.y = 0.42 * s;

  // fanged maw — two angular jaw halves splitting open, glowing throat between
  const throat = m(cone(0.2 * s, 0.34 * s, 5), maw); throat.position.y = 0.74 * s; throat.rotation.x = Math.PI;
  const jawTop = m(cone(0.3 * s, 0.3 * s, 5), body); jawTop.position.y = 0.96 * s; jawTop.rotation.x = -0.35;
  const jawBot = m(cone(0.3 * s, 0.26 * s, 5), body); jawBot.position.y = 0.66 * s; jawBot.rotation.x = Math.PI + 0.35;
  // fangs ring around the maw
  const fangs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = m(cone(0.045 * s, 0.16 * s, 3), thorn);
    f.position.set(Math.cos(a) * 0.24 * s, 0.8 * s, Math.sin(a) * 0.24 * s);
    f.rotation.x = Math.PI; f.rotation.z = Math.cos(a) * 0.3;
    fangs.push(f);
  }
  // glowing eye spots flanking the maw
  const eL = m(box(0.05 * s, 0.06 * s, 0.03 * s), eye); eL.position.set(-0.16 * s, 0.86 * s, 0.26 * s);
  const eR = m(box(0.05 * s, 0.06 * s, 0.03 * s), eye); eR.position.set(0.16 * s, 0.86 * s, 0.26 * s);

  // thorny vines / leaves splaying out from the pod
  const leaves = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.7;
    const leaf = m(cone(0.09 * s, 0.5 * s, 3), mat(c, 0.5));
    leaf.position.set(Math.cos(a) * 0.4 * s, 0.4 * s, Math.sin(a) * 0.4 * s);
    leaf.rotation.set(Math.PI / 2.4, a, 0.5);
    leaf.scale.set(1, 1, 0.35);
    leaves.push(leaf);
  }
  // a couple of barbed thorns on the bulb
  const t1 = m(cone(0.05 * s, 0.18 * s, 3), thorn); t1.position.set(-0.3 * s, 0.5 * s, 0.18 * s); t1.rotation.set(0.4, 0, 1.1);
  const t2 = m(cone(0.05 * s, 0.18 * s, 3), thorn); t2.position.set(0.32 * s, 0.46 * s, -0.1 * s); t2.rotation.set(-0.3, 0, -1.2);

  g.add(root, bulb, throat, jawTop, jawBot, eL, eR, t1, t2);
  for (const f of fangs) g.add(f);
  for (const l of leaves) g.add(l);

  // rooted: it does not walk. Idle = maw breathing open/shut + a slow sway of vines.
  const jt0 = jawTop.rotation.x, jb0 = jawBot.rotation.x;
  g.userData.anim = (grp, now) => {
    const o = (Math.sin(now / 520) + 1) * 0.5; // 0..1 bite cycle
    jawTop.rotation.x = jt0 - o * 0.3;
    jawBot.rotation.x = jb0 + o * 0.3;
    throat.scale.setScalar(0.85 + o * 0.4);
    const sw = Math.sin(now / 700) * 0.1;
    for (let i = 0; i < leaves.length; i++) leaves[i].rotation.z = 0.5 + Math.sin(now / 640 + i) * 0.12;
    grp.rotation.z = sw * 0.15;
  };
  return g;
}

export function buildEnemy_orb(opts) {
  const c = (opts && opts.color) || '#7fd0ff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.5 : 1;
  const g = new T.Group();
  const core = matAdd(c, 0.95);
  const coreHot = matAdd('#ffffff', 0.9);
  const shard = matAdd(c, 0.55);

  // floating bright core — a small faceted icosahedron, NO body, hovers up
  const hover = 0.6 * s;
  const ic = m(geo('orbCore', () => new T.IcosahedronGeometry(0.18, 0)), core);
  ic.position.y = hover;
  const inner = m(geo('orbInner', () => new T.IcosahedronGeometry(0.09, 0)), coreHot);
  inner.position.y = hover;
  // faint outer haze (additive) reads as a wisp glow
  const haze = m(geo('orbHaze', () => new T.IcosahedronGeometry(0.3, 0)), matAdd(c, 0.18));
  haze.position.y = hover;

  g.add(haze, ic, inner);

  // a few orbiting motes / shards circling the core
  const motes = [];
  const N = boss ? 5 : 3;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const mo = m(geo('orbMote', () => new T.OctahedronGeometry(0.055, 0)), shard);
    mo.userData.a = a;
    mo.userData.r = (0.28 + (i % 2) * 0.08) * s;
    mo.userData.yoff = ((i % 3) - 1) * 0.1 * s;
    // initial placement so motes don't pop from the origin before anim runs
    mo.position.set(Math.cos(a) * mo.userData.r, hover + mo.userData.yoff, Math.sin(a) * mo.userData.r);
    motes.push(mo);
    g.add(mo);
  }

  g.userData.anim = (grp, now) => {
    const bob = Math.sin(now / 600) * 0.07 * s;
    ic.position.y = hover + bob;
    inner.position.y = hover + bob;
    haze.position.y = hover + bob;
    ic.rotation.y = now / 900;
    ic.rotation.x = now / 1300;
    inner.scale.setScalar(0.8 + Math.sin(now / 240) * 0.35);
    haze.scale.setScalar(1 + Math.sin(now / 700) * 0.18);
    const spin = now / 700;
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const a = mo.userData.a + spin;
      const r = mo.userData.r;
      mo.position.set(Math.cos(a) * r, hover + bob + mo.userData.yoff + Math.sin(now / 500 + a) * 0.05, Math.sin(a) * r);
      mo.rotation.y = a * 2;
    }
  };
  return g;
}

export function buildEnemy_crystal(opts) {
  const c = (opts && opts.color) || '#9a8cff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.55 : 1;
  const g = new T.Group();
  const facet = mat(c, 0.5);
  const facetDk = mat(c, 0.32);
  const edge = matAdd(c, 0.6);
  const core = matAdd('#ffffff', 0.95);
  const eye = matAdd(c, 1);

  // crystalline legs — two stout faceted prisms
  const lL = m(cone(0.13 * s, 0.4 * s, 4), facetDk); lL.position.set(-0.16 * s, 0.2 * s, 0); lL.rotation.y = 0.6;
  const rL = m(cone(0.13 * s, 0.4 * s, 4), facetDk); rL.position.set(0.16 * s, 0.2 * s, 0); rL.rotation.y = 0.6;
  // torso — a big upward octahedron prism, hollow-lit core inside
  const torso = m(geo('crysTorso', () => new T.OctahedronGeometry(0.34, 0)), facet);
  torso.position.y = 0.74 * s; torso.scale.set(1 * s, 1.5 * s, 1 * s); torso.rotation.y = Math.PI / 4;
  const ccore = m(geo('crysCore', () => new T.IcosahedronGeometry(0.12, 0)), core);
  ccore.position.y = 0.92 * s;
  // sharp crown/head shard with glowing eye
  const head = m(cone(0.16 * s, 0.42 * s, 4), facet); head.position.y = 1.22 * s; head.rotation.y = Math.PI / 4;
  const eEye = m(box(0.07 * s, 0.07 * s, 0.04 * s), eye); eEye.position.set(0, 1.18 * s, 0.16 * s);
  // back/shoulder spikes
  const sp1 = m(cone(0.08 * s, 0.34 * s, 4), facet); sp1.position.set(-0.28 * s, 1.0 * s, -0.1 * s); sp1.rotation.set(0.2, 0, 0.6);
  const sp2 = m(cone(0.08 * s, 0.34 * s, 4), facet); sp2.position.set(0.28 * s, 1.0 * s, -0.1 * s); sp2.rotation.set(0.2, 0, -0.6);
  // glowing seams along the torso
  const seam = m(cone(0.05 * s, 0.5 * s, 3), edge); seam.position.y = 0.74 * s; seam.scale.y = 1.1;

  // floating shard 'hands' — detached crystals hovering at the sides
  const handL = m(geo('crysHand', () => new T.OctahedronGeometry(0.11, 0)), facet);
  handL.position.set(-0.42 * s, 0.7 * s, 0.12 * s);
  const handR = m(geo('crysHand', () => new T.OctahedronGeometry(0.11, 0)), facet);
  handR.position.set(0.42 * s, 0.7 * s, 0.12 * s);
  const handLc = m(geo('crysHandC', () => new T.OctahedronGeometry(0.05, 0)), edge); handLc.position.copy(handL.position);
  const handRc = m(geo('crysHandC', () => new T.OctahedronGeometry(0.05, 0)), edge); handRc.position.copy(handR.position);

  g.add(lL, rL, torso, ccore, seam, head, eEye, sp1, sp2, handL, handR, handLc, handRc);

  const hy = handL.position.y;
  g.userData.anim = (grp, now) => {
    ccore.scale.setScalar(0.85 + Math.sin(now / 300) * 0.3);
    torso.rotation.y = Math.PI / 4 + Math.sin(now / 1400) * 0.08;
    const f = Math.sin(now / 600);
    handL.position.y = hy + f * 0.08 * s; handLc.position.y = handL.position.y;
    handR.position.y = hy - f * 0.08 * s; handRc.position.y = handR.position.y;
    handL.rotation.y = now / 800; handR.rotation.y = -now / 800;
    handLc.rotation.y = -now / 600; handRc.rotation.y = now / 600;
  };
  return g;
}

export function buildEnemy_void(opts) {
  const c = (opts && opts.color) || '#5a2d8a';
  const g = new T.Group();
  const bodyDark = mat(c, 0.4);
  const bodyMid = mat(c, 0.6);
  const core = matAdd(c, 0.95);
  const glint = matAdd('#ffffff', 0.9);

  // Clustered angular mass (faceted prisms, not a smooth blob).
  // Lowered so the lowest spikes reach y~0 (no floating gap under the feet).
  const m1 = m(box(0.42,0.38,0.4), bodyDark); m1.position.set(0,0.46,0); m1.rotation.set(0.3,0.4,0.2);
  const m2 = m(box(0.34,0.34,0.3), bodyMid); m2.position.set(-0.16,0.64,0.05); m2.rotation.set(0.5,0.2,0.6);
  const m3 = m(box(0.3,0.3,0.32), bodyDark); m3.position.set(0.18,0.6,-0.06); m3.rotation.set(0.2,0.7,0.4);
  const m4 = m(box(0.26,0.24,0.26), bodyMid); m4.position.set(0.02,0.84,0.02); m4.rotation.set(0.6,0.3,0.3);

  // Glowing core peeking through the mass + a hot white glint (gothic eye signal).
  const coreMesh = m(cone(0.12,0.22,5), core); coreMesh.position.set(0,0.66,0.12); coreMesh.rotation.x = Math.PI;
  const eye = m(box(0.07,0.07,0.04), glint); eye.position.set(0,0.66,0.2);

  // Erratic spikes jutting out; two point down to anchor the silhouette to the ground.
  const sp = [];
  const spDefs = [
    [ 0.0, 0.99,  0.0, -0.1,  0.0],
    [-0.24,0.69,  0.1,  0.9, -0.5],
    [ 0.26,0.64, -0.05,-1.0,  0.3],
    [ 0.1, 0.34,  0.18, Math.PI - 0.3, 0.0],
    [-0.12,0.34, -0.16, Math.PI + 0.3, 0.0]
  ];
  for (let i=0;i<spDefs.length;i++){
    const d=spDefs[i];
    const s=m(cone(0.06,0.3,4), bodyMid);
    s.position.set(d[0],d[1],d[2]);
    s.rotation.set(d[3],0,d[4]);
    sp.push(s); g.add(s);
  }

  g.add(m1,m2,m3,m4,coreMesh,eye);
  g.userData.spikes = sp;
  g.userData.core = coreMesh;
  g.userData.eye = eye;
  g.userData.anim = (g, now) => {
    const arr = g.userData.spikes;
    for (let i=0;i<arr.length;i++){
      const s = 1 + 0.35 * Math.sin(now/180 + i*1.7);
      arr[i].scale.set(1, s, 1);
    }
    const p = 1 + 0.12 * Math.sin(now/140);
    g.userData.core.scale.setScalar(p);
    g.userData.eye.scale.setScalar(1 + 0.18 * Math.sin(now/120));
  };
  return g;
}

export function buildEnemy_voidlord(opts) {
  const c = (opts && opts.color) || '#7a2bd0';
  const g = new T.Group();
  const massDark = mat(c, 0.38);
  const massMid = mat(c, 0.55);
  const eyeGlow = matAdd('#ffffff', 0.95);
  const iris = matAdd(c, 0.9);
  const tendrilMat = mat(c, 0.5);
  const tetherMat = mat(c, 0.32);

  // Dark energy tether anchoring the floating mass to the ground (lowest point at y=0).
  const tether = m(cone(0.16, 1.05, 6), tetherMat);
  tether.position.set(0, 0.52, 0);
  tether.rotation.x = Math.PI; // taper points downward to the ground
  g.add(tether);
  const tetherGlow = m(cyl(0.04, 0.04, 1.0, 6), iris);
  tetherGlow.position.set(0, 0.5, 0);
  g.add(tetherGlow);

  // Floating hub for the whole oppressive mass.
  const hub = new T.Group();
  hub.position.y = 1.05;

  // Central angular body (clustered faceted prisms).
  const b1 = m(box(0.6, 0.56, 0.56), massDark); b1.rotation.set(0.4, 0.5, 0.3);
  const b2 = m(box(0.5, 0.5, 0.46), massMid); b2.position.set(-0.18, 0.1, 0.04); b2.rotation.set(0.6, 0.3, 0.5);
  const b3 = m(box(0.46, 0.44, 0.5), massDark); b3.position.set(0.2, -0.08, -0.05); b3.rotation.set(0.3, 0.7, 0.4);
  hub.add(b1, b2, b3);

  // Brow shroud over the eye.
  const brow = m(box(0.5, 0.16, 0.3), massMid); brow.position.set(0, 0.18, 0.3); brow.rotation.x = -0.3;
  hub.add(brow);

  // Central glowing eye facing +Z.
  const eye = m(cyl(0.2, 0.2, 0.08, 8), eyeGlow); eye.rotation.x = Math.PI / 2; eye.position.set(0, 0, 0.34);
  const pupil = m(cyl(0.09, 0.09, 0.1, 6), iris); pupil.rotation.x = Math.PI / 2; pupil.position.set(0, 0, 0.4);
  hub.add(eye, pupil);

  // Radiating angular tendrils/spikes around the mass (tightened so the footprint stays ~1.2 units).
  const tendrils = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const piv = new T.Group();
    const len = 0.42 + (i % 3) * 0.08;
    const t = m(cone(0.08, len, 4), tendrilMat);
    t.position.set(0, len * 0.5, 0);
    piv.add(t);
    piv.position.set(Math.cos(a) * 0.34, Math.sin(a) * 0.06 - 0.04, Math.sin(a) * 0.34);
    piv.rotation.z = -Math.cos(a) * 0.8;
    piv.rotation.x = Math.sin(a) * 0.8;
    piv.userData.base = { x: piv.rotation.x, z: piv.rotation.z, phase: i * 0.8 };
    hub.add(piv);
    tendrils.push(piv);
  }

  g.add(hub);
  g.userData.hub = hub;
  g.userData.tether = tether;
  g.userData.tetherGlow = tetherGlow;
  g.userData.tendrils = tendrils;
  g.userData.eye = eye;
  g.userData.anim = (g, now) => {
    const h = g.userData.hub;
    h.rotation.y = now / 2600;
    const bob = 0.08 * Math.sin(now / 700);
    h.position.y = 1.05 + bob;
    // Keep the tether bridging ground to the floating mass as it bobs.
    const tt = g.userData.tether;
    tt.scale.y = 1 + bob / 0.52;
    tt.position.y = 0.52 + bob * 0.5;
    g.userData.tetherGlow.scale.y = tt.scale.y;
    g.userData.tetherGlow.position.y = 0.5 + bob * 0.5;
    const arr = g.userData.tendrils;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i], b = p.userData.base;
      const w = 0.25 * Math.sin(now / 300 + b.phase);
      p.rotation.x = b.x + w;
      p.rotation.z = b.z + w * 0.6;
    }
    g.userData.eye.scale.setScalar(1 + 0.1 * Math.sin(now / 220));
  };
  return g;
}

export function buildEnemy_wyrm(opts) {
  const c = (opts && opts.color) || '#7fd8ff';
  const g = new T.Group();
  const scaleDark = mat(c, 0.42);
  const scaleMid = mat(c, 0.6);
  const hornMat = mat(c, 0.5);
  const eyeGlow = matAdd('#ffffff', 0.95);
  const jawGlow = matAdd(c, 0.85);

  // Long segmented body snaking along +Z, raised so the belly clears the ground.
  const segs = [];
  const SEG = 6;
  const BASE_Y = 0.28;                  // > max segment radius (0.26) so nothing dips below y=0
  for (let i=0;i<SEG;i++){
    const t = i/(SEG-1);
    const r = 0.26 - t*0.13;            // taper toward the tail (-Z end)
    const seg = new T.Group();
    const body = m(cyl(r, r*0.9, 0.42, 6), (i%2===0)?scaleDark:scaleMid);
    body.rotation.x = Math.PI/2;        // length along Z
    seg.add(body);
    // small dorsal fin/spike per segment
    const fin = m(cone(0.06, 0.18, 4), hornMat); fin.position.set(0, r+0.04, 0);
    seg.add(fin);
    const z = 0.55 - i*0.42;            // head region near +Z, tail at -Z
    seg.position.set(0, BASE_Y, z);
    seg.userData.baseZ = z;
    seg.userData.idx = i;
    g.add(seg);
    segs.push(seg);
  }

  // Horned head with glowing eyes and open jaws at +Z
  const head = new T.Group();
  head.position.set(0, BASE_Y + 0.04, 0.95);
  const skull = m(box(0.36,0.3,0.4), scaleDark); skull.position.set(0,0.02,0);
  const snout = m(cone(0.18,0.3,5), scaleMid); snout.rotation.x = Math.PI/2; snout.position.set(0,0,0.28);
  // Open jaws: upper + lower angled wedges with glowing maw between
  const upperJaw = m(box(0.28,0.1,0.26), scaleMid); upperJaw.position.set(0,0.08,0.18); upperJaw.rotation.x = -0.25;
  const lowerJaw = m(box(0.26,0.09,0.24), scaleDark); lowerJaw.position.set(0,-0.12,0.16); lowerJaw.rotation.x = 0.3;
  const maw = m(cone(0.1,0.2,5), jawGlow); maw.rotation.x = Math.PI/2; maw.position.set(0,-0.02,0.22);
  // Horns sweeping back
  const hornL = m(cone(0.06,0.34,4), hornMat); hornL.position.set(-0.13,0.2,-0.06); hornL.rotation.set(-0.6,0,0.3);
  const hornR = m(cone(0.06,0.34,4), hornMat); hornR.position.set(0.13,0.2,-0.06); hornR.rotation.set(-0.6,0,-0.3);
  // Glowing eyes
  const eyeL = m(box(0.06,0.06,0.04), eyeGlow); eyeL.position.set(-0.11,0.06,0.18);
  const eyeR = m(box(0.06,0.06,0.04), eyeGlow); eyeR.position.set(0.11,0.06,0.18);
  head.add(skull,snout,upperJaw,lowerJaw,maw,hornL,hornR,eyeL,eyeR);
  g.add(head);

  g.userData.segs = segs;
  g.userData.head = head;
  g.userData.baseY = BASE_Y;
  g.userData.headBaseY = BASE_Y + 0.04;
  g.userData.anim = (g, now) => {
    const arr = g.userData.segs;
    const by = g.userData.baseY;
    for (let i=0;i<arr.length;i++){
      const s = arr[i];
      s.position.x = 0.18 * Math.sin(now/260 - s.userData.idx*0.7);
      s.position.y = by + 0.04 * Math.sin(now/300 - s.userData.idx*0.5);
    }
    const h = g.userData.head;
    h.position.x = 0.18 * Math.sin(now/260 + 0.5);
    h.position.y = g.userData.headBaseY + 0.04 * Math.sin(now/300 + 0.3);
    h.rotation.y = 0.25 * Math.cos(now/260 + 0.5);
  };
  return g;
}

export function buildProp_chest(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#caa24a';
  const open = !!(opts && opts.open);
  const wood = mat('#3a2a18');
  const woodDark = mat('#241a10');
  const iron = mat('#3a3f4a');
  const glow = matAdd(c, 0.95);
  const glowSoft = matAdd(c, 0.5);

  // base box (chest body)
  const base = m(box(0.66, 0.34, 0.46), wood); base.position.set(0, 0.17, 0);
  // iron banding on the body (two vertical straps)
  const bandL = m(box(0.06, 0.36, 0.48), iron); bandL.position.set(-0.2, 0.17, 0);
  const bandR = m(box(0.06, 0.36, 0.48), iron); bandR.position.set(0.2, 0.17, 0);
  // dark foot rail so it reads grounded
  const foot = m(box(0.7, 0.06, 0.5), woodDark); foot.position.set(0, 0.03, 0);
  g.add(base, bandL, bandR, foot);

  // hinged lid pivot group (hinge at back-top of body)
  const lid = new T.Group(); lid.position.set(0, 0.34, -0.23);
  const lidTop = m(box(0.66, 0.12, 0.46), wood); lidTop.position.set(0, 0.06, 0.23);
  const lidBandL = m(box(0.06, 0.14, 0.48), iron); lidBandL.position.set(-0.2, 0.06, 0.23);
  const lidBandR = m(box(0.06, 0.14, 0.48), iron); lidBandR.position.set(0.2, 0.06, 0.23);
  lid.add(lidTop, lidBandL, lidBandR);
  if (open) lid.rotation.x = -1.15; // tilt back
  g.add(lid);

  // glowing keyhole on the front face
  const lockPlate = m(box(0.14, 0.16, 0.04), iron); lockPlate.position.set(0, 0.2, 0.235);
  const keyhole = m(box(0.05, 0.08, 0.03), glow); keyhole.position.set(0, 0.2, 0.255);
  g.add(lockPlate, keyhole);

  if (open) {
    // bright loot glow spilling out of the open chest
    const spill = m(box(0.5, 0.3, 0.34), glow); spill.position.set(0, 0.42, 0.02);
    const sparkA = m(box(0.07, 0.07, 0.07), matAdd('#ffffff', 0.9)); sparkA.position.set(-0.12, 0.5, 0.05);
    const sparkB = m(box(0.06, 0.06, 0.06), glowSoft); sparkB.position.set(0.14, 0.56, -0.04);
    const beam = m(cone(0.22, 0.6, 6), glowSoft); beam.position.set(0, 0.62, 0);
    g.add(spill, sparkA, sparkB, beam);
    g.userData.anim = (gr, now) => {
      const f = 1 + Math.sin(now / 220) * 0.12;
      spill.scale.set(f, f, f);
      beam.scale.y = 1 + Math.sin(now / 300) * 0.18;
      sparkA.position.y = 0.5 + Math.sin(now / 260) * 0.05;
      sparkB.position.y = 0.56 + Math.sin(now / 200 + 1.5) * 0.05;
    };
  } else {
    g.userData.anim = (gr, now) => {
      // faint keyhole pulse when closed
      const f = 0.85 + Math.sin(now / 380) * 0.15;
      keyhole.scale.set(f, f, 1);
    };
  }
  return g;
}

export function buildProp_portal(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#9a4dff';
  const ringMat = matAdd(c, 0.85);
  const ringMat2 = matAdd(c, 0.55);
  const coreMat = matAdd('#ffffff', 0.6);
  const stoneMat = mat('#2a2434');

  // dark stone footing pillars so the portal reads as standing on the ground
  const baseL = m(box(0.16, 0.5, 0.16), stoneMat); baseL.position.set(-0.52, 0.25, 0);
  const baseR = m(box(0.16, 0.5, 0.16), stoneMat); baseR.position.set(0.52, 0.25, 0);
  g.add(baseL, baseR);

  // the swirling vortex stands vertical, facing +Z. Pivot group at center height.
  const vortex = new T.Group(); vortex.position.set(0, 0.85, 0);

  // outer glowing ring (torus in XY plane -> faces +Z)
  const ringGeo = geo('portalRingOuter', () => new T.TorusGeometry(0.6, 0.07, 6, 16));
  const ring = m(ringGeo, ringMat);
  vortex.add(ring);

  // inner ring, counter-spun
  const ringGeo2 = geo('portalRingInner', () => new T.TorusGeometry(0.42, 0.045, 6, 14));
  const ring2 = m(ringGeo2, ringMat2);
  vortex.add(ring2);

  // swirling spokes -> faceted vortex arms
  const arms = [];
  for (let i = 0; i < 5; i++) {
    const a = m(box(0.07, 0.5, 0.05), ringMat2);
    a.position.set(0, 0, 0.01);
    a.rotation.z = (i / 5) * Math.PI * 2;
    vortex.add(a);
    arms.push(a);
  }

  // bright core flat disc, facing +Z
  const core = m(cyl(0.26, 0.26, 0.04, 12), coreMat); core.rotation.x = Math.PI / 2;
  vortex.add(core);

  g.add(vortex);

  g.userData.anim = (gr, now) => {
    ring.rotation.z = now / 900;
    ring2.rotation.z = -now / 600;
    const p = 0.85 + Math.sin(now / 280) * 0.15;
    core.scale.set(p, p, p);
    for (let i = 0; i < arms.length; i++) {
      arms[i].rotation.z = (i / arms.length) * Math.PI * 2 + now / 500;
    }
  };
  return g;
}

export function buildProp_shrine(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#52e0c4';
  const stone = mat('#2c2a34');
  const stoneTop = mat('#3a3744');
  const runeMat = matAdd(c, 0.9);
  const runeSoft = matAdd(c, 0.45);

  // stepped stone base
  const base = m(box(0.62, 0.14, 0.62), stone); base.position.set(0, 0.07, 0);
  const mid = m(box(0.44, 0.14, 0.44), stone); mid.position.set(0, 0.21, 0);
  // tapered obelisk pillar
  const pillar = m(cyl(0.13, 0.2, 0.62, 6), stone); pillar.position.set(0, 0.59, 0);
  // capstone
  const cap = m(cone(0.2, 0.18, 6), stoneTop); cap.position.set(0, 0.99, 0);
  g.add(base, mid, pillar, cap);

  // faint glowing rune carved into the pillar front
  const carve = m(box(0.1, 0.22, 0.03), runeSoft); carve.position.set(0, 0.6, 0.19);
  g.add(carve);

  // floating glowing rune above the obelisk (faceted diamond + cross glints)
  const rune = new T.Group(); rune.position.set(0, 1.3, 0);
  const dGeo = geo('shrineRuneOcta', () => new T.OctahedronGeometry(0.16, 0));
  const diamond = m(dGeo, runeMat); rune.add(diamond);
  const glintH = m(box(0.34, 0.04, 0.04), runeSoft); rune.add(glintH);
  const glintV = m(box(0.04, 0.34, 0.04), runeSoft); rune.add(glintV);
  const halo = m(cyl(0.22, 0.22, 0.02, 12), runeSoft); halo.rotation.x = Math.PI / 2;
  rune.add(halo);
  g.add(rune);

  g.userData.anim = (gr, now) => {
    rune.position.y = 1.3 + Math.sin(now / 600) * 0.07;
    rune.rotation.y = now / 1100;
    const p = 0.9 + Math.sin(now / 320) * 0.12;
    diamond.scale.set(p, p, p);
    halo.scale.set(p, 1, p);
  };
  return g;
}

export function buildProp_fountain(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#6fb8ff';
  const stone = mat('#2e2c36');
  const stoneLip = mat('#403d4a');
  const waterMat = matAdd(c, 0.55);
  const plumeMat = matAdd(c, 0.8);
  const dropMat = matAdd('#ffffff', 0.6);

  // lower wide basin wall (bottom sits at y=0)
  const basin = m(cyl(0.62, 0.66, 0.22, 12), stone); basin.position.set(0, 0.11, 0);
  const lip = m(cyl(0.66, 0.62, 0.06, 12), stoneLip); lip.position.set(0, 0.24, 0);
  // glowing water surface in lower basin
  const water1 = m(cyl(0.56, 0.56, 0.04, 12), waterMat); water1.position.set(0, 0.2, 0);
  g.add(basin, lip, water1);

  // central pedestal
  const stem = m(cyl(0.14, 0.2, 0.34, 6), stone); stem.position.set(0, 0.41, 0);
  // upper tier basin
  const upper = m(cyl(0.3, 0.34, 0.12, 12), stone); upper.position.set(0, 0.62, 0);
  const upperLip = m(cyl(0.34, 0.3, 0.04, 12), stoneLip); upperLip.position.set(0, 0.69, 0);
  const water2 = m(cyl(0.27, 0.27, 0.03, 12), waterMat); water2.position.set(0, 0.67, 0);
  g.add(stem, upper, upperLip, water2);

  // glowing water plume rising from the top center
  const plume = m(cone(0.12, 0.55, 6), plumeMat); plume.position.set(0, 1.0, 0);
  const plumeCap = m(cyl(0.03, 0.1, 0.18, 6), plumeMat); plumeCap.position.set(0, 1.32, 0);
  // a couple of falling droplet glints
  const dropA = m(box(0.05, 0.05, 0.05), dropMat); dropA.position.set(0.16, 0.95, 0);
  const dropB = m(box(0.05, 0.05, 0.05), dropMat); dropB.position.set(-0.14, 0.88, 0.05);
  g.add(plume, plumeCap, dropA, dropB);

  g.userData.anim = (gr, now) => {
    const sh = 1 + Math.sin(now / 180) * 0.1;
    plume.scale.set(1, sh, 1);
    plume.position.y = 1.0 + (sh - 1) * 0.27;
    plumeCap.position.y = 1.32 + Math.sin(now / 180) * 0.05;
    // droplets fall and loop
    dropA.position.y = 1.0 - ((now / 600) % 1) * 0.45;
    dropB.position.y = 0.95 - (((now / 600) + 0.5) % 1) * 0.4;
    const w = 0.92 + Math.sin(now / 400) * 0.08;
    water1.scale.set(w, 1, w);
    water2.scale.set(w, 1, w);
  };
  return g;
}

export function buildItem_coin(opts) {
  const c = (opts && opts.color) || '#ffcf52';
  const g = new T.Group();
  // A leaning pile of dim gold under a brighter spinning coin.
  const goldDim = mat(c, 0.45);
  const pileA = m(cyl(0.13, 0.16, 0.06, 8), goldDim); pileA.position.set(0, 0.03, 0);
  const pileB = m(cyl(0.09, 0.12, 0.05, 8), goldDim); pileB.position.set(0.04, 0.075, -0.02);
  const pileC = m(cyl(0.06, 0.08, 0.04, 8), goldDim); pileC.position.set(-0.05, 0.06, 0.03);
  g.add(pileA, pileB, pileC);
  // The hero coin: a thin disc with flat faces toward +Z, warm and bright.
  const coin = new T.Group(); coin.position.set(0, 0.2, 0);
  const disc = m(cyl(0.12, 0.12, 0.03, 10), mat(c, 1.0));
  disc.rotation.x = Math.PI / 2; // flat faces point along +/-Z
  const face = m(cyl(0.085, 0.085, 0.034, 8), matAdd(c, 0.85));
  face.rotation.x = Math.PI / 2; // emissive inner ring, slightly proud of the disc
  // Bright rune glyph sitting ON the front face (disc half-thickness ~0.015).
  const rune = m(box(0.03, 0.09, 0.02), matAdd('#fff4cf', 0.9)); rune.position.set(0, 0, 0.018);
  coin.add(disc, face, rune);
  g.add(coin);
  g.userData.anim = (grp, now) => {
    const cn = grp.children[grp.children.length - 1]; // the coin sub-group
    cn.rotation.y = now / 320;
  };
  return g;
}

export function buildItem_gem(opts) {
  const c = (opts && opts.color) || '#7ad0ff';
  const g = new T.Group();
  // Floating faceted gem: a stretched octahedron via two stacked cones.
  const gem = new T.Group(); gem.position.set(0, 0.26, 0);
  const body = mat(c, 0.6);
  const upper = m(cone(0.14, 0.18, 4), body); upper.position.set(0, 0.07, 0); upper.rotation.y = Math.PI / 4;
  const lower = m(cone(0.14, 0.16, 4), body); lower.position.set(0, -0.06, 0); lower.rotation.y = Math.PI / 4; lower.rotation.x = Math.PI;
  // Bright inner core so the silhouette reads as glowing crystal.
  const coreU = m(cone(0.07, 0.1, 4), matAdd(c, 0.8)); coreU.position.set(0, 0.05, 0); coreU.rotation.y = Math.PI / 4;
  const coreL = m(cone(0.07, 0.09, 4), matAdd(c, 0.8)); coreL.position.set(0, -0.04, 0); coreL.rotation.y = Math.PI / 4; coreL.rotation.x = Math.PI;
  const glint = m(box(0.04, 0.04, 0.04), matAdd('#ffffff', 0.9)); glint.position.set(0.05, 0.02, 0.07);
  gem.add(upper, lower, coreU, coreL, glint);
  g.add(gem);
  g.userData.anim = (grp, now) => {
    const gm = grp.children[0];
    gm.rotation.y = now / 700;
    gm.position.y = 0.26 + Math.sin(now / 520) * 0.04;
  };
  return g;
}

export function buildItem_potion(opts) {
  const c = (opts && opts.color) || '#ff4d6d';
  const g = new T.Group();
  // Faceted glass flask: dim tinted shell over a bright liquid core.
  const glass = mat(c, 0.35);
  const belly = m(cyl(0.14, 0.11, 0.18, 7), glass); belly.position.set(0, 0.13, 0);
  const shoulder = m(cone(0.14, 0.1, 7), glass); shoulder.position.set(0, 0.27, 0);
  const neck = m(cyl(0.05, 0.06, 0.1, 6), glass); neck.position.set(0, 0.35, 0);
  // Glowing liquid filling the lower flask.
  const liquid = m(cyl(0.1, 0.085, 0.13, 7), matAdd(c, 0.85)); liquid.position.set(0, 0.11, 0);
  const bubble = m(box(0.03, 0.03, 0.03), matAdd('#ffffff', 0.7)); bubble.position.set(0.04, 0.16, 0.08);
  // Cork stopper, dim warm wood tone.
  const cork = m(cyl(0.055, 0.05, 0.07, 6), mat('#a6724a', 0.6)); cork.position.set(0, 0.43, 0);
  g.add(belly, shoulder, neck, liquid, bubble, cork);
  return g;
}

export function buildItem_gear(opts) {
  const c = (opts && opts.color) || '#b070ff';
  const g = new T.Group();
  // Soft aura ring resting on the ground (rarity-colored glow).
  const ring = m(geo('itemGearRing', () => new T.TorusGeometry(0.2, 0.02, 4, 14)), matAdd(c, 0.5));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.02, 0);
  g.add(ring);
  // Hovering faceted rune shard: a sharp diamond prism standing upright.
  const shard = new T.Group(); shard.position.set(0, 0.34, 0);
  const top = m(cone(0.1, 0.22, 4), mat(c, 0.6)); top.position.set(0, 0.08, 0); top.rotation.y = Math.PI / 4;
  const bot = m(cone(0.1, 0.14, 4), mat(c, 0.6)); bot.position.set(0, -0.06, 0); bot.rotation.y = Math.PI / 4; bot.rotation.x = Math.PI;
  const core = m(box(0.05, 0.2, 0.05), matAdd(c, 0.85)); core.rotation.y = Math.PI / 4;
  const spark = m(box(0.035, 0.035, 0.035), matAdd('#ffffff', 0.9)); spark.position.set(0, 0.05, 0.06);
  shard.add(top, bot, core, spark);
  g.add(shard);
  g.userData.anim = (grp, now) => {
    const rg = grp.children[0];
    const sh = grp.children[1];
    const pulse = 1 + Math.sin(now / 380) * 0.18;
    rg.scale.set(pulse, pulse, 1);
    sh.position.y = 0.34 + Math.sin(now / 600) * 0.05;
    sh.rotation.y = now / 900;
  };
  return g;
}

export function buildNpc(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#caa15a';
  const robe = mat(c, 0.5);
  const robeDark = mat(c, 0.32);
  const skin = mat('#b8946a', 0.85);

  // Robe skirt: a wide tapered base reading as cloth that pools at the feet.
  const skirt = m(cyl(0.2, 0.34, 0.62, 6), robeDark); skirt.position.set(0, 0.31, 0);
  // Torso: slim faceted prism, calm upright posture.
  const torso = m(box(0.34, 0.42, 0.26), robe); torso.position.set(0, 0.78, 0);
  // Shoulder cowl tapering up to the hood.
  const cowl = m(cone(0.26, 0.26, 6), robe); cowl.position.set(0, 1.02, 0);
  // Hood point.
  const hood = m(cone(0.17, 0.26, 6), robeDark); hood.position.set(0, 1.16, 0);
  // Hood opening: a warm lit face so the figure reads friendly, not a void.
  const face = m(box(0.16, 0.16, 0.06), skin); face.position.set(0, 1.0, 0.16);
  const hoodGlow = m(box(0.2, 0.2, 0.04), matAdd(c, 0.5)); hoodGlow.position.set(0, 1.0, 0.13);

  // Folded arms resting across the front: peaceful, non-combative read.
  const armL = m(box(0.12, 0.12, 0.3), robe); armL.position.set(-0.18, 0.82, 0.08); armL.rotation.x = 0.5;
  const armR = m(box(0.12, 0.12, 0.3), robe); armR.position.set(0.18, 0.82, 0.08); armR.rotation.x = 0.5;

  // A small warm lantern held at the side: clear, welcoming town signal.
  const handle = m(box(0.03, 0.18, 0.03), robeDark); handle.position.set(0.28, 0.62, 0.1);
  const lantern = m(box(0.13, 0.16, 0.13), mat(c, 0.6)); lantern.position.set(0.28, 0.5, 0.1);
  const flame = m(cone(0.05, 0.12, 5), matAdd('#ffe2a0', 0.9)); flame.position.set(0.28, 0.51, 0.1);
  const lanternGlow = m(box(0.18, 0.2, 0.18), matAdd(c, 0.4)); lanternGlow.position.set(0.28, 0.5, 0.1);

  g.add(skirt, torso, cowl, hood, face, hoodGlow, armL, armR, handle, lantern, lanternGlow, flame);

  g.userData.anim = function (g, now) {
    // Gentle breathing sway and a softly pulsing lantern.
    const s = Math.sin(now / 900);
    torso.rotation.z = s * 0.025;
    cowl.rotation.z = s * 0.03;
    hood.rotation.z = s * 0.03;
    const p = 0.9 + Math.sin(now / 320) * 0.12;
    flame.scale.set(1, p, 1);
    lanternGlow.scale.setScalar(p);
  };
  return g;
}

export function buildDecor(opts) {
  const c = (opts && opts.color) || '#ff7a2a';
  const g = new T.Group();
  const stone = mat('#3a3540', 0.9);
  const stoneLip = mat('#4a4450', 1);

  // Angular stepped stone base — gothic plinth.
  const base = m(box(0.5, 0.18, 0.5), stone); base.position.set(0, 0.09, 0);
  const step = m(box(0.38, 0.14, 0.38), stoneLip); step.position.set(0, 0.25, 0);
  // Tapered pedestal column.
  const column = m(cyl(0.1, 0.16, 0.5, 6), stone); column.position.set(0, 0.57, 0);
  // Faceted bowl that cradles the flame.
  const bowl = m(cyl(0.26, 0.12, 0.18, 6), stoneLip); bowl.position.set(0, 0.86, 0);
  // Rim accent lit by the fire below.
  const rim = m(cyl(0.27, 0.24, 0.05, 6), matAdd(c, 0.45)); rim.position.set(0, 0.93, 0);

  // Layered additive flame: core + outer tongue for a flickering gothic fire.
  const ember = m(box(0.22, 0.1, 0.22), matAdd(c, 0.55)); ember.position.set(0, 0.95, 0);
  const flame = m(cone(0.18, 0.4, 6), matAdd(c, 0.85)); flame.position.set(0, 1.18, 0);
  const flameInner = m(cone(0.1, 0.26, 5), matAdd('#ffe0a0', 0.95)); flameInner.position.set(0, 1.12, 0);
  // Soft glow halo around the fire.
  const glow = m(box(0.46, 0.5, 0.46), matAdd(c, 0.25)); glow.position.set(0, 1.12, 0);

  g.add(base, step, column, bowl, rim, ember, glow, flame, flameInner);

  g.userData.anim = function (g, now) {
    // Independent flicker on the two flame layers + breathing glow.
    const f1 = 0.85 + Math.sin(now / 130) * 0.18 + Math.sin(now / 47) * 0.06;
    const f2 = 0.9 + Math.sin(now / 90 + 1.7) * 0.2;
    flame.scale.set(1, f1, 1);
    flame.position.x = Math.sin(now / 200) * 0.02;
    flameInner.scale.set(1, f2, 1);
    flameInner.position.x = Math.sin(now / 160 + 0.6) * 0.025;
    glow.scale.setScalar(0.92 + Math.sin(now / 240) * 0.1);
    ember.scale.setScalar(0.95 + Math.sin(now / 110) * 0.08);
  };
  return g;
}

// expose the cache for the engine (warm-up / disposal if needed)
export const _cache = { GEO, MATS };
