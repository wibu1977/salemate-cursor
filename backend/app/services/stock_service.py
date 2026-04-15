"""
Centralised stock deduction + low-stock alert.
Called after every order confirmation path (Toss, OCR, admin approve).
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Product
from app.models.order import Order, OrderItem
from app.services.notification_service import NotificationService

logger = logging.getLogger("salemate.stock")


async def deduct_stock_and_alert(
    db: AsyncSession,
    order: Order,
) -> None:
    """
    For each OrderItem linked to a product, reduce quantity and fire
    a Messenger alert if the product drops to or below its threshold.
    """
    items_stmt = select(OrderItem).where(OrderItem.order_id == order.id)
    items_result = await db.execute(items_stmt)
    items = items_result.scalars().all()

    for item in items:
        if not item.product_id:
            continue

        stmt = select(Product).where(Product.id == item.product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            continue

        old_qty = product.quantity
        product.quantity = max(0, product.quantity - item.quantity)

        if product.quantity <= product.stock_threshold and old_qty > product.stock_threshold:
            try:
                await NotificationService.notify_low_stock(
                    order.workspace_id,
                    product.name,
                    product.quantity,
                    product.stock_threshold,
                )
            except Exception:
                logger.exception(
                    "Low-stock alert failed product=%s workspace=%s",
                    product.id, order.workspace_id,
                )
