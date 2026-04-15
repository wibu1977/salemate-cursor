import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum

from app.database import Base


class FraudCheckResult(str, enum.Enum):
    PASS = "pass"
    FLAG = "flag"
    REJECT = "reject"


class FraudLog(Base):
    __tablename__ = "fraud_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)

    check_type: Mapped[str] = mapped_column(String(50))
    result: Mapped[FraudCheckResult] = mapped_column(SQLEnum(FraudCheckResult))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped["Order"] = relationship(back_populates="fraud_logs")
