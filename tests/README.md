# Gameplay and input verification

Spatial menu regression: `node tests/spatial-navigation.browser.cjs` starts its own cloud-disabled loopback server and checks the current displayed geometry at 600x600 and 390x844. Its 23 checks cover two-dimensional grids, incomplete rows, wide-row column retention, no wrapping, scroll/footer boundaries, inaccessible controls, inventory, skills, dialogue, pinch/Back and save-code editing. All network destinations outside that server are blocked; fixtures use disposable heroes. `NAV_PORT=5486 node tests/spatial-navigation.browser.cjs --serve` leaves the same preview server running for manual or supplied-client review (set the environment variable using the current shell's syntax).

Original prompt: Improve Glass Spire / HollowLight graphics, controls and enjoyment while preserving its lightweight Meta Display and phone experience.

## Run

With the app served locally, run `node tests/gameplay.browser.cjs` and `node tests/edges.browser.cjs`. Optional environment variables are `REALM_URL` (default `http://127.0.0.1:5251`), `PLAYWRIGHT_PATH` (installed Playwright module), and `REALM_EVIDENCE` (output directory). The default evidence folders are in the parent workspace's `.visual-review/hollowlight/` directory.

Rendering regressions: `node tests/render.browser.cjs` checks the corrected camera, fixed framebuffer, six biomes, missing-art fallback and Canvas2D mode. It uses the same browser environment variables. Cloud regressions: `node tests/cloud-sync.test.cjs` runs with a fake clock and fake server; no browser dependency or network is needed.

Both suites use isolated browser contexts, block external requests, and enable privileged fixtures only on loopback with `?test`. They never write a real cloud save. `legacy-save.json` is a disposable Warrior save captured from the original 9e80d25 app, not a user's character.

## Verified app changes

- New Hero initially focuses Warrior. Replacing an existing hero requires an explicit confirmation whose default is Keep current hero. Enter and focused-element click activate the same gameplay/menu control; Tab and menu arrows stay within visible enabled controls. First focus is scrolled into view. The code picker has reachable Submit and Cancel through D-pad alone.
- A short neural-band/keyboard swipe travels 2.3 base tiles; sustained keyboard movement consumes that burst budget, and direct touch/controller movement stops on release. Held input clears on menus, blur, touch cancellation and disconnected controllers. Player movement, Dash and Leap Slam respect a 0.22-tile footprint; movement is swept in small steps to avoid skipping walls. Legacy dungeon coordinates that fall inside a newly generated obstruction move to nearby supported ground.
- Saved dead heroes reopen the recovery screen; respawning charges the existing gold penalty once and saves the town checkpoint. Hardcore death cannot restart the dead character or recreate the deleted save. Deliberately unequipped weapons stay unequipped after reload instead of spawning duplicate starter gear.
- Full-bag bounty rewards go to the existing stash instead of being discarded. Purchase and stash-capacity checks preserve items/currency. A bounty turn-in that grants a level leaves the level-up screen intact. Frame processing stops when death, level-up or a zone transition interrupts the run.
- Delayed Starfall impacts and floating rewards follow active simulation time and are cleared on zone changes. They cannot strike while a menu is open or leak into another map. Volatile-enemy death cannot grant a post-mortem level-up revival; destroyed crystals leave the enemy list.
- Manual import validates the existing class/item shape before replacing a save, cancels pending cloud writes, timestamps the explicit replacement, and prevents old-page autosave/pagehide from overwriting it. Existing storage keys and v2 save format remain unchanged.
- `render_game_to_text()` exposes a concise read-only summary. `advanceTime(ms)` uses the same simulation path, respects menus/background pause, and bounds each call to 60 seconds. Fixture helpers are exposed only on localhost/127.0.0.1/[::1] with `?test`; the original legacy debug state hook remains compatible.

## Results and limits

- `gameplay.browser.cjs`: **34/34 passing**, covering real DOM/keyboard controls, all five class starter skills, equipment/loot/rewards/reload, bounty level-up continuation, all six biome position recovery, portals and death paths; zero JavaScript errors.
- `edges.browser.cjs`: **16/16 passing**, covering the original save fixture, actual unsupported-position reload, delayed effects, death/level-up interruptions, imports, picker navigation, 400 deterministic movement inputs, and actual touch events in a 390×844 mobile context; zero JavaScript errors.
- `render.browser.cjs`: **12/12 passing**, including equal 28px ground axes, model height, fixed 600px framebuffer at device pixel ratio 3, all biomes, and both fallback paths.
- `cloud-sync.test.cjs`: **11/11 passing**, including ordered writes, deduplication, immutable snapshots, retry/backoff, throttling, cancellation on import, UTF-8 keepalive limits, and stalled response-body timeout.
- Supplied develop-web-game client ran against the integrated app; gameplay screenshots and text state were opened and inspected. UI and rendering have separate independent reports maintained by their owners.

The existing procedural dungeon regenerates on re-entry/reload; this change makes its saved landing safe rather than introducing persistent dungeon geometry. Tests use controlled combat fixtures instead of grinding full campaigns. Physical glasses, a physical neural band and every high-level skill/endgame combination were not tested. No commit, push or deployment is part of this local review.

## Second-round systems audit

Additional commands (same isolated local server):

```text
node tests/combat-controls.browser.cjs
node tests/waypoint.browser.cjs
node tests/autoplay.browser.cjs
node tests/levels.browser.cjs
node tests/levels-flow.browser.cjs
node tests/gear-progression.browser.cjs
node tests/gear-progression.generation.cjs
```

- Combat/controls:18 checks for wall-aware attacks/interactions, swept projectiles and explosion occlusion, settled wall-scattered loot, boss engagement timers, keyboard action focus, controller press/release/disconnect, guaranteed boss hoards, challenge/campaign isolation and persistent finale rewards.
- Waypoint:120 layout/focus/progression checks across600px and390px. Campaign objectives precede advanced modes; six biome gates and seven Gauntlet bosses agree.
- Auto-Play:14 checks for full-bag behavior, auto-salvage eligibility, protected sockets, routes around close walls and legal occupancy.
- Levels:8,000 generated maps plus45 browser flow gates. See [LEVELS.md](LEVELS.md) for environment variables, deterministic generation and fixture limits.
- Gear/progression:231 browser/table checks plus46 generation gates. See [gear-progression.README.md](gear-progression.README.md) for stat, set, crafting, Journey and migration coverage. These include2,000 generated items and600 paid reforges, not hundreds of unique playthroughs.

The combat suite exposes private functions only by intercepting the loopback response in its disposable browser; production receives no extra privileged hook. All browser tests use disposable saves and block external requests. `combat-controls.browser.cjs` uses the original `REALM_*` variables. Other suites document their own variables at the top of each file.

Second-round evidence is outside the repo at `../.visual-review/spire-systems/`. Its `before/manifest.json` freezes the completed visual-overhaul files before this audit, rather than treating the old GitHub version as this round's baseline. The local review runs on5255, playable updated game on5251, and frozen second-round baseline on5254; all preview game servers disable cloud configuration.

## Movement and Back comfort pass

Run `node tests/movement-feel.browser.cjs`. This suite defaults to `http://127.0.0.1:5265`; `REALM_URL`, `REALM_EVIDENCE`, and `PLAYWRIGHT_PATH` override the server, evidence directory, and Playwright module. Like the combat suite, it exposes existing private movement/poll routines only in an intercepted loopback response and uses disposable state. It reads but never modifies `legacy-save.json`.

**39/39 passing**, with no runtime errors or external/cloud requests:

- All four single swipes cover 2.3 base tiles, equal within floating-point error at 20/30/60 simulation frames per second. The previous build covered 1.0/1.33/1.5 tiles respectively.
- Reversal and perpendicular turns replace the active burst; two opposite inputs before a frame retain the latest direction. Held keyboard movement keeps its original speed and has zero release drift. Direct controller taps are preserved without adding a long burst.
- Held keyboard, actual phone pointer release/cancel, controller disconnect, menu/resume, action/focused click, blur, background visibility and zone changes cancel movement as appropriate. Swept motion remains legal against walls, inside corners and single-tile obstacles.
- Escape, Backspace, BrowserBack/GoBack key events and an in-game Back action open the menu. Actual browser Back first pauses gameplay, closes nested inventory one level, and allows exit from the main menu. Reload/Continue and repeated Resume/Back cycles reuse one guard instead of accumulating history entries. Held Back repeats do not cross screens.
- The legacy character's class, level, gold, inventory and equipment survive save/reload. Screenshots were inspected at 600×600 and native touch 390×844.

Evidence: `../.visual-review/spire-feel/controls/baseline/` and `current/`. Open-grid and obstacle fixtures isolate movement from enemy AI and procedural generation; separate real-town captures verify rendering/UI. These browser checks do not establish physical neural-band event timing or the exact native Back mapping of every glasses host. The root integration pass also runs and inspects the supplied develop-web-game client.

## Context actions and scenery

`node tests/context-actions.browser.cjs` uses the same `REALM_URL`, `REALM_EVIDENCE` and `PLAYWRIGHT_PATH` variables. It passes 263 assertions across keyboard Enter, focused clicks and native phone taps: all five classes, mana/rune costs, cooldowns, silence, channeling, seven NPC roles, portals, shrines, locked/invalid/wall-obscured targets, stale caches and full-bag automatic loot. The highlighted name, action label, readiness and actual dispatch must agree. Separate real-time walking captures verify that leaving a character changes Talk to Cast and clears the world prompt.

`node tests/scenery.cjs` passes 27 checks covering 24 maps, unchanged world data, blocked prop footprints, target clearings, valid deterministic geometry, resource disposal and the fixed framebuffer. See [SCENERY.md](../SCENERY.md) for its `SPIRE_URL` / `SPIRE_SCENERY_EVIDENCE` options and measured before/after budgets.

The final built package passed these two suites plus movement/Back and rendering on port 5268. Browser history assertions await the actual destination instead of relying on a fixed delay, because exiting the Journal can require two asynchronous traversals. Paused-fixture exports in this headless environment intermittently omitted static HUD layers; normal real-time input captures and UI assertions were clean. The review uses cropped scenery comparisons and normal walk-away captures for its control examples. No runtime workaround was introduced for those partial fixture rasters.
