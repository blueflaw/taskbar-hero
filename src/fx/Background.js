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
 * A subtle parallax scroller: distant hill silhouettes (slow) and a proper
 * floor band (fast, closest to camera) that the hero/enemy sprites visually
 * stand on. Deliberately kept semi-transparent and partial-height - the
 * strip's transparency (blending with the desktop) is part of the original
 * design, so this adds a sense of motion and ground without turning the
 * window into an opaque scene.
 */
export class Background {
  constructor(app, screenWidth, screenHeight, groundY) {
    this.burstSpeed = 0;

    this.hillLayer = this._buildHillLayer(app, screenWidth);
    this.floorLayer = this._buildFloorLayer(app, screenWidth, groundY);

    // Insert behind everything else already on stage (index 0 = bottom).
    app.stage.addChildAt(this.floorLayer, 0);
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

  _buildFloorLayer(app, screenWidth, groundY) {
    const tileW = 24;
    const tileH = 3;
    const gfx = new PIXI.Graphics();

    // Base path fill - a warm, neutral dirt-path tone. Baked as real colors
    // (not runtime .tint) since this layer needs several distinct shades in
    // the same texture, and .tint can only multiply a whole sprite uniformly.
    gfx.beginFill(0x4a4038, 1);
    gfx.drawRect(0, 0, tileW, tileH);
    gfx.endFill();

    // Top-edge highlight - a lighter line suggesting the path catching light.
    gfx.beginFill(0x6b5f4f, 1);
    gfx.drawRect(0, 0, tileW, 1);
    gfx.endFill();

    // A couple of small darker texture flecks (pebbles/cracks) per tile.
    gfx.beginFill(0x352c26, 1);
    gfx.drawRect(6, 2, 2, 1);
    gfx.drawRect(15, 2, 1, 1);
    gfx.endFill();

    const texture = app.renderer.generateTexture(gfx);
    gfx.destroy();

    const layer = new PIXI.TilingSprite(texture, screenWidth + tileW, tileH);
    layer.y = groundY; // top edge sits right where sprite feet are
    layer.alpha = 0.55; // more solid than the strip used to be, still blends with the desktop
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
    this.floorLayer.tilePosition.x -= speed * deltaSeconds;
  }
}
