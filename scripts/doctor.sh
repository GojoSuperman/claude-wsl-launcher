#!/usr/bin/env bash
# scripts/doctor.sh — 설치 전/후 셀프 점검 (preflight doctor)
#
# SETUP.*.md 의 필수 요건을 자동으로 점검하고, 다시 설치하거나 셋팅해야 하는
# 항목이 있으면 "무엇을 / 어떤 명령으로" 고치면 되는지 설치자에게 알려준다.
# (기본: 진단만 — 변경 없음. --fix 옵션을 주면 [y/N] 동의 후 자동 수정.)
#
# 사용:  WSL(우분투) 터미널에서
#          bash scripts/doctor.sh         # 진단만(읽기전용, 안전)
#          bash scripts/doctor.sh --fix   # 문제를 [y/N] 동의받아 자동 수정
#
# 종료코드:  치명(❌) 항목이 있으면 1, 경고(⚠️)만 있거나 모두 통과면 0.
#
# 핵심: claude 점검은 단축키 런처가 실제로 쓰는 방식과 똑같이(=nvm 직접 소싱)
#       검사한다. 그래야 "터미널에선 되는데 단축키만 안 됨" 류를 미리 잡는다.
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJ="$(cd "$SCRIPT_DIR/.." && pwd -P)"

# 순수 판정/대화형 보조 함수 로드
# shellcheck source=lib/doctor-checks.sh
. "$SCRIPT_DIR/lib/doctor-checks.sh"

# --fix: 각 문제를 [y/N] 동의받아 자동 수정. 없으면 읽기전용(진단만).
FIX=0
[ "${1:-}" = "--fix" ] && FIX=1

# offer_fix <안내문구> <명령...>
#   --fix 면 [y/N] 묻고 예일 때 실행(드라이런 가능), 아니면 수동 명령만 안내.
offer_fix() {
  local msg="$1"; shift
  if [ "$FIX" = 1 ]; then
    if ask_yn "$msg"; then
      run_or_show "$@"
      hash -r 2>/dev/null || true
    else
      hint "건너뜀. 나중에 직접 실행:  $*"
    fi
  else
    hint "고치려면:  $*"
    hint "또는 자동 수정:  bash scripts/doctor.sh --fix"
  fi
}

# nvm 공식 설치 스크립트를 파일로 받아 실행(파이프 실행 회피) → nvm 로드 → Node LTS 설치 + default 지정
install_nvm_and_node() {
  local ver="v0.40.1" tmp
  tmp="$(mktemp)"
  if ! curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${ver}/install.sh" -o "$tmp"; then
    echo "  nvm 설치 스크립트 다운로드 실패 (네트워크 확인)" >&2; rm -f "$tmp"; return 1
  fi
  PROFILE=/dev/null bash "$tmp" >/dev/null 2>&1 || { rm -f "$tmp"; return 1; }   # PROFILE=/dev/null: rc 파일은 아래서 직접 처리
  rm -f "$tmp"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || return 1
  nvm install --lts >/dev/null 2>&1 || return 1
  nvm alias default 'lts/*' >/dev/null 2>&1 || true
  # 새 터미널에서도 nvm 이 보이도록 ~/.bashrc 에 로드 구문 추가(이미 있으면 생략)
  if ! grep -qs 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null; then
    printf '\n# nvm (Claude WSL Launcher setup 이 추가)\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\n' >> "$HOME/.bashrc"
  fi
  echo "  nvm + Node $(node -v) 설치됨 ($NVM_DIR)"
}

FAIL=0
WARN=0
ok()   { printf '  \xe2\x9c\x85 %s\n' "$1"; }
warn() { printf '  \xe2\x9a\xa0\xef\xb8\x8f  %s\n' "$1"; WARN=$((WARN + 1)); }
bad()  { printf '  \xe2\x9d\x8c %s\n' "$1"; FAIL=$((FAIL + 1)); }
hint() { printf '       \xe2\x86\x92 %s\n' "$1"; }

