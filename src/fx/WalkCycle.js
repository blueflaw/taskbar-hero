const FRAME_INTERVAL = 0.15; // seconds between leg-swap frames
const BOB_AMPLITUDE = 1.5; // px vertical bob, synced to the frame swap

/**
 * Starts a "marching in place" animation on `entry` for `duration` seconds -
 * alternates between two walk textures and adds a small vertical bob. This
 * doesn't move the sprite horizontally at all; it's meant to play while the
 * background scrolls faster (Background.pulse()), so the *world* moving
 * past a stationary, walking-looking hero reads as "we're traveling to the
 * next fight" - a classic treadmill effect, and it keeps the formation
 * position system (which several other systems depend on) untouched.
 */
export function startMarching(entry, duration) {
  entry.marching = { timer: 0, duration, frameTimer: 0, frameIndex: 0 };
}

/**
 * Call every frame for every entry that might be marching. `groundY` is the
 * sprite's normal resting y (bobbing is relative to it, not additive frame
 * to frame, so there's no drift). `walkTextures` is a [frame0, frame1]
 * pair; `idleTexture` is restored once the animation finishes. If
 * `walkTextures` is missing or incomplete, this becomes a no-op bob with no
 * texture swap - a class without walk art yet just won't visibly march,
 * rather than throwing.
 */
export function updateMarching(entry, deltaSeconds, groundY, walkTextures, idleTexture) {
  if (!entry.marching) return;

  const m = entry.marching;
  m.timer += deltaSeconds;
  m.frameTimer += deltaSeconds;

  if (m.frameTimer >= FRAME_INTERVAL) {
    m.frameTimer = 0;
    m.frameIndex = 1 - m.frameIndex;
    if (walkTextures && walkTextures[m.frameIndex]) {
      entry.sprite.texture = walkTextures[m.frameIndex];
    }
  }

  entry.sprite.y = groundY - (m.frameIndex === 0 ? BOB_AMPLITUDE : 0);

  if (m.timer >= m.duration) {
    entry.marching = null;
    entry.sprite.y = groundY;
    if (idleTexture) entry.sprite.texture = idleTexture;
  }
}
