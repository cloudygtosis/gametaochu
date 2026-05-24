import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";
import {
  rooms,
  type CollisionRect,
  type DoorConfig,
  type InvestigationConfig,
  type LinyaCompanionConfig,
  type NpcConfig,
  type NpcDialog,
  type NpcDialogLine,
  type RoomId,
  type WorldObjectConfig
} from "../data/exploreMaps";
import { audioManager } from "../systems/audioManager";
import { dialogueLog } from "../systems/dialogueLog";
import { clueCatalog, gameState, type ClueId } from "../systems/gameState";

type Direction = "down" | "left" | "right" | "up";

const PLAYER_RENDER_SCALE = 1.55;
const NPC_RENDER_SCALE = 2;
const PLAYER_SPEED = 155;

interface ExploreElements {
  root: HTMLElement;
  title: HTMLElement;
  prompt: HTMLElement;
  message: HTMLElement;
  clues: HTMLElement;
  clueToggle: HTMLButtonElement;
  confirm: HTMLButtonElement;
  npcDialog: HTMLElement;
  npcLeft: HTMLImageElement;
  npcRight: HTMLImageElement;
  npcSpeaker: HTMLElement;
  npcText: HTMLElement;
  npcContinue: HTMLButtonElement;
  linyaPortrait: HTMLImageElement;
  linyaBubble: HTMLElement;
}

