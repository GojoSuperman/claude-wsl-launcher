# 설치 가이드 (처음이어도 따라올 수 있게)

**한국어** · [English](SETUP.en.md) · [日本語](SETUP.ja.md)

**WSL2 확인 → 도구 받기 → `setup.sh` 한 번 → 실행** 순서입니다. 명령은 모두 **WSL(우분투) 터미널**에 입력합니다.
빠르게 끝내고 싶다면 [README 의 빠른 시작](../README.md#빠른-시작) 두 줄이면 됩니다. 이 문서는 각 단계에서 무엇을 확인하는지 설명합니다.

---

## 처음부터 끝까지 — 빈 Windows PC 에서 5단계 (Claude Code 에게 설치 맡기기)

아무것도 없는 PC 라면 이 순서가 가장 짧습니다. 사람이 직접 하는 건 **1·2번과 로그인 한 번**뿐이고, 나머지는 Claude Code 가 합니다.

| 단계 | 어디서 | 할 일 |
|---|---|---|
| 1 | **Windows PowerShell(관리자)** | `wsl --install` → 재부팅 → 우분투 첫 실행에서 사용자 이름·비밀번호 만들기 |
| 2 | **우분투 터미널** | Claude Code 설치: `curl -fsSL https://claude.ai/install.sh \| bash` (Node 없이도 됨) → `claude` 실행해 **로그인** |
| 3 | 우분투 터미널 | `cd ~ && git clone https://github.com/GojoSuperman/claude-wsl-launcher.git && cd claude-wsl-launcher && claude` |
| 4 | **Claude Code 안에서** | **"설치해줘"** — README 를 읽고 `bash scripts/setup.sh` 를 돌립니다. 키보드 입력이 없는 환경이라 자동으로 전부 '예'. Node/nvm 이 없어도 설치하고, 프로젝트 폴더를 찾아 고르고, 바탕화면 단축키까지 만듭니다 |
| 5 | 바탕화면 | 단축키 더블클릭 |

- 3번의 clone 도 Claude Code 에게 시켜도 됩니다: `cd ~ && claude` 로 홈에서 띄운 뒤 "이 주소를 클론하고 설치해줘". 런처는 `~/projects` 같은 **프로젝트 폴더 안이 아니라 홈**에 두세요.
- 아래 0~7번은 같은 과정을 한 단계씩 확인하며 손으로 할 때의 설명입니다.

---

## 0. 이 도구가 뭔가요? / 준비물

`~/projects` 폴더 안의 프로젝트들을 웹 화면(대시보드)에서 보고, 버튼 한 번으로 그 폴더에서 **Claude Code** 를 새 터미널 창에 띄워주는 개인용 로컬 도구입니다.

| 필요한 것 | 이유 | 없으면 |
|---|---|---|
| **Windows 10/11 + WSL2** | `wsl.exe`·`powershell.exe` 로 창을 띄움 → **맥·일반 리눅스에선 안 됨** | 1번에서 설치 |
| WSL 안에 **Node.js 20 이상** | 서버 실행 | `setup.sh` 가 nvm 으로 설치 제안 |
| WSL 안에 **Claude Code CLI** (`claude`) | 이 도구가 실행해 주는 대상 | `setup.sh` 가 설치 제안 |
| (선택) **GitHub CLI** (`gh`) 로그인 | 카드에 GitHub **공개/비공개** 배지 표시, "프로젝트 이름 변경" 이 GitHub 저장소 이름까지 변경 | 없어도 동작 (배지는 `?`, 이름은 로컬만 변경) |

---

## 1. WSL2 가 있는지 확인 (없으면 설치)

**Windows PowerShell**(WSL 아님)을 열고:

```powershell
wsl --version
```

- 버전 정보가 나오면 → WSL2 있음. 다음 단계로.
- 오류가 나면 → 관리자 PowerShell 에서 `wsl --install` 후 **PC 재부팅**, 우분투 초기 설정(사용자 이름·비밀번호)을 마칩니다.

> 💡 **"WSL(우분투) 터미널"이란?** 시작 메뉴에서 **"Ubuntu"** 를 검색해 클릭하면 뜨는 검은 창입니다. 프롬프트가 `이름@컴퓨터:~$` 모양이면 제대로 들어온 거예요. PowerShell(`PS C:\>`)·명령 프롬프트와는 다른 창입니다. PowerShell 에서 `wsl` 을 쳐도 같은 우분투로 들어가지만, 그때는 `/mnt/c/...`(Windows 폴더)에서 시작될 수 있으니 `cd ~` 로 리눅스 홈으로 이동하세요.

이제부터는 **WSL(우분투) 터미널**에서 진행합니다.

---

## 2. 도구 받기

> ⚠️ **반드시 WSL 터미널 안에서 클론하세요.** PowerShell·탐색기에서 클론하면 `.sh` 파일이 Windows 줄바꿈(CRLF)으로 저장돼 스크립트가 `set: pipefail: invalid option name` 으로 실패합니다. (`setup.sh` 가 이것도 점검·수정해 줍니다.)

```bash
cd ~                 # 도구는 스캔 폴더 밖에 (홈 등 — ~/projects 안에 두지 않기)
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
```

---

## 3. `setup.sh` 한 번

```bash
bash scripts/setup.sh
```

무엇을 하는지:

| 순서 | 점검 | 문제가 있으면 |
|---|---|---|
| 1 | WSL 안인지, `powershell.exe`·`wsl.exe` 접근 가능한지 | 원인과 조치 안내 |
| 2 | Node.js 20 이상 | "nvm 으로 설치할까요? [Y/N]" |
| 3 | `claude` 가 **리눅스 쪽(nvm)** 에 있는지 — 단축키가 실제로 찾는 방식 그대로 | "설치할까요? [Y/N]" (`npm install -g @anthropic-ai/claude-code`) |
| 4 | (선택) `gh` 로그인 여부 | 안내만 |
| 5 | `scripts/*.sh` 줄바꿈이 LF 인지 | "고칠까요? [Y/N]" |
| 6 | 의존성(`node_modules`) | 없으면 `npm install` |
| 6.5 | **프로젝트 폴더**: 홈 아래에서 git 저장소를 여러 개 품은 폴더를 찾아 번호로 보여줌 | 고른 폴더를 `~/.config/project-launcher/config.json` 에 저장. 후보가 없으면 `~/projects` 생성 |
| 7 | 바탕화면 단축키 | "만들까요? [Y/N]" |

- 모든 질문은 그냥 Enter 를 치면 "아니요" 입니다. 건너뛴 것은 나중에 다시 `bash scripts/setup.sh` 로 이어서 할 수 있습니다.
- 이미 쓰던 프로젝트 폴더(`~/dev`, `~/work` 등)가 있으면 후보 목록에 저장소 수와 함께 뜹니다. 번호만 고르면 됩니다. 나중에 대시보드 상단 **[변경]** 으로 바꿀 수 있습니다.
- 질문 없이 끝내려면(AI 에이전트·스크립트): `bash scripts/setup.sh --yes` — 전부 '예', 폴더는 저장소가 가장 많은 후보 자동 선택. 키보드 입력이 없는 환경이면 `--yes` 를 안 붙여도 자동으로 이 모드가 됩니다.
- 폴더를 직접 지정하려면: `PROJECTS_ROOT=~/dev bash scripts/setup.sh`.
- 단축키 이름을 바꾸려면: `SHORTCUT_NAME='내 런처' bash scripts/setup.sh` (기본 `Claude WSL Launcher`).
- 마지막에 `✅ 설치 완료` 와 접속 주소가 보이면 끝입니다.

> 이 도구는 **도구를 둔 위치와 별개로** 고른 프로젝트 폴더를 스캔합니다. 그 아래 폴더 하나하나가 카드가 됩니다. 우선순위는 `PROJECTS_ROOT` 환경변수 > 설정 파일 > `~/projects`.

---

## 4. 실행

**바탕화면 단축키를 더블클릭**하면:

- 서버를 **백그라운드**로 띄우고 **브라우저만** 엽니다(별도 터미널 창 없음). Chrome 이 설치돼 있으면 **주소창 없는 앱 창**으로, 없으면 기본 브라우저 탭으로 열립니다.
- 서버 기동에 **실패할 때만** 터미널 창이 떠서 로그를 보여줍니다.
- 이미 떠 있으면 재기동 없이 브라우저만 엽니다.

터미널에서 직접 띄우려면:

```bash
npm start       # 마지막에 "프로젝트 런처: http://127.0.0.1:41730" 이 보이면 성공
```

- 포트가 사용 중이면 41731~41739 로 자동 폴백되니 로그에 찍힌 실제 주소를 엽니다. 지정: `PORT=5000 npm start`
- 프로젝트 폴더 바꾸기: 대시보드 상단 **스캔 폴더 [변경]** (설정 파일에 저장, 재시작 불필요). 카드가 하나도 없을 때는 배너에서도 바꿀 수 있습니다. 한 번만 다른 폴더로 띄우려면 `PROJECTS_ROOT=~/dev npm start` (이때는 [변경] 이 잠깁니다).
- **끄기**: 대시보드 창을 닫으면 약 10초 뒤 서버가 **자동 종료**됩니다. 바로 끄려면 헤더의 **[서버 종료]** 버튼 또는 터미널에서 `Ctrl+C`. (자동 종료를 끄려면 `AUTO_SHUTDOWN=0 npm start`)

---

## 5. 사용법

| 버튼 | 동작 |
|---|---|
| **[claude 실행]** | 그 폴더에서 **새 WSL 창**에 claude. 대화 이력이 있으면 이어서(`--continue`), 없으면 새 세션 |
| **[원격 확인]** → **[받기]** | `git fetch` 후 뒤처졌으면 `git pull --ff-only` (업스트림 있는 카드에만 표시) |
| **[+ 새 프로젝트]** | `~/projects/<이름>` 폴더 + `git init` |
| **[✏️ 프로젝트 이름 변경]** | 폴더 이름 변경 + claude 대화 이력 폴더도 함께 이동. origin 이 GitHub 면 `gh repo rename` 으로 저장소 이름·remote URL 까지 갱신(gh 로그인 필요, 실패하면 로컬만 바뀌고 경고). 실행 중인 프로젝트·이 도구 자신의 폴더는 버튼 비활성 |
| 카드의 **GitHub 줄** | origin 저장소(`owner/repo`)와 **공개/비공개** 배지. gh 로그인이 없으면 `?`. 배지를 클릭하면 확인 후 공개↔비공개 전환(저장소 관리자 권한 필요) |
| **자동 · ☀️ · 🌙** | 라이트/다크 테마. 자동 = Windows 설정 따름 (선택 기억됨) |
| **[❓ 도움말]** / `?` 키 | 사용법 모달 |
| 하단 **서버 콘솔** | 이 서버의 로그(읽기 전용). ▾ 로 접기/펼치기 |

- **이름 규칙**: 새 프로젝트·이름 변경 모두 **영문·숫자·`-`·`_`·`.` 만** 가능합니다(GitHub 저장소 규칙, 한글 불가). 입력하면 안내가 뜨고 진행하지 않습니다.
- 이름 변경 전에 "다른 claude 창에서 이 폴더를 수정 중이 아닌지" 확인창이 한 번 뜹니다. 다른 폴더에서 띄운 claude 가 이 폴더를 고치는 경우는 자동 감지되지 않습니다.
- 다른 PC 에서도 쓰려면 그 PC 에서 2·3번을 한 번 더 하세요. 코드는 git 으로 받지만 Node·claude 설치와 단축키는 PC 마다 필요합니다.

---

## 6. 문제 해결

먼저 이걸 돌리세요. 대부분은 여기서 원인과 명령이 나옵니다:

```bash
bash scripts/doctor.sh        # 진단만
bash scripts/doctor.sh --fix  # 물어보고 자동 수정
```

doctor 가 잡지 못하는 것:

| 증상 | 해결 |
|---|---|
| 브라우저 "연결할 수 없음" | 서버가 안 떴거나 자동 종료됨. 단축키 다시 더블클릭, 또는 `npm start`. |
| `claude 실행` 을 눌러도 창이 안 뜨거나 "spawn powershell.exe ENOENT" | PATH 문제. WSL 터미널에서 `npm start` 로(로그인 셸) 서버를 띄워 보세요. |
| 포트 사용 중(EADDRINUSE) | 이미 서버가 떠 있음. [서버 종료] 하거나 `PORT=5000 npm start`. |
| 단축키가 옛 동작을 함 / 안 됨 | `bash scripts/install-shortcut.sh` 로 재생성. |
| 이름 변경 후 "GitHub 이름 변경 실패" 경고 | 로컬은 바뀐 상태. `gh auth login` 후 다시 시도하거나 GitHub 웹에서 이름을 바꾸고 `git remote set-url origin <새 URL>`. |

---

## 7. 보안 한 줄

이 서버는 **내 PC(localhost) 전용**이고 인증이 없습니다. **외부에 노출하지 마세요**(포트 포워딩·`0.0.0.0` 바인딩 금지). 개인 로컬 도구로만 쓰세요.

---

## 부록. 수동으로 설치하고 싶다면

`setup.sh` 없이 직접 할 때의 명령입니다.

**내 WSL 환경 확인**

```bash
echo "배포판: $WSL_DISTRO_NAME"   # 예: Ubuntu-24.04
echo "사용자: $(whoami)"           # 예: alice
echo "홈: $HOME"                   # 예: /home/alice
```

(이 값들은 자동 감지되므로 어디에도 입력하지 않습니다.)

**Node.js**

```bash
node -v    # v20.x 이상이면 OK. 없거나 낮으면:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 터미널을 닫았다 다시 열고:
nvm install --lts
```

**Claude Code CLI**

```bash
claude --version   # 없으면 (둘 중 하나):
curl -fsSL https://claude.ai/install.sh | bash   # 공식 설치기 — Node 없이도 됨 (권장)
npm install -g @anthropic-ai/claude-code          # 또는 npm (Node 필요)
# 설치 후 claude 로 한 번 로그인. 최신 설치 방법은 Claude Code 공식 문서 우선.
```

**의존성 · 실행 · 단축키**

```bash
npm install
npm start                               # 또는
bash scripts/install-shortcut.sh        # 바탕화면 단축키 (PROJECTS_ROOT=~/dev 로 스캔 폴더 지정 가능)
```

**줄바꿈이 깨졌을 때** (`set: pipefail: invalid option name`): WSL 안에서 `sed -i 's/\r$//' scripts/*.sh` 또는 WSL 터미널에서 다시 클론.
