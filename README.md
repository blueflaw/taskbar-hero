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
                               (includes boss-enrage.wav, boss-heavy-hit.wav)
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
    WalkCycle.js                 Marching-in-place animation (leg-swap frames + bob),
                               played on wave transitions - doesn't move the sprite
    Background.js              Scrolling parallax hills + a proper floor layer,
                               boss-proximity tint, and a speed-burst pulse on
                               stage transitions

  entities/
    Hero.js              Stats, leveling, equipment, combat actions
    Enemy.js              Scales with "stage" number and an optional formation
                           role. Bosses also track attacksLanded (for the
                           heavy-attack rotation) and enraged state.

  systems/
    CombatSystem.js       Resolves one tick of auto-battle across a party and a
                           WAVE (array) of enemies - heroes always target the
                           front-most living enemy; enemies prioritize
                           front-line heroes; handles boss enrage/heavy-attack
                           checks; returns events
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
    heroClasses.js          Full per-class stat block (hp/atk/armor/attackSpeed/
                           crit/CDR/moveSpeed/castSpeed) + recruitCost - THE
                           place to tune a hero or add a new class, no code
                           changes needed elsewhere. Exports MAX_PARTY_SIZE.
    lootTables.js           10-tier rarity ladder (Common..Cosmic) + item
                           generation - weapon-slot drops pull from
                           weaponTypes.js, armor/trinket stay generic
    weaponTypes.js           THE FILE for adding named weapons (per class).
                           Currently: `sword`, Knight-only, 20 names. Add a
                           new entry (bow for Ranger, staff for Priest, ...)
                           and lootTables.js picks it up automatically.
    enemyRoles.js           Tank/Brawler/Archer/Boss - same stat shape as
                           heroClasses.js but as multipliers on Enemy's
                           stage-scaled base stats. THE place to tune a
                           monster or add a new role.
    waveConfig.js            BOSS_INTERVAL and wave-size-per-stage scaling
    bossMechanics.js         Enrage threshold/multipliers, heavy-attack
                           interval/multiplier - boss-only tuning

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

### Boss mechanics: enrage and heavy attacks

Until this feature, a boss was purely a stat reskin - bigger numbers on the
same behavior as any other enemy. Two mechanics (`config/bossMechanics.js`)
make a boss fight actually feel different, both gated on `role === 'boss'`
so nothing here ever touches a normal enemy:

**Enrage.** `Enemy.checkEnrage()` is called after a boss takes damage - once
its hp drops to/below `ENRAGE_HP_FRACTION` (50%), it permanently gets faster
attacks (`attackCooldown *= ENRAGE_COOLDOWN_MULT`) and hits harder
(`atk *= ENRAGE_ATK_MULT`). This is a one-time trigger (`this.enraged` guards
against re-firing), and `CombatSystem` emits an `enemy-enraged` event the
instant it happens. `game.js` reacts with a floating "ENRAGED!", a dedicated
sound, a permanent shift to a deeper red `baseTint` (which `HitFlash` then
correctly blends its own flash color from/back to - see the `HitFlash`
section above), and a `background.pulse()` for extra emphasis. One subtlety:
`_cooldownTimer` (the countdown already in progress) isn't rescaled when
`attackCooldown` shrinks, so the speed-up takes full effect starting the
*next* attack cycle rather than instantly mid-countdown - imperceptible in
practice, not worth the extra bookkeeping to fix.

