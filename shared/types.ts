// Delade typer och konstanter mellan server och frontend.

/** Startbank per spelare: 10 minuter. */
export const BANK_MS = 10 * 60 * 1000;
/** Tillfällig bonus per tur: 20 sekunder. Används före banken och sparas inte mellan turer. */
export const TURN_BONUS_MS = 20 * 1000;
/** Antal rum/bord per turnering. */
export const ROOM_COUNT = 4;
/** Max antal spelare per rum. */
export const MAX_SEATS = 4;
/** Minsta antal spelare för att kunna starta ett spel. */
export const MIN_PLAYERS_TO_START = 2;
/** Poäng till vinnaren (placering 1). Varje lägre placering ger en poäng mindre, lägst 0. */
export const WINNER_POINTS = 3;

/** Tillåtna intervall för admin-inställda tider. */
export const BANK_MIN_MS = 60 * 1000; // 1 min
export const BANK_MAX_MS = 120 * 60 * 1000; // 120 min
export const BONUS_MIN_MS = 0;
export const BONUS_MAX_MS = 5 * 60 * 1000; // 5 min

/** Tidsinställningar per tävling (satta av admin). */
export interface Settings {
  bankMs: number;
  turnBonusMs: number;
}

export const DEFAULT_SETTINGS: Settings = { bankMs: BANK_MS, turnBonusMs: TURN_BONUS_MS };

export function clampSettings(s: Settings): Settings {
  const clamp = (v: number, lo: number, hi: number) => {
    const n = Number.isFinite(v) ? Math.round(v) : lo;
    return Math.min(hi, Math.max(lo, n));
  };
  return {
    bankMs: clamp(s.bankMs, BANK_MIN_MS, BANK_MAX_MS),
    turnBonusMs: clamp(s.turnBonusMs, BONUS_MIN_MS, BONUS_MAX_MS),
  };
}

export type GameStatus = 'lobby' | 'running' | 'reporting';

export interface SeatView {
  playerId: string;
  name: string;
  ready: boolean;
  /** Kvarvarande bank i ms (exkl. den tillfälliga turbonusen). */
  bankMs: number;
  /** Sant om spelaren tömt sin tidsbank (nått 0) under spelet. */
  timedOut: boolean;
}

export interface RoomView {
  index: number;
  status: GameStatus;
  /** Platser i turordning. */
  seats: SeatView[];
  /** Index i seats för spelaren vars tur det är (när status = running). */
  currentSeat: number;
  /** Serverns tidsstämpel (epoch ms) när nuvarande tur startade, annars null. */
  turnStartedAt: number | null;
  /** Om klockan är pausad. Den aktiva spelarens tid står då still. */
  paused: boolean;
  /** Fryst förfluten tid (ms) för nuvarande tur medan pausad. */
  pausedElapsedMs: number;
  gameId: string | null;
}

export interface StandingRow {
  playerId: string;
  name: string;
  games: number;
  points: number;
  vp: number;
  wins: number;
  /** Antal matcher där spelaren tömde sin tidsbank. */
  timeouts: number;
}

export interface Snapshot {
  type: 'snapshot';
  tournament: string;
  /** Serverns nuvarande tid (epoch ms). Klienten räknar ut sin offset från denna. */
  serverTime: number;
  rooms: RoomView[];
  standings: StandingRow[];
  settings: Settings;
}

export interface ErrorMsg {
  type: 'error';
  message: string;
}

/** Per-anslutnings-meddelande: säger om just den här klienten är admin. */
export interface WelcomeMsg {
  type: 'welcome';
  admin: boolean;
}

export type ServerMsg = Snapshot | ErrorMsg | WelcomeMsg;

export type ClientMsg =
  | { type: 'hello'; tournament: string; playerId: string; name: string; adminKey?: string }
  | { type: 'setName'; name: string }
  | { type: 'setSettings'; bankMs: number; turnBonusMs: number }
  | { type: 'joinRoom'; roomIndex: number }
  | { type: 'leaveRoom' }
  | { type: 'reorder'; roomIndex: number; order: string[] }
  | { type: 'setReady'; roomIndex: number; ready: boolean }
  | { type: 'pressClock'; roomIndex: number }
  | { type: 'setPaused'; roomIndex: number; paused: boolean }
  | { type: 'endGame'; roomIndex: number }
  | { type: 'cancelGame'; roomIndex: number }
  | { type: 'reportResult'; roomIndex: number; results: { playerId: string; vp: number }[] };

export interface PlacementResult {
  playerId: string;
  vp: number;
  placement: number;
  points: number;
}

/**
 * Härleder placering och placeringspoäng ur victory points.
 * Fast skala: vinnaren får WINNER_POINTS (3), varje lägre placering en poäng
 * mindre, lägst 0 – alltså 3-2-1-0 för placering 1–4 oavsett spelarantal.
 * Lika VP delar samma (bättre) placering: t.ex. fyra spelare med VP 10/7/7/7
 * ger placeringarna 1,2,2,2 och poängen 3-2-2-2. I en trespelarmatch är sista
 * plats (3:e) garanterat 1 poäng.
 */
export function derivePlacements(entries: { playerId: string; vp: number }[]): PlacementResult[] {
  const sorted = [...entries].sort((a, b) => b.vp - a.vp);
  const out: PlacementResult[] = [];
  let placement = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i].vp !== sorted[i - 1].vp) placement = i + 1;
    out.push({
      playerId: sorted[i].playerId,
      vp: sorted[i].vp,
      placement,
      points: Math.max(0, WINNER_POINTS - placement + 1),
    });
  }
  return out;
}

/** Svensk ordningsförkortning: 1:a, 2:a, 3:e, 4:e … */
export function ordinal(placement: number): string {
  return `${placement}:${placement <= 2 ? 'a' : 'e'}`;
}

/** Formaterar millisekunder som m:ss (negativa värden får ett ledande minus). */
export function fmtTime(ms: number): string {
  const negative = ms < 0;
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${negative ? '-' : ''}${minutes}:${String(seconds).padStart(2, '0')}`;
}
