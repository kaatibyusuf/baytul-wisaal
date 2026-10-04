# Baytul Wisaal

Marriage-readiness and matchmaking platform. See `Baytul-Wisaal-PRD.md` for the full specification.

**Next.js is the frontend. NestJS is the backend.** Only NestJS talks to PostgreSQL.

## Layout

```
apps/web      Next.js (App Router, Tailwind v4)  -> http://localhost:3000
apps/api      NestJS, REST under /api/v1          -> http://localhost:4000/api/v1
              Swagger docs                         -> http://localhost:4000/api/docs
packages/config   Shared brand constants
prisma/       schema.prisma (single source of truth for the database)
```

## First run (PowerShell)

```powershell
npm install -g pnpm@9
pnpm install

# Environment files
Copy-Item .env.example apps/api/.env
Copy-Item .env.example apps/web/.env.local

# Local Postgres + Redis (needs Docker Desktop)
docker compose up -d

# Prisma
pnpm db:generate
pnpm db:migrate --name init

# Run everything
pnpm dev
```

Then check:

- http://localhost:3000 (landing page)
- http://localhost:4000/api/v1/health (should report `"database": "up"`)

Run the web app or API on their own with `pnpm dev:web` and `pnpm dev:api`.

## Deploy

The web app deploys to Vercel from `apps/web` (set the root directory to `apps/web`).
The API is built as a container in a later milestone.

## Brand assets

`apps/web/public/brand/` holds PNG crops of the supplied logo (white and turquoise on NileBlue).
Replace these with proper SVG artwork, plus a light-background version, when available.
`apps/web/app/icon.png` is the temporary favicon.