**Heavy attack.** `Enemy.isHeavyAttack()` checks an attack counter
(`attacksLanded`, incremented every time `tick()` fires) against
`HEAVY_ATTACK_INTERVAL` - every 3rd swing lands as a heavy hit, dealing
`HEAVY_ATTACK_MULT` (2x) damage. This is attack-count-based, not a timer, so
it stays in sync with the boss's own attack rate even after it enrages and
starts swinging faster. On the rendering side, a heavy attack gets a
telegraph when the boss is already standing at its target (the common case,
since most swings after the first don't need to travel): it reuses
`travelTo` from the melee-collision work to step back a short distance
(`HEAVY_WINDUP_PULLBACK`), then slam back in for the hit - rather than
inventing a new animation primitive, the "engage and hold" travel system
turned out to be exactly what a wind-up/release telegraph needed too. The
impact itself gets a bigger, differently-colored damage number, an extra
white impact spark layered on top of the normal one, and its own sound.

Both mechanics were verified with a fast, deterministic logic-only test
(no rendering) that confirmed exact numbers - enrage firing exactly once
with `atk`/`cooldown` multiplied precisely as configured, and heavy attacks
landing on schedule with the expected damage ratio - before checking the
rendered result in the actual app.

### Floor and the "walking to the next fight" animation

The background's ground layer used to be sparse 3px tick marks - readable as
motion, but not really a *floor*. `Background._buildFloorLayer()` replaces
that with an actual textured band: a base fill, a lighter top-edge highlight,
and a couple of small darker texture flecks, all baked as real distinct
colors in the same tile (unlike the hill layer, which uses a single runtime
`.tint` since it only ever needs one color at a time). Still alpha 0.55, so
the desktop still blends through underneath the strip - solid-*reading*
ground, not a solid-*colored* one.

For the walking animation, the constraint that shaped the design: hero
formation position (`baseX`/`restX`) is load-bearing for combat - targeting,
collision points, engage/disengage all depend on it - so heroes can't
actually walk across the strip between waves without breaking those systems.
Instead, `WalkCycle.js`'s `startMarching()` plays a **treadmill effect**:
on every `wave-spawned` event, living heroes alternate between two walk
textures with a small vertical bob for `MARCH_DURATION` (0.5s, matched to
how long `Background`'s post-wave speed burst takes to decay back to
baseline) - the world visibly speeds up underneath a stationary-but-walking
party, which reads as travel without moving anyone's x position at all.
`updateMarching()` is a no-op if a class has no walk textures registered
(`WALK_SPRITE_PATHS` in `game.js`), so an animation-less class just doesn't
visibly march rather than throwing - useful if you add a class before
getting around to its walk frames.

Since your hero sprites are your own custom art now and I don't have
matching walk frames for them, the actual walk textures
(`hero-{class}-walk1.png` / `-walk2.png`) are **temporary placeholders** -
generated in the original simple chibi style (same approach as the very
first placeholder sprites), not yours. They're separate files from your real
idle sprites, so nothing of yours was touched or overwritten; swap them for
real walk-cycle art matching your style whenever you get to it, same
filenames and the animation keeps working unchanged.

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

### Editing stats - hero and monster, one schema for both

Heroes and monsters share the same *shape* of stat block, just expressed
differently: a hero's stats are flat numbers that scale with level
(`config/heroClasses.js`), a monster's are multipliers on `Enemy`'s
stage-scaled base stats (`config/enemyRoles.js`). Nothing outside these two
files needs to change for a stat tweak or a brand new class/role - both
files have a full field-by-field comment block at the top explaining what
each stat does and which one to touch.

| Stat | Hero field | Monster field | Where it lives / how it works |
|---|---|---|---|
| Level | `hero.level` | `enemy.stage` (closest equivalent - monsters don't level, they scale with stage) | `Hero.gainXp()` levels up; `Enemy` stats are computed once at spawn from `stage` |
| Exp | `hero.xp` | n/a | `xpToNextLevel()` in `heroClasses.js` sets the curve |
| Attack Damage | `hero.atk` (getter, scales with level + equipment) | `enemy.atk` (set at spawn from stage × role's `atkMult`) | `baseAtk` in `heroClasses.js` / `atkMult` in `enemyRoles.js` |
| Basic Attack DPS | `hero.dps` (computed getter) | not exposed (not needed - CombatSystem resolves actual hits directly) | `atk × effectiveAttackSpeed × crit factor` - see `Hero.js` |
| Current HP | `hero.hp` / `hero.maxHp` | `enemy.hp` / `enemy.maxHp` | `baseHp` in `heroClasses.js` / `hpMult` in `enemyRoles.js` |
| Attack Speed | `hero.attackSpeed` (attacks/sec, before CDR) | `enemy.attackCooldown` (seconds/attack, inverse framing) | Set per class/role directly |
| Critical Chance / Critical Damage | `hero.critChance` / `hero.critDamageMult` | `enemy.critChance` / `enemy.critDamageMult` | Rolled per-hit in `CombatSystem`; both sides can crit now |
| Cooldown Reduction | `hero.cooldownReduction` (0..1) | not currently on monsters (bosses get their own speed-up via enrage instead) | Shrinks `1 / effectiveAttackSpeed` in `Hero.tick()` |
| Move Speed | `hero.moveSpeed` (multiplier) | `enemy.moveSpeed` (from role's `moveSpeedMult`) | Passed into `MeleeAnim.travelTo()`'s `speedMultiplier` param - scales how fast lunge/engage animations play, not combat math |
| Armor | `hero.armor` (getter, scales with level) | `enemy.armor` | Flat damage reduction: `takeDamage()` does `max(1, rawDamage - armor)`. Renamed from the old internal `def` to match this stat list. |
| Cast Speed | `hero.castSpeed` | not on monsters | **Stored but not wired to anything yet** - there's no ability/cast system distinct from basic attacks. Priest's heal currently reuses `attackSpeed`/`cooldownReduction` like any other attack. This is a placeholder for when a proper ability system exists. |

A few implementation notes worth knowing if you're tuning numbers:
- Crit and heavy-attack (`bossMechanics.js`) visuals now **stack** - a hit
  can be both heavy and crit, and the floating text/impact spark reflect both.
- `moveSpeed` only affects animation timing (how fast a lunge/engage plays
  out), never actual combat resolution timing - a "fast" unit doesn't attack
  more often for having high `moveSpeed`, that's what `attackSpeed`/
  `cooldownReduction` are for.
- All of this was verified with a deterministic logic-only test before
  checking the rendered result - confirmed the DPS formula, the
  cooldown-reduction math, and the crit damage ratio all matched their
  configured values exactly, not just "looked about right."

### Floor and character positioning - where to edit

- **Floor appearance** (color, texture, height): `Background._buildFloorLayer()`
  in `src/fx/Background.js`. `tileH` controls the floor's height in pixels;
  the three `beginFill()` calls control its baked colors (base fill,
  top-edge highlight, texture flecks) - these are the *neutral* colors,
  before any per-stage tint is applied (see below); `layer.alpha` controls
  how much the desktop shows through underneath it.
- **Where the floor sits vertically** (and therefore where characters'
  feet land): `groundY` in `game.js` (`app.screen.height - 2`) - this is
  the single source of truth for "the ground," used by hero/enemy sprite
  positioning, the floor layer, and health bar placement alike.

### Per-stage floor theme

The floor's color now changes in two ways at once, both driven by
`Background.setStage(stage)` - called from `game.js`'s `wave-spawned`
handler every time the stage changes:

- **A different base tone every boss cycle.** `FLOOR_TIER_PALETTE` in
  `Background.js` is an array of tint colors, one per 10-stage stretch
  (`tier = Math.floor(stage / BOSS_INTERVAL)`) - neutral dirt → mossy →
  sandy → icy → volcanic, then wrapping back to neutral once you run out of
  palette entries. **This is the array to edit** to add more tiers, change
  the colors, or reorder the progression.
- **The same tension-building blend toward red that the hill layer already
  had**, layered on top of that tier's base tone as the stage approaches
  the next boss (`(stage % BOSS_INTERVAL) / BOSS_INTERVAL`) - so within any
  given tier, the floor still visibly warns you a boss is close, it just
  warns from a different starting color depending on which stretch of the
  run you're in.

Both effects are runtime `.tint` multiplication against the floor's baked
texture (not separate textures per tier - one texture, recolored), so
adding a tier is a one-line addition to the palette array, no new art or
texture-generation code needed. Verified with an exact math check before
touching the renderer - at several test stages, the actual tint value
`Background` applied matched hand-calculated predictions byte-for-byte,
including the palette wrapping back to tier 0 correctly past its end.

### Equipment: named weapons, rarity, and class restrictions

Items used to be generic - "Common weapon", one flat `statBonus` number,
equippable by anyone. Three files now work together to make them feel like
real gear:

**`config/weaponTypes.js` is the file to add named weapons in.** A weapon
*type* (e.g. `sword`) has a pool of names (one is picked at random whenever
that type drops - the name is cosmetic variety, not a separate power
level), an `allowedClasses` restriction, and `baseStats` that get scaled by
whatever rarity actually drops. Right now there's one fully-built type -
`sword`, Knight-only, your 20 requested names - plus commented-out stub
blocks for a Ranger `bow` and Priest `staff` ready to fill in whenever you
have names picked out. Adding a type needs zero changes anywhere else -
`lootTables.js` reads `WEAPON_TYPES` automatically and only rolls from
types that currently have at least one name.

**`config/lootTables.js`** has the rarity ladder - expanded from 5 tiers to
your requested 10 (Common → Uncommon → Rare → Legendary → Immortal →
Arcana → Beyond → Celestial → Divine → Cosmic), each with a drop `weight`
and a `statMult` that scales an item's stats. `generateLoot()` branches by
slot: a `weapon` roll picks a random type from `weaponTypes.js` and a
random name from that type, then scales `baseStats` by the rolled rarity
(and a small bonus for how deep into the run you are - `dropLevel`).
`armor`/`trinket` slots stay on the older generic system for now (universal,
single-stat) since only weapons were asked to be class-restricted.

**Items now carry a `stats: { ... }` object**, not one generic number - a
sword grants both `atk` and `attackSpeed` at once, for example. On the hero
side, `Hero._equipmentBonus(statKey)` sums that key across every equipped
item, and every stat getter (`atk`, `armor`, `attackSpeed`, `critChance`,
...) calls it - so *any* stat key an item happens to grant works
automatically with no extra wiring per stat. A future Ranger bow that
grants `critChance`, for instance, needs nothing beyond adding it to
`weaponTypes.js`.

**Class restriction is enforced twice.** `Hero.canEquip(item)` checks
`item.allowedClasses` against the hero's `classId` - `Hero.equip()` uses it
internally and returns `false` if rejected, and the inventory UI
(`inventory.js`) uses the same check to show a slot as green
"equippable" or red "wrong-class" *before* you even click it. While wiring
the equip flow through to this check I caught a real bug worth knowing
about: the equip handler in `game.js` used to remove the item from
`gameState.inventory` *before* calling `hero.equip()` - if equip failed
(wrong class), the item had already been spliced out and would have just
been deleted. Fixed by checking `canEquip()` first and only removing the
item from inventory once we know the equip will actually succeed.

All of this was verified with a deterministic logic test (5000 simulated
rolls confirmed the rarity distribution matches configured weights; a
forced equip attempt confirmed a knight can equip a sword and gains exactly
the stated bonuses, a ranger's attempt is rejected and the item stays
`null` on their equipment slot) before checking the rendered inventory
window, where the class-restriction badge and wrong-class slot styling both
showed up correctly.

## Next steps to build this out further

Full checklist lives in `ROADMAP.md`. With waves, formations (on both the
enemy and hero side), recruiting, projectiles, health bars, real melee
collision, engage-and-hold, ranged draw/recoil, boss enrage/heavy-attack
mechanics, a proper floor with a per-stage theme, the wave-transition walk
animation, a full hero/monster stat system, and named/rarity/class-restricted
equipment all working, reasonable next moves: Ranger and Priest weapon
types (the files are ready, just need names), a 4th hero class, real
arrow/bolt sprites for projectiles instead of colored dots, or a guaranteed
rare+ drop specifically from boss kills.

## Known rough edges (intentional, for a prototype)

- The floor's tier palette (`FLOOR_TIER_PALETTE`) only has 5 entries and
  then repeats - stage 51+ looks the same as stage 1+ again. Adding more
  entries is a one-line change if you want more visual variety deeper into
  a run before it starts repeating.
- Floor tier colors are tuned as multiplicative tints against the floor's
  existing baked colors (warm dirt tones), so very different hues (e.g. a
  vivid blue) will look muted/desaturated compared to what you'd expect
  from the raw palette value - the underlying texture still shows through.
  Worth knowing if a tier's color looks "off" compared to its hex value.
- Only `sword` (Knight) has real named weapons - Ranger and Priest have no
  class-restricted weapon type yet, so a weapon-slot drop can currently
  only ever be a sword. Add `bow`/`staff` (or whatever) to
  `config/weaponTypes.js` once you've got names for them.
- Armor and trinket slots are still on the older generic system (universal,
  single `stats.armor`/`stats.atk` bonus, no named items) - only weapons
  were asked to be class-restricted. The same `WEAPON_TYPES` pattern would
  extend to named armor/trinkets fairly directly if you want that later.
- Equipment set bonuses ("2pc Knight Set: +10% HP") aren't built - each
  item's stats are independent, no bonus for wearing a matching set.
- Bosses share the same sprite as normal enemies (bigger + red-tinted, and
  now deeper-red once enraged) rather than unique art - the mechanics are
  distinct now, the visuals are still a reskin.
- All enemy roles (tank/brawler/archer) currently share the same sprite -
  only stats differ. Distinct art per role would help readability a lot.
- Only two heroes are recruitable (Ranger, Priest) before you run out of
  classes - a 4th class would give the recruit UI more room to matter, and
  give the front line a second melee option.
- Walk-cycle sprites (`hero-{class}-walk1/2.png`) are temporary placeholders
  in my simple original style, not yours - see the walking-animation section
  above. A 4th hero class would also need its own walk pair added to
  `WALK_SPRITE_PATHS` in `game.js`, or it just won't visibly march.
- Only heroes march on a wave transition, not enemies - matches what was
  asked for, but if you want the new wave's enemies to also look like
  they're arriving on foot rather than just sliding in, that's a natural
  extension of the same `WalkCycle` module.
- Projectiles are a plain colored dot, not an actual arrow/bolt sprite or
  rotated-to-face-direction graphic - fine as a placeholder, would benefit
  from real art like everything else.
- `COLLISION_GAP` (16px) in `game.js` was tuned by eye against your current
  sprite sizes - if you swap in noticeably bigger or smaller art, this is
  the one constant to revisit so attacks still look like they connect.
- `castSpeed` exists on every hero but doesn't do anything yet - there's no
  ability/cast system separate from basic attacks for it to modify. It's
  there so the stat exists ahead of that system rather than needing a
  schema change later.
- `moveSpeed` only scales melee lunge/engage animation speed - ranged
  attackers' draw/recoil timing (`RangedAttackAnim.js`) doesn't currently
  respect it, so a fast archer's bow-draw takes the same time as a slow
  one's. Minor inconsistency, easy follow-up if it's noticeable.
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
