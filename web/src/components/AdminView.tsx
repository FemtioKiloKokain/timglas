import { useState } from 'react';
import type { Settings, StandingRow } from '@shared/types';
import { BANK_MAX_MS, BANK_MIN_MS, BONUS_MAX_MS, BONUS_MIN_MS, DEFAULT_SETTINGS } from '@shared/types';

interface AdminViewProps {
  settings: Settings;
  standings: StandingRow[];
  onSave: (bankMs: number, turnBonusMs: number) => void;
  onAdjust: (playerId: string, points: number, vp: number) => void;
  onDelete: (playerId: string) => void;
  onClose: () => void;
}

export function AdminView({ settings, standings, onSave, onAdjust, onDelete, onClose }: AdminViewProps) {
  const [bankMin, setBankMin] = useState(String(settings.bankMs / 60000));
  const [bonusSec, setBonusSec] = useState(String(settings.turnBonusMs / 1000));

  const save = () => {
    const bankMs = Math.round((Number(bankMin) || 0) * 60000);
    const bonusMs = Math.round((Number(bonusSec) || 0) * 1000);
    onSave(bankMs, bonusMs);
  };

  const reset = () => {
    setBankMin(String(DEFAULT_SETTINGS.bankMs / 60000));
    setBonusSec(String(DEFAULT_SETTINGS.turnBonusMs / 1000));
  };

  const players = [...standings].sort((a, b) => a.name.localeCompare(b.name, 'sv'));

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1 className="title">Adminläge</h1>
      </header>

      <section>
        <h2 className="section-title">Tidsinställningar</h2>
        <p className="muted">
          Gäller den här tävlingen. Banktiden används från nästa spel som startas; turtiden gäller direkt.
        </p>

        <div className="stack">
          <label className="field">
            <span className="field-label">Banktid (minuter)</span>
            <input
              className="text-input"
              type="number"
              inputMode="decimal"
              step={0.5}
              min={BANK_MIN_MS / 60000}
              max={BANK_MAX_MS / 60000}
              value={bankMin}
              onChange={(e) => setBankMin(e.target.value)}
            />
            <span className="field-hint">
              {BANK_MIN_MS / 60000}–{BANK_MAX_MS / 60000} min
            </span>
          </label>

          <label className="field">
            <span className="field-label">Tillfällig turtid (sekunder)</span>
            <input
              className="text-input"
              type="number"
              inputMode="numeric"
              step={1}
              min={BONUS_MIN_MS / 1000}
              max={BONUS_MAX_MS / 1000}
              value={bonusSec}
              onChange={(e) => setBonusSec(e.target.value)}
            />
            <span className="field-hint">
              {BONUS_MIN_MS / 1000}–{BONUS_MAX_MS / 1000} s – läggs till varje tur och används före banken
            </span>
          </label>
        </div>

        <p className="muted small">
          Aktuellt sparat: {settings.bankMs / 60000} min bank, {settings.turnBonusMs / 1000} s turtid.
        </p>

        <div className="stack">
          <button className="btn btn-block btn-primary" onClick={save}>
            Spara tidsinställningar
          </button>
          <button className="btn btn-block btn-ghost" onClick={reset}>
            Återställ till standard (10 min / 30 s)
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Justera poängställning</h2>
        <p className="muted small">
          <strong>Sätt total</strong> anger spelarens slutpoäng/VP direkt. <strong>Justera ±</strong> lägger
          till eller drar av (0 = ingen justering). Båda lagras som en justering ovanpå matchresultaten och
          markeras med * i tabellen. 🗑 raderar spelaren och all deras data.
        </p>
        <ul className="adjust-list">
          {players.map((row) => (
            <AdjustRow key={row.playerId} row={row} onAdjust={onAdjust} onDelete={onDelete} />
          ))}
          {players.length === 0 && <li className="muted">Inga spelare än.</li>}
        </ul>
      </section>

      <button className="btn btn-block btn-ghost" onClick={onClose}>
        Klar
      </button>
    </div>
  );
}

function AdjustRow({
  row,
  onAdjust,
  onDelete,
}: {
  row: StandingRow;
  onAdjust: (playerId: string, points: number, vp: number) => void;
  onDelete: (playerId: string) => void;
}) {
  // Poäng/VP som kommer från matcher (totalen minus nuvarande justering).
  const gamesPoints = row.points - row.adjustPoints;
  const gamesVp = row.vp - row.adjustVp;

  const [setP, setSetP] = useState(String(row.points));
  const [setV, setSetV] = useState(String(row.vp));
  const [adjP, setAdjP] = useState(String(row.adjustPoints));
  const [adjV, setAdjV] = useState(String(row.adjustVp));

  const setDirty = (Number(setP) || 0) !== row.points || (Number(setV) || 0) !== row.vp;
  const adjDirty = (Number(adjP) || 0) !== row.adjustPoints || (Number(adjV) || 0) !== row.adjustVp;

  const applySet = () =>
    onAdjust(row.playerId, (Number(setP) || 0) - gamesPoints, (Number(setV) || 0) - gamesVp);
  const applyAdjust = () => onAdjust(row.playerId, Number(adjP) || 0, Number(adjV) || 0);

  return (
    <li className="adjust-row">
      <div className="adjust-head">
        <span className="adjust-name">{row.name}</span>
        <span className="adjust-total">
          Totalt: {row.points} p · {row.vp} VP
        </span>
        <button
          className="btn btn-icon adjust-del"
          onClick={() => {
            if (window.confirm(`Radera ${row.name} och all deras data? Detta går inte att ångra.`)) {
              onDelete(row.playerId);
            }
          }}
          aria-label="Radera spelare"
        >
          🗑
        </button>
      </div>

      <div className="adjust-groups">
        <div className="adjust-group">
          <span className="adjust-group-label">Sätt total</span>
          <label className="adjust-field">
            <span>P</span>
            <input className="vp-input" type="number" step={1} value={setP} onChange={(e) => setSetP(e.target.value)} />
          </label>
          <label className="adjust-field">
            <span>VP</span>
            <input className="vp-input" type="number" step={1} value={setV} onChange={(e) => setSetV(e.target.value)} />
          </label>
          <button className="btn btn-icon" disabled={!setDirty} onClick={applySet} aria-label="Sätt total">
            ✓
          </button>
        </div>

        <div className="adjust-group">
          <span className="adjust-group-label">Justera ±</span>
          <label className="adjust-field">
            <span>Δp</span>
            <input className="vp-input" type="number" step={1} value={adjP} onChange={(e) => setAdjP(e.target.value)} />
          </label>
          <label className="adjust-field">
            <span>ΔVP</span>
            <input className="vp-input" type="number" step={1} value={adjV} onChange={(e) => setAdjV(e.target.value)} />
          </label>
          <button className="btn btn-icon" disabled={!adjDirty} onClick={applyAdjust} aria-label="Spara justering">
            ✓
          </button>
        </div>
      </div>
    </li>
  );
}
