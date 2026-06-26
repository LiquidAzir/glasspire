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
  // Strengthened: crisper angular skull (brow + tapered jaw), bolder ribcage with bright sternum, brighter glowing eye sockets w/ pulse + brow shadow, cleaner shoulder line.
  const g = new T.Group();
  const c = (opts && opts.color) || '#cfc8b0';
  const bone = mat(c, 0.6);
  const boneDark = mat(c, 0.34);
  const eye = new T.MeshBasicMaterial({ color: new T.Color('#ff5a3c'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const socket = mat('#171c27');
  const glint = matAdd('#dfffff', 0.8);

  // thin legs + feet
  const legL = m(box(0.085, 0.5, 0.085), boneDark); legL.position.set(-0.11, 0.25, 0);
  const legR = m(box(0.085, 0.5, 0.085), boneDark); legR.position.set(0.11, 0.25, 0);
  const footL = m(box(0.12, 0.05, 0.18), bone); footL.position.set(-0.11, 0.025, 0.04);
  const footR = m(box(0.12, 0.05, 0.18), bone); footR.position.set(0.11, 0.025, 0.04);
  const pelvis = m(box(0.32, 0.11, 0.16), bone); pelvis.position.set(0, 0.55, 0);

  // spine + bolder ribcage (slats taper to a cage) + bright sternum stripe
  const spine = m(box(0.07, 0.42, 0.07), boneDark); spine.position.set(0, 0.8, -0.03);
  const rib1 = m(box(0.38, 0.055, 0.2), bone); rib1.position.set(0, 0.68, 0.03);
  const rib2 = m(box(0.36, 0.055, 0.2), bone); rib2.position.set(0, 0.81, 0.03);
  const rib3 = m(box(0.31, 0.055, 0.19), bone); rib3.position.set(0, 0.94, 0.025);
  const sternum = m(box(0.05, 0.34, 0.02), glint); sternum.position.set(0, 0.81, 0.14);

  // bold shoulder line + thin arms
  const shoulders = m(box(0.44, 0.09, 0.15), bone); shoulders.position.set(0, 1.05, 0);
  const armL = m(box(0.07, 0.42, 0.07), boneDark); armL.position.set(-0.23, 0.84, 0.04);
  const armR = m(box(0.07, 0.42, 0.07), boneDark); armR.position.set(0.23, 0.84, 0.06);

  // chipped blade in right hand
  const hilt = m(box(0.05, 0.1, 0.05), boneDark); hilt.position.set(0.25, 0.6, 0.1);
  const blade = m(box(0.07, 0.5, 0.03), glint); blade.position.set(0.25, 0.88, 0.12); blade.rotation.z = 0.06;
  const tip = m(cone(0.05, 0.14, 4), glint); tip.position.set(0.245, 1.17, 0.12);

  // crisper angular skull: cranium + brow ridge + tapered jaw, recessed sockets + bright eyes
  const skull = m(box(0.25, 0.22, 0.23), bone); skull.position.set(0, 1.24, 0);
  const brow = m(box(0.26, 0.06, 0.06), boneDark); brow.position.set(0, 1.22, 0.12);
  const jaw = m(cyl(0.12, 0.07, 0.1, 4), bone); jaw.position.set(0, 1.1, 0.03); jaw.rotation.y = Math.PI / 4;
  const socketL = m(box(0.08, 0.08, 0.04), socket); socketL.position.set(-0.065, 1.21, 0.115);
  const socketR = m(box(0.08, 0.08, 0.04), socket); socketR.position.set(0.065, 1.21, 0.115);
  const eyeL = m(box(0.055, 0.055, 0.05), eye); eyeL.position.set(-0.065, 1.21, 0.13);
  const eyeR = m(box(0.055, 0.055, 0.05), eye); eyeR.position.set(0.065, 1.21, 0.13);

  g.add(legL, legR, footL, footR, pelvis, spine, rib1, rib2, rib3, sternum,
    shoulders, armL, armR, hilt, blade, tip, skull, brow, jaw, socketL, socketR, eyeL, eyeR);

  g.userData.anim = (grp, now) => {
    const s = Math.sin(now / 360);
    armR.rotation.x = -0.25 + s * 0.14;
    hilt.position.y = 0.6 + s * 0.02;
    blade.position.y = 0.88 + s * 0.02;
    tip.position.y = 1.17 + s * 0.02;
    skull.rotation.z = s * 0.045;
    brow.rotation.z = s * 0.045;
    const pulse = 0.7 + (Math.sin(now / 200) * 0.5 + 0.5) * 0.3;
    eye.opacity = pulse;
  };
  return g;
}

// Strengthened: deeper hunch + bony shoulder yoke + tall jagged spine hump, longer dragging arms with BIG bright claws, brighter sunken eyes + glowing brow + faint rib-core glow, richer shamble anim.
export function buildEnemy_hunched(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#7a8a5e';
  const flesh = mat(c, 0.55);
  const fleshDark = mat(c, 0.32);
  const bone = mat('#cfd6b8', 0.6);
  const claw = matAdd('#eaffcf', 0.85);

  // unique animated materials (eyes + rib core glow pulse)
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color('#bcff3a') });
  const browMat = new T.MeshBasicMaterial({ color: new T.Color('#8fff2a') });
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#9bff5a'), transparent: true, opacity: 0.45 });

  // --- bent, crouched legs + splayed feet (wide stable base) ---
  const legL = m(box(0.15, 0.32, 0.16), fleshDark); legL.position.set(-0.18, 0.17, -0.03); legL.rotation.x = 0.3;
  const legR = m(box(0.15, 0.32, 0.16), fleshDark); legR.position.set(0.18, 0.17, -0.03); legR.rotation.x = 0.3;
  const kneeL = m(box(0.13, 0.16, 0.15), fleshDark); kneeL.position.set(-0.2, 0.1, 0.08); kneeL.rotation.x = -0.4;
  const kneeR = m(box(0.13, 0.16, 0.15), fleshDark); kneeR.position.set(0.2, 0.1, 0.08); kneeR.rotation.x = -0.4;
  const footL = m(box(0.17, 0.06, 0.26), fleshDark); footL.position.set(-0.2, 0.03, 0.12);
  const footR = m(box(0.17, 0.06, 0.26), fleshDark); footR.position.set(0.2, 0.03, 0.12);

  // --- deeply hunched torso tilted forward ---
  const torso = m(box(0.5, 0.42, 0.36), flesh); torso.position.set(0, 0.5, 0.06); torso.rotation.x = 0.5;
  // tall jagged spine hump = signature stooped silhouette
  const hump = m(box(0.4, 0.3, 0.24), fleshDark); hump.position.set(0, 0.66, -0.16); hump.rotation.x = -0.25;
  const spine1 = m(cone(0.09, 0.22, 4), bone); spine1.position.set(0, 0.74, -0.16); spine1.rotation.x = -0.6;
  const spine2 = m(cone(0.07, 0.16, 4), bone); spine2.position.set(0, 0.62, -0.24); spine2.rotation.x = -0.8;
  // bony shoulder yoke crossing the back, strengthens the stoop line
  const yoke = m(box(0.56, 0.1, 0.16), bone); yoke.position.set(0, 0.7, -0.02); yoke.rotation.x = 0.25;

  // faint glowing ribcage core (pop without bloat)
  const core = m(box(0.22, 0.18, 0.05), coreMat); core.position.set(0, 0.5, 0.26); core.rotation.x = 0.5;

  // --- long dragging arms reaching forward + down, BIG bright claws ---
  const shoL = m(box(0.16, 0.18, 0.16), flesh); shoL.position.set(-0.32, 0.66, -0.02);
  const shoR = m(box(0.16, 0.18, 0.16), flesh); shoR.position.set(0.32, 0.66, -0.02);
  const upperL = m(box(0.14, 0.4, 0.14), flesh); upperL.position.set(-0.34, 0.46, 0.12); upperL.rotation.x = 0.85;
  const upperR = m(box(0.14, 0.4, 0.14), flesh); upperR.position.set(0.34, 0.46, 0.12); upperR.rotation.x = 0.85;
  const foreL = m(box(0.12, 0.42, 0.12), fleshDark); foreL.position.set(-0.36, 0.24, 0.34); foreL.rotation.x = 1.35;
  const foreR = m(box(0.12, 0.42, 0.12), fleshDark); foreR.position.set(0.36, 0.24, 0.34); foreR.rotation.x = 1.35;
  const clawL = m(cone(0.09, 0.34, 4), claw); clawL.position.set(-0.36, 0.08, 0.52); clawL.rotation.x = 1.9;
  const clawR = m(cone(0.09, 0.34, 4), claw); clawR.position.set(0.36, 0.08, 0.52); clawR.rotation.x = 1.9;

  // --- sunken jutting head, glowing eyes + brow slit ---
  const neck = m(box(0.14, 0.12, 0.16), fleshDark); neck.position.set(0, 0.62, 0.16);
  const head = m(box(0.28, 0.22, 0.26), fleshDark); head.position.set(0, 0.6, 0.3); head.rotation.x = 0.2;
  const jaw = m(box(0.22, 0.08, 0.18), fleshDark); jaw.position.set(0, 0.5, 0.36); jaw.rotation.x = 0.35;
  const brow = m(box(0.24, 0.04, 0.04), browMat); brow.position.set(0, 0.66, 0.42);
  const eyeL = m(box(0.07, 0.07, 0.05), eyeMat); eyeL.position.set(-0.07, 0.62, 0.44);
  const eyeR = m(box(0.07, 0.07, 0.05), eyeMat); eyeR.position.set(0.07, 0.62, 0.44);

  g.add(
    legL, legR, kneeL, kneeR, footL, footR,
    torso, hump, spine1, spine2, yoke, core,
    shoL, shoR, upperL, upperR, foreL, foreR, clawL, clawR,
    neck, head, jaw, brow, eyeL, eyeR
  );

  g.userData.anim = (grp, now) => {
    const s = Math.sin(now / 280);
    const sway = Math.sin(now / 520);
    // whole-body shambling sway + bob
    grp.rotation.z = sway * 0.05;
    grp.position.y = Math.abs(Math.sin(now / 260)) * 0.02;
    // dragging arm swing (alternating)
    foreL.rotation.x = 1.35 + s * 0.22;
    foreR.rotation.x = 1.35 - s * 0.22;
    clawL.position.z = 0.52 + s * 0.06;
    clawR.position.z = 0.52 - s * 0.06;
    clawL.position.y = 0.08 + s * 0.03;
    clawR.position.y = 0.08 - s * 0.03;
    // head loll
    head.rotation.z = sway * 0.12;
    head.position.y = 0.6 + Math.sin(now / 400) * 0.02;
    // pulsing eye / core glow
    const p = 0.55 + Math.abs(s) * 0.45;
    eyeMat.color.setRGB(0.74 * p, 1.0 * p, 0.23 * p);
    coreMat.opacity = 0.3 + Math.abs(sway) * 0.3;
  };
  return g;
}

export function buildEnemy_ghost(opts) {
  // Strengthened: bolder additive shroud, tall hooded crown, brighter hollow-eye mask, a pulsing additive heart-core, longer trailing wisp tail + drifting wisp arms.
  const g = new T.Group();
  const c = (opts && opts.color) || '#8fb6c8';

  // Bright additive shroud layers (the glowing silhouette) + a darker hood mass for contrast.
  const shroud     = matAdd(c, 0.5);
  const shroudSoft = matAdd(c, 0.3);
  const shroudWisp = matAdd(c, 0.18);
  const hoodMass   = mat(c, 0.34);
  const maskDark   = mat(c, 0.1);
  const eye        = matAdd('#e8ffff', 0.95);
  // UNIQUE animated material for the pulsing core glow (never the shared cache).
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#eafcff'), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });

  const float = new T.Group(); float.position.y = 0.5;

  // BOLD broad shoulders tapering down to a single trailing wisp — a clear wraith silhouette (no legs).
  const shoulders = m(cyl(0.36, 0.3, 0.34, 7), shroud);     shoulders.position.set(0, 0.56, 0);
  const torso     = m(cyl(0.3, 0.18, 0.42, 7), shroudSoft); torso.position.set(0, 0.18, 0);
  const tail      = m(cone(0.18, 0.5, 6), shroudWisp);      tail.position.set(0, -0.34, 0); tail.rotation.x = Math.PI;

  // Bright additive core deep in the chest — pulses, gives the wraith a glowing heart.
  const core = m(cyl(0.06, 0.1, 0.16, 6), coreMat); core.position.set(0, 0.46, 0.06);

  // Three tattered hem prongs sweeping below the shoulders.
  const hem1 = m(cone(0.1, 0.4, 4), shroudSoft);  hem1.position.set(-0.2, -0.02, 0.05); hem1.rotation.x = Math.PI;
  const hem2 = m(cone(0.1, 0.34, 4), shroudWisp); hem2.position.set(0.04, -0.06, -0.06); hem2.rotation.x = Math.PI;
  const hem3 = m(cone(0.1, 0.42, 4), shroudSoft); hem3.position.set(0.22, -0.02, 0.05); hem3.rotation.x = Math.PI;

  // TALL hooded crown — the iconic haunting head shape.
  const hoodTop  = m(cone(0.28, 0.5, 6), hoodMass);       hoodTop.position.set(0, 0.98, 0);
  const hoodBack = m(cyl(0.24, 0.28, 0.22, 6), hoodMass); hoodBack.position.set(0, 0.74, -0.02);
  // Dark mask cavity so the bright eyes read as hollow sockets.
  const mask = m(box(0.26, 0.22, 0.06), maskDark); mask.position.set(0, 0.74, 0.18);
  const eyeL = m(box(0.06, 0.09, 0.04), eye); eyeL.position.set(-0.07, 0.76, 0.22);
  const eyeR = m(box(0.06, 0.09, 0.04), eye); eyeR.position.set(0.07, 0.76, 0.22);

  // Long flowing wisp arms reaching outward with trailing claws.
  const armL  = m(cyl(0.05, 0.11, 0.46, 5), shroudSoft); armL.position.set(-0.36, 0.42, 0.04); armL.rotation.z = 0.5;
  const armR  = m(cyl(0.05, 0.11, 0.46, 5), shroudSoft); armR.position.set(0.36, 0.42, 0.04);  armR.rotation.z = -0.5;
  const clawL = m(cone(0.07, 0.22, 4), shroudWisp); clawL.position.set(-0.52, 0.18, 0.04); clawL.rotation.x = Math.PI;
  const clawR = m(cone(0.07, 0.22, 4), shroudWisp); clawR.position.set(0.52, 0.18, 0.04);  clawR.rotation.x = Math.PI;

  float.add(shoulders, torso, tail, core, hem1, hem2, hem3, hoodTop, hoodBack, mask, eyeL, eyeR, armL, armR, clawL, clawR);
  g.add(float);

  g.userData.anim = (grp, now) => {
    const drift = Math.sin(now / 700);
    float.position.y = 0.5 + drift * 0.08;
    float.rotation.y = Math.sin(now / 1600) * 0.12;
    // Pulsing additive heart.
    const pulse = 0.55 + (Math.sin(now / 320) * 0.5 + 0.5) * 0.45;
    core.material.opacity = pulse;
    core.scale.set(1, pulse * 1.2 + 0.4, 1);
    // Tattered hem sway.
    hem1.rotation.z = Math.sin(now / 500) * 0.16;
    hem2.rotation.z = Math.sin(now / 500 + 1) * 0.16;
    hem3.rotation.z = Math.sin(now / 500 + 2) * 0.16;
    tail.rotation.z = Math.sin(now / 650) * 0.1;
    // Reaching wisp arms.
    armL.rotation.z = 0.5 + Math.sin(now / 600) * 0.12;
    armR.rotation.z = -0.5 - Math.sin(now / 600) * 0.12;
  };
  return g;
}

export function buildEnemy_weaver(opts) {
  // Strengthened: spider-CASTER silhouette — 6 angular legs with BRIGHT glowing knee-joints splayed
  // in a radial frame around a hot pulsing abdomen core, hovering over a counter-rotating glyph ring.
  const c = (opts && opts.color) || '#b388ff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.55 : 1;
  const g = new T.Group();

  const body = mat(c, 0.42);        // dark carapace mass
  const limb = mat(c, 0.3);         // dim leg shafts
  const glow = matAdd(c, 0.95);     // bright energy / eyes
  const joint = matAdd(c, 0.85);    // glowing leg joints (shared static)
  const hot = matAdd('#ffffff', 1); // white-hot pinpoints
  const ringMat = mat(c, 0.5);

  // hovers — abdomen core centered around this height
  const cy = 0.78 * s;

  // ---- ABDOMEN CORE: the bright centerpiece. A faceted dark shell with a hot inner gem. ----
  // unique animated material for the pulsing core
  const coreMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const shell = m(geo('weaverShell', () => new T.OctahedronGeometry(0.3, 0)), body);
  shell.position.set(0, cy, -0.04 * s); shell.scale.set(1.05 * s, 1.25 * s, 1.1 * s);
  const core = m(geo('weaverCore', () => new T.OctahedronGeometry(0.2, 0)), coreMat);
  core.position.set(0, cy, -0.04 * s); core.scale.setScalar(s);
  const spark = m(box(0.06 * s, 0.09 * s, 0.06 * s), hot); spark.position.set(0, cy, -0.04 * s);

  // ---- CEPHALOTHORAX + caster head (front, +Z) ----
  const thorax = m(box(0.26 * s, 0.22 * s, 0.26 * s), body); thorax.position.set(0, cy - 0.02 * s, 0.24 * s);
  const head = m(cone(0.13 * s, 0.22 * s, 4), body); head.position.set(0, cy - 0.02 * s, 0.42 * s); head.rotation.x = Math.PI / 2;
  const eye = m(geo('weaverEye', () => new T.IcosahedronGeometry(0.1, 0)), glow); eye.position.set(0, cy + 0.02 * s, 0.46 * s); eye.scale.setScalar(s);
  const eyeCore = m(box(0.035 * s, 0.05 * s, 0.03 * s), hot); eyeCore.position.set(0, cy + 0.02 * s, 0.52 * s);
  // forward fangs
  const fangL = m(cone(0.03 * s, 0.13 * s, 3), glow); fangL.position.set(-0.07 * s, cy - 0.08 * s, 0.5 * s); fangL.rotation.x = Math.PI / 2;
  const fangR = m(cone(0.03 * s, 0.13 * s, 3), glow); fangR.position.set(0.07 * s, cy - 0.08 * s, 0.5 * s); fangR.rotation.x = Math.PI / 2;

  // ---- 6 SPINDLY LEGS with BRIGHT GLOWING KNEE-JOINTS — bold radial frame ----
  // Each leg: hip group at body height. Upper shaft angles up+out to a glowing knee node,
  // lower shaft drops to the floor (foot at y~0). Joints are the iconic bright accents.
  const legs = [];
  const cfg = [
    [-1, 0.16, 0.55], [1, 0.16, 0.55],   // front pair, splayed wide
    [-1, 0.0, 0.18], [1, 0.0, 0.18],     // mid pair
    [-1, -0.18, -0.2], [1, -0.18, -0.2], // rear pair
  ];
  for (let i = 0; i < cfg.length; i++) {
    const side = cfg[i][0], z = cfg[i][1] * s, spread = cfg[i][2];
    const lg = new T.Group(); lg.position.set(0.14 * side * s, cy - 0.04 * s, z);

    // upper shaft rises outward to the knee
    const upper = m(box(0.045 * s, 0.045 * s, 0.34 * s), limb);
    upper.position.set(0.24 * side, 0.18 * s, spread * 0.1 * s);
    upper.rotation.z = -0.95 * side; upper.rotation.y = spread * 0.9 * side;

    // glowing knee joint at the apex of the leg (the signature bright node)
    const knee = m(geo('weaverKnee', () => new T.OctahedronGeometry(0.07, 0)), joint);
    knee.position.set(0.42 * side, 0.34 * s, spread * 0.18 * s); knee.scale.setScalar(s);

    // lower shaft plunges from knee down to the ground
    const lower = m(box(0.04 * s, 0.62 * s, 0.04 * s), limb);
    lower.position.set(0.46 * side, -0.06 * s, spread * 0.2 * s);
    lower.rotation.z = 0.25 * side;

    // bright foot tip
    const foot = m(cone(0.035 * s, 0.1 * s, 3), glow);
    foot.position.set(0.5 * side, -(cy - 0.04 * s) + 0.05 * s, spread * 0.2 * s);
    foot.rotation.x = Math.PI;

    lg.add(upper, knee, lower, foot);
    lg.userData.ph = i * 1.05;
    lg.userData.knee = knee;
    legs.push(lg); g.add(lg);
  }

  // ---- counter-rotating glyph ring beneath the caster ----
  const ring = m(geo('weaverRing', () => new T.TorusGeometry(0.46, 0.028, 4, 8)), ringMat);
  ring.position.y = cy - 0.34 * s; ring.rotation.x = Math.PI / 2; ring.scale.setScalar(s);
  const ringGlyphs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const gl = m(cone(0.045 * s, 0.16 * s, 3), glow);
    gl.position.set(Math.cos(a) * 0.46 * s, cy - 0.34 * s, Math.sin(a) * 0.46 * s);
    gl.rotation.z = -a; ring.add ? null : null; g.add(gl); ringGlyphs.push(gl);
  }

  g.add(shell, core, spark, thorax, head, eye, eyeCore, fangL, fangR, ring);

  g.userData.anim = (grp, now) => {
    // hover bob
    const y = cy + Math.sin(now / 720) * 0.05 * s;
    const dy = y - cy;
    shell.position.y = y; core.position.y = y; spark.position.y = y;
    thorax.position.y = cy - 0.02 * s + dy; head.position.y = cy - 0.02 * s + dy;
    eye.position.y = cy + 0.02 * s + dy; eyeCore.position.y = cy + 0.02 * s + dy;
    fangL.position.y = cy - 0.08 * s + dy; fangR.position.y = cy - 0.08 * s + dy;

    // pulsing hot core + eye flare
    const p = Math.sin(now / 360);
    core.scale.setScalar(s * (1 + p * 0.18));
    coreMat.opacity = 0.75 + (p * 0.5 + 0.5) * 0.25;
    spark.scale.setScalar(1 + p * 0.4);
    eye.scale.setScalar(s * (1 + p * 0.1));

    // slow ring spin + glyph orbit
    ring.rotation.z = now / 1400;
    ring.position.y = cy - 0.34 * s + dy * 0.5;
    for (let i = 0; i < ringGlyphs.length; i++) {
      const a = (i / 4) * Math.PI * 2 + now / 1400;
      ringGlyphs[i].position.set(Math.cos(a) * 0.46 * s, cy - 0.34 * s + dy * 0.5, Math.sin(a) * 0.46 * s);
      ringGlyphs[i].rotation.y = a;
    }

    // legs weave + glowing knees twitch (carried with body bob)
    for (let i = 0; i < legs.length; i++) {
      const lp = Math.sin(now / 240 + legs[i].userData.ph);
      legs[i].rotation.x = lp * 0.1;
      legs[i].position.y = cy - 0.04 * s + dy + Math.abs(lp) * 0.015 * s;
      legs[i].userData.knee.scale.setScalar(s * (0.9 + Math.abs(lp) * 0.25));
    }
  };
  return g;
}

// Strengthened: open fanged maw + bristling additive spine ridge + glowing eyes/throat/heart core, heavier stance, pulsing-glow prowl anim.
export function buildEnemy_beast(opts) {
  const c = (opts && opts.color) || '#7a2230';
  const g = new T.Group();
  const body = mat(c, 0.5);
  const dark = mat(c, 0.34);
  const darker = mat(c, 0.26);
  const eyeHex = (opts && opts.eye) || '#ff5a2a';
  // Unique animated glow materials (pulse) — must NOT use shared matAdd cache.
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const mawMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const fangMat = matAdd('#fff2e0', 0.85);
  const spineMat = matAdd(eyeHex, 0.7);

  // --- Core mass: low forequarters, raised haunches = predatory crouch.
  const torso = m(box(0.4, 0.34, 0.9), body); torso.position.set(0, 0.5, 0.02);
  const haunch = m(box(0.48, 0.42, 0.36), dark); haunch.position.set(0, 0.54, -0.36);
  const chest = m(box(0.46, 0.4, 0.34), body); chest.position.set(0, 0.48, 0.38);
  // Glowing heart-core set into the chest.
  const core = m(box(0.16, 0.18, 0.06), coreMat); core.position.set(0, 0.46, 0.55);

  // --- Neck angled down + forward into a big, low, lunging head.
  const neck = m(box(0.3, 0.28, 0.3), dark); neck.position.set(0, 0.54, 0.54); neck.rotation.x = -0.42;
  const head = new T.Group(); head.position.set(0, 0.56, 0.72);
  const skull = m(box(0.34, 0.3, 0.32), body); skull.position.set(0, 0.06, 0);
  const browL = m(box(0.12, 0.07, 0.14), dark); browL.position.set(-0.1, 0.15, 0.12);
  const browR = m(box(0.12, 0.07, 0.14), dark); browR.position.set(0.1, 0.15, 0.12);
  // Open fanged maw: upper snout + dropped lower jaw with a glowing gullet between.
  const upper = m(box(0.22, 0.12, 0.3), dark); upper.position.set(0, 0.0, 0.24);
  const lower = m(box(0.2, 0.1, 0.26), darker); lower.position.set(0, -0.14, 0.22);
  const gullet = m(box(0.16, 0.1, 0.12), mawMat); gullet.position.set(0, -0.06, 0.26);
  const fang = (x, up) => { const f = m(cone(0.03, 0.11, 4), fangMat); f.position.set(x, up ? -0.04 : -0.08, 0.34); f.rotation.x = up ? Math.PI : 0; return f; };
  const fangs = [fang(-0.07, true), fang(0.07, true), fang(-0.06, false), fang(0.06, false)];
  // Big forward-blazing eyes.
  const eyeL = m(box(0.07, 0.07, 0.05), eyeMat); eyeL.position.set(-0.1, 0.1, 0.18);
  const eyeR = m(box(0.07, 0.07, 0.05), eyeMat); eyeR.position.set(0.1, 0.1, 0.18);
  // Swept horn-ears.
  const earL = m(cone(0.07, 0.24, 4), dark); earL.position.set(-0.12, 0.26, -0.04); earL.rotation.set(0.4, 0, -0.3);
  const earR = m(cone(0.07, 0.24, 4), dark); earR.position.set(0.12, 0.26, -0.04); earR.rotation.set(0.4, 0, 0.3);
  head.add(skull, browL, browR, upper, lower, gullet, eyeL, eyeR, earL, earR, ...fangs);

  // --- Bristling additive spine ridge: cone spikes shoulders -> hindquarters.
  const spine = new T.Group();
  const spineZ = [0.42, 0.22, 0.0, -0.2, -0.42];
  const spineH = [0.16, 0.22, 0.26, 0.24, 0.18];
  for (let i = 0; i < spineZ.length; i++) {
    const s = m(cone(0.05, spineH[i], 4), spineMat);
    s.position.set(0, 0.72 + spineH[i] * 0.4, spineZ[i]);
    s.rotation.x = -0.15;
    spine.add(s);
  }

  // --- Four heavier legs. Group each so anim swings from the hip.
  function leg(x, z, fwd) {
    const lg = new T.Group(); lg.position.set(x, 0.42, z);
    const upperL = m(box(0.13, 0.36, 0.15), dark); upperL.position.set(0, -0.18, 0);
    const paw = m(box(0.15, 0.09, 0.2), body); paw.position.set(0, -0.38, 0.04);
    const claw = m(box(0.14, 0.04, 0.06), darker); claw.position.set(0, -0.4, 0.16);
    lg.add(upperL, paw, claw); lg.userData.fwd = fwd; return lg;
  }
  const flL = leg(-0.18, 0.44, true);
  const flR = leg(0.18, 0.44, false);
  const blL = leg(-0.2, -0.42, false);
  const blR = leg(0.2, -0.42, true);

  // --- Stiff tail trailing -Z, pivot group for sway.
  const tail = new T.Group(); tail.position.set(0, 0.52, -0.54);
  const t1 = m(box(0.1, 0.1, 0.28), dark); t1.position.set(0, 0.0, -0.14);
  const t2 = m(cone(0.07, 0.26, 4), body); t2.position.set(0, 0.02, -0.36); t2.rotation.x = Math.PI / 2;
  const tTip = m(cone(0.05, 0.14, 4), spineMat); tTip.position.set(0, 0.02, -0.52); tTip.rotation.x = Math.PI / 2;
  tail.add(t1, t2, tTip);

  g.add(torso, haunch, chest, core, neck, head, spine, flL, flR, blL, blR, tail);
  g.userData.legs = [flL, flR, blL, blR];
  g.userData.tail = tail;
  g.userData.head = head;
  g.userData.anim = (grp, now) => {
    const t = now / 220;
    const legs = grp.userData.legs;
    for (let i = 0; i < legs.length; i++) {
      const ph = legs[i].userData.fwd ? 0 : Math.PI;
      legs[i].rotation.x = Math.sin(t + ph) * 0.55;
    }
    grp.userData.tail.rotation.y = Math.sin(now / 400) * 0.5;
    grp.userData.tail.rotation.x = -0.15 + Math.sin(now / 520) * 0.12;
    const h = grp.userData.head;
    h.position.y = 0.56 + Math.sin(now / 500) * 0.025;
    h.rotation.x = Math.sin(now / 760) * 0.08;
    grp.position.y = Math.sin(now / 300) * 0.012;
    const pulse = 0.7 + Math.sin(now / 240) * 0.3;
    eyeMat.opacity = pulse;
    mawMat.opacity = 0.45 + Math.sin(now / 200) * 0.2;
    coreMat.opacity = 0.4 + Math.sin(now / 300) * 0.2;
  };
  return g;
}

