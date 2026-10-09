# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

pnpm + Turborepo monorepo (pnpm 10, Node 20) with a separate Python API:

- `apps/web` — Next.js 14 App Router frontend (`@forge/web`), Tailwind, NextAuth, react-three-fiber.
- `apps/mobile` — Expo / expo-router app (`@forge/mobile`). Only reads mode metadata from `@forge/core`; it doesn't call the API yet.
- `packages/core` — shared TS: `MODES`, `PLANS`/`PlanTier`, daily Bible verses. `packages/ui` — shared React components (EdenTree logo, VerseBalloon). `packages/crypto` — browser WebCrypto asset encryption (not currently imported anywhere). These packages ship raw `src/index.ts` with no build step; `next.config.js` `transpilePackages` compiles them.
- `services/api` — FastAPI + asyncpg + LangGraph/Gemini backend. It's listed in the pnpm workspace but isn't a JS package.
- Root-level `components/` is a stale partial copy of `apps/web/components` and `public/`. Nothing imports it, so edit the files under `apps/web` instead.

## Commands

Web (from the repo root):
```bash
pnpm install --frozen-lockfile
pnpm --filter @forge/web dev                  # http://localhost:3000
pnpm --filter @forge/web exec tsc --noEmit    # typecheck
pnpm --filter @forge/web build                # production build (also lints/typechecks)
```

API (must run from `services/api`: imports are `from app...`, so the root `npm run api` script fails with `ModuleNotFoundError: No module named 'app'`):
```bash
cd services/api
pip install -r requirements.txt               # Python 3.12 (Dockerfile); 3.13 also works
JWT_SECRET=$(openssl rand -hex 32) ENCRYPTION_MASTER_KEY=$(openssl rand -base64 32) \
  uvicorn app.main:app --reload --port 8000
```

Database: Postgres 16 with the pgvector extension. Either run `docker compose up postgres redis -d`, which loads `services/api/app/schema.sql` on first init, or apply the schema by hand with `psql -h localhost -U forge -d forge -f services/api/app/schema.sql` (user, password and db are all `forge`). There are no migrations: `schema.sql` is the only source of truth, so schema changes mean editing it and recreating the DB. Redis is in docker-compose but no code uses it.

There is no unit test suite. CI (`.github/workflows/ci.yml`) runs the web typecheck and build, plus an API smoke test: it loads the schema into a pgvector service, starts uvicorn, and curls `/health`, `/auth/register` and `/auth/login`. To check a change, run the same commands locally.

Env vars are documented in `.env.example`. The API refuses to start without `ENCRYPTION_MASTER_KEY`, and it fails on any token operation without `JWT_SECRET`. Both are deliberately left without defaults. `GEMINI_API_KEY` is only needed when an agent or image endpoint is actually called.

## Architecture

### Auth: two token layers
The browser never talks to the API with a NextAuth token. Instead:
1. `apps/web/lib/auth.ts` (NextAuth, JWT sessions) runs sign-in. The Credentials provider calls the API's `POST /auth/login`. For Google and Apple, the `jwt` callback trades the provider's `id_token` at `POST /auth/oauth/{google,apple}`, and the API verifies the token against `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID`.
2. The API returns its own HS256 JWT (`services/api/app/services/auth_service.py`). That JWT is stored in the NextAuth token as `backendToken` and exposed on the session.
3. Client code calls the API directly through `apiFetch(path, session.backendToken)` (`apps/web/lib/api.ts`, using `NEXT_PUBLIC_API_URL`). Server-side Next routes (for example `app/api/billing/subscribe`) proxy through `API_URL` instead.
4. On the API side, `get_current_user` (`services/api/app/auth.py`) decodes the bearer token and loads the `users` row. Endpoints scope data by `user["id"]`.

`apps/web/middleware.ts` protects only `/projects/*` and `/dashboard/*`. Every other page is public.

### Design agent flow
- `POST /agent/invoke` runs `forge_graph` (`services/api/app/agents/orchestrator.py`). A conditional entry point (`supervisor`) routes on `state["mode"]` to one of eight mode nodes, falling back to `DEFAULT_MODE`. All eight nodes currently share `_run_mode_agent`: the persona system prompt from `agents/prompts.py`, then the conversation, then one Gemini response via `langchain_google_genai`.
- Conversation memory comes in two pieces. LangGraph's `MemorySaver` (thread id `project_{id}`) is in-process only and is lost on restart. The durable log is the `design_versions` table: each turn writes one row (`prompt`, plus `spec_sheet.response`), and `GET /projects/{id}/messages` rebuilds the chat from those rows.
- `POST /agent/generate-image` (`services/image_gen.py`, google-genai SDK, `GEMINI_IMAGE_MODEL`) renders an image, optionally from a sketch data URI produced by the web `SketchCanvas`. It stores the image as `spec_sheet.image_data_uri` on the project's **latest** `design_versions` row, so it must be called after `/agent/invoke`.
- Gemini message content can arrive as a list of content blocks, so `_extract_text` in `routers/agent.py` flattens it to a string before storing it.
- `db.py` registers JSON/JSONB codecs, so JSONB columns come back as Python dicts.
- `agents/memory.py` (pgvector `design_memories` recall) exists but isn't wired into the graph yet.

### Modes and plans are defined twice
Mode ids and plan tiers live both in TS (`packages/core/src/modes.ts` and `plans.ts`, used by the UI) and in Python (`services/api/app/services/paypal.py` `PLANS`, plus `agents/prompts.py` `MODE_PROMPTS`, plus the `users.allowed_modes` default in `schema.sql`). Adding or renaming a mode or tier means updating all of these. On the API side, `allowed_modes` and `render_quota` are only written, by the PayPal webhook's `_grant`. No endpoint enforces them yet.

### Billing
PayPal subscriptions: `POST /billing/subscribe` creates a PayPal subscription with `custom_id=user_{id}` and returns the approval URL. `POST /billing/webhook` verifies the PayPal signature, then updates `subscriptions`. On `ACTIVATED`, it upgrades the user's tier, quota and modes. `scripts/bootstrap_paypal.py` (run from the repo root) creates the PayPal product and plans and prints the `PAYPAL_PLAN_*` ids to put in env.

### Asset encryption
`services/api/app/services/crypto.py`: AES-GCM with a key derived by HKDF from `ENCRYPTION_MASTER_KEY` plus a random salt for each asset. `/assets/upload` currently returns only the salt and IV; it doesn't persist anything yet.

### 3D viewer (`/lab/3d`)
`apps/web/components/Character3DViewer.tsx` is a client-only R3F scene. It loads the rigged `public/models/CesiumMan.glb`, lights it with `public/hdri/potsdamer_platz_1k.hdr`, and applies post-processing (bloom, SMAA). It detects arm and leg bones by name to drive the body-proportion sliders, and attaches procedurally built part meshes (`PART_DEFS`) to head, hand and back bones. Keep assets under `public/` rather than on CDNs; each asset folder has a license README.
