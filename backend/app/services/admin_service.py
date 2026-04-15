import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, OrderStatus
from app.models.customer import Customer
from app.models.fraud_log import FraudLog
from app.models.inventory import Product
from app.schemas.admin import DashboardSummary, OrderActionRequest

KST = timezone(timedelta(hours=9))


class AdminService:
    @staticmethod
    async def get_summary(db: AsyncSession, workspace_id: uuid.UUID) -> DashboardSummary:
        now_kst = datetime.now(KST)
        today_start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start_kst = today_start_kst - timedelta(days=now_kst.weekday())
        month_start_kst = today_start_kst.replace(day=1)

        today_start_utc = today_start_kst.astimezone(timezone.utc).replace(tzinfo=None)
        week_start_utc = week_start_kst.astimezone(timezone.utc).replace(tzinfo=None)
        month_start_utc = month_start_kst.astimezone(timezone.utc).replace(tzinfo=None)

        async def revenue_since(since: datetime) -> int:
            stmt = select(func.coalesce(func.sum(Order.total_amount), 0)).where(
                Order.workspace_id == workspace_id,
                Order.status == OrderStatus.CONFIRMED,
                Order.confirmed_at >= since,
            )
            result = await db.execute(stmt)
            return result.scalar()

        async def count_by_status(status: OrderStatus) -> int:
            stmt = select(func.count(Order.id)).where(
                Order.workspace_id == workspace_id,
                Order.status == status,
            )
            result = await db.execute(stmt)
            return result.scalar()

        low_stock_stmt = select(Product).where(
            Product.workspace_id == workspace_id,
            Product.is_active == True,
            Product.quantity <= Product.stock_threshold,
        )
        low_stock_result = await db.execute(low_stock_stmt)
        low_stock = [
            {"name": p.name, "quantity": p.quantity, "threshold": p.stock_threshold}
            for p in low_stock_result.scalars()
        ]

        top_products = await AdminService._top_products_today(db, workspace_id, today_start_utc)

        return DashboardSummary(
            total_revenue_today=await revenue_since(today_start_utc),
            total_revenue_week=await revenue_since(week_start_utc),
            total_revenue_month=await revenue_since(month_start_utc),
            orders_pending=await count_by_status(OrderStatus.PENDING),
            orders_confirmed=await count_by_status(OrderStatus.CONFIRMED),
            orders_flagged=await count_by_status(OrderStatus.FLAGGED),
            top_products=top_products,
            low_stock_alerts=low_stock,
        )

    @staticmethod
    async def _top_products_today(
        db: AsyncSession, workspace_id: uuid.UUID, since_utc: datetime
    ) -> list[dict]:
        """Top 5 products by quantity sold today."""
        stmt = (
            select(
                OrderItem.product_name,
                func.sum(OrderItem.quantity).label("qty"),
                func.sum(OrderItem.subtotal).label("revenue"),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(
                Order.workspace_id == workspace_id,
                Order.status == OrderStatus.CONFIRMED,
                Order.confirmed_at >= since_utc,
            )
            .group_by(OrderItem.product_name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(5)
        )
        result = await db.execute(stmt)
        return [
            {"name": row.product_name, "quantity": row.qty, "revenue": row.revenue}
            for row in result.all()
        ]

    @staticmethod
    async def list_orders(
        db: AsyncSession, workspace_id: uuid.UUID,
        status: str | None, page: int, size: int
    ) -> list:
        stmt = (
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.customer))
            .where(Order.workspace_id == workspace_id)
        )
        if status:
            stmt = stmt.where(Order.status == status)
        stmt = stmt.order_by(Order.created_at.desc()).offset((page - 1) * size).limit(size)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_order_detail(
        db: AsyncSession, workspace_id: uuid.UUID, order_id: uuid.UUID
    ):
        stmt = (
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.customer),
                selectinload(Order.fraud_logs),
            )
            .where(
                Order.id == order_id,
                Order.workspace_id == workspace_id,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def handle_order_action(
        db: AsyncSession, workspace_id: uuid.UUID,
        order_id: uuid.UUID, payload: OrderActionRequest
    ):
        stmt = (
            select(Order)
            .options(selectinload(Order.customer))
            .where(
                Order.id == order_id,
                Order.workspace_id == workspace_id,
            )
        )
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            return {"error": "Order not found"}

        if payload.action == "approve":
            order.status = OrderStatus.CONFIRMED
            order.confirmed_at = datetime.utcnow()

            from app.services.stock_service import deduct_stock_and_alert
            await deduct_stock_and_alert(db, order)
        elif payload.action == "reject":
            order.status = OrderStatus.REJECTED

        await db.commit()

        from app.services.notification_service import NotificationService
        await NotificationService.notify_order_update(order)

        return {"status": "ok", "order_status": order.status.value}
