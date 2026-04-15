import re
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.order import Order, OrderStatus, PaymentMethod
from app.models.fraud_log import FraudLog, FraudCheckResult
from app.models.customer import Customer
from app.utils.image_hash import compute_image_hash

settings = get_settings()

KST = timezone(timedelta(hours=9))


class OCRService:
    """
    Google Cloud Vision OCR + 4-layer fraud detection.
    Fallback to Tesseract if needed.
    """

    @staticmethod
    async def verify_bill(db: AsyncSession, order_id: uuid.UUID, bill_image) -> dict:
        stmt = select(Order).where(Order.id == order_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            return {"order_id": order_id, "status": "error", "checks": {}, "flag_reason": "Order not found"}

        image_bytes = await bill_image.read()

        from app.services.storage_service import StorageService
        image_url = await StorageService.upload_bill_image(image_bytes, str(order_id))
        order.bill_image_url = image_url

        image_hash = compute_image_hash(image_bytes)
        order.bill_image_hash = image_hash

        ocr_data = await OCRService._extract_ocr_data(image_bytes)
        order.ocr_data = ocr_data

        checks = await OCRService._run_fraud_checks(db, order, ocr_data, image_hash)

        all_passed = all(v == "pass" for v in checks.values())
        has_reject = any(v == "reject" for v in checks.values())

        if all_passed:
            order.status = OrderStatus.CONFIRMED
            order.payment_method = PaymentMethod.OCR_VERIFIED
            order.confirmed_at = datetime.utcnow()
            status = "confirmed"

            from app.services.stock_service import deduct_stock_and_alert
            await deduct_stock_and_alert(db, order)
        elif has_reject:
            order.status = OrderStatus.REJECTED
            status = "rejected"
        else:
            order.status = OrderStatus.FLAGGED
            order.flag_reason = ", ".join(k for k, v in checks.items() if v == "flag")
            status = "flagged"

        await db.commit()

        if not all_passed:
            from app.services.notification_service import NotificationService
            await NotificationService.notify_fraud_alert(order, checks)

        return {
            "order_id": order_id,
            "status": status,
            "checks": checks,
            "flag_reason": order.flag_reason,
        }

    @staticmethod
    async def verify_bill_from_messenger(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        sender_psid: str,
        image_url: str,
        page_access_token: str,
    ):
        """Handle bill image sent via Messenger."""
        stmt = select(Customer).where(
            Customer.workspace_id == workspace_id,
            Customer.facebook_psid == sender_psid,
        )
        result = await db.execute(stmt)
        customer = result.scalar_one_or_none()
        if not customer:
            return

        from app.services.order_service import OrderService
        order = await OrderService.get_pending_order_for_customer(db, workspace_id, customer.id)
        if not order:
            from app.services.meta_service import MetaService
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Không tìm thấy đơn hàng đang chờ thanh toán."
            )
            return

        async with httpx.AsyncClient() as client:
            resp = await client.get(image_url)
            image_bytes = resp.content

        from app.services.storage_service import StorageService
        uploaded_url = await StorageService.upload_bill_image(image_bytes, str(order.id))
        order.bill_image_url = uploaded_url

        image_hash = compute_image_hash(image_bytes)
        order.bill_image_hash = image_hash

        ocr_data = await OCRService._extract_ocr_data(image_bytes)
        order.ocr_data = ocr_data

        checks = await OCRService._run_fraud_checks(db, order, ocr_data, image_hash)

        all_passed = all(v == "pass" for v in checks.values())
        has_reject = any(v == "reject" for v in checks.values())

        from app.services.meta_service import MetaService

        if all_passed:
            order.status = OrderStatus.CONFIRMED
            order.payment_method = PaymentMethod.OCR_VERIFIED
            order.confirmed_at = datetime.utcnow()

            from app.services.stock_service import deduct_stock_and_alert
            await deduct_stock_and_alert(db, order)

            await MetaService.send_text(
                page_access_token, sender_psid,
                f"✅ Thanh toán đã được xác nhận!\nMã đơn: {order.memo_code}\nCảm ơn bạn đã mua hàng!"
            )
        elif has_reject:
            order.status = OrderStatus.REJECTED
            await MetaService.send_text(
                page_access_token, sender_psid,
                "❌ Ảnh bill không hợp lệ. Vui lòng gửi lại ảnh bill chuyển khoản chính xác."
            )
        else:
            order.status = OrderStatus.FLAGGED
            order.flag_reason = ", ".join(k for k, v in checks.items() if v == "flag")
            await MetaService.send_text(
                page_access_token, sender_psid,
                "⏳ Ảnh bill đang được kiểm tra. Chủ shop sẽ xác nhận trong thời gian sớm nhất."
            )
            from app.services.notification_service import NotificationService
            await NotificationService.notify_fraud_alert(order, checks)

        await db.commit()

    @staticmethod
    async def _extract_ocr_data(image_bytes: bytes) -> dict:
        """
        Extract text from bill image.
        Primary: Google Cloud Vision.
        Fallback: pytesseract (local) when Vision API fails or quota exhausted.
        """
        empty = {"raw_text": "", "bill_time": None, "bill_memo": None, "bill_amount": None}

        # --- Primary: Google Cloud Vision ---
        try:
            from google.cloud import vision
            client = vision.ImageAnnotatorClient()
            image = vision.Image(content=image_bytes)
            response = client.text_detection(image=image)

            if response.error.message:
                raise RuntimeError(f"Vision API error: {response.error.message}")

            texts = response.text_annotations
            if texts:
                raw_text = texts[0].description
                result = OCRService._parse_bill_text(raw_text)
                result["ocr_engine"] = "google_vision"
                return result

        except Exception as vision_exc:
            # --- Fallback: Tesseract OCR ---
            try:
                import pytesseract
                from PIL import Image
                import io

                img = Image.open(io.BytesIO(image_bytes))

                gray = img.convert("L")
                threshold = gray.point(lambda px: 255 if px > 180 else 0, "1")

                raw_text = pytesseract.image_to_string(
                    threshold,
                    lang="kor+vie+eng",
                    config="--psm 6",
                )

                if raw_text.strip():
                    result = OCRService._parse_bill_text(raw_text)
                    result["ocr_engine"] = "tesseract"
                    result["vision_error"] = str(vision_exc)
                    return result

            except Exception as tess_exc:
                return {
                    **empty,
                    "error": f"Both OCR engines failed. Vision: {vision_exc} | Tesseract: {tess_exc}",
                }

        return empty

    @staticmethod
    def _parse_bill_text(raw_text: str) -> dict:
        """Parse extracted OCR text to find bill_time, bill_memo, bill_amount."""
        data = {"raw_text": raw_text, "bill_time": None, "bill_memo": None, "bill_amount": None}

        memo_match = re.search(r"SM[_\s-]?\d{4,}", raw_text, re.IGNORECASE)
        if memo_match:
            data["bill_memo"] = memo_match.group()

        amount_patterns = [
            r"(\d{1,3}(?:[,.\s]\d{3})+)\s*(?:원|KRW|VND|đ|₫|₩)",
            r"(?:금액|amount|số tiền|거래금액|입금)[:\s]*(\d{1,3}(?:[,.\s]\d{3})+)",
            r"(\d{4,})\s*(?:원|KRW|VND|đ|₫|₩)",
        ]
        for pattern in amount_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                raw_amount = match.group(1).replace(",", "").replace(".", "").replace(" ", "")
                data["bill_amount"] = int(raw_amount)
                break

        time_patterns = [
            r"(\d{4}[-/.]\d{2}[-/.]\d{2}\s+\d{2}:\d{2}(?::\d{2})?)",
            r"(\d{2}[-/.]\d{2}[-/.]\d{4}\s+\d{2}:\d{2}(?::\d{2})?)",
            r"(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2})",
        ]
        for pattern in time_patterns:
            match = re.search(pattern, raw_text)
            if match:
                data["bill_time"] = match.group(1)
                break

        return data

    @staticmethod
    def _normalize_memo(raw: str | None) -> str:
        """SM_123456 / sm 123456 / SM-123456 → SM_123456"""
        if not raw:
            return ""
        return re.sub(r"[\s_-]+", "_", raw.strip()).upper()

    @staticmethod
    def _to_utc(dt: datetime) -> datetime:
        """
        Bill timestamps from Korean banks are KST (UTC+9).
        If the parsed datetime is naive, assume KST and convert to UTC.
        If already aware, convert to UTC directly.
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=KST)
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    async def _run_fraud_checks(
        db: AsyncSession, order: Order, ocr_data: dict, image_hash: str
    ) -> dict:
        """4-layer fraud detection."""
        checks = {}

        # Layer 1: Time check — bill timestamps are KST, order.created_at is UTC
        bill_time_str = ocr_data.get("bill_time")
        if bill_time_str:
            try:
                from dateutil import parser as date_parser
                bill_time_raw = date_parser.parse(bill_time_str)
                bill_time_utc = OCRService._to_utc(bill_time_raw)
                order_created_utc = order.created_at

                skew = timedelta(minutes=3)
                if bill_time_utc >= (order_created_utc - skew):
                    checks["time"] = "pass"
                else:
                    checks["time"] = "reject"
                    await OCRService._log_fraud(
                        db, order.id, "time", FraudCheckResult.REJECT,
                        f"Bill {bill_time_utc.isoformat()} < order {order_created_utc.isoformat()} (even with 3m skew)",
                    )
            except Exception as exc:
                checks["time"] = "flag"
                await OCRService._log_fraud(
                    db, order.id, "time", FraudCheckResult.FLAG,
                    f"Cannot parse bill time '{bill_time_str}': {exc}",
                )
        else:
            checks["time"] = "flag"
            await OCRService._log_fraud(db, order.id, "time", FraudCheckResult.FLAG, "No time found in bill")

        # Layer 2: Memo check — normalize both sides before comparing
        bill_memo_raw = ocr_data.get("bill_memo")
        bill_memo_norm = OCRService._normalize_memo(bill_memo_raw)
        order_memo_norm = OCRService._normalize_memo(order.memo_code)

        if bill_memo_norm and bill_memo_norm == order_memo_norm:
            checks["memo"] = "pass"
        else:
            checks["memo"] = "flag"
            await OCRService._log_fraud(
                db, order.id, "memo", FraudCheckResult.FLAG,
                f"Expected '{order_memo_norm}', got '{bill_memo_norm}' (raw: '{bill_memo_raw}')",
            )

        # Layer 3: Amount check — allow ±1 rounding tolerance
        bill_amount = ocr_data.get("bill_amount")
        if bill_amount is not None and abs(bill_amount - order.total_amount) <= 1:
            checks["amount"] = "pass"
        else:
            checks["amount"] = "flag"
            await OCRService._log_fraud(
                db, order.id, "amount", FraudCheckResult.FLAG,
                f"Expected {order.total_amount}, got {bill_amount}",
            )

        # Layer 4: Duplicate check (perceptual image hash)
        stmt = select(Order).where(
            Order.bill_image_hash == image_hash,
            Order.id != order.id,
            Order.status == OrderStatus.CONFIRMED,
        )
        result = await db.execute(stmt)
        duplicate = result.scalar_one_or_none()
        if duplicate:
            checks["duplicate"] = "reject"
            await OCRService._log_fraud(
                db, order.id, "duplicate", FraudCheckResult.REJECT,
                f"Duplicate of order {duplicate.memo_code}",
            )
        else:
            checks["duplicate"] = "pass"

        return checks

    @staticmethod
    async def _log_fraud(
        db: AsyncSession, order_id: uuid.UUID,
        check_type: str, result: FraudCheckResult, details: str
    ):
        log = FraudLog(
            order_id=order_id,
            check_type=check_type,
            result=result,
            details=details,
        )
        db.add(log)
