"""Short-lived JWT for Messenger webview campaign preview/approve (no admin Bearer)."""

from __future__ import annotations

import time
import uuid

import jwt

from app.config import get_settings

WEBVIEW_TOKEN_TYP = "campaign_webview"
DEFAULT_WEBVIEW_TOKEN_HOURS = 24 * 7


def create_campaign_webview_token(campaign_id: uuid.UUID) -> str:
    settings = get_settings()
    payload = {
        "sub": str(campaign_id),
        "typ": WEBVIEW_TOKEN_TYP,
        "exp": int(time.time()) + DEFAULT_WEBVIEW_TOKEN_HOURS * 3600,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def parse_campaign_webview_token(token: str) -> uuid.UUID | None:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("typ") != WEBVIEW_TOKEN_TYP:
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        return uuid.UUID(sub)
    except (jwt.PyJWTError, ValueError):
        return None
