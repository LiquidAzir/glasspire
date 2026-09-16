# Room scenery

Original prompt: Keep the improved HollowLight art, but make its levels feel less
empty with more interesting scenery and props, including noninteractive details.

The six dungeon biomes now have room-scale floor treatments and architectural
compositions made from the existing original Blender kit:

- Crypts: funerary aisles, circular stone inlays, tombs and broken arches.
- Overgrowth: irregular moss banks, ruined trees and masonry among the roots.
- Frostpeak: broad ice deposits and crystal outcrops.
- Infernal: scorched stone, ember-colored cracks, braziers and obsidian clusters.
- Tempest: brass astronomical tracks, columns and ruined observatory arches.
- Voidspire: nested ritual geometry, dark inset stone and shard monuments.

These are scenery, with no new items, rewards, interactions or collision types.
Raised props must fit entirely inside existing blocked grid cells and remain at
least 2.1 tiles from the spawn, portals, shrines and NPCs at zone creation. Flat
decoration is clipped to real floor tiles and leaves interaction clearings.
The builder never changes the world, its objectives, resources, or save data.
Placement uses coordinate hashes rather than gameplay randomness. Three.js still
creates its normal internal random UUIDs, which do not determine scenery.

Blender prop triangles now join the same eight-tile culled batches as masonry.
There are no added textures, lights, shadow maps, animation loops or downloads.
Every zone-owned batch has its own geometry; the shared source kit is preserved
when the zone is disposed. The renderer keeps its fixed 600x600 buffer.

`node tests/scenery.cjs` checks 24 generated maps across all six biomes and four
floors, including unchanged world data, valid blocked footprints, target
setbacks, finite nondegenerate geometry, independence from random UUID values,
and stable geometry/texture counts over ten zone rebuilds. Set `SPIRE_URL` for a
different isolated loopback server and `SPIRE_SCENERY_EVIDENCE` for another output
directory. The test blocks external traffic and uses disposable browser storage.

Matched before/after captures at 600x600 and real 390x844 mobile are in
`../.visual-review/spire-feel/scenery/images/`; `comparison.json` records each
scene's grid hash and renderer counts. The previous release is the immutable
`b0a7cd7` baseline. The supplied develop-web-game client also completed a short
movement sequence; its 3D screenshots and text state were inspected.

Matched room measurements (the same counts apply at both tested viewport sizes):

| Biome | Draw calls, before / after | Triangles, before / after |
| --- | ---: | ---: |
| Crypts | 45 / 39 | 26,943 / 34,541 |
| Overgrowth | 50 / 48 | 20,591 / 28,090 |
| Frostpeak | 68 / 64 | 26,283 / 33,895 |
| Infernal | 45 / 39 | 18,321 / 27,711 |
| Tempest | 53 / 47 | 19,843 / 31,149 |
| Voidspire | 62 / 58 | 25,603 / 38,087 |

Physical glasses performance remains unmeasured. No new collision or procedural
layout changes are part of this scenery pass. Final integrated captures use a
fresh page per scene, refresh the fixture's HUD, and let its normal zone
notification fade before taking the screenshot.
