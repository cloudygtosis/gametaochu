import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { buildPrompt, describeGenerationMode } from "./assetGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "game.sqlite"));
db.exec(`
CREATE TABLE IF NOT EXISTS saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  scene_id TEXT NOT NULL,
  player_x INTEGER,
  player_y INTEGER,
  flags TEXT,
  inventory TEXT,
  playtime INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, slot)
);

CREATE TABLE IF NOT EXISTS choices_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  scene_id TEXT,
  choice_id TEXT,
  choice_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_key TEXT UNIQUE,
  asset_type TEXT,
  file_path TEXT,
  prompt_used TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const app = express();
const port = Number(process.env.PORT ?? 3001);
const defaultUser = "local-player";

app.use(express.json({ limit: "1mb" }));

function parseJsonColumn(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeSave(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    slot: row.slot,
    sceneId: row.scene_id,
    playerX: row.player_x,
    playerY: row.player_y,
    flags: parseJsonColumn(row.flags, {}),
    inventory: parseJsonColumn(row.inventory, []),
    playtime: row.playtime,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

app.post("/api/save", (req, res) => {
  // Slot 0 is autosave; slots 1-3 are available for manual saves from the overlay.
  // Flags/inventory stay JSON strings in SQLite to keep the schema lightweight.
  const body = req.body ?? {};
  const userId = body.user_id ?? body.userId ?? defaultUser;
  const slot = Number(body.slot ?? 0);
  const sceneId = String(body.scene_id ?? body.sceneId ?? "scene4_hanfu_interior");
  const flags = JSON.stringify(body.flags ?? {});
  const inventory = JSON.stringify(body.inventory ?? []);
  const playtime = Number(body.playtime ?? body.playtimeSeconds ?? 0);
  const playerX = Number(body.player_x ?? body.playerX ?? 0);
  const playerY = Number(body.player_y ?? body.playerY ?? 0);

  db.prepare(`
    INSERT INTO saves (user_id, slot, scene_id, player_x, player_y, flags, inventory, playtime, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, slot) DO UPDATE SET
      scene_id = excluded.scene_id,
      player_x = excluded.player_x,
      player_y = excluded.player_y,
      flags = excluded.flags,
      inventory = excluded.inventory,
      playtime = excluded.playtime,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, slot, sceneId, playerX, playerY, flags, inventory, playtime);

  const saved = db
    .prepare("SELECT * FROM saves WHERE user_id = ? AND slot = ?")
    .get(userId, slot);
  res.json({ ok: true, save: serializeSave(saved) });
});

app.get("/api/load/:slot", (req, res) => {
  const userId = String(req.query.user_id ?? req.query.userId ?? defaultUser);
  const slot = Number(req.params.slot);
  const row = db
    .prepare("SELECT * FROM saves WHERE user_id = ? AND slot = ?")
    .get(userId, slot);
  if (!row) {
    res.status(404).json({ ok: false, error: "SAVE_NOT_FOUND" });
    return;
  }
  res.json({ ok: true, save: serializeSave(row) });
});

app.get("/api/saves", (req, res) => {
  const userId = String(req.query.user_id ?? req.query.userId ?? defaultUser);
  const rows = db
    .prepare("SELECT * FROM saves WHERE user_id = ? ORDER BY slot ASC")
    .all(userId);
  res.json({ ok: true, saves: rows.map(serializeSave) });
});

app.delete("/api/save/:slot", (req, res) => {
  const userId = String(req.query.user_id ?? req.query.userId ?? defaultUser);
  const slot = Number(req.params.slot);
  db.prepare("DELETE FROM saves WHERE user_id = ? AND slot = ?").run(userId, slot);
  res.json({ ok: true });
});

app.post("/api/choice", (req, res) => {
  const body = req.body ?? {};
  const userId = body.user_id ?? body.userId ?? defaultUser;
  const sceneId = String(body.scene_id ?? body.sceneId ?? "");
  const choiceId = String(body.choice_id ?? body.choiceId ?? "");
  const choiceValue = String(body.choice_value ?? body.choiceValue ?? "");
  db.prepare(
    "INSERT INTO choices_log (user_id, scene_id, choice_id, choice_value) VALUES (?, ?, ?, ?)"
  ).run(userId, sceneId, choiceId, choiceValue);
  res.json({ ok: true });
});

app.post("/api/generate-asset", (req, res) => {
  const body = req.body ?? {};
  const assetKey = String(body.asset_key ?? body.assetKey ?? "unnamed_asset");
  const assetType = String(body.asset_type ?? body.assetType ?? "unknown");
  const filePath = String(body.file_path ?? body.filePath ?? "");
  const prompt = String(
    body.prompt_used ??
      body.promptUsed ??
      buildPrompt(assetKey, String(body.description ?? "Generate game asset"), {
        opaque: body.opaque === true,
        style: body.style,
        consistency: body.consistency
      })
  );

  db.prepare(`
    INSERT INTO assets_cache (asset_key, asset_type, file_path, prompt_used)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(asset_key) DO UPDATE SET
      asset_type = excluded.asset_type,
      file_path = excluded.file_path,
      prompt_used = excluded.prompt_used,
      generated_at = CURRENT_TIMESTAMP
  `).run(assetKey, assetType, filePath, prompt);

  res.json({
    ok: true,
    ...describeGenerationMode(),
    asset: { assetKey, assetType, filePath, promptUsed: prompt }
  });
});

const publicDir = path.join(rootDir, "dist");
app.use(express.static(publicDir));

app.listen(port, "127.0.0.1", () => {
  console.log(`API server listening on http://127.0.0.1:${port}`);
});
