import type { BackgroundKey, PortraitKey, SpriteKey, WorldImageKey } from "./assetManifest";
import type { ClueId } from "../systems/gameState";

export type RoomId = "hub" | "teahouse" | "inn" | "grocery";

export interface DoorConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  approachFrom: "above" | "below" | "left" | "right" | "any";
  target: RoomId | "hanfu";
  spawn?: { x: number; y: number };
  prompt?: string;
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
  /** Optional repeat-visit line shown after the clue is already collected. */
  repeatLines?: string[];
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

export interface NpcDialogLine {
  speaker?: "npc" | "xiaoyue" | "linya";
  text: string;
}

export interface NpcDialog {
  /** First-visit dialog (always shown on first interaction). */
  intro: NpcDialogLine[];
  /** Lines added if these flags are set. Played after intro on the *first* visit. */
  flagAddons?: { ifFlag: string; lines: NpcDialogLine[] }[];
  /** Lines shown if no specific addon matches and player has already talked. */
  repeat: NpcDialogLine[];
  /** Triggered when player has the listed clues. */
  clueAddons?: { ifClues: ClueId[]; lines: NpcDialogLine[]; setFlag?: string }[];
  /** Awards a clue on first interaction. */
  clue?: ClueId;
}

export interface NpcConfig {
  id: string;
  name: string;
  sprite: SpriteKey;
  portrait: PortraitKey;
  x: number;
  y: number;
  bodyWidth?: number;
  bodyHeight?: number;
  bodyOffsetY?: number;
  interactionRadius?: number;
  dialog: NpcDialog;
}

export interface LinyaCompanionConfig {
  /** Where Linya stands in this room (off to the side of the player). */
  x: number;
  y: number;
  portrait: PortraitKey;
  /** Ambient line shown right after entering this room. */
  ambientLine: string;
  /** Conditional remarks added to ambientLine. */
  flagLines?: { ifFlag: string; line: string }[];
  /** Lines triggered by reaching N clues. */
  clueLines?: { atClueCount: number; line: string }[];
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
  linya?: LinyaCompanionConfig;
  bgm?: string;
}

const interiorWalls: CollisionRect[] = [
  { x: 360, y: 110, width: 720, height: 220 },
  { x: 30, y: 690, width: 60, height: 1100 },
  { x: 690, y: 690, width: 60, height: 1100 }
];

