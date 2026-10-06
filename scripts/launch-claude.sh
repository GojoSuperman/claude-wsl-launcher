#!/usr/bin/env bash
# 새 WSL 창에서 claude 를 띄우는 런처 스크립트.
# server/launcher.js 가 다음 형태로 호출한다:
#   cmd /c start "" wsl.exe ... -- bash <이 스크립트> [--account <폴더>] [--label <이름>] [--continue]
#   --account: 그 계정 폴더(CLAUDE_CONFIG_DIR)로 실행 / --label: 탭 제목에 붙일 계정 이름
#
# 왜 인라인 bash 명령이 아니라 스크립트 파일인가:
#   단축키 → 대시보드 서버(node) → cmd start → wsl.exe 의 다단 호출을
#   거치면, 인라인 bash 명령의 따옴표/$변수/복합문이 중간 계층에서 망가진다
#   (예: `export PATH=...:$PATH` 가 효과 없이 사라짐). 게다가 그렇게 띄운 `bash -lic`
#   셸은 비대화형으로 취급되어 ~/.bashrc 상단의 비대화형 가드(`case $- in *i*) ;; *) return`)
#   에서 return 되고, 그 아래의 nvm 초기화가 실행되지 않는다 → `claude: command not found`.
#   (사용자가 직접 터미널에서 claude 를 칠 때는 대화형이라 nvm 이 로드돼 잘 됐다.)
#   스크립트 파일 안에서는 이 모든 셋업이 정상 동작하므로 파일로 분리한다.
#
# 줄바꿈: .gitattributes 의 `*.sh text eol=lf` 로 LF 가 보장된다(CRLF 면 bash 가 죽음).

# nvm 로드 — 대화형 가드(~/.bashrc)를 우회해 nvm.sh 를 직접 소싱한다.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  # 소싱만으론 기본 노드가 활성화되지 않으므로 명시적으로 use 한다.
  command -v nvm >/dev/null 2>&1 && nvm use default >/dev/null 2>&1
fi

# 네이티브 설치본(Claude Code 공식 권장 방식) 폴백: claude 는 ~/.local/bin 에 깔리는데,
# 이 셸은 비로그인(~/.profile 미실행)이라 그 경로가 PATH 에 없을 수 있다 → 있으면 직접 추가.
# (nvm 미사용 + 네이티브 설치 사용자도 command not found 안 나게 하는 범용 보강.)
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) [ -d "$HOME/.local/bin" ] && PATH="$HOME/.local/bin:$PATH" && export PATH ;;
esac

ACCOUNT_DIR=""
LABEL=""
CONT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --account) ACCOUNT_DIR="${2:-}"; shift ;;
    --label) LABEL="${2:-}"; shift ;;
    --continue) CONT=1 ;;
  esac
  shift
done

# 추가 계정: 설정 폴더만 바꾸고 API 키는 빼서 그 계정의 로그인으로 과금되게 한다.
# 대화 기록·지침·설정·플러그인은 계정 폴더 안의 링크로 기본 계정(~/.claude)과 공유되고,
# 빠진 링크·스킬·MCP 는 실행 직전 account-sync.mjs 로 맞춘다 (server/account-sync.js 참고).
if [ -n "$ACCOUNT_DIR" ]; then
  export CLAUDE_CONFIG_DIR="$ACCOUNT_DIR"
  unset ANTHROPIC_API_KEY
  command -v node >/dev/null 2>&1 && node "$(dirname "$0")/account-sync.mjs" "$ACCOUNT_DIR"
fi

# 터미널 탭 제목 = 프로젝트 폴더 이름(+ 계정 이름). claude 는 기본으로 탭 제목을 대화 주제로 계속
# 바꾸므로 CLAUDE_CODE_DISABLE_TERMINAL_TITLE 로 끄고 여기서 한 번 지정한다
# (2026-10-06 실측: 끄면 claude 의 제목 변경 시퀀스 0회). 이 스크립트는 프로젝트 폴더에서 실행된다.
TITLE="${PWD##*/}"
[ -n "$LABEL" ] && TITLE="$TITLE · $LABEL"
export CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
printf '\033]0;%s\007' "$TITLE"
[ -n "$LABEL" ] && echo "[계정: $LABEL]"

# claude 실행. nvm 이 없거나 claude 가 nvm 밖(시스템/~/.local/bin/Windows PATH)에 있어도
# PATH 에 있으면 그대로 실행된다 — 범용 폴백.
if [ "$CONT" = 1 ]; then
  claude --continue
else
  claude
fi

# claude 가 끝나도(또는 못 찾아도) 창이 즉시 닫히지 않게 대화형 셸로 전환.
exec bash -i
