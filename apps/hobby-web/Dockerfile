# syntax=docker/dockerfile:1.7
# hobby-web — Vite + React → nginx:alpine serve.
# Build from repo root:  docker build -f apps/hobby-web/Dockerfile -t getit-hobby-web .

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
COPY apps/hobby-web/package.json            apps/hobby-web/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter @getit/hobby-web... --filter @getit/hobby-web

COPY packages/theme            packages/theme
COPY packages/auth-utils       packages/auth-utils
COPY packages/schemas          packages/schemas
COPY packages/config-tailwind  packages/config-tailwind
COPY packages/config-eslint    packages/config-eslint
COPY apps/hobby-web            apps/hobby-web

# Vite 빌드 타임 env — 누락 시 `/api` fallback 으로 현재 origin (hobby.get-it.cloud)
# 을 친다. PATCH `/api/me/student-id` 가 hobby-api 로 404 나는 사고 (#585) 의
# 정확한 원인. build-args 로 반드시 주입. 6 web Dockerfile 통일.
#
# ARG 에 default 박는 이유 (Gemini #586): `ENV X=${X}` 만 두면 build-arg 미전달
# 시 ENV 가 빈 문자열 `""` 로 정의됨 → 코드 `?? '/api'` 의 `??` 는 `""` 를 valid
# 로 봐서 fallback 안 함. ARG 에 prod default 박으면 build-arg 누락 + 명시적
# `=""` 둘 다 안전. ENV 는 vite 가 process.env 로 읽으려면 필수 (ARG 만으론 부족).
ARG VITE_AUTH_API_URL=https://auth.get-it.cloud/api
ARG VITE_AUTH_URL=https://auth.get-it.cloud
ARG VITE_AUTH_ORIGIN=https://auth.get-it.cloud
ARG VITE_API_URL=/api
ARG VITE_NICKNAME_ONBOARDING_ENFORCED=
ENV VITE_AUTH_API_URL=${VITE_AUTH_API_URL} \
    VITE_AUTH_URL=${VITE_AUTH_URL} \
    VITE_AUTH_ORIGIN=${VITE_AUTH_ORIGIN} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_NICKNAME_ONBOARDING_ENFORCED=${VITE_NICKNAME_ONBOARDING_ENFORCED}

RUN pnpm --filter @getit/hobby-web build

# ---------- runner ----------
FROM nginx:1.27-alpine AS runner
RUN rm -f /etc/nginx/conf.d/default.conf
COPY infra/nginx/spa.conf /etc/nginx/conf.d/app.conf
COPY --from=builder /repo/apps/hobby-web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
