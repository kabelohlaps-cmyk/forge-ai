# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

pnpm + Turborepo monorepo (pnpm 10, Node 20) with a separate Python API:

- `apps/web` — Next.js 14 App Router frontend (`@forge/web`), Tailwind, NextAuth, react-three-fiber.
- `apps/mobile` — Expo / expo-router app (`@forge/mobile`). Only reads mode metadata from `@forge/core`; it doesn't call the API yet.
- `packages/core` — shared TS: `MODES`, `PLANS`/`PlanTier`, daily Bible verses. `packages/ui` — shared React components (EdenTree logo, VerseBalloon). `packages/crypto` — browser WebCrypto asset encryption (not currently imported anywhere). These packages ship raw `src/index.ts` with no build step; `next.config.js` `transpilePackages` compiles them.
- `services/api` — FastAPI + asyncpg + LangGraph/Gemini backend. It's listed in the pnpm workspace but isn't a JS package.

## Commands

Web (from the repo root):
```bash
pnpm install --frozen-lockfile
pnpm --filter @forge/web dev                  # http://localhost:3000
pnpm --filter @forge/web exec tsc --noEmit    # typecheck
pnpm --filter @forge/web build                # production build (also lints/typechecks)
```

API (run from `services/api`, because imports are `from app...`; the root `npm run api` script does the `cd` for you):
```bash
cd services/api
pip install -r requirements-dev.txt           # Python 3.12 (Dockerfile); 3.13 also works
JWT_SECRET=$(openssl rand -hex 32) ENCRYPTION_MASTER_KEY=$(openssl rand -base64 32) \
  uvicorn app.main:app --reload --port 8000

# Tests: real Postgres + pgvector; every test TRUNCATEs all tables, so use a throwaway DB
createdb -h localhost -U forge forge_test && psql -h localhost -U forge -d forge_test -f app/schema.sql
TEST_DATABASE_URL=postgresql://forge:forge@localhost:5432/forge_test pytest -q
pytest tests/test_agent.py::test_render_quota_is_enforced_and_counted   # single test
```

Database: Postgres 16 with the pgvector extension. Either run `docker compose up postgres redis -d`, which loads `services/api/app/schema.sql` on first init, or apply the schema by hand with `psql -h localhost -U forge -d forge -f services/api/app/schema.sql` (user, password and db are all `forge`). There are no migrations: `schema.sql` is the only source of truth, so schema changes mean editing it and recreating the DB. Redis is in docker-compose but no code uses it.

API tests (`services/api/tests`) use FastAPI's `TestClient` against the real database. `conftest.py` stubs out Gemini (`forge_graph` and `generate_design_image` in `app.routers.agent`) and provides a `make_user` fixture with `set_plan()` and `create_project()` helpers. Browser tests live in `e2e/`, a standalone npm package (Playwright) kept outside the pnpm workspace, because regenerating `pnpm-lock.yaml` re-resolves unrelated mobile deps. They need the web app and API already running against a schema-loaded database:
```bash
cd e2e && npm ci && npx playwright install chromium   # or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an existing Chromium
npx playwright test                                   # E2E_BASE_URL / E2E_API_URL default to localhost:3000 / :8000
npx playwright test tests/plans.spec.ts               # single file
```

CI (`.github/workflows/ci.yml`) has three jobs. `web` runs the typecheck and build. `api` runs pytest, then a uvicorn smoke test. `e2e` builds the web app, starts both servers, and runs Playwright.

Env vars are documented in `.env.example`. The API refuses to start without `ENCRYPTION_MASTER_KEY`, and it fails on any token operation without `JWT_SECRET`. Both are deliberately left without defaults. `GEMINI_API_KEY` is only needed when an agent or image endpoint is actually called.

## Architecture

### Auth: two token layers
The browser never talks to the API with a NextAuth token. Instead:
1. `apps/web/lib/auth.ts` (NextAuth, JWT sessions) runs sign-in. The Credentials provider calls the API's `POST /auth/login`. For Google and Apple, the `jwt` callback trades the provider's `id_token` at `POST /auth/oauth/{google,apple}`, and the API verifies the token against `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID`.
2. The API returns its own HS256 JWT (`services/api/app/services/auth_service.py`). That JWT is stored in the NextAuth token as `backendToken` and exposed on the session.
3. Client code calls the API directly through `apiFetch(path, session.backendToken)` (`apps/web/lib/api.ts`, using `NEXT_PUBLIC_API_URL`). Server-side Next routes (for example `app/api/billing/subscribe`) proxy through `API_URL` instead.
4. On the API side, `get_current_user` (`services/api/app/auth.py`) decodes the bearer token and loads the `users` row. Authorization checks live in `services/api/app/access.py`: `get_owned_project` returns 404 for another user's project, `require_mode` checks the plan's `allowed_modes`, and `require_render_quota` / `record_render` count `usage_events` with feature `render` since the start of the month (`render_quota` -1 means unlimited). Any endpoint that takes a `project_id` must go through `get_owned_project`. That matters for the agent in particular, because the LangGraph memory is keyed by project.

