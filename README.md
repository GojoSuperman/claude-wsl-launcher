# Claude WSL Launcher

**한국어** · [English](README.en.md) · [日本語](README.ja.md)

WSL 안에서 도는 작은 로컬 대시보드. `~/projects` 하위 폴더를 카드로 보여주고,
클릭 한 번으로 그 폴더에서 **Claude Code(`claude`)를 새 WSL 창**에 띄운다.
각 카드에 git 상태·실행 중 여부를 표시하고, 원격(GitHub) 받기·새 프로젝트 생성도 대시보드에서 한다.
대시보드 하단에는 **이 서버 자신의 콘솔**이 보여, 닫을 때 서버도 꺼야 함을 알 수 있다.

> 처음이세요? 단계별 설치 가이드를 보세요 → **[설치 가이드](docs/SETUP.ko.md)**

## 왜 이 도구인가?

claude 는 **WSL 네이티브 경로**(`~/projects/...`, ext4)에서 띄워야 제대로·빠르게 동작한다. Windows 탐색기로 `\\wsl.localhost\...`(UNC) 경로에 들어가 거기서 실행하면 함정에 빠진다:

- "이 폴더를 신뢰?" 재질문이 반복됨
- claude 의 Bash 가 **Windows Git Bash** 로 돌아 리눅스 `node_modules` 바이너리와 충돌
- 세션 로그가 Windows 쪽(`C:\...`)에 따로 쌓임
- 경계를 넘는 파일 I/O(`npm install`·`git status` 등)가 **5~10배 느림**

이 도구는 매번 터미널에서 `cd … && claude` 를 칠 필요 없이, **항상 올바른 네이티브 WSL 창**에서 클릭 한 번으로 띄워 이 함정들을 피한다.

## ⚠️ 요구사항

이 도구는 **로컬 PC를 직접 조작**한다(파일 스캔, WSL 창 실행). 따라서 다음 환경에서만 동작한다:

- **Windows 10/11 + WSL2** (`wsl.exe`·`powershell.exe` 사용 → **macOS·네이티브 Linux 미지원**)
- WSL 배포판 안에 **Node.js 20+** (nvm 권장)
- WSL 배포판 안에 **Claude Code CLI** (`claude` 명령) — 이 도구가 띄우는 대상

distro 이름·홈·사용자·바탕화면 경로는 **런타임 감지**하므로 PC마다 따로 설정할 필요가 없다.

## 빠른 시작

> ⚠️ **모든 명령(클론·설치·단축키)을 WSL(우분투) 터미널 안에서** 실행하세요 — Windows PowerShell·명령 프롬프트가 아닙니다. PowerShell 에서 클론하면 `.sh` 파일이 Windows 줄바꿈(CRLF)으로 저장돼, 단축키 설치가 `set: pipefail: invalid option name` 으로 실패합니다.

```bash
# WSL 터미널에서 (도구는 스캔 폴더 밖에 — 예: 홈)
cd ~
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
npm install
npm start
# 브라우저: http://127.0.0.1:41730  (기본으로 ~/projects 스캔; 없으면 mkdir -p ~/projects)
```

포트 변경: `PORT=5000 npm start` (포트가 사용 중이면 41730→41739 순으로 자동 폴백)

스캔 폴더 변경: `PROJECTS_ROOT=~/dev npm start` (기본 `~/projects`)

자세한 단계(환경 확인·설치 포함)는 **[설치 가이드](docs/SETUP.ko.md)** 참고.

### 바탕화면 단축키 (선택)

```bash
bash scripts/install-shortcut.sh
```

바탕화면에 단축키가 생긴다. 더블클릭하면 **서버를 백그라운드로 띄우고 브라우저만** 연다(별도 터미널 창 없음). 서버 기동에 실패하면 그때만 로그 창이 떠 원인을 보여준다.

## 기능

- **카드 목록**: `~/projects/*` 폴더를 카드로. 각 카드에 git 브랜치·변경 여부·마지막 커밋 시각, "실행 중" 배지, "대화 이력 있음/새 세션" 표시.
- **claude 실행**: 카드 버튼 → 그 폴더에서 **새 WSL 창**에 claude (이력 있으면 `--continue`). WSL 네이티브 실행이라 "폴더 신뢰" 재질문이 없다.
- **서버 콘솔(하단 패널)**: 이 서버의 로그를 실시간(읽기 전용)으로 보여줘 서버가 살아있음을 노출.
- **서버 종료 버튼**: 헤더에서 로컬 서버를 종료.
- **원격 받기**: 업스트림 있는 카드에서 `git fetch` 후 `↓N 뒤짐`이면 `git pull --ff-only`.
- **새 프로젝트**: `~/projects/<이름>` 폴더 생성 + `git init`.
- **다국어 (i18n)**: 헤더에서 한국어 · English · 日本語 전환 (선택 기억됨).
- **인앱 도움말**: 헤더 `❓ 도움말` 버튼 또는 `?` 키로 사용법 모달.
- **스캔 폴더 지정**: `PROJECTS_ROOT` 로 기본 `~/projects` 대신 원하는 폴더 스캔.
- **포트 자동 폴백**: 기본 `41730` 이 사용 중이면 `41731~` 로 자동 이동.

## 작동 방식

- 브라우저만으론 PC 프로세스를 못 띄우므로, **WSL 안에서 도는 작은 로컬 서버**(Express)가 대신한다.
- 서버는 `~/projects` 스캔, git 상태 조회, `powershell.exe`로 `Start-Process wsl.exe`를 호출해 **새 WSL 창**에 claude를 띄운다.
- 서버는 자신의 `stdout/stderr`를 가로채 `/ws/console` WebSocket으로 브라우저 하단 패널에 단방향 스트리밍한다.

## 보안

- **`127.0.0.1`(localhost) 전용 바인딩 — 외부에 노출하지 말 것.** 인증이 없고 명령을 실행하므로, 외부에 열면 임의 명령 실행 위험.
- 클라이언트는 프로젝트 **이름만** 전송 → 서버가 `~/projects` 안의 실제 경로로 재구성·검증(`/`·`..`·개행·NUL 거부).
- **개인 로컬 유틸리티**다. 멀티유저·원격 사용 용도가 아니다.

## 테스트

```bash
npm test
```

## 라이선스

[MIT](LICENSE)
