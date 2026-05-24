import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";
import { audioManager } from "../systems/audioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    Object.entries(assetManifest.backgrounds).forEach(([key, url]) => {
      this.load.image(key, url);
    });
    Object.entries(assetManifest.sprites).forEach(([key, url]) => {
      this.load.spritesheet(key, url, { frameWidth: 32, frameHeight: 48 });
    });
    Object.entries(assetManifest.worldImages).forEach(([key, url]) => {
      this.load.image(key, url);
    });
  }

  create(): void {
    // Audio track URLs are placeholders — drop real files into public/assets/audio/ and
    // playback will kick in automatically. Until then, registerBgm calls no-op on play.
    this.registerAudio();

    const params = new URLSearchParams(window.location.search);
    if (params.get("scene") === "explore") {
      const x = Number(params.get("x"));
      const y = Number(params.get("y"));
      this.scene.start("ExploreScene", {
        roomId: params.get("room") ?? "hub",
        spawn: params.has("x") && params.has("y") && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined
      });
      return;
    }
    this.scene.start("StartScene");
  }

  private registerAudio(): void {
    const candidates: Array<[string, string]> = [
      ["bgm_prologue", "/assets/audio/bgm_prologue.mp3"],
      ["bgm_town", "/assets/audio/bgm_town.mp3"],
      ["bgm_hanfu", "/assets/audio/bgm_hanfu.mp3"],
      ["bgm_dressing", "/assets/audio/bgm_dressing.mp3"],
      ["bgm_horror", "/assets/audio/bgm_horror.mp3"]
    ];
    for (const [id, url] of candidates) {
      void fetch(url, { method: "HEAD" })
        .then((response) => {
          if (response.ok) audioManager.registerBgm(id, url);
        })
        .catch(() => undefined);
    }
  }
}