`apps/web/middleware.ts` protects only `/projects/*` and `/dashboard/*`. Every other page is public.

### Design agent flow
- `POST /agent/invoke` runs `forge_graph` (`services/api/app/agents/orchestrator.py`). A conditional entry point (`supervisor`) routes on `state["mode"]` to one of eight mode nodes, falling back to `DEFAULT_MODE`. All eight nodes currently share `_run_mode_agent`: the persona system prompt from `agents/prompts.py`, then the conversation, then one Gemini response via `langchain_google_genai`.
- Conversation memory comes in two pieces. LangGraph's `MemorySaver` (thread id `project_{id}`) is in-process only and is lost on restart. The durable log is the `design_versions` table: each turn writes one row (`prompt`, plus `spec_sheet.response`), and `GET /projects/{id}/messages` rebuilds the chat from those rows.
- `POST /agent/generate-image` (`services/image_gen.py`, google-genai SDK, `GEMINI_IMAGE_MODEL`) renders an image, optionally from a sketch data URI produced by the web `SketchCanvas`. It stores the image as `spec_sheet.image_data_uri` on the project's **latest** `design_versions` row, so it must be called after `/agent/invoke`.
- Gemini message content can arrive as a list of content blocks, so `_extract_text` in `routers/agent.py` flattens it to a string before storing it.
- `db.py` registers JSON/JSONB codecs, so JSONB columns come back as Python dicts.
- `agents/memory.py` (pgvector `design_memories` recall) exists but isn't wired into the graph yet.

### Modes and plans are defined twice
Mode ids and plan tiers live both in TS (`packages/core/src/modes.ts` and `plans.ts`, used by the UI) and in Python (`services/api/app/services/paypal.py` `PLANS`, plus `agents/prompts.py` `MODE_PROMPTS`, plus the `users.allowed_modes` default in `schema.sql`). Adding or renaming a mode or tier means updating all of these. The PayPal webhook's `_grant` writes the user's plan fields, and `access.py` enforces them: project creation and both agent endpoints check the mode, and only `/agent/generate-image` uses up render quota.

### Billing
PayPal subscriptions: `POST /billing/subscribe` creates a PayPal subscription with `custom_id=user_{id}` and returns the approval URL. `POST /billing/webhook` verifies the PayPal signature, then updates `subscriptions`. On `ACTIVATED`, it upgrades the user's tier, quota and modes and records `next_billing_at`. Downgrades back to free (`FREE_PLAN` in `paypal.py`) live in `services/subscriptions.py`. `SUSPENDED` and `EXPIRED` downgrade immediately. `CANCELLED` keeps paid features until the end of the paid month (`next_billing_at`, or the end of the calendar month the user cancelled in if no payment was recorded). PayPal sends no event when that date passes, so `get_current_user` calls `expire_lapsed_plan` on every request. A user is only downgraded if no other subscription still gives them access, and plans set without any subscription row are never touched. `scripts/bootstrap_paypal.py` (run from the repo root) creates the PayPal product and plans and prints the `PAYPAL_PLAN_*` ids to put in env.

### Asset encryption
`services/api/app/services/crypto.py`: AES-GCM with a key derived by HKDF from `ENCRYPTION_MASTER_KEY` plus a random salt for each asset. `/assets/upload` currently returns only the salt and IV; it doesn't persist anything yet.

### 3D viewer (`/lab/3d`)
`apps/web/components/Character3DViewer.tsx` is a client-only R3F scene. It loads the rigged `public/models/CesiumMan.glb`, lights it with `public/hdri/potsdamer_platz_1k.hdr`, and applies post-processing (bloom, SMAA). It detects arm and leg bones by name to drive the body-proportion sliders, and attaches procedurally built part meshes (`PART_DEFS`) to head, hand and back bones. Keep assets under `public/` rather than on CDNs; each asset folder has a license README.
