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

## Preferences and matchmaking (Milestone 5, backend)

- `GET/PUT /api/v1/preferences`: the spouse questionnaire (served by the API), hard filters, and availability.
  Each question is asked twice: your own answer, and which answers you would accept in a spouse, with a firmness
  level (non-negotiable, preference, flexible). Personal and physical questions can never be non-negotiable.
- Opens after the marriage-readiness programme is finished (`matching.requireProgramme`, on by default).
- `POST /api/v1/admin/matchmaking/run` (ADMIN): `{ "dryRun": true }` previews pairs, `{ "dryRun": false }` creates
  matches. Rules in order: opposite sexes, hard filters both ways, non-negotiables both ways, not excluded, a minimum
  fit score, then best fit first with each person paired once per round.
- `GET /api/v1/matches`: the current match (basic introduction only) and closed history (nothing about the other person).
- `POST /api/v1/matches/:id/withdraw`: closes a pairing permanently for that pair. The person who closes it rests for
  `matching.withdrawCooldownDays` so matches cannot be browsed by closing them.
- `POST /api/v1/admin/matchmaking/exclusions` (ADMIN): stop two people ever being matched, by email.
- The questionnaire wording in `src/matching/questionnaire.ts` is **sample content**. Review it and replace it with your own.
- Matching runs when an administrator triggers it. It is not scheduled yet.

After pulling this milestone (PowerShell):

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate --name matching
pnpm db:seed
pnpm test
```

### Preferences, matches and notifications screens (Milestone 5, web)

- `/preferences`: the questionnaire (served by the API), hard filters, availability pause and resume.
- `/matches`: the current match's basic introduction, closing a pairing, and closed history.
- `/admin/matchmaking` (ADMIN): preview a round, create matches, prevent a pairing by email.
- The dashboard now follows the journey through preferences and matching, and shows unread notifications.
- Profile now has country and region, which the location filter needs.
- `GET /api/v1/notifications` and `POST /api/v1/notifications/read` back the "New for you" card.

To try the whole flow on your machine:

1. `$env:SEED_DEV_FAST=1; pnpm db:seed`, then `pnpm dev`.
2. Create at least two accounts of different sexes, and a third to be the administrator
   (set its `role` to `ADMIN` in Prisma Studio: `pnpm exec prisma studio --schema prisma/schema.prisma`).
3. For each of the two, finish the programme (placeholder days are short), then complete `/preferences`.
4. As the administrator, open Matchmaking, preview a round, then create the matches.
5. Sign in as each of the two to see the introduction, then close the pairing from one of them.

## Post-match flow (Milestone 6, backend)

After a match is created, each person writes what they are seeking, responds to the other's expectations,
and the system compares the two (PRD sections 21 to 24).

- `GET /api/v1/matches/:id`: where you are, the rules, your own expectations, and (only when allowed) the other person's.
- `PUT /api/v1/matches/:id/expectations` `{ items, submit }`: save a draft, or submit. A submitted form is locked.
- `PUT /api/v1/matches/:id/responses` `{ responses, submit }`: respond to every one of the other person's expectations.
- **Blind first.** Neither person sees the other's expectations until both have submitted their own, so nobody tailors
  what they write to what they have just read. The other person's responses to you stay hidden until the result is known.
- Every response needs a real explanation (8 words by default, no stock phrases), except "not applicable".
- Each expectation becomes Aligned, Needs discussion or Conflict. Only disagreeing with something the other person
  marked non-negotiable is a Conflict.
- The pairing meets the requirements when there is no Conflict, no more than 10 discussion points, and no more than 3
  disagreements with preferences. All of these are settings (`compat.*`).
- A result that does not meet the requirements goes to a reviewer before the pairing is closed
  (`compat.requireReviewOnFail`, on by default). Reviewers use `GET /api/v1/admin/compatibility`,
  `GET /api/v1/admin/compatibility/:matchId` and `POST /api/v1/admin/compatibility/:matchId/decision`
  with `{ "decision": "PASS" | "CLOSE" }`. Reviewers see both sides without names and cannot review their own pairing.
- Closing for compatibility is permanent for the pair, uses the PRD wording ("This pairing did not meet the requirements
  for the next stage."), and nobody rests afterwards. Details of what was written are never shown once a pairing closes.
- Physical expectations are limited to 2 and can never be non-negotiable.

After pulling this milestone (PowerShell):

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate --name postmatch
pnpm db:seed
pnpm test
```
