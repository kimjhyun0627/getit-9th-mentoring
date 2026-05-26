#!/usr/bin/env bash
# Post-deploy health probe — 5 BE API + 6 web 검증.
#
# 배경 (#587): 2026-05-26 run 26473512779 은 ssh-deploy success 였지만 5 BE 컨테이너가
# dotenv ERR_MODULE_NOT_FOUND 로 boot 실패. `docker compose up -d` 만으로는 컨테이너
# crash 를 감지 못 함 → silent 45분 다운. 이 스크립트가 GitHub Actions step 에서
# 11/11 endpoint 통과를 강제해 silent 실패를 차단한다.
#
# 검증:
#   5 API:  https://{auth,hobby,shelf,letter,board}.get-it.cloud/api/health
#           → HTTP 200 + JSON `ok: true`
#   6 web:  https://{get-it.cloud,auth/hobby/shelf/letter/board.get-it.cloud}/
#           → HTTP 200
#
# Retry: 컨테이너 restart 후 ready 까지 ~30s. 첫 실패 시 5s 간격으로 최대 12 회 (60s).
#
# Exit:  11/11 통과 → 0
#        하나라도 실패 → 1 (어느 endpoint / HTTP code / 사유 명시)
#
# Env override (test 용):
#   HEALTH_RETRIES   기본 12
#   HEALTH_INTERVAL  기본 5 (초)
#   HEALTH_TIMEOUT   기본 5  (curl --max-time, 초)
#   HEALTH_BASE      기본 https://  (mock test 시 http://127.0.0.1:PORT 로 override)

set -euo pipefail

RETRIES="${HEALTH_RETRIES:-12}"
INTERVAL="${HEALTH_INTERVAL:-5}"
TIMEOUT="${HEALTH_TIMEOUT:-5}"

# Endpoint list — name|url|kind
# kind = api  → HTTP 200 + JSON `"ok":true` 검증
# kind = web  → HTTP 200 검증
endpoints=(
  "auth-api|https://auth.get-it.cloud/api/health|api"
  "hobby-api|https://hobby.get-it.cloud/api/health|api"
  "shelf-api|https://shelf.get-it.cloud/api/health|api"
  "letter-api|https://letter.get-it.cloud/api/health|api"
  "board-api|https://board.get-it.cloud/api/health|api"
  "landing-web|https://get-it.cloud/|web"
  "auth-web|https://auth.get-it.cloud/|web"
  "hobby-web|https://hobby.get-it.cloud/|web"
  "shelf-web|https://shelf.get-it.cloud/|web"
  "letter-web|https://letter.get-it.cloud/|web"
  "board-web|https://board.get-it.cloud/|web"
)

# Test override: HEALTH_ENDPOINTS 가 set 되면 위 배열을 덮어쓴다.
# 형식: 한 줄에 `name|url|kind`. 줄 구분자는 `;` (개행 대신).
if [[ -n "${HEALTH_ENDPOINTS:-}" ]]; then
  IFS=';' read -r -a endpoints <<<"${HEALTH_ENDPOINTS}"
fi

# probe_once <url> <kind> → stdout: "HTTP=<code> BODY_OK=<true|false>"
#   exit code 0 = 통과, 1 = 실패. 실패 사유는 caller 가 stdout 파싱해서 보고.
probe_once() {
  local url="$1" kind="$2"
  local tmp http
  tmp="$(mktemp)"
  # -s silent, -o body, -w http-code, --max-time 명시. curl 자체 실패 (DNS/연결) 시 000 출력.
  http="$(curl -s -o "$tmp" -w '%{http_code}' --max-time "$TIMEOUT" "$url" || true)"

  local body_ok="n/a"
  if [[ "$kind" == "api" ]]; then
    # JSON `"ok":true` 부분 매칭. jq 가 있으면 정확하게, 없으면 grep fallback.
    if command -v jq >/dev/null 2>&1; then
      if jq -e '.ok == true' "$tmp" >/dev/null 2>&1; then
        body_ok="true"
      else
        body_ok="false"
      fi
    else
      if grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$tmp"; then
        body_ok="true"
      else
        body_ok="false"
      fi
    fi
  fi

  rm -f "$tmp"
  echo "HTTP=$http BODY_OK=$body_ok"

  if [[ "$http" != "200" ]]; then
    return 1
  fi
  if [[ "$kind" == "api" && "$body_ok" != "true" ]]; then
    return 1
  fi
  return 0
}

# probe_endpoint <name> <url> <kind> → 통과 시 0, 실패 시 1 + 마지막 결과 echo.
probe_endpoint() {
  local name="$1" url="$2" kind="$3"
  local attempt result rc

  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    if result="$(probe_once "$url" "$kind")"; then
      echo "  ok  $name  attempt=$attempt  $result"
      return 0
    fi
    if ((attempt < RETRIES)); then
      sleep "$INTERVAL"
    fi
  done

  # 마지막 시도 결과 한 번 더 (실패 사유 명확하게).
  rc=0
  result="$(probe_once "$url" "$kind")" || rc=$?
  local elapsed=$((RETRIES * INTERVAL))
  echo "  FAIL $name  url=$url  ${result}  retries=$RETRIES  elapsed=${elapsed}s" >&2
  return 1
}

main() {
  echo "Post-deploy health probe — ${#endpoints[@]} endpoints, retries=$RETRIES interval=${INTERVAL}s timeout=${TIMEOUT}s"
  local failures=0
  local failed_list=()

  for entry in "${endpoints[@]}"; do
    IFS='|' read -r name url kind <<<"$entry"
    if ! probe_endpoint "$name" "$url" "$kind"; then
      failures=$((failures + 1))
      failed_list+=("$name ($url)")
    fi
  done

  echo
  if ((failures == 0)); then
    echo "OK: ${#endpoints[@]}/${#endpoints[@]} endpoints healthy."
    return 0
  fi

  echo "FAIL: $failures/${#endpoints[@]} endpoints unhealthy:" >&2
  for f in "${failed_list[@]}"; do
    echo "  - $f" >&2
  done
  return 1
}

main "$@"
