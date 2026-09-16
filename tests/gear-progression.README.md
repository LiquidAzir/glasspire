# Gear and progression verification

Run against the safe local server (default `http://127.0.0.1:5251`):

```text
node tests/gear-progression.browser.cjs
node tests/gear-progression.generation.cjs
```

Environment: `PLAYWRIGHT_PATH`, `REALM_URL`, `REALM_EVIDENCE`. Defaults use the installed develop-web-game Playwright and write evidence outside the repository to `.visual-review/spire-systems/progression/`.

Both suites use a fresh isolated browser context, block external/cloud requests, and select SwiftShader explicitly. The helper exposes private functions only by intercepting the local `app.js` response in that disposable context. It never adds privileged production APIs or modifies source. Late-game states and gear are labelled fixtures; this is not a full campaign playthrough or physical glasses verification.

Final results: **231 browser/table checks + 46 generation gates**, zero browser errors and zero external/cloud requests. The table checks cover every gear base, all five classes, stat-source equivalence and all ten attainable sets. The UI checks cover actual item comparison/equip/Continue, salvage, point spending, talent prerequisite/reset, passive unlock, rewards and persistence. The generation gates cover **2,000 seeded generated items and 600 paid reroll/Keep Best transactions**, including the previously failing seed49 and 200 Primal transactions. These counts include repeated table/property cases, not 277 unique player journeys.

Fixed in the bounded progression audit:

- All base gear attributes apply and appear on the item card (69 bases previously lost one or more bonuses).
- Allocated, gear, talent and Paragon Intellect/Vitality now share the same resource formulas. Naked hero stats are unchanged for all five classes.
- Glass Cannon damage is included before character DPS and item comparisons.
- Failed salvage cannot extract a free aspect; successful salvage atomically restores gems and learns the aspect.
- Paid rerolls and Keep Best retain their affix count; Primal rolls retain perfected values. Exclusion pools keep keys unique without retry exhaustion.
- Weapon cards clarify that class determines attack style; equipping a bow does not change a Warrior into a ranged class.
- Full-bag Journey gear goes to the persistent stash. Repeat claims cannot duplicate gear/currency.
- The Paragon5 milestone is in the final Journey chapter; every-biome goals count all six actual biome IDs, excluding the Hollow King.
- Existing saves that already cleared Infernal or unlocked Voidspire cannot remain stranded with Tempest locked. Fresh saves remain locked as intended.

Evidence: `gear-progression.json`, `gear-generation.json`, `item-stats-fixed.png`, `journey-reward-fixed.png`. `initial-audit.json` and `rewards-audit.json` retain observed failures before their fixes. The `*.audit.cjs` files are exploratory diagnostic scripts, not release gates. The supplied develop-web-game client was rerun after the final edits, and its `client/shot-0.png` and `client/state-0.json` were opened and inspected. Syntax and `git diff --check` passed.

No commits, pushes or deployment. Parent owns campaign boss credit, finale loot transfer, Abyss reward guards and ordinary combat; level agent owns generation/navigation and special-mode flows. Those integration checks are tracked separately.
