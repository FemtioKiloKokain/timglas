// Poängmodell: placering + victory points som skiljeutslag.
//
// Placering och placeringspoäng härleds ur VP vid rapportering (se
// derivePlacements i shared/types) och lagras per resultatrad. Här summeras
// de bara. Summerade VP är skiljeutslag vid lika totalpoäng.
import { getPlayersMap, getResults } from './db';
import type { StandingRow } from '../../shared/types';

export function computeStandings(tournament: string): StandingRow[] {
  const players = getPlayersMap(tournament);
  const results = getResults(tournament);

  type Agg = { games: number; points: number; vp: number; wins: number };
  const agg = new Map<string, Agg>();
  const ensure = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { games: 0, points: 0, vp: 0, wins: 0 };
      agg.set(id, a);
    }
    return a;
  };

  // Ta med alla registrerade spelare, även de utan spelade matcher.
  for (const id of players.keys()) ensure(id);

  for (const r of results) {
    const a = ensure(r.playerId);
    a.games += 1;
    a.points += r.points;
    a.vp += r.vp;
    if (r.placement === 1) a.wins += 1;
  }

  const rows: StandingRow[] = [...agg.entries()].map(([playerId, a]) => ({
    playerId,
    name: players.get(playerId) ?? 'Spelare',
    games: a.games,
    points: a.points,
    vp: a.vp,
    wins: a.wins,
  }));

  rows.sort(
    (x, y) =>
      y.points - x.points ||
      y.vp - x.vp ||
      y.wins - x.wins ||
      x.name.localeCompare(y.name, 'sv'),
  );

  return rows;
}