export function buildEnemy_spider(opts) {
  // Strengthened: fatter faceted abdomen with a bright additive dorsal stripe + glow underbelt,
  // bolder radially-splayed 3-joint legs (thicker upper struts, clearer plant), and a brighter
  // 5-eye cluster with a glowing maw line. Unique animated mat per build; refined scuttle anim.
  const c = (opts && opts.color) || '#3b2a52';
  const g = new T.Group();
  const body = mat(c, 0.5);
  const dark = mat(c, 0.32);
  const eyeCol = (opts && opts.eye) || '#b06cff';
  const eyeMat = matAdd(eyeCol);
  // Unique additive material for the pulsing dorsal mark / underglow (animated -> must not share cache).
  const glowMat = new T.MeshBasicMaterial({ color: new T.Color(eyeCol), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });

  // --- Body: fat faceted abdomen (rear) + smaller cephalothorax/head (front, +Z) ---
  const abdomen = m(box(0.56, 0.4, 0.62), body); abdomen.position.set(0, 0.38, -0.24);
  const humpTop = m(cone(0.32, 0.34, 5), dark); humpTop.position.set(0, 0.56, -0.28); humpTop.rotation.x = Math.PI;
  // Bright additive dorsal stripe down the abdomen — a strong top-down read.
  const stripe = m(geo('spiderStripe', () => box(0.1, 0.04, 0.5)), glowMat); stripe.position.set(0, 0.6, -0.26);
  // Glow underbelt where legs meet body — anchors the radial splay visually.
  const belt = m(geo('spiderBelt', () => cyl(0.34, 0.34, 0.06, 8)), glowMat); belt.position.set(0, 0.34, -0.18);

  const head = m(box(0.34, 0.26, 0.32), dark); head.position.set(0, 0.33, 0.26);
  // Two fangs jutting forward + a bright maw line beneath the eyes.
  const fangL = m(cone(0.045, 0.16, 4), body); fangL.position.set(-0.08, 0.24, 0.44); fangL.rotation.x = Math.PI / 2;
  const fangR = m(cone(0.045, 0.16, 4), body); fangR.position.set(0.08, 0.24, 0.44); fangR.rotation.x = Math.PI / 2;
  const maw = m(geo('spiderMaw', () => box(0.18, 0.03, 0.02)), eyeMat); maw.position.set(0, 0.28, 0.43);

  // --- Bright 5-eye cluster on the head front (two big lead eyes + cluster) ---
  const eyePos = [[-0.09, 0.4, 0.41, 0.06], [0.09, 0.4, 0.41, 0.06], [0, 0.43, 0.42, 0.045], [-0.05, 0.35, 0.42, 0.035], [0.05, 0.35, 0.42, 0.035]];
  for (let i = 0; i < eyePos.length; i++) {
    const sz = eyePos[i][3];
    const e = m(box(sz, sz, 0.03), eyeMat); e.position.set(eyePos[i][0], eyePos[i][1], eyePos[i][2]); g.add(e);
  }

  // --- Eight bold radially-splayed legs: thick upper strut angles out+up, lower cone plants on the floor ---
  const baseY = 0.36;
  const legs = [];
  function buildLeg(side, z, spread) {
    const lg = new T.Group(); lg.position.set(0.18 * side, baseY, z);
    // Upper strut: thicker so the splay reads at small size.
    const upper = m(box(0.085, 0.075, 0.32), dark);
    upper.position.set(0.17 * side, 0.06, 0);
    upper.rotation.z = -0.55 * side;
    upper.rotation.y = spread * side;
    // Lower leg: downward cone whose tip plants on the ground (group-local y ~= -baseY).
    const lower = m(cone(0.05, 0.44, 4), body);
    lower.position.set(0.34 * side, -baseY + 0.22, spread * 0.18 * side);
    lower.rotation.z = 0.34 * side;
    // Tiny bright foot tip to punctuate the radial points.
    const foot = m(geo('spiderFoot', () => box(0.05, 0.05, 0.05)), eyeMat);
    foot.position.set(0.34 * side + 0.06 * side, -baseY + 0.01, spread * 0.18 * side);
    lg.add(upper, lower, foot); return lg;
  }
  const cfg = [[-1, 0.24, 0.55], [1, 0.24, 0.55], [-1, 0.07, 0.2], [1, 0.07, 0.2], [-1, -0.1, -0.2], [1, -0.1, -0.2], [-1, -0.28, -0.55], [1, -0.28, -0.55]];
  for (let i = 0; i < cfg.length; i++) {
    const lg = buildLeg(cfg[i][0], cfg[i][1], cfg[i][2]);
    lg.userData.ph = i * 0.8; legs.push(lg); g.add(lg);
  }

  g.add(abdomen, humpTop, stripe, belt, head, fangL, fangR, maw);
  g.userData.legs = legs;
  g.userData.glow = glowMat;
  g.userData.anim = (grp, now) => {
    const lg = grp.userData.legs;
    for (let i = 0; i < lg.length; i++) {
      const s = Math.sin(now / 130 + lg[i].userData.ph);
      lg[i].rotation.x = s * 0.18;
      lg[i].position.y = baseY + Math.abs(s) * 0.025;
    }
    if (grp.userData.glow) grp.userData.glow.opacity = 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(now / 320));
  };
  return g;
}

// Strengthened: WIDE custom membrane-wing geo with bright additive vein edges + glow core for a bold, bright silhouette; refined dual-phase flap.
export function buildEnemy_bat(opts) {
  const c = (opts && opts.color) || '#4a3a66';
  const g = new T.Group();
  const body = mat(c, 0.5);
  const memb = mat(c, 0.62);
  const eyeHex = (opts && opts.eye) || '#ff3860';
  // Unique additive materials (animated -> must not share the cache).
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const veinMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(eyeHex), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  // Crouched bat: lowest geometry sits at y=0. The engine adds its own float/bob.
  const BASE = 0.12;
  // Angular body + head.
  const torso = m(box(0.17, 0.24, 0.16), body); torso.position.set(0, BASE + 0.12, 0);
  const head = m(box(0.15, 0.14, 0.14), body); head.position.set(0, BASE + 0.29, 0.05);
  // Tall pointed demon ears.
  const earL = m(cone(0.045, 0.16, 4), body); earL.position.set(-0.06, BASE + 0.42, 0.03);
  const earR = m(cone(0.045, 0.16, 4), body); earR.position.set(0.06, BASE + 0.42, 0.03);
  // Big glowing eyes.
  const eyeL = m(box(0.05, 0.05, 0.03), eyeMat); eyeL.position.set(-0.045, BASE + 0.30, 0.12);
  const eyeR = m(box(0.05, 0.05, 0.03), eyeMat); eyeR.position.set(0.045, BASE + 0.30, 0.12);
  // Glowing chest core -> bright center anchor.
  const core = m(cone(0.06, 0.12, 4), coreMat); core.position.set(0, BASE + 0.12, 0.075); core.rotation.x = Math.PI / 2;
  // Custom WIDE membrane: a flat scalloped triangle fanning out from the shoulder.
  const wingGeo = geo('batWingMembrane', () => {
    const gm = new T.BufferGeometry();
    // Root near shoulder (x~0), tip far out (+x), with a swept lower trailing edge.
    const verts = new Float32Array([
      // upper panel
      0.0,  0.10, 0.0,   0.0, -0.06, 0.0,   0.58,  0.14, 0.0,
      // mid panel
      0.0, -0.06, 0.0,   0.42, -0.18, 0.0,   0.58,  0.14, 0.0,
      // lower scallop tip
      0.0, -0.06, 0.0,   0.30, -0.30, 0.0,   0.42, -0.18, 0.0,
    ]);
    gm.setAttribute('position', new T.BufferAttribute(verts, 3));
    gm.computeVertexNormals();
    return gm;
  });
  function wing(side) {
    const w = new T.Group(); w.position.set(0.075 * side, BASE + 0.17, 0);
    const mem = m(wingGeo, memb); mem.scale.x = side; mem.material = memb;
    mem.side = side;
    // Bright additive vein bones along the wing -> reads as glowing ribs.
    const armBone = m(box(0.6, 0.02, 0.02), veinMat); armBone.position.set(0.29 * side, 0.07, 0.012);
    armBone.rotation.z = 0.13 * side;
    const ribBone = m(box(0.46, 0.018, 0.018), veinMat); ribBone.position.set(0.21 * side, -0.07, 0.012);
    ribBone.rotation.z = -0.32 * side;
    // Wing-tip claw.
    const claw = m(cone(0.03, 0.11, 4), body); claw.position.set(0.59 * side, 0.13, 0); claw.rotation.z = -0.5 * side;
    w.add(mem, armBone, ribBone, claw); return w;
  }
  const wL = wing(-1);
  const wR = wing(1);
  // Small feet tucked under, resting at the ground.
  const feet = m(box(0.12, 0.05, 0.09), body); feet.position.set(0, BASE - 0.095, -0.02);
  g.add(torso, head, earL, earR, eyeL, eyeR, core, wL, wR, feet);
  g.userData.wL = wL; g.userData.wR = wR;
  g.userData.anim = (grp, now) => {
    const f = Math.sin(now / 90);
    const f2 = Math.sin(now / 90 - 0.6); // wingtip lag -> membrane snap
    grp.userData.wL.rotation.z = -f * 0.95;
    grp.userData.wR.rotation.z = f * 0.95;
    grp.userData.wL.rotation.y = -f2 * 0.18;
    grp.userData.wR.rotation.y = f2 * 0.18;
    const glow = 0.5 + 0.45 * Math.abs(f);
    eyeMat.opacity = 0.6 + 0.35 * glow;
    veinMat.opacity = 0.3 + 0.35 * Math.abs(f);
  };
  return g;
}

// Strengthened: taller swept horns, jagged bat-wing membranes, a big bright pulsing chest core + bigger glowing eyes, hovering bob + flap anim.
export function buildEnemy_imp(opts) {
  const c = (opts && opts.color) || '#a8324a';
  const g = new T.Group();
  const skin = mat(c, 0.5);
  const skinDark = mat(c, 0.3);
  const horn = mat('#caa86e');
  const eye = matAdd('#ffd24a', 1);
  const fang = matAdd('#fff0d8', 0.9);

  // unique animated core material (pulses) — must not be the shared cache
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#ff5a2a'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });

  // squat legs
  const lL = m(box(0.13, 0.18, 0.14), skinDark); lL.position.set(-0.11, 0.09, 0.02);
  const rL = m(box(0.13, 0.18, 0.14), skinDark); rL.position.set(0.11, 0.09, 0.02);

  // pot-bellied body (angular)
  const body = m(box(0.36, 0.3, 0.3), skin); body.position.set(0, 0.4, 0);
  const belly = m(cone(0.21, 0.24, 5), skin); belly.position.set(0, 0.36, 0.11); belly.rotation.x = Math.PI / 2;

  // BIG bright chest core — the signature glow (faceted gem)
  const core = m(geo('impCore', () => new T.OctahedronGeometry(0.12)), coreMat);
  core.position.set(0, 0.43, 0.18);
  const coreHalo = m(box(0.16, 0.16, 0.03), matAdd('#ff8a3a', 0.5)); coreHalo.position.set(0, 0.43, 0.16);

  // hunched little head
  const head = m(box(0.27, 0.23, 0.25), skin); head.position.set(0, 0.65, 0.03);
  const brow = m(box(0.28, 0.05, 0.06), skinDark); brow.position.set(0, 0.72, 0.13);

  // two big glowing eyes + halo glow
  const eyeL = m(box(0.08, 0.07, 0.03), eye); eyeL.position.set(-0.07, 0.65, 0.17);
  const eyeR = m(box(0.08, 0.07, 0.03), eye); eyeR.position.set(0.07, 0.65, 0.17);

  // fanged grin
  const f1 = m(box(0.035, 0.06, 0.02), fang); f1.position.set(-0.05, 0.56, 0.16);
  const f2 = m(box(0.035, 0.06, 0.02), fang); f2.position.set(0.05, 0.56, 0.16);

  // TALL swept horns — two-segment for a bold curved silhouette
  const hLg = geo('impHorn', () => cone(0.055, 0.26, 4));
  const hL = m(hLg, horn); hL.position.set(-0.11, 0.86, -0.01); hL.rotation.set(-0.25, 0, 0.55);
  const hR = m(hLg, horn); hR.position.set(0.11, 0.86, -0.01); hR.rotation.set(-0.25, 0, -0.55);
  const hLt = m(cone(0.03, 0.13, 4), horn); hLt.position.set(-0.2, 1.0, -0.05); hLt.rotation.set(-0.5, 0, 0.95);
  const hRt = m(cone(0.03, 0.13, 4), horn); hRt.position.set(0.2, 1.0, -0.05); hRt.rotation.set(-0.5, 0, -0.95);

  // bat wings — pivot groups so they flap from the shoulders
  const wingGeo = geo('impWing', () => cone(0.2, 0.42, 3));
  const wLp = new T.Group(); wLp.position.set(-0.18, 0.5, -0.06);
  const wRp = new T.Group(); wRp.position.set(0.18, 0.5, -0.06);
  const wL = m(wingGeo, skinDark); wL.position.set(-0.18, 0, 0); wL.rotation.set(Math.PI / 2, 0, 0.7); wL.scale.set(1, 0.26, 1);
  const wR = m(wingGeo, skinDark); wR.position.set(0.18, 0, 0); wR.rotation.set(Math.PI / 2, 0, -0.7); wR.scale.set(1, 0.26, 1);
  // bright leading-edge struts to make the wings read
  const wLe = m(box(0.34, 0.02, 0.02), matAdd(c, 0.4)); wLe.position.set(-0.18, 0.02, 0.02); wLe.rotation.z = 0.35;
  const wRe = m(box(0.34, 0.02, 0.02), matAdd(c, 0.4)); wRe.position.set(0.18, 0.02, 0.02); wRe.rotation.z = -0.35;
  wLp.add(wL, wLe); wRp.add(wR, wRe);

  // little arms
  const aL = m(box(0.08, 0.21, 0.09), skinDark); aL.position.set(-0.22, 0.42, 0.05);
  const aR = m(box(0.08, 0.21, 0.09), skinDark); aR.position.set(0.22, 0.42, 0.05);

  // pointed tail
  const tail = m(cone(0.05, 0.3, 4), skinDark); tail.position.set(0, 0.3, -0.22); tail.rotation.x = -1.0;
  const tailTip = m(cone(0.06, 0.1, 3), matAdd(c, 0.55)); tailTip.position.set(0, 0.18, -0.34); tailTip.rotation.x = -2.0;

  g.add(lL, rL, body, belly, core, coreHalo, head, brow, eyeL, eyeR, f1, f2, hL, hR, hLt, hRt, wLp, wRp, aL, aR, tail, tailTip);

  g.userData.anim = (grp, now) => {
    const flap = Math.sin(now / 130) * 0.6;
    wLp.rotation.z = flap; wRp.rotation.z = -flap;
    wLp.rotation.y = 0.2 + flap * 0.3; wRp.rotation.y = -0.2 - flap * 0.3;
    // hover bob
    grp.position.y = Math.sin(now / 320) * 0.025;
    // pulsing chest core + eyes
    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now / 200));
    coreMat.opacity = pulse;
    const s = 0.9 + 0.18 * Math.sin(now / 200);
    core.scale.setScalar(s);
  };
  return g;
}

// Strengthened: massive layered shoulder pauldrons + huge fists, shrunk head, and a BRIGHT pulsing weak-point core (animated) anchoring the chest silhouette.
export function buildEnemy_giant(opts) {
  const c = (opts && opts.color) || '#5f7d96';
  const g = new T.Group();
  const hide = mat(c, 0.5);
  const hideDark = mat(c, 0.32);
  const plate = mat(c, 0.62);
  const plateLit = mat(c, 0.78);
  const eye = matAdd('#bff0ff', 1);
  const coreGlow = matAdd('#ffe27a', 0.5);

  // thick legs
  const lL = m(box(0.28, 0.54, 0.3), hideDark); lL.position.set(-0.21, 0.27, 0);
  const rL = m(box(0.28, 0.54, 0.3), hideDark); rL.position.set(0.21, 0.27, 0);
  // heavy boots
  const bL = m(box(0.34, 0.16, 0.38), hide); bL.position.set(-0.21, 0.08, 0.03);
  const bR = m(box(0.34, 0.16, 0.38), hide); bR.position.set(0.21, 0.08, 0.03);

  // massive torso (broad, tapering toward small neck)
  const torso = m(box(0.66, 0.58, 0.46), hide); torso.position.set(0, 0.86, 0);
  const upperTorso = m(box(0.78, 0.22, 0.5), plate); upperTorso.position.set(0, 1.12, 0);
  const chestPlate = m(box(0.56, 0.4, 0.12), plate); chestPlate.position.set(0, 0.92, 0.24);

  // GLOWING WEAK-POINT CORE on the chest (bold, bright, animated)
  const coreRing = m(box(0.26, 0.26, 0.06), plateLit); coreRing.position.set(0, 0.92, 0.3);
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#ffd24a'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('giantCore', () => box(0.16, 0.16, 0.1)), coreMat); core.position.set(0, 0.92, 0.33);
  const coreHalo = m(geo('giantCoreHalo', () => plane(0.46, 0.46)), coreGlow); coreHalo.position.set(0, 0.92, 0.31);

  // MASSIVE layered shoulder pauldrons (broadest part of the silhouette)
  const shL = m(cone(0.3, 0.42, 4), plate); shL.position.set(-0.52, 1.16, 0); shL.rotation.z = 0.55;
  const shR = m(cone(0.3, 0.42, 4), plate); shR.position.set(0.52, 1.16, 0); shR.rotation.z = -0.55;
  const capL = m(box(0.34, 0.18, 0.42), plateLit); capL.position.set(-0.5, 1.24, 0); capL.rotation.z = 0.3;
  const capR = m(box(0.34, 0.18, 0.42), plateLit); capR.position.set(0.5, 1.24, 0); capR.rotation.z = -0.3;

  // thick arms
  const aL = m(box(0.24, 0.52, 0.26), hideDark); aL.position.set(-0.54, 0.8, 0.02);
  const aR = m(box(0.24, 0.52, 0.26), hideDark); aR.position.set(0.54, 0.8, 0.02);
  // HUGE fists
  const fL = m(box(0.36, 0.34, 0.36), hide); fL.position.set(-0.54, 0.44, 0.07);
  const fR = m(box(0.36, 0.34, 0.36), hide); fR.position.set(0.54, 0.44, 0.07);

  // tiny sunken head
  const head = m(box(0.22, 0.2, 0.22), hide); head.position.set(0, 1.32, 0.02);
  const eyeL = m(box(0.05, 0.04, 0.03), eye); eyeL.position.set(-0.05, 1.33, 0.13);
  const eyeR = m(box(0.05, 0.04, 0.03), eye); eyeR.position.set(0.05, 1.33, 0.13);

  g.add(lL, rL, bL, bR, torso, upperTorso, chestPlate, coreRing, core, coreHalo,
    shL, shR, capL, capR, aL, aR, fL, fR, head, eyeL, eyeR);

  g.userData.anim = (grp, now) => {
    const s = Math.sin(now / 520) * 0.08;
    aL.rotation.x = s; aR.rotation.x = -s;
    fL.position.y = 0.44 + Math.sin(now / 520) * 0.02;
    fR.position.y = 0.44 - Math.sin(now / 520) * 0.02;
    // pulsing weak-point core
    const p = 0.6 + Math.sin(now / 240) * 0.4;
    coreMat.opacity = p;
    const sc = 1 + Math.sin(now / 240) * 0.12;
    core.scale.set(sc, sc, 1);
    coreHalo.scale.set(sc, sc, 1);
  };
  return g;
}

export function buildEnemy_plant(opts) {
  // Strengthened: bigger flared petal-crown + huge bright glowing maw core & throat ring,
  // bolder fang ring and brighter eyes, thicker rooted stalk + splayed root claws; richer anim (bloom pulse, throb, sway).
  const c = (opts && opts.color) || '#5fae4a';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.5 : 1;
  const g = new T.Group();
  const body = mat(c, 0.45);
  const dark = mat(c, 0.26);
  const thorn = mat(c, 0.62);
  // unique animated glow materials (NOT cached — they breathe)
  const mawMat = new T.MeshBasicMaterial({ color: new T.Color('#ff5a2a'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#ffec5a'), transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color('#ffd14a'), transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const ring = matAdd('#ff7a2a', 0.85);

  // rooted base — splayed root claws gripping the ground, fused stalk
  const root = m(cone(0.46 * s, 0.32 * s, 5), dark); root.position.y = 0.16 * s; root.rotation.y = 0.4;
  const roots = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const rc = m(cone(0.07 * s, 0.34 * s, 3), dark);
    rc.position.set(Math.cos(a) * 0.4 * s, 0.06 * s, Math.sin(a) * 0.4 * s);
    rc.rotation.set(Math.PI / 1.7, a, 0);
    roots.push(rc);
  }
  const stalk = m(cyl(0.22 * s, 0.32 * s, 0.5 * s, 6), body); stalk.position.y = 0.5 * s;
  const bulb = m(cyl(0.4 * s, 0.3 * s, 0.34 * s, 6), body); bulb.position.y = 0.82 * s;

  // PETAL CROWN — bold flared petals ringing the maw (the signature silhouette)
  const petals = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = m(cone(0.16 * s, 0.46 * s, 3), thorn);
    p.position.set(Math.cos(a) * 0.34 * s, 1.0 * s, Math.sin(a) * 0.34 * s);
    p.rotation.set(-Math.PI / 2.2, -a, 0);
    p.scale.set(1, 1, 0.4);
    petals.push(p);
  }

  // glowing maw — big bright throat cup + blazing inner core
  const throat = m(cone(0.3 * s, 0.42 * s, 6), mawMat); throat.position.y = 1.04 * s; throat.rotation.x = Math.PI;
  const rim = m(cyl(0.3 * s, 0.34 * s, 0.06 * s, 8), ring); rim.position.y = 1.16 * s;
  const core = m(cone(0.16 * s, 0.26 * s, 5), coreMat); core.position.y = 1.0 * s; core.rotation.x = Math.PI;

  // fang ring around the maw — bolder, taller teeth
  const fangs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const f = m(cone(0.06 * s, 0.22 * s, 3), thorn);
    f.position.set(Math.cos(a) * 0.3 * s, 1.14 * s, Math.sin(a) * 0.3 * s);
    f.rotation.set(0.5, 0, Math.cos(a) * 0.35);
    fangs.push(f);
  }

  // glowing eye spots flanking the maw
  const eL = m(box(0.07 * s, 0.08 * s, 0.04 * s), eyeMat); eL.position.set(-0.22 * s, 1.06 * s, 0.3 * s);
  const eR = m(box(0.07 * s, 0.08 * s, 0.04 * s), eyeMat); eR.position.set(0.22 * s, 1.06 * s, 0.3 * s);

  // thorny vines splaying low from the stalk + barbed thorns
  const leaves = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.7;
    const leaf = m(cone(0.1 * s, 0.56 * s, 3), mat(c, 0.5));
    leaf.position.set(Math.cos(a) * 0.42 * s, 0.42 * s, Math.sin(a) * 0.42 * s);
    leaf.rotation.set(Math.PI / 2.4, a, 0.5);
    leaf.scale.set(1, 1, 0.35);
    leaves.push(leaf);
  }
  const t1 = m(cone(0.05 * s, 0.2 * s, 3), thorn); t1.position.set(-0.32 * s, 0.6 * s, 0.18 * s); t1.rotation.set(0.4, 0, 1.1);
  const t2 = m(cone(0.05 * s, 0.2 * s, 3), thorn); t2.position.set(0.34 * s, 0.56 * s, -0.1 * s); t2.rotation.set(-0.3, 0, -1.2);

  g.add(root, stalk, bulb, throat, rim, core, eL, eR, t1, t2);
  for (const r of roots) g.add(r);
  for (const p of petals) g.add(p);
  for (const f of fangs) g.add(f);
  for (const l of leaves) g.add(l);

  // rooted: it does not walk. Idle = maw bloom/throb + petal flare + vine sway.
  const pr0 = petals.map(p => p.rotation.x);
  g.userData.anim = (grp, now) => {
    const o = (Math.sin(now / 520) + 1) * 0.5; // 0..1 bloom cycle
    // petals flare open & shut
    for (let i = 0; i < petals.length; i++) petals[i].rotation.x = pr0[i] + o * 0.34;
    // throat & core pulse + brighten
    throat.scale.set(0.85 + o * 0.5, 1 + o * 0.3, 0.85 + o * 0.5);
    core.scale.setScalar(0.7 + o * 0.9);
    mawMat.opacity = 0.7 + o * 0.3;
    coreMat.opacity = 0.6 + o * 0.4;
    const pulse = (Math.sin(now / 240) + 1) * 0.5;
    eyeMat.opacity = 0.55 + pulse * 0.45;
    rim.rotation.y = now / 1400;
    // vine sway + whole-body lean
    for (let i = 0; i < leaves.length; i++) leaves[i].rotation.z = 0.5 + Math.sin(now / 640 + i) * 0.13;
    grp.rotation.z = Math.sin(now / 700) * 0.02;
  };
  return g;
}

export function buildEnemy_orb(opts) {
  // Strengthened: bold bright eye-orb (pulsing core + flat iris ring + dark pupil) with a few BIGGER orbiting shards; clearer iconic eye silhouette, kept float/anim.
  const c = (opts && opts.color) || '#7fd0ff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.5 : 1;
  const g = new T.Group();
  const hover = 0.62 * s;

  // unique animated materials (so pulsing doesn't bleed across instances)
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const hotMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const hazeMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false });

  // BOLD bright core — faceted sphere of light
  const core = m(geo('orbCore', () => new T.IcosahedronGeometry(0.2, 0)), coreMat);
  core.position.y = hover;

  // hot white center reads as the "lens" highlight
  const hot = m(geo('orbHot', () => new T.IcosahedronGeometry(0.085, 0)), hotMat);
  hot.position.set(0, hover, 0.06);

  // signature: a flat front-facing IRIS RING (bright) + dark PUPIL — the eye read
  const iris = m(geo('orbIris', () => new T.RingGeometry(0.11, 0.2, 16)), matAdd(c, 0.85));
  iris.position.set(0, hover, 0.205);
  const pupil = m(geo('orbPupil', () => new T.CircleGeometry(0.11, 14)), mat('#171c27'));
  pupil.position.set(0, hover, 0.2);

  // soft outer haze halo (vertical bias = looming eye)
  const haze = m(geo('orbHaze', () => new T.IcosahedronGeometry(0.34, 0)), hazeMat);
  haze.position.y = hover;
  haze.scale.set(1, 1.15, 1);

  g.add(haze, core, hot, pupil, iris);

  // fewer but BIGGER orbiting shards — bold tumbling chips of light
  const motes = [];
  const N = boss ? 4 : 3;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const mo = m(geo('orbShard', () => new T.OctahedronGeometry(0.085, 0)), matAdd(c, 0.6));
    mo.userData.a = a;
    mo.userData.r = (0.34 + (i % 2) * 0.07) * s;
    mo.userData.yoff = ((i % 3) - 1) * 0.12 * s;
    mo.position.set(Math.cos(a) * mo.userData.r, hover + mo.userData.yoff, Math.sin(a) * mo.userData.r);
    motes.push(mo);
    g.add(mo);
  }

  g.userData.anim = (grp, now) => {
    const bob = Math.sin(now / 600) * 0.08 * s;
    const y = hover + bob;
    core.position.y = y;
    hot.position.y = y;
    iris.position.y = y;
    pupil.position.y = y;
    haze.position.y = y;
    // slow ominous tumble of the core
    core.rotation.y = now / 950;
    core.rotation.x = now / 1400;
    // pulsing brightness of the core + center highlight
    const pulse = 0.78 + Math.sin(now / 300) * 0.22;
    coreMat.opacity = 0.7 + pulse * 0.28;
    hotMat.opacity = 0.6 + Math.sin(now / 200) * 0.4;
    hot.scale.setScalar(0.85 + Math.sin(now / 240) * 0.3);
    // iris stares toward the player, with a subtle scan drift
    const drift = Math.sin(now / 1100) * 0.5;
    iris.rotation.z = drift;
    pupil.position.x = Math.sin(now / 1300) * 0.03;
    haze.scale.set(1 + Math.sin(now / 700) * 0.14, 1.15 + Math.sin(now / 700) * 0.14, 1 + Math.sin(now / 700) * 0.14);
    hazeMat.opacity = 0.12 + (pulse - 0.78) * 0.18 + 0.06;
    const spin = now / 750;
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const a = mo.userData.a + spin;
      const r = mo.userData.r;
      mo.position.set(Math.cos(a) * r, y + mo.userData.yoff + Math.sin(now / 500 + a) * 0.06, Math.sin(a) * r);
      mo.rotation.y = a * 2;
      mo.rotation.x = now / 600 + a;
    }
  };
  return g;
}

