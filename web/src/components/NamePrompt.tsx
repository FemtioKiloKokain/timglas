import { useState } from 'react';

export function NamePrompt({ onSet }: { onSet: (name: string) => void }) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();

  return (
    <div className="app">
      <div className="card centered">
        <h1>Vad heter du?</h1>
        <p className="muted">Namnet visas för de andra spelarna och sparas i den här webbläsaren.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSet(trimmed);
          }}
        >
          <input
            className="text-input"
            autoFocus
            maxLength={24}
            placeholder="Ditt namn"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn btn-primary btn-block" type="submit" disabled={!trimmed}>
            Fortsätt
          </button>
        </form>
      </div>
    </div>
  );
}
