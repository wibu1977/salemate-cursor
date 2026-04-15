from pydantic import BaseModel
from datetime import datetime
import uuid


class DashboardSummary(BaseModel):
    total_revenue_today: int = 0
    total_revenue_week: int = 0
    total_revenue_month: int = 0
    orders_pending: int = 0
    orders_confirmed: int = 0
    orders_flagged: int = 0
    top_products: list[dict] = []
    low_stock_alerts: list[dict] = []


class OrderListItem(BaseModel):
    id: uuid.UUID
    memo_code: str
    customer_name: str | None
    total_amount: int
    status: str
    payment_method: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderDetail(OrderListItem):
    customer_phone: str | None
    customer_address: str | None
    customer_note: str | None
    items: list[dict] = []
    bill_image_url: str | None
    ocr_data: dict | None
    flag_reason: str | None
    fraud_logs: list[dict] = []


class OrderActionRequest(BaseModel):
    action: str  # "approve" | "reject"
    note: str | None = None
