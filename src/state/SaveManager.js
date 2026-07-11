import { GameState } from './GameState.js';
import { ProgressionSystem } from '../systems/ProgressionSystem.js';

const AUTOSAVE_INTERVAL_MS = 30_000;

export class SaveManager {
  static async load() {
    const saved = await window.taskbarHero.loadGame();
    const state = GameState.fromSave(saved);

    if (saved) {
      const offlineSeconds = Math.max(0, (Date.now() - saved.lastSavedAt) / 1000);
      // Cap offline simulation so a week-long gap doesn't hang the app on launch
      const cappedSeconds = Math.min(offlineSeconds, 60 * 60 * 12); // 12h cap
      ProgressionSystem.simulate(state, cappedSeconds, { allowChests: false, step: 5 });
    }

    return state;
  }

  static async save(gameState) {
    await window.taskbarHero.saveGame(gameState.serialize());
  }

  static startAutosave(gameState) {
    setInterval(() => SaveManager.save(gameState), AUTOSAVE_INTERVAL_MS);
    // Also save on unload as a best-effort
    window.addEventListener('beforeunload', () => SaveManager.save(gameState));
  }
}