// Strengthened: brighter pulsing core + bold radial shard burst (jagged silhouette), taller crown spire, brighter facet edges; preserved signature, eye, floating-shard hands & anim hook.
export function buildEnemy_crystal(opts) {
  const c = (opts && opts.color) || '#9a8cff';
  const boss = !!(opts && opts.boss);
  const s = boss ? 1.55 : 1;
  const g = new T.Group();
  const facet = mat(c, 0.5);
  const facetDk = mat(c, 0.34);
  const edge = matAdd(c, 0.7);
  const eye = matAdd(c, 1);
  // unique animated core material (pulses) — must not be the shared cache
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });

  // crystalline legs — two stout faceted prisms
  const lL = m(cone(0.14 * s, 0.42 * s, 4), facetDk); lL.position.set(-0.17 * s, 0.21 * s, 0); lL.rotation.y = 0.6;
  const rL = m(cone(0.14 * s, 0.42 * s, 4), facetDk); rL.position.set(0.17 * s, 0.21 * s, 0); rL.rotation.y = 0.6;

  // torso — a big upward octahedron prism with hollow-lit core
  const torso = m(geo('crysTorso', () => new T.OctahedronGeometry(0.35, 0)), facet);
  torso.position.y = 0.74 * s; torso.scale.set(1 * s, 1.55 * s, 1 * s); torso.rotation.y = Math.PI / 4;
  // bright vertical seam prism overlaid on torso for a glowing spine
  const seam = m(cone(0.06 * s, 0.62 * s, 3), edge); seam.position.y = 0.76 * s; seam.scale.y = 1.05;

  // glowing central core (animated pulse)
  const ccore = m(geo('crysCore', () => new T.IcosahedronGeometry(0.14, 0)), coreMat);
  ccore.position.y = 0.92 * s;

  // tall sharp crown spire with glowing eye
  const head = m(cone(0.17 * s, 0.5 * s, 4), facet); head.position.y = 1.3 * s; head.rotation.y = Math.PI / 4;
  const eEye = m(box(0.08 * s, 0.08 * s, 0.05 * s), eye); eEye.position.set(0, 1.2 * s, 0.17 * s);

  // RADIAL SHARD BURST — bright angular shards fanning out for a jagged silhouette
  const shards = [];
  const N = 8;
  const cy = 0.86 * s;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const up = (i % 2 === 0) ? 1 : -1;        // alternate tilt for jaggedness
    const len = (i % 2 === 0 ? 0.46 : 0.34) * s;
    const rad = (i % 2 === 0 ? 0.4 : 0.32) * s;
    const sh = m(cone(0.07 * s, len, 4), facet);
    sh.position.set(Math.cos(a) * rad, cy + up * 0.18 * s, Math.sin(a) * rad);
    // point the cone outward/up-down from the core
    sh.rotation.z = -Math.cos(a) * (up > 0 ? 1.0 : 0.5) - (up > 0 ? 0 : Math.PI);
    sh.rotation.x = Math.sin(a) * (up > 0 ? 1.0 : 0.5);
    sh.rotation.y = a;
    const sc = m(geo('crysShardTip', () => new T.OctahedronGeometry(0.05, 0)), edge);
    sc.position.copy(sh.position);
    shards.push(sh, sc);
  }

  // back/shoulder spikes — taller for bolder profile
  const sp1 = m(cone(0.09 * s, 0.42 * s, 4), facet); sp1.position.set(-0.3 * s, 1.04 * s, -0.12 * s); sp1.rotation.set(0.2, 0, 0.6);
  const sp2 = m(cone(0.09 * s, 0.42 * s, 4), facet); sp2.position.set(0.3 * s, 1.04 * s, -0.12 * s); sp2.rotation.set(0.2, 0, -0.6);

  // floating shard 'hands' — detached crystals hovering at the sides
  const handL = m(geo('crysHand', () => new T.OctahedronGeometry(0.12, 0)), facet);
  handL.position.set(-0.46 * s, 0.72 * s, 0.13 * s);
  const handR = m(geo('crysHand', () => new T.OctahedronGeometry(0.12, 0)), facet);
  handR.position.set(0.46 * s, 0.72 * s, 0.13 * s);
  const handLc = m(geo('crysHandC', () => new T.OctahedronGeometry(0.055, 0)), edge); handLc.position.copy(handL.position);
  const handRc = m(geo('crysHandC', () => new T.OctahedronGeometry(0.055, 0)), edge); handRc.position.copy(handR.position);

  g.add(lL, rL, torso, seam, ccore, head, eEye, sp1, sp2, handL, handR, handLc, handRc);
  for (const sh of shards) g.add(sh);

  const hy = handL.position.y;
  g.userData.anim = (grp, now) => {
    const pulse = 0.85 + Math.sin(now / 300) * 0.35;
    ccore.scale.setScalar(pulse);
    coreMat.opacity = 0.7 + Math.abs(Math.sin(now / 300)) * 0.3;
    torso.rotation.y = Math.PI / 4 + Math.sin(now / 1400) * 0.08;
    // slow shard-burst rotation for a shimmering halo
    const f = Math.sin(now / 600);
    handL.position.y = hy + f * 0.09 * s; handLc.position.y = handL.position.y;
    handR.position.y = hy - f * 0.09 * s; handRc.position.y = handR.position.y;
    handL.rotation.y = now / 800; handR.rotation.y = -now / 800;
    handLc.rotation.y = -now / 600; handRc.rotation.y = now / 600;
  };
  return g;
}

// Strengthened: bolder dark mass + bright void-rift crack-blades + reaching tendrils + 3 glowing eyes; richer eldritch motion.
export function buildEnemy_void(opts) {
  const c = (opts && opts.color) || '#5a2d8a';
  const g = new T.Group();
  const bodyDark = mat(c, 0.45);
  const bodyMid = mat(c, 0.7);
  // Unique animated materials (must NOT use shared cache — they pulse).
  const riftMat = new T.MeshBasicMaterial({ color: new T.Color('#c8a6ff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#e6d4ff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 1.0, blending: T.AdditiveBlending, depthWrite: false });

  // --- Dark shifting mass: a few BIG faceted prisms for a strong clustered silhouette. ---
  const m1 = m(box(0.5,0.46,0.46), bodyDark); m1.position.set(0,0.5,0); m1.rotation.set(0.3,0.4,0.2);
  const m2 = m(box(0.4,0.4,0.34), bodyMid); m2.position.set(-0.19,0.72,0.05); m2.rotation.set(0.5,0.2,0.6);
  const m3 = m(box(0.36,0.36,0.36), bodyDark); m3.position.set(0.21,0.66,-0.07); m3.rotation.set(0.2,0.7,0.4);
  const m4 = m(box(0.3,0.28,0.3), bodyMid); m4.position.set(0.02,0.96,0.02); m4.rotation.set(0.6,0.3,0.3);

  // --- Bright void-rifts: thin tall glowing crack-blades slicing through the mass (the signature pop). ---
  const rifts = [];
  const riftGeo = geo('void_riftBlade', () => box(0.05, 0.5, 0.16));
  const riftDefs = [
    [ 0.0,  0.66,  0.16,  0.0,  0.0,  0.15],
    [-0.16, 0.6,  -0.02,  0.4,  0.5, -0.4],
    [ 0.18, 0.74, -0.04, -0.3, -0.6,  0.5],
    [ 0.05, 0.92,  0.06,  0.2,  0.3, -0.2]
  ];
  for (let i=0;i<riftDefs.length;i++){
    const d = riftDefs[i];
    const r = m(riftGeo, riftMat);
    r.position.set(d[0],d[1],d[2]);
    r.rotation.set(d[3],d[4],d[5]);
    rifts.push(r); g.add(r);
  }

  // --- Glowing core peeking through + a hot triangular maw-light. ---
  const coreMesh = m(cone(0.14,0.26,5), coreMat); coreMesh.position.set(0,0.7,0.16); coreMesh.rotation.x = Math.PI;

  // --- Three glowing eyes (eldritch cluster) — bold bright signal. ---
  const eyes = [];
  const eyeDefs = [ [0,0.78,0.26,0.06], [-0.13,0.68,0.22,0.045], [0.12,0.66,0.22,0.045] ];
  for (let i=0;i<eyeDefs.length;i++){
    const d = eyeDefs[i];
    const e = m(box(d[3],d[3],0.03), eyeMat);
    e.position.set(d[0],d[1],d[2]);
    eyes.push(e); g.add(e);
  }

  // --- Reaching tendrils: tapered cones clawing out + two anchoring the silhouette to the ground. ---
  const sp = [];
  const spDefs = [
    [ 0.0, 1.16,  0.0, -0.1,  0.0, 0.36],
    [-0.3, 0.78,  0.12,  0.8, -0.6, 0.34],
    [ 0.32,0.72, -0.06,-0.9,  0.4, 0.34],
    [-0.34,0.46, -0.04,  1.4, -0.9, 0.3],
    [ 0.12, 0.34,  0.2, Math.PI - 0.3, 0.0, 0.34],
    [-0.14, 0.34, -0.18, Math.PI + 0.3, 0.0, 0.34]
  ];
  for (let i=0;i<spDefs.length;i++){
    const d=spDefs[i];
    const s=m(cone(0.07, d[5], 4), bodyMid);
    s.position.set(d[0],d[1],d[2]);
    s.rotation.set(d[3],0,d[4]);
    sp.push(s); g.add(s);
  }

  g.add(m1,m2,m3,m4,coreMesh);
  g.userData.spikes = sp;
  g.userData.rifts = rifts;
  g.userData.core = coreMesh;
  g.userData.eyes = eyes;
  g.userData.eye = eyes[0];
  g.userData.anim = (g, now) => {
    const arr = g.userData.spikes;
    for (let i=0;i<arr.length;i++){
      const s = 1 + 0.4 * Math.sin(now/170 + i*1.7);
      arr[i].scale.set(1, s, 1);
    }
    const rf = g.userData.rifts;
    for (let i=0;i<rf.length;i++){
      const s = 1 + 0.5 * Math.sin(now/130 + i*2.1);
      rf[i].scale.set(1, s, 1);
      rf[i].material.opacity = 0.7 + 0.3 * Math.abs(Math.sin(now/150 + i*1.3));
    }
    const p = 1 + 0.16 * Math.sin(now/140);
    g.userData.core.scale.setScalar(p);
    g.userData.core.material.opacity = 0.75 + 0.25 * Math.abs(Math.sin(now/160));
    const ey = g.userData.eyes;
    for (let i=0;i<ey.length;i++){
      ey[i].scale.setScalar(1 + 0.22 * Math.sin(now/120 + i*2.0));
    }
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

// Strengthened: broader fullered blade with a full-length BRIGHT fx-tinted fuller + twin edge-outline lines, a bolder heavier crossguard (now fx-tinted at all tiers), and a bright core glint at the guard so the silhouette reads big & glowing at small render size.
export function buildWeapon_sword(opts) {
  const o = opts || {};
  const c = o.color || '#c8d0e0';
  const tier = o.tier | 0;
  const fx = o.fx || null;
  const prism = !!o.prismatic;
  const g = new T.Group();

  // element tint for the bright glowing edge/fuller (falls back to blade color)
  const FXC = { fire: '#ff6a1a', ice: '#bfeaff', void: '#9a3cff', spark: '#a8e0ff', smoke: '#aab0c0', wisp: c };
  const edgeC = (fx && FXC[fx]) || c;

  // tier-driven proportions: blade grows longer + BROADER with rarity (bolder silhouette)
  const bw = 0.085 + tier * 0.016;           // blade width (broadened for a bolder read)
  const bh = 0.66 + tier * 0.1;              // blade length
  const by = 0.12 + bh / 2;                  // blade centre (grip at origin, ~0.1 hilt stack below)
  const topY = 0.12 + bh;                    // blade tip-base (business end)

  // cached static materials (NEVER mutated)
  const steel = mat(c, 0.95 + tier * 0.04);
  const guard = mat(tier >= 2 ? '#c8ad5c' : '#9aa0ae', tier >= 2 ? 1 : 1); // ornate brass at t2+
  const gripMat = mat('#2a2018');

  // unique additive emissive parts (so prismatic can recolor them per-frame; these are NEVER cached)
  const mkGlow = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const glowParts = [];   // {mesh, base} collected for prismatic hue cycling
  const fxParts = [];     // animated fx pieces {mesh, kind, base, phase}
  function glow(mesh, op) { glowParts.push({ mesh, base: op }); return mesh; }

  // --- blade body (broad, flat, gothic) ---
  const blade = m(box(bw, bh, 0.024), steel); blade.position.y = by;
  g.add(blade);
  const tip = m(cone(bw * 0.9, 0.2 + tier * 0.02, 4), steel); tip.position.y = topY + 0.085;
  g.add(tip);

  // BRIGHT full-length fuller down the centre — the dominant glowing stroke
  const fullerMat = mkGlow(edgeC, 0.7 + tier * 0.06);
  const fuller = m(box(bw * 0.4, bh * 0.86, 0.03), fullerMat); fuller.position.set(0, by, 0.006);
  g.add(fuller); glow(fuller, fullerMat.opacity);

  // twin bright EDGE-OUTLINE lines down each side of the blade (defines the silhouette)
  const edgeOp = 0.55 + tier * 0.07;
  for (let s = -1; s <= 1; s += 2) {
    const em = mkGlow(edgeC, edgeOp);
    const edge = m(box(bw * 0.12, bh * 0.92, 0.032), em);
    edge.position.set(s * (bw * 0.5 - bw * 0.06), by, 0.004);
    g.add(edge); glow(edge, edgeOp);
    fxParts.push({ mesh: edge, kind: 'rune', base: edgeOp, phase: s > 0 ? 0.9 : 0 });
  }

  // t1+: a brighter concentrated accent near the tip (the "business end" flare)
  if (tier >= 1) {
    const accMat = mkGlow(edgeC, 0.95);
    const acc = m(box(bw * 0.28, bh * 0.42, 0.036), accMat); acc.position.set(0, by + bh * 0.18, 0.014);
    g.add(acc); glow(acc, accMat.opacity);
    fxParts.push({ mesh: acc, kind: 'rune', base: accMat.opacity, phase: 2.0 });
  }

  // --- crossguard / fittings (bold, wide, fx-tinted glow underlay) ---
  const guardGlowMat = mkGlow(edgeC, 0.5);
  if (tier >= 2) {
    // ornate winged guard: a heavy bar + two upswept quillon prongs + fittings
    const cross = m(box(0.42, 0.075, 0.085), guard); cross.position.y = 0.1;
    g.add(cross);
    const gb = m(box(0.44, 0.04, 0.05), guardGlowMat); gb.position.set(0, 0.1, 0.045);
    g.add(gb); glow(gb, guardGlowMat.opacity);
    const qL = m(cone(0.05, 0.2, 4), guard); qL.position.set(-0.21, 0.16, 0); qL.rotation.z = 0.7;
    const qR = m(cone(0.05, 0.2, 4), guard); qR.position.set(0.21, 0.16, 0); qR.rotation.z = -0.7;
    g.add(qL, qR);
    // centre gem set in the guard
    const gemMat = mkGlow(edgeC, 0.98);
    const gem = m(geo('swGem', () => new T.OctahedronGeometry(0.06, 0)), gemMat); gem.position.set(0, 0.1, 0.075);
    g.add(gem); glow(gem, gemMat.opacity); fxParts.push({ mesh: gem, kind: 'gem', base: 0.06, phase: 0 });
  } else {
    const cross = m(box(0.36, 0.07, 0.075), guard); cross.position.y = 0.1;
    g.add(cross);
    const gb = m(box(0.38, 0.035, 0.045), guardGlowMat); gb.position.set(0, 0.1, 0.04);
    g.add(gb); glow(gb, guardGlowMat.opacity);
  }

  // --- grip + pommel ---
  const grip = m(box(0.055, 0.16, 0.055), gripMat); grip.position.y = 0;
  g.add(grip);
  const pommel = m(box(0.095, 0.095, 0.095), guard); pommel.position.y = -0.1;
  g.add(pommel);
  if (tier >= 3) {
    // legendary pommel jewel
    const pjMat = mkGlow(edgeC, 0.95);
    const pj = m(geo('swPom', () => new T.OctahedronGeometry(0.05, 0)), pjMat); pj.position.y = -0.1;
    g.add(pj); glow(pj, pjMat.opacity);
  }

  // --- t3 LEGENDARY: glowing runes along the blade + ornamental side prongs ---
  if (tier >= 3) {
    const runeMat = mkGlow(edgeC, 0.92);
    const nR = 3;
    for (let i = 0; i < nR; i++) {
      const r = m(box(bw * 0.55, 0.05, 0.034), runeMat);
      r.position.set(0, by - bh * 0.3 + i * (bh * 0.28), 0.016);
      g.add(r); glow(r, runeMat.opacity);
      fxParts.push({ mesh: r, kind: 'rune', base: runeMat.opacity, phase: i * 1.3 });
    }
    // ornamental prongs flanking the lower blade (elaborate silhouette)
    const prL = m(cone(0.04, 0.24, 4), guard); prL.position.set(-bw * 0.5 - 0.05, by - bh * 0.28, 0); prL.rotation.z = 0.35;
    const prR = m(cone(0.04, 0.24, 4), guard); prR.position.set(bw * 0.5 + 0.05, by - bh * 0.28, 0); prR.rotation.z = -0.35;
    g.add(prL, prR);
  }

  // --- ELEMENTAL FX at the business end (upper blade / tip) ---
  const fxY = topY - 0.04;
  const fxScale = tier >= 3 ? 1.35 : (tier >= 1 ? 1.0 : 0.0); // FX prominent at legendary; subtle below; none at t0
  if (fx && fxScale > 0) {
    if (fx === 'fire') {
      const cols = ['#ff6a1a', '#ffb648', '#ff3010'];
      for (let i = 0; i < 3; i++) {
        const fm = mkGlow(cols[i], 0.85);
        const fl = m(cone(0.055 * fxScale, (0.2 + i * 0.05) * fxScale, 4), fm);
        fl.position.set((i - 1) * 0.04, fxY + i * 0.04, 0);
        g.add(fl); glow(fl, fm.opacity);
        fxParts.push({ mesh: fl, kind: 'fire', base: (0.2 + i * 0.05) * fxScale, phase: i * 2.1 });
      }
    } else if (fx === 'ice') {
      for (let i = 0; i < 4; i++) {
        const im = mkGlow('#bfeaff', 0.75); // one unique material per crystal so opacity anim never touches a shared mat
        const a = (i / 4) * Math.PI * 2;
        const cr = m(cone(0.034 * fxScale, (0.15 + (i % 2) * 0.06) * fxScale, 3), im);
        cr.position.set(Math.cos(a) * 0.05, fxY - 0.02 + Math.sin(a) * 0.03, Math.sin(a) * 0.03);
        cr.rotation.set(0.5, a, Math.cos(a) * 0.5);
        g.add(cr); glow(cr, im.opacity);
        fxParts.push({ mesh: cr, kind: 'ice', base: im.opacity, phase: i * 1.1 });
      }
    } else if (fx === 'void') {
      for (let i = 0; i < 2; i++) {
        const vm = mkGlow('#6a18c8', 0.75);
        const orb = m(geo('swVoid', () => new T.IcosahedronGeometry(0.075, 0)), vm);
        orb.position.set((i ? 0.05 : -0.05), fxY + i * 0.08, 0);
        g.add(orb); glow(orb, vm.opacity);
        fxParts.push({ mesh: orb, kind: 'void', base: 0.075 * fxScale, phase: i * 3.1 });
        orb.scale.setScalar(fxScale);
      }
      const warpMat = mkGlow('#3a0a58', 0.5);
      const warp = m(geo('swWarp', () => new T.OctahedronGeometry(0.14, 0)), warpMat); warp.position.y = fxY + 0.04; warp.scale.setScalar(fxScale);
      g.add(warp); glow(warp, warpMat.opacity);
      fxParts.push({ mesh: warp, kind: 'void', base: 0.14 * fxScale, phase: 1.5 });
    } else if (fx === 'spark') {
      for (let i = 0; i < 4; i++) {
        const sm = mkGlow('#a8e0ff', 0.98);
        const bit = m(box(0.022 * fxScale, 0.08 * fxScale, 0.022 * fxScale), sm);
        bit.position.set((i % 2 ? 0.05 : -0.05), fxY + (i * 0.05 - 0.05), 0);
        bit.rotation.z = (i % 2 ? 0.6 : -0.6);
        g.add(bit); glow(bit, sm.opacity);
        fxParts.push({ mesh: bit, kind: 'spark', base: 0, phase: i * 1.7, bx: bit.position.x, by: bit.position.y });
      }
    } else if (fx === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const km = mkGlow('#9aa0b0', 0.32);
        const pf = m(geo('swSmoke', () => new T.IcosahedronGeometry(0.085, 0)), km);
        pf.position.set((i - 1) * 0.03, fxY + i * 0.07, 0); pf.scale.setScalar(fxScale * (1 + i * 0.2));
        g.add(pf); glow(pf, km.opacity);
        fxParts.push({ mesh: pf, kind: 'smoke', base: fxY + i * 0.07, phase: i * 2.0 });
      }
    } else if (fx === 'wisp') {
      for (let i = 0; i < 3; i++) {
        const wm = mkGlow(c, 0.92);
        const mote = m(geo('swMote', () => new T.IcosahedronGeometry(0.038, 0)), wm);
        g.add(mote); glow(mote, wm.opacity);
        fxParts.push({ mesh: mote, kind: 'wisp', base: fxY, phase: (i / 3) * Math.PI * 2, rad: 0.1 * fxScale });
      }
    }
  }

  // --- t4 MYTHIC extra drama: orbiting shards + intense core glint ---
  if (tier >= 4) {
    for (let i = 0; i < 3; i++) {
      const sm = mkGlow(c, 0.88);
      const shard = m(geo('swShard', () => new T.OctahedronGeometry(0.045, 0)), sm);
      g.add(shard); glow(shard, sm.opacity);
      fxParts.push({ mesh: shard, kind: 'shard', base: by + bh * 0.2, phase: (i / 3) * Math.PI * 2, rad: bw + 0.1 });
    }
    const coreMat = mkGlow('#ffffff', 0.98);
    const core = m(geo('swCore', () => new T.IcosahedronGeometry(0.055, 0)), coreMat); core.position.y = by;
    g.add(core); glow(core, coreMat.opacity);
    fxParts.push({ mesh: core, kind: 'core', base: 0.055, phase: 0 });
  }

  // bright core glint seated at the guard — anchors a glowing heart to the silhouette at every tier
  const heartMat = mkGlow(edgeC, 0.85);
  const heart = m(geo('swHeart', () => new T.OctahedronGeometry(0.05, 0)), heartMat);
  heart.position.set(0, 0.1 + (tier >= 2 ? 0 : 0.01), -0.05);
  g.add(heart); glow(heart, heartMat.opacity);
  fxParts.push({ mesh: heart, kind: 'core', base: 0.05, phase: 1.1 });

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
            p.mesh.scale.setScalar(1 + (Math.sin(t * 5 + p.phase) * 0.5 + 0.5) * 0.5);
            break;
        }
      }
    };
  }

  return g;
}

// Strengthened: BIG bright faceted focus crystal + glowing halo disc + always-on inner core so the head reads as the signature; bolder element-colored accent spine. Interface (signature/opts/userData.anim/origin/lean) preserved exactly.
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

  // --- BOLD element-colored accent spine up the shaft (all tiers, brighter at higher) ---
  const spine = m(box(0.02, shaftLen * 0.78, 0.02), glowMat(c, tier >= 1 ? 0.95 : 0.7, true));
  spine.position.set(0, shaftLen * 0.5 - 0.02, shaftR + 0.013);
  g.add(spine);

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

  // ============================================================
  // TOP FOCUS — the signature read. Big bright faceted crystal,
  // a glowing halo disc behind it, and an always-on white inner core.
  // ============================================================
  // halo disc: flat bright glow so the head reads as a beacon at tiny size
  const haloMat = glowMat(c, 0.34, true);
  const halo = m(geo('staffHalo', () => new T.CircleGeometry(tall ? 0.34 : 0.28, 16)), haloMat);
  halo.position.y = focusY;
  g.add(halo);

  // main focus crystal — a tall faceted bipyramid (bold gem silhouette, not a fuzzy ball)
  const orbR = tall ? 0.20 : 0.16;
  const orbMat = glowMat(c, 0.95, true);
  const orb = m(geo('staffFocusCrystal', () => {
    const gg = new T.CylinderGeometry(0, orbR, orbR * 2.2, 5, 1);
    return gg;
  }), orbMat);
  orb.position.y = focusY;
  g.add(orb);
  // mirrored lower half so it's a full double-pointed gem
  const orbLow = m(geo('staffFocusCrystalLow', () => new T.CylinderGeometry(0, orbR, orbR * 1.4, 5, 1)), orbMat);
  orbLow.position.y = focusY;
  orbLow.rotation.x = Math.PI;
  g.add(orbLow);

  // always-on bright white inner core (the "lit from within" punch)
  const core = m(geo('staffCore', () => new T.IcosahedronGeometry(0.07, 0)), glowMat('#ffffff', 0.95, false));
  core.position.y = focusY;
  g.add(core);

  // claw/cage holding the crystal. t<3 = a simple cradle; t>=3 = ornamental prongs.
  const cageProngs = [];
  if (tall){
    const ring = m(cyl(0.16, 0.18, 0.055, 6), metal); ring.position.y = focusY - 0.20; g.add(ring);
    for (let i = 0; i < 4; i++){
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const prong = m(cone(0.03, 0.40, 4), metal);
      prong.position.set(Math.cos(a) * 0.16, focusY - 0.04, Math.sin(a) * 0.16);
      // bend the prongs inward to cradle the crystal
      prong.rotation.z = -Math.cos(a) * 0.5;
      prong.rotation.x = Math.sin(a) * 0.5;
      g.add(prong); cageProngs.push(prong);
    }
  } else {
    const cradle = m(cone(0.15, 0.24, 4), mat(c, 0.6)); cradle.position.y = focusY - 0.12;
    g.add(cradle);
  }

  // --- t3+: glowing runes along the shaft ---
  const runes = [];
  if (tier >= 3){
    for (let i = 0; i < 3; i++){
      const r = m(box(0.035, 0.035, 0.012), glowMat(c, 0.85, true));
      r.position.set(0, 0.32 + i * 0.22, shaftR + 0.018);
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
        const tongue = m(cone(0.055 * fxScale, 0.26 * fxScale, 4), glowMat(i & 1 ? '#ff7a1a' : '#ffd24a', 0.9, false));
        tongue.position.set(Math.cos(a) * 0.12, focusY + 0.18, Math.sin(a) * 0.12);
        g.add(tongue); fxParts.push(tongue); fxBase.push(tongue.position.y);
      }
    } else if (fx === 'ice'){
      for (let i = 0; i < 5; i++){
        const a = (i / 5) * Math.PI * 2;
        const cr = m(cone(0.04 * fxScale, 0.28 * fxScale, 4), glowMat('#bff0ff', 0.75, false));
        cr.position.set(Math.cos(a) * 0.18, focusY + 0.02, Math.sin(a) * 0.18);
        cr.rotation.z = -Math.cos(a) * 0.7; cr.rotation.x = Math.sin(a) * 0.7;
        g.add(cr); fxParts.push(cr);
      }
    } else if (fx === 'void'){
      for (let i = 0; i < 3; i++){
        const a = (i / 3) * Math.PI * 2;
        const orbv = m(geo('staffVoidOrb', () => new T.IcosahedronGeometry(0.08, 0)), glowMat('#6a1ea8', 0.85, false));
        orbv.position.set(Math.cos(a) * 0.22, focusY + 0.04, Math.sin(a) * 0.22);
        g.add(orbv); fxParts.push(orbv);
      }
    } else if (fx === 'spark'){
      for (let i = 0; i < 5; i++){
        const a = (i / 5) * Math.PI * 2;
        const bit = m(box(0.022, 0.14 * fxScale, 0.022), glowMat('#cdf0ff', 0.95, false));
        bit.position.set(Math.cos(a) * 0.18, focusY + 0.1, Math.sin(a) * 0.18);
        bit.rotation.z = Math.cos(a) * 0.8;
        g.add(bit); fxParts.push(bit); fxBase.push(a);
      }
    } else if (fx === 'smoke'){
      for (let i = 0; i < 3; i++){
        const w = m(geo('staffSmoke', () => new T.IcosahedronGeometry(0.11, 0)), glowMat(c, 0.18, false));
        w.position.set((i - 1) * 0.06, focusY + 0.14 + i * 0.08, 0);
        w.scale.set(1, 0.7, 1);
        g.add(w); fxParts.push(w); fxBase.push(focusY + 0.14 + i * 0.08);
      }
    } else if (fx === 'wisp'){
      for (let i = 0; i < 4; i++){
        const a0 = (i / 4) * Math.PI * 2;
        const mote = m(geo('staffWisp', () => new T.IcosahedronGeometry(0.04, 0)), glowMat(i & 1 ? c : '#ffffff', 0.95, false));
        // initial orbit position so it reads on a static frame
        mote.position.set(Math.cos(a0) * 0.20, focusY, Math.sin(a0) * 0.20);
        g.add(mote); fxParts.push(mote); fxBase.push(a0);
      }
    }
  }

  // --- t4 mythic: orbiting shards around the focus ---
  const shards = [];
  if (tier >= 4){
    for (let i = 0; i < 3; i++){
      const sh = m(cone(0.045, 0.18, 3), glowMat(c, 0.9, true));
      const a0 = (i / 3) * Math.PI * 2;
      // initial orbit position so it reads on a static frame
      sh.position.set(Math.cos(a0) * 0.28, focusY, Math.sin(a0) * 0.28);
      sh.rotation.z = a0;
      g.add(sh); shards.push(sh);
    }
  }

  // slight gothic lean so it reads as a held staff
  g.rotation.z = -0.06;

  // private scratch Color — allocated ONCE here (not per frame) for the prismatic cycle
  const tmpC = new T.Color();
  const baseOrbScale = 1;

  // ============================================================
  // ANIMATION — cheap sin, mutate children only, no allocation
  // ============================================================
  g.userData.anim = (grp, now) => {
    const t = now;
    // breathing focus crystal + halo pulse + bright core throb
    const bs = baseOrbScale * (1 + Math.sin(t / 220) * 0.10);
    orb.scale.set(bs, bs, bs);
    orbLow.scale.set(bs, bs, bs);
    orb.rotation.y = t / 900;
    orbLow.rotation.y = t / 900;
    core.scale.setScalar(1 + Math.sin(t / 160) * 0.35);
    haloMat.opacity = 0.24 + (Math.sin(t / 260) * 0.5 + 0.5) * 0.20;
    halo.scale.setScalar(1 + Math.sin(t / 260) * 0.10);

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
        fxParts[i].position.y = (fxBase[i] || focusY + 0.18) + Math.sin(t / 110 + i) * 0.02;
      }
    } else if (fx === 'ice'){
      for (let i = 0; i < fxParts.length; i++) fxParts[i].material.opacity = 0.5 + (Math.sin(t / 400 + i) * 0.5 + 0.5) * 0.4;
    } else if (fx === 'void'){
      const rot = t / 600;
      for (let i = 0; i < fxParts.length; i++){
        const a = (i / fxParts.length) * Math.PI * 2 + rot;
        fxParts[i].position.set(Math.cos(a) * 0.22, focusY + 0.04 + Math.sin(t / 300 + i) * 0.03, Math.sin(a) * 0.22);
        fxParts[i].scale.setScalar(1 + Math.sin(t / 250 + i) * 0.22);
      }
    } else if (fx === 'spark'){
      for (let i = 0; i < fxParts.length; i++){
        const a = fxBase[i];
        const j = Math.sin(t / 40 + i * 2.1) * 0.04;
        fxParts[i].position.set(Math.cos(a) * (0.18 + j), focusY + 0.1 + Math.sin(t / 55 + i) * 0.03, Math.sin(a) * (0.18 + j));
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
        const rr = 0.20 + Math.sin(t / 500 + i) * 0.03;
        fxParts[i].position.set(Math.cos(a) * rr, focusY + Math.sin(t / 400 + i * 1.7) * 0.1, Math.sin(a) * rr);
      }
    }

    // mythic orbiting shards
    for (let i = 0; i < shards.length; i++){
      const a = (i / shards.length) * Math.PI * 2 + t / 500;
      shards[i].position.set(Math.cos(a) * 0.28, focusY + Math.sin(t / 360 + i) * 0.06, Math.sin(a) * 0.28);
      shards[i].rotation.z = a;
    }
  };
  return g;
}

