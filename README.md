# Clui CC — Windows Edition

A lightweight, transparent desktop overlay for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on Windows. Clui CC wraps the Claude Code CLI in a floating pill interface with multi-tab sessions, a permission approval UI, voice input, and a skills marketplace.

> **This is a Windows port** of the original [lcoutodemos/clui-cc](https://github.com/lcoutodemos/clui-cc) macOS project. The core architecture and features are identical — only platform-specific plumbing has been adapted.

## Demo

[![Watch the demo](https://img.youtube.com/vi/NqRBIpaA4Fk/maxresdefault.jpg)](https://www.youtube.com/watch?v=NqRBIpaA4Fk)

<p align="center"><a href="https://www.youtube.com/watch?v=NqRBIpaA4Fk">▶ Watch the full demo on YouTube</a></p>

## Features

- **Floating overlay** — transparent, click-through window that stays on top. Toggle with `Alt+Space`.
- **Multi-tab sessions** — each tab spawns its own `claude -p` process with independent session state.
- **Permission approval UI** — intercepts tool calls via PreToolUse HTTP hooks so you can review and approve/deny from the UI.
- **Conversation history** — browse and resume past Claude Code sessions.
- **Skills marketplace** — install plugins from Anthropic's GitHub repos without leaving Clui CC.
- **Voice input** — local speech-to-text via Whisper (no cloud transcription).
- **File & screenshot attachments** — paste images or attach files directly.
- **Dual theme** — dark/light mode with system-follow option.

## Quick Start (Recommended)

Run these commands one at a time in **Command Prompt** or **PowerShell**:

**1) Clone the repo**

```bat
git clone https://github.com/lcoutodemos/clui-cc.git clui-cc-win
```

**2) Enter the project folder**

```bat
cd clui-cc-win
```

**3) Start the app**

```bat
start.bat
```

`start.bat` runs environment checks first and prints fix instructions if something is missing. If all checks pass it installs dependencies, builds, and launches the app.

To close the app:

```bat
stop.bat
```

Toggle the overlay: **Alt+Space** (or **Ctrl+Shift+K** as fallback).

<details>
<summary><strong>Setup Prerequisites (Detailed)</strong></summary>

You need **Windows 10 version 1803 or newer** (required for the built-in `tar` command used during skill installation). Then install the following:

---

