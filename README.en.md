# lilbrumessage 💌

A cozy little messenger for two people — or five. No phone book integration, no clutter: you open it, register with a name, start typing. That's it.

Built for myself and a couple of friends: quick, lightweight, but made with care. Also doubles as a playground to try modern frontend plus a real WebSocket chat.

## What it does

- register / log in with name + password (passwords stored as salted scrypt hashes)
- one-on-one and group chats
- live messaging over WebSocket — messages arrive instantly, no page reloads
- emoji reactions, replies, delete your own messages
- read ticks, "typing…" indicator, online status
- in-chat message search (Ctrl+F) with match highlighting
- avatars and banners: PNG/JPG/WebP/GIF, animated GIFs stay animated on banners
- light and dark theme, animation settings
- messages survive server restarts and idle sleeps (no SQLite needed — a JSON file is plenty)

## Running locally

You need Node 18+.

```bash
npm install        # at the root
npm run build:all  # build server + client
npm start          # one process on port 4000: API + static files
```

Open http://localhost:4000 and start chatting.

For development, two processes are easier:

```bash
# terminal 1 — server
cd server
npm run dev

# terminal 2 — client with hot reload
cd client
$env:VITE_SERVER_URL='http://localhost:4000'   # Windows / PowerShell
npm run dev
```

The client runs on 5173, the API listens on 4000.

## Environment variables

| Variable | What it does | Default |
| --- | --- | --- |
| `PORT` | server port | `4000` |
| `CLIENT_ORIGIN` | allowed CORS origin | `http://localhost:5173` |
| `VITE_SERVER_URL` | where the client finds API/sockets | the URL the page was opened from |
| `DB_PATH` | database file | `data/db.json` (next to the server) |

## Deployment

Kept cheap — no credit card required:

- **Render (Blueprint)** — the main option. `render.yaml` ships a free Docker service. Push to GitHub → New Blueprint → done. The free tier downsides: the instance falls asleep after ~15 min of inactivity (first open is slow) and `data/` resets on redeploy.
- **Fly.io** — a fallback; it needs a volume for `data/` (example in `fly.toml`). It works properly, but asks for a card at signup.

Feeling lazy? Run it on localhost and expose it with cloudflared: `npm i -g cloudflared` + `cloudflared tunnel --url http://localhost:4000`. Downside: the URL changes every time.

`render.yaml`, `Dockerfile` and `fly.toml` are already tuned for this project.

## Layout

```
server/   Express + Socket.IO, REST + sockets, file database in data/db.json
client/   Vite + React + TypeScript, Material You palette
data/     database and uploads live here (gitignored)
```

## Checks

```bash
cd server && npm run build     # server: tsc
cd client && npm run typecheck # client: tsc
cd client && npm run build     # client: vite build
```

There are also e2e checks driven by a real Socket.IO client (registration, chats, reactions, avatars) plus a Playwright UI test against actual Chrome: login, chat creation, sending, bubble alignment, search, profile, logout.

## Tech stack

TypeScript, Node.js, Express, Socket.IO, React, Vite, hand-written CSS. No heavy frameworks, everything is straightforward and easy to read.

---

Made to feel nice to use. Enjoy. 💜