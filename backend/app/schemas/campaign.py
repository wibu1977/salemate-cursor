from pydantic import BaseModel
from datetime import datetime
import uuid


class SegmentResponse(BaseModel):
    id: uuid.UUID
    label: str
    description: str | None
    recommendation: str | None
    customer_count: int
    avg_orders: float
    avg_spent: float
    avg_recency_days: float

    model_config = {"from_attributes": True}


class CampaignCreate(BaseModel):
    name: str
    target_segment_id: uuid.UUID | None = None
    target_cluster: str | None = None
    message_template: str | None = None


class CampaignUpdate(BaseModel):
    name: str | None = None
    message_template: str | None = None


class CampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    target_cluster: str | None
    target_segment_id: uuid.UUID | None
    segment_label: str | None = None
    segment_description: str | None = None
    status: str
    message_template: str
    ai_generated: bool
    total_recipients: int
    sent_count: int
    opened_count: int
    converted_count: int
    scheduled_at: datetime | None
    approved_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_campaign(cls, campaign) -> "CampaignResponse":
        seg = campaign.target_segment
        return cls(
            id=campaign.id,
            name=campaign.name,
            target_cluster=campaign.target_cluster,
            target_segment_id=campaign.target_segment_id,
            segment_label=seg.label if seg else None,
            segment_description=seg.description if seg else None,
            status=campaign.status.value if hasattr(campaign.status, "value") else campaign.status,
            message_template=campaign.message_template,
            ai_generated=campaign.ai_generated,
            total_recipients=campaign.total_recipients,
            sent_count=campaign.sent_count,
            opened_count=campaign.opened_count,
            converted_count=campaign.converted_count,
            scheduled_at=campaign.scheduled_at,
            approved_at=campaign.approved_at,
            completed_at=campaign.completed_at,
            created_at=campaign.created_at,
        )


class CampaignApproveRequest(BaseModel):
    action: str  # "approve" | "rewrite" | "cancel"
    custom_message: str | None = None
