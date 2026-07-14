import * as PIXI from 'pixi.js';

const SPARK_DURATION = 0.16; // seconds

/**
 * A brief 4-point burst at an impact point - cheap visual "oomph" for both
 * melee collisions and projectile arrivals. Purely decorative, no game logic.
 */
export class ImpactSparkManager {
  constructor(stage) {
    this.stage = stage;
    this.active = [];
  }

  spawn(x, y, color = 0xffffff) {
    const gfx = new PIXI.Graphics();
    gfx.lineStyle(1.2, color, 1);
    const r = 3;
    gfx.moveTo(-r, 0).lineTo(r, 0);
    gfx.moveTo(0, -r).lineTo(0, r);
    gfx.moveTo(-r * 0.7, -r * 0.7).lineTo(r * 0.7, r * 0.7);
    gfx.moveTo(-r * 0.7, r * 0.7).lineTo(r * 0.7, -r * 0.7);
    gfx.x = x;
    gfx.y = y;
    this.stage.addChild(gfx);
    this.active.push({ gfx, timer: 0 });
  }

  update(deltaSeconds) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const spark = this.active[i];
      spark.timer += deltaSeconds;
      const t = spark.timer / SPARK_DURATION;

      if (t >= 1) {
        this.stage.removeChild(spark.gfx);
        spark.gfx.destroy();
        this.active.splice(i, 1);
        continue;
      }

      spark.gfx.scale.set(1 + t * 1.5);
      spark.gfx.alpha = 1 - t;
    }
  }
}
