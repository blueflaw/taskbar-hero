import { Hero } from '../entities/Hero.js';

export class GameState {
  constructor() {
    this.party = [new Hero('knight', 1)];
    this.gold = 0;
    this.stage = 1;
    this.inventory = [];
    this.enemies = []; // the current wave - populated by ProgressionSystem on first tick
    this.lastSavedAt = Date.now();
  }

  addHero(classId) {
    this.party.push(new Hero(classId, 1));
  }

  serialize() {
    return {
      party: this.party.map((h) => h.serialize()),
      gold: this.gold,
      stage: this.stage,
      inventory: this.inventory,
      lastSavedAt: Date.now(),
    };
  }

  static fromSave(saved) {
    const state = new GameState();
    if (!saved) return state;

    state.party = saved.party.map((h) => Hero.fromSave(h));
    state.gold = saved.gold ?? 0;
    state.stage = saved.stage ?? 1;
    state.inventory = saved.inventory ?? [];
    state.lastSavedAt = saved.lastSavedAt ?? Date.now();
    return state;
  }
}
