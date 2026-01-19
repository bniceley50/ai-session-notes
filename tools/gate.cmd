@echo off
setlocal EnableExtensions

REM Gate script for ai-session-notes
REM - Safe checks that work even if you don't have Node/Python/etc.
REM - Expands automatically if certain repo scripts exist

cd /d "%~dp0\.." || (echo [FAIL] Cannot cd to repo root & exit /b 1)

echo.
echo [GATE] git status -sb
git status -sb
if errorlevel 1 exit /b 1

echo.
echo [GATE] git diff --stat
git diff --stat
if errorlevel 1 exit /b 1

echo.
if exist "tools\dev_quickcheck.bat" (
  echo [GATE] tools\dev_quickcheck.bat /all
  call "tools\dev_quickcheck.bat" /all
  if errorlevel 1 exit /b 1
) else (
  echo [GATE] tools\dev_quickcheck.bat not found - skipping quickcheck
)

echo.
echo [OK] Gate passed
exit /b 0
