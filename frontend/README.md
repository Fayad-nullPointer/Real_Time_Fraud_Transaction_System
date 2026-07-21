# Sentinel — AI Credit Card Fraud Detection Platform

A modern, enterprise-grade SaaS frontend for a real-time credit card fraud detection system. Built with **TanStack Start**, **React 19**, **Tailwind CSS v4**, **Framer Motion**, and **Recharts**, styled after premium fintech dashboards (Stripe, Datadog).

The app ships with two experiences:

- **Customer Portal** (`/pay`) — transaction simulator with 100 interactive payment terminals, real-time fraud scoring, SHAP-style feature importance, and adaptive OTP verification for high-risk transactions.
- **Fraud Analyst Dashboard** (`/dashboard`) — KPI overview, live transaction stream, deep analytics, customer & terminal management, alerts, and system health.

---

## Getting Started

### Prerequisites

- **Node.js 20+** (or **Bun 1.1+**, recommended — the project uses `bun.lock`)
- A modern browser

### 1. Clone & install

```bash
git clone <your-repo-url> sentinel
cd sentinel

# with Bun (recommended)
bun install

# or with npm
npm install
```

### 2. Run the dev server

```bash
bun run dev
# → http://localhost:8080
```

Vite starts an SSR-enabled dev server with HMR. Route files under `src/routes/` are picked up automatically and `src/routeTree.gen.ts` is regenerated on the fly — never edit that file by hand.

### 3. Build for production

```bash
bun run build     # production build (Cloudflare Worker target via Nitro)
bun run preview   # serve the built output locally
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `bun run lint` | ESLint on the whole project |
| `bun run format` | Prettier write |
| `bun run build:dev` | Development-mode build (source maps, no minify) |

---

## Routes / Endpoints

All routes are file-based under `src/routes/`.

### Public

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `routes/index.tsx` | Landing page with animated network hero and feature grid |
| `/register` | `routes/register.tsx` | Multi-step registration; captures geolocation & issues a Customer ID |
| `/login` | `routes/login.tsx` | Banking-style login (card number + password) |

### Customer Portal

| Route | File | Purpose |
| --- | --- | --- |
| `/pay` | `routes/pay.tsx` | Transaction simulator: pick terminal on interactive SVG map → amount → live scoring → adaptive OTP |

### Analyst Dashboard (`/dashboard/*`)

Shared layout in `routes/dashboard.tsx` (sidebar + top bar). Child routes render inside its `<Outlet />`.

| Route | File | What it shows |
| --- | --- | --- |
| `/dashboard` | `dashboard.index.tsx` | KPI cards, 24h volume/fraud area charts |
| `/dashboard/live` | `dashboard.live.tsx` | Auto-refreshing transaction stream, status badges, slide-over details |
| `/dashboard/analytics` | `dashboard.analytics.tsx` | Fraud distribution, weekday patterns, OTP success |
| `/dashboard/customers` | `dashboard.customers.tsx` | Customer list with risk scores |
| `/dashboard/terminals` | `dashboard.terminals.tsx` | Terminal list + geographic hotspot map |
| `/dashboard/alerts` | `dashboard.alerts.tsx` | Alert feed with severity levels |
| `/dashboard/system` | `dashboard.system.tsx` | API latency, inference time, service uptime |

---

## Project Structure

```
src/
├── routes/                # File-based routes (TanStack Router)
│   ├── __root.tsx         # HTML shell, head metadata, providers, error/404 boundaries
│   ├── index.tsx          # Landing page
│   ├── login.tsx          # Auth
│   ├── register.tsx
│   ├── pay.tsx            # Customer transaction simulator
│   └── dashboard.*.tsx    # Analyst dashboard (flat dot-nested layout)
├── components/
│   ├── network-backdrop.tsx  # Animated canvas mesh used on marketing pages
│   └── site-nav.tsx
├── lib/
│   ├── mock-data.ts       # Deterministic seeded fixtures — swap for real API
│   └── utils.ts           # cn() and helpers
├── hooks/                 # Reusable client hooks
├── styles.css             # Tailwind v4 + design tokens (dark theme, glassmorphism)
├── router.tsx             # TanStack Router bootstrap
└── server.ts              # SSR entry with error normalization wrapper
```

### Key files to know

- **`src/styles.css`** — Design system. Semantic tokens (`--background`, `--primary`, `--success`, `--warning`, `--danger`, `--gradient-primary`, `--shadow-glow`) and the dark `#0B1220` theme live here. Never hardcode colors in components; use these tokens.
- **`src/lib/mock-data.ts`** — All demo data (terminals, transactions, KPIs, alerts, charts). Structured to mirror what a real backend would return, so it can be replaced with `fetch` / server functions with minimal churn.
- **`src/routes/__root.tsx`** — Head metadata (title, OG tags), fonts, global providers (React Query, Toaster), and the app-wide error / 404 boundaries.
- **`src/server.ts`** — Custom SSR entry that catches h3-swallowed errors and renders a proper 500 page.
- **`vite.config.ts`** — Uses `@lovable.dev/vite-tanstack-config` which pre-bundles TanStack Start, Tailwind v4, Nitro (Cloudflare target), path aliases (`@/*`), and dev-server tooling.

---

## Core Concepts

- **Design system first.** Every color, gradient, and shadow is a CSS variable in `styles.css`. Change theme once — the whole app follows.
- **Type-safe routing.** TanStack Router generates `routeTree.gen.ts` from files in `src/routes/`. `<Link to="...">` is fully typed.
- **SSR + streaming.** TanStack Start renders on the server and hydrates on the client. Loaders can prefetch data via TanStack Query (`context.queryClient.ensureQueryData`).
- **Ready for a real backend.** Replace `src/lib/mock-data.ts` accessors with `createServerFn` calls (client-safe modules like `src/lib/*.functions.ts`) or with fetches to your fraud-scoring service.

---

## Backend Integration (when ready)

The frontend is decoupled from any storage. Recommended path:

1. Enable Lovable Cloud (or your Supabase project) for auth + Postgres.
2. Add `createServerFn` modules under `src/lib/*.functions.ts` for typed RPC (e.g. `scoreTransaction`, `verifyOtp`, `listAlerts`).
3. Add public webhook / cron endpoints under `src/routes/api/public/*` if your fraud engine pushes updates.
4. Swap the imports in each route from `@/lib/mock-data` to the server-function equivalents.

---

## Docker

A production `Dockerfile` is included. See [Docker](#running-with-docker) below.

### Running with Docker

```bash
# build image
docker build -t sentinel .

# run
docker run --rm -p 8080:8080 sentinel
# → http://localhost:8080
```

The container:

1. Installs dependencies with Bun in a builder stage.
2. Builds the TanStack Start production bundle.
3. Copies the built output into a slim Node 20 runtime image.
4. Exposes port `8080` and starts the SSR server.

### Deploying

The build target is a Cloudflare Worker–compatible Node server (via Nitro). The Docker image works on any host that can run Node 20:

- Fly.io, Railway, Render, Google Cloud Run, AWS App Runner, Azure Container Apps
- Kubernetes / ECS (mount the image, expose port 8080)
- Cloudflare Workers directly (without Docker) via `wrangler deploy` after `bun run build`

Set `PORT` env var to override the default `8080`.

---

## License

Proprietary — internal demo project.
