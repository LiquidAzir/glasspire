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
  // chest-front mount for the tier armor kit (emblem / shoulder ornaments)
  const chestMount = new T.Object3D();
  chestMount.position.set(0, 0.72, 0.16);
  g.add(chestMount);
  // feet mount for the legendary / mythic aura
  const auraMount = new T.Object3D();
  auraMount.position.set(0, 0.02, 0);
  g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
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
// =============================================================
// GEAR LOOKS — attach to back/head mounts. opts.color = look color
// =============================================================
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

// =============================================================
// PROJECTILES + MINION (Stage 4) — projectiles point +Z (engine rotates to
// travel direction); opts.color = projectile/owner color.
// =============================================================
export function buildProjectile_arrow(opts) {
  const c = (opts && opts.color) || '#caa15a';
  const g = new T.Group();
  const shaft = m(box(0.045, 0.045, 0.5), mat(c, 0.85)); shaft.position.z = -0.05;
  const head = m(cone(0.07, 0.16, 4), matAdd(c, 0.9)); head.rotation.x = Math.PI / 2; head.position.z = 0.26;
  const fl1 = m(plane(0.12, 0.08), matAdd('#ffffff', 0.4)); fl1.position.z = -0.26; fl1.rotation.y = Math.PI / 2;
  g.add(shaft, head, fl1);
  return g;
}
export function buildProjectile_bolt(opts) {
  const c = (opts && opts.color) || '#9be8ff';
  const g = new T.Group();
  const dia = m(geo('boltDia', () => new T.OctahedronGeometry(0.14, 0)), matAdd(c, 0.95));
  const core = m(geo('boltCore', () => new T.IcosahedronGeometry(0.06, 0)), matAdd('#ffffff', 0.9));
  g.add(dia, core);
  g.userData.anim = (grp, now) => { dia.rotation.y = now / 100; dia.rotation.x = now / 140; };
  return g;
}
export function buildProjectile_bone(opts) {
  const c = (opts && opts.color) || '#e8e2cf';
  const g = new T.Group();
  const shaft = m(cyl(0.04, 0.04, 0.28, 5), mat(c, 0.85)); shaft.rotation.z = Math.PI / 2;
  const k1 = m(geo('boneKnob', () => new T.IcosahedronGeometry(0.07, 0)), mat(c, 0.9)); k1.position.x = -0.15;
  const k2 = m(geo('boneKnob', () => new T.IcosahedronGeometry(0.07, 0)), mat(c, 0.9)); k2.position.x = 0.15;
  g.add(shaft, k1, k2);
  g.userData.anim = (grp, now) => { grp.rotation.z = now / 80; };
  return g;
}
export function buildProjectile_soul(opts) {
  const c = (opts && opts.color) || '#c489ff';
  const g = new T.Group();
  const orb = m(geo('soulOrb', () => new T.IcosahedronGeometry(0.14, 0)), matAdd(c, 0.95));
  const core = m(geo('soulCore', () => new T.IcosahedronGeometry(0.06, 0)), matAdd('#ffffff', 0.85));
  const trail = m(cone(0.1, 0.34, 5), matAdd(c, 0.4)); trail.rotation.x = -Math.PI / 2; trail.position.z = -0.2;
  g.add(orb, core, trail);
  g.userData.anim = (grp, now) => { orb.scale.setScalar(1 + Math.sin(now / 120) * 0.12); };
  return g;
}

// raised-dead minion — a small ethereal spectral skeleton (additive, ghostly)
export function buildMinion(opts) {
  const c = (opts && opts.color) || '#c489ff';
  const g = new T.Group();
  const body = matAdd(c, 0.5);
  // unique (uncached) eye material — the anim mutates its opacity per-instance, so it
  // must NOT be the shared matAdd cache entry.
  const eye = new T.MeshBasicMaterial({ color: '#ff00ff', fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const ribs = m(box(0.22, 0.26, 0.16), body); ribs.position.y = 0.4;
  const legL = m(box(0.06, 0.24, 0.06), matAdd(c, 0.35)); legL.position.set(-0.07, 0.12, 0);
  const legR = m(box(0.06, 0.24, 0.06), matAdd(c, 0.35)); legR.position.set(0.07, 0.12, 0);
  const skull = m(geo('minSkull', () => new T.IcosahedronGeometry(0.13, 0)), body); skull.position.y = 0.66;
  const eyeL = m(box(0.04, 0.04, 0.03), eye); eyeL.position.set(-0.05, 0.67, 0.1);
  const eyeR = m(box(0.04, 0.04, 0.03), eye); eyeR.position.set(0.05, 0.67, 0.1);
  g.add(ribs, legL, legR, skull, eyeL, eyeR);
  g.userData.anim = (grp, now) => { eyeL.material.opacity = eyeR.material.opacity = 0.6 + 0.3 * Math.sin(now / 200); };
  return g;
}


// =============================================================
// GEAR MODELS (rarity+element driven) — weapons by type/tier/element,
// armor cosmetics, legendary/mythic auras + tier kit. Authored by workflow.
// =============================================================

export function buildWeapon_sword(opts) {
  const o = opts || {};
  const c = o.color || '#c8d0e0';
  const tier = o.tier | 0;
  const fx = o.fx || null;
  const prism = !!o.prismatic;
  const g = new T.Group();

  // tier-driven proportions: blade grows longer + wider with rarity
  const bw = 0.06 + tier * 0.012;            // blade width
  const bh = 0.62 + tier * 0.1;              // blade length
  const by = 0.12 + bh / 2;                  // blade centre (grip at origin, ~0.1 hilt stack below)
  const topY = 0.12 + bh;                    // blade tip-base (business end)

  // cached static materials (NEVER mutated)
  const steel = mat(c, 0.9 + tier * 0.04);
  const guard = mat(tier >= 2 ? '#b8a256' : '#8a8f9c', tier >= 2 ? 0.9 : 1); // ornate brass at t2+
  const gripMat = mat('#2a2018');

  // unique additive emissive parts (so prismatic can recolor them per-frame; these are NEVER cached)
  const mkGlow = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const glowParts = [];   // {mesh, base} collected for prismatic hue cycling
  const fxParts = [];     // animated fx pieces {mesh, kind, base, phase}
  function glow(mesh, op) { glowParts.push({ mesh, base: op }); return mesh; }

  // --- blade ---
  const blade = m(box(bw, bh, 0.02), steel); blade.position.y = by;
  g.add(blade);
  const tip = m(cone(bw * 0.85, 0.16 + tier * 0.02, 4), steel); tip.position.y = topY + 0.07;
  g.add(tip);

  // glowing centre fuller (t0 already gets a faint accent line)
  const fullerMat = mkGlow(c, 0.55 + tier * 0.08);
  const fuller = m(box(bw * 0.34, bh * 0.82, 0.025), fullerMat); fuller.position.y = by;
  g.add(fuller); glow(fuller, fullerMat.opacity);

  // t1+: a brighter accent edge line near the tip
  if (tier >= 1) {
    const accMat = mkGlow(c, 0.9);
    const acc = m(box(bw * 0.16, bh * 0.5, 0.03), accMat); acc.position.set(0, by + bh * 0.12, 0.012);
    g.add(acc); glow(acc, accMat.opacity);
  }

  // --- crossguard / fittings ---
  if (tier >= 2) {
    // ornate winged guard: a bar + two upswept quillon prongs + fittings
    const cross = m(box(0.34, 0.06, 0.07), guard); cross.position.y = 0.1;
    g.add(cross);
    const qL = m(cone(0.04, 0.16, 4), guard); qL.position.set(-0.17, 0.15, 0); qL.rotation.z = 0.7;
    const qR = m(cone(0.04, 0.16, 4), guard); qR.position.set(0.17, 0.15, 0); qR.rotation.z = -0.7;
    g.add(qL, qR);
    // centre gem set in the guard
    const gemMat = mkGlow(c, 0.95);
    const gem = m(geo('swGem', () => new T.OctahedronGeometry(0.05, 0)), gemMat); gem.position.set(0, 0.1, 0.06);
    g.add(gem); glow(gem, gemMat.opacity); fxParts.push({ mesh: gem, kind: 'gem', base: 0.05, phase: 0 });
  } else {
    const cross = m(box(0.28, 0.06, 0.06), guard); cross.position.y = 0.1;
    g.add(cross);
  }

  // --- grip + pommel ---
  const grip = m(box(0.05, 0.16, 0.05), gripMat); grip.position.y = 0;
  g.add(grip);
  const pommel = m(box(0.08, 0.08, 0.08), guard); pommel.position.y = -0.09;
  g.add(pommel);
  if (tier >= 3) {
    // legendary pommel jewel
    const pjMat = mkGlow(c, 0.95);
    const pj = m(geo('swPom', () => new T.OctahedronGeometry(0.045, 0)), pjMat); pj.position.y = -0.09;
    g.add(pj); glow(pj, pjMat.opacity);
  }

  // --- t3 LEGENDARY: glowing runes along the blade + ornamental side prongs ---
  if (tier >= 3) {
    const runeMat = mkGlow(c, 0.9);
    const nR = 3;
    for (let i = 0; i < nR; i++) {
      const r = m(box(bw * 0.5, 0.04, 0.028), runeMat);
      r.position.set(0, by - bh * 0.3 + i * (bh * 0.28), 0.013);
      g.add(r); glow(r, runeMat.opacity);
      fxParts.push({ mesh: r, kind: 'rune', base: runeMat.opacity, phase: i * 1.3 });
    }
    // ornamental prongs flanking the lower blade (elaborate silhouette)
    const prL = m(cone(0.035, 0.2, 4), guard); prL.position.set(-bw * 0.5 - 0.05, by - bh * 0.28, 0); prL.rotation.z = 0.35;
    const prR = m(cone(0.035, 0.2, 4), guard); prR.position.set(bw * 0.5 + 0.05, by - bh * 0.28, 0); prR.rotation.z = -0.35;
    g.add(prL, prR);
  }

  // --- ELEMENTAL FX at the business end (upper blade / tip) ---
  const fxY = topY - 0.04;
  const fxScale = tier >= 3 ? 1.35 : (tier >= 1 ? 1.0 : 0.0); // FX prominent at legendary; subtle below; none at t0
  if (fx && fxScale > 0) {
    if (fx === 'fire') {
      const cols = ['#ff6a1a', '#ffb648', '#ff3010'];
      for (let i = 0; i < 3; i++) {
        const fm = mkGlow(cols[i], 0.8);
        const fl = m(cone(0.05 * fxScale, (0.18 + i * 0.05) * fxScale, 4), fm);
        fl.position.set((i - 1) * 0.04, fxY + i * 0.04, 0);
        g.add(fl); glow(fl, fm.opacity);
        fxParts.push({ mesh: fl, kind: 'fire', base: (0.18 + i * 0.05) * fxScale, phase: i * 2.1 });
      }
    } else if (fx === 'ice') {
      for (let i = 0; i < 4; i++) {
        const im = mkGlow('#bfeaff', 0.7); // one unique material per crystal so opacity anim never touches a shared mat
        const a = (i / 4) * Math.PI * 2;
        const cr = m(cone(0.03 * fxScale, (0.14 + (i % 2) * 0.06) * fxScale, 3), im);
        cr.position.set(Math.cos(a) * 0.05, fxY - 0.02 + Math.sin(a) * 0.03, Math.sin(a) * 0.03);
        cr.rotation.set(0.5, a, Math.cos(a) * 0.5);
        g.add(cr); glow(cr, im.opacity);
        fxParts.push({ mesh: cr, kind: 'ice', base: im.opacity, phase: i * 1.1 });
      }
    } else if (fx === 'void') {
      for (let i = 0; i < 2; i++) {
        const vm = mkGlow('#6a18c8', 0.7);
        const orb = m(geo('swVoid', () => new T.IcosahedronGeometry(0.07, 0)), vm);
        orb.position.set((i ? 0.05 : -0.05), fxY + i * 0.08, 0);
        g.add(orb); glow(orb, vm.opacity);
        fxParts.push({ mesh: orb, kind: 'void', base: 0.07 * fxScale, phase: i * 3.1 });
        orb.scale.setScalar(fxScale);
      }
      const warpMat = mkGlow('#2a0840', 0.45);
      const warp = m(geo('swWarp', () => new T.OctahedronGeometry(0.13, 0)), warpMat); warp.position.y = fxY + 0.04; warp.scale.setScalar(fxScale);
      g.add(warp); glow(warp, warpMat.opacity);
      fxParts.push({ mesh: warp, kind: 'void', base: 0.13 * fxScale, phase: 1.5 });
    } else if (fx === 'spark') {
      for (let i = 0; i < 4; i++) {
        const sm = mkGlow('#a8e0ff', 0.95);
        const bit = m(box(0.02 * fxScale, 0.07 * fxScale, 0.02 * fxScale), sm);
        bit.position.set((i % 2 ? 0.05 : -0.05), fxY + (i * 0.05 - 0.05), 0);
        bit.rotation.z = (i % 2 ? 0.6 : -0.6);
        g.add(bit); glow(bit, sm.opacity);
        fxParts.push({ mesh: bit, kind: 'spark', base: 0, phase: i * 1.7, bx: bit.position.x, by: bit.position.y });
      }
    } else if (fx === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const km = mkGlow('#9aa0b0', 0.28);
        const pf = m(geo('swSmoke', () => new T.IcosahedronGeometry(0.08, 0)), km);
        pf.position.set((i - 1) * 0.03, fxY + i * 0.07, 0); pf.scale.setScalar(fxScale * (1 + i * 0.2));
        g.add(pf); glow(pf, km.opacity);
        fxParts.push({ mesh: pf, kind: 'smoke', base: fxY + i * 0.07, phase: i * 2.0 });
      }
    } else if (fx === 'wisp') {
      for (let i = 0; i < 3; i++) {
        const wm = mkGlow(c, 0.9);
        const mote = m(geo('swMote', () => new T.IcosahedronGeometry(0.035, 0)), wm);
        g.add(mote); glow(mote, wm.opacity);
        fxParts.push({ mesh: mote, kind: 'wisp', base: fxY, phase: (i / 3) * Math.PI * 2, rad: 0.1 * fxScale });
      }
    }
  }

  // --- t4 MYTHIC extra drama: orbiting shards + intense core glint ---
  if (tier >= 4) {
    for (let i = 0; i < 3; i++) {
      const sm = mkGlow(c, 0.85);
      const shard = m(geo('swShard', () => new T.OctahedronGeometry(0.04, 0)), sm);
      g.add(shard); glow(shard, sm.opacity);
      fxParts.push({ mesh: shard, kind: 'shard', base: by + bh * 0.2, phase: (i / 3) * Math.PI * 2, rad: bw + 0.1 });
    }
    const coreMat = mkGlow('#ffffff', 0.95);
    const core = m(geo('swCore', () => new T.IcosahedronGeometry(0.05, 0)), coreMat); core.position.y = by;
    g.add(core); glow(core, coreMat.opacity);
    fxParts.push({ mesh: core, kind: 'core', base: 0.05, phase: 0 });
  }

  g.rotation.z = -0.25;

  // --- animation: fx motion + (mythic) prismatic rainbow cycling ---
  if (fxParts.length || prism) {
    const col = new T.Color();
    g.userData.anim = (grp, now) => {
      const t = now / 1000;
      // prismatic: cycle every collected UNIQUE glow material through the rainbow
      if (prism && glowParts.length) {
        const hue = (now / 2600) % 1;
        for (let i = 0; i < glowParts.length; i++) {
          col.setHSL((hue + i * 0.06) % 1, 0.85, 0.6);
          glowParts[i].mesh.material.color.copy(col);
        }
      }
      for (let i = 0; i < fxParts.length; i++) {
        const p = fxParts[i], s = Math.sin(t * 6 + p.phase);
        switch (p.kind) {
          case 'fire':
            p.mesh.scale.y = 0.7 + (s * 0.5 + 0.5) * 0.9;
            p.mesh.scale.x = p.mesh.scale.z = 0.85 + s * 0.15;
            break;
          case 'ice':
            p.mesh.material.opacity = p.base * (0.6 + (Math.sin(t * 2 + p.phase) * 0.5 + 0.5) * 0.7);
            break;
          case 'void':
            p.mesh.scale.setScalar((fxScale || 1) * (0.85 + (Math.sin(t * 3 + p.phase) * 0.5 + 0.5) * 0.4));
            break;
          case 'spark':
            p.mesh.position.x = p.bx + Math.sin(t * 30 + p.phase) * 0.015;
            p.mesh.position.y = p.by + Math.cos(t * 24 + p.phase) * 0.015;
            p.mesh.material.opacity = 0.4 + (Math.sin(t * 18 + p.phase) * 0.5 + 0.5) * 0.6;
            break;
          case 'smoke': {
            const u = (t * 0.4 + p.phase) % 1;
            p.mesh.position.y = p.base + u * 0.16;
            p.mesh.material.opacity = 0.28 * (1 - u);
            break;
          }
          case 'wisp': {
            const a = t * 2 + p.phase;
            p.mesh.position.set(Math.cos(a) * p.rad, p.base + Math.sin(a * 1.5) * 0.04, Math.sin(a) * p.rad);
            break;
          }
          case 'rune':
            p.mesh.material.opacity = p.base * (0.55 + (Math.sin(t * 2.5 + p.phase) * 0.5 + 0.5) * 0.45);
            break;
          case 'gem':
            p.mesh.rotation.y = t * 1.5;
            p.mesh.scale.setScalar(1 + s * 0.12);
            break;
          case 'shard': {
            const a = t * 2.2 + p.phase;
            p.mesh.position.set(Math.cos(a) * p.rad, p.base + Math.sin(a * 1.3) * 0.06, Math.sin(a) * p.rad);
            p.mesh.rotation.set(a, a * 0.7, 0);
            break;
          }
          case 'core':
            p.mesh.scale.setScalar(1 + (Math.sin(t * 5) * 0.5 + 0.5) * 0.5);
            break;
        }
      }
    };
  }

  return g;
}

export function buildWeapon_staff(opts){
  const o = opts || {};
  const c = o.color || '#9be8ff';
  const tier = o.tier | 0;
  const fx = o.fx || null;
  const prismatic = !!o.prismatic;
  const g = new T.Group();

  // --- dimensions grow with legendary tier ---
  const tall = tier >= 3;
  const shaftLen = tall ? 1.12 : 0.95;
  const focusY = tall ? 1.20 : 1.0;      // top focus height
  const shaftR = tall ? 0.055 : 0.045;

  // cached static woods/metals (NEVER mutated)
  const wood = mat('#3a2e22');
  const woodDark = mat('#241a12');
  const metal = mat('#8a8f9c');
  const metalDk = mat('#4a4f5c');

  // collect UNIQUE (per-frame mutated) glow materials for the prismatic cycle
  const live = [];          // { mat, off }
  // make a UNIQUE additive glow material (safe to mutate per frame)
  function glowMat(hex, opacity, joinPrism){
    const mm = new T.MeshBasicMaterial({ color: hex, fog:false, transparent:true, opacity: opacity==null?1:opacity, blending:T.AdditiveBlending, depthWrite:false });
    if (joinPrism && prismatic) live.push({ mat: mm, off: live.length * 0.6 });
    return mm;
  }

  // --- shaft (up +Y, grip at origin) ---
  const shaft = m(cyl(shaftR, shaftR + 0.012, shaftLen, 6), wood);
  shaft.position.y = shaftLen * 0.5 - 0.02;
  g.add(shaft);
  // grip wrap near the hand
  const wrap = m(cyl(shaftR + 0.014, shaftR + 0.014, 0.16, 6), woodDark);
  wrap.position.y = 0.06;
  g.add(wrap);
  // butt cap / spike at the very bottom
  const butt = m(cone(shaftR + 0.02, 0.1, 5), metalDk); butt.position.y = -0.06; butt.rotation.x = Math.PI;
  g.add(butt);

  // --- t1+: a glowing accent line running up the shaft ---
  if (tier >= 1){
    const line = m(box(0.014, shaftLen * 0.74, 0.014), glowMat(c, 0.9, true));
    line.position.set(0, shaftLen * 0.5 - 0.02, shaftR + 0.012);
    g.add(line);
  }

  // --- t2+: ornate collar fittings below the focus + a small gem ---
  if (tier >= 2){
    const collar = m(cyl(shaftR + 0.05, shaftR + 0.03, 0.08, 6), metal);
    collar.position.y = focusY - (tall ? 0.34 : 0.26);
    g.add(collar);
    const collar2 = m(cyl(shaftR + 0.034, shaftR + 0.05, 0.06, 6), metalDk);
    collar2.position.y = focusY - (tall ? 0.44 : 0.34);
    g.add(collar2);
    // small inset gem on the collar
    const gem = m(geo('staffGem', () => new T.OctahedronGeometry(0.05, 0)), glowMat(c, 1, true));
    gem.position.set(0, focusY - (tall ? 0.34 : 0.26), shaftR + 0.07);
    g.add(gem);
  }

  // --- top focus: orb (all tiers) growing into a crystal cage at legendary ---
  const orbMat = glowMat(c, 0.95, true);
  const orb = m(geo('staffOrb', () => new T.IcosahedronGeometry(0.13, 0)), orbMat);
  orb.position.y = focusY;
  if (tall) orb.scale.setScalar(1.18);
  g.add(orb);
  // intense inner core at higher tiers
  let core = null;
  if (tier >= 3){
    core = m(geo('staffCore', () => new T.IcosahedronGeometry(0.06, 0)), glowMat('#ffffff', 0.95, false));
    core.position.y = focusY;
    g.add(core);
  }

  // claw/cage holding the orb. t<3 = a simple cone cradle; t>=3 = ornamental prongs.
  const cageProngs = [];
  if (tall){
    const ring = m(cyl(0.15, 0.17, 0.05, 6), metal); ring.position.y = focusY - 0.16; g.add(ring);
    for (let i = 0; i < 4; i++){
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const prong = m(cone(0.028, 0.34, 4), metal);
      prong.position.set(Math.cos(a) * 0.15, focusY + 0.02, Math.sin(a) * 0.15);
      // bend the prongs inward to cradle the orb
      prong.rotation.z = -Math.cos(a) * 0.55;
      prong.rotation.x = Math.sin(a) * 0.55;
      g.add(prong); cageProngs.push(prong);
    }
  } else {
    const cradle = m(cone(0.14, 0.22, 4), mat(c, 0.6)); cradle.position.y = focusY - 0.04;
    g.add(cradle);
  }

  // --- t3+: glowing runes along the shaft ---
  const runes = [];
  if (tier >= 3){
    for (let i = 0; i < 3; i++){
      const r = m(box(0.03, 0.03, 0.012), glowMat(c, 0.85, true));
      r.position.set(0, 0.32 + i * 0.22, shaftR + 0.016);
      g.add(r); runes.push(r);
    }
  }

  // ============================================================
  // ELEMENTAL FX — attached around the TOP focus (business end)
  // ============================================================
  const fxParts = [];
  const fxScale = tier >= 3 ? 1.35 : 1;   // prominent at legendary
  const fxBase = [];                       // remember authored positions for cheap anim
  if (fx){
    if (fx === 'fire'){
      for (let i = 0; i < 4; i++){
        const a = (i / 4) * Math.PI * 2;
        const tongue = m(cone(0.05 * fxScale, 0.22 * fxScale, 4), glowMat(i & 1 ? '#ff7a1a' : '#ffd24a', 0.85, false));
        tongue.position.set(Math.cos(a) * 0.1, focusY + 0.14, Math.sin(a) * 0.1);
        g.add(tongue); fxParts.push(tongue); fxBase.push(tongue.position.y);
      }
    } else if (fx === 'ice'){
      for (let i = 0; i < 5; i++){
        const a = (i / 5) * Math.PI * 2;
        const cr = m(cone(0.035 * fxScale, 0.24 * fxScale, 4), glowMat('#bff0ff', 0.7, false));
        cr.position.set(Math.cos(a) * 0.15, focusY + 0.02, Math.sin(a) * 0.15);
        cr.rotation.z = -Math.cos(a) * 0.7; cr.rotation.x = Math.sin(a) * 0.7;
        g.add(cr); fxParts.push(cr);
      }
    } else if (fx === 'void'){
      for (let i = 0; i < 3; i++){
        const a = (i / 3) * Math.PI * 2;
        const orbv = m(geo('staffVoidOrb', () => new T.IcosahedronGeometry(0.07, 0)), glowMat('#6a1ea8', 0.8, false));
        orbv.position.set(Math.cos(a) * 0.2, focusY + 0.04, Math.sin(a) * 0.2);
        g.add(orbv); fxParts.push(orbv);
      }
    } else if (fx === 'spark'){
      for (let i = 0; i < 5; i++){
        const a = (i / 5) * Math.PI * 2;
        const bit = m(box(0.02, 0.12 * fxScale, 0.02), glowMat('#cdf0ff', 0.9, false));
        bit.position.set(Math.cos(a) * 0.16, focusY + 0.1, Math.sin(a) * 0.16);
        bit.rotation.z = Math.cos(a) * 0.8;
        g.add(bit); fxParts.push(bit); fxBase.push(a);
      }
    } else if (fx === 'smoke'){
      for (let i = 0; i < 3; i++){
        const w = m(geo('staffSmoke', () => new T.IcosahedronGeometry(0.1, 0)), glowMat(c, 0.16, false));
        w.position.set((i - 1) * 0.06, focusY + 0.12 + i * 0.08, 0);
        w.scale.set(1, 0.7, 1);
        g.add(w); fxParts.push(w); fxBase.push(focusY + 0.12 + i * 0.08);
      }
    } else if (fx === 'wisp'){
      for (let i = 0; i < 4; i++){
        const a0 = (i / 4) * Math.PI * 2;
        const mote = m(geo('staffWisp', () => new T.IcosahedronGeometry(0.035, 0)), glowMat(i & 1 ? c : '#ffffff', 0.9, false));
        // initial orbit position so it reads on a static frame
        mote.position.set(Math.cos(a0) * 0.18, focusY, Math.sin(a0) * 0.18);
        g.add(mote); fxParts.push(mote); fxBase.push(a0);
      }
    }
  }

  // --- t4 mythic: orbiting shards around the focus ---
  const shards = [];
  if (tier >= 4){
    for (let i = 0; i < 3; i++){
      const sh = m(cone(0.04, 0.16, 3), glowMat(c, 0.85, true));
      const a0 = (i / 3) * Math.PI * 2;
      // initial orbit position so it reads on a static frame
      sh.position.set(Math.cos(a0) * 0.26, focusY, Math.sin(a0) * 0.26);
      sh.rotation.z = a0;
      g.add(sh); shards.push(sh);
    }
  }

  // slight gothic lean so it reads as a held staff
  g.rotation.z = -0.06;

  // private scratch Color — allocated ONCE here (not per frame) for the prismatic cycle
  const tmpC = new T.Color();

  // ============================================================
  // ANIMATION — cheap sin, mutate children only, no allocation
  // ============================================================
  g.userData.anim = (grp, now) => {
    const t = now;
    // breathing orb focus
    orb.scale.setScalar((tall ? 1.18 : 1) * (1 + Math.sin(t / 220) * 0.12));
    if (core) core.scale.setScalar(1 + Math.sin(t / 160) * 0.35);

    // prismatic hue cycle on every UNIQUE glow material
    if (prismatic){
      const h = (t / 2600) % 1;
      for (let i = 0; i < live.length; i++){
        const L = live[i];
        tmpC.setHSL((h + L.off) % 1, 0.85, 0.6);
        L.mat.color.copy(tmpC);
      }
    }

    // rune flicker
    for (let i = 0; i < runes.length; i++){
      runes[i].material.opacity = 0.55 + (Math.sin(t / 300 + i) * 0.5 + 0.5) * 0.4;
    }

    // elemental motion
    if (fx === 'fire'){
      for (let i = 0; i < fxParts.length; i++){
        const s = 1 + Math.sin(t / 90 + i * 1.3) * 0.35;
        fxParts[i].scale.set(1, s, 1);
        fxParts[i].position.y = (fxBase[i] || focusY + 0.14) + Math.sin(t / 110 + i) * 0.02;
      }
    } else if (fx === 'ice'){
      for (let i = 0; i < fxParts.length; i++) fxParts[i].material.opacity = 0.5 + (Math.sin(t / 400 + i) * 0.5 + 0.5) * 0.4;
    } else if (fx === 'void'){
      const rot = t / 600;
      for (let i = 0; i < fxParts.length; i++){
        const a = (i / fxParts.length) * Math.PI * 2 + rot;
        fxParts[i].position.set(Math.cos(a) * 0.2, focusY + 0.04 + Math.sin(t / 300 + i) * 0.03, Math.sin(a) * 0.2);
        fxParts[i].scale.setScalar(1 + Math.sin(t / 250 + i) * 0.22);
      }
    } else if (fx === 'spark'){
      for (let i = 0; i < fxParts.length; i++){
        const a = fxBase[i];
        const j = Math.sin(t / 40 + i * 2.1) * 0.04;
        fxParts[i].position.set(Math.cos(a) * (0.16 + j), focusY + 0.1 + Math.sin(t / 55 + i) * 0.03, Math.sin(a) * (0.16 + j));
        fxParts[i].material.opacity = 0.4 + (Math.sin(t / 30 + i * 3) * 0.5 + 0.5) * 0.6;
      }
    } else if (fx === 'smoke'){
      for (let i = 0; i < fxParts.length; i++){
        const base = fxBase[i];
        fxParts[i].position.y = base + Math.sin(t / 800 + i) * 0.04;
        fxParts[i].position.x = (i - 1) * 0.06 + Math.sin(t / 700 + i) * 0.03;
      }
    } else if (fx === 'wisp'){
      for (let i = 0; i < fxParts.length; i++){
        const a = fxBase[i] + t / 700;
        const rr = 0.18 + Math.sin(t / 500 + i) * 0.03;
        fxParts[i].position.set(Math.cos(a) * rr, focusY + Math.sin(t / 400 + i * 1.7) * 0.1, Math.sin(a) * rr);
      }
    }

    // mythic orbiting shards
    for (let i = 0; i < shards.length; i++){
      const a = (i / shards.length) * Math.PI * 2 + t / 500;
      shards[i].position.set(Math.cos(a) * 0.26, focusY + Math.sin(t / 360 + i) * 0.06, Math.sin(a) * 0.26);
      shards[i].rotation.z = a;
    }
  };
  return g;
}

export function buildWeapon_bow(opts) {
  // A gothic recurve bow gripped at center, limbs in the Y-Z plane (business
  // end = the firing line / arrow rest at front +Z). Authored pointing +Y so
  // the limbs sweep up (+Y) and down (-Y) from the riser at the origin.
  const c = (opts && opts.color) || '#caa15a';
  const tier = (opts && opts.tier) | 0;
  const fx = (opts && opts.fx) || null;
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // cached static materials (NEVER mutated)
  const wood = mat('#2a2018');
  const limbMat = mat(c, 0.8);
  const fitMat = mat('#8a8f9c');
  const accent = matAdd(c, 0.85);
  const rune = matAdd(c, 0.95);

  // unique materials ONLY for things the anim mutates (prismatic shimmer / pulsing FX).
  // Collected so the prismatic cycle can drive them all from one hue.
  const shimmer = [];
  function uniGlow(hex, opacity) {
    const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
    shimmer.push(mm);
    return mm;
  }

  // ---- silhouette scale: legendary+ bows are noticeably longer & wider ----
  const big = tier >= 3;
  const span = big ? 0.5 : 0.42;   // limb reach along +/-Y
  const tube = big ? 0.045 : 0.035;

  // ---- LIMBS: two curved arcs (upper +Y, lower -Y) meeting at the riser ----
  // A torus arc bent so its bow belly faces +Z (toward the firing line).
  const arcGeoKey = `bowArc${big ? 'L' : 'S'}`;
  const arcGeo = geo(arcGeoKey, () => new T.TorusGeometry(span, tube, 4, 9, Math.PI * 0.92));
  const upper = m(arcGeo, limbMat);
  upper.rotation.z = Math.PI / 2 - Math.PI * 0.46; // sweep starts at grip, curves up & forward
  upper.position.y = span * 0.5;
  const lower = m(arcGeo, limbMat);
  lower.rotation.z = -(Math.PI / 2 - Math.PI * 0.46);
  lower.rotation.x = Math.PI; // mirror downward
  lower.position.y = -span * 0.5;

  // recurve tips (legendary+): little out-flicked prongs at each limb end
  const nockY = span * 0.96;
  if (tier >= 3) {
    const tipU = m(cone(tube * 1.6, 0.12, 4), fitMat); tipU.position.set(0, nockY, 0.05); tipU.rotation.x = -0.5;
    const tipL = m(cone(tube * 1.6, 0.12, 4), fitMat); tipL.position.set(0, -nockY, 0.05); tipL.rotation.x = Math.PI + 0.5;
    g.add(tipU, tipL);
  }

  // ---- RISER / GRIP at the origin (the hand) ----
  const grip = m(box(0.06, 0.22, 0.07), wood); grip.position.y = 0;
  const riser = m(box(0.05, 0.3, 0.05), mat(c, 0.45)); riser.position.set(0, 0, -0.01);
  g.add(grip, riser, upper, lower);

  // ---- STRING: faint additive line between the two nocks (slightly behind, -Z) ----
  const strH = nockY * 2;
  const strMat = prismatic ? uniGlow(c, 0.4) : matAdd('#ffffff', 0.35);
  const string = m(box(0.01, strH, 0.01), strMat); string.position.set(0, 0, -0.04);
  g.add(string);
  // arrow rest marker at the grip front — the business end where FX anchors
  const restZ = 0.06;

  // ============ TIER LADDER (cumulative) ============
  // t1+: a glowing accent line running along the back of each limb
  if (tier >= 1) {
    const aMat = prismatic ? uniGlow(c, 0.8) : accent;
    const accGeo = geo(arcGeoKey + 'acc', () => new T.TorusGeometry(span, tube * 0.4, 4, 9, Math.PI * 0.92));
    const au = m(accGeo, aMat); au.rotation.copy(upper.rotation); au.position.copy(upper.position); au.position.z -= 0.015;
    const al = m(accGeo, aMat); al.rotation.copy(lower.rotation); al.position.copy(lower.position); al.position.z -= 0.015;
    g.add(au, al);
  }
  // t2+: ornate nock fittings on both limb ends + a small gem at the riser
  if (tier >= 2) {
    const fU = m(box(0.05, 0.06, 0.06), fitMat); fU.position.set(0, nockY, 0.02);
    const fL = m(box(0.05, 0.06, 0.06), fitMat); fL.position.set(0, -nockY, 0.02);
    const gemMat = prismatic ? uniGlow(c, 1) : matAdd(c, 1);
    const gem = m(geo('bowGem', () => new T.OctahedronGeometry(0.05, 0)), gemMat); gem.position.set(0, 0, restZ);
    g.add(fU, fL, gem);
    if (!prismatic) g.userData._gem = gem; // breathe at t2/t3 (scale only — material untouched)
  }
  // t3 LEGENDARY: glowing runes spaced along the limbs + strong emissive core glow
  if (tier >= 3) {
    const rMat = prismatic ? uniGlow(c, 0.95) : rune;
    for (let i = 0; i < 6; i++) {
      const up = i < 3;
      const t = (i % 3 + 1) / 3.6;           // 0..~0.83 along the limb
      const ry = (up ? 1 : -1) * span * t;
      const rz = 0.02 + Math.sin(t * Math.PI) * span * 0.42; // follow the belly curve outward
      const r = m(box(0.03, 0.03, 0.012), rMat); r.position.set(0, ry, rz);
      g.add(r);
    }
    // bright emissive core behind the grip
    const coreMat = prismatic ? uniGlow(c, 0.6) : matAdd(c, 0.55);
    const core = m(box(0.1, 0.34, 0.05), coreMat); core.position.set(0, 0, -0.02);
    g.add(core);
  }
  // t4 MYTHIC: orbiting shards around the riser + an intense core gem
  const shards = [];
  if (tier >= 4) {
    const coreMat = uniGlow('#ffffff', 0.95);
    const mcore = m(geo('bowMcore', () => new T.IcosahedronGeometry(0.07, 0)), coreMat); mcore.position.set(0, 0, restZ);
    g.add(mcore);
    g.userData._mcore = mcore;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sMat = uniGlow(c, 0.8);
      const sh = m(geo('bowShard', () => new T.OctahedronGeometry(0.045, 0)), sMat);
      sh.userData.a = a; sh.userData.r = 0.16;
      sh.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, restZ);
      shards.push(sh); g.add(sh);
    }
  }

  // ============ ELEMENTAL FX — anchored at the arrow rest / along the bow ============
  // FX anims mutate scale/position/rotation only, so cached matAdd is safe here.
  const fxParts = [];
  if (fx === 'fire') {
    // flickering warm flame tongues licking up off the arrow rest
    const f1 = m(cone(0.06, 0.22, 5), matAdd(c, 0.85)); f1.position.set(0, 0.06, restZ);
    const f2 = m(cone(0.035, 0.15, 4), matAdd('#ffe0a0', 0.95)); f2.position.set(0, 0.05, restZ + 0.01);
    g.add(f1, f2); fxParts.push({ k: 'fire', a: f1, b: f2 });
  } else if (fx === 'ice') {
    // jagged frost crystals clustered at the rest, faint cold shimmer
    const i1 = m(cone(0.04, 0.18, 4), matAdd(c, 0.6)); i1.position.set(0.04, 0.04, restZ); i1.rotation.z = -0.4;
    const i2 = m(cone(0.035, 0.14, 4), matAdd('#cdebff', 0.7)); i2.position.set(-0.03, 0.07, restZ); i2.rotation.z = 0.5;
    const i3 = m(cone(0.03, 0.1, 4), matAdd(c, 0.5)); i3.position.set(0.01, -0.02, restZ + 0.01);
    g.add(i1, i2, i3); fxParts.push({ k: 'ice', a: i1, b: i2, c: i3 });
  } else if (fx === 'void') {
    // dark-purple energy orbs pulsing/warping at the rest
    const v1 = m(geo('bowVoid', () => new T.IcosahedronGeometry(0.08, 0)), matAdd(c, 0.7)); v1.position.set(0, 0.04, restZ + 0.02);
    const v2 = m(geo('bowVoidC', () => new T.IcosahedronGeometry(0.035, 0)), matAdd('#1a0030', 0.9)); v2.position.set(0, 0.04, restZ + 0.04);
    g.add(v1, v2); fxParts.push({ k: 'void', a: v1, b: v2 });
  } else if (fx === 'spark') {
    // small crackling lightning bits jittering along the upper limb + rest
    const sp = [];
    for (let i = 0; i < 4; i++) {
      const b = m(box(0.018, 0.06, 0.018), matAdd('#eaf4ff', 0.9));
      b.position.set(0, (i - 1.5) * 0.12, restZ); b.userData.ph = i * 1.7;
      g.add(b); sp.push(b);
    }
    fxParts.push({ k: 'spark', list: sp });
  } else if (fx === 'smoke') {
    // wispy drifting trails, low opacity, slow drift off the rest
    const s1 = m(plane(0.14, 0.2), matAdd(c, 0.18)); s1.position.set(0, 0.1, restZ);
    const s2 = m(plane(0.1, 0.16), matAdd(c, 0.12)); s2.position.set(0.02, 0.2, restZ);
    g.add(s1, s2); fxParts.push({ k: 'smoke', a: s1, b: s2 });
  } else if (fx === 'wisp') {
    // floating motes orbiting the arrow rest
    const w = [];
    for (let i = 0; i < 3; i++) {
      const mo = m(geo('bowWisp', () => new T.OctahedronGeometry(0.025, 0)), matAdd(c, 0.85));
      mo.userData.a = (i / 3) * Math.PI * 2; mo.userData.r = 0.1;
      mo.position.set(Math.cos(mo.userData.a) * 0.1, 0.05 + Math.sin(mo.userData.a) * 0.1, restZ);
      g.add(mo); w.push(mo);
    }
    fxParts.push({ k: 'wisp', list: w });
  }

  // ---- ANIM: FX motion + tier glow + prismatic rainbow on UNIQUE mats only ----
  const hasAnim = fxParts.length || shimmer.length || g.userData._gem || g.userData._mcore || shards.length;
  if (hasAnim) {
    const gemRef = g.userData._gem, mcoreRef = g.userData._mcore;
    g.userData.anim = (grp, now) => {
      // prismatic: cycle every unique material through the rainbow together
      if (prismatic && shimmer.length) {
        const hue = (now / 2600) % 1;
        for (let i = 0; i < shimmer.length; i++) {
          shimmer[i].color.setHSL((hue + i * 0.06) % 1, 0.85, 0.6);
        }
      }
      // tier gem breathe / mythic core pulse (scale only)
      if (gemRef) gemRef.scale.setScalar(1 + Math.sin(now / 300) * 0.18);
      if (mcoreRef) mcoreRef.scale.setScalar(1 + Math.sin(now / 180) * 0.35);
      // mythic orbiting shards
      for (let i = 0; i < shards.length; i++) {
        const a = shards[i].userData.a + now / 700;
        const r = shards[i].userData.r;
        shards[i].position.set(Math.cos(a) * r, Math.sin(a) * r, restZ);
        shards[i].rotation.y = now / 200;
      }
      // elemental FX
      for (let p = 0; p < fxParts.length; p++) {
        const fp = fxParts[p];
        if (fp.k === 'fire') {
          fp.a.scale.set(1, 0.85 + Math.sin(now / 120) * 0.22 + Math.sin(now / 47) * 0.08, 1);
          fp.b.scale.set(1, 0.9 + Math.sin(now / 90 + 1.6) * 0.25, 1);
          fp.a.position.x = Math.sin(now / 180) * 0.015;
        } else if (fp.k === 'ice') {
          const sh = 0.9 + Math.sin(now / 260) * 0.1;
          fp.a.scale.y = sh; fp.b.scale.y = 0.9 + Math.sin(now / 230 + 1) * 0.12; fp.c.scale.y = sh;
        } else if (fp.k === 'void') {
          fp.a.scale.setScalar(1 + Math.sin(now / 200) * 0.22);
          fp.b.scale.setScalar(1 + Math.sin(now / 140 + 1) * 0.3);
          fp.a.rotation.y = now / 300;
        } else if (fp.k === 'spark') {
          for (let i = 0; i < fp.list.length; i++) {
            const b = fp.list[i];
            b.position.x = Math.sin(now / 40 + b.userData.ph) * 0.04;
            b.scale.y = 0.6 + Math.abs(Math.sin(now / 60 + b.userData.ph)) * 0.9;
          }
        } else if (fp.k === 'smoke') {
          fp.a.position.y = 0.1 + ((now / 900) % 1) * 0.1; fp.a.rotation.z = Math.sin(now / 500) * 0.2;
          fp.b.position.y = 0.2 + ((now / 1100 + 0.4) % 1) * 0.1;
        } else if (fp.k === 'wisp') {
          for (let i = 0; i < fp.list.length; i++) {
            const mo = fp.list[i];
            const a = mo.userData.a + now / 600;
            mo.position.set(Math.cos(a) * mo.userData.r, 0.05 + Math.sin(a) * mo.userData.r, restZ);
          }
        }
      }
    };
  }

  return g;
}

