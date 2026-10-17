# syntax=docker/dockerfile:1.7
# Web app image (Next.js standalone output). Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t elearner-web .
# Runtime config comes from environment variables (see apps/web/src/env.ts); none are needed to build.
# Migrations are NOT run here: the deploy pipeline runs `pnpm db:deploy` before rolling out (docs/deployment.md).

ARG NODE_IMAGE=node:22.23.3-bookworm-slim

# ── 1. Dependencies: cached on the lockfile alone, so source edits don't refetch packages ──
FROM ${NODE_IMAGE} AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --frozen-lockfile

# ── 2. Build ──
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@elearner/web..."
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=@elearner/web

# ── 3. Runtime: only the standalone server, its traced node_modules and static assets ──
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
# Liveness only (no DB/Redis): orchestrators should use /api/health/ready for readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
