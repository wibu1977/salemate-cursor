"""Link Meta message_deliveries (mids) to campaign_messages for analytics."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignMessage


async def record_deliveries_for_mids(db: AsyncSession, mids: list[str]) -> None:
    """Increment campaign.opened_count once per CampaignMessage when Meta confirms delivery."""
    if not mids:
        return

    for mid in mids:
        stmt = select(CampaignMessage).where(CampaignMessage.meta_message_id == mid)
        result = await db.execute(stmt)
        row = result.scalar_one_or_none()
        if not row:
            continue
        if row.opened_at is not None:
            continue

        row.opened_at = datetime.utcnow()
        camp_stmt = select(Campaign).where(Campaign.id == row.campaign_id)
        cr = await db.execute(camp_stmt)
        campaign = cr.scalar_one_or_none()
        if campaign:
            campaign.opened_count = (campaign.opened_count or 0) + 1

    await db.commit()
