import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";

export class CutsceneScene extends Phaser.Scene {
  constructor() {
    super("CutsceneScene");
  }

  create(): void {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");

    document.body.dataset.mood = "cutscene";
    root.innerHTML = `
      <section class="cutscene-screen" data-testid="cutscene-screen">
        <video
          class="cutscene-video"
          src="${assetManifest.videos.cutscene}"
          poster="${assetManifest.videos.cutscenePoster}"
          autoplay
          playsinline
          preload="auto"
          data-testid="cutscene-video"
        ></video>
        <button class="cutscene-skip" type="button" data-testid="cutscene-skip" aria-label="&#x8DF3;&#x8FC7;&#x8FC7;&#x573A;CG">&#x8DF3;&#x8FC7;</button>
      </section>
    `;

    const video = root.querySelector<HTMLVideoElement>(".cutscene-video");
    const skipButton = root.querySelector<HTMLButtonElement>(".cutscene-skip");

    let hasFinished = false;
    const finish = (): void => {
      if (hasFinished) return;
      hasFinished = true;
      video?.pause();
      root.innerHTML = "";
      this.scene.start("VnScene", { startSceneId: "prologue_arrival", exitScene: "ExploreScene" });
    };

    skipButton?.addEventListener("click", finish);
    video?.addEventListener("ended", finish);
    video?.addEventListener("error", finish);
    void video?.play().catch(() => {
      // If a browser blocks autoplay with sound, keep the skip affordance available.
    });

    this.input.keyboard?.on("keydown-ESC", finish);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      video?.pause();
      this.input.keyboard?.off("keydown-ESC", finish);
    });
  }
}
