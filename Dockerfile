# Baytul Wisaal API image (used by Railway). The web app is deployed separately on Vercel.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .

# apps/web is excluded by .dockerignore; the workspace file still lists it, which pnpm tolerates.
RUN pnpm install
RUN pnpm db:generate
RUN pnpm --filter @bw/api build

ENV NODE_ENV=production

# Apply any pending migrations, then start. Migrations only ever move forward (migrate deploy).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema prisma/schema.prisma && node apps/api/dist/main.js"]
