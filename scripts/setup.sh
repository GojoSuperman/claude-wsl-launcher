#!/usr/bin/env bash
# scripts/setup.sh — 한 번에 설치 (clone 다음에 이것 하나만 실행하면 된다)
#
#   1) doctor.sh --fix : WSL / Node / claude / 줄바꿈 / 의존성 점검 → 빠진 것은 [Y/N] 묻고 설치
#   2) npm install     : (doctor 에서 건너뛰었어도) 의존성 보장
#   3) 바탕화면 단축키 : 만들지 [Y/N] 물어보고 install-shortcut.sh
#
#   2.5) 프로젝트 폴더 : 홈 아래에서 git 저장소를 여러 개 품은 폴더를 찾아 고르게 하고 설정 파일에 저장
#
# 사용:  WSL(우분투) 터미널에서   bash scripts/setup.sh
#        bash scripts/setup.sh --yes   비대화형(AI 에이전트·스크립트) — 모든 질문 '예', 폴더는 자동 선택
# 옵션:  SETUP_NO_SHORTCUT=1  단축키 질문 생략 (CI/테스트)
#        PROJECTS_ROOT=~/dev   스캔 폴더를 직접 지정 (질문 생략, 설정 파일에 저장)
# 종료코드: doctor 의 치명 항목이 남아 있으면 1, 아니면 0.
set -uo pipefail

# --yes: 비대화형. ask_yn 이 전부 '예', 프로젝트 폴더는 후보 중 자동 선택
for arg in "$@"; do
  case "$arg" in
    --yes|-y) export SETUP_YES=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJ="$(cd "$SCRIPT_DIR/.." && pwd -P)"
# shellcheck source=lib/doctor-checks.sh
. "$SCRIPT_DIR/lib/doctor-checks.sh"

echo "########################################"
echo "# Claude WSL Launcher 설치 (setup)"
echo "# 위치: $PROJ"
echo "########################################"
echo

# [1] 점검 + 자동 수정 -------------------------------------------------------
bash "$SCRIPT_DIR/doctor.sh" --fix
DOCTOR_RC=$?

# doctor 가 방금 nvm/Node 를 설치했을 수 있으니 이 셸에도 로드 (npm install·설정 저장이 node 를 쓴다)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use default >/dev/null 2>&1
  hash -r 2>/dev/null || true
fi

# [2] 의존성 보장 (doctor 에서 '아니요' 했거나 dry-run 이면 여기서 한 번 더) ----
echo
if [ -d "$PROJ/node_modules" ]; then
  echo "[setup] 의존성 설치됨 (node_modules)"
else
  echo "[setup] 의존성 설치: npm install"
  run_or_show npm install --prefix "$PROJ" || DOCTOR_RC=1
fi

# [2.5] 프로젝트 폴더(스캔 폴더) 정하기 → 설정 파일 --------------------------
# 우선순위: PROJECTS_ROOT 지정 > 사용자가 고른 후보 > ~/projects(없으면 생성)
CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/project-launcher/config.json"
echo
echo "[setup] 프로젝트 폴더 (카드로 보여줄 폴더들이 들어 있는 곳)"
CHOSEN=""
if [ -n "${PROJECTS_ROOT:-}" ]; then
  CHOSEN="$PROJECTS_ROOT"
  echo "  PROJECTS_ROOT 로 지정됨: $CHOSEN"
else
  CANDS="$(bash "$SCRIPT_DIR/lib/find-projects-root.sh" "$HOME" | head -8)"
  if [ -n "$CANDS" ]; then
    echo "  홈 아래에서 git 저장소를 품은 폴더를 찾았어요 (괄호 = 저장소 수):"
    i=0
    while IFS=$'\t' read -r n d; do
      i=$((i + 1)); printf '    %d) %s  (%s)\n' "$i" "${d/#$HOME/~}" "$n"
    done <<< "$CANDS"
    printf '    %d) ~/projects  (기본값 — 없으면 새로 만듦)\n' "$((i + 1))"
    printf '    %d) 직접 입력\n' "$((i + 2))"
    if [ -n "${SETUP_YES:-}" ]; then
      CHOSEN="$(printf '%s\n' "$CANDS" | head -1 | cut -f2)"
      echo "  [자동] 저장소가 가장 많은 1) 선택: ${CHOSEN/#$HOME/~}"
    else
      printf '  번호를 고르세요 [1]: ' >&2
      read -r pick 2>/dev/null || pick=""
      pick="${pick:-1}"
      if [ "$pick" = "$((i + 1))" ]; then CHOSEN="$HOME/projects"
      elif [ "$pick" = "$((i + 2))" ]; then printf '  폴더 경로: ' >&2; read -r CHOSEN 2>/dev/null || CHOSEN=""
      else CHOSEN="$(printf '%s\n' "$CANDS" | sed -n "${pick}p" | cut -f2)"; fi
      [ -z "$CHOSEN" ] && CHOSEN="$HOME/projects"
    fi
  else
    echo "  git 저장소를 품은 폴더를 못 찾았어요 → 기본 ~/projects 를 씁니다 (나중에 대시보드 [변경] 으로 바꿀 수 있어요)"
    CHOSEN="$HOME/projects"
  fi
