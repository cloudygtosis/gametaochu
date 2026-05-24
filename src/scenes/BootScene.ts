import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";

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
}
