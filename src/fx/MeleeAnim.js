const TRAVEL_SPEED = 900; // px/sec - a fast dash; actual duration scales with distance
const MIN_TRAVEL_DURATION = 0.1; // floor so very short hops don't feel like a jitter
const MAX_TRAVEL_DURATION = 0.35; // ceiling so a long dash across the strip doesn't drag

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * One-way travel from wherever `entry` currently rests to `targetX`, then
 * HOLDS there - unlike a lunge, this doesn't automatically return. `entry`
 * needs `.sprite` and `.baseX` (its formation slot); `.restX` tracks where
 * it's actually standing right now (defaults to baseX until the first
 * travel completes). Call this again with a new targetX to move on (e.g.
 * the current target died and combat has moved to the next enemy in line),
 * or with `entry.baseX` itself to send it back to formation - see game.js
 * for the engage/disengage state machine built on top of this.
 *
 * `speedMultiplier` (default 1) scales TRAVEL_SPEED - pass the attacker's
 * `moveSpeed` stat here (Hero.moveSpeed / Enemy.moveSpeed, see
 * config/heroClasses.js and config/enemyRoles.js) so a faster unit actually
 * closes distance faster, not just "wins initiative" more often.
 */
export function travelTo(entry, targetX, onArrive, speedMultiplier = 1) {
  const fromX = entry.restX ?? entry.baseX;
  const distance = Math.abs(targetX - fromX);
  const duration = clamp(distance / (TRAVEL_SPEED * speedMultiplier), MIN_TRAVEL_DURATION, MAX_TRAVEL_DURATION);
  entry.travel = { fromX, targetX, timer: 0, duration, onArrive };
}

/**
 * Call every frame for every entry that might be mid-travel. When nothing
 * is in progress this pins the sprite to `restX` (or `baseX` if it's never
 * moved), so external animations (enemy spawn slide-in, death fade) should
 * be skipped for that frame rather than calling this - see game.js.
 */
export function updateTravel(entry, deltaSeconds) {
  if (!entry.travel) {
    entry.sprite.x = entry.restX ?? entry.baseX;
    return;
  }

  entry.travel.timer += deltaSeconds;
  const t = Math.min(1, entry.travel.timer / entry.travel.duration);
  const eased = 1 - Math.pow(1 - t, 2); // ease-out - quick start, gentle arrival

  entry.sprite.x = entry.travel.fromX + (entry.travel.targetX - entry.travel.fromX) * eased;

  if (t >= 1) {
    entry.restX = entry.travel.targetX;
    entry.sprite.x = entry.restX;
    const onArrive = entry.travel.onArrive;
    entry.travel = null;
    if (onArrive) onArrive();
  }
}
