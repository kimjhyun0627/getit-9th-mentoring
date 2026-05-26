# infra — Production deploy (Phase 4)

공통 인프라 (Docker Compose, Traefik, GCP VM). 배경 / PRD 는 [`.claude/projects/infra.md`](../.claude/projects/infra.md) 참조.

```text
internet ──► Traefik (80/443) ──► (edge network) ──► web / api containers
                                                       │
                                            (internal network) ──► mysql
```

## Layout

```text
infra/
├── docker-compose.prod.yml            # 13 services (traefik, mysql, landing, 5×web, 5×api)
├── .env.prod.example                  # secret template — copy to .env.prod on VM
├── nginx/spa.conf                     # nginx config baked into all web images
├── mysql/init/01-create-databases.sh  # idempotent DB bootstrap (templated from $MYSQL_USER)
└── traefik/
    ├── traefik.yml                    # static config (entrypoints, ACME)
    └── dynamic/middlewares.yml        # security-headers, rate-limit, compress
```

## DNS prerequisites (gabia → VM IP)

| Type | Name | Value     |
| :--- | :--- | :-------- |
| A    | `@`  | `<VM IP>` |
| A    | `*`  | `<VM IP>` |

TTL 300s 동안 테스트하고 안정되면 3600 으로. Let's Encrypt HTTP-01 인증서는 각 서브도메인 별로 첫 요청 시 발급된다 (와일드카드 인증서 불필요).

## Bootstrap a fresh GCP VM (Ubuntu 22.04+)

```bash
# 1. install docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. lay out the repo
sudo mkdir -p /opt/getit
sudo chown $USER:$USER /opt/getit
git clone https://github.com/kimjhyun0627/getit-9th-mentoring.git /opt/getit

# 3. configure secrets
cd /opt/getit/infra
cp .env.prod.example .env.prod
$EDITOR .env.prod        # 실제 값 채우고 저장
# CRITICAL — JWT_SECRET / SMTP_HOST 는 반드시 example 값에서 교체.
#   - JWT_SECRET: openssl rand -base64 48 결과로 교체.
#   - SMTP_HOST/USER/PASS: 실 운영 SMTP (Postmark/SES/등) 채워야 비번 재설정·
#     학교 인증 메일이 발송됨. 미설정/example 값이면 @getit/env-validator 가
#     boot 단계에서 throw — 컨테이너가 즉시 종료 (fail-fast, Issue #575).
#   - 메일 채널을 의도적으로 끄려면 MAILER_DISABLED_ALLOWED=true.

# 4. login to GHCR (PAT with read:packages)
echo "$GHCR_PAT" | docker login ghcr.io -u <gh-username> --password-stdin

# 5. pull + start
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

# 6. tail logs while ACME issues certs (~30s per subdomain)
docker compose -f docker-compose.prod.yml logs -f traefik
```

## Database migrations

Prisma 마이그레이션은 컨테이너 시작 시 자동 적용되지 않음 (스키마 변경은 명시적 작업으로 안전 확보). VM 에서 직접:

```bash
docker compose -f docker-compose.prod.yml exec auth-api \
  pnpm prisma migrate deploy --schema=prisma/schema.prisma
# hobby-api, shelf-api, board-api, letter-api 도 반복
```

## Updating a deployed stack

GitHub Actions (`.github/workflows/deploy.yml`) 가 11 개 이미지를 GHCR 에 push 한 뒤 SSH 로 `docker compose pull && up -d` 트리거. 수동 흐름:

```bash
cd /opt/getit && git pull
cd infra
docker compose --env-file .env.prod -f docker-compose.prod.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## Troubleshooting

- `acme.json: permission denied` — Traefik 은 권한이 느슨하면 시작을 거부. named volume 은 OK; bind mount 로 바꾸면 `chmod 600`.
- Cert 가 계속 pending — 80 포트가 공개 인터넷에서 도달 가능해야 함 (GCP 방화벽: `tcp:80,tcp:443` 오픈). Let's Encrypt 가 HTTP-01 로 검증.
- API 가 DB 못 잡음 — 둘 다 `internal` 네트워크에 있어야 하고, `DATABASE_URL` host 는 `mysql` (localhost X).

## 신규 workspace 패키지 추가 규칙

새 `packages/<name>/` 추가 시, 그 패키지를 의존하는 모든 앱 Dockerfile 에 두 줄을 동기화해야 한다 (manifest 단계 + source 단계). 누락 시 `pnpm install --filter` 가 workspace dep resolve 에 실패하고, 후속 `pnpm deploy --prod` 가 transitive deps 까지 prune 해서 컨테이너 부팅 실패 (45 분 라이브 다운 incident — PR #579 → #584).

CI 가 자동 검증한다 — `tools/ci/check-dockerfile-workspace-sync.mjs` 가 매 PR 마다 `apps/*/package.json` 의 runtime workspace dep 과 `apps/*/Dockerfile` 의 `COPY packages/<dir>/...` 라인을 대조. 누락 시 fail. 로컬 실행:

```bash
node tools/ci/check-dockerfile-workspace-sync.mjs
```
