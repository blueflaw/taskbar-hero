# Taskbar Hero Clone — Starter Scaffold

A minimal Electron + PixiJS skeleton for a taskbar-docked idle RPG, in the
spirit of *TBH: Task Bar Hero*. This is a working prototype, not a finished
game — it's meant to give you a clean starting architecture to build on.

See `ROADMAP.md` for the full development checklist and future plans.

## Run it

```bash
npm install
npm start
```

You should see a small strip window dock itself to the bottom-right of your
screen (near the system tray), with placeholder pixel-art heroes auto-battling
an enemy, plus a new icon in your system tray. It's click-through by default
so it won't get in your way, and becomes clickable when your mouse hovers
over it. Click the small bag icon (top-left of the strip) or use the tray
icon's "Open Inventory" to open the inventory popup. Right-click the tray
icon for the full menu; left-click it to quickly show/hide the strip.

## Architecture

```
main.js                Electron main process: window creation, taskbar docking,
                        always-on-top, save/load via disk (fs), IPC relay
                        between the game window and inventory popup, and the
                        system tray icon + its context menu
preload.js              contextBridge - safe API surface for the game window
preload-inventory.js    contextBridge - safe API surface for the inventory popup

assets/
  tray-icon-16.png, tray-icon-32.png   System tray emblem (separate from
                                        in-game sprites, which live under src/assets/)

src/
  index.html / game.js   PixiJS app bootstrap + render loop + bag-icon click handler
  style.css               Transparent background so only sprites are visible

  inventory.html / inventory.js / inventory.css
                          Framed popup window: party equipment slots, a
                          Recruit section to spend gold on new heroes, and
                          the item grid - click an item then a matching
                          slot to equip

  fx/
    FloatingTextManager.js   Damage/heal number pool - spawns, animates, cleans up
    HitFlash.js               Brief tint + scale punch on a sprite that took damage
    SoundManager.js           Preloads and plays short one-shot SFX clips
    MeleeAnim.js               Lunge-toward-target-and-back animation, fires an
                               impact callback (damage/flash/sound) at the hit frame
    Background.js              Scrolling parallax hills + ground ticks, boss-proximity
                               tint, and a speed-burst pulse on stage transitions

  entities/
    Hero.js              Stats, leveling, equipment, combat actions
    Enemy.js              Scales with "stage" number and an optional formation role

  systems/
    CombatSystem.js       Resolves one tick of auto-battle across a party and a
                           WAVE (array) of enemies - heroes always target the
                           front-most living enemy; returns events
    WaveSystem.js           Builds a formation-ordered wave for a given stage
                           (tank/brawler/archer roles, boss = solo)
    LootSystem.js          Rolls chests using the loot table
    ProgressionSystem.js  Advances stages, offline-time catch-up, forwards
                           combat/level-up/loot-drop/wave-spawned events to
                           an optional onEvent callback. Exports BOSS_INTERVAL.

  state/
    GameState.js           Single source of truth - party/gold/inventory/stage/
                           enemies (the current wave)
    SaveManager.js          Load/save + offline-progress simulation on launch

  config/
    heroClasses.js          Data-driven class stats + recruitCost (add classes
                           here, no code changes). Exports MAX_PARTY_SIZE.
    lootTables.js           Rarity weights and item generation
    enemyRoles.js           Tank/Brawler/Archer stat multipliers + the boss role
    waveConfig.js            BOSS_INTERVAL and wave-size-per-stage scaling

  assets/
    hero-*.png, enemy-*.png  Placeholder sprites - swap with your own art
    sfx/*.wav                 Synthesized placeholder SFX - swap with real sound design
```

The core idea: **systems are stateless functions that operate on GameState**.
This keeps combat/loot/progression logic testable and easy to reason about
separately from rendering, which lives entirely in `game.js`.

### How the inventory popup talks to the game

The game window and inventory window are separate Electron renderer
processes — they can't touch each other's JS objects directly. Instead:

1. Inventory window asks the main process for data (`request-inventory-sync`)
2. Main process relays that ask to the game window
3. Game window serializes the live `GameState` into a plain object and sends
   it back through main
4. Main process relays it to the inventory window, which renders it

Equipping an item follows the same relay pattern in reverse — the inventory
window never mutates state directly, it just asks the game window to do it.
This keeps `GameState` single-owned, which avoids sync bugs down the line.

### Combat feel: lunge animations and the background

Attacks no longer resolve instantly from a visual standpoint. When
`CombatSystem` decides a hit lands, `game.js` starts a **lunge** (see
`MeleeAnim.js`) - the attacker dashes partway toward its target and back over
~0.3s. The damage number, hit-flash, and sound don't fire at the moment the
attack was decided; they fire from an `onImpact` callback that `MeleeAnim`
invokes right as the lunge reaches its peak, so the feedback lines up with
the "contact" frame instead of popping instantly.