export const rooms: Record<RoomId, RoomConfig> = {
  hub: {
    id: "hub",
    title: "朱砂镇主街",
    background: "town_ground_base",
    bgm: "bgm_town",
    playerStart: { x: 360, y: 1180 },
    exits: [
      {
        id: "door_teahouse",
        x: 190,
        y: 510,
        width: 96,
        height: 30,
        approachFrom: "below",
        target: "teahouse",
        spawn: { x: 360, y: 1050 },
        prompt: "进入茶铺"
      },
      {
        id: "door_inn",
        x: 530,
        y: 510,
        width: 96,
        height: 30,
        approachFrom: "below",
        target: "inn",
        spawn: { x: 360, y: 1050 },
        prompt: "进入民宿"
      },
      {
        id: "door_grocery",
        x: 190,
        y: 955,
        width: 96,
        height: 30,
        approachFrom: "below",
        target: "grocery",
        spawn: { x: 360, y: 1050 },
        prompt: "进入杂货铺"
      },
      {
        id: "door_hanfu",
        x: 530,
        y: 960,
        width: 100,
        height: 30,
        approachFrom: "below",
        target: "hanfu",
        prompt: "进入汉服馆"
      }
    ],
    collisions: [
      { x: 20, y: 640, width: 40, height: 1280 },
      { x: 700, y: 640, width: 40, height: 1280 },
      { x: 360, y: 40, width: 720, height: 60 }
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
          y: 670,
          radius: 70,
          clue: "well_redrope",
          title: "老井",
          lines: [
            "井沿挂着一截褪色的红绳，结打了三道，像故意系上去的。",
            "水面黑得照不出人脸——可凑近时，又像有什么从水底慢慢浮了一下。"
          ],
          repeatLines: ["井沿那截红绳还在原处——只是今天的雾，比刚才更重了。"]
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
          ],
          repeatLines: ["小字旁边，还有几道指甲掐过的痕迹。"]
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
          lines: [
            "石碑被水汽泡得发黑，青苔下面露出几个旧字。",
            "——生人勿过酉时。",
            "（边缘还有几道极细的红印，像是用指尖蘸朱砂写上去又被磨掉的）"
          ],
          repeatLines: ["指尖再划一下青苔——里面那行字，比第一次看清楚了。"]
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
    investigations: [],
    linya: {
      x: 410,
      y: 1200,
      portrait: "linya_normal_modern",
      ambientLine: "（林雅在身后举着手机找机位）街上拍出来居然真没什么人，太赚了。",
      flagLines: [
        { ifFlag: "xiaoyueAlert", line: "（小声）你刚才的表情我手机录下来了——别皱眉了，去走走啊。" },
        { ifFlag: "knowsLastBus", line: "末班车酉时？那我们最晚 5 点就要在镇口集合，听见没。" }
      ],
      clueLines: [
        { atClueCount: 1, line: "你这是在收集恐怖元素？我都帮你截图存下来了。" },
        { atClueCount: 3, line: "……行吧，线索越凑越多。你确定还要去汉服馆？" },
        { atClueCount: 5, line: "（小声）该看的都看了——再不去，天就要黑了。" }
      ]
    }
  },
  teahouse: {
    id: "teahouse",
    title: "茶铺",
    background: "interior_empty_base",
    bgm: "bgm_town",
    playerStart: { x: 360, y: 1050 },
    exits: [
      {
        id: "exit_teahouse",
        x: 360,
        y: 1240,
        width: 200,
        height: 140,
        approachFrom: "above",
        target: "hub",
        spawn: { x: 190, y: 590 },
        prompt: "出门"
      }
    ],
    collisions: interiorWalls,
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
        bodyWidth: 44,
        bodyHeight: 28,
        bodyOffsetY: 30,
        interactionRadius: 120,
        dialog: {
          clue: "shen_family",
          intro: [
            { speaker: "npc", text: "（不抬头）……毕业照？拍归拍，别穿那件红的。" },
            { speaker: "xiaoyue", text: "哪件红的？您是说汉服馆那件？" },
            {
              speaker: "npc",
              text: "朱砂镇以前不叫朱砂镇，叫沈家镇。沈家的东西——认人。"
            }
          ],
          flagAddons: [
            {
              ifFlag: "xiaoyueAlert",
              lines: [
                { speaker: "npc", text: "（瞥了一眼小月）……姑娘心里有数，那就更别穿那件红的。" }
              ]
            }
          ],
          clueAddons: [
            {
              ifClues: ["old_photo"],
              lines: [
                {
                  speaker: "npc",
                  text: "民宿那张老照片，去年还是前年的？……反正每年都换一张。脸被刮掉的那个，叫什么我不记得了。"
                }
              ],
              setFlag: "elderHintedPhoto"
            }
          ],
          repeat: [
            { speaker: "npc", text: "（端起杯子）……还没走？我能说的，就这些。" }
          ]
        }
      }
    ],
    investigations: [],
    linya: {
      x: 540,
      y: 1080,
      portrait: "linya_normal_modern",
      ambientLine: "（小声）老爷子真的有点不爱搭话啊，你慢慢问。",
      clueLines: [
        { atClueCount: 2, line: "你听见“沈家”了吗？等下到汉服馆我得替你盯着。" }
      ]
    }
  },
  inn: {
    id: "inn",
    title: "民宿",
    background: "interior_empty_base",
    bgm: "bgm_town",
    playerStart: { x: 360, y: 1050 },
    exits: [
      {
        id: "exit_inn",
        x: 360,
        y: 1240,
        width: 200,
        height: 140,
        approachFrom: "above",
        target: "hub",
        spawn: { x: 530, y: 590 },
        prompt: "出门"
      }
    ],
    collisions: interiorWalls,
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
        collision: { x: 170, y: 378, width: 128, height: 54 },
        investigation: {
          id: "scraped_photo",
          x: 170,
          y: 460,
          radius: 86,
          clue: "old_photo",
          title: "墙上旧照",
          lines: [
            "照片很旧，颜色已经发黄。中间那个穿朱砂红的女子——脸的位置被人用指甲反复刮过，露出底下白色相纸。",
            "（角落写着小字：去年清明留念）"
          ],
          repeatLines: ["再细看那片刮痕——刮的方向是同一个，像是同一个人，刮了很多次。"]
        }
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
        bodyWidth: 30,
        bodyHeight: 24,
        bodyOffsetY: 28,
        interactionRadius: 110,
        dialog: {
          intro: [
            { speaker: "npc", text: "（仰头）姐姐，你们也是来拍照的吗？" },
            { speaker: "xiaoyue", text: "嗯。墙上那张照片里的姐姐，你认识吗？" },
            {
              speaker: "npc",
              text: "认识呀。她去年也跟你说过一样的话——“拍完就走”。后来她的脸，被我妈妈撕掉了。"
            }
          ],
          flagAddons: [
            {
              ifFlag: "elderHintedPhoto",
              lines: [
                {
                  speaker: "npc",
                  text: "茶铺爷爷叫你来问的吗？……他每次都让我别说，可那个姐姐真的没出过镇。"
                }
              ]
            }
          ],
          clueAddons: [
            {
              ifClues: ["stone_warning"],
              lines: [
                {
                  speaker: "npc",
                  text: "（声音更小）镇口石碑上的字，是那个姐姐拍照前一晚自己刻的。妈妈不让说。"
                }
              ]
            }
          ],
          repeat: [
            { speaker: "npc", text: "（小声）姐姐，你别买红的。" }
          ]
        }
      }
    ],
    investigations: [],
    linya: {
      x: 540,
      y: 1080,
      portrait: "linya_normal_modern",
      ambientLine: "这小孩话好少……你跟他聊，我先翻一下墙上那排照片。",
      clueLines: [
        { atClueCount: 1, line: "（凑过来小声）这种被刮脸的旧照，我以为只在视频里看到过。" }
      ]
    }
  },
  grocery: {
    id: "grocery",
    title: "杂货铺",
    background: "interior_empty_base",
    bgm: "bgm_town",
    playerStart: { x: 360, y: 1050 },
    exits: [
      {
        id: "exit_grocery",
        x: 360,
        y: 1240,
        width: 200,
        height: 140,
        approachFrom: "above",
        target: "hub",
        spawn: { x: 190, y: 1035 },
        prompt: "出门"
      }
    ],
    collisions: interiorWalls,
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
          lines: [
            "柜台上压着一本旧黄历，纸页潮得卷边。",
            "翻开那一页——“今日宜嫁娶，忌远行。酉时闭镇。”",
            "（页角还盖了个朱砂红的小印：沈）"
          ],
          repeatLines: ["小印旁边写着一行只有指甲压痕能看出的字：每年此日。"]
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
        collision: { x: 535, y: 748, width: 126, height: 44 },
        investigation: {
          id: "altar_paper",
          x: 535,
          y: 760,
          radius: 80,
          clue: "altar_paper",
          title: "供桌符纸",
          lines: [
            "供桌上压着一张刚写不久的朱砂符——",
            "“迎贵妃回宫”五个字，墨还没干透。"
          ],
          repeatLines: ["符纸下面还压着一张红纸条，写着一个名字的偏旁——“沈”。"]
        }
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
        bodyWidth: 38,
        bodyHeight: 26,
        bodyOffsetY: 32,
        interactionRadius: 112,
        dialog: {
          intro: [
            { speaker: "npc", text: "（不抬头）……要什么自己拿。" },
            { speaker: "xiaoyue", text: "请问，今天是什么日子？" },
            {
              speaker: "npc",
              text: "（把黄历推过来）今日宜嫁娶，忌远行。酉时闭镇。看完放回去。"
            }
          ],
          clueAddons: [
            {
              ifClues: ["altar_paper"],
              lines: [
                {
                  speaker: "npc",
                  text: "（眼皮抬了一下）……符是我写的。每年这一天都得写。别多问。"
                }
              ]
            }
          ],
          repeat: [
            { speaker: "npc", text: "……还有什么事？" }
          ]
        }
      }
    ],
    investigations: [],
    linya: {
      x: 540,
      y: 1080,
      portrait: "linya_normal_modern",
      ambientLine: "这供桌……杂货铺里供这种东西，正常吗？",
      flagLines: [
        { ifFlag: "knowsLastBus", line: "末班车 5 点。我盯着时间，别拖了。" }
      ],
      clueLines: [
        { atClueCount: 3, line: "线索越凑越像剧本——你确定还要进那家汉服馆？" },
        { atClueCount: 5, line: "（咽了一下口水）差不多了——再不去，怕是这镇连出口都没了。" }
      ]
    }
  }
};
