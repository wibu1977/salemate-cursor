import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.models.workspace import ShopPage
from app.services.meta_service import MetaService

router = APIRouter()
logger = logging.getLogger("salemate.pages")

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
    Connect a Facebook/Instagram page to this workspace.
    Subscribes to webhooks, sets Get Started button + persistent menu.
    """
    logger.info(
        "POST /admin/pages connect page_id=%s platform=%s workspace=%s",
        payload.page_id,
        payload.platform,
        workspace_id,
    )
    existing = await db.execute(
        select(ShopPage).where(ShopPage.page_id == payload.page_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Page already connected")

    # 1. Subscribe page to webhook events
    sub_result = await MetaService.subscribe_page_to_webhooks(
        payload.page_access_token, payload.page_id
    )
    if not sub_result.get("success"):
        logger.error("Failed to subscribe page %s: %s", payload.page_id, sub_result)
        raise HTTPException(status_code=502, detail=f"Meta subscription failed: {sub_result}")

    # 2. Set Get Started button
    await MetaService.set_get_started_button(payload.page_access_token)

    # 3. Set persistent menu
    await MetaService.set_persistent_menu(payload.page_access_token, SHOP_PERSISTENT_MENU)

    # 4. Set ice breakers
    await MetaService.set_ice_breakers(payload.page_access_token, SHOP_ICE_BREAKERS)

    page = ShopPage(
        workspace_id=workspace_id,
        page_id=payload.page_id,
        page_name=payload.page_name,
        page_access_token=payload.page_access_token,
        platform=payload.platform,
    )
    db.add(page)
    await db.flush()
    await db.refresh(page)

    logger.info("Connected page %s (%s) to workspace %s", payload.page_name, payload.page_id, workspace_id)
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
