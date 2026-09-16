# HollowLight original Blender art

This kit is authored for the Meta Display version of HollowLight. Geometry is
original project artwork, generated in Blender 5.2 from the reproducible script
`scripts/build-spire-art.py`. No imported models, images, fonts, or paid assets.

The runtime file is `assets/spire-kit.json`; the editable source scene is
`art-source/spire-kit.blend`. Coordinates use +Y up and +Z front, with one unit
equal to one game tile. Props rest on Y=0. Indexed triangle data includes linear
RGB colors with directional illumination and local ambient occlusion baked in.
Use a vertex-colored unlit material with an sRGB output framebuffer. Do not apply
another directional lighting pass to the baked material.

The Blender contact sheet displays the same vertex colors using an emission
material, without runtime lights or shadow maps. Authoring material slots remain
in the source scene alongside the baked color layer.

Status: complete and geometrically validated.

Final kit: 27 indexed meshes, 11,400 triangles across the unique geometry library.
Runtime JSON is 1,680,911 bytes; gzip is about 275 KB (encoder-dependent).
All environment models are at most 688 triangles; the three creatures are
620-938 triangles. The full five-part hero rigs are 1,277-1,592 triangles.
Each distinct geometry can share an unlit vertex-color material; character rigs
need a core plus two arm and two leg meshes for existing animation pivots.

Rig placement (logical Three.js coordinates):

- Core: body origin `(0,0,0)`.
- `hero_leg`: origin is hip; attach at `(+/-0.14,0.56,0)`.
- `hero_arm_CLASS`: origin is shoulder; attach at `(+/-0.35,1.05,0)`.
- Right hand center: `(0.35,0.585,0.04)`; attach held gear there.
- Recommended head gear height: actual model maximum Y from the table below.
- Preserve baked class colors: material tint should be white, unless deliberately recoloring.

The portal frame is 2.88 units tall; a runtime scale of 0.72 yields 2.0736 units.

| Model | Triangles | Bounds min (x,y,z) | Bounds max (x,y,z) |
| --- | ---: | --- | --- |
| crypt_pillar | 588 | -0.415, 0, -0.415 | 0.415, 2.24, 0.415 |
| broken_arch | 688 | -1.09, 0, -0.34 | 1.09, 2.5225, 1.0062 |
| sarcophagus | 412 | -0.415, 0, -0.75 | 0.415, 0.7599, 0.75 |
| chest | 442 | -0.39, 0, -0.2857 | 0.39, 0.6033, 0.326 |
| brazier | 288 | -0.2679, 0, -0.2679 | 0.2679, 1.2367, 0.2679 |
| altar | 660 | -0.64, 0, -0.43 | 0.64, 1.1694, 0.4906 |
| shrine | 428 | -0.42, 0, -0.3141 | 0.42, 1.708, 0.3687 |
| portal_frame | 532 | -1.115, 0, -0.38 | 1.115, 2.88, 0.38 |
| crystal_cluster | 164 | -0.3935, 0, -0.3147 | 0.3935, 1.095, 0.3147 |
| ruined_tree | 212 | -0.5447, 0, -0.3469 | 0.6405, 2.166, 0.4036 |
| obsidian_spires | 164 | -0.3935, 0, -0.3062 | 0.3935, 1.545, 0.3062 |
| stone_slab | 68 | -0.4875, 0, -0.4875 | 0.4875, 0.1295, 0.4875 |
| stone_brick | 44 | -0.47, 0, -0.225 | 0.47, 0.36, 0.225 |
| hero_leg | 204 | -0.0896, -0.56, -0.0963 | 0.0896, 0, 0.1623 |
| hero_core_warrior | 541 | -0.4671, 0.42, -0.3549 | 0.4671, 1.68, 0.228 |
| hero_arm_warrior | 164 | -0.1016, -0.53, -0.1016 | 0.1016, 0, 0.1095 |
| hero_core_mage | 672 | -0.3346, 0.0595, -0.2546 | 0.3346, 1.6931, 0.2728 |
| hero_arm_mage | 120 | -0.134, -0.53, -0.1041 | 0.134, 0, 0.1361 |
| hero_core_ranger | 668 | -0.4143, 0.3791, -0.3549 | 0.4143, 1.5045, 0.2054 |
| hero_arm_ranger | 164 | -0.1016, -0.53, -0.1016 | 0.1016, 0, 0.1095 |
| hero_core_summoner | 944 | -0.3593, 0.0595, -0.3549 | 0.3593, 1.574, 0.2728 |
| hero_arm_summoner | 120 | -0.134, -0.53, -0.1041 | 0.134, 0, 0.1361 |
| hero_core_paladin | 597 | -0.4671, 0.28, -0.3549 | 0.4671, 1.65, 0.3053 |
| hero_arm_paladin | 164 | -0.1016, -0.53, -0.1016 | 0.1016, 0, 0.1095 |
| skeleton | 938 | -0.3647, 0, -0.1183 | 0.43, 1.48, 0.1459 |
| ghoul | 794 | -0.5071, 0, -0.2746 | 0.5071, 1.34, 0.4425 |
| wraith | 620 | -0.6063, 0, -0.2649 | 0.6063, 1.6055, 0.3444 |

Validation checks finite buffers, exact metadata bounds, valid indices, unit normals,
nonzero-area triangles, ground origin for props/creatures, and complete-rig budgets.
All 27 models pass. The external review directory contains environmental, assembled
adventurer, and creature contact renders from Blender and the validation report.

The `.blend` opens on the environmental contact sheet. Character source objects retain
their local pivots and are hidden from the viewport; unhide the named object to edit it.
Linked assembled study instances are included, also hidden by default. Running the
build script again reconstructs and rebakes the entire kit deterministically.
