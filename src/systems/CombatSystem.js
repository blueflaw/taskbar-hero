// Resolves one tick of auto-battle between a party and a wave (array) of enemies.
// Heroes always attack the front-most LIVING enemy (lowest index in the
// array) - that's the formation order: tank up front, then brawler, then
// archer safely in back until everything ahead of it is dead. Enemies each
// act independently and retaliate against a random living hero.
export class CombatSystem {
  /**
   * @param {import('../entities/Hero.js').Hero[]} party
   * @param {import('../entities/Enemy.js').Enemy[]} enemies
   * @param {number} deltaSeconds
   * @returns {{events: Array<Object>, waveDefeated: boolean, partyWiped: boolean}}
   */
  static resolveTick(party, enemies, deltaSeconds) {
    const events = [];
    const livingParty = party.filter((h) => h.isAlive());

    for (const hero of livingParty) {
      if (!hero.tick(deltaSeconds)) continue;

      if (hero.role === 'support' && hero.healPerSecond > 0) {
        const target = livingParty.reduce((lowest, h) =>
          h.hp / h.maxHp < lowest.hp / lowest.maxHp ? h : lowest
        , livingParty[0]);
        target.heal(hero.healPerSecond);
        events.push({ type: 'heal', source: hero.id, target: target.id, amount: hero.healPerSecond });
        continue;
      }

      // Re-evaluate the front target on every hero's turn (not cached once
      // per tick) - if an earlier hero this same tick just killed the front
      // enemy, the next hero should hit whoever is now at the front instead
      // of wasting a swing on a corpse.
      const frontEnemy = enemies.find((e) => e.isAlive());
      if (frontEnemy) {
        const dmg = frontEnemy.takeDamage(hero.atk);
        events.push({ type: 'hero-attack', source: hero.id, targetEnemyId: frontEnemy.id, amount: dmg });
        if (!frontEnemy.isAlive()) {
          events.push({ type: 'enemy-killed', enemyId: frontEnemy.id });
        }
      }
    }

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      if (!enemy.tick(deltaSeconds)) continue;

      const aliveHeroes = party.filter((h) => h.isAlive());
      if (aliveHeroes.length === 0) continue;

      const target = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
      const dmg = target.takeDamage(enemy.atk);
      events.push({ type: 'enemy-attack', source: enemy.id, target: target.id, amount: dmg });
    }

    const waveDefeated = enemies.length > 0 && enemies.every((e) => !e.isAlive());
    const partyWiped = party.every((h) => !h.isAlive());
    return { events, waveDefeated, partyWiped };
  }
}
