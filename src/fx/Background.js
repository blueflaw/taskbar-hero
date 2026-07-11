import * as PIXI from 'pixi.js';

const BASE_SPEED = 12; // px/sec baseline scroll, sells constant forward travel
const BURST_DECAY = 140; // px/sec^2 - how fast a pulse's extra speed fades

const NORMAL_TINT = { r: 0x8a, g: 0x7a, b: 0xd1 };
const DANGER_TINT = { r: 0xe0, g: 0x48, b: 0x48 }; // matches the app's red accent

function lerpColor(from, to, t) {
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return (r << 16) + (g << 8) + b;
}

/**
 * A subtle two-layer parallax scroller: distant hill silhouettes (slow) and
 * near ground ticks (fast). Deliberately kept low-alpha and partial-height -
 * the strip's transparency (blending with the desktop) is part of the
 * original design, so this adds a sense of motion without turning the
 * window into an opaque scene.
 */
export class Background {
  constructor(app, screenWidth, screenHeight, groundY) {
    this.burstSpeed = 0;

    this.hillLayer = this._buildHillLayer(app, screenWidth);
    this.groundLayer = this._buildGroundLayer(app, screenWidth, groundY);

    // Insert behind everything else already on stage (index 0 = bottom).
    app.stage.addChildAt(this.groundLayer, 0);
    app.stage.addChildAt(this.hillLayer, 0);
  }

  _buildHillLayer(app, screenWidth) {
    const tileW = 60;
    const tileH = 16;
    const gfx = new PIXI.Graphics();
    gfx.beginFill(0xffffff, 1); // tinted at runtime via .tint
    gfx.moveTo(0, tileH);
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * tileW;
      // One full sine period across the tile width -> seamless tiling.
      const y = tileH - 6 - Math.sin((i / steps) * Math.PI * 2) * 5;
      gfx.lineTo(x, y);
    }
    gfx.lineTo(tileW, tileH);
    gfx.closePath();
    gfx.endFill();

    const texture = app.renderer.generateTexture(gfx);
    gfx.destroy();

    const layer = new PIXI.TilingSprite(texture, screenWidth + tileW, tileH);
    layer.y = 6;
    layer.alpha = 0.22;
    layer.tint = (NORMAL_TINT.r << 16) + (NORMAL_TINT.g << 8) + NORMAL_TINT.b;
    return layer;
  }

  _buildGroundLayer(app, screenWidth, groundY) {
    const tileW = 18;
    const tileH = 2;
    const gfx = new PIXI.Graphics();
    // PIXI's generateTexture bounds itself to the drawn geometry's bounding
    // box - without this near-invisible full-tile rect first, the texture
    // would collapse to just the 3px tick mark and tile edge-to-edge with
    // no gap (a solid line instead of dashes). This establishes the gap.
    gfx.beginFill(0xffffff, 0.001);
    gfx.drawRect(0, 0, tileW, tileH);
    gfx.endFill();
    gfx.beginFill(0xffffff, 1);
    gfx.drawRect(0, 0, 3, tileH);
    gfx.endFill();

    const texture = app.renderer.generateTexture(gfx);
    gfx.destroy();

    const layer = new PIXI.TilingSprite(texture, screenWidth + tileW, tileH);
    layer.y = groundY + 1;
    layer.alpha = 0.35;
    return layer;
  }

  /** Call once when a stage transitions (enemy defeated) - a quick speed burst
   * that decays back to baseline, selling "we just moved on to the next fight." */
  pulse() {
    this.burstSpeed = 70;
  }

  /** t: 0 (just past a boss) .. 1 (next boss stage imminent). Shifts the hill
   * tint from its normal purple toward the app's danger red as tension builds. */
  setBossProximity(t) {
    this.hillLayer.tint = lerpColor(NORMAL_TINT, DANGER_TINT, Math.max(0, Math.min(1, t)));
  }

  update(deltaSeconds) {
    this.burstSpeed = Math.max(0, this.burstSpeed - BURST_DECAY * deltaSeconds);
    const speed = BASE_SPEED + this.burstSpeed;

    this.hillLayer.tilePosition.x -= speed * 0.4 * deltaSeconds; // slower = further away
    this.groundLayer.tilePosition.x -= speed * deltaSeconds;
  }
}
