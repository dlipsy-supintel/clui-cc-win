/**
 * Cross-platform utilities for Clui CC.
 *
 * Centralizes platform-specific logic (binary discovery, PATH resolution,
 * process termination) so that index.ts, process-manager.ts, run-manager.ts,
 * and pty-run-manager.ts all share the same Windows/macOS/Linux behaviour.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, dirname, delimiter } from 'path'

const IS_WIN = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'

// ─── Claude Binary Discovery ───

/**
 * Locate the `claude` CLI binary.
 * Checks well-known install locations per platform, then falls back
 * to asking the system shell.
 */
export function findClaudeBinary(): string {
  const candidates: string[] = IS_WIN
    ? [
        join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        join(homedir(), 'AppData', 'Local', 'pnpm', 'claude.cmd'),
        join(homedir(), '.npm-global', 'bin', 'claude.cmd'),
        'C:\\Program Files\\nodejs\\claude.cmd',
      ]
    : [
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        join(homedir(), '.npm-global/bin/claude'),
      ]

  for (const c of candidates) {
    if (IS_WIN) {
      try {
        // On Windows `test -x` doesn't exist; just check file presence
        if (existsSync(c)) return c
      } catch {}
    } else {
      try {
        execSync(`test -x "${c}"`, { stdio: 'ignore' })
        return c
      } catch {}
    }
  }

  // Fallback: ask the system shell
  if (IS_WIN) {
    try {
      const result = execSync('where claude.cmd 2>nul || where claude 2>nul', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim().split(/\r?\n/)[0]
      if (result) return result
    } catch {}
  } else {
    try {
      const result = execSync('/bin/zsh -lc "whence -p claude"', { encoding: 'utf-8' }).trim()
      if (result) return result
    } catch {}
    try {
      const result = execSync('/bin/bash -lc "which claude"', { encoding: 'utf-8' }).trim()
      if (result) return result
    } catch {}
  }

  // Last resort — rely on PATH at runtime
  return IS_WIN ? 'claude.cmd' : 'claude'
}

// ─── Environment / PATH ───

let _loginShellPath = ''

/**
 * Build a child-process environment with the full user PATH.
 *
 * On macOS, Electron doesn't source ~/.zshrc so PATH is typically incomplete.
 * On Windows, process.env.PATH is usually correct already.
 */
export function buildEnv(claudeBinary: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.CLAUDECODE

  if (!IS_WIN && !_loginShellPath) {
    try {
      _loginShellPath = execSync('/bin/zsh -lc "echo $PATH"', { encoding: 'utf-8' }).trim()
    } catch {
      try {
        _loginShellPath = execSync('/bin/bash -lc "echo $PATH"', { encoding: 'utf-8' }).trim()
      } catch {
        _loginShellPath = ''
      }
    }
  }
  if (_loginShellPath) {
    env.PATH = _loginShellPath
  }

  // Ensure the claude binary's directory is in PATH
  const binDir = dirname(claudeBinary)
  if (env.PATH && !env.PATH.includes(binDir)) {
    env.PATH = `${binDir}${delimiter}${env.PATH}`
  }

  return env
}

// ─── Process Termination ───

/**
 * Gracefully terminate a child process.
 * On Unix sends SIGINT then SIGTERM after timeout.
 * On Windows uses taskkill (SIGINT is unreliable on Windows).
 */
export function gracefulKill(pid: number | undefined, child: { kill: (sig?: NodeJS.Signals | number) => boolean; exitCode: number | null }): void {
  if (!pid) return

  if (IS_WIN) {
    try {
      execSync(`taskkill /PID ${pid} /T`, { stdio: 'ignore', timeout: 5000 })
    } catch {}
    // Force-kill after 5s if still alive
    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 5000 })
        } catch {}
      }
    }, 5000)
  } else {
    child.kill('SIGINT')
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
      }
    }, 5000)
  }
}

/**
 * Force-kill after a delay (used as a fallback).
 */
