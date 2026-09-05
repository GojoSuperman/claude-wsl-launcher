#!/usr/bin/env bash
# 바탕화면 단축키가 호출하는 기동 스크립트 (옵션 1 + 헬스체크 폴백).
#
# 동작:
#   - 서버를 백그라운드로 기동(창이 닫혀도 유지) 후 포트 헬스체크
#   - 성공 → 브라우저만 열고 이 창은 닫힘 (Chrome 있으면 앱 모드 독립 창, 없으면 기본 브라우저)
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

# chrome.exe 경로 탐지 (하드코딩 금지 — 데스크탑/노트북 양쪽 동작). 없으면 빈 문자열.
find_chrome() {
  local p winuser
  for p in \
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; do
    [ -f "$p" ] && { printf '%s' "$p"; return 0; }
  done
  # 사용자 로컬(AppData) 설치 폴백 — Windows 사용자명은 PC마다 다르므로 런타임 조회
  winuser="$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')"
  if [ -n "$winuser" ]; then
    p="/mnt/c/Users/${winuser}/AppData/Local/Google/Chrome/Application/chrome.exe"
    [ -f "$p" ] && { printf '%s' "$p"; return 0; }
  fi
  return 1
}

# powershell.exe 경로 (비대화형/스냅샷 셸엔 PATH 에 없어 ENOENT 날 수 있음 → 절대경로 폴백).
# powershell.exe 는 System32 직속이 아니라 WindowsPowerShell\v1.0 하위에 있다.
resolve_pwsh() {
  command -v powershell.exe >/dev/null 2>&1 && { echo "powershell.exe"; return 0; }
  local p="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  [ -f "$p" ] && { echo "$p"; return 0; }
  return 1
}

# 브라우저로 열기 (테스트 시 LAUNCHER_NO_BROWSER=1 로 생략). $1 = 포트
# Chrome 앱 모드(--app)로 주소창·탭·메뉴 없는 독립 창을 띄운다.
# 핵심: chrome 을 Start-Process 로 Windows 가 직접(분리된 채) 띄우게 한다.
#   - WSL 함정: interop 으로 띄운 chrome 을 setsid 로 분리해도, 단축키의 transient
#     WSL 세션이 닫히는 순간 함께 죽는다(2026-06-05 실측). explorer.exe 가 멀쩡했던 건
#     URL 만 Windows 셸에 넘기고 실제 브라우저는 Windows 가 소유하기 때문.
#   - 그래서 Start-Process(=Windows 소유)로 띄워야 세션 종료와 무관하게 창이 유지된다.
# 실패(미설치/조회불가)하면 explorer.exe(기본 브라우저 일반 탭)로 폴백 → 최소한 대시보드는 뜬다.
open_browser() {
  [ -n "${LAUNCHER_NO_BROWSER:-}" ] && return 0
  local url="http://localhost:${1}" chrome chrome_win pwsh
  if chrome="$(find_chrome)" && pwsh="$(resolve_pwsh)"; then
    chrome_win="$(wslpath -w "$chrome")"
    if "$pwsh" -NoProfile -Command \
         "Start-Process -FilePath '${chrome_win}' -ArgumentList '--app=${url}'" \
         >/dev/null 2>&1; then
      return 0
    fi
  fi
  explorer.exe "$url" >/dev/null 2>&1 || true
}

# PORT..PORT_END 중 "우리 대시보드"(health 마커)가 떠 있는 첫 포트를 echo. (curl 무의존 — /dev/tcp)
# 남이 점유한 포트는 마커 불일치로 건너뛴다 → 엉뚱한 앱을 열지 않는다.
ours_port() {
  local p tmp pids=""
  tmp="$(mktemp -d)"
  # 포트 10개를 병렬로 탐색한다. 각 탐색은 connect+요청+응답을 통째로 timeout 으로 감싼다.
  # WSL mirrored 네트워킹(.wslconfig networkingMode=mirrored)에서는 아무도 안 듣는 루프백 포트에
  # connect 해도 거부(RST)가 오지 않고 SYN-SENT 로 ~2분 멈추는 경우가 있다(2026-09-04 노트북 실측).
  # 타임아웃 없이는 단축키가 서버를 띄우기도 전에 여기서 멎어 "실행이 안 되는" 것처럼 보이고,
  # 순차 탐색이면 회전마다 포트 수 × 타임아웃만큼 기다리게 되므로 병렬로 돌린다.
  for p in $(seq "$PORT" "$PORT_END"); do
    timeout 1 bash -c '
      exec 3<>"/dev/tcp/127.0.0.1/$1" || exit 1
      printf "GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n" >&3
      cat <&3' _ "$p" >"$tmp/$p" 2>/dev/null &
    pids="$pids $!"
  done
  wait $pids 2>/dev/null
  for p in $(seq "$PORT" "$PORT_END"); do
    if grep -q '"app":"claude-wsl-launcher"' "$tmp/$p" 2>/dev/null; then
      rm -rf "$tmp"; echo "$p"; return 0
    fi
  done
  rm -rf "$tmp"
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
