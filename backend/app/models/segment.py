import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CustomerSegment(Base):
    """
    Immutable segment snapshot created by each K-Means clustering run.

    Key design decisions:
    - INSERT NEW rows each run, NEVER upsert. This prevents the "Shifting Cluster"
      bug where K-Means reassigns cluster_0 from VIP to Dormant between runs,
      silently corrupting scheduled campaigns.
    - is_latest: only the most recent run's segments are True. Old segments stay
      in DB so campaigns already scheduled against them remain valid.
    - Campaigns reference segment_id FK which is stable once written.
    """
    __tablename__ = "customer_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), index=True)

    cluster_key: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_orders: Mapped[float] = mapped_column(Float, default=0.0)
    avg_spent: Mapped[float] = mapped_column(Float, default=0.0)
    avg_recency_days: Mapped[float] = mapped_column(Float, default=0.0)

    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workspace: Mapped["Workspace"] = relationship()
    customers: Mapped[list] = relationship("Customer", back_populates="segment")
