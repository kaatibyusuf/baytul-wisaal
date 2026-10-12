# Deploying Baytul Wisaal (staging, no custom domain needed)

Web on Vercel, API and Postgres on Railway. Vercel forwards `/api/v1/...` to the API, so the browser only ever talks to one site and the session cookie works on the free `vercel.app` address.

All commands are PowerShell, run from the project folder.

## 0. Before you start

1. Confirm migrations are committed. Production applies them with `prisma migrate deploy`, which needs the folder you created locally.
   ```
   dir prisma\migrations
   git status
   ```
   If `prisma\migrations` is untracked, `git add prisma/migrations`. If it is missing, run `pnpm db:migrate --name init` locally first.
2. Push the project to a GitHub repository (private is fine).

## 1. Database and API on Railway

1. railway.com > New Project > Deploy PostgreSQL.
2. In the same project: New > GitHub Repo > pick the repository. Railway finds `railway.json` and the `Dockerfile` by itself.
3. Open the API service > Variables, and add (see `.env.production.example`):
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the Postgres service)
   - `NODE_ENV` = `production`
   - `TRUST_PROXY` = `2`
   - `WEB_ORIGIN` and `APP_WEB_URL` = your Vercel address (you will know it after step 2; add them then and redeploy)
   - `COOKIE_SECURE` = `true`
   - AI keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`) and `AI_MODE=consensus`
   - Leave `RESEND_API_KEY` empty for now. Emails then print in the API logs.
4. Settings > Networking > Generate Domain. Copy it, for example `https://bw-api-production.up.railway.app`.
5. Check `https://<that domain>/api/v1/health`. It should say `"database":"up"`.

## 2. Web on Vercel

1. vercel.com > Add New > Project > the same repository. Set **Root Directory** to `apps/web`.
2. Environment variables:
   - `NEXT_PUBLIC_API_URL` = `/api/v1`
   - `API_INTERNAL_URL` = the Railway domain from step 1 (no trailing slash)
3. Deploy. Copy the Vercel address, then go back to Railway and set `WEB_ORIGIN` and `APP_WEB_URL` to it. Redeploy the API.

## 3. Load the content and create your admin

Point your local PowerShell at the Railway database for these commands. In Railway, open Postgres > Connect and copy the **public** connection URL.

```
$env:DATABASE_URL = "PASTE_PUBLIC_URL_HERE"
pnpm db:import-curriculum docs\curriculum.json --dry-run
pnpm db:import-curriculum docs\curriculum.json
pnpm db:make-admin you@example.com --role=SUPER_ADMIN
```

Do not run `pnpm db:seed` on staging. It loads sample data. Close the PowerShell window afterwards so the variable is gone. Register at the Vercel address first, then run `db:make-admin` with that email.

## 4. Test

Register, log in, open Day 1, open a scenario, then check Admin. Watch the Railway logs for errors.

## Known limits of the no-domain setup

- Requests pass through Vercel's forwarding, which has a time limit on slow responses. Normal pages are fine. If a scenario submission that waits on the AI providers times out, tell me and I will make it respond immediately and finish in the background.
- Resend needs a verified domain, so real email waits until you have one.

## When you buy a domain

1. Point `app.yourdomain.com` at Vercel and `api.yourdomain.com` at Railway (both give you the DNS records to add).
2. Railway: `WEB_ORIGIN` and `APP_WEB_URL` = `https://app.yourdomain.com`, `COOKIE_DOMAIN` = `.yourdomain.com`.
3. Vercel: `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com/api/v1`, and delete `API_INTERNAL_URL`.
4. Verify the domain in Resend, then set `RESEND_API_KEY` and `EMAIL_FROM`.
