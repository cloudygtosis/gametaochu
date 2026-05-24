type TrackId = string;

interface TrackHandle {
  id: TrackId;
  el: HTMLAudioElement;
  baseVolume: number;
}

const STORAGE_KEY = "taochu.audio";

interface AudioPrefs {
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { muted: false, bgmVolume: 0.55, sfxVolume: 0.8 };
    return { muted: false, bgmVolume: 0.55, sfxVolume: 0.8, ...JSON.parse(raw) };
  } catch {
    return { muted: false, bgmVolume: 0.55, sfxVolume: 0.8 };
  }
}

function savePrefs(prefs: AudioPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable; preferences fall back to defaults next session.
  }
}

export class AudioManager {
  private prefs: AudioPrefs = loadPrefs();
  private current?: TrackHandle;
  private tracks = new Map<TrackId, string>();
  private sfxPool = new Map<string, HTMLAudioElement>();
  private unlocked = false;

  registerBgm(id: TrackId, url: string): void {
    this.tracks.set(id, url);
  }

  registerSfx(id: TrackId, url: string): void {
    this.tracks.set(id, url);
  }

  /** Call from first user gesture so future plays work on iOS Safari. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.current && !this.prefs.muted) {
      void this.current.el.play().catch(() => undefined);
    }
  }

  playBgm(id: TrackId | undefined, volume = 0.55): void {
    if (!id) {
      this.stopBgm();
      return;
    }
    if (this.current?.id === id) return;
    const url = this.tracks.get(id);
    if (!url) {
      this.stopBgm();
      return;
    }
    this.stopBgm();
    const el = new Audio(url);
    el.loop = true;
    el.volume = this.prefs.muted ? 0 : volume * this.prefs.bgmVolume;
    el.preload = "auto";
    this.current = { id, el, baseVolume: volume };
    if (!this.prefs.muted) {
      void el.play().catch(() => undefined);
    }
  }

  stopBgm(): void {
    if (!this.current) return;
    this.current.el.pause();
    this.current.el.src = "";
    this.current = undefined;
  }

  playSfx(id: TrackId, volume = 1): void {
    if (this.prefs.muted) return;
    const url = this.tracks.get(id);
    if (!url) return;
    let pooled = this.sfxPool.get(id);
    if (!pooled) {
      pooled = new Audio(url);
      this.sfxPool.set(id, pooled);
    }
    pooled.currentTime = 0;
    pooled.volume = Math.min(1, volume * this.prefs.sfxVolume);
    void pooled.play().catch(() => undefined);
  }

  setMuted(muted: boolean): void {
    this.prefs.muted = muted;
    savePrefs(this.prefs);
    if (this.current) {
      this.current.el.volume = muted ? 0 : this.current.baseVolume * this.prefs.bgmVolume;
      if (muted) this.current.el.pause();
      else void this.current.el.play().catch(() => undefined);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.prefs.muted);
    return this.prefs.muted;
  }

  get muted(): boolean {
    return this.prefs.muted;
  }
}

export const audioManager = new AudioManager();
