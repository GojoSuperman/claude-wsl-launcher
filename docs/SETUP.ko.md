# 설치 가이드 (완전 초보자용)

**한국어** · [English](SETUP.en.md) · [日本語](SETUP.ja.md)

처음이어도 따라올 수 있게 **내 시스템 확인 → 필요한 것 설치 → 실행**까지 단계별로 안내합니다.
명령은 모두 **WSL(우분투 등) 터미널**에 입력합니다.

---

## 0. 이 도구가 뭔가요? / 나에게 맞나요?

`~/projects` 폴더 안의 프로젝트들을 웹 화면(대시보드)에서 보고, 버튼 한 번으로 그 폴더에서 **Claude Code**를 새 터미널 창에 띄워주는 개인용 로컬 도구입니다.

**필요한 환경 (셋 다 있어야 합니다):**

| 필요한 것 | 이유 |
|---|---|
| **Windows 10/11 + WSL2** | `wsl.exe`·`powershell.exe`로 창을 띄움 → **맥·일반 리눅스에선 안 됨** |
| WSL 안에 **Node.js 20 이상** | 서버 실행 |
| WSL 안에 **Claude Code CLI** (`claude`) | 이 도구가 실행해 주는 대상 |

> 맥/네이티브 리눅스 사용자는 이 도구를 쓸 수 없습니다(윈도우 전용 명령에 의존).

---

## 1. WSL2가 있는지 확인 (없으면 설치)

**Windows PowerShell**(WSL 아님)을 열고:

```powershell
wsl --version
```

- 버전 정보가 나오면 → WSL2 있음. 다음 단계로.
- 오류가 나거나 설치가 안 돼 있으면 → 관리자 PowerShell에서:
  ```powershell
  wsl --install
  ```
  설치 후 **PC를 재부팅**하고, 우분투 초기 설정(사용자 이름·비밀번호)을 마칩니다.

이제부터는 **WSL(우분투) 터미널**을 엽니다. (시작 메뉴에서 "Ubuntu" 검색)

> 💡 **"WSL(우분투) 터미널"이란?** 시작 메뉴에서 **"Ubuntu"** 를 검색해 클릭하면 뜨는 검은 창입니다(= 우분투 리눅스가 도는 터미널). 프롬프트가 `이름@컴퓨터:~$` 모양이면 제대로 들어온 거예요. PowerShell(`PS C:\>`)·명령 프롬프트와는 다른 창입니다. PowerShell에서 `wsl` 을 쳐도 같은 우분투로 들어가지만, 그때는 `/mnt/c/...`(Windows 폴더)에서 시작될 수 있으니 `cd ~` 로 리눅스 홈으로 이동하세요.

---

## 2. 내 WSL 환경 파악

WSL 터미널에서 아래를 입력해 내 값들을 확인합니다(설정에 쓰진 않지만, 어떤 환경인지 알아두면 좋습니다):

```bash
echo "배포판: $WSL_DISTRO_NAME"   # 예: Ubuntu-24.04
echo "사용자: $(whoami)"           # 예: alice
echo "홈: $HOME"                   # 예: /home/alice
```

> 이 도구는 위 값을 **자동 감지**하므로 직접 입력할 필요는 없습니다. (그래서 어느 PC에서나 그대로 동작)

---

## 3. Node.js 확인 / 설치

```bash
node -v    # v20.x 이상이면 OK
```

- `command not found` 거나 20 미만이면 **nvm**으로 설치 권장:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # 터미널을 닫았다 다시 열고:
  nvm install --lts
  node -v
  ```

---

## 4. Claude Code CLI 확인 / 설치

```bash
claude --version   # 버전이 나오면 OK
```

- 없으면 **Claude Code 공식 설치 안내**를 따라 설치합니다(가장 흔한 방법):
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
  설치 후 `claude` 로 한 번 로그인/설정을 마치고, `claude --version` 으로 확인합니다.
  > 최신 설치 방법은 항상 Claude Code 공식 문서를 우선하세요.

---

## 5. 이 도구 받기

> ⚠️ **반드시 WSL(우분투) 터미널 안에서 클론하세요.** Windows PowerShell·탐색기에서 클론하면 git 이 `.sh` 파일을 Windows 줄바꿈(CRLF)으로 저장해, 나중에 단축키 설치(7번)가 `set: pipefail: invalid option name` 으로 실패합니다.

```bash
cd ~                 # 도구는 스캔 폴더 밖에 (홈 등 — ~/projects 안에 두지 않기)
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
mkdir -p ~/projects  # 스캔할 기본 폴더 (없을 때만)
```

> 이 도구는 기본적으로 `~/projects` 를 스캔합니다(**도구를 둔 위치와는 별개**). 작업 프로젝트들을 그 아래 두면 카드로 보입니다. 다른 폴더를 쓰려면 6번의 `PROJECTS_ROOT` 참고.

---

> 💡 **셋업 점검 (권장):** 클론 후 `bash scripts/doctor.sh` 를 실행하면 WSL/Node/claude/줄바꿈/의존성을 자동 점검하고, 고쳐야 할 게 있으면 정확한 명령을 알려줍니다. 특히 **claude 가 그 PC 의 WSL(nvm)에 설치돼 있는지**를 단축키 런처와 동일한 방식으로 확인하므로, **다른 PC 에서 받았을 때** 먼저 돌려보면 좋습니다. 진단만 하지 않고 **자동으로 고치게 하려면** `bash scripts/doctor.sh --fix` — 빠진 항목마다 "설치할까요? [Y/N]" 으로 물어보고, 동의한 것만 고칩니다.

## 6. 설치하고 실행

```bash
npm install     # 의존성 설치 (처음 한 번)
npm start       # 서버 시작
```

마지막에 `프로젝트 런처: http://127.0.0.1:41730` 가 보이면 성공입니다. (포트가 사용 중이면 41731~ 로 자동 폴백되니, 로그에 찍힌 실제 주소를 엽니다.)
브라우저에서 **http://127.0.0.1:41730** 을 엽니다.

