# Level generation and progression checks

Run against a locally served HollowLight app:

```sh
node tests/levels.browser.cjs
node tests/levels-flow.browser.cjs
```

`TEST_URL` defaults to `http://127.0.0.1:5251/?test=1`. The tests use the
Playwright installation under the current user's `.codex/skills/develop-web-game`.
`LEVEL_TEST_OUT` and `LEVEL_FLOW_OUT` can override the evidence directories.
By default evidence goes outside this repository, under
`../.visual-review/spire-systems/levels/`.

Both runners use disposable browser contexts, explicit SwiftShader, and blocked
external requests. Their extra function access is injected only into the test
browser's intercepted app response. It does not add a production test API or
change a personal save.

## Coverage

- 7,200 seeded normal maps: 300 seeds, six biomes, four floors. Flood-fill from
  the hero verifies every floor cell and every portal, shrine, enemy and loot
  location. Spawn, exit and boss cells must be open.
- 800 seeded Rift/Abyss maps at depths 1, 4, 11 and 25, including enough reachable
  non-hazard enemies to meet the portal's kill quota.
- Distinct same-seed biome layouts; repeatable Daily layout, biome and modifier;
  restoration of the surrounding random stream even if a seeded build throws.
- Every biome's floor 1-4 portal transitions, boss credit and town return, using
  the actual Interact button's focused-click path and dismissing level-up dialogs.
- The formerly trapped seed-78 start moves with actual directional inputs.
- Rift/Abyss locked portals, kill quotas, unlocked descent, keyboard boon choice
  and leaving a run. Bosses are defeated through controlled combat fixtures;
  these tests verify transitions, not the difficulty of a full campaign.
- Fresh Abyss entry/exit gives no Glass Tears or Covenant favor. Actual combat
  earns the existing exit reward and first-kill favor; a completed floor retains
  its reward when leaving before fighting on the next floor.

## Changes covered

Decoration now respects the full corridor width, room-center fallback cells,
entrance/portal clearings and a five-tile boss fighting area. Empty isolated nooks
are closed before enemies or loot are placed. Biomes have different room-shape
weights and sparse landmark patterns, using the existing collision tile types.
The Gauntlet derives its seven bosses from all six biome bosses plus the King.
Daily generation owns a date-seeded random stream without reseeding combat.

Existing v2 saves and item identities remain unchanged. Normal dungeon layouts
still regenerate on re-entry/reload; the existing safe-position recovery handles
saved coordinates. These browser checks do not claim physical glasses performance.