export function buildWeapon_wand(opts) {
  const o = opts || {};
  const c = o.color || '#c489ff';
  const tier = o.tier || 0;
  const fx = o.fx || null;
  const prismatic = !!o.prismatic;
  const g = new T.Group();

  // --- cached static materials (NEVER mutated) ---
  const wood = mat('#2a223a');                       // dim shaft
  const bone = mat('#d8d2c0', tier >= 3 ? 0.95 : 0.8); // skull/idol (brighter at high tier)
  const boneDark = mat('#3a352a');                   // jaw / shadowed bone
  const fitting = mat('#8a8f9c');                    // metal fittings (t2+)
  const glow = matAdd(c, tier >= 3 ? 1 : 0.9);       // accent/runes/eyes (static uses)
  const glowSoft = matAdd(c, 0.5);

  // helper: make a UNIQUE additive material (for anything mutated per-frame)
  const uniq = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op == null ? 1 : op, blending: T.AdditiveBlending, depthWrite: false });

  // length grows with tier (t3 legendary = longer/wider)
  const shaftLen = tier >= 3 ? 0.62 : 0.5;
  const shaftTop = shaftLen;            // grip at y=0 -> shaft spans 0..shaftLen
  const headY = shaftTop + 0.1;         // skull/idol head centre, above the shaft

  // --- shaft (up +Y, grip at origin) ---
  const shaft = m(cyl(0.035, 0.052, shaftLen, 6), wood); shaft.position.y = shaftLen / 2;
  g.add(shaft);
  // grip wrap at the hand
  const wrap = m(cyl(0.05, 0.05, 0.1, 6), boneDark); wrap.position.y = 0.06;
  g.add(wrap);

  // --- T1+: a glowing accent line down the shaft ---
  if (tier >= 1) {
    const vein = m(box(0.012, shaftLen * 0.7, 0.06), glow);
    vein.position.set(0, shaftLen * 0.5, 0.04);
    g.add(vein);
  }

  // --- T2+: ornate metal fittings (collar below the head) + a small gem ---
  if (tier >= 2) {
    const collar = m(cyl(0.07, 0.06, 0.06, 6), fitting); collar.position.y = shaftTop - 0.02;
    const collarRing = m(cyl(0.085, 0.085, 0.02, 6), glowSoft); collarRing.position.y = shaftTop;
    g.add(collar, collarRing);
    // forehead gem set into the skull
    const gem = m(geo('wandGem', () => new T.OctahedronGeometry(0.045, 0)), glow);
    gem.position.set(0, headY + 0.08, 0.1);
    g.add(gem);
  }

  // --- skull / idol head (faceted, gothic) ---
  const skull = m(box(0.17, 0.17, 0.15), bone); skull.position.y = headY;
  const crown = m(cone(0.11, 0.1, 5), bone); crown.position.y = headY + 0.12; crown.rotation.y = 0.4;
  const jaw = m(box(0.13, 0.06, 0.13), boneDark); jaw.position.set(0, headY - 0.1, 0.01);
  g.add(skull, crown, jaw);
  // brow ridge for a grim silhouette
  const brow = m(box(0.17, 0.04, 0.04), boneDark); brow.position.set(0, headY + 0.05, 0.075);
  g.add(brow);

  // glowing eye sockets (UNIQUE if prismatic, else cached additive)
  let eyeMatL, eyeMatR;
  if (prismatic) { eyeMatL = uniq(c, 1); eyeMatR = uniq(c, 1); }
  else { eyeMatL = glow; eyeMatR = glow; }
  const eyeL = m(box(0.045, 0.05, 0.03), eyeMatL); eyeL.position.set(-0.045, headY + 0.01, 0.085);
  const eyeR = m(box(0.045, 0.05, 0.03), eyeMatR); eyeR.position.set(0.045, headY + 0.01, 0.085);
  g.add(eyeL, eyeR);

  // --- T3 LEGENDARY: horns/prongs framing the skull + glowing runes along the shaft ---
  const runes = [];
  if (tier >= 3) {
    const hornL = m(cone(0.04, 0.22, 4), bone); hornL.position.set(-0.12, headY + 0.12, -0.02); hornL.rotation.set(-0.2, 0, 0.7);
    const hornR = m(cone(0.04, 0.22, 4), bone); hornR.position.set(0.12, headY + 0.12, -0.02); hornR.rotation.set(-0.2, 0, -0.7);
    g.add(hornL, hornR);
    // lower prongs flanking the jaw
    const tuskL = m(cone(0.028, 0.13, 4), bone); tuskL.position.set(-0.09, headY - 0.13, 0.05); tuskL.rotation.x = 0.3;
    const tuskR = m(cone(0.028, 0.13, 4), bone); tuskR.position.set(0.09, headY - 0.13, 0.05); tuskR.rotation.x = 0.3;
    g.add(tuskL, tuskR);
    // glowing runes down the shaft (UNIQUE additive so they can pulse independently)
    for (let i = 0; i < 3; i++) {
      const r = m(box(0.05, 0.05, 0.062), uniq(c, 0.85));
      r.position.set(0, 0.16 + i * 0.14, 0.045);
      r.rotation.z = Math.PI / 4;
      runes.push(r); g.add(r);
    }
  }

  // --- T4 MYTHIC: orbiting shards + an intense core in the maw ---
  const shards = [];
  let coreMat = null, core = null;
  if (tier >= 4) {
    coreMat = uniq('#ffffff', 0.95);
    core = m(geo('wandCore', () => new T.IcosahedronGeometry(0.07, 0)), coreMat);
    core.position.set(0, headY, 0.02);
    g.add(core);
    for (let i = 0; i < 3; i++) {
      const sh = m(geo('wandShard', () => new T.OctahedronGeometry(0.04, 0)), uniq(c, 0.9));
      sh.userData.ph = (i / 3) * Math.PI * 2;
      shards.push(sh); g.add(sh);
    }
  }

  // ===========================================================
  // ELEMENTAL FX — gathers at the HEAD (top). Additive, animated.
  // Higher tier => more prominent. When prismatic, FX use UNIQUE
  // mats and shimmer; otherwise cheap cached mats.
  // ===========================================================
  const fxParts = [];
  const big = tier >= 3;
  const fxY = headY + 0.16; // just above the skull
  if (fx === 'fire') {
    const n = big ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const hot = i % 2 === 0;
      const hex = hot ? '#ffd24a' : '#ff5a2a';
      const fmat = prismatic ? uniq(hex, 0.85) : matAdd(hex, 0.85);
      const fl = m(cone(0.05, big ? 0.26 : 0.18, 4), fmat);
      const a = (i / n) * Math.PI * 2;
      fl.position.set(Math.cos(a) * 0.05, fxY + 0.04, Math.sin(a) * 0.05);
      fl.userData.base = fl.position.y; fl.userData.ph = i * 1.3; fl.userData.fmat = prismatic ? fmat : null;
      fxParts.push(fl); g.add(fl);
    }
  } else if (fx === 'ice') {
    const n = big ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const cmat = prismatic ? uniq('#bfe9ff', 0.7) : matAdd('#bfe9ff', 0.7);
      const cr = m(cone(0.035, big ? 0.2 : 0.14, 4), cmat);
      const a = (i / n) * Math.PI * 2;
      cr.position.set(Math.cos(a) * 0.09, fxY - 0.02, Math.sin(a) * 0.09);
      cr.rotation.set(0.4 * Math.cos(a), 0, 0.4 * Math.sin(a));
      cr.userData.ph = i * 0.9; cr.userData.fmat = prismatic ? cmat : null;
      fxParts.push(cr); g.add(cr);
    }
  } else if (fx === 'void') {
    const n = big ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const vm = uniq('#7a2bd0', 0.7);
      const orb = m(geo('wandVoid', () => new T.IcosahedronGeometry(0.07, 0)), vm);
      const a = (i / n) * Math.PI * 2;
      orb.position.set(Math.cos(a) * 0.08, fxY, Math.sin(a) * 0.08);
      orb.userData.ph = i * 2.1; orb.userData.vmat = vm; orb.userData.fmat = prismatic ? vm : null;
      fxParts.push(orb); g.add(orb);
    }
  } else if (fx === 'spark') {
    const n = big ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const kmat = prismatic ? uniq('#d8f0ff', 0.95) : matAdd('#d8f0ff', 0.95);
      const bit = m(box(0.02, 0.07, 0.02), kmat);
      const a = (i / n) * Math.PI * 2;
      bit.position.set(Math.cos(a) * 0.1, fxY, Math.sin(a) * 0.1);
      bit.userData.ph = i * 1.7; bit.userData.ax = Math.cos(a); bit.userData.az = Math.sin(a); bit.userData.fmat = prismatic ? kmat : null;
      fxParts.push(bit); g.add(bit);
    }
  } else if (fx === 'smoke') {
    const n = big ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const sm = uniq('#7a7488', 0.32);
      const puff = m(geo('wandSmoke', () => new T.IcosahedronGeometry(0.08, 0)), sm);
      puff.position.set(0, fxY + i * 0.07, 0);
      puff.userData.ph = i * 1.1; puff.userData.base = fxY + i * 0.07; puff.userData.smat = sm;
      fxParts.push(puff); g.add(puff);
    }
  } else if (fx === 'wisp') {
    const n = big ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const wmat = prismatic ? uniq(c, 0.9) : matAdd(c, 0.9);
      const mote = m(geo('wandMote', () => new T.IcosahedronGeometry(0.03, 0)), wmat);
      mote.userData.ph = (i / n) * Math.PI * 2; mote.userData.r = 0.13; mote.userData.fmat = prismatic ? wmat : null;
      fxParts.push(mote); g.add(mote);
    }
  }

  // ===========================================================
  // ANIMATION — sin-based, alloc-free, mutate children only.
  // ===========================================================
  g.userData.anim = (grp, now) => {
    // eye flicker
    const ef = 0.85 + Math.sin(now / 180) * 0.15;
    eyeL.scale.setScalar(ef); eyeR.scale.setScalar(ef);

    // legendary runes pulse along the shaft
    for (let i = 0; i < runes.length; i++) {
      runes[i].material.opacity = 0.55 + Math.abs(Math.sin(now / 300 + i)) * 0.45;
    }

    // mythic: orbiting shards + breathing core
    for (let i = 0; i < shards.length; i++) {
      const ph = shards[i].userData.ph + now / 600;
      shards[i].position.set(Math.cos(ph) * 0.18, headY + Math.sin(now / 500 + i) * 0.05, Math.sin(ph) * 0.18 + 0.02);
      shards[i].rotation.y = ph;
    }
    if (core) core.scale.setScalar(1 + Math.sin(now / 200) * 0.25);

    // prismatic rainbow shimmer (UNIQUE mats only)
    if (prismatic) {
      const hue = (now / 2600) % 1;
      eyeMatL.color.setHSL(hue, 1, 0.6);
      eyeMatR.color.setHSL((hue + 0.5) % 1, 1, 0.6);
      for (let i = 0; i < runes.length; i++) runes[i].material.color.setHSL((hue + i * 0.12) % 1, 1, 0.6);
      for (let i = 0; i < shards.length; i++) shards[i].material.color.setHSL((hue + 0.33 * i) % 1, 1, 0.62);
      if (coreMat) coreMat.color.setHSL((hue + 0.15) % 1, 0.6, 0.85);
      // FX motes shimmer too (each fxPart carries a unique fmat when prismatic)
      for (let i = 0; i < fxParts.length; i++) {
        const fm = fxParts[i].userData.fmat;
        if (fm) fm.color.setHSL((hue + 0.2 + i * 0.09) % 1, 1, 0.62);
      }
    }

    // elemental FX motion
    if (fx === 'fire') {
      for (let i = 0; i < fxParts.length; i++) {
        const f = fxParts[i], k = 0.7 + Math.abs(Math.sin(now / 110 + f.userData.ph)) * 0.6;
        f.scale.set(1, k, 1);
        f.position.y = f.userData.base + Math.sin(now / 130 + f.userData.ph) * 0.02;
      }
    } else if (fx === 'ice') {
      const sh = 0.85 + Math.sin(now / 500) * 0.15;
      for (let i = 0; i < fxParts.length; i++) fxParts[i].scale.setScalar(sh);
    } else if (fx === 'void') {
      for (let i = 0; i < fxParts.length; i++) {
        const f = fxParts[i], p = Math.sin(now / 340 + f.userData.ph);
        f.scale.setScalar(0.8 + p * 0.3);
        f.userData.vmat.opacity = 0.5 + (p + 1) * 0.2;
        const ph = f.userData.ph + now / 800;
        f.position.x = Math.cos(ph) * 0.08; f.position.z = Math.sin(ph) * 0.08;
      }
    } else if (fx === 'spark') {
      for (let i = 0; i < fxParts.length; i++) {
        const f = fxParts[i], j = Math.sin(now / 40 + f.userData.ph);
        f.position.x = f.userData.ax * (0.1 + j * 0.03);
        f.position.z = f.userData.az * (0.1 + j * 0.03);
        f.position.y = fxY + Math.sin(now / 55 + f.userData.ph * 2) * 0.04;
        f.rotation.z = j * 1.2;
      }
    } else if (fx === 'smoke') {
      for (let i = 0; i < fxParts.length; i++) {
        const f = fxParts[i], t = (now / 1400 + f.userData.ph) % 1;
        f.position.y = f.userData.base + t * 0.14;
        f.position.x = Math.sin(now / 900 + f.userData.ph) * 0.04;
        f.userData.smat.opacity = 0.34 * (1 - t);
        f.scale.setScalar(0.7 + t * 0.8);
      }
    } else if (fx === 'wisp') {
      for (let i = 0; i < fxParts.length; i++) {
        const f = fxParts[i], ph = f.userData.ph + now / 520;
        f.position.set(Math.cos(ph) * f.userData.r, fxY + Math.sin(now / 380 + i) * 0.05, Math.sin(ph) * f.userData.r);
      }
    }
  };

  return g;
}

export function buildGear_cape(opts) {
  const c = (opts && opts.color) || '#6a2030';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // Flowing cloth panel hanging BACKWARD (-Z) from the upper-back mount.
  // Built from stacked tapered panels (wide shoulders -> narrowing fall) plus
  // ragged hem prongs, so the silhouette reads as draped cloth, not a flat card.
  // On the ADDITIVE display cloth uses translucent additive mats so the stacked
  // panels layer like fabric. Animated (prismatic) parts get UNIQUE instances;
  // static parts use the cached additive helper.
  const clothMats = [];
  function cloth(hex, op) {
    if (prismatic) {
      const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
      clothMats.push(mm); return mm;
    }
    return matAdd(hex, op);
  }
  const trimMat = prismatic
    ? (() => { const mm = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }); clothMats.push(mm); return mm; })()
    : matAdd(c, 0.9);

  // shoulder collar -- a raised mantle over the shoulders, spread wide
  const collar = m(box(0.62, 0.12, 0.1), cloth(c, 0.55));
  collar.position.set(0, 0.06, -0.04); collar.rotation.x = 0.25;
  // glowing trim line along the collar edge (rarity accent)
  const trim = m(box(0.6, 0.03, 0.02), trimMat);
  trim.position.set(0, 0.11, -0.02); trim.rotation.x = 0.25;

  // a hanging cloth made of 3 stacked panels, each narrower + dimmer as it falls,
  // and each tilted a touch further back so it billows out behind the hero.
  const upper = m(plane(0.56, 0.34), cloth(c, 0.62));
  upper.position.set(0, -0.16, -0.05); upper.rotation.x = 0.16;
  const mid = m(plane(0.5, 0.34), cloth(c, 0.48));
  mid.position.set(0, -0.45, -0.11); mid.rotation.x = 0.1;
  const low = m(plane(0.42, 0.3), cloth(c, 0.36));
  low.position.set(0, -0.72, -0.15); low.rotation.x = 0.04;

  // ragged hem prongs trailing at the bottom for a tattered gothic edge
  const hems = [];
  const hemX = [-0.15, 0, 0.15];
  for (let i = 0; i < hemX.length; i++) {
    const hp = m(cone(0.07, 0.22, 3), cloth(c, 0.32));
    hp.position.set(hemX[i], -0.92, -0.15); hp.rotation.x = Math.PI - 0.04;
    hems.push(hp); g.add(hp);
  }

  g.add(collar, trim, upper, mid, low);

  g.userData.anim = (grp, now) => {
    // gentle idle sway: the whole cloth swings, lower panels lag for a wave
    const sway = Math.sin(now / 420);
    upper.rotation.x = 0.16 + sway * 0.05;
    mid.rotation.x = 0.1 + Math.sin(now / 420 - 0.5) * 0.07;
    low.rotation.x = 0.04 + Math.sin(now / 420 - 1.0) * 0.09;
    low.rotation.z = Math.sin(now / 560) * 0.04;
    for (let i = 0; i < hems.length; i++) {
      hems[i].rotation.z = Math.sin(now / 480 + i) * 0.14;
    }
    if (prismatic) {
      const hue = (now / 2600) % 1;
      for (let i = 0; i < clothMats.length; i++) {
        clothMats[i].color.setHSL((hue + i * 0.06) % 1, 0.85, 0.6);
      }
    }
  };
  return g;
}

export function buildGear_wings(opts) {
  const c = (opts && opts.color) || '#caa15a';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // Large feathered/ribbed wings spread WIDE, mounted at the upper-back and
  // sweeping BACKWARD (-Z) and out to the sides. Each wing is a pivot group so
  // it can beat from the shoulder joint. Built from a bony top spar + a fan of
  // tapered feather blades (longest at the wrist, shortest near the body) so the
  // silhouette reads unmistakably as a wing, not a triangle. Additive glow blades
  // so they read as light on the additive display.
  const featherMats = [];
  function feather(hex, br) {
    if (prismatic) {
      // UNIQUE per-frame-animated material (NEVER cached) for the rainbow shimmer.
      const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: br, blending: T.AdditiveBlending, depthWrite: false });
      featherMats.push(mm);
      return mm;
    }
    // Static feathers use the cached additive glow helper (additive-friendly, never mutated).
    return matAdd(hex, br);
  }
  const sparMat = mat(c, 0.85);

  function wing(side) {
    const w = new T.Group();
    w.position.set(0.08 * side, 0.04, -0.05);
    // bony leading spar sweeping out and back
    const spar = m(cyl(0.025, 0.04, 0.62, 4), sparMat);
    spar.position.set(0.3 * side, 0.04, -0.06);
    spar.rotation.z = (Math.PI / 2 - 0.5) * side;
    w.add(spar);
    // a fan of feathers along the spar — length grows toward the wingtip
    const fcount = 6;
    for (let i = 0; i < fcount; i++) {
      const t = i / (fcount - 1);                 // 0 root .. 1 tip
      const len = 0.26 + t * 0.42;                // longer toward the tip
      const br = 0.55 - t * 0.18;                 // dimmer toward the tip
      const f = m(cone(0.06, len, 3), feather(c, br));
      // ride along the spar, spreading down-and-back like a real wing
      f.position.set((0.12 + t * 0.5) * side, 0.06 - t * 0.16, -0.06 - t * 0.06);
      f.rotation.set(Math.PI / 2, 0, (1.0 + t * 0.5) * side);
      f.scale.set(1, 1, 0.28);                    // flatten into a feather blade
      w.add(f);
    }
    return w;
  }
  const wL = wing(-1);
  const wR = wing(1);
  g.add(wL, wR);

  g.userData.anim = (grp, now) => {
    // slow majestic beat from the shoulder
    const beat = Math.sin(now / 360) * 0.16;
    wL.rotation.z = beat;
    wR.rotation.z = -beat;
    // subtle fold/unfold so the spread breathes
    const flex = Math.sin(now / 520) * 0.05;
    wL.rotation.y = flex;
    wR.rotation.y = -flex;
    if (prismatic) {
      const hue = (now / 2400) % 1;
      for (let i = 0; i < featherMats.length; i++) {
        featherMats[i].color.setHSL((hue + i * 0.04) % 1, 0.85, 0.6);
      }
    }
  };
  return g;
}

export function buildGear_spectral(opts) {
  const c = (opts && opts.color) || '#8fb6c8';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // Ghostly translucent trailing wisps/tatters streaming BACKWARD (-Z) and out
  // from the upper-back mount. No solid cloth — faint additive tapered shrouds
  // and drifting motes that read as a spectral aura clinging to the hero. All
  // wisp/mote materials are UNIQUE additive instances (animated even when not
  // prismatic: their opacity breathes), so they never mutate cached mats.
  const wispMats = [];
  function wispMat(op) {
    const mm = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    wispMats.push(mm); return mm;
  }

  // three tapered tatters fanning out behind the shoulders, each its own pivot
  // so it can wave independently like a torn ghost-shroud.
  const tatters = [];
  const cfg = [[-0.16, 0.42], [0.0, 0.46], [0.16, 0.4]];
  for (let i = 0; i < cfg.length; i++) {
    const piv = new T.Group();
    piv.position.set(cfg[i][0], 0.0, -0.06);
    const len = cfg[i][1];
    const t = m(cone(0.12, len, 4), wispMat(0.34 - i * 0.04));
    // hang downward and trail back (-Z); rotation.x ~ PI points the cone down
    t.position.set(0, -len * 0.4, -0.08);
    t.rotation.x = Math.PI - 0.25;
    t.scale.set(1, 1, 0.5);
    piv.add(t);
    piv.userData.baseMat = t.material;
    piv.userData.baseOp = 0.34 - i * 0.04;
    piv.userData.ph = i * 1.1;
    tatters.push(piv); g.add(piv);
  }

  // a fainter wide halo-shroud over the shoulders to ground the wisps
  const shroud = m(cyl(0.18, 0.34, 0.3, 6), wispMat(0.16));
  shroud.position.set(0, -0.02, -0.08);
  g.add(shroud);

  // a few free-floating motes that rise and recycle, orbiting the trail
  const motes = [];
  const moteGeo = geo('spectralMote', () => new T.OctahedronGeometry(0.04, 0));
  for (let i = 0; i < 5; i++) {
    const mo = m(moteGeo, wispMat(0.6));
    mo.userData.ph = (i / 5) * Math.PI * 2;
    mo.userData.rad = 0.1 + (i % 3) * 0.05;
    motes.push(mo); g.add(mo);
  }

  g.userData.anim = (grp, now) => {
    // tatters wave and breathe (opacity flicker = ghostly)
    for (let i = 0; i < tatters.length; i++) {
      const piv = tatters[i];
      piv.rotation.z = Math.sin(now / 540 + piv.userData.ph) * 0.18;
      piv.rotation.x = Math.sin(now / 720 + piv.userData.ph) * 0.08;
      const flick = 0.78 + Math.sin(now / 300 + piv.userData.ph) * 0.22;
      piv.userData.baseMat.opacity = piv.userData.baseOp * flick;
    }
    shroud.material.opacity = 0.16 * (0.8 + Math.sin(now / 400) * 0.2);
    // motes rise behind the back and recycle to the bottom
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const t = ((now / 1400) + i / motes.length) % 1;   // 0..1 lifetime
      const a = mo.userData.ph + now / 900;
      mo.position.set(
        Math.cos(a) * mo.userData.rad,
        -0.5 + t * 0.7,
        -0.12 + Math.sin(a) * mo.userData.rad
      );
      // fade in at birth, out at death
      mo.material.opacity = 0.6 * Math.sin(t * Math.PI);
      mo.scale.setScalar(0.7 + Math.sin(t * Math.PI) * 0.5);
    }
    if (prismatic) {
      const hue = (now / 2200) % 1;
      for (let i = 0; i < wispMats.length; i++) {
        wispMats[i].color.setHSL((hue + i * 0.05) % 1, 0.7, 0.65);
      }
    }
  };
  return g;
}

export function buildGear_crown(opts) {
  const c = (opts && opts.color) || '#ffd166';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // Sits just above the head (headMount). Regal spiked band.
  const lift = 0.06;
  // Dim metal band base (cached, static) + a glowing trim ring.
  const band = m(cyl(0.16, 0.17, 0.08, 8), mat(c, 0.45));
  band.position.y = lift;
  const trim = m(geo('crownTrim', () => new T.TorusGeometry(0.165, 0.018, 4, 12)), matAdd(c, 0.9));
  trim.rotation.x = Math.PI / 2; trim.position.y = lift + 0.04;
  g.add(band, trim);

  // Prismatic shimmer: collect UNIQUE additive materials to hue-cycle.
  // Cached matAdd() is returned when not prismatic (never mutated by anim).
  const shimmer = [];
  function glowMat(opacity) {
    if (prism) {
      const u = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
      shimmer.push(u);
      return u;
    }
    return matAdd(c, opacity);
  }

  // Alternating tall/short spikes around the band for a regal silhouette.
  const N = 9;
  const tips = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const big = (i % 2 === 0);
    const h = big ? 0.2 : 0.12;
    const sp = m(cone(big ? 0.045 : 0.035, h, 4), glowMat(0.95));
    sp.position.set(Math.cos(a) * 0.155, lift + 0.04 + h / 2, Math.sin(a) * 0.155);
    g.add(sp);
    // A small gem bead at the base of every other spike (ornamentation).
    if (big) {
      const gem = m(geo('crownGem', () => new T.OctahedronGeometry(0.028, 0)), glowMat(1));
      gem.position.set(Math.cos(a) * 0.155, lift + 0.05, Math.sin(a) * 0.155);
      g.add(gem);
      tips.push(gem);
    }
  }

  // A larger central front jewel.
  const jewel = m(geo('crownJewel', () => new T.OctahedronGeometry(0.05, 0)), glowMat(1));
  jewel.position.set(0, lift + 0.05, 0.17);
  jewel.scale.set(1, 1.4, 0.6);
  g.add(jewel);
  tips.push(jewel);

  if (prism) {
    g.userData.anim = (grp, now) => {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.04) % 1, 0.85, 0.6);
      }
      const p = 1 + Math.sin(now / 300) * 0.12;
      for (let i = 0; i < tips.length; i++) tips[i].scale.setScalar(p);
      jewel.scale.set(p, p * 1.4, p * 0.6);
    };
  } else {
    g.userData.anim = (grp, now) => {
      const p = 1 + Math.sin(now / 360) * 0.1;
      for (let i = 0; i < tips.length; i++) tips[i].scale.setScalar(p);
      jewel.scale.set(p, p * 1.4, p * 0.6);
    };
  }
  return g;
}

