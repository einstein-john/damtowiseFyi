# Build: docker build -t damtowise-fyi-api .
# Run:   docker run --env-file .env -p 8787:8787 damtowise-fyi-api

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=build /app/dist ./dist
COPY assets ./assets

USER node
EXPOSE 8787

# The scheduler and OG rendering need a live process; the orchestrator restarts
# on failure and /health reports liveness without touching the database.
CMD ["node", "dist/index.js"]