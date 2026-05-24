import Phaser from "phaser";
import "./styles/game.css";
import { BootScene } from "./scenes/BootScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { ExploreScene } from "./scenes/ExploreScene";
import { StartScene } from "./scenes/StartScene";
import { VnScene } from "./scenes/VnScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: 720,
  height: 1280,
  backgroundColor: "#090706",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scene: [BootScene, StartScene, CutsceneScene, ExploreScene, VnScene]
});
