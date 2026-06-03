# Claude WSL Launcher

[한국어](README.md) · **English** · [日本語](README.ja.md)

A small local dashboard that runs inside WSL. It displays all folders under `~/projects` as cards, and with a single click launches **Claude Code (`claude`) in a new WSL window** from that folder.
Each card shows the git status, whether Claude is currently running, and the launcher also lets you pull from a remote (GitHub) or create a new project — all from the dashboard.
At the bottom of the dashboard, **this server's own console** is shown, so you always know the server is running and can shut it down when you're done.

> New here? Follow the step-by-step setup guide → **[Setup Guide](docs/SETUP.en.md)**

## Why this tool?

`claude` works correctly **and fast only when launched from a WSL-native path** (`~/projects/...`, ext4). If you instead navigate to `\\wsl.localhost\...` (a UNC path) in Windows Explorer and launch from there, you hit several traps:

- Repeated "Do you trust this folder?" prompts
- claude's Bash runs as **Windows Git Bash**, conflicting with Linux `node_modules` binaries
- Session logs pile up on the Windows side (`C:\...`)
- Cross-boundary file I/O (`npm install`, `git status`, …) is **5–10× slower**

This tool launches every project in a **proper native WSL window with one click** — no repetitive `cd … && claude` typing, and none of those traps.

## ⚠️ Requirements

This tool **directly controls your local PC** (file scanning, opening WSL windows). It therefore only works in the following environment:

- **Windows 10/11 + WSL2** (uses `wsl.exe` and `powershell.exe` → **not supported on macOS or native Linux**)
- **Node.js 20+** installed inside WSL (nvm recommended)
- **Claude Code CLI** (`claude` command) installed inside WSL — this is what the tool launches

The distro name, home directory, username, and desktop path are **detected at runtime**, so no per-PC configuration is needed.

## Quick Start

> ⚠️ **Run every command (clone, install, shortcut) inside a WSL (Ubuntu) terminal** — not Windows PowerShell or Command Prompt. Cloning from PowerShell saves the `.sh` files with Windows line endings (CRLF), which makes the shortcut installer fail with `set: pipefail: invalid option name`.

```bash
# In a WSL terminal (keep the tool outside the scanned folder — e.g. home)
cd ~
git clone https://github.com/GojoSuperman/claude-wsl-launcher.git
cd claude-wsl-launcher
npm install
npm start
# Browser: http://127.0.0.1:41730  (scans ~/projects by default; if missing: mkdir -p ~/projects)
```

To change the port: `PORT=5000 npm start` (if the port is busy it auto-falls back 41730→41739)

To scan a different folder: `PROJECTS_ROOT=~/dev npm start` (default `~/projects`)

For detailed steps (including environment checks and installation), see the **[Setup Guide](docs/SETUP.en.md)**.

### Desktop Shortcut (optional)

```bash
bash scripts/install-shortcut.sh
```

This creates a shortcut on your Windows desktop. Double-clicking it **starts the server in the background and opens only the browser** (no separate terminal window). If the server fails to start, a log window appears only then to help you diagnose the problem.

## Features

- **Card list**: Each folder under `~/projects/*` appears as a card, showing the git branch, whether there are uncommitted changes, the last commit time, a "Running" badge, and a "Has conversation history / New session" indicator.
- **Launch claude**: Click the card button → opens `claude` in a **new WSL window** from that folder (with `--continue` if conversation history exists). Because it's a native WSL launch, you won't be asked to "trust the folder" again.
- **Server console (bottom panel)**: Shows this server's logs in real time (read-only), so you can see that the server is alive.
- **Shut down server button**: Stops the local server from the header.
- **Pull from remote**: For cards with an upstream, runs `git fetch`; if the branch is behind (`↓N`), runs `git pull --ff-only`.
- **New project**: Creates a `~/projects/<name>` folder and runs `git init`.
- **i18n**: Switch between 한국어 · English · 日本語 in the header (choice is remembered).
- **In-app help**: A `❓ Help` button (or the `?` key) opens a usage modal.
- **Custom scan folder**: `PROJECTS_ROOT` scans a folder other than the default `~/projects`.
- **Port auto-fallback**: If the default `41730` is busy, it moves to `41731+` automatically.

## How It Works

- A browser alone cannot launch PC processes, so **a small local server running inside WSL** (Express) does it instead.
- The server scans `~/projects`, queries git status, and calls `powershell.exe` to run `Start-Process wsl.exe`, which opens claude in a **new WSL window**.
- The server intercepts its own `stdout/stderr` and streams it one-way to the browser's bottom panel via a `/ws/console` WebSocket.

## Security

- **Bound to `127.0.0.1` (localhost) only — do not expose externally.** There is no authentication and the server executes commands, so exposing it externally risks arbitrary command execution.
- The client sends only the project **name** → the server reconstructs and validates the actual path inside `~/projects` (rejecting `/`, `..`, newlines, and NUL characters).
- This is a **personal local utility**. It is not intended for multi-user or remote access.

## Tests

```bash
npm test
```

## License

[MIT](LICENSE)