fi
CHOSEN="${CHOSEN/#\~/$HOME}"
[ -d "$CHOSEN" ] || { echo "  폴더 생성: ${CHOSEN/#$HOME/~}"; run_or_show mkdir -p "$CHOSEN"; }
case "$CHOSEN" in
  /mnt/[a-zA-Z]/*) echo "  ⚠️  Windows 쪽 폴더(/mnt/…)예요. 동작은 하지만 5~10배 느리고 claude 실행에 함정이 있어요. 가능하면 WSL 홈 아래를 권장." ;;
esac
if [ -n "${DOCTOR_DRY_RUN:-}" ]; then
  echo "  (dry-run) 설정 저장 생략: $CONFIG_FILE ← $CHOSEN"
else
  mkdir -p "$(dirname "$CONFIG_FILE")"
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("fs"); const [file, root] = process.argv.slice(1);
      let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
      cfg.projectsRoot = root; fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    ' "$CONFIG_FILE" "$CHOSEN"
  else
    # node 없이도 저장 (설치 실패 대비): projectsRoot 하나만 기록. \ 와 " 는 JSON 이스케이프
    esc="$(printf '%s' "$CHOSEN" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    printf '{\n  "projectsRoot": "%s"\n}\n' "$esc" > "$CONFIG_FILE"
  fi
  echo "  저장됨: ${CONFIG_FILE/#$HOME/~}  →  projectsRoot = ${CHOSEN/#$HOME/~}"
fi
PROJECTS_ROOT_SHOW="${CHOSEN/#$HOME/~}"

# doctor 는 의존성이 없던 시점의 판정이므로, 설치 후 조용히 한 번 더 점검해 최종 판정을 갱신
if [ "$DOCTOR_RC" -ne 0 ]; then
  bash "$SCRIPT_DIR/doctor.sh" >/dev/null 2>&1 && DOCTOR_RC=0
fi

# [3] 바탕화면 단축키 (선택) --------------------------------------------------
echo
if [ -n "${SETUP_NO_SHORTCUT:-}" ]; then
  echo "[setup] 단축키 생략 (SETUP_NO_SHORTCUT)"
elif ask_yn "바탕화면에 단축키를 만들까요? (더블클릭으로 대시보드 실행, 나중에 'bash scripts/install-shortcut.sh' 로도 가능)"; then
  run_or_show bash "$SCRIPT_DIR/install-shortcut.sh"
else
  echo "[setup] 단축키 건너뜀. 나중에:  bash scripts/install-shortcut.sh"
fi

# --- 마무리 안내 --------------------------------------------------------------
echo
echo "########################################"
if [ "$DOCTOR_RC" -ne 0 ]; then
  echo "# ❌ 아직 조치가 필요한 항목이 있어요. 위 doctor 결과를 보고 고친 뒤 다시:  bash scripts/setup.sh"
  echo "########################################"
  exit 1
fi
echo "# ✅ 설치 완료"
echo "#"
echo "#   실행:   바탕화면 단축키 더블클릭   (또는 터미널에서  npm start)"
echo "#   주소:   http://127.0.0.1:${PORT:-41730}"
echo "#   스캔:   ${PROJECTS_ROOT_SHOW:-~/projects}   (대시보드 상단 [변경] 으로 언제든 바꿀 수 있어요)"
echo "#   종료:   대시보드 창을 닫으면 약 10초 뒤 서버가 자동 종료돼요"
echo "########################################"
exit 0
