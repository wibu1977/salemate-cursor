import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    
    try:
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
            # Một số API Meta trả về ID thay vì success: True
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
        
    except HTTPException:
        raise
    except httpx.ConnectError as e:
        logger.exception("SSL/Connection error in connect_page: %s", e)
        raise HTTPException(
            status_code=502,
            detail={
                "error": "ssl_connection_error",
                "message": (
                    f"Lỗi bảo mật/kết nối (SSL/TLS). Có thể chứng chỉ không hợp lệ: {e}"
                ),
            },
        )
    except httpx.RequestError as e:
        logger.exception("Graph API / network error in connect_page: %s", e)
        raise HTTPException(
            status_code=502,
            detail={
                "error": "meta_unreachable",
                "message": (
                    "Máy chủ không kết nối được tới Facebook (Graph API). "
                    "Chi tiết kỹ thuật: " + str(e)
                ),
            },
        )
    except OSError as e:
        logger.exception("OS network error in connect_page: %s", e)
        # Catch errors like [Errno 101] Network is unreachable
        raise HTTPException(
            status_code=502,
            detail={
                "error": "network_unreachable",
                "message": (
                    f"Lỗi mạng hệ thống ({e}). Trên Railway, hãy vào Settings -> Networking "
                    "và bật 'Enable Outbound IPv6', sau đó Deploy lại."
                ),
            },
        )
    except Exception as e:
        logger.exception("Unexpected error in connect_page: %s", e)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal", "message": str(e)},
        )


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
