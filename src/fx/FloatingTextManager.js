import * as PIXI from 'pixi.js';

const RISE_SPEED = 18; // px/sec
const LIFETIME = 0.7; // seconds

const STYLE_CACHE = {};

function styleFor(color) {
  if (!STYLE_CACHE[color]) {
    STYLE_CACHE[color] = new PIXI.TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: color,
      stroke: 0x000000,
      strokeThickness: 2,
    });
  }
  return STYLE_CACHE[color];
}

/**
 * Manages a pool of floating combat-text instances (damage numbers, heals).
 * Rendering-only - has no opinion about game rules, just draws numbers that
 * rise and fade.
 */
export class FloatingTextManager {
  constructor(stage) {
    this.stage = stage;
    this.active = [];
  }

  spawn(x, y, text, color = 0xffffff) {
    const label = new PIXI.Text(text, styleFor(color));
    label.anchor.set(0.5, 1);
    label.x = x + (Math.random() * 10 - 5); // slight horizontal jitter so stacked hits don't overlap exactly
    label.y = y;
    this.stage.addChild(label);
    this.active.push({ label, life: LIFETIME });
  }

  update(deltaSeconds) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      entry.life -= deltaSeconds;
      entry.label.y -= RISE_SPEED * deltaSeconds;
      entry.label.alpha = Math.max(0, entry.life / LIFETIME);

      if (entry.life <= 0) {
        this.stage.removeChild(entry.label);
        entry.label.destroy();
        this.active.splice(i, 1);
      }
    }
  }
}
