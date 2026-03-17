# Clui CC Environment Check — Windows
# Read-only diagnostics, no installs.

Write-Host "Clui CC Environment Check (Windows)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$fail = 0

function Check {
    param([string]$Label, [bool]$Ok, [string]$Detail)
    if ($Ok) {
        Write-Host "  PASS  $Label — $Detail" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $Label — $Detail" -ForegroundColor Red
        $script:fail = 1
    }
}

# Windows version
$osVersion = [System.Environment]::OSVersion.Version
$isWin10Plus = $osVersion.Major -ge 10
Check "Windows" $isWin10Plus "$([System.Environment]::OSVersion.VersionString)"

# Node.js
try {
    $nodeVer = (node --version 2>$null)
    if ($nodeVer) {
        $verNum = $nodeVer -replace '^v', ''
        $major = [int]($verNum -split '\.')[0]
        Check "Node.js" ($major -ge 18) $nodeVer
    } else {
        Check "Node.js" $false "not found — install from https://nodejs.org"
    }
} catch {
    Check "Node.js" $false "not found — install from https://nodejs.org"
}

# npm
try {
    $npmVer = (npm --version 2>$null)
    if ($npmVer) {
        Check "npm" $true $npmVer
    } else {
        Check "npm" $false "not found"
    }
} catch {
    Check "npm" $false "not found"
}

# Python
try {
    $pyVer = (python --version 2>&1)
    if ($pyVer -match 'Python (\d+\.\d+)') {
        Check "Python" $true $pyVer
    } else {
        Check "Python" $false "not found — install from https://python.org"
    }
} catch {
    Check "Python" $false "not found — install from https://python.org"
}

# Visual C++ compiler
try {
    $clPath = (Get-Command cl -ErrorAction SilentlyContinue)
    if ($clPath) {
        Check "C++ Compiler" $true "cl.exe found at $($clPath.Path)"
    } else {
        Check "C++ Compiler" $false "not found — install Visual Studio Build Tools"
    }
} catch {
    Check "C++ Compiler" $false "not found — install Visual Studio Build Tools"
}

# Claude CLI
try {
    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        $claudeCmd = Get-Command claude.cmd -ErrorAction SilentlyContinue
    }
    if ($claudeCmd) {
        try {
            $claudeVer = (claude --version 2>$null)
            Check "Claude CLI" $true ($claudeVer ?? "found")
        } catch {
            Check "Claude CLI" $true "found at $($claudeCmd.Path)"
        }
    } else {
        Check "Claude CLI" $false "not found — npm install -g @anthropic-ai/claude-code"
    }
} catch {
    Check "Claude CLI" $false "not found — npm install -g @anthropic-ai/claude-code"
}

# Whisper (optional)
try {
    $whisperCmd = Get-Command whisper-cli -ErrorAction SilentlyContinue
    if (-not $whisperCmd) {
        $whisperCmd = Get-Command whisper -ErrorAction SilentlyContinue
    }
    if ($whisperCmd) {
        Check "Whisper (optional)" $true "found at $($whisperCmd.Path)"
    } else {
        Write-Host "  INFO  Whisper (optional) — not found. Voice input unavailable." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  INFO  Whisper (optional) — not found. Voice input unavailable." -ForegroundColor Yellow
}

Write-Host ""
if ($fail -ne 0) {
    Write-Host "Some checks failed. Fix them above, then rerun:" -ForegroundColor Red
    Write-Host "  .\start.bat" -ForegroundColor Yellow
} else {
    Write-Host "Environment looks good." -ForegroundColor Green
}
