"""
Public (token-gated) endpoints for Messenger webview — campaign preview & approve.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.campaign import CampaignApproveRequest, CampaignResponse
from app.services.campaign_service import CampaignService
from app.utils.campaign_webview_jwt import parse_campaign_webview_token

router = APIRouter()


async def _campaign_from_token(
    campaign_id: uuid.UUID,
    token: str,
    db: AsyncSession,
):
    cid = parse_campaign_webview_token(token)
    if not cid or cid != campaign_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    campaign = await CampaignService.get_campaign_any(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def webview_get_campaign(
    campaign_id: uuid.UUID,
    token: str = Query(..., min_length=10),
    db: AsyncSession = Depends(get_db),
):
    """Preview campaign for shop owner in Messenger webview."""
    campaign = await _campaign_from_token(campaign_id, token, db)
    return CampaignResponse.from_campaign(campaign)


@router.post("/{campaign_id}/action")
async def webview_campaign_action(
    campaign_id: uuid.UUID,
    payload: CampaignApproveRequest,
    token: str = Query(..., min_length=10),
    db: AsyncSession = Depends(get_db),
):
    """Approve / rewrite / cancel from webview (same logic as admin API)."""
    campaign = await _campaign_from_token(campaign_id, token, db)
    return await CampaignService.handle_approval(
        db, campaign.workspace_id, campaign_id, payload
    )
