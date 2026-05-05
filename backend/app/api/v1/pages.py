import logging
import uuid

import certifi
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.models.workspace import ShopPage
from app.services.meta_service import MetaService
from app.config import get_settings

router = APIRouter()
logger = logging.getLogger("salemate.pages")
settings = get_settings()

SHOP_PERSISTENT_MENU = [
    {"type": "postback", "title": "Xem sản phẩm", "payload": "VIEW_PRODUCTS"},
    {"type": "postback", "title": "Đơn hàng của tôi", "payload": "MY_ORDERS"},
    {"type": "postback", "title": "Liên hệ hỗ trợ", "payload": "CONTACT_SUPPORT"},
]

SHOP_ICE_BREAKERS = [
    {"question": "Hôm nay có gì mới?", "payload": "VIEW_PRODUCTS"},
    {"question": "Tôi muốn đặt hàng", "payload": "START_ORDER"},
    {"question": "Kiểm tra đơn hàng", "payload": "MY_ORDERS"},
]


class ConnectPageRequest(BaseModel):
    page_id: str
    page_name: str
    page_access_token: str
    platform: str = "facebook"


class PageResponse(BaseModel):
    id: uuid.UUID
    page_id: str
    page_name: str
    platform: str
    is_active: bool

    model_config = {"from_attributes": True}


async def _exchange_long_lived_page_token(short_token: str) -> str:
    """
    Exchange short-lived page token → long-lived page token (không bao giờ hết hạn).

    Dùng App ID + App Secret qua endpoint oauth/access_token với
    grant_type=fb_exchange_token — không cần user token riêng.

    Nếu exchange thất bại (ví dụ token đã là long-lived), trả về token gốc
    để không block luồng kết nối page.
    """
    ssl_verify: bool | str = certifi.where() if not settings.META_GRAPH_SSL_INSECURE else False
    async with httpx.AsyncClient(verify=ssl_verify, timeout=20.0) as client:
        resp = await client.get(
            "https://graph.facebook.com/v21.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.META_APP_ID,
                "client_secret": settings.META_APP_SECRET,
                "fb_exchange_token": short_token,
            },
        )
        data = resp.json()

    if "error" in data:
        logger.warning(
            "Long-lived token exchange failed (will use original): %s",
            data["error"].get("message"),
        )
        return short_token

    ll_token = data.get("access_token", short_token)
    logger.info("Successfully exchanged short-lived → long-lived page token")
    return ll_token


@router.get("", response_model=list[PageResponse])
async def list_pages(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ShopPage).where(ShopPage.workspace_id == workspace_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=PageResponse)
async def connect_page(
    payload: ConnectPageRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Kết nối Facebook Page với workspace.

    Luồng xử lý:
    1. Exchange short-lived page token → long-lived page token (không bao giờ hết hạn)
    2. Subscribe page to webhook events
    3. Cài đặt Get Started / Persistent Menu / Ice Breakers
    4. Lưu page + long-lived token vào DB
    """
    logger.info(
        "POST /admin/pages connect page_id=%s platform=%s workspace=%s",
        payload.page_id,
        payload.platform,
        workspace_id,
    )

    # ── 1. Exchange lấy long-lived page token ──────────────────────────────────
    long_lived_token = await _exchange_long_lived_page_token(payload.page_access_token)

    # ── 2. Subscribe page to webhook events ────────────────────────────────────
    logger.info("Subscribing page %s to webhooks...", payload.page_id)
    sub_result = await MetaService.subscribe_page_to_webhooks(
        long_lived_token, payload.page_id
    )
    if not sub_result.get("success") and not sub_result.get("id"):
        logger.error("Failed to subscribe page %s: %s", payload.page_id, sub_result)
        raise HTTPException(
            status_code=502,
            detail=f"Meta webhook subscription failed: {sub_result}",
        )

    # ── 3. Cài đặt Messenger UI ────────────────────────────────────────────────
    logger.info("Setting Get Started button for page %s...", payload.page_id)
    await MetaService.set_get_started_button(long_lived_token)

    logger.info("Setting persistent menu for page %s...", payload.page_id)
    await MetaService.set_persistent_menu(long_lived_token, SHOP_PERSISTENT_MENU)

    logger.info("Setting ice breakers for page %s...", payload.page_id)
    await MetaService.set_ice_breakers(long_lived_token, SHOP_ICE_BREAKERS)

    # ── 4. Lưu vào DB với long-lived token ────────────────────────────────────
    existing = await db.execute(
        select(ShopPage).where(ShopPage.page_id == payload.page_id)
    )
    page = existing.scalar_one_or_none()

    if page:
        page.workspace_id = workspace_id
        page.page_name = payload.page_name
        page.page_access_token = long_lived_token  # ← long-lived, không hết hạn
        page.platform = payload.platform
        page.is_active = True
        logger.info("Updated existing page %s with new long-lived token", payload.page_id)
    else:
        page = ShopPage(
            workspace_id=workspace_id,
            page_id=payload.page_id,
            page_name=payload.page_name,
            page_access_token=long_lived_token,  # ← long-lived, không hết hạn
            platform=payload.platform,
            is_active=True,
        )
        db.add(page)

    await db.flush()
    await db.refresh(page)

    logger.info(
        "Connected page %s (%s) to workspace %s — long-lived token saved",
        payload.page_name,
        payload.page_id,
        workspace_id,
    )
    return page


@router.delete("/{page_db_id}")
async def disconnect_page(
    page_db_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ShopPage).where(
        ShopPage.id == page_db_id,
        ShopPage.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    page.is_active = False

    logger.info("Disconnected page %s (%s)", page.page_name, page.page_id)
    return {"status": "disconnected", "page_id": page.page_id}
