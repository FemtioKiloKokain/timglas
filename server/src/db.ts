// SQLite-lager. Allt tillstånd persisteras lokalt så att en omstart av servern
// återställer både pågående spel och poängtabellen.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GameStatus, Settings } from '../../shared/types';

export interface PersistedSeat {
  playerId: string;
  ready: boolean;
  bankMs: number;
  timedOut: boolean;
}

export interface PersistedRoom {
  index: number;
  status: GameStatus;
  seats: PersistedSeat[];
  currentSeat: number;
  turnStartedAt: number | null;
  paused: boolean;
  pausedElapsedMs: number;
  gameId: string | null;
}

export interface ResultRow {
  gameId: string;
  playerId: string;
  placement: number;
  points: number;
  vp: number;
  timedOut: number;
}

const DB_PATH = process.env.DB_PATH ?? 'data/tournament.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    tournament TEXT NOT NULL,
    id         TEXT NOT NULL,
    name       TEXT NOT NULL,
    PRIMARY KEY (tournament, id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament TEXT NOT NULL,
    game_id    TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    placement  INTEGER NOT NULL,
    points     INTEGER NOT NULL DEFAULT 0,
    vp         INTEGER NOT NULL DEFAULT 0,
    timed_out  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_results_tournament ON results(tournament);

  CREATE TABLE IF NOT EXISTS live_state (
    tournament TEXT PRIMARY KEY,
    rooms_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    tournament    TEXT PRIMARY KEY,
    bank_ms       INTEGER NOT NULL,
    turn_bonus_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS adjustments (
    tournament TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    points     INTEGER NOT NULL DEFAULT 0,
    vp         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tournament, player_id)
  );
`);

// Migreringar: lägg till kolumner för databaser skapade innan de fanns.
const resultCols = (db.pragma('table_info(results)') as { name: string }[]).map((c) => c.name);
if (!resultCols.includes('points')) {
  db.exec(`ALTER TABLE results ADD COLUMN points INTEGER NOT NULL DEFAULT 0`);
}
if (!resultCols.includes('timed_out')) {
  db.exec(`ALTER TABLE results ADD COLUMN timed_out INTEGER NOT NULL DEFAULT 0`);
}

const stmtUpsertPlayer = db.prepare(
  `INSERT INTO players (tournament, id, name) VALUES (?, ?, ?)
   ON CONFLICT(tournament, id) DO UPDATE SET name = excluded.name`,
);
export function upsertPlayer(tournament: string, id: string, name: string): void {
  stmtUpsertPlayer.run(tournament, id, name);
}

const stmtAllPlayers = db.prepare(`SELECT tournament, id, name FROM players`);
export function loadAllPlayers(): Map<string, Map<string, string>> {
  const byTournament = new Map<string, Map<string, string>>();
  for (const row of stmtAllPlayers.all() as { tournament: string; id: string; name: string }[]) {
    let m = byTournament.get(row.tournament);
    if (!m) {
      m = new Map();
      byTournament.set(row.tournament, m);
    }
    m.set(row.id, row.name);
  }
  return byTournament;
}

const stmtPlayersOf = db.prepare(`SELECT id, name FROM players WHERE tournament = ?`);
export function getPlayersMap(tournament: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const row of stmtPlayersOf.all(tournament) as { id: string; name: string }[]) {
    m.set(row.id, row.name);
  }
  return m;
}

const stmtSaveRooms = db.prepare(
  `INSERT INTO live_state (tournament, rooms_json, updated_at) VALUES (?, ?, ?)
   ON CONFLICT(tournament) DO UPDATE SET rooms_json = excluded.rooms_json, updated_at = excluded.updated_at`,
);
export function saveRooms(tournament: string, rooms: PersistedRoom[]): void {
  stmtSaveRooms.run(tournament, JSON.stringify(rooms), Date.now());
}

const stmtAllRooms = db.prepare(`SELECT tournament, rooms_json FROM live_state`);
export function loadAllRooms(): Map<string, PersistedRoom[]> {
  const byTournament = new Map<string, PersistedRoom[]>();
  for (const row of stmtAllRooms.all() as { tournament: string; rooms_json: string }[]) {
    try {
      byTournament.set(row.tournament, JSON.parse(row.rooms_json) as PersistedRoom[]);
    } catch {
      // trasig rad – hoppa över, rummet återskapas tomt
    }
  }
  return byTournament;
}

const stmtInsertResult = db.prepare(
  `INSERT INTO results (tournament, game_id, player_id, placement, points, vp, timed_out, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
export function insertResults(
  tournament: string,
  gameId: string,
  rows: { playerId: string; placement: number; points: number; vp: number; timedOut: number }[],
  now: number,
): void {
  const tx = db.transaction((rs: typeof rows) => {
    for (const r of rs)
      stmtInsertResult.run(tournament, gameId, r.playerId, r.placement, r.points, r.vp, r.timedOut, now);
  });
  tx(rows);
}

const stmtResultsOf = db.prepare(
  `SELECT game_id AS gameId, player_id AS playerId, placement, points, vp, timed_out AS timedOut
   FROM results WHERE tournament = ?`,
);
export function getResults(tournament: string): ResultRow[] {
  return stmtResultsOf.all(tournament) as ResultRow[];
}

const stmtSaveSettings = db.prepare(
  `INSERT INTO settings (tournament, bank_ms, turn_bonus_ms) VALUES (?, ?, ?)
   ON CONFLICT(tournament) DO UPDATE SET bank_ms = excluded.bank_ms, turn_bonus_ms = excluded.turn_bonus_ms`,
);
export function saveSettings(tournament: string, s: Settings): void {
  stmtSaveSettings.run(tournament, s.bankMs, s.turnBonusMs);
}

const stmtAllSettings = db.prepare(`SELECT tournament, bank_ms, turn_bonus_ms FROM settings`);
export function loadAllSettings(): Map<string, Settings> {
  const m = new Map<string, Settings>();
  for (const r of stmtAllSettings.all() as { tournament: string; bank_ms: number; turn_bonus_ms: number }[]) {
    m.set(r.tournament, { bankMs: r.bank_ms, turnBonusMs: r.turn_bonus_ms });
  }
  return m;
}

const stmtSaveAdjustment = db.prepare(
  `INSERT INTO adjustments (tournament, player_id, points, vp) VALUES (?, ?, ?, ?)
   ON CONFLICT(tournament, player_id) DO UPDATE SET points = excluded.points, vp = excluded.vp`,
);
export function setAdjustment(tournament: string, playerId: string, points: number, vp: number): void {
  stmtSaveAdjustment.run(tournament, playerId, points, vp);
}

const stmtAdjustmentsOf = db.prepare(
  `SELECT player_id AS playerId, points, vp FROM adjustments WHERE tournament = ?`,
);
export function getAdjustments(tournament: string): Map<string, { points: number; vp: number }> {
  const m = new Map<string, { points: number; vp: number }>();
  for (const r of stmtAdjustmentsOf.all(tournament) as { playerId: string; points: number; vp: number }[]) {
    m.set(r.playerId, { points: r.points, vp: r.vp });
  }
  return m;
}
