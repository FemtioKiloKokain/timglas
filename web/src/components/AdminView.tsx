import { useState } from 'react';
import type { Settings } from '@shared/types';
import { BANK_MAX_MS, BANK_MIN_MS, BONUS_MAX_MS, BONUS_MIN_MS, DEFAULT_SETTINGS } from '@shared/types';

interface AdminViewProps {
  settings: Settings;
  onSave: (bankMs: number, turnBonusMs: number) => void;
  onClose: () => void;
}

export function AdminView({ settings, onSave, onClose }: AdminViewProps) {
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

  return (
    <div className="page">
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1 className="title">Tidsinställningar</h1>
      </header>

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
          Spara inställningar
        </button>
        <button className="btn btn-block btn-ghost" onClick={reset}>
          Återställ till standard (10 min / 20 s)
        </button>
        <button className="btn btn-block btn-ghost" onClick={onClose}>
          Klar
        </button>
      </div>
    </div>
  );
}
