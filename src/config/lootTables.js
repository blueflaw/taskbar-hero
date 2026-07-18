import { WEAPON_TYPES } from './weaponTypes.js';

// Rarity tiers, cheapest/most common first. Weight = relative drop chance
// (doesn't need to sum to any particular total - rollRarity() just needs
// the relative proportions). statMult scales a weapon's baseStats or an
// armor/trinket's flat bonus - see generateLoot() below.
export const RARITIES = [
  { id: 'common', label: 'Common', weight: 500, statMult: 1.0 },
  { id: 'uncommon', label: 'Uncommon', weight: 250, statMult: 1.3 },
  { id: 'rare', label: 'Rare', weight: 120, statMult: 1.8 },
  { id: 'legendary', label: 'Legendary', weight: 60, statMult: 2.6 },
  { id: 'immortal', label: 'Immortal', weight: 30, statMult: 3.6 },
  { id: 'arcana', label: 'Arcana', weight: 15, statMult: 5.0 },
  { id: 'beyond', label: 'Beyond', weight: 8, statMult: 7.0 },
  { id: 'celestial', label: 'Celestial', weight: 4, statMult: 9.5 },
  { id: 'divine', label: 'Divine', weight: 2, statMult: 13.0 },
  { id: 'cosmic', label: 'Cosmic', weight: 1, statMult: 18.0 },
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

// Scales every value in a stats object by a multiplier, rounding sensibly -
// whole numbers for things like atk/armor, two decimals for small fractional
// stats like attackSpeed/critChance so they don't collapse to 0 at Common.
function scaleStats(baseStats, mult) {
  const scaled = {};
  for (const [key, value] of Object.entries(baseStats)) {
    const isSmallFraction = Math.abs(value) < 1;
    const raw = value * mult;
    scaled[key] = isSmallFraction ? Math.round(raw * 100) / 100 : Math.round(raw);
  }
  return scaled;
}

function pickWeapon(rarity, dropLevel) {
  const availableTypes = Object.values(WEAPON_TYPES).filter((t) => t.names.length > 0);
  if (availableTypes.length === 0) {
    // No named weapon types defined yet for any class - fall back to a
    // generic unrestricted weapon so drops still make sense mid-development.
    return {
      label: `${rarity.label} Weapon`,
      allowedClasses: null,
      stats: { atk: Math.round(2 * dropLevel * rarity.statMult) },
    };
  }

  const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const name = type.names[Math.floor(Math.random() * type.names.length)];
  return {
    label: `${rarity.label} ${name}`,
    allowedClasses: type.allowedClasses,
    stats: scaleStats(type.baseStats, rarity.statMult * (1 + dropLevel * 0.05)),
  };
}

function pickArmor(rarity, dropLevel) {
  const bonus = Math.round(2 * dropLevel * rarity.statMult);
  return {
    label: `${rarity.label} Armor`,
    allowedClasses: null, // armor/trinkets stay universal for now - only named weapons are class-restricted
    stats: { armor: bonus },
  };
}

function pickTrinket(rarity, dropLevel) {
  const bonus = Math.round(2 * dropLevel * rarity.statMult);
  return {
    label: `${rarity.label} Trinket`,
    allowedClasses: null,
    stats: { atk: bonus },
  };
}

export function generateLoot(dropLevel = 1) {
  const rarity = rollRarity();
  const slot = ITEM_SLOTS[Math.floor(Math.random() * ITEM_SLOTS.length)];

  const built = slot === 'weapon' ? pickWeapon(rarity, dropLevel)
    : slot === 'armor' ? pickArmor(rarity, dropLevel)
    : pickTrinket(rarity, dropLevel);

  return {
    id: `${slot}-${rarity.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    slot,
    rarity: rarity.id,
    label: built.label,
    allowedClasses: built.allowedClasses,
    stats: built.stats,
  };
}
