# HollowLight → WebGL 3D renderer — build plan (top-down, keep all game logic)

Goal: replace ONLY the Canvas2D renderer with a top-down WebGL (Three.js) 3D renderer.
All game logic, grid movement, items, leveling, menus (.screen DOM), HUD (#hud), minimap stay UNTOUCHED.

## Core decisions
- **Three.js 0.169.0**, self-hosted at `vendor/three-0.169.0.module.js` (687KB min). Import map in index.html `<head>` before app.js. NO CDN on deploy (flaky glasses link).
- **app.js stays a classic IIFE.** New ES module `render3d.js` (`<script type="module">` after app.js) publishes `window.__GL = { init, frame, onZoneChange, dispose, setMask, mask, enabled }`. One data shim at end of IIFE: `window.__GL_DATA = { rarityColor, mythicShimmer, gearLook, GEAR_LOOKS, ITEM_BASES, CLASSES, ENEMIES, SHRINES, BIOMES, RARITY_RANK, FACE, CFG }`.
- **Additive display is the load-bearing fact:** waveguide ADDS light; **pure black = transparent** (real world shows through). So: transparent clear (`alpha:true`, clearColor 0x000000,0), never draw a background, ALL materials emissive/unlit (`MeshBasicMaterial`), vignette = black `FogExp2` (fade-to-black = fade-to-transparent), "shadows" = faint additive contact glow discs (NOT black blobs — invisible). NOTE: current 2D `drawVignette` black-alpha fills are invisible on-device (latent bug); fog fixes it.
- **Renderer:** `antialias:false`, `setPixelRatio(1)` (hard cap), `setSize(600,600,false)`, `outputColorSpace=SRGB`, `NoToneMapping`, `shadowMap.enabled=false`, `sortObjects=false`, `autoClear=true`, `powerPreference:'high-performance'`.
- **Canvas:** a 2d-context canvas can't give webgl. Keep `#game-canvas` (2D); add NEW `#game-canvas-gl` as FIRST child of `#game` (bottom of stack) + a `#game-overlay-2d` 2D canvas for floating text/labels (above GL, below #hud). `#hud`, `.screen`, `#minimap` unchanged on top.
- **Camera:** tilted **orthographic** (~20°, TILT tunable; 0° FLAT tier = pixel-exact). 1 tile = 1 unit, ground = XZ plane, +Y up. `SPAN=600/28=21.4286` tiles across; `HALF=SPAN/2`. Reads `game.cam.{x,y}` (pre-clamped — never recompute). View center `(cam.x+HALF, 0, cam.y+HALF)`. Vertical frustum ÷cos(TILT). Screen-shake shakes the camera (`shake*16/28` world units).
- **Coord:** world tile `(wx,wy)` → 3D `(wx, 0, wy)` (game +y = world +z). Reproduces `w2s = (w-cam)*28`.

## Subsystem co-render MASK (keeps half-ported scene playable)
`window.__GL.mask = { world, items, portals, shrines, telegraphs, npcs, projectiles, minions, enemies, player, particles, ambient, town }` booleans.
- `render()` dispatcher (app.js): if `RENDER3D && __GL.enabled` → `render2D()` (draws ONLY subsystems whose mask bit is FALSE, on the 2D canvas) THEN `__GL.frame(game, now)` (renders mask-TRUE subsystems in 3D). Else `render2D()` with no mask (everything).
- Stacking: GL canvas (bottom) = 3D world; 2D canvas (top, transparent where not drawn) = remaining 2D subsystems; #hud on top. They composite.
- Final state: all mask bits true, `#game-canvas` `display:none`.

## Flag (master stays a working 2D game)
`const RENDER3D = new URLSearchParams(location.search).has('gl') || localStorage.getItem('hl_render')==='gl';` default OFF until Stage 4 proves on-device. 2D `render()` body renamed `render2D()` — never deleted (permanent fallback + hard auto-degrade target).

## app.js edits (small, reversible, flag-gated)
1. `setupRender()`: always get 2D ctx; if RENDER3D && __GL → also `__GL.init($('game'))`.
2. `render()`: rename body → `render2D()`; add dispatcher (above). render2D guards each draw with `MASKED('world')` etc.
3. `enterBiome`/`enterTown` after `game.world=` : `window.__GL && window.__GL.onZoneChange(game.world)`.
4. End of IIFE: `window.__GL_DATA = {...}`.
5. Debug handle: add `gl: window.__GL`.
6. `drawFloatingTexts`/`drawInteractionHints`: point ctx at overlay canvas when 3D active (Stage 4).

## draw* → 3D map (renderOrder floor 0 … vignette 100; opaque world depth-write, additive FX depthWrite:false)
- drawWorld → merged floor mesh + merged extruded-wall mesh + decor (built once in onZoneChange, vertex-colored, build-time face-cull: only floor-adjacent walls, only floor-facing faces, FACE[biome] two-tone).
- drawTownFeatures → fountain + 4 brazier groups (town onZoneChange).
- drawAmbient → 1 additive Points cloud (write ambientParticles[] into preallocated Float32Array).
- drawItems → pooled item group (ground glow disc + rarity beam plane + silhouette by icon family).
- drawPortals/drawShrines → pooled static-per-zone groups.
- drawTelegraphs → flat Ring + growing Circle on XZ (squash automatic under tilt).
- drawNpcs → pooled figure + role glyph plane (nameplate text → overlay-2D).
- drawProjectiles → InstancedMesh per kind (arrow/bolt/bone/soul).
- drawMinions → pooled purple skeletal group + TTL ring.
- drawEnemies → 18 shape builders + 2 fallbacks; pooled by shape, auto-instance per shape when crowd≥6; elite/frozen/enrage/hit-flash as separate affix-keyed overlay instancers; HP bar billboard; name/affix → overlay-2D.
- drawPlayer → 1 persistent rig: body + swappable weapon child + gear-look children + aura motes + wepFx; rebuild children only when equip ref changes.
- drawParticles → 1 additive cloud (write game.particles[]).
- drawInteractionHints → 1 pooled DOM `<div>` pill.
- drawVignette → black FogExp2 + player torch blob (additive radial plane) + CSS damage-flash div.
- drawFloatingTexts → port verbatim onto #game-overlay-2d (unshaken).
- drawMinimap → UNCHANGED (own #minimap canvas).

## buildX(THREE, opts) convention (pure factory; ~40 builders, parallel-authorable)
- Returns a `THREE.Group`. NO scene/global/game-state access. Materials from cached `MAT.tint(hex)`, geometry from module-level `GEO.*` singletons. ≤~8 prims / ≤~120 tris. Per-frame mutation ONLY in `group.userData.apply(obj,e,now)` — allocates NOTHING (anim phase from `performance.now()`, matching 2D `sin(now/220)`). Each enemy builder also exports `_merged()` (flattened BufferGeometry) for the instanced crowd path. Ship `buildPlaceholder` (tinted cube) for every key on day one so the pipeline is measurable before art exists.
- Builders: player (1 shared humanoid, 4 class tints) + weapons (sword/staff/bow/wand) + gear looks (cape/wings/spectral/crown/halo/plate/wepFx/aura) + 18 enemies (skeleton/hunched/ghost/spider/plant/orb/beast/giant/bat/wyrm/imp/demon/caster/void/weaver/crystal/voidlord + melee/ranged fallback) + NPC (1 shared + 5 role glyphs) + props (portal/shrine/minion/telegraph/townFountain/townBrazier) + 9 item silhouettes + 5 biome decor instancers + 1 shared glyph CanvasTexture atlas.

## Perf budget (600×600, weak mobile GPU, 40 enemies)
draw calls ≤~25, tris ≤~40k, per-frame JS ≤~2ms (zero alloc), GPU ≤~8-10ms. Static world = 3 merged draws built once/zone. Per-shape InstancedMesh for enemy crowds (≥6) + instanced projectiles/particles/shadow-blobs/aura/decor. Shared MAT/GEO caches. Preallocated typed arrays, module-level scratch Vector3/Matrix4/Color, pooling, never `new` in apply. Viewport-distance cull before sync. **Auto-degrade governor** (EMA over ~1s, ratchet down): >22ms → force instancing, drop ambient cap, hide cosmetics, top-only walls; then `setSize(450,450)` upscaled; hard >30ms or context-loss/init-fail → `RENDER3D=false` live + remember per-device.

## Stages (each independently testable on-device)
- **0 Foundation:** import map+vendor, render3d.js (init/frame/onZoneChange/dispose), GL+overlay canvases, tilted ortho cam, transparent clear, 6 app.js hooks, mask all-false. Done: `?gl=1` mounts transparent GL canvas; 2D game renders fully on top; flag off = identical; no errors.
- **1 World+player slice:** merged floor+walls+decor per biome, fog+torch, player placeholder. mask {world,player}. Done: walk a 3D extruded dungeon, camera centered same as 2D, shake works, walls occlude under tilt, rebuild on zone w/o leak.
- **2 Enemies + perf gate:** pooled zero-alloc reconcile, per-shape pools, cull, scale/affix toggles, HP bars, instanced crowd path, instanced projectiles/particles. mask +{enemies,projectiles,minions,particles}. Done: 40 enemies sustain target fps on-device (GO/NO-GO).
- **3 All builders:** replace placeholder cubes with real buildX, family by family. mask → all true. Done: every shape/weapon/look/role/kind/icon resolves; registry-completeness assert.
- **4 Polish + flip:** tune fog/torch per biome; particles; wepFx/auras/mythic shimmer; overlay-2D text+labels+hints; CSS damage-flash; governor+tiers; flip RENDER3D default ON.

## Risks → mitigations
enemy draw-call blowup → per-shape instancing proven w/ cubes in Stage 2 (gate); camera drift → ortho + drive only from game.cam, side-by-side validate; additive look → alpha:true+emissive+black fog, test on-device early w/ emissive slider; CDN fragility → self-host + init-fail→2D; zone hitch on 78² → presize arrays, build<8ms during fade; GPU leak across rifts → onZoneChange disposes prior world geo/mat/tex; IIFE coupling → one __GL_DATA line; sort artifacts → sortObjects=false, opaque-first then additive depthWrite:false in renderOrder.
