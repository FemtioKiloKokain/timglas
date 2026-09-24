import { useState } from 'react';
import { normalize } from '../routing';

export function TournamentChooser({ onChoose }: { onChoose: (slug: string) => void }) {
  const [value, setValue] = useState('');
  const slug = normalize(value);

  return (
    <div className="app">
      <div className="card centered">
        <div className="brand brand-lg">
          <span className="brand-hex">T</span>
          <span className="brand-name">Timglas</span>
        </div>
        <p className="tagline">Turordningsklocka för brädspelsturneringar</p>
        <p className="muted">
          Ange en tävlingskod. Alla som skriver in samma kod hamnar i samma turnering – med egna rum och egen
          poängtabell.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (slug) onChoose(slug);
          }}
        >
          <input
            className="text-input"
            autoFocus
            maxLength={40}
            placeholder="t.ex. catan-2026"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn btn-primary btn-block" type="submit" disabled={!slug}>
            Öppna tävling
          </button>
        </form>
      </div>
    </div>
  );
}