export function buildGear_halo(opts) {
  const c = (opts && opts.color) || '#9be8ff';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // HEAD cosmetic: floats just above the head (small +Y).
  const y = 0.12;

  // Unique materials we mutate per-frame for the prismatic (mythic) shimmer.
  // These MUST be fresh instances (never cached mat/matAdd) since we set .color each frame.
  const shimmer = [];
  function glowMat(opacity) {
    if (prism) {
      const u = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
      shimmer.push(u);
      return u;
    }
    // Static, non-animated parts use the cached additive helper.
    return matAdd(c, opacity);
  }

  // Main glowing ring (octagonal torus reads angular/gothic).
  const ring = m(geo('haloRing', () => new T.TorusGeometry(0.2, 0.022, 4, 24)), glowMat(0.9));
  ring.rotation.x = Math.PI / 2; ring.position.y = y;
  g.add(ring);

  // A fainter, larger second ring adds halo depth (extra drama when prismatic).
  const ring2 = m(geo('haloRing2', () => new T.TorusGeometry(0.27, 0.014, 4, 24)), glowMat(0.5));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = y + 0.005;
  g.add(ring2);

  // Small radiating motes orbiting on the halo plane (more + denser when prismatic).
  const motes = [];
  const M = prism ? 8 : 5;
  const R = 0.235;
  for (let i = 0; i < M; i++) {
    const a = (i / M) * Math.PI * 2;
    const mo = m(geo('haloMote', () => new T.OctahedronGeometry(0.022, 0)), glowMat(0.95));
    mo.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
    mo.userData.a = a;
    g.add(mo); motes.push(mo);
  }

  g.userData.anim = (grp, now) => {
    const spin = now / 1400;
    ring.rotation.z = spin;
    ring2.rotation.z = -spin * 0.7;
    for (let i = 0; i < motes.length; i++) {
      const a = motes[i].userData.a + spin;
      motes[i].position.x = Math.cos(a) * R;
      motes[i].position.z = Math.sin(a) * R;
      motes[i].position.y = y + Math.sin(now / 320 + i) * 0.02;
    }
    if (prism) {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.05) % 1, 0.85, 0.6);
      }
    }
  };
  return g;
}

export function buildGear_plate(opts) {
  const c = (opts && opts.color) || '#5f7d96';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // Mounted at the upper-back (backMount). Heavy ornate pauldrons spread over
  // the shoulders (+/-X) and a tall back ridge runs up the spine (-Z).
  const armor = mat(c, 0.5);
  const armorDark = mat(c, 0.3);

  // Per-frame prismatic shimmer requires UNIQUE materials (never mutate cached
  // mat()/matAdd()). Static parts use cached helpers; glow parts use glowMat().
  const shimmer = [];
  function glowMat(opacity) {
    if (prism) {
      const u = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
      shimmer.push(u);
      return u;
    }
    return matAdd(c, opacity);
  }

  // Heavy faceted pauldrons (cone caps) sitting over each shoulder.
  const trims = [];
  function pauldron(side) {
    const grp = new T.Group();
    grp.position.set(0.34 * side, 0.15, 0.1);
    const cap = m(cone(0.22, 0.28, 5), armor); cap.rotation.z = side * 0.55; cap.position.y = 0.04;
    const skirt = m(box(0.3, 0.1, 0.3), armorDark); skirt.position.y = -0.08;
    // Glowing trim band + an outward spike ridge for ornamentation.
    const trim = m(geo('plateTrim', () => new T.TorusGeometry(0.16, 0.02, 4, 10)), glowMat(0.85));
    trim.rotation.x = Math.PI / 2; trim.position.y = -0.04;
    trims.push(trim);
    const spike1 = m(cone(0.05, 0.22, 4), armorDark); spike1.position.set(0.18 * side, 0.06, 0); spike1.rotation.z = side * 1.4;
    const spike2 = m(cone(0.04, 0.16, 4), armorDark); spike2.position.set(0.1 * side, 0.16, -0.04); spike2.rotation.z = side * 1.1;
    const gem = m(geo('plateGem', () => new T.OctahedronGeometry(0.045, 0)), glowMat(1));
    gem.position.set(0, 0.06, 0.16); trims.push(gem);
    grp.add(cap, skirt, trim, spike1, spike2, gem);
    return grp;
  }
  g.add(pauldron(-1), pauldron(1));

  // Tall ornate back ridge running up the spine, leaning back (-Z).
  const ridgeBase = m(box(0.16, 0.36, 0.12), armorDark); ridgeBase.position.set(0, 0.04, -0.06);
  g.add(ridgeBase);
  const fins = [];
  for (let i = 0; i < 4; i++) {
    const fin = m(cone(0.05 + i * 0.006, 0.18 + i * 0.05, 4), armor);
    fin.position.set(0, -0.02 + i * 0.12, -0.1 - i * 0.03);
    fin.rotation.x = -0.45;
    g.add(fin); fins.push(fin);
  }
  // Glowing rune line down the central ridge.
  const rune = m(box(0.04, 0.42, 0.02), glowMat(0.9));
  rune.position.set(0, 0.1, -0.005); rune.rotation.x = -0.1;
  trims.push(rune);
  g.add(rune);
  // A crowning back jewel at the top of the ridge.
  const crownGem = m(geo('plateBackGem', () => new T.OctahedronGeometry(0.06, 0)), glowMat(1));
  crownGem.position.set(0, 0.42, -0.18); crownGem.scale.set(1, 1.4, 0.6);
  trims.push(crownGem);
  g.add(crownGem);

  if (prism) {
    g.userData.anim = (grp, now) => {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.03) % 1, 0.85, 0.6);
      }
      const p = 1 + Math.sin(now / 320) * 0.1;
      crownGem.scale.set(p, p * 1.4, p * 0.6);
    };
  } else {
    g.userData.anim = (grp, now) => {
      const p = 1 + Math.sin(now / 380) * 0.08;
      crownGem.scale.set(p, p * 1.4, p * 0.6);
    };
  }
  return g;
}

export function buildArmorKit(opts) {
  const tier = (opts && opts.tier) || 0;
  const c = (opts && opts.color) || '#c8d0e0';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // tier < 2 -> nothing; the base cuirass already covers the look.
  if (tier < 2) return g;

  // Authored to sit on the chest/front: around y 0.6..1.0, z ~0.18 front.
  // Kept small so it layers over the existing cuirass without occluding it.
  // ADDITIVE display: no black fills, no opaque depth-writing plates over glows.

  if (tier === 2) {
    // a small glowing chest gem in a dim additive setting (no black fill).
    const setting = m(box(0.11, 0.13, 0.05), matAdd(c, 0.25));
    setting.position.set(0, 0.82, 0.18);
    const gem = m(geo('kitGem', () => new T.OctahedronGeometry(0.06, 0)), matAdd(c, 0.95));
    gem.position.set(0, 0.82, 0.2);
    g.add(setting, gem);
    g.userData.anim = (gr, now) => { gem.scale.setScalar(1 + Math.sin(now / 360) * 0.14); };
    return g;
  }

  // tier >= 3: an ornate emblem on the chest + shoulder spikes.
  // Prismatic (tier 4) uses UNIQUE animated mats; otherwise cached additive.
  const mkMat = (hex, op) => prismatic
    ? new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op == null ? 0.95 : op, blending: T.AdditiveBlending, depthWrite: false })
    : matAdd(hex, op == null ? 0.9 : op);

  const emblemMat = mkMat(c, 0.95);
  const haloMat = mkMat(c, 0.4);
  const spikeMat = mkMat(c, 0.85);
  const crestMat = mkMat(c, 0.5);

  // central emblem — a faceted diamond with radiating glint bars (a gothic sigil)
  const emblem = m(geo('kitEmblem', () => new T.OctahedronGeometry(0.09, 0)), emblemMat);
  emblem.position.set(0, 0.86, 0.19);
  emblem.scale.set(1, 1.3, 0.6);
  const glintH = m(box(0.26, 0.025, 0.025), haloMat); glintH.position.set(0, 0.86, 0.19);
  const glintV = m(box(0.025, 0.22, 0.025), haloMat); glintV.position.set(0, 0.86, 0.19);
  // glowing wing-plates framing the emblem for an ornate crest (additive, no black)
  const crestL = m(cone(0.05, 0.16, 4), crestMat); crestL.position.set(-0.11, 0.86, 0.18); crestL.rotation.z = 1.4;
  const crestR = m(cone(0.05, 0.16, 4), crestMat); crestR.position.set(0.11, 0.86, 0.18); crestR.rotation.z = -1.4;
  g.add(crestL, crestR, glintH, glintV, emblem);

  // shoulder spikes (cones at x ~ +/-0.34, y ~0.95) pointing up/out
  const spL = m(cone(0.05, 0.2, 4), spikeMat); spL.position.set(-0.34, 0.95, 0); spL.rotation.z = 0.35;
  const spR = m(cone(0.05, 0.2, 4), spikeMat); spR.position.set(0.34, 0.95, 0); spR.rotation.z = -0.35;
  g.add(spL, spR);

  g.userData.anim = (gr, now) => {
    const p = 1 + Math.sin(now / 340) * 0.12;
    emblem.scale.set(p, p * 1.3, p * 0.6);
    if (prismatic) {
      const hue = (now / 2000) % 1;
      emblemMat.color.setHSL(hue, 0.9, 0.6);
      haloMat.color.setHSL((hue + 0.5) % 1, 0.85, 0.6);
      spikeMat.color.setHSL((hue + 0.25) % 1, 0.85, 0.6);
      crestMat.color.setHSL((hue + 0.75) % 1, 0.85, 0.55);
    }
  };
  return g;
}

// legendary / mythic character aura — a glowing ground ring + rising motes at the
// feet. tier 3 = bold single ring; tier 4 (prismatic) = double ring + more motes that
// shimmer through the rainbow. Uses UNIQUE materials (animated per-frame).
export function buildAura(opts) {
  const o = opts || {};
  const c = o.color || '#ff8c42';
  const prism = !!o.prismatic;
  const g = new T.Group();
  const mk = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const tinted = [];                                  // unique mats to hue-cycle when prismatic

  const ringMat = mk(c, 0.6);
  const ring = m(geo('auraRing', () => new T.TorusGeometry(0.5, 0.03, 4, 24)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  g.add(ring); tinted.push(ringMat);

  let ring2 = null;
  if (prism) {
    const r2 = mk(c, 0.5);
    ring2 = m(geo('auraRing2', () => new T.TorusGeometry(0.34, 0.025, 4, 20)), r2);
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.03;
    g.add(ring2); tinted.push(r2);
  }

  const motes = [];
  const nM = prism ? 8 : 5;
  for (let i = 0; i < nM; i++) {
    const mm = mk(c, 0.85);
    const mo = m(geo('auraMote', () => new T.IcosahedronGeometry(0.035, 0)), mm);
    const a = (i / nM) * Math.PI * 2;
    mo.position.set(Math.cos(a) * 0.4, 0.05, Math.sin(a) * 0.4);
    g.add(mo); tinted.push(mm);
    motes.push({ mesh: mo, a, base: i / nM });
  }

  g.userData.anim = (grp, now) => {
    ring.rotation.z = now / 1600;
    if (ring2) ring2.rotation.z = -now / 1200;
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i];
      const t = ((now / 1400) + mt.base) % 1;         // rise + recycle
      mt.mesh.position.set(Math.cos(mt.a + now / 2000) * 0.4, 0.05 + t * 0.9, Math.sin(mt.a + now / 2000) * 0.4);
      mt.mesh.material.opacity = 0.85 * (1 - t);
    }
    if (prism) {
      const hues = ['#f062ff', '#6df1ff', '#ffd166', '#ff4d6d', '#9bff8a'];
      const col = hues[Math.floor((now / 280) % hues.length)];
      for (const mat of tinted) mat.color.set(col);
    }
  };
  return g;
}


// =============================================================
// CLASS-DISTINCT PLAYER RIGS — warrior/mage/ranger/summoner (workflow).
// Same userData interface as buildPlayer; engine picks by classId.
// =============================================================

export function buildPlayer_warrior(opts){
  const g = new T.Group();

  // ---- UNIQUE recolor materials (engine recolors these live; never cache) ----
  const bodyMat = new T.MeshBasicMaterial({ color:0x46506b, fog:true });                              // -> class color (plate)
  const trimMat = new T.MeshBasicMaterial({ color:0xffce5e, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false }); // -> rarity accent (rune trim)
  const eyeMat  = new T.MeshBasicMaterial({ color:0xff4422, fog:false, transparent:true, opacity:1,    blending:T.AdditiveBlending, depthWrite:false }); // -> eye glow

  // fixed dark parts (cached OPAQUE fogged) - kept above pure-black so additive display still shows form
  const dark   = mat('#12161f');   // boots, gorget shadow, visor void
  const steel  = mat('#222a39');   // secondary plate / strap shade
  const sabato = mat('#171c27');   // sabatons

  // ================= LEGS (armored greaves + sabatons) =================
  // upper leg / cuisse
  const lThigh = m(box(0.22,0.30,0.24), bodyMat);  lThigh.position.set(-0.16,0.30,0);
  const rThigh = m(box(0.22,0.30,0.24), bodyMat);  rThigh.position.set( 0.16,0.30,0);
  // greave (lower leg) bolted to thigh so each is ONE walk-rotated mesh
  const lGreave = m(box(0.19,0.26,0.21), steel);   lGreave.position.set(0,-0.26,0.01);  lThigh.add(lGreave);
  const rGreave = m(box(0.19,0.26,0.21), steel);   rGreave.position.set(0,-0.26,0.01);  rThigh.add(rGreave);
  // knee cop (angular point)
  const lKnee = m(cone(0.12,0.13,4), bodyMat);     lKnee.position.set(0,-0.10,0.12); lKnee.rotation.x=0.5; lThigh.add(lKnee);
  const rKnee = m(cone(0.12,0.13,4), bodyMat);     rKnee.position.set(0,-0.10,0.12); rKnee.rotation.x=0.5; rThigh.add(rKnee);
  // sabatons (pointed armored boots)
  const lFoot = m(box(0.20,0.10,0.30), sabato);    lFoot.position.set(0,-0.36,0.05); lThigh.add(lFoot);
  const rFoot = m(box(0.20,0.10,0.30), sabato);    rFoot.position.set(0,-0.36,0.05); rThigh.add(rFoot);
  const lToe  = m(cone(0.09,0.14,4), sabato);      lToe.position.set(0,-0.36,0.21); lToe.rotation.x=Math.PI/2; lThigh.add(lToe);
  const rToe  = m(cone(0.09,0.14,4), sabato);      rToe.position.set(0,-0.36,0.21); rToe.rotation.x=Math.PI/2; rThigh.add(rToe);
  g.add(lThigh); g.add(rThigh);

  // ================= FAULD / TASSETS over the hips =================
  const fauld = m(box(0.58,0.18,0.40), steel);     fauld.position.set(0,0.50,0);   g.add(fauld);
  const lTasset = m(box(0.22,0.22,0.34), bodyMat); lTasset.position.set(-0.22,0.44,0.02); lTasset.rotation.z=0.18; g.add(lTasset);
  const rTasset = m(box(0.22,0.22,0.34), bodyMat); rTasset.position.set( 0.22,0.44,0.02); rTasset.rotation.z=-0.18; g.add(rTasset);
  // belt rune line
  const belt = m(box(0.60,0.05,0.42), trimMat);    belt.position.set(0,0.59,0);   g.add(belt);

  // ================= CUIRASS (thick chest) =================
  const cuirass = m(box(0.62,0.48,0.40), bodyMat); cuirass.position.set(0,0.84,0);  g.add(cuirass);
  // chest plates angle to a center ridge - side bevels
  const lBevel = m(box(0.16,0.44,0.10), steel);    lBevel.position.set(-0.30,0.84,0.18); lBevel.rotation.y=0.5; g.add(lBevel);
  const rBevel = m(box(0.16,0.44,0.10), steel);    rBevel.position.set( 0.30,0.84,0.18); rBevel.rotation.y=-0.5; g.add(rBevel);
  // central emblem ridge (vertical keel) + glowing emblem
  const ridge = m(box(0.10,0.44,0.10), steel);     ridge.position.set(0,0.84,0.205);  g.add(ridge);
  const emblem = m(box(0.14,0.20,0.06), trimMat);  emblem.position.set(0,0.89,0.24);  g.add(emblem);
  const emblemBar = m(box(0.26,0.05,0.05), trimMat); emblemBar.position.set(0,0.83,0.24); g.add(emblemBar);
  // gorget (neck guard)
  const gorget = m(box(0.34,0.12,0.32), dark);     gorget.position.set(0,1.10,0);    g.add(gorget);

  // ================= MASSIVE LAYERED PAULDRONS (widest point) =================
  function pauldron(side){
    const grp = new T.Group();
    grp.position.set(side*0.40,1.00,0);
    const cap = m(box(0.34,0.22,0.40), bodyMat); cap.position.set(side*0.06,0,0); cap.rotation.z=side*0.30; grp.add(cap);
    const lay1 = m(box(0.36,0.10,0.42), steel);  lay1.position.set(side*0.04,-0.13,0); lay1.rotation.z=side*0.22; grp.add(lay1);
    const lay2 = m(box(0.32,0.09,0.40), bodyMat); lay2.position.set(side*0.02,-0.24,0); lay2.rotation.z=side*0.14; grp.add(lay2);
    // upward menacing spike
    const spike = m(cone(0.11,0.28,4), bodyMat); spike.position.set(side*0.18,0.15,0); spike.rotation.z=side*-0.25; grp.add(spike);
    // rune edge
    const rune = m(box(0.36,0.03,0.44), trimMat); rune.position.set(side*0.05,-0.06,0); rune.rotation.z=side*0.30; grp.add(rune);
    return grp;
  }
  g.add(pauldron(-1)); g.add(pauldron(1));

  // ================= GAUNTLETED ARMS =================
  const lArm = m(box(0.17,0.42,0.18), bodyMat); lArm.position.set(-0.40,0.82,0);
  const rArm = m(box(0.17,0.42,0.18), bodyMat); rArm.position.set( 0.40,0.82,0);
  // forearm vambrace + rune
  const lFore = m(box(0.18,0.20,0.19), steel);  lFore.position.set(0,-0.26,0.02); lArm.add(lFore);
  const rFore = m(box(0.18,0.20,0.19), steel);  rFore.position.set(0,-0.26,0.02); rArm.add(rFore);
  const lVR = m(box(0.19,0.04,0.20), trimMat);  lVR.position.set(0,-0.20,0.02); lArm.add(lVR);
  const rVR = m(box(0.19,0.04,0.20), trimMat);  rVR.position.set(0,-0.20,0.02); rArm.add(rVR);
  // gauntlet fists
  const lFist = m(box(0.19,0.16,0.20), dark);   lFist.position.set(0,-0.40,0.03); lArm.add(lFist);
  const rFist = m(box(0.19,0.16,0.20), dark);   rFist.position.set(0,-0.40,0.03); rArm.add(rFist);
  g.add(lArm); g.add(rArm);

  // ================= GREAT-HELM (horned, visor slit, glowing eyes) =================
  const head = new T.Group(); head.position.set(0,1.06,0); g.add(head);
  const helm = m(box(0.30,0.30,0.30), bodyMat);  helm.position.set(0,0.10,0);  head.add(helm);
  // tapered crown
  const crown = m(cone(0.20,0.14,5), bodyMat);   crown.position.set(0,0.27,0); head.add(crown);
  // faceplate angled forward to a point
  const face = m(cone(0.21,0.26,4), steel);      face.position.set(0,0.08,0.06); face.rotation.x=Math.PI; head.add(face);
  // visor void (dark recessed band) + glowing eye slit
  const visor = m(box(0.26,0.08,0.06), dark);    visor.position.set(0,0.10,0.17); head.add(visor);
  const slit  = m(box(0.24,0.03,0.04), eyeMat);  slit.position.set(0,0.10,0.185); head.add(slit);
  const lEye  = m(box(0.06,0.05,0.04), eyeMat);  lEye.position.set(-0.07,0.105,0.19); head.add(lEye);
  const rEye  = m(box(0.06,0.05,0.04), eyeMat);  rEye.position.set( 0.07,0.105,0.19); head.add(rEye);
  // central crest fin
  const crest = m(box(0.05,0.18,0.20), bodyMat); crest.position.set(0,0.30,-0.02); head.add(crest);
  const crestRune = m(box(0.06,0.16,0.04), trimMat); crestRune.position.set(0,0.30,0.10); head.add(crestRune);
  // HORNS (curved out + up, two cones each)
  function horn(side){
    const grp = new T.Group(); grp.position.set(side*0.15,0.20,0);
    const base = m(cone(0.07,0.18,4), steel); base.position.set(side*0.06,0.04,0); base.rotation.z=side*-1.0; grp.add(base);
    const tip  = m(cone(0.05,0.18,4), bodyMat); tip.position.set(side*0.17,0.14,0); tip.rotation.z=side*-0.35; grp.add(tip);
    return grp;
  }
  head.add(horn(-1)); head.add(horn(1));

  // ================= SHORT TABARD + HALF-CAPE (back) =================
  const tabard = m(box(0.30,0.40,0.04), bodyMat); tabard.position.set(0,0.64,0.215); g.add(tabard);
  const tabRune = m(box(0.06,0.34,0.03), trimMat); tabRune.position.set(0,0.64,0.235); g.add(tabRune);
  const cape = m(box(0.46,0.50,0.05), steel);     cape.position.set(0,0.76,-0.22); cape.rotation.x=0.10; g.add(cape);
  const capeHem = m(box(0.46,0.05,0.06), trimMat); capeHem.position.set(0,0.53,-0.235); g.add(capeHem);

  // ================= MOUNTS =================
  const weaponMount = new T.Object3D(); weaponMount.position.set(0.42,0.55,0.12); g.add(weaponMount);
  const backMount   = new T.Object3D(); backMount.position.set(0,0.76,-0.20);     g.add(backMount);
  const headMount   = new T.Object3D(); headMount.position.set(0,1.55,0);          g.add(headMount);
  const chestMount  = new T.Object3D(); chestMount.position.set(0,0.72,0.18);      g.add(chestMount);
  const auraMount   = new T.Object3D(); auraMount.position.set(0,0.02,0);          g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
    bodyMat, trimMat, eyeMat,
    legs: [lThigh, rThigh],
    arms: [lArm, rArm],
    anim: (grp, now, moving)=>{
      // heavy breathing sway of cuirass + cape flap
      const t = now*0.002;
      const breathe = Math.sin(t)*0.02;
      cuirass.position.y = 0.84 + breathe;
      const flap = (moving ? 0.16 : 0.04);
      cape.rotation.x = 0.10 + Math.sin(t*1.6)*flap;
      tabard.rotation.x = Math.sin(t*1.6+0.3)*(flap*0.4);
    }
  };
  return g;
}

