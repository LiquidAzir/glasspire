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

// Strengthened: bolder corner-ironwork silhouette + plinth, bright haloed cross-lock, full-width glowing lid seam, brighter pulsing treasure spill/beam/halo; rarity themed by opts.color; keeps opts.open + userData.anim hook.
export function buildProp_chest(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#caa24a';
  const open = !!(opts && opts.open);
  const wood = mat('#3a2a18');
  const woodDark = mat('#221810');
  const iron = mat('#454b58');
  const ironDark = mat('#2b303a');
  // animated glows must be UNIQUE materials (never cached)
  const seamMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const lockMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 1.0, blending: T.AdditiveBlending, depthWrite: false });
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false });

  // --- BODY: bold blocky coffer on a dark plinth -----------------------------
  const plinth = m(box(0.78, 0.08, 0.58), woodDark); plinth.position.set(0, 0.04, 0);
  const base = m(box(0.66, 0.34, 0.46), wood); base.position.set(0, 0.25, 0);
  g.add(plinth, base);

  // chunky corner ironwork (4 verticals) — strong vertical silhouette
  const cx = 0.31, cz = 0.245;
  [[-cx, -cz], [cx, -cz], [-cx, cz], [cx, cz]].forEach((p) => {
    const post = m(box(0.08, 0.40, 0.08), iron); post.position.set(p[0], 0.25, p[1]); g.add(post);
  });
  // horizontal iron belt across the front/back
  const beltF = m(box(0.7, 0.07, 0.04), iron); beltF.position.set(0, 0.20, 0.235);
  const beltB = m(box(0.7, 0.07, 0.04), iron); beltB.position.set(0, 0.20, -0.235);
  g.add(beltF, beltB);

  // --- LID: hinged, gabled ridge for a bolder top profile --------------------
  const lid = new T.Group(); lid.position.set(0, 0.42, -0.23);
  const lidTop = m(box(0.66, 0.14, 0.46), wood); lidTop.position.set(0, 0.05, 0.23);
  const ridge = m(cone(0.34, 0.18, 4), ironDark); ridge.rotation.z = Math.PI / 4; ridge.rotation.y = Math.PI / 4; ridge.position.set(0, 0.13, 0.23); ridge.scale.set(1, 0.6, 1.42);
  const lidBeltL = m(box(0.08, 0.16, 0.48), iron); lidBeltL.position.set(-0.27, 0.05, 0.23);
  const lidBeltR = m(box(0.08, 0.16, 0.48), iron); lidBeltR.position.set(0.27, 0.05, 0.23);
  lid.add(lidTop, ridge, lidBeltL, lidBeltR);
  if (open) lid.rotation.x = -1.2;
  g.add(lid);

  // --- BRIGHT lid seam (full-width emissive line where lid meets body) -------
  const seam = m(box(0.64, 0.035, 0.04), seamMat); seam.position.set(0, 0.42, 0.235); g.add(seam);

  // --- BOLD glowing lock: plate + halo + cross keyhole -----------------------
  const lockPlate = m(box(0.2, 0.22, 0.05), ironDark); lockPlate.position.set(0, 0.26, 0.245);
  const halo = m(box(0.17, 0.19, 0.03), haloMat); halo.position.set(0, 0.26, 0.265);
  const keyV = m(box(0.05, 0.12, 0.04), lockMat); keyV.position.set(0, 0.26, 0.28);
  const keyH = m(box(0.11, 0.045, 0.04), lockMat); keyH.position.set(0, 0.235, 0.28);
  g.add(lockPlate, halo, keyV, keyH);

  if (open) {
    // bright treasure spilling out
    const spillMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
    const beamMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
    const sparkMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });

    const spill = m(box(0.52, 0.34, 0.36), spillMat); spill.position.set(0, 0.5, 0.02);
    const beam = m(cone(0.26, 0.78, 6), beamMat); beam.position.set(0, 0.78, 0);
    const sparkA = m(box(0.09, 0.09, 0.09), sparkMat); sparkA.position.set(-0.13, 0.6, 0.06);
    const sparkB = m(box(0.07, 0.07, 0.07), spillMat); sparkB.position.set(0.15, 0.68, -0.04);
    g.add(spill, beam, sparkA, sparkB);

    g.userData.anim = (gr, now) => {
      const f = 1 + Math.sin(now / 200) * 0.16;
      spill.scale.set(f, f, f);
      spillMat.opacity = 0.8 + Math.sin(now / 200) * 0.15;
      beam.scale.y = 1 + Math.sin(now / 300) * 0.22;
      beamMat.opacity = 0.45 + Math.sin(now / 260) * 0.18;
      sparkA.position.y = 0.6 + Math.sin(now / 240) * 0.06;
      sparkB.position.y = 0.68 + Math.sin(now / 190 + 1.5) * 0.06;
      seamMat.opacity = 0.8 + Math.sin(now / 220) * 0.18;
    };
  } else {
    g.userData.anim = (gr, now) => {
      // breathing lock + lid-seam pulse when closed
      const p = 0.8 + Math.sin(now / 360) * 0.2;
      lockMat.opacity = p;
      haloMat.opacity = 0.3 + Math.sin(now / 360) * 0.2;
      seamMat.opacity = 0.55 + Math.sin(now / 300 + 1.0) * 0.25;
      const s = 0.9 + Math.sin(now / 360) * 0.12;
      keyV.scale.set(s, 1, 1); keyH.scale.set(1, s, 1);
    };
  }
  return g;
}

// Strengthened: bolder double bright outer ring + halo glow disc, brighter swirling faceted vortex arms, hotter pulsing white core w/ energy plane; same opts/anim hook, feet at origin.
export function buildProp_portal(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#9a4dff';
  const ringMatHot = matAdd('#ffffff', 0.9);          // bright rim highlight (shared, static)
  const ringMat = matAdd(c, 0.85);
  const ringMat2 = matAdd(c, 0.6);
  const haloMat = matAdd(c, 0.28);                     // big soft glow disc behind the gate
  const stoneMat = mat('#241d30');

  // dark stone footing pillars so the portal reads as standing on the ground
  const baseL = m(box(0.18, 0.55, 0.18), stoneMat); baseL.position.set(-0.55, 0.275, 0);
  const baseR = m(box(0.18, 0.55, 0.18), stoneMat); baseR.position.set(0.55, 0.275, 0);
  // bright rune caps on the pillars
  const capL = m(box(0.2, 0.08, 0.2), ringMat); capL.position.set(-0.55, 0.56, 0);
  const capR = m(box(0.2, 0.08, 0.2), ringMat); capR.position.set(0.55, 0.56, 0);
  g.add(baseL, baseR, capL, capR);

  // the swirling vortex stands vertical, facing +Z. Pivot group at center height.
  const vortex = new T.Group(); vortex.position.set(0, 0.92, 0);

  // big soft halo glow disc behind everything -> bold bright silhouette at small size
  const halo = m(cyl(0.78, 0.78, 0.02, 16), haloMat); halo.rotation.x = Math.PI / 2;
  halo.position.z = -0.04;
  vortex.add(halo);

  // outer glowing ring (torus in XY plane -> faces +Z) - THICKER + brighter
  const ringGeo = geo('portalRingOuter', () => new T.TorusGeometry(0.62, 0.1, 8, 18));
  const ring = m(ringGeo, ringMat);
  vortex.add(ring);

  // hot white rim torus on top of the outer ring for a blazing edge
  const ringHotGeo = geo('portalRingRim', () => new T.TorusGeometry(0.62, 0.045, 6, 18));
  const ringHot = m(ringHotGeo, ringMatHot);
  vortex.add(ringHot);

  // inner ring, counter-spun
  const ringGeo2 = geo('portalRingInner', () => new T.TorusGeometry(0.42, 0.06, 6, 16));
  const ring2 = m(ringGeo2, ringMat2);
  vortex.add(ring2);

  // bright energy field plane filling the gate (animated -> unique basic material)
  const fieldMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
  const fieldGeo = geo('portalField', () => new T.CircleGeometry(0.52, 18));
  const field = m(fieldGeo, fieldMat); field.position.z = 0.005;
  vortex.add(field);

  // swirling spokes -> faceted vortex arms, brighter + tapered
  const arms = [];
  for (let i = 0; i < 6; i++) {
    const a = m(box(0.08, 0.52, 0.05), ringMat2);
    a.position.set(0, 0, 0.02);
    a.rotation.z = (i / 6) * Math.PI * 2;
    vortex.add(a);
    arms.push(a);
  }

  // bright core flat disc, facing +Z (animated pulse -> unique basic material)
  const coreMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(cyl(0.24, 0.24, 0.05, 14), coreMat); core.rotation.x = Math.PI / 2;
  core.position.z = 0.01;
  vortex.add(core);

  g.add(vortex);

  g.userData.anim = (gr, now) => {
    ring.rotation.z = now / 900;
    ringHot.rotation.z = now / 900;
    ring2.rotation.z = -now / 520;
    // hot core pulse
    const p = 0.82 + Math.sin(now / 240) * 0.22;
    core.scale.set(p, p, p);
    coreMat.opacity = 0.7 + Math.sin(now / 200) * 0.25;
    // energy field flicker + slow spin
    field.rotation.z = now / 1400;
    const fp = 1.0 + Math.sin(now / 330) * 0.06;
    field.scale.set(fp, fp, 1);
    fieldMat.opacity = 0.34 + Math.sin(now / 180) * 0.12;
    // swirling arms
    for (let i = 0; i < arms.length; i++) {
      arms[i].rotation.z = (i / arms.length) * Math.PI * 2 + now / 460;
    }
  };
  return g;
}

// Strengthened: bolder stepped angular pedestal + 4 corner spike finials + brighter, larger faceted floating orb-sigil with a double cross-glint, halo ring and pulsing light pillar; unique anim materials.
export function buildProp_shrine(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#52e0c4';
  const stone = mat('#2c2a34');
  const stoneTop = mat('#3a3744');
  const runeSoft = matAdd(c, 0.5);

  // BOLD stepped stone base (wider, more angular -> stronger silhouette)
  const base = m(box(0.7, 0.16, 0.7), stone); base.position.set(0, 0.08, 0);
  const mid = m(box(0.5, 0.14, 0.5), stone); mid.position.set(0, 0.23, 0);
  const collar = m(box(0.36, 0.08, 0.36), stoneTop); collar.position.set(0, 0.34, 0);
  // tapered hexagonal obelisk pillar
  const pillar = m(cyl(0.14, 0.22, 0.6, 6), stone); pillar.position.set(0, 0.68, 0);
  // capstone
  const cap = m(cone(0.22, 0.2, 6), stoneTop); cap.position.set(0, 1.06, 0);
  g.add(base, mid, collar, pillar, cap);

  // 4 corner spike finials on the base -> reads as ornate/interactable
  const spikeGeo = geo('shrineSpike', () => new T.ConeGeometry(0.05, 0.26, 4));
  for (let i = 0; i < 4; i++) {
    const sp = m(spikeGeo, stoneTop);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    sp.position.set(Math.cos(a) * 0.28, 0.43, Math.sin(a) * 0.28);
    g.add(sp);
  }

  // bright glowing rune carved into the pillar front
  const carve = m(box(0.12, 0.26, 0.03), runeSoft); carve.position.set(0, 0.66, 0.2);
  g.add(carve);

  // ---- floating glowing orb/sigil (UNIQUE animated materials) ----
  const orbMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95 });
  const glowMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });

  const rune = new T.Group(); rune.position.set(0, 1.42, 0);

  // bigger faceted diamond orb
  const dGeo = geo('shrineRuneOcta', () => new T.OctahedronGeometry(0.2, 0));
  const diamond = m(dGeo, orbMat); rune.add(diamond);
  // bright white inner core for a hot center
  const core = m(geo('shrineRuneCore', () => new T.OctahedronGeometry(0.09, 0)), coreMat); rune.add(core);

  // double cross-glints (4 bars) -> sharper sparkle silhouette
  const glintH = m(box(0.46, 0.05, 0.05), glowMat); rune.add(glintH);
  const glintV = m(box(0.05, 0.46, 0.05), glowMat); rune.add(glintV);
  const glintD1 = m(box(0.36, 0.035, 0.035), glowMat); glintD1.rotation.z = Math.PI / 4; rune.add(glintD1);
  const glintD2 = m(box(0.36, 0.035, 0.035), glowMat); glintD2.rotation.z = -Math.PI / 4; rune.add(glintD2);

  // halo ring
  const halo = m(geo('shrineHalo', () => new T.TorusGeometry(0.28, 0.022, 6, 18)), glowMat);
  halo.rotation.x = Math.PI / 2; rune.add(halo);
  g.add(rune);

  // bright light pillar connecting orb to capstone (reads as energized/interactable)
  const beam = m(geo('shrineBeam', () => new T.CylinderGeometry(0.05, 0.09, 0.34, 6)), glowMat);
  beam.position.set(0, 1.21, 0); g.add(beam);

  g.userData.anim = (gr, now) => {
    rune.position.y = 1.42 + Math.sin(now / 600) * 0.08;
    rune.rotation.y = now / 1100;
    const p = 0.88 + Math.sin(now / 320) * 0.14;
    diamond.scale.set(p, p, p);
    const cp = 0.85 + Math.sin(now / 200) * 0.2;
    core.scale.set(cp, cp, cp);
    coreMat.opacity = 0.7 + Math.sin(now / 200) * 0.25;
    const hp = 0.95 + Math.sin(now / 320) * 0.1;
    halo.scale.set(hp, hp, 1);
    halo.rotation.z = now / 800;
    glowMat.opacity = 0.34 + Math.sin(now / 280) * 0.12;
    beam.scale.y = 0.9 + Math.sin(now / 240) * 0.12;
  };
  return g;
}

// Strengthened: bolder tiered basin silhouette + 4 bright glowing water arcs, brighter twin-tier pools, taller luminous central plume + halo glow; richer animation (swaying arcs, pulsing pools, falling drops).
export function buildProp_fountain(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#6fb8ff';
  const stone = mat('#2e2c36');
  const stoneLip = mat('#403d4a');
  const waterMat = matAdd(c, 0.6);
  const poolMat = matAdd(c, 0.85);
  const arcMat = matAdd(c, 0.7);
  const plumeMat = matAdd(c, 0.9);
  const haloMat = matAdd(c, 0.3);
  const dropMat = matAdd('#ffffff', 0.7);

  // --- lower wide basin (bottom sits at y=0) ---
  const basin = m(cyl(0.62, 0.66, 0.24, 12), stone); basin.position.set(0, 0.12, 0);
  const lip = m(cyl(0.7, 0.6, 0.07, 12), stoneLip); lip.position.set(0, 0.26, 0);
  // bright luminous pool (brighter core disc + soft wide glow ring read at distance)
  const pool1 = m(cyl(0.58, 0.58, 0.05, 12), poolMat); pool1.position.set(0, 0.225, 0);
  const glow1 = m(cyl(0.6, 0.6, 0.02, 12), waterMat); glow1.position.set(0, 0.255, 0);
  g.add(basin, lip, pool1, glow1);

  // --- central pedestal ---
  const stem = m(cyl(0.15, 0.22, 0.36, 6), stone); stem.position.set(0, 0.44, 0);
  // --- upper tier basin ---
  const upper = m(cyl(0.3, 0.36, 0.13, 12), stone); upper.position.set(0, 0.66, 0);
  const upperLip = m(cyl(0.38, 0.3, 0.05, 12), stoneLip); upperLip.position.set(0, 0.735, 0);
  const pool2 = m(cyl(0.28, 0.28, 0.04, 12), poolMat); pool2.position.set(0, 0.72, 0);
  g.add(stem, upper, upperLip, pool2);

  // --- bright glowing central plume + halo ---
  const plume = m(cone(0.13, 0.62, 6), plumeMat); plume.position.set(0, 1.08, 0);
  const plumeCap = m(cyl(0.03, 0.11, 0.2, 6), plumeMat); plumeCap.position.set(0, 1.42, 0);
  const halo = m(cyl(0.2, 0.2, 0.02, 12), haloMat); halo.rotation.x = Math.PI / 2; halo.position.set(0, 1.3, 0);
  g.add(plume, plumeCap, halo);

  // --- 4 bright glowing water arcs spilling from upper basin into the pool ---
  const arcGeo = geo('fountainArc', () => new T.BoxGeometry(0.05, 0.46, 0.05));
  const arcs = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const arc = m(arcGeo, arcMat);
    arc.position.set(Math.cos(a) * 0.42, 0.5, Math.sin(a) * 0.42);
    arc.rotation.z = Math.cos(a) * 0.45;
    arc.rotation.x = -Math.sin(a) * 0.45;
    arcs.push(arc);
    g.add(arc);
  }

  // --- falling droplet glints ---
  const dropA = m(box(0.06, 0.06, 0.06), dropMat); dropA.position.set(0.17, 0.95, 0);
  const dropB = m(box(0.06, 0.06, 0.06), dropMat); dropB.position.set(-0.15, 0.88, 0.05);
  g.add(dropA, dropB);

  g.userData.anim = (gr, now) => {
    const sh = 1 + Math.sin(now / 180) * 0.12;
    plume.scale.set(1, sh, 1);
    plume.position.y = 1.08 + (sh - 1) * 0.31;
    plumeCap.position.y = 1.42 + Math.sin(now / 180) * 0.05;
    const hp = 0.9 + Math.sin(now / 260) * 0.18;
    halo.scale.set(hp, 1, hp);
    halo.position.y = 1.3 + Math.sin(now / 600) * 0.04;
    // arcs gently sway as if spilling water
    for (let i = 0; i < arcs.length; i++) {
      const s = 1 + Math.sin(now / 220 + i * 1.6) * 0.18;
      arcs[i].scale.set(1, s, 1);
    }
    // droplets fall and loop
    dropA.position.y = 1.0 - ((now / 600) % 1) * 0.48;
    dropB.position.y = 0.95 - (((now / 600) + 0.5) % 1) * 0.42;
    // pools shimmer
    const w = 0.92 + Math.sin(now / 400) * 0.08;
    pool1.scale.set(w, 1, w);
    glow1.scale.set(w, 1, w);
    pool2.scale.set(w, 1, w);
  };
  return g;
}

// Strengthened: bolder fanned coin stack + brighter emissive coin faces, scattered glint coins, and a pulsing-glint hero coin (unique animated material).
export function buildItem_coin(opts) {
  const c = (opts && opts.color) || '#ffcf52';
  const g = new T.Group();

  // --- Bold gold pile: a wide chunky base with stacked discs, brighter than before ---
  const goldBody = mat(c, 0.62);      // solid warm gold body (was 0.45 — brighter)
  const goldEdge = matAdd(c, 0.5);    // additive rim glow so the pile reads as metal
  const pileGeoBase = geo('coin_pileBase', () => cyl(0.17, 0.21, 0.07, 8));
  const pileGeoMid  = geo('coin_pileMid',  () => cyl(0.12, 0.15, 0.06, 8));
  const pileGeoTop  = geo('coin_pileTop',  () => cyl(0.08, 0.10, 0.05, 8));
  const pileGeoEdge = geo('coin_pileEdge', () => cyl(0.175, 0.215, 0.02, 8));

  const pileA = m(pileGeoBase, goldBody); pileA.position.set(0, 0.035, 0);
  const pileRim = m(pileGeoEdge, goldEdge); pileRim.position.set(0, 0.07, 0); // bright top rim of the base
  const pileB = m(pileGeoMid, goldBody);  pileB.position.set(0.05, 0.10, -0.02); pileB.rotation.y = 0.4;
  const pileC = m(pileGeoTop, goldBody);  pileC.position.set(-0.06, 0.085, 0.04); pileC.rotation.y = -0.5;
  g.add(pileA, pileRim, pileB, pileC);

  // --- A few scattered glint coins lying flat, bright additive faces catch the eye ---
  const glintMat = matAdd(c, 0.7);
  const flatGeo = geo('coin_flat', () => cyl(0.07, 0.07, 0.018, 8));
  const layout = [[0.13, 0.012, 0.10, 0.3], [-0.14, 0.012, -0.07, -0.6], [0.02, 0.012, -0.15, 0.9]];
  for (const [x, y, z, ry] of layout) {
    const fc = m(flatGeo, glintMat);
    fc.position.set(x, y, z); fc.rotation.x = Math.PI / 2; fc.rotation.z = ry;
    g.add(fc);
  }

  // --- Hero coin: a bigger thin disc standing on edge, very bright, with a pulsing glint ---
  const coin = new T.Group(); coin.position.set(0, 0.26, 0);
  const discGeo = geo('coin_disc', () => cyl(0.15, 0.15, 0.035, 12));
  const disc = m(discGeo, mat(c, 1.0));
  disc.rotation.x = Math.PI / 2; // flat faces along +/-Z
  coin.add(disc);

  // Bright emissive inner face — UNIQUE material so we can pulse its brightness.
  const faceMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const faceGeo = geo('coin_face', () => cyl(0.105, 0.105, 0.04, 10));
  const face = m(faceGeo, faceMat); face.rotation.x = Math.PI / 2;
  coin.add(face);

  // Bold rune cross on the front face — two crossed bars, near-white, reads at small size.
  const runeGeo = geo('coin_rune', () => box(0.035, 0.11, 0.022));
  const runeA = m(runeGeo, matAdd('#fff4cf', 0.95)); runeA.position.set(0, 0, 0.022);
  const runeB = m(runeGeo, matAdd('#fff4cf', 0.95)); runeB.position.set(0, 0, 0.022); runeB.rotation.z = Math.PI / 2;
  coin.add(runeA, runeB);
  g.add(coin);

  g.userData.glintMat = faceMat; // expose the animated material
  g.userData.anim = (grp, now) => {
    const ud = grp.userData;
    const cn = grp.children[grp.children.length - 1]; // hero coin sub-group
    cn.rotation.y = now / 280;
    cn.position.y = 0.26 + Math.sin(now / 420) * 0.015; // gentle bob
    if (ud.glintMat) ud.glintMat.opacity = 0.7 + Math.abs(Math.sin(now / 200)) * 0.3; // pulsing glint
  };
  return g;
}

export function buildItem_gem(opts) {
  // STRENGTHENED: bolder faceted octahedron silhouette (dim hull + bright additive core),
  // sharp angular sparkle spikes + brighter white glint; pulsing animated core (unique mat).
  const c = (opts && opts.color) || '#7ad0ff';
  const g = new T.Group();
  const gem = new T.Group(); gem.position.set(0, 0.28, 0);

  // Dim faceted hull — a chunkier stretched octahedron via two stacked 4-sided cones.
  const body = mat(c, 0.5);
  const upper = m(cone(0.18, 0.24, 4), body); upper.position.set(0, 0.09, 0); upper.rotation.y = Math.PI / 4;
  const lower = m(cone(0.18, 0.20, 4), body); lower.position.set(0, -0.07, 0); lower.rotation.y = Math.PI / 4; lower.rotation.x = Math.PI;

  // Bright additive core (UNIQUE material so the pulse animation never touches the cache).
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  const coreU = m(cone(0.10, 0.15, 4), coreMat); coreU.position.set(0, 0.07, 0); coreU.rotation.y = Math.PI / 4;
  const coreL = m(cone(0.10, 0.13, 4), coreMat); coreL.position.set(0, -0.05, 0); coreL.rotation.y = Math.PI / 4; coreL.rotation.x = Math.PI;

  // Sharp angular sparkle: four thin bright spikes radiating from the gem — a hard star glint.
  const spikeMat = matAdd('#eaffff', 0.7);
  const spikeGeoH = geo('gem_spikeH', () => box(0.5, 0.02, 0.02));
  const spikeGeoV = geo('gem_spikeV', () => box(0.02, 0.5, 0.02));
  const spikeH = m(spikeGeoH, spikeMat); spikeH.position.set(0, 0.02, 0.0);
  const spikeV = m(spikeGeoV, spikeMat); spikeV.position.set(0, 0.02, 0.0);
  const spikes = new T.Group(); spikes.add(spikeH, spikeV); spikes.rotation.z = Math.PI / 4;

  // Hot white glint hugging a top facet.
  const glint = m(box(0.05, 0.05, 0.05), matAdd('#ffffff', 0.95)); glint.position.set(0.06, 0.06, 0.08);

  gem.add(upper, lower, coreU, coreL, spikes, glint);
  g.add(gem);

  g.userData.anim = (grp, now) => {
    const gm = grp.children[0];
    gm.rotation.y = now / 700;
    gm.position.y = 0.28 + Math.sin(now / 520) * 0.045;
    // Pulse the core brightness + spin the star spikes for sharp twinkle.
    coreMat.opacity = 0.7 + Math.sin(now / 200) * 0.25;
    const sp = gm.children[4];
    if (sp) sp.rotation.z = Math.PI / 4 + now / 900;
  };
  return g;
}

export function buildItem_potion(opts) {
  // Strengthened: bolder faceted flask + dominant bright liquid core, glowing rim band, larger cork; added pulsing-glow anim hook (unique mats).
  const c = (opts && opts.color) || '#ff4d6d';
  const g = new T.Group();

  // Dim tinted glass shell — kept thin/low so it never mutes the inner glow.
  const glass = mat(c, 0.28);
  const belly = m(geo('potion_belly', () => cyl(0.17, 0.12, 0.2, 6)), glass);
  belly.position.set(0, 0.14, 0);
  const shoulder = m(geo('potion_shoulder', () => cone(0.17, 0.13, 6)), glass);
  shoulder.position.set(0, 0.305, 0);
  const neck = m(geo('potion_neck', () => cyl(0.07, 0.08, 0.11, 6)), glass);
  neck.position.set(0, 0.41, 0);

  // BRIGHT liquid core — the dominant emissive mass, animated (unique mat).
  const liquidMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95 });
  const liquid = m(geo('potion_liquid', () => cyl(0.135, 0.1, 0.16, 6)), liquidMat);
  liquid.position.set(0, 0.12, 0);

  // Glowing meniscus rim band — a hard bright edge that pops the silhouette.
  const rimMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.9 });
  const rim = m(geo('potion_rim', () => cyl(0.142, 0.142, 0.03, 6)), rimMat);
  rim.position.set(0, 0.2, 0);

  // Rising bright bubbles inside the liquid.
  const bubMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.8 });
  const bub1 = m(geo('potion_bubble', () => box(0.035, 0.035, 0.035)), bubMat);
  bub1.position.set(0.045, 0.12, 0.07);
  const bub2 = m(geo('potion_bubble'), bubMat);
  bub2.position.set(-0.05, 0.07, 0.05); bub2.scale.setScalar(0.7);

  // Bold cork stopper, warm dim wood.
  const cork = m(geo('potion_cork', () => cyl(0.075, 0.065, 0.09, 6)), mat('#a6724a', 0.7));
  cork.position.set(0, 0.5, 0);
  const corkTop = m(geo('potion_corktop', () => box(0.11, 0.04, 0.11)), mat('#8a5e3c', 0.7));
  corkTop.position.set(0, 0.555, 0);

  g.add(belly, shoulder, neck, liquid, rim, bub1, bub2, cork, corkTop);

  g.userData.anim = (grp, now) => {
    const t = now * 0.001;
    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
    liquidMat.opacity = 0.7 + 0.28 * pulse;
    rimMat.opacity = 0.65 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + 1));
    bub1.position.y = 0.07 + 0.09 * ((t * 0.6) % 1);
    bub2.position.y = 0.06 + 0.09 * ((t * 0.6 + 0.5) % 1);
    grp.position.y = Math.sin(t * 1.5) * 0.012;
    grp.rotation.y = t * 0.5;
  };

  return g;
}

// Strengthened: bolder BRIGHT gear silhouette (chunky cog teeth + glowing hub) over a wide additive ground-glow disc; crossed-weapon hint, brighter pulsing core, unique anim mat.
export function buildItem_gear(opts) {
  const c = (opts && opts.color) || '#b070ff';
  const g = new T.Group();

  // --- Wide ground glow: a flat additive disc + crisp rim ring (reads as a dropped-loot beacon) ---
  const glow = m(geo('itemGearGlowDisc', () => new T.CircleGeometry(0.34, 20)), matAdd(c, 0.28));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.012;
  g.add(glow);
  const ring = m(geo('itemGearRing', () => new T.TorusGeometry(0.26, 0.03, 4, 18)), matAdd(c, 0.7));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
  g.add(ring);

  // --- Hovering gear (the icon). children[1] = the floating piece the anim lifts/spins ---
  const gear = new T.Group(); gear.position.set(0, 0.36, 0);

  // Dark gear body disc (bold opaque silhouette)
  const body = m(geo('itemGearBody', () => new T.CylinderGeometry(0.17, 0.17, 0.07, 12)), mat(c, 0.32));
  body.rotation.x = Math.PI / 2;
  gear.add(body);

  // Chunky cog teeth — 6 fat blocks around the rim (bold, reads at small size)
  const toothGeo = geo('itemGearTooth', () => new T.BoxGeometry(0.08, 0.09, 0.075));
  const toothMat = mat(c, 0.42);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const t = m(toothGeo, toothMat);
    t.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0);
    t.rotation.z = a;
    gear.add(t);
  }

  // Bright emissive rim ring hugging the gear (silhouette pop)
  const rim = m(geo('itemGearRim', () => new T.TorusGeometry(0.175, 0.022, 4, 16)), matAdd(c, 0.85));
  gear.add(rim);

  // Crossed-weapon hint: two bright bars through the hub (equipment read) — unique anim core mat below
  const barGeo = geo('itemGearBar', () => new T.BoxGeometry(0.34, 0.035, 0.05));
  const barMat = matAdd(c, 0.6);
  const bar1 = m(barGeo, barMat); bar1.rotation.z = Math.PI / 4; gear.add(bar1);
  const bar2 = m(barGeo, barMat); bar2.rotation.z = -Math.PI / 4; gear.add(bar2);

  // Glowing hub core (animated → fresh unique MeshBasicMaterial, never cached)
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('itemGearCore', () => new T.CylinderGeometry(0.07, 0.07, 0.1, 8)), coreMat);
  core.rotation.x = Math.PI / 2;
  gear.add(core);
  const spark = m(geo('itemGearSpark', () => new T.BoxGeometry(0.05, 0.05, 0.05)), matAdd('#ffffff', 0.95));
  spark.position.z = 0.06;
  gear.add(spark);

  g.add(gear);

  g.userData.coreMat = coreMat;
  g.userData.anim = (grp, now) => {
    const gl = grp.children[0];
    const rg = grp.children[1];
    const gr = grp.children[2];
    const pulse = 1 + Math.sin(now / 360) * 0.16;
    if (rg) rg.scale.set(pulse, pulse, 1);
    if (gl) gl.scale.set(pulse, pulse, 1);
    gr.position.y = 0.36 + Math.sin(now / 620) * 0.05;
    gr.rotation.z = now / 1100;
    coreMat.opacity = 0.7 + Math.sin(now / 240) * 0.25;
  };
  return g;
}

// Strengthened: bolder hood/robe silhouette + a bright halo ring, glowing face, emissive robe trim band, and a brighter pulsing lantern for a warm, iconic "talk to me" read at small size.
export function buildNpc(opts) {
  const g = new T.Group();
  const c = (opts && opts.color) || '#caa15a';
  const robe = mat(c, 0.5);
  const robeDark = mat(c, 0.3);
  const skin = mat('#b8946a', 0.85);

  // Unique animated materials (fresh, never cached) — these pulse.
  const faceMat = new T.MeshBasicMaterial({ color: new T.Color('#ffd79a') });
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const trimMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  const flameMat = new T.MeshBasicMaterial({ color: new T.Color('#ffe2a0'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const lanternGlowMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false });

  // Robe skirt: wide tapered base pooling at the feet — broad, grounded silhouette.
  const skirt = m(geo('npc_skirt', () => cyl(0.22, 0.4, 0.66, 6)), robeDark); skirt.position.set(0, 0.33, 0);
  // Torso: slim faceted prism, calm upright posture.
  const torso = m(geo('npc_torso', () => box(0.36, 0.44, 0.27)), robe); torso.position.set(0, 0.82, 0);
  // Bright emissive trim band across the chest — a bold horizontal accent that pops.
  const trim = m(geo('npc_trim', () => box(0.38, 0.07, 0.29)), trimMat); trim.position.set(0, 0.74, 0.01);
  // Shoulder cowl tapering up to the hood — wider for a stronger shoulder line.
  const cowl = m(geo('npc_cowl', () => cone(0.3, 0.3, 6)), robe); cowl.position.set(0, 1.06, 0);
  // Tall hood point — taller/sharper for an iconic peaked-hood read.
  const hood = m(geo('npc_hood', () => cone(0.19, 0.34, 6)), robeDark); hood.position.set(0, 1.24, 0);

  // Halo ring behind the head: a big soft glow that makes the figure read from afar.
  const halo = m(geo('npc_halo', () => cyl(0.26, 0.26, 0.02, 10)), haloMat); halo.position.set(0, 1.06, -0.08); halo.rotation.x = Math.PI / 2;

  // Hood opening: a warm lit face so the figure reads friendly, not a void.
  const face = m(geo('npc_face', () => box(0.17, 0.18, 0.06)), faceMat); face.position.set(0, 1.02, 0.18);
  const hoodGlow = m(geo('npc_hoodGlow', () => box(0.24, 0.24, 0.04)), matAdd(c, 0.5)); hoodGlow.position.set(0, 1.02, 0.14);

  // Folded arms resting across the front: peaceful, non-combative read.
  const armL = m(geo('npc_arm', () => box(0.13, 0.13, 0.32)), robe); armL.position.set(-0.19, 0.86, 0.09); armL.rotation.x = 0.5;
  const armR = m(geo('npc_arm', () => box(0.13, 0.13, 0.32)), robe); armR.position.set(0.19, 0.86, 0.09); armR.rotation.x = 0.5;

  // A warm lantern held at the side: clear, welcoming town signal.
  const handle = m(geo('npc_handle', () => box(0.03, 0.2, 0.03)), robeDark); handle.position.set(0.31, 0.66, 0.11);
  const lantern = m(geo('npc_lantern', () => box(0.15, 0.18, 0.15)), mat(c, 0.6)); lantern.position.set(0.31, 0.52, 0.11);
  const flame = m(geo('npc_flame', () => cone(0.06, 0.14, 5)), flameMat); flame.position.set(0.31, 0.53, 0.11);
  const lanternGlow = m(geo('npc_lanternGlow', () => box(0.22, 0.24, 0.22)), lanternGlowMat); lanternGlow.position.set(0.31, 0.52, 0.11);

  g.add(skirt, torso, trim, cowl, hood, halo, face, hoodGlow, armL, armR, handle, lantern, lanternGlow, flame);

  g.userData.anim = function (grp, now) {
    // Gentle breathing sway, a softly breathing face/halo, and a pulsing lantern.
    const s = Math.sin(now / 900);
    torso.rotation.z = s * 0.025;
    cowl.rotation.z = s * 0.03;
    hood.rotation.z = s * 0.03;
    halo.rotation.z = now / 2600;
    const breathe = 0.78 + Math.sin(now / 1100) * 0.22;
    faceMat.opacity = 0.7 + breathe * 0.3;
    haloMat.opacity = 0.4 + breathe * 0.35;
    trimMat.opacity = 0.5 + breathe * 0.3;
    const p = 0.9 + Math.sin(now / 320) * 0.14;
    flame.scale.set(1, p, 1);
    flameMat.opacity = 0.8 + (p - 0.9) * 1.2;
    lanternGlow.scale.setScalar(p);
    lanternGlowMat.opacity = 0.35 + (p - 0.9) * 0.6;
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
// Strengthened: bolder bright streak (glowing motion-trail + tapered shaft), bigger emissive arrowhead with a side flare, twin fletch fins, and a unique-material spin/pulse anim hook.
export function buildProjectile_arrow(opts) {
  const c = (opts && opts.color) || '#caa15a';
  const g = new T.Group();

  // Tapered dark shaft body — angular, reads as the arrow's spine
  const shaft = m(
    geo('arrow_shaft', () => cyl(0.018, 0.03, 0.52, 4)),
    mat('#171c27')
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.04;
  g.add(shaft);

  // Bright core streak running the length — the BOLD bright silhouette
  const streakMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const streak = m(geo('arrow_streak', () => box(0.035, 0.035, 0.46)), streakMat);
  streak.position.z = -0.02;
  g.add(streak);

  // Glowing arrowhead — bigger, the brightest accent leading the shape
  const headMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 1.0, blending: T.AdditiveBlending, depthWrite: false });
  const head = m(geo('arrow_head', () => cone(0.085, 0.2, 4)), headMat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.3;
  g.add(head);

  // Horizontal flare cross at the tip — widens the silhouette so it reads at small size
  const flareMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  const flare = m(geo('arrow_flare', () => plane(0.26, 0.07)), flareMat);
  flare.position.z = 0.22;
  g.add(flare);

  // Glowing motion-trail tail — long bright wedge behind the shaft (streak feel)
  const trailMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const trail = m(geo('arrow_trail', () => cone(0.05, 0.34, 4)), trailMat);
  trail.rotation.x = -Math.PI / 2;
  trail.position.z = -0.46;
  g.add(trail);

  // Twin fletch fins — bright vanes for the back-end silhouette
  const fletchMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });
  const fl1 = m(geo('arrow_fletch', () => plane(0.14, 0.1)), fletchMat);
  fl1.position.z = -0.28;
  const fl2 = m(geo('arrow_fletch', () => plane(0.14, 0.1)), fletchMat);
  fl2.position.z = -0.28; fl2.rotation.z = Math.PI / 2;
  g.add(fl1, fl2);

  g.userData.anim = (grp, now) => {
    const t = now * 0.001;
    grp.rotation.z = t * 9;              // spin for a streaking blur
    const p = 0.78 + Math.sin(t * 22) * 0.22;
    headMat.opacity = Math.min(1, p);
    streakMat.opacity = 0.78 + Math.sin(t * 22 + 1.0) * 0.18;
    const tr = 0.4 + Math.sin(t * 16) * 0.2;
    trailMat.opacity = tr;
    trail.scale.z = 0.85 + Math.sin(t * 16) * 0.25;
  };

  return g;
}
export function buildProjectile_bolt(opts) {
  // STRENGTHENED: elongated forward dart + bright halo + white-hot core + twin trail streaks; bolder/brighter silhouette, pulse anim (fresh mats).
  const c = (opts && opts.color) || '#9be8ff';
  const g = new T.Group();

  // Bright halo glow (reads big at small size) — fresh mat so we can pulse it.
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
  const halo = m(geo('boltHalo', () => new T.OctahedronGeometry(0.2, 0)), haloMat);

  // Forward-pointing dart body (gives +Z direction + angular silhouette).
  const dartMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const dart = m(geo('boltDart', () => new T.ConeGeometry(0.11, 0.42, 4)), dartMat);
  dart.rotation.x = Math.PI / 2; // tip toward +Z
  dart.position.z = 0.12;

  // White-hot core — brightest point.
  const core = m(geo('boltCore', () => new T.IcosahedronGeometry(0.07, 0)), matAdd('#ffffff', 1.0));

  // Twin trailing streaks behind (short trail, additive).
  const trailMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const trail = m(geo('boltTrail', () => new T.ConeGeometry(0.07, 0.5, 4)), trailMat);
  trail.rotation.x = -Math.PI / 2; // taper backward (-Z)
  trail.position.z = -0.28;

  g.add(halo, trail, dart, core);

  g.userData.anim = (grp, now) => {
    halo.rotation.z = now / 90;
    dart.rotation.z = now / 70;
    const p = 0.5 + 0.5 * Math.sin(now / 60);
    haloMat.opacity = 0.4 + 0.35 * p;
    const s = 0.9 + 0.25 * p;
    core.scale.setScalar(s);
    trailMat.opacity = 0.4 + 0.3 * (0.5 + 0.5 * Math.sin(now / 45 + 1.5));
  };
  return g;
}
export function buildProjectile_bone(opts) {
  // STRENGTHENED: bolder dual-knuckle bone silhouette + bright additive core/tip glow, angular knobs, faster tumble.
  const c = (opts && opts.color) || '#e8e2cf';
  const g = new T.Group();

  // Bright additive core that runs the length of the shard — reads as a glowing splinter even tiny.
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('bone_core', () => { const gg = new T.CylinderGeometry(0.05, 0.05, 0.46, 4); gg.rotateZ(Math.PI / 2); return gg; }), coreMat);
  g.add(core);

  // Solid bone shaft over the core for a bold opaque body.
  const shaft = m(geo('bone_shaft', () => { const gg = new T.CylinderGeometry(0.035, 0.035, 0.34, 5); gg.rotateZ(Math.PI / 2); return gg; }), mat(c, 0.95));
  g.add(shaft);

  // Angular knuckle knobs at each end (octahedron = gothic faceted, not round).
  const knob = () => m(geo('bone_knob', () => new T.OctahedronGeometry(0.085, 0)), mat(c, 1.0));
  const k1 = knob(); k1.position.x = -0.2; k1.rotation.z = 0.5;
  const k2 = knob(); k2.position.x = 0.2; k2.rotation.z = -0.5;
  g.add(k1, k2);

  // Bright additive tips — the hot points of the splinter.
  const tipMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 1.0, blending: T.AdditiveBlending, depthWrite: false });
  const tip = (x) => { const t = m(geo('bone_tip', () => new T.OctahedronGeometry(0.05, 0)), tipMat); t.position.x = x; return t; };
  g.add(tip(-0.24), tip(0.24));

  g.userData.anim = (grp, now) => {
    grp.rotation.z = now / 60;
    grp.rotation.x = now / 140;
    const p = 0.85 + Math.sin(now / 70) * 0.15;
    coreMat.opacity = p; tipMat.opacity = p;
  };
  return g;
}
// Strengthened: bolder 4-point starburst halo + brighter pulsing white core + longer twin tail wisps; halo/core use fresh animated materials (flicker), cheap (~7 prims).
export function buildProjectile_soul(opts) {
  const c = (opts && opts.color) || '#c489ff';
  const g = new T.Group();

  // Bright spectral core — fresh material so it can flicker without mutating the cache.
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('soulCore', () => new T.IcosahedronGeometry(0.085, 0)), coreMat);

  // Colored mote body — bold octahedron silhouette.
  const orb = m(geo('soulOrb', () => new T.OctahedronGeometry(0.16, 0)), matAdd(c, 0.85));

  // Big 4-point starburst halo (crossed flat diamonds) — reads bright + iconic at small size.
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  const haloGeo = geo('soulHalo', () => {
    const og = new T.OctahedronGeometry(0.34, 0);
    og.scale(1, 1, 0.02); // flatten into a thin 4-point star facing the camera
    return og;
  });
  const halo = m(haloGeo, haloMat);

  // Faint tail — longer + brighter tapered cone.
  const trail = m(geo('soulTrail', () => new T.ConeGeometry(0.12, 0.5, 5)), matAdd(c, 0.42));
  trail.rotation.x = -Math.PI / 2; trail.position.z = -0.28;

  // Two trailing wisps for a wispy spectral tail.
  const wispGeo = geo('soulWisp', () => new T.OctahedronGeometry(0.06, 0));
  const wA = m(wispGeo, matAdd('#ffffff', 0.5)); wA.position.set(0.05, 0.02, -0.42);
  const wB = m(wispGeo, matAdd(c, 0.4)); wB.position.set(-0.05, -0.02, -0.6);

  g.add(halo, trail, orb, core, wA, wB);

  g.userData.anim = (grp, now) => {
    const p = Math.sin(now / 120);
    orb.scale.setScalar(1 + p * 0.14);
    core.scale.setScalar(1 + Math.sin(now / 70) * 0.22);
    coreMat.opacity = 0.8 + p * 0.18;
    halo.rotation.z = now / 600;
    haloMat.opacity = 0.42 + (p * 0.5 + 0.5) * 0.4;
    wA.position.y = 0.02 + Math.sin(now / 90) * 0.03;
    wB.position.x = -0.05 + Math.sin(now / 110) * 0.04;
  };
  return g;
}

// raised-dead minion — a small ethereal spectral skeleton (additive, ghostly)
// Strengthened: bolder skeletal silhouette (spine+pelvis+jaw+arms+shoulders), brighter additive core/eyes + a summon-rune halo at the feet, livelier idle bob with unique animated mats.
export function buildMinion(opts) {
  const c = (opts && opts.color) || '#c489ff';
  const g = new T.Group();
  // Solid-ish bright bone mass for a BOLD silhouette at small size.
  const bone = matAdd(c, 0.62);
  const boneDim = matAdd(c, 0.42);
  // Unique (uncached) animated mats — anim mutates opacity per-instance.
  const eye = new T.MeshBasicMaterial({ color: '#ff3df0', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const rune = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });

  // --- summon rune halo at feet (the "summoned" read) ---
  const halo = m(geo('minHalo', () => new T.RingGeometry(0.18, 0.27, 6)), rune);
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.012;

  // --- legs (angular) ---
  const legL = m(box(0.07, 0.26, 0.07), boneDim); legL.position.set(-0.08, 0.13, 0);
  const legR = m(box(0.07, 0.26, 0.07), boneDim); legR.position.set(0.08, 0.13, 0);

  // --- pelvis + spine + ribcage (bold central column) ---
  const pelvis = m(box(0.24, 0.08, 0.16), bone); pelvis.position.y = 0.30;
  const spine = m(box(0.08, 0.20, 0.08), boneDim); spine.position.y = 0.44;
  const ribs = m(box(0.30, 0.24, 0.18), bone); ribs.position.y = 0.50;
  // glowing summon-core heart in the chest
  const heart = m(geo('minCore', () => new T.OctahedronGeometry(0.085, 0)), core); heart.position.set(0, 0.50, 0.07);

  // --- shoulders + arms (it's a fighter) ---
  const shL = m(geo('minShoulder', () => new T.IcosahedronGeometry(0.07, 0)), bone); shL.position.set(-0.20, 0.58, 0);
  const shR = m(geo('minShoulder', () => new T.IcosahedronGeometry(0.07, 0)), bone); shR.position.set(0.20, 0.58, 0);
  const armL = m(box(0.06, 0.22, 0.06), boneDim); armL.position.set(-0.21, 0.46, 0);
  const armR = m(box(0.06, 0.22, 0.06), boneDim); armR.position.set(0.21, 0.46, 0);

  // --- neck + skull + jaw ---
  const neck = m(box(0.06, 0.06, 0.06), boneDim); neck.position.y = 0.70;
  const skull = m(geo('minSkull', () => new T.IcosahedronGeometry(0.15, 0)), bone); skull.position.y = 0.80;
  const jaw = m(box(0.16, 0.06, 0.12), bone); jaw.position.set(0, 0.72, 0.04);

  // --- big bright eyes ---
  const eyeL = m(box(0.055, 0.055, 0.04), eye); eyeL.position.set(-0.055, 0.82, 0.12);
  const eyeR = m(box(0.055, 0.055, 0.04), eye); eyeR.position.set(0.055, 0.82, 0.12);

  g.add(halo, legL, legR, pelvis, spine, ribs, heart, shL, shR, armL, armR, neck, skull, jaw, eyeL, eyeR);

  g.userData.anim = (grp, now) => {
    const t = now / 1000;
    const flick = 0.7 + 0.3 * Math.sin(now / 180);
    eyeL.material.opacity = eyeR.material.opacity = flick;
    heart.material.opacity = 0.65 + 0.3 * Math.sin(now / 260);
    rune.opacity = 0.45 + 0.25 * Math.sin(now / 400);
    halo.rotation.z = t * 0.8;
    // lively levitating bob + slight sway
    g.position.y = 0.02 * Math.sin(t * 3.2);
    skull.rotation.z = 0.08 * Math.sin(t * 2.1);
    armL.rotation.x = 0.18 * Math.sin(t * 2.6);
    armR.rotation.x = -0.18 * Math.sin(t * 2.6);
  };
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
  // STRENGTHENED: bolder horned great-helm + bigger 3-layer pauldrons + brighter PULSING chest emblem (unique anim mat); thicker silhouette, brighter trim/eyes.
  opts = opts || {};
  const g = new T.Group();

  // ---- UNIQUE recolor materials (engine recolors these live; never cache) ----
  const bodyMat = new T.MeshBasicMaterial({ color: (opts.color!=null?opts.color:0x46506b), fog:true });   // -> class color (plate)
  const trimMat = new T.MeshBasicMaterial({ color:0xffce5e, fog:false, transparent:true, opacity:0.97, blending:T.AdditiveBlending, depthWrite:false }); // -> rarity accent (rune trim)
  const eyeMat  = new T.MeshBasicMaterial({ color:0xff4422, fog:false, transparent:true, opacity:1,    blending:T.AdditiveBlending, depthWrite:false }); // -> eye glow
  // unique animated glow for the pulsing chest emblem (NEVER the cache) — driven in anim
  const emblemMat = new T.MeshBasicMaterial({ color:0xffe27a, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false });

  // fixed dark parts (cached OPAQUE fogged) - kept above pure-black so additive display still shows form
  const dark   = mat('#12161f');   // boots, gorget shadow, visor void
  const steel  = mat('#222a39');   // secondary plate / strap shade
  const sabato = mat('#171c27');   // sabatons

  // ================= LEGS (armored greaves + sabatons) — beefier =================
  const lThigh = m(geo('warrior_thigh', ()=>box(0.24,0.32,0.26)), bodyMat);  lThigh.position.set(-0.17,0.31,0);
  const rThigh = m(geo('warrior_thigh', ()=>box(0.24,0.32,0.26)), bodyMat);  rThigh.position.set( 0.17,0.31,0);
  const lGreave = m(geo('warrior_greave', ()=>box(0.21,0.28,0.23)), steel);  lGreave.position.set(0,-0.27,0.01);  lThigh.add(lGreave);
  const rGreave = m(geo('warrior_greave', ()=>box(0.21,0.28,0.23)), steel);  rGreave.position.set(0,-0.27,0.01);  rThigh.add(rGreave);
  const lKnee = m(geo('warrior_knee', ()=>cone(0.13,0.15,4)), bodyMat);      lKnee.position.set(0,-0.10,0.13); lKnee.rotation.x=0.5; lThigh.add(lKnee);
  const rKnee = m(geo('warrior_knee', ()=>cone(0.13,0.15,4)), bodyMat);      rKnee.position.set(0,-0.10,0.13); rKnee.rotation.x=0.5; rThigh.add(rKnee);
  const lFoot = m(geo('warrior_foot', ()=>box(0.21,0.11,0.32)), sabato);     lFoot.position.set(0,-0.38,0.06); lThigh.add(lFoot);
  const rFoot = m(geo('warrior_foot', ()=>box(0.21,0.11,0.32)), sabato);     rFoot.position.set(0,-0.38,0.06); rThigh.add(rFoot);
  const lToe  = m(geo('warrior_toe', ()=>cone(0.10,0.16,4)), sabato);        lToe.position.set(0,-0.38,0.23); lToe.rotation.x=Math.PI/2; lThigh.add(lToe);
  const rToe  = m(geo('warrior_toe', ()=>cone(0.10,0.16,4)), sabato);        rToe.position.set(0,-0.38,0.23); rToe.rotation.x=Math.PI/2; rThigh.add(rToe);
  g.add(lThigh); g.add(rThigh);

  // ================= FAULD / TASSETS over the hips =================
  const fauld = m(geo('warrior_fauld', ()=>box(0.62,0.20,0.42)), steel);     fauld.position.set(0,0.51,0);   g.add(fauld);
  const lTasset = m(geo('warrior_tasset', ()=>box(0.24,0.24,0.36)), bodyMat); lTasset.position.set(-0.24,0.45,0.02); lTasset.rotation.z=0.18; g.add(lTasset);
  const rTasset = m(geo('warrior_tasset', ()=>box(0.24,0.24,0.36)), bodyMat); rTasset.position.set( 0.24,0.45,0.02); rTasset.rotation.z=-0.18; g.add(rTasset);
  const belt = m(geo('warrior_belt', ()=>box(0.64,0.06,0.44)), trimMat);     belt.position.set(0,0.60,0);   g.add(belt);

  // ================= CUIRASS (thick chest) — broader =================
  const cuirass = m(geo('warrior_cuirass', ()=>box(0.68,0.50,0.42)), bodyMat); cuirass.position.set(0,0.85,0);  g.add(cuirass);
  const lBevel = m(geo('warrior_bevel', ()=>box(0.17,0.46,0.11)), steel);    lBevel.position.set(-0.33,0.85,0.19); lBevel.rotation.y=0.5; g.add(lBevel);
  const rBevel = m(geo('warrior_bevel', ()=>box(0.17,0.46,0.11)), steel);    rBevel.position.set( 0.33,0.85,0.19); rBevel.rotation.y=-0.5; g.add(rBevel);
  const ridge = m(geo('warrior_ridge', ()=>box(0.11,0.46,0.11)), steel);     ridge.position.set(0,0.85,0.215);  g.add(ridge);
  // GLOWING CHEST EMBLEM (bold cross sigil) — bigger + brighter, uses pulsing emblemMat
  const emblem = m(geo('warrior_emblem', ()=>box(0.20,0.32,0.07)), emblemMat); emblem.position.set(0,0.92,0.25);  g.add(emblem);
  const emblemBar = m(geo('warrior_emblemBar', ()=>box(0.38,0.09,0.06)), emblemMat); emblemBar.position.set(0,0.87,0.25); g.add(emblemBar);
  const emblemGem = m(geo('warrior_emblemGem', ()=>cone(0.10,0.16,4)), trimMat); emblemGem.position.set(0,1.04,0.26); emblemGem.rotation.x = Math.PI/2; g.add(emblemGem);
  // gorget (neck guard)
  const gorget = m(geo('warrior_gorget', ()=>box(0.36,0.13,0.34)), dark);    gorget.position.set(0,1.12,0);    g.add(gorget);

  // ================= MASSIVE LAYERED PAULDRONS (widest point) — pushed bigger =================
  function pauldron(side){
    const grp = new T.Group();
    grp.position.set(side*0.44,1.01,0);
    const cap  = m(geo('warrior_pCap',  ()=>box(0.40,0.26,0.46)), bodyMat); cap.position.set(side*0.07,0,0); cap.rotation.z=side*0.30; grp.add(cap);
    const lay1 = m(geo('warrior_pLay1', ()=>box(0.42,0.12,0.48)), steel);   lay1.position.set(side*0.05,-0.15,0); lay1.rotation.z=side*0.22; grp.add(lay1);
    const lay2 = m(geo('warrior_pLay2', ()=>box(0.38,0.10,0.44)), bodyMat); lay2.position.set(side*0.03,-0.27,0); lay2.rotation.z=side*0.14; grp.add(lay2);
    // twin upward menacing spikes (bigger crown)
    const spike  = m(geo('warrior_pSpike', ()=>cone(0.13,0.34,4)), bodyMat); spike.position.set(side*0.20,0.18,0); spike.rotation.z=side*-0.25; grp.add(spike);
    const spike2 = m(geo('warrior_pSpike2',()=>cone(0.08,0.20,4)), steel);   spike2.position.set(side*0.04,0.18,0); spike2.rotation.z=side*-0.12; grp.add(spike2);
    // bright rune edge
    const rune = m(geo('warrior_pRune', ()=>box(0.42,0.04,0.50)), trimMat);  rune.position.set(side*0.06,-0.07,0); rune.rotation.z=side*0.30; grp.add(rune);
    return grp;
  }
  g.add(pauldron(-1)); g.add(pauldron(1));

  // ================= GAUNTLETED ARMS =================
  const lArm = m(geo('warrior_arm', ()=>box(0.18,0.44,0.19)), bodyMat); lArm.position.set(-0.44,0.83,0);
  const rArm = m(geo('warrior_arm', ()=>box(0.18,0.44,0.19)), bodyMat); rArm.position.set( 0.44,0.83,0);
  const lFore = m(geo('warrior_fore', ()=>box(0.19,0.22,0.20)), steel);  lFore.position.set(0,-0.27,0.02); lArm.add(lFore);
  const rFore = m(geo('warrior_fore', ()=>box(0.19,0.22,0.20)), steel);  rFore.position.set(0,-0.27,0.02); rArm.add(rFore);
  const lVR = m(geo('warrior_vr', ()=>box(0.20,0.05,0.21)), trimMat);  lVR.position.set(0,-0.21,0.02); lArm.add(lVR);
  const rVR = m(geo('warrior_vr', ()=>box(0.20,0.05,0.21)), trimMat);  rVR.position.set(0,-0.21,0.02); rArm.add(rVR);
  const lFist = m(geo('warrior_fist', ()=>box(0.20,0.17,0.21)), dark);   lFist.position.set(0,-0.42,0.03); lArm.add(lFist);
  const rFist = m(geo('warrior_fist', ()=>box(0.20,0.17,0.21)), dark);   rFist.position.set(0,-0.42,0.03); rArm.add(rFist);
  g.add(lArm); g.add(rArm);

  // ================= GREAT-HELM (horned, visor slit, glowing eyes) — bolder =================
  const head = new T.Group(); head.position.set(0,1.08,0); g.add(head);
  const helm = m(geo('warrior_helm', ()=>box(0.34,0.34,0.34)), bodyMat);  helm.position.set(0,0.11,0);  head.add(helm);
  const crown = m(geo('warrior_crown', ()=>cone(0.23,0.16,5)), bodyMat);  crown.position.set(0,0.30,0); head.add(crown);
  const face = m(geo('warrior_face', ()=>cone(0.24,0.30,4)), steel);      face.position.set(0,0.09,0.07); face.rotation.x=Math.PI; head.add(face);
  // visor void (dark recessed band) + glowing eye slit
  const visor = m(geo('warrior_visor', ()=>box(0.30,0.09,0.07)), dark);   visor.position.set(0,0.11,0.19); head.add(visor);
  const slit  = m(geo('warrior_slit', ()=>box(0.28,0.04,0.05)), eyeMat);  slit.position.set(0,0.11,0.205); head.add(slit);
  const lEye  = m(geo('warrior_eye', ()=>box(0.07,0.06,0.05)), eyeMat);   lEye.position.set(-0.08,0.115,0.21); head.add(lEye);
  const rEye  = m(geo('warrior_eye', ()=>box(0.07,0.06,0.05)), eyeMat);   rEye.position.set( 0.08,0.115,0.21); head.add(rEye);
  // central crest fin
  const crest = m(geo('warrior_crest', ()=>box(0.06,0.22,0.24)), bodyMat); crest.position.set(0,0.34,-0.02); head.add(crest);
  const crestRune = m(geo('warrior_crestRune', ()=>box(0.07,0.20,0.05)), trimMat); crestRune.position.set(0,0.34,0.11); head.add(crestRune);
  // HORNS (sweeping out + up, three cones each) — bigger, more dramatic helm crown
  function horn(side){
    const grp = new T.Group(); grp.position.set(side*0.17,0.22,0);
    const base = m(geo('warrior_hornBase', ()=>cone(0.10,0.26,4)), steel);   base.position.set(side*0.08,0.06,0); base.rotation.z=side*-1.0; grp.add(base);
    const mid  = m(geo('warrior_hornMid',  ()=>cone(0.07,0.26,4)), bodyMat); mid.position.set(side*0.24,0.19,0); mid.rotation.z=side*-0.55; grp.add(mid);
    const tip  = m(geo('warrior_hornTip',  ()=>cone(0.05,0.24,4)), bodyMat); tip.position.set(side*0.39,0.40,0); tip.rotation.z=side*-0.15; grp.add(tip);
    const tipRune = m(geo('warrior_hornRune', ()=>cone(0.03,0.12,4)), trimMat); tipRune.position.set(side*0.46,0.53,0); tipRune.rotation.z=side*-0.10; grp.add(tipRune);
    return grp;
  }
  head.add(horn(-1)); head.add(horn(1));

  // ================= SHORT TABARD + HALF-CAPE (back) =================
  const tabard = m(geo('warrior_tabard', ()=>box(0.32,0.42,0.04)), bodyMat); tabard.position.set(0,0.65,0.225); g.add(tabard);
  const tabRune = m(geo('warrior_tabRune', ()=>box(0.07,0.36,0.03)), trimMat); tabRune.position.set(0,0.65,0.245); g.add(tabRune);
  const cape = m(geo('warrior_cape', ()=>box(0.50,0.54,0.05)), steel);       cape.position.set(0,0.78,-0.23); cape.rotation.x=0.10; g.add(cape);
  const capeHem = m(geo('warrior_capeHem', ()=>box(0.50,0.06,0.06)), trimMat); capeHem.position.set(0,0.53,-0.245); g.add(capeHem);

  // ================= MOUNTS =================
  const weaponMount = new T.Object3D(); weaponMount.position.set(0.46,0.55,0.12); g.add(weaponMount);
  const backMount   = new T.Object3D(); backMount.position.set(0,0.78,-0.21);     g.add(backMount);
  const headMount   = new T.Object3D(); headMount.position.set(0,1.60,0);          g.add(headMount);
  const chestMount  = new T.Object3D(); chestMount.position.set(0,0.72,0.19);      g.add(chestMount);
  const auraMount   = new T.Object3D(); auraMount.position.set(0,0.02,0);          g.add(auraMount);

  g.userData = {
    weaponMount, backMount, headMount, chestMount, auraMount,
    bodyMat, trimMat, eyeMat,
    legs: [lThigh, rThigh],
    arms: [lArm, rArm],
    anim: (grp, now, moving)=>{
      const t = now*0.002;
      // heavy breathing sway of cuirass
      const breathe = Math.sin(t)*0.02;
      cuirass.position.y = 0.85 + breathe;
      // pulsing heartbeat glow on the chest emblem (brighter when moving)
      const pulse = 0.78 + Math.sin(t*2.4)*0.22 + (moving?0.0:0.0);
      emblemMat.opacity = moving ? Math.min(1, pulse+0.12) : pulse;
      // cape flap + tabard sway
      const flap = (moving ? 0.18 : 0.04);
      cape.rotation.x = 0.10 + Math.sin(t*1.6)*flap;
      tabard.rotation.x = Math.sin(t*1.6+0.3)*(flap*0.4);
    }
  };
  return g;
}

export function buildPlayer_mage(opts){
  // STRENGTHENED: taller pointed hood + bigger crowning gem (halo+core), brighter/wider rune stripe & hem band, bolder focus diamond with halo, brighter eyes, brighter orbiting motes — bolder silhouette & brighter accents at small render size; rig contract preserved.
  opts = opts || {};
  const bodyCol = (opts.color != null) ? opts.color : 0x2a2360;

  // ---- UNIQUE recolor materials (engine recolors these live) ----
  const bodyMat = new T.MeshBasicMaterial({ color:bodyCol, fog:true }); // -> robe (class color)
  const trimMat = new T.MeshBasicMaterial({ color:0x7ad6ff, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // -> runes/focus (rarity accent)
  const eyeMat  = new T.MeshBasicMaterial({ color:0xcdf2ff, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // -> eyes/cores

  // DIM unique body-tinted shade so fabric edges stay visible on the additive display
  // (near-black caches render invisible). Not engine-recolored, just readable depth.
  const shadeMat = new T.MeshBasicMaterial({ color:0x16123a, fog:true }); // dim robe-shadow

  const g = new T.Group();

  // ===================== ROBE (floor-length, no legs) =====================
  // wider tapered skirt: bolder flare to the floor for a stronger triangular silhouette
  const skirt = m(geo('mage_skirt', ()=>cyl(0.18, 0.46, 0.88, 8)), bodyMat);
  skirt.position.y = 0.46;
  g.add(skirt);

  // hem ring (dim robe-shadow shade so the silhouette reads as a fabric edge)
  const hem = m(geo('mage_hem', ()=>cyl(0.48, 0.50, 0.07, 8)), shadeMat);
  hem.position.y = 0.05;
  g.add(hem);

  // bright glowing rune band around the hem (taller + brighter = bolder base glow)
  const hemRune = m(geo('mage_hemrune', ()=>cyl(0.47, 0.47, 0.06, 8)), trimMat);
  hemRune.position.y = 0.17;
  g.add(hemRune);

  // upper torso / chest of robe (slimmer, fitted)
  const torso = m(geo('mage_torso', ()=>cyl(0.22, 0.20, 0.42, 8)), bodyMat);
  torso.position.y = 0.99;
  g.add(torso);

  // ===================== HIGH COLLAR (angular, flared up) =====================
  const collar = m(geo('mage_collar', ()=>cyl(0.27, 0.17, 0.24, 6)), bodyMat);
  collar.position.y = 1.21;
  g.add(collar);
  // collar inner shadow (frames the hood opening from below) - dim, not black
  const collarShade = m(geo('mage_collarsh', ()=>cyl(0.15, 0.13, 0.14, 6)), shadeMat);
  collarShade.position.set(0, 1.18, 0.02);
  g.add(collarShade);

  // ===================== POINTED HOOD (taller, sharper) =====================
  // hood shell: a tall pointed cone leaning slightly back — the wizard's hero silhouette
  const hood = m(geo('mage_hood', ()=>cone(0.28, 0.56, 6)), bodyMat);
  hood.position.set(0, 1.50, -0.04);
  hood.rotation.x = -0.13;
  g.add(hood);

  // crowning arcane gem at the hood tip — BIG bright top accent: glow shell + halo + hot core
  const hoodGem = m(geo('mage_hoodgem', ()=>cone(0.10, 0.24, 4)), trimMat);
  hoodGem.position.set(0, 1.86, -0.10); hoodGem.rotation.x = -0.13; g.add(hoodGem);
  const hoodGemHalo = m(geo('mage_hoodgemhalo', ()=>cyl(0.135, 0.135, 0.03, 6)), trimMat);
  hoodGemHalo.position.set(0, 1.80, -0.09); hoodGemHalo.rotation.x = -0.13; g.add(hoodGemHalo);
  const hoodGemCore = m(geo('mage_hoodgemcore', ()=>box(0.085,0.085,0.085)), eyeMat);
  hoodGemCore.position.set(0, 1.82, -0.09); hoodGemCore.rotation.set(-0.13, 0, 0.78); g.add(hoodGemCore);

  // shadow inside the hood opening (face cavity) -> dim void (visible on additive)
  const hoodVoid = m(geo('mage_void', ()=>cone(0.16, 0.32, 6)), shadeMat);
  hoodVoid.position.set(0, 1.36, 0.10);
  hoodVoid.rotation.x = 0.30;
  g.add(hoodVoid);

  // bright hood brow/rune arc across the front of the hood (wider + thicker = bolder)
  const hoodTrim = m(geo('mage_hoodtrim', ()=>box(0.34, 0.05, 0.05)), trimMat);
  hoodTrim.position.set(0, 1.52, 0.17);
  hoodTrim.rotation.x = -0.20;
  g.add(hoodTrim);

  // glowing eyes deep inside the hood shadow (bigger + brighter)
  const eyeL = m(geo('mage_eye', ()=>box(0.05, 0.06, 0.03)), eyeMat);
  const eyeR = m(geo('mage_eye', ()=>box(0.05, 0.06, 0.03)), eyeMat);
  eyeL.position.set(-0.065, 1.34, 0.17);
  eyeR.position.set( 0.065, 1.34, 0.17);
  g.add(eyeL); g.add(eyeR);

  // ===================== WIDE SLEEVES (arms) =====================
  // big bell sleeves: narrow at shoulder, flaring wide at the cuff
  const armL = m(geo('mage_sleeve', ()=>cyl(0.17, 0.11, 0.52, 6)), bodyMat);
  const armR = m(geo('mage_sleeve', ()=>cyl(0.17, 0.11, 0.52, 6)), bodyMat);
  armL.position.set(-0.31, 0.86, 0); armL.rotation.z =  0.16;
  armR.position.set( 0.31, 0.86, 0); armR.rotation.z = -0.16;
  g.add(armL); g.add(armR);
  // bright cuff rune rings at each wrist
  const cuffL = m(geo('mage_cuff', ()=>cyl(0.19, 0.19, 0.05, 6)), trimMat);
  const cuffR = m(geo('mage_cuff', ()=>cyl(0.19, 0.19, 0.05, 6)), trimMat);
  cuffL.position.set(-0.355, 0.61, 0); cuffL.rotation.z =  0.16;
  cuffR.position.set( 0.355, 0.61, 0); cuffR.rotation.z = -0.16;
  g.add(cuffL); g.add(cuffR);

  // pointed shoulder mantle (angular cape over shoulders — wider for a stronger shoulder line)
  const mantle = m(geo('mage_mantle', ()=>cone(0.36, 0.22, 6)), bodyMat);
  mantle.position.set(0, 1.07, -0.02);
  mantle.rotation.x = Math.PI; // flip so the cone points down over the shoulders
  g.add(mantle);

  // ===================== ARCANE TRIM RUNES down the robe =====================
  // bold bright central vertical rune stripe down the front of the robe
  const runeStripe = m(geo('mage_runestripe', ()=>box(0.07, 0.66, 0.05)), trimMat);
  runeStripe.position.set(0, 0.66, 0.215);
  runeStripe.rotation.x = 0.04;
  g.add(runeStripe);
  // three brighter rune nodes glowing along the stripe
  for (let i=0;i<3;i++){
    const node = m(geo('mage_runenode', ()=>box(0.13, 0.07, 0.05)), trimMat);
    node.position.set(0, 0.50 + i*0.23, 0.225);
    g.add(node);
  }

  // ===================== SASH + FOCUS STONE =====================
  // diagonal sash across the chest (dim robe-shadow shade; readable on additive)
  const sash = m(geo('mage_sash', ()=>box(0.48, 0.11, 0.06)), shadeMat);
  sash.position.set(0, 0.84, 0.19);
  sash.rotation.z = 0.42;
  g.add(sash);
  // BIG glowing focus stone set into the sash — bold diamond + halo + hot core that reads small
  const focusHalo = m(geo('mage_focushalo', ()=>cyl(0.16, 0.16, 0.03, 6)), trimMat);
  focusHalo.position.set(0.04, 0.78, 0.205);
  g.add(focusHalo);
  const focus = m(geo('mage_focus', ()=>box(0.17, 0.20, 0.06)), trimMat);
  focus.position.set(0.04, 0.78, 0.225);
  focus.rotation.z = 0.78; // diamond
  g.add(focus);
  const focusCore = m(geo('mage_focuscore', ()=>box(0.085,0.095,0.07)), eyeMat);
  focusCore.position.set(0.04, 0.78, 0.245); focusCore.rotation.z = 0.78; g.add(focusCore);

  // ===================== FLOATING ARCANE MOTES (orbit in anim) =====================
  const mote1 = m(geo('mage_mote', ()=>box(0.07, 0.07, 0.07)), trimMat);
  const mote2 = m(geo('mage_mote', ()=>box(0.06, 0.06, 0.06)), trimMat);
  mote1.position.set(0.32, 1.00, 0.12);
  mote2.position.set(-0.30, 0.82, 0.10);
  g.add(mote1); g.add(mote2);

  // ===================== MOUNTS =====================
  const weaponMount = new T.Object3D();
  weaponMount.position.set(0.38, 0.56, 0.12); // right hand (staff points +Y)
  g.add(weaponMount);

  const backMount = new T.Object3D();
  backMount.position.set(0, 0.80, -0.20);
  g.add(backMount);

  const headMount = new T.Object3D();
  headMount.position.set(0, 1.86, 0); // above hood tip
  g.add(headMount);

  const chestMount = new T.Object3D();
  chestMount.position.set(0, 0.78, 0.19);
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
      const sway = Math.sin(t * 1.6) * (moving ? 0.11 : 0.05);
      skirt.rotation.z = sway * 0.5;
      hood.rotation.z  = -sway * 0.4;
      mantle.rotation.z = sway * 0.3;
      // subtle hem flare breathing
      const fl = 1 + Math.sin(t * 2.0) * 0.025;
      hem.scale.set(fl, 1, fl);
      // crowning gem + focus stone pulse brighter (bold, breathing arcane glow)
      const gemPulse = 0.85 + Math.sin(t * 2.6) * 0.18;
      hoodGemCore.scale.setScalar(gemPulse);
      hoodGemHalo.scale.setScalar(0.9 + Math.sin(t * 2.6 + 1.0) * 0.22);
      focusCore.scale.setScalar(0.9 + Math.sin(t * 3.2 + 0.5) * 0.18);
      focusHalo.scale.setScalar(0.92 + Math.sin(t * 3.2) * 0.2);
      // arcane motes orbiting the wizard
      const a1 = t * 1.4;
      mote1.position.set(Math.cos(a1) * 0.36, 1.00 + Math.sin(t * 2.2) * 0.07, Math.sin(a1) * 0.36 + 0.02);
      const a2 = -t * 1.1 + 2.1;
      mote2.position.set(Math.cos(a2) * 0.32, 0.86 + Math.sin(t * 1.7 + 1) * 0.06, Math.sin(a2) * 0.32 + 0.02);
      const pulse = 0.75 + Math.sin(t * 3.0) * 0.3;
      mote1.scale.setScalar(pulse);
      mote2.scale.setScalar(1.35 - pulse * 0.4);
    }
  };

  return g;
}

export function buildPlayer_ranger(opts){
  // STRENGTHENED: sharper taller hood peak, brighter/wider chest-X harness w/ pulsing clasp (unique anim mat), bolder shoulder caps + rim glow, fuller back cloak, brighter back quiver glow.
  opts = opts || {};
  const themeHex = (opts.color != null) ? opts.color : 0x9be86a;

  // ===== UNIQUE recolor materials (engine recolors these live; never cache) =====
  const bodyMat = new T.MeshBasicMaterial({ color:0x3a4d3b, fog:true }); // leathers -> class color
  const trimMat = new T.MeshBasicMaterial({ color:themeHex, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false }); // rune/strap accents -> rarity
  const eyeMat  = new T.MeshBasicMaterial({ color:themeHex, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // eye glow
  // UNIQUE animated material for the pulsing chest-X clasp (must not touch the cache or trimMat)
  const chestPulseMat = new T.MeshBasicMaterial({ color:themeHex, fog:false, transparent:true, opacity:0.95, blending:T.AdditiveBlending, depthWrite:false });

  // fixed dark cached parts
  const darkLeather = mat('#171c27'); // boots, deep hood shadow, harness leather
  const midLeather  = mat('#2a2f24'); // straps, bracers under-layer
  const shaftMat    = mat('#3b2c1c'); // arrow shafts (warm dark)

  const g = new T.Group();

  // ---------- LEGS (slim, agile) ----------
  const lLeg = new T.Group();
  const lThigh = m(geo('rngr_thigh',()=>box(0.135,0.30,0.16)), bodyMat); lThigh.position.y = 0.40; lLeg.add(lThigh);
  const lShin  = m(geo('rngr_shin',()=>box(0.115,0.24,0.145)), midLeather); lShin.position.y = 0.16; lLeg.add(lShin);
  const lBoot  = m(geo('rngr_boot',()=>box(0.14,0.10,0.21)), darkLeather); lBoot.position.set(0,0.05,0.02); lLeg.add(lBoot);
  lLeg.position.set(-0.105,0,0);
  const rLeg = new T.Group();
  const rThigh = m(geo('rngr_thigh',()=>box(0.135,0.30,0.16)), bodyMat); rThigh.position.y = 0.40; rLeg.add(rThigh);
  const rShin  = m(geo('rngr_shin',()=>box(0.115,0.24,0.145)), midLeather); rShin.position.y = 0.16; rLeg.add(rShin);
  const rBoot  = m(geo('rngr_boot',()=>box(0.14,0.10,0.21)), darkLeather); rBoot.position.set(0,0.05,0.02); rLeg.add(rBoot);
  rLeg.position.set(0.105,0,0);
  g.add(lLeg); g.add(rLeg);

  // ---------- HIPS / belt ----------
  const hips = m(geo('rngr_hips',()=>box(0.34,0.12,0.21)), bodyMat); hips.position.y = 0.60; g.add(hips);
  const beltGlow = m(geo('rngr_belt',()=>box(0.37,0.045,0.23)), trimMat); beltGlow.position.y = 0.605; g.add(beltGlow);

  // ---------- TORSO (lean, tapered) ----------
  const torso = m(geo('rngr_torso',()=>box(0.36,0.40,0.24)), bodyMat); torso.position.y = 0.85; g.add(torso);
  const chest = m(geo('rngr_chest',()=>box(0.30,0.16,0.215)), bodyMat); chest.position.set(0,1.0,0.01); g.add(chest);

  // ---------- CHEST HARNESS / crossing straps (BRIGHTER, BOLDER X) ----------
  const strapA = m(geo('rngr_strap',()=>box(0.075,0.52,0.05)), darkLeather);
  strapA.position.set(0,0.86,0.135); strapA.rotation.z = 0.42; g.add(strapA);
  const strapB = m(geo('rngr_strap',()=>box(0.075,0.52,0.05)), midLeather);
  strapB.position.set(0,0.86,0.135); strapB.rotation.z = -0.42; g.add(strapB);
  // wider, brighter glowing rune line down each strap so the chest-X reads at small render size
  const strapGlowA = m(geo('rngr_strapglow',()=>box(0.04,0.52,0.05)), trimMat); strapGlowA.position.set(0,0.86,0.155); strapGlowA.rotation.z = 0.42; g.add(strapGlowA);
  const strapGlowB = m(geo('rngr_strapglow',()=>box(0.04,0.52,0.05)), trimMat); strapGlowB.position.set(0,0.86,0.155); strapGlowB.rotation.z = -0.42; g.add(strapGlowB);
  // bigger pulsing glowing harness clasp where straps cross (focal hero accent)
  const clasp = m(geo('rngr_clasp',()=>box(0.12,0.12,0.05)), chestPulseMat); clasp.position.set(0,0.86,0.18); g.add(clasp);
  const claspCore = m(geo('rngr_claspcore',()=>box(0.055,0.055,0.06)), trimMat); claspCore.position.set(0,0.86,0.20); g.add(claspCore);

  // ---------- SHOULDER CAPS — bolder pointed pauldrons + bright rims ----------
  const capL = m(geo('rngr_cap',()=>cone(0.115,0.18,4)), bodyMat); capL.position.set(-0.275,1.07,0); capL.rotation.z = 0.62; g.add(capL);
  const capR = m(geo('rngr_cap',()=>cone(0.115,0.18,4)), bodyMat); capR.position.set( 0.275,1.07,0); capR.rotation.z =-0.62; g.add(capR);
  const capGlowL = m(geo('rngr_capglow',()=>box(0.13,0.03,0.15)), trimMat); capGlowL.position.set(-0.275,1.0,0.01); g.add(capGlowL);
  const capGlowR = m(geo('rngr_capglow',()=>box(0.13,0.03,0.15)), trimMat); capGlowR.position.set( 0.275,1.0,0.01); g.add(capGlowR);

  // ---------- LAYERED CLOAK over left shoulder (fuller, bolder back) ----------
  const cloak = new T.Group();
  const mantle = m(geo('rngr_mantle',()=>box(0.32,0.17,0.11)), darkLeather);
  mantle.position.set(-0.10,1.03,-0.06); mantle.rotation.z = 0.18; cloak.add(mantle);
  const drape1 = m(geo('rngr_drape1',()=>box(0.30,0.46,0.05)), bodyMat);
  drape1.position.set(-0.10,0.74,-0.165); drape1.rotation.z = 0.10; cloak.add(drape1);
  const drape2 = m(geo('rngr_drape2',()=>box(0.22,0.34,0.05)), darkLeather);
  drape2.position.set(-0.17,0.62,-0.145); drape2.rotation.z = 0.16; cloak.add(drape2);
  // brighter glowing edge trim on the cloak hem
  const cloakEdge = m(geo('rngr_cloakedge',()=>box(0.31,0.045,0.055)), trimMat);
  cloakEdge.position.set(-0.10,0.52,-0.165); cloakEdge.rotation.z = 0.10; cloak.add(cloakEdge);
  g.add(cloak);

  // ---------- ARMS (lean, with bracers) ----------
  const lArm = new T.Group();
  const lUpper = m(geo('rngr_upperarm',()=>box(0.105,0.28,0.13)), bodyMat); lUpper.position.y = -0.14; lArm.add(lUpper);
  const lFore  = m(geo('rngr_forearm',()=>box(0.095,0.20,0.12)), midLeather); lFore.position.y = -0.34; lArm.add(lFore);
  const lBrace = m(geo('rngr_brace',()=>box(0.115,0.10,0.135)), darkLeather); lBrace.position.y = -0.33; lArm.add(lBrace);
  const lBraceGlow = m(geo('rngr_braceglow',()=>box(0.12,0.03,0.14)), trimMat); lBraceGlow.position.y = -0.30; lArm.add(lBraceGlow);
  lArm.position.set(-0.255,1.0,0);
  const rArm = new T.Group();
  const rUpper = m(geo('rngr_upperarm',()=>box(0.105,0.28,0.13)), bodyMat); rUpper.position.y = -0.14; rArm.add(rUpper);
  const rFore  = m(geo('rngr_forearm',()=>box(0.095,0.20,0.12)), midLeather); rFore.position.y = -0.34; rArm.add(rFore);
  const rBrace = m(geo('rngr_brace',()=>box(0.115,0.10,0.135)), darkLeather); rBrace.position.y = -0.33; rArm.add(rBrace);
  const rBraceGlow = m(geo('rngr_braceglow',()=>box(0.12,0.03,0.14)), trimMat); rBraceGlow.position.y = -0.30; rArm.add(rBraceGlow);
  rArm.position.set(0.255,1.0,0);
  g.add(lArm); g.add(rArm);

  // ---------- NECK ----------
  const neck = m(geo('rngr_neck',()=>box(0.12,0.08,0.12)), midLeather); neck.position.y = 1.085; g.add(neck);

  // ---------- HEAD + SHARP HOOD (face in shadow) ----------
  const head = m(geo('rngr_head',()=>box(0.20,0.20,0.20)), darkLeather); head.position.y = 1.20; g.add(head);
  // hood: taller, sharper outer cone for a crisper peak
  const hoodOuter = m(geo('rngr_hoodouter',()=>cone(0.215,0.36,5)), bodyMat); hoodOuter.position.set(0,1.31,-0.01); g.add(hoodOuter);
  // forward peak/brow that casts the face into shadow (juts toward +Z)
  const hoodPeak = m(geo('rngr_hoodpeak',()=>box(0.22,0.14,0.15)), bodyMat);
  hoodPeak.position.set(0,1.255,0.10); hoodPeak.rotation.x = -0.42; g.add(hoodPeak);
  // sharp forward hood point — crisp, instantly-readable archer-hood silhouette
  const hoodTip = m(geo('rngr_hoodtip',()=>cone(0.115,0.30,4)), bodyMat); hoodTip.position.set(0,1.33,0.05); hoodTip.rotation.x = 0.55; g.add(hoodTip);
  // dark inner cowl (the shadowed face opening)
  const cowl = m(geo('rngr_cowl',()=>box(0.165,0.16,0.07)), darkLeather); cowl.position.set(0,1.205,0.105); g.add(cowl);
  // hood back drape onto shoulders
  const hoodBack = m(geo('rngr_hoodback',()=>box(0.25,0.20,0.08)), bodyMat); hoodBack.position.set(0,1.18,-0.11); g.add(hoodBack);
  // brighter hood-rim glow line at the brow edge (V-read of the hood)
  const hoodGlow = m(geo('rngr_hoodglow',()=>box(0.18,0.028,0.035)), trimMat); hoodGlow.position.set(0,1.275,0.16); hoodGlow.rotation.x = -0.42; g.add(hoodGlow);

  // ---------- GLOWING EYES (deep in the cowl shadow) ----------
  const lEye = m(geo('rngr_eye',()=>box(0.05,0.05,0.03)), eyeMat); lEye.position.set(-0.05,1.205,0.145); g.add(lEye);
  const rEye = m(geo('rngr_eye',()=>box(0.05,0.05,0.03)), eyeMat); rEye.position.set(0.05,1.205,0.145); g.add(rEye);

  // ---------- QUIVER across the back (angled) + arrows ----------
  const quiver = new T.Group();
  const tube = m(geo('rngr_quiver',()=>cyl(0.078,0.062,0.44,7)), darkLeather); quiver.add(tube);
  const tubeBand = m(geo('rngr_quiverband',()=>cyl(0.082,0.082,0.04,7)), trimMat); tubeBand.position.y = 0.10; quiver.add(tubeBand);
  const tubeBand2 = m(geo('rngr_quiverband',()=>cyl(0.082,0.082,0.04,7)), trimMat); tubeBand2.position.y = -0.12; quiver.add(tubeBand2);
  // arrow shafts poking out the top
  const aOff = [[-0.04,0.03],[0.04,-0.02],[0.0,0.05],[-0.02,-0.04]];
  for (let i=0;i<aOff.length;i++){
    const shaft = m(geo('rngr_arrowshaft',()=>cyl(0.012,0.012,0.22,4)), shaftMat);
    shaft.position.set(aOff[i][0],0.30,aOff[i][1]); shaft.rotation.z = (i-1.5)*0.07; quiver.add(shaft);
    const fletch = m(geo('rngr_fletch',()=>box(0.045,0.055,0.012)), trimMat);
    fletch.position.set(aOff[i][0],0.40,aOff[i][1]); fletch.rotation.z = (i-1.5)*0.07; quiver.add(fletch);
  }
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
      // pulsing chest-X clasp glow (unique material, safe to mutate)
      chestPulseMat.opacity = 0.7 + Math.sin(t * (moving ? 6.0 : 3.0)) * 0.3;
      // nimble idle bob of the whole rig
      grp.position.y = moving ? 0 : Math.sin(t * 1.8) * 0.012;
    }
  };
  return g;
}

export function buildPlayer_summoner(opts){
  // STRENGTHENED: bigger anchoring skull-face + bolder bone-horn shoulders, brighter glowing ribcage/spine/collar, brighter chattering skull mote + halo — same strict rig contract.
  const g = new T.Group();
  opts = opts || {};
  // theme tint (engine recolors bodyMat live; default from opts.color when present)
  const themeCol = (opts.color != null) ? opts.color : 0x8a5cff;

  // --- UNIQUE recolor materials (engine recolors these live) ---
  const bodyMat = new T.MeshBasicMaterial({ color:0x2a2533, fog:true }); // dark robe -> class color
  const trimMat = new T.MeshBasicMaterial({ color:themeCol, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // runes/bone glow -> rarity accent
  const eyeMat  = new T.MeshBasicMaterial({ color:0x77ffe0, fog:false, transparent:true, opacity:1, blending:T.AdditiveBlending, depthWrite:false }); // eyes

  // fixed dark cached parts
  const dark   = mat('#12101a');   // deepest shadow under robe / mask shadow
  const ash    = mat('#1c1826');   // shadowed cloth folds
  const bone   = mat('#e6e0cc');   // skull / ribs (brighter opaque off-white, fogged)

  // ================= ROBE (legs hidden -> ragged hem) =================
  const innerCol = m(geo('summInner', ()=>cyl(0.16,0.30,1.02,6)), dark);
  innerCol.position.y = 0.52; g.add(innerCol);

  // Main robe body (tintable). Hexagonal, gothic, angular.
  const robe = m(geo('summRobe', ()=>cyl(0.20,0.40,0.90,6)), bodyMat);
  robe.position.y = 0.50; robe.rotation.y = Math.PI/6; g.add(robe);

  // Ragged hem: a ring of downward cone shards (tattered), swayed in anim.
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
    t.rotation.z = Math.sin(a*1.7)*0.18;
    t.userData.baseRot = t.rotation.z;
    t.userData.phase = i*0.7;
    hemGroup.add(t);
  }
  const frontTatter = m(geo('summTatterLong', ()=>cone(0.07,0.46,3)), bodyMat);
  frontTatter.position.set(0.08,0.02,0.30); frontTatter.rotation.x = Math.PI; frontTatter.rotation.z = -0.12; hemGroup.add(frontTatter);

  // glowing hem rune ring — brightens the base of the silhouette
  const hemRune = m(geo('summHemRune', ()=>cyl(0.345,0.40,0.05,6)), trimMat);
  hemRune.position.y = 0.18; hemRune.rotation.y = Math.PI/6; g.add(hemRune);

  // Layered over-robe / shawl draped on shoulders (darker cloth layer)
  const shawl = m(geo('summShawl', ()=>cyl(0.30,0.40,0.34,6)), ash);
  shawl.position.y = 0.84; shawl.rotation.y = Math.PI/6; g.add(shawl);

  // ================= HIGH JAGGED COLLAR =================
  const collarGeo = geo('summCollarSpike', ()=>cone(0.07,0.36,3));
  const COL_N = 7;
  for(let i=0;i<COL_N;i++){
    const a = (-0.95 + (i/(COL_N-1))*1.9) - Math.PI/2; // back/side arc, open at front
    const r = 0.20;
    const sp = m(collarGeo, bodyMat);
    sp.position.set(Math.cos(a)*r, 1.00, Math.sin(a)*r - 0.02);
    sp.lookAt(Math.cos(a)*r*2.2, 1.46, Math.sin(a)*r*2.2 - 0.05);
    g.add(sp);
  }
  // glowing rune ring at collar base (accent)
  const collarRune = m(geo('summCollarRune', ()=>cyl(0.215,0.215,0.05,6)), trimMat);
  collarRune.position.y = 0.95; g.add(collarRune);

  // BOLD shoulder bone-horns (jut up & out) — bigger, layered for a strong silhouette
  const shoulderHorn = geo('summShoulderHorn', ()=>cone(0.115,0.50,4));
  const shL = m(shoulderHorn, bone); shL.position.set(-0.36,1.04,0.02); shL.rotation.z = 0.78; g.add(shL);
  const shR = m(shoulderHorn, bone); shR.position.set( 0.36,1.04,0.02); shR.rotation.z =-0.78; g.add(shR);
  // secondary smaller horns for a jagged shoulder mass
  const shoulderHorn2 = geo('summShoulderHorn2', ()=>cone(0.075,0.28,4));
  const shL2 = m(shoulderHorn2, bone); shL2.position.set(-0.30,1.06,-0.06); shL2.rotation.z = 0.55; g.add(shL2);
  const shR2 = m(shoulderHorn2, bone); shR2.position.set( 0.30,1.06,-0.06); shR2.rotation.z =-0.55; g.add(shR2);
  // glowing horn tips (brighter accents)
  const shTipL = m(geo('summHornRune', ()=>cone(0.055,0.16,4)), trimMat); shTipL.position.set(-0.55,1.23,0.02); shTipL.rotation.z = 0.78; g.add(shTipL);
  const shTipR = m(geo('summHornRune', ()=>cone(0.055,0.16,4)), trimMat); shTipR.position.set( 0.55,1.23,0.02); shTipR.rotation.z =-0.78; g.add(shTipR);

  // ================= SKELETAL CHEST / RIB ACCENTS (brighter) =================
  const ribGeo = geo('summRib', ()=>box(0.36,0.06,0.06));
  for(let i=0;i<5;i++){
    const ry = 0.58 + i*0.072;
    const rib = m(ribGeo, trimMat);
    rib.position.set(0, ry, 0.205);
    rib.scale.x = 1 - i*0.11; // taper toward bottom (chest -> belly)
    g.add(rib);
  }
  // bright sternum/spine column down the chest
  const sternum = m(geo('summSternum', ()=>box(0.06,0.42,0.06)), trimMat);
  sternum.position.set(0,0.73,0.21); g.add(sternum);
  // glowing heart core — bold central brightness point on the chest
  const heartCore = m(geo('summHeart', ()=>box(0.10,0.10,0.05)), trimMat);
  heartCore.position.set(0,0.74,0.215); g.add(heartCore);
  // animated soul-glow halo behind the ribcage (unique material so it pulses on its own)
  const ribGlow = new T.Mesh(geo('summRibGlow', ()=>plane(0.30,0.36)),
    new T.MeshBasicMaterial({ color:themeCol, fog:false, transparent:true, opacity:0.3, blending:T.AdditiveBlending, depthWrite:false }));
  ribGlow.position.set(0,0.72,0.19); g.add(ribGlow);

  // ================= HEAD: BONE SKULL FACE =================
  const headGroup = new T.Group(); g.add(headGroup);
  // Hooded shadow behind skull (dark cowl framing)
  const cowl = m(geo('summCowl', ()=>cone(0.24,0.44,6)), bodyMat);
  cowl.position.y = 1.24; cowl.rotation.y = Math.PI/6; headGroup.add(cowl);
  const cowlShadow = m(geo('summCowlInner', ()=>cyl(0.15,0.17,0.24,6)), dark);
  cowlShadow.position.set(0,1.17,0.04); headGroup.add(cowlShadow);

  // Skull cranium (bone, opaque) — enlarged so the face anchors the silhouette
  const skull = m(geo('summSkull', ()=>box(0.26,0.27,0.23)), bone);
  skull.position.set(0,1.16,0.06); headGroup.add(skull);
  // angular jaw / lower face
  const jaw = m(geo('summJaw', ()=>box(0.20,0.11,0.18)), bone);
  jaw.position.set(0,1.02,0.07); headGroup.add(jaw);
  // brow ridge (dark recess above eyes)
  const browShadow = m(geo('summBrow', ()=>box(0.22,0.05,0.02)), dark);
  browShadow.position.set(0,1.165,0.175); headGroup.add(browShadow);
  // cheek socket shadows (dark, bigger -> stronger skull read)
  const socketGeo = geo('summSocket', ()=>box(0.075,0.085,0.02));
  const socL = m(socketGeo, dark); socL.position.set(-0.055,1.13,0.17); headGroup.add(socL);
  const socR = m(socketGeo, dark); socR.position.set( 0.055,1.13,0.17); headGroup.add(socR);
  // nasal cavity
  const nasal = m(geo('summNasal', ()=>box(0.03,0.06,0.02)), dark);
  nasal.position.set(0,1.06,0.17); headGroup.add(nasal);
  // teeth bar
  const teeth = m(geo('summTeeth', ()=>box(0.13,0.035,0.02)), bone);
  teeth.position.set(0,1.0,0.165); headGroup.add(teeth);

  // ===== eerie glowing eyes (deep in sockets, brighter) =====
  const eyeGeo = geo('summEye', ()=>box(0.05,0.055,0.03));
  const eyeL = m(eyeGeo, eyeMat); eyeL.position.set(-0.055,1.13,0.185); headGroup.add(eyeL);
  const eyeR = m(eyeGeo, eyeMat); eyeR.position.set( 0.055,1.13,0.185); headGroup.add(eyeR);
  // eye-glow halo (unique animated material -> stays its own glow)
  const eyeHalo = new T.Mesh(geo('summEyeHalo', ()=>plane(0.20,0.08)),
    new T.MeshBasicMaterial({ color:0x77ffe0, fog:false, transparent:true, opacity:0.3, blending:T.AdditiveBlending, depthWrite:false }));
  eyeHalo.position.set(0,1.13,0.2); headGroup.add(eyeHalo);

  // ================= ARMS (wide tattered sleeves) =================
  const sleeveGeo = geo('summSleeve', ()=>cyl(0.14,0.07,0.44,5));
  const armL = m(sleeveGeo, bodyMat);
  armL.position.set(-0.31,0.66,0); g.add(armL);
  const armR = m(sleeveGeo, bodyMat);
  armR.position.set( 0.31,0.66,0); g.add(armR);
  // sleeve rune cuffs (accent)
  const cuffGeo = geo('summCuff', ()=>cyl(0.145,0.145,0.04,5));
  const cuffL = m(cuffGeo, trimMat); cuffL.position.set(-0.31,0.45,0); g.add(cuffL);
  const cuffR = m(cuffGeo, trimMat); cuffR.position.set( 0.31,0.45,0); g.add(cuffR);
  // skeletal hands (bone)
  const handGeo = geo('summHand', ()=>box(0.075,0.095,0.06));
  const handL = m(handGeo, bone); handL.position.set(-0.31,0.41,0.02); g.add(handL);
  const handR = m(handGeo, bone); handR.position.set( 0.31,0.41,0.02); g.add(handR);

  // ================= FLOATING SKULL MOTE (orbits, anim) =================
  const moteGroup = new T.Group(); g.add(moteGroup);
  const skullMote = new T.Group();
  const moteSkull = m(geo('summMoteSkull', ()=>box(0.10,0.105,0.10)), bone);
  skullMote.add(moteSkull);
  const moteJaw = m(geo('summMoteJaw', ()=>box(0.08,0.04,0.08)), bone);
  moteJaw.position.y = -0.07; skullMote.add(moteJaw);
  const moteEyeGeo = geo('summMoteEye', ()=>box(0.028,0.03,0.022));
  const meL = m(moteEyeGeo, trimMat); meL.position.set(-0.026,0.006,0.052); skullMote.add(meL);
  const meR = m(moteEyeGeo, trimMat); meR.position.set( 0.026,0.006,0.052); skullMote.add(meR);
  // mote glow halo (unique animated material)
  const moteHalo = new T.Mesh(geo('summMoteHalo', ()=>plane(0.22,0.22)),
    new T.MeshBasicMaterial({ color:themeCol, fog:false, transparent:true, opacity:0.4, blending:T.AdditiveBlending, depthWrite:false }));
  moteHalo.position.set(0,0,-0.04); skullMote.add(moteHalo);
  skullMote.position.set(0.32,1.18,0); // initial orbit pos
  moteGroup.add(skullMote);

  // a couple of free-floating bone shards orbiting
  const shardGeo = geo('summShard', ()=>cone(0.035,0.18,3));
  const shardA = m(shardGeo, bone); shardA.position.set(-0.30,1.05,0.05); moteGroup.add(shardA);
  const shardB = m(shardGeo, bone); shardB.position.set(0.18,1.30,-0.06); moteGroup.add(shardB);

  // ================= MOUNTS =================
  const weaponMount = new T.Object3D(); weaponMount.position.set(0.41,0.55,0.12); g.add(weaponMount);
  const backMount   = new T.Object3D(); backMount.position.set(0,0.78,-0.18); g.add(backMount);
  const headMount   = new T.Object3D(); headMount.position.set(0,1.32,0); g.add(headMount);
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
      const sway = moving ? 0.24 : 0.10;
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
      skullMote.position.set(Math.cos(oa)*0.34, 1.18 + Math.sin(t*1.7)*0.05, Math.sin(oa)*0.34 - 0.02);
      skullMote.rotation.y = -oa + Math.PI/2;
      moteJaw.position.y = -0.065 - (Math.sin(t*4)*0.5+0.5)*0.022; // chattering jaw
      moteHalo.material.opacity = 0.28 + (Math.sin(t*3.5)*0.5+0.5)*0.22;
      // bone shards drift
      shardA.position.y = 1.05 + Math.sin(t*1.5)*0.05;
      shardA.rotation.z = t*0.8;
      shardB.position.y = 1.30 + Math.cos(t*1.3)*0.05;
      shardB.rotation.z = -t*0.9;
      // necromantic pulse: eyes + soul-glow ribcage breathe together
      const pulse = 0.7 + (Math.sin(t*3)*0.5+0.5)*0.3;
      eyeMat.opacity = pulse;
      eyeHalo.material.opacity = 0.2 + (Math.sin(t*3)*0.5+0.5)*0.2;
      ribGlow.material.opacity = 0.24 + (Math.sin(t*2.2)*0.5+0.5)*0.26;
    }
  };

  return g;
}


// =============================================================
// UPGRADED BOSS MODELS (workflow) — impressive lich/archdemon/voidlord/wyrm.
// =============================================================

// Strengthened: grander/taller lich — floating rune CROWN, brighter triple-layer focus orb + halo,
// blazing eyes, broader spiked mantle, wider ground aura, and a richer channel/orbit anim hook.
export function buildEnemy_caster(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const g = new T.Group();
  // material palette — dark fogged robe masses + selective additive glow (additive display: black = invisible).
  const robe = mat(c, 0.4);            // main robe
  const robeDeep = mat(c, 0.24);       // shadowed under-folds / cowl interior trim
  const robeMid = mat(c, 0.55);        // mantle / lighter accent cloth
  const robeHi = mat(c, 0.72);         // brightest trim edge
  const bone = mat('#cfc6b0');         // skeletal face + claws
  const boneDark = mat('#6d6552');     // shadowed bone
  const wood = mat('#3a2c1d');         // gnarled staff (warm dark-bronze, reads on additive)
  const woodLit = mat('#5c4630');      // staff highlights / cage
  const glow = matAdd(c, 0.95);        // runes, face glow, motes
  const glowSoft = matAdd(c, 0.6);     // softer aura/orb shell
  const glowHot = matAdd('#ffffff', 0.85); // hot white accents (crown, halo, eyes core)

  // ============================================================
  // ROBE — tall, floor-length, no legs. Wide hem flares to a narrow chest.
  // base ~1.7 tall before engine x1.6 -> an imposing tower.
  // ============================================================
  const hem = m(cyl(0.22, 0.56, 0.98, 6), robeDeep); hem.position.y = 0.49; hem.rotation.y = Math.PI / 6;
  const skirtOver = m(cyl(0.16, 0.42, 0.5, 6), robe); skirtOver.position.y = 0.86; skirtOver.rotation.y = Math.PI / 6;
  const torso = m(cyl(0.15, 0.23, 0.44, 6), robe); torso.position.y = 1.28; torso.rotation.y = Math.PI / 6;
  // angular front panel of the robe (a flat prism the runes sit on)
  const panel = m(box(0.27, 0.82, 0.05), robeMid); panel.position.set(0, 0.86, 0.25);
  // bright vertical trim seams down the robe front (sharpen the silhouette)
  const seamL = m(box(0.03, 0.86, 0.03), robeHi); seamL.position.set(-0.13, 0.86, 0.27);
  const seamR = m(box(0.03, 0.86, 0.03), robeHi); seamR.position.set(0.13, 0.86, 0.27);

  // ============================================================
  // SHOULDER MANTLE — broad ornate gothic shoulders (the regal silhouette)
  // ============================================================
  const collar = m(cyl(0.28, 0.34, 0.15, 6), robeMid); collar.position.y = 1.52;
  const mantleL = m(cone(0.24, 0.34, 4), robeMid); mantleL.position.set(-0.36, 1.56, 0); mantleL.rotation.set(0, Math.PI / 4, 0.72);
  const mantleR = m(cone(0.24, 0.34, 4), robeMid); mantleR.position.set(0.36, 1.56, 0); mantleR.rotation.set(0, Math.PI / 4, -0.72);
  // mantle spikes — sharp ornamental points rising off the shoulders
  const spikeL = m(cone(0.055, 0.3, 4), robeHi); spikeL.position.set(-0.38, 1.78, 0); spikeL.rotation.z = 0.5;
  const spikeR = m(cone(0.055, 0.3, 4), robeHi); spikeR.position.set(0.38, 1.78, 0); spikeR.rotation.z = -0.5;
  const gemL = m(box(0.07, 0.07, 0.07), glow); gemL.position.set(-0.36, 1.62, 0.07);
  const gemR = m(box(0.07, 0.07, 0.07), glow); gemR.position.set(0.36, 1.62, 0.07);

  // ============================================================
  // HOODED COWL — deep faceted cowl, dark interior, sliver of skeletal face
  // ============================================================
  const hood = m(cone(0.28, 0.52, 5), robe); hood.position.y = 1.88; hood.rotation.y = Math.PI / 5;
  const hoodBack = m(cone(0.24, 0.34, 4), robeDeep); hoodBack.position.set(0, 1.92, -0.11); hoodBack.rotation.x = -0.3;
  const cowlDark = m(box(0.24, 0.26, 0.06), mat(c, 0.18)); cowlDark.position.set(0, 1.72, 0.15);
  // skeletal face — gaunt skull plane + brow, just catching the light
  const skull = m(box(0.14, 0.18, 0.08), boneDark); skull.position.set(0, 1.73, 0.16);
  const jaw = m(cone(0.075, 0.11, 4), bone); jaw.position.set(0, 1.62, 0.17); jaw.rotation.x = Math.PI;
  const brow = m(box(0.17, 0.04, 0.04), bone); brow.position.set(0, 1.8, 0.18);
  // blazing eyes — twin hot motes deep in the cowl (cores white-hot)
  const eyeL = m(box(0.04, 0.05, 0.03), glow); eyeL.position.set(-0.048, 1.74, 0.19);
  const eyeR = m(box(0.04, 0.05, 0.03), glow); eyeR.position.set(0.048, 1.74, 0.19);
  const eyeCoreL = m(box(0.018, 0.024, 0.02), glowHot); eyeCoreL.position.set(-0.048, 1.74, 0.2);
  const eyeCoreR = m(box(0.018, 0.024, 0.02), glowHot); eyeCoreR.position.set(0.048, 1.74, 0.2);

  // ============================================================
  // FLOATING RUNE CROWN — a bright ring of glyphs orbiting the cowl (iconic read)
  // ============================================================
  const crown = new T.Group(); crown.position.set(0, 2.04, 0);
  const crownRunes = [];
  const crownN = 8, crownRad = 0.26;
  for (let i = 0; i < crownN; i++) {
    const a = (i / crownN) * Math.PI * 2;
    const big = i % 2 === 0;
    const rn = m(geo(big ? 'lichCrownGlyphA' : 'lichCrownGlyphB',
      () => new T.BoxGeometry(0.05, big ? 0.12 : 0.08, 0.025)), big ? glowHot : glow);
    rn.position.set(Math.cos(a) * crownRad, 0, Math.sin(a) * crownRad);
    rn.rotation.y = -a;
    rn.userData.phase = i * 0.7;
    crown.add(rn); crownRunes.push(rn);
  }
  g.add(crown);

  // ============================================================
  // ARMS + SKELETAL CLAWED HANDS — raised, channelling the staff out front
  // ============================================================
  const armL = m(box(0.085, 0.54, 0.095), robe); armL.position.set(-0.26, 1.28, 0.15); armL.rotation.set(0.6, 0, 0.32);
  const armR = m(box(0.085, 0.54, 0.095), robe); armR.position.set(0.26, 1.14, 0.19); armR.rotation.set(0.9, 0, -0.28);
  const cuffL = m(cone(0.11, 0.15, 5), robeMid); cuffL.position.set(-0.32, 1.08, 0.26); cuffL.rotation.x = 0.6;
  const cuffR = m(cone(0.11, 0.15, 5), robeMid); cuffR.position.set(0.32, 0.92, 0.32); cuffR.rotation.x = 0.9;
  // bony hands (small palm + splayed claw fingers)
  const handL = m(box(0.07, 0.07, 0.05), bone); handL.position.set(-0.32, 0.98, 0.32);
  const handR = m(box(0.07, 0.07, 0.05), bone); handR.position.set(0.32, 0.82, 0.38);
  const clawL = m(cone(0.03, 0.11, 4), bone); clawL.position.set(-0.32, 1.07, 0.34); clawL.rotation.x = 0.3;
  const clawR = m(cone(0.03, 0.11, 4), bone); clawR.position.set(0.32, 0.91, 0.4); clawR.rotation.x = 0.3;

  // ============================================================
  // GNARLED STAFF — tall leaning shaft, kinked nodes, claw-cage holding a big orb
  // ============================================================
  const staff = m(cyl(0.032, 0.048, 1.62, 5), wood); staff.position.set(0.32, 0.86, 0.36); staff.rotation.x = 0.12;
  const knot1 = m(box(0.085, 0.085, 0.085), woodLit); knot1.position.set(0.33, 1.06, 0.34); knot1.rotation.set(0.4, 0, 0.5);
  const knot2 = m(box(0.075, 0.075, 0.075), woodLit); knot2.position.set(0.35, 1.4, 0.38); knot2.rotation.set(0.3, 0.4, 0.6);
  // claw cage cradling the focus orb at the top of the staff
  const cage = m(cone(0.17, 0.28, 4), woodLit); cage.position.set(0.37, 1.76, 0.42); cage.rotation.x = 0.1;
  const cageClaw1 = m(cone(0.03, 0.2, 4), woodLit); cageClaw1.position.set(0.3, 1.9, 0.42); cageClaw1.rotation.z = 0.5;
  const cageClaw2 = m(cone(0.03, 0.2, 4), woodLit); cageClaw2.position.set(0.44, 1.9, 0.42); cageClaw2.rotation.z = -0.5;
  // the big glowing focus — flaring halo + faceted shell + faceted core + hot center
  const orbCenter = { x: 0.37, y: 1.94, z: 0.42 };
  const orbHalo = m(geo('lichOrbHalo', () => new T.OctahedronGeometry(0.26, 0)), glowHot);
  orbHalo.position.set(orbCenter.x, orbCenter.y, orbCenter.z);
  const orbShell = m(geo('lichOrbShell', () => new T.OctahedronGeometry(0.19, 0)), glowSoft);
  orbShell.position.set(orbCenter.x, orbCenter.y, orbCenter.z);
  const orb = m(geo('lichOrb', () => new T.OctahedronGeometry(0.13, 0)), glow);
  orb.position.set(orbCenter.x, orbCenter.y, orbCenter.z);
  // unique animated core material (opacity pulsed per frame -> must NOT be cached)
  const coreMat = new T.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const orbCore = m(box(0.07, 0.07, 0.07), coreMat); orbCore.position.set(orbCenter.x, orbCenter.y, orbCenter.z);

  // ============================================================
  // ARCANE RUNES — glowing glyphs marching down the front robe panel
  // ============================================================
  const runes = [];
  const runeGeoKeys = ['lichRuneA', 'lichRuneB', 'lichRuneC'];
  for (let i = 0; i < 4; i++) {
    const ry = 1.12 - i * 0.22;
    const rk = runeGeoKeys[i % 3];
    const rune = m(geo(rk, () => new T.BoxGeometry(0.07 + (rk.charCodeAt(8) % 3) * 0.015, 0.05, 0.02)), glow);
    rune.position.set(0, ry, 0.28);
    rune.userData.baseY = ry;
    g.add(rune); runes.push(rune);
  }

  // ============================================================
  // ORBITING ENERGY MOTES — bright motes circling the staff orb
  // ============================================================
  const motes = [];
  for (let i = 0; i < 4; i++) {
    const mote = m(geo('lichMote', () => new T.OctahedronGeometry(0.045, 0)), glow);
    mote.userData.ang = (i / 4) * Math.PI * 2;
    mote.userData.rad = 0.32 + (i % 2) * 0.07;
    mote.userData.tilt = i * 0.5;
    g.add(mote); motes.push(mote);
  }

  // hovering aura pool at the feet (additive, hugs the ground for the floaty read)
  const aura = m(cyl(0.1, 0.58, 0.05, 6), glowSoft); aura.position.y = 0.03;
  const auraRing = m(geo('lichAuraRing', () => new T.OctahedronGeometry(0.4, 0)), matAdd(c, 0.32));
  auraRing.position.y = 0.06; auraRing.scale.y = 0.12;

  g.add(
    hem, skirtOver, torso, panel, seamL, seamR,
    collar, mantleL, mantleR, spikeL, spikeR, gemL, gemR,
    hood, hoodBack, cowlDark, skull, jaw, brow, eyeL, eyeR, eyeCoreL, eyeCoreR,
    armL, armR, cuffL, cuffR, handL, handR, clawL, clawR,
    staff, knot1, knot2, cage, cageClaw1, cageClaw2,
    orbHalo, orbShell, orb, orbCore, aura, auraRing
  );

  // store the cluster of parts that float together as one body
  const floaters = [
    hem, skirtOver, torso, panel, seamL, seamR, collar, mantleL, mantleR, spikeL, spikeR,
    gemL, gemR, hood, hoodBack, cowlDark, skull, jaw, brow, eyeL, eyeR, eyeCoreL, eyeCoreR,
    armL, armR, cuffL, cuffR, handL, handR, clawL, clawR,
    staff, knot1, knot2, cage, cageClaw1, cageClaw2, orbHalo, orbShell, orb, orbCore, crown
  ];
  const baseY = floaters.map((o) => o.position.y);
  for (let i = 0; i < runes.length; i++) { floaters.push(runes[i]); baseY.push(runes[i].position.y); }

  g.userData.anim = (grp, now) => {
    // slow ominous float bob of the whole sorcerer
    const bob = Math.sin(now / 760) * 0.06;
    for (let i = 0; i < floaters.length; i++) floaters[i].position.y = baseY[i] + bob;

    // floating rune crown — slow rotation + individual glyph rise/shimmer
    crown.rotation.y = now / 2400;
    for (let i = 0; i < crownRunes.length; i++) {
      const cr = crownRunes[i];
      cr.position.y = Math.sin(now / 520 + cr.userData.phase) * 0.05;
      cr.scale.setScalar(0.7 + 0.5 * (Math.sin(now / 300 + cr.userData.phase) * 0.5 + 0.5));
    }

    // pulsing focus orb — scale on cached glows, opacity on the unique core, flaring halo
    const p = Math.sin(now / 300);
    orbHalo.scale.setScalar(1 + (p * 0.5 + 0.5) * 0.4);
    orbHalo.rotation.y = now / 700; orbHalo.rotation.x = now / 1300;
    orbShell.scale.setScalar(1 + p * 0.14);
    orb.scale.setScalar(1 + p * 0.1);
    orb.rotation.y = -now / 500;
    orbCore.scale.setScalar(1 + p * 0.35);
    coreMat.opacity = 0.7 + (p * 0.5 + 0.5) * 0.3;

    // blazing eyes flicker with the orb
    const eg = 1 + p * 0.2;
    eyeL.scale.setScalar(eg); eyeR.scale.setScalar(eg);
    eyeCoreL.scale.setScalar(1 + p * 0.4); eyeCoreR.scale.setScalar(1 + p * 0.4);

    // runes shimmer in a downward cascade
    for (let i = 0; i < runes.length; i++) {
      runes[i].scale.setScalar(0.8 + 0.4 * (Math.sin(now / 360 - i * 0.9) * 0.5 + 0.5));
    }

    // orbiting energy motes circling the staff orb (float with the bob too)
    const oy = orbCenter.y + bob;
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i], ud = mt.userData;
      const a = ud.ang + now / 620;
      mt.position.set(
        orbCenter.x + Math.cos(a) * ud.rad,
        oy + Math.sin(a + ud.tilt) * 0.11,
        orbCenter.z + Math.sin(a) * ud.rad
      );
      mt.scale.setScalar(0.8 + 0.4 * Math.sin(now / 240 + i));
    }

    // ground aura ring slowly breathes + spins
    auraRing.rotation.y = now / 1800;
    auraRing.scale.x = auraRing.scale.z = 1 + Math.sin(now / 900) * 0.1;

    // slow hooded sway + staff-arm channel motion for menace
    hood.rotation.z = Math.sin(now / 1100) * 0.04;
    hoodBack.rotation.z = hood.rotation.z;
    const ch = Math.sin(now / 680) * 0.05;
    armR.rotation.x = 0.9 + ch; armL.rotation.x = 0.6 - ch * 0.5;
  };

  return g;
}

// Strengthened: grander wings w/ glowing edges, taller glowing-tip horns, brighter layered molten core + crack ladder + halo, blazing maw/eyes, richer flap+pulse anim.
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
  const haloMat = new T.MeshBasicMaterial({ color: '#ff8030', fog: false, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false });
  const eyeMat = new T.MeshBasicMaterial({ color: '#ff3a14', fog: false, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const mawMat = new T.MeshBasicMaterial({ color: '#ff5a1e', fog: false, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false });
  const crackMat = new T.MeshBasicMaterial({ color: '#ff7a24', fog: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  const wingEdgeMat = new T.MeshBasicMaterial({ color: '#ffb255', fog: false, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false });
  const hornTipMat = new T.MeshBasicMaterial({ color: '#ffcf70', fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });

  // ---- hooved / clawed legs (thick, slightly splayed) ----
  const thighL = m(box(0.28, 0.52, 0.32), hideMid); thighL.position.set(-0.28, 0.66, -0.02); thighL.rotation.z = 0.1;
  const thighR = m(box(0.28, 0.52, 0.32), hideMid); thighR.position.set(0.28, 0.66, -0.02); thighR.rotation.z = -0.1;
  const shinL = m(box(0.22, 0.44, 0.26), hideDark); shinL.position.set(-0.3, 0.28, 0.06);
  const shinR = m(box(0.22, 0.44, 0.26), hideDark); shinR.position.set(0.3, 0.28, 0.06);
  // cloven hooves at the feet (cones, base at ground)
  const hoofL = m(cone(0.14, 0.24, 4), hoof); hoofL.position.set(-0.3, 0.12, 0.1); hoofL.rotation.set(0.1, 0.78, 0);
  const hoofR = m(cone(0.14, 0.24, 4), hoof); hoofR.position.set(0.3, 0.12, 0.1); hoofR.rotation.set(0.1, 0.78, 0);
  // foot claws
  const tcL = m(cone(0.05, 0.18, 3), spike); tcL.position.set(-0.3, 0.07, 0.28); tcL.rotation.x = 1.45;
  const tcR = m(cone(0.05, 0.18, 3), spike); tcR.position.set(0.3, 0.07, 0.28); tcR.rotation.x = 1.45;

  // ---- heavy hulking torso ----
  const hips = m(box(0.64, 0.28, 0.42), hideDark); hips.position.set(0, 0.96, 0);
  const torso = m(box(0.72, 0.64, 0.48), hide); torso.position.set(0, 1.36, 0);
  // angular pectoral / ridged chest prism
  const pec = m(cone(0.4, 0.54, 4), hideMid); pec.position.set(0, 1.34, 0.12); pec.rotation.set(Math.PI / 2, Math.PI / 4, 0); pec.scale.set(1, 1, 0.55);
  // upper trapezius mass bridging to the neck
  const traps = m(box(0.56, 0.24, 0.36), hideMid); traps.position.set(0, 1.7, -0.02);

  // ---- molten chest core (layered glow + halo ring) ----
  const coreSocket = m(box(0.3, 0.32, 0.14), hideDark); coreSocket.position.set(0, 1.38, 0.22);
  const halo = m(geo('demonCoreHalo', () => new T.TorusGeometry(0.22, 0.05, 6, 12)), haloMat); halo.position.set(0, 1.38, 0.28);
  const core = m(geo('demonCoreOct', () => new T.OctahedronGeometry(0.18, 0)), coreMat); core.position.set(0, 1.38, 0.3);
  const coreHot = m(geo('demonCoreHot', () => new T.OctahedronGeometry(0.09, 0)), coreHotMat); coreHot.position.set(0, 1.38, 0.32);
  // molten crack ladder leaking up/down the torso ridge
  const cracks = [];
  const crackY = [1.66, 1.54, 1.22, 1.08];
  for (let i = 0; i < crackY.length; i++) {
    const cr = m(box(0.05, 0.12, 0.03), crackMat);
    cr.position.set((i % 2 ? 0.11 : -0.11), crackY[i], 0.24);
    cr.rotation.z = (i % 2 ? -0.4 : 0.4);
    cracks.push(cr);
  }
  // ember motes leaking from chest ridge
  const em1 = m(box(0.05, 0.05, 0.03), ember); em1.position.set(-0.13, 1.52, 0.26);
  const em2 = m(box(0.045, 0.045, 0.03), ember); em2.position.set(0.14, 1.18, 0.26);

  // ---- broad jagged shoulders with spikes ----
  const shL = m(cone(0.3, 0.46, 4), hideMid); shL.position.set(-0.54, 1.66, 0); shL.rotation.z = 0.9;
  const shR = m(cone(0.3, 0.46, 4), hideMid); shR.position.set(0.54, 1.66, 0); shR.rotation.z = -0.9;
  const spkSL = m(cone(0.08, 0.4, 4), spike); spkSL.position.set(-0.62, 1.9, -0.02); spkSL.rotation.set(-0.2, 0, 0.55);
  const spkSR = m(cone(0.08, 0.4, 4), spike); spkSR.position.set(0.62, 1.9, -0.02); spkSR.rotation.set(-0.2, 0, -0.55);
  const spkSL2 = m(cone(0.06, 0.26, 4), spike); spkSL2.position.set(-0.46, 1.88, -0.04); spkSL2.rotation.set(-0.2, 0, 0.35);
  const spkSR2 = m(cone(0.06, 0.26, 4), spike); spkSR2.position.set(0.46, 1.88, -0.04); spkSR2.rotation.set(-0.2, 0, -0.35);

  // ---- thick clawed arms ----
  const armL = m(box(0.22, 0.64, 0.24), hideMid); armL.position.set(-0.62, 1.28, 0.04); armL.rotation.z = 0.2;
  const armR = m(box(0.22, 0.64, 0.24), hideMid); armR.position.set(0.62, 1.28, 0.04); armR.rotation.z = -0.2;
  const foreL = m(box(0.2, 0.42, 0.22), hideDark); foreL.position.set(-0.7, 0.86, 0.12); foreL.rotation.z = 0.32;
  const foreR = m(box(0.2, 0.42, 0.22), hideDark); foreR.position.set(0.7, 0.86, 0.12); foreR.rotation.z = -0.32;
  // clawed hands (cluster of talon cones)
  const clawL = [];
  const clawR = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.07;
    const cl = m(cone(0.05, 0.26, 3), spike); cl.position.set(-0.78 + off * 0.3, 0.58, 0.18 + off); cl.rotation.set(0.7, 0, 0.35);
    const cr = m(cone(0.05, 0.26, 3), spike); cr.position.set(0.78 - off * 0.3, 0.58, 0.18 + off); cr.rotation.set(0.7, 0, -0.35);
    clawL.push(cl); clawR.push(cr);
  }

  // ---- spine spikes running down the back ----
  const spineSpikes = [];
  for (let i = 0; i < 5; i++) {
    const sp = m(cone(0.07 - i * 0.008, 0.34 - i * 0.04, 4), spike);
    sp.position.set(0, 1.66 - i * 0.24, -0.26 + i * 0.02);
    sp.rotation.x = -0.5;
    spineSpikes.push(sp);
  }

  // ---- fanged horned head ----
  const neck = m(cyl(0.14, 0.17, 0.18, 6), hideDark); neck.position.set(0, 1.82, 0.02);
  const head = m(box(0.36, 0.32, 0.34), hide); head.position.set(0, 2.0, 0.04);
  // jutting brow/snout
  const snout = m(cone(0.2, 0.28, 4), hideMid); snout.position.set(0, 1.94, 0.22); snout.rotation.set(Math.PI / 2, Math.PI / 4, 0); snout.scale.set(1, 1, 0.55);
  // blazing eyes
  const eyeL = m(box(0.08, 0.07, 0.04), eyeMat); eyeL.position.set(-0.1, 2.04, 0.22);
  const eyeR = m(box(0.08, 0.07, 0.04), eyeMat); eyeR.position.set(0.1, 2.04, 0.22);
  // lower jaw + glowing maw + fangs
  const jaw = m(box(0.26, 0.09, 0.22), hideDark); jaw.position.set(0, 1.88, 0.18);
  const maw = m(box(0.18, 0.05, 0.06), mawMat); maw.position.set(0, 1.92, 0.26);
  const fangs = [];
  for (let i = 0; i < 4; i++) {
    const fx = (i < 2 ? -1 : 1) * (0.04 + (i % 2) * 0.06);
    const fg = m(cone(0.025, 0.11, 3), spike); fg.position.set(fx, 1.86, 0.26); fg.rotation.x = Math.PI;
    fangs.push(fg);
  }
  // MASSIVE curved crowning horns (3-segment sweeping curve) + glowing tips
  const hbL = m(cone(0.11, 0.44, 4), horn); hbL.position.set(-0.17, 2.24, -0.04); hbL.rotation.set(-0.25, 0, 0.6);
  const hbR = m(cone(0.11, 0.44, 4), horn); hbR.position.set(0.17, 2.24, -0.04); hbR.rotation.set(-0.25, 0, -0.6);
  const hmL = m(cone(0.08, 0.4, 4), horn); hmL.position.set(-0.34, 2.56, -0.06); hmL.rotation.set(-0.45, 0, 0.95);
  const hmR = m(cone(0.08, 0.4, 4), horn); hmR.position.set(0.34, 2.56, -0.06); hmR.rotation.set(-0.45, 0, -0.95);
  const htL = m(cone(0.05, 0.32, 4), horn); htL.position.set(-0.52, 2.78, -0.04); htL.rotation.set(-0.7, 0, 1.35);
  const htR = m(cone(0.05, 0.32, 4), horn); htR.position.set(0.52, 2.78, -0.04); htR.rotation.set(-0.7, 0, -1.35);
  const htipL = m(geo('demonHornTip', () => new T.OctahedronGeometry(0.055, 0)), hornTipMat); htipL.position.set(-0.62, 2.92, -0.02);
  const htipR = m(geo('demonHornTip', () => new T.OctahedronGeometry(0.055, 0)), hornTipMat); htipR.position.set(0.62, 2.92, -0.02);
  // smaller secondary horns
  const h2L = m(cone(0.05, 0.22, 4), horn); h2L.position.set(-0.07, 2.2, 0.06); h2L.rotation.set(0.2, 0, 0.3);
  const h2R = m(cone(0.05, 0.22, 4), horn); h2R.position.set(0.07, 2.2, 0.06); h2R.rotation.set(0.2, 0, -0.3);

  // ---- HUGE bat-like wings spread wide behind ----
  const wingL = new T.Group(); wingL.position.set(-0.4, 1.54, -0.22);
  const wingR = new T.Group(); wingR.position.set(0.4, 1.54, -0.22);
  // membrane (flattened cones) + bony spars + glowing leading edge + finger claws, built in local space then pivoted
  const buildWing = (grp, sign) => {
    const memb = m(cone(0.72, 1.9, 3), hideDark); memb.position.set(sign * 0.86, 0.12, -0.12); memb.rotation.set(Math.PI / 2, 0, sign * (Math.PI / 2 + 0.1)); memb.scale.set(1, 0.5, 1);
    const memb2 = m(cone(0.42, 1.1, 3), hideMid); memb2.position.set(sign * 0.6, -0.34, -0.1); memb2.rotation.set(Math.PI / 2, 0, sign * (Math.PI / 2 + 0.5)); memb2.scale.set(1, 0.45, 1);
    const spar = m(cyl(0.045, 0.07, 1.7, 4), horn); spar.position.set(sign * 0.78, 0.5, -0.1); spar.rotation.z = sign * 1.15;
    const spar2 = m(cyl(0.035, 0.05, 1.1, 4), horn); spar2.position.set(sign * 0.62, -0.2, -0.1); spar2.rotation.z = sign * 0.7;
    // glowing leading edge (additive) — makes the wing read as LIGHT, not just dark mass
    const edge = m(cyl(0.03, 0.03, 1.7, 4), wingEdgeMat); edge.position.set(sign * 0.82, 0.5, -0.06); edge.rotation.z = sign * 1.15;
    const tip = m(cone(0.05, 0.26, 3), spike); tip.position.set(sign * 1.6, 0.8, -0.1); tip.rotation.z = sign * -0.6;
    const tip2 = m(cone(0.04, 0.18, 3), spike); tip2.position.set(sign * 1.1, -0.6, -0.1); tip2.rotation.z = sign * -0.4;
    grp.add(memb, memb2, spar, spar2, edge, tip, tip2);
    grp.userData.edge = edge;
  };
  buildWing(wingL, -1);
  buildWing(wingR, 1);

  body.add(thighL, thighR, shinL, shinR, hoofL, hoofR, tcL, tcR,
    hips, torso, pec, traps, coreSocket, halo, core, coreHot, em1, em2,
    shL, shR, spkSL, spkSR, spkSL2, spkSR2, armL, armR, foreL, foreR,
    neck, head, snout, eyeL, eyeR, jaw, maw,
    hbL, hbR, hmL, hmR, htL, htR, htipL, htipR, h2L, h2R, wingL, wingR);
  for (const cl of clawL) body.add(cl);
  for (const cr of clawR) body.add(cr);
  for (const sp of spineSpikes) body.add(sp);
  for (const fg of fangs) body.add(fg);
  for (const cr of cracks) body.add(cr);

  // scale whole figure down to BASE height ~1.5 (authored ~2.9 tall).
  // feet stay at y=0 since the inner group's origin sits at the feet.
  body.scale.setScalar(0.51);
  g.add(body);

  const edgeL = wingL.userData.edge, edgeR = wingR.userData.edge;

  g.userData.anim = (grp, now) => {
    // slow heavy asymmetric wing flap
    const flap = Math.sin(now / 620) * 0.34;
    wingL.rotation.z = flap; wingR.rotation.z = -flap;
    wingL.rotation.y = 0.16 + Math.sin(now / 620) * 0.14;
    wingR.rotation.y = -0.16 - Math.sin(now / 620) * 0.14;
    // wing-edge glow brightens at the top of the downbeat
    const beat = 0.45 + (Math.sin(now / 620 + 1.2) + 1) * 0.25;
    if (edgeL) edgeL.material.opacity = beat;
    if (edgeR) edgeR.material.opacity = beat;
    // molten chest core pulse
    const pulse = (Math.sin(now / 300) + 1) * 0.5; // 0..1
    const s = 1 + pulse * 0.3;
    core.scale.setScalar(s);
    coreHot.scale.setScalar(1 + pulse * 0.55);
    coreMat.opacity = 0.7 + pulse * 0.3;
    haloMat.opacity = 0.35 + pulse * 0.35;
    halo.scale.setScalar(1 + pulse * 0.12);
    halo.rotation.z = now / 1400;
    // crack ladder + maw breathe with the core
    crackMat.opacity = 0.45 + pulse * 0.35;
    mawMat.opacity = 0.55 + pulse * 0.3;
    em1.position.y = 1.52 + pulse * 0.09;
    em2.position.y = 1.18 + (1 - pulse) * 0.09;
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
  // Strengthened: TOWERING eldritch silhouette — tall void column + crown of dark spikes,
  // a great central eye flanked by smaller void-eyes, long reaching tendril-arms,
  // bright vertical "tears in reality" rifts, orbiting shards + ground rift glow.
  const c = (opts && opts.color) || '#b14dff';
  const g = new T.Group();

  // ---- materials (additive display: dark = transparent, bright = glow) ----
  const shellGlow  = matAdd(c, 0.28);          // body/column shell (dim theme glow)
  const spikeGlow  = matAdd(c, 0.36);          // tendrils / crown / shards
  const glowC      = matAdd(c, 0.62);          // bright theme accents
  const glowDim    = matAdd(c, 0.30);          // dim halo / framing
  const shardGlow  = matAdd(0xe8d0ff, 0.55);   // pale crystalline shard edges
  const riftGlow   = matAdd(0xf3e6ff, 0.6);    // bright pale rift cores (tears)
  const voidSlit   = matAdd(0x05010a, 0.85);   // near-black = transparent gap (slit)

  // overall scale so base height lands tall (engine x1.6 -> grand)
  const RIG = new T.Group();
  RIG.scale.set(0.74, 0.74, 0.74);
  g.add(RIG);

  // ---------------------------------------------------------------
  // TOWERING VOID COLUMN — a tall robed pillar rising from the floor
  // ---------------------------------------------------------------
  const bodyY = 1.55;              // head/eye mass sits high -> imposing
  const column = new T.Group();
  RIG.add(column);

  // wide skirted base flaring out at the ground (grounded, monumental)
  const skirt = m(geo('vl_skirt', () => cone(0.86, 1.5, 8)), shellGlow);
  skirt.position.y = 0.74;
  column.add(skirt);
  // mid torso block tapering up toward the head mass
  const torso = m(geo('vl_torso', () => cyl(0.34, 0.6, 0.9, 8)), shellGlow);
  torso.position.y = 1.55;
  column.add(torso);

  // CENTRAL VOID HEAD MASS — irregular clustered crown of the column
  const core = new T.Group();
  core.position.y = bodyY + 0.55;
  RIG.add(core);

  const massTop = m(geo('vl_massT', () => cone(0.52, 0.62, 7)), shellGlow);
  massTop.position.y = 0.16;
  core.add(massTop);
  const massBot = m(geo('vl_massB', () => cone(0.56, 0.5, 7)), shellGlow);
  massBot.rotation.x = Math.PI;
  massBot.position.y = -0.12;
  core.add(massBot);

  // asymmetric secondary lobes (otherworldly lumpiness)
  const lobeGeo = geo('vl_lobe', () => cone(0.26, 0.36, 6));
  const lobeA = m(lobeGeo, shellGlow);
  lobeA.position.set(0.4, 0.1, 0.16); lobeA.rotation.z = -0.9; lobeA.rotation.x = 0.3;
  core.add(lobeA);
  const lobeB = m(lobeGeo, shellGlow);
  lobeB.position.set(-0.36, -0.04, -0.2); lobeB.rotation.z = 1.1; lobeB.rotation.x = -0.4;
  core.add(lobeB);
  const lobeC = m(lobeGeo, shellGlow);
  lobeC.position.set(-0.1, 0.3, 0.36); lobeC.rotation.x = -1.0; lobeC.scale.set(0.8,0.8,0.8);
  core.add(lobeC);

  // ---------------------------------------------------------------
  // THE GREAT EYE — one huge glowing central eye facing +Z
  // ---------------------------------------------------------------
  const eyeGrp = new T.Group();
  eyeGrp.position.set(0, 0.02, 0.46);
  core.add(eyeGrp);

  const socket = m(geo('vl_socket', () => cyl(0.4, 0.44, 0.18, 8)), glowDim);
  socket.rotation.x = Math.PI / 2;
  socket.position.z = -0.04;
  eyeGrp.add(socket);

  const sclera = m(geo('vl_sclera', () => cyl(0.32, 0.32, 0.06, 12)), glowDim);
  sclera.rotation.x = Math.PI / 2;
  eyeGrp.add(sclera);

  // bright iris — ANIMATED unique material (pulse)
  const irisMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.9, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const iris = m(geo('vl_iris', () => cyl(0.21, 0.21, 0.1, 14)), irisMat);
  iris.rotation.x = Math.PI / 2;
  iris.position.z = 0.06;
  eyeGrp.add(iris);

  // vertical slit pupil — dark void slash (additive: reads as gap)
  const pupil = m(geo('vl_pupil', () => box(0.05, 0.3, 0.04)), voidSlit);
  pupil.position.z = 0.13;
  eyeGrp.add(pupil);

  // bright inner spark — ANIMATED unique material (counter-pulse)
  const sparkMat = new T.MeshBasicMaterial({ color: new T.Color(0xffffff), transparent: true, opacity: 0.95, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const spark = m(geo('vl_spark', () => box(0.07, 0.1, 0.05)), sparkMat);
  spark.position.z = 0.16;
  eyeGrp.add(spark);

  // lash-spikes radiating around the eye (menacing brow)
  const lashGeo = geo('vl_lash', () => cone(0.05, 0.32, 4));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lash = m(lashGeo, spikeGlow);
    lash.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.02);
    lash.rotation.z = a - Math.PI / 2;
    eyeGrp.add(lash);
  }

  // ---------------------------------------------------------------
  // MINOR VOID-EYES — smaller glowing eyes scattered on the mass/column
  // ---------------------------------------------------------------
  const minorEyes = [];
  const meIris = geo('vl_meIris', () => cyl(0.09, 0.09, 0.06, 10));
  const meRing = geo('vl_meRing', () => cyl(0.12, 0.14, 0.05, 8));
  const meSpec = [
    [ 0.34, 0.34,  0.34],
    [-0.34, 0.28,  0.32],
    [ 0.16,-0.18,  0.5 ],
    [ 0.0,  0.5,   0.3 ],
    [-0.2, -0.1,   0.46],
  ];
  for (let i = 0; i < meSpec.length; i++){
    const [px,py,pz] = meSpec[i];
    const eg = new T.Group();
    eg.position.set(px, py, pz);
    core.add(eg);
    const ring = m(meRing, glowDim);
    ring.rotation.x = Math.PI / 2;
    eg.add(ring);
    const im = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.85, fog: false, blending: T.AdditiveBlending, depthWrite: false });
    const ir = m(meIris, im);
    ir.rotation.x = Math.PI / 2;
    ir.position.z = 0.03;
    eg.add(ir);
    minorEyes.push({ mat: im, phase: i * 1.3 });
  }
  // two more glowing eyes lower on the torso column
  const torsoEyeY = [1.9, 1.35];
  for (let i = 0; i < torsoEyeY.length; i++){
    const eg = new T.Group();
    eg.position.set(i ? 0.18 : -0.16, torsoEyeY[i], 0.4);
    RIG.add(eg);
    const ring = m(meRing, glowDim);
    ring.rotation.x = Math.PI / 2;
    eg.add(ring);
    const im = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.8, fog: false, blending: T.AdditiveBlending, depthWrite: false });
    const ir = m(meIris, im);
    ir.rotation.x = Math.PI / 2;
    ir.position.z = 0.03;
    eg.add(ir);
    minorEyes.push({ mat: im, phase: 3 + i * 1.7 });
  }

  // ---------------------------------------------------------------
  // TEARS IN REALITY — bright vertical rifts hovering around the column
  // ---------------------------------------------------------------
  const rifts = [];
  const riftCore = geo('vl_riftCore', () => box(0.04, 0.9, 0.04));
  const riftEdge = geo('vl_riftEdge', () => box(0.12, 1.0, 0.03));
  const riftSpec = [
    [ 0.95, 1.6,  0.2,  0.25],
    [-0.9,  1.3, -0.1, -0.3 ],
    [ 0.55, 2.2, -0.5,  0.1 ],
    [-0.5,  2.0,  0.45, 0.35],
  ];
  for (let i = 0; i < riftSpec.length; i++){
    const [px,py,pz,rot] = riftSpec[i];
    const rg = new T.Group();
    rg.position.set(px, py, pz);
    rg.rotation.z = rot;
    RIG.add(rg);
    // dark transparent slit behind (the tear itself)
    const slit = m(geo('vl_riftSlit', () => box(0.08, 0.95, 0.05)), voidSlit);
    slit.position.z = -0.02;
    rg.add(slit);
    // dim purple halo edges flanking the rift
    const eMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.22, fog: false, blending: T.AdditiveBlending, depthWrite: false });
    const edge = m(riftEdge, eMat);
    rg.add(edge);
    // bright pale core line — ANIMATED unique material (flicker)
    const cMat = new T.MeshBasicMaterial({ color: new T.Color(0xf3e6ff), transparent: true, opacity: 0.7, fog: false, blending: T.AdditiveBlending, depthWrite: false });
    const cl = m(riftCore, cMat);
    cl.position.z = 0.03;
    rg.add(cl);
    rifts.push({ node: rg, coreMat: cMat, edgeMat: eMat, baseScaleY: 1, phase: i * 1.1 });
  }

  // ---------------------------------------------------------------
  // REACHING TENDRIL-ARMS — long angular arms radiating from the head mass
  // ---------------------------------------------------------------
  const tendrils = [];
  const tendrilCount = 9;
  const tBase = geo('vl_tBase', () => cone(0.1, 0.9, 5));
  const tTip  = geo('vl_tTip', () => cone(0.05, 0.55, 4));
  const tGlow = geo('vl_tGlow', () => cone(0.05, 0.24, 4));
  for (let i = 0; i < tendrilCount; i++) {
    const a = (i / tendrilCount) * Math.PI * 2 + 0.3;
    const reach = 0.6 + ((i * 37) % 5) * 0.06;
    const tilt = -0.4 - ((i * 53) % 4) * 0.2;
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
    seg2.position.set(reach + 0.58, 0, 0);
    seg2.rotation.z = -Math.PI / 2 + 0.35;
    arm.add(seg2);

    const glowTip = m(tGlow, glowC);
    glowTip.position.set(reach + 0.98, 0.06, 0);
    glowTip.rotation.z = -Math.PI / 2 + 0.35;
    arm.add(glowTip);

    tendrils.push({ arm, phase: i * 0.7, baseTilt: tilt });
  }

  // ---------------------------------------------------------------
  // CROWN OF DARK SPIKES — tall radiating crown above the head, bright caps
  // ---------------------------------------------------------------
  const crownGeo = geo('vl_crown', () => cone(0.08, 0.9, 4));
  const crownCapGeo = geo('vl_crownCap', () => cone(0.05, 0.22, 4));
  const crownY = core.position.y + 0.55;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const sp = m(crownGeo, spikeGlow);
    sp.position.set(Math.cos(a) * 0.32, crownY, Math.sin(a) * 0.32);
    sp.rotation.z = -Math.cos(a) * 0.32;
    sp.rotation.x = Math.sin(a) * 0.32;
    RIG.add(sp);
    const cap = m(crownCapGeo, glowC);
    cap.position.set(Math.cos(a) * 0.48, crownY + 0.5, Math.sin(a) * 0.48);
    RIG.add(cap);
  }
  // tall central spire spike (apex of the silhouette)
  const spire = m(geo('vl_spire', () => cone(0.1, 1.1, 5)), spikeGlow);
  spire.position.set(0, crownY + 0.3, 0);
  RIG.add(spire);
  const spireCap = m(geo('vl_spireCap', () => cone(0.06, 0.28, 4)), glowC);
  spireCap.position.set(0, crownY + 0.95, 0);
  RIG.add(spireCap);

  // ---------------------------------------------------------------
  // ORBITING CRYSTALLINE SHARDS
  // ---------------------------------------------------------------
  const shards = [];
  const shardCount = 6;
  const shGeo = geo('vl_shard', () => cone(0.12, 0.48, 4));
  const shEdgeGeo = geo('vl_shardEdge', () => cone(0.05, 0.52, 4));
  for (let i = 0; i < shardCount; i++) {
    const a = (i / shardCount) * Math.PI * 2;
    const r = 1.05 + (i % 3) * 0.12;
    const yOff = core.position.y + Math.sin(a * 1.7) * 0.5;
    const sh = new T.Group();
    sh.position.set(Math.cos(a) * r, yOff, Math.sin(a) * r);
    sh.rotation.set(a * 1.3, a, a * 0.7);
    RIG.add(sh);

    const body = m(shGeo, spikeGlow);
    sh.add(body);
    const edge = m(shEdgeGeo, shardGlow);
    edge.position.y = 0.02;
    sh.add(edge);

    shards.push({ node: sh, baseA: a, r, baseY: yOff, spin: 0.4 + (i % 3) * 0.25 });
  }

  // ---------------------------------------------------------------
  // OPPRESSIVE WARPED AURA + ground rift glow
  // ---------------------------------------------------------------
  const auraMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.12, fog: false, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide });
  const aura = m(geo('vl_aura', () => cyl(0.85, 0.85, 1.6, 9)), auraMat);
  aura.position.y = bodyY + 0.2;
  aura.scale.set(1, 1.25, 1);
  RIG.add(aura);

  const aura2Mat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.07, fog: false, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide });
  const aura2 = m(geo('vl_aura2', () => cone(1.2, 2.6, 9)), aura2Mat);
  aura2.position.y = bodyY - 0.3;
  RIG.add(aura2);

  const poolMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.2, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const pool = m(geo('vl_pool', () => cyl(0.8, 1.1, 0.02, 12)), poolMat);
  pool.position.y = 0.02;
  RIG.add(pool);

  // ---------------------------------------------------------------
  // ANIM — slow ominous sway + writhing tendrils + eye pulse + rifts + orbit
  // ---------------------------------------------------------------
  g.userData.anim = (root, now) => {
    const t = now * 0.001;

    core.rotation.y = t * 0.25;
    const bob = Math.sin(t * 0.9) * 0.05;
    core.position.y = (bodyY + 0.55) + bob;
    column.rotation.z = Math.sin(t * 0.5) * 0.025;   // tall column sway
    eyeGrp.rotation.z = Math.sin(t * 0.4) * 0.08;

    // great eye pulse (iris + spark counter-phase)
    const pulse = 0.55 + (Math.sin(t * 2.0) * 0.5 + 0.5) * 0.45;
    irisMat.opacity = pulse;
    const s = 0.9 + Math.sin(t * 2.0) * 0.12;
    iris.scale.set(s, s, 1);
    sparkMat.opacity = 0.5 + (Math.sin(t * 3.3 + 1.0) * 0.5 + 0.5) * 0.5;

    // minor void-eyes blink/pulse out of phase
    for (let i = 0; i < minorEyes.length; i++) {
      const me = minorEyes[i];
      me.mat.opacity = 0.45 + (Math.sin(t * 2.4 + me.phase) * 0.5 + 0.5) * 0.5;
    }

    // tears in reality flicker + breathe vertically
    for (let i = 0; i < rifts.length; i++) {
      const rf = rifts[i];
      rf.coreMat.opacity = 0.45 + (Math.sin(t * 5.0 + rf.phase) * 0.5 + 0.5) * 0.5;
      rf.edgeMat.opacity = 0.14 + (Math.sin(t * 1.6 + rf.phase) * 0.5 + 0.5) * 0.16;
      rf.node.scale.y = 1 + Math.sin(t * 1.8 + rf.phase) * 0.12;
    }

    // writhing reaching tendrils
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

    // aura warp breathing + ground rift
    const ab = 1 + Math.sin(t * 0.8) * 0.06;
    aura.scale.set(ab, 1.25 * ab, ab);
    auraMat.opacity = 0.1 + Math.sin(t * 1.1) * 0.04;
    aura2Mat.opacity = 0.06 + Math.sin(t * 0.7 + 1.0) * 0.03;
    poolMat.opacity = 0.18 + Math.sin(t * 1.5) * 0.05;
  };

  return g;
}

// Strengthened: grander 9-seg serpentine body, tall bright frost crest-sail along the whole spine,
// bigger horned/fanged head w/ glowing brow-gem + brighter eyes + swelling frost-breath maw; richer undulation anim.
export function buildEnemy_wyrm(opts){
  const c = (opts && opts.color) || '#7fd9ff';
  const ice = '#bfeaff';
  const deep = '#3aa6e0';
  const eye = '#e8fbff';
  const breath = '#aef0ff';
  const seam = '#d6f6ff';
  const g = new T.Group();

  // ---- SEGMENTED SERPENTINE BODY (long chain arcing along +Z) ----
  const SEG = 9;
  const segGroups = [];
  for (let i = 0; i < SEG; i++) {
    const t = i / (SEG - 1);                 // 0 tail .. 1 neck
    const r = 0.13 + t * 0.32;               // stronger taper: thin tail -> thick neck
    const z = -1.85 + t * 2.55;              // longer march forward along +Z
    const sg = new T.Group();
    const baseY = 0.24 + r * 0.55;
    sg.position.set(0, baseY, z);
    sg.userData.baseY = baseY;               // captured up-front (anim-safe)

    // chunky angular vertebra ring (low-poly cyl, few sides = gothic facets)
    const ring = m(geo('wyrmSeg' + i, () => cyl(r, r * 1.14, 0.50, 6)), mat(c));
    ring.rotation.x = Math.PI / 2;           // axis along Z
    sg.add(ring);

    // bright ice spine-seam running the crest of each vertebra (energy backbone)
    const seg = m(geo('wyrmSeam' + i, () => box(r * 0.5, 0.07, 0.40)), matAdd(seam, 0.85));
    seg.position.y = r * 1.02;
    sg.add(seg);

    // ribbed dorsal plate band (mid ice ridge wrapping the top)
    const band = m(geo('wyrmBand' + i, () => box(r * 1.55, 0.11, 0.34)), mat(deep));
    band.position.y = r * 0.66;
    sg.add(band);

    // belly underplate (dim, grounds the silhouette)
    const belly = m(geo('wyrmBelly' + i, () => box(r * 1.3, 0.15, 0.36)), mat(deep));
    belly.position.y = -r * 0.80;
    sg.add(belly);

    // TALL FROST CREST-FIN sail on the spine (bold bright silhouette, grows toward neck)
    const sh = 0.40 + t * 0.66;
    const sail = m(geo('wyrmSail' + i, () => cone(r * 0.5, sh, 4)), matAdd(ice, 0.9));
    sail.position.y = r * 0.95 + sh * 0.5;
    sail.rotation.x = -0.20;                  // raked back
    sg.add(sail);

    // paired side frost fins (frost fringe) on the larger segments
    if (i >= 2) {
      const sf = 0.20 + t * 0.34;
      for (let s = -1; s <= 1; s += 2) {
        const fin = m(geo('wyrmFin' + i + (s > 0 ? 'R' : 'L'), () => cone(r * 0.28, sf, 4)), matAdd(c, 0.72));
        fin.position.set(s * r * 0.84, r * 0.40, 0);
        fin.rotation.z = s * 0.95;
        fin.rotation.x = -0.12;
        sg.add(fin);
      }
    }

    // glowing core node pulsing inside each vertebra (UNIQUE animated mat)
    const coreMat = new T.MeshBasicMaterial({ color: new T.Color(breath), fog: false, transparent: true, opacity: 0.55, blending: T.AdditiveBlending });
    const core = m(geo('wyrmCore' + i, () => box(r * 0.55, r * 0.55, 0.20)), coreMat);
    core.userData.coreMat = coreMat;
    sg.add(core);

    g.add(sg);
    segGroups.push(sg);
  }

  // ---- DRACONIC HEAD at +Z front ----
  const head = new T.Group();
  const neck = segGroups[SEG - 1];
  head.position.set(0, neck.position.y + 0.20, neck.position.z + 0.62);
  head.userData.baseY = head.position.y;
  g.add(head);

  // angular skull (faceted, wedge-shaped pointing +Z)
  const skull = m(geo('wyrmSkull', () => cyl(0.34, 0.46, 0.66, 6)), mat(c));
  skull.rotation.x = Math.PI / 2;
  skull.position.z = 0.08;
  head.add(skull);

  // upper snout wedge (cone driving the muzzle forward)
  const snout = m(geo('wyrmSnout', () => cone(0.30, 0.70, 5)), mat(c));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.06, 0.70);
  head.add(snout);

  // crown / brow ridge (dim mass over the eyes)
  const brow = m(geo('wyrmBrow', () => box(0.60, 0.18, 0.38)), mat(deep));
  brow.position.set(0, 0.27, 0.14);
  head.add(brow);

  // glowing brow-gem crowning the head (bright focal accent, UNIQUE animated)
  const gemMat = new T.MeshBasicMaterial({ color: new T.Color(seam), fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending });
  const gem = m(geo('wyrmGem', () => cone(0.13, 0.30, 4)), gemMat);
  gem.position.set(0, 0.40, 0.06);
  gem.userData.gemMat = gemMat;
  head.add(gem);

  // sweeping back-swept HORNS (pair) + smaller secondary horns + cheek spikes
  for (let s = -1; s <= 1; s += 2) {
    const horn = m(geo('wyrmHorn' + (s > 0 ? 'R' : 'L'), () => cone(0.11, 0.92, 5)), mat(ice));
    horn.position.set(s * 0.22, 0.36, -0.12);
    horn.rotation.set(0.98, 0, s * 0.30);     // sweep up and back
    head.add(horn);

    const horn2 = m(geo('wyrmHorn2' + (s > 0 ? 'R' : 'L'), () => cone(0.08, 0.50, 4)), mat(ice));
    horn2.position.set(s * 0.33, 0.22, 0.02);
    horn2.rotation.set(0.62, 0, s * 0.72);
    head.add(horn2);

    const cheek = m(geo('wyrmCheek' + (s > 0 ? 'R' : 'L'), () => cone(0.08, 0.38, 4)), matAdd(c, 0.72));
    cheek.position.set(s * 0.32, -0.02, 0.30);
    cheek.rotation.set(0, 0, s * 1.3);
    head.add(cheek);
  }

  // GLOWING EYES (unique animated, pulse menacingly) + socket slashes
  const eyeMats = [];
  for (let s = -1; s <= 1; s += 2) {
    const em = new T.MeshBasicMaterial({ color: new T.Color(eye), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending });
    const e = m(geo('wyrmEye' + (s > 0 ? 'R' : 'L'), () => box(0.15, 0.12, 0.11)), em);
    e.position.set(s * 0.20, 0.15, 0.40);
    e.userData.eyeMat = em;
    head.add(e);
    eyeMats.push(em);
    const slash = m(geo('wyrmSlash' + (s > 0 ? 'R' : 'L'), () => box(0.18, 0.045, 0.045)), matAdd(eye, 0.55));
    slash.position.set(s * 0.20, 0.23, 0.37);
    slash.rotation.z = s * 0.42;
    head.add(slash);
  }

  // OPEN FANGED JAW (lower mandible hinged at back, animates open)
  const jaw = new T.Group();
  jaw.position.set(0, -0.11, 0.10);
  head.add(jaw);
  const mandible = m(geo('wyrmJaw', () => cone(0.25, 0.62, 5)), mat(deep));
  mandible.rotation.x = Math.PI / 2;
  mandible.position.z = 0.50;
  jaw.add(mandible);
  // fang rows (upper fixed on head, lower on jaw)
  for (let s = -1; s <= 1; s += 2) {
    for (let f = 0; f < 3; f++) {
      const uf = m(geo('wyrmFangU' + (s > 0 ? 'R' : 'L') + f, () => cone(0.05, 0.22, 3)), matAdd(ice, 0.95));
      uf.position.set(s * 0.17, -0.04, 0.34 + f * 0.14);
      uf.rotation.x = Math.PI;                 // point down
      head.add(uf);
      const lf = m(geo('wyrmFangL' + (s > 0 ? 'R' : 'L') + f, () => cone(0.05, 0.20, 3)), matAdd(ice, 0.95));
      lf.position.set(s * 0.15, 0.06, 0.32 + f * 0.14);
      jaw.add(lf);
    }
  }

  // FROST BREATH glow billowing from the open maw (unique animated)
  const breathMat = new T.MeshBasicMaterial({ color: new T.Color(breath), fog: false, transparent: true, opacity: 0.35, blending: T.AdditiveBlending });
  const breathG = new T.Group();
  breathG.position.set(0, -0.02, 0.78);
  head.add(breathG);
  const maw = m(geo('wyrmMaw', () => cone(0.27, 0.78, 6)), breathMat);
  maw.rotation.x = Math.PI / 2;                // flare outward +Z
  maw.position.z = 0.32;
  breathG.add(maw);
  breathG.userData.breathMat = breathMat;
  // inner throat glow (unique animated)
  const throatMat = new T.MeshBasicMaterial({ color: new T.Color(eye), fog: false, transparent: true, opacity: 0.6, blending: T.AdditiveBlending });
  const throat = m(geo('wyrmThroat', () => box(0.18, 0.13, 0.13)), throatMat);
  throat.position.set(0, 0.0, 0.24);
  head.add(throat);
  head.userData.throatMat = throatMat;

  // ---- ANIM: full-body sine undulation + jaw/breath/eye/core/gem pulse ----
  g.userData.anim = function (root, now) {
    const tms = now * 0.001;
    // body undulation: travelling sine wave along the segment chain
    for (let i = 0; i < segGroups.length; i++) {
      const sg = segGroups[i];
      const phase = i * 0.66;
      sg.position.x = Math.sin(tms * 2.0 - phase) * (0.22 + i * 0.02);
      const bob = Math.sin(tms * 2.0 - phase + 0.5) * 0.05;
      sg.position.y = sg.userData.baseY + bob;
      sg.rotation.y = Math.cos(tms * 2.0 - phase) * 0.20;
      // pulse the inner core nodes
      const ch = sg.children;
      for (let k = 0; k < ch.length; k++) {
        const cm = ch[k].userData && ch[k].userData.coreMat;
        if (cm) cm.opacity = 0.4 + Math.sin(tms * 4.0 - phase) * 0.25;
      }
    }
    // head follows the neck segment laterally + slow menacing weave
    head.position.x = segGroups[SEG - 1].position.x + Math.sin(tms * 1.3) * 0.06;
    head.position.y = head.userData.baseY + Math.sin(tms * 2.0 - (SEG - 1) * 0.66 + 0.5) * 0.05;
    head.rotation.y = Math.sin(tms * 1.3) * 0.12;
    head.rotation.z = Math.sin(tms * 0.9) * 0.05;
    // jaw open/close
    const open = (Math.sin(tms * 1.6) * 0.5 + 0.5);
    jaw.rotation.x = 0.12 + open * 0.58;
    // breath pulse swells when jaw opens
    if (breathG.userData.breathMat) breathG.userData.breathMat.opacity = 0.12 + open * 0.42;
    breathG.scale.setScalar(0.7 + open * 0.75);
    if (head.userData.throatMat) head.userData.throatMat.opacity = 0.35 + open * 0.5;
    // brow-gem slow shimmer
    if (gem.userData.gemMat) gem.userData.gemMat.opacity = 0.65 + Math.sin(tms * 2.4) * 0.25;
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
// Strengthened: bolder cloaked/crested armored silhouette + brighter tabard/visor/weapon accents; unique animated mats; richer single idle-anim hook (breathing bob, eye flicker, per-weapon motion). Keeps opts(color,weapon) + userData.anim.
export function buildHireling(opts) {
  const o = opts || {};
  const c = o.color || '#cdd6e6';
  const wpn = o.weapon || 'sword';
  const g = new T.Group();

  const body = mat(c, 0.9), dark = mat('#171c27'), steel = mat('#3a4150');
  // unique uncached emissive eye material (anim mutates opacity per-instance)
  const eye = new T.MeshBasicMaterial({ color: '#bfe6ff', fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const trim = matAdd(c, 0.8); // bright themed accent (cached ok — not animated)

  // legs
  const lL = m(box(0.12, 0.34, 0.13), dark); lL.position.set(-0.09, 0.17, 0);
  const rL = m(box(0.12, 0.34, 0.13), dark); rL.position.set(0.09, 0.17, 0);

  // torso + tapered armored chest (broader top = grander)
  const torso = m(box(0.38, 0.42, 0.27), body); torso.position.set(0, 0.55, 0);
  const collar = m(box(0.42, 0.08, 0.3), steel); collar.position.set(0, 0.78, 0);

  // BIG back cloak — the main silhouette boost
  const cloak = m(box(0.46, 0.78, 0.05), dark); cloak.position.set(0, 0.5, -0.16);
  const cloakTrim = m(box(0.46, 0.06, 0.05), trim); cloakTrim.position.set(0, 0.88, -0.15);

  // glowing tabard chevron down the chest (bold bright stripe)
  const tabard = m(box(0.1, 0.34, 0.02), trim); tabard.position.set(0, 0.55, 0.15);
  const chevron = m(geo('hireChevron', () => new T.ConeGeometry(0.12, 0.14, 4)), trim);
  chevron.position.set(0, 0.36, 0.15); chevron.rotation.x = Math.PI;

  // spiked pauldrons (angular shoulders read as capable/armored)
  const lP = m(box(0.18, 0.15, 0.24), steel); lP.position.set(-0.26, 0.74, 0);
  const rP = m(box(0.18, 0.15, 0.24), steel); rP.position.set(0.26, 0.74, 0);
  const lSpike = m(geo('hireSpike', () => new T.ConeGeometry(0.07, 0.16, 4)), trim); lSpike.position.set(-0.26, 0.86, 0);
  const rSpike = m(geo('hireSpike', () => new T.ConeGeometry(0.07, 0.16, 4)), trim); rSpike.position.set(0.26, 0.86, 0);

  // arms
  const lA = m(box(0.1, 0.32, 0.11), dark); lA.position.set(-0.27, 0.52, 0.02);
  const rA = m(box(0.1, 0.32, 0.11), dark); rA.position.set(0.27, 0.52, 0.04);

  // crested helm + wide bright visor band + eyes
  const head = m(box(0.2, 0.2, 0.2), steel); head.position.set(0, 0.94, 0);
  const visor = m(box(0.21, 0.05, 0.02), trim); visor.position.set(0, 0.95, 0.11);
  const crest = m(geo('hireCrest', () => new T.ConeGeometry(0.05, 0.2, 4)), trim); crest.position.set(0, 1.12, -0.02);
  const eyeL = m(box(0.05, 0.04, 0.03), eye); eyeL.position.set(-0.05, 0.96, 0.11);
  const eyeR = m(box(0.05, 0.04, 0.03), eye); eyeR.position.set(0.05, 0.96, 0.11);

  g.add(lL, rL, torso, collar, cloak, cloakTrim, tabard, chevron, lP, rP, lSpike, rSpike, lA, rA, head, visor, crest, eyeL, eyeR);

  // weapon-specific extras + a unique animated energy material
  let energy = null, orb = null;
  if (wpn === 'bow') {
    const limb = m(geo('hireBowLimb', () => new T.TorusGeometry(0.3, 0.03, 4, 10, Math.PI * 1.15)), trim);
    limb.position.set(0.34, 0.55, 0.12); limb.rotation.z = Math.PI / 2;
    energy = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false });
    const str = m(box(0.012, 0.56, 0.012), energy); str.position.set(0.34, 0.55, 0.08);
    g.add(limb, str);
  } else if (wpn === 'staff') {
    const shaft = m(cyl(0.035, 0.045, 0.86, 5), steel); shaft.position.set(0.36, 0.5, 0.1);
    energy = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
    orb = m(geo('hireOrb', () => new T.IcosahedronGeometry(0.12, 0)), energy); orb.position.set(0.36, 0.98, 0.1);
    const claw = m(geo('hireClaw', () => new T.ConeGeometry(0.09, 0.16, 4)), trim); claw.position.set(0.36, 0.84, 0.1);
    g.add(shaft, orb, claw);
  } else {
    energy = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false });
    const blade = m(box(0.06, 0.56, 0.02), energy); blade.position.set(0.38, 0.76, 0.1);
    const guard = m(box(0.2, 0.06, 0.06), steel); guard.position.set(0.38, 0.48, 0.1);
    const gem = m(geo('hireGem', () => new T.OctahedronGeometry(0.06, 0)), trim); gem.position.set(0.38, 0.48, 0.1);
    g.add(blade, guard, gem);
  }

  g.userData.anim = (grp, now) => {
    const t = now / 1000;
    grp.position.y = Math.sin(t * 1.6) * 0.012;           // gentle breathing bob
    const flick = 0.7 + 0.3 * Math.sin(now / 180);
    eyeL.material.opacity = eyeR.material.opacity = flick; // eye flicker
    if (orb) {
      orb.scale.setScalar(1 + Math.sin(now / 220) * 0.16);
      orb.position.y = 0.98 + Math.sin(t * 1.6) * 0.012;
      energy.opacity = 0.8 + 0.2 * Math.sin(now / 200);
    } else if (energy) {
      energy.opacity = 0.6 + 0.25 * Math.sin(now / 240);   // bow string / blade pulse
    }
  };
  return g;
}

// THE HOLLOW KING — the campaign final boss. A towering crowned void-monarch:
// dark regal robe, hollow crown, a blazing void core, spectral mantle + tendrils,
// a skull-mask face with burning eyes. opts.color = void theme. Engine scales x1.6.
// Strengthened: towering/broad/regal final boss — crowned skull + shard halo, massive
// layered pauldrons + sweeping cape, bright pulsing hollow-light core, 4 eyes, great scepter.
export function buildEnemy_hollowking(opts) {
  const c = (opts && opts.color) || '#b388ff';
  const g = new T.Group();

  // ---- materials (additive display: structural masses use DIM glow so they read) ----
  const robe     = matAdd(c, 0.26);        // robe / body shell
  const robeDeep = matAdd(c, 0.18);        // deep robe / cape inner
  const plate    = matAdd(c, 0.34);        // pauldrons / armor shell (a touch brighter)
  const bone     = matAdd('#e9e0c8', 0.5); // skull / claws (pale bone)
  const boneDim  = matAdd('#cfc6b0', 0.34);
  const gold     = matAdd('#ffd27a', 0.92);// regal gold trim / crown
  const goldDim  = matAdd('#ffbe55', 0.5);
  const voidGlow = matAdd(c, 0.8);         // bright theme accents
  const voidDim  = matAdd(c, 0.4);

  // author slightly compact so engine x-scale lands grand but on-tile
  const RIG = new T.Group();
  RIG.scale.set(0.92, 0.92, 0.92);
  g.add(RIG);

  // ---------------------------------------------------------------
  // SWEEPING CAPE — wide tall backdrop that broadens the silhouette
  // ---------------------------------------------------------------
  const cape = new T.Group();
  cape.position.set(0, 1.05, -0.18);
  RIG.add(cape);
  const capeMain = m(geo('hk_cape', () => cone(0.7, 1.5, 5)), robeDeep);
  capeMain.position.y = -0.1; capeMain.scale.set(1.25, 1, 0.55);
  cape.add(capeMain);
  const capeEdgeMat = new T.MeshBasicMaterial({ color: new T.Color(c), transparent: true, opacity: 0.45, fog: false, blending: T.AdditiveBlending, depthWrite: false });
  const capeEdge = m(geo('hk_capeEdge', () => cone(0.74, 1.5, 5)), capeEdgeMat);
  capeEdge.position.y = -0.1; capeEdge.scale.set(1.28, 1, 0.5);
  cape.add(capeEdge);

  // ---------------------------------------------------------------
  // ROBE BODY — wide hem tapering up to a broad chest
  // ---------------------------------------------------------------
  const hem = m(geo('hk_hem', () => cyl(0.34, 0.78, 1.2, 7)), robeDeep);
  hem.position.y = 0.6;
  RIG.add(hem);
  const skirtFront = m(geo('hk_skirt', () => box(0.66, 1.1, 0.1)), robe);
  skirtFront.position.set(0, 0.62, 0.36);
  RIG.add(skirtFront);
  const torso = m(geo('hk_torso', () => cyl(0.3, 0.42, 0.7, 7)), robe);
  torso.position.y = 1.55;
  RIG.add(torso);
  // gold sash / belt
  const belt = m(geo('hk_belt', () => cyl(0.4, 0.46, 0.14, 8)), gold);
  belt.position.y = 1.22;
  RIG.add(belt);

  // ---------------------------------------------------------------
  // BLAZING HOLLOW-LIGHT CORE — bright chest furnace + twin rings
  // ---------------------------------------------------------------
  const coreMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const core = m(geo('hk_core', () => new T.IcosahedronGeometry(0.24, 0)), coreMat);
  core.position.set(0, 1.5, 0.34);
  RIG.add(core);
  const flareMat = new T.MeshBasicMaterial({ color: new T.Color('#ffffff'), fog: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  const flare = m(geo('hk_flare', () => new T.OctahedronGeometry(0.12, 0)), flareMat);
  flare.position.set(0, 1.5, 0.4);
  RIG.add(flare);
  const ring1 = m(geo('hk_ring1', () => new T.TorusGeometry(0.32, 0.03, 4, 18)), voidGlow);
  ring1.position.set(0, 1.5, 0.34);
  RIG.add(ring1);
  const ring2 = m(geo('hk_ring2', () => new T.TorusGeometry(0.4, 0.022, 4, 18)), voidDim);
  ring2.position.set(0, 1.5, 0.34); ring2.rotation.x = Math.PI / 3;
  RIG.add(ring2);

  // ---------------------------------------------------------------
  // MASSIVE ORNATE PAULDRONS — broad layered shoulders + spikes
  // ---------------------------------------------------------------
  function pauldron(side) {
    const grp = new T.Group();
    grp.position.set(0.56 * side, 1.78, 0);
    RIG.add(grp);
    const cap = m(geo('hk_pauldCap', () => cone(0.34, 0.4, 5)), plate);
    cap.rotation.z = side * 1.05; cap.scale.set(1.2, 1, 1.1);
    grp.add(cap);
    const cap2 = m(geo('hk_pauldCap2', () => cone(0.26, 0.34, 5)), plate);
    cap2.position.set(0.04 * side, -0.14, 0); cap2.rotation.z = side * 1.05;
    grp.add(cap2);
    const rim = m(geo('hk_pauldRim', () => new T.TorusGeometry(0.26, 0.035, 4, 12)), gold);
    rim.rotation.z = side * 1.05; rim.position.y = 0.04;
    grp.add(rim);
    // upward shoulder spikes
    for (let i = 0; i < 3; i++) {
      const sp = m(geo('hk_pauldSpike', () => cone(0.06, 0.4, 4)), gold);
      sp.position.set((0.02 + i * 0.12) * side, 0.18 + i * 0.04, -0.04);
      sp.rotation.z = side * (0.5 + i * 0.2);
      grp.add(sp);
    }
    return grp;
  }
  pauldron(-1); pauldron(1);

  // ---------------------------------------------------------------
  // ARMS — skeletal robed arms + clawed hands
  // ---------------------------------------------------------------
  const armL = m(geo('hk_arm', () => box(0.13, 0.7, 0.14)), robe);
  armL.position.set(-0.52, 1.3, 0.06); armL.rotation.z = 0.34;
  RIG.add(armL);
  const armR = m(box(0.13, 0.7, 0.14), robe);
  armR.position.set(0.52, 1.3, 0.06); armR.rotation.z = -0.34;
  RIG.add(armR);
  function claw(side, x) {
    for (let i = 0; i < 3; i++) {
      const cl = m(geo('hk_claw', () => cone(0.05, 0.22, 4)), bone);
      cl.position.set(x + (i - 1) * 0.07 * side, 0.92, 0.12);
      cl.rotation.x = 0.7; cl.rotation.z = (i - 1) * 0.2;
      RIG.add(cl);
    }
  }
  claw(-1, -0.66); claw(1, 0.66);

  // ---------------------------------------------------------------
  // HEAD — high collar, hood, crowned skull, FOUR glowing eyes
  // ---------------------------------------------------------------
  const collar = m(geo('hk_collar', () => cyl(0.3, 0.5, 0.42, 7)), robe);
  collar.position.y = 2.12;
  RIG.add(collar);
  const collarTrim = m(geo('hk_collarTrim', () => cyl(0.5, 0.54, 0.06, 7)), gold);
  collarTrim.position.y = 2.32;
  RIG.add(collarTrim);
  const hood = m(geo('hk_hood', () => cone(0.34, 0.62, 6)), robeDeep);
  hood.position.y = 2.62;
  RIG.add(hood);
  const skull = m(geo('hk_skull', () => box(0.26, 0.32, 0.24)), bone);
  skull.position.set(0, 2.42, 0.12);
  RIG.add(skull);
  const brow = m(geo('hk_brow', () => box(0.3, 0.07, 0.06)), boneDim);
  brow.position.set(0, 2.52, 0.25);
  RIG.add(brow);
  const jaw = m(geo('hk_jaw', () => box(0.2, 0.1, 0.18)), boneDim);
  jaw.position.set(0, 2.27, 0.16);
  RIG.add(jaw);
  // four eyes: two main + two smaller upper
  const eyeMat = new T.MeshBasicMaterial({ color: new T.Color('#ff3df0'), fog: false, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false });
  const eyes = [];
  const eyeGeoBig = geo('hk_eyeBig', () => box(0.07, 0.09, 0.05));
  const eyeGeoSm = geo('hk_eyeSm', () => box(0.045, 0.06, 0.05));
  [[-0.08, 2.45, eyeGeoBig], [0.08, 2.45, eyeGeoBig], [-0.13, 2.56, eyeGeoSm], [0.13, 2.56, eyeGeoSm]].forEach(p => {
    const e = m(p[2], eyeMat); e.position.set(p[0], p[1], 0.24); eyes.push(e); RIG.add(e);
  });

  // ---------------------------------------------------------------
  // THE HOLLOW CROWN — tall ring of gold spikes
  // ---------------------------------------------------------------
  const crownBand = m(geo('hk_crownBand', () => cyl(0.26, 0.3, 0.14, 9)), gold);
  crownBand.position.y = 2.74;
  RIG.add(crownBand);
  const crownSpikeGeo = geo('hk_crownSpike', () => cone(0.06, 0.34, 4));
  const crownCapGeo = geo('hk_crownCap', () => cone(0.04, 0.16, 4));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const tall = 0.34 + (i % 2) * 0.22;
    const sp = m(i % 2 ? crownSpikeGeo : crownCapGeo, gold);
    sp.position.set(Math.cos(a) * 0.27, 2.88 + (i % 2) * 0.1, Math.sin(a) * 0.27);
    sp.rotation.z = -Math.cos(a) * 0.18; sp.rotation.x = Math.sin(a) * 0.18;
    sp.scale.y = tall / 0.34;
    RIG.add(sp);
    if (i % 2) {
      const tipMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
      const tip = m(geo('hk_crownTip', () => new T.OctahedronGeometry(0.05, 0)), tipMat);
      tip.position.set(Math.cos(a) * 0.27, 3.18, Math.sin(a) * 0.27);
      RIG.add(tip);
    }
  }

  // ---------------------------------------------------------------
  // HALO OF GLOWING SHARDS — orbiting crown of light shards round head
  // ---------------------------------------------------------------
  const shards = [];
  const shardGeo = geo('hk_shard', () => cone(0.07, 0.3, 4));
  const haloMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const sh = m(shardGeo, haloMat);
    sh.userData.a = (i / 8) * Math.PI * 2;
    sh.userData.r = 0.5 + (i % 2) * 0.12;
    shards.push(sh); RIG.add(sh);
  }

  // ---------------------------------------------------------------
  // GREAT SCEPTER / GREATSWORD — planted at his right side, towering
  // ---------------------------------------------------------------
  const scepter = new T.Group();
  scepter.position.set(0.74, 0, 0.12); scepter.rotation.z = -0.12;
  RIG.add(scepter);
  const haft = m(geo('hk_haft', () => cyl(0.05, 0.06, 2.5, 6)), goldDim);
  haft.position.y = 1.25;
  scepter.add(haft);
  const guard = m(geo('hk_guard', () => box(0.5, 0.08, 0.1)), gold);
  guard.position.y = 1.9;
  scepter.add(guard);
  // blade / head: tall tapered prism
  const blade = m(geo('hk_blade', () => cone(0.13, 0.85, 4)), voidDim);
  blade.position.y = 2.45;
  scepter.add(blade);
  const bladeEdge = m(geo('hk_bladeEdge', () => cone(0.07, 0.85, 4)), voidGlow);
  bladeEdge.position.y = 2.5;
  scepter.add(bladeEdge);
  // crowning gem (animated)
  const gemMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
  const gem = m(geo('hk_gem', () => new T.OctahedronGeometry(0.13, 0)), gemMat);
  gem.position.y = 3.05;
  scepter.add(gem);
  const gemRing = m(geo('hk_gemRing', () => new T.TorusGeometry(0.16, 0.02, 4, 14)), gold);
  gemRing.position.y = 3.05; gemRing.rotation.x = Math.PI / 2;
  scepter.add(gemRing);

  // ---------------------------------------------------------------
  // GROUND POOL — bright glow puddle beneath the looming king
  // ---------------------------------------------------------------
  const poolMat = new T.MeshBasicMaterial({ color: new T.Color(c), fog: false, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false });
  const pool = m(geo('hk_pool', () => cyl(0.6, 0.95, 0.02, 14)), poolMat);
  pool.position.y = 0.02;
  RIG.add(pool);

  // ---------------------------------------------------------------
  // ANIM — core furnace pulse, orbiting halo, counter-spin rings,
  //        eye flicker, ominous hover, cape sway, scepter gem throb
  // ---------------------------------------------------------------
  g.userData.anim = (grp, now) => {
    const t = now * 0.001;
    // chest furnace
    coreMat.opacity = 0.7 + Math.sin(t * 5.5) * 0.25;
    core.scale.setScalar(1 + Math.sin(t * 4.8) * 0.16);
    flareMat.opacity = 0.5 + (Math.sin(t * 7.0) * 0.5 + 0.5) * 0.5;
    flare.rotation.y = t * 1.4; flare.rotation.x = t * 0.9;
    ring1.rotation.z = t * 0.8;
    ring2.rotation.z = -t * 0.6;
    // ominous hover (added to engine bob)
    grp.position.y = Math.sin(t * 1.2) * 0.05;
    // eye flicker
    eyeMat.opacity = 0.75 + Math.sin(t * 3.0) * 0.25;
    // halo shards orbit + bob around the head
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i], ang = s.userData.a + t * 0.9;
      const y = 2.95 + Math.sin(t * 1.6 + i) * 0.16;
      s.position.set(Math.cos(ang) * s.userData.r, y, Math.sin(ang) * s.userData.r);
      s.rotation.set(t * 1.2, ang, t * 0.7);
    }
    haloMat.opacity = 0.6 + Math.sin(t * 2.2) * 0.25;
    // cape sway
    cape.rotation.z = Math.sin(t * 0.8) * 0.05;
    capeEdgeMat.opacity = 0.35 + Math.sin(t * 1.4) * 0.12;
    // scepter gem throb
    gemMat.opacity = 0.7 + Math.sin(t * 4.0 + 1.0) * 0.25;
    gem.scale.setScalar(1 + Math.sin(t * 3.4) * 0.14);
    gem.rotation.y = t * 1.1;
    // ground pool breathing
    poolMat.opacity = 0.16 + Math.sin(t * 1.5) * 0.06;
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
  whirlwind: (prog, pm, ud) => {
    // STRENGTHENED: faster 4-rev spin w/ snappy wind-up→whirl→recovery, deeper lean, twin overhead blade sweep, crouch-and-lift
    const wind = prog < 0.16 ? prog / 0.16 : 1;                 // 0→1 coil
    const spin = prog < 0.16 ? 0 : (prog - 0.16) / 0.84;        // hold then unleash
    const env = Math.sin(prog * Math.PI);                        // 0→1→0 power
    pm.rotation.y = -wind * 0.5 + spin * spin * 4 * _TAU;        // coil back, then accelerate into 4 full spins
    pm.rotation.z = env * 0.30 * (1 - 0.3 * Math.sin(prog * _TAU * 4)); // hard lean + wobble
    pm.rotation.x = -wind * 0.18 + env * 0.05;                   // duck into the coil
    pm.position.y += env * 0.12 - wind * 0.05;                   // crouch then lift off
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[0].rotation.z = 0.4 + env * 1.7;  ud.arms[1].rotation.z = -(0.4 + env * 1.7); // arms flung wide
      ud.arms[0].rotation.x = -0.2 - env * 0.5; ud.arms[1].rotation.x = -0.2 - env * 0.5;   // raised overhead
    }
    if (ud.legs && ud.legs.length >= 2) {
      ud.legs[0].rotation.z = env * 0.22; ud.legs[1].rotation.z = -env * 0.22;  // braced wide stance
      ud.legs[0].rotation.x = env * 0.18; ud.legs[1].rotation.x = -env * 0.18;
    }
    ud.weaponMount.rotation.z = -1.45 - env * 0.25;             // blade swept flat & wide
    ud.weaponMount.rotation.x = 0.05 + env * 0.20;
    ud.weaponMount.rotation.y = env * 0.4;
  },
  leapslam: (prog, pm, ud) => {
  let dy = 0, pitch = 0, weapX = 0, weapY = 0, weapZ = 0, legTuck = 0, armUp = 0, sc = 1, shake = 0;
  if (prog < 0.28) {
    const t = prog / 0.28;
    const dip = Math.sin(Math.min(t, 0.55) / 0.55 * Math.PI * 0.5);
    const launch = t > 0.55 ? (t - 0.55) / 0.45 : 0;
    const lp = launch * launch;
    dy = -0.85 * dip * (1 - launch) + 1.35 * lp;
    pitch = -0.06 - 0.26 * dip * (1 - launch) + 0.30 * launch;
    legTuck = -1.0 * dip * (1 - launch) + 0.8 * lp;
    armUp = -0.5 - 1.7 * t;
    sc = 1 - 0.07 * dip * (1 - launch) + 0.10 * lp;
  } else if (prog < 0.58) {
    const t = (prog - 0.28) / 0.30;
    const air = Math.sin(t * Math.PI);
    dy = 1.35 + 0.65 * air;
    pitch = 0.30 - 0.16 * t;
    legTuck = 1.85 * Math.sin(Math.min(t * 1.35, 1) * Math.PI * 0.5);
    armUp = -2.3;
    weapX = -2.7;
    sc = 1 + 0.04 * air;
  } else if (prog < 0.76) {
    const t = (prog - 0.58) / 0.18;
    const drive = t * t * t;
    dy = 1.35 * (1 - drive);
    pitch = -0.75 * drive;
    legTuck = 1.85 * (1 - drive) - 0.45 * drive;
    armUp = -2.3 + 3.0 * drive;
    weapX = -2.7 + 3.5 * drive;
    sc = 1 + 0.10 * Math.sin(t * Math.PI);
  } else {
    const t = (prog - 0.76) / 0.24;
    const rec = Math.sin(t * Math.PI * 0.5);
    const bounce = Math.sin(Math.min(t * 1.6, 1) * Math.PI) * (1 - t);
    dy = -0.55 * (1 - rec) + 0.30 * bounce;
    pitch = -0.75 * (1 - rec) * (1 - 0.5 * t);
    legTuck = -0.45 * (1 - rec);
    armUp = 0.7 * (1 - rec);
    weapX = 0.8 * (1 - rec);
    sc = 1 + 0.06 * bounce;
    shake = (1 - t) * 0.05 * Math.sin(t * Math.PI * 9);
  }
  pm.position.y += dy;
  pm.rotation.x = pitch;
  pm.rotation.z = shake;
  pm.scale.setScalar(sc);
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = armUp; ud.arms[1].rotation.x = armUp;
    ud.arms[0].rotation.z = 0.20; ud.arms[1].rotation.z = -0.20;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = legTuck; ud.legs[1].rotation.x = legTuck;
  }
  ud.weaponMount.rotation.x = weapX;
  ud.weaponMount.rotation.y = weapY;
  ud.weaponMount.rotation.z = weapZ;
},
  warcry: (prog, pm, ud, now, moving) => {
  const plant = Math.min(1, prog / 0.18);
  const charge = Math.min(1, prog / 0.55);
  const swell = Math.sin(charge * Math.PI * 0.5);
  const wind = Math.sin(Math.min(1, prog / 0.45) * Math.PI * 0.5); // arms-back wind-up
  const hold = prog > 0.22 && prog < 0.7 ? 1 : Math.max(0, 1 - Math.abs(prog - 0.46) / 0.46);
  const thrust = prog > 0.7 ? (prog - 0.7) / 0.3 : 0;
  const tEnv = Math.sin(Math.min(1, thrust) * Math.PI);
  const tSnap = thrust > 0 ? Math.sin(Math.min(1, thrust / 0.45) * Math.PI * 0.5) : 0; // fast fling-out
  // chest swells big, recoils punchy on the roar
  pm.scale.setScalar(1 + swell * (0.18 + Math.sin(now * 0.024) * 0.03 * hold) - thrust * 0.07 + tEnv * 0.05);
  // defiant lean BACK during charge, snap UPRIGHT/forward on roar
  pm.rotation.x = -swell * 0.46 * (1 - thrust) + tEnv * 0.5;
  pm.position.y += swell * 0.07 * (1 - thrust) - thrust * 0.06 + tEnv * 0.04;
  pm.rotation.z = Math.sin(now * 0.032) * 0.035 * hold;
  if (ud.arms && ud.arms.length >= 2) {
    // wind-up: arms flung hard BACK and slightly out
    const back = -2.45 * wind * (1 - thrust);
    const out = 1.05 * wind * (1 - thrust);
    ud.arms[0].rotation.x = back; ud.arms[1].rotation.x = back;
    ud.arms[0].rotation.z = out; ud.arms[1].rotation.z = -out;
    if (thrust > 0) {
      // release: arms SNAP wide-open and forward (defiant flex-out)
      const fx = -0.3 + tSnap * 0.9;
      const fz = 0.2 + tSnap * 1.55;
      ud.arms[0].rotation.x = fx; ud.arms[1].rotation.x = fx;
      ud.arms[0].rotation.z = fz; ud.arms[1].rotation.z = -fz;
    }
  }
  if (ud.legs && ud.legs.length >= 2) {
    // hard wide stomp plant, deepens on the roar
    const st = 0.34 * plant + thrust * 0.12;
    ud.legs[0].rotation.x = st; ud.legs[1].rotation.x = -st;
    ud.legs[0].rotation.z = 0.16 * plant; ud.legs[1].rotation.z = -0.16 * plant;
  }
  if (ud.weaponMount) {
    // weapon thrust skyward on charge, then punched out on roar
    ud.weaponMount.rotation.x = -swell * 0.6 * (1 - thrust) + tEnv * 0.4;
    ud.weaponMount.rotation.z = swell * 0.25 * (1 - thrust);
  }
},
  shieldwall: (prog, pm, ud, now, moving) => {
  const set = Math.min(prog / 0.14, 1);
  const ease = set * set * (3 - 2 * set);
  const release = prog > 0.82 ? (prog - 0.82) / 0.18 : 0;
  const snap = release > 0 ? Math.sin(release * Math.PI) : 0;
  const brace = ease * (1 - release * 0.65);
  const tremble = Math.sin(prog * Math.PI * 26) * 0.018 * (brace > 0.35 ? 1 : 0);
  pm.position.y -= brace * 0.34 - snap * 0.08;
  pm.rotation.x = -brace * 0.30 + snap * 0.10;
  pm.rotation.z = tremble;
  pm.scale.y = 1 - brace * 0.06 + snap * 0.05;
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = brace * 0.46; ud.legs[0].rotation.z = brace * 0.34;
    ud.legs[1].rotation.x = -brace * 0.40; ud.legs[1].rotation.z = -brace * 0.34;
  }
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[0].rotation.x = -brace * 1.6 + snap * 0.35;
    ud.arms[0].rotation.z = -brace * 0.7 + tremble * 3;
    ud.arms[0].rotation.y = brace * 0.55;
    ud.arms[1].rotation.x = brace * 0.7;
    ud.arms[1].rotation.z = -brace * 0.24;
  }
  ud.weaponMount.rotation.x = brace * 1.1 - snap * 0.4;
  ud.weaponMount.rotation.z = -brace * 0.6;
  ud.weaponMount.position.y = -brace * 0.14;
  ud.weaponMount.position.z = brace * 0.1 + snap * 0.12;
},
  frostnova: (prog, pm, ud) => {
  // STRENGTHENED: deeper rise→crouch wind-up, harder ground slam, arms sweep WIDE out + recoil bounce
  const rise = Math.min(1, prog / 0.4);                 // wind-up: lift up onto toes, arms overhead
  const er = rise * rise * (3 - 2 * rise);
  const snap = prog < 0.4 ? 0 : Math.min(1, (prog - 0.4) / 0.1); // the slam
  const es = snap * snap * (3 - 2 * snap);
  const settle = prog < 0.5 ? 0 : (prog - 0.5) / 0.5;   // recovery back to neutral
  const recoil = Math.sin(snap * Math.PI) * (1 - settle * 0.5);
  // crouch: rise UP during windup, then SLAM down hard, then bob back up
  pm.position.y += er * 0.18 - es * 0.5 * (1 - settle) - recoil * 0.06;
  pm.rotation.x = -er * 0.22 + es * 0.5 * (1 - settle * 0.7);  // lean back, then pitch forward into slam
  pm.scale.setScalar(1 + recoil * 0.09 - es * 0.04 * (1 - settle));
  if (ud.arms && ud.arms.length >= 2) {
    // windup: arms raise overhead. slam: arms whip DOWN then sweep WIDE out to the sides
    const ax = -er * 2.3 + es * 3.0;
    ud.arms[0].rotation.x = ax;
    ud.arms[1].rotation.x = ax;
    const spread = er * 0.35 + es * 1.15 - settle * 0.95;  // big wide sweep on release
    ud.arms[0].rotation.z = spread;
    ud.arms[1].rotation.z = -spread;
  }
  if (ud.legs && ud.legs.length >= 2) {
    const tuck = es * 0.7 * (1 - settle * 0.8);  // legs bend into the crouch on impact
    ud.legs[0].rotation.x = tuck;
    ud.legs[1].rotation.x = tuck;
  }
},
  chainlightning: (prog, pm, ud, now, moving) => {
  // STRENGTHENED: tighter coil-back then a violent forward arm-snap + lunge, sharper electric jolt-shudder on release.
  const coil = Math.min(prog / 0.32, 1);
  const cEase = coil * coil;
  const snap = prog < 0.32 ? 0 : Math.min((prog - 0.32) / 0.18, 1);
  const sEase = snap < 0.5 ? 4 * snap * snap * snap : 1 - Math.pow(-2 * snap + 2, 3) / 2;
  const rel = prog > 0.5 ? (prog - 0.5) / 0.5 : 0;
  const jolt = rel > 0 ? Math.sin(rel * Math.PI * 11) * Math.pow(1 - rel, 2) : 0;
  const settle = 1 - sEase * rel * 0.55;
  // lean back on coil, then drive the torso forward into the throw
  pm.rotation.x = -cEase * 0.30 * (1 - snap) + sEase * 0.34 * settle + jolt * 0.06;
  pm.rotation.y += cEase * 0.42 * (1 - snap) - sEase * 0.78 * settle + jolt * 0.10;
  pm.rotation.z = cEase * 0.14 * (1 - snap) - sEase * 0.10 * settle - jolt * 0.05;
  pm.position.y += -cEase * 0.06 * (1 - snap) + sEase * 0.05 * (1 - rel);
  if (ud.arms && ud.arms.length >= 2) {
    // throwing arm (1): cocked high/back, then hurled straight forward
    ud.arms[1].rotation.x = -cEase * 1.4 * (1 - snap) - sEase * 2.9 * settle + jolt * 0.18;
    ud.arms[1].rotation.z = -cEase * 0.9 * (1 - snap) + sEase * 0.55 * settle;
    ud.arms[1].rotation.y = -cEase * 0.4 * (1 - snap) + sEase * 0.42;
    // off arm (0): flares back for counterbalance
    ud.arms[0].rotation.z = cEase * 0.7 * (1 - snap) - sEase * 0.6 * settle;
    ud.arms[0].rotation.x = cEase * 0.35 * (1 - snap) - sEase * 0.4;
    ud.arms[0].rotation.y = sEase * 0.25;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = sEase * 0.4 * (1 - rel * 0.5);
    ud.legs[1].rotation.x = -sEase * 0.3 * (1 - rel * 0.5);
  }
  if (ud.weaponMount) ud.weaponMount.rotation.x = -cEase * 0.5 * (1 - snap) - sEase * 1.2 * settle;
},
  meteor: (prog, pm, ud, now, moving) => {
  const gather = Math.min(prog / 0.62, 1);
  const gEase = gather * gather * (3 - 2 * gather);
  const snap = prog > 0.62 ? (prog - 0.62) / 0.20 : 0;
  const sEase = snap < 1 ? snap * snap : 1;
  const land = prog > 0.82 ? (prog - 0.82) / 0.18 : 0;
  const lEase = land * land * (3 - 2 * land);
  // point UP (lean back, rise) -> DRIVE DOWN (hard forward pitch, drop) -> crouch recover
  pm.rotation.x = -gEase * 0.55 + sEase * 1.25 - lEase * 0.35;
  pm.position.y += gEase * 0.16 - sEase * 0.22 - lEase * 0.18;
  pm.rotation.z = Math.sin(gather * Math.PI * 4) * 0.04 * gEase * (1 - snap);
  if (ud.arms && ud.arms.length >= 2) {
    // both arms punch overhead together, then slam straight down past the body
    const up = -gEase * 3.2 + sEase * 5.4 - lEase * 1.2;
    const tremor = Math.sin(prog * 64) * 0.07 * gEase * (1 - snap);
    ud.arms[0].rotation.x = up + tremor;
    ud.arms[1].rotation.x = up - tremor;
    ud.arms[0].rotation.z = gEase * 0.30 - sEase * 0.34;
    ud.arms[1].rotation.z = -gEase * 0.30 + sEase * 0.34;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // brace on the slam, deep crouch on landing
    ud.legs[0].rotation.x = sEase * 0.35 - lEase * 0.9;
    ud.legs[1].rotation.x = -sEase * 0.35 + lEase * 0.9;
  }
},
  blinkstrike: (prog, pm, ud, now, moving) => {
  if (prog < 0.3) {
    // BLINK-OUT: implode hard and fast, pull arms in tight
    const t = prog / 0.3;
    const e = t * t * t;
    pm.scale.setScalar(1 - e * 0.78);
    pm.position.y += -e * 0.34;
    pm.rotation.x = -e * 0.22;
    pm.rotation.z = Math.sin(t * Math.PI) * 0.25 * (1 - e); // shiver
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[0].rotation.x = e * 0.7; ud.arms[1].rotation.x = e * 0.7;
      ud.arms[0].rotation.z = e * 0.45; ud.arms[1].rotation.z = -e * 0.45;
    }
  } else {
    // ARRIVAL STRIKE: snap to full size, hard z-flicker, violent lunge + recovery
    const t = (prog - 0.3) / 0.7;
    const burst = 1 - Math.pow(1 - t, 4);
    const flick = 1 + Math.sin(prog * 120) * 0.07 * Math.max(0, 1 - t * 2.2);
    const overshoot = 1 + Math.sin(Math.min(t * 1.6, 1) * Math.PI) * 0.14;
    pm.scale.setScalar((0.22 + burst * 0.78) * flick * overshoot);
    pm.position.y += -0.34 * (1 - burst) + Math.sin(t * Math.PI) * 0.14;
    // quick re-materialize flicker on the roll axis, settling to 0
    pm.rotation.z = Math.sin(prog * 140) * 0.12 * Math.max(0, 1 - t * 3);
    const lunge = Math.sin(Math.min(t * 1.5, 1) * Math.PI);
    pm.rotation.x = -0.22 - lunge * 0.55;
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[1].rotation.x = -1.6 - lunge * 0.9;
      ud.arms[1].rotation.z = -0.08;
      ud.arms[0].rotation.x = 0.7 - lunge * 0.55;
      ud.arms[0].rotation.z = 0.4;
    }
    ud.weaponMount.rotation.x = -1.8 - lunge * 0.7;
    ud.weaponMount.rotation.z = -lunge * 0.4; // slash cant
    ud.weaponMount.position.z = lunge * 0.6;
    ud.weaponMount.position.y = lunge * 0.26;
  }
},
  multishot: (prog, pm, ud, now, moving) => {
  const draw = Math.min(1, prog / 0.6);
  const drawE = draw * draw * (3 - 2 * draw);
  const released = prog > 0.6;
  const rel = released ? (prog - 0.6) / 0.4 : 0;
  const snap = released ? Math.sin(Math.min(1, rel * 1.7) * Math.PI) * (1 - rel * 0.35) : 0;
  const settle = released ? Math.sin(Math.min(1, rel) * Math.PI) * 0.5 : 0;
  // turn into the draw, then whip forward on loose
  pm.rotation.y += -0.62 * drawE + snap * 0.34;
  pm.rotation.z = drawE * 0.07 - snap * 0.06;
  pm.rotation.x = -drawE * 0.07 + snap * 0.18 - settle * 0.05;
  pm.position.y += -drawE * 0.05 + snap * 0.035;
  // small forward lunge as the volley releases
  pm.position.z += snap * 0.12;
  if (ud.arms && ud.arms.length >= 2) {
    // bow arm punches out and steadies, recoiling on loose
    ud.arms[0].rotation.x = -1.6 * drawE - snap * 0.15;
    ud.arms[0].rotation.z = 0.16 * drawE;
    ud.arms[0].rotation.y = -0.3 * drawE;
    // string hand hauls back hard, then snaps fully forward
    const drawBack = 0.95 + 0.7 * drawE;
    const fwd = released ? snap * 2.1 : 0;
    ud.arms[1].rotation.x = -drawBack + fwd;
    ud.arms[1].rotation.z = -0.62 * drawE + snap * 0.4;
    ud.arms[1].rotation.y = 0.42 * drawE - snap * 0.5;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // brace stance widens on draw, drives forward on loose
    ud.legs[0].rotation.x = 0.3 * drawE - snap * 0.25;
    ud.legs[1].rotation.x = -0.38 * drawE + snap * 0.2;
  }
  // bow held across body, tips on release
  ud.weaponMount.rotation.z = 1.55 * drawE;
  ud.weaponMount.rotation.x = -0.18 * drawE - snap * 0.28;
  ud.weaponMount.position.x = 0.12 * drawE;
},
  poisontrap: (prog, pm, ud) => {
  // phases: wind-up (load low/back) -> release whip -> recovery
  const wind = Math.min(1, prog / 0.5);
  const windE = wind * wind * (3 - 2 * wind);            // smooth load
  const released = prog > 0.5;
  const rel = released ? (prog - 0.5) / 0.5 : 0;
  const whip = released ? Math.sin(Math.min(1, rel * 1.5) * Math.PI) * (1 - rel * 0.35) : 0; // snappy forward burst
  // body coils forward over the load, then unwinds with a small hop on release
  pm.rotation.x = -windE * 0.30 + whip * 0.34;           // lean in, then kick chest up as it lobs
  pm.rotation.z = windE * 0.10 - whip * 0.06;            // weight onto throwing side
  pm.position.y += -windE * 0.20 + whip * 0.14;          // dip to load, pop on the toss
  pm.rotation.y += windE * 0.18 - whip * 0.22;           // slight torso wind then unwind
  if (ud.arms && ud.arms.length >= 2) {
    // arm[0] = throwing arm: swings LOW and BACK to load, then whips forward-and-up underhand
    ud.arms[0].rotation.x = 0.95 * windE - whip * 2.35;  // back-low -> forward-up release
    ud.arms[0].rotation.z = 0.30 * windE - whip * 0.35;  // flares out across the body on release
    ud.arms[0].rotation.y = -0.20 * windE + whip * 0.30;
    // arm[1] = off arm counterbalances back, then forward
    ud.arms[1].rotation.x = -0.45 * windE + whip * 0.55;
    ud.arms[1].rotation.z = -0.18 * windE;
  }
  if (ud.legs && ud.legs.length >= 2) {                  // ranger has legs: brace + drive
    ud.legs[0].rotation.x = 0.55 * windE - whip * 0.30;  // lead leg loads then extends
    ud.legs[0].rotation.z = windE * 0.12;
    ud.legs[1].rotation.x = -0.35 * windE + whip * 0.25; // back leg drives the toss
  }
},
  piercingshot: (prog, pm, ud) => {
  const lunge = Math.min(1, prog / 0.55);
  const le = lunge * lunge * (3 - 2 * lunge);
  const draw = prog < 0.55 ? le : 1;
  const release = prog > 0.6 ? Math.min(1, (prog - 0.6) / 0.4) : 0;
  const re = release * release * (3 - 2 * release);
  // a short violent snap right at loose for the whip-crack
  const snap = Math.max(0, Math.sin(Math.min(1, Math.max(0, (prog - 0.6) / 0.22)) * Math.PI));
  // heavy charged tremble during the held draw
  const tremble = draw * (1 - re) * Math.sin(prog * 140) * 0.04;
  pm.rotation.x = -0.78 * le + re * 0.18 - snap * 0.1;
  pm.position.y += -0.28 * le + re * 0.08 + snap * 0.04;
  pm.rotation.z = 0.07 * le * (1 - re) + tremble;
  pm.scale.y = 1 - 0.05 * draw * (1 - re) + snap * 0.06;
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 1.25 * le + re * 0.3;
    ud.legs[1].rotation.x = -1.05 * le - snap * 0.15;
    ud.legs[0].rotation.z = 0.12 * le;
  }
  if (ud.arms && ud.arms.length >= 2) {
    const tension = draw * (1 - re) + tremble;
    // bow arm punches forward and locks
    ud.arms[0].rotation.x = -1.5 - 0.45 * tension + re * 0.45;
    ud.arms[0].rotation.z = 0.6 * draw - re * 0.6 - snap * 0.12;
    // draw arm hauls back hard, then snaps open on loose
    ud.arms[1].rotation.x = -0.95 + 0.75 * tension - 0.8 * re;
    ud.arms[1].rotation.z = -0.7 * draw + re * 1.25 + snap * 0.4;
  }
  if (ud.weaponMount) {
    ud.weaponMount.rotation.z = 0.5 * draw - re * 0.55;
    ud.weaponMount.rotation.x = -0.15 * draw;
  }
},
  volley: (prog, pm, ud, now, moving) => {
  const draw = Math.min(prog / 0.55, 1);
  const drawE = draw * draw * (3 - 2 * draw);
  const rel = prog > 0.55 ? (prog - 0.55) / 0.45 : 0;
  // snap loose: fast attack, settle back
  const relE = rel < 0.35 ? (rel / 0.35) : 1 - 0.55 * ((rel - 0.35) / 0.65);
  const twang = rel > 0 && rel < 0.4 ? Math.sin(rel / 0.4 * Math.PI) * Math.sin(now * 0.05) * 0.06 : 0;
  // arc the bow skyward: lean back hard on draw, punch up on loose
  const lean = -0.85 * drawE + 1.05 * relE;
  pm.rotation.x = lean;
  pm.rotation.z = 0.09 * Math.sin(prog * Math.PI) + twang;
  pm.position.y += -0.09 * drawE + 0.14 * relE;
  if (ud.arms && ud.arms.length >= 2) {
    // both arms raise overhead, aiming the bow up
    const raise = -2.7 * drawE + 2.5 * relE;
    ud.arms[0].rotation.x = raise;
    ud.arms[1].rotation.x = raise;
    ud.arms[0].rotation.z = 0.5 * drawE - 0.35 * relE;
    ud.arms[1].rotation.z = -0.5 * drawE + 0.35 * relE;
    // draw-hand pulls the string back, then snaps forward on release
    const drawPull = -0.7 * drawE * (1 - rel);
    ud.arms[1].rotation.x += drawPull - twang * 2;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // brace stance: front leg plants, back leg drives
    ud.legs[0].rotation.x = 0.4 * drawE - 0.3 * relE;
    ud.legs[1].rotation.x = -0.42 * drawE + 0.5 * relE;
  }
  // bow arcs from drawn-low to loosed-skyward
  ud.weaponMount.rotation.x = -2.6 * drawE + 2.0 * relE;
  ud.weaponMount.rotation.z = 0.32 * drawE - 0.18 * relE + twang;
},
  raisedead: (prog, pm, ud) => {
  const TAU = Math.PI * 2;
  // wind-up: hunch low over the grave, then HEAVE the dead up
  const gather = Math.min(prog / 0.40, 1);
  const ge = Math.sin(gather * Math.PI / 2);            // ease-in crouch
  const heave = prog > 0.40 ? Math.min((prog - 0.40) / 0.30, 1) : 0;
  const he = Math.sin(heave * Math.PI / 2);             // ease-out rise
  const peak = Math.max(0, 1 - Math.abs(prog - 0.62) / 0.16); // summon climax
  const climax = peak * peak;
  const recover = prog > 0.78 ? (prog - 0.78) / 0.22 : 0;
  // body: hunch forward over the earth, then arch back as the dead burst forth
  pm.rotation.x = ge * 0.34 - he * 0.40 - climax * 0.14;
  pm.position.y += -ge * 0.14 + he * 0.10 + climax * 0.06;
  // violent ritual shudder at the climax + steady ritual sway
  const shudder = climax > 0.15 ? Math.sin(prog * 95) * climax * 0.07 : 0;
  pm.rotation.z = Math.sin(prog * TAU * 2.5) * (ge * 0.10 + he * 0.06) + shudder;
  pm.position.y += shudder * 0.6;
  if (ud.arms && ud.arms.length >= 2) {
    // crouch: arms reach DOWN to claw the earth -> HEAVE wide+overhead to drag the dead up
    const down = ge * 1.0;                              // dig toward the grave
    const up = he * 2.9 + climax * 0.5;                 // wrench skyward
    const ax = down - up;                               // arms.x: down (+) then far up (-)
    ud.arms[0].rotation.x = ax;
    ud.arms[1].rotation.x = ax;
    const spread = 0.30 + he * 1.05 + climax * 0.25;    // throw WIDE at release
    ud.arms[0].rotation.z = spread;
    ud.arms[1].rotation.z = -spread;
    // claw inward low, splay outward high
    ud.arms[0].rotation.y = ge * 0.35 - he * 0.40;
    ud.arms[1].rotation.y = -ge * 0.35 + he * 0.40;
    // recovery: let arms settle
    ud.arms[0].rotation.x += recover * 0.6;
    ud.arms[1].rotation.x += recover * 0.6;
  }
},
  souldrain: (prog, pm, ud) => {
  const reach = Math.min(1, prog * 1.8);
  const drink = Math.max(0, (prog - 0.45) / 0.55);
  const drinkE = drink * drink * (3 - 2 * drink);
  const reel = Math.sin(prog * Math.PI * 6) * (1 - prog * 0.35);
  const grab = 0.5 - 0.5 * Math.cos(prog * Math.PI * 8);
  pm.rotation.x = -0.42 * reach + 0.46 * drinkE + reel * 0.07;
  pm.rotation.z = 0.09 * Math.sin(prog * Math.PI * 4) - 0.05 * grab;
  pm.position.y += -0.07 * reach - 0.12 * drinkE + reel * 0.025;
  pm.scale.x = pm.scale.z = 1 + 0.07 * drinkE * Math.sin(prog * Math.PI * 10);
  if (ud.arms && ud.arms.length >= 2) {
    const out = -1.95 * (1 - reach) - 0.45 * reach;
    const claw = grab * 0.3;
    ud.arms[0].rotation.x = out + claw - 0.7 * drinkE;
    ud.arms[0].rotation.z = -0.4 - 0.55 * reach + 0.2 * drinkE;
    ud.arms[0].rotation.y = 0.32 * reach;
    ud.arms[1].rotation.x = out * 0.85 + claw - 0.7 * drinkE;
    ud.arms[1].rotation.z = 0.4 + 0.55 * reach - 0.2 * drinkE;
    ud.arms[1].rotation.y = -0.32 * reach;
  }
},
  corpseexplosion: (prog, pm, ud) => {
  const TAU = Math.PI * 2;
  // clench: pull in & crouch over first 42%
  const gather = Math.min(prog / 0.42, 1);
  const ge = Math.sin(gather * Math.PI / 2);
  const ge2 = ge * ge;
  // snap window around the throw-down
  const d = Math.max(0, 1 - Math.abs(prog - 0.5) / 0.10);
  const snap = d * d * d;
  const recoil = prog > 0.55 ? Math.max(0, 1 - (prog - 0.55) / 0.45) : 0;
  const rb = Math.sin(recoil * Math.PI);
  // body: hunch forward during clench, drive DOWN hard on slam, settle
  pm.rotation.x = -ge2 * 0.30 + snap * 1.05 - rb * 0.16;
  pm.position.y += ge2 * 0.06 - snap * 0.32 - rb * 0.05;
  pm.rotation.z = Math.sin(prog * TAU * 1.5) * snap * 0.07;
  // hard tremble at the detonation, fading shudder after
  const tremble = (snap > 0.15 ? Math.sin(prog * 120) * snap * 0.06 : 0) + rb * Math.sin(prog * 70) * 0.025;
  pm.position.y += tremble;
  pm.scale.setScalar(1 + snap * 0.10 - ge * 0.03);
  if (ud.arms && ud.arms.length >= 2) {
    // CLENCH: arms hauled UP and IN tight across the chest (fists balled at center)
    const clenchUp = -ge * 2.2;        // raised, drawn back
    const clenchIn = ge * 1.0;         // pulled inward across chest
    // THROW-DOWN: drive both arms violently down past the body
    const slam = snap * 3.8;
    const ax = clenchUp + slam - rb * 0.5;
    ud.arms[0].rotation.x = ax;
    ud.arms[1].rotation.x = ax;
    ud.arms[0].rotation.z = clenchIn - snap * 0.5;
    ud.arms[1].rotation.z = -clenchIn + snap * 0.5;
    ud.arms[0].rotation.y = -clenchIn * 0.6 + snap * 0.5;
    ud.arms[1].rotation.y = clenchIn * 0.6 - snap * 0.5;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // brace: legs spread/dig in on the slam
    const brace = snap * 0.35 + ge * 0.12;
    ud.legs[0].rotation.z = brace;
    ud.legs[1].rotation.z = -brace;
    ud.legs[0].rotation.x = -ge * 0.25 + snap * 0.2;
    ud.legs[1].rotation.x = ge * 0.25 - snap * 0.2;
  }
},
  boneprison: (prog, pm, ud, now) => {
  // BOLDER: big horizontal sweep-summon (cross-body wind-up -> outward fling) + crouch-anchor stomp on release.
  const wind = prog < 0.40 ? (prog / 0.40) : 1;          // 0->1 wind-up
  const fling = prog >= 0.40 ? Math.min(1, (prog - 0.40) / 0.30) : 0; // 0->1 outward sweep
  const settle = prog > 0.78 ? (1 - (prog - 0.78) / 0.22) : 1;        // ease-out
  const windE = Math.sin(wind * Math.PI * 0.5);
  const flingE = Math.sin(fling * Math.PI * 0.5);
  // crouch + forward lean as the cage erupts ahead
  pm.position.y -= (windE * 0.10 + flingE * 0.16) * settle;
  pm.rotation.x = (windE * 0.10 + flingE * 0.26) * settle;
  // body twists into the sweep: load to one side, snap to the other
  pm.rotation.y += (-windE * 0.45 + flingE * 0.70) * settle;
  // grind tremor while the bones rise
  const tremor = (prog > 0.45 && prog < 0.85) ? Math.sin(now * 0.06) * 0.018 * settle : 0;
  pm.rotation.z = tremor;
  if (ud.arms && ud.arms.length >= 2) {
    // wind-up: both arms drawn across to one side, low
    // fling: arms sweep wide and out, palms casting the ring forward
    ud.arms[0].rotation.x = 0.30 + windE * 0.55 + flingE * 0.95;
    ud.arms[1].rotation.x = 0.30 + windE * 0.55 + flingE * 0.95;
    ud.arms[0].rotation.z = (windE * 0.85) - (flingE * 1.55);   // lead arm flings wide
    ud.arms[1].rotation.z = (-windE * 0.20) + (flingE * 1.35);  // trailing arm opens
    ud.arms[0].rotation.y = flingE * 0.5;
    ud.arms[1].rotation.y = -flingE * 0.5;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // braced stance: legs spread on the fling/stomp
    ud.legs[0].rotation.z = flingE * 0.22;
    ud.legs[1].rotation.z = -flingE * 0.22;
    ud.legs[0].rotation.x = -flingE * 0.18;
    ud.legs[1].rotation.x = flingE * 0.18;
  }
  if (ud.weaponMount) {
    ud.weaponMount.rotation.z = (windE * 0.6) - (flingE * 1.1);
  }
},
  demonslash: (prog, pm, ud) => {
  const wind = Math.min(1, prog / 0.26);
  const swing = prog < 0.26 ? 0 : Math.min(1, (prog - 0.26) / 0.46);
  const recover = prog < 0.72 ? 0 : (prog - 0.72) / 0.28;
  // snappy ease-out so the release cracks, plus a slight overshoot
  const ease = swing < 1 ? 1 - Math.pow(1 - swing, 3) : 1;
  const over = Math.sin(swing * Math.PI) * (1 - swing);
  const swingEnv = Math.sin(swing * Math.PI);
  const coil = wind * (1 - swing);
  // body: coil away then whip across and over the lead shoulder
  pm.rotation.y += -0.95 * coil + 2.1 * ease + 0.35 * over - 0.6 * recover;
  pm.rotation.z = -0.4 * coil + 0.55 * swingEnv - 0.16 * recover;
  // diagonal: pitch DOWN hard through the swing to drive the descending slash
  pm.rotation.x = 0.16 * coil - 0.5 * ease + 0.34 * swingEnv;
  pm.position.y += -0.1 * coil - 0.22 * ease * (1 - recover) + 0.05 * swingEnv;
  pm.scale.setScalar(1 + 0.09 * swingEnv);
  if (ud.arms && ud.arms.length >= 2) {
    ud.arms[1].rotation.x = -0.6 - 1.5 * coil + 1.5 * ease;
    ud.arms[1].rotation.z = -0.45 - 1.2 * coil + 1.7 * ease;
    ud.arms[1].rotation.y = -0.85 * coil + 1.0 * ease;
    ud.arms[0].rotation.z = 0.7 * swingEnv - 0.55 * coil;
    ud.arms[0].rotation.x = 0.35 * swingEnv;
  }
  if (ud.legs && ud.legs.length >= 2) {
    ud.legs[0].rotation.x = 0.55 * coil + 0.55 * ease;
    ud.legs[1].rotation.x = -0.45 * coil - 0.45 * ease;
  }
  if (ud.weaponMount) {
    // raise high-and-back on wind-up, then carve a fast diagonal down-across
    ud.weaponMount.rotation.z = -1.9 + 1.5 * coil + 3.5 * ease + 0.4 * over;
    ud.weaponMount.rotation.y = 1.5 * coil - 3.0 * ease;
    ud.weaponMount.rotation.x = -0.5 * coil + 0.9 * ease - 0.35 * recover;
  }
},
  starfall: (prog, pm, ud) => {
      // Stronger overhead conjure: deeper wind-up, snappier release, 3 downward "meteor-call" pulses to match the 3 stars
      const rise = Math.sin(Math.min(prog, 0.62) / 0.62 * Math.PI * 0.5);
      const arch = rise;
      const strike = prog > 0.62 ? (prog - 0.62) / 0.38 : 0;
      const e = strike * strike * (3 - 2 * strike);
      const pulse = strike > 0 ? Math.abs(Math.sin(strike * Math.PI * 3)) * (1 - strike) : 0;
      pm.rotation.x = -arch * 0.5 + e * 0.72 - pulse * 0.12;
      pm.position.y += rise * 0.18 - e * 0.16 + pulse * 0.05;
      if (ud.arms && ud.arms.length >= 2) {
        const up = -2.95;
        const lx = up * (1 - e) + e * 0.7 - pulse * 0.3;
        ud.arms[0].rotation.x = lx; ud.arms[1].rotation.x = lx;
        ud.arms[0].rotation.z = (0.7 * (1 - e)) - e * 0.2;
        ud.arms[1].rotation.z = (-0.7 * (1 - e)) + e * 0.2;
      }
      if (ud.legs && ud.legs.length >= 2) {
        ud.legs[0].rotation.x = -e * 0.3; ud.legs[1].rotation.x = e * 0.3;
      }
      if (ud.weaponMount) { ud.weaponMount.rotation.z = -arch * 0.6 + e * 0.4; }
    },
  typhoonshot: (prog, pm, ud) => { /* STRENGTHENED: deeper wound-up coil (full body twist + crouch) then explosive whip-release with snappier overshoot, brighter pose */ const coil = Math.min(prog / 0.5, 1); const rel = Math.max((prog - 0.5) / 0.5, 0); const ease = (1 - Math.cos(coil * Math.PI)) / 2; const relEase = Math.sin(Math.min(rel, 1) * Math.PI * 0.5); const snap = Math.sin(Math.min(rel, 1) * Math.PI); const env = Math.sin(prog * Math.PI); pm.rotation.y += -1.15 * ease * (1 - rel) + 2.7 * relEase - 1.05 * relEase * relEase; pm.rotation.z = -0.38 * ease * (1 - rel) + 0.26 * snap; pm.rotation.x = -0.30 * ease * (1 - rel) + 0.34 * snap; pm.position.y += env * 0.06 - 0.13 * ease * (1 - rel) + 0.09 * snap; pm.scale.setScalar(1 + 0.06 * snap - 0.04 * ease * (1 - rel)); const draw = ease * (1 - rel); if (ud.arms && ud.arms.length >= 2) { ud.arms[0].rotation.x = -0.5 - 1.2 * draw + 0.6 * relEase; ud.arms[1].rotation.x = -0.5 - 1.2 * draw + 0.6 * relEase; ud.arms[0].rotation.z = 0.45 + 1.2 * draw - 2.0 * relEase; ud.arms[1].rotation.z = -0.45 - 1.2 * draw + 2.0 * relEase; ud.arms[0].rotation.y = 0.95 * draw - 0.7 * relEase; ud.arms[1].rotation.y = -0.95 * draw + 0.7 * relEase; } if (ud.legs && ud.legs.length >= 2) { ud.legs[0].rotation.x = 0.4 * draw - 0.5 * relEase; ud.legs[1].rotation.x = -0.4 * draw + 0.5 * relEase; ud.legs[0].rotation.z = 0.12 * draw; ud.legs[1].rotation.z = -0.12 * draw; } if (ud.weaponMount) { ud.weaponMount.rotation.z = -0.85 - 0.85 * draw + 1.4 * relEase; ud.weaponMount.rotation.x = -0.45 * draw + 0.7 * snap; ud.weaponMount.rotation.y = 0.8 * draw - 1.2 * relEase; } },
  soulharvest: (prog, pm, ud, now, moving) => {
  const reap = Math.min(prog / 0.58, 1);
  const draw = Math.max((prog - 0.58) / 0.42, 0);
  const reapE = Math.sin(reap * Math.PI * 0.5);
  const drawE = draw * draw * (3 - 2 * draw);
  // snap: a quick spike right as the pull fires, then settle
  const snap = Math.sin(Math.min(draw / 0.3, 1) * Math.PI) * (1 - draw * 0.5);
  pm.rotation.y += reapE * 1.15 * (1 - drawE * 0.4);
  pm.rotation.z = reapE * 0.16 * (1 - drawE) - snap * 0.05;
  pm.rotation.x = -drawE * 0.2 + reapE * 0.06 * (1 - drawE) + snap * 0.12;
  // crouch as souls slam in, then a small upward heave from the nova
  pm.position.y += -reapE * 0.05 * (1 - drawE) - snap * 0.1 + drawE * 0.18;
  const pulse = 1 + drawE * 0.05 + snap * 0.09;
  pm.scale.setScalar(pulse);
  if (ud.arms && ud.arms.length >= 2) {
    const out = reapE * 1.7 * (1 - drawE);
    const clutch = drawE * 0.75 + snap * 0.25;
    ud.arms[0].rotation.z = out - clutch;
    ud.arms[1].rotation.z = -out + clutch;
    const lift = reapE * 0.7 * (1 - drawE);
    ud.arms[0].rotation.x = -lift - drawE * 1.55 - snap * 0.4;
    ud.arms[1].rotation.x = -lift - drawE * 1.55 - snap * 0.4;
    ud.arms[0].rotation.y = reapE * 0.55 * (1 - drawE);
    ud.arms[1].rotation.y = -reapE * 0.55 * (1 - drawE);
  }
  if (ud.legs && ud.legs.length >= 2) {
    const stance = reapE * 0.24 * (1 - drawE) + drawE * 0.3;
    ud.legs[0].rotation.x = stance;
    ud.legs[1].rotation.x = -stance;
  }
  if (ud.weaponMount) {
    ud.weaponMount.rotation.z = -0.7 - reapE * 0.6 + snap * 0.5;
    ud.weaponMount.rotation.x = 0.2 - snap * 0.4;
  }
},
  seismicrupture: (prog, pm, ud, now, moving) => {
    // seismicrupture body: BOLD overhead two-hand slam — high wind-up, hard drive-down at ~0.45, sharp recoil/recovery.
    const wind = Math.min(prog / 0.45, 1);                 // 0→1 raise phase
    const wEase = wind * wind;                              // accel into the top
    const slam = prog > 0.45 ? Math.min((prog - 0.45) / 0.18, 1) : 0; // 0→1 drive down
    const sEase = slam * slam * (3 - 2 * slam);
    const rec = prog > 0.63 ? (prog - 0.63) / 0.37 : 0;     // recoil / settle
    const recEase = Math.sin(Math.min(rec, 1) * Math.PI) * (1 - Math.min(rec, 1) * 0.4);
    // torso: arch back on wind-up, pitch hard forward on the slam, small bounce-back recoil
    pm.rotation.x = -wEase * 0.55 + sEase * 0.95 - recEase * 0.25;
    // rise on toes during wind-up, drop & crouch on impact (ADD to existing bob)
    pm.position.y += wEase * 0.14 * (1 - slam) - sEase * 0.22 + recEase * 0.04;
    // weapon: hauled WAY overhead (behind head), then chopped straight down past front
    const wpnX = -2.5 + wEase * 0.6 - sEase * 3.2 + recEase * 0.5;
    ud.weaponMount.rotation.x = wpnX;
    ud.weaponMount.rotation.z = Math.sin(prog * Math.PI) * 0.05;
    if (ud.arms && ud.arms.length >= 2) {
      // both arms reach overhead (negative x = up/back), then drive down together
      const armX = -2.3 * wEase + sEase * 2.9 - recEase * 0.3;
      ud.arms[0].rotation.x = armX; ud.arms[1].rotation.x = armX;
      // hands close together for a two-hand grip
      ud.arms[0].rotation.z = -0.32 + sEase * 0.10;
      ud.arms[1].rotation.z = 0.32 - sEase * 0.10;
    }
    if (ud.legs && ud.legs.length >= 2) {
      // brace stance: legs splay and bend on the slam to absorb the impact
      const brace = sEase * (1 - recEase * 0.5);
      ud.legs[0].rotation.x = -brace * 0.55 - recEase * 0.15;
      ud.legs[1].rotation.x = brace * 0.55 + recEase * 0.15;
      ud.legs[0].rotation.z = -brace * 0.12;
      ud.legs[1].rotation.z = brace * 0.12;
    }
  },
  singularity: (prog, pm, ud) => {
    const reach = Math.sin(Math.min(prog / 0.4, 1) * Math.PI * 0.5);   // arms thrust forward 0->1
    const rel = prog > 0.72 ? (prog - 0.72) / 0.28 : 0;                // final shove on implosion
    const env = Math.sin(prog * Math.PI);
    pm.rotation.x = 0.14 * reach + 0.16 * rel;                          // lean into the cast
    pm.position.y += env * 0.05;
    if (ud.arms && ud.arms.length >= 2) {
      ud.arms[0].rotation.x = -1.5 * reach - 0.35 * rel; ud.arms[1].rotation.x = -1.5 * reach - 0.35 * rel;
      ud.arms[0].rotation.z = 0.28 - 0.2 * reach; ud.arms[1].rotation.z = -0.28 + 0.2 * reach;   // palms drawn together, forward
    }
    if (ud.weaponMount) { ud.weaponMount.rotation.x = -1.2 * reach; }
  },
  explosiveshot: (prog, pm, ud, now, moving) => {
  // phases: draw (0..0.55) → loose snap (0.55..0.72) → recovery (0.72..1)
  const draw = Math.min(prog / 0.55, 1);
  const dEase = draw * draw * (3 - 2 * draw);
  const loose = prog > 0.55 ? Math.min((prog - 0.55) / 0.17, 1) : 0;
  const recov = prog > 0.72 ? (prog - 0.72) / 0.28 : 0;
  // lean back while drawing, then punch forward on release, settle on recovery
  pm.rotation.x = -0.22 * dEase + loose * 0.34 - recov * 0.10;
  pm.rotation.z = 0.10 * dEase;                    // bracing side-lean
  pm.position.y += Math.sin(prog * Math.PI) * 0.03; // slight rise
  if (ud.arms && ud.arms.length >= 2) {
    // arm[0] = bow arm thrust forward+up; arm[1] = string hand drawn back hard then snaps fwd
    ud.arms[0].rotation.x = -1.15 - dEase * 0.25 + loose * 0.20;
    ud.arms[0].rotation.z = 0.18;
    const back = dEase * 1.0;                       // pull string back
    const snap = loose * 1.5;                       // release fling forward
    ud.arms[1].rotation.x = -0.55 - back + snap;
    ud.arms[1].rotation.z = -0.45 - dEase * 0.35 + loose * 0.30;
  }
  if (ud.legs && ud.legs.length >= 2) {
    // staggered archer's stance: lead leg fwd, rear leg braced back, dig in on loose
    ud.legs[0].rotation.x = 0.34 + loose * 0.10;
    ud.legs[1].rotation.x = -0.30 - dEase * 0.10;
    ud.legs[0].rotation.z = 0.05; ud.legs[1].rotation.z = -0.07;
  }
  if (ud.weaponMount) {                             // bow held level, kicks on release
    ud.weaponMount.rotation.z = 1.55;
    ud.weaponMount.rotation.x = -0.10 + loose * 0.22 - recov * 0.10;
  }
},
  gravegrasp: (prog, pm, ud, now, moving) => {
    const wind = Math.min(prog / 0.34, 1);                 // reach up
    const wEase = wind * wind * (3 - 2 * wind);
    const slam = prog > 0.34 ? (prog - 0.34) / 0.40 : 0;   // sweep down
    const sEase = slam * slam * (3 - 2 * slam);
    const settle = prog > 0.74 ? (prog - 0.74) / 0.26 : 0;
    // body: rise on wind-up, pitch forward + sink hard on the down-claw, ease back on settle
    pm.position.y += wEase * 0.10 - sEase * 0.16 + settle * 0.05;
    pm.rotation.x = -wEase * 0.12 + sEase * 0.42 - settle * 0.30;   // lean back, then drive forward
    pm.rotation.z = (slam > 0 && settle === 0) ? Math.sin(prog * 60) * 0.05 : 0; // summon shudder
    if (ud.arms && ud.arms.length >= 2) {
      const base = -2.3 * wEase;                           // raised overhead during wind-up
      const armX = base + (1.3 - base) * sEase;            // then sweep down hard past the body
      ud.arms[0].rotation.x = armX; ud.arms[1].rotation.x = armX;
      ud.arms[0].rotation.z = 0.35 + sEase * 0.25;         // claw hands inward
      ud.arms[1].rotation.z = -0.35 - sEase * 0.25;
    }
    if (ud.legs && ud.legs.length >= 2) {                  // guard: mage/summoner have no legs
      ud.legs[0].rotation.x = -sEase * 0.20; ud.legs[1].rotation.x = sEase * 0.20;
    }
    if (ud.weaponMount) { ud.weaponMount.rotation.x = sEase * 0.5; }
  },
};

// WARRIOR — Whirlwind flourish: a spinning translucent blade-disc + streaks at waist height.
// STRENGTHENED: dual counter-rotating blade rings + long trailing arcs + rising spark motes; brighter additive, scales/fades with cast
export function buildCastFx_whirlwind(opts) {
  const c = (opts && opts.color) || '#ff4d6d';
  const g = new T.Group();
  const newMat = (op) => new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const ringMatLo = newMat(0.7);
  const ringLo = m(geo('whirlwindRingLo', () => new T.RingGeometry(1.1, 2.3, 40)), ringMatLo);
  ringLo.rotation.x = -Math.PI / 2; ringLo.position.y = 0.45; g.add(ringLo);
  const ringMatHi = newMat(0.5);
  const ringHi = m(geo('whirlwindRingHi', () => new T.RingGeometry(0.7, 1.7, 40)), ringMatHi);
  ringHi.rotation.x = -Math.PI / 2; ringHi.position.y = 0.85; g.add(ringHi);
  const arcMat = newMat(0.85);
  const arcGeo = geo('whirlwindArc', () => new T.RingGeometry(1.7, 2.15, 24, 1, 0, Math.PI * 0.55));
  const arcs = [];
  for (let i = 0; i < 4; i++) {
    const a = m(arcGeo, arcMat);
    a.rotation.x = -Math.PI / 2;
    a.userData.a = (i / 4) * _TAU;
    a.position.y = 0.5 + i * 0.05;
    g.add(a); arcs.push(a);
  }
  const streakMat = newMat(0.8);
  const streaks = [];
  for (let i = 0; i < 6; i++) {
    const s = m(box(4.2, 0.06, 0.16), streakMat);
    s.position.y = 0.5 + i * 0.05;
    s.userData.a = (i / 6) * _TAU;
    g.add(s); streaks.push(s);
  }
  const moteMat = newMat(0.9);
  const moteGeo = geo('whirlwindMote', () => new T.SphereGeometry(0.09, 6, 6));
  const motes = [];
  for (let i = 0; i < 8; i++) {
    const mt = m(moteGeo, moteMat);
    mt.userData.a = (i / 8) * _TAU;
    mt.userData.r = 1.6 + (i % 3) * 0.35;
    g.add(mt); motes.push(mt);
  }
  g.userData.castAnim = (grp, prog) => {
    const env = Math.sin(prog * Math.PI);
    const spin = prog * _TAU;
    ringMatLo.opacity = 0.85 * env;
    ringMatHi.opacity = 0.6 * env;
    arcMat.opacity = 0.95 * env;
    streakMat.opacity = 0.8 * env;
    moteMat.opacity = env;
    ringLo.scale.setScalar(0.6 + prog * 1.0);
    ringLo.rotation.z = spin * 6;
    ringHi.scale.setScalar(0.5 + env * 0.8);
    ringHi.rotation.z = -spin * 8;
    for (let i = 0; i < arcs.length; i++) {
      arcs[i].rotation.z = arcs[i].userData.a + spin * 7;
      arcs[i].scale.setScalar(0.7 + prog * 0.6);
    }
    for (let i = 0; i < streaks.length; i++) {
      streaks[i].rotation.y = streaks[i].userData.a + spin * 7;
      streaks[i].scale.setScalar(0.5 + prog * 0.7);
    }
    for (let i = 0; i < motes.length; i++) {
      const ang = motes[i].userData.a + spin * 7;
      const r = motes[i].userData.r * (0.5 + prog * 0.9);
      motes[i].position.set(Math.cos(ang) * r, 0.4 + env * 1.1 + (i % 3) * 0.2, Math.sin(ang) * r);
      motes[i].scale.setScalar(0.6 + env * 0.8);
    }
  };
  return g;
}

// leapslam fx: brighter falling streak, white-hot core impact burst, bolder dual shockwave rings + radial crack-spikes + rising sparks on landing
export function buildCastFx_leapslam(opts) {
  const c = (opts && opts.color) || "#ffc857";
  const g = new T.Group();

  const mk = (col) => new T.MeshBasicMaterial({ color: col, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = mk(c);
  const ring2Mat = mk(c);
  const dustMat = mk(c);
  const lineMat = mk("#ffffff");
  const flashMat = mk("#ffffff");
  const coreMat = mk(c);
  const sparkMat = mk(c);

  const ring = m(geo("cfxLeapslamRing", () => new T.RingGeometry(0.5, 1.05, 40)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);

  const ring2 = m(geo("cfxLeapslamRing2", () => new T.RingGeometry(0.18, 0.5, 32)), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.05; g.add(ring2);

  const flash = m(geo("cfxLeapslamFlash", () => new T.CircleGeometry(0.7, 28)), flashMat);
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.06; g.add(flash);

  const core = m(geo("cfxLeapslamCore", () => new T.SphereGeometry(0.32, 14, 10)), coreMat);
  core.position.y = 0.1; g.add(core);

  const spikes = [];
  for (let i = 0; i < 10; i++) {
    const s = m(geo("cfxLeapslamSpike", () => new T.BoxGeometry(0.95, 0.06, 0.14)), dustMat);
    const a = (i / 10) * Math.PI * 2;
    s.userData.a = a;
    s.position.y = 0.07;
    g.add(s); spikes.push(s);
  }

  const sparks = [];
  for (let i = 0; i < 8; i++) {
    const sp = m(geo("cfxLeapslamSpark", () => new T.BoxGeometry(0.07, 0.5, 0.07)), sparkMat);
    const a = (i / 8) * Math.PI * 2 + 0.3;
    sp.userData.a = a;
    g.add(sp); sparks.push(sp);
  }

  const streak = m(geo("cfxLeapslamStreak", () => new T.BoxGeometry(0.14, 2.0, 0.14)), lineMat);
  streak.position.y = 1.0; g.add(streak);

  g.userData.castAnim = (grp, prog) => {
    if (prog < 0.58) {
      lineMat.opacity = 0.0; ringMat.opacity = 0.0; ring2Mat.opacity = 0.0;
      dustMat.opacity = 0.0; flashMat.opacity = 0.0; coreMat.opacity = 0.0; sparkMat.opacity = 0.0;
    } else if (prog < 0.76) {
      const t = (prog - 0.58) / 0.18;
      lineMat.opacity = 0.85 * (1 - Math.abs(t - 0.5) * 1.6);
      streak.scale.y = 1.0 + 0.6 * t;
      streak.position.y = 1.7 - 1.4 * t;
      ringMat.opacity = 0.0; ring2Mat.opacity = 0.0; dustMat.opacity = 0.0; sparkMat.opacity = 0.0;
      const b = Math.max(0, (t - 0.6) / 0.4);
      flashMat.opacity = 1.0 * b;
      flash.scale.setScalar(0.4 + 1.0 * b);
      coreMat.opacity = 1.0 * b;
      core.scale.setScalar(0.5 + 1.0 * b);
    } else {
      const t = (prog - 0.76) / 0.24;
      const fade = 1 - t;
      const ef = fade * fade;
      lineMat.opacity = 0.0;

      ringMat.opacity = 0.85 * ef;
      ring.scale.setScalar(0.5 + 3.4 * t);

      ring2Mat.opacity = 0.7 * ef;
      ring2.scale.setScalar(0.4 + 2.4 * Math.min(t * 1.4, 1));

      flashMat.opacity = 1.0 * Math.max(0, 1 - t * 2.6);
      flash.scale.setScalar(1.3 + 1.8 * t);

      coreMat.opacity = 0.9 * Math.max(0, 1 - t * 2.2);
      core.scale.setScalar(1.5 + 2.0 * t);

      dustMat.opacity = 0.8 * fade;
      const reach = 0.4 + 2.8 * t;
      for (let i = 0; i < spikes.length; i++) {
        const s = spikes[i];
        s.rotation.y = s.userData.a;
        s.position.x = Math.cos(s.userData.a) * reach;
        s.position.z = Math.sin(s.userData.a) * reach;
        s.scale.x = 0.6 + 1.6 * t;
      }

      sparkMat.opacity = 0.85 * ef;
      const srad = 0.3 + 1.4 * t;
      const sy = 0.1 + 1.8 * t * (1 - 0.4 * t);
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        sp.position.x = Math.cos(sp.userData.a) * srad;
        sp.position.z = Math.sin(sp.userData.a) * srad;
        sp.position.y = sy;
        sp.scale.y = 1.0 - 0.5 * t;
      }
    }
  };

  return g;
}

// warcry: brighter triple shockwave + punchier roar burst, taller pulsing aura column, brighter rising embers + ground flash
export function buildCastFx_warcry(opts) {
  const c = (opts && opts.color) || "#ffb44a";
  const g = new T.Group();
  const RM = () => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });

  // Three stacked shockwave rings blasting outward on the roar
  const waves = [];
  const ringDefs = [
    ["cfxWarcryWaveA", 0.5, 0.95, 40, 3.8, 0.85],
    ["cfxWarcryWaveB", 0.38, 0.66, 34, 2.6, 0.6],
    ["cfxWarcryWaveC", 0.28, 0.46, 28, 1.7, 0.42],
  ];
  for (const d of ringDefs) {
    const mat = RM();
    const ring = m(geo(d[0], () => new T.RingGeometry(d[1], d[2], d[3])), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    ring.userData = { mat: mat, grow: d[4], peak: d[5] };
    g.add(ring); waves.push(ring);
  }

  // Bright ground flash disc under the feet at the moment of the roar
  const flashMat = RM();
  const flash = m(geo("cfxWarcryFlash", () => new T.CircleGeometry(0.9, 32)), flashMat);
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.04; g.add(flash);

  // Roar cone bursting out the front from chest height
  const roarMat = RM();
  const roar = m(cone(0.62, 1.05, 20), roarMat);
  roar.rotation.x = Math.PI / 2; roar.position.set(0, 1.05, 0.5); g.add(roar);

  // Tall fury aura column swelling at the chest through the held roar
  const colMat = RM();
  const col = m(cyl(0.34, 0.56, 1.55, 18), colMat);
  col.position.y = 1.0; g.add(col);

  // Bright crown ring lifting off the shoulders as the buff lands
  const crownMat = RM();
  const crown = m(geo("cfxWarcryCrown", () => new T.RingGeometry(0.34, 0.5, 28)), crownMat);
  crown.rotation.x = -Math.PI / 2; crown.position.y = 1.1; g.add(crown);

  // Rising fury embers spiraling around the body
  const embers = [];
  for (let i = 0; i < 8; i++) {
    const eMat = RM();
    const e = m(box(0.11, 0.26, 0.11), eMat);
    const a = (i / 8) * Math.PI * 2;
    e.userData = { a: a, r: 0.44 + (i % 2) * 0.2, ph: i * 0.13, mat: eMat };
    g.add(e); embers.push(e);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const charge = Math.min(1, prog / 0.55);
    const swell = Math.sin(charge * Math.PI * 0.5);
    const hold = prog > 0.22 && prog < 0.7 ? 1 : Math.max(0, 1 - Math.abs(prog - 0.46) / 0.5);
    const rel = prog > 0.7 ? (prog - 0.7) / 0.3 : 0;
    const relEnv = Math.sin(Math.min(1, rel) * Math.PI);
    const relSnap = rel > 0 ? Math.sin(Math.min(1, rel / 0.4) * Math.PI * 0.5) : 0;

    // Shockwaves blast outward, brighter and faster
    for (const w of waves) {
      w.userData.mat.opacity = w.userData.peak * relEnv;
      w.scale.setScalar(0.28 + relSnap * w.userData.grow);
    }

    // Ground flash pops hard then fades
    flashMat.opacity = 0.8 * relEnv * (1 - rel * 0.4);
    flash.scale.setScalar(0.5 + relSnap * 1.4);

    // Roar cone punches forward
    roarMat.opacity = 0.7 * relEnv;
    roar.scale.set(0.5 + relSnap * 1.5, 0.5 + relSnap * 2.5, 0.5 + relSnap * 1.5);
    roar.position.z = 0.5 + relSnap * 0.8;

    // Fury column pulses during the held charge, collapses on release
    colMat.opacity = 0.55 * hold * (1 - rel);
    const pulse = 1 + Math.sin(now * 0.024) * 0.16 * hold;
    col.scale.set((0.6 + swell * 0.65) * pulse, 0.7 + swell * 0.8, (0.6 + swell * 0.65) * pulse);

    // Crown ring rises and brightens as the buff lands
    crownMat.opacity = (0.4 * swell + 0.5 * relEnv);
    crown.scale.setScalar(0.7 + swell * 0.6 + relSnap * 1.0);
    crown.position.y = 1.1 + swell * 0.2 + rel * 0.3;

    // Embers rise and intensify with the build
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      const t = ((now * 0.0011 + e.userData.ph) % 1);
      const spin = now * 0.0012;
      e.position.x = Math.cos(e.userData.a + spin) * e.userData.r;
      e.position.z = Math.sin(e.userData.a + spin) * e.userData.r;
      e.position.y = 0.2 + t * 1.8;
      e.userData.mat.opacity = (0.7 * swell) * (1 - t) * (1 - rel * 0.5);
    }
  };

  return g;
}

// shieldwall fx: swapped the dim dome for a BOLD hexagonal barrier raised in front — bright hex border + lit honeycomb cells that slam up into place, edge spark, ground brace
export function buildCastFx_shieldwall(opts) {
  const c = (opts && opts.color) || "#8fb7ff";
  const g = new T.Group();

  // wall pivots up from its base, planted in front of the player
  const wall = new T.Group();
  wall.position.set(0, 0.05, 0.92);
  g.add(wall);

  const R = 0.9; // hex radius

  // bright outer hex ring (the barrier border)
  const borderMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const border = m(geo("cfxSwBorder", () => new T.RingGeometry(R * 0.86, R, 6, 1)), borderMat);
  border.rotation.z = Math.PI / 2; // point-up hexagon
  border.position.y = R;
  wall.add(border);

  // translucent face glow filling the hex
  const faceMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const face = m(geo("cfxSwFace", () => new T.CircleGeometry(R * 0.92, 6)), faceMat);
  face.rotation.z = Math.PI / 2;
  face.position.y = R; face.position.z = -0.01;
  wall.add(face);

  // honeycomb cells — small hexes that light up across the barrier
  const cells = [];
  const cr = R * 0.26; // cell radius
  const offs = [
    [0, 0], [0, 1], [0, -1],
    [0.87, 0.5], [0.87, -0.5], [-0.87, 0.5], [-0.87, -0.5]
  ];
  for (let i = 0; i < offs.length; i++) {
    const cMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const cell = m(geo("cfxSwCell" + i, () => new T.RingGeometry(cr * 0.62, cr * 0.78, 6, 1)), cMat);
    cell.rotation.z = Math.PI / 2;
    cell.position.x = offs[i][0] * cr * 1.55;
    cell.position.y = R + offs[i][1] * cr * 1.7;
    cell.position.z = 0.005;
    cell.userData.mat = cMat;
    cell.userData.ph = i * 0.9;
    wall.add(cell); cells.push(cell);
  }

  // top edge spark bar — bright line that runs along the barrier crest on slam
  const sparkMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const spark = m(box(R * 1.7, 0.06, 0.06), sparkMat);
  spark.position.y = R * 1.9;
  wall.add(spark);

  // ground brace ring at the player's feet
  const baseMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ground = m(geo("cfxSwGround", () => new T.RingGeometry(0.5, 0.92, 6)), baseMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.02, 0.92); ground.scale.z = 0.6;
  g.add(ground);

  g.userData.castAnim = (grp, prog, now) => {
    // raise: hex rotates up from the ground (0..0.18), hold, then snap-flare on release
    const raise = Math.min(prog / 0.18, 1);
    const er = raise * raise * (3 - 2 * raise);
    const rel = prog > 0.82 ? (prog - 0.82) / 0.18 : 0;
    const snap = rel > 0 ? Math.sin(rel * Math.PI) : 0;
    const live = 1 - rel * 0.5;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.007);

    // tilt the whole wall up into place
    wall.rotation.x = (1 - er) * 1.25;
    wall.scale.setScalar(0.6 + 0.4 * er + 0.06 * snap);

    borderMat.opacity = (0.55 + 0.35 * pulse) * er * live + 0.6 * snap;
    faceMat.opacity = (0.16 + 0.12 * pulse) * er * live + 0.2 * snap;
    baseMat.opacity = (0.4 + 0.25 * pulse) * er * live;

    // cells light up in a sweep as the wall settles
    for (let i = 0; i < cells.length; i++) {
      const m2 = cells[i].userData.mat;
      const tw = 0.5 + 0.5 * Math.sin(now * 0.006 + cells[i].userData.ph);
      m2.opacity = (0.35 + 0.45 * tw) * er * live + 0.5 * snap;
    }

    // edge spark fires on the slam-into-place
    sparkMat.opacity = 0.95 * snap;
    spark.scale.x = 0.6 + 0.6 * snap;
  };

  return g;
}

export function buildCastFx_frostnova(opts) {
  // STRENGTHENED: brighter double shockwave ring + leading rim, hotter impact flash, 12 jagged shards that punch up+out, frost motes
  const c = (opts && opts.color) || "#6df1ff";
  const g = new T.Group();
  const mk = (o) => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = mk(), rimMat = mk(), innerMat = mk(), flashMat = mk(), shardMat = mk(), moteMat = mk();

  // main expanding shockwave ring
  const ring = m(geo("cfxFnRing", () => new T.RingGeometry(0.78, 1.0, 48)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);

  // bright thin leading rim that races ahead of the ring
  const rim = m(geo("cfxFnRim", () => new T.RingGeometry(0.95, 1.02, 48)), rimMat);
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.05; g.add(rim);

  // inner secondary ring
  const inner = m(geo("cfxFnInner", () => new T.RingGeometry(0.45, 0.6, 36)), innerMat);
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.03; g.add(inner);

  // ground impact flash
  const flash = m(geo("cfxFnFlash", () => new T.CircleGeometry(0.62, 28)), flashMat);
  flash.rotation.x = -Math.PI / 2; flash.position.y = 0.02; g.add(flash);

  // jagged ice shards radiating out (tall thin pyramids)
  const shards = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const sh = m(geo("cfxFnShard", () => new T.ConeGeometry(0.13, 0.85, 4)), shardMat);
    const a = (i / N) * Math.PI * 2;
    sh.userData.a = a;
    sh.position.y = 0.06;
    g.add(sh);
    shards.push(sh);
  }

  // sparkling frost motes that burst upward
  const motes = [];
  const M = 10;
  for (let i = 0; i < M; i++) {
    const mo = m(geo("cfxFnMote", () => new T.OctahedronGeometry(0.07)), moteMat);
    const a = (i / M) * Math.PI * 2 + 0.3;
    mo.userData.a = a;
    mo.userData.r = 0.6 + (i % 3) * 0.5;
    mo.userData.h = 0.5 + (i % 4) * 0.25;
    g.add(mo);
    motes.push(mo);
  }

  g.userData.castAnim = (grp, prog) => {
    const snap = prog < 0.4 ? 0 : Math.min(1, (prog - 0.4) / 0.08);
    const wave = prog < 0.4 ? 0 : (prog - 0.4) / 0.6;
    const fade = Math.max(0, 1 - wave);
    const fade2 = fade * fade;

    // shockwave ring
    const r = 0.25 + wave * 4.2;
    ring.scale.set(r, r, r);
    ring.rotation.z = wave * 0.5;
    ringMat.opacity = 0.85 * fade * snap;

    // leading rim races slightly faster, brighter, thinner
    const rr = 0.25 + wave * 4.8;
    rim.scale.set(rr, rr, rr);
    rimMat.opacity = 0.95 * fade2 * snap;

    // inner ring
    const ri = 0.25 + wave * 2.7;
    inner.scale.set(ri, ri, ri);
    inner.rotation.z = -wave * 0.7;
    innerMat.opacity = 0.55 * fade * snap;

    // hot impact flash on the slam, fast falloff
    const fp = Math.sin(snap * Math.PI);
    flashMat.opacity = 1.0 * fp * (1 - wave * 0.5);
    const fs = 0.5 + snap * 1.6;
    flash.scale.set(fs, fs, fs);

    // shards: punch up and outward, leaning out from center
    shardMat.opacity = 0.9 * fade * snap;
    const reach = 0.45 + wave * 3.4;
    const grow = 0.4 + snap * 1.2;
    for (let i = 0; i < shards.length; i++) {
      const sh = shards[i];
      const a = sh.userData.a;
      sh.position.x = Math.cos(a) * reach;
      sh.position.z = Math.sin(a) * reach;
      sh.position.y = 0.06 + 0.18 * (grow - 0.4);
      // lean outward: tilt the upright cone away from center
      sh.rotation.set(0, 0, 0);
      sh.rotation.z = -Math.cos(a) * 0.5;
      sh.rotation.x = Math.sin(a) * 0.5;
      sh.scale.set(grow * (0.7 + wave * 0.6), 0.9 + wave * 1.3, grow * (0.7 + wave * 0.6));
    }

    // frost motes burst up and out, twinkling
    moteMat.opacity = 0.85 * Math.max(0, 1 - wave * 1.2) * snap;
    const mr = 0.4 + wave * 2.8;
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const a = mo.userData.a;
      mo.position.x = Math.cos(a) * mr * (0.6 + mo.userData.r * 0.3);
      mo.position.z = Math.sin(a) * mr * (0.6 + mo.userData.r * 0.3);
      mo.position.y = 0.1 + mo.userData.h * Math.sin(Math.min(wave * 1.6, 1) * Math.PI);
      const tw = 0.5 + 0.5 * Math.sin(prog * 40 + i);
      const ms = (0.6 + wave * 0.8) * tw;
      mo.scale.set(ms, ms, ms);
    }
  };

  return g;
}

// STRENGTHENED: brighter white-hot cores (layered core+halo bolt), more violent multi-fork arcs, a hard flash-reveal + electric flicker, punchier muzzle burst and travelling tip spark.
export function buildCastFx_chainlightning(opts) {
  const c = (opts && opts.color) || "#bff0ff";
  const g = new T.Group();
  const coreMat = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const glowMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false });
  const hx = 0.32, hy = 0.92;
  const pts = [
    [hx, hy, 0.1], [hx+0.22, hy+0.20, 0.6], [hx-0.10, hy-0.08, 1.15],
    [hx+0.16, hy+0.14, 1.75], [hx-0.14, hy-0.16, 2.35], [hx+0.08, hy+0.06, 3.05]
  ];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1];
    const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
    const cx = (a[0]+b[0])/2, cy = (a[1]+b[1])/2, cz = (a[2]+b[2])/2;
    const target = new T.Vector3(b[0], b[1], b[2]);
    // outer colored glow
    const sg = m(box(0.13, 0.13, 1), glowMat);
    sg.scale.z = len; sg.position.set(cx, cy, cz); sg.lookAt(target);
    sg.userData.t0 = i / (pts.length - 1); sg.userData.len = len; sg.userData.bw = 0.13;
    g.add(sg); segs.push(sg);
    // white-hot inner core
    const sc = m(box(0.05, 0.05, 1), coreMat);
    sc.scale.z = len; sc.position.set(cx, cy, cz); sc.lookAt(target);
    sc.userData.t0 = i / (pts.length - 1); sc.userData.len = len; sc.userData.bw = 0.05;
    g.add(sc); segs.push(sc);
  }
  const forks = [];
  const fbase = [[2,0.7,0.5],[3,-0.8,0.35],[4,0.6,-0.5],[2,-0.5,-0.4],[3,0.85,0.2]];
  for (let i = 0; i < fbase.length; i++) {
    const o = pts[fbase[i][0]];
    const f = m(box(0.07, 0.07, 1), glowMat);
    const flen = 0.5 + (i % 3) * 0.22;
    f.scale.z = flen;
    f.position.set(o[0] + fbase[i][1]*0.28, o[1] + fbase[i][2]*0.5, o[2] + (i%2?0.18:-0.18));
    f.rotation.z = fbase[i][1]; f.rotation.y = fbase[i][2] * 1.3;
    f.userData.t0 = 0.35 + i*0.12; f.userData.flen = flen;
    g.add(f); forks.push(f);
    const fc = m(box(0.03, 0.03, 1), coreMat);
    fc.scale.z = flen; fc.position.copy(f.position); fc.rotation.copy(f.rotation);
    fc.userData.t0 = f.userData.t0; fc.userData.flen = flen;
    g.add(fc); forks.push(fc);
  }
  const burstGlow = m(geo("cfxClBurstG", () => new T.SphereGeometry(0.26, 10, 10)), glowMat);
  burstGlow.position.set(hx, hy, 0.1); g.add(burstGlow);
  const burstCore = m(geo("cfxClBurstC", () => new T.SphereGeometry(0.15, 8, 8)), coreMat);
  burstCore.position.set(hx, hy, 0.1); g.add(burstCore);
  const tipGlow = m(geo("cfxClTipG", () => new T.SphereGeometry(0.20, 8, 8)), glowMat);
  tipGlow.position.set(hx+0.08, hy+0.06, 3.05); g.add(tipGlow);
  const tipCore = m(geo("cfxClTipC", () => new T.SphereGeometry(0.11, 6, 6)), coreMat);
  tipCore.position.copy(tipGlow.position); g.add(tipCore);
  g.userData.castAnim = (grp, prog, now) => {
    const fire = prog < 0.40 ? 0 : (prog - 0.40) / 0.60;
    const flick = 0.55 + 0.45 * Math.sin(now * 0.085) + 0.18 * Math.sin(now * 0.21);
    const flash = fire > 0 && fire < 0.16 ? (1 - fire / 0.16) : 0; // hard reveal pop
    const fade = 1 - Math.max(0, (prog - 0.88) / 0.12) * 0.85;
    const gOp = fire > 0 ? (0.95 * flick + flash * 1.2) * fade : 0;
    const cOp = fire > 0 ? (1.0 * (0.7 + 0.3 * flick) + flash * 1.5) * fade : 0;
    glowMat.opacity = Math.max(0, gOp);
    coreMat.opacity = Math.max(0, cOp);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.visible = fire > s.userData.t0;
      const w = s.userData.bw * (0.7 + 0.5 * flick) + flash * 0.05;
      s.scale.x = w; s.scale.y = w; s.scale.z = s.userData.len;
    }
    for (let i = 0; i < forks.length; i++) {
      const f = forks[i];
      f.visible = fire > f.userData.t0;
      f.scale.z = f.userData.flen * (0.8 + 0.5 * Math.sin(now * 0.13 + i));
    }
    const muzzle = fire > 0 && fire < 0.55;
    burstGlow.visible = muzzle; burstCore.visible = muzzle;
    const bs = fire < 0.55 ? (0.6 + fire * 2.4) : 0.001;
    burstGlow.scale.setScalar(bs); burstCore.scale.setScalar(bs * 0.7);
    const arrived = fire > 0.8;
    tipGlow.visible = arrived; tipCore.visible = arrived;
    const ts = 0.9 + Math.sin(now * 0.12) * 0.6;
    tipGlow.scale.setScalar(ts); tipCore.scale.setScalar(ts * 0.8);
  };
  return g;
}

// STRENGTHENED: bolt now streaks from FAR overhead (long bright core + tapered tail) and the impact spawns a hard ground flare RING + shockwave + ejecta spikes — brighter, longer streak, clearer "meteor hits here" beat.
export function buildCastFx_meteor(opts) {
  const c = (opts && opts.color) || "#ff7a3c";
  const g = new T.Group();
  const HI = 3.6, Z = 0.55;            // bolt start height / forward offset
  const newMat = (o) => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:o, blending:T.AdditiveBlending, depthWrite:false });
  const orbMat = newMat(0), coreMat = newMat(0), tailMat = newMat(0), haloMat = newMat(0);
  const ringMat = newMat(0), waveMat = newMat(0), flashMat = newMat(0);

  // gathering orb high overhead
  const orb = m(geo("meteorOrb", () => new T.SphereGeometry(0.26, 16, 12)), orbMat);
  orb.position.set(0, HI, Z); g.add(orb);
  const halo = m(geo("meteorHalo", () => new T.RingGeometry(0.3, 0.6, 28)), haloMat);
  halo.position.set(0, HI, Z); g.add(halo);
  const shards = [];
  for (let i = 0; i < 5; i++) {
    const s = m(geo("meteorShard", () => new T.BoxGeometry(0.05, 0.05, 0.55)), orbMat);
    s.userData.a = (i / 5) * Math.PI * 2; s.userData.r = 0.45;
    g.add(s); shards.push(s);
  }
  // streaking bolt: bright core + long tapered tail
  const core = m(geo("meteorCore", () => new T.CylinderGeometry(0.14, 0.05, 1.0, 10)), coreMat);
  g.add(core);
  const tail = m(geo("meteorTail", () => new T.CylinderGeometry(0.02, 0.30, 1.0, 12)), tailMat);
  g.add(tail);
  // impact on the ground
  const flash = m(geo("meteorFlash", () => new T.SphereGeometry(0.4, 14, 10)), flashMat);
  flash.position.set(0, 0.05, Z); g.add(flash);
  const ring = m(geo("meteorRing", () => new T.RingGeometry(0.55, 0.95, 40)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.04, Z); g.add(ring);
  const wave = m(geo("meteorWave", () => new T.RingGeometry(0.2, 0.35, 40)), waveMat);
  wave.rotation.x = -Math.PI / 2; wave.position.set(0, 0.03, Z); g.add(wave);
  const ejecta = [];
  for (let i = 0; i < 8; i++) {
    const e = m(geo("meteorEjecta", () => new T.ConeGeometry(0.07, 0.5, 6)), ringMat);
    e.userData.a = (i / 8) * Math.PI * 2;
    g.add(e); ejecta.push(e);
  }

  g.userData.castAnim = (grp, prog) => {
    const gather = Math.min(prog / 0.62, 1);
    const gEase = gather * gather * (3 - 2 * gather);
    const drive = prog > 0.62 ? Math.min((prog - 0.62) / 0.20, 1) : 0;
    const dEase = drive * drive;                 // accelerating fall
    const burst = prog > 0.82 ? (prog - 0.82) / 0.18 : 0; // ground impact
    const pulse = 1 + Math.sin(prog * 30) * 0.14 * (1 - drive);

    // --- charge phase: orb + halo + orbiting shards overhead ---
    const charging = 1 - drive;
    const grow = 0.45 + gEase * 0.95;
    orbMat.opacity = (0.5 + 0.5 * gEase) * charging;
    orb.scale.setScalar(grow * pulse);
    orb.position.set(0, HI, Z);
    haloMat.opacity = gEase * 0.6 * charging;
    halo.scale.setScalar(0.7 + gEase * 1.2 + Math.sin(prog * 18) * 0.12);
    halo.rotation.z = prog * 3.2;
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const spin = prog * 6.5 + s.userData.a;
      const r = s.userData.r * grow;
      s.position.set(Math.cos(spin) * r, HI + Math.sin(prog * 12 + i) * 0.06, Z + Math.sin(spin) * r);
      s.lookAt(0, HI, Z);
      s.scale.setScalar((0.5 + gEase * 0.9) * charging);
    }

    // --- streak phase: bright bolt drives down from HI to the ground ---
    if (drive > 0) {
      const y = HI - dEase * (HI - 0.25);
      const len = 1.4 + dEase * 1.6;             // streak lengthens as it falls
      const bright = 1 - burst * 0.5;
      coreMat.opacity = 1.0 * bright;
      core.position.set(0, y, Z);
      core.scale.set(1.0 + Math.sin(prog * 40) * 0.1, len, 1.0 + Math.sin(prog * 40) * 0.1);
      tailMat.opacity = 0.8 * (1 - burst * 0.7);
      tail.position.set(0, y + len * 0.55, Z);   // tail trails above the head
      tail.scale.set(1, len * 1.6, 1);
      orbMat.opacity = 0; haloMat.opacity = 0;
      for (let i = 0; i < shards.length; i++) shards[i].scale.setScalar(0.001);
    } else {
      coreMat.opacity = 0; tailMat.opacity = 0;
    }

    // --- impact: white flash + expanding flare ring + shockwave + ejecta spikes ---
    if (burst > 0) {
      const b = burst;
      const eo = 1 - b;
      flashMat.opacity = (1 - b) * 1.0;
      flash.scale.setScalar(0.6 + b * 2.2);
      ringMat.opacity = (1 - b) * 0.95;
      ring.scale.setScalar(0.4 + b * 3.4);
      waveMat.opacity = (1 - b * 1.1 < 0 ? 0 : 1 - b * 1.1) * 0.8;
      wave.scale.setScalar(0.5 + b * 5.0);
      for (let i = 0; i < ejecta.length; i++) {
        const e = ejecta[i];
        const r = b * 1.7;
        e.position.set(Math.cos(e.userData.a) * r, 0.05 + Math.sin(b * Math.PI) * 0.9, Z + Math.sin(e.userData.a) * r);
        e.rotation.set(Math.PI, e.userData.a, 0);
        e.scale.setScalar(eo * 1.1);
      }
      ringMat.opacity = Math.max(ringMat.opacity, 0);
    } else {
      flashMat.opacity = 0; ringMat.opacity = 0; waveMat.opacity = 0;
      for (let i = 0; i < ejecta.length; i++) ejecta[i].scale.setScalar(0.001);
    }
  };
  return g;
}

// STRENGTHENED: added a bright collapsing implosion ring on blink-out, a brighter arrival shockwave + double ring, more/longer sparks, and a real sweeping slash-arc on arrival.
export function buildCastFx_blinkstrike(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();
  const M = (op) => new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });

  const shellMat = M(0.55);
  const implodeMat = M(0.0);
  const ringMat = M(0.7);
  const ring2Mat = M(0.0);
  const sparkMat = M(0.0);
  const lanceMat = M(0.0);
  const arcMat = M(0.0);

  // vertical light column (blink-out core)
  const shell = m(cyl(0.34, 0.34, 1.6, 12), shellMat);
  shell.position.y = 0.8; g.add(shell);

  // collapsing implosion ring (sucks inward on blink-out)
  const implode = m(geo("blinkstrikeImplode", () => new T.RingGeometry(0.55, 0.9, 28)), implodeMat);
  implode.rotation.x = -Math.PI / 2; implode.position.y = 0.7; g.add(implode);

  // arrival ground shockwaves (two staggered rings)
  const ring = m(geo("blinkstrikeRing", () => new T.RingGeometry(0.5, 0.78, 28)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const ring2 = m(geo("blinkstrikeRing2", () => new T.RingGeometry(0.5, 0.66, 28)), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.06; g.add(ring2);

  // radial arrival sparks
  const sparks = [];
  for (let i = 0; i < 10; i++) {
    const s = m(box(0.07, 0.07, 0.55), sparkMat);
    const a = (i / 10) * Math.PI * 2;
    s.userData.a = a; s.userData.h = 0.45 + (i % 3) * 0.45;
    s.position.y = 0.8; g.add(s); sparks.push(s);
  }

  // forward strike lance
  const lance = m(box(0.11, 0.11, 1.5), lanceMat);
  lance.position.set(0, 0.85, 0.7); g.add(lance);

  // sweeping slash arc on arrival
  const arc = m(geo("blinkstrikeArc", () => new T.RingGeometry(0.7, 1.05, 32, 1, -0.7, 1.7)), arcMat);
  arc.position.set(0, 0.85, 0.55); g.add(arc);

  g.userData.castAnim = (grp, prog) => {
    if (prog < 0.3) {
      // BLINK-OUT
      const t = prog / 0.3;
      shellMat.opacity = 0.6 * (1 - t);
      shell.scale.set(1 - t * 0.5, 1 - t * 0.55, 1 - t * 0.5);
      // implosion ring rushes inward and brightens then snuffs
      implodeMat.opacity = 0.9 * Math.sin(t * Math.PI);
      implode.scale.setScalar(1.6 - t * 1.35);
      ringMat.opacity = 0.6 * (1 - t);
      ring.scale.setScalar(1 - t * 0.7);
      ring2Mat.opacity = 0; sparkMat.opacity = 0; lanceMat.opacity = 0; arcMat.opacity = 0;
      lance.scale.z = 0; lance.scale.x = 0;
    } else {
      // ARRIVAL BURST + SLASH
      const t = (prog - 0.3) / 0.7;
      const burst = 1 - Math.pow(1 - t, 4);
      const fade = Math.sin(t * Math.PI);
      implodeMat.opacity = 0;
      shellMat.opacity = 0.7 * Math.max(0, 1 - t * 1.6);
      shell.scale.set(1 + burst * 3.0, 1 + burst * 0.7, 1 + burst * 3.0);
      // double expanding shockwave
      ringMat.opacity = 0.85 * (1 - t);
      ring.scale.setScalar(0.4 + burst * 2.8);
      ring2Mat.opacity = 0.7 * Math.max(0, 1 - t * 1.4);
      ring2.scale.setScalar(0.4 + burst * 1.9);
      // sparks fly out
      sparkMat.opacity = 1.0 * fade;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const r = burst * 1.35;
        s.position.x = Math.cos(s.userData.a) * r;
        s.position.z = Math.sin(s.userData.a) * r;
        s.position.y = s.userData.h + burst * 0.35;
        s.rotation.y = s.userData.a;
        s.scale.z = 0.5 + burst * 1.5;
      }
      // forward lance thrust
      const lp = Math.sin(Math.min(t * 1.5, 1) * Math.PI);
      lanceMat.opacity = 0.95 * lp;
      lance.scale.z = 0.4 + lp * 1.5;
      lance.scale.x = 0.6 + lp;
      lance.position.z = 0.45 + lp * 0.85;
      // quick slash arc sweeps and fades
      const sp = Math.min(t * 1.7, 1);
      arcMat.opacity = 0.9 * Math.max(0, 1 - sp) * (t < 0.6 ? 1 : 0) + 0.9 * Math.sin(Math.min(t, 0.55) / 0.55 * Math.PI);
      arc.rotation.z = -1.3 + sp * 2.6;
      arc.scale.setScalar(0.7 + sp * 0.7);
    }
  };
  return g;
}

// STRENGTHENED: 7 arrows (was 5) with bright glowing trail tails, a charging nock-glow during the draw, a wider/faster forward fan, a bigger release flash + radiating spark motes.
export function buildCastFx_multishot(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();
  const fan = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const ang = (i - (N - 1) / 2) * 0.3;
    const arrow = new T.Group();
    // bright core shaft
    const coreMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const shaft = m(box(0.05, 0.05, 1.6), coreMat);
    shaft.position.z = 0.8;
    // glowing trailing streak behind the head
    const tailMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const tail = m(box(0.14, 0.14, 2.0), tailMat);
    tail.position.z = -0.1;
    const headMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const head = m(cone(0.13, 0.32, 6), headMat);
    head.rotation.x = Math.PI / 2;
    head.position.z = 1.6;
    arrow.add(tail); arrow.add(shaft); arrow.add(head);
    arrow.position.y = 0.85;
    arrow.rotation.y = ang;
    arrow.userData.ang = ang;
    arrow.userData.core = coreMat;
    arrow.userData.tail = tailMat;
    arrow.userData.head = headMat;
    g.add(arrow);
    fan.push(arrow);
  }
  // charging nock glow at the draw point
  const nockMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const nock = m(geo("cfxMsNock", () => new T.SphereGeometry(0.16, 10, 10)), nockMat);
  nock.position.set(0, 0.85, 0.15);
  g.add(nock);
  // release flash ring
  const flashMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
  const flash = m(geo("cfxMsFlash", () => new T.RingGeometry(0.1, 0.55, 18)), flashMat);
  flash.position.set(0, 0.85, 0.2);
  g.add(flash);
  // radiating spark motes on loose
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sMat = new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    const s = m(geo("cfxMsSpark", () => new T.SphereGeometry(0.07, 6, 6)), sMat);
    s.position.set(0, 0.85, 0.2);
    const a = (i / 6) * Math.PI * 2;
    s.userData.dx = Math.cos(a);
    s.userData.dy = Math.sin(a);
    s.userData.mat = sMat;
    g.add(s);
    sparks.push(s);
  }
  g.userData.castAnim = (grp, prog) => {
    const released = prog > 0.6;
    const draw = Math.min(1, prog / 0.6);
    const rel = released ? (prog - 0.6) / 0.4 : 0;
    // nock charges up bright during the draw, pops out on release
    const ch = released ? Math.max(0, 1 - rel * 3) : draw;
    nockMat.opacity = 0.9 * ch;
    nock.scale.setScalar(0.5 + draw * 0.7 + (released ? rel * 0.6 : 0));
    for (let i = 0; i < fan.length; i++) {
      const a = fan[i];
      const reach = released ? rel : 0;
      const spread = 1 + Math.abs(a.userData.ang) * 1.6;
      a.position.z = reach * (3.0 * spread);
      const fade = released ? Math.max(0, 1 - rel) : 0;
      a.userData.core.opacity = 0.95 * fade;
      a.userData.head.opacity = 1.0 * fade;
      a.userData.tail.opacity = 0.5 * fade;
      const sc = 0.6 + reach * 0.7;
      a.scale.set(1, 1, sc);
    }
    const fl = released ? Math.sin(Math.min(1, rel * 3) * Math.PI) : 0;
    flashMat.opacity = 0.85 * fl;
    flash.scale.setScalar(0.6 + fl * 1.8);
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const d = released ? rel : 0;
      s.position.x = s.userData.dx * d * 1.1;
      s.position.y = 0.85 + s.userData.dy * d * 1.1;
      s.position.z = 0.2 + d * 0.6;
      s.userData.mat.opacity = 0.8 * fl;
    }
  };
  return g;
}

// Strengthened: brighter, punchier bloom — added an arcing thrown-flask bolt that lobs in and SHATTERS into a flash, a fast expanding spore shockring, a billowing dome of spore puffs that swell+rise, plus drifting up-motes. Bigger scales, hotter peak opacities, clearer arc->impact->bloom beat.
export function buildCastFx_poisontrap(opts) {
  const c = (opts && opts.color) || "#9be57c";
  const g = new T.Group();

  // --- Thrown flask: a bright bolt that arcs in underhand and lands at the feet ---
  const flaskMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flask = m(geo("cfxPtFlask", () => new T.SphereGeometry(0.16, 10, 8)), flaskMat);
  g.add(flask);
  // little trailing glow behind the flask
  const trailMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const trail = m(geo("cfxPtTrail", () => new T.SphereGeometry(0.11, 8, 6)), trailMat);
  g.add(trail);

  // --- Impact flash on shatter ---
  const flashMat = new T.MeshBasicMaterial({ color: "#eaffd6", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flash = m(geo("cfxPtFlash", () => new T.CircleGeometry(0.7, 24)), flashMat);
  flash.rotation.x = -Math.PI/2; flash.position.y = 0.05; g.add(flash);

  // --- Fast expanding spore shock-ring on the ground ---
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxPtRing", () => new T.RingGeometry(0.45, 0.9, 32)), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.035; g.add(ring);

  // --- Bubbling pod core that swells at the feet ---
  const podMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const pod = m(geo("cfxPtPod", () => new T.SphereGeometry(0.5, 16, 12)), podMat);
  pod.position.y = 0.2; pod.scale.set(0.2, 0.12, 0.2); g.add(pod);

  // --- Billowing dome of spore puffs (the bloom) -- each own fresh material ---
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const pMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const p = m(geo("cfxPtPuff", () => new T.SphereGeometry(0.22, 8, 6)), pMat);
    const a = (i / 10) * Math.PI * 2 + (i % 2) * 0.3;
    p.userData.a = a;
    p.userData.r = 0.3 + (i % 3) * 0.22;
    p.userData.ph = (i * 0.37) % 1;
    p.userData.hi = 0.25 + (i % 4) * 0.16;   // how high this puff billows
    p.userData.mat = pMat;
    g.add(p); puffs.push(p);
  }

  // --- Drifting up-motes (spores rising) -- own fresh material ---
  const motes = [];
  for (let i = 0; i < 6; i++) {
    const mMat = new T.MeshBasicMaterial({ color: "#d4ffb0", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const mo = m(geo("cfxPtMote", () => new T.SphereGeometry(0.06, 6, 5)), mMat);
    mo.userData.a = (i / 6) * Math.PI * 2;
    mo.userData.r = 0.25 + (i % 2) * 0.2;
    mo.userData.ph = i * 0.5;
    mo.userData.mat = mMat;
    g.add(mo); motes.push(mo);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const t = (now || 0) * 0.004;
    const land = 0.45;                       // flask lands here

    if (prog < land) {
      // ---- arc the flask in (underhand lob): starts up-and-behind, lands at feet ----
      const u = prog / land;                 // 0..1 along the arc
      flaskMat.opacity = 0.95;
      const ax = 0.5 * (1 - u);               // come from forward-right of body
      const az = 0.5 * (1 - u);
      const ay = 0.3 + 1.4 * Math.sin(u * Math.PI) * (1 - u * 0.3); // lob hump
      flask.position.set(ax, Math.max(0.1, ay), az);
      flask.scale.setScalar(1 + 0.3 * Math.sin(t * 6));
      trailMat.opacity = 0.55;
      trail.position.set(ax + 0.08 * (1 - u), Math.max(0.1, ay) + 0.12, az + 0.08 * (1 - u));
      trail.scale.setScalar(0.9);
      // everything else dormant
      flashMat.opacity = 0; ringMat.opacity = 0; podMat.opacity = 0;
      for (let i = 0; i < puffs.length; i++) puffs[i].userData.mat.opacity = 0;
      for (let i = 0; i < motes.length; i++) motes[i].userData.mat.opacity = 0;
    } else {
      // ---- shatter + bloom ----
      const b = (prog - land) / (1 - land);  // 0..1 after impact
      const fade = 1 - b;
      const grow = Math.min(b / 0.5, 1);

      flaskMat.opacity = 0; trailMat.opacity = 0;

      // impact flash: hot, instant, gone fast
      flashMat.opacity = 1.0 * Math.max(0, 1 - b * 3.2);
      flash.scale.setScalar(0.5 + 2.0 * Math.min(b * 3, 1));

      // shock-ring rips outward
      ringMat.opacity = 0.85 * fade;
      ring.scale.setScalar(0.5 + 2.4 * grow + 0.05 * Math.sin(t * 4));

      // pod core swells and roils
      podMat.opacity = 0.8 * (fade * 0.6 + 0.4 * Math.sin(b * Math.PI));
      const sw = 0.3 + grow * 1.0;
      pod.scale.set(sw * (1 + 0.14 * Math.sin(t * 3)), sw * 0.75 * (1 + 0.16 * Math.sin(t * 4 + 1)), sw * (1 + 0.14 * Math.sin(t * 3 + 2)));
      pod.position.y = 0.2 + 0.05 * Math.sin(t * 2);

      // billowing dome of puffs: swell up-and-out, then thin
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        const rr = p.userData.r + grow * 0.55;
        const lift = p.userData.hi + grow * 0.6 + 0.06 * Math.sin(t * 3 + i);
        p.position.set(Math.cos(p.userData.a) * rr, 0.15 + lift, Math.sin(p.userData.a) * rr);
        p.scale.setScalar((0.5 + 1.1 * grow) * (1 + 0.18 * Math.sin(t * 5 + p.userData.ph * 6)));
        p.userData.mat.opacity = 0.7 * (0.4 + 0.6 * grow) * fade;
      }

      // up-motes spiral up out of the cloud, popping back
      for (let i = 0; i < motes.length; i++) {
        const mo = motes[i];
        const up = ((t * 0.7 + mo.userData.ph) % 1.0);
        const rr = mo.userData.r + up * 0.35;
        mo.position.set(Math.cos(mo.userData.a + up * 1.5) * rr, 0.15 + up * 1.3, Math.sin(mo.userData.a + up * 1.5) * rr);
        mo.scale.setScalar(0.7 + 0.5 * Math.sin(up * Math.PI));
        mo.userData.mat.opacity = 0.7 * (1 - up) * fade;
      }
    }
  };

  return g;
}

// Strengthened: brighter/longer lance with a hot white-cored shaft + leading spear-tip flare, a sharp loose-flash muzzle burst, and trailing speed rings that rip forward with the bolt.
export function buildCastFx_piercingshot(opts) {
  const c = (opts && opts.color) || "#caa15a";
  const g = new T.Group();
  const mk = () => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const mkW = () => new T.MeshBasicMaterial({ color:"#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const boltMat = mk();
  const glowMat = mk();
  const coreMat = mkW();
  const tipMat = mk();
  const tipHotMat = mkW();
  const ringMat = mk();
  const muzMat = mk();
  const muzHotMat = mkW();

  const Y = 0.9;

  // bright outer shaft
  const bolt = m(cyl(0.05, 0.05, 1, 8), boltMat);
  bolt.rotation.x = Math.PI/2;
  bolt.position.set(0, Y, 0.5);
  g.add(bolt);

  // soft box glow halo around the shaft
  const glow = m(box(0.22, 0.22, 1.0), glowMat);
  glow.position.set(0, Y, 0.5);
  g.add(glow);

  // hot white inner core for brightness
  const core = m(cyl(0.02, 0.02, 1, 6), coreMat);
  core.rotation.x = Math.PI/2;
  core.position.set(0, Y, 0.5);
  g.add(core);

  // leading spear tip (themed) + hot white tip
  const tip = m(cone(0.15, 0.6, 10), tipMat);
  tip.rotation.x = Math.PI/2;
  tip.position.set(0, Y, 1.0);
  g.add(tip);
  const tipHot = m(cone(0.07, 0.34, 8), tipHotMat);
  tipHot.rotation.x = Math.PI/2;
  tipHot.position.set(0, Y, 1.05);
  g.add(tipHot);

  // speed rings ripping forward along the bolt
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const r = m(geo("cfxPsRing" + i, () => new T.RingGeometry(0.16, 0.30, 20)), ringMat);
    r.position.set(0, Y, 0.2);
    r.userData.off = i / 4;
    g.add(r);
    rings.push(r);
  }

  // muzzle loose-flash burst
  const muzzle = m(geo("cfxPsMuzzle", () => new T.RingGeometry(0.05, 0.42, 18)), muzMat);
  muzzle.position.set(0, Y, 0.05);
  g.add(muzzle);
  const muzHot = m(geo("cfxPsMuzHot", () => new T.RingGeometry(0.02, 0.22, 16)), muzHotMat);
  muzHot.position.set(0, Y, 0.06);
  g.add(muzHot);

  // charge sparkle before loose
  const charge = m(geo("cfxPsCharge", () => new T.SphereGeometry(0.13, 10, 10)), mkW());
  charge.position.set(0, Y, 0.1);
  g.add(charge);
  const chargeMat = charge.material;

  g.userData.castAnim = (grp, prog) => {
    // pre-loose charge build
    const ch = prog < 0.6 ? Math.min(1, prog / 0.6) : 0;
    chargeMat.opacity = 0.85 * ch * ch;
    charge.scale.setScalar(0.4 + 0.7 * ch + 0.25 * Math.sin(prog * 90));

    const fire = prog > 0.6 ? (prog - 0.6) / 0.4 : 0;
    const env = Math.sin(Math.min(1, fire) * Math.PI);
    // ease-out so the bolt LEAPS forward fast then settles
    const fe = fire * (2 - fire);
    const reach = 0.1 + fe * 7.0;

    boltMat.opacity = 0.85 * env;
    glowMat.opacity = 0.5 * env;
    coreMat.opacity = 0.95 * env;
    tipMat.opacity = 0.9 * env;
    tipHotMat.opacity = 1.0 * env;
    ringMat.opacity = 0.65 * env;

    const len = reach;
    const midZ = 0.1 + len * 0.5;
    bolt.scale.y = len; bolt.position.z = midZ;
    glow.scale.z = len; glow.position.z = midZ;
    core.scale.y = len; core.position.z = midZ;
    tip.position.z = 0.1 + len + 0.25;
    tip.scale.setScalar(1 + 0.5 * env);
    tipHot.position.z = 0.1 + len + 0.28;
    tipHot.scale.setScalar(1 + 0.6 * env);

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const t = (fire * 1.4 + r.userData.off) % 1;
      r.position.z = 0.1 + t * reach;
      r.scale.setScalar(0.9 + t * 0.8);
    }

    // sharp loose flash
    const flash = prog < 0.6 ? 0 : Math.max(0, 1 - (prog - 0.6) / 0.16);
    muzMat.opacity = 0.95 * flash;
    muzHotMat.opacity = 1.0 * flash;
    muzzle.scale.setScalar(0.6 + flash * 2.8);
    muzHot.scale.setScalar(0.5 + flash * 2.0);
  };
  return g;
}

// Strengthened: brighter ringed volley that launches up THEN rains arrow-streaks down over a wide area, with a target-zone flare + ground impact ring.
export function buildCastFx_volley(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();

  // ---- rising volley arrows (launch up off the bow) ----
  const N = 9;
  const arrows = [];
  for (let i = 0; i < N; i++) {
    const aMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const a = m(geo("cfxVolleyShaft", () => box(0.05, 0.05, 0.85)), aMat);
    const head = m(geo("cfxVolleyHead", () => cone(0.13, 0.32, 4)), aMat);
    head.position.z = 0.6; head.rotation.x = Math.PI / 2; a.add(head);
    a.userData.mat = aMat;
    a.userData.ang = (i / N) * Math.PI * 2;
    a.userData.spread = 1.4 + (i % 3) * 0.6;
    g.add(a); arrows.push(a);
  }

  // ---- raining streaks falling onto the target area ----
  const M = 12;
  const rain = [];
  const RZ = 3.4; // forward reach of the rain zone
  for (let i = 0; i < M; i++) {
    const rMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const s = m(geo("cfxVolleyStreak", () => box(0.04, 0.04, 1.1)), rMat);
    s.rotation.x = -Math.PI / 2; // point downward
    // scatter across a circular target zone in front of the player
    const rr = 0.5 + Math.sqrt((i + 0.5) / M) * 2.0;
    const ph = (i * 2.39996); // golden-angle scatter
    s.userData.mat = rMat;
    s.userData.tx = Math.cos(ph) * rr;
    s.userData.tz = RZ + Math.sin(ph) * rr;
    s.userData.delay = (i / M) * 0.45;
    s.userData.len = 0.8 + (i % 4) * 0.25;
    g.add(s); rain.push(s);
  }

  // ---- launch ring at the bow ----
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxVolleyRing", () => new T.RingGeometry(0.45, 0.9, 36)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);

  // ---- target-zone impact ring on the ground ----
  const zoneMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const zone = m(geo("cfxVolleyZone", () => new T.RingGeometry(0.6, 2.4, 40)), zoneMat);
  zone.rotation.x = -Math.PI / 2; zone.position.set(0, 0.04, RZ); g.add(zone);

  // ---- sky flare: bright glow at apex where arrows crest ----
  const flareMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flare = m(geo("cfxVolleyFlare", () => new T.SphereGeometry(0.5, 10, 8)), flareMat);
  flare.position.set(0, 3.6, RZ * 0.5); g.add(flare);

  g.userData.castAnim = (grp, prog) => {
    const draw = Math.min(prog / 0.55, 1);
    const launch = prog > 0.55 ? (prog - 0.55) / 0.45 : 0;
    const drawEnv = Math.sin(draw * Math.PI * 0.5);

    // rising arrows: explode up off the bow on loose
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      const ang = a.userData.ang;
      const sp = a.userData.spread;
      const t = Math.min(launch * 1.3, 1);
      const arc = Math.sin(Math.min(t, 1) * Math.PI * 0.5);
      const radius = t * sp;
      a.position.x = Math.cos(ang) * radius;
      a.position.z = Math.sin(ang) * radius;
      a.position.y = 0.9 + arc * 3.4 + draw * 0.3;
      const pitch = (0.6 - t) * 2.0;
      a.rotation.set(pitch, -ang + Math.PI / 2, 0);
      const s = 0.7 + draw * 0.4 + launch * 0.4;
      a.scale.setScalar(s);
      a.userData.mat.opacity = launch > 0 ? 0.95 * (1 - t) : 0.2 + 0.7 * draw;
    }

    // falling rain: streaks plunge into the target zone, staggered
    for (let i = 0; i < rain.length; i++) {
      const s = rain[i];
      const lt = (launch - s.userData.delay) / (1 - s.userData.delay);
      if (lt <= 0) { s.userData.mat.opacity = 0; continue; }
      const f = Math.min(lt, 1);
      s.position.x = s.userData.tx;
      s.position.z = s.userData.tz;
      // fall from high sky down to ground
      s.position.y = 4.4 * (1 - f) + 0.05;
      s.scale.set(1, 1, s.userData.len * (0.6 + 0.7 * f));
      // bright while falling, snuff on impact
      s.userData.mat.opacity = f < 0.9 ? 0.95 : 0.95 * (1 - (f - 0.9) / 0.1);
    }

    // launch ring pulses out on draw, fades on loose
    ringMat.opacity = (0.7 * drawEnv) * (1 - launch * 0.8);
    ring.scale.setScalar(0.5 + draw * 1.4 + launch * 0.6);

    // target zone blooms as the rain lands
    zoneMat.opacity = 0.75 * Math.sin(Math.min(launch * 1.2, 1) * Math.PI);
    zone.scale.setScalar(0.5 + launch * 1.3);

    // apex flare flashes at the crest of the launch
    const fl = Math.sin(Math.min(launch * 1.5, 1) * Math.PI);
    flareMat.opacity = 0.85 * fl;
    flare.scale.setScalar(0.5 + fl * 1.2);
  };
  return g;
}

// STRENGTHENED: jagged ground-tear cracks + double grave-glow ring + clawing bony hands AND rising skeletal forms, brighter staged reveal
export function buildCastFx_raisedead(opts) {
  const c = (opts && opts.color) || "#a0ffc0";
  const g = new T.Group();
  const mkMat = () => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = mkMat();
  const crackMat = mkMat();
  const handMat = mkMat();
  const boneMat = mkMat();
  const moteMat = mkMat();

  // ---- grave-glow rings on the ground ----
  const ring = m(geo("cfxRdRing", () => new T.RingGeometry(0.50, 0.92, 36)), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.03; g.add(ring);
  const ring2 = m(geo("cfxRdRing2", () => new T.RingGeometry(0.95, 1.08, 36)), ringMat);
  ring2.rotation.x = -Math.PI/2; ring2.position.y = 0.03; g.add(ring2);
  const core = m(geo("cfxRdCore", () => new T.CircleGeometry(0.55, 24)), ringMat);
  core.rotation.x = -Math.PI/2; core.position.y = 0.025; g.add(core);

  // ---- jagged ground-tear cracks radiating out ----
  const cracks = [];
  const NC = 6;
  for (let i = 0; i < NC; i++) {
    const a = (i / NC) * Math.PI * 2 + 0.3;
    const cr = m(geo("cfxRdCrack", () => new T.PlaneGeometry(0.10, 1.0)), crackMat);
    cr.rotation.x = -Math.PI/2;
    cr.rotation.z = a;
    cr.position.set(Math.cos(a) * 0.55, 0.028, Math.sin(a) * 0.55);
    cr.scale.set(0.0, 0.0, 0.0);
    cr.userData.ph = i / NC;
    g.add(cr); cracks.push(cr);
  }

  // ---- clawing bony hands (fingers = thin cones) ----
  const hands = [];
  const NH = 4;
  for (let i = 0; i < NH; i++) {
    const a = (i / NH) * Math.PI * 2 + 0.6;
    const r = 0.62;
    const hand = new T.Group();
    hand.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    for (let f = 0; f < 4; f++) {
      const fin = m(geo("cfxRdFinger", () => new T.ConeGeometry(0.035, 0.34, 5)), handMat);
      const fa = (f - 1.5) * 0.28;
      fin.position.set(Math.sin(fa) * 0.10, 0.16, 0);
      fin.rotation.z = -fa;
      fin.rotation.x = -0.25; // curl like clutching claws
      hand.add(fin);
    }
    hand.userData.ph = i / NH;
    hand.userData.ang = a;
    hand.scale.setScalar(0.0);
    g.add(hand); hands.push(hand);
  }

  // ---- rising skeletal forms (tall ribbed wisps) ----
  const bones = [];
  const NB = 6;
  for (let i = 0; i < NB; i++) {
    const a = (i / NB) * Math.PI * 2;
    const r = 0.82;
    const bn = m(geo("cfxRdBone", () => new T.ConeGeometry(0.085, 0.9, 6)), boneMat);
    bn.userData.bx = Math.cos(a) * r;
    bn.userData.bz = Math.sin(a) * r;
    bn.userData.ph = i / NB;
    bn.position.set(bn.userData.bx, 0.05, bn.userData.bz);
    g.add(bn); bones.push(bn);
  }

  // ---- soul motes flickering upward ----
  const motes = [];
  const NM = 10;
  for (let i = 0; i < NM; i++) {
    const mo = m(geo("cfxRdMote", () => new T.SphereGeometry(0.05, 6, 6)), moteMat);
    mo.userData.ph = i / NM;
    mo.userData.ang = (i * 2.39) % (Math.PI * 2);
    mo.userData.rad = 0.3 + (i % 4) * 0.18;
    g.add(mo); motes.push(mo);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const env = Math.sin(prog * Math.PI);
    const t = (now || 0) * 0.004;
    const open = Math.min(prog / 0.40, 1);          // ground tears open
    const oe = Math.sin(open * Math.PI / 2);
    const summon = prog > 0.35 ? Math.min((prog - 0.35) / 0.5, 1) : 0;
    const fade = prog > 0.82 ? (1 - (prog - 0.82) / 0.18) : 1;

    // rings: bloom + spin
    ringMat.opacity = (0.45 + 0.45 * env) * fade;
    ring.rotation.z = prog * Math.PI * 1.8;
    ring2.rotation.z = -prog * Math.PI * 1.4;
    ring2.scale.setScalar(0.8 + env * 0.4);
    core.scale.setScalar(0.5 + oe * 0.7 + Math.sin(prog * Math.PI * 8) * 0.04);

    // cracks: snap open then hold bright
    crackMat.opacity = 0.9 * oe * fade;
    for (let i = 0; i < cracks.length; i++) {
      const cr = cracks[i];
      const lo = Math.max(0, Math.min(1, (open - cr.userData.ph * 0.25) / 0.6));
      cr.scale.set(1, lo, 1);
    }

    // clawing hands: burst up first, clutch the air
    handMat.opacity = 0.95 * Math.min(1, summon * 1.6) * fade;
    for (let i = 0; i < hands.length; i++) {
      const hd = hands[i];
      const local = Math.max(0, Math.min(1, (summon - hd.userData.ph * 0.18) / 0.5));
      const h = Math.sin(local * Math.PI * 0.5);
      hd.scale.setScalar(h * 1.0);
      hd.position.y = 0.05 + h * 0.5;
      // clutch: rock the hand as it grasps
      hd.rotation.y = hd.userData.ang + Math.sin(t * 2 + i) * 0.2;
      hd.rotation.x = -0.2 + Math.sin(local * Math.PI + i) * 0.15;
    }

    // skeletal forms: stream upward, curling inward
    boneMat.opacity = 0.85 * Math.min(1, summon * 1.4) * fade;
    for (let i = 0; i < bones.length; i++) {
      const bn = bones[i];
      const local = ((summon * 1.3) + bn.userData.ph) % 1;
      bn.position.y = 0.05 + local * 1.9;
      const f2 = Math.sin(local * Math.PI);
      bn.scale.set(0.5 + f2 * 0.7, 0.6 + f2 * 1.3, 0.5 + f2 * 0.7);
      const swirl = bn.userData.ph * Math.PI * 2 + t;
      const rr = 0.82 * (1 - local * 0.5);
      bn.position.x = Math.cos(swirl) * rr;
      bn.position.z = Math.sin(swirl) * rr;
      bn.rotation.y = swirl;
    }

    // soul motes: flicker and drift up
    moteMat.opacity = 0.8 * env * fade;
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const local = ((prog * 1.5) + mo.userData.ph) % 1;
      const sw = mo.userData.ang + t * 1.5;
      const rr = mo.userData.rad * (1 - local * 0.3);
      mo.position.set(Math.cos(sw) * rr, 0.1 + local * 1.6, Math.sin(sw) * rr);
      const fl = Math.sin(local * Math.PI) * (0.6 + 0.4 * Math.sin(t * 6 + i));
      mo.scale.setScalar(Math.max(0, fl));
    }
  };
  return g;
}

// STRENGTHENED: brighter twin-strand spiral tether, more motes streaming inward, a hungry pulsing chest-core that flares on each drink + inward shockwave rings
export function buildCastFx_souldrain(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();
  const handY = 1.05, handZ = 0.35;
  const tipZ = 2.2;
  const NA = (hex, o) => new T.MeshBasicMaterial({ color: hex, opacity: o, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false });

  // chest core — where soul is drained INTO
  const coreMat = NA(c, 0.9);
  const core = m(geo("cfxSdCore2", () => new T.SphereGeometry(0.18, 12, 12)), coreMat);
  core.position.set(0, handY, handZ); g.add(core);
  const haloMat = NA("#ffffff", 0.85);
  const halo = m(geo("cfxSdHalo", () => new T.SphereGeometry(0.1, 10, 10)), haloMat);
  halo.position.set(0, handY, handZ); g.add(halo);

  // two spiraling tether strands hand -> foe
  const strands = [];
  for (let s = 0; s < 2; s++) {
    const sm = NA(c, 0.7);
    const st = m(cyl(0.03, 0.012, 1, 6), sm);
    st.rotation.x = Math.PI / 2;
    st.userData.mat = sm; st.userData.sign = s === 0 ? 1 : -1;
    g.add(st); strands.push(st);
  }

  // soul motes streaming inward along the tether
  const motes = [], N = 11;
  for (let i = 0; i < N; i++) {
    const mm = NA(i % 3 === 0 ? "#ffffff" : c, 0.85);
    const mt = m(geo("cfxSdMote2", () => new T.OctahedronGeometry(0.1, 0)), mm);
    mt.userData.ph = i / N; mt.userData.mat = mm; mt.userData.sw = (i % 2) ? 1 : -1;
    g.add(mt); motes.push(mt);
  }

  // far wisp ring at the foe
  const wispMat = NA(c, 0.8);
  const wisp = m(geo("cfxSdWisp2", () => new T.RingGeometry(0.16, 0.34, 18)), wispMat);
  wisp.position.set(0, handY, tipZ); g.add(wisp);

  // inward-collapsing pulse rings at the chest (each "drink")
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const rm = NA("#ffffff", 0);
    const r = m(geo("cfxSdRing2", () => new T.RingGeometry(0.3, 0.42, 24)), rm);
    r.position.set(0, handY, handZ);
    r.userData.mat = rm; r.userData.off = i * 0.5;
    g.add(r); rings.push(r);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const t = now * 0.004;
    const env = Math.sin(Math.min(1, prog) * Math.PI);
    const reach = tipZ - prog * 0.7;
    const drink = Math.max(0, (prog - 0.4) / 0.6);
    const beat = 0.5 + 0.5 * Math.sin(prog * Math.PI * 9);

    coreMat.opacity = (0.55 + 0.45 * beat) * (0.4 + 0.6 * env);
    core.scale.setScalar(0.7 + drink * 1.1 + beat * 0.4 * env);
    haloMat.opacity = (0.5 + 0.5 * beat) * env;
    halo.scale.setScalar(0.5 + drink * 0.7 + beat * 0.3);

    // strands spiral between hand-core and reach
    for (let s = 0; s < strands.length; s++) {
      const st = strands[s];
      st.position.z = (handZ + reach) / 2;
      st.position.y = handY;
      st.scale.y = (reach - handZ);
      const w = 1 + Math.sin(t * 5 + s * Math.PI) * 0.5;
      st.scale.x = st.scale.z = w;
      st.rotation.z = t * 3 * st.userData.sign;
      st.position.x = Math.sin(t * 4 + s * Math.PI) * 0.06 * st.userData.sign;
      st.userData.mat.opacity = (0.5 + 0.4 * beat) * env;
    }

    // wisp ring at foe shrinks as soul is sapped
    wisp.position.z = reach;
    wisp.position.y = handY + Math.sin(t * 2) * 0.07;
    wisp.scale.setScalar((1.1 - prog * 0.5) + Math.sin(t * 3) * 0.1);
    wisp.rotation.z = t * 1.5;
    wispMat.opacity = 0.85 * env;

    // motes race inward toward the chest, brightening as they arrive
    for (let i = 0; i < motes.length; i++) {
      const mt = motes[i];
      let f = (mt.userData.ph + prog * 1.9) % 1;
      const z = handZ + f * (reach - handZ);
      const spin = z * 5 + t * 5;
      mt.position.set(Math.cos(spin) * 0.16 * mt.userData.sw, handY + Math.sin(spin) * 0.14, z);
      const near = 1 - f;
      mt.scale.setScalar((0.4 + near * 1.1) * env);
      mt.userData.mat.opacity = (0.5 + near * 0.5) * env;
      mt.rotation.x = t * 3 + i; mt.rotation.y = t * 4;
    }

    // collapsing pulse rings on each drink
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const p = ((prog * 2.2 + r.userData.off) % 1);
      r.scale.setScalar(0.2 + (1 - p) * 1.3);
      r.rotation.z = t * 2;
      r.userData.mat.opacity = p * (1 - p) * 3.2 * drink * env;
    }
  };
  return g;
}

// Stronger: replaced single centered shard-ring with SEVERAL distinct sickly-green bursts popping at offset spots AROUND the player (staggered pop timing), each a bright flare + spike-shards + shock-ring, plus a charging core and ground scorch.
export function buildCastFx_corpseexplosion(opts) {
  const c = (opts && opts.color) || "#9bff4a";
  const g = new T.Group();
  const CHEST = 0.85;

  const mkMat = (op) => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity: op||0, blending:T.AdditiveBlending, depthWrite:false });

  // --- charging core at the chest (clench glow) that flashes white-bright on detonate ---
  const coreMat = mkMat(0);
  const core = m(geo("cfxCeCore", () => new T.SphereGeometry(0.30, 16, 12)), coreMat);
  core.position.y = CHEST;
  g.add(core);

  // central shock ring on the ground from the throw-down
  const shockMat = mkMat(0);
  const shock = m(geo("cfxCeShock", () => new T.RingGeometry(0.45, 0.78, 40)), shockMat);
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = 0.05;
  g.add(shock);

  // ground scorch flare
  const scorchMat = mkMat(0);
  const scorch = m(geo("cfxCeScorch", () => new T.CircleGeometry(1.0, 36)), scorchMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.03;
  g.add(scorch);

  // --- SEVERAL corpse-bursts popping around the player ---
  const BURSTS = 5;
  const SPIKES = 5;
  const bursts = [];
  for (let b = 0; b < BURSTS; b++) {
    const ang = (b / BURSTS) * Math.PI * 2 + 0.4;
    const rad = 1.5 + (b % 2) * 0.55;
    const bx = Math.sin(ang) * rad;
    const bz = Math.cos(ang) * rad;
    const by = CHEST * (0.35 + (b % 3) * 0.22);
    const node = new T.Group();
    node.position.set(bx, by, bz);
    g.add(node);

    // bright flare ball
    const flareMat = mkMat(0);
    const flare = m(geo("cfxCeFlare", () => new T.SphereGeometry(0.30, 12, 10)), flareMat);
    node.add(flare);

    // expanding shock ringlet, faces the player roughly
    const ringMat = mkMat(0);
    const ring = m(geo("cfxCeBRing", () => new T.RingGeometry(0.30, 0.50, 28)), ringMat);
    ring.lookAt(new T.Vector3(0, by, 0));
    node.add(ring);

    // jagged spike-shards bursting outward
    const spikes = [];
    for (let s = 0; s < SPIKES; s++) {
      const sMat = mkMat(0);
      const sp = m(geo("cfxCeSpike", () => new T.ConeGeometry(0.07, 0.55, 6)), sMat);
      const sa = (s / SPIKES) * Math.PI * 2;
      sp.userData.sa = sa;
      sp.userData.mat = sMat;
      node.add(sp);
      spikes.push(sp);
    }

    bursts.push({
      node, flare, flareMat, ring, ringMat, spikes,
      // staggered detonation peak so they pop in a ripple
      peak: 0.5 + (b - (BURSTS - 1) / 2) * 0.055,
      seed: b
    });
  }

  g.userData.castAnim = (grp, prog) => {
    const charge = Math.min(prog / 0.45, 1);
    // central detonation envelope
    const dC = Math.max(0, 1 - Math.abs(prog - 0.5) / 0.12);
    const blastC = dC * dC;
    const after = prog > 0.46 ? 1 : 0;
    const t = (prog - 0.46) / 0.54;
    const grow = t < 0 ? 0 : (t > 1 ? 1 : t);

    // core charges during clench, flares hard, then snuffs
    core.scale.setScalar(0.28 + charge * 0.55 + blastC * 2.2);
    coreMat.opacity = 0.30 * charge + 1.0 * blastC;
    coreMat.color.setRGB(0.6 + 0.4 * blastC, 1.0, 0.3 + 0.4 * blastC);

    // central shock ring sweeps out flat
    shock.scale.setScalar(0.4 + grow * 4.6);
    shockMat.opacity = (1.0 * blastC + 0.45 * (1 - grow)) * after;
    scorch.scale.setScalar(0.5 + grow * 2.2);
    scorchMat.opacity = (0.5 * blastC + 0.25 * (1 - grow)) * after;

    // each burst pops on its own staggered timeline
    for (let i = 0; i < bursts.length; i++) {
      const B = bursts[i];
      const d = Math.max(0, 1 - Math.abs(prog - B.peak) / 0.085);
      const pop = d * d;
      const lt = (prog - (B.peak - 0.05)) / 0.40;
      const local = lt < 0 ? 0 : (lt > 1 ? 1 : lt);
      const on = prog > (B.peak - 0.06) ? 1 : 0;

      B.flare.scale.setScalar(0.25 + pop * 1.9 + local * 0.4);
      B.flareMat.opacity = (1.0 * pop + 0.3 * (1 - local)) * on;
      B.flareMat.color.setRGB(0.65 + 0.35 * pop, 1.0, 0.35);

      B.ring.scale.setScalar(0.3 + local * 3.0);
      B.ringMat.opacity = (0.85 * pop + 0.35 * (1 - local)) * on;

      const reach = local * 1.4;
      for (let s = 0; s < B.spikes.length; s++) {
        const sp = B.spikes[s];
        const sa = sp.userData.sa;
        const dx = Math.sin(sa) * reach;
        const dz = Math.cos(sa) * reach;
        const dy = Math.sin(local * Math.PI) * 0.35;
        sp.position.set(dx, dy, dz);
        // point cones outward from the burst center
        sp.rotation.z = -sa;
        sp.rotation.x = Math.PI / 2;
        sp.scale.setScalar(0.5 + pop * 1.3);
        sp.userData.mat.opacity = (0.9 * pop + 0.3 * (1 - local)) * on;
      }
      // little upward drift as the burst dies
      B.node.position.y += (pop * 0.02);
    }

    grp.rotation.y = prog * 0.4;
  };

  return g;
}

// STRENGTHENED: more & taller bone pillars (12) in a clear ring, each overshoots-then-settles erupting upward with a bright cap-flash; punchier ground shockwave + sweeping summon arc + rising marrow motes; brighter additive throughout.
export function buildCastFx_boneprison(opts) {
  const c = (opts && opts.color) || "#e8e0c0";
  const g = new T.Group();
  const N = 12;
  const R = 1.05;

  // shared additive materials (freshly created — safe to animate)
  const spikeMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const capMat   = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const coreMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const arcMat   = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const moteMat  = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  const spikes = [];
  const caps = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const sp = m(geo("cfxBpSpike", () => new T.ConeGeometry(0.16, 1.15, 5)), spikeMat);
    sp.position.set(Math.cos(a) * R, 0.0, Math.sin(a) * R);
    sp.rotation.z = Math.cos(a) * 0.16;
    sp.rotation.x = -Math.sin(a) * 0.16;
    sp.scale.set(1, 0.03, 1);
    sp.userData.ph = i / N;
    sp.userData.a = a;
    g.add(sp);
    spikes.push(sp);
    // bright tip flash that pops when each pillar tops out
    const cap = m(geo("cfxBpCap", () => new T.SphereGeometry(0.12, 7, 6)), capMat);
    cap.position.set(Math.cos(a) * R, 0.0, Math.sin(a) * R);
    cap.userData.ph = i / N;
    cap.userData.a = a;
    g.add(cap);
    caps.push(cap);
  }

  // ground shockwave ring under the cage
  const ring = m(geo("cfxBpRing", () => new T.RingGeometry(R - 0.14, R + 0.14, 36)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);

  // bright sigil core at center
  const core = m(geo("cfxBpCore", () => new T.RingGeometry(0.16, 0.48, 24)), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.03;
  g.add(core);

  // sweeping summon arc that traces the ring as the gesture flings forward
  const arc = m(geo("cfxBpArc", () => new T.RingGeometry(R - 0.06, R + 0.06, 40, 1, 0, Math.PI * 0.9)), arcMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.y = 0.10;
  g.add(arc);

  // rising marrow motes
  const motes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const mo = m(geo("cfxBpMote", () => new T.SphereGeometry(0.05, 6, 5)), moteMat);
    const mr = R * (0.85 + (i % 3) * 0.07);
    mo.userData.a = a;
    mo.userData.r = mr;
    mo.userData.ph = (i * 0.13) % 1;
    mo.position.set(Math.cos(a) * mr, 0, Math.sin(a) * mr);
    g.add(mo);
    motes.push(mo);
  }

  g.userData.castAnim = (grp, prog, now) => {
    const rise = prog < 0.50 ? (prog / 0.50) : 1;
    const fade = prog > 0.82 ? (1 - (prog - 0.82) / 0.18) : 1;
    const er = Math.sin(Math.min(rise, 1) * Math.PI * 0.5);
    const t = now ? now : 0;

    for (let i = 0; i < spikes.length; i++) {
      const sp = spikes[i];
      // staggered eruption around the ring, each overshoots then settles
      const local = Math.max(0, Math.min(1, (rise - sp.userData.ph * 0.35) / 0.55));
      const eo = local <= 0 ? 0 : (1 + Math.sin(local * Math.PI - Math.PI * 0.5)) * 0.5; // ease
      const overshoot = 1 + Math.sin(local * Math.PI) * 0.18; // pop past then settle
      const h = eo * overshoot;
      const sy = 0.03 + h * 1.0;
      sp.scale.y = sy;
      sp.position.y = (1.15 * sy) * 0.5 - 0.05;
      // cap rides the tip, flashes brightest at the moment it tops out
      const cap = caps[i];
      cap.position.y = 1.15 * sy - 0.05;
      const pop = Math.sin(Math.min(1, local) * Math.PI); // peaks mid-rise
      cap.scale.setScalar(0.5 + pop * 1.4);
      capMat.opacity = 0; // set per-mesh below via shared mat; use brightest contribution
    }
    // cap flash: drive shared material by overall rise burst
    capMat.opacity = (0.9 * Math.sin(Math.min(1, rise) * Math.PI)) * fade;

    spikeMat.opacity = 0.95 * Math.min(1, rise * 1.4) * fade;

    // shockwave: punchy expand at the start, then steady glow
    const shock = prog < 0.4 ? (prog / 0.4) : 1;
    ring.scale.setScalar(0.5 + shock * 0.75 + Math.sin(prog * Math.PI * 6) * 0.05);
    ringMat.opacity = (0.7 * er) * fade;

    // sigil core spins and pulses bright
    core.rotation.z = t * 0.004;
    core.scale.setScalar(0.5 + er * 0.8);
    coreMat.opacity = (0.85 * er) * fade;

    // summon arc sweeps around and brightens during the fling, then fades
    arc.rotation.z = -Math.PI * 0.5 + prog * Math.PI * 2.2;
    const arcLife = prog < 0.6 ? Math.sin(Math.min(1, prog / 0.6) * Math.PI) : 0;
    arc.scale.setScalar(0.9 + er * 0.2);
    arcMat.opacity = 0.85 * arcLife * fade;

    // motes rise and twinkle
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const lp = (rise + mo.userData.ph) % 1;
      mo.position.y = lp * 1.25;
      const drift = mo.userData.r * (1 + lp * 0.12);
      mo.position.x = Math.cos(mo.userData.a) * drift;
      mo.position.z = Math.sin(mo.userData.a) * drift;
      mo.scale.setScalar(0.6 + Math.sin(t * 0.01 + i) * 0.4);
    }
    moteMat.opacity = (0.8 * er) * fade;
  };
  return g;
}

// demonslash: brighter layered flame crescent that sweeps on a DIAGONAL tilt, white-hot inner edge, leading flame tongue, trailing ember spray, punchier mid-swing flash
export function buildCastFx_demonslash(opts) {
  const c = (opts && opts.color) || "#ff3b2f";
  const g = new T.Group();
  const mk = (col, op) => new T.MeshBasicMaterial({ color: col, fog:false, transparent:true, opacity:op, blending:T.AdditiveBlending, depthWrite:false });

  // pivot tilted so the whole crescent sweeps on a diagonal, not flat
  const pivot = new T.Group();
  pivot.position.y = 0.9;
  pivot.rotation.z = 0.5;   // diagonal lean of the slash plane
  pivot.rotation.x = -Math.PI / 2 + 0.35;
  g.add(pivot);

  const outerMat = mk(c, 0.0);
  const coreMat = mk("#ffb347", 0.0);
  const hotMat = mk("#fff2c8", 0.0);
  const arc = m(geo("cfxDsArc", () => new T.RingGeometry(1.2, 2.5, 48, 1, -Math.PI * 0.66, Math.PI * 1.32)), outerMat);
  pivot.add(arc);
  const core = m(geo("cfxDsCore", () => new T.RingGeometry(1.55, 2.15, 48, 1, -Math.PI * 0.6, Math.PI * 1.2)), coreMat);
  pivot.add(core);
  const hot = m(geo("cfxDsHot", () => new T.RingGeometry(1.78, 2.02, 48, 1, -Math.PI * 0.56, Math.PI * 1.12)), hotMat);
  pivot.add(hot);

  // leading flame tongue at the tip of the arc
  const tongueMat = mk("#ffd58a", 0.0);
  const tongue = m(geo("cfxDsTongue", () => new T.ConeGeometry(0.5, 1.6, 12)), tongueMat);
  tongue.userData.mat = tongueMat;
  pivot.add(tongue);

  // trailing ember spray
  const embers = [];
  for (let i = 0; i < 9; i++) {
    const eMat = mk(i % 2 ? "#ffcf7a" : c, 0.0);
    const e = m(box(0.17, 0.17, 0.17), eMat);
    const a = -Math.PI * 0.55 + (i / 8) * Math.PI * 1.1;
    e.userData.a = a; e.userData.mat = eMat; e.userData.phase = (i / 8) * 0.5; e.userData.r0 = 1.9 + (i % 3) * 0.12;
    pivot.add(e); embers.push(e);
  }

  // bright impact flash facing the player
  const flashMat = mk("#ffd0a0", 0.0);
  const flash = m(plane(3.2, 2.0), flashMat);
  flash.position.set(0, 1.0, 1.5); g.add(flash);

  g.userData.castAnim = (grp, prog, now) => {
    const swing = prog < 0.26 ? 0 : Math.min(1, (prog - 0.26) / 0.46);
    const sweepEnv = Math.sin(Math.max(0, swing) * Math.PI);
    const wind = Math.min(1, prog / 0.26);
    const fade = prog < 0.82 ? 1 : Math.max(0, 1 - (prog - 0.82) / 0.18);

    // the crescent rotates fast through its tilted plane as the swing carves
    pivot.rotation.y = -1.3 * (1 - swing) + 2.0 * swing;
    const sc = 0.65 + 0.6 * swing;
    arc.scale.setScalar(sc); core.scale.setScalar(sc); hot.scale.setScalar(sc);

    outerMat.opacity = (0.85 * sweepEnv + 0.25 * wind * (1 - swing)) * fade;
    coreMat.opacity = 0.95 * sweepEnv * fade;
    hotMat.opacity = Math.pow(sweepEnv, 0.6) * fade;

    // flame tongue rides the leading edge of the arc
    const tipA = -Math.PI * 0.62 * sc;
    tongue.position.set(Math.cos(tipA) * 2.2 * sc, Math.sin(tipA) * 2.2 * sc, 0);
    tongue.rotation.z = tipA - Math.PI * 0.5;
    tongueMat.opacity = sweepEnv * fade;
    const ts = 0.7 + 0.7 * sweepEnv;
    tongue.scale.set(ts, 1 + 0.5 * sweepEnv, ts);

    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      const lag = Math.max(0, Math.min(1, (swing - e.userData.phase) * 1.7));
      const r = (e.userData.r0 + lag * 0.8) * sc;
      e.position.set(Math.cos(e.userData.a) * r, Math.sin(e.userData.a) * r, (Math.sin(now * 0.013 + i) * 0.12) - lag * 0.4);
      const es = 1 - lag * 0.75;
      e.scale.setScalar(Math.max(0.05, es));
      e.userData.mat.opacity = 1.0 * sweepEnv * (1 - lag * 0.45) * fade;
    }

    flashMat.opacity = 0.85 * Math.max(0, 1 - Math.abs(swing - 0.4) * 4.2) * fade;
    flash.scale.setScalar(0.7 + swing * 0.9);
  };
  return g;
}

// Brighter conjure: counter-rotating twin halo + pulsing white core + sharper motes; 3 staggered meteors with white-hot heads, long trails, and expanding impact flare + shockwave rings
export function buildCastFx_starfall(opts) {
      const c = (opts && opts.color) || "#ffe08a";
      const g = new T.Group();
      const SKY = 3.6;
      const haloMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const ring2Mat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const coreMat  = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
      const moteMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

      const halo = m(geo("cfxStarfallHalo", () => new T.RingGeometry(0.5, 1.15, 36)), haloMat);
      halo.rotation.x = -Math.PI / 2; halo.position.y = SKY; g.add(halo);
      const ring2 = m(geo("cfxStarfallRing2", () => new T.RingGeometry(0.18, 0.34, 28)), ring2Mat);
      ring2.rotation.x = -Math.PI / 2; ring2.position.y = SKY; g.add(ring2);
      const core = m(geo("cfxStarfallCore", () => new T.OctahedronGeometry(0.4, 0)), coreMat);
      core.position.y = SKY; g.add(core);

      const motes = [];
      for (let i = 0; i < 9; i++) {
        const s = m(geo("cfxStarfallMote", () => new T.OctahedronGeometry(0.15, 0)), moteMat);
        s.userData.a = (i / 9) * Math.PI * 2;
        s.userData.r = 0.85 + (i % 3) * 0.22;
        g.add(s); motes.push(s);
      }

      const meteors = [];
      for (let i = 0; i < 3; i++) {
        const grp = new T.Group();
        const trailMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
        const headMat  = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
        const flareMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
        const shockMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
        const head = m(geo("cfxStarfallHead", () => new T.OctahedronGeometry(0.26, 0)), headMat);
        grp.add(head);
        const tail = m(geo("cfxStarfallTail", () => new T.ConeGeometry(0.2, 2.0, 10)), trailMat);
        tail.position.y = 1.1; grp.add(tail);
        const flare = m(geo("cfxStarfallFlare", () => new T.OctahedronGeometry(0.5, 0)), flareMat);
        flare.visible = false; grp.add(flare);
        const shock = m(geo("cfxStarfallShock", () => new T.RingGeometry(0.4, 0.62, 28)), shockMat);
        shock.rotation.x = -Math.PI / 2; shock.visible = false; grp.add(shock);
        const ang = (i / 3) * Math.PI * 2 + 0.5;
        grp.userData.tx = Math.cos(ang) * (0.7 + i * 0.35);
        grp.userData.tz = Math.sin(ang) * (0.7 + i * 0.35);
        grp.userData.delay = i * 0.16;
        grp.userData.trailMat = trailMat; grp.userData.headMat = headMat;
        grp.userData.flareMat = flareMat; grp.userData.shockMat = shockMat;
        grp.userData.flare = flare; grp.userData.shock = shock;
        grp.visible = false;
        g.add(grp); meteors.push(grp);
      }

      g.userData.castAnim = (grp, prog, now) => {
        const t = now ? now * 0.001 : prog * 5;
        const gather = Math.min(prog, 0.62) / 0.62;
        const strike = prog > 0.62 ? (prog - 0.62) / 0.38 : 0;
        const conjure = gather * (1 - strike);

        haloMat.opacity = 0.7 * conjure;
        halo.scale.setScalar(0.4 + gather * 1.0 + strike * 0.8);
        halo.rotation.z = prog * Math.PI * 1.8;
        ring2Mat.opacity = 0.85 * conjure;
        ring2.scale.setScalar(0.5 + gather * 0.8);
        ring2.rotation.z = -prog * Math.PI * 2.6;
        coreMat.opacity = (0.5 + 0.5 * Math.sin(t * 14)) * conjure;
        core.scale.setScalar(0.5 + gather * 0.9 + Math.sin(t * 14) * 0.12 * gather);
        core.rotation.y = t * 3;

        const conv = 1 - gather * 0.78;
        moteMat.opacity = 0.95 * conjure;
        for (let i = 0; i < motes.length; i++) {
          const s = motes[i];
          const a = s.userData.a + prog * Math.PI * 3.0;
          const r = s.userData.r * conv;
          s.position.set(Math.cos(a) * r, SKY + Math.sin(prog * 7 + i) * 0.14, Math.sin(a) * r);
          s.scale.setScalar(0.55 + gather * 0.7);
          s.rotation.y = a * 2;
        }

        for (let i = 0; i < meteors.length; i++) {
          const mt = meteors[i];
          const ud = mt.userData;
          const local = Math.min(1, Math.max(0, (strike - ud.delay) / 0.42));
          mt.visible = local > 0;
          if (local <= 0) continue;
          const fall = local < 0.78 ? local / 0.78 : 1;
          const land = local > 0.78 ? (local - 0.78) / 0.22 : 0;
          const ef = fall * fall;
          const y = SKY - ef * SKY;
          mt.position.set(ud.tx * ef, y, ud.tz * ef);
          mt.scale.setScalar(0.85 + fall * 0.5);
          ud.trailMat.opacity = 0.95 * (1 - land);
          ud.headMat.opacity  = (0.8 + 0.2 * Math.sin(t * 30)) * (1 - land * 0.6);
          ud.flare.visible = land > 0;
          ud.shock.visible = land > 0;
          if (land > 0) {
            ud.flareMat.opacity = 1.0 * (1 - land);
            ud.flare.scale.setScalar(0.6 + land * 2.2);
            ud.shockMat.opacity = 0.85 * (1 - land);
            ud.shock.scale.setScalar(0.3 + land * 3.0);
          }
        }
      };
      return g;
    }

// STRENGTHENED: brighter triple vortex (core + two counter-rotating rings), 9 fanned arrow streaks with bright glowing tips, a charge-up funnel of motes and a forward muzzle-blast shockwave on release
export function buildCastFx_typhoonshot(opts) {
  const c = (opts && opts.color) || "#7dffb0";
  const g = new T.Group();
  const mk = (o) => new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat = mk();
  const coreMat = mk();
  const arrowMat = mk();
  const tipMat = mk();
  const moteMat = mk();
  const blastMat = mk();

  // Bright vortex core funnel + two counter-rotating swirl rings at chest height
  const core = m(geo("cfxTyphCore", () => new T.ConeGeometry(0.5, 1.0, 14, 1, true)), coreMat);
  core.position.y = 1.0; core.rotation.x = Math.PI; g.add(core);
  const ringA = m(geo("cfxTyphRingA", () => new T.TorusGeometry(0.95, 0.07, 8, 30)), ringMat);
  ringA.position.y = 0.82; ringA.rotation.x = -Math.PI/2 + 0.5; g.add(ringA);
  const ringB = m(geo("cfxTyphRingB", () => new T.TorusGeometry(0.62, 0.055, 8, 26)), ringMat);
  ringB.position.y = 1.08; ringB.rotation.x = -Math.PI/2 - 0.45; g.add(ringB);

  // Forward muzzle-blast shockwave ring (fires on release)
  const blast = m(geo("cfxTyphBlast", () => new T.TorusGeometry(0.5, 0.09, 8, 24)), blastMat);
  blast.position.y = 0.95; g.add(blast);

  // Arrow streaks: thin glowing shaft + bright cone tip
  const arrows = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = new T.Group();
    const shaft = m(geo("cfxTyphShaft", () => box(0.045, 0.045, 1.0)), arrowMat); a.add(shaft);
    const head = m(geo("cfxTyphHead", () => cone(0.11, 0.26, 7)), arrowMat); head.rotation.x = Math.PI/2; head.position.z = 0.6; a.add(head);
    const tip = m(geo("cfxTyphTip", () => new T.SphereGeometry(0.13, 8, 8)), tipMat); tip.position.z = 0.62; a.add(tip);
    a.userData.a = (i / N) * Math.PI * 2;
    a.userData.r = 0.45 + (i % 3) * 0.2;
    a.position.y = 0.95;
    g.add(a); arrows.push(a);
  }

  // Charge-up motes spiraling inward into the funnel during the coil
  const motes = [];
  for (let i = 0; i < 8; i++) {
    const p = m(geo("cfxTyphMote", () => new T.SphereGeometry(0.06, 6, 6)), moteMat);
    p.userData.a = (i / 8) * Math.PI * 2; p.userData.h = (i % 4) * 0.12;
    g.add(p); motes.push(p);
  }

  g.userData.castAnim = (grp, prog) => {
    const coil = Math.min(prog / 0.5, 1);
    const rel = Math.max((prog - 0.5) / 0.5, 0);
    const env = Math.sin(prog * Math.PI);
    const snap = Math.sin(Math.min(rel, 1) * Math.PI);
    const spin = prog * Math.PI * 2 * 5;

    ringMat.opacity = 0.7 * env;
    coreMat.opacity = 0.55 * coil * (1 - rel * 0.6);
    arrowMat.opacity = 0.85 * rel * (1 - rel * 0.25);
    tipMat.opacity = rel * (1 - rel * 0.2);
    moteMat.opacity = 0.8 * coil * (1 - rel);
    blastMat.opacity = 0.9 * snap * (1 - rel * 0.5);

    // Rings wind tight on coil, burst wide on release, spinning hard in opposition
    ringA.rotation.z = spin; ringB.rotation.z = -spin * 1.4;
    const grow = 0.35 + coil * 0.25 + rel * 1.0;
    ringA.scale.setScalar(grow); ringB.scale.setScalar(grow * 0.85);
    core.scale.set(0.8 + coil * 0.3, 0.8 + coil * 0.4, 0.8 + coil * 0.3);
    core.rotation.y = -spin * 0.5;

    // Forward shockwave punches out and expands as arrows launch
    blast.scale.setScalar(0.4 + rel * 2.4);
    blast.position.z = 0.4 + rel * 1.2;

    // Inward-spiraling charge motes collapse into the funnel mouth
    for (let i = 0; i < motes.length; i++) {
      const mo = motes[i];
      const ang = mo.userData.a + spin * 0.4;
      const rad = (1 - coil) * 1.1 + 0.12;
      mo.position.x = Math.cos(ang) * rad;
      mo.position.z = Math.sin(ang) * rad;
      mo.position.y = 0.95 + mo.userData.h + coil * 0.25;
      mo.scale.setScalar(0.6 + coil * 0.6);
    }

    // Arrows spiral then blast forward, fanning outward into a cone
    for (let i = 0; i < arrows.length; i++) {
      const ar = arrows[i];
      const ang = ar.userData.a + spin * 0.6;
      const reach = rel * 3.6;
      const spread = ar.userData.r * (0.5 + rel * 1.6);
      ar.position.x = Math.cos(ang) * spread;
      ar.position.z = 0.4 + reach;
      ar.position.y = 0.95 + Math.sin(ang) * spread * 0.45;
      ar.rotation.x = -spread * 0.25;
      ar.rotation.y = ang * 0.3 + (ar.userData.a - Math.PI) * 0.45;
      ar.scale.setScalar(0.55 + rel * 0.75);
    }
  };
  return g;
}

// STRENGTHENED: more soul motes dragged from a wider radius on visible tethers, a brighter cinching reap-ring, a darker-cored imploding nova with a hard flash-spike + recoil shockwave on collapse.
export function buildCastFx_soulharvest(opts) {
  const c = (opts && opts.color) || "#c489ff";
  const g = new T.Group();

  // Cinching reap-ring at the harvest radius
  const ringMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring = m(geo("cfxShReapRing", () => new T.RingGeometry(3.6, 4.15, 48)), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.7; g.add(ring);

  // Inner counter-ring for a brighter braided look
  const ring2Mat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ring2 = m(geo("cfxShReapRing2", () => new T.RingGeometry(2.4, 2.7, 40)), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.85; g.add(ring2);

  // Soul motes + their drag-tethers
  const wispMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const tethMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const wisps = [], teths = [];
  const N = 12;
  for (let i = 0; i < N; i++) {
    const w = m(geo("cfxShWisp", () => new T.SphereGeometry(0.13, 8, 8)), wispMat);
    w.userData.a = (i / N) * Math.PI * 2;
    w.userData.ph = (i / N);
    g.add(w); wisps.push(w);
    const t = m(geo("cfxShTeth", () => new T.PlaneGeometry(0.07, 1, 1, 1)), tethMat);
    g.add(t); teths.push(t);
  }

  // Dark-cored imploding nova: bright halo with a darker (absent-light) center void implied by a tighter hot core
  const haloMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const halo = m(geo("cfxShHalo", () => new T.SphereGeometry(0.55, 14, 14)), haloMat);
  halo.position.y = 1.0; g.add(halo);

  const coreMat = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const core = m(geo("cfxShCore", () => new T.SphereGeometry(0.26, 12, 12)), coreMat);
  core.position.y = 1.0; g.add(core);

  // Vertical soul pillar erupting on collapse
  const pillarMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const pillar = m(cyl(0.22, 0.04, 2.6, 12), pillarMat);
  pillar.position.y = 1.2; g.add(pillar);

  // Recoil shockwave ring kicked out at the instant of implosion
  const shockMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const shock = m(geo("cfxShShock", () => new T.RingGeometry(0.3, 0.55, 40)), shockMat);
  shock.rotation.x = -Math.PI / 2; shock.position.y = 0.6; g.add(shock);

  g.userData.castAnim = (grp, prog) => {
    const reap = Math.min(prog / 0.58, 1);
    const draw = Math.max((prog - 0.58) / 0.42, 0);
    const reapE = Math.sin(reap * Math.PI * 0.5);
    const drawE = draw * draw * (3 - 2 * draw);
    // hard flash at the collapse moment
    const flash = Math.sin(Math.min(draw / 0.28, 1) * Math.PI);

    // Cinching rings: bright during reap, snap tighter and fade as souls pull in
    ringMat.opacity = 0.6 * reapE * (1 - draw * 0.85);
    ring.rotation.z = reap * Math.PI * 1.4;
    ring.scale.setScalar((1 - draw * 0.55));
    ring2Mat.opacity = 0.5 * reapE * (1 - draw * 0.7);
    ring2.rotation.z = -reap * Math.PI * 1.8;
    ring2.scale.setScalar(1 - draw * 0.4);

    const inward = drawE;
    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i], t = teths[i];
      const local = Math.min(Math.max((prog - w.userData.ph * 0.22) / 0.78, 0), 1);
      const rad = 3.9 * (1 - local * 0.12);
      const spin = w.userData.a + prog * Math.PI * 3.6 + inward * Math.PI * 3.0;
      const rNow = rad * (1 - inward * 0.97);
      const px = Math.cos(spin) * rNow;
      const pz = Math.sin(spin) * rNow;
      const py = 0.5 + inward * (0.55 + (i % 3) * 0.2) + reapE * 0.12;
      w.position.set(px, py, pz);
      const s = 0.75 + reapE * 0.55 + inward * 0.7 + flash * 0.3;
      w.scale.setScalar(s);

      // tether streak from mote toward the core
      const cx = 0, cy = 1.0, cz = 0;
      const dx = cx - px, dy = cy - py, dz = cz - pz;
      const len = Math.hypot(dx, dy, dz) || 0.0001;
      t.position.set((px + cx) / 2, (py + cy) / 2, (pz + cz) / 2);
      t.scale.set(1, len, 1);
      t.lookAt(cx, cy, cz);
      t.rotateX(Math.PI / 2);
    }
    wispMat.opacity = 0.9 * Math.min(reap * 1.5, 1) * (1 - draw * 0.45);
    tethMat.opacity = 0.5 * Math.min(reap * 1.6, 1) * (1 - draw * 0.6) * (0.4 + inward * 0.6);

    // Imploding nova: halo balloons then the white core flares hard
    haloMat.opacity = drawE * 0.7 * (1 - draw * 0.25) + flash * 0.2;
    halo.scale.setScalar(0.5 + drawE * 1.7 + flash * 0.4);
    coreMat.opacity = drawE * 0.95 + flash * 0.5;
    core.scale.setScalar(0.35 + drawE * 1.1 + flash * 0.7 + Math.sin(prog * 44) * 0.05 * drawE);

    // Pillar erupts upward on collapse
    pillarMat.opacity = drawE * 0.55 * (1 - draw * 0.35) + flash * 0.2;
    pillar.scale.y = 0.25 + drawE * 1.25;
    pillar.scale.x = pillar.scale.z = 0.45 + drawE * 0.9;

    // Recoil shockwave punches outward at the implosion instant
    shockMat.opacity = flash * 0.7;
    const sw = 0.5 + flash * 6.0 + draw * 1.5;
    shock.scale.set(sw, sw, sw);
  };

  return g;
}

// expose the cache for the engine (warm-up / disposal if needed)
export const _cache = { GEO, MATS };


// seismicrupture FX: a bright cracking fissure that ERUPTS forward in +Z ~5 tiles on slam-impact — jagged ground cracks, flung earth shards, dust, amber/orange additive glow.
export function buildCastFx_seismicrupture(opts) {
  const c = (opts && opts.color) || "#ff8a2c";
  const g = new T.Group();
  const RUN = 5.0;            // ~5 tiles forward in +Z
  const SEGS = 7;             // jagged crack segments

  const fresh = (op) => new T.MeshBasicMaterial({ color: c, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });

  // --- main fissure line: chain of jagged segments laid out along +Z, each kinked sideways ---
  const crackMat = fresh(0.0);
  const segs = [];
  let zCur = 0.15, xCur = 0;
  for (let i = 0; i < SEGS; i++) {
    const dz = RUN / SEGS;
    const nx = (i % 2 === 0 ? 1 : -1) * (0.12 + (i / SEGS) * 0.18); // widening zig-zag
    const seg = m(geo("seismicruptureCrack" + i, () => box(0.16, 0.05, 1.0)), crackMat);
    const z0 = zCur, z1 = zCur + dz, x0 = xCur, x1 = xCur + nx;
    seg.userData.z0 = z0; seg.userData.z1 = z1; seg.userData.x0 = x0; seg.userData.x1 = x1;
    seg.userData.t = (i + 1) / SEGS;     // how far down the line (for staggered eruption)
    g.add(seg); segs.push(seg);
    zCur = z1; xCur = x1;
  }

  // --- flung earth shards kicked up along the fissure ---
  const shardMat = fresh(0.0);
  const shards = [];
  for (let i = 0; i < 9; i++) {
    const s = m(geo("seismicruptureShard" + (i % 3), () => box(0.09, 0.16, 0.09)), shardMat);
    const t = (i + 0.5) / 9;
    s.userData.t = t;
    s.userData.z = 0.15 + t * RUN;
    s.userData.x = (i % 2 === 0 ? 1 : -1) * (0.18 + Math.random() * 0.25);
    s.userData.sp = 0.9 + Math.random() * 0.8;   // launch speed
    s.userData.rot = (Math.random() - 0.5) * 8;
    g.add(s); shards.push(s);
  }

  // --- dust plumes (soft wide boxes) rising along the line ---
  const dustMat = fresh(0.0);
  const dusts = [];
  for (let i = 0; i < 4; i++) {
    const d = m(geo("seismicruptureDust" + i, () => box(0.5, 0.6, 0.5)), dustMat);
    d.userData.t = (i + 0.5) / 4;
    d.userData.z = 0.4 + d.userData.t * (RUN - 0.4);
    g.add(d); dusts.push(d);
  }

  // --- impact flare at the caster's feet where the slam lands ---
  const flareMat = fresh(0.0);
  const flare = m(geo("seismicruptureFlare", () => new T.RingGeometry(0.12, 0.5, 20)), flareMat);
  flare.rotation.x = -Math.PI / 2; flare.position.set(0, 0.06, 0.2); g.add(flare);

  g.userData.castAnim = (grp, prog, now) => {
    // fissure erupts on the slam (~0.45 in the body anim); before that, nothing visible
    const erupt = prog < 0.42 ? 0 : Math.min((prog - 0.42) / 0.20, 1); // 0→1 race forward
    const eEase = erupt * erupt * (3 - 2 * erupt);
    const fade = prog > 0.78 ? (prog - 0.78) / 0.22 : 0;               // settle/fade tail
    const fadeMul = 1 - fade;
    const flick = 1 + Math.sin((now || 0) * 0.05) * 0.12;             // glow flicker

    // impact flare: hard pop on the slam, expands and fades
    const fl = prog < 0.42 ? 0 : Math.min((prog - 0.42) / 0.12, 1);
    flareMat.opacity = Math.sin(Math.min(fl, 1) * Math.PI) * 0.9 * flick;
    flare.scale.setScalar(0.5 + fl * 2.6);

    // crack: each segment lights up as the eruption front passes its position
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const lit = Math.max(0, Math.min((eEase - s.userData.t * 0.85) / 0.18, 1));
      const mx = (s.userData.x0 + s.userData.x1) / 2;
      const mz = (s.userData.z0 + s.userData.z1) / 2;
      s.position.set(mx, 0.05, mz);
      const len = (s.userData.z1 - s.userData.z0) * 1.05;
      s.scale.set(1, 1, len * lit);
      s.lookAt(s.userData.x1, 0.05, s.userData.z1);
      s.userData.litMat = lit;
    }
    crackMat.opacity = (0.55 + 0.35 * flick) * eEase * fadeMul + 0.15 * eEase;

    // shards: launch upward+outward as the front reaches them, arc back down
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const local = Math.max(0, Math.min((eEase - s.userData.t * 0.85) / 0.22, 1));
      const arc = Math.sin(local * Math.PI);          // up then down
      const y = 0.05 + arc * s.userData.sp;
      s.position.set(s.userData.x * (0.4 + local), y, s.userData.z + arc * 0.2);
      s.rotation.set(local * s.userData.rot, local * 2, local * s.userData.rot * 0.6);
      s.scale.setScalar(0.5 + local * 0.7);
    }
    shardMat.opacity = (0.8 * eEase) * fadeMul;

    // dust: bloom up and dissipate, lagging slightly behind the shards
    for (let i = 0; i < dusts.length; i++) {
      const d = dusts[i];
      const local = Math.max(0, Math.min((eEase - d.userData.t * 0.85) / 0.30, 1));
      const rise = local;
      d.position.set(0, 0.2 + rise * 0.8, d.userData.z);
      d.scale.set(0.6 + rise * 1.4, 0.5 + rise * 1.2, 0.6 + rise * 1.4);
    }
    dustMat.opacity = 0.22 * eEase * fadeMul;
  };

  return g;
}

export function buildCastFx_singularity(opts) {
  // void core ~3.5 tiles ahead (+Z): shrinking rings + inward motes, then a bright implosion flash
  const c = (opts && opts.color) || '#c489ff';
  const g = new T.Group();
  const cx = 0, cy = 0.85, cz = 3.5;
  const mk = (hex, op) => new T.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  const coreMat = mk('#7a3cff', 0.92);
  const core = m(geo('singCore', () => new T.SphereGeometry(0.42, 10, 10)), coreMat); core.position.set(cx, cy, cz); g.add(core);
  const ringMat = mk(c, 0.8);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = m(geo('singRing' + i, () => new T.TorusGeometry(1.0 + i * 0.45, 0.06, 6, 22)), ringMat);
    r.position.set(cx, cy, cz); r.rotation.x = Math.PI / 2; g.add(r); rings.push(r);
  }
  const moteMat = mk('#e6cfff', 0.9);
  const motes = [];
  for (let i = 0; i < 10; i++) {
    const mt = m(geo('singMote', () => box(0.13, 0.13, 0.13)), moteMat);
    mt.userData.a = (i / 10) * Math.PI * 2; mt.userData.r = 1.7 + (i % 3) * 0.3; g.add(mt); motes.push(mt);
  }
  const flashMat = mk('#ffffff', 0);
  const flash = m(geo('singFlash', () => new T.SphereGeometry(0.6, 10, 10)), flashMat); flash.position.set(cx, cy, cz); g.add(flash);
  g.userData.castAnim = (grp, prog) => {
    const charge = Math.min(prog / 0.72, 1), imp = prog > 0.72 ? (prog - 0.72) / 0.28 : 0;
    core.scale.setScalar(Math.max(0.05, 1 + charge * 0.5 - imp * 0.9));
    coreMat.opacity = 0.92 * (1 - imp);
    const rs = Math.max(0.05, (1 - charge * 0.55) * (1 - imp));
    for (let i = 0; i < rings.length; i++) { rings[i].scale.setScalar(rs); rings[i].rotation.z = prog * 6; }
    ringMat.opacity = 0.8 * (1 - imp);
    const pull = (1 - charge) * (1 - imp);
    for (let i = 0; i < motes.length; i++) {
      const ang = motes[i].userData.a + prog * 4, r = motes[i].userData.r * pull;
      motes[i].position.set(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.6, cz + Math.sin(ang) * r);
    }
    moteMat.opacity = 0.9 * (1 - imp);
    flashMat.opacity = imp > 0 ? Math.sin(imp * Math.PI) * 0.9 : 0;
    flash.scale.setScalar(0.5 + imp * 3.2);
  };
  return g;
}

// strengthened: volatile forward launch — bright nocked spark that streaks out in +Z, a muzzle flash at the loose point, and a fading ember/spark trail
export function buildCastFx_explosiveshot(opts) {
  const c = (opts && opts.color) || "#ffb020";
  const g = new T.Group();
  const Y = 1.45, Z0 = 0.30;                 // launch origin (shoulder height, front)

  // fresh additive mats (never the shared cache)
  const headMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const flashMat = new T.MeshBasicMaterial({ color: "#ffffff", fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const ringMat  = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const trailMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const emberMat = new T.MeshBasicMaterial({ color: c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });

  // bright streaking head
  const head = m(geo("explosiveshotHead", () => new T.SphereGeometry(0.13, 12, 10)), headMat);
  head.position.set(0, Y, Z0); g.add(head);

  // hot trailing streak behind the head
  const trail = m(geo("explosiveshotTrail", () => new T.CylinderGeometry(0.025, 0.10, 1.0, 8)), trailMat);
  trail.position.set(0, Y, Z0); g.add(trail);

  // muzzle flash burst at the nock point
  const flash = m(geo("explosiveshotFlash", () => new T.SphereGeometry(0.22, 12, 10)), flashMat);
  flash.position.set(0, Y, Z0); g.add(flash);

  // expanding launch ring (shockwave at loose)
  const ring = m(geo("explosiveshotRing", () => new T.RingGeometry(0.10, 0.26, 20)), ringMat);
  ring.position.set(0, Y, Z0); g.add(ring);

  // ember sparks scattered along the wake
  const embers = [];
  for (let i = 0; i < 8; i++) {
    const e = m(geo("explosiveshotEmber", () => new T.BoxGeometry(0.05, 0.05, 0.05)), emberMat);
    e.userData.a = (i / 8) * Math.PI * 2;
    e.userData.r = 0.06 + (i % 3) * 0.045;
    e.userData.lag = 0.10 + (i % 4) * 0.07;   // how far back along the streak
    e.visible = false;
    g.add(e); embers.push(e);
  }

  g.userData.castAnim = (grp, prog) => {
    // charge while drawing, fire forward after the loose
    const charge = Math.min(prog / 0.55, 1);
    const cEase = charge * charge * (3 - 2 * charge);
    const fire = prog > 0.55 ? (prog - 0.55) / 0.45 : 0;   // 0..1 flight
    const fEase = fire * fire;                              // accelerate out

    // pre-loose: charging glow + jitter at the nock
    if (fire <= 0) {
      const jit = Math.sin(prog * 40) * 0.04;
      head.position.set(jit, Y, Z0);
      headMat.opacity = 0.35 + 0.5 * cEase;
      head.scale.setScalar(0.6 + cEase * 0.6 + Math.sin(prog * 26) * 0.1);
      flashMat.opacity = 0; ringMat.opacity = 0; trailMat.opacity = 0;
      for (const e of embers) e.visible = false;
      return;
    }

    // the loose flash (brief, front-loaded on fire)
    const flashE = Math.max(0, 1 - fire / 0.35);
    flashMat.opacity = flashE * flashE * 0.95;
    flash.scale.setScalar(0.4 + (1 - flashE) * 1.6);

    // launch ring expands and fades
    ringMat.opacity = flashE * 0.7;
    ring.scale.setScalar(0.5 + (1 - flashE) * 2.4);
    ring.rotation.z = prog * 4.0;

    // head streaks forward in +Z
    const z = Z0 + fEase * 3.4;
    head.position.set(0, Y, z);
    headMat.opacity = 0.95 * (1 - fire * 0.25);
    head.scale.setScalar(1.0 + Math.sin(prog * 30) * 0.12);

    // stretched hot trail behind the head
    const len = 0.4 + fEase * 1.6;
    trailMat.opacity = 0.7 * (1 - fire * 0.4);
    trail.position.set(0, Y, z - len * 0.5);
    trail.scale.set(1, len, 1);
    trail.rotation.x = Math.PI / 2;   // align cylinder along +Z

    // ember sparks scatter and drift back along the wake
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i]; e.visible = true;
      const ez = z - e.userData.lag - fEase * (0.3 + e.userData.lag);
      const spin = prog * 10 + e.userData.a;
      const r = e.userData.r * (1 + fire * 1.2);
      e.position.set(Math.cos(spin) * r, Y + Math.sin(spin) * r - fire * 0.18, ez);
      e.scale.setScalar((0.5 + Math.sin(prog * 24 + i) * 0.3) * (1 - fire * 0.3));
      emberMat.opacity = 0.8 * (1 - fire * 0.6);
    }
  };

  return g;
}

// gravegrasp FX: strengthened with a full RING of bone-white skeletal hands/claws erupting up out of the ground ahead in +Z (~2.6-tile span), staggered burst, plus a grave-dust shock ring, ground crack ring, central grave glow, and rising bone motes — all additive
export function buildCastFx_gravegrasp(opts){
  const c = (opts && opts.color) || '#e8f0e0';
  const g = new T.Group();
  const HANDS = 7;
  const CZ = 1.55;            // ring center ahead in +Z
  const RAD = 1.1;            // ring radius → ~2.6-tile diameter span
  const hands = [];
  const ringMat = new T.MeshBasicMaterial({ color:c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const dustMat = new T.MeshBasicMaterial({ color:c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const glowMat = new T.MeshBasicMaterial({ color:c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  // ground crack ring marking where the hands rise
  const ring = m(geo('gravegraspRing', () => new T.RingGeometry(RAD*0.55, RAD*1.02, 28)), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.set(0, 0.02, CZ); g.add(ring);
  // expanding grave-dust shock ring
  const dust = m(geo('gravegraspDust', () => new T.RingGeometry(0.2, 0.42, 24)), dustMat);
  dust.rotation.x = -Math.PI/2; dust.position.set(0, 0.03, CZ); g.add(dust);
  // central grave glow dome
  const glow = m(geo('gravegraspGlow', () => new T.SphereGeometry(0.5, 12, 8)), glowMat);
  glow.position.set(0, 0.05, CZ); glow.scale.set(1, 0.45, 1); g.add(glow);
  // skeletal hands: each = a wrist/palm column + 2 claw bones
  for (let i = 0; i < HANDS; i++){
    const a = (i / HANDS) * Math.PI * 2;
    const hand = new T.Group();
    hand.position.set(Math.sin(a) * RAD, 0, CZ + Math.cos(a) * RAD);
    hand.rotation.y = a;                                   // face outward from the ring
    const palmMat = new T.MeshBasicMaterial({ color:c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
    const palm = m(geo('gravegraspPalm', () => new T.CylinderGeometry(0.05, 0.07, 0.36, 6)), palmMat);
    palm.position.y = 0.18; hand.add(palm);
    for (let f = 0; f < 2; f++){
      const fin = m(geo('gravegraspFinger', () => new T.ConeGeometry(0.032, 0.28, 5)), palmMat);
      const fa = (f === 0 ? -0.42 : 0.42);
      fin.position.set(Math.sin(fa)*0.08, 0.42, 0.02);
      fin.rotation.z = -fa; fin.rotation.x = -0.18;
      hand.add(fin);
    }
    hand.userData.mat = palmMat;
    hand.userData.delay = (i / HANDS) * 0.4;               // staggered burst around the ring
    g.add(hand); hands.push(hand);
  }
  // rising bone motes
  const moteMat = new T.MeshBasicMaterial({ color:c, fog:false, transparent:true, opacity:0.0, blending:T.AdditiveBlending, depthWrite:false });
  const motes = [];
  for (let i = 0; i < 3; i++){
    const mt = m(box(0.06,0.06,0.06), moteMat);
    mt.userData.a = (i/3)*Math.PI*2; mt.userData.r = RAD*0.7;
    g.add(mt); motes.push(mt);
  }
  g.userData.castAnim = (grp, prog, now) => {
    const pre = Math.min(prog/0.45, 1);                    // gesture builds
    const preE = pre*pre*(3-2*pre);
    const burst = prog > 0.45 ? (prog-0.45)/0.55 : 0;      // hands erupt
    ringMat.opacity = (0.15 + preE*0.5) * (1 - burst*0.4);
    ring.scale.setScalar(0.4 + preE*0.7 + burst*0.15);
    ring.rotation.z = prog * 1.4;
    glowMat.opacity = preE*0.5*(1-burst) + (burst>0 ? Math.sin(Math.min(burst,1)*Math.PI)*0.4 : 0);
    glow.scale.set(0.6+preE*0.6, 0.3+preE*0.2, 0.6+preE*0.6);
    dustMat.opacity = burst>0 ? (1-burst)*0.55 : 0;        // shock ring expands on burst
    dust.scale.setScalar(0.3 + burst*3.2);
    for (let i=0;i<hands.length;i++){
      const h = hands[i];
      const local = Math.max(0, Math.min((burst - h.userData.delay) / Math.max(0.0001, 1 - h.userData.delay), 1));
      const rise = local*local*(3-2*local);
      h.position.y = -0.6 + rise*0.9;                      // emerge from below ground
      h.scale.setScalar(0.3 + rise*1.0);
      h.rotation.x = -0.15 + Math.sin(local*Math.PI)*0.28; // claw clench at apex
      h.userData.mat.opacity = rise * (1 - burst*0.25) * 0.95;
    }
    for (let i=0;i<motes.length;i++){
      const mt = motes[i];
      const ph = (burst*1.3 + i*0.2) % 1;
      const r = mt.userData.r * (0.6 + burst*0.5);
      mt.position.set(Math.sin(mt.userData.a)*r, ph*1.0, CZ + Math.cos(mt.userData.a)*r);
      mt.scale.setScalar((1-ph)*0.6*(burst>0?1:0));
      moteMat.opacity = burst>0 ? (1-ph)*0.6 : 0;
    }
  };
  return g;
}
