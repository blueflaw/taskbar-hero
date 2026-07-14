# Taskbar Hero Clone — Development Roadmap

A living checklist. Check items off as you go, and don't be afraid to reorder
things inside a phase — the phase order matters more than the item order.

---

## Right Now 🔵

*(Full technical detail on all of these lives in README.md - this list is a
quick-scan history, not the deep dive.)*

- [x] Inventory popup window
- [x] Damage numbers + hit-flash
- [x] System tray icon
- [x] Sound effects
- [x] Melee lunge animation + scrolling background + boss stages
- [x] Multi-enemy waves + formation targeting (Tank/Brawler/Archer, front-to-back)
- [x] Recruit-hero UI (spend gold to add Ranger/Priest via the inventory popup)
- [x] Projectile animation + health bars (ranged attackers fire bolts; every unit has an hp bar)
- [x] Hero formation lines (front-line melee protects back-line ranged/support, mirrors enemy formation)
- [x] Melee collision (attackers travel to a real collision point near their target instead of a token hop)
- [x] **Engage-and-hold + coin burst** — melee units (heroes and enemies)
  now travel to their target ONCE and hold that position for as long as
  they keep fighting it, instead of resetting to their formation slot
  between every single swing. They only move again when the target changes
  (it died, so combat moves to the next enemy in line) or when the fight
  ends entirely (new wave spawns → heroes return to formation). A quick
  punch-flash on the attacker itself (reusing `HitFlash`) gives per-swing
  feedback while stationary. Enemy deaths now also pop a small 3-coin gold
  burst (`CoinBurst.js`) that arcs and fades. `MeleeAnim.js`'s API changed
  from `startLunge`/`updateLunge` (round-trip) to `travelTo`/`updateTravel`
  (one-way, holds at the destination) - `game.js` tracks each entry's
  `engagedTargetId` to know whether to travel or just swing in place.
- [ ] **Next up is your call** — see "possible next steps" below.

**Working split going forward:** code/animation/systems work stays with
Claude; art and content ideas are a good lane for you to drive in parallel
since neither blocks the other - e.g. you keep working on sprites (idle/attack
frames, enemy variety, item icons) while animation/combat systems get built
against whatever's currently in `src/assets/`. Flag here whenever you push
new art or an idea so the roadmap stays the shared source of truth for both
of us.

*(Possible next steps: a 4th hero class so there's something left to recruit
after Ranger + Priest, and so the front line has a second melee option; real
arrow/bolt sprites instead of plain colored dots for projectiles; a small
draw/recoil animation for ranged attackers instead of staying static while
the projectile does the work; enemy roles could get distinct sprites too,
following the same pattern.)*

---

## Phase 1 — MVP Polish
Goal: a taskbar companion that feels good to glance at, even with placeholder art.

- [x] Taskbar-docked transparent overlay window
- [x] Core auto-battle loop (hero vs enemy, HP/ATK/DEF math)
- [x] XP, leveling, stage progression
- [x] Loot rolls with rarity tiers
- [x] Save/load to disk + offline-time catch-up
- [x] Placeholder sprites (knight/ranger/priest/enemy)
- [x] Inventory popup window (see "Right Now")
- [x] Equip UI wired to `Hero.equip()`
- [x] Basic damage-number popups (floating text on hit)
- [x] Sound effects: hit, level-up, loot drop (even placeholder blips)
- [x] System tray icon (right-click menu: Open Inventory / Show-Hide / Quit)
- [x] Melee lunge animation on attack, synced damage/flash/sound timing
- [x] Scrolling parallax background + stage-transition speed pulse
- [ ] Proper app icon (`.ico`) for the taskbar/dock/installer - tray icon is separate from this

---

## Phase 2 — Your Own Art
Goal: replace every placeholder with real assets — this is where your
illustration skills take over from mine.

- [x] Basic hero/enemy sprite swap (done on your end - static images replacing the Python-generated placeholders)
- [ ] Idle + attack animation frames per class (currently a single static image per hero/enemy - swap `PIXI.Sprite` for `PIXI.AnimatedSprite` with a spritesheet when ready)
- [ ] Enemy sprite variety (3-5 enemy types per stage tier + per formation role, not just one image)
- [ ] Icon art for loot items (even simple colored gem/weapon icons help a lot)
- [ ] A small logo/wordmark for the inventory popup header

