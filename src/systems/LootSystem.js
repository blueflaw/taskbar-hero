import { generateLoot } from '../config/lootTables.js';

export class LootSystem {
  /**
   * Roll a chest for the given stage and push it into the inventory array.
   * Keeping inventory as a plain array on GameState makes save/load trivial.
   */
  static rollChest(stage, inventory) {
    const item = generateLoot(stage);
    inventory.push(item);
    return item;
  }
}
