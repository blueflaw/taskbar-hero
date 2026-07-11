// Formation roles for a wave, front-to-back. Heroes always attack the
// front-most living enemy (index 0 of the wave), so `tank` soaks hits while
// `archer` stays safe in back until everything in front of it is dead.
// Wave composition assigns these by array index, wrapping if a wave is
// bigger than the role list (see WaveSystem.spawnWave).
export const ENEMY_ROLES = [
  { key: 'tank', label: 'Tank', hpMult: 1.6, atkMult: 0.7, defMult: 1.8 },
  { key: 'brawler', label: 'Brawler', hpMult: 1.0, atkMult: 1.3, defMult: 1.0 },
  { key: 'archer', label: 'Archer', hpMult: 0.65, atkMult: 1.6, defMult: 0.4 },
];

// Boss stages always spawn a single enemy using this role instead of a wave.
export const BOSS_ROLE = { key: 'boss', label: 'Boss', hpMult: 6, atkMult: 1.8, defMult: 2.2 };
