import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_users.id"), nullable=True, index=True
    )
    owner_facebook_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    owner_name: Mapped[str] = mapped_column(String(255))
    owner_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_hour: Mapped[int] = mapped_column(default=9)
    language: Mapped[str] = mapped_column(String(10), default="vi")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pages: Mapped[list["ShopPage"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    products: Mapped[list] = relationship("Product", back_populates="workspace", cascade="all, delete-orphan")
    orders: Mapped[list] = relationship("Order", back_populates="workspace", cascade="all, delete-orphan")
    customers: Mapped[list] = relationship("Customer", back_populates="workspace", cascade="all, delete-orphan")
    campaigns: Mapped[list] = relationship("Campaign", back_populates="workspace", cascade="all, delete-orphan")


class ShopPage(Base):
    __tablename__ = "shop_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id"), index=True)
    page_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    page_name: Mapped[str] = mapped_column(String(255))
    page_access_token: Mapped[str] = mapped_column(Text)
    platform: Mapped[str] = mapped_column(String(20), default="facebook")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workspace: Mapped["Workspace"] = relationship(back_populates="pages")