export function buildWeapon_bow(opts) {
  // STRENGTHENED: fatter bold recurve arcs + a thick double-glow string (bright core +
  // wide additive halo) + always-on element-tinted glowing nock caps at both limb tips.
  const c = (opts && opts.color) || '#caa15a';
  const tier = (opts && opts.tier) | 0;
  const fx = (opts && opts.fx) || null;
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // element tint for the nock glow / string (falls back to the weapon color)
  const elemHue = fx === 'fire' ? '#ff9030' : fx === 'ice' ? '#bfe9ff'
    : fx === 'void' ? '#b060ff' : fx === 'spark' ? '#dff0ff'
    : fx === 'smoke' ? '#9aa0ac' : fx === 'wisp' ? '#bfffe0' : c;

  // cached static materials (NEVER mutated)
  const wood = mat('#2a2018');
  const limbMat = mat(c, 0.95);
  const fitMat = mat('#9aa0 b0'.replace(' ', '')); // light steel fittings
  const accent = matAdd(c, 0.95);
  const rune = matAdd(c, 1);

  // unique materials ONLY for things the anim mutates (prismatic shimmer / pulsing FX).
  const shimmer = [];
  function uniGlow(hex, opacity) {
    const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false });
    shimmer.push(mm);
    return mm;
  }

  // ---- silhouette scale: bolder & longer than before, legendary+ even bigger ----
  const big = tier >= 3;
  const span = big ? 0.54 : 0.46;   // limb reach along +/-Y
  const tube = big ? 0.058 : 0.048; // FATTER limbs read at small size

  // ---- LIMBS: two bold curved arcs (upper +Y, lower -Y) meeting at the riser ----
  const arcGeoKey = `bowArc${big ? 'L' : 'S'}`;
  const arcGeo = geo(arcGeoKey, () => new T.TorusGeometry(span, tube, 5, 11, Math.PI * 0.94));
  const upper = m(arcGeo, limbMat);
  upper.rotation.z = Math.PI / 2 - Math.PI * 0.47;
  upper.position.y = span * 0.5;
  const lower = m(arcGeo, limbMat);
  lower.rotation.z = -(Math.PI / 2 - Math.PI * 0.47);
  lower.rotation.x = Math.PI;
  lower.position.y = -span * 0.5;

  const nockY = span * 0.96;

  // recurve tips (legendary+): out-flicked prongs at each limb end
  if (tier >= 3) {
    const tipU = m(cone(tube * 1.5, 0.14, 4), fitMat); tipU.position.set(0, nockY, 0.06); tipU.rotation.x = -0.5;
    const tipL = m(cone(tube * 1.5, 0.14, 4), fitMat); tipL.position.set(0, -nockY, 0.06); tipL.rotation.x = Math.PI + 0.5;
    g.add(tipU, tipL);
  }

  // ---- RISER / GRIP at the origin (the hand) ----
  const grip = m(box(0.07, 0.24, 0.08), wood); grip.position.y = 0;
  const riser = m(box(0.06, 0.34, 0.055), mat(c, 0.5)); riser.position.set(0, 0, -0.01);
  g.add(grip, riser, upper, lower);

  // ---- BRIGHT GLOWING LIMB-TIP NOCK CAPS (always on, element-tinted) ----
  // Bold bright dots that bracket the silhouette top & bottom.
  const nockMat = prismatic ? uniGlow(elemHue, 0.95) : matAdd(elemHue, 0.95);
  const capGeo = geo('bowNockCap', () => new T.OctahedronGeometry(0.05, 0));
  const capU = m(capGeo, nockMat); capU.position.set(0, nockY, 0.03);
  const capL = m(capGeo, nockMat); capL.position.set(0, -nockY, 0.03);
  g.add(capU, capL);

  // ---- STRING: thick double glow — bright white core + wide tinted halo ----
  const strH = nockY * 2;
  const strCoreMat = prismatic ? uniGlow('#ffffff', 0.85) : matAdd('#ffffff', 0.8);
  const strHaloMat = prismatic ? uniGlow(elemHue, 0.5) : matAdd(elemHue, 0.5);
  const strHalo = m(box(0.03, strH, 0.03), strHaloMat); strHalo.position.set(0, 0, -0.05);
  const string = m(box(0.014, strH, 0.014), strCoreMat); string.position.set(0, 0, -0.05);
  g.add(strHalo, string);
  const restZ = 0.07;

  // ============ TIER LADDER (cumulative) ============
  // t1+: a bold glowing accent line running along the back of each limb
  if (tier >= 1) {
    const aMat = prismatic ? uniGlow(c, 0.9) : accent;
    const accGeo = geo(arcGeoKey + 'acc', () => new T.TorusGeometry(span, tube * 0.55, 4, 11, Math.PI * 0.94));
    const au = m(accGeo, aMat); au.rotation.copy(upper.rotation); au.position.copy(upper.position); au.position.z -= 0.02;
    const al = m(accGeo, aMat); al.rotation.copy(lower.rotation); al.position.copy(lower.position); al.position.z -= 0.02;
    g.add(au, al);
  }
  // t2+: ornate nock fittings + a bigger gem at the riser
  if (tier >= 2) {
    const fU = m(box(0.06, 0.07, 0.07), fitMat); fU.position.set(0, nockY, 0.0);
    const fL = m(box(0.06, 0.07, 0.07), fitMat); fL.position.set(0, -nockY, 0.0);
    const gemMat = prismatic ? uniGlow(c, 1) : matAdd(c, 1);
    const gem = m(geo('bowGem', () => new T.OctahedronGeometry(0.065, 0)), gemMat); gem.position.set(0, 0, restZ);
    g.add(fU, fL, gem);
    if (!prismatic) g.userData._gem = gem;
  }
  // t3 LEGENDARY: glowing runes along the limbs + strong emissive core glow
  if (tier >= 3) {
    const rMat = prismatic ? uniGlow(c, 1) : rune;
    for (let i = 0; i < 6; i++) {
      const up = i < 3;
      const t = (i % 3 + 1) / 3.6;
      const ry = (up ? 1 : -1) * span * t;
      const rz = 0.02 + Math.sin(t * Math.PI) * span * 0.44;
      const r = m(box(0.038, 0.038, 0.014), rMat); r.position.set(0, ry, rz);
      g.add(r);
    }
    const coreMat = prismatic ? uniGlow(c, 0.7) : matAdd(c, 0.65);
    const core = m(box(0.12, 0.38, 0.06), coreMat); core.position.set(0, 0, -0.02);
    g.add(core);
  }
  // t4 MYTHIC: orbiting shards around the riser + an intense core gem
  const shards = [];
  if (tier >= 4) {
    const coreMat = uniGlow('#ffffff', 1);
    const mcore = m(geo('bowMcore', () => new T.IcosahedronGeometry(0.085, 0)), coreMat); mcore.position.set(0, 0, restZ);
    g.add(mcore);
    g.userData._mcore = mcore;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sMat = uniGlow(c, 0.85);
      const sh = m(geo('bowShard', () => new T.OctahedronGeometry(0.05, 0)), sMat);
      sh.userData.a = a; sh.userData.r = 0.17;
      sh.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, restZ);
      shards.push(sh); g.add(sh);
    }
  }

  // ============ ELEMENTAL FX — anchored at the arrow rest / along the bow ============
  const fxParts = [];
  if (fx === 'fire') {
    const f1 = m(cone(0.07, 0.24, 5), matAdd(c, 0.9)); f1.position.set(0, 0.07, restZ);
    const f2 = m(cone(0.04, 0.16, 4), matAdd('#ffe0a0', 1)); f2.position.set(0, 0.06, restZ + 0.01);
    g.add(f1, f2); fxParts.push({ k: 'fire', a: f1, b: f2 });
  } else if (fx === 'ice') {
    const i1 = m(cone(0.045, 0.2, 4), matAdd(c, 0.65)); i1.position.set(0.04, 0.04, restZ); i1.rotation.z = -0.4;
    const i2 = m(cone(0.04, 0.15, 4), matAdd('#cdebff', 0.8)); i2.position.set(-0.03, 0.07, restZ); i2.rotation.z = 0.5;
    const i3 = m(cone(0.034, 0.11, 4), matAdd(c, 0.55)); i3.position.set(0.01, -0.02, restZ + 0.01);
    g.add(i1, i2, i3); fxParts.push({ k: 'ice', a: i1, b: i2, c: i3 });
  } else if (fx === 'void') {
    const v1 = m(geo('bowVoid', () => new T.IcosahedronGeometry(0.09, 0)), matAdd(c, 0.75)); v1.position.set(0, 0.04, restZ + 0.02);
    const v2 = m(geo('bowVoidC', () => new T.IcosahedronGeometry(0.04, 0)), matAdd('#1a0030', 0.95)); v2.position.set(0, 0.04, restZ + 0.04);
    g.add(v1, v2); fxParts.push({ k: 'void', a: v1, b: v2 });
  } else if (fx === 'spark') {
    const sp = [];
    for (let i = 0; i < 4; i++) {
      const b = m(box(0.02, 0.07, 0.02), matAdd('#eaf4ff', 0.95));
      b.position.set(0, (i - 1.5) * 0.12, restZ); b.userData.ph = i * 1.7;
      g.add(b); sp.push(b);
    }
    fxParts.push({ k: 'spark', list: sp });
  } else if (fx === 'smoke') {
    const s1 = m(plane(0.14, 0.2), matAdd(c, 0.2)); s1.position.set(0, 0.1, restZ);
    const s2 = m(plane(0.1, 0.16), matAdd(c, 0.14)); s2.position.set(0.02, 0.2, restZ);
    g.add(s1, s2); fxParts.push({ k: 'smoke', a: s1, b: s2 });
  } else if (fx === 'wisp') {
    const w = [];
    for (let i = 0; i < 3; i++) {
      const mo = m(geo('bowWisp', () => new T.OctahedronGeometry(0.028, 0)), matAdd(c, 0.9));
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
      if (prismatic && shimmer.length) {
        const hue = (now / 2600) % 1;
        for (let i = 0; i < shimmer.length; i++) {
          shimmer[i].color.setHSL((hue + i * 0.06) % 1, 0.85, 0.6);
        }
      }
      if (gemRef) gemRef.scale.setScalar(1 + Math.sin(now / 300) * 0.18);
      if (mcoreRef) mcoreRef.scale.setScalar(1 + Math.sin(now / 180) * 0.35);
      for (let i = 0; i < shards.length; i++) {
        const a = shards[i].userData.a + now / 700;
        const r = shards[i].userData.r;
        shards[i].position.set(Math.cos(a) * r, Math.sin(a) * r, restZ);
        shards[i].rotation.y = now / 200;
      }
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
  // STRENGTHENED: hero crown-gem tip now reads as the brightest, biggest accent (bold pulsing core + glow halo + radiating prongs); ornate head framed by a bright additive ring so the small scepter pops on the additive display.
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
  const glowSoft = matAdd(c, 0.55);

  // helper: make a UNIQUE additive material (for anything mutated per-frame)
  const uniq = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op == null ? 1 : op, blending: T.AdditiveBlending, depthWrite: false });

  // length grows with tier (t3 legendary = longer/wider)
  const shaftLen = tier >= 3 ? 0.62 : 0.5;
  const shaftTop = shaftLen;            // grip at y=0 -> shaft spans 0..shaftLen
  const headY = shaftTop + 0.1;         // skull/idol head centre, above the shaft
  const tipY = headY + 0.26;            // HERO crown-gem tip, crowning the scepter

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

  // --- ORNATE CROWN: four claw-prongs cradling the hero tip gem (always present, the signature head) ---
  const claws = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cl = m(cone(0.026, 0.16, 4), bone);
    cl.position.set(Math.cos(a) * 0.07, headY + 0.16, Math.sin(a) * 0.07);
    cl.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
    claws.push(cl); g.add(cl);
  }

  // glowing eye sockets (UNIQUE if prismatic, else cached additive)
  let eyeMatL, eyeMatR;
  if (prismatic) { eyeMatL = uniq(c, 1); eyeMatR = uniq(c, 1); }
  else { eyeMatL = glow; eyeMatR = glow; }
  const eyeL = m(box(0.045, 0.05, 0.03), eyeMatL); eyeL.position.set(-0.045, headY + 0.01, 0.085);
  const eyeR = m(box(0.045, 0.05, 0.03), eyeMatR); eyeR.position.set(0.045, headY + 0.01, 0.085);
  g.add(eyeL, eyeR);

  // ===========================================================
  // HERO TIP GEM — the single brightest, boldest accent. Big bi-pyramid
  // crystal core + a soft glow halo + four radiating glow spikes so the
  // tiny scepter reads strongly on the additive display. ALWAYS present.
  // UNIQUE materials => animated/prismatic-safe.
  // ===========================================================
  const tipCoreMat = uniq('#ffffff', 1);
  const tipGemMat = uniq(c, 0.95);
  const tipHaloMat = uniq(c, 0.4);
  // outer crystal (tier-scaled size — bigger & brighter at higher tier)
  const gemR = tier >= 3 ? 0.11 : 0.09;
  const gemH = tier >= 3 ? 0.3 : 0.24;
  const tipGem = m(geo('wandTipGem', () => new T.ConeGeometry(1, 1, 4)), tipGemMat);
  tipGem.scale.set(gemR, gemH * 0.5, gemR);
  tipGem.position.set(0, tipY, 0);
  g.add(tipGem);
  const tipGemLow = m(geo('wandTipGemLow', () => new T.ConeGeometry(1, 1, 4)), tipGemMat);
  tipGemLow.scale.set(gemR, gemH * 0.5, gemR);
  tipGemLow.position.set(0, tipY - gemH * 0.5, 0);
  tipGemLow.rotation.z = Math.PI; // mirror -> diamond/octahedron silhouette
  g.add(tipGemLow);
  // blazing white inner core
  const tipCore = m(geo('wandTipCore', () => new T.OctahedronGeometry(0.05, 0)), tipCoreMat);
  tipCore.position.set(0, tipY, 0);
  g.add(tipCore);
  // soft glow halo behind the gem (big, dim, billboard-ish disc -> bloom)
  const tipHalo = m(geo('wandTipHalo', () => new T.OctahedronGeometry(0.16, 0)), tipHaloMat);
  tipHalo.scale.set(1, 0.55, 1);
  tipHalo.position.set(0, tipY, 0);
  g.add(tipHalo);
  // four radiating glow spikes -> bold star silhouette
  const tipRays = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ray = m(box(0.016, 0.22, 0.016), tipGemMat);
    ray.position.set(Math.cos(a) * 0.02, tipY, Math.sin(a) * 0.02);
    ray.rotation.set(0, a, Math.cos(a) * 0.9);
    tipRays.push(ray); g.add(ray);
  }

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

  // --- T4 MYTHIC: orbiting shards around the hero tip + an intense core in the maw ---
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
  // ELEMENTAL FX — gathers at the HERO TIP (top). Additive, animated.
  // Higher tier => more prominent. When prismatic, FX use UNIQUE
  // mats and shimmer; otherwise cheap cached mats.
  // ===========================================================
  const fxParts = [];
  const big = tier >= 3;
  const fxY = tipY + 0.14; // crowning the hero tip gem
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

    // HERO tip gem — strong throbbing pulse so it's the star of the silhouette
    const pulse = 0.85 + Math.sin(now / 220) * 0.2;
    tipCore.scale.setScalar(0.8 + Math.sin(now / 160) * 0.35);
    tipHalo.scale.set(pulse, pulse * 0.55, pulse);
    tipHaloMat.opacity = 0.3 + Math.abs(Math.sin(now / 300)) * 0.3;
    tipGemMat.opacity = 0.75 + Math.abs(Math.sin(now / 260)) * 0.25;
    for (let i = 0; i < tipRays.length; i++) {
      const r = tipRays[i];
      r.scale.y = 0.7 + Math.abs(Math.sin(now / 200 + i * 1.6)) * 0.6;
    }
    grp; // (signature parity)

    // legendary runes pulse along the shaft
    for (let i = 0; i < runes.length; i++) {
      runes[i].material.opacity = 0.55 + Math.abs(Math.sin(now / 300 + i)) * 0.45;
    }

    // mythic: orbiting shards around the hero tip + breathing maw core
    for (let i = 0; i < shards.length; i++) {
      const ph = shards[i].userData.ph + now / 600;
      shards[i].position.set(Math.cos(ph) * 0.18, tipY + Math.sin(now / 500 + i) * 0.06, Math.sin(ph) * 0.18);
      shards[i].rotation.y = ph;
    }
    if (core) core.scale.setScalar(1 + Math.sin(now / 200) * 0.25);

    // prismatic rainbow shimmer (UNIQUE mats only)
    if (prismatic) {
      const hue = (now / 2600) % 1;
      eyeMatL.color.setHSL(hue, 1, 0.6);
      eyeMatR.color.setHSL((hue + 0.5) % 1, 1, 0.6);
      tipGemMat.color.setHSL(hue, 1, 0.62);
      tipHaloMat.color.setHSL((hue + 0.1) % 1, 1, 0.6);
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
  // Strengthened: wider winged mantle + bolder billowing fall + a continuous BRIGHT glowing hem-line band; richer lagged sway.
  const c = (opts && opts.color) || '#6a2030';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // Flowing cloth panel hanging BACKWARD (-Z) from the upper-back mount.
  // Stacked tapered panels (wide winged shoulders -> billowing fall) with a single
  // bold glowing hem line so the silhouette reads BIG and BRIGHT at glasses scale.
  // Prismatic (animated) parts get UNIQUE material instances; static parts use cache.
  const clothMats = [];
  function cloth(hex, op) {
    if (prismatic) {
      const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
      clothMats.push(mm); return mm;
    }
    return matAdd(hex, op);
  }
  function uniqAdd(hex, op) {
    const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    clothMats.push(mm); return mm;
  }
  const trimMat = prismatic
    ? uniqAdd(c, 0.98)
    : matAdd(c, 0.95);
  // hem-line band gets its OWN bright instance so it can pulse independently
  const hemMat = uniqAdd(c, 1.0);

  // WIDE winged mantle over the shoulders -- the bold top of the silhouette
  const collar = m(box(0.78, 0.14, 0.11), cloth(c, 0.58));
  collar.position.set(0, 0.07, -0.04); collar.rotation.x = 0.28;
  // angled shoulder wings flaring outward for a broader, more heroic top line
  const wingL = m(box(0.26, 0.12, 0.08), cloth(c, 0.5));
  wingL.position.set(-0.42, 0.05, -0.05); wingL.rotation.set(0.28, 0, 0.5);
  const wingR = m(box(0.26, 0.12, 0.08), cloth(c, 0.5));
  wingR.position.set(0.42, 0.05, -0.05); wingR.rotation.set(0.28, 0, -0.5);
  // bright trim line along the collar edge (rarity accent)
  const trim = m(box(0.74, 0.035, 0.02), trimMat);
  trim.position.set(0, 0.13, -0.02); trim.rotation.x = 0.28;

  // billowing cloth: 3 stacked panels, wider + bolder than before, each tilted
  // further back so it fans out behind the hero.
  const upper = m(plane(0.7, 0.36), cloth(c, 0.66));
  upper.position.set(0, -0.17, -0.06); upper.rotation.x = 0.18;
  const mid = m(plane(0.62, 0.36), cloth(c, 0.52));
  mid.position.set(0, -0.47, -0.13); mid.rotation.x = 0.11;
  const low = m(plane(0.54, 0.34), cloth(c, 0.4));
  low.position.set(0, -0.76, -0.18); low.rotation.x = 0.05;

  // ONE bold continuous glowing hem-line band across the bottom of the fall
  const hemBand = m(box(0.56, 0.05, 0.02), hemMat);
  hemBand.position.set(0, -0.92, -0.18); hemBand.rotation.x = 0.05;

  // ragged hem prongs trailing below the band for a tattered gothic edge
  const hems = [];
  const hemX = [-0.21, -0.07, 0.07, 0.21];
  for (let i = 0; i < hemX.length; i++) {
    const hp = m(cone(0.075, 0.24, 3), cloth(c, 0.36));
    hp.position.set(hemX[i], -1.04, -0.18); hp.rotation.x = Math.PI - 0.05;
    hems.push(hp); g.add(hp);
  }

  g.add(collar, wingL, wingR, trim, upper, mid, low, hemBand);

  g.userData.anim = (grp, now) => {
    // idle sway: whole cloth swings, lower panels lag for a travelling wave
    const sway = Math.sin(now / 420);
    upper.rotation.x = 0.18 + sway * 0.05;
    mid.rotation.x = 0.11 + Math.sin(now / 420 - 0.5) * 0.07;
    low.rotation.x = 0.05 + Math.sin(now / 420 - 1.0) * 0.1;
    low.rotation.z = Math.sin(now / 560) * 0.05;
    hemBand.rotation.x = 0.05 + Math.sin(now / 420 - 1.0) * 0.1;
    hemBand.rotation.z = Math.sin(now / 560) * 0.05;
    // shoulder wings flutter a touch
    wingL.rotation.z = 0.5 + Math.sin(now / 500) * 0.06;
    wingR.rotation.z = -0.5 - Math.sin(now / 500) * 0.06;
    for (let i = 0; i < hems.length; i++) {
      hems[i].rotation.z = Math.sin(now / 480 + i) * 0.16;
    }
    // bright hem-line breathes so it always pops
    hemMat.opacity = 0.8 + Math.abs(Math.sin(now / 700)) * 0.2;
    if (prismatic) {
      const hue = (now / 2600) % 1;
      for (let i = 0; i < clothMats.length; i++) {
        clothMats[i].color.setHSL((hue + i * 0.05) % 1, 0.85, 0.6);
      }
    }
  };
  return g;
}

export function buildGear_wings(opts) {
  // STRENGTHENED: ~2x span with tall arched BRIGHT additive bone-spars, glowing
  // wingtip claw-fingers, a big luminous membrane fan with glowing edge-ribs and a
  // bright root boss — reads as a wide blazing wing silhouette instead of the old
  // near-invisible thin fan. Keeps the majestic beat + prismatic shimmer.
  const c = (opts && opts.color) || '#caa15a';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // Collect every animated (UNIQUE, never-cached) material so the shimmer/pulse
  // can drive them without touching the shared mat()/matAdd() cache.
  const glowMats = [];
  function liveGlow(hex, op) {
    const mm = new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    glowMats.push(mm);
    return mm;
  }
  const boneCol = '#fff0c8';     // bright bone / strut color
  const sparMat = mat(c, 0.9);   // opaque dark core gives the spar a touch of mass

  function wing(side) {
    const w = new T.Group();
    w.position.set(0.1 * side, 0.16, -0.06);

    // ---- main arched leading bone-spar: long bright glowing strut ----
    const spar = m(cyl(0.05, 0.09, 1.05, 4), liveGlow(boneCol, 0.95));
    spar.position.set(0.5 * side, 0.14, -0.12);
    spar.rotation.z = (Math.PI / 2 - 0.62) * side;
    spar.rotation.y = -0.2 * side;
    w.add(spar);
    // dark inner core of the spar for contrast/mass
    const sparCore = m(cyl(0.03, 0.05, 1.02, 4), sparMat);
    sparCore.position.copy(spar.position);
    sparCore.rotation.copy(spar.rotation);
    w.add(sparCore);

    // ---- bright wingtip claw / finger spikes flaring off the spar end ----
    for (let k = 0; k < 3; k++) {
      const claw = m(cone(0.045, 0.34 + k * 0.06, 4), liveGlow(boneCol, 0.95));
      claw.position.set((0.92 - k * 0.05) * side, 0.34 - k * 0.12, -0.18);
      claw.rotation.z = (1.15 + k * 0.28) * side;
      w.add(claw);
    }

    // ---- the membrane / feather fan: BIG flat blades fanning down & back ----
    const fcount = 7;
    for (let i = 0; i < fcount; i++) {
      const t = i / (fcount - 1);                       // 0 root .. 1 tip
      const len = 0.5 + t * 0.62;                       // long blades, longest at tip
      const br = 0.5 + (1 - Math.abs(t - 0.5) * 2) * 0.22; // brightest mid-wing
      const f = m(cone(0.14, len, 3), liveGlow(c, br));
      f.position.set((0.18 + t * 0.78) * side, 0.12 - t * 0.36, -0.14 - t * 0.05);
      f.rotation.set(Math.PI / 2, 0, (1.12 + t * 0.46) * side);
      f.scale.set(1, 1, 0.22);                          // flatten into a blade
      w.add(f);
      // bright glowing leading edge-rib on every other blade for crisp struts
      if (i % 2 === 0) {
        const rib = m(cyl(0.014, 0.022, len * 0.92, 3), liveGlow(boneCol, 0.85));
        rib.position.copy(f.position);
        rib.rotation.copy(f.rotation);
        w.add(rib);
      }
    }

    // ---- bright root boss where the wing meets the back ----
    const boss = m(cone(0.12, 0.22, 4), liveGlow(boneCol, 0.9));
    boss.position.set(0.12 * side, 0.1, -0.1);
    boss.rotation.z = -0.6 * side;
    w.add(boss);

    return w;
  }

  const wL = wing(-1);
  const wR = wing(1);
  g.add(wL, wR);

  g.userData.anim = (grp, now) => {
    // strong majestic beat from the shoulder
    const beat = Math.sin(now / 340) * 0.26;
    wL.rotation.z = beat;
    wR.rotation.z = -beat;
    // fold/unfold sweep so the spread breathes
    const flex = Math.sin(now / 500) * 0.09;
    wL.rotation.y = flex;
    wR.rotation.y = -flex;
    if (prismatic) {
      const hue = (now / 2200) % 1;
      for (let i = 0; i < glowMats.length; i++) {
        glowMats[i].color.setHSL((hue + i * 0.03) % 1, 0.85, 0.62);
      }
    }
  };
  return g;
}