export function forceKillAfter(pid: number | undefined, child: { kill: (sig?: NodeJS.Signals | number) => boolean; exitCode: number | null }, delayMs: number): void {
  if (!pid) return
  setTimeout(() => {
    if (child.exitCode === null) {
      if (IS_WIN) {
        try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 5000 }) } catch {}
      } else {
        child.kill('SIGKILL')
      }
    }
  }, delayMs)
}

// ─── Whisper Binary Discovery ───

export function findWhisperBinary(): string {
  const candidates: string[] = IS_WIN
    ? [
        join(homedir(), 'AppData', 'Local', 'Programs', 'whisper', 'whisper.exe'),
        join(homedir(), 'scoop', 'shims', 'whisper.exe'),
        join(homedir(), 'scoop', 'shims', 'whisper-cli.exe'),
        'C:\\Program Files\\whisper\\whisper.exe',
      ]
    : [
        '/opt/homebrew/bin/whisper-cli',
        '/usr/local/bin/whisper-cli',
        '/opt/homebrew/bin/whisper',
        '/usr/local/bin/whisper',
        join(homedir(), '.local/bin/whisper'),
      ]

  for (const c of candidates) {
    if (existsSync(c)) return c
  }

  // Fallback: ask the system shell
  if (IS_WIN) {
    try {
      const result = execSync('where whisper-cli.exe 2>nul || where whisper.exe 2>nul', {
        encoding: 'utf-8', timeout: 5000,
      }).trim().split(/\r?\n/)[0]
      if (result) return result
    } catch {}
  } else {
    try {
      return execSync('/bin/zsh -lc "whence -p whisper-cli"', { encoding: 'utf-8' }).trim()
    } catch {}
    try {
      return execSync('/bin/zsh -lc "whence -p whisper"', { encoding: 'utf-8' }).trim()
    } catch {}
  }

  return ''
}

// ─── Whisper Model Discovery ───

export function findWhisperModel(): string {
  const candidates: string[] = IS_WIN
    ? [
        join(homedir(), '.local', 'share', 'whisper', 'ggml-tiny.bin'),
        join(homedir(), '.local', 'share', 'whisper', 'ggml-base.bin'),
        join(homedir(), 'AppData', 'Local', 'whisper', 'models', 'ggml-tiny.bin'),
        join(homedir(), 'AppData', 'Local', 'whisper', 'models', 'ggml-base.bin'),
        join(homedir(), '.local', 'share', 'whisper', 'ggml-tiny.en.bin'),
        join(homedir(), '.local', 'share', 'whisper', 'ggml-base.en.bin'),
      ]
    : [
        join(homedir(), '.local/share/whisper/ggml-tiny.bin'),
        join(homedir(), '.local/share/whisper/ggml-base.bin'),
        '/opt/homebrew/share/whisper-cpp/models/ggml-tiny.bin',
        '/opt/homebrew/share/whisper-cpp/models/ggml-base.bin',
        join(homedir(), '.local/share/whisper/ggml-tiny.en.bin'),
        join(homedir(), '.local/share/whisper/ggml-base.en.bin'),
        '/opt/homebrew/share/whisper-cpp/models/ggml-tiny.en.bin',
        '/opt/homebrew/share/whisper-cpp/models/ggml-base.en.bin',
      ]

  for (const m of candidates) {
    if (existsSync(m)) return m
  }
  return ''
}

// ─── Session Path Encoding ───

/**
 * Encode a project path for Claude session storage lookup.
 * macOS: /Users/foo/project → -Users-foo-project
 * Windows: C:\Users\foo\project → C-Users-foo-project
 */
export function encodeProjectPath(cwd: string): string {
  return cwd
    .replace(/[/\\]/g, '-')   // slash or backslash → dash
    .replace(/^-/, '')         // strip leading dash (from Unix root /)
    .replace(/:/, '')          // strip drive letter colon (Windows C:)
}

// ─── Open in Terminal ───

/**
 * Open a terminal with the given command, platform-aware.
 */
