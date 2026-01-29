@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem tools\dev_quickcheck.bat
rem Real gate for MVP (Next 16): typecheck + eslint

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%.." >nul || (echo [FAIL] Cannot cd to repo root & exit /b 1)

set "TSC=%CD%\node_modules\.bin\tsc.cmd"
set "ESLINT=%CD%\node_modules\.bin\eslint.cmd"

if not exist "%TSC%" (
  echo [FAIL] Missing %TSC%
  echo        Run: npm install
  popd >nul
  exit /b 1
)

if not exist "%ESLINT%" (
  echo [FAIL] Missing %ESLINT%
  echo        Run: npm install
  popd >nul
  exit /b 1
)

echo [CHECK] typecheck
call "%TSC%" --noEmit
if errorlevel 1 (
  echo [FAIL] typecheck failed
  popd >nul
  exit /b 1
)

echo [CHECK] lint
call "%ESLINT%" .
if errorlevel 1 (
  echo [FAIL] lint failed
  popd >nul
  exit /b 1
)

echo [OK] quickcheck passed
popd >nul
exit /b 0
