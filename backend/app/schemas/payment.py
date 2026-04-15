from pydantic import BaseModel
from typing import Any
import uuid


class CheckoutRequest(BaseModel):
    order_id: uuid.UUID


class CheckoutResponse(BaseModel):
    order_id: str
    memo_code: str
    amount: int
    currency: str
    order_name: str
    customer_name: str
    customer_email: str | None = None
    success_url: str
    fail_url: str
    toss_client_key: str


class PaymentConfirmRequest(BaseModel):
    payment_key: str = ""
    order_id: str = ""
    amount: int = 0


class PaymentConfirmResponse(BaseModel):
    success: bool
    memo_code: str | None = None
    status: str | None = None
    error: str | None = None


class PaymentCancelRequest(BaseModel):
    order_id: uuid.UUID
    reason: str = ""


class OCRVerifyResponse(BaseModel):
    order_id: uuid.UUID
    status: str
    checks: dict[str, str]
    flag_reason: str | None = None


class OrderPaymentStatus(BaseModel):
    order_id: uuid.UUID
    memo_code: str
    status: str
    payment_method: str | None
    total_amount: int
    currency: str
    created_at: str
    confirmed_at: str | None