export function buildPlayer_mage(opts){
  // ---- UNIQUE recolor materials (engine recolors these live) ----
  const bodyMat = new T.MeshBasicMaterial({ color:0x2a2360, fog:true }); // -> robe (class color)
  const trimMat = new T.MeshBasicMaterial({ color:0x7ad6ff, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false }); // -> runes/focus (rarity accent)
  const eyeMat  = new T.MeshBasicMaterial({ color:0xbfeaff, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // -> eyes

  // A DIM unique body-tinted material for "shadow/fabric" parts. On the ADDITIVE
  // display, near-black (#0c0f18 via cached mat) renders as TRANSPARENT/invisible,
  // which would erase the hem & hood depth. Use a darker shade of the recolorable
  // body color instead so these surfaces still read as dim fabric. UNIQUE so the
  // engine can recolor it in step with the robe is NOT required (engine only
  // recolors bodyMat/trimMat/eyeMat), but a faint emitted value keeps it visible.
  const shadeMat = new T.MeshBasicMaterial({ color:0x14102e, fog:true }); // dim robe-shadow (visible on additive)

  const g = new T.Group();

  // ===================== ROBE (floor-length, no legs) =====================
  // wide tapered skirt: narrow at hips, flaring to the floor
  const skirt = m(geo('mage_skirt', ()=>cyl(0.20, 0.42, 0.86, 8)), bodyMat);
  skirt.position.y = 0.45;
  g.add(skirt);

  // hem ring (dim robe-shadow shade so the silhouette reads as a fabric edge)
  const hem = m(geo('mage_hem', ()=>cyl(0.44, 0.46, 0.06, 8)), shadeMat);
  hem.position.y = 0.05;
  g.add(hem);

  // glowing rune band around the hem
  const hemRune = m(geo('mage_hemrune', ()=>cyl(0.43, 0.43, 0.04, 8)), trimMat);
  hemRune.position.y = 0.16;
  g.add(hemRune);

  // upper torso / chest of robe (slimmer, fitted)
  const torso = m(geo('mage_torso', ()=>cyl(0.22, 0.20, 0.40, 8)), bodyMat);
  torso.position.y = 0.98;
  g.add(torso);

  // ===================== HIGH COLLAR (angular, flared up) =====================
  const collar = m(geo('mage_collar', ()=>cyl(0.26, 0.17, 0.22, 6)), bodyMat);
  collar.position.y = 1.20;
  g.add(collar);
  // collar inner shadow (frames the hood opening from below) - dim, not black
  const collarShade = m(geo('mage_collarsh', ()=>cyl(0.15, 0.13, 0.14, 6)), shadeMat);
  collarShade.position.y = 1.18;
  collarShade.position.z = 0.02;
  g.add(collarShade);

  // ===================== POINTED HOOD =====================
  // hood back/shell: a cone leaning slightly back, deep and pointed
  const hood = m(geo('mage_hood', ()=>cone(0.27, 0.46, 6)), bodyMat);
  hood.position.set(0, 1.46, -0.03);
  hood.rotation.x = -0.12;
  g.add(hood);

  // shadow inside the hood opening (face cavity) -> dim void (visible on additive)
  const hoodVoid = m(geo('mage_void', ()=>cone(0.155, 0.30, 6)), shadeMat);
  hoodVoid.position.set(0, 1.34, 0.10);
  hoodVoid.rotation.x = 0.30;
  g.add(hoodVoid);

  // hood brow/rune trim arc across the front of the hood
  const hoodTrim = m(geo('mage_hoodtrim', ()=>box(0.30, 0.04, 0.04)), trimMat);
  hoodTrim.position.set(0, 1.50, 0.16);
  hoodTrim.rotation.x = -0.20;
  g.add(hoodTrim);

  // glowing eyes deep inside the hood shadow
  const eyeL = m(geo('mage_eye', ()=>box(0.045, 0.05, 0.03)), eyeMat);
  const eyeR = m(geo('mage_eye', ()=>box(0.045, 0.05, 0.03)), eyeMat);
  eyeL.position.set(-0.06, 1.33, 0.16);
  eyeR.position.set( 0.06, 1.33, 0.16);
  g.add(eyeL); g.add(eyeR);

  // ===================== WIDE SLEEVES (arms) =====================
  // big bell sleeves: narrow at shoulder, flaring wide at the cuff
  const armL = m(geo('mage_sleeve', ()=>cyl(0.17, 0.10, 0.50, 6)), bodyMat);
  const armR = m(geo('mage_sleeve', ()=>cyl(0.17, 0.10, 0.50, 6)), bodyMat);
  armL.position.set(-0.30, 0.86, 0); armL.rotation.z =  0.16;
  armR.position.set( 0.30, 0.86, 0); armR.rotation.z = -0.16;
  g.add(armL); g.add(armR);
  // cuff rune rings at each wrist
  const cuffL = m(geo('mage_cuff', ()=>cyl(0.175, 0.175, 0.04, 6)), trimMat);
  const cuffR = m(geo('mage_cuff', ()=>cyl(0.175, 0.175, 0.04, 6)), trimMat);
  cuffL.position.set(-0.345, 0.62, 0); cuffL.rotation.z =  0.16;
  cuffR.position.set( 0.345, 0.62, 0); cuffR.rotation.z = -0.16;
  g.add(cuffL); g.add(cuffR);

  // pointed shoulder mantle (small angular cape over shoulders)
  const mantle = m(geo('mage_mantle', ()=>cone(0.32, 0.20, 6)), bodyMat);
  mantle.position.set(0, 1.06, -0.02);
  mantle.rotation.x = Math.PI; // flip so the cone points down over the shoulders
  g.add(mantle);

  // ===================== ARCANE TRIM RUNES down the robe =====================
  // central vertical rune stripe down the front of the robe
  const runeStripe = m(geo('mage_runestripe', ()=>box(0.05, 0.62, 0.04)), trimMat);
  runeStripe.position.set(0, 0.66, 0.205);
  runeStripe.rotation.x = 0.04;
  g.add(runeStripe);
  // three rune nodes glowing along the stripe
  for (let i=0;i<3;i++){
    const node = m(geo('mage_runenode', ()=>box(0.10, 0.06, 0.04)), trimMat);
    node.position.set(0, 0.50 + i*0.22, 0.215);
    g.add(node);
  }

  // ===================== SASH + FOCUS STONE =====================
  // diagonal sash across the chest (dim robe-shadow shade; readable on additive)
  const sash = m(geo('mage_sash', ()=>box(0.46, 0.10, 0.06)), shadeMat);
  sash.position.set(0, 0.84, 0.18);
  sash.rotation.z = 0.42;
  g.add(sash);
  // glowing focus stone set into the sash (chest front)
  const focus = m(geo('mage_focus', ()=>box(0.11, 0.13, 0.06)), trimMat);
  focus.position.set(0.04, 0.78, 0.215);
  focus.rotation.z = 0.78; // diamond
  g.add(focus);

  // ===================== FLOATING ARCANE MOTES (orbit in anim) =====================
  const mote1 = m(geo('mage_mote', ()=>box(0.06, 0.06, 0.06)), trimMat);
  const mote2 = m(geo('mage_mote', ()=>box(0.05, 0.05, 0.05)), trimMat);
  mote1.position.set(0.30, 1.00, 0.12);
  mote2.position.set(-0.28, 0.80, 0.10);
  g.add(mote1); g.add(mote2);

  // ===================== MOUNTS =====================
  const weaponMount = new T.Object3D();
  weaponMount.position.set(0.38, 0.56, 0.12); // right hand (staff points +Y)
  g.add(weaponMount);

  const backMount = new T.Object3D();
  backMount.position.set(0, 0.78, -0.18);
  g.add(backMount);

  const headMount = new T.Object3D();
  headMount.position.set(0, 1.74, 0); // above hood tip
  g.add(headMount);

  const chestMount = new T.Object3D();
  chestMount.position.set(0, 0.76, 0.18);
  g.add(chestMount);

  const auraMount = new T.Object3D();
  auraMount.position.set(0, 0.02, 0);
  g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
    bodyMat, trimMat, eyeMat,
    legs: [],                 // robed -> no walk-cycle legs
    arms: [armL, armR],       // sleeves swing
    anim: (grp, now, moving) => {
      const t = now * 0.001;
      // robe / sleeve sway
      const sway = Math.sin(t * 1.6) * (moving ? 0.10 : 0.05);
      skirt.rotation.z = sway * 0.5;
      hood.rotation.z  = -sway * 0.4;
      mantle.rotation.z = sway * 0.3;
      // subtle hem flare breathing
      const fl = 1 + Math.sin(t * 2.0) * 0.02;
      hem.scale.set(fl, 1, fl);
      // arcane motes orbiting the wizard
      const a1 = t * 1.4;
      mote1.position.set(Math.cos(a1) * 0.34, 1.00 + Math.sin(t * 2.2) * 0.06, Math.sin(a1) * 0.34 + 0.02);
      const a2 = -t * 1.1 + 2.1;
      mote2.position.set(Math.cos(a2) * 0.30, 0.86 + Math.sin(t * 1.7 + 1) * 0.05, Math.sin(a2) * 0.30 + 0.02);
      const pulse = 0.7 + Math.sin(t * 3.0) * 0.3;
      mote1.scale.setScalar(pulse);
      mote2.scale.setScalar(1.3 - pulse * 0.4);
    }
  };

  return g;
}

export function buildPlayer_ranger(opts){
  // ===== UNIQUE recolor materials (engine recolors these live; never cache) =====
  const bodyMat = new T.MeshBasicMaterial({ color:0x3a4d3b, fog:true }); // light leathers -> class color
  const trimMat = new T.MeshBasicMaterial({ color:0x9be86a, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false }); // rune/strap accents -> rarity
  const eyeMat  = new T.MeshBasicMaterial({ color:0x9be86a, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // eye glow

  // fixed dark cached parts
  const darkLeather = mat('#171c27'); // boots, deep hood shadow, harness leather
  const midLeather  = mat('#2a2f24'); // straps, bracers under-layer
  const shaftMat    = mat('#3b2c1c'); // arrow shafts (warm dark)

  const g = new T.Group();

  // ---------- LEGS (slim, agile) ----------
  // left leg
  const lLeg = new T.Group();
  const lThigh = m(box(0.135,0.30,0.16), bodyMat); lThigh.position.y = 0.40; lLeg.add(lThigh);
  const lShin  = m(box(0.115,0.24,0.145), midLeather); lShin.position.y = 0.16; lLeg.add(lShin);
  const lBoot  = m(box(0.14,0.10,0.21), darkLeather); lBoot.position.set(0,0.05,0.02); lLeg.add(lBoot);
  lLeg.position.set(-0.105,0,0);
  // right leg
  const rLeg = new T.Group();
  const rThigh = m(box(0.135,0.30,0.16), bodyMat); rThigh.position.y = 0.40; rLeg.add(rThigh);
  const rShin  = m(box(0.115,0.24,0.145), midLeather); rShin.position.y = 0.16; rLeg.add(rShin);
  const rBoot  = m(box(0.14,0.10,0.21), darkLeather); rBoot.position.set(0,0.05,0.02); rLeg.add(rBoot);
  rLeg.position.set(0.105,0,0);
  g.add(lLeg); g.add(rLeg);

  // ---------- HIPS / belt ----------
  const hips = m(box(0.34,0.12,0.21), bodyMat); hips.position.y = 0.60; g.add(hips);
  const beltGlow = m(box(0.36,0.035,0.225), trimMat); beltGlow.position.y = 0.605; g.add(beltGlow);

  // ---------- TORSO (lean, tapered) ----------
  const torso = m(box(0.36,0.40,0.24), bodyMat); torso.position.y = 0.85; g.add(torso);
  // tapered upper chest (narrower) for a lean read
  const chest = m(box(0.30,0.16,0.215), bodyMat); chest.position.set(0,1.0,0.01); g.add(chest);

  // ---------- CHEST HARNESS / crossing straps ----------
  const strapA = m(box(0.07,0.50,0.05), darkLeather);
  strapA.position.set(0,0.86,0.135); strapA.rotation.z = 0.42; g.add(strapA);
  const strapB = m(box(0.07,0.50,0.05), midLeather);
  strapB.position.set(0,0.86,0.135); strapB.rotation.z = -0.42; g.add(strapB);
  // small glowing harness clasp where straps cross
  const clasp = m(box(0.07,0.07,0.04), trimMat); clasp.position.set(0,0.86,0.16); g.add(clasp);

  // ---------- LAYERED SHORT CLOAK over ONE (left) shoulder ----------
  const cloak = new T.Group();
  // upper mantle slung over left shoulder
  const mantle = m(box(0.30,0.16,0.10), darkLeather);
  mantle.position.set(-0.10,1.02,-0.06); mantle.rotation.z = 0.18; cloak.add(mantle);
  // two layered drapes down the back-left, angled
  const drape1 = m(box(0.26,0.40,0.045), bodyMat);
  drape1.position.set(-0.12,0.78,-0.155); drape1.rotation.z = 0.10; cloak.add(drape1);
  const drape2 = m(box(0.20,0.30,0.045), darkLeather);
  drape2.position.set(-0.18,0.66,-0.135); drape2.rotation.z = 0.16; cloak.add(drape2);
  // faint glowing edge trim on the cloak hem
  const cloakEdge = m(box(0.27,0.035,0.05), trimMat);
  cloakEdge.position.set(-0.12,0.585,-0.155); cloakEdge.rotation.z = 0.10; cloak.add(cloakEdge);
  g.add(cloak);

  // ---------- ARMS (lean, with bracers) ----------
  const lArm = new T.Group();
  const lUpper = m(box(0.105,0.28,0.13), bodyMat); lUpper.position.y = -0.14; lArm.add(lUpper);
  const lFore  = m(box(0.095,0.20,0.12), midLeather); lFore.position.y = -0.34; lArm.add(lFore);
  const lBrace = m(box(0.11,0.10,0.13), darkLeather); lBrace.position.y = -0.33; lArm.add(lBrace);
  const lBraceGlow = m(box(0.115,0.025,0.135), trimMat); lBraceGlow.position.y = -0.30; lArm.add(lBraceGlow);
  lArm.position.set(-0.255,1.0,0);
  const rArm = new T.Group();
  const rUpper = m(box(0.105,0.28,0.13), bodyMat); rUpper.position.y = -0.14; rArm.add(rUpper);
  const rFore  = m(box(0.095,0.20,0.12), midLeather); rFore.position.y = -0.34; rArm.add(rFore);
  const rBrace = m(box(0.11,0.10,0.13), darkLeather); rBrace.position.y = -0.33; rArm.add(rBrace);
  const rBraceGlow = m(box(0.115,0.025,0.135), trimMat); rBraceGlow.position.y = -0.30; rArm.add(rBraceGlow);
  rArm.position.set(0.255,1.0,0);
  g.add(lArm); g.add(rArm);

  // ---------- NECK ----------
  const neck = m(box(0.12,0.08,0.12), midLeather); neck.position.y = 1.085; g.add(neck);

  // ---------- HEAD + LOW HOOD (face in shadow) ----------
  const head = m(box(0.20,0.20,0.20), darkLeather); head.position.y = 1.20; g.add(head);
  // hood: a low cone/peak pulled forward over the brow, body-colored outer
  const hoodOuter = m(cone(0.205,0.30,5), bodyMat); hoodOuter.position.set(0,1.27,-0.01); g.add(hoodOuter);
  // forward peak/brow that casts the face into shadow (juts toward +Z)
  const hoodPeak = m(box(0.22,0.14,0.14), bodyMat);
  hoodPeak.position.set(0,1.255,0.10); hoodPeak.rotation.x = -0.42; g.add(hoodPeak);
  // dark inner cowl (the shadowed face opening)
  const cowl = m(box(0.165,0.16,0.07), darkLeather); cowl.position.set(0,1.205,0.105); g.add(cowl);
  // hood back drape onto shoulders
  const hoodBack = m(box(0.24,0.18,0.07), bodyMat); hoodBack.position.set(0,1.18,-0.11); g.add(hoodBack);
  // single subtle hood-rim glow line at the brow edge
  const hoodGlow = m(box(0.17,0.02,0.03), trimMat); hoodGlow.position.set(0,1.275,0.155); hoodGlow.rotation.x = -0.42; g.add(hoodGlow);

  // ---------- GLOWING EYES (deep in the cowl shadow) ----------
  const lEye = m(box(0.045,0.045,0.03), eyeMat); lEye.position.set(-0.05,1.205,0.145); g.add(lEye);
  const rEye = m(box(0.045,0.045,0.03), eyeMat); rEye.position.set(0.05,1.205,0.145); g.add(rEye);

  // ---------- QUIVER across the back (angled) + arrows ----------
  const quiver = new T.Group();
  const tube = m(cyl(0.075,0.06,0.42,7), darkLeather); quiver.add(tube);
  const tubeBand = m(cyl(0.078,0.078,0.03,7), trimMat); tubeBand.position.y = 0.10; quiver.add(tubeBand);
  // arrow shafts poking out the top
  const aOff = [[-0.04,0.03],[0.04,-0.02],[0.0,0.05],[-0.02,-0.04]];
  for (let i=0;i<aOff.length;i++){
    const shaft = m(cyl(0.012,0.012,0.22,4), shaftMat);
    shaft.position.set(aOff[i][0],0.30,aOff[i][1]); shaft.rotation.z = (i-1.5)*0.07; quiver.add(shaft);
    const fletch = m(box(0.04,0.05,0.012), trimMat);
    fletch.position.set(aOff[i][0],0.40,aOff[i][1]); fletch.rotation.z = (i-1.5)*0.07; quiver.add(fletch);
  }
  // mount diagonally across the back (lower-right to upper-left), behind torso
  quiver.position.set(0.07,0.80,-0.165);
  quiver.rotation.z = 0.55; quiver.rotation.x = -0.16;
  g.add(quiver);

  // ---------- MOUNTS ----------
  const weaponMount = new T.Object3D(); weaponMount.position.set(0.40,0.56,0.12); g.add(weaponMount);
  const backMount   = new T.Object3D(); backMount.position.set(0,0.78,-0.18); g.add(backMount);
  const headMount   = new T.Object3D(); headMount.position.set(0,1.48,0); g.add(headMount);
  const chestMount  = new T.Object3D(); chestMount.position.set(0,0.74,0.17); g.add(chestMount);
  const auraMount   = new T.Object3D(); auraMount.position.set(0,0.02,0); g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
    bodyMat, trimMat, eyeMat,
    legs: [lLeg, rLeg],
    arms: [lArm, rArm],
    anim: (grp, now, moving) => {
      const t = now * 0.001;
      // light cloak sway: gentle when idle, more when moving
      const amp = moving ? 0.10 : 0.045;
      const sway = Math.sin(t * (moving ? 4.2 : 1.6)) * amp;
      cloak.rotation.z = sway * 0.5;
      cloak.rotation.x = -0.04 + Math.abs(sway) * 0.5;
      drape1.rotation.z = 0.10 + sway;
      drape2.rotation.z = 0.16 + sway * 1.2;
      // nimble idle bob of the whole rig
      grp.position.y = moving ? 0 : Math.sin(t * 1.8) * 0.012;
    }
  };
  return g;
}

export function buildPlayer_summoner(opts){
  const g = new T.Group();

  // --- UNIQUE recolor materials (engine recolors these live) ---
  const bodyMat = new T.MeshBasicMaterial({ color:0x2a2533, fog:true }); // dark robe -> class color
  const trimMat = new T.MeshBasicMaterial({ color:0x8a5cff, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false }); // runes/bone glow -> rarity accent
  const eyeMat  = new T.MeshBasicMaterial({ color:0x66ffd0, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // eyes

  // fixed dark cached parts
  const dark   = mat('#12101a');   // deepest shadow under robe / mask shadow
  const ash    = mat('#1c1826');   // shadowed cloth folds
  const bone   = mat('#d8d2c0');   // skull / ribs (opaque off-white, fogged)

  // ================= ROBE (legs hidden -> ragged hem) =================
  // Tapered robe column: narrow at shoulders, flaring to a wide ragged hem.
  // Hidden inner column (dark) so the silhouette reads solid from above.
  const innerCol = m(geo('summInner', ()=>cyl(0.16,0.30,1.02,6)), dark);
  innerCol.position.y = 0.52; g.add(innerCol);

  // Main robe body (tintable). Hexagonal, gothic, angular.
  const robe = m(geo('summRobe', ()=>cyl(0.20,0.40,0.90,6)), bodyMat);
  robe.position.y = 0.50; robe.rotation.y = Math.PI/6; g.add(robe);

  // Ragged hem: a ring of downward cone shards (tattered tatters), swayed in anim.
  const hemGroup = new T.Group(); hemGroup.position.y = 0.07; g.add(hemGroup);
  const tatterGeo = geo('summTatter', ()=>cone(0.085,0.34,3));
  const HEM_N = 9;
  for(let i=0;i<HEM_N;i++){
    const a = (i/HEM_N)*Math.PI*2;
    const r = 0.355;
    const t = m(tatterGeo, bodyMat);
    t.position.set(Math.cos(a)*r, 0.04, Math.sin(a)*r);
    t.rotation.x = Math.PI; // point down
    t.rotation.y = a;
    // slight outward lean + varied length feel via z-tilt
    t.rotation.z = Math.sin(a*1.7)*0.18;
    t.userData.baseRot = t.rotation.z;
    t.userData.phase = i*0.7;
    hemGroup.add(t);
  }
  // a couple of longer front tatters for raggedness
  const frontTatter = m(geo('summTatterLong', ()=>cone(0.07,0.46,3)), bodyMat);
  frontTatter.position.set(0.08,0.02,0.30); frontTatter.rotation.x = Math.PI; frontTatter.rotation.z = -0.12; hemGroup.add(frontTatter);

  // Layered over-robe / shawl draped on shoulders (darker cloth layer)
  const shawl = m(geo('summShawl', ()=>cyl(0.30,0.40,0.34,6)), ash);
  shawl.position.y = 0.84; shawl.rotation.y = Math.PI/6; g.add(shawl);

  // ================= HIGH JAGGED COLLAR =================
  // Tall spiky collar framing the head — signature necromancer silhouette.
  const collarGeo = geo('summCollarSpike', ()=>cone(0.07,0.34,3));
  const COL_N = 7;
  for(let i=0;i<COL_N;i++){
    const a = (-0.95 + (i/(COL_N-1))*1.9) - Math.PI/2; // back/side arc, open at front
    const r = 0.20;
    const sp = m(collarGeo, bodyMat);
    sp.position.set(Math.cos(a)*r, 1.00, Math.sin(a)*r - 0.02);
    // fan outward & upward toward a point above and behind the head
    sp.lookAt(Math.cos(a)*r*2.2, 1.42, Math.sin(a)*r*2.2 - 0.05);
    g.add(sp);
  }
  // glowing rune ring at collar base (accent)
  const collarRune = m(geo('summCollarRune', ()=>cyl(0.215,0.215,0.04,6)), trimMat);
  collarRune.position.y = 0.95; g.add(collarRune);

  // ================= SKELETAL CHEST / RIB ACCENTS =================
  // Exposed ribcage over the robe front (glowing accent bones).
  const ribGeo = geo('summRib', ()=>box(0.30,0.035,0.05));
  for(let i=0;i<4;i++){
    const ry = 0.62 + i*0.075;
    const rib = m(ribGeo, trimMat);
    rib.position.set(0, ry, 0.19);
    rib.scale.x = 1 - i*0.13; // taper toward bottom (chest -> belly)
    g.add(rib);
  }
  // sternum bar
  const sternum = m(geo('summSternum', ()=>box(0.04,0.30,0.05)), trimMat);
  sternum.position.set(0,0.71,0.195); g.add(sternum);

  // ================= HEAD: BONE SKULL HALF-MASK =================
  const headGroup = new T.Group(); g.add(headGroup);
  // Hooded shadow behind skull (dark cowl framing)
  const cowl = m(geo('summCowl', ()=>cone(0.22,0.40,6)), bodyMat);
  cowl.position.y = 1.22; cowl.rotation.y = Math.PI/6; headGroup.add(cowl);
  const cowlShadow = m(geo('summCowlInner', ()=>cyl(0.135,0.155,0.22,6)), dark);
  cowlShadow.position.set(0,1.16,0.04); headGroup.add(cowlShadow);

  // Skull cranium (bone, opaque)
  const skull = m(geo('summSkull', ()=>box(0.20,0.21,0.19)), bone);
  skull.position.set(0,1.14,0.06); headGroup.add(skull);
  // angular jaw / lower face
  const jaw = m(geo('summJaw', ()=>box(0.16,0.09,0.16)), bone);
  jaw.position.set(0,1.02,0.07); headGroup.add(jaw);
  // brow ridge (dark recess above eyes)
  const browShadow = m(geo('summBrow', ()=>box(0.20,0.045,0.02)), dark);
  browShadow.position.set(0,1.155,0.16); headGroup.add(browShadow);
  // cheek socket shadows (dark)
  const socketGeo = geo('summSocket', ()=>box(0.06,0.07,0.02));
  const socL = m(socketGeo, dark); socL.position.set(-0.05,1.12,0.155); headGroup.add(socL);
  const socR = m(socketGeo, dark); socR.position.set( 0.05,1.12,0.155); headGroup.add(socR);
  // nasal cavity
  const nasal = m(geo('summNasal', ()=>box(0.025,0.05,0.02)), dark);
  nasal.position.set(0,1.06,0.155); headGroup.add(nasal);
  // teeth bar
  const teeth = m(geo('summTeeth', ()=>box(0.11,0.03,0.02)), bone);
  teeth.position.set(0,1.0,0.15); headGroup.add(teeth);

  // ===== eerie glowing eyes (deep in sockets) =====
  const eyeGeo = geo('summEye', ()=>box(0.045,0.05,0.03));
  const eyeL = m(eyeGeo, eyeMat); eyeL.position.set(-0.05,1.12,0.165); headGroup.add(eyeL);
  const eyeR = m(eyeGeo, eyeMat); eyeR.position.set( 0.05,1.12,0.165); headGroup.add(eyeR);
  // faint eye-glow halo (unique animated material -> stays its own glow)
  const eyeHalo = new T.Mesh(geo('summEyeHalo', ()=>box(0.18,0.06,0.005)),
    new T.MeshBasicMaterial({ color:0x66ffd0, fog:false, transparent:true, opacity:0.25, blending:T.AdditiveBlending, depthWrite:false }));
  eyeHalo.position.set(0,1.12,0.178); headGroup.add(eyeHalo);

  // ================= ARMS (wide tattered sleeves) =================
  // bell sleeves -> cones flaring downward, with skeletal hands.
  const sleeveGeo = geo('summSleeve', ()=>cyl(0.13,0.07,0.42,5));
  const armL = m(sleeveGeo, bodyMat);
  armL.position.set(-0.30,0.66,0); g.add(armL);
  const armR = m(sleeveGeo, bodyMat);
  armR.position.set( 0.30,0.66,0); g.add(armR);
  // sleeve rune cuffs (accent)
  const cuffGeo = geo('summCuff', ()=>cyl(0.135,0.135,0.03,5));
  const cuffL = m(cuffGeo, trimMat); cuffL.position.set(-0.30,0.46,0); g.add(cuffL);
  const cuffR = m(cuffGeo, trimMat); cuffR.position.set( 0.30,0.46,0); g.add(cuffR);
  // skeletal hands (bone)
  const handGeo = geo('summHand', ()=>box(0.07,0.09,0.06));
  const handL = m(handGeo, bone); handL.position.set(-0.30,0.42,0.02); g.add(handL);
  const handR = m(handGeo, bone); handR.position.set( 0.30,0.42,0.02); g.add(handR);

  // ================= FLOATING SKULL MOTE (orbits, anim) =================
  const moteGroup = new T.Group(); g.add(moteGroup);
  const skullMote = new T.Group();
  const moteSkull = m(geo('summMoteSkull', ()=>box(0.085,0.09,0.085)), bone);
  skullMote.add(moteSkull);
  const moteJaw = m(geo('summMoteJaw', ()=>box(0.07,0.035,0.07)), bone);
  moteJaw.position.y = -0.06; skullMote.add(moteJaw);
  const moteEyeGeo = geo('summMoteEye', ()=>box(0.022,0.025,0.02));
  const meL = m(moteEyeGeo, trimMat); meL.position.set(-0.022,0.005,0.045); skullMote.add(meL);
  const meR = m(moteEyeGeo, trimMat); meR.position.set( 0.022,0.005,0.045); skullMote.add(meR);
  skullMote.position.set(0.30,1.18,0); // initial orbit pos
  moteGroup.add(skullMote);

  // a couple of free-floating bone shards orbiting
  const shardGeo = geo('summShard', ()=>cone(0.03,0.16,3));
  const shardA = m(shardGeo, bone); shardA.position.set(-0.30,1.05,0.05); moteGroup.add(shardA);
  const shardB = m(shardGeo, bone); shardB.position.set(0.18,1.30,-0.06); moteGroup.add(shardB);

  // ================= MOUNTS =================
  const weaponMount = new T.Object3D(); weaponMount.position.set(0.40,0.56,0.12); g.add(weaponMount);
  const backMount   = new T.Object3D(); backMount.position.set(0,0.78,-0.18); g.add(backMount);
  const headMount   = new T.Object3D(); headMount.position.set(0,1.30,0); g.add(headMount);
  const chestMount  = new T.Object3D(); chestMount.position.set(0,0.72,0.18); g.add(chestMount);
  const auraMount   = new T.Object3D(); auraMount.position.set(0,0.02,0); g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
    bodyMat, trimMat, eyeMat,
    legs: [],                 // robed class -> no leg walk cycle
    arms: [armL, armR],
    anim: (grp, now, moving)=>{
      const t = now*0.001;
      // robe hem sway (gentle, more when moving)
      const sway = moving ? 0.22 : 0.09;
      const kids = hemGroup.children;
      for(let i=0;i<kids.length;i++){
        const c = kids[i];
        const ph = c.userData.phase || 0;
        const base = c.userData.baseRot || 0;
        c.rotation.z = base + Math.sin(t*1.6 + ph)*sway;
        c.rotation.x = Math.PI + Math.sin(t*1.3 + ph)*sway*0.4;
      }
      // whole robe subtle breathing tilt
      robe.rotation.z = Math.sin(t*0.9)*0.02;
      shawl.rotation.z = Math.sin(t*0.9)*0.02;
      // sleeve sway
      armL.rotation.z = Math.sin(t*1.4)*0.06 + 0.04;
      armR.rotation.z = -Math.sin(t*1.4)*0.06 - 0.04;
      // floating skull mote orbit around head
      const oa = t*0.9;
      skullMote.position.set(Math.cos(oa)*0.32, 1.18 + Math.sin(t*1.7)*0.05, Math.sin(oa)*0.32 - 0.02);
      skullMote.rotation.y = -oa + Math.PI/2;
      moteJaw.position.y = -0.055 - (Math.sin(t*4)*0.5+0.5)*0.02; // chattering jaw
      // bone shards drift
      shardA.position.y = 1.05 + Math.sin(t*1.5)*0.05;
      shardA.rotation.z = t*0.8;
      shardB.position.y = 1.30 + Math.cos(t*1.3)*0.05;
      shardB.rotation.z = -t*0.9;
      // eye flicker (necromantic pulse)
      const pulse = 0.7 + (Math.sin(t*3)*0.5+0.5)*0.3;
      eyeMat.opacity = pulse;
      eyeHalo.material.opacity = 0.18 + (Math.sin(t*3)*0.5+0.5)*0.18;
    }
  };

  return g;
}


// =============================================================
// UPGRADED BOSS MODELS (workflow) — impressive lich/archdemon/voidlord/wyrm.
// =============================================================

export function buildEnemy_caster(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const g = new T.Group();
  // material palette — dark fogged robe shades + selective additive glow.
  // NOTE: additive display = black is invisible, so the "dark" staff/cowl use
  // muted-but-non-black opaque tones so they still read as silhouette mass.
  const robe = mat(c, 0.4);            // main robe
  const robeDeep = mat(c, 0.24);       // shadowed under-folds / cowl interior trim
  const robeMid = mat(c, 0.55);        // mantle / lighter accent cloth
  const bone = mat('#cfc6b0');         // skeletal face + claws
  const boneDark = mat('#6d6552');     // shadowed bone
  const wood = mat('#3a2c1d');         // gnarled staff (warm dark-bronze, reads on additive)
  const woodLit = mat('#5c4630');      // staff highlights / cage (brighter so it catches light)
  const glow = matAdd(c, 0.95);        // runes, face glow, motes
  const glowSoft = matAdd(c, 0.6);     // softer aura/orb shell

  // ============================================================
  // ROBE — tall, floor-length, no legs. Wide hem flares to a narrow chest.
  // base ~1.55 tall before engine x1.6 -> imposing tower.
  // ============================================================
  const hem = m(cyl(0.2, 0.52, 0.9, 6), robeDeep); hem.position.y = 0.45; hem.rotation.y = Math.PI / 6;
  const skirtOver = m(cyl(0.16, 0.4, 0.46, 6), robe); skirtOver.position.y = 0.78; skirtOver.rotation.y = Math.PI / 6;
  const torso = m(cyl(0.15, 0.22, 0.4, 6), robe); torso.position.y = 1.16; torso.rotation.y = Math.PI / 6;
  // angular front panel of the robe (a flat prism the runes sit on)
  const panel = m(box(0.26, 0.74, 0.05), robeMid); panel.position.set(0, 0.78, 0.24);

  // ============================================================
  // SHOULDER MANTLE — broad ornate gothic shoulders (the regal silhouette)
  // ============================================================
  const collar = m(cyl(0.26, 0.32, 0.14, 6), robeMid); collar.position.y = 1.38;
  const mantleL = m(cone(0.22, 0.3, 4), robeMid); mantleL.position.set(-0.32, 1.42, 0); mantleL.rotation.set(0, Math.PI / 4, 0.7);
  const mantleR = m(cone(0.22, 0.3, 4), robeMid); mantleR.position.set(0.32, 1.42, 0); mantleR.rotation.set(0, Math.PI / 4, -0.7);
  // mantle spikes — sharp ornamental points rising off the shoulders
  const spikeL = m(cone(0.05, 0.26, 4), robeDeep); spikeL.position.set(-0.34, 1.62, 0); spikeL.rotation.z = 0.5;
  const spikeR = m(cone(0.05, 0.26, 4), robeDeep); spikeR.position.set(0.34, 1.62, 0); spikeR.rotation.z = -0.5;
  const gemL = m(box(0.06, 0.06, 0.06), glow); gemL.position.set(-0.32, 1.48, 0.06);
  const gemR = m(box(0.06, 0.06, 0.06), glow); gemR.position.set(0.32, 1.48, 0.06);

  // ============================================================
  // HOODED COWL — deep faceted cowl, dark interior, sliver of skeletal face
  // ============================================================
  const hood = m(cone(0.26, 0.46, 5), robe); hood.position.y = 1.7; hood.rotation.y = Math.PI / 5;
  const hoodBack = m(cone(0.22, 0.3, 4), robeDeep); hoodBack.position.set(0, 1.74, -0.1); hoodBack.rotation.x = -0.3;
  const cowlDark = m(box(0.22, 0.24, 0.06), mat(c, 0.18)); cowlDark.position.set(0, 1.56, 0.14);
  // skeletal face — gaunt skull plane + brow, just catching the light
  const skull = m(box(0.13, 0.17, 0.08), boneDark); skull.position.set(0, 1.57, 0.15);
  const jaw = m(cone(0.07, 0.1, 4), bone); jaw.position.set(0, 1.47, 0.16); jaw.rotation.x = Math.PI;
  const brow = m(box(0.16, 0.04, 0.04), bone); brow.position.set(0, 1.63, 0.17);
  // intense eyes — twin hot motes deep in the cowl
  const eyeL = m(box(0.035, 0.045, 0.03), glow); eyeL.position.set(-0.045, 1.58, 0.18);
  const eyeR = m(box(0.035, 0.045, 0.03), glow); eyeR.position.set(0.045, 1.58, 0.18);

  // ============================================================
  // ARMS + SKELETAL CLAWED HANDS — raised, gripping the staff out front
  // ============================================================
  const armL = m(box(0.08, 0.5, 0.09), robe); armL.position.set(-0.24, 1.16, 0.14); armL.rotation.set(0.6, 0, 0.32);
  const armR = m(box(0.08, 0.5, 0.09), robe); armR.position.set(0.24, 1.04, 0.18); armR.rotation.set(0.9, 0, -0.28);
  const cuffL = m(cone(0.1, 0.14, 5), robeMid); cuffL.position.set(-0.3, 0.98, 0.24); cuffL.rotation.x = 0.6;
  const cuffR = m(cone(0.1, 0.14, 5), robeMid); cuffR.position.set(0.3, 0.82, 0.3); cuffR.rotation.x = 0.9;
  // bony hands (small palm + splayed claw fingers)
  const handL = m(box(0.07, 0.07, 0.05), bone); handL.position.set(-0.3, 0.88, 0.3);
  const handR = m(box(0.07, 0.07, 0.05), bone); handR.position.set(0.3, 0.72, 0.36);
  const clawL = m(cone(0.03, 0.1, 4), bone); clawL.position.set(-0.3, 0.96, 0.32); clawL.rotation.x = 0.3;
  const clawR = m(cone(0.03, 0.1, 4), bone); clawR.position.set(0.3, 0.8, 0.38); clawR.rotation.x = 0.3;

  // ============================================================
  // GNARLED STAFF — tall leaning shaft, kinked node, claw-cage holding a big orb
  // ============================================================
  const staff = m(cyl(0.03, 0.045, 1.5, 5), wood); staff.position.set(0.3, 0.78, 0.34); staff.rotation.x = 0.12;
  const knot1 = m(box(0.08, 0.08, 0.08), woodLit); knot1.position.set(0.31, 0.96, 0.32); knot1.rotation.set(0.4, 0, 0.5);
  const knot2 = m(box(0.07, 0.07, 0.07), woodLit); knot2.position.set(0.33, 1.28, 0.36); knot2.rotation.set(0.3, 0.4, 0.6);
  // claw cage cradling the focus orb at the top of the staff
  const cage = m(cone(0.16, 0.26, 4), woodLit); cage.position.set(0.35, 1.62, 0.4); cage.rotation.x = 0.1;
  const cageClaw1 = m(cone(0.03, 0.18, 4), woodLit); cageClaw1.position.set(0.28, 1.74, 0.4); cageClaw1.rotation.z = 0.5;
  const cageClaw2 = m(cone(0.03, 0.18, 4), woodLit); cageClaw2.position.set(0.42, 1.74, 0.4); cageClaw2.rotation.z = -0.5;
  // the big glowing focus — soft outer shell + faceted core + hot center
  const orbShell = m(geo('lichOrbShell', () => new T.IcosahedronGeometry(0.17, 0)), glowSoft);
  orbShell.position.set(0.35, 1.78, 0.4);
  const orb = m(geo('lichOrb', () => new T.IcosahedronGeometry(0.12, 0)), glow);
  orb.position.set(0.35, 1.78, 0.4);
  // unique animated core material (opacity pulsed per frame -> must NOT be cached)
  const coreMat = new T.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const orbCore = m(box(0.06, 0.06, 0.06), coreMat); orbCore.position.set(0.35, 1.78, 0.4);

  // ============================================================
  // ARCANE RUNES — glowing glyphs marching down the front robe panel
  // ============================================================
  const runes = [];
  const runeGeoKeys = ['lichRuneA', 'lichRuneB', 'lichRuneC'];
  for (let i = 0; i < 4; i++) {
    const ry = 1.04 - i * 0.2;
    const rk = runeGeoKeys[i % 3];
    const rune = m(geo(rk, () => new T.BoxGeometry(0.07 + (rk.charCodeAt(8) % 3) * 0.015, 0.05, 0.02)), glow);
    rune.position.set(0, ry, 0.27);
    rune.userData.baseY = ry;
    g.add(rune); runes.push(rune);
  }

  // ============================================================
  // ORBITING ENERGY MOTES — a few bright motes circling the staff orb
  // ============================================================
  const motes = [];
  const orbCenter = { x: 0.35, y: 1.78, z: 0.4 };
  for (let i = 0; i < 3; i++) {
    const mote = m(geo('lichMote', () => new T.OctahedronGeometry(0.04, 0)), glow);
    mote.userData.ang = (i / 3) * Math.PI * 2;
    mote.userData.rad = 0.3 + (i % 2) * 0.06;
    mote.userData.tilt = i * 0.5;
    g.add(mote); motes.push(mote);
  }

  // hovering aura pool at the feet (additive, hugs the ground for the floaty read)
  const aura = m(cyl(0.1, 0.5, 0.05, 6), glowSoft); aura.position.y = 0.03;

  g.add(
    hem, skirtOver, torso, panel,
    collar, mantleL, mantleR, spikeL, spikeR, gemL, gemR,
    hood, hoodBack, cowlDark, skull, jaw, brow, eyeL, eyeR,
    armL, armR, cuffL, cuffR, handL, handR, clawL, clawR,
    staff, knot1, knot2, cage, cageClaw1, cageClaw2,
    orbShell, orb, orbCore, aura
  );

  // store the cluster of parts that float together as one body
  const floaters = [
    hem, skirtOver, torso, panel, collar, mantleL, mantleR, spikeL, spikeR,
    gemL, gemR, hood, hoodBack, cowlDark, skull, jaw, brow, eyeL, eyeR,
    armL, armR, cuffL, cuffR, handL, handR, clawL, clawR,
    staff, knot1, knot2, cage, cageClaw1, cageClaw2, orbShell, orb, orbCore
  ];
  const baseY = floaters.map((o) => o.position.y);
  for (let i = 0; i < runes.length; i++) { floaters.push(runes[i]); baseY.push(runes[i].position.y); }

  g.userData.anim = (grp, now) => {
    // slow ominous float bob of the whole sorcerer
    const bob = Math.sin(now / 760) * 0.05;
    for (let i = 0; i < floaters.length; i++) floaters[i].position.y = baseY[i] + bob;

    // pulsing focus orb — scale on the cached glow, opacity on the unique core
    const p = Math.sin(now / 300);
    orbShell.scale.setScalar(1 + p * 0.14);
    orb.scale.setScalar(1 + p * 0.1);
    orbCore.scale.setScalar(1 + p * 0.35);
    coreMat.opacity = 0.7 + (p * 0.5 + 0.5) * 0.3;

    // intense eyes flicker subtly with the orb
    eyeL.scale.setScalar(1 + p * 0.18);
    eyeR.scale.setScalar(1 + p * 0.18);

    // runes shimmer in a downward cascade
    for (let i = 0; i < runes.length; i++) {
      runes[i].scale.setScalar(0.8 + 0.4 * (Math.sin(now / 360 - i * 0.9) * 0.5 + 0.5));
    }

    // orbiting energy motes circling the staff orb (motes float with the bob too)
    const oy = orbCenter.y + bob;
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i], ud = mt.userData;
      const a = ud.ang + now / 620;
      mt.position.set(
        orbCenter.x + Math.cos(a) * ud.rad,
        oy + Math.sin(a + ud.tilt) * 0.1,
        orbCenter.z + Math.sin(a) * ud.rad
      );
      mt.scale.setScalar(0.8 + 0.4 * Math.sin(now / 240 + i));
    }

    // slow hooded sway for menace
    hood.rotation.z = Math.sin(now / 1100) * 0.04;
    hoodBack.rotation.z = hood.rotation.z;
  };

  return g;
}

export function buildEnemy_demon(opts) {
  const c = (opts && opts.color) || '#7a1f2b';
  const g = new T.Group();
  // body assembled in an inner group authored at tall coords (~2.6),
  // then scaled to BASE height ~1.5 (engine scales bosses x1.6 -> ~2.4 final).
  const body = new T.Group();

  // static cached materials (hulking gothic hide + bone).
  // additive display: black=transparent, so keep every tone clearly emissive — no near-black.
  const hide = mat(c, 0.5);
  const hideDark = mat(c, 0.34);
  const hideMid = mat(c, 0.64);
  const horn = mat('#6b5236');     // warm bone, bright enough to read on additive
  const hoof = mat('#4a3526');     // dark bronze, still visible (not near-black)
  const spike = mat(c, 0.82);
  const ember = matAdd('#ff8a2e', 0.85);
  // UNIQUE animated glow materials (never cached — recolored/scaled per frame)
  const coreMat = new T.MeshBasicMaterial({ color: '#ff6a1e', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const coreHotMat = new T.MeshBasicMaterial({ color: '#ffd070', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const eyeMat = new T.MeshBasicMaterial({ color: '#ff3a14', fog: false, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });

  // ---- hooved / clawed legs (thick, slightly splayed) ----
  const thighL = m(box(0.26, 0.5, 0.3), hideMid); thighL.position.set(-0.26, 0.66, -0.02); thighL.rotation.z = 0.08;
  const thighR = m(box(0.26, 0.5, 0.3), hideMid); thighR.position.set(0.26, 0.66, -0.02); thighR.rotation.z = -0.08;
  const shinL = m(box(0.2, 0.42, 0.24), hideDark); shinL.position.set(-0.28, 0.28, 0.06);
  const shinR = m(box(0.2, 0.42, 0.24), hideDark); shinR.position.set(0.28, 0.28, 0.06);
  // cloven hooves at the feet (cones, base at ground)
  const hoofL = m(cone(0.13, 0.22, 4), hoof); hoofL.position.set(-0.28, 0.11, 0.1); hoofL.rotation.set(0.1, 0.78, 0);
  const hoofR = m(cone(0.13, 0.22, 4), hoof); hoofR.position.set(0.28, 0.11, 0.1); hoofR.rotation.set(0.1, 0.78, 0);
  // foot claws
  const tcL = m(cone(0.05, 0.16, 3), spike); tcL.position.set(-0.28, 0.06, 0.26); tcL.rotation.x = 1.45;
  const tcR = m(cone(0.05, 0.16, 3), spike); tcR.position.set(0.28, 0.06, 0.26); tcR.rotation.x = 1.45;

  // ---- heavy hulking torso ----
  const hips = m(box(0.6, 0.26, 0.4), hideDark); hips.position.set(0, 0.96, 0);
  const torso = m(box(0.66, 0.6, 0.46), hide); torso.position.set(0, 1.34, 0);
  // angular pectoral / ridged chest prism
  const pec = m(cone(0.36, 0.5, 4), hideMid); pec.position.set(0, 1.32, 0.1); pec.rotation.set(Math.PI / 2, Math.PI / 4, 0); pec.scale.set(1, 1, 0.55);
  // upper trapezius mass bridging to the neck
  const traps = m(box(0.5, 0.22, 0.34), hideMid); traps.position.set(0, 1.66, -0.02);

  // ---- molten chest core (layered glow) ----
  const coreSocket = m(box(0.26, 0.28, 0.14), hideDark); coreSocket.position.set(0, 1.36, 0.2);
  const core = m(geo('demonCoreOct', () => new T.OctahedronGeometry(0.16, 0)), coreMat); core.position.set(0, 1.36, 0.28);
  const coreHot = m(geo('demonCoreHot', () => new T.OctahedronGeometry(0.08, 0)), coreHotMat); coreHot.position.set(0, 1.36, 0.3);
  // ember motes leaking from chest ridge
  const em1 = m(box(0.05, 0.05, 0.03), ember); em1.position.set(-0.12, 1.5, 0.24);
  const em2 = m(box(0.045, 0.045, 0.03), ember); em2.position.set(0.13, 1.18, 0.24);

  // ---- broad jagged shoulders with spikes ----
  const shL = m(cone(0.26, 0.4, 4), hideMid); shL.position.set(-0.48, 1.62, 0); shL.rotation.z = 0.85;
  const shR = m(cone(0.26, 0.4, 4), hideMid); shR.position.set(0.48, 1.62, 0); shR.rotation.z = -0.85;
  const spkSL = m(cone(0.07, 0.34, 4), spike); spkSL.position.set(-0.56, 1.82, -0.02); spkSL.rotation.set(-0.2, 0, 0.55);
  const spkSR = m(cone(0.07, 0.34, 4), spike); spkSR.position.set(0.56, 1.82, -0.02); spkSR.rotation.set(-0.2, 0, -0.55);

  // ---- thick clawed arms ----
  const armL = m(box(0.2, 0.62, 0.22), hideMid); armL.position.set(-0.56, 1.26, 0.04); armL.rotation.z = 0.18;
  const armR = m(box(0.2, 0.62, 0.22), hideMid); armR.position.set(0.56, 1.26, 0.04); armR.rotation.z = -0.18;
  const foreL = m(box(0.18, 0.4, 0.2), hideDark); foreL.position.set(-0.64, 0.86, 0.12); foreL.rotation.z = 0.3;
  const foreR = m(box(0.18, 0.4, 0.2), hideDark); foreR.position.set(0.64, 0.86, 0.12); foreR.rotation.z = -0.3;
  // clawed hands (cluster of talon cones)
  const clawL = [];
  const clawR = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.07;
    const cl = m(cone(0.05, 0.24, 3), spike); cl.position.set(-0.72 + off * 0.3, 0.6, 0.18 + off); cl.rotation.set(0.7, 0, 0.35);
    const cr = m(cone(0.05, 0.24, 3), spike); cr.position.set(0.72 - off * 0.3, 0.6, 0.18 + off); cr.rotation.set(0.7, 0, -0.35);
    clawL.push(cl); clawR.push(cr);
  }

  // ---- spine spikes running down the back ----
  const spineSpikes = [];
  for (let i = 0; i < 4; i++) {
    const sp = m(cone(0.06 - i * 0.008, 0.3 - i * 0.04, 4), spike);
    sp.position.set(0, 1.6 - i * 0.26, -0.24 + i * 0.02);
    sp.rotation.x = -0.5;
    spineSpikes.push(sp);
  }

  // ---- fanged horned head ----
  const neck = m(cyl(0.13, 0.16, 0.16, 6), hideDark); neck.position.set(0, 1.78, 0.02);
  const head = m(box(0.34, 0.3, 0.32), hide); head.position.set(0, 1.96, 0.04);
  // jutting brow/snout
  const snout = m(cone(0.18, 0.26, 4), hideMid); snout.position.set(0, 1.9, 0.2); snout.rotation.set(Math.PI / 2, Math.PI / 4, 0); snout.scale.set(1, 1, 0.55);
  // blazing eyes
  const eyeL = m(box(0.07, 0.06, 0.04), eyeMat); eyeL.position.set(-0.09, 2.0, 0.2);
  const eyeR = m(box(0.07, 0.06, 0.04), eyeMat); eyeR.position.set(0.09, 2.0, 0.2);
  // lower jaw + fangs
  const jaw = m(box(0.24, 0.08, 0.2), hideDark); jaw.position.set(0, 1.84, 0.16);
  const fangs = [];
  for (let i = 0; i < 4; i++) {
    const fx = (i < 2 ? -1 : 1) * (0.04 + (i % 2) * 0.06);
    const fg = m(cone(0.025, 0.1, 3), spike); fg.position.set(fx, 1.82, 0.24); fg.rotation.x = Math.PI;
    fangs.push(fg);
  }
  // MASSIVE curved crowning horns (two-segment for a sweeping curve)
  const hbL = m(cone(0.1, 0.4, 4), horn); hbL.position.set(-0.16, 2.2, -0.04); hbL.rotation.set(-0.25, 0, 0.6);
  const hbR = m(cone(0.1, 0.4, 4), horn); hbR.position.set(0.16, 2.2, -0.04); hbR.rotation.set(-0.25, 0, -0.6);
  const htL = m(cone(0.06, 0.34, 4), horn); htL.position.set(-0.34, 2.5, -0.06); htL.rotation.set(-0.5, 0, 1.0);
  const htR = m(cone(0.06, 0.34, 4), horn); htR.position.set(0.34, 2.5, -0.06); htR.rotation.set(-0.5, 0, -1.0);
  // smaller secondary horns
  const h2L = m(cone(0.05, 0.2, 4), horn); h2L.position.set(-0.06, 2.16, 0.06); h2L.rotation.set(0.2, 0, 0.3);
  const h2R = m(cone(0.05, 0.2, 4), horn); h2R.position.set(0.06, 2.16, 0.06); h2R.rotation.set(0.2, 0, -0.3);

  // ---- LARGE bat-like wings spread wide behind ----
  const wingL = new T.Group(); wingL.position.set(-0.36, 1.5, -0.2);
  const wingR = new T.Group(); wingR.position.set(0.36, 1.5, -0.2);
  // membrane (flattened cone) + bony spars + finger claws, built in local space then pivoted
  const buildWing = (grp, sign) => {
    const memb = m(cone(0.6, 1.5, 3), hideDark); memb.position.set(sign * 0.7, 0.1, -0.12); memb.rotation.set(Math.PI / 2, 0, sign * (Math.PI / 2 + 0.1)); memb.scale.set(1, 0.5, 1);
    const spar = m(cyl(0.04, 0.06, 1.3, 4), horn); spar.position.set(sign * 0.62, 0.4, -0.1); spar.rotation.z = sign * 1.15;
    const spar2 = m(cyl(0.03, 0.045, 0.9, 4), horn); spar2.position.set(sign * 0.5, -0.16, -0.1); spar2.rotation.z = sign * 0.7;
    const tip = m(cone(0.04, 0.2, 3), spike); tip.position.set(sign * 1.24, 0.62, -0.1); tip.rotation.z = sign * -0.6;
    grp.add(memb, spar, spar2, tip);
  };
  buildWing(wingL, -1);
  buildWing(wingR, 1);

  body.add(thighL, thighR, shinL, shinR, hoofL, hoofR, tcL, tcR,
    hips, torso, pec, traps, coreSocket, core, coreHot, em1, em2,
    shL, shR, spkSL, spkSR, armL, armR, foreL, foreR,
    neck, head, snout, eyeL, eyeR, jaw,
    hbL, hbR, htL, htR, h2L, h2R, wingL, wingR);
  for (const cl of clawL) body.add(cl);
  for (const cr of clawR) body.add(cr);
  for (const sp of spineSpikes) body.add(sp);
  for (const fg of fangs) body.add(fg);

  // scale whole figure down to BASE height ~1.5 (authored ~2.6 tall).
  // feet stay at y=0 since the inner group's origin sits at the feet.
  body.scale.setScalar(0.57);
  g.add(body);

  g.userData.anim = (grp, now) => {
    // slow heavy wing flap
    const flap = Math.sin(now / 620) * 0.3;
    wingL.rotation.z = flap; wingR.rotation.z = -flap;
    wingL.rotation.y = 0.15 + Math.sin(now / 620) * 0.12;
    wingR.rotation.y = -0.15 - Math.sin(now / 620) * 0.12;
    // molten chest core pulse
    const pulse = (Math.sin(now / 300) + 1) * 0.5; // 0..1
    const s = 1 + pulse * 0.28;
    core.scale.setScalar(s);
    coreHot.scale.setScalar(1 + pulse * 0.5);
    coreMat.opacity = 0.7 + pulse * 0.3;
    em1.position.y = 1.5 + pulse * 0.08;
    em2.position.y = 1.18 + (1 - pulse) * 0.08;
    // smoldering eye flicker
    const flick = 0.85 + Math.sin(now / 140) * 0.15;
    eyeMat.opacity = flick;
    // ponderous idle sway + breathing
    grp.rotation.z = Math.sin(now / 900) * 0.025;
    grp.position.y = Math.sin(now / 560) * 0.03;
  };
  return g;
}

export function buildEnemy_voidlord(opts){
  const c = (opts && opts.color) || '#b14dff';
  const g = new T.Group();

  // ---- materials ----
  // ADDITIVE display: opaque near-black mat() would be invisible. Structural
  // masses use DIM additive glow so the silhouette actually reads, while
  // bright accents pop. A genuinely dark slit (pupil) is the ONE exception:
  // on additive, dark = transparent = a real void gap, which is exactly the look.
  const shellGlow  = matAdd(c, 0.30);        // body/lobe shell (dim theme glow)
  const spikeGlow  = matAdd(c, 0.34);        // tendrils / crown / shards
  const glowC      = matAdd(c, 0.6);         // bright theme accents
  const glowDim    = matAdd(c, 0.30);        // dim halo
  const shardGlow  = matAdd(0xe8d0ff, 0.55); // pale crystalline shard edges
  const voidSlit   = matAdd(0x05010a, 0.85); // near-black = transparent gap (slit)

  // overall: author a touch smaller so base height lands ~1.5 (engine x1.6 -> ~2.4)
  const RIG = new T.Group();
  RIG.scale.set(0.74, 0.74, 0.74);
  g.add(RIG);

  // ---------------------------------------------------------------
  // CENTRAL VOID MASS — irregular clustered hovering body
  // ---------------------------------------------------------------
  const bodyY = 1.12;
  const core = new T.Group();
  core.position.y = bodyY;
  RIG.add(core);

  const massTop = m(geo('vl_massT', () => cone(0.62, 0.7, 7)), shellGlow);
  massTop.position.y = 0.18;
  core.add(massTop);
  const massBot = m(geo('vl_massB', () => cone(0.66, 0.62, 7)), shellGlow);
  massBot.rotation.x = Math.PI;       // point down
  massBot.position.y = -0.14;
  core.add(massBot);

  // asymmetric secondary lobes (otherworldly lumpiness)
  const lobeGeo = geo('vl_lobe', () => cone(0.3, 0.4, 6));
  const lobeA = m(lobeGeo, shellGlow);
  lobeA.position.set(0.46, 0.1, 0.18); lobeA.rotation.z = -0.9; lobeA.rotation.x = 0.3;
  core.add(lobeA);
  const lobeB = m(lobeGeo, shellGlow);
  lobeB.position.set(-0.4, -0.06, -0.22); lobeB.rotation.z = 1.1; lobeB.rotation.x = -0.4;
  core.add(lobeB);
  const lobeC = m(lobeGeo, shellGlow);
  lobeC.position.set(-0.12, 0.34, 0.4); lobeC.rotation.x = -1.0; lobeC.scale.set(0.8,0.8,0.8);
  core.add(lobeC);

  // ---------------------------------------------------------------
  // THE GREAT EYE — one huge glowing central eye facing +Z
  // ---------------------------------------------------------------
  const eyeGrp = new T.Group();
  eyeGrp.position.set(0, 0.04, 0.5);
  core.add(eyeGrp);

  // socket bezel ring (angular brow) — dim glow so it frames the eye
  const socket = m(geo('vl_socket', () => cyl(0.42, 0.46, 0.18, 8)), glowDim);
  socket.rotation.x = Math.PI / 2;
  socket.position.z = -0.04;
  eyeGrp.add(socket);

  // eye sclera halo (dim glow disc)
  const sclera = m(geo('vl_sclera', () => cyl(0.34, 0.34, 0.06, 12)), glowDim);
  sclera.rotation.x = Math.PI / 2;
  eyeGrp.add(sclera);

  // bright iris — ANIMATED unique material (pulse)
  const irisMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.9, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const iris = m(geo('vl_iris', () => cyl(0.22, 0.22, 0.1, 14)), irisMat);
  iris.rotation.x = Math.PI / 2;
  iris.position.z = 0.06;
  eyeGrp.add(iris);

  // vertical slit pupil — dark void slash over the iris (additive: reads as gap)
  const pupil = m(geo('vl_pupil', () => box(0.05, 0.32, 0.04)), voidSlit);
  pupil.position.z = 0.13;
  eyeGrp.add(pupil);

  // bright inner spark — ANIMATED unique material (counter-pulse)
  const sparkMat = new T.MeshBasicMaterial({ color: new T.Color(0xffffff), transparent: true, opacity: 0.95, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const spark = m(geo('vl_spark', () => box(0.07, 0.1, 0.05)), sparkMat);
  spark.position.z = 0.16;
  eyeGrp.add(spark);

  // lash-spikes radiating around the eye (menacing brow)
  const lashGeo = geo('vl_lash', () => cone(0.05, 0.34, 4));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lash = m(lashGeo, spikeGlow);
    lash.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, -0.02);
    lash.rotation.z = a - Math.PI / 2;
    eyeGrp.add(lash);
  }

  // ---------------------------------------------------------------
  // RADIATING TENDRILS / SPIKES — many angular arms outward
  // ---------------------------------------------------------------
  const tendrils = [];
  const tendrilCount = 9;
  const tBase = geo('vl_tBase', () => cone(0.1, 0.85, 5));
  const tTip  = geo('vl_tTip', () => cone(0.05, 0.5, 4));
  const tGlow = geo('vl_tGlow', () => cone(0.045, 0.22, 4));
  for (let i = 0; i < tendrilCount; i++) {
    const a = (i / tendrilCount) * Math.PI * 2 + 0.3;
    const reach = 0.62 + ((i * 37) % 5) * 0.06;
    const tilt = -0.5 - ((i * 53) % 4) * 0.18;   // splay downward/out
    const arm = new T.Group();
    arm.position.copy(core.position);
    arm.rotation.y = a;
    arm.rotation.z = tilt;
    RIG.add(arm);

    const seg1 = m(tBase, spikeGlow);
    seg1.position.set(reach, 0, 0);
    seg1.rotation.z = -Math.PI / 2;
    arm.add(seg1);

    const seg2 = m(tTip, spikeGlow);
    seg2.position.set(reach + 0.55, 0, 0);
    seg2.rotation.z = -Math.PI / 2 + 0.35;   // jagged kink
    arm.add(seg2);

    // glowing tendril tip (bright)
    const glowTip = m(tGlow, glowC);
    glowTip.position.set(reach + 0.92, 0.06, 0);
    glowTip.rotation.z = -Math.PI / 2 + 0.35;
    arm.add(glowTip);

    tendrils.push({ arm, phase: i * 0.7, baseTilt: tilt });
  }

  // upward crown spikes (taller, grander silhouette)
  const crownGeo = geo('vl_crown', () => cone(0.07, 0.7, 4));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = m(crownGeo, spikeGlow);
    sp.position.set(Math.cos(a) * 0.3, bodyY + 0.62, Math.sin(a) * 0.3);
    sp.rotation.z = -Math.cos(a) * 0.35;
    sp.rotation.x = Math.sin(a) * 0.35;
    RIG.add(sp);
    // bright glow caps on crown
    const cap = m(geo('vl_crownCap', () => cone(0.04, 0.18, 4)), glowC);
    cap.position.set(Math.cos(a) * 0.3 * 1.5, bodyY + 0.98, Math.sin(a) * 0.3 * 1.5);
    RIG.add(cap);
  }

  // ---------------------------------------------------------------
  // ORBITING CRYSTALLINE SHARDS — jagged, around the mass
  // ---------------------------------------------------------------
  const shards = [];
  const shardCount = 6;
  const shGeo = geo('vl_shard', () => cone(0.12, 0.46, 4));
  for (let i = 0; i < shardCount; i++) {
    const a = (i / shardCount) * Math.PI * 2;
    const r = 1.05 + (i % 3) * 0.12;
    const yOff = bodyY + Math.sin(a * 1.7) * 0.42;
    const sh = new T.Group();
    sh.position.set(Math.cos(a) * r, yOff, Math.sin(a) * r);
    sh.rotation.set(a * 1.3, a, a * 0.7);
    RIG.add(sh);

    const body = m(shGeo, spikeGlow);
    sh.add(body);
    const edge = m(geo('vl_shardEdge', () => cone(0.05, 0.5, 4)), shardGlow);
    edge.position.y = 0.02;
    sh.add(edge);

    shards.push({ node: sh, baseA: a, r, baseY: yOff, spin: 0.4 + (i % 3) * 0.25 });
  }

  // ---------------------------------------------------------------
  // OPPRESSIVE WARPED AURA — faint additive shells around the mass
  // ---------------------------------------------------------------
  const auraMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.12, fog: false, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide });
  const aura = m(geo('vl_aura', () => cyl(0.9, 0.9, 0.9, 9)), auraMat);
  aura.position.y = bodyY;
  aura.scale.set(1, 1.25, 1);
  RIG.add(aura);

  const aura2Mat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.07, fog: false, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide });
  const aura2 = m(geo('vl_aura2', () => cone(1.15, 1.6, 9)), aura2Mat);
  aura2.position.y = bodyY - 0.1;
  RIG.add(aura2);

  // ground shadow-pool glow beneath the hovering horror
  const poolMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.18, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const pool = m(geo('vl_pool', () => cyl(0.7, 0.95, 0.02, 12)), poolMat);
  pool.position.y = 0.02;
  RIG.add(pool);

  // ---------------------------------------------------------------
  // ANIM — slow ominous rotation + writhing tendrils + eye pulse + orbit
  // ---------------------------------------------------------------
  g.userData.anim = (root, now) => {
    const t = now * 0.001;

    core.rotation.y = t * 0.25;
    const bob = Math.sin(t * 0.9) * 0.06;
    core.position.y = bodyY + bob;
    eyeGrp.rotation.z = Math.sin(t * 0.4) * 0.08;   // unsettling eye lean

    // eye pulse (iris + spark counter-phase)
    const pulse = 0.55 + (Math.sin(t * 2.0) * 0.5 + 0.5) * 0.45;
    irisMat.opacity = pulse;
    const s = 0.9 + Math.sin(t * 2.0) * 0.12;
    iris.scale.set(s, s, 1);
    sparkMat.opacity = 0.5 + (Math.sin(t * 3.3 + 1.0) * 0.5 + 0.5) * 0.5;

    // writhing tendrils
    for (let i = 0; i < tendrils.length; i++) {
      const td = tendrils[i];
      td.arm.rotation.z = td.baseTilt + Math.sin(t * 1.3 + td.phase) * 0.22;
      td.arm.rotation.x = Math.sin(t * 1.0 + td.phase * 1.3) * 0.18;
    }

    // orbiting crystalline shards
    for (let i = 0; i < shards.length; i++) {
      const s2 = shards[i];
      const a = s2.baseA + t * 0.35 * (i % 2 ? 1 : -1);
      s2.node.position.x = Math.cos(a) * s2.r;
      s2.node.position.z = Math.sin(a) * s2.r;
      s2.node.position.y = s2.baseY + bob + Math.sin(t * 1.2 + i) * 0.1;
      s2.node.rotation.y += s2.spin * 0.02;
      s2.node.rotation.x = a * 1.3;
    }

    // aura warp breathing
    const ab = 1 + Math.sin(t * 0.8) * 0.06;
    aura.scale.set(ab, 1.25 * ab, ab);
    auraMat.opacity = 0.1 + Math.sin(t * 1.1) * 0.04;
    aura2Mat.opacity = 0.06 + Math.sin(t * 0.7 + 1.0) * 0.03;
    poolMat.opacity = 0.16 + Math.sin(t * 1.5) * 0.05;
  };

  return g;
}

