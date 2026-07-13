import { HERO_CLASSES as CLASSES, xpToNextLevel } from '../config/heroClasses.js';

let nextId = 1;

export class Hero {
  constructor(classId, level = 1) {
    const def = CLASSES[classId];
    if (!def) throw new Error(`Unknown hero class: ${classId}`);

    this.id = nextId++;
    this.classId = classId;
    this.label = def.label;
    this.role = def.role;
    this.formationLine = def.formationLine ?? 'back'; // front = melee, engaged first; back = ranged/support
    this.level = level;
    this.xp = 0;

    this.baseHp = def.baseHp;
    this.baseAtk = def.baseAtk;
    this.baseDef = def.baseDef;
    this.attackSpeed = def.attackSpeed;
    this.healPerSecond = def.healPerSecond || 0;

    this.equipment = { weapon: null, armor: null, trinket: null };

    this.hp = this.maxHp;
    this.attackCooldown = 0;
  }

  // Stats scale with level; equipment adds flat bonuses on top
  get maxHp() {
    const equipBonus = this._equipBonus();
    return Math.round((this.baseHp + this.level * 8) + equipBonus * 0.5);
  }

  get atk() {
    const equipBonus = this._equipBonus();
    return Math.round((this.baseAtk + this.level * 1.5) + equipBonus);
  }

  get def() {
    return Math.round(this.baseDef + this.level * 0.8);
  }

  _equipBonus() {
    return Object.values(this.equipment)
      .filter(Boolean)
      .reduce((sum, item) => sum + item.statBonus, 0);
  }

  isAlive() {
    return this.hp > 0;
  }

  equip(item) {
    if (!item || !this.equipment.hasOwnProperty(item.slot)) return;
    this.equipment[item.slot] = item;
    // Re-clamp hp if maxHp changed
    this.hp = Math.min(this.hp, this.maxHp);
  }

  gainXp(amount) {
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= xpToNextLevel(this.level)) {
      this.xp -= xpToNextLevel(this.level);
      this.level += 1;
      this.hp = this.maxHp; // full heal on level up, classic RPG feel
      leveledUp = true;
    }
    return leveledUp;
  }

  // Advance internal cooldown timer; returns true if hero should attack this tick
  tick(deltaSeconds) {
    this.attackCooldown -= deltaSeconds;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 1 / this.attackSpeed;
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.def);
    this.hp = Math.max(0, this.hp - mitigated);
    return mitigated;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  serialize() {
    return {
      classId: this.classId,
      level: this.level,
      xp: this.xp,
      hp: this.hp,
      equipment: this.equipment,
    };
  }

  static fromSave(saved) {
    const hero = new Hero(saved.classId, saved.level);
    hero.xp = saved.xp;
    Object.values(saved.equipment || {}).forEach((item) => item && hero.equip(item));
    hero.hp = saved.hp ?? hero.maxHp;
    return hero;
  }
}
