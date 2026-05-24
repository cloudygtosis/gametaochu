import Phaser from "phaser";
import { assetManifest } from "../data/assetManifest";
import {
  rooms,
  type CollisionRect,
  type DoorConfig,
  type InvestigationConfig,
  type NpcConfig,
  type RoomId,
  type WorldObjectConfig
} from "../data/exploreMaps";
import { clueCatalog, gameState, type ClueId } from "../systems/gameState";

type Direction = "down" | "left" | "right" | "up";

const PLAYER_RENDER_SCALE = 1.55;
const NPC_RENDER_SCALE = 2;

interface ExploreElements {
  root: HTMLElement;
  title: HTMLElement;
  prompt: HTMLElement;
  message: HTMLElement;
  clues: HTMLElement;
  confirm: HTMLButtonElement;
  npcDialog: HTMLElement;
  npcLeft: HTMLImageElement;
  npcRight: HTMLImageElement;
  npcSpeaker: HTMLElement;
  npcText: HTMLElement;
  npcContinue: HTMLButtonElement;
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
  private doorCooldownUntil = 0;
  private activePrompt = "";
  private dialogOpen = false;
  private messageVisible = false;
  private messageTimer?: Phaser.Time.TimerEvent;
  private nearbyNpc?: NpcConfig;
  private nearbyInvestigation?: InvestigationConfig;

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
    this.input.keyboard?.on("keydown-SPACE", () => this.confirmAction());
    this.input.keyboard?.on("keydown-ENTER", () => this.confirmAction());
    this.loadRoom(data?.roomId ?? "hub", data?.spawn);
    this.setupVirtualStick(this.elements.root.querySelector(".explore-stick")!);
  }

  update(): void {
    if (this.dialogOpen) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      return;
    }

    const velocity = this.readMovement();
    this.player.setVelocity(velocity.x, velocity.y);
    this.player.setDepth(Math.round(this.player.y) + 10);

    if (velocity.lengthSq() === 0) {
      this.player.anims.stop();
      this.player.setFrame(this.standFrameFor(this.currentDirection));
    } else {
      this.currentDirection = this.directionFromVelocity(velocity);
      this.player.play(`xiaoyue-walk-${this.currentDirection}`, true);
    }

    this.updateNearbyInteraction();
    this.checkDoors();
  }

  private loadRoom(roomId: RoomId, spawn?: { x: number; y: number }): void {
    this.clearWorldObjects();
    this.roomId = roomId;
    const room = rooms[roomId];
    this.elements.title.textContent = room.title;
    this.activePrompt = "";
    this.nearbyNpc = undefined;
    this.nearbyInvestigation = undefined;
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
    this.player.setDepth(this.player.y + 10);

    this.createAnimations();
    this.roomColliders.push(this.physics.add.collider(this.player, blockers));
    this.updateCluePanel();
    this.showMessage(
      roomId === "hub"
        ? "先在镇上打听线索。收集至少 2 条线索后，再去汉服馆。"
        : "靠近 NPC 或物件按确认调查。碰到门会自动离开。"
    );
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
      this.add.sprite(npc.x, npc.y, npc.sprite, 0).setScale(NPC_RENDER_SCALE).setDepth(npc.y + 5);
      this.addCollisionRect(blockers, { x: npc.x, y: npc.y + 22, width: 34, height: 34 });
    }
  }

  private addCollisionRect(blockers: Phaser.Physics.Arcade.StaticGroup, rect: CollisionRect): void {
    const wall = this.add.rectangle(rect.x, rect.y, rect.width, rect.height, 0x000000, 0);
    this.physics.add.existing(wall, true);
    blockers.add(wall);
  }

  private checkDoors(): void {
    if (this.time.now < this.doorCooldownUntil) return;
    const door = rooms[this.roomId].exits.find((candidate) => this.distanceTo(candidate.x, candidate.y) <= candidate.radius);
    if (door) this.enterDoor(door);
  }

  private enterDoor(door: DoorConfig): void {
    this.doorCooldownUntil = this.time.now + 800;
    if (door.target === "hanfu") {
      if (gameState.clueCount() < 2) {
        this.showMessage("林雅拉住小月：先别急。这个镇不对劲，我们至少再打听两条线索。");
        this.player.setPosition(door.x, door.y + 62);
        return;
      }
      this.showMessage("线索已经够了。林雅深吸一口气，推开汉服馆的门。");
      this.time.delayedCall(450, () => this.scene.start("VnScene", { startSceneId: "scene4_hanfu_interior" }));
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
    const door = room.exits.find((candidate) => this.distanceTo(candidate.x, candidate.y) <= candidate.radius + 20);

    const prompt = this.nearbyNpc
      ? `! 和${this.nearbyNpc.name}交谈`
      : this.nearbyInvestigation
        ? `! 调查${this.nearbyInvestigation.title}`
        : door?.target === "hanfu"
          ? "进入汉服馆"
          : door
            ? "进门"
            : "";

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
    if (this.dialogOpen) {
      this.closeNpcDialog();
      return;
    }
    if (this.nearbyNpc) {
      this.openNpcDialog(this.nearbyNpc);
      return;
    }
    if (this.nearbyInvestigation) {
      this.handleInvestigation(this.nearbyInvestigation);
    }
  }

  private openNpcDialog(npc: NpcConfig): void {
    this.dialogOpen = true;
    const clueText = npc.clue ? this.collectClue(npc.clue) : "";
    this.elements.npcLeft.src = assetManifest.portraits.xiaoyue_normal_modern;
    this.elements.npcRight.src = assetManifest.portraits[npc.portrait];
    this.elements.npcLeft.className = "portrait portrait-left dimmed";
    this.elements.npcRight.className = "portrait portrait-right active";
    this.elements.npcSpeaker.textContent = npc.name;
    this.elements.npcText.textContent = `${npc.lines.join(" ")}${clueText}`;
    this.elements.npcDialog.classList.remove("hidden");
  }

  private closeNpcDialog(): void {
    this.dialogOpen = false;
    this.elements.npcDialog.classList.add("hidden");
  }

  private handleInvestigation(item: InvestigationConfig): void {
    const clueText = item.clue ? this.collectClue(item.clue) : "";
    this.showMessage(`${item.lines.join(" ")}${clueText}`);
  }

  private collectClue(id: ClueId): string {
    const isNew = gameState.addClue(id);
    this.updateCluePanel();
    return isNew ? `\n获得线索：${clueCatalog[id].title}` : `\n线索已记录：${clueCatalog[id].title}`;
  }

  private createOverlay(): ExploreElements {
    const root = document.getElementById("vn-layer");
    if (!root) throw new Error("Missing #vn-layer");
    root.innerHTML = `
      <div class="explore-topbar">
        <span class="scene-title explore-title"></span>
        <button class="icon-button explore-menu" type="button" aria-label="菜单">☰</button>
      </div>
      <div class="clue-panel"></div>
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
      confirm: root.querySelector<HTMLButtonElement>(".confirm-action")!,
      npcDialog: root.querySelector<HTMLElement>(".explore-npc-vn")!,
      npcLeft: root.querySelector<HTMLImageElement>(".explore-npc-vn .portrait-left")!,
      npcRight: root.querySelector<HTMLImageElement>(".explore-npc-vn .portrait-right")!,
      npcSpeaker: root.querySelector<HTMLElement>(".explore-npc-vn .speaker-name")!,
      npcText: root.querySelector<HTMLElement>(".explore-npc-vn .dialogue-text")!,
      npcContinue: root.querySelector<HTMLButtonElement>(".explore-npc-vn .continue-button")!
    };
    elements.confirm.addEventListener("click", () => this.confirmAction());
    elements.npcContinue.addEventListener("click", () => this.closeNpcDialog());
    elements.npcDialog.querySelector(".dialogue-panel")?.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLButtonElement)) this.closeNpcDialog();
    });
    return elements;
  }

  private setupVirtualStick(stick: HTMLElement): void {
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
    return vector.normalize().scale(155);
  }

  private directionFromVelocity(velocity: Phaser.Math.Vector2): Direction {
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) return velocity.x < 0 ? "left" : "right";
    return velocity.y < 0 ? "up" : "down";
  }

  private standFrameFor(direction: Direction): number {
    return { down: 0, left: 8, right: 16, up: 24 }[direction];
  }

  private showMessage(message: string): void {
    this.messageTimer?.remove(false);
    this.messageVisible = true;
    this.elements.message.textContent = message;
    this.elements.message.classList.add("visible");
    this.elements.prompt.classList.remove("visible");
    this.messageTimer = this.time.delayedCall(4800, () => {
      this.messageVisible = false;
      this.elements.message.classList.remove("visible");
      this.elements.prompt.classList.toggle("visible", Boolean(this.activePrompt));
    });
  }

  private updateCluePanel(): void {
    const clues = gameState.clueList();
    this.elements.clues.innerHTML =
      `<strong>线索 ${clues.length}/4</strong>` +
      clues.map((clue) => `<span>${clue.title}</span>`).join("") +
      (clues.length >= 2 ? `<em>可进入汉服馆</em>` : `<em>至少需要 2 条</em>`);
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
          flags: { clues: gameState.clueList().map((clue) => clue.id) },
          inventory: [],
          playtime: 0
        })
      });
    } catch {
      // Exploration remains playable even if the local save service is unavailable.
    }
  }
}
