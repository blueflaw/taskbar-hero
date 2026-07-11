const LUNGE_DURATION = 0.3; // total dash-out + dash-back, in seconds
const IMPACT_FRACTION = 0.45; // where in the animation the "hit" visually lands (0..1)
const LUNGE_DISTANCE = 22; // px - a hop, not a full traversal, given how small the strip is

/**
 * Start a lunge for `entry` (needs `.sprite` and `.baseX`). `direction`
 * should be +1 (lunge right, e.g. hero attacking enemy) or -1 (lunge left,
 * e.g. enemy attacking a hero). `onImpact` fires once, right as the sprite
 * reaches the peak of the lunge - that's where damage numbers/hit-flash/
 * sound should trigger, so the feedback lines up with the "contact" frame
 * instead of firing instantly when the attack is decided.
 */
export function startLunge(entry, direction, onImpact) {
  entry.lunge = { timer: 0, dx: LUNGE_DISTANCE * direction, impactFired: false, onImpact };
}

/**
 * Call every frame for every entry that might be mid-lunge. When no lunge
 * is active this just pins the sprite to its resting baseX, so external
 * animations (like an enemy spawn slide-in) should be skipped for that
 * frame rather than calling this - see game.js for how the two are sequenced.
 */
export function updateLunge(entry, deltaSeconds) {
  if (!entry.lunge) {
    entry.sprite.x = entry.baseX;
    return;
  }

  entry.lunge.timer += deltaSeconds;
  const t = Math.min(1, entry.lunge.timer / LUNGE_DURATION);

  // Triangular envelope: 0 -> 1 over [0, IMPACT_FRACTION], then 1 -> 0 back to rest.
  const envelope =
    t < IMPACT_FRACTION
      ? t / IMPACT_FRACTION
      : 1 - (t - IMPACT_FRACTION) / (1 - IMPACT_FRACTION);

  entry.sprite.x = entry.baseX + entry.lunge.dx * envelope;

  if (!entry.lunge.impactFired && t >= IMPACT_FRACTION) {
    entry.lunge.impactFired = true;
    if (entry.lunge.onImpact) entry.lunge.onImpact();
  }

  if (t >= 1) {
    entry.sprite.x = entry.baseX;
    entry.lunge = null;
  }
}
