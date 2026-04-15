from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.schemas.campaign import (
    CampaignCreate,
    CampaignResponse,
    CampaignApproveRequest,
    CampaignUpdate,
    SegmentResponse,
)
from app.services.campaign_service import CampaignService

router = APIRouter()


@router.get("/segments", response_model=list[SegmentResponse])
async def list_segments(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List available customer segments (is_latest=True only)."""
    return await CampaignService.list_available_segments(db, workspace_id)


@router.get("")
async def list_campaigns(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """List all campaigns with segment info."""
    campaigns = await CampaignService.list_campaigns(db, workspace_id)
    return [CampaignResponse.from_campaign(c) for c in campaigns]


@router.post("")
async def create_campaign(
    payload: CampaignCreate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Create campaign targeting a segment. AI auto-generates message using segment context."""
    return await CampaignService.create_campaign(db, workspace_id, payload)


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    campaign = await CampaignService.get_campaign(db, workspace_id, campaign_id)
    if campaign:
        return CampaignResponse.from_campaign(campaign)
    return {"error": "Campaign not found"}


@router.post("/{campaign_id}/approve")
async def approve_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignApproveRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.handle_approval(db, workspace_id, campaign_id, payload)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Update name/message while campaign is draft or pending approval."""
    updated = await CampaignService.update_campaign(
        db,
        workspace_id,
        campaign_id,
        name=payload.name,
        message_template=payload.message_template,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign not found or not editable in current status",
        )
    return CampaignResponse.from_campaign(updated)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove campaign in draft, pending approval, or cancelled state."""
    ok = await CampaignService.delete_campaign(db, workspace_id, campaign_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign not found or cannot be deleted in current status",
        )
