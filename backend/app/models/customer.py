import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Customer(Base):
    """Single Customer View (SCV) - unified by phone number."""
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    facebook_psid: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    instagram_psid: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    cluster: Mapped[str | None] = mapped_column(String(50), nullable=True)
    segment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("customer_segments.id"), nullable=True, index=True
    )
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[int] = mapped_column(Integer, default=0)
    last_order_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    opted_in_recurring: Mapped[bool] = mapped_column(default=False)
    recurring_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="customers")
    segment: Mapped["CustomerSegment"] = relationship(back_populates="customers")
    orders: Mapped[list] = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