export function buildEnemy_wyrm(opts){
  const c = (opts && opts.color) || '#7fd9ff';
  const ice = '#bfeaff';
  const deep = '#3aa6e0';
  const eye = '#e8fbff';
  const breath = '#aef0ff';
  const g = new T.Group();

  // ---- SEGMENTED SERPENTINE BODY (chain arcing along +Z) ----
  // 7 tapering segments from tail (-Z) to neck (+Z); low to the ground.
  const SEG = 7;
  const segGroups = [];
  for (let i = 0; i < SEG; i++) {
    const t = i / (SEG - 1);              // 0 tail .. 1 neck
    const r = 0.15 + t * 0.27;            // taper: thin tail -> thick neck
    const z = -1.45 + t * 2.15;           // march forward along +Z
    const sg = new T.Group();
    const baseY = 0.26 + r * 0.55;
    sg.position.set(0, baseY, z);
    sg.userData.baseY = baseY;            // captured up-front (anim-safe)

    // chunky angular vertebra ring (low-poly cyl, few sides = gothic facets)
    const ring = m(geo('wy_seg' + i, () => cyl(r, r * 1.12, 0.44, 6)), mat(c));
    ring.rotation.x = Math.PI / 2;        // axis along Z
    sg.add(ring);

    // ribbed dorsal plate band (brighter ice ridge wrapping the top)
    const band = m(geo('wy_band' + i, () => box(r * 1.5, 0.10, 0.30)), mat(deep));
    band.position.y = r * 0.7;
    sg.add(band);

    // belly underplate (dim, grounds the silhouette)
    const belly = m(geo('wy_belly' + i, () => box(r * 1.3, 0.14, 0.34)), mat(deep));
    belly.position.y = -r * 0.78;
    sg.add(belly);

    // FROST SPIKE fin on the spine (every segment, growing toward neck)
    const sh = 0.30 + t * 0.40;
    const spike = m(geo('wy_spk' + i, () => cone(r * 0.42, sh, 4)), matAdd(ice, 0.85));
    spike.position.y = r * 0.9 + sh * 0.5;
    spike.rotation.x = -0.18;             // raked back
    sg.add(spike);

    // paired smaller side fins (frost fringe) on the larger segments
    if (i >= 2) {
      const sf = 0.18 + t * 0.28;
      for (let s = -1; s <= 1; s += 2) {
        const fin = m(geo('wy_fin' + i, () => cone(r * 0.26, sf, 4)), matAdd(c, 0.7));
        fin.position.set(s * r * 0.82, r * 0.42, 0);
        fin.rotation.z = s * 0.9;
        fin.rotation.x = -0.1;
        sg.add(fin);
      }
    }

    // glowing core node pulsing inside each vertebra (UNIQUE animated mat)
    const coreMat = new T.MeshBasicMaterial({ color: new T.Color(breath), fog: false, transparent: true, opacity: 0.55, blending: T.AdditiveBlending });
    const core = m(geo('wy_core' + i, () => box(r * 0.5, r * 0.5, 0.18)), coreMat);
    core.userData.coreMat = coreMat;
    sg.add(core);

    g.add(sg);
    segGroups.push(sg);
  }

  // ---- DRACONIC HEAD at +Z front ----
  const head = new T.Group();
  const neck = segGroups[SEG - 1];
  head.position.set(0, neck.position.y + 0.18, neck.position.z + 0.55);
  head.userData.baseY = head.position.y;
  g.add(head);

  // angular skull (faceted, wedge-shaped pointing +Z)
  const skull = m(geo('wy_skull', () => cyl(0.30, 0.40, 0.60, 6)), mat(c));
  skull.rotation.x = Math.PI / 2;
  skull.position.z = 0.08;
  head.add(skull);

  // upper snout wedge (cone driving the muzzle forward)
  const snout = m(geo('wy_snout', () => cone(0.26, 0.62, 5)), mat(c));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.06, 0.62);
  head.add(snout);

  // crown / brow ridge (dim mass over the eyes)
  const brow = m(geo('wy_brow', () => box(0.52, 0.16, 0.34)), mat(deep));
  brow.position.set(0, 0.24, 0.14);
  head.add(brow);

  // sweeping back-swept HORNS (pair) + smaller secondary horns
  for (let s = -1; s <= 1; s += 2) {
    const horn = m(geo('wy_horn', () => cone(0.10, 0.78, 5)), mat(ice));
    horn.position.set(s * 0.20, 0.34, -0.10);
    horn.rotation.set(0.95, 0, s * 0.28);   // sweep up and back
    head.add(horn);

    const horn2 = m(geo('wy_horn2', () => cone(0.07, 0.44, 4)), mat(ice));
    horn2.position.set(s * 0.30, 0.20, 0.02);
    horn2.rotation.set(0.6, 0, s * 0.7);
    head.add(horn2);

    // cheek frost spike
    const cheek = m(geo('wy_cheek', () => cone(0.07, 0.34, 4)), matAdd(c, 0.7));
    cheek.position.set(s * 0.30, -0.02, 0.30);
    cheek.rotation.set(0, 0, s * 1.3);
    head.add(cheek);
  }

  // GLOWING EYES (unique animated, pulse menacingly)
  const eyeMats = [];
  for (let s = -1; s <= 1; s += 2) {
    const em = new T.MeshBasicMaterial({ color: new T.Color(eye), fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending });
    const e = m(geo('wy_eye', () => box(0.13, 0.10, 0.10)), em);
    e.position.set(s * 0.18, 0.14, 0.36);
    e.userData.eyeMat = em;
    head.add(e);
    eyeMats.push(em);
    // glowing eye-socket slash above
    const slash = m(geo('wy_slash', () => box(0.16, 0.04, 0.04)), matAdd(eye, 0.5));
    slash.position.set(s * 0.18, 0.21, 0.34);
    slash.rotation.z = s * 0.4;
    head.add(slash);
  }

  // OPEN FANGED JAW (lower mandible hinged at back, animates open)
  const jaw = new T.Group();
  jaw.position.set(0, -0.10, 0.10);
  head.add(jaw);
  const mandible = m(geo('wy_jaw', () => cone(0.22, 0.56, 5)), mat(deep));
  mandible.rotation.x = Math.PI / 2;
  mandible.position.z = 0.46;
  jaw.add(mandible);
  // fang rows (upper fixed on head, lower on jaw)
  for (let s = -1; s <= 1; s += 2) {
    for (let f = 0; f < 3; f++) {
      const uf = m(geo('wy_fangU', () => cone(0.045, 0.20, 3)), matAdd(ice, 0.95));
      uf.position.set(s * 0.16, -0.04, 0.32 + f * 0.13);
      uf.rotation.x = Math.PI;            // point down
      head.add(uf);
      const lf = m(geo('wy_fangL', () => cone(0.045, 0.18, 3)), matAdd(ice, 0.95));
      lf.position.set(s * 0.14, 0.06, 0.30 + f * 0.13);
      jaw.add(lf);
    }
  }

  // FROST BREATH glow billowing from the open maw (unique animated)
  const breathMat = new T.MeshBasicMaterial({ color: new T.Color(breath), fog: false, transparent: true, opacity: 0.35, blending: T.AdditiveBlending });
  const breathG = new T.Group();
  breathG.position.set(0, -0.02, 0.7);
  head.add(breathG);
  const maw = m(geo('wy_maw', () => cone(0.24, 0.7, 6)), breathMat);
  maw.rotation.x = Math.PI / 2;          // flare outward +Z
  maw.position.z = 0.3;
  breathG.add(maw);
  breathG.userData.breathMat = breathMat;
  // inner throat glow
  const throatMat = new T.MeshBasicMaterial({ color: new T.Color(eye), fog: false, transparent: true, opacity: 0.6, blending: T.AdditiveBlending });
  const throat = m(geo('wy_throat', () => box(0.16, 0.12, 0.12)), throatMat);
  throat.position.set(0, 0.0, 0.22);
  head.add(throat);
  head.userData.throatMat = throatMat;

  // ---- ANIM: full-body sine undulation + jaw/breath pulse ----
  g.userData.anim = function (root, now) {
    const tms = now * 0.001;
    // body undulation: travelling sine wave along the segment chain
    for (let i = 0; i < segGroups.length; i++) {
      const sg = segGroups[i];
      const phase = i * 0.7;
      sg.position.x = Math.sin(tms * 2.0 - phase) * (0.20 + i * 0.02);
      const bob = Math.sin(tms * 2.0 - phase + 0.5) * 0.05;
      sg.position.y = sg.userData.baseY + bob;
      sg.rotation.y = Math.cos(tms * 2.0 - phase) * 0.18;
      // pulse the inner core nodes
      const ch = sg.children;
      for (let k = 0; k < ch.length; k++) {
        const cm = ch[k].userData && ch[k].userData.coreMat;
        if (cm) cm.opacity = 0.4 + Math.sin(tms * 4.0 - phase) * 0.25;
      }
    }
    // head follows the neck segment laterally + slow menacing weave
    head.position.x = segGroups[SEG - 1].position.x + Math.sin(tms * 1.3) * 0.06;
    head.position.y = head.userData.baseY + Math.sin(tms * 2.0 - (SEG - 1) * 0.7 + 0.5) * 0.05;
    head.rotation.y = Math.sin(tms * 1.3) * 0.12;
    head.rotation.z = Math.sin(tms * 0.9) * 0.05;
    // jaw open/close
    const open = (Math.sin(tms * 1.6) * 0.5 + 0.5);
    jaw.rotation.x = 0.12 + open * 0.55;
    // breath pulse swells when jaw opens
    if (breathG.userData.breathMat) breathG.userData.breathMat.opacity = 0.12 + open * 0.4;
    breathG.scale.setScalar(0.7 + open * 0.7);
    if (head.userData.throatMat) head.userData.throatMat.opacity = 0.35 + open * 0.5;
    // eyes pulse
    const ep = 0.7 + Math.sin(tms * 3.0) * 0.3;
    for (let e = 0; e < eyeMats.length; e++) eyeMats[e].opacity = ep;
  };

  return g;
}

// Treasure Goblin — a hunched gold-laden imp with a bulging treasure sack that
// flees the player. opts.color = treasure-gold accent.
export function buildEnemy_goblin(opts) {
  const c = (opts && opts.color) || '#ffd24a';
  const g = new T.Group();
  const skin = mat('#5b7a3a'), skinDark = mat('#39501f'), sack = mat('#6b4a2a');
  const gold = matAdd(c, 0.95), eye = matAdd('#ffe24a', 1);
  const lL = m(box(0.1, 0.22, 0.1), skinDark); lL.position.set(-0.1, 0.11, 0);
  const rL = m(box(0.1, 0.22, 0.1), skinDark); rL.position.set(0.1, 0.11, 0);
  const body = m(box(0.34, 0.3, 0.28), skin); body.position.set(0, 0.36, 0.02); body.rotation.x = 0.25;
  const bag = m(geo('gobBag', () => new T.IcosahedronGeometry(0.28, 0)), sack); bag.position.set(0, 0.5, -0.22); bag.scale.set(1, 1.15, 1);
  const tie = m(box(0.12, 0.08, 0.12), skinDark); tie.position.set(0, 0.74, -0.22);
  const coin1 = m(geo('gobCoin', () => new T.OctahedronGeometry(0.05, 0)), gold); coin1.position.set(-0.06, 0.8, -0.2);
  const coin2 = m(geo('gobCoin', () => new T.OctahedronGeometry(0.05, 0)), gold); coin2.position.set(0.07, 0.83, -0.24);
  const coin3 = m(geo('gobCoin', () => new T.OctahedronGeometry(0.05, 0)), gold); coin3.position.set(0, 0.86, -0.18);
  const lA = m(box(0.07, 0.3, 0.07), skinDark); lA.position.set(-0.2, 0.34, 0.1); lA.rotation.x = 0.5;
  const rA = m(box(0.07, 0.3, 0.07), skinDark); rA.position.set(0.2, 0.34, 0.1); rA.rotation.x = 0.5;
  const head = m(box(0.24, 0.2, 0.22), skin); head.position.set(0, 0.6, 0.1);
  const earL = m(cone(0.06, 0.18, 4), skin); earL.position.set(-0.15, 0.66, 0.06); earL.rotation.z = 1.0;
  const earR = m(cone(0.06, 0.18, 4), skin); earR.position.set(0.15, 0.66, 0.06); earR.rotation.z = -1.0;
  const nose = m(cone(0.04, 0.12, 4), skin); nose.position.set(0, 0.58, 0.22); nose.rotation.x = Math.PI / 2;
  const eyeL = m(box(0.05, 0.05, 0.03), eye); eyeL.position.set(-0.06, 0.64, 0.21);
  const eyeR = m(box(0.05, 0.05, 0.03), eye); eyeR.position.set(0.06, 0.64, 0.21);
  const grin = m(box(0.14, 0.03, 0.02), matAdd('#ffffff', 0.8)); grin.position.set(0, 0.55, 0.22);
  g.add(lL, rL, body, bag, tie, coin1, coin2, coin3, lA, rA, head, earL, earR, nose, eyeL, eyeR, grin);
  g.userData.anim = (grp, now) => {
    const j = Math.sin(now / 90) * 0.04;
    body.position.y = 0.36 + j; head.position.y = 0.6 + j;
    bag.position.y = 0.5 + Math.sin(now / 120) * 0.03;
    coin1.position.y = 0.8 + Math.sin(now / 100) * 0.02;
    coin2.position.y = 0.83 + Math.sin(now / 100 + 1) * 0.02;
  };
  return g;
}


// =============================================================
// GOTHIC TOWN — Sanctuary buildings + props (workflow). Placed by render3d
// buildTownFeatures(). Origin at base-center, face +Z.
// =============================================================

