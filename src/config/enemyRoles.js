// Formation roles for a wave, front-to-back. Heroes always attack the
// front-most living enemy (index 0 of the wave), so `tank` soaks hits while
// `archer` stays safe in back until everything in front of it is dead.
// Wave composition assigns these by array index, wrapping if a wave is
// bigger than the role list (see WaveSystem.spawnWave).
//
// This is THE place to tune or add an enemy role/monster type - same stat
// shape as config/heroClasses.js (see the reference comment there), just as
// multipliers on Enemy's stage-scaled base stats instead of flat per-level
// values. Add a new entry here (or a new file the same shape, e.g. a future
// dungeon-specific role list) and Enemy.js/CombatSystem.js pick it up with
// no other code changes needed:
//   hpMult, atkMult, armorMult   multiply the stage-scaled base hp/atk/armor
//   critChance, critDamageMult   same meaning as the hero stats
//   moveSpeedMult                multiplier on lunge/travel animation speed
//                                (1.0 = normal) - ranged roles never travel,
//                                so this only visibly matters for melee roles
export const ENEMY_ROLES = [
  {
    key: 'tank', label: 'Tank',
    hpMult: 1.6, atkMult: 0.7, armorMult: 1.8,
    critChance: 0.03, critDamageMult: 1.4,
    moveSpeedMult: 0.85, // slow, heavy
  },
  {
    key: 'brawler', label: 'Brawler',
    hpMult: 1.0, atkMult: 1.3, armorMult: 1.0,
    critChance: 0.08, critDamageMult: 1.5,
    moveSpeedMult: 1.0,
  },
  {
    key: 'archer', label: 'Archer',
    hpMult: 0.65, atkMult: 1.6, armorMult: 0.4,
    critChance: 0.12, critDamageMult: 1.6,
    moveSpeedMult: 1.0, // never travels (ranged), kept for consistency/future use
  },
];

// Boss stages always spawn a single enemy using this role instead of a wave.
export const BOSS_ROLE = {
  key: 'boss', label: 'Boss',
  hpMult: 6, atkMult: 1.8, armorMult: 2.2,
  critChance: 0.1, critDamageMult: 1.7,
  moveSpeedMult: 0.9, // big and a little slower, but its heavy-attack telegraph (bossMechanics.js) does most of the "weighty" work
};
