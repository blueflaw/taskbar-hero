const FLASH_DURATION = 0.15; // seconds
const FLASH_TINT = { r: 0xff, g: 0x99, b: 0x99 }; // reddish-white flash
const PUNCH_SCALE = 0.18; // extra scale at the peak of the punch, relative to base

function toRgb(hex) {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

function lerpColor(from, to, t) {
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return (r << 16) + (g << 8) + b;
}

/**
 * Call once when an entity takes damage. `entry` is any object with a
 * `.sprite` (PIXI.Sprite) and `.baseScale` (number) - see game.js for how
 * hero/enemy entries are built. `entry.baseTint` is optional (defaults to
 * white/no-tint) - set it for entries that need a persistent color, like a
 * boss enemy, and the flash will blend from that color instead of white.
 */
export function triggerHitFlash(entry) {
  entry.hitTimer = FLASH_DURATION;
}

/**
 * Call every frame for every entry that might be mid-flash. Cheap no-op
 * once hitTimer has expired - but still re-applies baseTint/baseScale each
 * frame so external changes (e.g. an enemy becoming a boss mid-game) show up
 * immediately rather than waiting for the next flash to "refresh" them.
 */
export function updateHitFlash(entry, deltaSeconds) {
  const baseTint = entry.baseTint ?? 0xffffff;

  if (!entry.hitTimer || entry.hitTimer <= 0) {
    entry.sprite.tint = baseTint;
    entry.sprite.scale.set(entry.baseScale);
    return;
  }

  entry.hitTimer -= deltaSeconds;
  const progress = Math.max(0, entry.hitTimer / FLASH_DURATION); // 1 -> 0

  entry.sprite.tint = lerpColor(toRgb(baseTint), FLASH_TINT, progress);
  const scale = entry.baseScale * (1 + PUNCH_SCALE * progress);
  entry.sprite.scale.set(scale);

  if (entry.hitTimer <= 0) {
    entry.hitTimer = 0;
    entry.sprite.tint = baseTint;
    entry.sprite.scale.set(entry.baseScale);
  }
}
