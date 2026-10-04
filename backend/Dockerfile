# Multi-stage. Targets: dev (compose), build, runtime (deployed to Fly).
ARG NODE_IMAGE=node:24-bookworm-slim

# Prisma's schema engine (migrate) needs OpenSSL; slim images don't ship it.
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# dev: dependencies + source, for docker compose (source is bind-mounted over /app).
FROM base AS dev
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# build: install, generate the Prisma client, compile to dist/.
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate && npx nest build

# runtime: production dependencies (including prisma@7, so migrations run here) + dist/ + prisma/.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
# Fetch Prisma's schema engine now (as root), so `prisma migrate deploy` needs no
# writes or downloads at release time.
RUN npx prisma --version && chown -R node:node /app
USER node
EXPOSE 3000
# Exec form, so the process receives SIGTERM. (tsc keeps the src/ prefix because
# prisma/seed.ts compiles to dist/prisma/seed.js alongside it.)
CMD ["node", "dist/src/main.js"]
