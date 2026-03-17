@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set FAIL=0

echo.
echo --- Checking environment

:: 1. Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   FAIL: Node.js is not installed.
    echo   Install from: https://nodejs.org
    set FAIL=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo   OK: Node.js %%v
)

:: 2. npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   FAIL: npm is not installed.
    set FAIL=1
) else (
    for /f "tokens=*" %%v in ('npm --version') do echo   OK: npm %%v
)

:: 3. Python 3
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   INFO: Python 3 not found. Native module compilation may fail.
    echo   Install from: https://www.python.org/downloads/
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   OK: %%v
)

:: 4. Claude CLI
where claude >nul 2>&1
if %errorlevel% neq 0 (
    where claude.cmd >nul 2>&1
    if !errorlevel! neq 0 (
        echo   FAIL: Claude Code CLI is not installed.
        echo   Install with: npm install -g @anthropic-ai/claude-code
        set FAIL=1
    ) else (
        echo   OK: Claude Code CLI found
    )
) else (
    echo   OK: Claude Code CLI found
)

:: 5. Visual C++ Build Tools (for native modules like node-pty)
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo   INFO: Visual C++ compiler not in PATH.
    echo   If npm install fails, install Visual Studio Build Tools:
    echo   https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo   Or run: npm install -g windows-build-tools
)

:: Bail if any critical check failed
if %FAIL% neq 0 (
    echo.
    echo Some checks failed. Fix them above, then rerun:
    echo   start.bat
    pause
    exit /b 1
)

echo.
echo All checks passed.

:: Parse arguments
set INSTALL_WHISPER=0
for %%a in (%*) do (
    if "%%a"=="--with-voice" set INSTALL_WHISPER=1
)

:: Optional voice
where whisper-cli >nul 2>&1
if %errorlevel% equ 0 (
    echo   OK: Whisper CLI found (voice input ready)
) else (
    if %INSTALL_WHISPER% equ 1 (
        echo.
        echo   INFO: Whisper must be installed manually on Windows.
        echo   See: https://github.com/ggerganov/whisper.cpp
    ) else (
        echo.
        echo   INFO: Voice input is optional and Whisper CLI is not installed.
        echo   See: https://github.com/ggerganov/whisper.cpp
    )
)

:: Install dependencies
if not exist "node_modules" (
    echo.
    echo --- Installing dependencies
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo npm install failed. Common fixes:
        echo   1. Install Visual Studio Build Tools
        echo   2. Run: npm install -g windows-build-tools
        echo   3. Rerun start.bat
        pause
        exit /b 1
    )
)

:: Build
echo.
echo --- Building Clui CC
call npx electron-vite build --mode production
if %errorlevel% neq 0 (
    echo.
    echo Build failed. Try:
    echo   1. Delete node_modules and rerun start.bat
    echo   2. Check that all dependencies are installed
    pause
    exit /b 1
)

:: Launch
echo.
echo --- Launching Clui CC
echo   Alt+Space to toggle the overlay.
echo   Use stop.bat or tray icon ^> Quit to close.
echo.
npx electron .
