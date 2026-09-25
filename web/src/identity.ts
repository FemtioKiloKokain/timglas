// Spelaridentitet som överlever att man stänger fliken/webbläsaren.
const ID_KEY = 'bgtt.playerId';
const NAME_KEY = 'bgtt.name';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function setPlayerId(id: string): void {
  try {
    localStorage.setItem(ID_KEY, id);
  } catch {
    /* privat läge e.d. */
  }
}

export function getName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* privat läge e.d. – strunt samma */
  }
}