export function buildTown_cathedral(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#ffb858';
  // static cached materials
  const stone = mat('#3a3742', 1);      // main facade stone
  const stoneDk = mat('#2a2630', 1);    // shadowed stone / recesses
  const slate = mat('#23202c');         // roof / spire slate
  const iron = mat('#1a1a22');          // mullions, tracery, cross
  const door = mat('#06040a');          // dark doorway void behind the warm glow
  const doorGlow = matAdd('#ffcf7a', 0.85); // warm interior of the doorway
  // stained-glass jewel tones for the rose window petals (cached statics; the bright center is animated/unique)
  const jewelR = matAdd('#ff5a6e', 0.85);
  const jewelB = matAdd('#5a86ff', 0.85);
  const jewelG = matAdd('#5ad6a0', 0.8);
  const jewelV = matAdd('#b06cff', 0.82);

  // ---- main hall mass (a tall nave block) ----
  const nave = m(box(1.8, 3.0, 1.4), stone); nave.position.set(0, 1.5, 0);
  const naveBack = m(box(1.5, 2.6, 1.0), stoneDk); naveBack.position.set(0, 1.3, -0.9);
  g.add(nave, naveBack);

  // steep pitched roof over the nave
  const roof = m(cone(1.25, 1.1, 4), slate); roof.position.set(0, 3.55, -0.2); roof.rotation.y = Math.PI / 4; roof.scale.set(0.85, 1, 1.3);
  g.add(roof);

  // ---- buttresses down the flanks ----
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const but = m(box(0.22, 1.9, 0.3), stoneDk); but.position.set(sx * 0.98, 0.95, 0.35);
    const butAngle = m(box(0.18, 0.9, 0.5), stoneDk); butAngle.position.set(sx * 0.9, 1.5, 0.0); butAngle.rotation.x = 0.4;
    const butCap = m(cone(0.16, 0.34, 4), slate); butCap.position.set(sx * 0.98, 2.05, 0.35);
    g.add(but, butAngle, butCap);
  }

  // collect warm window meshes that get a gentle unique-material flicker
  const flickerMats = [];
  function warmWin(geom, hex, op){
    const wm = new T.MeshBasicMaterial({ color: new T.Color(hex), fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    const mesh = m(geom, wm);
    flickerMats.push({ mat: wm, base: op });
    return mesh;
  }

  // ---- two flanking pinnacle towers ----
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const tower = m(box(0.62, 3.4, 0.62), stone); tower.position.set(sx * 1.05, 1.7, 0.2);
    const towerTrim = m(box(0.7, 0.16, 0.7), stoneDk); towerTrim.position.set(sx * 1.05, 3.4, 0.2);
    const spirelet = m(cone(0.44, 1.0, 4), slate); spirelet.position.set(sx * 1.05, 4.0, 0.2); spirelet.rotation.y = Math.PI / 4;
    const finial = m(cone(0.08, 0.26, 4), iron); finial.position.set(sx * 1.05, 4.62, 0.2);
    // small warm lit lancet windows up each tower (unique flicker mats)
    const tw1 = warmWin(box(0.14, 0.4, 0.06), '#ffb858', 0.9); tw1.position.set(sx * 1.05, 1.6, 0.52);
    const tw2 = warmWin(box(0.14, 0.34, 0.06), '#ffb858', 0.9); tw2.position.set(sx * 1.05, 2.5, 0.52);
    // pointed lancet caps
    const tw1c = warmWin(cone(0.09, 0.16, 3), '#ffb858', 0.9); tw1c.position.set(sx * 1.05, 1.86, 0.52);
    const tw2c = warmWin(cone(0.09, 0.14, 3), '#ffb858', 0.9); tw2c.position.set(sx * 1.05, 2.72, 0.52);
    g.add(tower, towerTrim, spirelet, finial, tw1, tw2, tw1c, tw2c);
  }

  // ---- central steep spire over the facade gable ----
  const spireBase = m(box(0.6, 0.5, 0.6), stoneDk); spireBase.position.set(0, 3.25, 0.3); spireBase.rotation.y = Math.PI / 4;
  const spire = m(cone(0.42, 1.5, 4), slate); spire.position.set(0, 4.2, 0.3); spire.rotation.y = Math.PI / 4;
  const spireFin = m(box(0.05, 0.34, 0.05), iron); spireFin.position.set(0, 5.05, 0.3);
  // wrought-iron cross finial atop the spire
  const crossV = m(box(0.05, 0.4, 0.05), iron); crossV.position.set(0, 5.32, 0.3);
  const crossH = m(box(0.26, 0.05, 0.05), iron); crossH.position.set(0, 5.36, 0.3);
  g.add(spireBase, spire, spireFin, crossV, crossH);

  // ---- grand pointed-arch doorway with warm-lit interior ----
  const archL = m(box(0.16, 1.3, 0.16), stoneDk); archL.position.set(-0.42, 0.65, 0.7);
  const archR = m(box(0.16, 1.3, 0.16), stoneDk); archR.position.set(0.42, 0.65, 0.7);
  const archTop = m(cone(0.56, 0.7, 3), stoneDk); archTop.position.set(0, 1.55, 0.7); archTop.scale.set(1, 1, 0.35);
  // dark recess + warm glowing interior light spilling out
  const doorVoid = m(box(0.7, 1.2, 0.1), door); doorVoid.position.set(0, 0.62, 0.66);
  const doorLight = m(box(0.6, 1.05, 0.06), doorGlow); doorLight.position.set(0, 0.6, 0.73);
  const doorArchLight = m(cone(0.34, 0.5, 3), doorGlow); doorArchLight.position.set(0, 1.35, 0.73); doorArchLight.scale.set(1, 1, 0.3);
  g.add(archL, archR, archTop, doorVoid, doorLight, doorArchLight);

  // flanking lancet windows on the facade (unique flicker mats)
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const lan = warmWin(box(0.16, 0.7, 0.06), '#ffd98a', 0.85); lan.position.set(sx * 0.66, 1.0, 0.71);
    const lanCap = warmWin(cone(0.1, 0.2, 3), '#ffd98a', 0.85); lanCap.position.set(sx * 0.66, 1.45, 0.71);
    g.add(lan, lanCap);
  }

  // ---- large glowing ROSE WINDOW (stained glass) high on the facade ----
  const roseY = 2.35, roseZ = 0.72;
  const rose = new T.Group(); rose.position.set(0, roseY, roseZ);
  // dark stone ring framing the window
  const roseRing = m(geo('cathRoseRing', () => new T.TorusGeometry(0.5, 0.07, 4, 16)), iron);
  rose.add(roseRing);
  // bright animated center — UNIQUE material (it shimmers per frame)
  const roseCoreMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const roseCore = m(geo('cathRoseCore', () => new T.CircleGeometry(0.18, 12)), roseCoreMat);
  roseCore.position.z = 0.02; rose.add(roseCore);
  // jewel-tone petals radiating out — alternating colors, with iron mullions between
  const jewels = [jewelR, jewelB, jewelG, jewelV, jewelR, jewelB, jewelG, jewelV];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = m(geo('cathRosePetal', () => new T.PlaneGeometry(0.18, 0.34)), jewels[i]);
    petal.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.01);
    petal.rotation.z = a + Math.PI / 2;
    rose.add(petal);
    // iron mullion spoke
    const spoke = m(box(0.03, 0.46, 0.03), iron);
    spoke.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.0);
    spoke.rotation.z = a + Math.PI / 2;
    rose.add(spoke);
  }
  // pointed stone hood over the rose window
  const roseHood = m(cone(0.6, 0.5, 3), stoneDk); roseHood.position.set(0, 2.95, roseZ - 0.02); roseHood.scale.set(1, 1, 0.3);
  g.add(rose, roseHood);

  // ---- facade gable trim + banners for character ----
  const gable = m(cone(0.95, 0.7, 3), stone); gable.position.set(0, 3.15, 0.4); gable.scale.set(1, 1, 0.25);
  g.add(gable);
  // two hanging banners flanking the door (theme-accent glow), animated sway
  const bannerMeshes = [];
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const bmat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    const banner = m(geo('cathBanner', () => new T.PlaneGeometry(0.22, 0.85)), bmat);
    banner.position.set(sx * 0.95, 1.4, 0.74);
    g.add(banner); bannerMeshes.push(banner);
  }

  g.userData.anim = (gr, now) => {
    // gentle rose-window shimmer: pulse brightness + slow rotation
    const p = 0.7 + Math.sin(now / 520) * 0.25;
    roseCoreMat.opacity = 0.7 + p * 0.25;
    roseCore.scale.setScalar(0.9 + Math.sin(now / 380) * 0.12);
    rose.rotation.z = Math.sin(now / 2600) * 0.08;
    // warm windows flicker softly like candlelight
    for (let i = 0; i < flickerMats.length; i++) {
      const f = flickerMats[i];
      f.mat.opacity = f.base * (0.82 + Math.sin(now / 240 + i * 1.7) * 0.12);
    }
    // banners sway
    for (let i = 0; i < bannerMeshes.length; i++) {
      bannerMeshes[i].material.opacity = 0.55 + Math.sin(now / 700 + i) * 0.15;
      bannerMeshes[i].rotation.y = Math.sin(now / 900 + i * 1.3) * 0.12;
    }
  };
  return g;
}

export function buildTown_gate(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#ffb858';
  // static cached materials (opaque fogged / additive glow)
  const stone = mat('#3a3742', 1);    // pillar stone
  const stoneDk = mat('#2a2630', 1);  // shadowed stone
  const iron = mat('#1a1a22');        // portcullis + lantern frames
  const slate = mat('#23202c');       // finial caps
  const lanternFrame = mat('#14141c');
  const portGlow = matAdd('#ffcf7a', 0.4); // faint warm glow behind the portcullis (interior beyond the gate)

  const HALF = 1.15; // half the span between pillar centers

  // ---- two heavy stone pillars ----
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    const base = m(box(0.62, 0.2, 0.62), stoneDk); base.position.set(sx * HALF, 0.1, 0);
    const pillar = m(box(0.5, 2.0, 0.5), stone); pillar.position.set(sx * HALF, 1.15, 0);
    const pillarSeam = m(box(0.54, 0.1, 0.54), stoneDk); pillarSeam.position.set(sx * HALF, 1.4, 0);
    // capital + finial / gargoyle block on top
    const cap = m(box(0.58, 0.18, 0.58), stoneDk); cap.position.set(sx * HALF, 2.24, 0);
    const gargoyle = m(box(0.34, 0.26, 0.5), stone); gargoyle.position.set(sx * HALF, 2.46, 0.06);
    const gargSnout = m(cone(0.12, 0.3, 4), stoneDk); gargSnout.position.set(sx * HALF, 2.46, 0.34); gargSnout.rotation.x = Math.PI / 2;
    const finial = m(cone(0.16, 0.36, 4), slate); finial.position.set(sx * HALF, 2.78, -0.04); finial.rotation.y = Math.PI / 4;
    g.add(base, pillar, pillarSeam, cap, gargoyle, gargSnout, finial);
  }

  // ---- pointed arch spanning the pillars ----
  // spring blocks rising from each pillar inner shoulder
  const archL = m(box(0.3, 0.6, 0.4), stoneDk); archL.position.set(-HALF + 0.1, 2.05, 0); archL.rotation.z = -0.5;
  const archR = m(box(0.3, 0.6, 0.4), stoneDk); archR.position.set(HALF - 0.1, 2.05, 0); archR.rotation.z = 0.5;
  // pointed keystone apex (triangular prism -> gothic point)
  const arch = m(cone(HALF + 0.2, 0.9, 3), stone); arch.position.set(0, 2.45, 0); arch.scale.set(1, 1, 0.4);
  const keystone = m(box(0.22, 0.3, 0.42), stoneDk); keystone.position.set(0, 2.55, 0);
  // a crossbeam lintel tying the two pillars at the spring line
  const lintel = m(box(2.0, 0.22, 0.4), stoneDk); lintel.position.set(0, 1.95, 0);
  g.add(archL, archR, arch, keystone, lintel);

  // ---- portcullis grid hanging in the gateway ----
  const port = new T.Group(); port.position.set(0, 0.05, 0);
  // faint warm interior glow plane behind the bars so the opening reads lit, not a black blob
  const glowPlane = m(geo('gateGlow', () => new T.PlaneGeometry(1.8, 1.85)), portGlow);
  glowPlane.position.set(0, 1.0, -0.08); port.add(glowPlane);
  // vertical bars
  for (let i = -3; i <= 3; i++) {
    const bar = m(box(0.05, 1.8, 0.05), iron); bar.position.set(i * 0.28, 1.0, 0);
    port.add(bar);
  }
  // horizontal rails
  for (let j = 0; j < 4; j++) {
    const rail = m(box(1.9, 0.05, 0.05), iron); rail.position.set(0, 0.3 + j * 0.5, 0);
    port.add(rail);
  }
  // pointed spike tips along the bottom of the portcullis
  for (let i = -3; i <= 3; i++) {
    const spike = m(cone(0.04, 0.16, 4), iron); spike.position.set(i * 0.28, 0.08, 0); spike.rotation.x = Math.PI;
    port.add(spike);
  }
  g.add(port);

  // ---- a hanging lantern at each pillar (warm flicker) ----
  const flames = [];
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    // wrought-iron arm reaching inward from the pillar
    const arm = m(box(0.06, 0.06, 0.5), iron); arm.position.set(sx * (HALF - 0.25), 2.15, 0.28); arm.rotation.x = 0.2;
    const hook = m(box(0.04, 0.22, 0.04), iron); hook.position.set(sx * (HALF - 0.45), 2.02, 0.42);
    // lantern cage
    const cage = m(box(0.2, 0.26, 0.2), lanternFrame); cage.position.set(sx * (HALF - 0.45), 1.82, 0.42);
    const capTop = m(cone(0.16, 0.16, 4), iron); capTop.position.set(sx * (HALF - 0.45), 2.0, 0.42);
    // UNIQUE animated flame + glow materials (flicker per frame -> must NOT be cached)
    const flameMat = new T.MeshBasicMaterial({ color: '#ffd98a', fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const flame = m(geo('gateFlame', () => new T.ConeGeometry(0.07, 0.18, 5)), flameMat);
    flame.position.set(sx * (HALF - 0.45), 1.84, 0.42);
    const glowMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false });
    const glow = m(geo('gateLanternGlow', () => new T.BoxGeometry(0.26, 0.32, 0.26)), glowMat);
    glow.position.set(sx * (HALF - 0.45), 1.82, 0.42);
    g.add(arm, hook, cage, capTop, flame, glow);
    flames.push({ flame, flameMat, glow, glowMat, ph: i * 2.1 });
  }

  g.userData.anim = (gr, now) => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      // irregular flicker via summed sines
      const flick = 0.78 + Math.sin(now / 90 + f.ph) * 0.14 + Math.sin(now / 47 + f.ph * 1.7) * 0.08;
      f.flameMat.opacity = Math.max(0.55, Math.min(1, flick));
      f.flame.scale.set(1, 0.85 + (flick - 0.78) * 0.9, 1);
      f.glowMat.opacity = Math.max(0.18, 0.35 + (flick - 0.78) * 0.5);
      f.glow.scale.setScalar(0.92 + (flick - 0.78) * 0.6);
    }
  };
  return g;
}

export function buildTown_house(opts){
  const c = (opts && opts.color) || '#ffb858';
  const g = new T.Group();
  // --- materials (cached statics) ---
  const stone = mat('#3a3742',1);
  const stoneDark = mat('#2a2630',1);
  const timber = mat('#2a2018');
  const slate = mat('#23202c');
  const iron = mat('#1a1a22');
  // unique animated glow materials (NEVER cached, animated per-frame)
  const winColor = new T.Color(c);
  const win1   = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.9,  fog:false, blending:T.AdditiveBlending });
  const win2   = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.85, fog:false, blending:T.AdditiveBlending });
  const win3   = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.8,  fog:false, blending:T.AdditiveBlending });
  const doorMat= new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.95, fog:false, blending:T.AdditiveBlending });
  const gableM = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.7,  fog:false, blending:T.AdditiveBlending });
  const lantM  = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.95, fog:false, blending:T.AdditiveBlending });

  const W = 1.0, D = 0.9; // narrow body
  // ground floor (stone)
  const g0 = m(box(W, 1.0, D), stone); g0.position.y = 0.5; g.add(g0);
  // upper floor (timber framed, slightly inset)
  const g1 = m(box(W*0.96, 1.0, D*0.96), stoneDark); g1.position.y = 1.5; g.add(g1);
  // timber corner posts on upper floor (4 verticals)
  const postW = 0.07;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(s=>{
    const p = m(box(postW, 1.0, postW), timber);
    p.position.set(s[0]*(W*0.96/2 - postW/2), 1.5, s[1]*(D*0.96/2 - postW/2));
    g.add(p);
  });
  // timber cross-rails (front face)
  const railTop = m(box(W*0.96, 0.06, 0.04), timber); railTop.position.set(0,1.96, D*0.96/2); g.add(railTop);
  const railMid = m(box(W*0.96, 0.06, 0.04), timber); railMid.position.set(0,1.5,  D*0.96/2); g.add(railMid);

  // --- steep pitched slate roof (two sloped planks) ---
  const roofH = 1.0;
  const roofL = m(box(0.06, 1.18, D*1.05), slate);
  roofL.position.set(-W*0.25, 2.0 + roofH*0.5, 0);
  roofL.rotation.z = 0.62; g.add(roofL);
  const roofR = m(box(0.06, 1.18, D*1.05), slate);
  roofR.position.set(W*0.25, 2.0 + roofH*0.5, 0);
  roofR.rotation.z = -0.62; g.add(roofR);
  // gable end triangle fills (kept inside roofline so they don't poke out)
  const gableF = m(box(W*0.78, 0.82, 0.05), stoneDark); gableF.position.set(0,2.36,D*0.44); g.add(gableF);
  const gableB = m(box(W*0.78, 0.82, 0.05), stoneDark); gableB.position.set(0,2.36,-D*0.44); g.add(gableB);
  // glowing gable window (breaks the upper dark mass on the front silhouette)
  const gWin = m(plane(0.2,0.26), gableM); gWin.position.set(0,2.42,D*0.47); g.add(gWin);
  const gWinF = m(box(0.26,0.32,0.04), iron); gWinF.position.set(0,2.42,D*0.445); g.add(gWinF);
  // ridge cap
  const ridge = m(box(0.1,0.1,D*1.06), slate); ridge.position.set(0, 3.0, 0); g.add(ridge);

  // chimney
  const chim = m(box(0.18,0.7,0.18), stoneDark); chim.position.set(W*0.32, 2.85, -D*0.2); g.add(chim);
  const chimCap = m(box(0.24,0.06,0.24), iron); chimCap.position.set(W*0.32,3.2,-D*0.2); g.add(chimCap);

  // tiny dormer on front roof
  const dormer = m(box(0.26,0.26,0.18), stoneDark); dormer.position.set(-0.2, 2.55, D*0.34); g.add(dormer);
  const dormerWin = m(plane(0.14,0.14), win3); dormerWin.position.set(-0.2,2.55,D*0.44); g.add(dormerWin);
  const dormerRoof = m(box(0.32,0.05,0.14), slate); dormerRoof.position.set(-0.2,2.72,D*0.34); dormerRoof.rotation.x=0.3; g.add(dormerRoof);

  // --- lit doorway (front, +Z) ---
  const doorFrame = m(box(0.34,0.62,0.06), iron); doorFrame.position.set(0,0.31,D/2+0.01); g.add(doorFrame);
  const door = m(plane(0.24,0.5), doorMat); door.position.set(0,0.27,D/2+0.05); g.add(door);
  // pointed arch hint above door
  const arch = m(box(0.3,0.08,0.05), iron); arch.position.set(0,0.66,D/2+0.02); g.add(arch);

  // wrought-iron lantern beside the door (warm glow, strengthens silhouette)
  const lBrkt = m(box(0.04,0.04,0.18), iron); lBrkt.position.set(0.28,0.78,D/2+0.08); g.add(lBrkt);
  const lCage = m(box(0.1,0.16,0.1), iron);  lCage.position.set(0.28,0.66,D/2+0.16); g.add(lCage);
  const lGlow = m(box(0.06,0.1,0.06), lantM); lGlow.position.set(0.28,0.66,D/2+0.16); g.add(lGlow);

  // --- warm glowing windows ---
  // ground floor window (front)
  const w1 = m(plane(0.22,0.3), win1); w1.position.set(-0.32,0.55,D/2+0.04); g.add(w1);
  const w1f = m(box(0.26,0.34,0.04), iron); w1f.position.set(-0.32,0.55,D/2+0.01); g.add(w1f);
  // upper floor windows (front, two)
  const w2 = m(plane(0.2,0.26), win2); w2.position.set(-0.28,1.6,D*0.96/2+0.04); g.add(w2);
  const w2f = m(box(0.24,0.3,0.04), iron); w2f.position.set(-0.28,1.6,D*0.96/2+0.01); g.add(w2f);
  const w3 = m(plane(0.2,0.26), win3); w3.position.set(0.28,1.6,D*0.96/2+0.04); g.add(w3);
  const w3f = m(box(0.24,0.3,0.04), iron); w3f.position.set(0.28,1.6,D*0.96/2+0.01); g.add(w3f);
  // side window glow
  const ws = m(plane(0.2,0.26), win2); ws.position.set(W/2+0.02,1.0,0); ws.rotation.y = Math.PI/2; g.add(ws);

  // --- subtle glow flicker anim (all unique materials) ---
  g.userData.anim = (grp, now) => {
    const t = now*0.001;
    const f1 = 0.78 + 0.16*Math.sin(t*3.1) + 0.05*Math.sin(t*11.0);
    const f2 = 0.72 + 0.14*Math.sin(t*2.3 + 1.7);
    const f3 = 0.70 + 0.15*Math.sin(t*4.1 + 0.9);
    win1.opacity = f1; win2.opacity = f2; win3.opacity = f3;
    gableM.opacity = 0.6 + 0.12*Math.sin(t*1.9 + 2.2);
    doorMat.opacity = 0.85 + 0.1*Math.sin(t*2.6 + 0.4);
    lantM.opacity = 0.82 + 0.18*Math.sin(t*5.7 + 3.3) + 0.06*Math.sin(t*13.0);
  };
  return g;
}

export function buildTown_house2(opts){
  const c = (opts && opts.color) || '#ffcf7a';
  const g = new T.Group();
  const stone = mat('#3a3742',1);
  const stoneDark = mat('#2a2630',1);
  const timber = mat('#2a2018');
  const slate = mat('#23202c');
  const iron = mat('#1a1a22');
  const winColor = new T.Color(c);
  // UNIQUE animated materials (additive glow) — never cached
  const winA = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.88, fog:false, blending:T.AdditiveBlending, depthWrite:false });
  const winB = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.82, fog:false, blending:T.AdditiveBlending, depthWrite:false });
  const winC = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.78, fog:false, blending:T.AdditiveBlending, depthWrite:false });
  const doorMat = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.90, fog:false, blending:T.AdditiveBlending, depthWrite:false });

  // TALLER + NARROWER variant with an OVERHANGING jettied upper floor
  const W = 0.82, D = 0.78;
  const fz = D*0.12; // jetty forward shift for upper masses
  // ground floor (stone, narrower)
  const g0 = m(box(W, 1.1, D), stone); g0.position.y = 0.55; g.add(g0);
  // middle floor (darker stone)
  const g1 = m(box(W*1.04, 1.0, D*1.04), stoneDark); g1.position.y = 1.6; g.add(g1);
  // jettied TOP floor overhangs forward (+Z) and wider
  const g2 = m(box(W*1.18, 0.95, D*1.12), stoneDark); g2.position.set(0,2.55, fz); g.add(g2);
  // jetty support brackets (timber) under overhang
  const brk1 = m(box(0.06,0.18,0.18), timber); brk1.position.set(-W*0.4,2.1,D*0.5); brk1.rotation.x=0.5; g.add(brk1);
  const brk2 = m(box(0.06,0.18,0.18), timber); brk2.position.set( W*0.4,2.1,D*0.5); brk2.rotation.x=0.5; g.add(brk2);

  // timber framing posts on top floor corners (front face)
  const postW=0.06;
  [-1,1].forEach(s=>{
    const p=m(box(postW,0.95,postW),timber);
    p.position.set(s*(W*1.18/2-postW/2), 2.55, D*1.12/2-postW/2 + fz); g.add(p);
  });
  const rail = m(box(W*1.18,0.05,0.04), timber); rail.position.set(0,2.55, D*1.12/2 + fz); g.add(rail);

  // STEEP asymmetric side-gable roof
  const roofL = m(box(0.06,1.45,D*1.2),slate);
  roofL.position.set(-W*0.28, 3.60, fz); roofL.rotation.z=0.72; g.add(roofL);
  const roofR = m(box(0.06,1.45,D*1.2),slate);
  roofR.position.set( W*0.28, 3.60, fz); roofR.rotation.z=-0.72; g.add(roofR);
  // gable end walls (front +Z reads against the plaza)
  const gF = m(box(W*1.05,1.1,0.05),stoneDark); gF.position.set(0,3.55, D*1.12/2 + fz); g.add(gF);
  const gB = m(box(W*1.05,1.1,0.05),stoneDark); gB.position.set(0,3.55,-D*1.12/2 + fz); g.add(gB);
  const ridge = m(box(0.09,0.09,D*1.22),slate); ridge.position.set(0,4.15,fz); g.add(ridge);
  // finial spire on ridge front
  const finial = m(cone(0.06,0.30,6),iron); finial.position.set(0,4.30, D*1.12/2 + fz); g.add(finial);

  // tall thin chimney (rear corner)
  const chim=m(box(0.15,0.85,0.15),stoneDark); chim.position.set(-W*0.42,3.7,-D*0.15); g.add(chim);
  const chimCap=m(box(0.2,0.05,0.2),iron); chimCap.position.set(-W*0.42,4.15,-D*0.15); g.add(chimCap);

  // lit narrow arched doorway
  const doorFrame=m(box(0.3,0.66,0.06),iron); doorFrame.position.set(0,0.33,D/2+0.01); g.add(doorFrame);
  const door=m(plane(0.2,0.5),doorMat); door.position.set(0,0.28,D/2+0.05); g.add(door);
  const archTop=m(cone(0.14,0.16,5),iron); archTop.position.set(0,0.66,D/2+0.03); g.add(archTop);

  // ground-floor pointed-arch glowing window (beside door)
  const w1f=m(box(0.2,0.4,0.04),iron); w1f.position.set(-0.22,0.62,D/2+0.01); g.add(w1f);
  const w1=m(plane(0.16,0.34),winA); w1.position.set(-0.22,0.62,D/2+0.04); g.add(w1);
  // middle floor pair
  const w2f=m(box(0.19,0.36,0.04),iron); w2f.position.set(-0.2,1.65,D*1.04/2+0.01); g.add(w2f);
  const w2 =m(plane(0.15,0.3),winB);    w2.position.set(-0.2,1.65,D*1.04/2+0.04); g.add(w2);
  const w3f=m(box(0.19,0.36,0.04),iron); w3f.position.set( 0.2,1.65,D*1.04/2+0.01); g.add(w3f);
  const w3 =m(plane(0.15,0.3),winC);    w3.position.set( 0.2,1.65,D*1.04/2+0.04); g.add(w3);
  // jettied top floor: single big mullioned window on the overhang
  const topZ = D*1.12/2 + fz;
  const w4f=m(box(0.36,0.36,0.04),iron); w4f.position.set(0,2.6,topZ+0.01); g.add(w4f);
  const w4 =m(plane(0.3,0.3),winA);      w4.position.set(0,2.6,topZ+0.04); g.add(w4);
  const mulV=m(box(0.02,0.32,0.05),iron); mulV.position.set(0,2.6,topZ+0.06); g.add(mulV);
  const mulH=m(box(0.32,0.02,0.05),iron); mulH.position.set(0,2.6,topZ+0.06); g.add(mulH);

  g.userData.anim=(grp,now)=>{
    const t=now*0.001;
    winA.opacity   = 0.80 + 0.15*Math.sin(t*2.7+0.3) + 0.04*Math.sin(t*9.3);
    winB.opacity   = 0.74 + 0.13*Math.sin(t*3.6+1.2);
    winC.opacity   = 0.72 + 0.14*Math.sin(t*2.0+2.4);
    doorMat.opacity= 0.82 + 0.10*Math.sin(t*2.9);
  };
  return g;
}

export function buildTown_tavern(opts){
  const c = (opts && opts.color) || '#ffb04a';
  const g = new T.Group();
  const stone = mat('#3a3742',1);
  const stoneDark = mat('#2a2630',1);
  const timber = mat('#2a2018');
  const slate = mat('#23202c');
  const iron = mat('#1a1a22');
  const winColor = new T.Color(c);
  // unique animated mats
  const glowA = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.92, fog:false, blending:T.AdditiveBlending });
  const glowB = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.85, fog:false, blending:T.AdditiveBlending });
  const doorGlow = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.95, fog:false, blending:T.AdditiveBlending });
  const lantern = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:1.0, fog:false, blending:T.AdditiveBlending });
  const signEmblem = new T.MeshBasicMaterial({ color: winColor.clone(), transparent:true, opacity:0.9, fog:false, blending:T.AdditiveBlending });

  // WIDER inn body
  const W = 1.9, D = 1.3;
  const g0 = m(box(W,1.1,D),stone); g0.position.y=0.55; g.add(g0);
  const g1 = m(box(W*0.97,0.95,D*0.97),stoneDark); g1.position.y=1.55; g.add(g1);
  // timber framing across wide front
  const postW=0.08;
  for(let i=-2;i<=2;i++){
    const p=m(box(postW,0.95,postW),timber);
    p.position.set(i*(W*0.97/2)/2.2,1.55,D*0.97/2-postW/2); g.add(p);
  }
  const railT=m(box(W*0.97,0.07,0.05),timber); railT.position.set(0,2.0,D*0.97/2); g.add(railT);
  const railB=m(box(W*0.97,0.07,0.05),timber); railB.position.set(0,1.1,D*0.97/2); g.add(railB);

  // big steep hipped/pitched roof
  const roofL=m(box(0.07,1.5,D*1.1),slate); roofL.position.set(-W*0.26,2.05+0.6,0); roofL.rotation.z=0.6; g.add(roofL);
  const roofR=m(box(0.07,1.5,D*1.1),slate); roofR.position.set(W*0.26,2.05+0.6,0); roofR.rotation.z=-0.6; g.add(roofR);
  const gF=m(box(W*0.92,1.0,0.06),stoneDark); gF.position.set(0,2.55,D*0.5); g.add(gF);
  const gB=m(box(W*0.92,1.0,0.06),stoneDark); gB.position.set(0,2.55,-D*0.5); g.add(gB);
  const ridge=m(box(0.11,0.11,D*1.12),slate); ridge.position.set(0,3.2,0); g.add(ridge);
  // two dormers on wide roof
  [-0.5,0.5].forEach(x=>{
    const dm=m(box(0.3,0.3,0.2),stoneDark); dm.position.set(x*W,2.55,D*0.4); g.add(dm);
    const dw=m(plane(0.16,0.16),glowB); dw.position.set(x*W,2.55,D*0.5); g.add(dw);
    const dr=m(box(0.36,0.05,0.16),slate); dr.position.set(x*W,2.74,D*0.4); dr.rotation.x=0.3; g.add(dr);
  });

  // chimney (smoke origin)
  const chim=m(box(0.22,0.8,0.22),stoneDark); chim.position.set(-W*0.36,3.05,-D*0.25); g.add(chim);
  const chimCap=m(box(0.28,0.06,0.28),iron); chimCap.position.set(-W*0.36,3.45,-D*0.25); g.add(chimCap);
  // faint smoke wisp (3 rising puffs, animated) -- each gets a UNIQUE material so opacities fade independently
  const smokeGrp=new T.Group(); smokeGrp.position.set(-W*0.36,3.5,-D*0.25); g.add(smokeGrp);
  const puffs=[];
  for(let i=0;i<3;i++){
    const sm=new T.MeshBasicMaterial({ color:new T.Color('#6a6470'), transparent:true, opacity:0.18, fog:false, blending:T.AdditiveBlending });
    const pf=m(plane(0.18+i*0.05,0.18+i*0.05),sm); pf.position.y=i*0.25; smokeGrp.add(pf); puffs.push(pf);
  }

  // grand lit double doorway
  const doorFrame=m(box(0.6,0.78,0.07),iron); doorFrame.position.set(0,0.39,D/2+0.01); g.add(doorFrame);
  const door=m(plane(0.48,0.62),doorGlow); door.position.set(0,0.34,D/2+0.05); g.add(door);
  const lintel=m(box(0.66,0.1,0.08),timber); lintel.position.set(0,0.82,D/2+0.02); g.add(lintel);

  // wide warm windows across front (4)
  [-0.62,-0.2,0.2,0.62].forEach((x,i)=>{
    const wm = (i%2===0)?glowA:glowB;
    const wn=m(plane(0.26,0.34),wm); wn.position.set(x,1.6,D*0.97/2+0.04); g.add(wn);
    const wf=m(box(0.3,0.38,0.04),iron); wf.position.set(x,1.6,D*0.97/2+0.01); g.add(wf);
    // ground floor windows flanking door
    if(Math.abs(x)>0.4){
      const gw=m(plane(0.24,0.3),glowB); gw.position.set(x,0.6,D/2+0.04); g.add(gw);
      const gf=m(box(0.28,0.34,0.04),iron); gf.position.set(x,0.6,D/2+0.01); g.add(gf);
    }
  });
  // entry lantern beside door
  const lampBkt=m(box(0.04,0.04,0.2),iron); lampBkt.position.set(0.38,0.95,D/2+0.1); g.add(lampBkt);
  const lamp=m(box(0.1,0.14,0.1),lantern); lamp.position.set(0.38,0.9,D/2+0.2); g.add(lamp);

  // --- HANGING SIGN on wrought-iron bracket (swings) ---
  // bracket fixed to front wall, upper right
  const armBase=m(box(0.05,0.05,0.05),iron); armBase.position.set(W*0.5,2.1,D/2); g.add(armBase);
  const arm=m(box(0.5,0.05,0.05),iron); arm.position.set(W*0.5+0.22,2.1,D/2+0.02); g.add(arm);
  const armStay=m(box(0.05,0.3,0.05),iron); armStay.position.set(W*0.5+0.05,1.95,D/2+0.02); armStay.rotation.z=0.5; g.add(armStay);
  // swinging sign group (pivots at end of arm)
  const signPivot=new T.Group(); signPivot.position.set(W*0.5+0.44,2.08,D/2+0.04); g.add(signPivot);
  const hangerL=m(box(0.02,0.16,0.02),iron); hangerL.position.set(-0.12,-0.08,0); signPivot.add(hangerL);
  const hangerR=m(box(0.02,0.16,0.02),iron); hangerR.position.set(0.12,-0.08,0); signPivot.add(hangerR);
  const signBoard=m(box(0.34,0.28,0.03),timber); signBoard.position.set(0,-0.32,0); signPivot.add(signBoard);
  const signFrame=m(box(0.38,0.04,0.04),iron); signFrame.position.set(0,-0.18,0); signPivot.add(signFrame);
  // glowing tankard/ale emblem on the board
  const tankBody=m(box(0.12,0.14,0.02),signEmblem); tankBody.position.set(-0.02,-0.32,0.03); signPivot.add(tankBody);
  const tankHandle=m(box(0.04,0.08,0.02),signEmblem); tankHandle.position.set(0.08,-0.32,0.03); signPivot.add(tankHandle);
  const tankFroth=m(box(0.14,0.04,0.02),signEmblem); tankFroth.position.set(-0.02,-0.23,0.03); signPivot.add(tankFroth);

  // --- anim: swinging sign + rising smoke + warm flicker ---
  g.userData.anim=(grp,now)=>{
    const t=now*0.001;
    signPivot.rotation.z=0.12*Math.sin(t*1.4);
    glowA.opacity=0.84+0.12*Math.sin(t*2.4)+0.04*Math.sin(t*8.0);
    glowB.opacity=0.78+0.1*Math.sin(t*3.1+1.0);
    doorGlow.opacity=0.88+0.08*Math.sin(t*2.0+0.5);
    lantern.opacity=0.8+0.2*Math.sin(t*5.0+0.7);
    // smoke rise + fade loop (each puff has its own material)
    for(let i=0;i<puffs.length;i++){
      const ph=(t*0.4 + i*0.34)%1.0;
      puffs[i].position.y=ph*0.9;
      puffs[i].position.x=Math.sin(ph*4.0+i)*0.08;
      puffs[i].material.opacity=0.18*(1.0-ph);
      const sc=0.6+ph*1.2; puffs[i].scale.set(sc,sc,sc);
    }
  };
  return g;
}

