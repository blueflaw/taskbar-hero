// Rarity tiers, cheapest/most common first. Weight = relative drop chance.
export const RARITIES = [
  { id: 'common', label: 'Common', weight: 60, statMult: 1.0 },
  { id: 'uncommon', label: 'Uncommon', weight: 25, statMult: 1.3 },
  { id: 'rare', label: 'Rare', weight: 10, statMult: 1.8 },
  { id: 'legendary', label: 'Legendary', weight: 4, statMult: 2.6 },
  { id: 'immortal', label: 'Immortal', weight: 1, statMult: 4.0 },
];

export const ITEM_SLOTS = ['weapon', 'armor', 'trinket'];

export function rollRarity() {
  const totalWeight = RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of RARITIES) {
    if (roll < rarity.weight) return rarity;
    roll -= rarity.weight;
  }
  return RARITIES[0];
}

export function generateLoot(dropLevel = 1) {
  const rarity = rollRarity();
  const slot = ITEM_SLOTS[Math.floor(Math.random() * ITEM_SLOTS.length)];
  const baseStat = Math.round(2 * dropLevel * rarity.statMult);
  return {
    id: `${slot}-${rarity.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    slot,
    rarity: rarity.id,
    label: `${rarity.label} ${slot}`,
    statBonus: baseStat,
  };
}