---

## Phase 3 — Content Expansion
Goal: give players (including future-you) reasons to keep the game running for weeks.

- [ ] More hero classes beyond knight/ranger/priest (mage? rogue?)
- [x] Recruit-hero UI (spend gold to add ranger/priest to the party via the inventory popup's Recruit section)
- [x] Basic boss stages every `BOSS_INTERVAL` (10) stages - bigger, red-tinted
  enemy, background tint builds toward it. Still needs: actually different
  stats/attack pattern (currently just a reskinned normal enemy) and a
  guaranteed rare+ drop.
- [ ] Equipment sets / set bonuses (e.g. "2pc Knight Set: +10% HP")
- [ ] Crafting or item upgrade system (combine 3 commons → 1 uncommon)
- [ ] A second currency (gems) from bosses, spent on cosmetic-only stuff first —
      keeps monetization-adjacent design honest before you add anything real

---

## Phase 4 — Meta-Progression & Retention
Goal: the "why do I open this every day" layer — this is what separates an
idle toy from an idle *game*.

- [ ] Permanent upgrade tree (their "Rune" system) — spend a prestige currency
      on small permanent stat boosts
- [ ] Prestige / rebirth loop: reset stage progress for a permanent multiplier
- [ ] Daily login reward (simple streak counter is enough to start)
- [ ] Achievements list (even a static local list with checkmarks is good UX)
- [ ] Pet/companion system (passive bonus, unlockable) — good scope for a v2

---

## Phase 5 — Live-Ops Feel
Goal: make it feel like a maintained product, not a one-off script.

- [ ] In-app changelog / "what's new" popup on update
- [ ] Settings panel: toggle click-through sensitivity, window position,
      autosave interval, mute sound
- [ ] Telemetry opt-in (local-only stage/playtime stats you can view — skip
      remote analytics unless you actually plan to ship this publicly)
- [ ] Auto-update mechanism (`electron-updater`) if you plan to keep pushing changes

---

## Phase 6 — Packaging & Distribution
Goal: get it onto an actual machine (yours, then maybe others').

- [ ] `electron-builder` config for a Windows installer (`.exe`/NSIS)
- [ ] App icon in all required sizes (`.ico` for Windows)
- [ ] Code signing (optional but avoids SmartScreen warnings if you go public)
- [ ] Decide: personal tool only, itch.io release, or Steam page — each has
      very different overhead (Steam needs a $100 direct fee + storefront
      assets + trailer)

---

## Design Guardrails (revisit these as scope grows)

- **Keep the taskbar strip tiny and glanceable.** Any UI that needs real
  interaction (inventory, settings, crafting) belongs in a popup window, not
  crammed into the 48px strip.
- **Systems stay data-driven.** New hero classes, enemies, and loot should be
  addable by editing `config/*.js`, not by touching `systems/*.js`. If you
  find yourself editing a system file to add content, that's a sign to
  refactor the system to read from config instead.
- **Offline simulation stays capped.** Don't let players (or future-you)
  accumulate unbounded offline rewards — it breaks the loop's pacing and
  makes early game trivial.
- **Ship Phase 1 fully before touching Phase 2 art.** Placeholder squares are
  fine to look at for weeks if the *loop* is fun. Don't let art production
  block gameplay iteration.

---

## Quick Reference: File → Feature Map

| Want to change...              | Edit this file                        |
|--------------------------------|----------------------------------------|
| Hero base stats / new class    | `src/config/heroClasses.js`            |
| Loot rarity odds / items       | `src/config/lootTables.js`             |
| How combat math works          | `src/systems/CombatSystem.js`          |
| Stage-up / offline sim rules   | `src/systems/ProgressionSystem.js`     |
| Save file shape                | `src/state/GameState.js`               |
| Window size/position/behavior  | `main.js`                              |
| Sprites / visuals               | `src/game.js` + `src/assets/`          |
