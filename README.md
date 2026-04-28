# pi-telemetry-web

Self-hosted telemetry dashboard for [`pi-telemetry-minimal`](https://github.com/drsh4dow/pi-telemetry-minimal).

It receives the existing `turn_usage` webhook payload, stores validated events in SQLite-compatible storage, and shows usage by project, developer, model, provider, and time range.

## Features

- TanStack Start + React
- Bun-first runtime
- Local SQLite or Turso/libSQL storage
- Better Auth email/password login
- First-run admin setup
- Static bearer token ingestion
- shadcn-style Tailwind UI with Base UI dialog primitive
- Recharts dashboard charts
- JSONL upload for existing `events.jsonl`
- Dockerfile-only deployment path

## Deployment model

| Target | Database | Notes |
| --- | --- | --- |
| Docker/Railway/Fly/etc. | `DATABASE_BACKEND=local` | Mount persistent storage at `/data`. Run a single app instance against the local SQLite file. |
| Vercel/serverless | `DATABASE_BACKEND=turso` | Local filesystem storage is not durable on serverless platforms. Use Turso. |

Local SQLite is the default because it is the easiest durable Docker deployment. Use Turso for serverless or multi-instance deployments.

## Local development

```bash
bun install
cp .env.example .env
bun run dev
```

Open <http://localhost:3000> and create the first admin user.

## Configure pi-telemetry-minimal

After setup, open **Settings** and copy the generated config into `~/.pi/telemetry-minimal.json`:

```json
{
  "sinks": {
    "webhook": {
      "url": "http://localhost:3000/api/telemetry/events",
      "token": "generated-token",
      "timeoutMs": 2000
    }
  }
}
```

The dashboard endpoint accepts one JSON event per request and requires:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

## Configuration

Required production settings:

```bash
NODE_ENV=production
BETTER_AUTH_URL=https://your-app.example.com
BETTER_AUTH_SECRET=<random 32+ char secret>
```

Database settings:

```bash
DATABASE_BACKEND=local # default
DATA_DIR=/data
# DB_PATH=/data/pi-telemetry-web.sqlite
```

For Turso:

```bash
DATABASE_BACKEND=turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=<token>
```

Optional settings:

```bash
MIGRATE_ON_STARTUP=true
PI_TELEMETRY_INGEST_TOKEN=<externally-managed-token>
PORT=3000
```

If `PI_TELEMETRY_INGEST_TOKEN` is set, token rotation in the UI is disabled and rotation must happen in environment configuration.

## Docker

Build and run with the Dockerfile directly. Mount `/data` to persistent storage.

```bash
docker build -t pi-telemetry-web .
docker run --rm \
  -p 3000:3000 \
  -v pi-telemetry-data:/data \
  -e NODE_ENV=production \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e BETTER_AUTH_SECRET=<random 32+ char secret> \
  pi-telemetry-web
```

SQLite lives at `/data/pi-telemetry-web.sqlite` by default in the container. Do not run the local backend in production without persistent storage.

## Railway

Deploy with the Dockerfile and attach a Railway volume mounted at `/data`. The container fixes `/data` ownership on startup, so Railway's root-owned volume can be used by the non-root app process.

Recommended variables:

```bash
NODE_ENV=production
PORT=3000
DATABASE_BACKEND=local
DATA_DIR=/data
DB_PATH=/data/pi-telemetry-web.sqlite
BETTER_AUTH_URL=https://your-app.up.railway.app
BETTER_AUTH_SECRET=<random 32+ char secret>
```

Use one replica with the local backend. For multiple replicas, use Turso.

If you override Railway's runtime UID, keep startup as root (or set `RAILWAY_RUN_UID=0`) so the entrypoint can repair volume ownership before dropping privileges.

## Vercel

Use Turso. Do not use the local backend on Vercel; Vercel function filesystems are not durable application storage.

Recommended variables:

```bash
DATABASE_BACKEND=turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=<token>
BETTER_AUTH_URL=https://your-app.vercel.app
BETTER_AUTH_SECRET=<random 32+ char secret>
```

Build command:

```bash
bun run build:vercel
```

## Operations

Run migrations explicitly:

```bash
bun run migrate
```

Startup migrations are enabled by default. Set `MIGRATE_ON_STARTUP=false` if migrations are handled separately.

Reset the admin account while preserving telemetry:

```bash
ADMIN_EMAIL=admin@example.com bun run reset-password
```

Then open the app and create a new admin account.

Health check:

```bash
curl http://localhost:3000/healthz
```

Backups are deployment-specific: snapshot the mounted volume for local SQLite, or use Turso's backup/restore tooling for Turso databases.

## Validation

```bash
bun test
bun run typecheck
bun run check
bun run build:docker
bun run build:vercel
docker build -t pi-telemetry-web .
```