- 포트를 바꾸려면: `PORT=5000 npm start`
- **스캔 폴더를 바꾸려면**(기본 `~/projects` 가 아닌 기존 작업 폴더 사용): `PROJECTS_ROOT=~/dev npm start`
  - 절대경로(`/home/me/work`)·`~/하위`·홈 기준 상대경로(`repos`) 모두 가능.
- 멈추려면: 화면 헤더의 **[서버 종료]** 버튼, 또는 터미널에서 `Ctrl+C`.

---

## 7. (선택) 바탕화면 단축키 만들기

매번 터미널을 열지 않고 더블클릭으로 띄우려면:

```bash
bash scripts/install-shortcut.sh
```

**`~/projects`가 아닌 다른 폴더**를 보게 하려면 그 폴더를 함께 지정해 단축키를 만듭니다(그 값이 단축키에 박힙니다):

```bash
PROJECTS_ROOT=~/dev bash scripts/install-shortcut.sh   # 더블클릭하면 ~/dev 를 스캔
```

바탕화면에 단축키가 생깁니다. 더블클릭하면:
- 서버를 **백그라운드**로 띄우고 **브라우저만** 엽니다(별도 터미널 창 없음).
- 서버 기동에 **실패할 때만** 터미널 창이 떠서 로그를 보여줍니다(원인 파악용).
- 지정한 스캔 폴더(미지정 시 `~/projects`)로 자동 기동합니다.
- 다른 PC에서 받았다면 그 PC에서 이 명령을 **한 번 더** 실행해 그쪽 바탕화면에도 단축키를 만드세요.

> 단축키 이름은 기본 **`Claude WSL Launcher`** 입니다. 이름을 바꾸려면(같은 이름의 기존 단축키를 덮어쓰지 않도록): `SHORTCUT_NAME='내 런처' bash scripts/install-shortcut.sh`

---

## 8. 사용법 요약

- **카드의 [claude 실행]** → 그 폴더에서 **새 WSL 창**에 claude. 대화 이력이 있으면 이어서(`--continue`), 없으면 새 세션.
- **하단 서버 콘솔** → 이 서버의 로그(읽기 전용). "서버가 켜져 있구나"를 알려줍니다. ▾로 접기/펼치기.
- **[서버 종료]** → 로컬 서버를 끔. (단축키로 백그라운드 실행했을 땐 이 버튼이 종료 수단)
- **[원격 확인] / 받기** → `git fetch` 후 뒤처졌으면 `git pull --ff-only`.
- **[+ 새 프로젝트]** → `~/projects/<이름>` 폴더 + `git init`.

---

## 9. 문제 해결

| 증상 | 해결 |
|---|---|
| 브라우저 "연결할 수 없음" | 서버가 안 떴거나 종료됨. 터미널에서 `npm start` 재실행, 또는 단축키 다시 더블클릭. |
| `claude 실행`을 눌러도 창이 안 뜨거나 "spawn powershell.exe ENOENT" | 거의 PATH 문제. 이 도구는 자동 폴백하지만, 안 되면 WSL 터미널에서 `npm start`로(로그인 셸) 서버를 띄워 보세요. |
| 새 창에서 `claude: command not found` | WSL에 claude가 설치 안 됨. 런처(`scripts/launch-claude.sh`)는 nvm을 직접 소싱해 claude를 찾으므로 **nvm 기본 노드에 설치**해야 합니다(4번): `npm install -g @anthropic-ai/claude-code`. 코드는 git으로 동기화되지만 claude 설치는 PC 로컬이라 **PC마다 한 번씩** 필요합니다. |
| 포트 사용 중(EADDRINUSE) | 이미 서버가 떠 있음. 기존 것을 [서버 종료]하거나 `PORT=5000 npm start`. |
| 단축키가 옛 동작/안 됨 | `bash scripts/install-shortcut.sh` 다시 실행해 단축키 재생성. |
| `set: pipefail: invalid option name` / `invalid option name` (글자가 겹쳐 깨져 보임) | `.sh` 가 Windows 줄바꿈(CRLF)이라 발생. **WSL 안에서** `sed -i 's/\r$//' scripts/*.sh` 로 고치거나, WSL 터미널에서 다시 클론하세요(5번). |

---

## 10. 보안 한 줄

이 서버는 **내 PC(localhost) 전용**이고 인증이 없습니다. **외부에 노출하지 마세요**(포트 포워딩·`0.0.0.0` 바인딩 금지). 개인 로컬 도구로만 쓰세요.
