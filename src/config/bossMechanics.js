// Boss-only mechanics - a normal enemy never checks these, only role === 'boss' does.

// Once a boss's hp drops to/below this fraction of max, it permanently
// enrages: faster attacks and more damage. One-time trigger per boss.
export const ENRAGE_HP_FRACTION = 0.5;
export const ENRAGE_ATK_MULT = 1.3;
export const ENRAGE_COOLDOWN_MULT = 0.65; // lower = faster attacks after enraging

// Every Nth attack a boss lands is a "heavy" hit - extra damage, and on the
// rendering side a distinct telegraph/impact instead of a normal swing.
export const HEAVY_ATTACK_INTERVAL = 3;
export const HEAVY_ATTACK_MULT = 2.0;