export class ExploreScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D" | "SPACE" | "ENTER", Phaser.Input.Keyboard.Key>;
  private elements!: ExploreElements;
  private roomColliders: Phaser.Physics.Arcade.Collider[] = [];
  private stickVector = new Phaser.Math.Vector2(0, 0);
  private currentDirection: Direction = "down";
  private roomId: RoomId = "hub";
  private activePrompt = "";
  private dialogOpen = false;
  private messageVisible = false;
  private messageTimer?: Phaser.Time.TimerEvent;
  private cluePanelOpen = false;
  private nearbyNpc?: NpcConfig;
  private nearbyInvestigation?: InvestigationConfig;
  private nearbyDoor?: DoorConfig;
  private dialogQueue: NpcDialogLine[] = [];
  private dialogQueueNpc?: NpcConfig;

  constructor() {
    super("ExploreScene");
  }

  create(data?: { roomId?: RoomId; spawn?: { x: number; y: number } }): void {
    this.elements = this.createOverlay();
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,SPACE,ENTER") as Record<
      "W" | "A" | "S" | "D" | "SPACE" | "ENTER",
      Phaser.Input.Keyboard.Key
    >;
    const onSpace = (): void => this.confirmAction();
    const onEnter = (): void => this.confirmAction();
    this.input.keyboard?.on("keydown-SPACE", onSpace);
    this.input.keyboard?.on("keydown-ENTER", onEnter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-SPACE", onSpace);
      this.input.keyboard?.off("keydown-ENTER", onEnter);
      this.messageTimer?.remove(false);
    });
    this.loadRoom(data?.roomId ?? "hub", data?.spawn);
    this.setupVirtualStick(this.elements.root.querySelector(".explore-stick") as HTMLElement);
  }

  update(): void {
    if (this.dialogOpen) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      return;
    }

    const velocity = this.readMovement();
    this.player.setVelocity(velocity.x, velocity.y);
    this.player.setDepth(Math.round(this.player.y + this.player.displayHeight / 2));

    if (velocity.lengthSq() === 0) {
      this.player.anims.stop();
      this.player.setFrame(this.standFrameFor(this.currentDirection));
    } else {
      this.currentDirection = this.directionFromVelocity(velocity);
      this.player.play(`xiaoyue-walk-${this.currentDirection}`, true);
    }

    this.updateNearbyInteraction();
  }

  private loadRoom(roomId: RoomId, spawn?: { x: number; y: number }): void {
    this.clearWorldObjects();
    this.roomId = roomId;
    const room = rooms[roomId];
    this.elements.title.textContent = room.title;
    this.activePrompt = "";
    this.nearbyNpc = undefined;
    this.nearbyInvestigation = undefined;
    this.nearbyDoor = undefined;
    this.elements.prompt.classList.remove("visible");

    this.add.image(360, 640, room.background).setDisplaySize(720, 1280).setDepth(-1000);
    this.physics.world.setBounds(0, 0, 720, 1280);

    const blockers = this.physics.add.staticGroup();
    room.collisions.forEach((rect) => this.addCollisionRect(blockers, rect));
    this.createWorldObjects(room.objects, blockers);
    this.createNpcs(room.npcs, blockers);

    const start = spawn ?? room.playerStart;
    this.player = this.physics.add
      .sprite(start.x, start.y, "xiaoyue_modern_spritesheet", 0)
      .setScale(PLAYER_RENDER_SCALE);
    this.player.body?.setSize(18, 18).setOffset(7, 28);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(this.player.y + this.player.displayHeight / 2);

    this.createAnimations();
    this.roomColliders.push(this.physics.add.collider(this.player, blockers));
    this.updateCluePanel();
    this.renderLinya(room.linya);
    if (room.bgm) audioManager.playBgm(room.bgm);
    this.showWelcomeMessage(roomId);
    void this.autoSave(roomId);
  }

  private clearWorldObjects(): void {
    this.roomColliders.forEach((collider) => collider.destroy());
    this.roomColliders = [];
    this.children.removeAll(true);
  }

  private createAnimations(): void {
    const rows: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };
    (Object.keys(rows) as Direction[]).forEach((direction) => {
      const key = `xiaoyue-walk-${direction}`;
      if (this.anims.exists(key)) return;
      const start = rows[direction] * 8;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers("xiaoyue_modern_spritesheet", {
          frames: [start, start + 1, start + 2, start + 3, start + 4, start + 5, start + 6, start + 7]
        }),
        frameRate: 10,
        repeat: -1
      });
    });
  }

  private createWorldObjects(
    objects: WorldObjectConfig[],
    blockers: Phaser.Physics.Arcade.StaticGroup
  ): void {
    for (const object of objects) {
      this.add
        .image(object.x, object.y, object.image)
        .setOrigin(0.5, 1)
        .setDisplaySize(object.width, object.height)
        .setDepth(object.y);

      if (object.collision) {
        this.addCollisionRect(blockers, object.collision);
      }
    }
  }

  private createNpcs(npcs: NpcConfig[], blockers: Phaser.Physics.Arcade.StaticGroup): void {
    for (const npc of npcs) {
      const sprite = this.add.sprite(npc.x, npc.y, npc.sprite, 0).setScale(NPC_RENDER_SCALE);
      sprite.setDepth(npc.y + sprite.displayHeight / 2);
      const w = npc.bodyWidth ?? 40;
      const h = npc.bodyHeight ?? 26;
      const offsetY = npc.bodyOffsetY ?? 28;
      this.addCollisionRect(blockers, { x: npc.x, y: npc.y + offsetY, width: w, height: h });
    }
  }

  private addCollisionRect(blockers: Phaser.Physics.Arcade.StaticGroup, rect: CollisionRect): void {
    const wall = this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0x000000, 0);
    this.physics.add.existing(wall, true);
    blockers.add(wall);
  }

  private renderLinya(linya: LinyaCompanionConfig | undefined): void {
    const portrait = this.elements.linyaPortrait;
    const bubble = this.elements.linyaBubble;

    // Always reset visibility/opacity classes so leftovers from the previous room don't bleed in.
    portrait.classList.remove("fading");
    bubble.classList.remove("fading");

    if (!linya) {
      portrait.classList.add("hidden");
      bubble.classList.add("hidden");
      return;
    }

    portrait.src = assetManifest.portraits[linya.portrait];
    portrait.classList.remove("hidden");

    const lines: string[] = [linya.ambientLine];
    for (const fl of linya.flagLines ?? []) {
      if (gameState.hasFlag(fl.ifFlag)) lines.push(fl.line);
    }
    for (const cl of linya.clueLines ?? []) {
      if (gameState.clueCount() >= cl.atClueCount) lines.push(cl.line);
    }

    const line = lines[lines.length - 1];
    bubble.textContent = `林雅：${line}`;
    bubble.classList.remove("hidden");
    dialogueLog.push({ speaker: "林雅", text: line });

    // Bubble fades earlier; the portrait follows so Linya doesn't linger on screen.
    this.time.delayedCall(6500, () => {
      bubble.classList.add("fading");
      portrait.classList.add("fading");
    });
    this.time.delayedCall(8500, () => {
      bubble.classList.add("hidden");
      portrait.classList.add("hidden");
      bubble.classList.remove("fading");
      portrait.classList.remove("fading");
    });
  }

  private isInsideDoorTrigger(door: DoorConfig): boolean {
    const halfW = door.width / 2;
    const halfH = door.height / 2;
    // Match against the player's feet so the trigger lines up with where the
    // character visually stands rather than the sprite center.
    const feetY = this.player.y + this.player.displayHeight / 2 - 8;
    return (
      this.player.x >= door.x - halfW &&
      this.player.x <= door.x + halfW &&
      feetY >= door.y - halfH &&
      feetY <= door.y + halfH
    );
  }

  private enterDoor(door: DoorConfig): void {
    if (door.target === "hanfu") {
      if (gameState.clueCount() < 5) {
        this.showMessage(
          `林雅拉住小月：先别急——这个镇不对劲，我们至少要凑齐五条线索。\n（当前 ${gameState.clueCount()}/5 条）`
        );
        return;
      }
      this.showMessage("线索够了。林雅深吸一口气，推开汉服馆的门。");
      this.time.delayedCall(450, () =>
        this.scene.start("VnScene", { startSceneId: "scene4_hanfu_interior", exitScene: undefined })
      );
      return;
    }
    this.loadRoom(door.target, door.spawn);
  }

  private updateNearbyInteraction(): void {
    const room = rooms[this.roomId];
    this.nearbyNpc = this.findNearestNpc(room.npcs);
    this.nearbyInvestigation = this.findNearestInvestigation([
      ...room.investigations,
      ...room.objects.flatMap((object) => (object.investigation ? [object.investigation] : []))
    ]);
    this.nearbyDoor = room.exits.find((door) => this.isInsideDoorTrigger(door));

    let doorPrompt = "";
    if (this.nearbyDoor) {
      if (this.nearbyDoor.target === "hanfu" && gameState.clueCount() < 5) {
        doorPrompt = `▶ 进入汉服馆（需 5 条线索 · 当前 ${gameState.clueCount()}）`;
      } else {
        doorPrompt = `▶ ${this.nearbyDoor.prompt ?? "进门"}`;
      }
    }

    const prompt = this.nearbyNpc
      ? `▶ 与${this.nearbyNpc.name}交谈`
      : this.nearbyInvestigation
        ? `▶ 调查${this.nearbyInvestigation.title}`
        : doorPrompt;

    if (prompt === this.activePrompt) return;
    this.activePrompt = prompt;
    this.elements.prompt.textContent = prompt;
    this.elements.prompt.classList.toggle("visible", Boolean(prompt) && !this.messageVisible);
  }

  private findNearestNpc(npcs: NpcConfig[]): NpcConfig | undefined {
    return npcs
      .map((npc) => ({ npc, distance: this.distanceTo(npc.x, npc.y) }))
      .filter(({ npc, distance }) => distance <= (npc.interactionRadius ?? 96))
      .sort((a, b) => a.distance - b.distance)[0]?.npc;
  }

  private findNearestInvestigation(items: InvestigationConfig[]): InvestigationConfig | undefined {
    return items
      .map((item) => ({ item, distance: this.distanceTo(item.x, item.y) }))
      .filter(({ item, distance }) => distance <= item.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.item;
  }

  private confirmAction(): void {
    audioManager.unlock();
    if (this.dialogOpen) {
      this.advanceNpcDialog();
      return;
    }
    if (this.nearbyNpc) {
      this.openNpcDialog(this.nearbyNpc);
      return;
    }
    if (this.nearbyInvestigation) {
      this.handleInvestigation(this.nearbyInvestigation);
      return;
    }
    if (this.nearbyDoor) {
      this.enterDoor(this.nearbyDoor);
    }
  }

  private buildNpcLines(npc: NpcConfig, dialog: NpcDialog): NpcDialogLine[] {
    const lines: NpcDialogLine[] = [];
    const isFirst = gameState.talkCount(npc.id) === 0;

    if (isFirst) {
      lines.push(...dialog.intro);
      for (const addon of dialog.flagAddons ?? []) {
        if (gameState.hasFlag(addon.ifFlag)) lines.push(...addon.lines);
      }
    } else {
      lines.push(...dialog.repeat);
    }

    for (const addon of dialog.clueAddons ?? []) {
      const hasAll = addon.ifClues.every((c) => gameState.hasClue(c));
      if (hasAll) {
        lines.push(...addon.lines);
        if (addon.setFlag) gameState.setFlag(addon.setFlag);
      }
    }

    return lines;
  }

  private openNpcDialog(npc: NpcConfig): void {
    this.dialogOpen = true;
    this.dialogQueueNpc = npc;
    this.dialogQueue = this.buildNpcLines(npc, npc.dialog);

    if (npc.dialog.clue) {
      const isNew = gameState.addClue(npc.dialog.clue);
      // Mirror clue-aware "shen_family" into a runtime flag for VN branches to read.
      gameState.setFlag(this.flagForClue(npc.dialog.clue), true);
      if (isNew) {
        this.dialogQueue.push({
          speaker: "xiaoyue",
          text: `（在笔记里记下：${clueCatalog[npc.dialog.clue].title}）`
        });
      }
    }
    gameState.recordTalk(npc.id);
    this.updateCluePanel();

    this.elements.npcLeft.src = assetManifest.portraits.xiaoyue_normal_modern;
    this.elements.npcRight.src = assetManifest.portraits[npc.portrait];
    this.elements.npcDialog.classList.remove("hidden");
    this.advanceNpcDialog();
  }

  private advanceNpcDialog(): void {
    if (!this.dialogQueueNpc) {
      this.closeNpcDialog();
      return;
    }
    const next = this.dialogQueue.shift();
    if (!next) {
      this.closeNpcDialog();
      return;
    }
    const npc = this.dialogQueueNpc;
    let displaySpeaker = npc.name;
    let activeLeft = false;
    if (next.speaker === "xiaoyue") {
      displaySpeaker = "小月";
      activeLeft = true;
    } else if (next.speaker === "linya") {
      displaySpeaker = "林雅";
      activeLeft = true;
    }
    this.elements.npcSpeaker.textContent = displaySpeaker;
    this.elements.npcText.textContent = next.text;
    this.elements.npcLeft.classList.toggle("active", activeLeft);
    this.elements.npcLeft.classList.toggle("dimmed", !activeLeft);
    this.elements.npcRight.classList.toggle("active", !activeLeft);
    this.elements.npcRight.classList.toggle("dimmed", activeLeft);
    dialogueLog.push({ speaker: displaySpeaker, text: next.text });
  }

  private closeNpcDialog(): void {
    this.dialogOpen = false;
    this.dialogQueueNpc = undefined;
    this.dialogQueue = [];
    this.elements.npcDialog.classList.add("hidden");
  }

  private handleInvestigation(item: InvestigationConfig): void {
    const isRevisit = item.clue ? gameState.hasClue(item.clue) : false;
    const lines = isRevisit && item.repeatLines ? item.repeatLines : item.lines;
    let clueText = "";
    if (item.clue) {
      const isNew = gameState.addClue(item.clue);
      gameState.setFlag(this.flagForClue(item.clue), true);
      this.updateCluePanel();
      clueText = isNew
        ? `\n（记下线索：${clueCatalog[item.clue].title}）`
        : `\n（线索已在你笔记里：${clueCatalog[item.clue].title}）`;
    }
    const text = `${lines.join("\n")}${clueText}`;
    dialogueLog.push({ speaker: "调查 · " + item.title, text });
    this.showMessage(text);
  }

  private flagForClue(id: ClueId): string {
    switch (id) {
      case "shen_family":
        return "knowsShenFamily";
      case "stone_warning":
        return "knowsStoneWarning";
      case "old_photo":
        return "knowsOldPhoto";
      case "huangli":
        return "knowsHuangli";
      case "well_redrope":
        return "knowsWellRope";
      case "altar_paper":
        return "knowsAltarPaper";
    }
  }

  private createOverlay(): ExploreElements {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");
    root.innerHTML = `
      <div class="explore-topbar">
        <span class="scene-title explore-title"></span>
        <button class="icon-button explore-clue-toggle" type="button" aria-label="线索">📜</button>
      </div>
      <div class="clue-panel hidden"></div>
      <img class="linya-portrait hidden" alt="林雅" />
      <div class="linya-bubble hidden"></div>
      <div class="interact-prompt"></div>
      <div class="explore-message"></div>
      <div class="explore-npc-vn hidden">
        <img class="portrait portrait-left dimmed" alt="" />
        <img class="portrait portrait-right active" alt="" />
        <section class="dialogue-panel">
          <div class="speaker-name"></div>
          <p class="dialogue-text"></p>
          <button class="continue-button" type="button">确认</button>
        </section>
      </div>
      <div class="mobile-stick explore-stick" aria-label="虚拟摇杆"><span></span></div>
      <nav class="mobile-actions explore-actions" aria-label="操作按钮">
        <button class="round-action confirm-action" type="button">✓</button>
        <button class="round-action cancel-action" type="button">×</button>
        <button class="round-action menu-action" type="button">☰</button>
      </nav>
    `;

    const elements: ExploreElements = {
      root,
      title: root.querySelector<HTMLElement>(".explore-title")!,
      prompt: root.querySelector<HTMLElement>(".interact-prompt")!,
      message: root.querySelector<HTMLElement>(".explore-message")!,
      clues: root.querySelector<HTMLElement>(".clue-panel")!,
      clueToggle: root.querySelector<HTMLButtonElement>(".explore-clue-toggle")!,
      confirm: root.querySelector<HTMLButtonElement>(".confirm-action")!,
      npcDialog: root.querySelector<HTMLElement>(".explore-npc-vn")!,
      npcLeft: root.querySelector<HTMLImageElement>(".explore-npc-vn .portrait-left")!,
      npcRight: root.querySelector<HTMLImageElement>(".explore-npc-vn .portrait-right")!,
      npcSpeaker: root.querySelector<HTMLElement>(".explore-npc-vn .speaker-name")!,
      npcText: root.querySelector<HTMLElement>(".explore-npc-vn .dialogue-text")!,
      npcContinue: root.querySelector<HTMLButtonElement>(".explore-npc-vn .continue-button")!,
      linyaPortrait: root.querySelector<HTMLImageElement>(".linya-portrait")!,
      linyaBubble: root.querySelector<HTMLElement>(".linya-bubble")!
    };
    elements.confirm.addEventListener("click", () => this.confirmAction());
    elements.clueToggle.addEventListener("click", () => this.toggleCluePanel());
    elements.npcContinue.addEventListener("click", () => this.advanceNpcDialog());
    elements.npcDialog.querySelector(".dialogue-panel")?.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLButtonElement)) this.advanceNpcDialog();
    });
    return elements;
  }

  private toggleCluePanel(): void {
    this.cluePanelOpen = !this.cluePanelOpen;
    this.elements.clues.classList.toggle("hidden", !this.cluePanelOpen);
  }

  private setupVirtualStick(stick: HTMLElement | null): void {
    if (!stick) return;
    let activePointer = -1;
    const updateVector = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.stickVector.set(
        Phaser.Math.Clamp((event.clientX - cx) / (rect.width / 2), -1, 1),
        Phaser.Math.Clamp((event.clientY - cy) / (rect.height / 2), -1, 1)
      );
    };
    stick.addEventListener("pointerdown", (event) => {
      activePointer = event.pointerId;
      stick.setPointerCapture(activePointer);
      updateVector(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId === activePointer) updateVector(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      activePointer = -1;
      this.stickVector.set(0, 0);
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
  }

  private readMovement(): Phaser.Math.Vector2 {
    const vector = new Phaser.Math.Vector2(this.stickVector.x, this.stickVector.y);
    if (this.cursors.left.isDown || this.keys.A.isDown) vector.x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vector.x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vector.y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vector.y += 1;
    if (vector.lengthSq() === 0) return vector;
    return vector.normalize().scale(PLAYER_SPEED);
  }

  private directionFromVelocity(velocity: Phaser.Math.Vector2): Direction {
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) return velocity.x < 0 ? "left" : "right";
    return velocity.y < 0 ? "up" : "down";
  }

  private standFrameFor(direction: Direction): number {
    return { down: 0, left: 8, right: 16, up: 24 }[direction];
  }

  private showWelcomeMessage(roomId: RoomId): void {
    if (roomId === "hub") {
      const count = gameState.clueCount();
      const need = Math.max(0, 5 - count);
      const msg =
        need > 0
          ? `（先在镇上四处打听。再收集 ${need} 条线索，就够推开汉服馆的门。）`
          : `（五条线索都凑齐了。可以去汉服馆了——不过你也可以再听听镇上的声音。）`;
      this.showMessage(msg);
    } else {
      this.showMessage("（靠近 NPC 或物件，按 确认/Space 互动。从入口往下走可以出门。）");
    }
  }

  private showMessage(message: string): void {
    this.messageTimer?.remove(false);
    this.messageVisible = true;
    this.elements.message.textContent = message;
    this.elements.message.classList.add("visible");
    this.elements.prompt.classList.remove("visible");
    const durationMs = Math.min(12000, 3200 + message.length * 90);
    this.messageTimer = this.time.delayedCall(durationMs, () => {
      this.messageVisible = false;
      this.elements.message.classList.remove("visible");
      this.elements.prompt.classList.toggle("visible", Boolean(this.activePrompt));
    });
  }

  private updateCluePanel(): void {
    const clues = gameState.clueList();
    this.elements.clues.innerHTML =
      `<strong>线索 ${clues.length}/${Object.keys(clueCatalog).length}（至少 5）</strong>` +
      clues.map((clue) => `<span title="${clue.description}">${clue.title}</span>`).join("") +
      (clues.length >= 5 ? `<em>可进入汉服馆</em>` : `<em>还需 ${5 - clues.length} 条</em>`);
  }

  private distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
  }

  private async autoSave(sceneId: string): Promise<void> {
    try {
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: 0,
          sceneId,
          playerX: Math.round(this.player?.x ?? 360),
          playerY: Math.round(this.player?.y ?? 1120),
          flags: { ...gameState.flags, clues: gameState.clueList().map((clue) => clue.id) },
          inventory: [],
          playtime: 0
        })
      });
    } catch {
      // Exploration remains playable even if the local save service is unavailable.
    }
  }
}
