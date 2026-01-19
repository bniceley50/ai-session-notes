@echo off
setlocal EnableExtensions
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix_codex_skills.ps1" -RepoRoot "%~dp0"
