let nextId = 1;

// Enemy strength scales with the "stage" number so later fights hit harder,
// and with an optional formation `role` (see config/enemyRoles.js) that
// multiplies those base stats - a tank has more HP/DEF but less ATK, an
// archer is the reverse. No role = a flat 1x multiplier, same as before.
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
  }

  isAlive() {
    return this.hp > 0;
  }

  tick(deltaSeconds) {
    this._cooldownTimer -= deltaSeconds;
    if (this._cooldownTimer <= 0) {
      this._cooldownTimer = this.attackCooldown;
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.def);
    this.hp = Math.max(0, this.hp - mitigated);
    return mitigated;
  }
}
