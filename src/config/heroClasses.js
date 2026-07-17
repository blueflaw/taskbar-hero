// Base stats each class starts with at level 1. This is THE place to tune
// or add a hero class - nothing outside this file needs to change for a
// stat tweak or a brand new class, as long as the fields below are present.
//
// Stat reference (all per-class, flat unless noted "scales with level" -
// see the getters in entities/Hero.js for the exact level-scaling formulas):
//   label               display name
//   baseHp              scales with level -> Hero.maxHp
//   baseAtk             scales with level -> Hero.atk ("Attack Damage")
//   baseArmor           scales with level -> Hero.armor (flat damage reduction)
//   attackSpeed         attacks per second, before cooldownReduction
//   critChance          0..1 chance an attack crits
//   critDamageMult      damage multiplier on a crit (1.5 = +50%)
//   cooldownReduction   0..1, shrinks the effective time between attacks
//   moveSpeed           multiplier on how fast this hero's lunge/travel
//                       animations play (1.0 = normal) - see MeleeAnim.js
//   castSpeed           multiplier reserved for a future ability/cast
//                       system - NOT wired to anything yet (see README)
//   role                'tank' | 'dps' | 'support' - drives heal-vs-attack
//                       behavior in CombatSystem, distinct from formationLine
//   formationLine       'front' classes stand near the enemies and are what
//                       enemies attack first; 'back' (ranged/support) only
//                       become attackable once every front-line hero is dead
//   healPerSecond       support classes only - heal amount per cast
//   recruitCost         gold cost in the inventory popup's Recruit section;
//                       0 = starting hero, not recruitable (see GameState)
export const HERO_CLASSES = {
  knight: {
    label: 'Knight',
    baseHp: 60,
    baseAtk: 6,
    baseArmor: 8,
    attackSpeed: 1.0,
    critChance: 0.05,
    critDamageMult: 1.5,
    cooldownReduction: 0,
    moveSpeed: 1.0,
    castSpeed: 1.0,
    role: 'tank',
    formationLine: 'front',
    recruitCost: 0,
  },
  ranger: {
    label: 'Ranger',
    baseHp: 35,
    baseAtk: 9,
    baseArmor: 2,
    attackSpeed: 1.6,
    critChance: 0.15, // nimble, precision-focused - highest crit chance of the three
    critDamageMult: 1.8,
    cooldownReduction: 0,
    moveSpeed: 1.1,
    castSpeed: 1.0,
    role: 'dps',
    formationLine: 'back',
    recruitCost: 60,
  },
  priest: {
    label: 'Priest',
    baseHp: 40,
    baseAtk: 3,
    baseArmor: 3,
    attackSpeed: 0.8,
    critChance: 0.05,
    critDamageMult: 1.5,
    cooldownReduction: 0.1, // efficient casting - shrinks time between heals too, since heals reuse the same tick/cooldown as attacks
    moveSpeed: 0.9,
    castSpeed: 1.2, // priest's defining stat, once a distinct cast system exists to use it
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
