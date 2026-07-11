import { Enemy } from '../entities/Enemy.js';
import { ENEMY_ROLES, BOSS_ROLE } from '../config/enemyRoles.js';
import { BOSS_INTERVAL, waveSizeForStage } from '../config/waveConfig.js';

export class WaveSystem {
  /**
   * Returns an array of Enemy instances in formation order (index 0 = front,
   * the one heroes attack first). Boss stages are always a solo fight;
   * everything else scales up via waveSizeForStage and cycles through the
   * tank/brawler/archer roles front-to-back.
   */
  static spawnWave(stage) {
    if (stage % BOSS_INTERVAL === 0) {
      return [new Enemy(stage, BOSS_ROLE)];
    }

    const size = waveSizeForStage(stage);
    const wave = [];
    for (let i = 0; i < size; i++) {
      wave.push(new Enemy(stage, ENEMY_ROLES[i % ENEMY_ROLES.length]));
    }
    return wave;
  }
}
