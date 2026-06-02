#!/usr/bin/env bash
# 바탕화면 단축키가 호출하는 기동 스크립트 (옵션 1 + 헬스체크 폴백).
#
# 동작:
#   - 서버를 백그라운드로 기동(창이 닫혀도 유지) 후 포트 헬스체크
#   - 성공 → 기본 브라우저만 열고 이 창은 닫힘 (별도 터미널 창 없음)
#   - 실패 → 서버 로그를 보여주며 창을 유지 (눈먼 채 끝나지 않게)
#   - 이미 떠 있으면 재기동 없이 브라우저만
#
# 제약: 브라우저 페이지는 서버가 서빙하므로, 서버가 아예 안 뜨면 브라우저로
#       오류를 못 보여준다 → 그래서 실패 시 "이 창"에 로그를 남긴다.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJ="$(cd "$SCRIPT_DIR/.." && pwd -P)"
PORT="${PORT:-41730}"
export PORT                       # 자식 npm start 가 같은 기본 포트를 쓰도록 전달
[ -n "${PROJECTS_ROOT:-}" ] && export PROJECTS_ROOT  # 단축키가 지정한 스캔 폴더를 npm start 로 전달
PORT_END=$((PORT + 9))            # 서버는 PORT..PORT+9 범위에서 폴백 바인딩
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/project-launcher"
LOG="${LOG_DIR}/server.log"

# 기본 브라우저로 열기 (테스트 시 LAUNCHER_NO_BROWSER=1 로 생략). $1 = 포트
open_browser() {
  [ -n "${LAUNCHER_NO_BROWSER:-}" ] && return 0
  explorer.exe "http://localhost:${1}" >/dev/null 2>&1 || true
}

# PORT..PORT_END 중 "우리 대시보드"(health 마커)가 떠 있는 첫 포트를 echo. (curl 무의존 — /dev/tcp)
# 남이 점유한 포트는 마커 불일치로 건너뛴다 → 엉뚱한 앱을 열지 않는다.
ours_port() {
  local p resp
  for p in $(seq "$PORT" "$PORT_END"); do
    exec 3<>"/dev/tcp/127.0.0.1/$p" 2>/dev/null || continue
    printf 'GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n' >&3
    resp="$(timeout 1 cat <&3 2>/dev/null)"
    exec 3<&- 3>&- 2>/dev/null || true
    if printf '%s' "$resp" | grep -q '"app":"claude-wsl-launcher"'; then
      echo "$p"; return 0
    fi
  done
  return 1
}

cd "$PROJ"

if FOUND="$(ours_port)"; then
  echo "이미 실행 중입니다 (http://localhost:${FOUND}) — 브라우저만 엽니다."
  open_browser "$FOUND"
  exit 0
fi

mkdir -p "$LOG_DIR"
: > "$LOG"
# 창(wsl.exe 세션)이 닫혀도 살아남도록 setsid 로 새 세션에 완전 분리.
# (WSL 함정: transient `wsl.exe -- cmd` 세션이 끝나면 nohup 만으론 자식이 함께 죽는다.
#  setsid 는 제어터미널 없는 새 세션을 만들어 세션 종료 신호로부터 떼어낸다.)
setsid bash -c 'exec npm start' >>"$LOG" 2>&1 </dev/null &
disown 2>/dev/null || true

# 헬스체크: 최대 ~12초 동안 우리 대시보드가 (폴백 포함) 뜨길 기다림
for _ in $(seq 1 24); do
  if FOUND="$(ours_port)"; then
    echo "서버 기동 완료 (http://localhost:${FOUND}) — 브라우저를 엽니다."
    open_browser "$FOUND"
    exit 0
  fi
  sleep 0.5
done

# 실패 → 로그 노출 + 창 유지
echo "────────────────────────────────────────"
echo "⚠️  서버 기동 실패: ${PORT}~${PORT_END} 포트가 응답하지 않습니다."
echo "    로그 파일: ${LOG}"
echo "────────────────────────────────────────"
tail -n 100 "$LOG" 2>/dev/null || echo "(로그 비어 있음)"
echo "────────────────────────────────────────"
echo "수동 재시도:  cd '${PROJ}' && npm start"
exec bash -i
