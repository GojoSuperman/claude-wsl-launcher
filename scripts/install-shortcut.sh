#!/usr/bin/env bash
# 바탕화면에 "프로젝트 런처" 단축키(.lnk)를 생성한다.
#
# 더블클릭하면 scripts/launch.sh 를 실행한다:
#   - 서버를 백그라운드로 기동(창이 닫혀도 유지) 후 포트 헬스체크
#   - 성공 → 기본 브라우저만 열고 창은 닫힘 (별도 터미널 창 없음)
#   - 실패 → 서버 로그를 보여주며 창 유지 (눈먼 채 끝나지 않게)
#   서버 콘솔은 브라우저 하단 패널에서 보이고, 종료는 [서버 종료] 버튼.
#
# 설계 원칙(계획서 §3·§4):
#   - distro / 홈 / 프로젝트 경로는 런타임 감지 → 데스크탑·노트북 양쪽 동작 (하드코딩 금지)
#   - 바탕화면 경로는 PowerShell [Environment]::GetFolderPath('Desktop')
#     → OneDrive 리다이렉트·언어 무관하게 정확
#   - npm(nvm)을 찾으려면 로그인+대화형 셸 `bash -lic`
#   - 동적 값은 PS 단일인용 문자열로 이스케이프(' -> '')해 삽입하고,
#     스크립트 파일은 UTF-8 BOM 으로 써서 Windows PowerShell 5.1 이 한글을 올바로 읽게 함
#     (WSL 환경변수는 Windows 프로세스로 자동 전달되지 않으므로 env 전달은 쓰지 않음)
set -euo pipefail

DISTRO="${WSL_DISTRO_NAME:-}"
if [ -z "$DISTRO" ]; then
  echo "오류: WSL_DISTRO_NAME 이 비어 있습니다. WSL 안에서 실행하세요." >&2
  exit 1
fi

# 이 스크립트 위치 기준으로 프로젝트 루트 결정 (어디서 실행해도 동작)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJ="$(cd "$SCRIPT_DIR/.." && pwd -P)"
PORT="${PORT:-41730}"
PROJECTS_ROOT="${PROJECTS_ROOT:-}"   # 설치 시점에 주면 단축키에 구워 넣음(미설정이면 서버 기본 ~/projects)
URL="http://localhost:${PORT}"
# 단축키 표시 이름. SHORTCUT_NAME 으로 바꿀 수 있다(같은 이름의 기존 .lnk 를 덮어쓰므로,
# 다른 런처와 충돌하지 않게 고유한 이름을 주면 된다).
NAME="${SHORTCUT_NAME:-Claude WSL Launcher}"

if [ ! -f "$PROJ/package.json" ]; then
  echo "오류: $PROJ/package.json 이 없습니다." >&2
  exit 1
fi

# 단축키가 실행할 명령: launch.sh (백그라운드 기동 + 헬스체크 폴백). PORT·PROJECTS_ROOT 는 설치 시점 값 전달.
# PROJECTS_ROOT 값은 작은따옴표로 감싼다(공백/특수문자 대비). bash -lic 큰따옴표 안의 작은따옴표는 리터럴.
ENV_PREFIX="PORT=${PORT}"
if [ -n "$PROJECTS_ROOT" ]; then
  ENV_PREFIX="PROJECTS_ROOT='${PROJECTS_ROOT}' ${ENV_PREFIX}"
fi
BASHCMD="${ENV_PREFIX} bash scripts/launch.sh"
# wsl.exe 가 받을 Arguments 문자열 (경로/명령을 큰따옴표로 그룹화)
LNK_ARGS="-d ${DISTRO} --cd \"${PROJ}\" -- bash -lic \"${BASHCMD}\""

# PowerShell 단일인용 문자열 이스케이프: ' -> ''
psq() { printf '%s' "$1" | sed "s/'/''/g"; }
ARGS_PS="$(psq "$LNK_ARGS")"
NAME_PS="$(psq "$NAME")"

# powershell.exe 경로: 비대화형 셸(Claude Code 등 AI 에이전트가 실행할 때)엔 Windows 경로가
# PATH 에 없어 이름만으로는 못 찾는다 → System32 절대경로로 폴백. (doctor.sh·launch.sh 와 같은 규칙)
resolve_pwsh() {
  command -v powershell.exe >/dev/null 2>&1 && { echo "powershell.exe"; return 0; }
  local p="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  [ -f "$p" ] && { echo "$p"; return 0; }
  return 1
}
if ! PWSH="$(resolve_pwsh)"; then
  echo "오류: powershell.exe 를 찾지 못했습니다 (PATH 에도, /mnt/c/Windows/System32 에도 없음). WSL 에서 Windows 연동(interop)이 꺼져 있는지 확인하세요." >&2
  exit 1
fi

# Windows 임시 폴더(로컬 C: 경로 — UNC 회피)에 PowerShell 스크립트 작성. cmd.exe 대신 powershell 로 조회(PATH 무관).
WIN_TMP="$("$PWSH" -NoProfile -Command '$env:TEMP' 2>/dev/null | tr -d '\r')"
if [ -z "$WIN_TMP" ]; then
  echo "오류: Windows 임시 폴더(%TEMP%)를 알아내지 못했습니다." >&2
  exit 1
fi
TMP_WSL="$(wslpath -u "$WIN_TMP")"
PS1_WSL="${TMP_WSL}/make-launcher-shortcut.ps1"
PS1_WIN="${WIN_TMP}\\make-launcher-shortcut.ps1"

# UTF-8 BOM + PS 본문 (\$ → 리터럴 $, \\ → 리터럴 \)
{
  printf '\xEF\xBB\xBF'
  printf '%s\n' "\$ws = New-Object -ComObject WScript.Shell"
  printf '%s\n' "\$desktop = [Environment]::GetFolderPath('Desktop')"
  printf '%s\n' "\$lnk = Join-Path \$desktop '${NAME_PS}.lnk'"
  printf '%s\n' "\$s = \$ws.CreateShortcut(\$lnk)"
  printf '%s\n' "\$s.TargetPath = 'C:\\Windows\\System32\\wsl.exe'"
  printf '%s\n' "\$s.Arguments = '${ARGS_PS}'"
  printf '%s\n' "\$s.IconLocation = 'C:\\Windows\\System32\\wsl.exe,0'"
  printf '%s\n' "\$s.Description = '프로젝트 런처 대시보드 (백그라운드 기동 + 브라우저)'"
  printf '%s\n' "\$s.Save()"
  printf '%s\n' "Write-Output \$lnk"
} > "$PS1_WSL"

echo "단축키 생성 중... (이름: ${NAME}.lnk)"
LNK_PATH="$("$PWSH" -NoProfile -ExecutionPolicy Bypass -File "$PS1_WIN" 2>/dev/null | tr -d '\r')"
rm -f "$PS1_WSL"

if [ -n "$LNK_PATH" ]; then
  echo "✅ 생성 완료 (바탕화면): ${NAME}.lnk"
  echo "   더블클릭 → 서버 백그라운드 기동 + 브라우저(${URL}) (실패 시에만 창 유지)"
  if [ -n "$PROJECTS_ROOT" ]; then
    echo "   스캔 폴더: ${PROJECTS_ROOT}"
  else
    echo "   스캔 폴더: 설정 파일(~/.config/project-launcher/config.json) 또는 기본 ~/projects — 대시보드 상단 [변경] 으로 바꿀 수 있음"
  fi
else
  echo "⚠️  단축키 경로를 확인하지 못했습니다. PowerShell 출력/권한을 확인하세요." >&2
  exit 1
fi
