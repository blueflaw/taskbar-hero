const SFX_PATHS = {
  'hit-dealt': 'assets/sfx/hit-dealt.wav',
  'hit-taken': 'assets/sfx/hit-taken.wav',
  'level-up': 'assets/sfx/level-up.wav',
  'loot-drop': 'assets/sfx/loot-drop.wav',
};

/**
 * Thin wrapper around HTMLAudioElement for short one-shot SFX.
 * Swap the files in src/assets/sfx/ with real sound design later - same
 * keys, same call sites, nothing else needs to change.
 */
export class SoundManager {
  constructor(volume = 0.5) {
    this.volume = volume;
    this.muted = false;
    // Pre-create one Audio() per clip so the browser caches/decodes it once;
    // play() clones a fresh element per trigger so overlapping hits don't cut each other off.
    this.templates = {};
    for (const [key, path] of Object.entries(SFX_PATHS)) {
      const audio = new Audio(path);
      audio.volume = this.volume;
      this.templates[key] = audio;
    }
  }

  play(key) {
    if (this.muted) return;
    const template = this.templates[key];
    if (!template) return;

    const instance = template.cloneNode();
    instance.volume = this.volume;
    // Autoplay-policy or decode failures shouldn't ever crash the game loop -
    // swallow and move on, same instinct as the tray try/catch.
    instance.play().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
  }

  setVolume(volume) {
    this.volume = volume;
    Object.values(this.templates).forEach((a) => (a.volume = volume));
  }
}
