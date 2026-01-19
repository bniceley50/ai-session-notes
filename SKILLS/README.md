# SKILLS Registry

This folder is the repo source-of-truth for what skills exist.

- manifest.json = machine-readable index
- *.md = human instructions per skill

Add a skill:
1) Create SKILLS/<slug>.md
2) Add entry to SKILLS/manifest.json (slug/title/summary/doc)
3) Reload: . .\start.ps1
4) Verify: skills then skill <slug>
