import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS players (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      desk        TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      pass_hash   TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      last_seen   INTEGER NOT NULL
    );

    -- When a player first opened a case, and how many hints they took.
    CREATE TABLE IF NOT EXISTS progress (
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      case_id     TEXT NOT NULL,
      opened_at   INTEGER NOT NULL,
      hints       INTEGER NOT NULL DEFAULT 0,
      wrong       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (player_id, case_id)
    );

    CREATE TABLE IF NOT EXISTS solves (
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      case_id     TEXT NOT NULL,
      desk        TEXT NOT NULL,
      points      INTEGER NOT NULL,
      first_blood INTEGER NOT NULL DEFAULT 0,
      solved_at   INTEGER NOT NULL,
      PRIMARY KEY (player_id, case_id)
    );

    CREATE TABLE IF NOT EXISTS attempts (
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      case_id     TEXT NOT NULL,
      at          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attempts_recent ON attempts (player_id, case_id, at);

    CREATE TABLE IF NOT EXISTS eggs (
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      egg_id      TEXT NOT NULL,
      points      INTEGER NOT NULL,
      found_at    INTEGER NOT NULL,
      PRIMARY KEY (player_id, egg_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      ach_id      TEXT NOT NULL,
      points      INTEGER NOT NULL,
      earned_at   INTEGER NOT NULL,
      PRIMARY KEY (player_id, ach_id)
    );

    -- Shards submitted to a collaborative vault.
    CREATE TABLE IF NOT EXISTS vault_shards (
      vault_id    TEXT NOT NULL,
      player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      desk        TEXT NOT NULL,
      at          INTEGER NOT NULL,
      PRIMARY KEY (vault_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS vaults_opened (
      vault_id    TEXT PRIMARY KEY,
      opened_at   INTEGER NOT NULL
    );

    -- The wire: what happened, never the answer.
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kind        TEXT NOT NULL,
      player_id   TEXT,
      text        TEXT NOT NULL,
      at          INTEGER NOT NULL
    );
  `);
  return db;
}
