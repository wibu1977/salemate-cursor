import asyncio
import logging
from datetime import datetime
from sqlalchemy import select

from app.workers import celery_app
from app.database import async_session
from app.models.campaign import Campaign, CampaignMessage, CampaignStatus
from app.models.customer import Customer
from app.services.meta_service import MetaService
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("salemate.outreach")


@celery_app.task
def send_campaign_messages(campaign_id: str):
    asyncio.get_event_loop().run_until_complete(_send_messages(campaign_id))


async def _send_messages(campaign_id: str):
    async with async_session() as db:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        result = await db.execute(stmt)
        campaign = result.scalar_one_or_none()

        if not campaign or campaign.status != CampaignStatus.APPROVED:
            return

        campaign.status = CampaignStatus.SENDING

        # Query recipients: prefer segment_id FK, fallback to cluster string.
        # This ensures campaigns scheduled before a clustering re-run
        # still target the exact segment snapshot they were approved for.
        if campaign.target_segment_id:
            customer_stmt = select(Customer).where(
                Customer.workspace_id == campaign.workspace_id,
                Customer.segment_id == campaign.target_segment_id,
                Customer.opted_in_recurring == True,
                Customer.facebook_psid.isnot(None),
            )
        else:
            customer_stmt = select(Customer).where(
                Customer.workspace_id == campaign.workspace_id,
                Customer.cluster == campaign.target_cluster,
                Customer.opted_in_recurring == True,
                Customer.facebook_psid.isnot(None),
            )

        customer_result = await db.execute(customer_stmt)
        customers = customer_result.scalars().all()

        for customer in customers:
            try:
                send_result: dict = {}
                if customer.recurring_token:
                    send_result = await MetaService.send_recurring_notification(
                        settings.SALEMATE_PAGE_ACCESS_TOKEN,
                        customer.recurring_token,
                        campaign.message_template,
                    ) or {}
                else:
                    send_result = await MetaService.send_text(
                        settings.SALEMATE_PAGE_ACCESS_TOKEN,
                        customer.facebook_psid,
                        campaign.message_template,
                    ) or {}

                mid = send_result.get("message_id")

                msg = CampaignMessage(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    content=campaign.message_template,
                    status="sent",
                    sent_at=datetime.utcnow(),
                    meta_message_id=mid,
                )
                db.add(msg)
                campaign.sent_count += 1

            except Exception:
                logger.exception("Failed to send to customer %s", customer.id)
                msg = CampaignMessage(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    content=campaign.message_template,
                    status="failed",
                )
                db.add(msg)

        campaign.status = CampaignStatus.COMPLETED
        campaign.completed_at = datetime.utcnow()
        await db.commit()

        logger.info(
            "Campaign %s completed: sent=%d total=%d",
            campaign.name, campaign.sent_count, len(customers),
        )
