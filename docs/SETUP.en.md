# Setup Guide (Complete Beginner's Edition)

[한국어](SETUP.ko.md) · **English** · [日本語](SETUP.ja.md)

Even if this is your first time, this guide walks you through everything step by step — **checking your system → installing what's needed → running the app**.
All commands are entered in a **WSL (Ubuntu, etc.) terminal**.

---

## 0. What is this tool? / Is it right for me?

This is a personal local tool that displays the projects inside your `~/projects` folder as a web dashboard, and lets you launch **Claude Code** in a new terminal window from any project folder with a single button click.

**Required environment (you need all three):**

| Required | Why |
|---|---|
| **Windows 10/11 + WSL2** | Opens windows via `wsl.exe` and `powershell.exe` → **does not work on Mac or native Linux** |
| **Node.js 20 or higher** inside WSL | To run the server |
| **Claude Code CLI** (`claude`) inside WSL | This is what the tool launches |

> Mac / native Linux users cannot use this tool (it depends on Windows-only commands).

---

## 1. Check if WSL2 is installed (install it if not)

Open **Windows PowerShell** (not WSL) and run:

```powershell
wsl --version
```

- If version information appears → WSL2 is installed. Proceed to the next step.
- If you get an error or it's not installed → in an **Administrator** PowerShell, run:
  ```powershell
  wsl --install
  ```
  After installation, **restart your PC** and complete the initial Ubuntu setup (username and password).

From this point on, open a **WSL (Ubuntu) terminal**. (Search for "Ubuntu" in the Start menu.)

---

## 2. Understand your WSL environment

In a WSL terminal, run the following to check your values (you won't need to configure these manually, but it's good to know your environment):

```bash
echo "Distro: $WSL_DISTRO_NAME"   # e.g. Ubuntu-24.04
echo "User:   $(whoami)"           # e.g. alice
echo "Home:   $HOME"               # e.g. /home/alice
```

> This tool **detects the above values automatically**, so you don't need to enter them yourself. (That's why it works on any PC without extra configuration.)

---

## 3. Check / Install Node.js

```bash
node -v    # v20.x or higher is fine
```

- If you get `command not found` or the version is below 20, install via **nvm** (recommended):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # Close the terminal, reopen it, then:
  nvm install --lts
  node -v
  ```

---

## 4. Check / Install the Claude Code CLI

```bash
claude --version   # If a version is shown, you're good
```

- If not installed, follow the **official Claude Code installation instructions** (the most common method):
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
  After installation, complete the login/setup by running `claude` once, then verify with `claude --version`.
  > Always check the official Claude Code documentation for the most up-to-date installation method.

---

## 5. Clone this tool

> ⚠️ **Clone from inside a WSL (Ubuntu) terminal.** If you clone from Windows PowerShell or Explorer, git saves the `.sh` files with Windows line endings (CRLF), and the shortcut installer (step 7) later fails with `set: pipefail: invalid option name`.

```bash
cd ~                 # keep the tool outside the scanned folder (home — not inside ~/projects)
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
mkdir -p ~/projects  # the default folder to scan (only if it doesn't exist)
```

> `~/projects` is the default folder this tool scans (**separate from where the tool itself lives**). Any project folders you place there appear as cards. To scan a different folder, see `PROJECTS_ROOT` in step 6.

---

> 💡 **Setup check (recommended):** After cloning, run `bash scripts/doctor.sh` to automatically check WSL/Node/claude/line-endings/dependencies and print the exact command to fix anything that's off. It verifies **whether claude is installed in this PC's WSL (nvm)** the same way the shortcut launcher resolves it — handy to run first **when you've pulled the repo on another PC**. To have it **fix things automatically**, run `bash scripts/doctor.sh --fix` — it asks "Install? [Y/N]" per missing item and only fixes what you approve.

## 6. Install dependencies and run

```bash
npm install     # Install dependencies (first time only)
npm start       # Start the server
```

When you see `프로젝트 런처: http://127.0.0.1:41730` at the end, it's working. (If the port is busy it auto-falls back to 41731+, so open the actual address shown in the log.)
Open **http://127.0.0.1:41730** in your browser.

- To change the port: `PORT=5000 npm start`
- **To scan a different folder** (use your existing work folder instead of `~/projects`): `PROJECTS_ROOT=~/dev npm start`
  - Accepts an absolute path (`/home/me/work`), `~/sub`, or a home-relative path (`repos`).
- To stop: click the **[서버 종료]** (Shut down server) button in the page header, or press `Ctrl+C` in the terminal.

---

## 7. (Optional) Create a desktop shortcut

If you'd rather double-click to launch instead of opening a terminal every time:

```bash
bash scripts/install-shortcut.sh
```

To make it scan a **folder other than `~/projects`**, pass that folder when creating the shortcut (the value gets baked into the shortcut):

```bash
PROJECTS_ROOT=~/dev bash scripts/install-shortcut.sh   # double-click scans ~/dev
```

A shortcut appears on your desktop. When you double-click it:
- The server starts **in the background** and **only the browser opens** (no separate terminal window).
- A terminal window appears **only if the server fails to start**, showing the logs so you can diagnose the problem.
- It starts with the folder you specified (or `~/projects` if none).
- If you set up this tool on another PC, run this command **once on that PC too** to create the shortcut there.

> The shortcut is named **`Claude WSL Launcher`** by default. To use a different name (so it won't overwrite an existing same-named shortcut): `SHORTCUT_NAME='My Launcher' bash scripts/install-shortcut.sh`

---

## 8. Usage Summary

- **[claude 실행]** (Run claude) on a card → opens `claude` in a **new WSL window** from that folder. Continues from previous conversation history (`--continue`) if it exists, or starts a new session.
- **Bottom server console** → shows this server's logs (read-only). Confirms the server is running. Use ▾ to collapse/expand.
- **[서버 종료]** (Shut down server) → stops the local server. (This button is the main way to stop the server when it was started via the desktop shortcut in the background.)
- **[원격 확인]** (Check remote) / Pull → runs `git fetch`; if the branch is behind, runs `git pull --ff-only`.
- **[+ 새 프로젝트]** (New project) → creates a `~/projects/<name>` folder and runs `git init`.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Browser shows "Unable to connect" | The server isn't running or has stopped. Run `npm start` again in a terminal, or double-click the shortcut again. |
| Clicking "Run claude" opens no window, or shows "spawn powershell.exe ENOENT" | Almost always a PATH issue. The tool has an automatic fallback, but if that doesn't work, try starting the server from a WSL terminal with `npm start` (login shell). |
| `claude: command not found` in the new window | Claude is not installed in WSL. The launcher (`scripts/launch-claude.sh`) sources nvm directly to find claude, so install it in your **default nvm Node** (Step 4): `npm install -g @anthropic-ai/claude-code`. The code syncs via git, but the claude install is PC-local, so it's needed **once per PC**. |
| Port already in use (EADDRINUSE) | The server is already running. Shut down the existing instance with **[서버 종료]** (Shut down server), or use `PORT=5000 npm start`. |
| Shortcut does the old behavior or doesn't work | Re-run `bash scripts/install-shortcut.sh` to regenerate the shortcut. |
| `set: pipefail: invalid option name` / `invalid option name` (text looks garbled/overlapping) | The `.sh` files have Windows line endings (CRLF). Fix it **inside WSL** with `sed -i 's/\r$//' scripts/*.sh`, or re-clone from a WSL terminal (step 5). |

---

## 10. Security in One Line

This server is **for your PC (localhost) only** and has no authentication. **Do not expose it externally** (no port forwarding, no `0.0.0.0` binding). Use it as a personal local tool only.
