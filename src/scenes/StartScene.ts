import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";

export class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
  }

  create(): void {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");

    document.body.dataset.mood = "title";
    root.innerHTML = `
      <section class="start-screen" data-testid="start-screen">
        <video
          class="start-video"
          src="${assetManifest.videos.intro}"
          poster="${assetManifest.videos.poster}"
          autoplay
          muted
          loop
          playsinline
          preload="auto"
          aria-hidden="true"
        ></video>
        <div class="start-shade" aria-hidden="true"></div>
        <div class="start-content">
          <button class="start-button" type="button" data-testid="start-button" aria-label="&#x5F00;&#x59CB;&#x6E38;&#x620F;">
            <img src="${assetManifest.ui.startButton}" alt="" aria-hidden="true" />
            <span>&#x5F00;&#x59CB;&#x6E38;&#x620F;</span>
          </button>
        </div>
      </section>
    `;

    const video = root.querySelector<HTMLVideoElement>(".start-video");
    void video?.play().catch(() => {
      // Muted autoplay can still be blocked in some browser modes; the screen remains usable.
    });

    let hasStarted = false;
    const begin = (): void => {
      if (hasStarted) return;
      hasStarted = true;
      root.innerHTML = "";
      this.scene.start("CutsceneScene");
    };

    root.querySelector<HTMLButtonElement>(".start-button")?.addEventListener("click", begin);
    this.input.keyboard?.on("keydown-ENTER", begin);
    this.input.keyboard?.on("keydown-SPACE", begin);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ENTER", begin);
      this.input.keyboard?.off("keydown-SPACE", begin);
    });
  }
}
