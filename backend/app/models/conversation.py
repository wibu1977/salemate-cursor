import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum

from app.database import Base


class ConversationState(str, enum.Enum):
    GREETING = "greeting"
    CONSULTING = "consulting"
    COLLECTING_ORDER = "collecting_order"
    AWAITING_PAYMENT = "awaiting_payment"
    COMPLETED = "completed"


class Conversation(Base):
    """Tracks AI chatbot conversation state per customer session."""
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), index=True)
    page_id: Mapped[str] = mapped_column(String(100), index=True)
    platform: Mapped[str] = mapped_column(String(20), default="facebook")

    state: Mapped[ConversationState] = mapped_column(
        SQLEnum(ConversationState), default=ConversationState.GREETING
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
