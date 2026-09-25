import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg, Snapshot } from '@shared/types';
import { serverWsUrl } from './config';
import { setPlayerId } from './identity';

export interface TournamentConnection {
  snapshot: Snapshot | null;
  connected: boolean;
  admin: boolean;
  /** Klientens faktiska id (kan ha återtagits via namn av servern). */
  playerId: string;
  error: string | null;
  clearError: () => void;
  send: (msg: ClientMsg) => void;
  /** Serverns nuvarande tid (epoch ms), korrigerad för klientens klockdrift. */
  serverNow: () => number;
}

export function useTournament(
  slug: string,
  requestedPlayerId: string,
  name: string,
  adminKey?: string,
): TournamentConnection {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [playerId, setEffectiveId] = useState(requestedPlayerId);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  const nameRef = useRef(name);
  nameRef.current = name;
  const adminKeyRef = useRef(adminKey);
  adminKeyRef.current = adminKey;
  const effectiveIdRef = useRef(playerId);
  effectiveIdRef.current = playerId;

  useEffect(() => {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect(): void {
      const ws = new WebSocket(serverWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'hello',
            tournament: slug,
            playerId: effectiveIdRef.current,
            name: nameRef.current,
            adminKey: adminKeyRef.current,
          } satisfies ClientMsg),
        );
      };

      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.type === 'snapshot') {
          offsetRef.current = msg.serverTime - Date.now();
          setSnapshot(msg);
        } else if (msg.type === 'welcome') {
          setAdmin(msg.admin);
          if (msg.playerId && msg.playerId !== effectiveIdRef.current) {
            effectiveIdRef.current = msg.playerId;
            setEffectiveId(msg.playerId);
            setPlayerId(msg.playerId); // spara det återtagna id:t för nästa gång
          }
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!closedByUs) retryTimer = setTimeout(connect, 1000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [slug, requestedPlayerId]);

  const send = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  const clearError = useCallback(() => setError(null), []);

  return { snapshot, connected, admin, playerId, error, clearError, send, serverNow };
}
