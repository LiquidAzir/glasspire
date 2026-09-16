# HollowLight / Glass Spire visual and controls upgrade

Base: `LiquidAzir/glasspire`, `master` at `9e80d25`. The existing checkout matched GitHub after fetching. This round is a local implementation and review; no production deployment has been performed.

## Rendering

- Original Blender 5.2 kit: 27 meshes, five articulated heroes, three creatures and gothic environment props. Editable `.blend` and reproducible exporter are included. See `art-source/README.md`.
- Corrected orthographic projection: ground tiles now occupy 28 pixels on both screen axes. The previous vertical frustum flattened characters and scenery to half height.
- Fog now measures ground distance around the player. It no longer obscures almost the entire dungeon by measuring from the distant orthographic camera.
- Beveled masonry, subtle floor variation, biome palettes, contact shadows, readable portal frames and NPC role labels. New decoration stays within existing blocked cells.
- Legacy scenery is batched into opaque, additive and translucent groups. Eight-tile world chunks let off-screen rooms be culled. Material opacity is preserved separately from linear colour, so batching does not brighten effects incorrectly.
- Equipment remains independent of the hero mesh. Weapons follow their wrist, reset correctly after casts, and head mounts use class-specific model heights. Existing gear and transmog models remain available.
- Fixed 600×600, device pixel ratio 1, no real-time lights or shadow maps, no new runtime library or remote art dependency. Existing Canvas2D and failed-art fallbacks remain.

The kit is 1,680,911 bytes raw, approximately 275 KB gzip, and 11,400 triangles across its unique models. A matched town scene drops from 917 drawing operations to 43. The extra geometry is intentional; these are browser rendering measurements, not a physical-glasses frame-rate claim.

## Interface and gameplay

The new field-journal interface uses local SVG artwork, native readable phone text, a complete five-class chooser, grouped menus, strong focus and explicit game actions. Directional gestures remain compatible. Phone controls and contextual hints stay outside the square game scene.

Movement, Dash and Leap Slam now use body clearance and swept collision. Resuming into a regenerated dungeon finds a supported landing. Dead saves recover correctly; hardcore death cannot recreate its deleted character. Full-bag bounty rewards go to the stash, unequipping no longer creates starter duplicates, and menu/zone interruptions stop delayed effects safely.

Save import validates the payload and prevents the previous page from overwriting the replacement. Cloud writes are serialized, immutable, deduplicated and retried with the existing five-minute throttle. Pull timeouts cover stalled response bodies. Save keys, identities and the v2 format are preserved.

## Verification

`tests/README.md` documents the browser suites and their controlled fixtures. Run the standalone cloud checks with `node tests/cloud-sync.test.cjs`; they do not contact a real service.

Local review servers disable the cloud configuration, and browser tests block external requests. Comparison scenes are copied from the immutable base version so both images use the same map and hero position. Separate checks exercise actual keyboard/touch controls, skills, inventory, quests, saves, all six biomes, model opacity, missing-art fallback and resource cleanup.

Remaining validation: physical Meta Display glasses, physical neural-band input, and full endgame campaigns. Procedural dungeons still regenerate on re-entry; safe landing is corrected without changing that design.
