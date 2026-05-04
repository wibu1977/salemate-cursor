import logging
import os
import ssl
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
from app.debug_agent_log import agent_log
from app.config import get_settings

router = APIRouter()
logger = logging.getLogger("salemate.pages")
settings = get_settings()

_TLS_DIAG_SUFFIX = (
    " Đ�?chẩn đoán: m�?GET /health/outbound-tls trên cùng backend (JSON). "
    "CA doanh nghiệp: đặt SSL_CERT_FILE hoặc REQUESTS_CA_BUNDLE tr�?tới file .pem, rồi restart. "
    "Tạm thời (rủi ro): META_GRAPH_SSL_INSECURE=true trong backend .env ch�?cho Graph API."
)

SHOP_PERSISTENT_MENU = [
    {"type": "postback", "title": "Xem sản phẩm", "payload": "VIEW_PRODUCTS"},
    {"type": "postback", "title": "Đơn hàng của tôi", "payload": "MY_ORDERS"},
    {"type": "postback", "title": "Liên h�?h�?tr�?, "payload": "CONTACT_SUPPORT"},
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
    try:
        print("========== INCOMING REQUEST ==========")
        print(f"access_token received from frontend: {payload.page_access_token}")
        print(f"request body: {payload.model_dump()}")
        print("======================================")

        ssl_verify: bool | str = certifi.where() if not settings.META_GRAPH_SSL_INSECURE else False
        async with httpx.AsyncClient(verify=ssl_verify) as client:
            graph_res = await client.get(
                "https://graph.facebook.com/v21.0/me/accounts",
                params={"access_token": payload.page_access_token}
            )
            print("========== GRAPH API RESPONSE (/me/accounts) ==========")
            print(f"Status: {graph_res.status_code}")
            print(f"Body: {graph_res.text}")
            print("=======================================================")

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
        logger.info("Subscribing page %s to webhooks...", payload.page_id)
        sub_result = await MetaService.subscribe_page_to_webhooks(
            payload.page_access_token, payload.page_id
        )
        if not sub_result.get("success") and not sub_result.get("id"):
            logger.error("Failed to subscribe page %s: %s", payload.page_id, sub_result)
            raise HTTPException(status_code=502, detail=f"Meta subscription failed: {sub_result}")

        # 2. Set Get Started button
        logger.info("Setting Get Started button for page %s...", payload.page_id)
        await MetaService.set_get_started_button(payload.page_access_token)

        # 3. Set persistent menu
        logger.info("Setting persistent menu for page %s...", payload.page_id)
        await MetaService.set_persistent_menu(payload.page_access_token, SHOP_PERSISTENT_MENU)

        # 4. Set ice breakers
        logger.info("Setting ice breakers for page %s...", payload.page_id)
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

    except Exception as e:
        import traceback
        print("ERROR:", str(e))
        print(traceback.format_exc())
        raise


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
