// Every Nth stage is a boss stage - a single, much stronger enemy instead of a wave.
export const BOSS_INTERVAL = 10;

// Hard cap on simultaneous enemies - the strip is only ~360px wide, and
// enemies share that space with the hero party, so this keeps layout sane
// even as more heroes get added later.
export const MAX_WAVE_SIZE = 4;

/**
 * How many enemies spawn on a given stage. Ramps slowly so early stages
 * stay simple (matches the original single-enemy feel), then introduces
 * mobs as the run goes on. Boss stages are handled separately by the
 * caller (WaveSystem) - they're always a solo fight regardless of this.
 */
export function waveSizeForStage(stage) {
  return Math.min(MAX_WAVE_SIZE, 1 + Math.floor((stage - 1) / 5));
}
