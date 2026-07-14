import * as PIXI from 'pixi.js';

const COIN_COUNT = 3;
const COIN_DURATION = 0.6; // seconds
const GRAVITY = 220; // px/sec^2 - coins pop up/out then fall as they fade

/**
 * A small handful of coins that pop out, arc, and fall while fading -
 * purely decorative "kill reward" feedback. Fires per enemy death (see the
 * 'enemy-killed' handler in game.js) even though actual gold is only
 * credited once the whole wave clears - this is cosmetic, not the ledger.
 */
export class CoinBurstManager {
  constructor(stage) {
    this.stage = stage;
    this.active = [];
  }

  spawn(x, y) {
    for (let i = 0; i < COIN_COUNT; i++) {
      const gfx = new PIXI.Graphics();
      gfx.beginFill(0xffd35c);
      gfx.lineStyle(0.5, 0xa87b1a, 1);
      gfx.drawCircle(0, 0, 2);
      gfx.endFill();
      gfx.x = x;
      gfx.y = y;

      // Fan the coins out in a small upward arc, not straight up - reads
      // more like a "burst" than a single trail.
      const angle = (Math.PI / 3) * (i - (COIN_COUNT - 1) / 2) - Math.PI / 2;
      const speed = 60 + Math.random() * 30;

      this.stage.addChild(gfx);
      this.active.push({
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        timer: 0,
      });
    }
  }

  update(deltaSeconds) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const coin = this.active[i];
      coin.timer += deltaSeconds;
      coin.vy += GRAVITY * deltaSeconds;
      coin.gfx.x += coin.vx * deltaSeconds;
      coin.gfx.y += coin.vy * deltaSeconds;

      const t = coin.timer / COIN_DURATION;
      coin.gfx.alpha = Math.max(0, 1 - t);

      if (t >= 1) {
        this.stage.removeChild(coin.gfx);
        coin.gfx.destroy();
        this.active.splice(i, 1);
      }
    }
  }
}
