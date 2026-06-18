# HollowLight

Action RPG for Meta Ray-Ban Display glasses. 600×600 dark additive display, 4-way D-pad + single-pinch input.

## Run locally

```
python -m http.server 5187 --directory .
# then open http://localhost:5187
```

Arrow keys move, Enter is the pinch, Escape opens the in-game menu.

Combo gestures (deliberate multi-tap patterns):

- `↑↓↑↓` — open menu (inventory, skills, quests)
- `←→←→` — drink a health potion
- `↑↑↑` — dash forward (2s cooldown)

## Deploy to Render

1. Push this folder to a git repo (GitHub/GitLab).
2. In the Render dashboard → **New +** → **Static Site**.
3. Connect the repo and pick this directory as the root.
4. Settings:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`
5. Click **Create Static Site**. Done in ~30s — you get a URL like `https://hollowlight.onrender.com`.

The bundled `render.yaml` lets Render auto-detect these settings if you use Infrastructure as Code.

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
5. **The Void Spire** — voidlings, nullweavers, crystal sentinels · boss: Void Lord

## Debug

A small hook is exposed for inspection from the browser console:

```js
__hollowlight.game            // live game state
__hollowlight.enterBiome('crypts', 1)
__hollowlight.enterTown()
```