// STRENGTHENED: bold wide spectral extra-arms + bright wraith core give a haunting, readable wide silhouette at small render; bigger/brighter additive tatters & motes replace faint fussy wisps.
export function buildGear_spectral(opts) {
  const c = (opts && opts.color) || '#8fb6c8';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // All glow materials are UNIQUE additive instances (their opacity/color breathe
  // every frame), so they never mutate the shared cached mats.
  const wispMats = [];
  function wispMat(op) {
    const mm = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    wispMats.push(mm); return mm;
  }

  // ---- BIG signature shape: a pair of ghostly wraith-arms reaching wide & back.
  // Each arm = upper segment (cone) + forearm (cone) + a bright claw tip, on its
  // own shoulder pivot so it can drift/reach like a haunting spectral limb.
  const arms = [];
  const armSeg = geo('spectralArmSeg', () => new T.CylinderGeometry(0.05, 0.11, 0.34, 5));
  const armFore = geo('spectralArmFore', () => new T.CylinderGeometry(0.025, 0.06, 0.30, 5));
  const clawTip = geo('spectralClaw', () => new T.ConeGeometry(0.05, 0.16, 4));
  for (let s = 0; s < 2; s++) {
    const dir = s === 0 ? -1 : 1;
    const piv = new T.Group();
    piv.position.set(dir * 0.17, 0.16, -0.07);
    piv.rotation.z = dir * 0.55;           // splay outward (wide silhouette)
    piv.rotation.y = dir * -0.35;          // sweep back

    const upper = m(armSeg, wispMat(0.5));
    upper.position.set(dir * 0.12, -0.05, -0.04);
    upper.rotation.z = dir * 0.6;
    piv.add(upper);

    // elbow pivot for a reaching forearm
    const elbow = new T.Group();
    elbow.position.set(dir * 0.22, -0.13, -0.07);
    const fore = m(armFore, wispMat(0.6));
    fore.position.set(dir * 0.05, -0.14, -0.02);
    fore.rotation.z = dir * 0.3;
    elbow.add(fore);
    const claw = m(clawTip, wispMat(0.85));
    claw.position.set(dir * 0.08, -0.30, -0.02);
    claw.rotation.z = dir * 0.3;
    claw.rotation.x = 0.2;
    elbow.add(claw);
    piv.add(elbow);

    piv.userData.elbow = elbow;
    piv.userData.upMat = upper.material;
    piv.userData.foreMat = fore.material;
    piv.userData.clawMat = claw.material;
    piv.userData.dir = dir;
    piv.userData.ph = s * 1.4;
    piv.userData.baseZ = dir * 0.55;
    piv.userData.baseY = dir * -0.35;
    arms.push(piv); g.add(piv);
  }

  // ---- Bright wraith CORE between the shoulders (the glowing heart of the shroud)
  const coreGeo = geo('spectralCore', () => new T.OctahedronGeometry(0.13, 0));
  const coreMat = wispMat(0.95);
  const core = m(coreGeo, coreMat);
  core.position.set(0, 0.05, -0.06);
  core.scale.set(1, 1.5, 0.8);
  g.add(core);
  // inner bright pip for a hot center
  const coreInnerMat = wispMat(1.0);
  const coreInner = m(geo('spectralCoreInner', () => new T.OctahedronGeometry(0.06, 0)), coreInnerMat);
  coreInner.position.copy(core.position);
  coreInner.scale.set(1, 1.4, 0.8);
  g.add(coreInner);

  // ---- A few BOLD trailing tatters fanning down/back behind the shoulders.
  const tatters = [];
  const cfg = [[-0.14, 0.5], [0.0, 0.58], [0.14, 0.5]];
  const tattGeo = geo('spectralTatter', () => new T.ConeGeometry(0.16, 1, 4));
  for (let i = 0; i < cfg.length; i++) {
    const piv = new T.Group();
    piv.position.set(cfg[i][0], -0.04, -0.08);
    const len = cfg[i][1];
    const op = 0.42 - i * 0.02;
    const t = m(tattGeo, wispMat(op));
    t.scale.set(1, len, 0.45);
    t.position.set(0, -len * 0.42, -0.1);
    t.rotation.x = Math.PI - 0.22;
    piv.add(t);
    piv.userData.baseMat = t.material;
    piv.userData.baseOp = op;
    piv.userData.ph = i * 1.1;
    tatters.push(piv); g.add(piv);
  }

  // wide faint halo-shroud grounding the wisps over the shoulders
  const shroudMat = wispMat(0.2);
  const shroud = m(cyl(0.2, 0.4, 0.32, 8), shroudMat);
  shroud.position.set(0, -0.02, -0.08);
  g.add(shroud);

  // ---- A few bigger, brighter motes orbiting/rising in the trail
  const motes = [];
  const moteGeo = geo('spectralMote', () => new T.OctahedronGeometry(0.055, 0));
  for (let i = 0; i < 5; i++) {
    const mo = m(moteGeo, wispMat(0.8));
    mo.userData.ph = (i / 5) * Math.PI * 2;
    mo.userData.rad = 0.12 + (i % 3) * 0.06;
    motes.push(mo); g.add(mo);
  }

  g.userData.anim = (grp, now) => {
    // wraith-arms reach & drift, claws flaring brightest
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      const ph = a.userData.ph;
      a.rotation.z = a.userData.baseZ + Math.sin(now / 700 + ph) * 0.16;
      a.rotation.y = a.userData.baseY + Math.sin(now / 900 + ph) * 0.18;
      a.userData.elbow.rotation.z = a.userData.dir * (0.3 + Math.sin(now / 520 + ph) * 0.3);
      const fl = 0.8 + Math.sin(now / 280 + ph) * 0.2;
      a.userData.upMat.opacity = 0.5 * fl;
      a.userData.foreMat.opacity = 0.6 * fl;
      a.userData.clawMat.opacity = 0.85 * (0.85 + Math.sin(now / 220 + ph) * 0.15);
    }
    // core pulses (the bright heart)
    const cp = 0.85 + Math.sin(now / 360) * 0.15;
    coreMat.opacity = 0.95 * cp;
    coreInnerMat.opacity = 1.0 * (0.8 + Math.sin(now / 240) * 0.2);
    const cs = 1 + Math.sin(now / 360) * 0.12;
    core.scale.set(cs, 1.5 * cs, 0.8);
    // tatters wave and breathe
    for (let i = 0; i < tatters.length; i++) {
      const piv = tatters[i];
      piv.rotation.z = Math.sin(now / 540 + piv.userData.ph) * 0.18;
      piv.rotation.x = Math.sin(now / 720 + piv.userData.ph) * 0.08;
      const flick = 0.78 + Math.sin(now / 300 + piv.userData.ph) * 0.22;
      piv.userData.baseMat.opacity = piv.userData.baseOp * flick;
    }
    shroudMat.opacity = 0.2 * (0.8 + Math.sin(now / 400) * 0.2);
    // motes rise behind the back and recycle to the bottom
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const t = ((now / 1400) + i / motes.length) % 1;
      const ang = mo.userData.ph + now / 900;
      mo.position.set(
        Math.cos(ang) * mo.userData.rad,
        -0.5 + t * 0.75,
        -0.12 + Math.sin(ang) * mo.userData.rad
      );
      mo.material.opacity = 0.8 * Math.sin(t * Math.PI);
      mo.scale.setScalar(0.7 + Math.sin(t * Math.PI) * 0.6);
    }
    if (prismatic) {
      const hue = (now / 2200) % 1;
      for (let i = 0; i < wispMats.length; i++) {
        wispMats[i].color.setHSL((hue + i * 0.04) % 1, 0.7, 0.65);
      }
    }
  };
  return g;
}

export function buildGear_crown(opts) {
  // Strengthened: taller bolder spikes, a brighter double-band, and a big glowing
  // front jewel backed by an additive halo plate so the crown reads as a bright
  // signature shape at tiny on-glasses render size.
  const c = (opts && opts.color) || '#ffd166';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // Sits just above the head (headMount). Regal spiked band, facing +Z.
  const lift = 0.06;

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

  // Solid metal band base (opaque mass, reads as the crown body) + a bright
  // glowing trim ring above and below it for a strong horizontal stroke.
  const band = m(cyl(0.165, 0.175, 0.085, 10), mat(c, 0.5));
  band.position.y = lift + 0.04;
  g.add(band);
  const trimGeo = geo('crownTrim', () => new T.TorusGeometry(0.172, 0.022, 4, 14));
  const trimTop = m(trimGeo, glowMat(0.95));
  trimTop.rotation.x = Math.PI / 2; trimTop.position.y = lift + 0.082;
  const trimBot = m(trimGeo, glowMat(0.8));
  trimBot.rotation.x = Math.PI / 2; trimBot.position.y = lift + 0.0;
  g.add(trimTop, trimBot);

  // Bold alternating tall/short spikes around the band — taller and brighter
  // than before so the silhouette spikes read clearly.
  const N = 8;
  const tips = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const big = (i % 2 === 0);
    const h = big ? 0.28 : 0.16;
    const r = big ? 0.05 : 0.038;
    const sp = m(cone(r, h, 4), glowMat(0.95));
    sp.position.set(Math.cos(a) * 0.165, lift + 0.085 + h / 2, Math.sin(a) * 0.165);
    g.add(sp);
    // A bright gem bead at the base of every tall spike.
    if (big) {
      const gem = m(geo('crownGem', () => new T.OctahedronGeometry(0.032, 0)), glowMat(1));
      gem.position.set(Math.cos(a) * 0.165, lift + 0.1, Math.sin(a) * 0.165);
      g.add(gem);
      tips.push(gem);
    }
  }

  // The signature: a BIG bright front jewel backed by an additive halo plate so
  // it glows as the crown's focal point even when tiny.
  const halo = m(geo('crownHalo', () => new T.CircleGeometry(0.075, 12)), glowMat(0.45));
  halo.position.set(0, lift + 0.1, 0.178);
  g.add(halo);
  const jewel = m(geo('crownJewel', () => new T.OctahedronGeometry(0.062, 0)), glowMat(1));
  jewel.position.set(0, lift + 0.1, 0.185);
  jewel.scale.set(1, 1.5, 0.6);
  g.add(jewel);
  tips.push(jewel);

  if (prism) {
    g.userData.anim = (grp, now) => {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.04) % 1, 0.85, 0.62);
      }
      const p = 1 + Math.sin(now / 300) * 0.14;
      for (let i = 0; i < tips.length; i++) tips[i].scale.setScalar(p);
      jewel.scale.set(p, p * 1.5, p * 0.6);
    };
  } else {
    g.userData.anim = (grp, now) => {
      const p = 1 + Math.sin(now / 360) * 0.12;
      for (let i = 0; i < tips.length; i++) tips[i].scale.setScalar(p);
      jewel.scale.set(p, p * 1.5, p * 0.6);
    };
  }
  return g;
}

export function buildGear_halo(opts) {
  // Strengthened: bolder/brighter thick primary ring + radiant inner glow disc + a crown of
  // bright vertical light-spokes for an unmistakable halo silhouette; keeps gentle rotation.
  const c = (opts && opts.color) || '#9be8ff';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // HEAD cosmetic: floats just above the head (small +Y).
  const y = 0.13;

  // Unique materials we mutate per-frame (prismatic shimmer + a gentle global pulse).
  // These MUST be fresh instances (never cached mat/matAdd) since we set .color/.opacity each frame.
  const shimmer = [];
  const pulsers = [];
  function glowMat(opacity, animatePulse) {
    const op = opacity == null ? 1 : opacity;
    const u = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
    if (prism) shimmer.push(u);
    if (animatePulse) pulsers.push({ mat: u, base: op });
    return u;
  }

  // BRIGHT inner glow disc — gives the halo a solid radiant core that reads at distance.
  const disc = m(geo('haloGlowDisc', () => new T.CircleGeometry(0.165, 28)), glowMat(0.32, true));
  disc.rotation.x = -Math.PI / 2; disc.position.y = y - 0.004;
  g.add(disc);

  // Main glowing ring — thick + round (many segments) so the band is BOLD and clean.
  const ring = m(geo('haloRingMain', () => new T.TorusGeometry(0.205, 0.034, 10, 40)), glowMat(1.0, true));
  ring.rotation.x = Math.PI / 2; ring.position.y = y;
  g.add(ring);

  // Bright thin highlight ring sitting on the main band — sharpens the edge, adds pop.
  const ringHi = m(geo('haloRingHi', () => new T.TorusGeometry(0.205, 0.013, 8, 40)), glowMat(0.95));
  ringHi.rotation.x = Math.PI / 2; ringHi.position.y = y + 0.006;
  g.add(ringHi);

  // Outer faint aura ring for depth/drama.
  const ring2 = m(geo('haloRingAura', () => new T.TorusGeometry(0.275, 0.016, 6, 32)), glowMat(0.45, true));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = y + 0.004;
  g.add(ring2);

  // Crown of bright vertical light-spokes radiating up from the ring — iconic, reads boldly.
  const spokes = [];
  const S = prism ? 10 : 8;
  const SR = 0.205;
  for (let i = 0; i < S; i++) {
    const a = (i / S) * Math.PI * 2;
    const sp = m(box(0.018, 0.09, 0.018), glowMat(0.9));
    sp.position.set(Math.cos(a) * SR, y + 0.05, Math.sin(a) * SR);
    sp.userData.a = a;
    g.add(sp); spokes.push(sp);
  }

  // Bright angular motes orbiting on the halo plane.
  const motes = [];
  const M = prism ? 8 : 6;
  const R = 0.245;
  for (let i = 0; i < M; i++) {
    const a = (i / M) * Math.PI * 2;
    const mo = m(geo('haloMoteOcta', () => new T.OctahedronGeometry(0.026, 0)), glowMat(1.0));
    mo.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
    mo.userData.a = a;
    g.add(mo); motes.push(mo);
  }

  g.userData.anim = (grp, now) => {
    const spin = now / 1400;
    ring.rotation.z = spin;
    ringHi.rotation.z = spin;
    ring2.rotation.z = -spin * 0.7;
    disc.rotation.z = spin * 0.4;
    for (let i = 0; i < spokes.length; i++) {
      const a = spokes[i].userData.a + spin;
      spokes[i].position.x = Math.cos(a) * SR;
      spokes[i].position.z = Math.sin(a) * SR;
      spokes[i].position.y = y + 0.05 + Math.sin(now / 360 + i) * 0.012;
    }
    for (let i = 0; i < motes.length; i++) {
      const a = motes[i].userData.a - spin * 1.3;
      motes[i].position.x = Math.cos(a) * R;
      motes[i].position.z = Math.sin(a) * R;
      motes[i].position.y = y + Math.sin(now / 320 + i) * 0.022;
    }
    // Gentle breathing pulse keeps the halo feeling alive/bright.
    const pulse = 0.85 + Math.sin(now / 520) * 0.15;
    for (let i = 0; i < pulsers.length; i++) {
      pulsers[i].mat.opacity = pulsers[i].base * pulse;
    }
    if (prism) {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.04) % 1, 0.85, 0.62);
      }
    }
  };
  return g;
}

// Strengthened: bigger blockier pauldrons with a bright outer rim + crowning horn, fatter glowing spine rune and a larger pulsing back crest — reads bold & bright at glasses scale.
export function buildGear_plate(opts) {
  const c = (opts && opts.color) || '#5f7d96';
  const prism = !!(opts && opts.prismatic);
  const g = new T.Group();
  // Mounted at the upper-back (backMount). Heavy ornate pauldrons spread over
  // the shoulders (+/-X) and a tall back ridge runs up the spine (-Z).
  const armor = mat(c, 0.55);
  const armorDark = mat(c, 0.32);

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

  const trims = [];
  // Big, blocky faceted pauldrons that beef up the shoulder silhouette, ringed
  // by a bright additive rim and crowned with an outward horn.
  function pauldron(side) {
    const grp = new T.Group();
    grp.position.set(0.36 * side, 0.16, 0.08);
    grp.rotation.z = side * 0.18;
    // Bulky two-tier shoulder mass (bigger = stronger silhouette).
    const dome = m(cone(0.28, 0.30, 5), armor); dome.position.y = 0.06;
    const base = m(box(0.40, 0.16, 0.40), armorDark); base.position.y = -0.07;
    // Bright outer rim ring that traces the whole shoulder edge — the pop.
    const rim = m(geo('plateRim', () => new T.TorusGeometry(0.24, 0.035, 4, 12)), glowMat(0.95));
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.02; rim.scale.set(1, 1, 0.9);
    trims.push(rim);
    // One bold outward horn instead of fussy little spikes.
    const horn = m(cone(0.07, 0.34, 4), armor);
    horn.position.set(0.20 * side, 0.10, 0); horn.rotation.z = side * 1.35;
    const hornGlow = m(geo('plateHornTip', () => new T.OctahedronGeometry(0.05, 0)), glowMat(1));
    hornGlow.position.set(0.30 * side, 0.21, 0); trims.push(hornGlow);
    // Big bright gem set on the cap face.
    const gem = m(geo('plateGem', () => new T.OctahedronGeometry(0.07, 0)), glowMat(1));
    gem.position.set(0, 0.10, 0.20); gem.scale.set(1, 1.3, 0.7); trims.push(gem);
    grp.add(dome, base, rim, horn, hornGlow, gem);
    return grp;
  }
  g.add(pauldron(-1), pauldron(1));

  // Tall ornate back ridge running up the spine, leaning back (-Z).
  const ridgeBase = m(box(0.20, 0.44, 0.14), armorDark); ridgeBase.position.set(0, 0.06, -0.06);
  g.add(ridgeBase);
  const fins = [];
  for (let i = 0; i < 4; i++) {
    const fin = m(cone(0.07 + i * 0.008, 0.22 + i * 0.06, 4), armor);
    fin.position.set(0, -0.02 + i * 0.13, -0.11 - i * 0.035);
    fin.rotation.x = -0.45;
    g.add(fin); fins.push(fin);
  }
  // Fat glowing rune bar down the central ridge.
  const rune = m(box(0.07, 0.50, 0.03), glowMat(0.95));
  rune.position.set(0, 0.12, -0.005); rune.rotation.x = -0.1;
  trims.push(rune);
  g.add(rune);
  // A large crowning back crest at the top of the ridge.
  const crownGem = m(geo('plateBackGem', () => new T.OctahedronGeometry(0.10, 0)), glowMat(1));
  crownGem.position.set(0, 0.50, -0.20); crownGem.scale.set(1, 1.5, 0.6);
  trims.push(crownGem);
  g.add(crownGem);

  if (prism) {
    g.userData.anim = (grp, now) => {
      const base = (now / 2600) % 1;
      for (let i = 0; i < shimmer.length; i++) {
        shimmer[i].color.setHSL((base + i * 0.03) % 1, 0.85, 0.6);
      }
      const p = 1 + Math.sin(now / 320) * 0.12;
      crownGem.scale.set(p, p * 1.5, p * 0.6);
    };
  } else {
    g.userData.anim = (grp, now) => {
      const p = 1 + Math.sin(now / 380) * 0.1;
      crownGem.scale.set(p, p * 1.5, p * 0.6);
    };
  }
  return g;
}

// Strengthened: bigger, brighter chest sigil with a bold glowing halo-ring + double-layer core, and taller swept shoulder pauldron spikes that punch the silhouette.
export function buildArmorKit(opts) {
  const tier = (opts && opts.tier) || 0;
  const c = (opts && opts.color) || '#c8d0e0';
  const prismatic = !!(opts && opts.prismatic);
  const g = new T.Group();

  // tier < 2 -> nothing; the base cuirass already covers the look.
  if (tier < 2) return g;

  // Authored to sit on the chest/front: around y 0.6..1.0, z ~0.18 front.
  // ADDITIVE display: no black fills, no opaque depth-writing plates over glows.
  // BOLD strokes only — big bright emblem + a clear halo + tall shoulder spikes.

  if (tier === 2) {
    // a bolder glowing chest gem: bright core over a dim faceted setting + a glint cross.
    const setting = m(box(0.15, 0.18, 0.05), matAdd(c, 0.3));
    setting.position.set(0, 0.82, 0.17);
    const halo = m(box(0.13, 0.13, 0.04), matAdd(c, 0.22));
    halo.position.set(0, 0.82, 0.18); halo.rotation.z = 0.785;
    const gem = m(geo('kitGem', () => new T.OctahedronGeometry(0.085, 0)), matAdd(c, 1.0));
    gem.position.set(0, 0.82, 0.21); gem.scale.set(1, 1.25, 0.7);
    const glint = m(box(0.3, 0.022, 0.022), matAdd(c, 0.5)); glint.position.set(0, 0.82, 0.19);
    g.add(setting, halo, glint, gem);
    g.userData.anim = (gr, now) => {
      const p = 1 + Math.sin(now / 360) * 0.16;
      gem.scale.set(p, p * 1.25, p * 0.7);
    };
    return g;
  }

  // tier >= 3: a bold ornate emblem on the chest + big shoulder spikes.
  // Prismatic (tier 4) uses UNIQUE animated mats; otherwise cached additive.
  const mkMat = (hex, op) => prismatic
    ? new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op == null ? 0.95 : op, blending: T.AdditiveBlending, depthWrite: false })
    : matAdd(hex, op == null ? 0.95 : op);

  const emblemMat = mkMat(c, 1.0);
  const coreMat = mkMat(c, 0.55);
  const ringMat = mkMat(c, 0.45);
  const spikeMat = mkMat(c, 0.95);
  const crestMat = mkMat(c, 0.55);

  // central emblem — a big bright faceted diamond, layered over a softer aura
  // for a punchy two-tone glow that reads as a single bold sigil.
  const aura = m(geo('kitAura', () => new T.OctahedronGeometry(0.15, 0)), coreMat);
  aura.position.set(0, 0.86, 0.17); aura.scale.set(1, 1.35, 0.45);
  const emblem = m(geo('kitEmblem', () => new T.OctahedronGeometry(0.11, 0)), emblemMat);
  emblem.position.set(0, 0.86, 0.2); emblem.scale.set(1, 1.35, 0.6);

  // bold halo: a diamond ring frame + a long glint cross radiating out.
  const ring = m(geo('kitRing', () => new T.TorusGeometry(0.16, 0.018, 4, 4)), ringMat);
  ring.position.set(0, 0.86, 0.18); ring.rotation.z = 0.785;
  const glintH = m(box(0.4, 0.03, 0.03), ringMat); glintH.position.set(0, 0.86, 0.19);
  const glintV = m(box(0.03, 0.34, 0.03), ringMat); glintV.position.set(0, 0.86, 0.19);

  // glowing wing-plates framing the emblem for an ornate gothic crest.
  const crestL = m(cone(0.06, 0.22, 4), crestMat); crestL.position.set(-0.15, 0.86, 0.16); crestL.rotation.z = 1.45;
  const crestR = m(cone(0.06, 0.22, 4), crestMat); crestR.position.set(0.15, 0.86, 0.16); crestR.rotation.z = -1.45;
  g.add(aura, ring, crestL, crestR, glintH, glintV, emblem);

  // shoulder spikes — taller, swept up/out to punch the silhouette, each backed
  // by a short bright stub for a layered pauldron read.
  const spL = m(cone(0.06, 0.28, 4), spikeMat); spL.position.set(-0.35, 0.96, 0); spL.rotation.z = 0.4;
  const spR = m(cone(0.06, 0.28, 4), spikeMat); spR.position.set(0.35, 0.96, 0); spR.rotation.z = -0.4;
  const stubL = m(cone(0.05, 0.16, 4), crestMat); stubL.position.set(-0.31, 0.92, 0.05); stubL.rotation.z = 0.65;
  const stubR = m(cone(0.05, 0.16, 4), crestMat); stubR.position.set(0.31, 0.92, 0.05); stubR.rotation.z = -0.65;
  g.add(spL, spR, stubL, stubR);

  g.userData.anim = (gr, now) => {
    const p = 1 + Math.sin(now / 340) * 0.14;
    emblem.scale.set(p, p * 1.35, p * 0.6);
    const a = 1 + Math.sin(now / 340 + 1.2) * 0.1;
    aura.scale.set(a, a * 1.35, a * 0.45);
    if (prismatic) {
      const hue = (now / 2000) % 1;
      emblemMat.color.setHSL(hue, 0.9, 0.62);
      coreMat.color.setHSL((hue + 0.5) % 1, 0.85, 0.6);
      ringMat.color.setHSL((hue + 0.5) % 1, 0.85, 0.6);
      spikeMat.color.setHSL((hue + 0.25) % 1, 0.85, 0.62);
      crestMat.color.setHSL((hue + 0.75) % 1, 0.85, 0.58);
    }
  };
  return g;
}

