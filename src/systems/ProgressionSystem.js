import { WaveSystem } from './WaveSystem.js';
import { CombatSystem } from './CombatSystem.js';
import { LootSystem } from './LootSystem.js';
import { BOSS_INTERVAL } from '../config/waveConfig.js';

// Re-exported for convenience - game.js and others already import this from here.
export { BOSS_INTERVAL };

export class ProgressionSystem {
  /**
   * Simulate `seconds` worth of gameplay in fixed steps.
   * Used both for the live tick (called every frame with small delta)
   * and for catching up offline progress (called once with a big delta on launch).
   * Matches the real game's design: offline sim still runs, but no chests drop offline.
   */
  static simulate(gameState, seconds, { allowChests = true, step = 0.25, onEvent = null } = {}) {
    let remaining = seconds;

    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      remaining -= dt;

      // Whenever there's no active wave (game start, right after a wave
      // clears, or after a party wipe reset) spawn a fresh one and let the
      // caller know - this is the single place new enemies come from, so
      // the renderer only needs to listen for this one event to build sprites.
      if (!gameState.enemies || gameState.enemies.length === 0) {
        gameState.enemies = WaveSystem.spawnWave(gameState.stage);
        if (onEvent) {
          onEvent({
            type: 'wave-spawned',
            stage: gameState.stage,
            isBoss: gameState.stage % BOSS_INTERVAL === 0,
            enemies: gameState.enemies,
          });
        }
      }

      const { events, waveDefeated, partyWiped } = CombatSystem.resolveTick(
        gameState.party,
        gameState.enemies,
        dt
      );

      // Let the caller (renderer) react to what just happened - damage
      // numbers, hit flashes, sound cues, etc. Kept optional so headless
      // simulation (offline catch-up) doesn't pay for any of that.
      if (onEvent) {
        for (const event of events) onEvent(event);
      }

      if (waveDefeated) {
        const totalXp = gameState.enemies.reduce((sum, e) => sum + e.xpReward, 0);
        gameState.party.forEach((hero) => {
          if (hero.isAlive()) {
            const leveledUp = hero.gainXp(totalXp);
            if (leveledUp && onEvent) {
              onEvent({ type: 'level-up', heroId: hero.id, level: hero.level });
            }
          }
        });
        gameState.gold += totalXp * 2;

        if (allowChests && Math.random() < 0.35) {
          const item = LootSystem.rollChest(gameState.stage, gameState.inventory);
          if (onEvent) onEvent({ type: 'loot-drop', item });
        }

        gameState.stage += 1;
        gameState.enemies = []; // next loop iteration (or next frame) spawns the next wave
      }

      if (partyWiped) {
        // Auto-retry: drop back a couple stages and heal up, rather than hard-stopping.
        gameState.stage = Math.max(1, gameState.stage - 2);
        gameState.party.forEach((hero) => (hero.hp = hero.maxHp));
        gameState.enemies = [];
      }
    }
  }
}
