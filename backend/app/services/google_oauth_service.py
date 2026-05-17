"""Google OAuth 2.0 (Web) — Sheets + Drive metadata readonly."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.workspace import Workspace

logger = logging.getLogger("salemate.google_oauth")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# spreadsheets.readonly: read Sheet values API.
# drive.metadata.readonly: list files / Google Picker.
# drive.readonly: export spreadsheet as XLSX (embedded images → same pipeline as file import).
# For Picker, set GOOGLE_PICKER_API_KEY (Google Cloud API key). Users may need to reconnect after scope changes.
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def oauth_is_configured() -> bool:
    s = get_settings()
    return bool(
        (s.GOOGLE_OAUTH_CLIENT_ID or "").strip()
        and (s.GOOGLE_OAUTH_CLIENT_SECRET or "").strip()
        and (s.GOOGLE_OAUTH_REDIRECT_URI or "").strip()
    )


def build_authorization_url(workspace_id: uuid.UUID, next_path: str | None = None) -> str:
    settings = get_settings()
    if not oauth_is_configured():
        raise ValueError(
            "Google OAuth chưa cấu hình. Đặt GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI."
        )
    exp = int((datetime.now(timezone.utc) + timedelta(minutes=15)).timestamp())
    payload: dict = {"wid": str(workspace_id), "exp": exp}
    if next_path and next_path.strip():
        payload["next"] = next_path.strip()[:2048]
    state = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def decode_oauth_state(state: str) -> tuple[uuid.UUID, str | None]:
    settings = get_settings()
    payload = jwt.decode(
        state,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    workspace_id = uuid.UUID(str(payload["wid"]))
    next_url = payload.get("next")
    if isinstance(next_url, str) and next_url.strip():
        return workspace_id, next_url.strip()
    return workspace_id, None


async def exchange_code_and_store(
    db: AsyncSession, code: str, workspace_id: uuid.UUID
) -> None:
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        r = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=30.0,
        )
        if r.status_code >= 400:
            logger.warning("Google token exchange failed: %s %s", r.status_code, r.text)
            raise ValueError(
                "Không đổi được mã Google OAuth. Kiểm tra Client ID/Secret và Redirect URI, "
                "rồi kết nối lại Google."
            ) from None
        try:
            data = r.json()
        except ValueError as e:
            raise ValueError("Google trả phản hồi token không hợp lệ.") from e

    access = data.get("access_token")
    refresh = data.get("refresh_token")
    if not access:
        raise ValueError("Google không trả access_token.")

    expires_in = int(data.get("expires_in") or 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws:
        raise ValueError("Workspace không tồn tại.")

    ws.google_access_token = access
    if refresh:
        ws.google_refresh_token = refresh
    ws.google_token_expires_at = expires_at.replace(tzinfo=None)
    await db.commit()



async def refresh_access_token(db: AsyncSession, workspace: Workspace) -> str:
    settings = get_settings()
    rt = (workspace.google_refresh_token or "").strip()
    if not rt:
        raise ValueError("Chưa có refresh token. Kết nối lại Google từ dashboard.")

    async with httpx.AsyncClient() as client:
        r = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "refresh_token": rt,
                "grant_type": "refresh_token",
            },
            timeout=30.0,
        )
        if r.status_code >= 400:
            logger.warning("Google refresh failed: %s %s", r.status_code, r.text)
            raise ValueError(
                "Phiên Google đã hết hạn hoặc bị thu hồi. Vui lòng ngắt kết nối và kết nối lại Google trên dashboard."
            ) from None
        try:
            data = r.json()
        except ValueError as e:
            raise ValueError("Google trả phản hồi làm mới token không hợp lệ.") from e

    access = data.get("access_token")
    if not access:
        raise ValueError("Làm mới token thất bại.")
    expires_in = int(data.get("expires_in") or 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    workspace.google_access_token = access
    workspace.google_token_expires_at = expires_at.replace(tzinfo=None)
    await db.commit()
    await db.refresh(workspace)
    return access


async def ensure_valid_access_token(db: AsyncSession, workspace: Workspace) -> str:
    now = datetime.now(timezone.utc)
    exp = workspace.google_token_expires_at
    token = (workspace.google_access_token or "").strip()
    if token and exp:
        exp_utc = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        if exp_utc > now + timedelta(minutes=2):
            return token
    if (workspace.google_refresh_token or "").strip():
        return await refresh_access_token(db, workspace)
    raise ValueError("Phiên Google đã hết hạn. Vui lòng kết nối lại.")