// legendary / mythic character aura — a glowing ground ring + rising motes at the
// feet. tier 3 = bold single ring; tier 4 (prismatic) = double ring + more motes that
// shimmer through the rainbow. Uses UNIQUE materials (animated per-frame).
export function buildAura(opts) {
  // STRENGTHENED: bold bright footprint disc + thick double ring + radiating spokes; stronger ground-glow pulse, motes kept.
  const o = opts || {};
  const c = o.color || '#ff8c42';
  const prism = !!o.prismatic;
  const g = new T.Group();
  const mk = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const tinted = [];                                  // unique mats to hue-cycle when prismatic

  // Wide bright footprint glow — the BIG bold silhouette read on the ground.
  const discMat = mk(c, 0.4);
  const disc = m(geo('auraDisc', () => new T.CircleGeometry(0.62, 36)), discMat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.012;
  g.add(disc); tinted.push(discMat);

  // Thick bold primary ring — the iconic outline.
  const ringMat = mk(c, 0.95);
  const ring = m(geo('auraRing', () => new T.TorusGeometry(0.52, 0.055, 6, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  g.add(ring); tinted.push(ringMat);

  // Inner counter ring (always — adds depth, not just prismatic).
  const ring2Mat = mk(c, 0.7);
  const ring2 = m(geo('auraRing2', () => new T.TorusGeometry(0.34, 0.035, 6, 28)), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.028;
  g.add(ring2); tinted.push(ring2Mat);

  // Radiating spokes — bright tapered prisms that point outward, sharpening the energy footprint.
  const spokes = [];
  const nS = 8;
  const spokeGeo = geo('auraSpoke', () => new T.ConeGeometry(0.04, 0.42, 4));
  for (let i = 0; i < nS; i++) {
    const sm = mk(c, 0.8);
    const sp = m(spokeGeo, sm);
    const a = (i / nS) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.4, 0.03, Math.sin(a) * 0.4);
    sp.rotation.z = Math.PI / 2;                      // lay flat, pointing outward
    sp.rotation.y = -a;
    g.add(sp); tinted.push(sm);
    spokes.push({ mesh: sm, base: i / nS });
  }

  // Rising energy motes (kept from original signature feel).
  const motes = [];
  const nM = prism ? 9 : 6;
  const moteGeo = geo('auraMote', () => new T.IcosahedronGeometry(0.045, 0));
  for (let i = 0; i < nM; i++) {
    const mm = mk(c, 0.9);
    const mo = m(moteGeo, mm);
    const a = (i / nM) * Math.PI * 2;
    mo.position.set(Math.cos(a) * 0.42, 0.05, Math.sin(a) * 0.42);
    g.add(mo); tinted.push(mm);
    motes.push({ mesh: mo, a, base: i / nM });
  }

  g.userData.anim = (grp, now) => {
    // Strong shared pulse for the bright footprint glow.
    const pulse = 0.78 + 0.22 * Math.sin(now / 380);
    ring.material.opacity = 0.95 * pulse;
    ring2.material.opacity = 0.7 * pulse;
    discMat.opacity = 0.4 * (0.7 + 0.3 * Math.sin(now / 420));
    const s = 0.97 + 0.05 * Math.sin(now / 380);
    disc.scale.set(s, s, s);

    ring.rotation.z = now / 1600;
    ring2.rotation.z = -now / 1200;

    // Spokes shimmer + slow spin of the whole footprint plane.
    g.rotation.y = now / 5200;
    for (let i = 0; i < spokes.length; i++) {
      spokes[i].mesh.opacity = 0.8 * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 300 + spokes[i].base * Math.PI * 2)));
    }

    // Rising, recycling motes.
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i];
      const t = ((now / 1400) + mt.base) % 1;         // rise + recycle
      mt.mesh.position.set(Math.cos(mt.a + now / 2000) * 0.42, 0.05 + t * 0.95, Math.sin(mt.a + now / 2000) * 0.42);
      mt.mesh.material.opacity = 0.9 * (1 - t);
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
  // central emblem ridge (vertical keel) + glowing emblem (bold cross sigil)
  const ridge = m(box(0.10,0.44,0.10), steel);     ridge.position.set(0,0.84,0.205);  g.add(ridge);
  const emblem = m(box(0.16,0.26,0.06), trimMat);  emblem.position.set(0,0.90,0.24);  g.add(emblem);
  const emblemBar = m(box(0.30,0.07,0.05), trimMat); emblemBar.position.set(0,0.86,0.24); g.add(emblemBar);
  const emblemGem = m(cone(0.08,0.12,4), trimMat); emblemGem.position.set(0,0.99,0.25); emblemGem.rotation.x = Math.PI/2; g.add(emblemGem);
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
  // HORNS (sweeping out + up, three cones each) — bigger, more dramatic helm crown
  function horn(side){
    const grp = new T.Group(); grp.position.set(side*0.15,0.20,0);
    const base = m(cone(0.08,0.22,4), steel);   base.position.set(side*0.07,0.05,0); base.rotation.z=side*-1.0; grp.add(base);
    const mid  = m(cone(0.06,0.22,4), bodyMat);  mid.position.set(side*0.21,0.16,0); mid.rotation.z=side*-0.55; grp.add(mid);
    const tip  = m(cone(0.04,0.20,4), bodyMat);  tip.position.set(side*0.34,0.34,0); tip.rotation.z=side*-0.15; grp.add(tip);
    const tipRune = m(cone(0.025,0.10,4), trimMat); tipRune.position.set(side*0.40,0.46,0); tipRune.rotation.z=side*-0.10; grp.add(tipRune);
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
  // crowning arcane gem at the hood tip — a bright top accent that anchors the wizard read
  const hoodGem = m(geo('mage_hoodgem', ()=>cone(0.075, 0.18, 4)), trimMat);
  hoodGem.position.set(0, 1.74, -0.08); hoodGem.rotation.x = -0.12; g.add(hoodGem);
  const hoodGemCore = m(geo('mage_hoodgemcore', ()=>box(0.06,0.06,0.06)), eyeMat);
  hoodGemCore.position.set(0, 1.70, -0.07); g.add(hoodGemCore);

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
  // glowing focus stone set into the sash (chest front) — bold diamond that reads small
  const focus = m(geo('mage_focus', ()=>box(0.15, 0.17, 0.06)), trimMat);
  focus.position.set(0.04, 0.78, 0.215);
  focus.rotation.z = 0.78; // diamond
  g.add(focus);
  const focusCore = m(geo('mage_focuscore', ()=>box(0.07,0.08,0.07)), eyeMat);
  focusCore.position.set(0.04, 0.78, 0.235); focusCore.rotation.z = 0.78; g.add(focusCore);

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
  // BRIGHT glowing rune line down each strap so the chest-X reads at small render size
  const strapGlowA = m(box(0.028,0.50,0.05), trimMat); strapGlowA.position.set(0,0.86,0.15); strapGlowA.rotation.z = 0.42; g.add(strapGlowA);
  const strapGlowB = m(box(0.028,0.50,0.05), trimMat); strapGlowB.position.set(0,0.86,0.15); strapGlowB.rotation.z = -0.42; g.add(strapGlowB);
  // small glowing harness clasp where straps cross
  const clasp = m(box(0.085,0.085,0.04), trimMat); clasp.position.set(0,0.86,0.17); g.add(clasp);
  // pointed leather shoulder caps — a touch more shoulder line on the lean frame
  const capL = m(cone(0.10,0.16,4), bodyMat); capL.position.set(-0.27,1.06,0); capL.rotation.z = 0.6; g.add(capL);
  const capR = m(cone(0.10,0.16,4), bodyMat); capR.position.set( 0.27,1.06,0); capR.rotation.z =-0.6; g.add(capR);
  const capGlowR = m(box(0.10,0.022,0.13), trimMat); capGlowR.position.set(0.27,1.0,0.01); g.add(capGlowR);

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
  // sharp forward hood point — a crisp, instantly-readable archer-hood silhouette
  const hoodTip = m(cone(0.11,0.26,4), bodyMat); hoodTip.position.set(0,1.31,0.05); hoodTip.rotation.x = 0.55; g.add(hoodTip);
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
  // BOLD shoulder bone-horns (jut up & out) — gives the small-render silhouette a
  // strong, instantly-readable necromancer shoulder line.
  const shoulderHorn = geo('summShoulderHorn', ()=>cone(0.10,0.40,4));
  const shL = m(shoulderHorn, bone); shL.position.set(-0.34,1.02,0.02); shL.rotation.z = 0.7; g.add(shL);
  const shR = m(shoulderHorn, bone); shR.position.set( 0.34,1.02,0.02); shR.rotation.z =-0.7; g.add(shR);
  const shTipL = m(geo('summHornRune', ()=>cone(0.05,0.12,4)), trimMat); shTipL.position.set(-0.50,1.16,0.02); shTipL.rotation.z = 0.7; g.add(shTipL);
  const shTipR = m(geo('summHornRune', ()=>cone(0.05,0.12,4)), trimMat); shTipR.position.set( 0.50,1.16,0.02); shTipR.rotation.z =-0.7; g.add(shTipR);

  // ================= SKELETAL CHEST / RIB ACCENTS =================
  // Exposed ribcage over the robe front (glowing accent bones). BOLD so it reads
  // as the iconic necromancer chest even at small on-glasses render size.
  const ribGeo = geo('summRib', ()=>box(0.34,0.055,0.06));
  for(let i=0;i<5;i++){
    const ry = 0.58 + i*0.072;
    const rib = m(ribGeo, trimMat);
    rib.position.set(0, ry, 0.20);
    rib.scale.x = 1 - i*0.11; // taper toward bottom (chest -> belly)
    rib.rotation.z = 0; g.add(rib);
  }
  // bright sternum/spine column down the chest
  const sternum = m(geo('summSternum', ()=>box(0.055,0.40,0.06)), trimMat);
  sternum.position.set(0,0.73,0.205); g.add(sternum);

  // ================= HEAD: BONE SKULL HALF-MASK =================
  const headGroup = new T.Group(); g.add(headGroup);
  // Hooded shadow behind skull (dark cowl framing)
  const cowl = m(geo('summCowl', ()=>cone(0.22,0.40,6)), bodyMat);
  cowl.position.y = 1.22; cowl.rotation.y = Math.PI/6; headGroup.add(cowl);
  const cowlShadow = m(geo('summCowlInner', ()=>cyl(0.135,0.155,0.22,6)), dark);
  cowlShadow.position.set(0,1.16,0.04); headGroup.add(cowlShadow);

  // Skull cranium (bone, opaque) — enlarged so the face anchors the silhouette
  const skull = m(geo('summSkull', ()=>box(0.23,0.24,0.21)), bone);
  skull.position.set(0,1.15,0.06); headGroup.add(skull);
  // angular jaw / lower face
  const jaw = m(geo('summJaw', ()=>box(0.18,0.10,0.17)), bone);
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
// Goblin: bolder hunched silhouette, oversized ears/nose, pulsing beady eyes + clutched glowing dagger and coin sack.
export function buildEnemy_goblin(opts) {
  const c = (opts && opts.color) || '#ffd24a';
  const g = new T.Group();
  const skin = mat('#6f9442'), skinDark = mat('#3c5320'), cloth = mat('#5a3c22'), sack = mat('#6b4a2a');
  const gold = matAdd(c, 0.95);
  // unique animated additive materials (eyes + dagger edge throb) — must NOT use shared cache
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color('#ffe24a'), transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const bladeMat = new T.MeshBasicMaterial({ color: new T.Color('#bfe9ff'), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });

  // --- legs (short, bowed) ---
  const lL = m(box(0.11, 0.2, 0.12), skinDark); lL.position.set(-0.11, 0.1, 0); lL.rotation.z = 0.12;
  const rL = m(box(0.11, 0.2, 0.12), skinDark); rL.position.set(0.11, 0.1, 0); rL.rotation.z = -0.12;
  const lF = m(box(0.13, 0.06, 0.18), skinDark); lF.position.set(-0.12, 0.03, 0.04);
  const rF = m(box(0.13, 0.06, 0.18), skinDark); rF.position.set(0.12, 0.03, 0.04);

  // --- hunched torso: forward-leaning chest + big tapered back hump ---
  const body = m(box(0.36, 0.32, 0.3), skin); body.position.set(0, 0.36, 0.04); body.rotation.x = 0.42;
  const belly = m(box(0.3, 0.18, 0.22), skin); belly.position.set(0, 0.26, 0.14); belly.rotation.x = 0.3;
  const loin = m(box(0.32, 0.14, 0.26), cloth); loin.position.set(0, 0.2, 0.05);
  const hump = m(cone(0.26, 0.34, 5), skin); hump.position.set(0, 0.52, -0.16); hump.rotation.x = -0.5;

  // --- coin sack slung on the hump ---
  const bag = m(geo('gobBag', () => new T.IcosahedronGeometry(0.22, 0)), sack); bag.position.set(0.04, 0.58, -0.24); bag.scale.set(1, 1.2, 1);
  const tie = m(box(0.1, 0.07, 0.1), cloth); tie.position.set(0.04, 0.74, -0.22);
  const coin1 = m(geo('gobCoin', () => new T.OctahedronGeometry(0.055, 0)), gold); coin1.position.set(-0.04, 0.8, -0.2);
  const coin2 = m(geo('gobCoin', () => new T.OctahedronGeometry(0.055, 0)), gold); coin2.position.set(0.1, 0.83, -0.25);

  // --- head thrust forward & low (hunched) ---
  const neck = m(box(0.12, 0.1, 0.12), skin); neck.position.set(0, 0.5, 0.14);
  const head = m(box(0.26, 0.22, 0.24), skin); head.position.set(0, 0.56, 0.22);
  const brow = m(box(0.26, 0.07, 0.1), skinDark); brow.position.set(0, 0.62, 0.32);

  // --- oversized swept-back ears ---
  const earL = m(cone(0.08, 0.28, 4), skin); earL.position.set(-0.2, 0.6, 0.14); earL.rotation.set(0, 0, 1.15); earL.rotation.x = -0.4;
  const earR = m(cone(0.08, 0.28, 4), skin); earR.position.set(0.2, 0.6, 0.14); earR.rotation.set(0, 0, -1.15); earR.rotation.x = -0.4;

  // --- long hooked nose ---
  const nose = m(cone(0.06, 0.2, 4), skin); nose.position.set(0, 0.54, 0.38); nose.rotation.x = 1.9;

  // --- bright beady eyes + sharp grin ---
  const eyeL = m(box(0.06, 0.06, 0.04), eyeMat); eyeL.position.set(-0.07, 0.6, 0.34);
  const eyeR = m(box(0.06, 0.06, 0.04), eyeMat); eyeR.position.set(0.07, 0.6, 0.34);
  const grin = m(box(0.15, 0.035, 0.03), matAdd('#ffffff', 0.85)); grin.position.set(0, 0.49, 0.35);

  // --- arms: clutching the dagger forward ---
  const lA = m(box(0.08, 0.3, 0.08), skinDark); lA.position.set(-0.22, 0.36, 0.16); lA.rotation.x = 0.9;
  const rA = m(box(0.08, 0.3, 0.08), skinDark); rA.position.set(0.22, 0.36, 0.16); rA.rotation.x = 0.9;
  const fistR = m(box(0.1, 0.1, 0.1), skinDark); fistR.position.set(0.22, 0.32, 0.34);

  // --- clutched dagger (group so it can be brandished) ---
  const dag = new T.Group(); dag.position.set(0.22, 0.32, 0.34);
  const hilt = m(box(0.04, 0.12, 0.04), cloth); hilt.position.set(0, 0, 0);
  const guard = m(box(0.14, 0.04, 0.05), gold); guard.position.set(0, 0.07, 0);
  const blade = m(cone(0.05, 0.3, 4), bladeMat); blade.position.set(0, 0.24, 0); 
  dag.add(hilt, guard, blade); dag.rotation.x = -0.5;

  g.add(lL, rL, lF, rF, body, belly, loin, hump, bag, tie, coin1, coin2,
        neck, head, brow, earL, earR, nose, eyeL, eyeR, grin, lA, rA, fistR, dag);

  g.userData.anim = (grp, now) => {
    const j = Math.sin(now / 90) * 0.045;          // creeping crouch-bob
    const sway = Math.sin(now / 140) * 0.06;
    body.position.y = 0.36 + j; belly.position.y = 0.26 + j;
    head.position.y = 0.56 + j; head.rotation.y = sway;
    brow.position.y = 0.62 + j; neck.position.y = 0.5 + j;
    eyeL.position.y = 0.6 + j; eyeR.position.y = 0.6 + j;
    nose.position.y = 0.54 + j; grin.position.y = 0.49 + j;
    hump.position.y = 0.52 + j;
    bag.position.y = 0.58 + Math.sin(now / 120) * 0.03;
    coin1.position.y = 0.8 + Math.sin(now / 100) * 0.02;
    coin2.position.y = 0.83 + Math.sin(now / 100 + 1) * 0.02;
    dag.position.y = 0.32 + j; dag.rotation.x = -0.5 + Math.sin(now / 110) * 0.18; // little jabs
    fistR.position.y = 0.32 + j;
    const pulse = 0.7 + Math.abs(Math.sin(now / 130)) * 0.3;
    eyeMat.opacity = pulse; bladeMat.opacity = 0.6 + Math.abs(Math.sin(now / 160)) * 0.4;
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

// =============================================================
// SKILL CAST ANIMATIONS
// CAST_ANIMS[id](prog, pm, ud, now, moving): drive the PLAYER RIG for a cast.
//   prog 0..1 over the cast. pm = player Group (its rotation.y is preset to facing
//   each frame — OVERRIDE it for spins, or leave it and use rotation.x/z for lean/pitch).
//   pm.position.y += dy  (a bob is already applied; add to it for hops/crouch).
//   pm.scale for pulses. ud.arms[0,1] (shoulders; legged AND robed classes have arms),
//   ud.legs[0,1] (ONLY warrior+ranger — mage/summoner are robed, ud.legs is []),
//   ud.weaponMount (rotation/position — the held weapon). Reset to baseline by the engine
//   every frame, so only set what you animate. PURE TRANSFORMS — never touch
//   ud.bodyMat/trimMat/eyeMat (shared, recolored on equip).
// buildCastFx_<id>(opts{color}): a Group flourish parented to the player at its feet/origin,
//   faces +Z. Optional userData.castAnim(g, prog, now) driven by cast progress. Any material
//   whose opacity/color is animated MUST be a fresh `new T.MeshBasicMaterial` (never cached).
// =============================================================
const _TAU = Math.PI * 2;
export const CAST_ANIMS = {
  // WARRIOR — Whirlwind: 3 fast full-body spins, arms flung out level, blade swung wide.
  whirlwind: (prog, pm, ud) => {
    pm.rotation.y = prog * 3 * _TAU;                 // override facing → spin
    const env = Math.sin(prog * Math.PI);            // 0→1→0 envelope
    pm.rotation.z = env * 0.16;                      // lean into the spin
    pm.position.y += env * 0.06;                     // slight lift mid-spin
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[0].rotation.z = env * 1.25; ud.arms[1].rotation.z = -env * 1.25;
      ud.arms[0].rotation.x = 0.15; ud.arms[1].rotation.x = 0.15;
    }
    ud.weaponMount.rotation.z = -1.15; ud.weaponMount.rotation.x = 0.10;
  },
  leapslam: (prog, pm, ud) => {
  let dy = 0, pitch = 0, weapX = 0, weapY = 0, weapZ = 0, legTuck = 0, armUp = 0, sc = 1;
  if (prog < 0.3) {
    const t = prog / 0.3;
    const dip = Math.sin(Math.min(t, 0.5) / 0.5 * Math.PI * 0.5);
    const launch = t > 0.5 ? (t - 0.5) / 0.5 : 0;
    dy = -0.55 * dip * (1 - launch) + 0.9 * launch * launch;
    pitch = -0.05 - 0.18 * dip * (1 - launch) + 0.22 * launch;
    legTuck = -0.7 * dip * (1 - launch);
    armUp = -0.6 - 1.4 * t;
    sc = 1 + 0.05 * launch;
  } else if (prog < 0.6) {
    const t = (prog - 0.3) / 0.3;
    const air = Math.sin(t * Math.PI);
    dy = 0.9 + 0.55 * air;
    pitch = 0.22 - 0.1 * t;
    legTuck = 1.5 * Math.sin(Math.min(t * 1.3, 1) * Math.PI * 0.5);
    armUp = -2.0;
    weapX = -2.3;
  } else if (prog < 0.8) {
    const t = (prog - 0.6) / 0.2;
    const drive = t * t;
    dy = 0.9 * (1 - drive) - 0.35 * Math.sin(Math.min(t, 0.85) / 0.85 * Math.PI);
    pitch = -0.55 * drive;
    legTuck = 1.5 * (1 - drive) - 0.25 * drive;
    armUp = -2.0 + 2.6 * drive;
    weapX = -2.3 + 3.0 * drive;
    sc = 1 + 0.08 * Math.sin(t * Math.PI);
  } else {
    const t = (prog - 0.8) / 0.2;
    const rec = Math.sin(t * Math.PI * 0.5);
    dy = -0.35 * (1 - rec);
    pitch = -0.55 * (1 - rec);
    legTuck = -0.25 * (1 - rec);
    armUp = 0.6 * (1 - rec);
    weapX = 0.7 * (1 - rec);
  }
  pm.position.y += dy;
  pm.rotation.x = pitch;
  pm.scale.setScalar(sc);
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = armUp; ud.arms[1].rotation.x = armUp;
    ud.arms[0].rotation.z = 0.18; ud.arms[1].rotation.z = -0.18;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = legTuck; ud.legs[1].rotation.x = legTuck;
  }
  ud.weaponMount.rotation.x = weapX;
  ud.weaponMount.rotation.y = weapY;
  ud.weaponMount.rotation.z = weapZ;
},
  warcry: (prog, pm, ud, now, moving) => {
  const plant = Math.min(1, prog / 0.2);
  const swell = Math.sin(Math.min(1, prog / 0.6) * Math.PI * 0.5);
  const hold = prog > 0.25 && prog < 0.72 ? 1 : Math.max(0, 1 - Math.abs(prog - 0.48) / 0.48);
  const thrust = prog > 0.72 ? (prog - 0.72) / 0.28 : 0;
  const tEnv = Math.sin(thrust * Math.PI);
  pm.scale.setScalar(1 + swell * (0.13 + Math.sin(now * 0.022) * 0.02 * hold) - thrust * 0.05);
  pm.rotation.x = -swell * 0.34 * (1 - thrust) + tEnv * 0.42;
  pm.position.y += swell * 0.05 * (1 - thrust) - thrust * 0.04;
  pm.rotation.z = Math.sin(now * 0.03) * 0.025 * hold;
  if (ud.arms && ud.arms.length >= 2) {
    const back = -2.0 * swell * (1 - thrust) - thrust * 0.3;
    const out = 1.15 * swell * (1 - thrust * 0.6);
    ud.arms[0].rotation.x = back; ud.arms[1].rotation.x = back;
    ud.arms[0].rotation.z = out; ud.arms[1].rotation.z = -out;
    if (thrust > 0) { ud.arms[0].rotation.x = -0.4 + tEnv * 1.2; ud.arms[1].rotation.x = -0.4 + tEnv * 1.2; ud.arms[0].rotation.z = 0.5 * (1 - tEnv); ud.arms[1].rotation.z = -0.5 * (1 - tEnv); }
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 0.28 * plant; ud.legs[1].rotation.x = -0.28 * plant;
    ud.legs[0].rotation.z = 0.12 * plant; ud.legs[1].rotation.z = -0.12 * plant;
  }
},
  shieldwall: (prog, pm, ud) => {
  const set = Math.min(prog / 0.18, 1);
  const release = prog > 0.86 ? (prog - 0.86) / 0.14 : 0;
  const brace = set * (1 - release);
  const tremble = Math.sin(prog * Math.PI * 22) * 0.012 * (brace > 0.4 ? 1 : 0);
  pm.position.y -= brace * 0.26;
  pm.rotation.x = -brace * 0.2;
  pm.rotation.z = tremble;
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = brace * 0.34; ud.legs[0].rotation.z = brace * 0.26;
    ud.legs[1].rotation.x = -brace * 0.30; ud.legs[1].rotation.z = -brace * 0.26;
  }
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = -brace * 1.35;
    ud.arms[0].rotation.z = -brace * 0.55 + tremble * 3;
    ud.arms[0].rotation.y = brace * 0.45;
    ud.arms[1].rotation.x = brace * 0.55;
    ud.arms[1].rotation.z = -brace * 0.18;
  }
  ud.weaponMount.rotation.x = brace * 0.9;
  ud.weaponMount.rotation.z = -brace * 0.5;
  ud.weaponMount.position.y = -brace * 0.12;
},
  frostnova: (prog, pm, ud) => {
  const raise = Math.min(1, prog / 0.45);
  const ease = raise * raise * (3 - 2 * raise);
  const snap = prog < 0.45 ? 0 : Math.min(1, (prog - 0.45) / 0.12);
  const settle = prog < 0.57 ? 0 : (prog - 0.57) / 0.43;
  const recoil = Math.sin(snap * Math.PI) * (1 - settle * 0.6);
  pm.rotation.x = -ease * 0.18 + recoil * 0.42;
  pm.position.y += -recoil * 0.22 - ease * 0.04;
  const burst = snap < 1 ? snap : Math.max(0, 1 - (prog - 0.57) / 0.18);
  pm.scale.setScalar(1 + burst * 0.07);
  if (ud.arms && ud.arms.length >= 2) {
    const up = -ease * 2.0;
    const slam = snap * 2.7;
    const ax = up + slam;
    ud.arms[0].rotation.x = ax;
    ud.arms[1].rotation.x = ax;
    const spread = ease * 0.5 + snap * 0.55 - settle * 0.4;
    ud.arms[0].rotation.z = spread;
    ud.arms[1].rotation.z = -spread;
  }
},
  chainlightning: (prog, pm, ud, now, moving) => {
  const coil = Math.min(prog / 0.35, 1);
  const thrust = prog < 0.35 ? 0 : Math.min((prog - 0.35) / 0.25, 1);
  const cEase = coil * coil;
  const tEase = thrust < 0.5 ? 2 * thrust * thrust : 1 - Math.pow(-2 * thrust + 2, 2) / 2;
  const jolt = prog > 0.6 ? Math.sin((prog - 0.6) / 0.4 * Math.PI * 9) * Math.pow(1 - (prog - 0.6) / 0.4, 2) : 0;
  pm.rotation.x = -cEase * 0.32 * (1 - thrust) + tEase * 0.28 + jolt * 0.05;
  pm.rotation.y += cEase * 0.5 - tEase * 0.7 + (tEase > 0.85 ? (tEase - 0.85) * 1.2 : 0) + jolt * 0.08;
  pm.rotation.z = cEase * 0.12 * (1 - thrust) - jolt * 0.04;
  pm.position.y += -cEase * 0.05 * (1 - thrust) + tEase * 0.03;
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[1].rotation.x = -cEase * 0.5 * (1 - thrust) - tEase * 2.6 + jolt * 0.12;
    ud.arms[1].rotation.z = -cEase * 0.7 * (1 - thrust) + tEase * 0.5;
    ud.arms[1].rotation.y = tEase * 0.3;
    ud.arms[0].rotation.z = cEase * 0.55 * (1 - thrust) - tEase * 0.45;
    ud.arms[0].rotation.x = -tEase * 0.25;
  }
},
  meteor: (prog, pm, ud) => {
  const gather = Math.min(prog / 0.75, 1);
  const gEase = gather * gather * (3 - 2 * gather);
  const snap = prog > 0.75 ? (prog - 0.75) / 0.25 : 0;
  const sEase = snap * snap;
  pm.rotation.x = -gEase * 0.42 + sEase * 0.95;
  pm.position.y += gEase * 0.1 - sEase * 0.14;
  pm.rotation.z = Math.sin(gather * Math.PI * 4) * 0.03 * gEase * (1 - snap);
  if (ud.arms && ud.arms.length >= 2) {
    const up = -gEase * 2.7 + sEase * 4.2;
    const tremor = Math.sin(prog * 55) * 0.05 * gEase * (1 - snap);
    ud.arms[0].rotation.x = up + tremor;
    ud.arms[1].rotation.x = up - tremor;
    ud.arms[0].rotation.z = gEase * 0.22 - sEase * 0.18;
    ud.arms[1].rotation.z = -gEase * 0.22 + sEase * 0.18;
  }
},
  blinkstrike: (prog, pm, ud, now, moving) => {
  if (prog < 0.32) {
    const t = prog / 0.32;
    const e = t * t;
    pm.scale.setScalar(1 - e * 0.62);
    pm.position.y += -e * 0.28;
    pm.rotation.x = -e * 0.18;
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[0].rotation.x = e * 0.5; ud.arms[1].rotation.x = e * 0.5;
      ud.arms[0].rotation.z = e * 0.3; ud.arms[1].rotation.z = -e * 0.3;
    }
  } else {
    const t = (prog - 0.32) / 0.68;
    const burst = 1 - Math.pow(1 - t, 3);
    const flick = 1 + Math.sin(prog * 90) * 0.04 * (1 - t);
    pm.scale.setScalar((0.38 + burst * 0.62) * flick);
    pm.position.y += -0.28 * (1 - burst) + Math.sin(t * Math.PI) * 0.1;
    const lunge = Math.sin(Math.min(t * 1.4, 1) * Math.PI);
    pm.rotation.x = -0.18 - lunge * 0.42;
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[1].rotation.x = -1.5 - lunge * 0.6;
      ud.arms[1].rotation.z = -0.1;
      ud.arms[0].rotation.x = 0.6 - lunge * 0.4;
      ud.arms[0].rotation.z = 0.35;
    }
    ud.weaponMount.rotation.x = -1.7 - lunge * 0.5;
    ud.weaponMount.position.z = lunge * 0.45;
    ud.weaponMount.position.y = lunge * 0.2;
  }
},
  multishot: (prog, pm, ud) => {
  const draw = Math.min(1, prog / 0.62);
  const drawE = draw * draw * (3 - 2 * draw);
  const released = prog > 0.62;
  const rel = released ? (prog - 0.62) / 0.38 : 0;
  const snap = released ? Math.sin(Math.min(1, rel * 1.6) * Math.PI) * (1 - rel * 0.4) : 0;
  pm.rotation.y += -0.5 * drawE + snap * 0.22;
  pm.rotation.z = drawE * 0.05 - snap * 0.04;
  pm.rotation.x = -drawE * 0.05 + snap * 0.12;
  pm.position.y += -drawE * 0.03 + snap * 0.02;
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = -1.45 * drawE;
    ud.arms[0].rotation.z = 0.12 * drawE;
    ud.arms[0].rotation.y = -0.25 * drawE;
    const drawBack = 0.9 + 0.55 * drawE;
    const fwd = released ? snap * 1.7 : 0;
    ud.arms[1].rotation.x = -drawBack + fwd;
    ud.arms[1].rotation.z = -0.55 * drawE + snap * 0.3;
    ud.arms[1].rotation.y = 0.35 * drawE - snap * 0.4;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 0.25 * drawE;
    ud.legs[1].rotation.x = -0.3 * drawE;
  }
  ud.weaponMount.rotation.z = 1.5 * drawE;
  ud.weaponMount.rotation.x = -0.15 * drawE - snap * 0.2;
  ud.weaponMount.position.x = 0.1 * drawE;
},
  poisontrap: (prog, pm, ud) => {
  const k = Math.sin(prog * Math.PI);                 // 0->1->0 kneel envelope
  const down = Math.sin(Math.min(prog, 0.85) / 0.85 * Math.PI); // hold low through middle
  pm.position.y -= k * 0.42;                           // dip notably into a kneel
  pm.rotation.x = -k * 0.42;                           // lean forward over the trap
  pm.rotation.z = k * 0.05;                            // tiny weight shift
  if (ud.legs && ud.legs.length >= 2) {                // bend both legs to crouch/kneel
    ud.legs[0].rotation.x = k * 1.25;                  // front knee deep
    ud.legs[1].rotation.x = -k * 0.55;                 // back leg trails
    ud.legs[0].rotation.z = k * 0.18;
  }
  if (ud.arms && ud.arms.length >= 2) {
    const pat = 0.12 * Math.sin(prog * Math.PI * 6) * down; // small pat at the bottom
    ud.arms[0].rotation.x = down * 2.05 + pat;         // planting hand swings to ground
    ud.arms[0].rotation.z = down * 0.32;               // cross slightly inward
    ud.arms[1].rotation.x = down * 0.55;               // other arm braces on knee
    ud.arms[1].rotation.z = -down * 0.12;
  }
},
  piercingshot: (prog, pm, ud) => {
  const lunge = Math.min(1, prog / 0.55);
  const le = lunge * lunge * (3 - 2 * lunge);
  const draw = prog < 0.55 ? le : 1;
  const release = prog > 0.6 ? Math.min(1, (prog - 0.6) / 0.4) : 0;
  const re = release * release * (3 - 2 * release);
  pm.rotation.x = -0.6 * le + re * 0.12;
  pm.position.y += -0.2 * le + re * 0.05;
  pm.rotation.z = 0.05 * le * (1 - re);
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 1.05 * le + re * 0.2;
    ud.legs[1].rotation.x = -0.9 * le;
  }
  if (ud.arms && ud.arms.length >= 2) {
    const tension = draw * (1 - re);
    ud.arms[0].rotation.x = -1.35 - 0.3 * tension + re * 0.35;
    ud.arms[0].rotation.z = 0.45 * draw - re * 0.45;
    ud.arms[1].rotation.x = -0.9 + 0.55 * tension - 0.6 * re;
    ud.arms[1].rotation.z = -0.55 * draw + re * 1.0;
  }
},
  volley: (prog, pm, ud) => {
  const draw = Math.min(prog / 0.6, 1);
  const drawE = draw * draw * (3 - 2 * draw);
  const rel = prog > 0.6 ? (prog - 0.6) / 0.4 : 0;
  const relE = rel * rel * (3 - 2 * rel);
  const lean = -0.6 * drawE + 0.85 * relE;
  pm.rotation.x = lean;
  pm.position.y += -0.06 * drawE + 0.03 * relE;
  pm.rotation.z = 0.07 * Math.sin(prog * Math.PI);
  if (ud.arms && ud.arms.length >= 2) {
    const raise = -2.4 * drawE + 2.2 * relE;
    ud.arms[0].rotation.x = raise;
    ud.arms[1].rotation.x = raise;
    ud.arms[0].rotation.z = 0.4 * drawE - 0.3 * relE;
    ud.arms[1].rotation.z = -0.4 * drawE + 0.3 * relE;
    const drawPull = -0.55 * drawE * (1 - rel);
    ud.arms[1].rotation.x += drawPull;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 0.32 * drawE - 0.25 * relE;
    ud.legs[1].rotation.x = -0.32 * drawE + 0.4 * relE;
  }
  ud.weaponMount.rotation.x = -2.3 * drawE + 1.7 * relE;
  ud.weaponMount.rotation.z = 0.28 * drawE - 0.15 * relE;
},
  raisedead: (prog, pm, ud) => {
  const env = Math.sin(prog * Math.PI);                 // 0->1->0 channel envelope
  const rise = prog * prog;                              // hands climb, peak at climax
  const sway = Math.sin(prog * Math.PI * 4);            // body sways with channeled power
  pm.rotation.z = env * 0.14 * sway;                    // ritual sway side to side
  pm.rotation.x = -env * 0.10;                          // lean back, gaze upward
  pm.position.y += env * 0.05;                          // subtle channel lift
  if (ud.arms && ud.arms.length >= 2) {
    const spread = 0.45 + env * 0.95;                   // spread WIDE
    const lift = -(0.25 + rise * env * 1.55);          // raise, palms up, higher at climax
    ud.arms[0].rotation.z = spread; ud.arms[1].rotation.z = -spread;
    ud.arms[0].rotation.x = lift; ud.arms[1].rotation.x = lift;
    ud.arms[0].rotation.y = -env * 0.25; ud.arms[1].rotation.y = env * 0.25;
  }
},
  souldrain: (prog, pm, ud) => {
  const pull = 0.5 - 0.5 * Math.cos(prog * Math.PI * 2);
  const reel = (Math.sin(prog * Math.PI * 5) * 0.5 + 0.5) * (1 - prog * 0.3);
  const draw = prog;
  pm.rotation.x = (-0.18 * (1 - draw)) + (0.22 * draw) + reel * 0.04;
  pm.rotation.z = 0.05 * Math.sin(prog * Math.PI * 3);
  pm.position.y += draw * -0.05 + reel * 0.02;
  if (ud.arms && ud.arms.length >= 2) {
    const reach = -1.55 * (1 - draw) - 0.55 * draw;
    const claw = reel * 0.18;
    ud.arms[0].rotation.x = reach + claw;
    ud.arms[0].rotation.z = -0.35 - 0.5 * draw;
    ud.arms[0].rotation.y = 0.25 * draw;
    ud.arms[1].rotation.x = -0.25 - 0.2 * pull;
    ud.arms[1].rotation.z = 0.4;
  }
},
  corpseexplosion: (prog, pm, ud) => {
  const TAU = Math.PI * 2;
  const gather = Math.min(prog / 0.45, 1);
  const ge = Math.sin(gather * Math.PI / 2);
  const d = Math.max(0, 1 - Math.abs(prog - 0.5) / 0.12);
  const snap = d * d * d;
  const recoil = prog > 0.55 ? Math.max(0, 1 - (prog - 0.55) / 0.45) : 0;
  const rb = Math.sin(recoil * Math.PI) * 0.5;
  pm.rotation.x = -ge * 0.35 + snap * 0.85 - rb * 0.12;
  pm.position.y += ge * 0.08 - snap * 0.22;
  pm.rotation.z = Math.sin(prog * TAU * 1.5) * snap * 0.06;
  const tremble = (snap > 0.2) ? Math.sin(prog * 90) * snap * 0.04 : 0;
  pm.position.y += tremble;
  if (ud.arms && ud.arms.length >= 2) {
    const upBack = -ge * 2.4;
    const slam = snap * 3.4;
    const ax = upBack + slam - rb * 0.4;
    ud.arms[0].rotation.x = ax;
    ud.arms[1].rotation.x = ax;
    const flare = ge * 0.9 - snap * 0.7;
    ud.arms[0].rotation.z = flare;
    ud.arms[1].rotation.z = -flare;
    ud.arms[0].rotation.y = -ge * 0.3 + snap * 0.4;
    ud.arms[1].rotation.y = ge * 0.3 - snap * 0.4;
  }
},
  boneprison: (prog, pm, ud, now) => {
  const press = prog < 0.25 ? (prog / 0.25) : 1;
  const release = prog > 0.85 ? (1 - (prog - 0.85) / 0.15) : 1;
  const lock = press * release;
  pm.position.y -= lock * 0.18;
  pm.rotation.x = lock * 0.20;
  const tremor = (prog > 0.25 && prog < 0.85) ? Math.sin(now * 0.045) * 0.012 * release : 0;
  pm.rotation.z = tremor;
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = 0.55 + lock * 0.85;
    ud.arms[1].rotation.x = 0.55 + lock * 0.85;
    ud.arms[0].rotation.z = lock * 0.95;
    ud.arms[1].rotation.z = -lock * 0.95;
    const slam = press < 1 ? Math.sin(press * Math.PI) * 0.25 : 0;
    ud.arms[0].rotation.x += slam;
    ud.arms[1].rotation.x += slam;
  }
},
  demonslash: (prog, pm, ud) => {
  const wind = Math.min(1, prog / 0.28);
  const swing = prog < 0.28 ? 0 : Math.min(1, (prog - 0.28) / 0.52);
  const recover = prog < 0.8 ? 0 : (prog - 0.8) / 0.2;
  const ease = swing < 1 ? swing * swing * (3 - 2 * swing) : 1;
  const swingEnv = Math.sin(swing * Math.PI);
  pm.rotation.y += -0.7 * wind * (1 - swing) + 1.6 * ease - 0.5 * recover;
  pm.rotation.z = -0.28 * wind * (1 - swing) + 0.4 * swingEnv - 0.12 * recover;
  pm.rotation.x = -0.18 * swingEnv;
  pm.position.y += -0.05 * wind * (1 - swing) + 0.04 * swingEnv;
  pm.scale.setScalar(1 + 0.05 * swingEnv);
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[1].rotation.x = -0.5 - 1.1 * wind * (1 - swing) + 0.9 * ease;
    ud.arms[1].rotation.z = -0.4 - 0.9 * wind * (1 - swing) + 1.3 * ease;
    ud.arms[1].rotation.y = -0.6 * wind * (1 - swing) + 0.7 * ease;
    ud.arms[0].rotation.z = 0.5 * swingEnv;
    ud.arms[0].rotation.x = 0.2 * swingEnv;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 0.4 * wind * (1 - swing) + 0.3 * ease;
    ud.legs[1].rotation.x = -0.3 * wind * (1 - swing) - 0.2 * ease;
  }
  if (ud.weaponMount) {
    ud.weaponMount.rotation.z = -1.5 + 1.1 * wind * (1 - swing) + 2.6 * ease;
    ud.weaponMount.rotation.y = 1.2 * wind * (1 - swing) - 2.4 * ease;
    ud.weaponMount.rotation.x = 0.3 * swingEnv - 0.3 * recover;
  }
},
  starfall: (prog, pm, ud) => {
      const rise = Math.sin(Math.min(prog, 0.7) / 0.7 * Math.PI * 0.5);
      const arch = rise;
      const strike = prog > 0.7 ? (prog - 0.7) / 0.3 : 0;
      const ease = strike * strike * (3 - 2 * strike);
      pm.rotation.x = -arch * 0.42 + ease * 0.6;
      pm.position.y += rise * 0.14 - ease * 0.12;
      if (ud.arms && ud.arms.length >= 2) {
        const up = -2.7;
        const lx = up * (1 - ease) + ease * 0.45;
        ud.arms[0].rotation.x = lx; ud.arms[1].rotation.x = lx;
        ud.arms[0].rotation.z = (0.55 * (1 - ease)) - ease * 0.15;
        ud.arms[1].rotation.z = (-0.55 * (1 - ease)) + ease * 0.15;
      }
      if (ud.legs && ud.legs.length >= 2) {
        ud.legs[0].rotation.x = -ease * 0.25; ud.legs[1].rotation.x = ease * 0.25;
      }
      if (ud.weaponMount) { ud.weaponMount.rotation.z = -arch * 0.5 + ease * 0.3; }
    },
  typhoonshot: (prog, pm, ud) => { const coil = Math.min(prog / 0.5, 1); const rel = Math.max((prog - 0.5) / 0.5, 0); const ease = (1 - Math.cos(coil * Math.PI)) / 2; const relEase = Math.sin(Math.min(rel, 1) * Math.PI * 0.5); const env = Math.sin(prog * Math.PI); pm.rotation.y += -0.8 * (1 - ease) * coil + 2.0 * relEase - 0.8 * relEase * relEase; pm.rotation.z = -0.28 * ease * (1 - rel) + 0.18 * relEase * (1 - relEase) * 2; pm.rotation.x = -0.18 * relEase * (1 - relEase) * 2; pm.position.y += env * 0.07 - 0.05 * ease * (1 - rel); const draw = ease * (1 - rel); if (ud.arms && ud.arms.length >= 2) { ud.arms[0].rotation.x = -0.5 - 0.9 * draw + 0.4 * relEase; ud.arms[1].rotation.x = -0.5 - 0.9 * draw + 0.4 * relEase; ud.arms[0].rotation.z = 0.4 + 0.9 * draw - 1.5 * relEase; ud.arms[1].rotation.z = -0.4 - 0.9 * draw + 1.5 * relEase; ud.arms[0].rotation.y = 0.7 * draw - 0.5 * relEase; ud.arms[1].rotation.y = -0.7 * draw + 0.5 * relEase; } if (ud.legs && ud.legs.length >= 2) { ud.legs[0].rotation.x = 0.25 * ease * (1 - rel) - 0.3 * relEase; ud.legs[1].rotation.x = -0.25 * ease * (1 - rel) + 0.3 * relEase; } if (ud.weaponMount) { ud.weaponMount.rotation.z = -0.8 - 0.6 * draw + 1.0 * relEase; ud.weaponMount.rotation.x = -0.3 * draw + 0.5 * relEase; ud.weaponMount.rotation.y = 0.6 * draw - 0.9 * relEase; } },
  soulharvest: (prog, pm, ud, now, moving) => {
  const reap = Math.min(prog / 0.62, 1);
  const draw = Math.max((prog - 0.62) / 0.38, 0);
  const reapE = Math.sin(reap * Math.PI * 0.5);
  const drawE = draw * draw * (3 - 2 * draw);
  pm.rotation.y += reapE * 1.0 * (1 - drawE * 0.35);
  pm.rotation.z = reapE * 0.12 * (1 - drawE);
  pm.rotation.x = -drawE * 0.14 + reapE * 0.05 * (1 - drawE);
  pm.position.y += drawE * 0.13 - reapE * 0.03 * (1 - drawE);
  const pulse = 1 + drawE * 0.07 * Math.sin(now * 0.02);
  pm.scale.setScalar(pulse);
  if (ud.arms && ud.arms.length >= 2) {
    const out = reapE * 1.45 * (1 - drawE);
    ud.arms[0].rotation.z = out - drawE * 0.55;
    ud.arms[1].rotation.z = -out + drawE * 0.55;
    const lift = reapE * 0.55 * (1 - drawE);
    ud.arms[0].rotation.x = -lift - drawE * 1.25;
    ud.arms[1].rotation.x = -lift - drawE * 1.25;
    ud.arms[0].rotation.y = reapE * 0.45 * (1 - drawE);
    ud.arms[1].rotation.y = -reapE * 0.45 * (1 - drawE);
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = reapE * 0.18 * (1 - drawE);
    ud.legs[1].rotation.x = -reapE * 0.18 * (1 - drawE);
  }
  if (ud.weaponMount) { ud.weaponMount.rotation.z = -0.7 - reapE * 0.5; ud.weaponMount.rotation.x = 0.2; }
},
};

