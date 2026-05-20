# syntax=docker/dockerfile:1.7
# auth-api — Express + Prisma (JS only, no build step).
# Build from repo root:  docker build -f apps/auth-api/Dockerfile -t getit-auth-api .

ARG PNPM_VERSION=9.15.0

# ---------- builder: full deps, prisma generate, then `pnpm deploy` prune --------
FROM node:20-alpine AS builder
ARG PNPM_VERSION
WORKDIR /repo

RUN apk add --no-cache libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

ENV CI=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json ./
# Strip husky `prepare` script — dev-only, breaks `pnpm install`.
RUN node -e "const f='package.json';const p=require('./'+f);delete p.scripts.prepare;require('fs').writeFileSync(f,JSON.stringify(p,null,2));"

COPY packages/auth-utils/package.json    packages/auth-utils/package.json
COPY packages/schemas/package.json       packages/schemas/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY apps/auth-api/package.json          apps/auth-api/package.json

# Full install so `prisma` CLI is on PATH for generate.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile \
       --filter @getit/auth-api... --filter @getit/auth-api

COPY packages/auth-utils  packages/auth-utils
COPY packages/schemas     packages/schemas
COPY apps/auth-api        apps/auth-api

RUN pnpm --filter @getit/auth-api exec prisma generate

# pnpm deploy → standalone prod-pruned tree at /out (workspace links hoisted).
# `deploy` strips the generated Prisma client, so re-generate inside /out using
# the prisma CLI from the source-tree's devDeps (still installed in /repo).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @getit/auth-api deploy --prod /out \
    && /repo/apps/auth-api/node_modules/.bin/prisma generate \
       --schema=/out/prisma/schema.prisma \
    && ln -sf /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma \
              /out/node_modules/.prisma 2>/dev/null || true

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini wget \
    && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3001

COPY --from=builder --chown=app:app /out /app

USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
