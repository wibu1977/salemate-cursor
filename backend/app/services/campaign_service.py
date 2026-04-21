import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sql_delete
from sqlalchemy.orm import selectinload
from openai import AsyncOpenAI

from app.config import get_settings
from app.models.campaign import Campaign, CampaignMessage, CampaignStatus
from app.models.customer import Customer
from app.models.segment import CustomerSegment
from app.schemas.campaign import CampaignCreate, CampaignApproveRequest

settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

KST = timezone(timedelta(hours=9))


class CampaignService:
    @staticmethod
    async def list_campaigns(db: AsyncSession, workspace_id: uuid.UUID) -> list:
        stmt = (
            select(Campaign)
            .options(selectinload(Campaign.target_segment))
            .where(Campaign.workspace_id == workspace_id)
            .order_by(Campaign.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def list_available_segments(db: AsyncSession, workspace_id: uuid.UUID) -> list[CustomerSegment]:
        """Return only is_latest=True segments for the campaign creation UI."""
        stmt = (
            select(CustomerSegment)
            .where(
                CustomerSegment.workspace_id == workspace_id,
                CustomerSegment.is_latest == True,
            )
            .order_by(CustomerSegment.customer_count.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_campaign(
        db: AsyncSession, workspace_id: uuid.UUID, payload: CampaignCreate
    ) -> Campaign:
        # Determine target: segment_id (preferred) or cluster string (fallback)
        segment: CustomerSegment | None = None
        if payload.target_segment_id:
            seg_stmt = select(CustomerSegment).where(CustomerSegment.id == payload.target_segment_id)
            seg_result = await db.execute(seg_stmt)
            segment = seg_result.scalar_one_or_none()

        if segment:
            recipients_stmt = select(func.count(Customer.id)).where(
                Customer.workspace_id == workspace_id,
                Customer.segment_id == segment.id,
                Customer.opted_in_recurring == True,
            )
        else:
            recipients_stmt = select(func.count(Customer.id)).where(
                Customer.workspace_id == workspace_id,
                Customer.cluster == payload.target_cluster,
                Customer.opted_in_recurring == True,
            )

        result = await db.execute(recipients_stmt)
        total_recipients = result.scalar() or 0

        message_template = payload.message_template
        if not message_template:
            message_template = await CampaignService._generate_message(
                workspace_id,
                segment.label if segment else payload.target_cluster,
                segment.description if segment else None,
                segment.recommendation if segment else None,
                db,
            )

        campaign = Campaign(
            workspace_id=workspace_id,
            name=payload.name,
            target_cluster=segment.label if segment else payload.target_cluster,
            target_segment_id=segment.id if segment else None,
            status=CampaignStatus.PENDING_APPROVAL,
            message_template=message_template,
            ai_generated=not bool(payload.message_template),
            total_recipients=total_recipients,
        )
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        await CampaignService.notify_owner_campaign_pending(db, campaign, workspace_id)
        return campaign

    @staticmethod
    async def get_campaign(
        db: AsyncSession, workspace_id: uuid.UUID, campaign_id: uuid.UUID
    ) -> Campaign | None:
        stmt = (
            select(Campaign)
            .options(selectinload(Campaign.target_segment))
            .where(
                Campaign.id == campaign_id,
                Campaign.workspace_id == workspace_id,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_campaign_any(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign | None:
        stmt = (
            select(Campaign)
            .options(selectinload(Campaign.target_segment))
            .where(Campaign.id == campaign_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update_campaign(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        campaign_id: uuid.UUID,
        name: str | None,
        message_template: str | None,
    ) -> Campaign | None:
        campaign = await CampaignService.get_campaign(db, workspace_id, campaign_id)
        if not campaign:
            return None
        if campaign.status not in (
            CampaignStatus.DRAFT,
            CampaignStatus.PENDING_APPROVAL,
        ):
            return None
        if name is not None:
            campaign.name = name
        if message_template is not None:
            campaign.message_template = message_template
            campaign.ai_generated = False
        await db.commit()
        await db.refresh(campaign)
        return campaign

    @staticmethod
    async def delete_campaign(
        db: AsyncSession, workspace_id: uuid.UUID, campaign_id: uuid.UUID
    ) -> bool:
        campaign = await CampaignService.get_campaign(db, workspace_id, campaign_id)
        if not campaign:
            return False
        if campaign.status not in (
            CampaignStatus.DRAFT,
            CampaignStatus.PENDING_APPROVAL,
            CampaignStatus.CANCELLED,
        ):
            return False
        await db.execute(
            sql_delete(CampaignMessage).where(CampaignMessage.campaign_id == campaign_id)
        )
        await db.execute(
            sql_delete(Campaign).where(
                Campaign.id == campaign_id,
                Campaign.workspace_id == workspace_id,
            )
        )
        await db.commit()
        return True

    @staticmethod
    async def handle_approval(
        db: AsyncSession, workspace_id: uuid.UUID,
        campaign_id: uuid.UUID, payload: CampaignApproveRequest
    ) -> dict:
        campaign = await CampaignService.get_campaign(db, workspace_id, campaign_id)
        if not campaign:
            return {"error": "Campaign not found"}

        if payload.custom_message:
            campaign.message_template = payload.custom_message
            campaign.ai_generated = False

        if payload.action == "approve":
            campaign.status = CampaignStatus.APPROVED
            campaign.approved_at = datetime.now(KST)
            from app.workers.outreach import send_campaign_messages
            send_campaign_messages.delay(str(campaign.id))
        elif payload.action == "rewrite":
            segment = campaign.target_segment
            new_message = await CampaignService._generate_message(
                workspace_id,
                segment.label if segment else campaign.target_cluster,
                segment.description if segment else None,
                segment.recommendation if segment else None,
                db,
            )
            campaign.message_template = new_message
            campaign.status = CampaignStatus.PENDING_APPROVAL
        elif payload.action == "cancel":
            campaign.status = CampaignStatus.CANCELLED

        await db.commit()
        return {"status": "ok", "campaign_status": campaign.status.value}

    @staticmethod
    async def notify_owner_campaign_pending(
        db: AsyncSession, campaign: Campaign, workspace_id: uuid.UUID
    ) -> None:
        """Push Messenger to workspace owner with webview link (Phase 6)."""
        from app.models.workspace import Workspace
        from app.services.meta_service import MetaService
        from app.utils.campaign_webview_jwt import create_campaign_webview_token

        ws = await db.get(Workspace, workspace_id)
        if not ws or not ws.owner_facebook_id or not settings.SALEMATE_PAGE_ACCESS_TOKEN:
            return

        try:
            token = create_campaign_webview_token(campaign.id)
            base = (settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "").rstrip("/")
            if not base:
                return
            url = f"{base}/webview/campaign/{campaign.id}?token={token}"
            owner_psid = ws.owner_facebook_id
            await MetaService.send_text(
                settings.SALEMATE_PAGE_ACCESS_TOKEN,
                owner_psid,
                f"📣 Chiến dịch \"{campaign.name}\" cần bạn duyệt trước khi gửi khách.\n"
                f"Người nhận dự kiến: {campaign.total_recipients}",
            )
            await MetaService.send_webview_button(
                settings.SALEMATE_PAGE_ACCESS_TOKEN,
                owner_psid,
                "Mở bản xem trước và duyệt trong webview:",
                "Duyệt chiến dịch",
                url,
            )
        except Exception:
            import logging
            logging.getLogger("salemate.campaign").exception(
                "notify_owner_campaign_pending failed campaign=%s", campaign.id
            )

    @staticmethod
    async def _generate_message(
        workspace_id: uuid.UUID,
        target_label: str,
        segment_description: str | None,
        segment_recommendation: str | None,
        db: AsyncSession,
    ) -> str:
        from app.models.workspace import Workspace
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one()

        context_lines = [
            f"Cua hang: '{workspace.name}'",
            f"Nhom khach hang: '{target_label}'",
        ]
        if segment_description:
            context_lines.append(f"Dac diem nhom: {segment_description}")
        if segment_recommendation:
            context_lines.append(f"Goi y marketing: {segment_recommendation}")

        prompt = (
            "\n".join(context_lines)
            + "\n\nSoan mot tin nhan ngan gon (duoi 160 ky tu), than thien, "
            "co call-to-action ro rang, phu hop gui qua Messenger.\n"
            "Ngon ngu: Tieng Viet."
        )

        completion = await openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=200,
        )

        return completion.choices[0].message.content.strip()
