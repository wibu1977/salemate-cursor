import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAYMENT_SENT = "payment_sent"
    CONFIRMED = "confirmed"
    FLAGGED = "flagged"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class PaymentMethod(str, enum.Enum):
    TOSS = "toss"
    BANK_TRANSFER = "bank_transfer"
    OCR_VERIFIED = "ocr_verified"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)

    memo_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    status: Mapped[OrderStatus] = mapped_column(SQLEnum(OrderStatus, name="order_status"), default=OrderStatus.PENDING)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(SQLEnum(PaymentMethod, name="payment_method"), nullable=True)

    total_amount: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="KRW")

    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    customer_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    customer_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    toss_payment_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    bill_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bill_image_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    ocr_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="orders")
    customer: Mapped["Customer"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    fraud_logs: Mapped[list] = relationship("FraudLog", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    product_name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer, default=0)
    subtotal: Mapped[int] = mapped_column(Integer, default=0)

    order: Mapped["Order"] = relationship(back_populates="items")
