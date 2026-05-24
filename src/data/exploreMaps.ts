import type { BackgroundKey, PortraitKey, SpriteKey, WorldImageKey } from "./assetManifest";
import type { ClueId } from "../systems/gameState";

export type RoomId = "hub" | "teahouse" | "inn" | "grocery";

export interface DoorConfig {
  id: string;
  x: number;
  y: number;
  radius: number;
  target: RoomId | "hanfu";
  spawn?: { x: number; y: number };
}

export interface CollisionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InvestigationConfig {
  id: string;
  x: number;
  y: number;
  radius: number;
  clue?: ClueId;
  title: string;
  lines: string[];
}

export interface WorldObjectConfig {
  id: string;
  image: WorldImageKey;
  x: number;
  y: number;
  width: number;
  height: number;
  collision?: CollisionRect;
  investigation?: InvestigationConfig;
}

export interface NpcConfig {
  id: string;
  name: string;
  sprite: SpriteKey;
  portrait: PortraitKey;
  x: number;
  y: number;
  clue?: ClueId;
  lines: string[];
  interactionRadius?: number;
}

export interface RoomConfig {
  id: RoomId;
  title: string;
  background: BackgroundKey;
  playerStart: { x: number; y: number };
  exits: DoorConfig[];
  collisions: CollisionRect[];
  objects: WorldObjectConfig[];
  npcs: NpcConfig[];
  investigations: InvestigationConfig[];
}

const roomWalls: CollisionRect[] = [
  { x: 360, y: 120, width: 720, height: 240 },
  { x: 38, y: 690, width: 76, height: 1060 },
  { x: 682, y: 690, width: 76, height: 1060 }
];

