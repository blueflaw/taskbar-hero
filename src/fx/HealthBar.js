import * as PIXI from 'pixi.js';

const BAR_WIDTH = 22;
const BAR_HEIGHT = 3;
const GAP_ABOVE_SPRITE = 4; // px between the sprite's visual top and the bar

const LOW = { r: 0xe0, g: 0x48, b: 0x48 }; // red, matches the app's danger accent
const MID = { r: 0xe0, g: 0xc0, b: 0x48 }; // yellow
const HIGH = { r: 0x5f, g: 0xd6, b: 0x6a }; // green

function lerpColor(from, to, t) {
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return (r << 16) + (g << 8) + b;
}

// Green above 50% hp, sliding through yellow down to red as it empties.
function colorForFraction(t) {
  return t > 0.5 ? lerpColor(MID, HIGH, (t - 0.5) * 2) : lerpColor(LOW, MID, t * 2);
}

/**
 * A tiny hp bar that sits above a sprite. Owns its own PIXI display objects -
 * call destroy() when the thing it's tracking (e.g. a defeated enemy) goes away.
 */
export class HealthBar {
  constructor(stage) {
    this.container = new PIXI.Container();

    this.back = new PIXI.Graphics();
    this.back.beginFill(0x100e17, 0.75);
    this.back.drawRect(0, 0, BAR_WIDTH, BAR_HEIGHT);
    this.back.endFill();

    this.fill = new PIXI.Graphics();

    this.container.addChild(this.back);
    this.container.addChild(this.fill);
    stage.addChild(this.container);
  }

  /**
   * @param hpFraction 0..1
   * @param centerX where the sprite currently is (follows lunges/slide-ins)
   * @param spriteTopY the sprite's visual top edge in stage coordinates
   */
  update(hpFraction, centerX, spriteTopY) {
    const frac = Math.max(0, Math.min(1, hpFraction));

    this.fill.clear();
    this.fill.beginFill(colorForFraction(frac));
    this.fill.drawRect(0, 0, BAR_WIDTH * frac, BAR_HEIGHT);
    this.fill.endFill();

    this.container.x = centerX - BAR_WIDTH / 2;
    // Clamp so a boss (scaled above the strip's own height) doesn't push its
    // bar off the top edge and out of view.
    this.container.y = Math.max(1, spriteTopY - BAR_HEIGHT - GAP_ABOVE_SPRITE);
    this.container.visible = frac > 0;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
