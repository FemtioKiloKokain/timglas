import { useEffect, useRef, useState } from 'react';

interface AppHeaderProps {
  name: string;
  admin: boolean;
  onChangeName: (name: string) => void;
  onHome: () => void;
  onOpenAdmin: () => void;
  onLeaveTournament: () => void;
}

export function AppHeader({ name, admin, onChangeName, onHome, onOpenAdmin, onLeaveTournament }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const rename = () => {
    const next = window.prompt('Ditt namn', name);
    if (next && next.trim()) onChangeName(next.trim().slice(0, 24));
  };

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <button className="brand" onClick={onHome} aria-label="Till start">
          <span className="brand-hex">T</span>
          <span className="brand-name">Timglas</span>
        </button>

        <div className="header-actions">
          <button className="user-chip" onClick={rename} title="Byt namn">
            <span className="user-avatar">{initial}</span>
            <span className="user-name">{name}</span>
          </button>

          <div className="menu" ref={menuRef}>
            <button
              className="menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Meny"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="menu-panel" role="menu">
                {admin && (
                  <button
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAdmin();
                    }}
                  >
                    Admin – tidsinställningar
                  </button>
                )}
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    rename();
                  }}
                >
                  Byt namn
                </button>
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLeaveTournament();
                  }}
                >
                  Byt tävling
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
