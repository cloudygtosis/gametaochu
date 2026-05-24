export type ClueId = "stone_warning" | "old_photo" | "huangli" | "shen_family";

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
  }
};

export const gameState = {
  clues: new Set<ClueId>(),
  flags: {} as Record<string, boolean>,
  addClue(id: ClueId): boolean {
    const existed = this.clues.has(id);
    this.clues.add(id);
    return !existed;
  },
  hasClue(id: ClueId): boolean {
    return this.clues.has(id);
  },
  clueCount(): number {
    return this.clues.size;
  },
  clueList(): Clue[] {
    return Array.from(this.clues).map((id) => clueCatalog[id]);
  }
};
