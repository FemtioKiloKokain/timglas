import type { RoomView, Snapshot } from '@shared/types';
import { MAX_SEATS } from '@shared/types';
import { resourceFor } from '../resources';

interface HomeProps {
  slug: string;
  snapshot: Snapshot;
  playerId: string;
  onOpenRoom: (index: number) => void;
}

const STATUS_LABEL: Record<RoomView['status'], string> = {
  lobby: 'Väntar',
  running: 'Pågår',
  reporting: 'Rapporteras',
};

export function Home({ slug, snapshot, playerId, onOpenRoom }: HomeProps) {
  const myRoom = snapshot.rooms.find((r) => r.seats.some((s) => s.playerId === playerId));
  const ongoing = myRoom && myRoom.status !== 'lobby' ? myRoom : null;

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Tävling</div>
        <h1 className="title">{slug}</h1>
      </header>

      {ongoing && (
        <button className="alert-banner" onClick={() => onOpenRoom(ongoing.index)}>
          Ditt spel {ongoing.status === 'running' ? 'pågår' : 'ska rapporteras'} i Rum {ongoing.index + 1} → öppna
        </button>
      )}

      <section>
        <h2 className="section-title">Rum</h2>
        <div className="room-grid">
          {snapshot.rooms.map((room) => (
            <RoomCard
              key={room.index}
              room={room}
              playerId={playerId}
              onOpen={() => onOpenRoom(room.index)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Poängställning</h2>
        <Standings snapshot={snapshot} playerId={playerId} />
      </section>

      <p className="muted small">
        Poäng: placering (3-2-1-0) med summerade victory points som skiljeutslag. ⏳ = matcher där
        tidsbanken tog slut. * = justerad av admin.
      </p>
    </div>
  );
}

function RoomCard({
  room,
  playerId,
  onOpen,
}: {
  room: RoomView;
  playerId: string;
  onOpen: () => void;
}) {
  const iAmHere = room.seats.some((s) => s.playerId === playerId);
  const resource = resourceFor(room.index);
  return (
    <button className={`room-card status-${room.status}`} onClick={onOpen}>
      <div className="room-card-head">
        <span className={`hex ${resource.cls}`}>{room.index + 1}</span>
        <div className="room-card-title">
          <span className="room-name">Rum {room.index + 1}</span>
          <span className="room-resource">{resource.name}</span>
        </div>
        <span className={`badge badge-${room.status}`}>{STATUS_LABEL[room.status]}</span>
      </div>
      <div className="room-card-seats">
        {room.seats.length === 0 && <span className="muted">Tomt</span>}
        {room.seats.map((s, i) => {
          const isCurrent = room.status === 'running' && room.currentSeat === i;
          return (
            <span
              key={s.playerId}
              className={`chip${isCurrent ? ' chip-current' : ''}${s.playerId === playerId ? ' chip-me' : ''}`}
            >
              {room.status === 'lobby' && (s.ready ? '✓ ' : '')}
              {s.name}
            </span>
          );
        })}
      </div>
      <div className="room-card-foot muted">
        {room.seats.length}/{MAX_SEATS} spelare
        {iAmHere && ' · du sitter här'}
      </div>
    </button>
  );
}

function Standings({ snapshot, playerId }: { snapshot: Snapshot; playerId: string }) {
  // Alla anslutna spelare visas direkt; de utan spelade matcher tonas ned.
  const rows = snapshot.standings;
  if (rows.length === 0) {
    return <p className="muted">Inga spelare anslutna än.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Spelare</th>
            <th className="num">P</th>
            <th className="num">VP</th>
            <th className="num">V</th>
            <th className="num" title="Matcher där tidsbanken tog slut">⏳</th>
            <th className="num">Sp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const adjusted = r.adjustPoints !== 0 || r.adjustVp !== 0;
            const hasStanding = r.games > 0 || adjusted;
            const classes = [r.playerId === playerId ? 'me' : '', hasStanding ? '' : 'inactive']
              .filter(Boolean)
              .join(' ');
            return (
              <tr key={r.playerId} className={classes}>
                <td>{hasStanding ? i + 1 : '–'}</td>
                <td>
                  {r.name}
                  {adjusted && (
                    <span className="adj-mark" title="Justerad av admin">
                      *
                    </span>
                  )}
                </td>
                <td className="num strong">{r.points}</td>
                <td className="num">{r.vp}</td>
                <td className="num">{r.wins}</td>
                <td className="num">
                  {r.timeouts > 0 ? <span className="timeout-count">{r.timeouts}</span> : '–'}
                </td>
                <td className="num">{r.games}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
