// Serverns spellogik. Serverklockan är den enda sanningen, så alla klienter
// räknar ner mot samma tidsstämpel utan risk för drift mellan enheter.
import { randomUUID } from 'node:crypto';
import * as db from './db';
import type { PersistedRoom } from './db';
import { computeStandings } from './scoring';
import {
  ROOM_COUNT,
  MAX_SEATS,
  MIN_PLAYERS_TO_START,
  DEFAULT_SETTINGS,
  clampSettings,
  derivePlacements,
  type GameStatus,
  type RoomView,
  type Settings,
  type Snapshot,
} from '../../shared/types';

interface TournamentState {
  slug: string;
  rooms: PersistedRoom[];
  names: Map<string, string>;
  settings: Settings;
}

function emptyRooms(): PersistedRoom[] {
  return Array.from({ length: ROOM_COUNT }, (_, i) => ({
    index: i,
    status: 'lobby' as GameStatus,
    seats: [],
    currentSeat: 0,
    turnStartedAt: null,
    paused: false,
    pausedElapsedMs: 0,
    gameId: null,
  }));
}

export class Hub {
  private tournaments = new Map<string, TournamentState>();

  constructor() {
    const roomsByTournament = db.loadAllRooms();
    const playersByTournament = db.loadAllPlayers();
    const settingsByTournament = db.loadAllSettings();
    const slugs = new Set<string>([
      ...roomsByTournament.keys(),
      ...playersByTournament.keys(),
      ...settingsByTournament.keys(),
    ]);
    for (const slug of slugs) {
      this.tournaments.set(slug, {
        slug,
        rooms: normalizeRooms(roomsByTournament.get(slug)),
        names: playersByTournament.get(slug) ?? new Map(),
        settings: settingsByTournament.get(slug) ?? { ...DEFAULT_SETTINGS },
      });
    }
  }

  private get(slug: string): TournamentState {
    let t = this.tournaments.get(slug);
    if (!t) {
      t = { slug, rooms: emptyRooms(), names: new Map(), settings: { ...DEFAULT_SETTINGS } };
      this.tournaments.set(slug, t);
    }
    return t;
  }

  private persist(t: TournamentState): void {
    db.saveRooms(t.slug, t.rooms);
  }

  private roomOf(t: TournamentState, playerId: string): PersistedRoom | null {
    return t.rooms.find((r) => r.seats.some((s) => s.playerId === playerId)) ?? null;
  }

  private roomAt(t: TournamentState, index: number): PersistedRoom {
    const room = t.rooms[index];
    if (!room) throw new Error('Rummet finns inte');
    return room;
  }

  ensure(slug: string): void {
    this.get(slug);
  }

  setPlayer(slug: string, id: string, rawName: string): void {
    const t = this.get(slug);
    const name = rawName.trim().slice(0, 24) || 'Spelare';
    t.names.set(id, name);
    db.upsertPlayer(slug, id, name);
  }

  /** Hittar id:t för en spelare vars namn matchar (skiftlägesokänsligt), annars null. */
  findIdByName(slug: string, rawName: string): string | null {
    const t = this.get(slug);
    const target = normName(rawName);
    if (!target) return null;
    for (const [id, disp] of t.names) {
      if (normName(disp) === target) return id;
    }
    return null;
  }

