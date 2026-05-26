#!/usr/bin/env bash
# Unit test for tools/ci/post-deploy-health.sh
#
# 전략: Node.js 로 임시 HTTP mock 서버 띄워서 케이스별 응답 시나리오 검증.
# (CI runner 가 node 가지고 있으므로 외부 의존 없음.)
#
# 테스트 케이스:
#   1. 11/11 healthy → exit 0
#   2. 1 api endpoint HTTP 500 → exit 1, 사유 메시지에 endpoint + HTTP code
#   3. 1 api endpoint HTTP 200 + JSON `ok: false` → exit 1
#   4. 1 web endpoint HTTP 502 → exit 1
#   5. Retry: 처음 2회 502, 3회째 200 → exit 0 (retry 동작 확인)
#
# 실행: bash tools/ci/post-deploy-health.test.sh
#       PASS / FAIL 출력. 실패 시 exit 1.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$SCRIPT_DIR/post-deploy-health.sh"

if [[ ! -x "$PROBE" ]]; then
  echo "FAIL: $PROBE not found or not executable" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "SKIP: node not available; cannot run mock-server tests" >&2
  exit 0
fi

# Pick a free port (ephemeral).
PORT="$(node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close();});")"
MOCK_PID=""
MOCK_STATE=""

cleanup() {
  if [[ -n "${MOCK_PID:-}" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
  [[ -n "${MOCK_STATE:-}" && -f "$MOCK_STATE" ]] && rm -f "$MOCK_STATE"
}
trap cleanup EXIT

# Mock server: route-based 응답. 상태 파일로 retry 시나리오 시뮬레이션.
#   /healthy-api  → 200 {"ok":true}
#   /healthy-web  → 200 "<html>"
#   /bad-api-500  → 500 ""
#   /bad-api-okfalse → 200 {"ok":false}
#   /bad-web-502 → 502 ""
#   /flaky-api  → 첫 N call 502, 이후 200 {"ok":true} (N 은 MOCK_STATE 파일에서 읽음)
start_mock_server() {
  MOCK_STATE="$(mktemp)"
  echo "2" > "$MOCK_STATE"  # 첫 2회는 fail, 3회째부터 ok
  export MOCK_STATE PORT

  node -e "
    const http = require('http');
    const fs = require('fs');
    const state = process.env.MOCK_STATE;
    const port = Number(process.env.PORT);
    const srv = http.createServer((req, res) => {
      const url = req.url || '/';
      if (url === '/healthy-api') {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: true, service: 'mock'}));
        return;
      }
      if (url === '/healthy-web') {
        res.writeHead(200, {'content-type': 'text/html'});
        res.end('<html>ok</html>');
        return;
      }
      if (url === '/bad-api-500') {
        res.writeHead(500);
        res.end('');
        return;
      }
      if (url === '/bad-api-okfalse') {
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: false}));
        return;
      }
      if (url === '/bad-web-502') {
        res.writeHead(502);
        res.end('');
        return;
      }
      if (url === '/flaky-api') {
        const remaining = Number(fs.readFileSync(state, 'utf8').trim());
        if (remaining > 0) {
          fs.writeFileSync(state, String(remaining - 1));
          res.writeHead(502);
          res.end('');
          return;
        }
        res.writeHead(200, {'content-type': 'application/json'});
        res.end(JSON.stringify({ok: true}));
        return;
      }
      res.writeHead(404);
      res.end('');
    });
    srv.listen(port, '127.0.0.1');
  " &
  MOCK_PID=$!

  # Wait for server ready (max 3s).
  local i
  for i in {1..30}; do
    if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/healthy-web"; then
      return 0
    fi
    sleep 0.1
  done
  echo "FAIL: mock server did not become ready" >&2
  return 1
}

PASS=0
FAIL=0
report() {
  local name="$1" rc="$2" expected="$3"
  if [[ "$rc" == "$expected" ]]; then
    echo "  PASS  $name (rc=$rc)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name (rc=$rc, expected=$expected)" >&2
    FAIL=$((FAIL + 1))
  fi
}

start_mock_server || exit 1

# Common short retry/interval for tests.
export HEALTH_RETRIES=3
export HEALTH_INTERVAL=1
export HEALTH_TIMEOUT=2

BASE="http://127.0.0.1:$PORT"

# ── Test 1: 모두 healthy → 0 ─────────────────────────────────────────────
HEALTH_ENDPOINTS="api1|$BASE/healthy-api|api;web1|$BASE/healthy-web|web" \
  "$PROBE" >/tmp/probe-test-1.log 2>&1
report "all healthy" "$?" "0"

# ── Test 2: api HTTP 500 → 1 ────────────────────────────────────────────
HEALTH_ENDPOINTS="api1|$BASE/healthy-api|api;bad|$BASE/bad-api-500|api" \
  "$PROBE" >/tmp/probe-test-2.log 2>&1
RC=$?
report "api HTTP 500 fails" "$RC" "1"
if ! grep -q "bad" /tmp/probe-test-2.log; then
  echo "  FAIL  api HTTP 500 fails: endpoint name not in log" >&2
  FAIL=$((FAIL + 1))
fi
if ! grep -q "HTTP=500" /tmp/probe-test-2.log; then
  echo "  FAIL  api HTTP 500 fails: HTTP=500 not reported" >&2
  FAIL=$((FAIL + 1))
fi

# ── Test 3: api 200 + ok:false → 1 ──────────────────────────────────────
HEALTH_ENDPOINTS="bad|$BASE/bad-api-okfalse|api" \
  "$PROBE" >/tmp/probe-test-3.log 2>&1
RC=$?
report "api ok:false fails" "$RC" "1"
if ! grep -q "BODY_OK=false" /tmp/probe-test-3.log; then
  echo "  FAIL  api ok:false: BODY_OK=false not reported" >&2
  FAIL=$((FAIL + 1))
fi

# ── Test 4: web HTTP 502 → 1 ────────────────────────────────────────────
HEALTH_ENDPOINTS="web1|$BASE/healthy-web|web;bad|$BASE/bad-web-502|web" \
  "$PROBE" >/tmp/probe-test-4.log 2>&1
RC=$?
report "web HTTP 502 fails" "$RC" "1"
if ! grep -q "HTTP=502" /tmp/probe-test-4.log; then
  echo "  FAIL  web HTTP 502: HTTP=502 not reported" >&2
  FAIL=$((FAIL + 1))
fi

# ── Test 5: Retry 동작 — 첫 2회 502, 3회 200 → 0 ────────────────────────
# mock state 는 처음 호출 시 2 로 초기화됨. 위 테스트들이 flaky 를 안 건드렸으므로 그대로.
HEALTH_ENDPOINTS="flaky|$BASE/flaky-api|api" \
  "$PROBE" >/tmp/probe-test-5.log 2>&1
report "retry recovers after 2 failures" "$?" "0"
if ! grep -q "attempt=3" /tmp/probe-test-5.log; then
  echo "  WARN  retry test: expected attempt=3 in log" >&2
fi

echo
echo "Result: $PASS passed, $FAIL failed."
if ((FAIL > 0)); then
  echo "--- Test 2 log ---" >&2
  cat /tmp/probe-test-2.log >&2
  exit 1
fi
exit 0
