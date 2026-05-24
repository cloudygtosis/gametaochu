import type { ChoiceOption, RuntimeFlags, RuntimeNode, SceneScript, ScriptNode } from "./vnTypes";

export class VnRuntime {
  private nodes = new Map<string, RuntimeNode>();
  private sceneStarts = new Map<string, string>();
  private currentId: string;
  private previousChoiceId = "";

  readonly flags: RuntimeFlags = {};
  readonly inventory: string[] = [];
  readonly startedAt = Date.now();

  constructor(scenes: SceneScript[], startSceneId: string) {
    for (const scene of scenes) {
      for (const node of scene.nodes) {
        const globalId = this.toGlobalId(scene.id, node.id);
        const runtimeNode: RuntimeNode = {
          ...node,
          globalId,
          sceneId: scene.id,
          sceneTitle: scene.title,
          resolvedBackground: node.background ?? scene.background
        };
        this.nodes.set(globalId, runtimeNode);
      }
      this.sceneStarts.set(scene.id, this.toGlobalId(scene.id, scenes.find((item) => item.id === scene.id)?.nodes[0].id ?? "start"));
    }

    const startId = this.sceneStarts.get(startSceneId);
    if (!startId) {
      throw new Error(`Missing start scene: ${startSceneId}`);
    }
    this.currentId = startId;
  }

  get current(): RuntimeNode {
    const node = this.nodes.get(this.currentId);
    if (!node) {
      throw new Error(`Missing node: ${this.currentId}`);
    }
    return node;
  }

  get playtimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  advance(): RuntimeNode {
    // VN nodes are a small directed graph loaded from JSON so dialogue edits do not
    // require code changes. Cross-scene jumps use "sceneId:nodeId".
    const next = this.current.next;
    if (!next) return this.current;
    this.currentId = this.resolveNext(next, this.current.sceneId);
    return this.current;
  }

  choose(option: ChoiceOption): RuntimeNode {
    // Choices are the only place where branch flags mutate; death nodes keep a pointer
    // back to the last choice so "重新选择" never restarts the whole chapter.
    this.previousChoiceId = this.current.globalId;
    if (option.flag) {
      this.flags[option.flag] = true;
    }
    this.currentId = this.resolveNext(option.next, this.current.sceneId);
    return this.current;
  }

  retryChoice(): RuntimeNode {
    const retryChoice = this.current.retryChoice || this.previousChoiceId;
    if (retryChoice) {
      this.currentId = this.resolveNext(retryChoice, this.current.sceneId);
    }
    return this.current;
  }

  jump(globalOrLocalId: string): RuntimeNode {
    this.currentId = this.resolveNext(globalOrLocalId, this.current.sceneId);
    return this.current;
  }

  private toGlobalId(sceneId: string, nodeId: string): string {
    return `${sceneId}:${nodeId}`;
  }

  private resolveNext(next: string, currentSceneId: string): string {
    const globalId = next.includes(":") ? next : this.toGlobalId(currentSceneId, next);
    if (!this.nodes.has(globalId)) {
      throw new Error(`Missing VN target: ${globalId}`);
    }
    return globalId;
  }
}

export function isChoiceNode(node: ScriptNode): boolean {
  return node.type === "choice" && Array.isArray(node.options);
}
