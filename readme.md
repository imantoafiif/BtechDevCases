# Auth with JWT

Registration, login, and a protected page, with auto-logout after 15 minutes of inactivity.

- **Backend** — Express 5 + TypeScript, SQLite (better-sqlite3), JWT via `jose`, bcrypt password hashing
- **Frontend** — React 19 + TypeScript, react-router, Vite
- **Shared** — validation schemas (zod) reused by both sides

---

## Run it with Docker Compose

From the repository root:

```bash
cp .env.example .env
docker compose up --build
```

Then open **http://localhost:8080**.

The API is on **http://localhost:3000**. Press `Ctrl-C` to stop.

Drop `--build` on later runs. You only need it again after changing a Dockerfile,
a dependency, or `VITE_API_BASE_URL`.

### Other useful commands

```bash
docker compose up -d --build   # run in the background
docker compose logs -f         # follow logs (add a service name for just one)
docker compose ps              # see what is running
docker compose down            # stop and remove the containers
docker compose down -v         # also wipe the database volume
```

Both images build from the repository root, because they need the npm workspace
manifests and `packages/shared`. Run the commands from there, not from
`backend/` or `frontend/`.

Accounts are stored in a SQLite file on the named volume `backend-data`, so they
survive `docker compose down`. Use `down -v` when you want an empty database.

---

## Environment variables

Compose reads `.env` from the repository root. Copy `.env.example` to get started.

**Required:**

| Variable | Description |
| --- | --- |
| `JWT_SECRET` | Secret used to sign tokens. **Must be at least 32 characters.** The backend refuses to start otherwise. |

**Optional** — every one of these has a working default, so you can leave them out:

| Variable | Default | Description |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Host port for the frontend |
| `API_PORT` | `3000` | Host port for the backend |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | API URL the browser calls |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:8080` | Comma-separated list of allowed origins |
| `JWT_TTL_SECONDS` | `900` | Access token lifetime (15 minutes) |
| `SESSION_MAX_AGE_SECONDS` | `28800` | Maximum session length before re-login (8 hours) |
| `BCRYPT_COST` | `12` | Password hashing cost |
| `JWT_ISSUER` | `btech-auth-api` | `iss` claim |
| `JWT_AUDIENCE` | `btech-auth-web` | `aud` claim |
| `DATABASE_PATH` | `/data/app.db` | SQLite file location (set by Compose) |
| `PORT` | `3000` | Port the backend listens on inside its container |

Two things to watch out for:

- `VITE_API_BASE_URL` is baked into the frontend bundle at **build** time, not read
  at runtime. Changing it requires `docker compose up --build`. It is also the URL
  your *browser* requests, so it stays `localhost` — `http://backend:3000` would
  not resolve outside the Compose network.
- If you change `WEB_PORT`, add the new origin to `CORS_ORIGIN` as well, or the
  browser will block the API calls.

---

## Running without Docker

Requires Node 24+.

```bash
npm install
cp .env.example .env
npm run dev
```

This starts the backend on port 3000 and the Vite dev server on port 5173.

---

## Tests

```bash
npm test          # all workspaces
npm run typecheck
```

Backend integration tests use supertest against an in-memory database; frontend
tests use Vitest with Testing Library.
