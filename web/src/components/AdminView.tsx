import { useState } from 'react';
import type { Settings, StandingRow } from '@shared/types';
import { BANK_MAX_MS, BANK_MIN_MS, BONUS_MAX_MS, BONUS_MIN_MS, DEFAULT_SETTINGS } from '@shared/types';

interface AdminViewProps {
  settings: Settings;
  standings: StandingRow[];
  onSave: (bankMs: number, turnBonusMs: number) => void;
  onAdjust: (playerId: string, points: number, vp: number) => void;
  onClose: () => void;
}

export function AdminView({ settings, standings, onSave, onAdjust, onClose }: AdminViewProps) {
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
            Återställ till standard (10 min / 20 s)
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">Justera poängställning</h2>
        <p className="muted small">
          Justeringen adderas till spelarens total. Δp = poäng, ΔVP = victory points. Sätt till 0 för att ta
          bort. Justerade spelare markeras med * i tabellen.
        </p>
        <ul className="adjust-list">
          {players.map((row) => (
            <AdjustRow key={row.playerId} row={row} onAdjust={onAdjust} />
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
}: {
  row: StandingRow;
  onAdjust: (playerId: string, points: number, vp: number) => void;
}) {
  const [p, setP] = useState(String(row.adjustPoints));
  const [v, setV] = useState(String(row.adjustVp));
  const dirty = (Number(p) || 0) !== row.adjustPoints || (Number(v) || 0) !== row.adjustVp;

  return (
    <li className="adjust-row">
      <div className="adjust-info">
        <span className="adjust-name">{row.name}</span>
        <span className="adjust-total">
          Totalt: {row.points} p · {row.vp} VP
        </span>
      </div>
      <label className="adjust-field">
        <span>Δp</span>
        <input className="vp-input" type="number" step={1} value={p} onChange={(e) => setP(e.target.value)} />
      </label>
      <label className="adjust-field">
        <span>ΔVP</span>
        <input className="vp-input" type="number" step={1} value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button
        className="btn btn-icon"
        disabled={!dirty}
        onClick={() => onAdjust(row.playerId, Number(p) || 0, Number(v) || 0)}
        aria-label="Spara justering"
      >
        ✓
      </button>
    </li>
  );
}
