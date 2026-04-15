import base64
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.order import Order, OrderStatus, PaymentMethod

settings = get_settings()
logger = logging.getLogger("salemate.payment")

TOSS_API_URL = "https://api.tosspayments.com/v1"
KST = timezone(timedelta(hours=9))


def _toss_auth_header() -> str:
    return "Basic " + base64.b64encode(f"{settings.TOSS_SECRET_KEY}:".encode()).decode()


class PaymentService:
    """
    Toss Payments integration — pass-through model.
    Money goes directly to shop owner's Toss account, never retained in system.

    Flow:
    1. Customer picks Toss → backend creates checkout session
    2. Customer completes payment on Toss widget
    3. Toss redirects to our success URL with paymentKey
    4. Backend calls /payments/confirm to finalize
    5. Toss sends webhook as backup confirmation
    """

    # ------------------------------------------------------------------
    # Step 1: Create checkout session for a pending order
    # ------------------------------------------------------------------
    @staticmethod
    async def create_checkout(db: AsyncSession, order_id: uuid.UUID, success_url: str, fail_url: str) -> dict:
        stmt = (
            select(Order)
            .options(selectinload(Order.items), selectinload(Order.customer))
            .where(Order.id == order_id)
        )
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            return {"error": "Order not found"}

        if order.status not in (OrderStatus.PENDING, OrderStatus.PAYMENT_SENT):
            return {"error": f"Order status is {order.status.value}, cannot checkout"}

        order_name = ", ".join(
            f"{item.product_name} x{item.quantity}" for item in order.items
        ) or "Salemate Order"
        if len(order_name) > 100:
            order_name = order_name[:97] + "..."

        customer_name = order.customer.name if order.customer else "Customer"

        return {
            "order_id": str(order.id),
            "memo_code": order.memo_code,
            "amount": order.total_amount,
            "currency": order.currency,
            "order_name": order_name,
            "customer_name": customer_name,
            "customer_email": order.customer.email if order.customer else None,
            "success_url": f"{success_url}?memo_code={order.memo_code}",
            "fail_url": f"{fail_url}?memo_code={order.memo_code}",
            "toss_client_key": settings.TOSS_CLIENT_KEY,
        }

    # ------------------------------------------------------------------
    # Step 2: Confirm payment after Toss redirect (server-side)
    # ------------------------------------------------------------------
    @staticmethod
    async def confirm_payment(
        db: AsyncSession, payment_key: str, order_id: str, amount: int
    ) -> dict:
        stmt = (
            select(Order)
            .options(selectinload(Order.customer))
            .where(Order.memo_code == order_id)
        )
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            return {"success": False, "error": "Order not found"}

        if order.total_amount != amount:
            logger.error(
                "Amount mismatch: order %s expects %d, got %d",
                order.memo_code, order.total_amount, amount,
            )
            return {"success": False, "error": "Amount mismatch"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{TOSS_API_URL}/payments/confirm",
                    headers={
                        "Authorization": _toss_auth_header(),
                        "Content-Type": "application/json",
                    },
                    json={
                        "paymentKey": payment_key,
                        "orderId": order.memo_code,
                        "amount": amount,
                    },
                )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
            logger.error("Toss confirm network error for %s: %s", order.memo_code, exc)
            await PaymentService._send_fallback_transfer_message(db, order)
            return {
                "success": False,
                "error": f"Toss API unreachable: {type(exc).__name__}",
                "fallback": "bank_transfer_sent",
            }

        try:
            toss_data = response.json()
        except Exception:
            logger.error("Toss confirm returned non-JSON: status=%d body=%s", response.status_code, response.text[:200])
            await PaymentService._send_fallback_transfer_message(db, order)
            return {
                "success": False,
                "error": "Toss returned invalid response",
                "fallback": "bank_transfer_sent",
            }

        if response.status_code == 200 and toss_data.get("status") == "DONE":
            order.status = OrderStatus.CONFIRMED
            order.payment_method = PaymentMethod.TOSS
            order.toss_payment_key = payment_key
            order.confirmed_at = datetime.utcnow()

            from app.services.stock_service import deduct_stock_and_alert
            await deduct_stock_and_alert(db, order)

            await db.commit()

            from app.services.notification_service import NotificationService
            await NotificationService.notify_order_update(order)

            logger.info("Payment confirmed: %s key=%s", order.memo_code, payment_key)
            return {"success": True, "memo_code": order.memo_code, "status": "confirmed"}
        else:
            error_msg = toss_data.get("message", "Unknown error")
            logger.error("Toss confirm failed for %s: %s", order.memo_code, error_msg)
            return {"success": False, "error": error_msg, "toss_code": toss_data.get("code")}

    # ------------------------------------------------------------------
    # Webhook handler (backup confirmation from Toss)
    # ------------------------------------------------------------------
    @staticmethod
    async def handle_toss_webhook(db: AsyncSession, payload: dict) -> dict:
        payment_key = payload.get("paymentKey")
        order_id = payload.get("orderId")
        status = payload.get("status")

        if not payment_key or not order_id:
            return {"status": "ignored"}

        stmt = select(Order).where(Order.memo_code == order_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            logger.warning("Toss webhook: order %s not found", order_id)
            return {"status": "order_not_found"}

        if order.status == OrderStatus.CONFIRMED:
            return {"status": "already_confirmed"}

        if status == "DONE":
            order.status = OrderStatus.CONFIRMED
            order.payment_method = PaymentMethod.TOSS
            order.toss_payment_key = payment_key
            order.confirmed_at = datetime.utcnow()

            from app.services.stock_service import deduct_stock_and_alert
            await deduct_stock_and_alert(db, order)
        elif status == "CANCELED":
            order.status = OrderStatus.CANCELLED
        elif status in ("ABORTED", "EXPIRED"):
            order.status = OrderStatus.REJECTED

        await db.commit()

        from app.services.notification_service import NotificationService
        await NotificationService.notify_order_update(order)

        logger.info("Toss webhook processed: %s -> %s", order.memo_code, order.status.value)
        return {"status": "processed", "order_status": order.status.value}

    # ------------------------------------------------------------------
    # Cancel / Refund
    # ------------------------------------------------------------------
    @staticmethod
    async def cancel_payment(db: AsyncSession, order_id: uuid.UUID, reason: str = "") -> dict:
        stmt = select(Order).where(Order.id == order_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order or not order.toss_payment_key:
            return {"success": False, "error": "Order not found or no payment key"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{TOSS_API_URL}/payments/{order.toss_payment_key}/cancel",
                    headers={
                        "Authorization": _toss_auth_header(),
                        "Content-Type": "application/json",
                    },
                    json={"cancelReason": reason or "Customer requested cancellation"},
                )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
            logger.error("Toss cancel network error for %s: %s", order.memo_code, exc)
            return {"success": False, "error": f"Toss API unreachable: {type(exc).__name__}"}

        try:
            toss_data = response.json()
        except Exception:
            logger.error("Toss cancel returned non-JSON: status=%d body=%s", response.status_code, response.text[:200])
            return {"success": False, "error": "Toss returned invalid response"}

        if response.status_code == 200:
            order.status = OrderStatus.CANCELLED
            await db.commit()
            logger.info("Payment cancelled: %s", order.memo_code)
            return {"success": True, "memo_code": order.memo_code}
        else:
            error_msg = toss_data.get("message", "Cancel failed")
            logger.error("Toss cancel failed for %s: %s", order.memo_code, error_msg)
            return {"success": False, "error": error_msg}

    # ------------------------------------------------------------------
    # Query payment status from Toss
    # ------------------------------------------------------------------
    @staticmethod
    async def get_payment_status(payment_key: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{TOSS_API_URL}/payments/{payment_key}",
                    headers={"Authorization": _toss_auth_header()},
                )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
            logger.error("Toss status query network error: %s", exc)
            return {"error": f"Toss API unreachable: {type(exc).__name__}"}

        try:
            return response.json()
        except Exception:
            logger.error("Toss status returned non-JSON: status=%d", response.status_code)
            return {"error": "Toss returned invalid response"}

    # ------------------------------------------------------------------
    # Auto-Fallback: send bank transfer instructions via Messenger
    # ------------------------------------------------------------------
    @staticmethod
    async def _send_fallback_transfer_message(db: AsyncSession, order: Order):
        """
        When Toss is down, immediately message the customer via Messenger
        with bank transfer instructions so the order isn't stuck.
        """
        try:
            from app.services.meta_service import MetaService
            from app.models.workspace import ShopPage

            customer = order.customer
            if not customer:
                return

            sender_psid = customer.facebook_psid or customer.instagram_psid
            if not sender_psid:
                return

            page_stmt = select(ShopPage).where(
                ShopPage.workspace_id == order.workspace_id,
                ShopPage.is_active == True,
            )
            page_result = await db.execute(page_stmt)
            shop_page = page_result.scalars().first()
            if not shop_page:
                return

            fallback_msg = (
                f"⚠️ Rất xin lỗi bạn, cổng thanh toán Toss Payments hiện đang quá tải.\n\n"
                f"Để không làm chậm trễ đơn hàng, bạn vui lòng thanh toán bằng "
                f"phương thức chuyển khoản nhé.\n\n"
                f"Nội dung chuyển khoản (Memo):\n"
                f"👉 {order.memo_code}\n\n"
                f"Sau khi chuyển xong, bạn cứ gửi ảnh bill vào đây "
                f"để AI xác nhận tự động nha! 📸"
            )

            await MetaService.send_text(shop_page.page_access_token, sender_psid, fallback_msg)
            logger.info("Fallback bank transfer message sent for order %s to psid %s", order.memo_code, sender_psid)

        except Exception as msg_exc:
            logger.error("Failed to send fallback message for %s: %s", order.memo_code, msg_exc)

    # ------------------------------------------------------------------
    # Webhook signature verification
    # ------------------------------------------------------------------
    @staticmethod
    def verify_toss_webhook_signature(payload_body: bytes, signature: str | None) -> bool:
        if not settings.TOSS_WEBHOOK_SECRET or not signature:
            return True
        expected = hmac.new(
            settings.TOSS_WEBHOOK_SECRET.encode(),
            payload_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
