export type ClueId = "stone_warning" | "old_photo" | "huangli" | "shen_family" | "well_redrope" | "altar_paper";

export interface Clue {
  id: ClueId;
  title: string;
  description: string;
}

export const clueCatalog: Record<ClueId, Clue> = {
  stone_warning: {
    id: "stone_warning",
    title: "酉时石碑",
    description: "镇口石碑被青苔遮住，只露出“生人勿过酉时”。"
  },
  old_photo: {
    id: "old_photo",
    title: "刮脸旧照",
    description: "民宿旧照片里穿朱砂衣的女子，脸被人反复刮掉。"
  },
  huangli: {
    id: "huangli",
    title: "旧黄历",
    description: "杂货铺黄历写着“今日宜嫁娶，忌远行。酉时闭镇”。"
  },
  shen_family: {
    id: "shen_family",
    title: "沈家旧名",
    description: "茶铺老人说朱砂镇以前叫沈家镇，别碰那件红衣。"
  },
  well_redrope: {
    id: "well_redrope",
    title: "井沿红绳",
    description: "老井挂着一截褪色红绳，井水黑得照不出人脸。"
  },
  altar_paper: {
    id: "altar_paper",
    title: "供桌符纸",
    description: "杂货铺供桌压着一张朱砂符，写着“迎贵妃回宫”。"
  }
};

export type RuntimeFlagValue = boolean | string | number;

class GameState {
  clues = new Set<ClueId>();
  flags: Record<string, RuntimeFlagValue> = {};
  readNodes = new Set<string>();
  npcTalkCount: Record<string, number> = {};

  addClue(id: ClueId): boolean {
    const existed = this.clues.has(id);
    this.clues.add(id);
    return !existed;
  }

  hasClue(id: ClueId): boolean {
    return this.clues.has(id);
  }

  clueCount(): number {
    return this.clues.size;
  }

  clueList(): Clue[] {
    return Array.from(this.clues).map((id) => clueCatalog[id]);
  }

  setFlag(name: string, value: RuntimeFlagValue = true): void {
    this.flags[name] = value;
  }

  hasFlag(name: string): boolean {
    return Boolean(this.flags[name]);
  }

  mergeFlags(flags: Record<string, RuntimeFlagValue> | undefined): void {
    if (!flags) return;
    for (const [k, v] of Object.entries(flags)) this.flags[k] = v;
  }

  markRead(globalNodeId: string): void {
    this.readNodes.add(globalNodeId);
  }

  isRead(globalNodeId: string): boolean {
    return this.readNodes.has(globalNodeId);
  }

  recordTalk(npcId: string): number {
    const next = (this.npcTalkCount[npcId] ?? 0) + 1;
    this.npcTalkCount[npcId] = next;
    return next;
  }

  talkCount(npcId: string): number {
    return this.npcTalkCount[npcId] ?? 0;
  }
}

export const gameState = new GameState();
