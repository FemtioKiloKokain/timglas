// HTTP + WebSocket-server i en enda process. Levererar den byggda frontenden
// (web/dist) i produktion och sköter realtidssynken via WebSocket.
import './env'; // måste vara först: laddar .env innan store/db läser process.env
import http from 'node:http';
import { existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import sirv from 'sirv';
import { Hub } from './store';
import type { ClientMsg } from '../../shared/types';

const PORT = Number(process.env.PORT ?? 3000);
const DIST_DIR = 'web/dist';

// Admin-gate: nyckel via URL-param (?admin=<nyckel>) och/eller spelarnamn.
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin';
const ADMIN_NAMES = (process.env.ADMIN_NAMES ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(key: string | undefined, name: string): boolean {
  if (key && ADMIN_KEY && key === ADMIN_KEY) return true;
  return ADMIN_NAMES.includes(name.trim().toLowerCase());
}

const hub = new Hub();

interface Ctx {
  slug?: string;
  playerId?: string;
  adminKey?: string;
  admin?: boolean;
}
const sockets = new Map<WebSocket, Ctx>();

const assets = existsSync(DIST_DIR)
  ? sirv(DIST_DIR, { single: true, gzip: true, brotli: true })
  : null;

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (assets) {
    assets(req, res, () => {
      res.writeHead(404);
      res.end('Not found');
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Frontend körs av Vite på http://localhost:5173 i dev-läge.');
});

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(slug: string): void {
  const payload = JSON.stringify(hub.snapshot(slug));
  for (const [ws, ctx] of sockets) {
    if (ctx.slug === slug && ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'error', message }));
}

function sanitizeSlug(raw: string): string {
  const clean = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  return clean || 'default';
}

wss.on('connection', (ws) => {
  sockets.set(ws, {});

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const ctx = sockets.get(ws);
    if (!ctx) return;

    try {
      if (msg.type === 'hello') {
        ctx.slug = sanitizeSlug(msg.tournament);
        // Återta en befintlig spelare med samma namn (samma person – ny flik, enhet eller URL).
        const existing = hub.findIdByName(ctx.slug, msg.name);
        ctx.playerId = existing ?? msg.playerId;
        ctx.adminKey = msg.adminKey;
        ctx.admin = isAdmin(msg.adminKey, msg.name);
        hub.setPlayer(ctx.slug, ctx.playerId, msg.name);
        ws.send(JSON.stringify({ type: 'welcome', admin: ctx.admin, playerId: ctx.playerId }));
        ws.send(JSON.stringify(hub.snapshot(ctx.slug)));
        broadcast(ctx.slug);
        return;
      }

      const { slug, playerId } = ctx;
      if (!slug || !playerId) {
        sendError(ws, 'Inte ansluten');
        return;
      }

      switch (msg.type) {
        case 'setName': {
          const owner = hub.findIdByName(slug, msg.name);
          if (owner && owner !== playerId) {
            sendError(ws, 'Namnet är upptaget av en annan spelare');
            break;
          }
          hub.setPlayer(slug, playerId, msg.name);
          const nowAdmin = isAdmin(ctx.adminKey, msg.name);
          if (nowAdmin !== ctx.admin) {
            ctx.admin = nowAdmin;
            ws.send(JSON.stringify({ type: 'welcome', admin: ctx.admin, playerId }));
          }
          break;
        }
        case 'setSettings':
          if (!ctx.admin) throw new Error('Kräver admin');
          hub.setSettings(slug, msg.bankMs, msg.turnBonusMs);
          break;
        case 'setAdjustment':
          if (!ctx.admin) throw new Error('Kräver admin');
          hub.setAdjustment(slug, msg.playerId, msg.points, msg.vp);
          break;
        case 'deletePlayer':
          if (!ctx.admin) throw new Error('Kräver admin');
          hub.deletePlayer(slug, msg.playerId);
          break;
        case 'joinRoom':
          hub.join(slug, playerId, msg.roomIndex);
          break;
        case 'leaveRoom':
          hub.leave(slug, playerId);
          break;
        case 'reorder':
          hub.reorder(slug, msg.roomIndex, msg.order);
          break;
        case 'setReady':
          hub.setReady(slug, playerId, msg.roomIndex, msg.ready);
          break;
        case 'pressClock':
          hub.press(slug, playerId, msg.roomIndex);
          break;
        case 'setPaused':
          hub.setPaused(slug, playerId, msg.roomIndex, msg.paused);
          break;
        case 'endGame':
          hub.endGame(slug, playerId, msg.roomIndex);
          break;
        case 'cancelGame':
          hub.cancelGame(slug, playerId, msg.roomIndex);
          break;
        case 'reportResult':
          hub.report(slug, playerId, msg.roomIndex, msg.results);
          break;
      }
      broadcast(slug);
    } catch (err) {
      sendError(ws, err instanceof Error ? err.message : 'Något gick fel');
    }
  });

  ws.on('close', () => sockets.delete(ws));
  ws.on('error', () => sockets.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Turordningsklocka kör på http://localhost:${PORT}`);
  if (!assets) {
    console.log('Ingen web/dist ännu – kör "yarn dev" (Vite på 5173) eller "yarn build" först.');
  }
});
