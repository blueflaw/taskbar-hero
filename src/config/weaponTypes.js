// THIS IS THE FILE for adding named weapons. Each entry in WEAPON_TYPES is
// a weapon *category* (sword, bow, staff, ...) with:
//   names           array of display names - one is picked at random
//                   whenever this weapon type drops. All names in a
//                   category share the same base stats below; the name is
//                   cosmetic variety, not a separate power level. Rarity
//                   (see lootTables.js) is what actually scales the power.
//   allowedClasses  array of hero classIds that can equip this type.
//                   Hero.equip() and the inventory UI both enforce this -
//                   an item can still DROP for anyone, it just can't be
//                   equipped by the wrong class.
//   baseStats       stat bonuses at Common rarity - multiplied by the
//                   dropped rarity's statMult in lootTables.js. Keys must
//                   match real Hero stat names (atk, attackSpeed, armor,
//                   critChance, critDamageMult, cooldownReduction,
//                   moveSpeed) - see config/heroClasses.js for what each does.
//
// To add a new weapon type (e.g. for Ranger or Priest once you've got
// names picked out): copy the `sword` block, rename the key, set
// allowedClasses to that class's id, and fill in names + baseStats. No
// other file needs to change - lootTables.js reads this automatically.
export const WEAPON_TYPES = {
  sword: {
    names: [
      'Long Sword', 'Cutlass', 'Rapier', 'Bastard Sword', 'Great Sword',
      'Heavy Blade', 'Knight Sword', "Commander's Sword", 'Rune Sword',
      'Legend Sword', 'Fate Sword', 'Hero Sword', 'Storm Sword',
      'Vengeance Sword', 'Void Blade', 'Crystal Blade', 'Dimensional Sword',
      'Shadow Blade', 'Eternal Sword', 'Radiant Sword',
    ],
    allowedClasses: ['knight'],
    baseStats: { atk: 1, attackSpeed: 0.10 },
  },

  // --- Not built yet - add Ranger's bow names here when you have them ---
  // bow: {
  //   names: ['Short Bow', 'Longbow', ...],
  //   allowedClasses: ['ranger'],
  //   baseStats: { atk: 1, critChance: 0.02 },
  // },

  // --- Not built yet - add Priest's staff/wand names here when you have them ---
  // staff: {
  //   names: ['Wooden Staff', 'Blessed Rod', ...],
  //   allowedClasses: ['priest'],
  //   baseStats: { atk: 1, cooldownReduction: 0.02 },
  // },
};
