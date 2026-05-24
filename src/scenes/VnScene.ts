import Phaser from "phaser";
import { assetManifest, type PortraitKey } from "../data/assetManifest";
import prologueRaw from "../data/scenes/prologue_arrival.json";
import scene4Raw from "../data/scenes/scene4_hanfu_interior.json";
import scene5Raw from "../data/scenes/scene5_dressingroom.json";
import scene6Raw from "../data/scenes/scene6_after_crossing.json";
import { VnRuntime } from "../systems/vnRuntime";
import type { ChoiceOption, RuntimeNode, SceneScript } from "../systems/vnTypes";

const scripts = [prologueRaw, scene4Raw, scene5Raw, scene6Raw] as unknown as SceneScript[];

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
}

export class VnScene extends Phaser.Scene {
  private runtime!: VnRuntime;
  private bg?: Phaser.GameObjects.Image;
  private redOverlay?: Phaser.GameObjects.Rectangle;
  private currentBackground = "";
  private elements!: VnElements;
  private savedNodes = new Set<string>();
  private lastSceneId = "";
  private playedEffects = new Set<string>();
  private exitScene?: string;

  constructor() {
    super("VnScene");
  }

  create(): void {
    const data = (this.scene.settings.data ?? {}) as { startSceneId?: string; exitScene?: string };
    this.exitScene = data.exitScene;
    this.runtime = new VnRuntime(scripts, data.startSceneId ?? "prologue_arrival");
    this.redOverlay = this.add.rectangle(360, 640, 720, 1280, 0x8b0018, 0).setDepth(5);
    this.elements = this.createOverlay();
    this.input.keyboard?.on("keydown-ENTER", () => this.handleConfirm());
    this.input.keyboard?.on("keydown-SPACE", () => this.handleConfirm());
    this.input.keyboard?.on("keydown-ESC", () => this.toggleMenu());
    this.input.keyboard?.on("keydown-ONE", () => this.pickChoiceByIndex(0));
    this.input.keyboard?.on("keydown-TWO", () => this.pickChoiceByIndex(1));
    this.input.keyboard?.on("keydown-THREE", () => this.pickChoiceByIndex(2));
    this.renderNode(this.runtime.current);
  }

  private createOverlay(): VnElements {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");
    root.innerHTML = `
      <div class="topbar">
        <span class="scene-title" data-testid="scene-title"></span>
        <button class="icon-button menu-toggle" type="button" aria-label="菜单" data-testid="menu-toggle">☰</button>
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
      menuButton: root.querySelector(".menu-action")!
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

    elements.menu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const saveSlot = target.dataset.slotSave;
      const loadSlot = target.dataset.slotLoad;
      if (saveSlot) void this.save(Number(saveSlot));
      if (loadSlot) void this.loadSave(Number(loadSlot));
    });

    return elements;
  }

  private renderNode(node: RuntimeNode): void {
    this.setBackground(node);
    this.elements.sceneTitle.textContent = node.sceneTitle;
    document.body.dataset.mood = node.resolvedBackground === "scene6_mainstreet_horror" ? "horror" : "normal";
    this.setPortrait(this.elements.leftPortrait, node.left);
    this.setPortrait(this.elements.rightPortrait, node.right);
    this.setActivePortrait(node.activeSide);

    this.elements.choices.innerHTML = "";
    this.elements.choices.classList.toggle("visible", node.type === "choice");
    this.elements.dialogue.classList.toggle("death", node.type === "death");
    this.elements.dialogue.classList.toggle("ending", node.type === "ending");
    this.elements.speaker.textContent = node.title ?? node.speaker ?? "旁白";
    this.elements.text.textContent = node.prompt ?? node.text ?? "";

    if (node.type === "choice" && node.options) {
      this.renderChoices(node, node.options);
      this.elements.continueButton.classList.add("hidden");
    } else if (node.type === "death") {
      this.elements.continueButton.textContent = "重新选择";
      this.elements.continueButton.classList.remove("hidden");
    } else if (node.type === "ending") {
      this.elements.continueButton.textContent = this.exitScene ? "开始探索" : "留在此处";
      this.elements.continueButton.classList.remove("hidden");
    } else {
      this.elements.continueButton.textContent = "确认";
      this.elements.continueButton.classList.remove("hidden");
    }

    if (node.type === "effect" && node.effect && !this.playedEffects.has(node.globalId)) {
      this.playedEffects.add(node.globalId);
      this.runEffect(node.effect);
    }

    if (node.autosave || node.sceneId !== this.lastSceneId) {
      this.lastSceneId = node.sceneId;
      void this.save(0);
    }
  }

  private renderChoices(node: RuntimeNode, options: ChoiceOption[]): void {
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-button ${option.death ? "danger" : ""}`;
      button.dataset.choiceId = option.id;
      button.innerHTML = `
        <span class="choice-icon">${option.icon}</span>
        <span class="choice-copy">
          <span class="choice-label">${option.label}</span>
          <span class="choice-consequence">${option.consequence}</span>
        </span>
      `;
      button.addEventListener("click", () => this.choose(node, option));
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
    const node = this.runtime.current;
    if (node.type === "choice") return;
    if (node.type === "death") {
      this.renderNode(this.runtime.retryChoice());
      return;
    }
    if (node.type === "ending") {
      if (this.exitScene) this.scene.start(this.exitScene);
      return;
    }
    this.renderNode(this.runtime.advance());
  }

  private pickChoiceByIndex(index: number): void {
    const node = this.runtime.current;
    if (node.type !== "choice" || !node.options?.[index]) return;
    this.choose(node, node.options[index]);
  }

  private choose(node: RuntimeNode, option: ChoiceOption): void {
    void this.logChoice(node, option);
    this.renderNode(this.runtime.choose(option));
  }

  private runEffect(effect: "mirrorPulse" | "crossing"): void {
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

  private toggleMenu(): void {
    this.elements.menu.classList.toggle("hidden");
  }

  private async save(slot: number): Promise<void> {
    const node = this.runtime.current;
    const cacheKey = `${slot}:${node.globalId}`;
    if (slot === 0 && this.savedNodes.has(cacheKey)) return;
    this.savedNodes.add(cacheKey);
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
