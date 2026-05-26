# syntax=docker/dockerfile:1.7
# letter-web — Vite + React → nginx:alpine serve.
# Build from repo root:  docker build -f apps/letter-web/Dockerfile -t getit-letter-web .

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

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY turbo.json ./
# Strip husky `prepare` script — dev-only, breaks `pnpm install` in builder.
RUN node -e "const f='package.json';const p=require('./'+f);delete p.scripts.prepare;require('fs').writeFileSync(f,JSON.stringify(p,null,2));"
COPY packages/theme/package.json            packages/theme/package.json
COPY packages/auth-utils/package.json       packages/auth-utils/package.json
COPY packages/schemas/package.json          packages/schemas/package.json
COPY packages/config-tailwind/package.json  packages/config-tailwind/package.json
COPY packages/config-eslint/package.json    packages/config-eslint/package.json
COPY apps/letter-web/package.json           apps/letter-web/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter @getit/letter-web... --filter @getit/letter-web

COPY packages/theme            packages/theme
COPY packages/auth-utils       packages/auth-utils
COPY packages/schemas          packages/schemas
COPY packages/config-tailwind  packages/config-tailwind
COPY packages/config-eslint    packages/config-eslint
COPY apps/letter-web           apps/letter-web

# Vite 빌드 타임 env — 누락 시 `/api` fallback 으로 현재 origin 을 친다.
# (#585) 학번 모달 PATCH 404 사고와 동일 패턴. 6 web Dockerfile 통일.
ARG VITE_AUTH_API_URL
ARG VITE_AUTH_URL
ARG VITE_AUTH_ORIGIN
ARG VITE_API_URL
ARG VITE_NICKNAME_ONBOARDING_ENFORCED
ENV VITE_AUTH_API_URL=${VITE_AUTH_API_URL} \
    VITE_AUTH_URL=${VITE_AUTH_URL} \
    VITE_AUTH_ORIGIN=${VITE_AUTH_ORIGIN} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_NICKNAME_ONBOARDING_ENFORCED=${VITE_NICKNAME_ONBOARDING_ENFORCED}

RUN pnpm --filter @getit/letter-web build

# ---------- runner ----------
FROM nginx:1.27-alpine AS runner
RUN rm -f /etc/nginx/conf.d/default.conf
COPY infra/nginx/spa.conf /etc/nginx/conf.d/app.conf
COPY --from=builder /repo/apps/letter-web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