export function openInTerminal(
  projectDir: string,
  claudeBin: string,
  sessionId: string | null,
  callback: (err: Error | null) => void,
): void {
  const { execFile } = require('child_process')

  if (IS_MAC) {
    const escapedDir = projectDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    let cmd: string
    if (sessionId) {
      cmd = `cd \\"${escapedDir}\\" && ${claudeBin} --resume ${sessionId}`
    } else {
      cmd = `cd \\"${escapedDir}\\" && ${claudeBin}`
    }
    const script = `tell application "Terminal"\n  activate\n  do script "${cmd}"\nend tell`
    execFile('/usr/bin/osascript', ['-e', script], callback)
  } else if (IS_WIN) {
    const args = sessionId ? `--resume ${sessionId}` : ''
    // Try Windows Terminal first, fall back to cmd.exe
    try {
      execFile('wt.exe', ['-d', projectDir, 'cmd', '/k', `${claudeBin} ${args}`], (err: Error | null) => {
        if (err) {
          // Fall back to cmd.exe
          execFile('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${projectDir}" && ${claudeBin} ${args}`], callback)
        } else {
          callback(null)
        }
      })
    } catch {
      execFile('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${projectDir}" && ${claudeBin} ${args}`], callback)
    }
  } else {
    // Linux fallback
    const cmd = sessionId ? `${claudeBin} --resume ${sessionId}` : claudeBin
    try {
      execFile('x-terminal-emulator', ['-e', `bash -c 'cd "${projectDir}" && ${cmd}'`], callback)
    } catch {
      execFile('xterm', ['-e', `bash -c 'cd "${projectDir}" && ${cmd}'`], callback)
    }
  }
}

// ─── Screenshot ───

/**
 * Take a screenshot and save to the given path.
 * Returns true if successful.
 */
export function takeScreenshot(screenshotPath: string): boolean {
  if (IS_MAC) {
    try {
      execSync(`/usr/sbin/screencapture -i "${screenshotPath}"`, {
        timeout: 30000,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  } else if (IS_WIN) {
    // Use PowerShell to capture the screen to clipboard then save
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Screen]::PrimaryScreen | Out-Null
      Start-Process snippingtool -ArgumentList '/clip' -Wait -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 500
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($img) { $img.Save('${screenshotPath.replace(/\\/g, '\\\\')}') }
    `.replace(/\n/g, '; ')
    try {
      execSync(`powershell -NoProfile -Command "${psScript}"`, {
        timeout: 30000,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }
  return false
}

// ─── Platform Icon Paths ───

export function getAppIconName(): string {
  return IS_WIN ? 'icon.ico' : 'icon.icns'
}

export function getTrayIconName(): string {
  return IS_WIN ? 'tray.ico' : 'trayTemplate.png'
}

// ─── Tar / Download ───

/**
 * Download and extract a GitHub tarball. Cross-platform.
 */
export function downloadAndExtractTarball(
  tarballUrl: string,
  stripComponents: number,
  targetDir: string,
  subPath: string,
): void {
  if (IS_WIN) {
    // Windows: use PowerShell to download + tar to extract
    const tmpTar = join(require('os').tmpdir(), `clui-dl-${Date.now()}.tar.gz`)
    const psDownload = `Invoke-WebRequest -Uri '${tarballUrl}' -OutFile '${tmpTar}' -UseBasicParsing`
    execSync(`powershell -NoProfile -Command "${psDownload}"`, { timeout: 60000, stdio: 'pipe' })
    // Windows tar (built-in since Win10 1803)
    execSync(`tar -xzf "${tmpTar}" --strip-components=${stripComponents} -C "${targetDir}"`, { timeout: 60000, stdio: 'pipe' })
    try { require('fs').unlinkSync(tmpTar) } catch {}
  } else {
    const cmd = [
      `curl -sL "${tarballUrl}"`,
      '|',
      `tar -xz --strip-components=${stripComponents} -C "${targetDir}" "*/${subPath}"`,
    ].join(' ')
    execSync(cmd, { timeout: 60000, stdio: 'pipe' })
  }
}