The **background** (`Background.js`) is a two-layer parallax scroll - distant
hill silhouettes and near ground ticks - deliberately kept low-alpha so the
window's original transparency (blending with the desktop) still comes
through. It scrolls continuously at a baseline speed, gets a brief speed
burst on every wave transition (`wave-spawned` event), and its tint drifts
from purple toward red as the stage number approaches a multiple of
`BOSS_INTERVAL` (10) - building tension toward each boss fight. When a new
wave spawns, each enemy slides in from off-screen right (staggered slightly
per slot) rather than popping into place; boss-stage enemies are additionally
bigger and permanently red-tinted.

### Multi-enemy waves and formation targeting

`GameState.enemies` holds the current **wave** - an array, not a single
enemy. `WaveSystem.spawnWave(stage)` decides how many enemies (see
`waveSizeForStage` in `config/waveConfig.js` - ramps from 1 up to
`MAX_WAVE_SIZE`) and assigns each a role from `config/enemyRoles.js`,
front-to-back: **Tank** (high HP/DEF, low ATK) → **Brawler** (balanced) →
**Archer** (glass cannon), cycling if the wave is bigger than three. Boss
stages always override this to a single boss-role enemy.

`CombatSystem` enforces the formation: heroes always attack
`enemies.find(e => e.isAlive())` - the front-most living enemy - so the tank
has to die before the brawler takes damage, and the archer is safe until
both are cleared. This is re-evaluated *per hero, per tick* rather than
cached once, so if one hero kills the front enemy, the next hero acting the
same tick correctly targets whichever enemy is now at the front instead of
wasting a hit on a corpse. Enemies themselves aren't formation-locked - each
one independently picks a random living hero to attack.

On the rendering side, `game.js` keeps a dynamic `enemyEntries` array instead
of a single enemy object. Each entry tracks its own lunge/hit-flash/spawn-in/
death-fade state independently, and `enemySlotX()` lays them out with the
front slot closest to the heroes and the back slot at the strip's right edge
(mirroring where the original single enemy used to rest). One bug worth
knowing about since it's a real trap for this kind of code: if a hero's lunge
targets the last enemy in a wave and that hit clears the wave, a new wave can
spawn (destroying all the old sprites) *before* the lunge's impact callback
fires a few frames later - so every impact callback checks
`enemyEntries.includes(targetEntry)` before touching the sprite, in case it
was already cleaned up out from under it.

**Multiple heroes** needed almost no new architecture -
`GameState.addHero(classId)` and the hero-rendering/combat/lunge code already
operated on `gameState.party` generically. What was missing was a way to
actually *trigger* it in-game, which is now the inventory popup's **Recruit**
section: it lists any class not already in the party (`recruitCost > 0` in
`heroClasses.js`, so the starting knight is excluded) with its gold cost, and
a disabled button if you can't afford it. Recruiting follows the exact same
window-relay pattern as equipping an item - the inventory window never
touches `gold` or `party` directly, it sends a `recruit-hero` request through
main to the game window, which owns `GameState` and does the affordability +
`MAX_PARTY_SIZE` checks before calling `addHero()` and pushing a new sprite
entry onto `heroSprites`. Party size is capped at `MAX_PARTY_SIZE` (4) so the
formation doesn't outgrow the strip's ~360px width even alongside a max-size
enemy wave.

## Next steps to build this out further

Full checklist lives in `ROADMAP.md`. With waves, formations, multiple
heroes, and recruiting all working, reasonable next moves: giving enemy
roles distinct sprites instead of the same reskinned slime, a 4th hero class
(there's nothing left to recruit after Ranger + Priest), or Phase 2 (swap in
your own art).

## Known rough edges (intentional, for a prototype)

- Boss enemies are currently a reskin (bigger + red tint, boss stat role) of
  the normal enemy - not a mechanically distinct fight with unique attacks.
- All enemy roles (tank/brawler/archer) currently share the same sprite -
  only stats differ. Distinct art per role would help readability a lot.
- Only two heroes are recruitable (Ranger, Priest) before you run out of
  classes - a 4th class would give the recruit UI more room to matter.
- No mute/volume UI yet — `SoundManager` supports `setMuted()`/`setVolume()`
  but nothing in the UI calls them. Worth adding once you build the settings
  panel (Phase 5).
- Inventory window polls every 2s rather than getting push updates on every
  combat tick — fine for now, but worth revisiting if it feels laggy.
- Tray creation is wrapped in a try/catch since some Linux desktop
  environments have no system tray host - it'll log a warning and keep
  running rather than crash, but you won't see a tray icon there. The bag
  icon on the strip still works as a fallback.
