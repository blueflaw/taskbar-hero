// Base stats each class starts with at level 1.
// Keep this data-driven so adding a class never touches game logic.
export const HERO_CLASSES = {
  knight: {
    label: 'Knight',
    baseHp: 60,
    baseAtk: 6,
    baseDef: 8,
    attackSpeed: 1.0, // attacks per second
    role: 'tank',
  },
  ranger: {
    label: 'Ranger',
    baseHp: 35,
    baseAtk: 9,
    baseDef: 2,
    attackSpeed: 1.6,
    role: 'dps',
  },
  priest: {
    label: 'Priest',
    baseHp: 40,
    baseAtk: 3,
    baseDef: 3,
    attackSpeed: 0.8,
    role: 'support',
    healPerSecond: 4,
  },
};

// Simple exponential-ish XP curve: xp needed to reach next level
export function xpToNextLevel(level) {
  return Math.floor(20 * Math.pow(level, 1.35));
}
