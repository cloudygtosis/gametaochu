import Phaser from "phaser";
import { assetManifest, type PortraitKey } from "../data/assetManifest";
import prologueRaw from "../data/scenes/prologue_arrival.json";
import scene4Raw from "../data/scenes/scene4_hanfu_interior.json";
import scene5Raw from "../data/scenes/scene5_dressingroom.json";
import scene6Raw from "../data/scenes/scene6_after_crossing.json";
import { audioManager } from "../systems/audioManager";
import { dialogueLog } from "../systems/dialogueLog";
import { gameState } from "../systems/gameState";
import { VnRuntime } from "../systems/vnRuntime";
import type { ChoiceOption, RuntimeNode, SceneScript } from "../systems/vnTypes";

const scripts = [prologueRaw, scene4Raw, scene5Raw, scene6Raw] as unknown as SceneScript[];

const TYPEWRITER_CPS = 38;
const AUTO_DELAY_MS = 1600;

interface VnElements {
  root: HTMLElement;
  sceneTitle: HTMLElement;
  leftPortrait: HTMLImageElement;
  rightPortrait: HTMLImageElement;
  speaker: HTMLElement;
  text: HTMLElement;
  continueButton: HTMLButtonElement;
  dialogue: HTMLElement;
  choices: HTMLElement;
  menu: HTMLElement;
  confirm: HTMLButtonElement;
  cancel: HTMLButtonElement;
  menuButton: HTMLButtonElement;
  skipButton: HTMLButtonElement;
  autoButton: HTMLButtonElement;
  logButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  logPanel: HTMLElement;
  logCloseButton: HTMLButtonElement;
}

export class VnScene extends Phaser.Scene {
  private runtime!: VnRuntime;
  private bg?: Phaser.GameObjects.Image;
  private redOverlay?: Phaser.GameObjects.Rectangle;
  private currentBackground = "";
  private elements!: VnElements;
  private lastSceneId = "";
  private playedEffects = new Set<string>();
  private exitScene?: string;
  private typingTimer?: Phaser.Time.TimerEvent;
  private autoTimer?: Phaser.Time.TimerEvent;
  private isTyping = false;
  private pendingText = "";
  private autoMode = false;
  private skipMode = false;
  private keyHandlers: { event: string; fn: () => void }[] = [];

  constructor() {
    super("VnScene");
  }

  create(): void {
    const data = (this.scene.settings.data ?? {}) as { startSceneId?: string; exitScene?: string };
    this.exitScene = data.exitScene;
    this.runtime = new VnRuntime(scripts, data.startSceneId ?? "prologue_arrival", { ...gameState.flags });
    this.redOverlay = this.add.rectangle(360, 640, 720, 1280, 0x8b0018, 0).setDepth(5);
    this.elements = this.createOverlay();
    this.bindKeyboard();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.renderNode(this.runtime.current);
  }

  private bindKeyboard(): void {
    const map: { event: string; fn: () => void }[] = [
      { event: "keydown-ENTER", fn: () => this.handleConfirm() },
      { event: "keydown-SPACE", fn: () => this.handleConfirm() },
      { event: "keydown-ESC", fn: () => this.toggleMenu() },
      { event: "keydown-ONE", fn: () => this.pickChoiceByIndex(0) },
      { event: "keydown-TWO", fn: () => this.pickChoiceByIndex(1) },
      { event: "keydown-THREE", fn: () => this.pickChoiceByIndex(2) },
      { event: "keydown-FOUR", fn: () => this.pickChoiceByIndex(3) },
      { event: "keydown-A", fn: () => this.toggleAuto() },
      { event: "keydown-S", fn: () => this.toggleSkip() },
      { event: "keydown-L", fn: () => this.toggleLog() },
      { event: "keydown-M", fn: () => this.toggleMute() }
    ];
    for (const { event, fn } of map) {
      this.input.keyboard?.on(event, fn);
      this.keyHandlers.push({ event, fn });
    }
  }

  private teardown(): void {
    this.typingTimer?.remove(false);
    this.autoTimer?.remove(false);
    for (const { event, fn } of this.keyHandlers) this.input.keyboard?.off(event, fn);
    this.keyHandlers = [];
    // Persist flags so explore/other scenes see the updated state.
    for (const [k, v] of Object.entries(this.runtime.flags)) gameState.setFlag(k, v);
  }

