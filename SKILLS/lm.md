# lm

LM Studio Local Server should be running at `http://127.0.0.1:1234`.

Sanity check:

```
Invoke-RestMethod http://127.0.0.1:1234/v1/models
```

Usage:

```
lm .\tools\prompts\debug_filled.md
```
