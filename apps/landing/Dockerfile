# syntax=docker/dockerfile:1.7
# landing — Vite static (React) → nginx:alpine serve.
# Build from repo root:  docker build -f apps/landing/Dockerfile -t getit-landing .

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate

ENV CI=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0

# Workspace manifests first (better layer cache).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json ./
# Strip husky `prepare` script — dev-only, breaks `pnpm install` in builder.
RUN node -e "const f='package.json';const p=require('./'+f);delete p.scripts.prepare;require('fs').writeFileSync(f,JSON.stringify(p,null,2));"
COPY packages/theme/package.json            packages/theme/package.json
COPY packages/auth-utils/package.json       packages/auth-utils/package.json
COPY packages/schemas/package.json          packages/schemas/package.json
COPY packages/config-tailwind/package.json  packages/config-tailwind/package.json
COPY packages/config-eslint/package.json    packages/config-eslint/package.json
COPY apps/landing/package.json              apps/landing/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter @getit/landing... --filter @getit/landing

# Source.
COPY packages/theme            packages/theme
COPY packages/auth-utils       packages/auth-utils
COPY packages/schemas          packages/schemas
COPY packages/config-tailwind  packages/config-tailwind
COPY packages/config-eslint    packages/config-eslint
COPY apps/landing              apps/landing

RUN pnpm --filter @getit/landing build

# ---------- runner ----------
FROM nginx:1.27-alpine AS runner
RUN rm -f /etc/nginx/conf.d/default.conf
COPY infra/nginx/spa.conf /etc/nginx/conf.d/app.conf
COPY --from=builder /repo/apps/landing/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
