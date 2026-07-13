// Base stats each class starts with at level 1.
// Keep this data-driven so adding a class never touches game logic.
// recruitCost is in gold - 0 means "starting hero, not recruitable" (knight
// begins in the party by default; see GameState).
// formationLine: 'front' classes stand near the enemies and are what enemies
// attack first (mirrors how enemies themselves have a tank/brawler/archer
// formation) - 'back' classes (ranged, support) only become attackable once
// every front-line hero is dead.
export const HERO_CLASSES = {
  knight: {
    label: 'Knight',
    baseHp: 60,
    baseAtk: 6,
    baseDef: 8,
    attackSpeed: 1.0, // attacks per second
    role: 'tank',
    formationLine: 'front',
    recruitCost: 0,
  },
  ranger: {
    label: 'Ranger',
    baseHp: 35,
    baseAtk: 9,
    baseDef: 2,
    attackSpeed: 1.6,
    role: 'dps',
    formationLine: 'back',
    recruitCost: 60,
  },
  priest: {
    label: 'Priest',
    baseHp: 40,
    baseAtk: 3,
    baseDef: 3,
    attackSpeed: 0.8,
    role: 'support',
    healPerSecond: 4,
    formationLine: 'back',
    recruitCost: 120,
  },
};

// Strip is only ~360px wide and enemies share that space - cap party size
// so the formation doesn't run out of room even in a max-size wave.
export const MAX_PARTY_SIZE = 4;

// Simple exponential-ish XP curve: xp needed to reach next level
export function xpToNextLevel(level) {
  return Math.floor(20 * Math.pow(level, 1.35));
}
