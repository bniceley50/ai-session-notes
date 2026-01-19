@echo off
set "REPO=%~dp0"
powershell -NoLogo -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%REPO%'; . '.\start.ps1'"
