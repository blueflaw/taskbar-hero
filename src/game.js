import * as PIXI from 'pixi.js';
import { SaveManager } from './state/SaveManager.js';
import { ProgressionSystem, BOSS_INTERVAL } from './systems/ProgressionSystem.js';
import { FloatingTextManager } from './fx/FloatingTextManager.js';
import { triggerHitFlash, updateHitFlash } from './fx/HitFlash.js';
import { SoundManager } from './fx/SoundManager.js';
import { startLunge, updateLunge } from './fx/MeleeAnim.js';
import { Background } from './fx/Background.js';
import { HERO_CLASSES, MAX_PARTY_SIZE } from './config/heroClasses.js';
import { HealthBar } from './fx/HealthBar.js';
import { ProjectileManager } from './fx/Projectile.js';

const app = new PIXI.Application({
  resizeTo: document.getElementById('game-root'),
  backgroundAlpha: 0, // fully transparent - only sprites show
  antialias: false,   // crisp pixel art
});
document.getElementById('game-root').appendChild(app.view);

// --- Sprites ---
// Swap these PNGs in src/assets/ with your own art later - same filenames,
// same ~32x32 canvas proportions, and everything downstream keeps working.
const SPRITE_PATHS = {
  knight: 'assets/hero-knight.png',
  ranger: 'assets/hero-ranger.png',
  priest: 'assets/hero-priest.png',
  enemy: 'assets/enemy-slime.png',
};

const SPRITE_SCALE = 0.4; // 96px source -> ~38px, fits the 48px-tall strip
const SPRITE_SOURCE_SIZE = 96; // all hero/enemy sprite source PNGs are 96x96
// Back line (ranged/support) keeps the strip's original left-side position.
// Front line (melee) stands further right, closer to the enemies - visually
// "in combat" with them - while the back line stays safely behind.
const BACK_BASE_X = 20;
const BACK_SLOT_SPACING = 30;
const FRONT_BASE_X = 130;
const FRONT_SLOT_SPACING = 30;
const ENEMY_SLOT_SPACING = 34; // px between enemies in a wave
const DEATH_FADE_DURATION = 0.3; // seconds for a defeated enemy to fade out

// Sprites are bottom-anchored at sprite.y - this finds the visual top edge,
// which is where a health bar should sit just above.
function spriteTopY(entry) {
  return entry.sprite.y - SPRITE_SOURCE_SIZE * entry.baseScale;
}

function makeHeroSprite(hero) {
  const sprite = PIXI.Sprite.from(SPRITE_PATHS[hero.classId] ?? SPRITE_PATHS.knight);
  sprite.scale.set(SPRITE_SCALE);
  sprite.anchor.set(0.5, 1);
  return sprite;
}

function makeEnemySprite() {
  const sprite = PIXI.Sprite.from(SPRITE_PATHS.enemy);
  sprite.scale.set(SPRITE_SCALE);
  sprite.anchor.set(0.5, 1);
  return sprite;
}

// Formation layout: index 0 (front/tank) sits closest to the heroes, the
// last index (back/archer) sits at the strip's right edge - mirrors how the
// original single-enemy rested at that same right-edge position.
function enemySlotX(indexFromFront, waveSize, screenWidth) {
  const rightEdge = screenWidth - 22;
  return rightEdge - (waveSize - 1 - indexFromFront) * ENEMY_SLOT_SPACING;
}

