# HollowLight

Action RPG for Meta Ray-Ban Display glasses. 600×600 dark additive display, 4-way D-pad + single-pinch input.

## Run locally

```
python -m http.server 5187 --directory .
# then open http://localhost:5187
```

Swipe or briefly press an arrow to travel about 2.3 tiles at base speed. Hold a direction to keep moving; turn to redirect immediately. The phone D-pad and gamepad move while held and stop on release. Walls still stop movement, and tapping an action stops a swipe burst.

Enter is the pinch: **Cast** uses your active skill, **Talk** opens the highlighted character, **Enter** uses an unlocked portal, and **Use** activates a shrine. The action label and HUD show the current target, cooldown, and mana availability. Ordinary attacks and nearby loot collection remain automatic.

Escape, Backspace, or the browser's Back action opens the in-game Journal/menu. Resume is selected first. From the menu, use **Save & Quit** to return to the title, or the browser's Back action again to leave the app. Nested screens return through the menu before leaving.

Combo gestures (deliberate multi-tap patterns):

- `↑↓↑↓` — open menu (inventory, skills, quests)
- `←→←→` — drink a health potion
- `↑↑↑` — dash forward (1.5s cooldown)

Each dungeon biome has deterministic scenery and floor motifs, using the existing lightweight art kit. Tall decorations sit on blocked tiles; walkable paths and interaction targets remain clear. See [SCENERY.md](SCENERY.md) for rendering budgets and validation.

## Deploy to Render

1. Push this folder to a git repo (GitHub/GitLab).
2. In the Render dashboard → **New +** → **Static Site**.
3. Connect the repo and pick this directory as the root.
4. Settings:
   - **Build command:** `node scripts/build-static.cjs`
   - **Publish directory:** `dist`
5. Click **Create Static Site**. Done in ~30s — you get a URL like `https://hollowlight.onrender.com`.

The bundled `render.yaml` lets Render auto-detect these settings if you use Infrastructure as Code.

The existing production site is `https://glasspire.onrender.com`. The build publishes only the game runtime and assets, adds content-versioned asset URLs, and writes a public `release.json` manifest for deployment verification. Tests, editable Blender sources and local development files are excluded. Keep the configured `Cache-Control: public, max-age=0, must-revalidate` header when updating the service. Existing save keys and personal sync-link parameters are retained.

## Add to the glasses

1. Open the **Meta AI** app on your phone.
2. **Devices → Display Glasses → App connections → Web apps → Add a web app**.
3. Name: `HollowLight`. URL: the Render URL from above.

Or generate a QR code from the URL and scan it on your phone to deep-link the install.

## Classes

| Class    | Auto-attack             | Active skill (pinch) |
|----------|-------------------------|----------------------|
| Warrior  | Cleave melee            | Whirlwind            |
| Mage     | Auto-cast arcane bolts  | Frost Nova           |
| Ranger   | Auto-fire arrows        | Multishot            |
| Summoner | Bone wand at range      | Raise Dead           |

## Biomes

Unlock in order by beating each boss:

1. **The Crypts** — skeletons, ghouls, wraiths · boss: Lich Lord
2. **Overgrown Ruins** — spiders, thornlings, wisps · boss: Old Druid
3. **Frozen Peaks** — frostwolves, frost giants, ice bats · boss: Ice Wyrm
4. **Infernal Depths** — imps, hellhounds, demons · boss: Archdemon
5. **The Tempest Reach** — storm creatures · boss: Storm Sovereign
6. **The Void Spire** — voidlings, nullweavers, crystal sentinels · boss: Void Lord

## Debug

A small hook is exposed for inspection from the browser console:

```js
__hollowlight.game            // live game state
__hollowlight.enterBiome('crypts', 1)
__hollowlight.enterTown()
```