**Step 1.** Install [Node.js](https://nodejs.org) — minimum v18, recommended v20 or v22 LTS.

Verify it's on your PATH:

```bat
node --version
npm --version
```

---

**Step 2.** Install Visual C++ Build Tools (required to compile `node-pty` and other native modules).

Download and run the **Build Tools for Visual Studio** installer from [visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). Select **"Desktop development with C++"**.

Alternatively, from an elevated (Administrator) PowerShell:

```powershell
npm install -g windows-build-tools
```

---

**Step 3.** Install [Python 3](https://www.python.org/downloads/) (needed by the native module build system). During installation, check **"Add Python to PATH"**.

---

**Step 4.** Install Claude Code CLI:

```bat
npm install -g @anthropic-ai/claude-code
```

---

**Step 5.** Authenticate Claude Code (follow the prompts that appear):

```bat
claude
```

---

**Step 6.** Verify Claude Code is working (should print `2.1.x` or higher):

```bat
claude --version
```

---

**Optional:** Install Whisper for voice input.

Clui CC looks for `whisper-cli.exe` or `whisper.exe` on your PATH, or in common locations such as:
- `%USERPROFILE%\AppData\Local\Programs\whisper\`
- `%USERPROFILE%\scoop\shims\`

Download prebuilt binaries from [github.com/ggerganov/whisper.cpp](https://github.com/ggerganov/whisper.cpp/releases).

Then download a model file:

```powershell
mkdir "$env:USERPROFILE\.local\share\whisper"
curl -L -o "$env:USERPROFILE\.local\share\whisper\ggml-tiny.bin" `
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
```

> **No API keys or `.env` file required.** Clui CC uses your existing Claude Code CLI authentication (Pro/Team/Enterprise subscription).

</details>

<details>
<summary><strong>Development Commands</strong></summary>

### Hot Reload

If you are actively developing:

```bat
npm install
npm run dev
```

Renderer changes update instantly. Main-process changes require restarting `npm run dev`.

### Production Build

```bat
npm run build
npx electron .
```

### Environment Diagnostics

```bat
npm run doctor
```

Or run directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1
```

</details>

<details>
<summary><strong>Architecture and Internals</strong></summary>

Clui CC is an Electron app with three layers:

```
┌─────────────────────────────────────────────────┐
│  Renderer (React 19 + Zustand + Tailwind CSS 4) │
│  Components, theme, state management             │
├─────────────────────────────────────────────────┤
│  Preload (window.clui bridge)                    │
│  Secure IPC surface between renderer and main    │
├─────────────────────────────────────────────────┤
│  Main Process                                    │
│  ControlPlane → RunManager → claude -p (NDJSON)  │
│  PermissionServer (HTTP hooks on 127.0.0.1)      │
│  Marketplace catalog (GitHub raw fetch + cache)  │
└─────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full deep-dive.

### Project Structure

```
src/
├── main/                    # Electron main process
│   ├── claude/              # ControlPlane, RunManager, EventNormalizer
│   ├── hooks/               # PermissionServer (PreToolUse HTTP hooks)
│   ├── marketplace/         # Plugin catalog fetching + install
│   ├── skills/              # Skill auto-installer
│   ├── platform-utils.ts    # Cross-platform helpers (NEW — Windows port)
│   └── index.ts             # Window creation, IPC handlers, tray
├── renderer/                # React frontend
│   ├── components/          # TabStrip, ConversationView, InputBar, etc.
│   ├── stores/              # Zustand session store
│   ├── hooks/               # Event listeners, health reconciliation
│   └── theme.ts             # Dual palette + CSS custom properties
├── preload/                 # Secure IPC bridge (window.clui API)
└── shared/                  # Canonical types, IPC channel definitions
```

### How It Works

1. Each tab creates a `claude -p --output-format stream-json` subprocess.
2. NDJSON events are parsed by `RunManager` and normalized by `EventNormalizer`.
3. `ControlPlane` manages tab lifecycle (connecting → idle → running → completed/failed/dead).
4. Tool permission requests arrive via HTTP hooks to `PermissionServer` (localhost only).
5. The renderer polls backend health every 1.5s and reconciles tab state.
6. Sessions are resumed with `--resume <session-id>` for continuity.

### Windows-Specific Changes

This port introduces `src/main/platform-utils.ts` which centralises all platform-specific logic:

| Area | macOS original | Windows replacement |
|------|---------------|---------------------|
| Claude binary discovery | `/opt/homebrew/bin/claude`, zsh `whence` | `%APPDATA%\npm\claude.cmd`, `where claude` |
| Login shell PATH | `/bin/zsh -lc "echo $PATH"` | `process.env.PATH` (already correct) |
| Process termination | `SIGINT` → `SIGTERM` | `taskkill /PID … /T` |
| Screenshot | `/usr/sbin/screencapture -i` | PowerShell + Snipping Tool |
| Open in terminal | AppleScript → Terminal.app | `wt.exe` (Windows Terminal), fallback `cmd.exe` |
| Skill download | `curl \| tar` (piped) | PowerShell `Invoke-WebRequest` + `tar` |
| Whisper discovery | Homebrew paths | `%APPDATA%`, `%LOCALAPPDATA%`, Scoop shims |
| Session path encoding | `/` → `-` | `\` and `/` → `-`, strip drive colon |
| App icon | `icon.icns` | `icon.ico` |
| Tray icon | `trayTemplate.png` (macOS template) | `tray.ico` |

### Network Behavior

Clui CC operates almost entirely offline. The only outbound network calls are:

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `raw.githubusercontent.com/anthropics/*` | Marketplace catalog (cached 5 min) | No — graceful fallback |
| `api.github.com/repos/anthropics/*/tarball/*` | Skill auto-install on startup | No — skipped on failure |

No telemetry, analytics, or auto-update mechanisms. All core Claude Code interaction goes through the local CLI.

</details>

## Troubleshooting

Run the built-in diagnostics first:

```bat
npm run doctor
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1
```

For general setup issues, see [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

**Common Windows issues:**

| Symptom | Fix |
|---------|-----|
| `npm install` fails with node-gyp errors | Install Visual C++ Build Tools and Python 3 |
| `claude` not found on launch | Ensure `%APPDATA%\npm` is in your `PATH` |
| Overlay doesn't appear | Try `Ctrl+Shift+K`; check the system tray |
| Screenshot returns null | Run as a normal user (not Administrator); Snipping Tool must be available |
| Voice input not working | Place `whisper-cli.exe` on `PATH` and download a model file |
| `taskkill` errors on stop | The app wasn't running; this is harmless |

## Tested On

| Component | Version |
|-----------|---------|
| Windows | 10 (22H2), 11 |
| Node.js | 20.x LTS, 22.x |
| Python | 3.12 |
| Visual Studio Build Tools | 2022 |
| Electron | 33.x |
| Claude Code CLI | 2.1.71 |

## Known Limitations

- **Requires Claude Code CLI** — Clui CC is a UI layer, not a standalone AI client. You need an authenticated `claude` CLI install.
- **Screenshot tool** — uses PowerShell + Snipping Tool; interactive region selection (like macOS `-i`) is not yet supported. The full screen is captured automatically.
- **Voice input** — Whisper must be manually installed on Windows (no package manager equivalent of `brew install whisper-cli`).
- **PTY transport** — the optional interactive PTY permission mode (`CLUI_INTERACTIVE_PERMISSIONS_PTY=1`) uses `node-pty` which requires Visual C++ Build Tools and compiles a native module at install time.

## License

[MIT](LICENSE)
