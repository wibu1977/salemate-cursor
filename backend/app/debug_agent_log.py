"""NDJSON debug logging for agent sessions."""
from __future__ import annotations

import json
import logging
import tempfile
import time
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_WORKSPACE_ROOT = _BACKEND_DIR.parent

_dbg = logging.getLogger("salemate.debug_agent")

LOG_CANDIDATES = (
    Path(tempfile.gettempdir()) / "salemate-debug-1afd7b.log",
    _WORKSPACE_ROOT / "debug-1afd7b.log",
    _BACKEND_DIR / "debug-1afd7b.log",
)
SESSION_ID = "1afd7b"


def agent_log(
    hypothesis_id: str,
    location: str,
    message: str,
    data: dict | None = None,
    run_id: str = "pre-fix",
) -> None:
    # #region agent log
    payload = {
        "sessionId": SESSION_ID,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(time.time() * 1000),
    }
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    _dbg.info("AGENT_NDJSON %s", line.strip())
    for path in LOG_CANDIDATES:
        try:
            with path.open("a", encoding="utf-8") as f:
                f.write(line)
            return
        except OSError as exc:
            _dbg.debug("agent_log skip %s: %s", path, exc)
            continue
    _dbg.warning("agent_log: could not write NDJSON to any candidate path")
    # #endregion
