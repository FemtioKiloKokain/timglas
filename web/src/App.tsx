import { useEffect, useState } from 'react';
import { getName, getPlayerId, setName as persistName } from './identity';
import { parseAdminKey, parseSlug, setSlugInUrl } from './routing';
import { useTournament } from './useTournament';
import { NamePrompt } from './components/NamePrompt';
import { TournamentChooser } from './components/TournamentChooser';
import { Toast } from './components/Toast';
import { AppHeader } from './components/AppHeader';
import { Home } from './components/Home';
import { RoomScreen } from './components/RoomScreen';
import { AdminView } from './components/AdminView';

type View = { name: 'home' } | { name: 'room'; index: number } | { name: 'admin' };

export default function App() {
  const [slug, setSlug] = useState<string | null>(() => parseSlug());
  const [adminKey] = useState<string | undefined>(() => parseAdminKey());
  const playerId = getPlayerId();

  useEffect(() => {
    const onPop = () => setSlug(parseSlug());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const leaveTournament = () => {
    history.pushState(null, '', '/');
    setSlug(null);
  };

  if (!slug) {
    return (
      <TournamentChooser
        onChoose={(s) => {
          setSlugInUrl(s);
          setSlug(s);
        }}
      />
    );
  }

  return (
    <TournamentApp
      slug={slug}
      playerId={playerId}
      adminKey={adminKey}
      onLeaveTournament={leaveTournament}
    />
  );
}

function TournamentApp({
  slug,
  playerId,
  adminKey,
  onLeaveTournament,
}: {
  slug: string;
  playerId: string;
  adminKey?: string;
  onLeaveTournament: () => void;
}) {
  const [name, setNameState] = useState<string>(() => getName());

  const changeName = (n: string) => {
    persistName(n);
    setNameState(n);
  };

  // Anslut inte förrän spelaren har ett namn – då registreras man med ett
  // riktigt namn och syns direkt i poängställningen.
  if (!name) return <NamePrompt onSet={changeName} />;

  return (
    <ConnectedTournament
      slug={slug}
      playerId={playerId}
      name={name}
      adminKey={adminKey}
      onChangeName={changeName}
      onLeaveTournament={onLeaveTournament}
    />
  );
}

function ConnectedTournament({
  slug,
  playerId,
  name,
  adminKey,
  onChangeName,
  onLeaveTournament,
}: {
  slug: string;
  playerId: string;
  name: string;
  adminKey?: string;
  onChangeName: (name: string) => void;
  onLeaveTournament: () => void;
}) {
  const [view, setView] = useState<View>({ name: 'home' });
  const { snapshot, connected, admin, error, clearError, send, serverNow } = useTournament(
    slug,
    playerId,
    name,
    adminKey,
  );

  // Håll serverns namn i synk vid namnbyte.
  useEffect(() => {
    send({ type: 'setName', name });
  }, [name, send]);

  if (!snapshot) {
    return (
      <div className="app">
        <div className="loading">Ansluter…</div>
      </div>
    );
  }

  const room = view.name === 'room' ? snapshot.rooms[view.index] : null;
  const showAdmin = view.name === 'admin' && admin;

  let content;
  if (showAdmin) {
    content = (
      <AdminView
        settings={snapshot.settings}
        onSave={(bankMs, turnBonusMs) => send({ type: 'setSettings', bankMs, turnBonusMs })}
        onClose={() => setView({ name: 'home' })}
      />
    );
  } else if (room) {
    content = (
      <RoomScreen
        room={room}
        playerId={playerId}
        turnBonusMs={snapshot.settings.turnBonusMs}
        send={send}
        serverNow={serverNow}
        onBack={() => setView({ name: 'home' })}
      />
    );
  } else {
    content = (
      <Home
        slug={slug}
        snapshot={snapshot}
        playerId={playerId}
        onOpenRoom={(index) => setView({ name: 'room', index })}
      />
    );
  }

  return (
    <div className="app">
      {!connected && <div className="banner">Återansluter…</div>}
      <AppHeader
        name={name}
        admin={admin}
        onChangeName={onChangeName}
        onHome={() => setView({ name: 'home' })}
        onOpenAdmin={() => setView({ name: 'admin' })}
        onLeaveTournament={onLeaveTournament}
      />
      {error && <Toast message={error} onDone={clearError} />}
      {content}
    </div>
  );
}
