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
  death?: boolean;
}

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
  options?: ChoiceOption[];
  autosave?: boolean;
  effect?: "mirrorPulse" | "crossing";
  retryChoice?: string;
  background?: BackgroundKey;
}

export interface SceneScript {
  id: string;
  title: string;
  background: BackgroundKey;
  nodes: ScriptNode[];
}

export interface RuntimeNode extends ScriptNode {
  globalId: string;
  sceneId: string;
  sceneTitle: string;
  resolvedBackground: BackgroundKey;
}

export type RuntimeFlags = Record<string, boolean | string | number>;