  private createOverlay(): VnElements {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");
    root.innerHTML = `
      <div class="topbar">
        <span class="scene-title" data-testid="scene-title"></span>
        <div class="vn-topbar-buttons">
          <button class="icon-button vn-skip" type="button" aria-label="跳过已读">⏩</button>
          <button class="icon-button vn-auto" type="button" aria-label="自动播放">▶</button>
          <button class="icon-button vn-log" type="button" aria-label="对话回看">🕮</button>
          <button class="icon-button vn-mute" type="button" aria-label="静音">🔊</button>
          <button class="icon-button menu-toggle" type="button" aria-label="菜单">☰</button>
        </div>
      </div>
      <img class="portrait portrait-left" alt="" data-testid="portrait-left" />
      <img class="portrait portrait-right" alt="" data-testid="portrait-right" />
      <div class="choice-panel" data-testid="choice-panel"></div>
      <section class="dialogue-panel" data-testid="dialogue-panel">
        <div class="speaker-name" data-testid="speaker-name"></div>
        <p class="dialogue-text" data-testid="dialogue-text"></p>
        <button class="continue-button" type="button" data-testid="continue-button">确认</button>
      </section>
      <aside class="slot-menu hidden" data-testid="slot-menu">
        <div class="slot-title">存档</div>
        <button type="button" data-slot-save="1">存 1</button>
        <button type="button" data-slot-save="2">存 2</button>
        <button type="button" data-slot-save="3">存 3</button>
        <button type="button" data-slot-load="1">读 1</button>
        <button type="button" data-slot-load="2">读 2</button>
        <button type="button" data-slot-load="3">读 3</button>
      </aside>
      <aside class="log-panel hidden">
        <div class="log-header">
          <span>对话回看</span>
          <button type="button" class="log-close">×</button>
        </div>
        <div class="log-body"></div>
      </aside>
      <div class="mobile-stick" aria-hidden="true"><span></span></div>
      <nav class="mobile-actions" aria-label="操作按钮">
        <button class="round-action confirm-action" type="button">✓</button>
        <button class="round-action cancel-action" type="button">×</button>
        <button class="round-action menu-action" type="button">☰</button>
      </nav>
    `;

    const elements: VnElements = {
      root,
      sceneTitle: root.querySelector(".scene-title")!,
      leftPortrait: root.querySelector(".portrait-left")!,
      rightPortrait: root.querySelector(".portrait-right")!,
      speaker: root.querySelector(".speaker-name")!,
      text: root.querySelector(".dialogue-text")!,
      continueButton: root.querySelector(".continue-button")!,
      dialogue: root.querySelector(".dialogue-panel")!,
      choices: root.querySelector(".choice-panel")!,
      menu: root.querySelector(".slot-menu")!,
      confirm: root.querySelector(".confirm-action")!,
      cancel: root.querySelector(".cancel-action")!,
      menuButton: root.querySelector(".menu-action")!,
      skipButton: root.querySelector(".vn-skip")!,
      autoButton: root.querySelector(".vn-auto")!,
      logButton: root.querySelector(".vn-log")!,
      muteButton: root.querySelector(".vn-mute")!,
      logPanel: root.querySelector(".log-panel")!,
      logCloseButton: root.querySelector(".log-close")!
    };

    elements.dialogue.addEventListener("click", (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      this.handleConfirm();
    });
    elements.continueButton.addEventListener("click", () => this.handleConfirm());
    elements.confirm.addEventListener("click", () => this.handleConfirm());
    elements.cancel.addEventListener("click", () => this.elements.menu.classList.add("hidden"));
    elements.menuButton.addEventListener("click", () => this.toggleMenu());
    root.querySelector(".menu-toggle")?.addEventListener("click", () => this.toggleMenu());
    elements.skipButton.addEventListener("click", () => this.toggleSkip());
    elements.autoButton.addEventListener("click", () => this.toggleAuto());
    elements.logButton.addEventListener("click", () => this.toggleLog());
    elements.muteButton.addEventListener("click", () => this.toggleMute());
    elements.logCloseButton.addEventListener("click", () => this.toggleLog(false));

    elements.menu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const saveSlot = target.dataset.slotSave;
      const loadSlot = target.dataset.slotLoad;
      if (saveSlot) void this.save(Number(saveSlot));
      if (loadSlot) void this.loadSave(Number(loadSlot));
    });

    elements.muteButton.textContent = audioManager.muted ? "🔇" : "🔊";
    elements.muteButton.classList.toggle("active", audioManager.muted);
    return elements;
  }

  private renderNode(node: RuntimeNode): void {
    this.autoTimer?.remove(false);
    this.setBackground(node);
    this.elements.sceneTitle.textContent = node.sceneTitle;
    document.body.dataset.mood = node.resolvedBackground === "scene6_mainstreet_horror" ? "horror" : "normal";
    this.setPortrait(this.elements.leftPortrait, node.left);
    this.setPortrait(this.elements.rightPortrait, node.right);
    this.setActivePortrait(node.activeSide);

    if (node.bgm) audioManager.playBgm(node.bgm);
    if (node.sfx) audioManager.playSfx(node.sfx);

    this.elements.choices.innerHTML = "";
    const showChoicesPanel = node.type === "choice" || node.type === "death";
    this.elements.choices.classList.toggle("visible", showChoicesPanel);
    this.elements.dialogue.classList.toggle("death", node.type === "death");
    this.elements.dialogue.classList.toggle("ending", node.type === "ending");

    let heading = node.title ?? node.speaker ?? "旁白";
    if (node.type === "death") heading = `GAME OVER · ${node.title ?? "死亡结局"}`;
    this.elements.speaker.textContent = heading;

    let fullText = node.prompt ?? node.text ?? "";
    if (node.type === "death") fullText = `${fullText}\n\n——是否重来？`;
    this.startTypewriter(fullText);
    dialogueLog.push({ speaker: heading, text: fullText });

    if (node.type === "choice" && node.options) {
      this.renderChoices(node, this.runtime.visibleChoices(node));
      this.elements.continueButton.classList.add("hidden");
    } else if (node.type === "death") {
      this.renderDeathActions();
      this.elements.continueButton.classList.add("hidden");
    } else if (node.type === "ending") {
      this.elements.continueButton.textContent = this.endingButtonLabel(node);
      this.elements.continueButton.classList.remove("hidden");
    } else {
      this.elements.continueButton.textContent = "确认";
      this.elements.continueButton.classList.remove("hidden");
    }

    if (node.type === "effect" && node.effect && !this.playedEffects.has(node.globalId)) {
      this.playedEffects.add(node.globalId);
      this.runEffect(node.effect);
    }

    const wasRead = gameState.isRead(node.globalId);
    gameState.markRead(node.globalId);

    if (node.autosave || node.sceneId !== this.lastSceneId) {
      this.lastSceneId = node.sceneId;
      void this.save(0);
    }

    if (this.skipMode && wasRead && node.type !== "choice" && node.type !== "death" && node.type !== "ending") {
      this.finishTypewriter();
      this.autoTimer = this.time.delayedCall(160, () => this.handleConfirm());
    } else if (this.autoMode && node.type !== "choice") {
      this.scheduleAutoAdvance(fullText);
    }
  }

  private startTypewriter(text: string): void {
    this.typingTimer?.remove(false);
    this.pendingText = text;
    this.isTyping = true;
    this.elements.text.textContent = "";
    let i = 0;
    const stepMs = Math.max(8, Math.floor(1000 / TYPEWRITER_CPS));
    this.typingTimer = this.time.addEvent({
      delay: stepMs,
      repeat: text.length - 1,
      callback: () => {
        i += 1;
        this.elements.text.textContent = text.slice(0, i);
        if (i >= text.length) this.isTyping = false;
      }
    });
  }

  private finishTypewriter(): void {
    this.typingTimer?.remove(false);
    this.elements.text.textContent = this.pendingText;
    this.isTyping = false;
  }

  private scheduleAutoAdvance(text: string): void {
    const stepMs = Math.max(8, Math.floor(1000 / TYPEWRITER_CPS));
    const typingMs = text.length * stepMs;
    this.autoTimer = this.time.delayedCall(typingMs + AUTO_DELAY_MS, () => {
      if (!this.autoMode) return;
      const node = this.runtime.current;
      if (node.type === "choice") return;
      this.handleConfirm();
    });
  }

  private renderDeathActions(): void {
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "choice-button danger";
    retryButton.innerHTML = `
      <span class="choice-icon">↻</span>
      <span class="choice-copy">
        <span class="choice-label">重新选择</span>
        <span class="choice-consequence">回到上一个分歧点</span>
      </span>
    `;
    retryButton.addEventListener("click", () => this.renderNode(this.runtime.retryChoice()));
    this.elements.choices.append(retryButton);

    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "choice-button";
    titleButton.innerHTML = `
      <span class="choice-icon">⌂</span>
      <span class="choice-copy">
        <span class="choice-label">返回标题</span>
        <span class="choice-consequence">回到开始界面，重头再来</span>
      </span>
    `;
    titleButton.addEventListener("click", () => this.returnToTitle());
    this.elements.choices.append(titleButton);
  }

  private endingButtonLabel(node: RuntimeNode): string {
    if (node.sceneId === "scene6_after_crossing") return "进入终章 CG";
    if (this.exitScene) return "开始探索";
    return "继续";
  }

  private handleEndingAdvance(node: RuntimeNode): void {
    if (node.sceneId === "scene6_after_crossing") {
      // Persist flags so any future scene can read them, then play the finale cutscene.
      for (const [k, v] of Object.entries(this.runtime.flags)) gameState.setFlag(k, v);
      this.scene.start("FinalScene");
      return;
    }
    if (this.exitScene) this.scene.start(this.exitScene);
  }

  private returnToTitle(): void {
    gameState.clues.clear();
    gameState.flags = {};
    gameState.readNodes.clear();
    gameState.npcTalkCount = {};
    dialogueLog.clear();
    this.scene.start("StartScene");
  }

  private renderChoices(_node: RuntimeNode, options: ChoiceOption[]): void {
    options.forEach((option, idx) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-button ${option.death ? "danger" : ""}`;
      button.dataset.choiceId = option.id;
      button.innerHTML = `
        <span class="choice-icon">${option.icon}</span>
        <span class="choice-copy">
          <span class="choice-label">${idx + 1}. ${option.label}</span>
          <span class="choice-consequence">${option.consequence}</span>
        </span>
      `;
      button.addEventListener("click", () => this.choose(option));
      this.elements.choices.append(button);
    });
  }

  private setBackground(node: RuntimeNode): void {
    if (this.currentBackground === node.resolvedBackground) return;
    this.currentBackground = node.resolvedBackground;
    this.bg?.destroy();
    this.bg = this.add
      .image(360, 640, node.resolvedBackground)
      .setDisplaySize(720, 1280)
      .setDepth(0);
  }

  private setPortrait(element: HTMLImageElement, key?: PortraitKey): void {
    if (!key) {
      element.removeAttribute("src");
      element.classList.add("hidden");
      return;
    }
    element.src = assetManifest.portraits[key];
    element.classList.remove("hidden");
  }

  private setActivePortrait(activeSide?: "left" | "right"): void {
    this.elements.leftPortrait.classList.remove("active", "dimmed");
    this.elements.rightPortrait.classList.remove("active", "dimmed");
    if (!activeSide) return;
    const active = activeSide === "left" ? this.elements.leftPortrait : this.elements.rightPortrait;
    const silent = activeSide === "left" ? this.elements.rightPortrait : this.elements.leftPortrait;
    active.classList.add("active");
    if (!silent.classList.contains("hidden")) silent.classList.add("dimmed");
  }

  private handleConfirm(): void {
    audioManager.unlock();
    if (this.isTyping) {
      this.finishTypewriter();
      return;
    }
    const node = this.runtime.current;
    if (node.type === "choice") return;
    if (node.type === "death") {
      // Confirm key is wired to "retry" by default; the explicit death actions handle this too.
      this.renderNode(this.runtime.retryChoice());
      return;
    }
    if (node.type === "ending") {
      this.handleEndingAdvance(node);
      return;
    }
    this.renderNode(this.runtime.advance());
  }

  private pickChoiceByIndex(index: number): void {
    const node = this.runtime.current;
    if (node.type !== "choice") return;
    const visible = this.runtime.visibleChoices(node);
    if (!visible[index]) return;
    this.choose(visible[index]);
  }

  private choose(option: ChoiceOption): void {
    const node = this.runtime.current;
    void this.logChoice(node, option);
    this.renderNode(this.runtime.choose(option));
  }

  private runEffect(effect: NonNullable<RuntimeNode["effect"]>): void {
    if (!this.redOverlay) return;
    if (effect === "mirrorPulse") {
      this.cameras.main.shake(260, 0.004);
      this.tweens.add({
        targets: this.redOverlay,
        alpha: { from: 0, to: 0.32 },
        duration: 180,
        yoyo: true,
        repeat: 2
      });
      return;
    }
    if (effect === "redPulse") {
      this.tweens.add({
        targets: this.redOverlay,
        alpha: { from: 0, to: 0.45 },
        duration: 380,
        yoyo: true,
        repeat: 1
      });
      return;
    }
    if (effect === "shake") {
      this.cameras.main.shake(420, 0.006);
      return;
    }
    if (effect === "flashWhite") {
      this.cameras.main.flash(380, 255, 246, 230);
      return;
    }
    if (effect === "fadeBlack") {
      this.cameras.main.fade(620, 0, 0, 0, false);
      return;
    }
    if (effect === "crossing") {
      this.cameras.main.flash(900, 128, 0, 24);
      this.cameras.main.shake(720, 0.008);
      this.tweens.add({
        targets: this.redOverlay,
        alpha: { from: 0.1, to: 0.55 },
        duration: 520,
        yoyo: true,
        repeat: 1
      });
    }
  }

  private toggleMenu(): void {
    this.elements.menu.classList.toggle("hidden");
  }

  private toggleAuto(): void {
    this.autoMode = !this.autoMode;
    if (this.autoMode) this.skipMode = false;
    this.elements.autoButton.classList.toggle("active", this.autoMode);
    this.elements.skipButton.classList.toggle("active", this.skipMode);
    if (this.autoMode && !this.isTyping) {
      this.scheduleAutoAdvance(this.pendingText);
    } else {
      this.autoTimer?.remove(false);
    }
  }

  private toggleSkip(): void {
    this.skipMode = !this.skipMode;
    if (this.skipMode) this.autoMode = false;
    this.elements.skipButton.classList.toggle("active", this.skipMode);
    this.elements.autoButton.classList.toggle("active", this.autoMode);
    if (this.skipMode) {
      // Kick the skip loop by triggering an immediate confirm if the current node is read.
      const node = this.runtime.current;
      if (gameState.isRead(node.globalId) && node.type !== "choice") {
        this.handleConfirm();
      }
    }
  }

  private toggleLog(force?: boolean): void {
    const willOpen = typeof force === "boolean" ? force : this.elements.logPanel.classList.contains("hidden");
    this.elements.logPanel.classList.toggle("hidden", !willOpen);
    if (willOpen) {
      const body = this.elements.logPanel.querySelector(".log-body")!;
      body.innerHTML = dialogueLog
        .all()
        .map((entry) => `<div class="log-entry"><strong>${entry.speaker}</strong><span>${entry.text}</span></div>`)
        .join("");
      body.scrollTop = body.scrollHeight;
    }
  }

  private toggleMute(): void {
    audioManager.toggleMuted();
    this.refreshMuteButton();
  }

  private refreshMuteButton(): void {
    this.elements.muteButton.textContent = audioManager.muted ? "🔇" : "🔊";
    this.elements.muteButton.classList.toggle("active", audioManager.muted);
  }

  private async save(slot: number): Promise<void> {
    const node = this.runtime.current;
    await postJson("/api/save", {
      slot,
      sceneId: node.globalId,
      flags: this.runtime.flags,
      inventory: this.runtime.inventory,
      playtime: this.runtime.playtimeSeconds
    });
  }

  private async loadSave(slot: number): Promise<void> {
    const response = await fetch(`/api/load/${slot}`);
    if (!response.ok) return;
    const data = await response.json();
    if (!data.save?.sceneId) return;
    this.elements.menu.classList.add("hidden");
    if (data.save.flags) {
      for (const [k, v] of Object.entries(data.save.flags as Record<string, boolean | string | number>)) {
        this.runtime.setFlag(k, v);
      }
    }
    this.renderNode(this.runtime.jump(data.save.sceneId));
  }

  private async logChoice(node: RuntimeNode, option: ChoiceOption): Promise<void> {
    await postJson("/api/choice", {
      sceneId: node.sceneId,
      choiceId: node.globalId,
      choiceValue: option.id
    });
  }
}

async function postJson(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    // The VN remains playable if the local API is temporarily unavailable.
  }
}
