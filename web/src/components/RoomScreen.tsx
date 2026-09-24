import { useEffect, useState } from 'react';
import type { ClientMsg, RoomView } from '@shared/types';
import { derivePlacements, fmtTime, MAX_SEATS, ordinal } from '@shared/types';
import { resourceFor } from '../resources';

interface RoomScreenProps {
  room: RoomView;
  playerId: string;
  turnBonusMs: number;
  send: (msg: ClientMsg) => void;
  serverNow: () => number;
  onBack: () => void;
}

export function RoomScreen({ room, playerId, turnBonusMs, send, serverNow, onBack }: RoomScreenProps) {
  return (
    <div className="page">
      <header className="topbar">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Rum
        </button>
        <h1 className="title with-hex">
          <span className={`hex hex-sm ${resourceFor(room.index).cls}`}>{room.index + 1}</span>
          Rum {room.index + 1}
        </h1>
        <span className="topbar-spacer" />
      </header>

      {room.status === 'lobby' && <Lobby room={room} playerId={playerId} send={send} />}
      {room.status === 'running' && (
        <Clock
          room={room}
          playerId={playerId}
          turnBonusMs={turnBonusMs}
          send={send}
          serverNow={serverNow}
        />
      )}
      {room.status === 'reporting' && <Reporting room={room} playerId={playerId} send={send} />}
    </div>
  );
}

