import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.customer import Customer
from app.services.meta_service import MetaService

logger = logging.getLogger("salemate.customer")


class CustomerService:
    """
    Single Customer View (SCV) — phone number is the merge key.
    When a customer provides their phone, we try to unify FB + IG profiles.
    """

    @staticmethod
    async def get_or_create(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        psid: str,
        platform: str,
        page_access_token: str | None = None,
    ) -> Customer:
        """Look up by PSID first, then return existing or create new."""
        psid_field = Customer.facebook_psid if platform == "facebook" else Customer.instagram_psid
        stmt = select(Customer).where(
            Customer.workspace_id == workspace_id,
            psid_field == psid,
        )
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()

        if customer:
            return customer

        name = None
        if page_access_token:
            try:
                profile = await MetaService.get_user_profile(page_access_token, psid)
                first = profile.get("first_name", "")
                last = profile.get("last_name", "")
                name = f"{first} {last}".strip() or None
            except Exception:
                pass

        customer = Customer(
            workspace_id=workspace_id,
            name=name,
            **{f"{platform}_psid": psid},
        )
        db.add(customer)
        await db.flush()
        logger.info("Created customer %s for %s psid=%s", customer.id, platform, psid)
        return customer

    @staticmethod
    async def merge_by_phone(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        customer_id: uuid.UUID,
        phone: str,
    ) -> Customer:
        """
        After a customer provides their phone number, check if another
        record with the same phone already exists (from a different channel).
        If so, merge both profiles into one SCV record.
        """
        phone = phone.strip().replace(" ", "").replace("-", "")

        current_stmt = select(Customer).where(Customer.id == customer_id)
        result = await db.execute(current_stmt)
        current = result.scalar_one()

        if current.phone == phone:
            return current

        existing_stmt = select(Customer).where(
            Customer.workspace_id == workspace_id,
            Customer.phone == phone,
            Customer.id != customer_id,
        )
        existing_result = await db.execute(existing_stmt)
        existing = existing_result.scalar_one_or_none()

        if not existing:
            current.phone = phone
            return current

        # Merge: keep the record that has more history, absorb the other
        keeper, absorbed = (existing, current) if existing.total_orders >= current.total_orders else (current, existing)

        if absorbed.facebook_psid and not keeper.facebook_psid:
            keeper.facebook_psid = absorbed.facebook_psid
        if absorbed.instagram_psid and not keeper.instagram_psid:
            keeper.instagram_psid = absorbed.instagram_psid
        if absorbed.email and not keeper.email:
            keeper.email = absorbed.email
        if absorbed.name and not keeper.name:
            keeper.name = absorbed.name

        keeper.phone = phone
        keeper.total_orders += absorbed.total_orders
        keeper.total_spent += absorbed.total_spent
        if absorbed.last_order_at and (not keeper.last_order_at or absorbed.last_order_at > keeper.last_order_at):
            keeper.last_order_at = absorbed.last_order_at
        if absorbed.opted_in_recurring:
            keeper.opted_in_recurring = True
            keeper.recurring_token = absorbed.recurring_token or keeper.recurring_token

        # Re-parent absorbed customer's orders
        from app.models.order import Order
        orders_stmt = select(Order).where(Order.customer_id == absorbed.id)
        orders_result = await db.execute(orders_stmt)
        for order in orders_result.scalars():
            order.customer_id = keeper.id

        # Re-parent conversations
        from app.models.conversation import Conversation
        conv_stmt = select(Conversation).where(Conversation.customer_id == absorbed.id)
        conv_result = await db.execute(conv_stmt)
        for conv in conv_result.scalars():
            conv.customer_id = keeper.id

        await db.delete(absorbed)
        logger.info(
            "Merged customer %s into %s via phone=%s",
            absorbed.id, keeper.id, phone,
        )
        return keeper

    @staticmethod
    async def set_recurring_opt(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        psid: str,
        platform: str,
        opted_in: bool,
        token: str | None,
    ):
        """Update Recurring Notification opt-in status."""
        psid_field = Customer.facebook_psid if platform == "facebook" else Customer.instagram_psid
        stmt = select(Customer).where(
            Customer.workspace_id == workspace_id,
            psid_field == psid,
        )
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()

        if not customer:
            customer = Customer(
                workspace_id=workspace_id,
                **{f"{platform}_psid": psid},
            )
            db.add(customer)

        customer.opted_in_recurring = opted_in
        customer.recurring_token = token
        await db.commit()

    @staticmethod
    async def find_by_phone(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        phone: str,
    ) -> Customer | None:
        phone = phone.strip().replace(" ", "").replace("-", "")
        stmt = select(Customer).where(
            Customer.workspace_id == workspace_id,
            Customer.phone == phone,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
