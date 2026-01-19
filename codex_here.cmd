@echo off
setlocal EnableExtensions

REM Launch Codex CLI from this repo with a repo-local CODEX_HOME.
REM This keeps prompts/config portable on the drive (no user profile required).

set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"

cd /d "%REPO%" || (echo [FAIL] Cannot cd to "%REPO%" & exit /b 1)

set "CODEX_HOME=%REPO%\.codex_home"
if not exist "%CODEX_HOME%" mkdir "%CODEX_HOME%" >nul 2>&1
if not exist "%CODEX_HOME%\prompts" mkdir "%CODEX_HOME%\prompts" >nul 2>&1
if not exist "%CODEX_HOME%\skills" mkdir "%CODEX_HOME%\skills" >nul 2>&1

echo [INFO] CODEX_HOME=%CODEX_HOME%
echo [INFO] Repo=%REPO%
echo.

REM Pass through all arguments to codex (example: codex_here.cmd "fix NEXT.md")
codex %*
