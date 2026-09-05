#!/usr/bin/env bash
# scripts/setup.sh — 한 번에 설치 (clone 다음에 이것 하나만 실행하면 된다)
#
#   1) doctor.sh --fix : WSL / Node / claude / 줄바꿈 / 의존성 점검 → 빠진 것은 [Y/N] 묻고 설치
#   2) npm install     : (doctor 에서 건너뛰었어도) 의존성 보장
#   3) 바탕화면 단축키 : 만들지 [Y/N] 물어보고 install-shortcut.sh
#
# 사용:  WSL(우분투) 터미널에서   bash scripts/setup.sh
# 옵션:  SETUP_NO_SHORTCUT=1  단축키 질문 생략 (CI/테스트)
#        PROJECTS_ROOT=~/dev   스캔 폴더를 단축키에 구워 넣기 (미지정 시 ~/projects)
# 종료코드: doctor 의 치명 항목이 남아 있으면 1, 아니면 0.
set -uo pipefail

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

# [2] 의존성 보장 (doctor 에서 '아니요' 했거나 dry-run 이면 여기서 한 번 더) ----
echo
if [ -d "$PROJ/node_modules" ]; then
  echo "[setup] 의존성 설치됨 (node_modules)"
else
  echo "[setup] 의존성 설치: npm install"
  run_or_show npm install --prefix "$PROJ" || DOCTOR_RC=1
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
echo "#   스캔:   ${PROJECTS_ROOT:-~/projects}   (프로젝트 폴더들을 여기 두면 카드로 보여요)"
echo "#   종료:   대시보드 창을 닫으면 약 10초 뒤 서버가 자동 종료돼요"
echo "########################################"
exit 0