// WARRIOR — Whirlwind flourish: a spinning translucent blade-disc + streaks at waist height.
export function buildCastFx_whirlwind(opts) {
  const c = (opts && opts.color) || '#ff4d6d';
  const g = new T.Group();
  const fxMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const disc = m(geo('cfxWwDisc', () => new T.RingGeometry(1.2, 2.1, 28)), fxMat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.6; g.add(disc);
  const streaks = [];
  for (let i = 0; i < 5; i++) {
    const s = m(box(1.8, 0.05, 0.14), fxMat);
    s.position.y = 0.55 + i * 0.06;
    s.userData.a = (i / 5) * _TAU;
    g.add(s); streaks.push(s);
  }
  g.userData.castAnim = (grp, prog) => {
    const env = Math.sin(prog * Math.PI);
    fxMat.opacity = 0.6 * env;
    disc.scale.setScalar(0.5 + prog * 0.7);
    for (let i = 0; i < streaks.length; i++) streaks[i].rotation.y = streaks[i].userData.a + prog * _TAU * 5;
  };
  return g;
}

export function buildCastFx_leapslam(opts) {
  const c = (opts && opts.color) || "#ffc857";
  const g = new T.Group();

  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring2Mat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const dustMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const lineMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flashMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  const ring = m(geo("cfxLeapslamRing", () => new T.RingGeometry(0.55, 1.0, 36)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);

  const ring2 = m(geo("cfxLeapslamRing2", () => new T.RingGeometry(0.2, 0.45, 28)), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.05; g.add(ring2);

  const flash = m(geo("cfxLeapslamFlash", () => new T.CircleGeometry(0.6, 24)), flashMat);
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.06; g.add(flash);

  const spikes = [];
  for (let i = 0; i < 8; i++) {
    const s = m(box(0.85, 0.05, 0.12), dustMat);
    const a = (i / 8) * Math.PI * 2;
    s.userData.a = a;
    s.position.y = 0.07;
    g.add(s); spikes.push(s);
  }

  const streak = m(box(0.1, 1.8, 0.1), lineMat);
  streak.position.y = 1.0; g.add(streak);

  g.userData.castAnim = (grp, prog) => {
    if (prog < 0.6) {
      lineMat.opacity = 0.0;
      ringMat.opacity = 0.0; ring2Mat.opacity = 0.0; dustMat.opacity = 0.0; flashMat.opacity = 0.0;
    } else if (prog < 0.8) {
      const t = (prog - 0.6) / 0.2;
      lineMat.opacity = 0.5 * (1 - Math.abs(t - 0.5) * 2);
      streak.scale.y = 1.0;
      streak.position.y = 1.4 - 1.1 * t;
      ringMat.opacity = 0.0; ring2Mat.opacity = 0.0; dustMat.opacity = 0.0;
      const b = Math.max(0, (t - 0.7) / 0.3);
      flashMat.opacity = 0.9 * b;
      flash.scale.setScalar(0.4 + 0.8 * b);
    } else {
      const t = (prog - 0.8) / 0.2;
      const fade = 1 - t;
      lineMat.opacity = 0.0;
      ringMat.opacity = 0.75 * fade;
      ring.scale.setScalar(0.5 + 2.6 * t);
      ring2Mat.opacity = 0.6 * fade;
      ring2.scale.setScalar(0.4 + 1.8 * Math.min(t * 1.4, 1));
      flashMat.opacity = 0.9 * Math.max(0, 1 - t * 2.2);
      flash.scale.setScalar(1.2 + 1.4 * t);
      dustMat.opacity = 0.7 * fade;
      const reach = 0.4 + 2.2 * t;
      for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        s.rotation.y = s.userData.a;
        s.position.x = Math.cos(s.userData.a) * reach;
        s.position.z = Math.sin(s.userData.a) * reach;
        s.scale.x = 0.6 + 1.4 * t;
      }
    }
  };

  return g;
}

export function buildCastFx_warcry(opts) {
  const c = (opts && opts.color) || "#ffb44a";
  const g = new T.Group();

  // Expanding shockwave ring on the ground (released near the end)
  const waveMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const wave = m(geo("cfxWarcryWave", () => new T.RingGeometry(0.55, 0.95, 36)), waveMat);
  wave.rotation.x = -Math.PI / 2; wave.position.y = 0.05; g.add(wave);

  // Second trailing wave for depth
  const wave2Mat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const wave2 = m(geo("cfxWarcryWave2", () => new T.RingGeometry(0.4, 0.62, 30)), wave2Mat);
  wave2.rotation.x = -Math.PI / 2; wave2.position.y = 0.05; g.add(wave2);

  // Roar cone bursting out the front (from chest height)
  const roarMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const roar = m(cone(0.6, 1.0, 18), roarMat);
  roar.rotation.x = Math.PI / 2; roar.position.set(0, 1.05, 0.5); g.add(roar);

  // Vertical fury column swelling at the chest during the held roar
  const colMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const col = m(cyl(0.32, 0.5, 1.3, 16), colMat);
  col.position.y = 0.95; g.add(col);

  // Rising fury embers around the body
  const embers = [];
  for (let i = 0; i < 6; i++) {
    const eMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
    const e = m(box(0.1, 0.22, 0.1), eMat);
    const a = (i / 6) * Math.PI * 2;
    e.userData.a = a; e.userData.r = 0.42 + (i % 2) * 0.18; e.userData.ph = i * 0.16;
    e.userData.mat = eMat;
    g.add(e); embers.push(e);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const swell = Math.sin(Math.min(1, prog / 0.6) * Math.PI * 0.5);
    const hold = prog > 0.25 && prog < 0.72 ? 1 : Math.max(0, 1 - Math.abs(prog - 0.48) / 0.5);
    const rel = prog > 0.72 ? (prog - 0.72) / 0.28 : 0;
    const relEnv = Math.sin(rel * Math.PI);

    // Shockwaves blast outward on release
    waveMat.opacity = 0.7 * relEnv;
    wave.scale.setScalar(0.3 + rel * 3.4);
    wave2Mat.opacity = 0.5 * relEnv;
    wave2.scale.setScalar(0.3 + rel * 2.2);

    // Roar cone punches forward
    roarMat.opacity = 0.6 * relEnv;
    roar.scale.set(0.5 + rel * 1.3, 0.5 + rel * 2.2, 0.5 + rel * 1.3);
    roar.position.z = 0.5 + rel * 0.7;

    // Fury column pulses during the held roar, then collapses
    colMat.opacity = 0.45 * hold * (1 - rel);
    const pulse = 1 + Math.sin(now * 0.02) * 0.12 * hold;
    col.scale.set((0.6 + swell * 0.6) * pulse, 0.7 + swell * 0.7, (0.6 + swell * 0.6) * pulse);

    // Embers rise and intensify with the build
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      const t = ((now * 0.0009 + e.userData.ph) % 1);
      e.position.x = Math.cos(e.userData.a) * e.userData.r;
      e.position.z = Math.sin(e.userData.a) * e.userData.r;
      e.position.y = 0.2 + t * 1.6;
      e.userData.mat.opacity = (0.55 * swell) * (1 - t) * (1 - rel * 0.7);
    }
  };

  return g;
}

export function buildCastFx_shieldwall(opts) {
  const c = (opts && opts.color) || "#8fb7ff";
  const g = new T.Group();
  const dome = new T.Group();
  dome.position.set(0, 0.0, 0.85);
  g.add(dome);

  const shellMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.18, blending:T.AdditiveBlending, depthWrite:false, wireframe:true });
  const shell = m(geo("cfxSwDome", () => new T.SphereGeometry(0.95, 6, 4, 0, Math.PI*2, 0, Math.PI/2)), shellMat);
  shell.scale.set(1, 1.0, 0.55);
  dome.add(shell);

  const skinMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.07, blending:T.AdditiveBlending, depthWrite:false });
  const skin = m(geo("cfxSwSkin", () => new T.SphereGeometry(0.9, 12, 8, 0, Math.PI*2, 0, Math.PI/2)), skinMat);
  skin.scale.set(1, 1.0, 0.55);
  dome.add(skin);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const rMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.4, blending:T.AdditiveBlending, depthWrite:false });
    const r = m(geo("cfxSwRing" + i, () => new T.TorusGeometry(0.4 + i*0.22, 0.025, 6, 24)), rMat);
    r.rotation.x = Math.PI/2;
    r.position.y = 0.05 + i*0.18;
    r.scale.z = 0.55;
    r.userData.mat = rMat; r.userData.base = 0.42 - i*0.06;
    dome.add(r); rings.push(r);
  }

  const base = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.5, blending:T.AdditiveBlending, depthWrite:false });
  const ground = m(geo("cfxSwGround", () => new T.RingGeometry(0.55, 0.95, 6)), base);
  ground.rotation.x = -Math.PI/2; ground.position.y = 0.02; ground.scale.z = 0.6;
  dome.add(ground);

  g.userData.castAnim = (grp, prog, now) => {
    const set = Math.min(prog / 0.18, 1);
    const rel = prog > 0.86 ? 1 - (prog - 0.86) / 0.14 : 1;
    const up = set * rel;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    shellMat.opacity = (0.1 + 0.14 * pulse) * up;
    skinMat.opacity = (0.04 + 0.06 * pulse) * up;
    base.opacity = (0.3 + 0.3 * pulse) * up;
    dome.scale.setScalar(0.85 + 0.15 * set + 0.04 * pulse);
    for (let i = 0; i < rings.length; i++) {
      const m2 = rings[i].userData.mat;
      m2.opacity = (rings[i].userData.base * (0.6 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.005 + i)))) * up;
      rings[i].rotation.z = now * 0.0008 * (i + 1) * (i % 2 ? -1 : 1);
    }
  };
  return g;
}

export function buildCastFx_frostnova(opts) {
  const c = (opts && opts.color) || "#6df1ff";
  const g = new T.Group();
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const innerMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const shardMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flashMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  const ring = m(geo("cfxFnRing", () => new T.RingGeometry(0.82, 1.0, 40)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);

  const inner = m(geo("cfxFnInner", () => new T.RingGeometry(0.5, 0.62, 32)), innerMat);
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.03; g.add(inner);

  const flash = m(geo("cfxFnFlash", () => new T.CircleGeometry(0.6, 24)), flashMat);
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.02; g.add(flash);

  const shards = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const sh = m(geo("cfxFnShard", () => new T.ConeGeometry(0.12, 0.6, 4)), shardMat);
    const a = (i / N) * Math.PI * 2;
    sh.userData.a = a;
    sh.rotation.x = Math.PI / 2;
    sh.rotation.z = -a;
    sh.position.y = 0.06;
    g.add(sh);
    shards.push(sh);
  }

  g.userData.castAnim = (grp, prog) => {
    const snap = prog < 0.45 ? 0 : Math.min(1, (prog - 0.45) / 0.1);
    const wave = prog < 0.45 ? 0 : (prog - 0.45) / 0.55;
    const fade = Math.max(0, 1 - wave);

    const r = 0.2 + wave * 3.5;
    ring.scale.set(r, r, r);
    ring.rotation.z = wave * 0.6;
    ringMat.opacity = 0.75 * fade * snap;

    const ri = 0.2 + wave * 2.4;
    inner.scale.set(ri, ri, ri);
    innerMat.opacity = 0.5 * fade * snap;

    flashMat.opacity = 0.9 * Math.sin(snap * Math.PI);
    const fs = 0.5 + snap * 1.2;
    flash.scale.set(fs, fs, fs);

    shardMat.opacity = 0.8 * fade * snap;
    const reach = 0.4 + wave * 2.9;
    for (let i = 0; i < shards.length; i++) {
      const sh = shards[i];
      const a = sh.userData.a;
      sh.position.x = Math.cos(a) * reach;
      sh.position.z = Math.sin(a) * reach;
      const sc = 0.4 + snap * 1.1;
      sh.scale.set(sc, 1 + wave * 0.8, sc);
    }
  };

  return g;
}

export function buildCastFx_chainlightning(opts) {
  const c = (opts && opts.color) || "#bff0ff";
  const g = new T.Group();
  const boltMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const hx = 0.32, hy = 0.92;
  const pts = [
    [hx, hy, 0.1], [hx+0.18, hy+0.16, 0.6], [hx-0.05, hy-0.05, 1.1],
    [hx+0.12, hy+0.1, 1.7], [hx-0.1, hy-0.12, 2.3], [hx+0.06, hy+0.05, 3.0]
  ];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1];
    const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
    const s = m(box(0.07, 0.07, 1), boltMat);
    s.scale.z = len;
    s.position.set((a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2);
    s.lookAt(new T.Vector3(b[0], b[1], b[2]));
    s.userData.t0 = i / (pts.length - 1);
    s.userData.len = len;
    g.add(s); segs.push(s);
  }
  const forks = [];
  const fbase = [[pts[2], 0.5, 0.4], [pts[3], -0.55, 0.3], [pts[4], 0.45, -0.35]];
  for (let i = 0; i < fbase.length; i++) {
    const o = fbase[i][0];
    const f = m(box(0.05, 0.05, 1), boltMat);
    f.scale.z = 0.55;
    f.position.set(o[0] + fbase[i][1]*0.25, o[1] + (i%2?-0.2:0.25), o[2] + fbase[i][2]*0.5);
    f.rotation.z = fbase[i][1]; f.rotation.y = fbase[i][2];
    f.userData.t0 = 0.4 + i*0.18;
    g.add(f); forks.push(f);
  }
  const burst = m(geo("cfxClBurst", () => new T.SphereGeometry(0.22, 8, 8)), boltMat);
  burst.position.set(hx, hy, 0.1); g.add(burst);
  const tip = m(geo("cfxClTip", () => new T.SphereGeometry(0.14, 6, 6)), boltMat);
  tip.position.set(hx+0.06, hy+0.05, 3.0); g.add(tip);
  g.userData.castAnim = (grp, prog, now) => {
    const fire = prog < 0.45 ? 0 : (prog - 0.45) / 0.55;
    const flick = 0.6 + 0.4 * Math.sin(now * 0.06);
    const fade = 1 - Math.max(0, (prog - 0.9) / 0.1) * 0.5;
    boltMat.opacity = fire > 0 ? 0.9 * flick * fade : 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.visible = fire > s.userData.t0;
      s.scale.x = 0.07 * flick + 0.02;
      s.scale.y = 0.07 * flick + 0.02;
      s.scale.z = s.userData.len;
    }
    for (let i = 0; i < forks.length; i++) forks[i].visible = fire > forks[i].userData.t0;
    burst.visible = fire > 0 && fire < 0.5;
    burst.scale.setScalar(fire < 0.5 ? (0.5 + fire * 2) : 0.001);
    tip.visible = fire > 0.85;
    tip.scale.setScalar(0.8 + Math.sin(now * 0.1) * 0.5);
  };
  return g;
}

export function buildCastFx_meteor(opts) {
  const c = (opts && opts.color) || "#ff7a3c";
  const g = new T.Group();
  const orbMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const haloMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const trailMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const orb = m(geo("cfxMeteorOrb", () => new T.SphereGeometry(0.26, 16, 12)), orbMat);
  orb.position.set(0, 1.95, 0.45); g.add(orb);
  const halo = m(geo("cfxMeteorHalo", () => new T.RingGeometry(0.3, 0.55, 24)), haloMat);
  halo.position.set(0, 1.95, 0.45); g.add(halo);
  const shards = [];
  for (let i = 0; i < 5; i++) {
    const s = m(box(0.05, 0.05, 0.5), orbMat);
    const a = (i / 5) * Math.PI * 2;
    s.userData.a = a; s.userData.r = 0.42;
    g.add(s); shards.push(s);
  }
  const trail = m(cyl(0.04, 0.2, 1.0, 8), trailMat);
  trail.position.set(0, 1.95, 0.45); g.add(trail);
  g.userData.castAnim = (grp, prog) => {
    const gather = Math.min(prog / 0.75, 1);
    const gEase = gather * gather * (3 - 2 * gather);
    const snap = prog > 0.75 ? (prog - 0.75) / 0.25 : 0;
    const pulse = 1 + Math.sin(prog * 30) * 0.12 * (1 - snap);
    orbMat.opacity = (0.4 + 0.5 * gEase) * (1 - snap * 0.3);
    const grow = 0.4 + gEase * 0.8;
    orb.scale.setScalar(grow * pulse);
    haloMat.opacity = gEase * 0.5 * (1 - snap);
    halo.scale.setScalar(0.6 + gEase * 1.0 + Math.sin(prog * 18) * 0.1);
    halo.rotation.z = prog * 3.0;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const spin = prog * 6.0 + s.userData.a;
      const r = s.userData.r * grow;
      s.position.set(Math.cos(spin) * r, 1.95 + Math.sin(prog * 12 + i) * 0.05, 0.45 + Math.sin(spin) * r);
      s.lookAt(0, 1.95, 0.45);
      s.scale.setScalar(0.5 + gEase * 0.8);
    }
    if (snap > 0) {
      const drop = snap * snap;
      const y = 1.95 - drop * 1.7;
      const z = 0.45 + drop * 1.6;
      orb.position.set(0, y, z);
      orb.scale.setScalar(grow * (1 + drop * 0.5));
      orbMat.opacity = 0.9 * (1 - drop * 0.4);
      trailMat.opacity = drop * 0.7 * (1 - drop * 0.5);
      trail.position.set(0, (1.95 + y) / 2, (0.45 + z) / 2);
      trail.scale.set(1, 1.0 + drop * 3.0, 1);
      trail.lookAt(0, y, z);
      for (let i = 0; i < shards.length; i++) { shards[i].position.set(0, y, z); shards[i].scale.setScalar(0.001); }
      haloMat.opacity = 0;
    } else {
      orb.position.set(0, 1.95, 0.45);
      trailMat.opacity = 0;
    }
  };
  return g;
}

