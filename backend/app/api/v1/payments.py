import logging
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.config import get_settings
from app.models.order import Order
from app.schemas.payment import (
    CheckoutRequest, CheckoutResponse,
    PaymentConfirmRequest, PaymentConfirmResponse,
    PaymentCancelRequest, OCRVerifyResponse, OrderPaymentStatus,
)
from app.services.payment_service import PaymentService
from app.services.ocr_service import OCRService

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("salemate.payments")

FRONTEND_URL = "http://localhost:3000"


# ------------------------------------------------------------------
# Toss Payments: Checkout flow
# ------------------------------------------------------------------

@router.post("/toss/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: Create checkout session data for Toss Payments widget.
    Returns client_key + order info for frontend to render Toss SDK.
    """
    frontend_base = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else FRONTEND_URL
    result = await PaymentService.create_checkout(
        db,
        payload.order_id,
        success_url=f"{frontend_base}/webview/payment/success",
        fail_url=f"{frontend_base}/webview/payment/fail",
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/toss/confirm", response_model=PaymentConfirmResponse)
async def confirm_payment(
    payload: PaymentConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2: Server-side payment confirmation.
    Called after Toss redirects customer to success URL with paymentKey.
    """
    if not payload.payment_key or not payload.order_id or not payload.amount:
        raise HTTPException(status_code=400, detail="Missing required fields")

    result = await PaymentService.confirm_payment(
        db, payload.payment_key, payload.order_id, payload.amount
    )
    return result


@router.post("/toss/webhook")
async def toss_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Backup webhook from Toss Payments.
    Verifies signature, then processes payment status.
    """
    raw_body = await request.body()
    signature = request.headers.get("Toss-Signature")

    if not PaymentService.verify_toss_webhook_signature(raw_body, signature):
        logger.warning("Toss webhook signature mismatch")
        raise HTTPException(status_code=403, detail="Invalid signature")

    body = await request.json()
    result = await PaymentService.handle_toss_webhook(db, body)
    return result


@router.post("/toss/cancel")
async def cancel_payment(
    payload: PaymentCancelRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel/refund a Toss payment. Admin only."""
    stmt = select(Order).where(
        Order.id == payload.order_id,
        Order.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found in this workspace")

    return await PaymentService.cancel_payment(db, payload.order_id, payload.reason)


# ------------------------------------------------------------------
# Order payment status (public, by memo_code)
# ------------------------------------------------------------------

@router.get("/status/{memo_code}", response_model=OrderPaymentStatus)
async def get_payment_status(
    memo_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: check payment status by memo_code."""
    stmt = select(Order).where(Order.memo_code == memo_code)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderPaymentStatus(
        order_id=order.id,
        memo_code=order.memo_code,
        status=order.status.value,
        payment_method=order.payment_method.value if order.payment_method else None,
        total_amount=order.total_amount,
        currency=order.currency,
        created_at=order.created_at.isoformat(),
        confirmed_at=order.confirmed_at.isoformat() if order.confirmed_at else None,
    )


# ------------------------------------------------------------------
# OCR Bill verification
# ------------------------------------------------------------------

@router.post("/ocr/verify", response_model=OCRVerifyResponse)
async def verify_bill_ocr(
    order_id: uuid.UUID,
    bill_image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload bill image, run OCR extraction + 4-layer fraud check."""
    result = await OCRService.verify_bill(db, order_id, bill_image)
    return result
