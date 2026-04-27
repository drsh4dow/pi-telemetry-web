# pi-telemetry-web

Self-hosted telemetry dashboard for [`pi-telemetry-minimal`](https://github.com/drsh4dow/pi-telemetry-minimal).

It receives the existing `turn_usage` webhook payload, stores validated events in SQLite, and shows usage by project, developer, model, provider, and time range.

## Features

- TanStack Start + React
- Bun-first runtime
- SQLite storage
- Better Auth email/password login
- First-run admin setup
- Static bearer token ingestion
- shadcn-style Tailwind UI with Base UI dialog primitive
- Recharts dashboard charts
- JSONL upload for existing `events.jsonl`
- Docker-first deployment

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

## Docker

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET to a strong random value.
docker compose up --build
```

SQLite lives in the `/data` volume. Do not run production without a persistent volume.

## Railway

Deploy with the Dockerfile.

Recommended variables:

```bash
NODE_ENV=production
PORT=3000
DATA_DIR=/data
BETTER_AUTH_URL=https://your-app.up.railway.app
BETTER_AUTH_SECRET=<random 32+ char secret>
```

Attach a Railway volume mounted at `/data`.

Optional:

```bash
PI_TELEMETRY_INGEST_TOKEN=<externally-managed-token>
```

If this env var is set, token rotation in the UI is disabled and rotation must happen in Railway/env config.

## Operations

Run migrations explicitly:

```bash
bun run migrate
```

Reset the admin account while preserving telemetry:

```bash
ADMIN_EMAIL=admin@example.com bun run reset-password
```

Then open the app and create a new admin account.

Health check:

```bash
curl http://localhost:3000/healthz
```

## Validation

```bash
bun test
bun run typecheck
bun run check
bun run build
docker build -t pi-telemetry-web .
```
