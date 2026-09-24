import { useEffect } from 'react';

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className="toast" role="alert" onClick={onDone}>
      {message}
    </div>
  );
}
