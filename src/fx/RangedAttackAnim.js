const DRAW_DURATION = 0.12; // pull back / nock the arrow
const RECOIL_DURATION = 0.1; // snap through release and settle
const DRAW_PULL = 5; // px pulled back away from the target during the draw
const RECOIL_OVERSHOOT = 3; // px pushed past resting toward the target on release

/**
 * A small, purely-visual "draw back, then release" flourish for ranged
 * attackers (Ranger hero, Archer enemy role) - since they don't lunge or
 * travel anywhere, this gives their own sprite some motion instead of
 * standing perfectly still while the projectile does all the work.
 * `direction` is +1 if the attacker faces right (toward the target), -1 if
 * it faces left. `onRelease` fires exactly once, at the draw->recoil
 * transition - that's where game.js should actually spawn the projectile,
 * so the arrow visually leaves right as the bow snaps forward.
 */
export function startDrawAndRelease(entry, direction, onRelease) {
  entry.rangedAnim = { phase: 'draw', timer: 0, direction, onRelease, released: false };
}

/**
 * Call every frame for every entry that might be mid-draw/recoil - AFTER
 * updateTravel for that same entry, not instead of it. Applies a small x
 * offset on top of wherever updateTravel already put the sprite this frame
 * (its resting position), rather than owning position outright.
 */
export function updateRangedAnim(entry, deltaSeconds) {
  if (!entry.rangedAnim) return;

  const anim = entry.rangedAnim;
  anim.timer += deltaSeconds;

  if (anim.phase === 'draw') {
    const t = Math.min(1, anim.timer / DRAW_DURATION);
    entry.sprite.x -= anim.direction * DRAW_PULL * t;

    if (t >= 1) {
      anim.phase = 'recoil';
      anim.timer = 0;
      if (!anim.released) {
        anim.released = true;
        if (anim.onRelease) anim.onRelease();
      }
    }
    return;
  }

  // Recoil phase: sweep from the pulled-back offset, through neutral, to a
  // small forward overshoot, then settle back to neutral as it finishes.
  const t = Math.min(1, anim.timer / RECOIL_DURATION);
  const pulledBack = -anim.direction * DRAW_PULL;
  const overshoot = anim.direction * RECOIL_OVERSHOOT;
  const swing =
    t < 0.5
      ? pulledBack + (overshoot - pulledBack) * (t / 0.5)
      : overshoot * (1 - (t - 0.5) / 0.5);
  entry.sprite.x += swing;

  if (t >= 1) {
    entry.rangedAnim = null;
  }
}
