import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.workers import celery_app
from app.database import async_session
from app.models.workspace import Workspace
from app.services.admin_service import AdminService
from app.services.notification_service import NotificationService

logger = logging.getLogger("salemate.daily_report")
KST = timezone(timedelta(hours=9))


@celery_app.task
def generate_daily_reports():
    """Send daily summary to each workspace owner at their configured hour (KST)."""
    asyncio.get_event_loop().run_until_complete(_generate_reports())


async def _generate_reports():
    current_hour_kst = datetime.now(KST).hour

    async with async_session() as db:
        stmt = select(Workspace).where(
            Workspace.is_active == True,
            Workspace.report_hour == current_hour_kst,
        )
        result = await db.execute(stmt)
        workspaces = result.scalars().all()

        for workspace in workspaces:
            try:
                summary = await AdminService.get_summary(db, workspace.id)

                report_data = {
                    "revenue_today": summary.total_revenue_today,
                    "revenue_week": summary.total_revenue_week,
                    "revenue_month": summary.total_revenue_month,
                    "orders_confirmed": summary.orders_confirmed,
                    "orders_pending": summary.orders_pending,
                    "orders_flagged": summary.orders_flagged,
                    "top_products": summary.top_products,
                    "low_stock_alerts": summary.low_stock_alerts,
                }

                await NotificationService.send_daily_report(workspace.id, report_data)
                logger.info("Daily report sent for workspace %s", workspace.id)
            except Exception:
                logger.exception("Daily report failed for workspace %s", workspace.id)
