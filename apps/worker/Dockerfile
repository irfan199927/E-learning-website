# syntax=docker/dockerfile:1.7
# Worker image: BullMQ consumers + ffmpeg. Build from the REPO ROOT:
#   docker build -f apps/worker/Dockerfile -t elearner-worker .
# tsup bundles the workspace packages into dist/; `pnpm deploy` installs only the npm runtime deps.
# Runtime config comes from environment variables (see apps/worker/src/env.ts).

ARG NODE_IMAGE=node:22.23.3-bookworm-slim

# ── 1. Dependencies (cached on the lockfile) ──
FROM ${NODE_IMAGE} AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile

# ── 2. Build + production-only node_modules ──
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@elearner/worker..."
RUN pnpm exec turbo run build --filter=@elearner/worker
# --legacy: pnpm 10 otherwise requires inject-workspace-packages; workspace code is already bundled into dist/.
# auto-install-peers=false keeps optional peers out (the Prisma CLI/Studio, TypeScript: ~215 MB never loaded at runtime).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @elearner/worker deploy --prod --legacy --ignore-scripts \
      --config.auto-install-peers=false --config.dedupe-peer-dependents=false /out \
 && cp -r apps/worker/dist /out/dist

# ── 3. Runtime ──
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production WORKER_HEALTH_PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.WORKER_HEALTH_PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
