import type { BackgroundKey, PortraitKey } from "../data/assetManifest";

export type NodeKind = "dialogue" | "choice" | "effect" | "death" | "ending";
export type PortraitSide = "left" | "right";

export interface ChoiceOption {
  id: string;
  icon: string;
  label: string;
  consequence: string;
  next: string;
  flag?: string;
  flags?: string[];
  death?: boolean;
  requires?: string;
  hideIfMissing?: boolean;
}

export interface ConditionalNext {
  if: string;
  next: string;
}

export type VnEffect =
  | "mirrorPulse"
  | "crossing"
  | "shake"
  | "flashWhite"
  | "redPulse"
  | "fadeBlack";

export interface ScriptNode {
  id: string;
  type: NodeKind;
  title?: string;
  speaker?: string;
  activeSide?: PortraitSide;
  left?: PortraitKey;
  right?: PortraitKey;
  text?: string;
  prompt?: string;
  next?: string;
  branches?: ConditionalNext[];
  options?: ChoiceOption[];
  autosave?: boolean;
  effect?: VnEffect;
  retryChoice?: string;
  background?: BackgroundKey;
  bgm?: string;
  sfx?: string;
}

export interface SceneScript {
  id: string;
  title: string;
  background: BackgroundKey;
  bgm?: string;
  nodes: ScriptNode[];
}

export interface RuntimeNode extends ScriptNode {
  globalId: string;
  sceneId: string;
  sceneTitle: string;
  resolvedBackground: BackgroundKey;
}

export type RuntimeFlags = Record<string, boolean | string | number>;
