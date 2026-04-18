# Windows Event Loop Fix — `claude-agent-sdk` Subprocess Failure

## Symptom

On Windows, requests that use the `claude-agent-sdk` (e.g. `POST /api/checks/clarify`) returned HTTP 500 with:

```
claude_agent_sdk._errors.CLIConnectionError: Failed to start Claude Code:
...
File "...\asyncio\base_events.py", line 539, in _make_subprocess_transport
    raise NotImplementedError
```

## Root cause

Two separate Windows-specific issues, in order:

1. **Missing README** — `server/pyproject.toml` declared `readme = "README.md"` but no such file existed in `server/`, so `uv sync` failed with `OSError: Readme file does not exist: README.md`.

2. **Wrong asyncio event loop policy** — `claude-agent-sdk` spawns the bundled `claude.exe` via `asyncio.create_subprocess_exec`. On Windows this **requires `ProactorEventLoop`**; `SelectorEventLoop` raises `NotImplementedError` from `_make_subprocess_transport`.

   Uvicorn with `reload=True` on Windows explicitly installs `WindowsSelectorEventLoopPolicy` (to work around `watchfiles` issues), which overrides any policy set at module import time.

GitHub issue [anthropics/claude-agent-sdk-python#252](https://github.com/anthropics/claude-agent-sdk-python/issues/252) (`WinError 193`) is **not** this issue — it was resolved in SDK 0.1.20+ by bundling a native `claude.exe`. This project uses 0.1.58, so that fix is already active.

## Resolution

### 1. Create `server/README.md`

Minimal file so hatchling can build the editable install.

### 2. Force `ProactorEventLoop` + disable reload on Windows

In `server/api/server.py`, at the top of the module:

```python
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
```

And in the `__main__` block:

```python
uvicorn.run(
    "api.server:app",
    host="0.0.0.0",
    port=9090,
    reload=sys.platform != "win32",  # reload forces SelectorEventLoop on Windows
    log_level="info",
)
```

## Trade-off

Auto-reload is disabled on Windows. Restart the server manually after code changes, or develop on macOS/Linux where `reload=True` is safe. Non-Windows platforms are unaffected.

## Verification

```bash
cd server
uv run python -m api.server
# then from another terminal:
curl -X POST http://localhost:9090/api/checks/clarify -H "Content-Type: application/json" -d "{\"claim\":\"test\"}"
```

Expect HTTP 200 with clarification questions; no `NotImplementedError` in logs.
