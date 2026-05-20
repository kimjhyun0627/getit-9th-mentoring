# syntax=docker/dockerfile:1.7
# hobby-api — Express + Prisma (JS only, no build step).
# Build from repo root:  docker build -f apps/hobby-api/Dockerfile -t getit-hobby-api .

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
RUN node -e "const f='package.json';const p=require('./'+f);delete p.scripts.prepare;require('fs').writeFileSync(f,JSON.stringify(p,null,2));"

COPY packages/auth-utils/package.json    packages/auth-utils/package.json
COPY packages/schemas/package.json       packages/schemas/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY apps/hobby-api/package.json         apps/hobby-api/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile \
       --filter @getit/hobby-api... --filter @getit/hobby-api

COPY packages/auth-utils  packages/auth-utils
COPY packages/schemas     packages/schemas
COPY apps/hobby-api       apps/hobby-api

RUN pnpm --filter @getit/hobby-api exec prisma generate

# pnpm deploy strips the generated Prisma client; re-generate inside /out via
# the prisma CLI still available in the source-tree's devDeps under /repo.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @getit/hobby-api deploy --prod /out \
    && /repo/apps/hobby-api/node_modules/.bin/prisma generate \
       --schema=/out/prisma/schema.prisma \
    && ln -sf /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma \
              /out/node_modules/.prisma 2>/dev/null || true

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini wget \
    && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3002

COPY --from=builder --chown=app:app /out /app

USER app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3002/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