function Lobby({
  room,
  playerId,
  send,
}: {
  room: RoomView;
  playerId: string;
  send: (msg: ClientMsg) => void;
}) {
  const mySeat = room.seats.find((s) => s.playerId === playerId);
  const roomFull = room.seats.length >= MAX_SEATS;

  const move = (index: number, dir: -1 | 1) => {
    const order = room.seats.map((s) => s.playerId);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    send({ type: 'reorder', roomIndex: room.index, order });
  };

  return (
    <div className="stack">
      <p className="muted">
        Turordning bestäms av tärningskast – dra spelarna till rätt ordning med pilarna. Klockan startar
        automatiskt när alla har tryckt <strong>Redo</strong>.
      </p>

      <ol className="seat-list">
        {room.seats.map((s, i) => (
          <li key={s.playerId} className={`seat-row${s.playerId === playerId ? ' me' : ''}`}>
            <span className="seat-pos">{i + 1}</span>
            <span className="seat-name">
              {s.name}
              {s.ready && <span className="ready-tag">Redo</span>}
            </span>
            <span className="seat-actions">
              <button className="btn btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Flytta upp">
                ↑
              </button>
              <button
                className="btn btn-icon"
                onClick={() => move(i, 1)}
                disabled={i === room.seats.length - 1}
                aria-label="Flytta ned"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
        {room.seats.length === 0 && <li className="muted seat-empty">Inga spelare ännu.</li>}
      </ol>

      <div className="stack">
        {mySeat ? (
          <>
            <button
              className={`btn btn-block ${mySeat.ready ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => send({ type: 'setReady', roomIndex: room.index, ready: !mySeat.ready })}
            >
              {mySeat.ready ? 'Avmarkera redo' : 'Jag är redo'}
            </button>
            <button className="btn btn-block btn-ghost" onClick={() => send({ type: 'leaveRoom' })}>
              Lämna rummet
            </button>
          </>
        ) : roomFull ? (
          <p className="muted">Rummet är fullt ({MAX_SEATS} spelare).</p>
        ) : (
          <button className="btn btn-block btn-primary" onClick={() => send({ type: 'joinRoom', roomIndex: room.index })}>
            Sätt dig i rummet
          </button>
        )}
      </div>
    </div>
  );
}

function Clock({
  room,
  playerId,
  turnBonusMs,
  send,
  serverNow,
}: {
  room: RoomView;
  playerId: string;
  turnBonusMs: number;
  send: (msg: ClientMsg) => void;
  serverNow: () => number;
}) {
  // Tickar lokalt för att räkna ner mot serverns tidsstämpel.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const iAmSeated = room.seats.some((s) => s.playerId === playerId);
  const current = room.seats[room.currentSeat];
  const paused = room.paused;
  const elapsed = paused
    ? room.pausedElapsedMs
    : room.turnStartedAt != null
      ? serverNow() - room.turnStartedAt
      : 0;
  const remaining = current.bankMs + turnBonusMs - elapsed;
  const bankIfPassNow = Math.max(0, current.bankMs - Math.max(0, elapsed - turnBonusMs));
  const overtime = remaining < 0;

  return (
    <div className="stack">
      <button
        className={`clock-button${paused ? ' paused' : ''}${overtime && !paused ? ' overtime' : ''}${
          !iAmSeated ? ' spectator' : ''
        }`}
        onClick={() => iAmSeated && !paused && send({ type: 'pressClock', roomIndex: room.index })}
        disabled={!iAmSeated || paused}
      >
        <span className="clock-turn-label">Tur: {current.name}</span>
        <span className="clock-time">{fmtTime(remaining)}</span>
        <span className="clock-sub">
          {paused
            ? 'Pausad'
            : overtime
              ? 'Tid slut – banken tar slut'
              : `Bank om du passar nu: ${fmtTime(bankIfPassNow)}`}
        </span>
        <span className="clock-hint">
          {paused
            ? 'Klockan står still – tryck Fortsätt'
            : iAmSeated
              ? 'Tryck för att lämna över turen'
              : 'Du tittar på'}
        </span>
      </button>

      <button
        className={`btn btn-block ${paused ? 'btn-primary' : 'btn-ghost'}`}
        disabled={!iAmSeated}
        onClick={() => send({ type: 'setPaused', roomIndex: room.index, paused: !paused })}
      >
        {paused ? '▶ Fortsätt' : '⏸ Paus'}
      </button>

      <div className="clock-seats">
        {room.seats.map((s, i) => (
          <div
            key={s.playerId}
            className={`clock-seat${i === room.currentSeat ? ' current' : ''}${s.playerId === playerId ? ' me' : ''}`}
          >
            <span className="clock-seat-name">{s.name}</span>
            <span className="clock-seat-bank">{fmtTime(s.bankMs)}</span>
          </div>
        ))}
      </div>

      <div className="stack">
        <button
          className="btn btn-block btn-danger"
          disabled={!iAmSeated}
          onClick={() => {
            if (window.confirm('Avsluta spelet? Ni går sedan vidare till att rapportera resultatet.')) {
              send({ type: 'endGame', roomIndex: room.index });
            }
          }}
        >
          Avsluta spel
        </button>
        <button
          className="btn btn-block btn-ghost"
          disabled={!iAmSeated}
          onClick={() => {
            if (window.confirm('Avbryta spelet utan att spara resultat? Rummet nollställs.')) {
              send({ type: 'cancelGame', roomIndex: room.index });
            }
          }}
        >
          Avbryt spel
        </button>
      </div>
    </div>
  );
}

function Reporting({
  room,
  playerId,
  send,
}: {
  room: RoomView;
  playerId: string;
  send: (msg: ClientMsg) => void;
}) {
  const iAmSeated = room.seats.some((s) => s.playerId === playerId);
  const [vp, setVp] = useState<Record<string, string>>({});

  const allFilled = room.seats.every((s) => (vp[s.playerId] ?? '').trim() !== '');
  // Placering och poäng räknas ut live ur inmatade VP (lika VP delar placering).
  const entries = room.seats.map((s) => ({ playerId: s.playerId, vp: Number(vp[s.playerId]) || 0 }));
  const placed = new Map(derivePlacements(entries).map((p) => [p.playerId, p]));

  const submit = () => {
    if (!window.confirm('Rapportera det här resultatet till poängtabellen?')) return;
    const results = room.seats.map((s) => ({ playerId: s.playerId, vp: Number(vp[s.playerId]) || 0 }));
    send({ type: 'reportResult', roomIndex: room.index, results });
  };

  return (
    <div className="stack">
      <p className="muted">
        Ange victory points för varje spelare. Placering och poäng räknas ut automatiskt – lika VP delar
        placering.
      </p>

      <ul className="seat-list">
        {room.seats.map((s) => {
          const p = placed.get(s.playerId)!;
          const showResult = allFilled;
          return (
            <li
              key={s.playerId}
              className={`seat-row${s.playerId === playerId ? ' me' : ''}${
                showResult && p.placement === 1 ? ' winner' : ''
              }`}
            >
              <span className="place-badge">{showResult ? ordinal(p.placement) : '–'}</span>
              <span className="seat-name">{s.name}</span>
              <span className="place-points">{showResult ? `${p.points} p` : ''}</span>
              <input
                className="vp-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={30}
                placeholder="VP"
                value={vp[s.playerId] ?? ''}
                onChange={(e) => setVp((prev) => ({ ...prev, [s.playerId]: e.target.value }))}
              />
            </li>
          );
        })}
      </ul>

      <button className="btn btn-block btn-primary" onClick={submit} disabled={!iAmSeated || !allFilled}>
        Rapportera resultat
      </button>
      <button
        className="btn btn-block btn-ghost"
        disabled={!iAmSeated}
        onClick={() => {
          if (window.confirm('Avbryt utan att spara resultat? Rummet nollställs.')) {
            send({ type: 'cancelGame', roomIndex: room.index });
          }
        }}
      >
        Avbryt utan att spara
      </button>
    </div>
  );
}
