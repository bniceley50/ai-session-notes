@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem tools\gate.cmd
rem Real gate: always runs quickcheck and fails if it is missing or fails.

set "SCRIPT_DIR=%~dp0"

pushd "%SCRIPT_DIR%.." >nul || (echo [FAIL] Cannot cd to repo root & exit /b 1)

echo.
echo [GATE] git status -sb
git status -sb
if errorlevel 1 (
  echo [FAIL] git status failed
  popd >nul
  exit /b 1
)

echo.
echo [GATE] git diff --stat
git diff --stat
if errorlevel 1 (
  echo [FAIL] git diff failed
  popd >nul
  exit /b 1
)

echo.
set "QC=%SCRIPT_DIR%dev_quickcheck.bat"
if not exist "%QC%" (
  echo [FAIL] tools\dev_quickcheck.bat not found. Gate requires quickcheck.
  echo        Restore/create tools\dev_quickcheck.bat, then re-run gate.
  popd >nul
  exit /b 1
)

echo [GATE] tools\dev_quickcheck.bat %*
call "%QC%" %*
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo [FAIL] Quickcheck failed (exit %RC%)
  popd >nul
  exit /b %RC%
)

echo.
echo [OK] Gate passed
popd >nul
exit /b 0
