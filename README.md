# Timglas

Timglas is a real-time turn timer (chess clock) for a Settlers of Catan tournament: 16 players across 4 tables, each seat with its own clock, shared live between everyone in the room. Not deployed to a host — it runs on one machine and is exposed to players' phones over a Cloudflare quick tunnel.

A single Node process serves the built React frontend and holds all state; clients sync over WebSocket, and the server clock is the single source of truth so no device-clock drift creeps into the timer.

## Stack

- Node 22.13.1 / Yarn 1.22.21 (pinned via Volta)
- TypeScript 5.7 (strict)
- React 18.3 + Vite 5.4 — frontend
- Node `http` + `ws` 8.18 — WebSocket realtime
- better-sqlite3 11 — local persistence (a single SQLite file)
- sirv 2 — static file serving in production
- tsx 4.19 — runs the TypeScript server with no separate build step
- cloudflared — Cloudflare quick tunnel (installed separately, see below)

## Getting started

```sh
yarn install
yarn dev
```

`yarn dev` starts two processes in parallel:

- **Vite** on `http://localhost:5173` (the frontend you open while developing)
- **Node/tsx** on `http://localhost:3000` (the WebSocket + API server)

Vite proxies `/ws` and `/api` to the Node server, so open `5173` in the browser during development.

### Running a tournament (public link)

For the actual event the whole thing runs from one Mac and is tunneled out so players can reach it on their phones.

1. Install the tunnel client once: `brew install cloudflared`
2. Start everything with one command:

   ```sh
   yarn tournament
   ```

   This builds the frontend, keeps the Mac awake with `caffeinate`, starts the server on port 3000, and opens a Cloudflare quick tunnel. cloudflared prints a public `https://<random>.trycloudflare.com` URL — share that with the players.

Notes:

- It only works while the Mac is **on, awake and online**. The quick-tunnel URL is **random and changes on every restart**, so start it once and leave it up for the whole tournament. For a stable URL you would need a Cloudflare account and a named tunnel.
- All state lives in the local SQLite file, so a crash or restart recovers both the standings and any in-progress game.
- The link is open — anyone with the URL (and the tournament code) can join. That is by design for a casual tournament; no sensitive data is stored.

### Environment variables

| Variable      | Purpose                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `PORT`        | Server port. Default `3000` (the tunnel expects this).                           |
| `DB_PATH`     | SQLite file path. Default `data/tournament.db` (auto-created).                    |
| `ADMIN_KEY`   | Key for the `?admin=<key>` URL parameter. Default `admin`.                        |
| `ADMIN_NAMES` | Comma-separated player names that are admins (case-insensitive). Default empty.   |

## Routing

The frontend is a single-page app. A tournament is selected with a URL segment:

- `/t/<slug>` — the app for that tournament (e.g. `/t/catan-2026`). `?t=<slug>` also works.
- `/` — a chooser where you type a tournament code.

Each slug is an isolated tournament: its own 4 rooms and its own standings. The server serves `index.html` for every path (SPA fallback), so these routes work on a hard refresh.

## Data & realtime

- **Source of truth:** the server. Every mutation is validated server-side, written through to SQLite, and then a fresh snapshot of the whole tournament is broadcast to every connected client for that slug.
- **The clock:** the server stores `turnStartedAt` (its own `Date.now()`), whose turn it is, and each player's remaining bank. Clients compute the countdown locally against that timestamp, correcting for their own clock offset — so the timer reads the same on every phone.
- **Banks:** each player starts a game with a 10-minute bank. Every turn also grants a temporary 30-second bonus that is spent first; the bank only ticks down once a turn runs past that bonus. When a player passes, the overrun is deducted from their bank. Both the bank and the per-turn bonus are admin-configurable defaults.
- **Persistence:** players, live room/game state, and finished-game results are stored in SQLite. Live room state is kept as a JSON blob per tournament; results are individual rows used to compute standings.
- **Scoring:** when a game is reported you enter each player's victory points; placement is derived from VP (equal VP share the better placement). Placement points are a fixed scale — the winner always gets 3, and each lower placement one less, floored at 0: 3-2-1-0 for placements 1–4 regardless of how many played. In a three-player game last place (3rd) is therefore worth 1. Equal VP share the better placement (10/7/7/7 gives 3-2-2-2). Total victory points is the tiebreaker in the overall standings.

## Admin

Admin mode unlocks a settings view where the **bank time** and the **per-turn bonus** can be changed per tournament. A connection is admin if it opens the app with `?admin=<key>` matching `ADMIN_KEY` (default `admin`, e.g. `…/t/catan-2026?admin=admin`), or if its player name is in `ADMIN_NAMES`. The check is enforced server-side, and admins get an "Admin – tidsinställningar" entry in the header menu (⋮). Bank-time changes apply to games started after the change; the per-turn bonus applies immediately. Set a non-default key to keep control to yourself, e.g. `ADMIN_KEY=hemligt ADMIN_NAMES=Jens yarn tournament`, and share the plain link (without `?admin=`) with players.

## Layout

| Path              | What it is                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `shared/types.ts` | Domain types, message protocol, and constants shared by server and web.    |
| `server/src/`     | The Node server: `index.ts` (HTTP + WS), `store.ts` (game logic), `db.ts` (SQLite), `scoring.ts` (standings). |
| `web/`            | The React/Vite frontend; `web/src/components/` holds the screens.          |
| `web/dist/`       | Built frontend, served in production (generated, gitignored).              |
| `data/`           | The SQLite database file (generated, gitignored).                          |

## Conventions

- TypeScript strict everywhere, with `noUnusedLocals`/`noUnusedParameters` (see `tsconfig.base.json`).
- The frontend imports shared code via the `@shared/*` path alias (Vite + tsconfig); the server uses relative imports so `tsx` resolves them at runtime without alias config.
- No linter, formatter, or git hooks are configured.
- UI text and code comments are in Swedish (the app is Swedish-facing); this README follows the English default.

## Scripts

| Script           | What it does                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| `yarn dev`       | Vite (5173) + Node/tsx server (3000) in parallel, for local development.        |
| `yarn dev:server`| Just the WebSocket server, with file watching.                                  |
| `yarn dev:web`   | Just the Vite dev server.                                                       |
| `yarn build`     | Build the frontend to `web/dist`.                                               |
| `yarn start`     | Run the server (serves `web/dist` if it has been built).                        |
| `yarn host`      | `build` then `start`.                                                           |
| `yarn tunnel`    | Expose `localhost:3000` via a Cloudflare quick tunnel.                          |
| `yarn tournament`| Build, keep the Mac awake, and run the server + tunnel together (the event command). |
| `yarn typecheck` | Type-check the server and frontend projects.                                    |
