# syntax=docker/dockerfile:1.7
# shelf-api — Express + Prisma (JS only, no build step).
# Build from repo root:  docker build -f apps/shelf-api/Dockerfile -t getit-shelf-api .

ARG PNPM_VERSION=9.15.0

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
COPY packages/env-validator/package.json packages/env-validator/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY apps/shelf-api/package.json         apps/shelf-api/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile \
       --filter @getit/shelf-api... --filter @getit/shelf-api

COPY packages/auth-utils  packages/auth-utils
COPY packages/schemas     packages/schemas
COPY packages/env-validator packages/env-validator
COPY apps/shelf-api       apps/shelf-api

RUN pnpm --filter @getit/shelf-api exec prisma generate

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @getit/shelf-api deploy --prod /out \
    && /repo/apps/shelf-api/node_modules/.bin/prisma generate \
       --schema=/out/prisma/schema.prisma \
    && ln -sf /out/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma \
              /out/node_modules/.prisma 2>/dev/null || true

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini wget \
    && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3003

COPY --from=builder --chown=app:app /out /app

USER app
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3003/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
