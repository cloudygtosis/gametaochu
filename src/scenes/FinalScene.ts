import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";
import { audioManager } from "../systems/audioManager";
import { dialogueLog } from "../systems/dialogueLog";
import { gameState } from "../systems/gameState";

export class FinalScene extends Phaser.Scene {
  constructor() {
    super("FinalScene");
  }

  create(): void {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");

    document.body.dataset.mood = "cutscene";
    audioManager.stopBgm();

    root.innerHTML = `
      <section class="final-screen" data-testid="final-screen">
        <video
          class="final-video"
          src="${assetManifest.videos.finale}"
          autoplay
          playsinline
          preload="auto"
          data-testid="final-video"
        ></video>
        <button class="cutscene-skip final-skip" type="button" data-testid="final-skip" aria-label="跳过">&#x8DF3;&#x8FC7;</button>
        <div class="final-overlay hidden" data-testid="final-overlay">
          <div class="final-panel">
            <h1 class="final-title">序章 · 终</h1>
            <p class="final-text">后续篇章正在开发中……</p>
            <p class="final-sub">敬请期待。</p>
            <div class="final-actions">
              <button class="final-action primary" type="button" data-action="restart">从头再来</button>
              <button class="final-action" type="button" data-action="title">返回标题</button>
            </div>
          </div>
        </div>
      </section>
    `;

    const video = root.querySelector<HTMLVideoElement>(".final-video");
    const skipButton = root.querySelector<HTMLButtonElement>(".final-skip");
    const overlay = root.querySelector<HTMLElement>(".final-overlay");

    const showOverlay = (): void => {
      if (!overlay) return;
      overlay.classList.remove("hidden");
      skipButton?.classList.add("hidden");
    };

    video?.addEventListener("ended", showOverlay);
    video?.addEventListener("error", showOverlay);
    skipButton?.addEventListener("click", () => {
      video?.pause();
      showOverlay();
    });
    void video?.play().catch(() => {
      // Autoplay with sound may be blocked; the skip button remains available.
    });

    overlay?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const action = target.dataset.action;
      this.resetSessionState();
      root.innerHTML = "";
      if (action === "title") this.scene.start("StartScene");
      else this.scene.start("CutsceneScene");
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      video?.pause();
    });
  }

  private resetSessionState(): void {
    gameState.clues.clear();
    gameState.flags = {};
    gameState.readNodes.clear();
    gameState.npcTalkCount = {};
    dialogueLog.clear();
  }
}
