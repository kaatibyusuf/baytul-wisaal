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

# Local Postgres: install it directly on Windows (winget install PostgreSQL.PostgreSQL.16)
# and create the database once:
#   & "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres baytul_wisaal
# (docker-compose.yml is optional and only needed if you prefer Docker; Redis is not used yet.)

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

## Authentication (Milestone 2)

Register, verify email, sign in, sign out, password reset. Sessions are server-side: the browser
holds an opaque token in an HTTP-only cookie and the database stores only its hash.

- In development no email is sent. **The verification and reset links print in the API terminal.**
- After pulling this milestone run `pnpm install`, then `pnpm db:migrate --name auth`.
- Tests: `pnpm test` (runs the auth suite against an in-memory stand-in for the database).
- Accounts are always created as `USER`. To make yourself an admin for testing, update the `role`
  column directly in the database (for example with Prisma Studio: `pnpm exec prisma studio --schema prisma/schema.prisma`).