echo "========================================"
echo " 프로젝트 런처 셋업 점검 (doctor)"
echo " 위치: $PROJ"
[ "$FIX" = 1 ] && echo " 모드: 자동 수정(--fix) — 각 항목을 물어보고 고쳐요" || echo " 모드: 진단만(안전) — 고치려면 --fix"
echo "========================================"

# [1] WSL 안에서 실행 중인가 -------------------------------------------------
echo
echo "[1/7] WSL 환경"
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  ok "WSL 배포판: ${WSL_DISTRO_NAME}"
else
  bad "WSL 안이 아닙니다 (WSL_DISTRO_NAME 비어 있음)."
  hint "Windows PowerShell/탐색기가 아니라 WSL(우분투) 터미널에서 실행하세요."
fi

# [2] Windows 연동 (서버가 새 창을 띄울 때 필요) ------------------------------
echo
echo "[2/7] Windows 연동 (창 띄우기)"
PS_FALLBACK="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
if command -v powershell.exe >/dev/null 2>&1; then
  ok "powershell.exe 접근 가능 (PATH)"
elif [ -x "$PS_FALLBACK" ]; then
  ok "powershell.exe 접근 가능 (표준 경로 폴백)"
else
  bad "powershell.exe 를 찾지 못함 — 'claude 실행' 시 새 창이 안 뜹니다."
  hint "WSL interop 가 켜져 있는지 확인하세요 (/etc/wsl.conf 의 [interop] enabled=true)."
fi
if command -v wsl.exe >/dev/null 2>&1; then
  ok "wsl.exe 접근 가능"
else
  warn "wsl.exe 를 PATH 에서 못 찾음 — distro 자동감지 폴백이 제한될 수 있음."
fi

# --- 런처와 동일하게 nvm 로드 (이후 node/claude 점검을 같은 조건에서) --------
# launch-claude.sh 와 같은 절차: NVM_DIR 소싱 후 기본 노드 활성화.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NVM_LOADED=0
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  if command -v nvm >/dev/null 2>&1; then
    nvm use default >/dev/null 2>&1 && NVM_LOADED=1
  fi
fi
hash -r 2>/dev/null || true   # 캐시된 명령 위치 초기화 (정확한 command -v 위해)

# [3] Node.js >= 20 ----------------------------------------------------------
echo
echo "[3/7] Node.js (>= 20)"
if command -v node >/dev/null 2>&1 && is_node_ge "$(node -v 2>/dev/null)" 20; then
  if [ "$NVM_LOADED" = 1 ]; then ok "Node $(node -v) (nvm 기본)"; else ok "Node $(node -v)"; fi
else
  bad "Node 가 없거나 20 미만이에요 (런처가 안 떠요)."
  if command -v nvm >/dev/null 2>&1; then
    offer_fix "최신 Node(LTS)를 설치할까요?" nvm install --lts
  else
    hint "nvm(Node 버전 관리자)이 없어요. 공식 설치 스크립트로 nvm + 최신 Node(LTS)를 받을 수 있어요."
    offer_fix "nvm 을 설치하고 최신 Node(LTS)를 받을까요? (https://github.com/nvm-sh/nvm 공식 스크립트, ~/.nvm 에 설치)" install_nvm_and_node
  fi
  # 방금 설치됐으면 이후 점검(claude·의존성)이 같은 셸에서 node 를 보도록 다시 로드
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use default >/dev/null 2>&1 && NVM_LOADED=1
    hash -r 2>/dev/null || true
    command -v node >/dev/null 2>&1 && is_node_ge "$(node -v 2>/dev/null)" 20 && { ok "Node $(node -v) (방금 설치됨)"; FAIL=$((FAIL - 1)); }
  fi
fi