export const rooms: Record<RoomId, RoomConfig> = {
  hub: {
    id: "hub",
    title: "朱砂镇主街",
    background: "town_ground_base",
    playerStart: { x: 360, y: 1180 },
    exits: [
      { id: "door_teahouse", x: 190, y: 514, radius: 38, target: "teahouse", spawn: { x: 360, y: 1115 } },
      { id: "door_inn", x: 530, y: 514, radius: 38, target: "inn", spawn: { x: 360, y: 1115 } },
      { id: "door_grocery", x: 190, y: 954, radius: 40, target: "grocery", spawn: { x: 360, y: 1115 } },
      { id: "door_hanfu", x: 530, y: 960, radius: 42, target: "hanfu" }
    ],
    collisions: [
      { x: 20, y: 640, width: 40, height: 1280 },
      { x: 700, y: 640, width: 40, height: 1280 },
      { x: 360, y: 20, width: 720, height: 40 }
    ],
    objects: [
      {
        id: "teahouse",
        image: "building_teahouse",
        x: 190,
        y: 500,
        width: 270,
        height: 244,
        collision: { x: 190, y: 380, width: 258, height: 188 }
      },
      {
        id: "inn",
        image: "building_inn",
        x: 530,
        y: 500,
        width: 282,
        height: 230,
        collision: { x: 530, y: 383, width: 270, height: 180 }
      },
      {
        id: "grocery",
        image: "building_grocery",
        x: 190,
        y: 945,
        width: 278,
        height: 264,
        collision: { x: 190, y: 815, width: 268, height: 212 }
      },
      {
        id: "hanfu_shop",
        image: "building_hanfu",
        x: 530,
        y: 950,
        width: 294,
        height: 284,
        collision: { x: 530, y: 810, width: 284, height: 226 }
      },
      {
        id: "old_well",
        image: "prop_well",
        x: 448,
        y: 674,
        width: 82,
        height: 110,
        collision: { x: 448, y: 633, width: 56, height: 46 },
        investigation: {
          id: "well",
          x: 448,
          y: 650,
          radius: 70,
          title: "老井",
          lines: ["井沿挂着一截褪色红绳，水面黑得看不见底。", "林雅压低声音：这里拍照是好看，但也太阴了。"]
        }
      },
      {
        id: "town_intro_sign",
        image: "prop_town_sign",
        x: 460,
        y: 1140,
        width: 118,
        height: 116,
        collision: { x: 460, y: 1090, width: 86, height: 54 },
        investigation: {
          id: "town_intro_sign",
          x: 460,
          y: 1100,
          radius: 80,
          title: "古镇介绍牌",
          lines: [
            "介绍牌写着：朱砂镇，旧属浙江西南山道，因山中朱砂矿与沈氏祠而兴。",
            "下面还有一行被雨水泡花的小字：酉时后不接外客。"
          ]
        }
      },
      {
        id: "stone_tablet",
        image: "prop_stone_tablet",
        x: 110,
        y: 1160,
        width: 72,
        height: 120,
        collision: { x: 110, y: 1110, width: 48, height: 62 },
        investigation: {
          id: "stone_tablet",
          x: 110,
          y: 1125,
          radius: 76,
          clue: "stone_warning",
          title: "镇口石碑",
          lines: ["石碑被水汽泡得发黑，青苔下面露出几个旧字。", "生人勿过酉时。"]
        }
      },
      {
        id: "rest_bench",
        image: "prop_bench",
        x: 555,
        y: 1180,
        width: 118,
        height: 64,
        collision: { x: 555, y: 1150, width: 108, height: 28 }
      },
      {
        id: "lantern_pair",
        image: "prop_lantern_pair",
        x: 318,
        y: 1218,
        width: 74,
        height: 124,
        collision: { x: 318, y: 1185, width: 40, height: 52 }
      }
    ],
    npcs: [],
    investigations: []
  },
  teahouse: {
    id: "teahouse",
    title: "茶铺",
    background: "interior_empty_base",
    playerStart: { x: 360, y: 1115 },
    exits: [{ id: "exit_teahouse", x: 360, y: 1190, radius: 70, target: "hub", spawn: { x: 190, y: 570 } }],
    collisions: roomWalls,
    objects: [
      {
        id: "teahouse_counter",
        image: "furn_teahouse_counter",
        x: 360,
        y: 365,
        width: 246,
        height: 118,
        collision: { x: 360, y: 320, width: 236, height: 70 }
      },
      {
        id: "tea_table_left",
        image: "furn_tea_table",
        x: 220,
        y: 650,
        width: 128,
        height: 82,
        collision: { x: 220, y: 628, width: 112, height: 48 }
      },
      {
        id: "tea_table_right",
        image: "furn_tea_table",
        x: 510,
        y: 735,
        width: 128,
        height: 82,
        collision: { x: 510, y: 712, width: 112, height: 48 }
      },
      {
        id: "calendar_board",
        image: "prop_calendar_board",
        x: 570,
        y: 420,
        width: 68,
        height: 92,
        collision: { x: 570, y: 382, width: 44, height: 38 }
      }
    ],
    npcs: [
      {
        id: "tea_elder",
        name: "茶铺老人",
        sprite: "npc_teahouse_elder_spritesheet",
        portrait: "npc_teahouse_elder",
        x: 360,
        y: 780,
        clue: "shen_family",
        interactionRadius: 110,
        lines: ["毕业照？拍归拍，别穿那件红的。", "朱砂镇以前不叫朱砂镇，叫沈家镇。沈家的东西，认人。"]
      }
    ],
    investigations: []
  },
  inn: {
    id: "inn",
    title: "民宿",
    background: "interior_empty_base",
    playerStart: { x: 360, y: 1115 },
    exits: [{ id: "exit_inn", x: 360, y: 1190, radius: 70, target: "hub", spawn: { x: 530, y: 570 } }],
    collisions: roomWalls,
    objects: [
      {
        id: "inn_counter",
        image: "furn_inn_counter",
        x: 360,
        y: 365,
        width: 250,
        height: 136,
        collision: { x: 360, y: 315, width: 238, height: 74 }
      },
      {
        id: "guest_bed",
        image: "furn_bed",
        x: 530,
        y: 620,
        width: 138,
        height: 126,
        collision: { x: 530, y: 580, width: 120, height: 70 }
      },
      {
        id: "photo_shelf",
        image: "furn_wall_shelf",
        x: 170,
        y: 415,
        width: 150,
        height: 110,
        collision: { x: 170, y: 378, width: 128, height: 54 }
      }
    ],
    npcs: [
      {
        id: "inn_child",
        name: "民宿小孩",
        sprite: "npc_inn_child_spritesheet",
        portrait: "npc_inn_child",
        x: 340,
        y: 720,
        clue: "old_photo",
        interactionRadius: 112,
        lines: ["姐姐，你们也是来拍照的吗？", "墙上那张照片里的姐姐，去年也说拍完就走。后来她的脸，被老板撕掉了。"]
      }
    ],
    investigations: []
  },
  grocery: {
    id: "grocery",
    title: "杂货铺",
    background: "interior_empty_base",
    playerStart: { x: 360, y: 1115 },
    exits: [{ id: "exit_grocery", x: 360, y: 1190, radius: 70, target: "hub", spawn: { x: 190, y: 1010 } }],
    collisions: roomWalls,
    objects: [
      {
        id: "grocery_counter",
        image: "furn_grocery_counter",
        x: 360,
        y: 390,
        width: 250,
        height: 130,
        collision: { x: 360, y: 340, width: 238, height: 70 },
        investigation: {
          id: "counter_calendar",
          x: 360,
          y: 455,
          radius: 84,
          clue: "huangli",
          title: "柜台旧黄历",
          lines: ["柜台上压着一本旧黄历，纸页潮得卷边。", "今日宜嫁娶，忌远行。酉时闭镇。"]
        }
      },
      {
        id: "grocery_shelf_left",
        image: "furn_grocery_shelf",
        x: 170,
        y: 430,
        width: 155,
        height: 120,
        collision: { x: 170, y: 390, width: 138, height: 58 }
      },
      {
        id: "wall_shelf_right",
        image: "furn_wall_shelf",
        x: 555,
        y: 440,
        width: 160,
        height: 118,
        collision: { x: 555, y: 398, width: 138, height: 58 }
      },
      {
        id: "altar_table",
        image: "furn_altar_table",
        x: 535,
        y: 780,
        width: 140,
        height: 96,
        collision: { x: 535, y: 748, width: 126, height: 44 }
      }
    ],
    npcs: [
      {
        id: "grocery_clerk",
        name: "杂货铺店员",
        sprite: "npc_grocery_clerk_spritesheet",
        portrait: "npc_grocery_clerk",
        x: 360,
        y: 670,
        clue: "huangli",
        interactionRadius: 112,
        lines: ["店员没有抬头，只把一本旧黄历推到柜台边。", "今日宜嫁娶，忌远行。酉时闭镇。"]
      }
    ],
    investigations: []
  }
};
