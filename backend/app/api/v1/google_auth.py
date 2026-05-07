import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_workspace_id
from app.config import get_settings
from app.database import get_db
from app.models.workspace import Workspace
from app.services.google_oauth_service import (
    build_authorization_url,
    decode_oauth_state,
    ensure_valid_access_token,
    exchange_code_and_store,
    oauth_is_configured,
)

router = APIRouter()


@router.get("/login")
async def google_oauth_login(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    next: str | None = Query(None, description="URL chuyển về sau khi kết nối (vd. /onboarding)"),
):
    if not oauth_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Google OAuth chưa cấu hình trên máy chủ.",
        )
    try:
        base = build_authorization_url(workspace_id, next_path=next)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"authorization_url": base}


@router.get("/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    try:
        workspace_id, next_url = decode_oauth_state(state)
        await exchange_code_and_store(db, code, workspace_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    target = (next_url or settings.GOOGLE_OAUTH_SUCCESS_REDIRECT).strip()
    if not target.startswith("http://") and not target.startswith("https://"):
        target = settings.GOOGLE_OAUTH_SUCCESS_REDIRECT
    sep = "&" if "?" in target else "?"
    return RedirectResponse(f"{target}{sep}google=connected", status_code=302)


@router.get("/status")
async def google_connection_status(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    return {
        "connected": bool((ws.google_refresh_token or "").strip()),
        "oauth_configured": oauth_is_configured(),
    }


@router.get("/picker-config")
async def google_picker_config(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """OAuth access token + client id + API key cho Google Picker (trình duyệt)."""
    settings = get_settings()
    if not oauth_is_configured():
        raise HTTPException(status_code=503, detail="Google OAuth chưa cấu hình.")
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace không tồn tại.")
    try:
        access = await ensure_valid_access_token(db, ws)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "access_token": access,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "developer_key": (settings.GOOGLE_PICKER_API_KEY or "").strip() or None,
    }
