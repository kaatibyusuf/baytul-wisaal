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

## Profile and programme (Milestone 3)

- Profile: `GET/PATCH /api/v1/profile`. Name, gender and date of birth are fixed at registration.
- Programme engine: enrol, one day opens at a time, lessons / reflections / quizzes, all verified on the
  server. Quiz answer keys never leave the API. Reading time is enforced by the server's clock.
- Thresholds (unlock interval, grace period, reading time, quiz pass mark and attempts) live in the
  `SystemSetting` table, with sensible defaults, so they can be changed without a deploy.
- The lesson content in `apps/api/src/seed.ts` is **sample content**. Replace it with the real curriculum.

After pulling this milestone (PowerShell):

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate --name programme
pnpm db:seed
```

To test all 30 days quickly on your machine (every day open in order, no reading delay):

```powershell
$env:SEED_DEV_FAST=1; pnpm db:seed
```

Put the real timings back with `$env:SEED_DEV_FAST=0; pnpm db:seed`.

## Scenario assessment and AI evaluation (Milestone 4, backend)

- A scenario is shown only inside a protected session: its own token (rotated on every reload),
  an expiry, a watermark code, uncached responses, and every fetch logged.
- Answers are validated on the server (no vague stock answers), kept exactly as written, and evaluated
  in the background by up to three providers (Anthropic, OpenAI, Google) behind one interface.
- Scores are combined (median per criterion). A critical flag from ANY provider stands.
- Business rules decide what happens next. The AI can only ever pass someone automatically when nothing is
  unusual. Low scores, critical flags, low confidence, provider disagreement, contradictions, suspicious signals,
  prompt-injection attempts and outages all go to a human reviewer. The AI never fails anyone by itself.
- Reviewers use `GET /api/v1/admin/reviews` and `POST /api/v1/admin/reviews/:id/decision` (roles MODERATOR or ADMIN).
- Add API keys to `apps/api/.env` (see `.env.example`). Without keys everything goes to human review.
- The scenario and rubric in `src/seed.ts` are **samples**. Day 4 of the sample programme contains the scenario.

After pulling this milestone (PowerShell):

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate --name assessment
pnpm db:seed
```

### Trying the scenario and review screens

1. Seed with fast settings: `$env:SEED_DEV_FAST=1; pnpm db:seed`, then `pnpm dev`.
2. Sign in, open Programme, finish days 1 to 3, then open Day 4 and start the scenario.
3. With no AI keys in `apps/api/.env`, the answer goes straight to human review, which lets you test the
   whole flow for free. Add one or more keys to try the real evaluation.
4. To review it, make a second account a reviewer: run `pnpm exec prisma studio --schema prisma/schema.prisma`,
   open the `User` table, and set that account's `role` to `MODERATOR`. Sign in as that account and open Reviews.
5. A reviewer cannot decide their own response, so use two accounts.
