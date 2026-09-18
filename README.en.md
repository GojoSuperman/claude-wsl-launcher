# Claude WSL Launcher

[한국어](README.md) · **English** · [日本語](README.ja.md)

A small local dashboard that lists the projects under `~/projects` as cards and opens **Claude Code (`claude`) in a new WSL window** for that folder with one click. Windows + WSL2 only.

![Dashboard](docs/images/dashboard-en.png)

## Quick Start

> ⚠️ Run every command below **inside a WSL (Ubuntu) terminal**, not PowerShell or Command Prompt. (Search "Ubuntu" in the Start menu.)

```bash
cd ~ && git clone https://github.com/GojoSuperman/claude-wsl-launcher.git && cd claude-wsl-launcher
bash scripts/setup.sh
```

`setup.sh` checks Node, claude and the dependencies, offers to install whatever is missing, **finds the folders under your home that hold git repositories and lets you pick your projects folder**, then creates a desktop shortcut. When it finishes, **double-click the shortcut** (it opens an app-style window if Chrome is installed, otherwise your default browser; or run `npm start` and open http://127.0.0.1:41730).

- You can change the projects folder any time with **[Change]** at the top of the dashboard (saved to `~/.config/project-launcher/config.json`). To set it explicitly: `PROJECTS_ROOT=~/dev bash scripts/setup.sh`.
- **Letting an AI agent such as Claude Code install it**: plain `bash scripts/setup.sh` is enough. When no keyboard input is available it switches to `--yes` mode automatically, answers every question with yes and picks the candidate folder with the most repositories. Keep the tool itself in your home (`~`), **not inside the projects folder**.
- Prefer to check each step yourself? → **[Setup Guide](docs/SETUP.en.md)**. Starting from a blank PC? → [Zero to launch in 5 steps](docs/SETUP.en.md#zero-to-launch--5-steps-on-a-blank-windows-pc-let-claude-code-install-it)

## Updating an existing install

**You do not need to clone again.** Your settings (`~/.config/project-launcher/`) and notes (`~/.local/state/project-launcher/`) live outside the repository and are preserved, and the desktop shortcut keeps working as is.

```bash
cd ~/claude-wsl-launcher   # wherever you installed it
git pull
npm install
```

Then **restart the dashboard.**

> ⚠️ **This is the important part.** If you `git pull` while the dashboard is running, the page (buttons, modals) updates to the new code but **the already-running server is still the old code**, so the new buttons fail with a "server error". Nothing is broken — the server is just stale.
> Click **[Shut down server]** in the header, then launch the desktop shortcut again.

**To use GitHub import and delete**, sign in to the gh CLI once (everything else works without it):

```bash
gh auth login
```

Run `bash scripts/doctor.sh` to verify your setup.

## Requirements

| Required | Why |
|---|---|
| **Windows 10/11 + WSL2** | Windows are opened via `wsl.exe` / `cmd.exe` → macOS and native Linux are not supported |
| **Node.js 20+** inside WSL | Runs the server (`setup.sh` offers to install it via nvm) |
| **Claude Code CLI** inside WSL | What this tool launches (`setup.sh` offers to install it) |

| Optional | Used for |
|---|---|
| **GitHub CLI (`gh`)**, logged in | **Import from GitHub** (your repo list), deleting repositories, the public/private badge on cards, and letting "Rename project" rename the GitHub repo too. Sign in with `gh auth login`. |

Distro name, home and desktop paths are **detected at runtime**, so there is nothing to configure per PC.

## Features

- **Card list**: git branch, dirty/clean, last commit time, a "running" badge and "has history / new session" for each folder.
- **Launch claude**: opens claude in a **new WSL window** for that folder (`--continue` when history exists). Native WSL launch, so no repeated "trust this folder?" prompts.
- **Check remote / Pull**: `git fetch`, then `git pull --ff-only` if behind.
- **New project**: creates `~/projects/<name>` and runs `git init`.
- **Import from GitHub**: `⬇ Import` in the header lists your GitHub repositories, searchable, and clones the one you pick (requires gh login). Repositories you already have are marked. You can also paste a GitHub URL directly.
- **Delete a project**: moves the local folder to the trash, and optionally **deletes the GitHub repository too** (checkbox, requires gh login). Running projects and the tool's own folder cannot be deleted.
- **Notes**: a one-line note per card so you can tell projects apart (stored in `~/.local/state/project-launcher/notes.json`).
- **Rename project**: renames the folder and moves the claude history folder along (keeps `--continue`). If origin is GitHub, runs `gh repo rename` to rename the repo and update the remote URL (needs gh login; on failure the local folder is still renamed and a warning is shown). The button is disabled for running projects and for this tool's own folder.
- **Name rule**: new and renamed projects may only use letters, digits, `-`, `_` and `.` (GitHub repo rule).
- **GitHub public/private badge and switch**: cards whose origin is GitHub show `owner/repo` and a **public/private** badge (with gh login; `?` otherwise). Click the badge to switch via `gh repo edit --visibility` after a confirmation.
- **Light/dark theme**: Auto (follows Windows) · ☀️ · 🌙 in the header (remembered).
- **Server console (bottom panel)**: this server's log, streamed live (read-only).
- **Auto shutdown**: closing the dashboard window stops the server after about 10 seconds (`AUTO_SHUTDOWN=0` disables). The **Shut down** button in the header stops it immediately.
- **Languages**: 한국어 · English · 日本語 (remembered). **In-app help**: `❓ Help` button or the `?` key.
- **Projects folder pick/change**: chosen from detected candidates at install time, changeable any time with [Change] at the top of the dashboard; when there are no cards the banner offers it too. Priority: `PROJECTS_ROOT` env var > config file > `~/projects`.
- **Self-update**: `⟳ Update` in the header checks for a new version, pulls it (`git pull --ff-only` + `npm install`) and walks you through the restart. If your local edits overlap the incoming changes, or the history has diverged, it **changes nothing** and tells you why.
- **Port fallback**: if `41730` is busy, moves to `41731`–`41739`. Set one with `PORT=5000 npm start`.

## Why this tool?

claude works properly and fast only when launched from a **native WSL path** (`~/projects/...`, ext4). Opening `\\wsl.localhost\...` in Windows Explorer and launching from there leads to traps:

- Repeated "Do you trust this folder?" prompts
- claude's Bash running as **Windows Git Bash**, clashing with Linux `node_modules` binaries
- Session logs piling up on the Windows side (`C:\...`)
- Cross-boundary file I/O (`npm install`, `git status`, …) that is **5–10× slower**

This tool avoids all of that by always launching in the **correct native WSL window** with one click, instead of typing `cd … && claude` every time.

## How it works

- A browser alone cannot start a process on your PC, so a **small local server (Express) running inside WSL** does it.
- The server scans `~/projects`, reads git status, and calls `cmd.exe /c start` with `wsl.exe` to open claude in a **new WSL window**.
- The server tees its own `stdout/stderr` into the `/ws/console` WebSocket for the bottom panel. When every such connection is gone it shuts itself down after a grace period.

## Security

- **Binds to `127.0.0.1` (localhost) only — never expose it.** There is no authentication and it executes commands; exposing it would allow arbitrary command execution.
- The client sends only the project **name**; the server rebuilds and validates the real path inside `~/projects` (rejects `/`, `..`, newlines and NUL).
- It is a **personal local utility**, not meant for multi-user or remote use.

## If something breaks

```bash
bash scripts/doctor.sh        # diagnose only
bash scripts/doctor.sh --fix  # ask, then fix automatically
```

It checks WSL, Node, claude, line endings (CRLF) and dependencies, and prints the exact command to fix each problem. See the [troubleshooting table in the setup guide](docs/SETUP.en.md#6-troubleshooting) for the rest.

## Tests

```bash
npm test
```

## License

[MIT](LICENSE)