export function buildTown_shop(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#ffb858';
  const stone = mat('#3a3742', 1);
  const stoneDk = mat('#2a2630', 1);
  const timber = mat('#2a2018');
  const slate = mat('#23202c');
  const iron = mat('#1a1a22');
  const cloth = mat(c, 0.42);
  const clothDk = mat(c, 0.26);
  const woodWare = mat('#3a2a18');
  const win = matAdd('#ffb858', 0.85);
  const sign = matAdd(c, 0.7);

  // ---- house body: tall gothic shop, stone ground floor + timbered upper ----
  const body = m(box(1.5, 1.5, 1.2), stone); body.position.set(0, 0.75, 0);
  const upper = m(box(1.56, 0.7, 1.26), stoneDk); upper.position.set(0, 1.72, 0);
  // timber framing strips on the upper storey (front, +Z)
  const beamH = m(box(1.56, 0.07, 0.04), timber); beamH.position.set(0, 1.72, 0.64);
  const beamV1 = m(box(0.06, 0.7, 0.04), timber); beamV1.position.set(-0.5, 1.72, 0.64);
  const beamV2 = m(box(0.06, 0.7, 0.04), timber); beamV2.position.set(0.5, 1.72, 0.64);
  const beamX = m(box(0.05, 0.85, 0.04), timber); beamX.position.set(0, 1.72, 0.64); beamX.rotation.z = 0.6;
  // corner posts on the lower stone body
  const postL = m(box(0.1, 1.5, 0.1), timber); postL.position.set(-0.74, 0.75, 0.58);
  const postR = m(box(0.1, 1.5, 0.1), timber); postR.position.set(0.74, 0.75, 0.58);

  // ---- steep pitched gothic roof (two angled slabs + a ridge) ----
  const roofL = m(box(0.95, 0.07, 1.4), slate); roofL.position.set(-0.42, 2.32, 0); roofL.rotation.z = 0.72;
  const roofR = m(box(0.95, 0.07, 1.4), slate); roofR.position.set(0.42, 2.32, 0); roofR.rotation.z = -0.72;
  const ridge = m(box(0.08, 0.08, 1.42), timber); ridge.position.set(0, 2.66, 0);
  // front gable triangle to close the pitch (faces +Z)
  const gable = m(cone(0.86, 0.62, 3), stoneDk); gable.position.set(0, 2.32, 0.66); gable.rotation.x = Math.PI / 2; gable.scale.set(1, 1, 0.12);
  // little brick chimney
  const chimney = m(box(0.18, 0.5, 0.18), stoneDk); chimney.position.set(0.42, 2.5, -0.3);
  const chimCap = m(box(0.24, 0.06, 0.24), iron); chimCap.position.set(0.42, 2.77, -0.3);

  g.add(body, upper, beamH, beamV1, beamV2, beamX, postL, postR, roofL, roofR, ridge, gable, chimney, chimCap);

  // ---- glowing upper-storey windows (leaded, warm) ----
  const winFrameL = m(box(0.3, 0.42, 0.04), iron); winFrameL.position.set(-0.36, 1.74, 0.66);
  const winFrameR = m(box(0.3, 0.42, 0.04), iron); winFrameR.position.set(0.36, 1.74, 0.66);
  const glassL = m(box(0.22, 0.34, 0.03), win); glassL.position.set(-0.36, 1.74, 0.68);
  const glassR = m(box(0.22, 0.34, 0.03), win); glassR.position.set(0.36, 1.74, 0.68);
  g.add(winFrameL, winFrameR, glassL, glassR);

  // ---- door set into the stone at +Z, slightly to one side ----
  const doorFrame = m(box(0.42, 0.78, 0.08), timber); doorFrame.position.set(0.42, 0.42, 0.6);
  const door = m(box(0.3, 0.66, 0.04), mat('#1f1812')); door.position.set(0.42, 0.36, 0.64);
  const doorGlow = m(box(0.18, 0.18, 0.03), matAdd('#ffb858', 0.5)); doorGlow.position.set(0.42, 0.58, 0.66);
  g.add(doorFrame, door, doorGlow);

  // ---- STALL / AWNING storefront on the +Z front side ----
  // counter
  const counter = m(box(0.92, 0.5, 0.46), woodWare); counter.position.set(-0.34, 0.25, 0.92);
  const counterTop = m(box(0.98, 0.06, 0.52), timber); counterTop.position.set(-0.34, 0.53, 0.92);
  g.add(counter, counterTop);

  // striped cloth awning sloping out over the counter
  const awning = new T.Group(); awning.position.set(-0.34, 1.04, 0.86);
  const a1 = m(box(0.98, 0.04, 0.66), cloth); a1.position.set(0, 0, 0.18); a1.rotation.x = -0.5;
  const stripe1 = m(box(0.18, 0.05, 0.66), clothDk); stripe1.position.set(-0.3, 0.002, 0.18); stripe1.rotation.x = -0.5;
  const stripe2 = m(box(0.18, 0.05, 0.66), clothDk); stripe2.position.set(0.16, 0.002, 0.18); stripe2.rotation.x = -0.5;
  // scalloped valance hem (little down-pointing teeth)
  const hem = new T.Group(); hem.position.set(0, -0.02, 0.5);
  for (let i = 0; i < 5; i++) {
    const tooth = m(cone(0.09, 0.13, 3), cloth);
    tooth.position.set(-0.4 + i * 0.2, -0.05, 0);
    tooth.rotation.x = Math.PI; tooth.scale.set(1, 1, 0.3);
    hem.add(tooth);
  }
  awning.add(a1, stripe1, stripe2, hem);
  // awning support posts down to the ground
  const supL = m(box(0.06, 1.06, 0.06), timber); supL.position.set(-0.8, 0.53, 1.18);
  const supR = m(box(0.06, 1.06, 0.06), timber); supR.position.set(0.12, 0.53, 1.18);
  g.add(awning, supL, supR);

  // ---- wares on the counter: crates, glowing bottles ----
  const crateA = m(box(0.2, 0.2, 0.2), woodWare); crateA.position.set(-0.66, 0.66, 0.92);
  const crateB = m(box(0.16, 0.16, 0.16), mat('#2e2012')); crateB.position.set(-0.62, 0.84, 0.86);
  const bottle1 = m(cyl(0.04, 0.05, 0.16, 5), matAdd('#7ad0a0', 0.55)); bottle1.position.set(-0.2, 0.64, 0.94);
  const bottle2 = m(cyl(0.04, 0.05, 0.14, 5), matAdd('#c87aff', 0.55)); bottle2.position.set(-0.06, 0.63, 0.9);
  const bottle3 = m(cyl(0.035, 0.045, 0.12, 5), matAdd('#ff6a6a', 0.55)); bottle3.position.set(-0.34, 0.62, 0.96);
  g.add(crateA, crateB, bottle1, bottle2, bottle3);

  // glowing hanging lantern at the stall corner (UNIQUE mat -> animated flicker)
  const lanternMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const lantHook = m(box(0.03, 0.16, 0.03), iron); lantHook.position.set(-0.8, 1.1, 1.18);
  const lantCage = m(box(0.1, 0.14, 0.1), iron); lantCage.position.set(-0.8, 0.96, 1.18);
  const lantGlow = m(box(0.07, 0.1, 0.07), lanternMat); lantGlow.position.set(-0.8, 0.96, 1.18);
  const lantCap = m(cone(0.08, 0.07, 4), iron); lantCap.position.set(-0.8, 1.05, 1.18);
  g.add(lantHook, lantCage, lantGlow, lantCap);

  // ---- hanging shop sign on a wrought-iron bracket ----
  const bracket = m(box(0.4, 0.05, 0.04), iron); bracket.position.set(0.42, 1.5, 0.82);
  const bracketArm = m(box(0.05, 0.3, 0.04), iron); bracketArm.position.set(0.62, 1.38, 0.82);
  // sign pivots from the bracket arm: parent group at the arm, board hangs below
  const signPivot = new T.Group(); signPivot.position.set(0.62, 1.29, 0.82);
  const signBoard = m(box(0.36, 0.26, 0.04), timber); signBoard.position.set(0, -0.13, 0);
  const signGlyph = m(box(0.16, 0.12, 0.03), sign); signGlyph.position.set(0, -0.13, 0.03);
  signPivot.add(signBoard, signGlyph);
  g.add(bracket, bracketArm, signPivot);

  g.userData.anim = (gr, now) => {
    // lantern warm flicker (unique material -> safe to animate)
    lanternMat.opacity = 0.72 + Math.sin(now / 130) * 0.1 + Math.sin(now / 47) * 0.06;
    // sign sways gently on its bracket (transform only, no material change)
    signPivot.rotation.z = Math.sin(now / 900) * 0.08;
  };
  return g;
}

export function buildTown_vault(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#ffd24a';
  const ashlar = mat('#3a3742', 1);
  const ashlarDk = mat('#2a2630', 1);
  const ashlarLt = mat('#46424f', 1);
  const iron = mat('#1a1a22', 1);
  const ironLt = mat('#2a2a34', 1);
  const win = matAdd('#ffb858', 0.7);

  // ---- squat heavy ashlar body (wider than tall, fortress-like) ----
  const body = m(box(1.7, 1.5, 1.5), ashlar); body.position.set(0, 0.75, 0);
  // ashlar block courses suggested by stacked offset slabs of slightly varied tone
  const course1 = m(box(1.74, 0.04, 1.54), ashlarDk); course1.position.set(0, 0.5, 0);
  const course2 = m(box(1.74, 0.04, 1.54), ashlarDk); course2.position.set(0, 1.0, 0);
  // chunky corner quoins
  const qFL = m(box(0.2, 1.5, 0.2), ashlarLt); qFL.position.set(-0.78, 0.75, 0.66);
  const qFR = m(box(0.2, 1.5, 0.2), ashlarLt); qFR.position.set(0.78, 0.75, 0.66);
  const qBL = m(box(0.2, 1.5, 0.2), ashlarLt); qBL.position.set(-0.78, 0.75, -0.66);
  const qBR = m(box(0.2, 1.5, 0.2), ashlarLt); qBR.position.set(0.78, 0.75, -0.66);
  g.add(body, course1, course2, qFL, qFR, qBL, qBR);

  // ---- low battlement top (crenellations) ----
  const parapet = m(box(1.78, 0.16, 1.58), ashlarDk); parapet.position.set(0, 1.58, 0);
  for (let i = 0; i < 5; i++) {
    const x = -0.7 + i * 0.35;
    const mF = m(box(0.22, 0.22, 0.16), ashlarLt); mF.position.set(x, 1.77, 0.7); g.add(mF);
    const mB = m(box(0.22, 0.22, 0.16), ashlarLt); mB.position.set(x, 1.77, -0.7); g.add(mB);
  }
  for (let i = 0; i < 4; i++) {
    const z = -0.52 + i * 0.35;
    const mLs = m(box(0.16, 0.22, 0.22), ashlarLt); mLs.position.set(-0.78, 1.77, z); g.add(mLs);
    const mRs = m(box(0.16, 0.22, 0.22), ashlarLt); mRs.position.set(0.78, 1.77, z); g.add(mRs);
  }
  g.add(parapet);

  // ---- reinforced iron-barred door (recessed pointed-arch portal) ----
  const portal = m(box(0.66, 1.0, 0.18), ashlarDk); portal.position.set(0, 0.5, 0.7);
  const arch = m(cone(0.4, 0.34, 4), ashlarDk); arch.position.set(0, 1.0, 0.7); arch.rotation.y = Math.PI / 4;
  const doorPlate = m(box(0.5, 0.86, 0.06), iron); doorPlate.position.set(0, 0.46, 0.79);
  // warm glow leaking around the vault door so the entrance reads as lit
  const doorGlow = m(box(0.46, 0.82, 0.02), matAdd('#ffcaa0', 0.32)); doorGlow.position.set(0, 0.46, 0.76);
  g.add(doorGlow);
  // vertical iron bars across the door
  for (let i = 0; i < 4; i++) {
    const bar = m(box(0.05, 0.82, 0.04), ironLt); bar.position.set(-0.18 + i * 0.12, 0.46, 0.83); g.add(bar);
  }
  // horizontal iron straps
  const strapA = m(box(0.5, 0.06, 0.05), ironLt); strapA.position.set(0, 0.66, 0.83);
  const strapB = m(box(0.5, 0.06, 0.05), ironLt); strapB.position.set(0, 0.26, 0.83);
  // big rivet bolts
  const boltA = m(box(0.06, 0.06, 0.05), iron); boltA.position.set(-0.2, 0.66, 0.86);
  const boltB = m(box(0.06, 0.06, 0.05), iron); boltB.position.set(0.2, 0.66, 0.86);
  g.add(portal, arch, doorPlate, strapA, strapB, boltA, boltB);

  // ---- glowing coin / gem emblem above the door ----
  const emblemBack = m(cyl(0.22, 0.22, 0.05, 8), iron); emblemBack.rotation.x = Math.PI / 2; emblemBack.position.set(0, 1.22, 0.74);
  const emblemMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.92, blending: T.AdditiveBlending, depthWrite: false });
  const emblem = m(cyl(0.15, 0.15, 0.06, 8), emblemMat); emblem.rotation.x = Math.PI / 2; emblem.position.set(0, 1.22, 0.77);
  // a coin-stack / gem glyph on the emblem face
  const glyph = m(box(0.06, 0.14, 0.03), matAdd('#fff4cf', 0.85)); glyph.position.set(0, 1.22, 0.81);
  g.add(emblemBack, emblem, glyph);

  // ---- small barred windows flanking the door ----
  function barredWindow(x) {
    const recess = m(box(0.24, 0.34, 0.08), ashlarDk); recess.position.set(x, 0.78, 0.72);
    const glow = m(box(0.16, 0.26, 0.03), win); glow.position.set(x, 0.78, 0.76);
    const barA = m(box(0.03, 0.3, 0.03), iron); barA.position.set(x - 0.05, 0.78, 0.79);
    const barB = m(box(0.03, 0.3, 0.03), iron); barB.position.set(x + 0.05, 0.78, 0.79);
    const barH = m(box(0.2, 0.03, 0.03), iron); barH.position.set(x, 0.78, 0.79);
    g.add(recess, glow, barA, barB, barH);
  }
  barredWindow(-0.56);
  barredWindow(0.56);

  // ---- a wrought-iron lantern bracket by the door for grounding light ----
  const lampMat = new T.MeshBasicMaterial({ color: '#ffb858', fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  const lampArm = m(box(0.04, 0.04, 0.24), iron); lampArm.position.set(-0.42, 1.12, 0.82);
  const lampCage = m(box(0.1, 0.16, 0.1), iron); lampCage.position.set(-0.42, 1.0, 0.94);
  const lampGlow = m(box(0.06, 0.11, 0.06), lampMat); lampGlow.position.set(-0.42, 1.0, 0.94);
  g.add(lampArm, lampCage, lampGlow);

  g.userData.anim = (gr, now) => {
    // emblem pulses like treasure
    emblemMat.opacity = 0.78 + Math.sin(now / 360) * 0.16;
    const p = 1 + Math.sin(now / 360) * 0.06;
    emblem.scale.set(p, p, 1);
    // door lamp flicker
    lampMat.opacity = 0.7 + Math.sin(now / 110) * 0.1 + Math.sin(now / 53) * 0.05;
  };
  return g;
}

export function buildTown_guildhall(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#c8463c';
  const stone = mat('#3a3742', 1);
  const stoneDk = mat('#2a2630', 1);
  const stoneLt = mat('#46424f', 1);
  const slate = mat('#23202c', 1);
  const timber = mat('#2a2018', 1);
  const iron = mat('#1a1a22', 1);
  const gold = mat('#7a6a2a', 1);
  const win = matAdd('#ffb858', 0.85);
  const doorWarm = matAdd('#ffb858', 0.5);
  const crestGlow = matAdd(c, 0.6);
  const crestBarGlow = matAdd(c, 0.85);
  const glyphGlow = matAdd('#ffe8b0', 0.7);

  // ---- stately hall body ----
  const body = m(box(1.8, 1.8, 1.4), stone); body.position.set(0, 0.9, 0);
  const plinth = m(box(1.9, 0.2, 1.5), stoneDk); plinth.position.set(0, 0.1, 0);
  const cornice = m(box(1.88, 0.12, 1.48), stoneLt); cornice.position.set(0, 1.84, 0);
  // buttresses on the front corners
  const butL = m(box(0.22, 1.7, 0.3), stoneDk); butL.position.set(-0.82, 0.85, 0.78);
  const butR = m(box(0.22, 1.7, 0.3), stoneDk); butR.position.set(0.82, 0.85, 0.78);
  const butCapL = m(cone(0.18, 0.3, 4), slate); butCapL.position.set(-0.82, 1.85, 0.78); butCapL.rotation.y = Math.PI / 4;
  const butCapR = m(cone(0.18, 0.3, 4), slate); butCapR.position.set(0.82, 1.85, 0.78); butCapR.rotation.y = Math.PI / 4;
  g.add(body, plinth, cornice, butL, butR, butCapL, butCapR);

  // ---- steep pitched roof + gable ----
  const roofL = m(box(1.1, 0.07, 1.6), slate); roofL.position.set(-0.5, 2.42, 0); roofL.rotation.z = 0.72;
  const roofR = m(box(1.1, 0.07, 1.6), slate); roofR.position.set(0.5, 2.42, 0); roofR.rotation.z = -0.72;
  const ridge = m(box(0.08, 0.08, 1.62), timber); ridge.position.set(0, 2.82, 0);
  const gable = m(cone(1.0, 0.7, 3), stoneDk); gable.position.set(0, 2.42, 0.7); gable.rotation.x = Math.PI / 2; gable.scale.set(1, 1, 0.12);
  // ridge finial
  const finial = m(cone(0.07, 0.28, 4), gold); finial.position.set(0, 2.96, 0);
  g.add(roofL, roofR, ridge, gable, finial);

  // ---- small corner tower (slender, with its own spire) ----
  const tower = m(box(0.5, 2.3, 0.5), stoneDk); tower.position.set(-0.95, 1.15, -0.55);
  const towerWin = m(box(0.18, 0.4, 0.04), win); towerWin.position.set(-0.95, 1.7, -0.29);
  const towerWin2 = m(box(0.18, 0.3, 0.04), win); towerWin2.position.set(-1.21, 1.5, -0.55); towerWin2.rotation.y = Math.PI / 2;
  const towerBatt = m(box(0.6, 0.12, 0.6), stoneLt); towerBatt.position.set(-0.95, 2.36, -0.55);
  const spire = m(cone(0.36, 0.9, 4), slate); spire.position.set(-0.95, 2.86, -0.55); spire.rotation.y = Math.PI / 4;
  const spireTip = m(cone(0.05, 0.22, 4), gold); spireTip.position.set(-0.95, 3.4, -0.55);
  g.add(tower, towerWin, towerWin2, towerBatt, spire, spireTip);

  // ---- tall lit windows along the front (pointed-arch) ----
  function lancet(x) {
    const frame = m(box(0.34, 0.78, 0.05), iron); frame.position.set(x, 1.0, 0.72);
    const glass = m(box(0.24, 0.62, 0.03), win); glass.position.set(x, 0.98, 0.74);
    const top = m(cone(0.17, 0.26, 4), win); top.position.set(x, 1.42, 0.74); top.rotation.y = Math.PI / 4;
    const mull = m(box(0.03, 0.62, 0.04), iron); mull.position.set(x, 0.98, 0.76);
    g.add(frame, glass, top, mull);
  }
  lancet(-0.44);
  lancet(0.44);

  // ---- arched main door with a crest/shield above ----
  const doorRecess = m(box(0.6, 0.96, 0.14), stoneDk); doorRecess.position.set(0, 0.58, 0.7);
  const doorArch = m(cone(0.36, 0.34, 4), stoneDk); doorArch.position.set(0, 1.06, 0.7); doorArch.rotation.y = Math.PI / 4;
  const door = m(box(0.46, 0.82, 0.05), timber); door.position.set(0, 0.52, 0.78);
  const doorGlow = m(box(0.3, 0.16, 0.03), doorWarm); doorGlow.position.set(0, 0.84, 0.8);
  const doorBand = m(box(0.46, 0.05, 0.05), iron); doorBand.position.set(0, 0.6, 0.81);
  g.add(doorRecess, doorArch, door, doorGlow, doorBand);

  // crest / shield over the door
  const shieldTop = m(box(0.34, 0.26, 0.06), stoneLt); shieldTop.position.set(0, 1.34, 0.76);
  const shieldPt = m(cone(0.24, 0.26, 3), stoneLt); shieldPt.position.set(0, 1.1, 0.76); shieldPt.rotation.x = Math.PI / 2; shieldPt.rotation.z = Math.PI; shieldPt.scale.set(1, 1, 0.5);
  const crest = m(box(0.18, 0.18, 0.03), crestGlow); crest.position.set(0, 1.34, 0.8);
  const crestBar = m(box(0.2, 0.05, 0.03), crestBarGlow); crestBar.position.set(0, 1.34, 0.81);
  g.add(shieldTop, shieldPt, crest, crestBar);

  // ---- two tall BANNERS flanking the crest (animated sway) ----
  const banners = [];
  function banner(x) {
    const grp = new T.Group(); grp.position.set(x, 1.6, 0.74);
    const pole = m(box(0.04, 1.1, 0.04), iron); pole.position.set(0, -0.2, 0);
    grp.add(pole);
    // unique additive material per banner so we can animate its opacity independently
    const clothMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
    const cloth = m(box(0.3, 0.8, 0.03), clothMat); cloth.position.set(0, -0.42, 0.03);
    // pointed banner tail (shares the animated cloth material so it sways/pulses together)
    const tail = m(cone(0.21, 0.22, 3), clothMat); tail.position.set(0, -0.93, 0.03); tail.rotation.x = Math.PI / 2; tail.rotation.z = Math.PI; tail.scale.set(1, 1, 0.3);
    // a charge glyph on the banner (static additive glow)
    const glyph = m(box(0.12, 0.12, 0.02), glyphGlow); glyph.position.set(0, -0.4, 0.05);
    grp.add(cloth, tail, glyph);
    grp.userData.cloth = cloth; grp.userData.tail = tail; grp.userData.glyph = glyph; grp.userData.clothMat = clothMat;
    banners.push(grp);
    return grp;
  }
  const bannerL = banner(-0.72);
  const bannerR = banner(0.72);
  g.add(bannerL, bannerR);

  g.userData.anim = (gr, now) => {
    // banners sway out of phase
    const sway = (b, ph) => {
      const s = Math.sin(now / 620 + ph);
      b.userData.cloth.rotation.y = s * 0.22;
      b.userData.tail.rotation.y = s * 0.22;
      b.userData.glyph.rotation.y = s * 0.22;
      b.userData.cloth.position.z = 0.03 + Math.abs(s) * 0.03;
      b.userData.clothMat.opacity = 0.46 + Math.sin(now / 500 + ph) * 0.08;
    };
    sway(bannerL, 0);
    sway(bannerR, 1.1);
  };
  return g;
}

export function buildTown_tent(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#b46cff';
  const cloth = mat(c, 0.4);
  const clothDk = mat(c, 0.26);
  const wood = mat('#3a2a18');
  const woodDk = mat('#241a10');
  const iron = mat('#1a1a22');
  const glowInner = matAdd(c, 0.5);

  // ---- peaked patterned cloth TENT glowing from within ----
  // hexagonal conical tent body (cone) sitting on the ground
  const tent = m(cone(0.9, 1.5, 6), cloth); tent.position.set(0, 0.75, 0); tent.rotation.y = Math.PI / 6;
  // a darker patterned band near the base (zigzag suggested by tone shift)
  const band = m(cyl(0.78, 0.9, 0.26, 6), clothDk); band.position.set(0, 0.26, 0); band.rotation.y = Math.PI / 6;
  // alternating vertical seam ribs to read as panels
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rib = m(box(0.04, 1.5, 0.04), clothDk);
    rib.position.set(Math.cos(a) * 0.45, 0.75, Math.sin(a) * 0.45);
    rib.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    g.add(rib);
  }
  // inner glow shell so the tent looks lit from inside
  const innerGlow = m(cone(0.6, 1.1, 6), glowInner); innerGlow.position.set(0, 0.65, 0); innerGlow.rotation.y = Math.PI / 6;
  g.add(tent, band, innerGlow);

  // tent pole finial at the peak
  const peakBall = m(cone(0.1, 0.22, 5), iron); peakBall.position.set(0, 1.62, 0);
  const peakGlowMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const peakGlow = m(box(0.07, 0.07, 0.07), peakGlowMat); peakGlow.position.set(0, 1.74, 0);
  // a little pennant on the peak
  const pennant = m(cone(0.14, 0.16, 3), cloth); pennant.position.set(0.12, 1.66, 0); pennant.rotation.z = -Math.PI / 2; pennant.scale.set(1, 1, 0.25);
  g.add(peakBall, peakGlow, pennant);

  // ---- glowing entry slit at the front (faces +Z) ----
  const entry = m(box(0.26, 0.7, 0.04), matAdd('#ffce6a', 0.7)); entry.position.set(0, 0.42, 0.84);
  const flapL = m(box(0.14, 0.78, 0.05), clothDk); flapL.position.set(-0.22, 0.45, 0.82); flapL.rotation.z = 0.12;
  const flapR = m(box(0.14, 0.78, 0.05), clothDk); flapR.position.set(0.22, 0.45, 0.82); flapR.rotation.z = -0.12;
  g.add(entry, flapL, flapR);

  // ---- small hanging lanterns around the tent (animated flicker) ----
  const lanterns = [];
  const lanternDefs = [[-0.7, 0.9, 0.5, '#ffb858'], [0.74, 0.85, 0.42, '#7ad0ff'], [0.55, 1.0, -0.55, '#ff7ab0']];
  for (let i = 0; i < lanternDefs.length; i++) {
    const d = lanternDefs[i];
    const hook = m(box(0.02, 0.12, 0.02), iron); hook.position.set(d[0], d[1] + 0.12, d[2]);
    const cage = m(box(0.09, 0.12, 0.09), iron); cage.position.set(d[0], d[1], d[2]);
    const lmat = new T.MeshBasicMaterial({ color: d[3], fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    const glow = m(box(0.06, 0.08, 0.06), lmat); glow.position.set(d[0], d[1], d[2]);
    const cap = m(cone(0.07, 0.06, 4), iron); cap.position.set(d[0], d[1] + 0.08, d[2]);
    g.add(hook, cage, glow, cap);
    lanterns.push({ mat: lmat, ph: i * 1.7 });
  }

  // ---- little wooden wagon beside the tent ----
  const wagon = new T.Group(); wagon.position.set(-1.15, 0, 0.1);
  const bed = m(box(0.7, 0.26, 0.5), wood); bed.position.set(0, 0.42, 0);
  const sideF = m(box(0.74, 0.22, 0.04), woodDk); sideF.position.set(0, 0.5, 0.26);
  const sideB = m(box(0.74, 0.22, 0.04), woodDk); sideB.position.set(0, 0.5, -0.26);
  const axle = m(box(0.74, 0.06, 0.06), iron); axle.position.set(0, 0.24, 0);
  // a big spoked wheel (the visible near-side one)
  const wheel = m(cyl(0.26, 0.26, 0.06, 8), woodDk); wheel.rotation.z = Math.PI / 2; wheel.position.set(0.2, 0.24, 0.3);
  const hub = m(cyl(0.07, 0.07, 0.08, 6), wood); hub.rotation.z = Math.PI / 2; hub.position.set(0.2, 0.24, 0.3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const spoke = m(box(0.04, 0.46, 0.03), wood); spoke.position.set(0.2, 0.24, 0.3); spoke.rotation.x = Math.PI / 2; spoke.rotation.y = a;
    wagon.add(spoke);
  }
  const wheelB = m(cyl(0.22, 0.22, 0.05, 8), woodDk); wheelB.rotation.z = Math.PI / 2; wheelB.position.set(-0.25, 0.22, -0.28);
  wagon.add(bed, sideF, sideB, axle, wheel, hub, wheelB);

  // a few exotic crates / a barrel on and beside the wagon
  const crateA = m(box(0.22, 0.22, 0.22), wood); crateA.position.set(-0.12, 0.66, 0);
  const crateB = m(box(0.16, 0.16, 0.16), woodDk); crateB.position.set(0.12, 0.63, 0.06);
  const crateGlow = m(box(0.18, 0.05, 0.18), matAdd(c, 0.4)); crateGlow.position.set(-0.12, 0.78, 0);
  const barrel = m(cyl(0.13, 0.15, 0.32, 6), wood); barrel.position.set(0.5, 0.16, 0.3);
  const barrelTop = m(cyl(0.11, 0.11, 0.04, 6), matAdd('#ffce6a', 0.45)); barrelTop.position.set(0.5, 0.33, 0.3);
  wagon.add(crateA, crateB, crateGlow, barrel, barrelTop);
  g.add(wagon);

  // a loose exotic crate near the tent door
  const sideCrate = m(box(0.2, 0.2, 0.2), wood); sideCrate.position.set(0.74, 0.1, 0.55);
  const sideCrateGlow = m(box(0.16, 0.04, 0.16), matAdd('#7ad0ff', 0.4)); sideCrateGlow.position.set(0.74, 0.21, 0.55);
  g.add(sideCrate, sideCrateGlow);

  g.userData.anim = (gr, now) => {
    // lanterns flicker out of phase
    for (let i = 0; i < lanterns.length; i++) {
      const L = lanterns[i];
      L.mat.opacity = 0.66 + Math.sin(now / 120 + L.ph) * 0.12 + Math.sin(now / 41 + L.ph) * 0.07;
    }
    // peak glow breathes softly + pennant sways
    peakGlowMat.opacity = 0.74 + Math.sin(now / 300) * 0.16;
    pennant.rotation.x = Math.sin(now / 700) * 0.25;
  };
  return g;
}

export function buildTown_lamppost(opts){
  const c = (opts && opts.color) || '#ffb858';
  const g = new T.Group();
  const iron = mat('#1a1a22');
  const ironLip = mat('#2a2630',1);
  const glass = matAdd(c,0.25);

  // Stepped stone footing so the post reads as planted on the ground (base sits at y=0).
  const baseA = m(box(0.3,0.1,0.3), mat('#2a2630',1)); baseA.position.set(0,0.05,0);
  const baseB = m(box(0.22,0.08,0.22), ironLip); baseB.position.set(0,0.14,0);
  // Slim fluted wrought-iron post.
  const post = m(cyl(0.045,0.06,1.3,8), iron); post.position.set(0,0.83,0);
  // A couple of forged collars breaking up the shaft.
  const collarA = m(cyl(0.07,0.07,0.05,8), ironLip); collarA.position.set(0,0.5,0);
  const collarB = m(cyl(0.07,0.07,0.05,8), ironLip); collarB.position.set(0,1.2,0);
  g.add(baseA, baseB, post, collarA, collarB);

  // Scroll brackets curling out near the top (angular gothic ironwork).
  const brL1 = m(box(0.04,0.04,0.18), iron); brL1.position.set(-0.1,1.46,0); brL1.rotation.z = 0.5;
  const brL2 = m(box(0.04,0.12,0.04), iron); brL2.position.set(-0.17,1.42,0);
  const brR1 = m(box(0.04,0.04,0.18), iron); brR1.position.set(0.1,1.46,0); brR1.rotation.z = -0.5;
  const brR2 = m(box(0.04,0.12,0.04), iron); brR2.position.set(0.17,1.42,0);
  // Front/back scrolls so the head reads from the tilted top-down camera too.
  const brF1 = m(box(0.18,0.04,0.04), iron); brF1.position.set(0,1.46,0.1); brF1.rotation.x = -0.5;
  const brB1 = m(box(0.18,0.04,0.04), iron); brB1.position.set(0,1.46,-0.1); brB1.rotation.x = 0.5;
  g.add(brL1, brL2, brR1, brR2, brF1, brB1);

  // Lantern head: a faceted iron cage cap over a glowing glass housing.
  const neck = m(cyl(0.04,0.05,0.1,6), iron); neck.position.set(0,1.55,0);
  const cage = m(cyl(0.13,0.11,0.26,6), iron); cage.position.set(0,1.72,0);
  const housing = m(cyl(0.105,0.09,0.24,6), glass); housing.position.set(0,1.72,0);
  const cap = m(cone(0.16,0.16,6), iron); cap.position.set(0,1.92,0);
  const finial = m(cone(0.04,0.1,6), ironLip); finial.position.set(0,2.04,0);
  g.add(neck, cage, housing, cap, finial);

  // ANIMATED warm flame + glow halo -- UNIQUE materials (engine mutates these per-frame).
  const flameMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false });
  const glowMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.4,  blending:T.AdditiveBlending, depthWrite:false });
  const FLAME_Y = 1.7;
  const flame = m(cone(0.06,0.18,6), flameMat); flame.position.set(0,FLAME_Y,0);
  const ember = m(box(0.1,0.08,0.1), flameMat); ember.position.set(0,1.62,0);
  const halo  = m(box(0.34,0.4,0.34), glowMat); halo.position.set(0,1.72,0);
  g.add(halo, ember, flame);

  g.userData.anim = (grp, now) => {
    // Candle-like flicker: two beat frequencies on height + brightness.
    const fl = 0.85 + Math.sin(now/120)*0.16 + Math.sin(now/41)*0.07;
    flame.scale.set(1, fl, 1);
    flame.position.x = Math.sin(now/180)*0.012;
    flame.position.y = FLAME_Y + (fl-1)*0.09;
    flameMat.opacity = 0.8 + Math.sin(now/95)*0.18;
    ember.scale.setScalar(0.92 + Math.sin(now/70)*0.12);
    const gp = 0.85 + Math.sin(now/150)*0.15;
    halo.scale.setScalar(gp);
    glowMat.opacity = 0.3 + Math.sin(now/150)*0.12;
  };
  return g;
}

export function buildTown_well(opts){
  const c = (opts && opts.color) || '#6fb8ff';
  const g = new T.Group();
  const stone = mat('#3a3742',1);
  const stoneDark = mat('#2a2630',1);
  const stoneLip = mat('#4a4450',1);
  const wood = mat('#2a2018');
  const iron = mat('#1a1a22');

  // Round ashlar wellhead — a low stone ring (origin at base center, y=0 on ground).
  const wall = m(cyl(0.5,0.52,0.5,12), stone); wall.position.set(0,0.25,0);
  const coping = m(cyl(0.55,0.55,0.08,12), stoneLip); coping.position.set(0,0.52,0);
  const inner = m(cyl(0.4,0.4,0.46,12), stoneDark); inner.position.set(0,0.27,0);
  g.add(wall, coping, inner);

  // Faint glowing water disc deep in the shaft (UNIQUE mat — it shimmers).
  const waterMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.5, blending:T.AdditiveBlending, depthWrite:false });
  const water = m(cyl(0.36,0.36,0.02,12), waterMat); water.position.set(0,0.30,0);
  g.add(water);

  // Two timber posts holding the roof.
  const postL = m(box(0.08,0.85,0.08), wood); postL.position.set(-0.46,0.95,0);
  const postR = m(box(0.08,0.85,0.08), wood); postR.position.set(0.46,0.95,0);
  // Cross beam carrying the windlass.
  const beam = m(box(1.0,0.07,0.07), wood); beam.position.set(0,1.34,0);
  g.add(postL, postR, beam);

  // Windlass roller + crank handle (wrought iron crank).
  const roller = m(cyl(0.06,0.06,0.78,8), wood); roller.position.set(0,1.34,0); roller.rotation.z = Math.PI/2;
  const crank = m(box(0.04,0.16,0.04), iron); crank.position.set(0.5,1.28,0);
  const crankArm = m(box(0.14,0.04,0.04), iron); crankArm.position.set(0.56,1.21,0);
  g.add(roller, crank, crankArm);

  // Peaked little gable roof (steep gothic pitch) — two slate slabs.
  const roofL = m(box(0.62,0.06,0.72), mat('#23202c')); roofL.position.set(-0.27,1.62,0); roofL.rotation.z = 0.7;
  const roofR = m(box(0.62,0.06,0.72), mat('#23202c')); roofR.position.set(0.27,1.62,0); roofR.rotation.z = -0.7;
  const ridge = m(box(0.06,0.06,0.78), stoneLip); ridge.position.set(0,1.86,0);
  g.add(roofL, roofR, ridge);

  // Wrought-iron lantern hanging under the gable so the silhouette READS
  // against the additive black (the well's main light source, top-down visible).
  const lanternGrp = new T.Group(); lanternGrp.position.set(0,1.18,0.30);
  const lanternHook = m(cyl(0.008,0.008,0.14,4), iron); lanternHook.position.set(0,0.11,0);
  const lanternCap = m(cone(0.07,0.06,6), iron); lanternCap.position.set(0,0.05,0);
  // UNIQUE material — the flame flickers per frame.
  const flameMat = new T.MeshBasicMaterial({ color:0xffb858, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false });
  const lanternGlow = m(cyl(0.05,0.055,0.11,6), flameMat); lanternGlow.position.set(0,-0.02,0);
  const lanternBase = m(cyl(0.06,0.05,0.02,6), iron); lanternBase.position.set(0,-0.08,0);
  lanternGrp.add(lanternHook, lanternCap, lanternGlow, lanternBase);
  g.add(lanternGrp);

  // Warm trim accents on the coping so the stone ring catches the eye (cached additive, static).
  const trimF = m(box(0.18,0.04,0.04), matAdd('#ffb858',0.5)); trimF.position.set(0,0.50,0.52);
  const trimB = m(box(0.18,0.04,0.04), matAdd('#ffb858',0.5)); trimB.position.set(0,0.50,-0.52);
  g.add(trimF, trimB);

  // Rope dropping from the roller + a wooden bucket hanging over the mouth.
  const rope = m(cyl(0.012,0.012,0.62,4), mat('#4a4034',0.7)); rope.position.set(-0.30,1.04,0.0);
  const bucketGrp = new T.Group(); bucketGrp.position.set(-0.30,0.72,0.0);
  const bucket = m(cyl(0.1,0.08,0.16,8), wood); bucket.position.set(0,0,0);
  const bucketBand = m(cyl(0.105,0.105,0.03,8), iron); bucketBand.position.set(0,0.05,0);
  const bail = m(box(0.18,0.02,0.02), iron); bail.position.set(0,0.1,0);
  bucketGrp.add(bucket, bucketBand, bail);
  g.add(rope, bucketGrp);

  g.userData.anim = (grp, now) => {
    // Water shimmer deep in the shaft (UNIQUE material).
    waterMat.opacity = 0.40 + Math.sin(now/360)*0.14 + Math.sin(now/150)*0.05;
    const w = 0.94 + Math.sin(now/300)*0.06;
    water.scale.set(w,1,w);
    // Lantern flame flicker (UNIQUE material) — the silhouette anchor.
    flameMat.opacity = 0.85 + Math.sin(now/120)*0.12 + Math.sin(now/47)*0.06;
    lanternGrp.rotation.z = Math.sin(now/900)*0.06;
    // Barely-perceptible bucket sway over the shaft.
    bucketGrp.rotation.z = Math.sin(now/1100)*0.05;
  };
  return g;
}