async function main() {
  const gameState = await SaveManager.load();
  SaveManager.startAutosave(gameState);

  // Lay out hero sprites left-to-right, enemies form up on the right.
  // Anchor is bottom-center, so y sits near the bottom of the 48px strip.
  const groundY = app.screen.height - 2;

  const background = new Background(app, app.screen.width, app.screen.height, groundY);

  const heroSprites = [];

  function addHeroEntry(hero) {
    const sprite = makeHeroSprite(hero);
    // Index within this hero's OWN formation group (front or back), not the
    // party as a whole - so recruiting a back-line hero never shifts
    // existing front-line positions and vice versa.
    const groupIndex = heroSprites.filter((e) => e.hero.formationLine === hero.formationLine).length;
    const baseX = hero.formationLine === 'front'
      ? FRONT_BASE_X + groupIndex * FRONT_SLOT_SPACING
      : BACK_BASE_X + groupIndex * BACK_SLOT_SPACING;
    sprite.x = baseX;
    sprite.y = groundY;
    app.stage.addChild(sprite);
    const entry = { hero, sprite, baseScale: SPRITE_SCALE, baseTint: 0xffffff, hitTimer: 0, baseX };
    entry.healthBar = new HealthBar(app.stage);
    heroSprites.push(entry);
    return entry;
  }

  gameState.party.forEach((hero) => addHeroEntry(hero));

  // Enemy entries are built dynamically as waves spawn (see the
  // 'wave-spawned' event below) - there's no fixed enemy count anymore.
  let enemyEntries = [];

  function findEnemyEntry(enemyId) {
    return enemyEntries.find((e) => e.enemyId === enemyId);
  }

  const floatingText = new FloatingTextManager(app.stage);
  const projectiles = new ProjectileManager(app.stage);
  const sound = new SoundManager(0.4);

  // Small clickable icon that opens the inventory popup. Sits top-left,
  // out of the way of the hero lineup.
  const menuButton = new PIXI.Graphics();
  menuButton.eventMode = 'static';
  menuButton.cursor = 'pointer';
  menuButton.beginFill(0x3a3648, 0.9);
  menuButton.lineStyle(1, 0x5a5570, 1);
  menuButton.drawRoundedRect(0, 0, 16, 14, 3);
  menuButton.endFill();
  // Tiny "bag" glyph - two dots to suggest a satchel clasp
  menuButton.beginFill(0xeae6f5);
  menuButton.drawRect(6, 4, 2, 2);
  menuButton.drawRect(9, 4, 2, 2);
  menuButton.endFill();
  menuButton.x = 4;
  menuButton.y = 4;
  menuButton.on('pointertap', () => window.taskbarHero.openInventory());
  app.stage.addChild(menuButton);

  // Basic hover-to-interact: only capture mouse when actually over the window content
  app.view.addEventListener('mouseenter', () => window.taskbarHero.setIgnoreMouse(false));
  app.view.addEventListener('mouseleave', () => window.taskbarHero.setIgnoreMouse(true));

  // --- Inventory window sync ---
  // The inventory popup has no direct access to gameState (it lives in a
  // different renderer process) - it asks, and we answer with a plain-object snapshot.
  function serializeForInventory() {
    const partyClassIds = new Set(gameState.party.map((h) => h.classId));
    const recruitable = Object.entries(HERO_CLASSES)
      .filter(([classId, def]) => def.recruitCost > 0 && !partyClassIds.has(classId))
      .map(([classId, def]) => ({ classId, label: def.label, cost: def.recruitCost }));

    return {
      gold: gameState.gold,
      party: gameState.party.map((hero) => ({
        id: hero.id,
        label: hero.label,
        classId: hero.classId,
        level: hero.level,
        hp: hero.hp,
        maxHp: hero.maxHp,
        equipment: hero.equipment,
      })),
      inventory: gameState.inventory,
      recruitable,
      partyFull: gameState.party.length >= MAX_PARTY_SIZE,
    };
  }

  window.taskbarHero.onProvideInventorySync(() => {
    window.taskbarHero.sendInventorySync(serializeForInventory());
  });

  // The inventory window tells us "equip item X to hero Y" - we own the real
  // Hero instances, so we perform the actual mutation and drop the item from inventory.
  window.taskbarHero.onEquipItem(({ heroId, itemId }) => {
    const hero = gameState.party.find((h) => h.id === heroId);
    const itemIndex = gameState.inventory.findIndex((i) => i.id === itemId);
    if (!hero || itemIndex === -1) return;

    const [item] = gameState.inventory.splice(itemIndex, 1);
    const previouslyEquipped = hero.equipment[item.slot];
    hero.equip(item);
    if (previouslyEquipped) gameState.inventory.push(previouslyEquipped);

    SaveManager.save(gameState);

    // Push a fresh snapshot right away so the popup updates without waiting on its poll.
    window.taskbarHero.sendInventorySync(serializeForInventory());
  });

  // The inventory window tells us "recruit this class" - we own gold/party,
  // so the affordability + max-party-size checks happen here, not there.
  window.taskbarHero.onRecruitHero((classId) => {
    const classDef = HERO_CLASSES[classId];
    if (!classDef || classDef.recruitCost <= 0) return; // not a recruitable class
    if (gameState.party.length >= MAX_PARTY_SIZE) return;
    if (gameState.party.some((h) => h.classId === classId)) return; // already recruited
    if (gameState.gold < classDef.recruitCost) return;

    gameState.gold -= classDef.recruitCost;
    gameState.addHero(classId);

    // The new Hero was appended to gameState.party - mirror that with a new
    // sprite entry. addHeroEntry figures out its formation-group slot itself.
    const newHero = gameState.party[gameState.party.length - 1];
    addHeroEntry(newHero);

    SaveManager.save(gameState);
    window.taskbarHero.sendInventorySync(serializeForInventory());
  });

  // --- Game feedback (lunge/projectile animation, damage numbers, hit flash, sound) ---
  // ProgressionSystem forwards each raw event here as it happens. For attacks,
  // we don't fire damage numbers/flash/sound immediately - instead melee
  // attackers kick off a lunge (dash toward the target and back) and ranged
  // attackers (Ranger hero, Archer enemy role) fire a projectile; either way
  // an arrival/impact callback fires the feedback right as it "lands", so
  // the numbers sync with the swing/hit instead of popping instantly.
  function onGameEvent(event) {
    if (event.type === 'hero-attack') {
      const attacker = heroSprites.find(({ hero }) => hero.id === event.source);
      const targetEntry = findEnemyEntry(event.targetEnemyId);
      if (!attacker || !targetEntry) return;

      const onImpact = () => {
        // The target may have died and been cleaned up (or a whole new wave
        // may have spawned) in the gap between the hit resolving and the
        // attack's impact frame - if so, its sprite is already destroyed.
        if (!enemyEntries.includes(targetEntry)) return;
        floatingText.spawn(targetEntry.sprite.x, targetEntry.sprite.y - 30, `-${event.amount}`, 0xffcc66);
        triggerHitFlash(targetEntry);
        sound.play('hit-dealt');
      };

      if (attacker.hero.classId === 'ranger') {
        projectiles.spawn(
          attacker.sprite.x, attacker.sprite.y - 18,
          targetEntry.sprite.x, targetEntry.sprite.y - 18,
          0xd9b877, // wooden-arrow tan
          onImpact
        );
      } else {
        startLunge(attacker, +1, onImpact);
      }
      return;
    }

    if (event.type === 'enemy-attack') {
      const attackerEntry = findEnemyEntry(event.source);
      const target = heroSprites.find(({ hero }) => hero.id === event.target);
      if (!attackerEntry || !target) return;

      const onImpact = () => {
        floatingText.spawn(target.sprite.x, target.sprite.y - 30, `-${event.amount}`, 0xff5f5f);
        triggerHitFlash(target);
        sound.play('hit-taken');
      };

      if (attackerEntry.role === 'archer') {
        // Projectiles don't hold a live reference to the attacker's sprite
        // after spawning (just its position at that instant), so there's no
        // dangling-sprite risk here even if the archer dies mid-flight.
        projectiles.spawn(
          attackerEntry.sprite.x, attackerEntry.sprite.y - 18,
          target.sprite.x, target.sprite.y - 18,
          0xb98bff, // magic-bolt purple, matches the loot/rare accent color
          onImpact
        );
      } else {
        startLunge(attackerEntry, -1, () => {
          if (!enemyEntries.includes(attackerEntry)) return;
          onImpact();
        });
      }
      return;
    }

    if (event.type === 'enemy-killed') {
      const entry = findEnemyEntry(event.enemyId);
      if (entry && !entry.dying) {
        entry.dying = true;
        entry.deathTimer = 0;
        entry.healthBar.container.visible = false;
      }
      return;
    }

    if (event.type === 'heal') {
      const target = heroSprites.find(({ hero }) => hero.id === event.target);
      if (!target) return;
      floatingText.spawn(target.sprite.x, target.sprite.y - 30, `+${event.amount}`, 0x6fe38a);
      return;
    }

    if (event.type === 'level-up') {
      const target = heroSprites.find(({ hero }) => hero.id === event.heroId);
      if (target) {
        floatingText.spawn(target.sprite.x, target.sprite.y - 30, 'LEVEL UP!', 0xffe066);
      }
      sound.play('level-up');
      return;
    }

    if (event.type === 'loot-drop') {
      // Front enemy (tank/index 0) is a sensible visual origin for loot text.
      const originX = enemyEntries[0]?.sprite.x ?? app.screen.width - 40;
      const originY = enemyEntries[0]?.sprite.y ?? groundY;
      floatingText.spawn(originX, originY - 30, event.item.label, 0xb98bff);
      sound.play('loot-drop');
      return;
    }

    if (event.type === 'wave-spawned') {
      // Clear out anything left over from before (should normally already be
      // empty - each enemy removes itself via the death-fade below - but this
      // is a safety net for edge cases like a party-wipe reset).
      enemyEntries.forEach((entry) => {
        app.stage.removeChild(entry.sprite);
        entry.sprite.destroy();
        entry.healthBar.destroy();
      });
      enemyEntries = [];

      background.pulse();
      background.setBossProximity((event.stage % BOSS_INTERVAL) / BOSS_INTERVAL);

      const waveSize = event.enemies.length;
      event.enemies.forEach((enemy, i) => {
        const baseX = enemySlotX(i, waveSize, app.screen.width);
        const sprite = makeEnemySprite();
        const isBoss = event.isBoss;

        const entry = {
          enemyId: enemy.id,
          sprite,
          role: enemy.role, // needed to decide melee lunge vs ranged projectile on attack
          baseScale: SPRITE_SCALE * (isBoss ? 1.35 : 1),
          baseTint: isBoss ? 0xff5555 : 0xffffff,
          hitTimer: 0,
          baseX,
          dying: false,
        };
        entry.healthBar = new HealthBar(app.stage);

        // Slide in from off-screen right, staggered slightly per slot so a
        // multi-enemy wave doesn't arrive as one indistinguishable clump.
        const offscreenX = app.screen.width + 24 + i * 16;
        sprite.y = groundY;
        sprite.x = offscreenX;
        entry.spawnAnim = { timer: -i * 0.08, duration: 0.35, fromX: offscreenX, toX: baseX };

        app.stage.addChild(sprite);
        enemyEntries.push(entry);
      });

      if (event.isBoss) {
        floatingText.spawn(app.screen.width / 2, groundY - 34, 'BOSS INCOMING', 0xff5555);
      }
    }
  }

  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000; // seconds since last frame

    ProgressionSystem.simulate(gameState, dt, {
      allowChests: true,
      step: dt,
      onEvent: onGameEvent,
    });

    // Sync hero sprite opacity to hp% as a cheap "damaged" visual cue, and
    // update each hero's health bar to match.
    heroSprites.forEach((entry) => {
      const { hero, sprite } = entry;
      sprite.alpha = hero.isAlive() ? Math.max(0.3, hero.hp / hero.maxHp) : 0.15;
      entry.healthBar.update(hero.hp / hero.maxHp, sprite.x, spriteTopY(entry));
    });

    background.update(dt);
    projectiles.update(dt);

    // Animate floating damage/heal numbers and hero hit-flash/lunge
    floatingText.update(dt);
    heroSprites.forEach((entry) => {
      updateHitFlash(entry, dt);
      updateLunge(entry, dt);
    });

    // Each enemy entry is in exactly one of three states this frame:
    // dying (fading out after death), spawning (sliding in), or active
    // (normal hp-sync + hit-flash + lunge-toward-hero-on-attack).
    for (let i = enemyEntries.length - 1; i >= 0; i--) {
      const entry = enemyEntries[i];

      if (entry.dying) {
        entry.deathTimer += dt;
        const t = Math.min(1, entry.deathTimer / DEATH_FADE_DURATION);
        entry.sprite.alpha = 1 - t;
        entry.sprite.scale.set(entry.baseScale * (1 - t * 0.3));
        if (t >= 1) {
          app.stage.removeChild(entry.sprite);
          entry.sprite.destroy();
          entry.healthBar.destroy();
          enemyEntries.splice(i, 1);
        }
        continue;
      }

      if (entry.spawnAnim) {
        const spawn = entry.spawnAnim;
        spawn.timer += dt;
        if (spawn.timer >= 0) {
          const t = Math.min(1, spawn.timer / spawn.duration);
          const eased = 1 - Math.pow(1 - t, 2); // ease-out
          entry.sprite.x = spawn.fromX + (spawn.toX - spawn.fromX) * eased;
          if (t >= 1) entry.spawnAnim = null;
        }
        // Health bar still tracks along during the slide-in - falls through
        // to the hp-sync below rather than an early continue.
      }

      const enemy = gameState.enemies.find((e) => e.id === entry.enemyId);
      if (enemy) {
        entry.sprite.alpha = Math.max(0.2, enemy.hp / enemy.maxHp);
        entry.healthBar.update(enemy.hp / enemy.maxHp, entry.sprite.x, spriteTopY(entry));
      }
      updateHitFlash(entry, dt);
      if (!entry.spawnAnim) updateLunge(entry, dt);
    }
  });
}

main();
