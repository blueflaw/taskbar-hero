import { ENRAGE_HP_FRACTION, ENRAGE_ATK_MULT, ENRAGE_COOLDOWN_MULT, HEAVY_ATTACK_INTERVAL } from '../config/bossMechanics.js';

let nextId = 1;

// Enemy strength scales with the "stage" number so later fights hit harder,
// and with an optional formation `role` (see config/enemyRoles.js) that
// multiplies those base stats - a tank has more HP/DEF but less ATK, an
// archer is the reverse. No role = a flat 1x multiplier, same as before.
// Bosses (role.key === 'boss') additionally get two mechanics normal
// enemies never check: a one-time enrage at low hp, and a heavy attack
// every few swings - see config/bossMechanics.js for the tuning.
export class Enemy {
  constructor(stage = 1, role = null) {
    this.id = nextId++;
    this.stage = stage;
    this.role = role?.key ?? 'normal';
    this.roleLabel = role?.label ?? 'Enemy';

    const hpMult = role?.hpMult ?? 1;
    const atkMult = role?.atkMult ?? 1;
    const defMult = role?.defMult ?? 1;

    this.maxHp = Math.round((15 + stage * 6) * hpMult);
    this.hp = this.maxHp;
    this.atk = Math.round((3 + stage * 1.2) * atkMult);
    this.def = Math.round(stage * 0.5 * defMult);
    // Reward roughly tracks the enemy's overall power, not just its HP -
    // otherwise squishy-but-dangerous archers would be worth less than tanks.
    this.xpReward = Math.round((5 + stage * 2) * ((hpMult + atkMult) / 2));
    this.attackCooldown = 1.2;
    this._cooldownTimer = this.attackCooldown;

    this.enraged = false;
    this.attacksLanded = 0;
  }

  isAlive() {
    return this.hp > 0;
  }

  tick(deltaSeconds) {
    this._cooldownTimer -= deltaSeconds;
    if (this._cooldownTimer <= 0) {
      this._cooldownTimer = this.attackCooldown;
      this.attacksLanded += 1;
      return true;
    }
    return false;
  }

  /** True if the attack that just fired (the most recent tick() that
   * returned true) should land as a heavy hit - every Nth boss attack. */
  isHeavyAttack() {
    return this.role === 'boss' && this.attacksLanded > 0 && this.attacksLanded % HEAVY_ATTACK_INTERVAL === 0;
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.def);
    this.hp = Math.max(0, this.hp - mitigated);
    return mitigated;
  }

  /** Call after this enemy takes damage. Returns true the ONE time enrage
   * actually triggers (hp fraction crossed the threshold), so the caller
   * can emit a one-shot event - false every other time, including all
   * calls after it's already enraged. */
  checkEnrage() {
    if (this.role !== 'boss' || this.enraged || !this.isAlive()) return false;
    if (this.hp / this.maxHp > ENRAGE_HP_FRACTION) return false;

    this.enraged = true;
    this.atk = Math.round(this.atk * ENRAGE_ATK_MULT);
    this.attackCooldown *= ENRAGE_COOLDOWN_MULT;
    return true;
  }
}
