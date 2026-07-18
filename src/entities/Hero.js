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
    this.baseArmor = def.baseArmor;
    this.healPerSecond = def.healPerSecond || 0;

    // Base (unequipped) values for every equippable stat - each has a
    // matching getter below that adds whatever equipment currently
    // contributes to that same stat key. See config/heroClasses.js for
    // where to tune these per class, and config/weaponTypes.js /
    // lootTables.js for how equipment grants bonuses to these same keys.
    this._baseAttackSpeed = def.attackSpeed;
    this._baseCritChance = def.critChance ?? 0;
    this._baseCritDamageMult = def.critDamageMult ?? 1.5;
    this._baseCooldownReduction = def.cooldownReduction ?? 0;
    this._baseMoveSpeed = def.moveSpeed ?? 1.0;
    this._baseCastSpeed = def.castSpeed ?? 1.0; // reserved - see README, not wired to a mechanic yet

    this.equipment = { weapon: null, armor: null, trinket: null };

    this.hp = this.maxHp;
    this._cooldownTimer = 0;
  }

  // Sums a given stat key across all currently-equipped items - e.g.
  // _equipmentBonus('atk') adds up every equipped item's stats.atk. Any
  // stat key an item grants "just works" here with no extra wiring, as
  // long as a getter below reads it.
  _equipmentBonus(statKey) {
    return Object.values(this.equipment)
      .filter(Boolean)
      .reduce((sum, item) => sum + (item.stats?.[statKey] ?? 0), 0);
  }

  // Stats scale with level; equipment adds flat bonuses on top.
  get maxHp() {
    return Math.round((this.baseHp + this.level * 8) + this._equipmentBonus('hp'));
  }

  get atk() {
    return Math.round((this.baseAtk + this.level * 1.5) + this._equipmentBonus('atk'));
  }

  get armor() {
    return Math.round((this.baseArmor + this.level * 0.8) + this._equipmentBonus('armor'));
  }

  get attackSpeed() {
    return this._baseAttackSpeed + this._equipmentBonus('attackSpeed');
  }

  get critChance() {
    return this._baseCritChance + this._equipmentBonus('critChance');
  }

  get critDamageMult() {
    return this._baseCritDamageMult + this._equipmentBonus('critDamageMult');
  }

  get cooldownReduction() {
    return this._baseCooldownReduction + this._equipmentBonus('cooldownReduction');
  }

  get moveSpeed() {
    return this._baseMoveSpeed + this._equipmentBonus('moveSpeed');
  }

  get castSpeed() {
    return this._baseCastSpeed + this._equipmentBonus('castSpeed');
  }

  // Effective attacks/sec after cooldownReduction shrinks the gap between
  // them - this is what tick() actually uses, and what "Basic Attack DPS"
  // (below) is computed from.
  get effectiveAttackSpeed() {
    return this.attackSpeed / (1 - this.cooldownReduction);
  }

  // Expected damage per second from basic attacks alone, crit included on
  // average (not a single-hit number - see CombatSystem for the actual
  // per-hit crit roll). Useful as a single "how strong is this build" stat.
  get dps() {
    const critFactor = 1 + this.critChance * (this.critDamageMult - 1);
    return this.atk * this.effectiveAttackSpeed * critFactor;
  }

  isAlive() {
    return this.hp > 0;
  }

  // True if this hero's class is allowed to equip `item` - class-restricted
  // weapons (see config/weaponTypes.js) set item.allowedClasses; anything
  // else (armor/trinkets today) is universal.
  canEquip(item) {
    if (!item) return false;
    if (!item.allowedClasses) return true;
    return item.allowedClasses.includes(this.classId);
  }

  equip(item) {
    if (!item || !this.equipment.hasOwnProperty(item.slot)) return false;
    if (!this.canEquip(item)) return false;
    this.equipment[item.slot] = item;
    // Re-clamp hp if maxHp changed
    this.hp = Math.min(this.hp, this.maxHp);
    return true;
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
    this._cooldownTimer -= deltaSeconds;
    if (this._cooldownTimer <= 0) {
      this._cooldownTimer = 1 / this.effectiveAttackSpeed;
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    const mitigated = Math.max(1, amount - this.armor);
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
