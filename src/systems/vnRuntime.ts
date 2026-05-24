import type { ChoiceOption, RuntimeFlags, RuntimeNode, SceneScript, ScriptNode } from "./vnTypes";

export class VnRuntime {
  private nodes = new Map<string, RuntimeNode>();
  private sceneStarts = new Map<string, string>();
  private currentId: string;
  private previousChoiceId = "";

  readonly flags: RuntimeFlags;
  readonly inventory: string[] = [];
  readonly startedAt = Date.now();

  constructor(scenes: SceneScript[], startSceneId: string, initialFlags?: RuntimeFlags) {
    this.flags = { ...(initialFlags ?? {}) };

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
      const firstNodeId = scene.nodes[0]?.id ?? "start";
      this.sceneStarts.set(scene.id, this.toGlobalId(scene.id, firstNodeId));
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

  setFlag(name: string, value: boolean | string | number = true): void {
    this.flags[name] = value;
  }

  hasFlag(name: string): boolean {
    return Boolean(this.flags[name]);
  }

  advance(): RuntimeNode {
    const node = this.current;
    const next = this.pickBranch(node);
    if (!next) return node;
    this.currentId = this.resolveNext(next, node.sceneId);
    return this.current;
  }

  choose(option: ChoiceOption): RuntimeNode {
    this.previousChoiceId = this.current.globalId;
    if (option.flag) this.flags[option.flag] = true;
    if (option.flags) for (const f of option.flags) this.flags[f] = true;
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

  visibleChoices(node: RuntimeNode): ChoiceOption[] {
    if (!node.options) return [];
    return node.options.filter((opt) => {
      if (opt.requires && !this.hasFlag(opt.requires) && opt.hideIfMissing) return false;
      return true;
    });
  }

  private pickBranch(node: ScriptNode): string | undefined {
    if (node.branches) {
      for (const branch of node.branches) {
        if (this.hasFlag(branch.if)) return branch.next;
      }
    }
    return node.next;
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
