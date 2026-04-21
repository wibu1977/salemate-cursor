import logging
import uuid

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_workspace_id, _decode_supabase_payload, security
from app.config import get_settings
from app.database import get_db
from app.schemas.admin import DashboardSummary, OrderListItem, OrderDetail, OrderActionRequest
from app.schemas.auth import AuthMeResponse, FacebookLoginRequest, TokenResponse, WorkspaceSetup
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService

router = APIRouter()
logger = logging.getLogger(__name__)
_settings = get_settings()


def _facebook_login_error_payload(code: str, message: str) -> dict[str, str]:
    """JSON trong body lỗi: { detail: { error, message } } (FastAPI gói trong detail)."""
    return {"error": code, "message": message}


@router.get("/auth/me", response_model=AuthMeResponse)
async def auth_me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Provisioning workspace cho user Supabase; hoặc trả workspace từ JWT legacy."""
    token = credentials.credentials
    sup_secret = (_settings.SUPABASE_JWT_SECRET or "").strip()
    if sup_secret:
        payload = _decode_supabase_payload(token, sup_secret)
        if payload and payload.get("sub"):
            try:
                uid = uuid.UUID(str(payload["sub"]))
            except ValueError:
                uid = None
            if uid:
                meta = payload.get("user_metadata") or {}
                name = meta.get("full_name") or meta.get("name")
                ws_id = await AuthService.ensure_workspace_for_supabase_user(
                    db,
                    user_id=uid,
                    email=payload.get("email"),
                    name=name if isinstance(name, str) else None,
                )
                return AuthMeResponse(
                    workspace_id=ws_id,
                    auth="supabase",
                    email=payload.get("email"),
                )

    try:
        legacy = jwt.decode(
            token,
            _settings.JWT_SECRET_KEY,
            algorithms=[_settings.JWT_ALGORITHM],
        )
        wid = legacy.get("workspace_id")
        if not wid:
            raise HTTPException(status_code=401, detail="Invalid token")
        return AuthMeResponse(workspace_id=uuid.UUID(str(wid)), auth="legacy", email=None)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e


@router.post("/auth/facebook", response_model=TokenResponse)
async def facebook_login(payload: FacebookLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with Facebook OAuth token, create workspace if new."""
    try:
        return await AuthService.facebook_login(db, payload.access_token)
    except ValueError as e:
        # Token Graph không hợp lệ / /me lỗi — auth_service ném ValueError
        raise HTTPException(
            status_code=401,
            detail=_facebook_login_error_payload("facebook_token", str(e)),
        ) from e
    except httpx.HTTPError as e:
        logger.exception("POST /admin/auth/facebook: Facebook Graph API HTTP/network error")
        raise HTTPException(
            status_code=502,
            detail=_facebook_login_error_payload(
                "graph_unreachable",
                "Không kết nối được Facebook Graph API.",
            ),
        ) from e
    except jwt.PyJWTError as e:
        logger.exception("POST /admin/auth/facebook: JWT encode failed")
        raise HTTPException(
            status_code=500,
            detail=_facebook_login_error_payload(
                "jwt_config",
                "Lỗi ký JWT. Kiểm tra JWT_SECRET_KEY và thuật toán.",
            ),
        ) from e
    except SQLAlchemyError as e:
        logger.exception("POST /admin/auth/facebook: database error")
        msg = (
            str(e)
            if _settings.DEBUG or _settings.APP_ENV != "production"
            else "Không ghi được dữ liệu. Thử lại sau."
        )
        raise HTTPException(
            status_code=503,
            detail=_facebook_login_error_payload("database", msg),
        ) from e
    except Exception as e:
        logger.exception("POST /admin/auth/facebook: unexpected error")
        msg = (
            str(e)
            if _settings.DEBUG
            else "Lỗi máy chủ khi đăng nhập. Xem log backend."
        )
        raise HTTPException(
            status_code=500,
            detail=_facebook_login_error_payload("internal", msg),
        ) from e


@router.post("/auth/setup")
async def setup_workspace(
    payload: WorkspaceSetup,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Initial workspace setup after first login."""
    return await AuthService.setup_workspace(db, workspace_id, payload)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """30-second dashboard summary: revenue, orders, alerts."""
    return await AdminService.get_summary(db, workspace_id)


@router.get("/orders", response_model=list[OrderListItem])
async def list_orders(
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List orders with optional status filter."""
    return await AdminService.list_orders(db, workspace_id, status, page, size)


@router.get("/orders/{order_id}", response_model=OrderDetail)
async def get_order_detail(
    order_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Get order detail including OCR data and fraud logs."""
    return await AdminService.get_order_detail(db, workspace_id, order_id)


@router.post("/orders/{order_id}/action")
async def order_action(
    order_id: uuid.UUID,
    payload: OrderActionRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a flagged order."""
    return await AdminService.handle_order_action(db, workspace_id, order_id, payload)
