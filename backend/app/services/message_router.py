import logging
from sqlalchemy import select

from app.database import async_session
from app.models.workspace import ShopPage
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("salemate.router")


class MessageRouter:
    """
    Routes incoming Meta events to the correct handler.
    Supports both Facebook Messenger and Instagram DM.
    """

    @staticmethod
    async def route(page_id: str, event: dict, platform: str = "facebook"):
        sender_id = event.get("sender", {}).get("id")
        if not sender_id:
            return

        # Echo from our own page — ignore
        recipient_id = event.get("recipient", {}).get("id")
        if sender_id == recipient_id:
            return

        message = event.get("message", {})
        postback = event.get("postback", {})
        referral = event.get("referral", {})
        optin = event.get("optin", {})

        # Recurring Notification opt-in
        if optin:
            await MessageRouter._handle_optin(page_id, sender_id, optin, platform)
            return

        # Referral (e.g. m.me link with ref param)
        if referral and not message and not postback:
            await MessageRouter._handle_referral(page_id, sender_id, referral, platform)
            return

        # Delivery receipts → campaign analytics (message_id → CampaignMessage)
        if event.get("delivery"):
            mids = event.get("delivery", {}).get("mids") or []
            if mids:
                from app.services.campaign_delivery_service import record_deliveries_for_mids

                async with async_session() as db:
                    await record_deliveries_for_mids(db, mids)
            return

        if event.get("read"):
            return

        # is_echo from page itself — skip
        if message.get("is_echo"):
            return

        if page_id == settings.SALEMATE_PAGE_ID:
            await MessageRouter._handle_admin_message(sender_id, message, postback)
        else:
            await MessageRouter._handle_shop_message(page_id, sender_id, message, postback, platform)

    @staticmethod
    async def _handle_shop_message(
        page_id: str, sender_id: str, message: dict, postback: dict, platform: str
    ):
        async with async_session() as db:
            stmt = select(ShopPage).where(
                ShopPage.page_id == page_id,
                ShopPage.is_active == True,
            )
            result = await db.execute(stmt)
            shop_page = result.scalar_one_or_none()

            if not shop_page:
                logger.warning("No active ShopPage for page_id=%s platform=%s", page_id, platform)
                return

            resolved_platform = shop_page.platform or platform

            from app.services.ai_service import AIService
            await AIService.handle_customer_message(
                db=db,
                workspace_id=shop_page.workspace_id,
                page_access_token=shop_page.page_access_token,
                sender_psid=sender_id,
                message=message,
                postback=postback,
                platform=resolved_platform,
            )

    @staticmethod
    async def _handle_admin_message(sender_id: str, message: dict, postback: dict):
        from app.services.admin_command_service import AdminCommandService
        await AdminCommandService.handle(sender_id, message, postback)

    @staticmethod
    async def _handle_optin(page_id: str, sender_id: str, optin: dict, platform: str):
        """
        Recurring Notification opt-in / opt-out.
        optin.type == "notification_messages" when user subscribes.
        """
        from app.services.customer_service import CustomerService

        notification_type = optin.get("type")
        token = optin.get("notification_messages_token")
        frequency = optin.get("notification_messages_frequency")
        status = optin.get("notification_messages_status")

        if notification_type != "notification_messages":
            return

        async with async_session() as db:
            shop_page = await MessageRouter._resolve_shop_page(db, page_id)
            if not shop_page:
                return

            if status == "STOP_NOTIFICATIONS":
                await CustomerService.set_recurring_opt(
                    db, shop_page.workspace_id, sender_id, platform,
                    opted_in=False, token=None,
                )
            else:
                await CustomerService.set_recurring_opt(
                    db, shop_page.workspace_id, sender_id, platform,
                    opted_in=True, token=token,
                )
                logger.info(
                    "Recurring opt-in: psid=%s freq=%s page=%s",
                    sender_id, frequency, page_id,
                )

    @staticmethod
    async def _handle_referral(page_id: str, sender_id: str, referral: dict, platform: str):
        """Handle m.me?ref=... deep links — treat as conversation start."""
        ref = referral.get("ref", "")
        logger.info("Referral: psid=%s ref=%s page=%s", sender_id, ref, page_id)
        await MessageRouter._handle_shop_message(
            page_id, sender_id,
            message={"text": ref or "Xin chào"},
            postback={},
            platform=platform,
        )

    @staticmethod
    async def _resolve_shop_page(db, page_id: str) -> ShopPage | None:
        stmt = select(ShopPage).where(ShopPage.page_id == page_id, ShopPage.is_active == True)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
