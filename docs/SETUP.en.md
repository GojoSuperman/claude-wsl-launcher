# Setup Guide (for first-timers)

[한국어](SETUP.ko.md) · **English** · [日本語](SETUP.ja.md)

The order is **check WSL2 → get the tool → run `setup.sh` once → launch**. Type every command into a **WSL (Ubuntu) terminal**.
In a hurry? The two lines in the [README Quick Start](../README.en.md#quick-start) are enough. This guide explains what each step checks.

---

## 0. What is this tool? / What you need

A personal local tool that shows the projects inside `~/projects` on a web page (dashboard) and opens **Claude Code** in a new terminal window for that folder with one button.

| Needed | Why | If missing |
|---|---|---|
| **Windows 10/11 + WSL2** | Windows are opened via `wsl.exe` / `powershell.exe` → **no macOS / plain Linux** | Install in step 1 |
| **Node.js 20+** inside WSL | Runs the server | `setup.sh` offers to install via nvm |
| **Claude Code CLI** (`claude`) inside WSL | What this tool launches | `setup.sh` offers to install |
| (optional) **GitHub CLI** (`gh`), logged in | Public/private badge on cards, and "Rename project" renaming the GitHub repo too | Works without it (badge shows `?`, rename is local only) |

---

## 1. Check that WSL2 is installed (install it if not)

Open **Windows PowerShell** (not WSL):

```powershell
wsl --version
```

- Version info → WSL2 is there. Go to the next step.
- Error → in an admin PowerShell run `wsl --install`, **reboot**, then finish Ubuntu's first-run setup (username/password).

> 💡 **What is a "WSL (Ubuntu) terminal"?** The black window that opens when you search **"Ubuntu"** in the Start menu. If the prompt looks like `name@computer:~$`, you are in the right place. PowerShell (`PS C:\>`) and Command Prompt are different windows. Typing `wsl` in PowerShell also gets you into the same Ubuntu, but it may start in `/mnt/c/...` (a Windows folder) — run `cd ~` to go to your Linux home.

From here on, everything happens in the **WSL (Ubuntu) terminal**.

---

## 2. Get the tool

> ⚠️ **Clone inside the WSL terminal.** Cloning from PowerShell or Explorer saves `.sh` files with Windows line endings (CRLF), and the scripts fail with `set: pipefail: invalid option name`. (`setup.sh` checks and fixes this too.)

```bash
cd ~                 # keep the tool outside the scanned folder (e.g. home — not inside ~/projects)
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
```

---

## 3. Run `setup.sh` once

```bash
bash scripts/setup.sh
```

What it does:

| # | Check | If there is a problem |
|---|---|---|
| 1 | Inside WSL? Can it reach `powershell.exe` / `wsl.exe`? | Explains the cause and the fix |
| 2 | Node.js 20+ | "Install via nvm? [Y/N]" |
| 3 | Is `claude` installed on the **Linux side (nvm)** — checked exactly the way the shortcut launcher finds it | "Install? [Y/N]" (`npm install -g @anthropic-ai/claude-code`) |
| 4 | (optional) `gh` logged in? | Hint only |
| 5 | `scripts/*.sh` use LF line endings? | "Fix? [Y/N]" |
| 6 | Dependencies (`node_modules`) | Runs `npm install` if missing |
| 6.5 | **Projects folder**: finds folders under your home that hold several git repositories and lists them by number | Saves your pick to `~/.config/project-launcher/config.json`. Creates `~/projects` if nothing is found |
| 7 | Desktop shortcut | "Create? [Y/N]" |

- Pressing Enter on any question means "No". Anything you skip can be done later by running `bash scripts/setup.sh` again.
- If you already keep projects somewhere (`~/dev`, `~/work`, …) it shows up in the candidate list with its repository count; just pick the number. You can change it later with **[Change]** at the top of the dashboard.
- To finish without questions (AI agents, scripts): `bash scripts/setup.sh --yes` answers yes to everything and picks the candidate with the most repositories. When no keyboard input is available this mode turns on by itself, even without `--yes`.
- To set the folder explicitly: `PROJECTS_ROOT=~/dev bash scripts/setup.sh`.
- To change the shortcut name: `SHORTCUT_NAME='My Launcher' bash scripts/setup.sh` (default `Claude WSL Launcher`).
- When you see `✅` and the URL at the end, you are done.

> The tool scans the chosen projects folder **regardless of where the tool itself lives**. Each subfolder becomes a card. Priority: `PROJECTS_ROOT` env var > config file > `~/projects`.

---

## 4. Launch

**Double-click the desktop shortcut**:

- Starts the server **in the background** and opens **only the browser** (no extra terminal window). With Chrome installed it opens an **app-style window without an address bar**; otherwise a normal tab in your default browser.
- A terminal window appears **only if the server fails to start**, showing the log.
- If the server is already running, it just opens the browser.

To start it from a terminal instead:

```bash
npm start       # success when you see "프로젝트 런처: http://127.0.0.1:41730" at the end
```

- If the port is busy it falls back to 41731–41739; open the address printed in the log. Pick one with `PORT=5000 npm start`.
- Change the projects folder: **Scan folder [Change]** at the top of the dashboard (saved to the config file, no restart). When there are no cards at all, the banner offers it too. For a one-off run on another folder: `PROJECTS_ROOT=~/dev npm start` ([Change] is locked then).
- **Stopping**: closing the dashboard window stops the server automatically after about 10 seconds. To stop immediately use the **[Shut down]** button in the header or `Ctrl+C` in the terminal. (Disable auto-stop with `AUTO_SHUTDOWN=0 npm start`.)

---

## 5. Usage

| Button | What it does |
|---|---|
| **[Launch claude]** | Opens claude in a **new WSL window** for that folder. Continues the conversation (`--continue`) if history exists, otherwise starts fresh |
| **[Check remote]** → **[Pull]** | `git fetch`, then `git pull --ff-only` if behind (shown only on cards with an upstream) |
| **[+ New project]** | Creates `~/projects/<name>` and runs `git init` |
| **[✏️ Rename project]** | Renames the folder and moves the claude history folder along. If origin is GitHub, runs `gh repo rename` to update the repo name and remote URL (needs gh login; on failure only the local folder changes and a warning appears). Disabled for running projects and this tool's own folder |
| **GitHub line** on a card | The origin repo (`owner/repo`) and a **public/private** badge. Shows `?` without gh login. Click the badge to switch after confirming (needs admin permission on the repo) |
| **Auto · ☀️ · 🌙** | Light/dark theme. Auto follows the Windows setting (remembered) |
| **[❓ Help]** / `?` key | Usage modal |
| Bottom **server console** | This server's log (read-only). ▾ collapses/expands |

- **Name rule**: new and renamed projects may only use **letters, digits, `-`, `_` and `.`** (GitHub repo rule). Anything else shows a notice and stops.
- Before renaming, a confirmation asks you to make sure no other claude window is editing that folder. A claude launched from a different folder that edits this one is not detected automatically.
- On another PC, repeat steps 2 and 3 there. The code comes via git, but Node, claude and the shortcut are per-PC.

---

## 6. Troubleshooting

Run this first — it finds the cause and prints the fix for most problems:

```bash
bash scripts/doctor.sh        # diagnose only
bash scripts/doctor.sh --fix  # ask, then fix automatically
```

What doctor cannot catch:

| Symptom | Fix |
|---|---|
| Browser says "cannot connect" | The server did not start or auto-stopped. Double-click the shortcut again, or run `npm start`. |
| `Launch claude` opens nothing, or "spawn powershell.exe ENOENT" | A PATH problem. Start the server from a WSL terminal with `npm start` (login shell). |
| Port already in use (EADDRINUSE) | A server is already running. Use [Shut down], or `PORT=5000 npm start`. |
| Shortcut behaves like the old version / does nothing | Recreate it: `bash scripts/install-shortcut.sh`. |
| "GitHub rename failed" warning after renaming | The local folder is already renamed. Run `gh auth login` and retry, or rename on GitHub web and run `git remote set-url origin <new URL>`. |

---

## 7. Security in one line

This server is **localhost-only** and has no authentication. **Never expose it** (no port forwarding, no `0.0.0.0` binding). Use it as a personal local tool only.

---

## Appendix. Manual installation

The commands `setup.sh` runs for you, in case you prefer to do it by hand.

**Check your WSL environment**

```bash
echo "distro: $WSL_DISTRO_NAME"   # e.g. Ubuntu-24.04
echo "user: $(whoami)"            # e.g. alice
echo "home: $HOME"                # e.g. /home/alice
```

(These are detected automatically; you never type them anywhere.)

**Node.js**

```bash
node -v    # v20.x or newer is fine. Otherwise:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen the terminal, then:
nvm install --lts
```

**Claude Code CLI**

```bash
claude --version   # if missing:
npm install -g @anthropic-ai/claude-code
# run claude once to log in. Always prefer the official Claude Code docs for the latest install method.
```

**Dependencies · run · shortcut**

```bash
npm install
npm start                               # or
bash scripts/install-shortcut.sh        # desktop shortcut (PROJECTS_ROOT=~/dev to pick the scanned folder)
```

**Broken line endings** (`set: pipefail: invalid option name`): inside WSL run `sed -i 's/\r$//' scripts/*.sh`, or clone again from a WSL terminal.