# [4] Claude CLI — 런처가 실제로 찾는 방식으로 -------------------------------
echo
echo "[4/7] Claude CLI (단축키 런처 기준)"
CLAUDE_PATH="$(command -v claude 2>/dev/null || true)"
case "$(classify_claude "$CLAUDE_PATH")" in
  missing)
    bad "claude 가 없어요 — 새 창에서 'claude: command not found' 가 떠요."
    offer_fix "claude 를 리눅스(WSL)에 제대로 설치할까요? (권장)" \
              npm install -g @anthropic-ai/claude-code ;;
  windows)
    warn "claude 가 '윈도우 쪽'에만 깔려 있어요: $CLAUDE_PATH"
    warn "버튼으로 실행할 때 가끔 안 열릴 수 있어요."
    offer_fix "리눅스(WSL) 쪽에 '제대로' 다시 설치할까요? (권장)" \
              npm install -g @anthropic-ai/claude-code ;;
  native)
    ok "claude (리눅스 네이티브): $CLAUDE_PATH  ($(claude --version 2>&1 | head -1))" ;;
esac

# [4b] GitHub CLI (선택) — 카드 '이름 변경' 이 GitHub 저장소 이름까지 바꿀 때만 필요
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    ok "gh CLI 로그인됨 (선택 — 이름 변경 시 GitHub 저장소 이름도 함께 변경)"
  else
    hint "gh CLI 는 있지만 로그인 안 됨 (선택): 'gh auth login' 하면 이름 변경 시 GitHub 저장소 이름도 바뀌어요."
  fi
else
  hint "gh CLI 없음 (선택): 없어도 동작해요. 이름 변경 시 GitHub 저장소 이름까지 바꾸려면 https://cli.github.com 설치 후 'gh auth login'."
fi

# [5] 스크립트 줄바꿈 (CRLF 면 bash 가 죽음) ---------------------------------
echo
echo "[5/7] 스크립트 줄바꿈 (LF)"
CRLF_FILES=""
for f in "$PROJ"/scripts/*.sh; do
  [ -f "$f" ] || continue
  if grep -q $'\r' "$f" 2>/dev/null; then
    CRLF_FILES="$CRLF_FILES $(basename "$f")"
  fi
done
if [ -n "$CRLF_FILES" ]; then
  bad "윈도우식 줄바꿈(CRLF)이 섞였어요:${CRLF_FILES}"
  offer_fix "줄바꿈을 리눅스식(LF)으로 고칠까요?" sed -i 's/\r$//' "$PROJ"/scripts/*.sh
else
  ok "scripts/*.sh 모두 LF"
fi

# [6] 의존성 설치 ------------------------------------------------------------
echo
echo "[6/7] 의존성 (node_modules)"
if [ -d "$PROJ/node_modules" ]; then
  ok "필요한 부품(node_modules) 설치됨"
else
  bad "필요한 부품(node_modules)이 없어요 — 서버가 안 떠요."
  offer_fix "지금 설치할까요?" npm install --prefix "$PROJ"
fi

# [7] 런처 스크립트 자체 -----------------------------------------------------
echo
echo "[7/7] 런처 스크립트"
if [ -f "$PROJ/scripts/launch-claude.sh" ]; then
  ok "런처 스크립트(launch-claude.sh) 있음"
else
  bad "런처 스크립트가 없어요 — 최신 코드를 안 받았어요."
  offer_fix "최신 코드를 받을까요?" git -C "$PROJ" pull --ff-only
fi

# --- 요약 -------------------------------------------------------------------
echo
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  printf ' 결과: \xe2\x9d\x8c 조치 필요 %d 건, \xe2\x9a\xa0\xef\xb8\x8f 경고 %d 건\n' "$FAIL" "$WARN"
  if [ "$FIX" = 1 ]; then
    echo " 일부를 건너뛰었다면, 다시 'bash scripts/doctor.sh --fix' 로 이어서 고칠 수 있어요."
  else
    echo " 자동으로 고치려면:  bash scripts/doctor.sh --fix"
  fi
  echo "========================================"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  printf ' 결과: \xe2\x9a\xa0\xef\xb8\x8f 경고 %d 건 (동작은 하지만 권장 조치 있음)\n' "$WARN"
  echo " 그대로 단축키 → 카드 'claude 실행' 으로 동작을 확인해도 됩니다."
  echo "========================================"
  exit 0
else
  printf ' 결과: \xe2\x9c\x85 모든 점검 통과 — 바로 사용하세요.\n'
  echo "========================================"
  exit 0
fi