export function buildCastFx_blinkstrike(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();
  const shellMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
  const sparkMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const ringMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });

  const shell = m(cyl(0.34, 0.34, 1.5, 10), shellMat);
  shell.position.y = 0.75; g.add(shell);

  const ring = m(geo("cfxBlinkRing", () => new T.RingGeometry(0.5, 0.75, 24)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);

  const sparks = [];
  for (let i = 0; i < 7; i++) {
    const s = m(box(0.07, 0.07, 0.5), sparkMat);
    const a = (i / 7) * Math.PI * 2;
    s.userData.a = a; s.userData.h = 0.5 + (i % 3) * 0.4;
    s.position.y = 0.8; g.add(s); sparks.push(s);
  }

  const lance = m(box(0.1, 0.1, 1.4), sparkMat);
  lance.position.set(0, 0.85, 0.7); g.add(lance);

  g.userData.castAnim = (grp, prog) => {
    if (prog < 0.32) {
      const t = prog / 0.32;
      shellMat.opacity = 0.55 * (1 - t);
      shell.scale.set(1 - t * 0.4, 1 - t * 0.5, 1 - t * 0.4);
      ringMat.opacity = 0.6 * (1 - t);
      ring.scale.setScalar(1 - t * 0.6);
      sparkMat.opacity = 0;
      lance.scale.z = 0; lance.scale.x = 0;
    } else {
      const t = (prog - 0.32) / 0.68;
      const burst = 1 - Math.pow(1 - t, 3);
      shellMat.opacity = 0.6 * (1 - t);
      shell.scale.set(1 + burst * 2.5, 1 + burst * 0.6, 1 + burst * 2.5);
      ringMat.opacity = 0.7 * (1 - t);
      ring.scale.setScalar(0.4 + burst * 2.2);
      const fade = Math.sin(t * Math.PI);
      sparkMat.opacity = 0.95 * fade;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const r = burst * 1.1;
        s.position.x = Math.cos(s.userData.a) * r;
        s.position.z = Math.sin(s.userData.a) * r;
        s.position.y = s.userData.h + burst * 0.3;
        s.rotation.y = s.userData.a;
        s.scale.z = 0.4 + burst * 1.2;
      }
      const lp = Math.sin(Math.min(t * 1.4, 1) * Math.PI);
      lance.scale.z = 0.3 + lp * 1.2;
      lance.scale.x = 0.5 + lp;
      lance.position.z = 0.4 + lp * 0.7;
    }
  };
  return g;
}

export function buildCastFx_multishot(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();
  const fan = [];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const ang = (i - (N - 1) / 2) * 0.32;
    const arrowMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const shaft = m(box(0.06, 0.06, 1.5), arrowMat);
    shaft.position.z = 0.75;
    const head = m(cone(0.12, 0.28, 6), arrowMat);
    head.rotation.x = Math.PI / 2;
    head.position.z = 1.5;
    const arrow = new T.Group();
    arrow.add(shaft); arrow.add(head);
    arrow.position.y = 0.85;
    arrow.rotation.y = ang;
    arrow.userData.ang = ang;
    arrow.userData.mat = arrowMat;
    g.add(arrow);
    fan.push(arrow);
  }
  const flashMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const flash = m(geo("cfxMsFlash", () => new T.RingGeometry(0.1, 0.45, 16)), flashMat);
  flash.position.set(0, 0.85, 0.2);
  g.add(flash);
  g.userData.castAnim = (grp, prog) => {
    const released = prog > 0.62;
    const rel = released ? (prog - 0.62) / 0.38 : 0;
    for (let i = 0; i < fan.length; i++) {
      const a = fan[i];
      const reach = released ? rel : 0;
      a.position.z = reach * (2.6 + Math.abs(a.userData.ang) * 1.5);
      a.userData.mat.opacity = released ? (0.85 * (1 - rel)) : 0;
      const sc = 0.6 + reach * 0.6;
      a.scale.set(1, 1, sc);
    }
    const fl = released ? Math.sin(Math.min(1, rel * 3) * Math.PI) : 0;
    flashMat.opacity = 0.7 * fl;
    flash.scale.setScalar(0.6 + fl * 1.4);
  };
  return g;
}

export function buildCastFx_poisontrap(opts) {
  const c = (opts && opts.color) || "#9be57c";
  const g = new T.Group();
  // Bubbling pod core at the feet (fresh material -> opacity animated)
  const podMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const pod = m(geo("cfxPtPod", () => new T.SphereGeometry(0.5, 16, 12)), podMat);
  pod.position.y = 0.18; pod.scale.set(0.2, 0.12, 0.2); g.add(pod);
  // Toxic ground ring marking the trap (fresh material)
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxPtRing", () => new T.RingGeometry(0.55, 0.95, 30)), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.03; g.add(ring);
  // Rising bubbles that roil up out of the pod -- each gets its OWN fresh material so fade is independent
  const bubbles = [];
  for (let i = 0; i < 7; i++) {
    const bMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const b = m(geo("cfxPtBub", () => new T.SphereGeometry(0.12, 8, 6)), bMat);
    const a = (i / 7) * Math.PI * 2;
    b.userData.a = a; b.userData.r = 0.18 + (i % 3) * 0.12; b.userData.ph = i * 0.6; b.userData.mat = bMat;
    b.position.set(Math.cos(a) * b.userData.r, 0.18, Math.sin(a) * b.userData.r);
    g.add(b); bubbles.push(b);
  }
  g.userData.castAnim = (grp, prog, now) => {
    const env = Math.sin(prog * Math.PI);
    const grow = Math.min(prog / 0.7, 1);
    const t = (now || 0) * 0.004;
    // pod swells and roils with a wobble
    podMat.opacity = 0.6 * env;
    const sw = 0.2 + grow * 0.85;
    pod.scale.set(sw * (1 + 0.12 * Math.sin(t * 3)), sw * 0.7 * (1 + 0.15 * Math.sin(t * 4 + 1)), sw * (1 + 0.12 * Math.sin(t * 3 + 2)));
    pod.position.y = 0.18 + 0.04 * Math.sin(t * 2);
    // ring expands and pulses
    ringMat.opacity = 0.5 * env;
    ring.scale.setScalar(0.6 + grow * 0.9 + 0.06 * Math.sin(t * 3));
    ring.rotation.z = prog * 1.6;
    // bubbles drift up and out, popping back down (roil) -- independent per-bubble fade
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const up = ((t + b.userData.ph) % 1.0);
      const rr = b.userData.r + up * 0.35;
      b.position.set(Math.cos(b.userData.a) * rr, 0.12 + up * 0.7, Math.sin(b.userData.a) * rr);
      const fade = (1 - up);
      b.scale.setScalar((0.5 + 0.6 * Math.sin(up * Math.PI)) * grow);
      b.userData.mat.opacity = 0.55 * env * fade;
    }
  };
  return g;
}

export function buildCastFx_piercingshot(opts) {
  const c = (opts && opts.color) || "#caa15a";
  const g = new T.Group();
  const boltMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const tipMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const muzMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  const bolt = m(cyl(0.035, 0.035, 1, 6), boltMat);
  bolt.rotation.x = Math.PI/2;
  bolt.position.set(0, 0.9, 0.5);
  g.add(bolt);

  const glow = m(box(0.16, 0.16, 1.0), boltMat);
  glow.position.set(0, 0.9, 0.5);
  g.add(glow);

  const tip = m(cone(0.12, 0.45, 8), tipMat);
  tip.rotation.x = Math.PI/2;
  tip.position.set(0, 0.9, 1.0);
  g.add(tip);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = m(geo("cfxPsRing" + i, () => new T.RingGeometry(0.18, 0.34, 18)), ringMat);
    r.position.set(0, 0.9, 0.2);
    r.userData.off = i / 3;
    g.add(r);
    rings.push(r);
  }

  const muzzle = m(geo("cfxPsMuzzle", () => new T.RingGeometry(0.05, 0.4, 16)), muzMat);
  muzzle.position.set(0, 0.9, 0.05);
  g.add(muzzle);

  g.userData.castAnim = (grp, prog) => {
    const fire = prog > 0.6 ? (prog - 0.6) / 0.4 : 0;
    const env = Math.sin(Math.min(1, fire) * Math.PI);
    const reach = 0.1 + fire * 5.5;
    boltMat.opacity = 0.7 * env;
    tipMat.opacity = 0.85 * env;
    ringMat.opacity = 0.6 * env;

    const len = reach;
    bolt.scale.y = len;
    bolt.position.z = 0.1 + len * 0.5;
    glow.scale.z = len;
    glow.position.z = 0.1 + len * 0.5;
    tip.position.z = 0.1 + len + 0.2;
    tip.scale.setScalar(1 + 0.4 * env);

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const t = (fire + r.userData.off) % 1;
      r.position.z = 0.1 + t * reach;
      r.scale.setScalar(1 + t * 0.6);
    }

    const flash = prog < 0.62 ? 0 : Math.max(0, 1 - (prog - 0.6) / 0.18);
    muzMat.opacity = 0.9 * flash;
    muzzle.scale.setScalar(0.6 + flash * 2.2);
  };
  return g;
}

export function buildCastFx_volley(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();
  const arrowMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const N = 8;
  const arrows = [];
  for (let i = 0; i < N; i++) {
    const a = m(box(0.06, 0.06, 0.7), arrowMat);
    const head = m(cone(0.12, 0.28, 4), arrowMat);
    head.position.z = 0.5; head.rotation.x = Math.PI / 2; a.add(head);
    a.userData.ang = (i / N) * Math.PI * 2;
    a.userData.spread = 1.5 + (i % 3) * 0.55;
    g.add(a); arrows.push(a);
  }
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxVolleyRing", () => new T.RingGeometry(0.5, 0.85, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.castAnim = (grp, prog) => {
    const draw = Math.min(prog / 0.6, 1);
    const launch = prog > 0.6 ? (prog - 0.6) / 0.4 : 0;
    const env = Math.sin(prog * Math.PI);
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      const ang = a.userData.ang;
      const sp = a.userData.spread;
      const t = Math.min(launch * 1.15, 1);
      const arc = Math.sin(t * Math.PI);
      const radius = t * sp;
      a.position.x = Math.cos(ang) * radius;
      a.position.z = Math.sin(ang) * radius;
      a.position.y = 0.85 + arc * 2.8 + draw * 0.3;
      const pitch = (0.5 - t) * 1.9;
      a.rotation.set(pitch, -ang + Math.PI / 2, 0);
      const s = 0.6 + draw * 0.4 + launch * 0.3;
      a.scale.setScalar(s);
    }
    arrowMat.opacity = launch > 0 ? 0.85 * (1 - 0.35 * launch) : 0.15 + 0.6 * draw;
    ringMat.opacity = 0.6 * env;
    ring.scale.setScalar(0.6 + prog * 1.7);
  };
  return g;
}

export function buildCastFx_raisedead(opts) {
  const c = (opts && opts.color) || "#a0ffc0";
  const g = new T.Group();
  const wispMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  // ground summoning ring
  const ring = m(geo("cfxRdRing", () => new T.RingGeometry(0.55, 0.95, 32)), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.03; g.add(ring);
  const ring2 = m(geo("cfxRdRing2", () => new T.RingGeometry(0.95, 1.05, 32)), ringMat);
  ring2.rotation.x = -Math.PI/2; ring2.position.y = 0.03; g.add(ring2);
  // bone/soul wisps rising from a ring around the feet
  const wisps = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const w = m(geo("cfxRdWisp", () => new T.ConeGeometry(0.07, 0.4, 6)), wispMat);
    const r = 0.8;
    w.userData.bx = Math.cos(a) * r;
    w.userData.bz = Math.sin(a) * r;
    w.userData.ph = i / N;
    w.position.set(w.userData.bx, 0.1, w.userData.bz);
    g.add(w); wisps.push(w);
  }
  g.userData.castAnim = (grp, prog, now) => {
    const env = Math.sin(prog * Math.PI);
    ringMat.opacity = 0.7 * env;
    ring.rotation.z = prog * Math.PI * 1.5;
    ring2.scale.setScalar(0.85 + env * 0.3);
    wispMat.opacity = 0.85 * env;
    const t = (now || 0) * 0.004;
    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i];
      const local = (prog * 1.3 + w.userData.ph) % 1;       // each wisp loops upward
      w.position.y = 0.05 + local * 1.7;                    // rise from ground
      const fade = Math.sin(local * Math.PI);               // born low, fade high
      w.scale.set(fade, 0.5 + fade * 1.1, fade);
      const swirl = w.userData.ph * Math.PI * 2 + t;        // curl inward as they rise
      const rr = 0.8 * (1 - local * 0.55);
      w.position.x = Math.cos(swirl) * rr;
      w.position.z = Math.sin(swirl) * rr;
      w.rotation.y = swirl;
    }
  };
  return g;
}

export function buildCastFx_souldrain(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();
  const handY = 1.05, handZ = 0.35;
  const tipZ = 1.9;
  const tetherMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.7, blending:T.AdditiveBlending, depthWrite:false });
  const motes = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const s = m(geo("cfxSdMote", () => new T.OctahedronGeometry(0.11, 0)), tetherMat);
    s.userData.ph = i / N;
    g.add(s); motes.push(s);
  }
  const core = m(geo("cfxSdCore", () => new T.SphereGeometry(0.16, 10, 10)), tetherMat);
  core.position.set(0, handY, handZ); g.add(core);
  const strand = m(cyl(0.025, 0.025, 1, 6), tetherMat);
  strand.position.set(0, handY, (handZ + tipZ) / 2);
  strand.rotation.x = Math.PI / 2;
  strand.scale.y = tipZ - handZ;
  g.add(strand);
  const wisp = m(geo("cfxSdWisp", () => new T.RingGeometry(0.18, 0.3, 16)), tetherMat);
  wisp.position.set(0, handY, tipZ); g.add(wisp);
  g.userData.castAnim = (grp, prog, now) => {
    const t = now * 0.004;
    const env = Math.sin(prog * Math.PI);
    const pullT = 0.5 - 0.5 * Math.cos(prog * Math.PI * 2);
    tetherMat.opacity = 0.75 * env;
    const reach = tipZ - prog * 0.55;
    strand.position.z = (handZ + reach) / 2;
    strand.scale.y = reach - handZ;
    strand.scale.x = strand.scale.z = 1 + Math.sin(t * 3) * 0.25;
    wisp.position.z = reach;
    wisp.position.y = handY + Math.sin(t * 2) * 0.08;
    wisp.scale.setScalar(0.8 + pullT * 0.5);
    wisp.rotation.z = t;
    core.scale.setScalar(0.6 + pullT * 0.9 + env * 0.3);
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i];
      let f = (mt.userData.ph + prog * 1.6) % 1;
      f = 1 - f;
      const z = handZ + f * (reach - handZ);
      mt.position.set(Math.sin(z * 6 + t * 4) * 0.12, handY + Math.cos(z * 5 + t * 3) * 0.1, z);
      const s = (0.5 + (1 - f) * 0.7) * env;
      mt.scale.setScalar(s);
      mt.rotation.x = t * 2 + i; mt.rotation.y = t * 3;
    }
  };
  return g;
}

export function buildCastFx_corpseexplosion(opts) {
  const c = (opts && opts.color) || "#b6ff6a";
  const g = new T.Group();
  const CHEST = 0.85;

  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const groundMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const coreMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const shardMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  const ring = m(geo("cfxCeRing", () => new T.RingGeometry(0.55, 0.85, 36)), ringMat);
  ring.position.y = CHEST;
  g.add(ring);

  const ground = m(geo("cfxCeGround", () => new T.RingGeometry(0.6, 0.95, 36)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.04;
  g.add(ground);

  const core = m(geo("cfxCeCore", () => new T.SphereGeometry(0.32, 16, 12)), coreMat);
  core.position.y = CHEST;
  g.add(core);

  const shards = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const s = m(box(0.5, 0.07, 0.07), shardMat);
    const a = (i / N) * Math.PI * 2;
    s.userData.a = a;
    s.position.y = CHEST;
    s.rotation.y = a;
    g.add(s);
    shards.push(s);
  }

  g.userData.castAnim = (grp, prog) => {
    const d = Math.max(0, 1 - Math.abs(prog - 0.5) / 0.16);
    const blast = d * d;
    const t = (prog - 0.45) / 0.55;
    const grow = t < 0 ? 0 : (t > 1 ? 1 : t);
    const after = prog > 0.45 ? 1 : 0;

    const rScale = 0.4 + grow * 3.6;
    ring.scale.setScalar(rScale);
    ground.scale.setScalar(0.4 + grow * 4.2);
    ringMat.opacity = (0.95 * blast + 0.4 * (1 - grow)) * after;
    groundMat.opacity = (0.7 * blast + 0.3 * (1 - grow)) * after;

    const charge = Math.min(prog / 0.45, 1);
    core.scale.setScalar(0.3 + charge * 0.6 + blast * 1.8);
    coreMat.opacity = 0.25 * charge + 0.95 * blast;

    const reach = grow * 2.6;
    shardMat.opacity = (0.85 * blast + 0.4 * (1 - grow)) * after;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const a = s.userData.a;
      s.position.x = Math.sin(a) * reach;
      s.position.z = Math.cos(a) * reach;
      s.position.y = CHEST + Math.sin(grow * Math.PI) * 0.3 - grow * 0.5;
      s.scale.setScalar(0.6 + blast * 1.2);
    }

    grp.rotation.y = prog * 0.6;
  };

  return g;
}

export function buildCastFx_boneprison(opts) {
  const c = (opts && opts.color) || "#e8e0c0";
  const g = new T.Group();
  const spikeMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const N = 8;
  const R = 0.95;
  const spikes = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const sp = m(geo("cfxBpSpike", () => new T.ConeGeometry(0.13, 0.85, 5)), spikeMat);
    sp.position.set(Math.cos(a) * R, 0.0, Math.sin(a) * R);
    sp.rotation.z = Math.cos(a) * 0.18;
    sp.rotation.x = -Math.sin(a) * 0.18;
    sp.scale.set(1, 0.05, 1);
    sp.userData.ph = i / N;
    g.add(sp);
    spikes.push(sp);
  }
  const ring = m(geo("cfxBpRing", () => new T.RingGeometry(R - 0.12, R + 0.12, 32)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  const core = m(geo("cfxBpCore", () => new T.RingGeometry(0.18, 0.42, 20)), ringMat);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.03;
  g.add(core);
  g.userData.castAnim = (grp, prog) => {
    const rise = prog < 0.45 ? (prog / 0.45) : 1;
    const fade = prog > 0.8 ? (1 - (prog - 0.8) / 0.2) : 1;
    const er = Math.sin(Math.min(rise, 1) * Math.PI * 0.5);
    for (let i = 0; i < spikes.length; i++) {
      const sp = spikes[i];
      const local = Math.max(0, Math.min(1, (rise - sp.userData.ph * 0.3) / 0.7));
      const h = Math.sin(local * Math.PI * 0.5);
      sp.scale.y = 0.05 + h * 1.0;
      sp.position.y = (0.85 * (0.05 + h * 1.0)) * 0.5 - 0.05;
    }
    spikeMat.opacity = 0.85 * fade;
    ringMat.opacity = 0.5 * er * fade;
    const pulse = 1 + Math.sin(prog * Math.PI * 6) * 0.04;
    ring.scale.setScalar(pulse);
    core.scale.setScalar(0.6 + er * 0.6);
  };
  return g;
}

export function buildCastFx_demonslash(opts) {
  const c = (opts && opts.color) || "#ff3b2f";
  const g = new T.Group();
  const crescentMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const coreMat = new T.MeshBasicMaterial({ color: "#ffd28a", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const arc = m(geo("cfxDsArc", () => new T.RingGeometry(1.3, 2.2, 40, 1, -Math.PI * 0.62, Math.PI * 1.24)), crescentMat);
  arc.rotation.x = -Math.PI / 2; arc.position.y = 0.85; g.add(arc);
  const core = m(geo("cfxDsCore", () => new T.RingGeometry(1.55, 1.95, 40, 1, -Math.PI * 0.55, Math.PI * 1.1)), coreMat);
  core.rotation.x = -Math.PI / 2; core.position.y = 0.85; g.add(core);
  const embers = [];
  for (let i = 0; i < 7; i++) {
    const eMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const e = m(box(0.16, 0.16, 0.16), eMat);
    const a = -Math.PI * 0.5 + (i / 6) * Math.PI;
    e.position.set(Math.cos(a) * 1.85, 0.85, Math.sin(a) * 1.85);
    e.userData.a = a; e.userData.mat = eMat; e.userData.phase = i * 0.12;
    g.add(e); embers.push(e);
  }
  const flash = m(plane(2.6, 1.6), new T.MeshBasicMaterial({ color: "#ffb070", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false }));
  flash.position.set(0, 0.9, 1.4); g.add(flash);
  g.userData.castAnim = (grp, prog, now) => {
    const swing = prog < 0.28 ? 0 : Math.min(1, (prog - 0.28) / 0.52);
    const sweepEnv = Math.sin(Math.max(0, swing) * Math.PI);
    const wind = Math.min(1, prog / 0.28);
    const fade = prog < 0.85 ? 1 : Math.max(0, 1 - (prog - 0.85) / 0.15);
    grp.rotation.y = -1.0 * (1 - swing) + 1.6 * swing;
    const sc = 0.7 + 0.5 * swing;
    arc.scale.set(sc, sc, sc); core.scale.set(sc, sc, sc);
    crescentMat.opacity = (0.75 * sweepEnv + 0.2 * wind * (1 - swing)) * fade;
    coreMat.opacity = 0.85 * sweepEnv * fade;
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      const lag = Math.max(0, Math.min(1, (swing - e.userData.phase) * 1.6));
      const r = 1.85 + lag * 0.6;
      e.position.set(Math.cos(e.userData.a) * r, 0.85 + lag * 0.5 + Math.sin(now * 0.012 + i) * 0.06, Math.sin(e.userData.a) * r);
      const es = 1 - lag * 0.7;
      e.scale.setScalar(Math.max(0.05, es));
      e.userData.mat.opacity = 0.9 * sweepEnv * (1 - lag * 0.5) * fade;
    }
    flash.material.opacity = 0.6 * Math.max(0, 1 - Math.abs(swing - 0.45) * 4) * fade;
    flash.scale.setScalar(0.8 + swing * 0.6);
  };
  return g;
}

export function buildCastFx_starfall(opts) {
      const c = (opts && opts.color) || "#ffe08a";
      const g = new T.Group();
      const haloMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const moteMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const trailMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const SKY = 3.4;
      const halo = m(geo("cfxStarfallHalo", () => new T.RingGeometry(0.5, 1.05, 30)), haloMat);
      halo.rotation.x = -Math.PI / 2; halo.position.y = SKY; g.add(halo);
      const motes = [];
      for (let i = 0; i < 7; i++) {
        const s = m(geo("cfxStarfallMote", () => new T.OctahedronGeometry(0.16, 0)), moteMat);
        s.userData.a = (i / 7) * Math.PI * 2;
        s.userData.r = 0.7 + (i % 3) * 0.18;
        g.add(s); motes.push(s);
      }
      const meteors = [];
      for (let i = 0; i < 3; i++) {
        const grp = new T.Group();
        const head = m(geo("cfxStarfallHead", () => new T.OctahedronGeometry(0.22, 0)), trailMat);
        grp.add(head);
        const tail = m(geo("cfxStarfallTail", () => new T.ConeGeometry(0.16, 1.3, 8)), trailMat);
        tail.position.y = 0.75; grp.add(tail);
        const ang = (i / 3) * Math.PI * 2 + 0.4;
        grp.userData.tx = Math.cos(ang) * 0.95;
        grp.userData.tz = Math.sin(ang) * 0.95;
        grp.visible = false;
        g.add(grp); meteors.push(grp);
      }
      g.userData.castAnim = (grp, prog) => {
        const gather = Math.min(prog, 0.7) / 0.7;
        const strike = prog > 0.7 ? (prog - 0.7) / 0.3 : 0;
        haloMat.opacity = 0.5 * gather * (1 - strike);
        halo.scale.setScalar(0.4 + gather * 0.9 + strike * 0.6);
        halo.rotation.z = prog * Math.PI * 1.5;
        const conv = 1 - gather * 0.7;
        moteMat.opacity = 0.85 * gather * (1 - strike);
        for (let i = 0; i < motes.length; i++) {
          const s = motes[i];
          const a = s.userData.a + prog * Math.PI * 2.5;
          const r = s.userData.r * conv;
          s.position.set(Math.cos(a) * r, SKY + Math.sin(prog * 6 + i) * 0.12, Math.sin(a) * r);
          s.scale.setScalar(0.6 + gather * 0.6);
          s.rotation.y = a * 2;
        }
        trailMat.opacity = 0.9 * (strike > 0 ? 1 : 0) * (1 - strike * 0.3);
        for (let i = 0; i < meteors.length; i++) {
          const mt = meteors[i];
          const local = Math.min(1, Math.max(0, (strike - i * 0.12) * 1.5));
          mt.visible = local > 0;
          const y = SKY - local * SKY;
          mt.position.set(mt.userData.tx * local, y, mt.userData.tz * local);
          mt.scale.setScalar(0.7 + local * 0.5);
        }
      };
      return g;
    }

export function buildCastFx_typhoonshot(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const arrowMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  // Two tilted swirling wind vortex rings stacked at chest height
  const ringA = m(geo("cfxTyphRingA", () => new T.TorusGeometry(0.9, 0.06, 8, 28)), ringMat);
  ringA.position.y = 0.85; ringA.rotation.x = -Math.PI/2 + 0.5; g.add(ringA);
  const ringB = m(geo("cfxTyphRingB", () => new T.TorusGeometry(0.6, 0.05, 8, 24)), ringMat);
  ringB.position.y = 1.05; ringB.rotation.x = -Math.PI/2 - 0.45; g.add(ringB);

  // Arrow streaks spiraling forward (+Z), built as thin boxes with cone heads
  const arrows = [];
  for (let i = 0; i < 6; i++) {
    const a = new T.Group();
    const shaft = m(box(0.04, 0.04, 0.9), arrowMat); shaft.position.z = 0.0; a.add(shaft);
    const head = m(cone(0.1, 0.22, 6), arrowMat); head.rotation.x = Math.PI/2; head.position.z = 0.5; a.add(head);
    a.userData.a = (i / 6) * Math.PI * 2;
    a.userData.r = 0.5 + (i % 3) * 0.18;
    a.position.y = 0.95;
    g.add(a); arrows.push(a);
  }

  g.userData.castAnim = (grp, prog) => {
    const coil = Math.min(prog / 0.5, 1);
    const rel = Math.max((prog - 0.5) / 0.5, 0);
    const env = Math.sin(prog * Math.PI);
    ringMat.opacity = 0.5 * env;
    arrowMat.opacity = 0.7 * rel * (1 - rel * 0.3);
    // Rings wind up tight then expand on release, spinning fast
    const spin = prog * Math.PI * 2 * 4;
    ringA.rotation.z = spin; ringB.rotation.z = -spin * 1.3;
    const grow = 0.4 + coil * 0.3 + rel * 0.8;
    ringA.scale.setScalar(grow); ringB.scale.setScalar(grow * 0.85);
    // Arrows spiral and shoot forward, fanning outward as they go
    for (let i = 0; i < arrows.length; i++) {
      const ar = arrows[i];
      const ang = ar.userData.a + spin * 0.6;
      const reach = rel * 3.2;
      const spread = ar.userData.r * (0.6 + rel * 1.4);
      ar.position.x = Math.cos(ang) * spread;
      ar.position.z = 0.4 + reach;
      ar.position.y = 0.95 + Math.sin(ang) * spread * 0.4;
      ar.rotation.y = ang * 0.3 + (ar.userData.a - Math.PI) * 0.4;
      ar.scale.setScalar(0.6 + rel * 0.6);
    }
  };
  return g;
}

export function buildCastFx_soulharvest(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();

  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.4, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxShReapRing", () => new T.RingGeometry(3.4, 3.95, 40)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.7; g.add(ring);

  const wispMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.9, blending:T.AdditiveBlending, depthWrite:false });
  const wisps = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const w = m(geo("cfxShWisp", () => new T.SphereGeometry(0.12, 8, 8)), wispMat);
    w.userData.a = (i / N) * Math.PI * 2;
    w.userData.ph = (i / N);
    g.add(w); wisps.push(w);
  }

  const coreMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const core = m(geo("cfxShCore", () => new T.SphereGeometry(0.45, 12, 12)), coreMat);
  core.position.y = 1.0; g.add(core);

  const pillarMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const pillar = m(cyl(0.18, 0.05, 2.2, 10), pillarMat);
  pillar.position.y = 1.1; g.add(pillar);

  g.userData.castAnim = (grp, prog) => {
    const reap = Math.min(prog / 0.62, 1);
    const draw = Math.max((prog - 0.62) / 0.38, 0);
    const reapE = Math.sin(reap * Math.PI * 0.5);

    ringMat.opacity = 0.45 * reapE * (1 - draw * 0.8);
    ring.rotation.z = reap * Math.PI * 1.2;
    ring.scale.setScalar(1 - draw * 0.3);

    const inward = draw;
    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i];
      const local = Math.min(Math.max((prog - w.userData.ph * 0.25) / 0.75, 0), 1);
      const rad = 3.6 * (1 - inward) * (1 - local * 0.15);
      const spin = w.userData.a + prog * Math.PI * 3.2 + inward * Math.PI * 2.5;
      const rNow = rad * (1 - inward * 0.95);
      w.position.x = Math.cos(spin) * rNow;
      w.position.z = Math.sin(spin) * rNow;
      w.position.y = 0.5 + inward * (0.7 + (i % 3) * 0.18) + reapE * 0.1;
      const s = 0.7 + reapE * 0.5 + inward * 0.6;
      w.scale.setScalar(s);
    }
    wispMat.opacity = 0.85 * Math.min(reap * 1.4, 1) * (1 - draw * 0.5);

    coreMat.opacity = draw * 0.85;
    core.scale.setScalar(0.4 + draw * 1.3 + Math.sin(prog * 40) * 0.05 * draw);

    pillarMat.opacity = draw * 0.5 * (1 - draw * 0.4);
    pillar.scale.y = 0.3 + draw * 1.1;
    pillar.scale.x = pillar.scale.z = 0.5 + draw * 0.8;
  };

  return g;
}

// expose the cache for the engine (warm-up / disposal if needed)
export const _cache = { GEO, MATS };