export function buildTown_banner(opts){
  const c = (opts && opts.color) || '#b8413a';
  const g = new T.Group();
  const iron = mat('#1a1a22');
  const ironLip = mat('#2a2630',1);
  const stone = mat('#3a3742',1);

  // Small stone footing so the pole reads as set into the plaza.
  const foot = m(box(0.26,0.12,0.26), stone); foot.position.set(0,0.06,0);
  const footCap = m(cyl(0.1,0.13,0.06,6), ironLip); footCap.position.set(0,0.15,0);
  // Tall wrought-iron pole.
  const pole = m(cyl(0.035,0.05,2.4,8), iron); pole.position.set(0,1.32,0);
  const collar = m(cyl(0.06,0.06,0.05,8), ironLip); collar.position.set(0,2.2,0);
  // Gothic finial: a faceted spear-point with a small cross-stub.
  const finial = m(cone(0.06,0.2,6), ironLip); finial.position.set(0,2.6,0);
  const finialTip = m(cone(0.025,0.1,6), iron); finialTip.position.set(0,2.74,0);
  const crossbar = m(box(0.4,0.035,0.035), iron); crossbar.position.set(0,2.48,0);
  g.add(foot, footCap, pole, collar, crossbar, finial, finialTip);

  // The banner cloth: a vertical strip of segments hung from the crossbar so we
  // can ripple it per-frame with rotations only (no allocation). The glow and
  // trim materials are UNIQUE new MeshBasicMaterials because their opacity is
  // animated per frame for a lit, breathing flag; the engine never sees a
  // cached material being mutated.
  const clothMat = m_clothMaterial(c);
  const glowMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.45, blending:T.AdditiveBlending, depthWrite:false });
  const trimMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.8, blending:T.AdditiveBlending, depthWrite:false });

  // Hang from a top node just under the crossbar; chain 5 cloth segments so the
  // ripple travels down the strip. The whole thing faces +Z (front of banner).
  const cloth = new T.Group(); cloth.position.set(0,2.44,0.03);
  const segGeo = box(0.46,0.34,0.03);
  const glowGeo = box(0.5,0.36,0.01);
  const segs = [];
  let parent = cloth;
  for (let i=0;i<5;i++){
    const node = new T.Object3D();
    node.position.set(0, i===0 ? -0.17 : -0.34, 0);
    const panel = m(segGeo, clothMat); panel.position.set(0,-0.17,0);
    // A back-lit glow panel just behind each cloth segment so the banner emits
    // against the additive black instead of reading as a dark blob.
    const glow = m(glowGeo, glowMat); glow.position.set(0,-0.17,-0.025);
    node.add(panel, glow);
    parent.add(node);
    segs.push(node);
    parent = node;
  }
  g.add(cloth);

  // Emblem rides on the FACE of the cloth so it sways with the flag: a bright
  // vertical center stripe + a chevron mark. Parented to the top cloth node so
  // it inherits the travelling ripple. Local Y is relative to that node.
  const face = new T.Object3D(); face.position.set(0,-0.68,0.06); segs[0].add(face);
  const stripe = m(box(0.08,1.1,0.01), trimMat); stripe.position.set(0,0,0);
  const emblemA = m(box(0.26,0.05,0.01), trimMat); emblemA.position.set(0,0.22,0.005); emblemA.rotation.z = 0.5;
  const emblemB = m(box(0.26,0.05,0.01), trimMat); emblemB.position.set(0,0.22,0.005); emblemB.rotation.z = -0.5;
  face.add(stripe, emblemA, emblemB);

  g.userData.anim = (grp, now) => {
    // Travelling ripple down the hanging chain  each node lags the one above,
    // so the banner sways and undulates. Rotation-only: allocation-free.
    for (let i=0;i<segs.length;i++){
      const phase = now/520 - i*0.6;
      segs[i].rotation.z = Math.sin(phase)*0.08;
      segs[i].rotation.x = Math.sin(phase*1.3 + 0.5)*0.06;
    }
    // Banner breathes with light; emblem trim pulses a touch brighter.
    glowMat.opacity = 0.38 + Math.sin(now/600)*0.12;
    trimMat.opacity = 0.7 + Math.sin(now/430)*0.18;
    // Subtle whole-cloth sway from the crossbar.
    cloth.rotation.z = Math.sin(now/900)*0.03;
  };
  return g;

  // Local helper: cloth body is a deep jewel tone, additive so it glows softly
  // rather than blocking light. UNIQUE material (its color could be themed) but
  // it is NOT animated, so a plain new material is fine and self-contained.
  function m_clothMaterial(col){
    return new T.MeshBasicMaterial({ color: col, fog:false, transparent:true, opacity:0.85, blending:T.AdditiveBlending, depthWrite:false });
  }
}

export function buildTown_deadtree(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#aee0ff';

  // In ADDITIVE display, opaque dark bark emits almost nothing -> invisible black blob.
  // So the woody mass is drawn with FAINT additive 'moonlit' glow materials so the
  // gnarled silhouette actually reads as emitted light. A warm hanging lantern + a
  // glowing wisp anchor the form. Cached additive mats for all static parts.
  const bark      = matAdd('#5a4a36', 0.5);   // dim cool-warm rim light on main trunk
  const barkDark  = matAdd('#3a2e20', 0.42);  // darker boughs / roots
  const knotMat   = matAdd('#6a563c', 0.55);  // knots catch a touch more light
  const iron      = mat('#1a1a22');           // lantern bracket (opaque, reads as shadow shape)
  const ironTrim  = matAdd('#7a8aa0', 0.4);   // faint cool sheen so the bracket reads

  // gnarled trunk -- tapered cylinders leaning slightly, with a thicker root flare
  const root   = m(cyl(0.22, 0.32, 0.18, 6), barkDark); root.position.set(0, 0.09, 0);
  const trunk  = m(cyl(0.1, 0.2, 1.1, 6), bark);  trunk.position.set(0.02, 0.7, 0);  trunk.rotation.z = -0.05;
  const trunkUp= m(cyl(0.06, 0.1, 0.5, 5), bark); trunkUp.position.set(0.04, 1.34, -0.02); trunkUp.rotation.z = -0.12;
  // a couple of barky knots to break the silhouette
  const knot1 = m(box(0.16, 0.14, 0.14), knotMat); knot1.position.set(-0.05, 0.6, 0.04); knot1.rotation.set(0.3, 0.4, 0.2);
  const knot2 = m(box(0.12, 0.12, 0.12), knotMat); knot2.position.set(0.1, 1.0, -0.04); knot2.rotation.set(0.2, 0.5, 0.4);

  // angular leafless branches -- tapered prisms splitting off the upper trunk
  // each: [x,y,z, rotX,rotZ, len, rad]
  const branchDefs = [
    [-0.04, 1.5, 0.0,  0.5, -0.95, 0.6, 0.05],
    [ 0.1,  1.55,-0.02,-0.4,  0.85, 0.66,0.055],
    [ 0.02, 1.7, 0.02, 1.0, -0.2, 0.5, 0.045],
    [-0.12, 1.4, 0.06, 0.3, -1.4, 0.42,0.04],
    [ 0.16, 1.42,-0.06,-0.2,  1.45,0.4, 0.04]
  ];
  const tips = [];
  for (let i = 0; i < branchDefs.length; i++){
    const d = branchDefs[i];
    const len = d[5], rad = d[6];
    const br = m(cyl(rad * 0.4, rad, len, 5), bark);
    // position the branch so its base joins near the trunk; cone-like taper grows outward
    br.position.set(d[0], d[1] + len * 0.25, d[2]);
    br.rotation.set(d[3], 0, d[4]);
    g.add(br);
    // a few angular twig forks off the larger branches
    if (i < 3){
      const tw = m(cyl(rad * 0.2, rad * 0.45, len * 0.55, 4), barkDark);
      tw.position.set(d[0] + Math.sin(d[4]) * len * 0.45, d[1] + len * 0.5, d[2] + Math.sin(d[3]) * len * 0.3);
      tw.rotation.set(d[3] * 0.5 + 0.6, 0, d[4] * 1.4);
      g.add(tw);
      // record an outer tip for the wisp / lantern to nestle near
      tips.push([d[0] + Math.sin(d[4]) * len * 0.7, d[1] + len * 0.55, d[2] + Math.sin(d[3]) * len * 0.5]);
    }
  }

  g.add(root, trunk, trunkUp, knot1, knot2);

  // ---- hanging wrought-iron lantern (warm anchor so the prop never reads as black) ----
  // hung from the lowest-left bough; a unique flickering flame material + cached glow.
  const lantern = new T.Group();
  lantern.position.set(-0.46, 1.62, 0.12);
  // short iron hook/chain up to the bough
  const chain = m(cyl(0.012, 0.012, 0.26, 4), iron); chain.position.set(0.02, 0.16, 0); chain.rotation.z = 0.15;
  // iron cage posts (4 thin uprights) + cap
  const cap = m(cone(0.075, 0.07, 5), ironTrim); cap.position.set(0, 0.075, 0);
  const base = m(cyl(0.06, 0.07, 0.03, 5), iron); base.position.set(0, -0.075, 0);
  const post1 = m(box(0.012, 0.13, 0.012), iron); post1.position.set(0.045, 0, 0.045);
  const post2 = m(box(0.012, 0.13, 0.012), iron); post2.position.set(-0.045, 0, 0.045);
  const post3 = m(box(0.012, 0.13, 0.012), iron); post3.position.set(0.045, 0, -0.045);
  const post4 = m(box(0.012, 0.13, 0.012), iron); post4.position.set(-0.045, 0, -0.045);
  // warm glass glow (cached additive) + unique animated flame core
  const glass = m(geo('deadtreeLampGlass', () => new T.IcosahedronGeometry(0.055, 0)), matAdd('#ffb858', 0.55));
  const flameMat = new T.MeshBasicMaterial({ color: new T.Color('#ffcf7a'), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const flame = m(geo('deadtreeLampFlame', () => new T.IcosahedronGeometry(0.03, 0)), flameMat);
  lantern.add(chain, cap, base, post1, post2, post3, post4, glass, flame);
  g.add(lantern);

  // ---- one tiny glowing wisp caught in the boughs (unique animated materials) ----
  const wispCol  = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const wispHaze = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false });
  const tp = tips[0] || [0.16, 1.7, 0.1];
  const wisp = new T.Group(); wisp.position.set(tp[0], tp[1], tp[2]);
  const core = m(geo('deadtreeWisp', () => new T.IcosahedronGeometry(0.07, 0)), wispCol);
  const haze = m(geo('deadtreeWispHaze', () => new T.IcosahedronGeometry(0.16, 0)), wispHaze);
  wisp.add(haze, core);
  g.add(wisp);

  const wx = tp[0], wy = tp[1], wz = tp[2];
  g.userData.anim = (grp, now) => {
    // faint wisp bob + drift + breathing glow
    wisp.position.x = wx + Math.sin(now / 900) * 0.04;
    wisp.position.y = wy + Math.sin(now / 620) * 0.05;
    wisp.position.z = wz + Math.cos(now / 1100) * 0.03;
    const p = 0.7 + Math.sin(now / 340) * 0.25;
    wispCol.opacity = 0.6 + p * 0.35;
    haze.scale.setScalar(1 + Math.sin(now / 480) * 0.2);
    core.rotation.y = now / 700;
    // lantern flame flicker (unique material)
    const f = 0.78 + Math.sin(now / 130) * 0.12 + Math.sin(now / 47) * 0.08;
    flameMat.opacity = f;
    flame.scale.setScalar(0.85 + Math.sin(now / 95) * 0.18);
  };
  return g;
}

export function buildTown_gravestones(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#9fd8c8';
  const stone = mat('#3a3742', 1);
  const stoneDark = mat('#2a2630', 1);
  const moss = mat('#26302a', 1);
  const iron = mat('#1a1a22', 1);
  // faint cool etch-glow so the stone silhouettes actually read against black
  const etch = matAdd(c, 0.42);
  const etchSoft = matAdd(c, 0.22);
  const lampWarm = matAdd('#ffb858', 0.95);

  // low grassy/earthen mound the cluster sits on
  const mound = m(cyl(0.62, 0.7, 0.12, 8), moss); mound.position.set(0, 0.06, 0);
  const mound2 = m(cyl(0.42, 0.52, 0.08, 7), stoneDark); mound2.position.set(0.04, 0.15, -0.04);
  g.add(mound, mound2);

  // leaning weathered headstones — a mix of slabs and crosses, each with glowing etched trim
  // slab 1 (rounded-top via a slab + a small cap), tilted
  const s1 = new T.Group(); s1.position.set(-0.26, 0.12, 0.1); s1.rotation.z = 0.14; s1.rotation.y = -0.3;
  const s1b = m(box(0.26, 0.5, 0.07), stone); s1b.position.set(0, 0.25, 0);
  const s1cap = m(cone(0.14, 0.12, 5), stone); s1cap.position.set(0, 0.5, 0); s1cap.rotation.y = Math.PI / 5;
  // etched cross / inscription line glowing faintly on the face
  const s1eV = m(box(0.025, 0.18, 0.02), etch); s1eV.position.set(0, 0.34, 0.04);
  const s1eH = m(box(0.12, 0.025, 0.02), etch); s1eH.position.set(0, 0.4, 0.04);
  const s1line = m(box(0.16, 0.018, 0.02), etchSoft); s1line.position.set(0, 0.18, 0.04);
  s1.add(s1b, s1cap, s1eV, s1eH, s1line); g.add(s1);

  // cross headstone, tilted the other way
  const s2 = new T.Group(); s2.position.set(0.22, 0.16, -0.02); s2.rotation.z = -0.16; s2.rotation.y = 0.4;
  const s2post = m(box(0.09, 0.6, 0.08), stone); s2post.position.set(0, 0.3, 0);
  const s2arm = m(box(0.32, 0.09, 0.08), stone); s2arm.position.set(0, 0.42, 0);
  // glowing seam down the cross so it reads
  const s2glowV = m(box(0.03, 0.5, 0.02), etchSoft); s2glowV.position.set(0, 0.34, 0.05);
  const s2glowH = m(box(0.26, 0.03, 0.02), etchSoft); s2glowH.position.set(0, 0.42, 0.05);
  s2.add(s2post, s2arm, s2glowV, s2glowH); g.add(s2);

  // small slab toppled / low at the back
  const s3 = new T.Group(); s3.position.set(0.02, 0.13, -0.26); s3.rotation.z = 0.08; s3.rotation.y = 0.1;
  const s3b = m(box(0.3, 0.36, 0.07), stoneDark); s3b.position.set(0, 0.18, 0);
  const s3line = m(box(0.18, 0.02, 0.02), etchSoft); s3line.position.set(0, 0.22, 0.04);
  s3.add(s3b, s3line); g.add(s3);

  // a fourth tiny marker, very weathered, leaning forward
  const s4 = new T.Group(); s4.position.set(-0.08, 0.13, 0.28); s4.rotation.x = 0.18; s4.rotation.y = -0.2;
  const s4b = m(box(0.18, 0.3, 0.06), stone); s4b.position.set(0, 0.15, 0);
  const s4line = m(box(0.1, 0.02, 0.02), etchSoft); s4line.position.set(0, 0.17, 0.035);
  s4.add(s4b, s4line); g.add(s4);

  // short wrought-iron fence ringing the mound — corner posts + low rails
  const R = 0.6;
  const posts = [];
  const N = 8;
  for (let i = 0; i < N; i++){
    const a = (i / N) * Math.PI * 2 + 0.2;
    const px = Math.cos(a) * R, pz = Math.sin(a) * R;
    const post = m(box(0.04, 0.3, 0.04), iron); post.position.set(px, 0.13, pz);
    const finial = m(cone(0.035, 0.08, 4), iron); finial.position.set(px, 0.3, pz);
    g.add(post, finial);
    posts.push([px, pz]);
  }
  // two horizontal rails connecting consecutive posts
  for (let i = 0; i < N; i++){
    const a = posts[i], b = posts[(i + 1) % N];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const ang = Math.atan2(dx, dz);
    const railTop = m(box(0.025, 0.025, len), iron); railTop.position.set(mx, 0.22, mz); railTop.rotation.y = ang;
    const railBot = m(box(0.025, 0.025, len), iron); railBot.position.set(mx, 0.1, mz); railBot.rotation.y = ang;
    g.add(railTop, railBot);
  }

  // a small wrought-iron grave lantern on a hooked post — warm anchoring light (animated flame is unique mat)
  const lampFlame = new T.MeshBasicMaterial({ color: new T.Color('#ffb858'), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const lantern = new T.Group(); lantern.position.set(0.46, 0.0, 0.34);
  const lpost = m(box(0.035, 0.46, 0.035), iron); lpost.position.set(0, 0.23, 0);
  const lhook = m(box(0.16, 0.03, 0.03), iron); lhook.position.set(-0.07, 0.45, 0);
  const lcage = m(box(0.1, 0.12, 0.1), iron); lcage.position.set(-0.14, 0.38, 0);
  const lglow = m(box(0.06, 0.08, 0.06), lampFlame); lglow.position.set(-0.14, 0.38, 0);
  const lcap = m(cone(0.08, 0.06, 4), iron); lcap.position.set(-0.14, 0.47, 0);
  lantern.add(lpost, lhook, lcage, lglow, lcap); g.add(lantern);

  // faint ghostly glow drifting over the graves (unique materials — animated)
  const ghostCol = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
  const ghostHaze = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false });
  const ghost = new T.Group(); ghost.position.set(0.02, 0.5, 0.02);
  const gcore = m(box(0.1, 0.12, 0.1), ghostCol); gcore.position.set(0, 0, 0);
  const ghaze = m(geo('graveHaze', () => new T.IcosahedronGeometry(0.26, 0)), ghostHaze); ghaze.scale.y = 1.3;
  ghost.add(ghaze, gcore);
  g.add(ghost);
  // a low cold floor glow so the cluster reads as haunted ground
  const floorGlow = m(plane(1.1, 1.1), new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.1, blending: T.AdditiveBlending, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(0, 0.13, 0);
  g.add(floorGlow);

  g.userData.anim = (grp, now) => {
    ghost.position.x = 0.02 + Math.sin(now / 1300) * 0.16;
    ghost.position.z = 0.02 + Math.cos(now / 1700) * 0.12;
    ghost.position.y = 0.5 + Math.sin(now / 900) * 0.06;
    const p = 0.5 + Math.sin(now / 560) * 0.5;
    ghostCol.opacity = 0.22 + p * 0.3;
    ghostHaze.opacity = 0.1 + p * 0.12;
    ghaze.scale.set(1 + p * 0.12, 1.3 + p * 0.12, 1 + p * 0.12);
    // lantern flame flicker
    const f = 0.7 + Math.sin(now / 130) * 0.18 + Math.sin(now / 47) * 0.1;
    lampFlame.opacity = 0.7 + f * 0.25;
  };
  return g;
}

export function buildTown_crates(opts){
  const g = new T.Group();
  const c = (opts && opts.color) || '#ffb858';
  const wood = mat('#3a2a18', 1);
  const woodDark = mat('#241a10', 1);
  const woodLight = mat('#4a3622', 1);
  const iron = mat('#1a1a22', 1);
  const sack = mat('#5a4d36', 1);
  const rope = mat('#6b5a3a', 1);
  // faint warm brand-stamp / trim glow so the dark wood masses read against black
  const brand = matAdd('#c8772e', 0.5);

  // helper: a banded crate (box body + iron edge straps + a plank seam + a glowing brand stamp)
  function crate(w, h, d, woodMat, stamp){
    const cg = new T.Group();
    const body = m(box(w, h, d), woodMat);
    // plank seam lines (slightly proud darker slats on the front/sides)
    const seamH = m(box(w * 1.01, 0.025, d * 1.01), woodDark);
    const seamV = m(box(0.025, h * 1.01, d * 1.01), woodDark);
    // iron corner straps (thin vertical boxes hugging the left/right edges)
    const bandL = m(box(0.03, h * 1.02, d * 1.02), iron); bandL.position.set(-w / 2 + 0.015, 0, 0);
    const bandR = m(box(0.03, h * 1.02, d * 1.02), iron); bandR.position.set(w / 2 - 0.015, 0, 0);
    cg.add(body, seamH, seamV, bandL, bandR);
    // a small glowing branded mark burned into the +Z face (lit so the crate isn't a black blob)
    if (stamp){
      const mark = m(box(w * 0.34, h * 0.34, 0.012), brand);
      mark.position.set(0, 0, d / 2 + 0.006);
      const markBar = m(box(w * 0.34, 0.02, 0.014), brand);
      markBar.position.set(0, 0, d / 2 + 0.007);
      cg.add(mark, markBar);
    }
    return cg;
  }

  // bottom-left big crate (branded front)
  const c1 = crate(0.42, 0.42, 0.42, wood, true); c1.position.set(-0.18, 0.21, 0.05); c1.rotation.y = 0.12;
  // bottom-right crate, slightly turned (branded)
  const c2 = crate(0.38, 0.36, 0.38, woodLight, true); c2.position.set(0.22, 0.18, -0.06); c2.rotation.y = -0.35;
  // smaller crate stacked on top of the big one
  const c3 = crate(0.3, 0.3, 0.3, wood, false); c3.position.set(-0.2, 0.57, 0.02); c3.rotation.y = -0.18;
  g.add(c1, c2, c3);

  // a couple of barrels — tapered cylinders with iron hoops
  function barrel(){
    const bg = new T.Group();
    const belly = m(cyl(0.16, 0.14, 0.5, 8), wood); belly.position.set(0, 0.25, 0);
    const bulge = m(cyl(0.18, 0.18, 0.22, 8), wood); bulge.position.set(0, 0.25, 0);
    const hoopT = m(cyl(0.165, 0.165, 0.04, 8), iron); hoopT.position.set(0, 0.42, 0);
    const hoopM = m(cyl(0.185, 0.185, 0.04, 8), iron); hoopM.position.set(0, 0.25, 0);
    const hoopB = m(cyl(0.155, 0.155, 0.04, 8), iron); hoopB.position.set(0, 0.07, 0);
    const lid = m(cyl(0.13, 0.13, 0.03, 8), woodDark); lid.position.set(0, 0.5, 0);
    bg.add(belly, bulge, hoopT, hoopM, hoopB, lid);
    return bg;
  }
  const b1 = barrel(); b1.position.set(0.28, 0, 0.26); b1.rotation.y = 0.5;
  // a tipped barrel lying on its side at the front
  const b2 = barrel(); b2.position.set(-0.34, 0.16, 0.34); b2.rotation.set(Math.PI / 2, 0, 0.2);
  g.add(b1, b2);

  // a slumped sack leaning against the crates
  const sg = new T.Group(); sg.position.set(0.08, 0.0, 0.32); sg.rotation.set(0.12, 0.3, 0.06);
  const sbody = m(cyl(0.16, 0.13, 0.34, 7), sack); sbody.position.set(0, 0.18, 0);
  const stop = m(cone(0.12, 0.16, 6), sack); stop.position.set(0, 0.36, 0);
  const tie = m(cyl(0.075, 0.085, 0.05, 6), rope); tie.position.set(0, 0.33, 0);
  sg.add(sbody, stop, tie);
  g.add(sg);

  // small glowing lantern resting on top of the stack (unique animated materials — flicker)
  const lampGlass = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.92, blending: T.AdditiveBlending, depthWrite: false });
  const lampHaze = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false });
  const lant = new T.Group(); lant.position.set(-0.2, 0.73, 0.04);
  const cage = m(box(0.13, 0.18, 0.13), iron); cage.position.set(0, 0.09, 0);
  const capTop = m(cone(0.1, 0.08, 4), iron); capTop.position.set(0, 0.22, 0); capTop.rotation.y = Math.PI / 4;
  const ringTop = m(cyl(0.02, 0.02, 0.05, 4), iron); ringTop.position.set(0, 0.27, 0);
  const lbase = m(box(0.12, 0.04, 0.12), iron); lbase.position.set(0, 0, 0);
  const flame = m(box(0.07, 0.1, 0.07), lampGlass); flame.position.set(0, 0.09, 0);
  const halo = m(geo('crateLampHalo', () => new T.IcosahedronGeometry(0.18, 0)), lampHaze); halo.position.set(0, 0.09, 0);
  lant.add(halo, lbase, cage, capTop, ringTop, flame);
  g.add(lant);

  g.userData.anim = (grp, now) => {
    // warm lantern flicker — opacity + slight scale jitter on the flame
    const f = 0.78 + Math.sin(now / 120) * 0.16 + Math.sin(now / 53) * 0.06;
    lampGlass.opacity = Math.max(0.4, f);
    flame.scale.set(0.9 + Math.sin(now / 90) * 0.12, f, 0.9 + Math.sin(now / 90) * 0.12);
    lampHaze.opacity = 0.16 + Math.sin(now / 200) * 0.08;
    halo.scale.setScalar(1 + Math.sin(now / 230) * 0.12);
  };
  return g;
}

// Hireling companion — a humanoid ally; opts.color = theme, opts.weapon = sword|bow|staff.
export function buildHireling(opts) {
  const o = opts || {};
  const c = o.color || '#cdd6e6';
  const wpn = o.weapon || 'sword';
  const g = new T.Group();
  const body = mat(c, 0.85), dark = mat('#1a1a22'), eye = matAdd('#9fd8ff');
  const lL = m(box(0.12, 0.34, 0.13), dark); lL.position.set(-0.09, 0.17, 0);
  const rL = m(box(0.12, 0.34, 0.13), dark); rL.position.set(0.09, 0.17, 0);
  const torso = m(box(0.36, 0.4, 0.26), body); torso.position.set(0, 0.55, 0);
  const lP = m(box(0.15, 0.13, 0.22), body); lP.position.set(-0.24, 0.72, 0);
  const rP = m(box(0.15, 0.13, 0.22), body); rP.position.set(0.24, 0.72, 0);
  const lA = m(box(0.1, 0.32, 0.11), dark); lA.position.set(-0.25, 0.5, 0.02);
  const rA = m(box(0.1, 0.32, 0.11), dark); rA.position.set(0.25, 0.5, 0.04);
  const head = m(box(0.2, 0.2, 0.2), body); head.position.set(0, 0.92, 0);
  const eyeL = m(box(0.05, 0.04, 0.03), eye); eyeL.position.set(-0.05, 0.93, 0.11);
  const eyeR = m(box(0.05, 0.04, 0.03), eye); eyeR.position.set(0.05, 0.93, 0.11);
  g.add(lL, rL, torso, lP, rP, lA, rA, head, eyeL, eyeR);
  if (wpn === 'bow') {
    const limb = m(geo('hireBow', () => new T.TorusGeometry(0.28, 0.025, 4, 8, Math.PI * 1.1)), mat(c, 0.8));
    limb.position.set(0.32, 0.55, 0.12); limb.rotation.z = Math.PI / 2; g.add(limb);
  } else if (wpn === 'staff') {
    const shaft = m(cyl(0.03, 0.04, 0.82, 5), mat('#3a2e22')); shaft.position.set(0.34, 0.5, 0.1);
    const orb = m(geo('hireOrb', () => new T.IcosahedronGeometry(0.1, 0)), matAdd(c, 0.95)); orb.position.set(0.34, 0.93, 0.1);
    g.add(shaft, orb);
    g.userData.anim = (grp, now) => orb.scale.setScalar(1 + Math.sin(now / 220) * 0.14);
  } else {
    const blade = m(box(0.05, 0.5, 0.02), matAdd(c, 0.7)); blade.position.set(0.36, 0.72, 0.1);
    const guard = m(box(0.18, 0.05, 0.05), mat('#8a8f9c')); guard.position.set(0.36, 0.48, 0.1);
    g.add(blade, guard);
  }
  return g;
}

// THE HOLLOW KING — the campaign final boss. A towering crowned void-monarch:
// dark regal robe, hollow crown, a blazing void core, spectral mantle + tendrils,
// a skull-mask face with burning eyes. opts.color = void theme. Engine scales x1.6.
export function buildEnemy_hollowking(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const g = new T.Group();
  const robe = mat(c, 0.34), robeDeep = mat(c, 0.2), bone = mat('#cfc6b0'), boneDark = mat('#6d6552');
  const gold = matAdd('#ffd27a', 0.9), voidGlow = matAdd(c, 0.95), eye = matAdd('#ff3df0', 1);
  // long regal robe (no legs) — wide hem to narrow chest
  const hem = m(cyl(0.22, 0.6, 1.0, 6), robeDeep); hem.position.y = 0.5; hem.rotation.y = Math.PI / 6;
  const torso = m(cyl(0.18, 0.26, 0.5, 6), robe); torso.position.y = 1.25; torso.rotation.y = Math.PI / 6;
  const frontPanel = m(box(0.3, 0.9, 0.06), mat(c, 0.46)); frontPanel.position.set(0, 0.95, 0.3);
  // blazing void core in the chest
  const coreMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('hkCore', () => new T.IcosahedronGeometry(0.16, 0)), coreMat); core.position.set(0, 1.2, 0.3);
  const coreRing = m(geo('hkCoreRing', () => new T.TorusGeometry(0.22, 0.025, 4, 16)), voidGlow); coreRing.position.set(0, 1.2, 0.3);
  // broad spectral shoulder mantle + gold trim
  const mantleL = m(cone(0.3, 0.4, 4), robe); mantleL.position.set(-0.42, 1.5, 0); mantleL.rotation.set(0, Math.PI / 4, 0.8);
  const mantleR = m(cone(0.3, 0.4, 4), robe); mantleR.position.set(0.42, 1.5, 0); mantleR.rotation.set(0, Math.PI / 4, -0.8);
  const collar = m(cyl(0.28, 0.36, 0.16, 6), gold); collar.position.y = 1.55;
  // raised skeletal arms with clawed hands
  const armL = m(box(0.09, 0.6, 0.1), robe); armL.position.set(-0.32, 1.3, 0.1); armL.rotation.set(0.3, 0, 0.7);
  const armR = m(box(0.09, 0.6, 0.1), robe); armR.position.set(0.32, 1.3, 0.1); armR.rotation.set(0.3, 0, -0.7);
  const clawL = m(cone(0.08, 0.2, 4), bone); clawL.position.set(-0.58, 1.62, 0.18); clawL.rotation.z = 0.4;
  const clawR = m(cone(0.08, 0.2, 4), bone); clawR.position.set(0.58, 1.62, 0.18); clawR.rotation.z = -0.4;
  // hooded skull face
  const hood = m(cone(0.28, 0.5, 5), robe); hood.position.y = 1.95;
  const skull = m(box(0.18, 0.22, 0.16), boneDark); skull.position.set(0, 1.8, 0.14);
  const jaw = m(box(0.13, 0.06, 0.13), bone); jaw.position.set(0, 1.69, 0.15);
  const eyeL = m(box(0.05, 0.06, 0.04), eye); eyeL.position.set(-0.06, 1.83, 0.21);
  const eyeR = m(box(0.05, 0.06, 0.04), eye); eyeR.position.set(0.06, 1.83, 0.21);
  // the HOLLOW CROWN — a ring of gold spikes above the hood
  const crownBand = m(cyl(0.22, 0.22, 0.1, 7), gold); crownBand.position.y = 2.22;
  const crownPts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const sp = m(cone(0.05, 0.22 + (i % 2) * 0.12, 4), gold);
    sp.position.set(Math.cos(a) * 0.2, 2.36 + (i % 2) * 0.06, Math.sin(a) * 0.2);
    g.add(sp); crownPts.push(sp);
  }
  // orbiting void tendrils/shards
  const shards = [];
  for (let i = 0; i < 4; i++) {
    const sh = m(geo('hkShard', () => new T.OctahedronGeometry(0.1, 0)), voidGlow);
    sh.userData.a = (i / 4) * Math.PI * 2; sh.userData.r = 0.7 + (i % 2) * 0.15;
    g.add(sh); shards.push(sh);
  }
  g.add(hem, torso, frontPanel, core, coreRing, mantleL, mantleR, collar, armL, armR, clawL, clawR, hood, skull, jaw, eyeL, eyeR, crownBand);
  g.userData.anim = (grp, now) => {
    coreMat.opacity = 0.7 + Math.sin(now / 180) * 0.25;
    core.scale.setScalar(1 + Math.sin(now / 160) * 0.18);
    grp.position.y = Math.sin(now / 520) * 0.05;   // ominous hover (added to engine bob)
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i], ang = s.userData.a + now / 900;
      s.position.set(Math.cos(ang) * s.userData.r, 1.3 + Math.sin(now / 700 + i) * 0.3, Math.sin(ang) * s.userData.r);
      s.rotation.y = now / 200;
    }
  };
  return g;
}

// expose the cache for the engine (warm-up / disposal if needed)
export const _cache = { GEO, MATS };