  join(slug: string, playerId: string, roomIndex: number): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'lobby') throw new Error('Spelet har redan börjat i det rummet');

    const current = this.roomOf(t, playerId);
    if (current) {
      if (current.index === roomIndex) return;
      if (current.status !== 'lobby') throw new Error('Du sitter i ett pågående spel');
      current.seats = current.seats.filter((s) => s.playerId !== playerId);
    }

    if (room.seats.length >= MAX_SEATS) throw new Error('Rummet är fullt');
    room.seats.push({ playerId, ready: false, bankMs: t.settings.bankMs, timedOut: false });
    this.persist(t);
  }

  leave(slug: string, playerId: string): void {
    const t = this.get(slug);
    const room = this.roomOf(t, playerId);
    if (!room) return;
    if (room.status !== 'lobby') throw new Error('Du kan inte lämna ett pågående spel');
    room.seats = room.seats.filter((s) => s.playerId !== playerId);
    this.persist(t);
  }

  reorder(slug: string, roomIndex: number, order: string[]): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'lobby') throw new Error('Går inte att ändra ordning nu');
    const ids = new Set(room.seats.map((s) => s.playerId));
    if (order.length !== room.seats.length || !order.every((id) => ids.has(id))) {
      throw new Error('Ogiltig ordning');
    }
    room.seats = order.map((id) => room.seats.find((s) => s.playerId === id)!);
    this.persist(t);
  }

  setReady(slug: string, playerId: string, roomIndex: number, ready: boolean): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'lobby') throw new Error('Går inte att ändra redo-status nu');
    const seat = room.seats.find((s) => s.playerId === playerId);
    if (!seat) throw new Error('Du sitter inte i rummet');
    seat.ready = ready;

    // Starta automatiskt när alla i rummet är redo.
    if (room.seats.length >= MIN_PLAYERS_TO_START && room.seats.every((s) => s.ready)) {
      room.status = 'running';
      room.currentSeat = 0;
      room.turnStartedAt = Date.now();
      room.paused = false;
      room.pausedElapsedMs = 0;
      room.gameId = randomUUID();
      for (const s of room.seats) {
        s.bankMs = t.settings.bankMs;
        s.timedOut = false;
      }
    }
    this.persist(t);
  }

  press(slug: string, playerId: string, roomIndex: number): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'running' || room.turnStartedAt == null) throw new Error('Klockan är inte igång');
    if (room.paused) throw new Error('Klockan är pausad');
    if (!room.seats.some((s) => s.playerId === playerId)) throw new Error('Du sitter inte i rummet');

    const now = Date.now();
    const current = room.seats[room.currentSeat];
    const elapsed = now - room.turnStartedAt;
    // Turbonusen används först; banken tickar bara på överskjutande tid.
    const overflow = Math.max(0, elapsed - t.settings.turnBonusMs);
    current.bankMs = Math.max(0, current.bankMs - overflow);
    if (current.bankMs === 0) current.timedOut = true;

    room.currentSeat = (room.currentSeat + 1) % room.seats.length;
    room.turnStartedAt = now;
    this.persist(t);
  }

  setPaused(slug: string, playerId: string, roomIndex: number, paused: boolean): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'running' || room.turnStartedAt == null) throw new Error('Klockan är inte igång');
    if (!room.seats.some((s) => s.playerId === playerId)) throw new Error('Du sitter inte i rummet');
    if (paused === room.paused) return;

    const now = Date.now();
    if (paused) {
      // Frys hur mycket av turen som gått.
      room.pausedElapsedMs = Math.max(0, now - room.turnStartedAt);
      room.paused = true;
    } else {
      // Återuppta: flytta fram starten så att förfluten tid fortsätter där den frös.
      room.turnStartedAt = now - room.pausedElapsedMs;
      room.paused = false;
      room.pausedElapsedMs = 0;
    }
    this.persist(t);
  }

  endGame(slug: string, playerId: string, roomIndex: number): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'running') throw new Error('Inget pågående spel');
    if (!room.seats.some((s) => s.playerId === playerId)) throw new Error('Du sitter inte i rummet');

    // Slutför den aktiva spelarens tur så att en ev. tömd bank fångas.
    if (room.turnStartedAt != null) {
      const cur = room.seats[room.currentSeat];
      const elapsed = room.paused ? room.pausedElapsedMs : Date.now() - room.turnStartedAt;
      const overflow = Math.max(0, elapsed - t.settings.turnBonusMs);
      cur.bankMs = Math.max(0, cur.bankMs - overflow);
      if (cur.bankMs === 0) cur.timedOut = true;
    }

    room.status = 'reporting';
    room.turnStartedAt = null;
    room.paused = false;
    room.pausedElapsedMs = 0;
    this.persist(t);
  }

  cancelGame(slug: string, playerId: string, roomIndex: number): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (!room.seats.some((s) => s.playerId === playerId)) throw new Error('Du sitter inte i rummet');
    resetToLobby(room, t.settings.bankMs);
    this.persist(t);
  }

  report(
    slug: string,
    playerId: string,
    roomIndex: number,
    results: { playerId: string; vp: number }[],
  ): void {
    const t = this.get(slug);
    const room = this.roomAt(t, roomIndex);
    if (room.status !== 'reporting') throw new Error('Spelet är inte redo att rapporteras');
    if (!room.seats.some((s) => s.playerId === playerId)) throw new Error('Du sitter inte i rummet');

    const seatIds = new Set(room.seats.map((s) => s.playerId));
    const reported = results.map((r) => r.playerId);
    if (reported.length !== room.seats.length || !reported.every((id) => seatIds.has(id))) {
      throw new Error('Ogiltig resultatlista');
    }
    if (new Set(reported).size !== reported.length) throw new Error('Dubbletter i resultatlistan');

    const gameId = room.gameId ?? randomUUID();
    // Placering och poäng härleds ur VP (fast skala 3-2-1-0); lika VP delar placering.
    const clean = results.map((r) => ({
      playerId: r.playerId,
      vp: Math.max(0, Math.round(Number(r.vp) || 0)),
    }));
    const rows = derivePlacements(clean).map((p) => ({
      playerId: p.playerId,
      placement: p.placement,
      points: p.points,
      vp: p.vp,
      timedOut: room.seats.find((s) => s.playerId === p.playerId)?.timedOut ? 1 : 0,
    }));
    db.insertResults(slug, gameId, rows, Date.now());

    resetToLobby(room, t.settings.bankMs);
    this.persist(t);
  }

  snapshot(slug: string): Snapshot {
    const t = this.get(slug);
    const rooms: RoomView[] = t.rooms.map((r) => ({
      index: r.index,
      status: r.status,
      currentSeat: r.currentSeat,
      turnStartedAt: r.turnStartedAt,
      paused: r.paused ?? false,
      pausedElapsedMs: r.pausedElapsedMs ?? 0,
      gameId: r.gameId,
      seats: r.seats.map((s) => ({
        playerId: s.playerId,
        name: t.names.get(s.playerId) ?? 'Spelare',
        ready: s.ready,
        bankMs: s.bankMs,
        timedOut: s.timedOut ?? false,
      })),
    }));
    return {
      type: 'snapshot',
      tournament: slug,
      serverTime: Date.now(),
      rooms,
      standings: computeStandings(slug),
      settings: t.settings,
    };
  }

  setSettings(slug: string, bankMs: number, turnBonusMs: number): void {
    const t = this.get(slug);
    t.settings = clampSettings({ bankMs, turnBonusMs });
    db.saveSettings(slug, t.settings);
  }

  setAdjustment(slug: string, playerId: string, points: number, vp: number): void {
    this.get(slug); // säkerställ att tävlingen finns
    const p = Number.isFinite(points) ? Math.round(points) : 0;
    const v = Number.isFinite(vp) ? Math.round(vp) : 0;
    db.setAdjustment(slug, playerId, p, v);
  }
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resetToLobby(room: PersistedRoom, bankMs: number): void {
  room.status = 'lobby';
  room.currentSeat = 0;
  room.turnStartedAt = null;
  room.paused = false;
  room.pausedElapsedMs = 0;
  room.gameId = null;
  for (const s of room.seats) {
    s.ready = false;
    s.bankMs = bankMs;
    s.timedOut = false;
  }
}

// Säkerställ att ett laddat tillstånd alltid har exakt ROOM_COUNT rum i rätt ordning.
function normalizeRooms(loaded: PersistedRoom[] | undefined): PersistedRoom[] {
  const base = emptyRooms();
  if (!loaded) return base;
  for (const room of loaded) {
    if (room && typeof room.index === 'number' && room.index >= 0 && room.index < ROOM_COUNT) {
      base[room.index] = { ...base[room.index], ...room, index: room.index };
    }
  }
  return base;
}
