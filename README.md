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
screen (near the system tray), with pixel-art heroes auto-battling
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
    MeleeAnim.js               One-way travel to a point, then HOLDS there
                               (travelTo/updateTravel) - game.js's engage
                               state machine decides when to call it again
                               vs. just landing a hit in place
    ImpactSpark.js             Small expanding-and-fading burst at an impact
                               point - used by both melee and projectile hits
    CoinBurst.js                Small gold-coin pop-and-fall burst, fired on
                               enemy death (cosmetic only, not the gold ledger)
    Projectile.js               Ranged-attack bolt that travels attacker->target,
                               fires an arrival callback (same role as MeleeAnim's impact)
    RangedAttackAnim.js         Draw-back-then-release x-offset for Ranger/Archer -
                               onRelease is where the projectile actually launches
    HealthBar.js                Small color-graded hp bar that tracks above a sprite
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
    hero-*.png, enemy-*.png  Hero/enemy sprites (originally generated
                             placeholders - now your own art)
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

### Combat feel: engage-and-hold, the background, and coin bursts

Attacks no longer resolve instantly from a visual standpoint, and melee
combatants no longer reset position after every swing. When `CombatSystem`
decides a melee hit lands, `game.js` checks whether the attacker is already
`engaged` with that specific target (tracked via `entry.engagedTargetId`):

- **New target** (first swing, or the previous target just died and combat
  moved to the next enemy in line) - `MeleeAnim.travelTo()` sends the
  attacker to a real collision point near the target (`COLLISION_GAP` in
  `game.js`, tuned to your sprites' visual width) and it **holds there**,
  rather than snapping back to its formation slot. Duration scales with
  distance (`TRAVEL_SPEED`, floored/ceilinged) so a short gap and a long one
  both feel like the same dash speed instead of the same fixed duration.
- **Same target as last swing** - no travel at all, the hit just lands in
  place. The attacker gets a quick punch-flash (reusing `HitFlash` on itself,
  not just the target) so repeated swings still read as "hitting something"
  rather than standing still doing nothing.
- **Fight over** - heroes only return to their formation slot when there's
  genuinely nothing left to fight, i.e. a new wave spawns (`wave-spawned`
  event) and their previous target no longer exists. Enemies don't need this
  same reset - they just die wherever they're standing when their turn comes.

The damage number, hit-flash, sound, and a small impact-spark burst
(`ImpactSpark.js`) don't fire at the moment the attack was decided; they fire
from an `onImpact`/arrival callback so the feedback lines up with the actual
"contact" frame. Ranged attackers (Ranger, Archer role) skip the
travel/collision part of this entirely - they never move formation position -
but they get their own equivalent flourish, described next.

### Ranged attacker draw and recoil

Ranger and Archer don't lunge or travel anywhere - they stay at their
formation slot - so without something extra they'd just stand still while
their projectile does all the work. `RangedAttackAnim.js` gives them a
small "draw back, then release" motion instead: `startDrawAndRelease()`
pulls the sprite ~5px away from its target over ~0.12s (`DRAW_PULL`,
`DRAW_DURATION`), then sweeps it forward through neutral to a small
overshoot before settling (`RECOIL_OVERSHOOT`, `RECOIL_DURATION`). This is
a pure x-offset applied on top of whatever `updateTravel` already set that
frame - deliberately no scale change, since `HitFlash` already owns
scale-punch and the two would fight over the same property if both fired
in the same frame.

The shot itself is wired to the *release*, not the original attack
decision: `onRelease` is where `game.js` actually calls `projectiles.spawn()`,
so the arrow/bolt visually leaves right as the bow snaps forward instead of
popping into existence the instant the attack resolves. That introduces a
small new edge case worth knowing about - since there's now a ~0.12s gap
between "attack decided" and "arrow launched," the target could die in that
window (from a different hero attacking it) before the shot even fires. The
ranger's release callback guards against this the same way the impact
callback already did (`enemyEntries.includes(targetEntry)`); the archer
doesn't need the equivalent check since its target is a hero, which is
never destroyed - and if the archer itself dies mid-draw, the ticker's
existing death-fade branch simply stops calling `updateRangedAnim` for it,
so `onRelease` never fires and the shot silently never happens, no crash.

Enemy deaths also pop a small 3-coin gold burst (`CoinBurst.js`) that arcs
outward and fades - purely cosmetic feedback tied to the `enemy-killed`
event, separate from the actual gold ledger (which is credited once per
wave-clear, not per kill - see `ProgressionSystem`).

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

### Projectiles and health bars

Not every attack should look the same - a Ranger swinging a melee lunge
looked wrong given the sprite is holding a bow. `onGameEvent`'s attack
handlers now branch: if the attacking hero's `classId === 'ranger'` or the
attacking enemy's `role === 'archer'`, it calls `projectiles.spawn()` instead
of `startLunge()`. `ProjectileManager` is deliberately simpler than
`MeleeAnim` - it's a straight-line travel from attacker to target with a
single arrival callback, no impact-fraction envelope needed since the whole
animation *is* the travel. It's also safer by construction: it copies the
attacker's position once at spawn time rather than holding a live reference
to their sprite, so an attacker dying mid-flight can't leave a dangling
reference the way a lunge target could (see the note above about that bug) -
only the *target* side still needs the `enemyEntries.includes(...)` guard.

**Health bars** (`HealthBar.js`) are a small standalone display object per
hero/enemy entry - a dark track plus a color-graded fill that lerps
green→yellow→red as hp drops. Each entry owns one and is responsible for its
lifecycle: heroes create theirs once in `addHeroEntry` (heroes are never
removed), enemies create theirs in the `wave-spawned` handler and destroy it
wherever the sprite itself gets destroyed (death-fade completion, and the
defensive wave-transition cleanup). The bar tracks `entry.sprite.x` every
frame, so it follows lunges and enemy spawn slide-ins automatically without
any special-casing - it just reads wherever the sprite currently is. One
deliberate clamp: a boss's scaled-up sprite can visually poke above the
strip's own 48px height, so the bar's y-position is clamped to never go
above y=1, keeping it visible even when its sprite doesn't fully fit.

### Hero formation lines

Enemies already had a front-to-back formation (tank/brawler/archer); heroes
didn't - every enemy just picked a random living hero to attack, so a
fragile ranger could get focused down before the knight took a single hit.
`Hero.formationLine` (`'front'` or `'back'`, set per class in
`heroClasses.js`) fixes that symmetrically: Knight is `'front'`, Ranger and
Priest are `'back'`. In `CombatSystem`, an attacking enemy always picks a
random *living front-line* hero if one exists, and only falls back to the
back line once every front-line hero is dead - re-evaluated per enemy turn
(not cached once per tick) for the same reason the enemy-targeting lookup
is: if an earlier enemy this same tick just killed the last front-line hero,
the next enemy should immediately see the back line as fair game.

On the rendering side, `addHeroEntry` positions a hero using an index
*within its own formation group*, not the party as a whole - front-line
heroes lay out from `FRONT_BASE_X` (130, closer to the enemies), back-line
heroes stay at `BACK_BASE_X` (20, the strip's original left edge). Recruiting
a new hero just needs `heroSprites.filter(sameFormationLine).length` for its
slot index, so existing heroes never need to be repositioned when the party
grows - each formation group is independently indexed.

## Next steps to build this out further

Full checklist lives in `ROADMAP.md`. With waves, formations (on both the
enemy and hero side), recruiting, projectiles, health bars, real melee
collision, engage-and-hold, and ranged draw/recoil all working, reasonable
next moves: boss unique mechanics (right now they're just a bigger reskin -
the background's tension-building tint doesn't pay off with anything
mechanically different yet), a 4th hero class (there's nothing left to
recruit after Ranger + Priest, and the front line only has one melee
option), or real arrow/bolt sprites for projectiles instead of colored dots.

## Known rough edges (intentional, for a prototype)

- Boss enemies are currently a reskin (bigger + red tint, boss stat role) of
  the normal enemy - not a mechanically distinct fight with unique attacks.
- All enemy roles (tank/brawler/archer) currently share the same sprite -
  only stats differ. Distinct art per role would help readability a lot.
- Only two heroes are recruitable (Ranger, Priest) before you run out of
  classes - a 4th class would give the recruit UI more room to matter, and
  give the front line a second melee option.
- Projectiles are a plain colored dot, not an actual arrow/bolt sprite or
  rotated-to-face-direction graphic - fine as a placeholder, would benefit
  from real art like everything else.
- `COLLISION_GAP` (16px) in `game.js` was tuned by eye against your current
  sprite sizes - if you swap in noticeably bigger or smaller art, this is
  the one constant to revisit so attacks still look like they connect.
- Engaged enemies don't have their own "give up and return to formation"
  reset the way heroes do - they just die wherever they're standing, which
  reads fine in practice, but if you ever add non-death ways for an enemy
  to lose its target this'll need the same disengage treatment heroes get.
- No mute/volume UI yet — `SoundManager` supports `setMuted()`/`setVolume()`
  but nothing in the UI calls them. Worth adding once you build the settings
  panel (Phase 5).
- Inventory window polls every 2s rather than getting push updates on every
  combat tick — fine for now, but worth revisiting if it feels laggy.
- Tray creation is wrapped in a try/catch since some Linux desktop
  environments have no system tray host - it'll log a warning and keep
  running rather than crash, but you won't see a tray icon there. The bag
  icon on the strip still works as a fallback.
