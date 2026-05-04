import hashlib
import hmac
import logging

from fastapi import APIRouter, Request, Query, HTTPException, Response
from app.config import get_settings
from app.services.message_router import MessageRouter

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("salemate.webhook")


def _verify_signature(payload: bytes, signature_header: str | None) -> bool:
    """Verify X-Hub-Signature-256 from Meta."""
    if not settings.META_APP_SECRET:
        return True  # skip in dev when secret not set
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(
        settings.META_APP_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.get("")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification (Hub Challenge)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")
    
    logger.warning("Webhook verification failed: token mismatch or invalid mode")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def handle_webhook(request: Request):
    """
    Unified entry for Messenger + Instagram webhooks.
    1. Verify X-Hub-Signature-256
    2. Route each messaging event based on page_id
    """
    raw_body = await request.body()

    signature = request.headers.get("X-Hub-Signature-256")
    if not _verify_signature(raw_body, signature):
        logger.warning("Webhook signature mismatch — rejecting request")
        raise HTTPException(status_code=403, detail="Invalid signature")

    body = await request.json()
    obj_type = body.get("object")

    if obj_type == "page":
        await _process_page_events(body)
    elif obj_type == "instagram":
        await _process_instagram_events(body)
    else:
        logger.debug("Ignored webhook object type: %s", obj_type)

    return {"status": "ok"}


async def _process_page_events(body: dict):
    """Handle Messenger page events."""
    for entry in body.get("entry", []):
        page_id = entry.get("id")

        for event in entry.get("messaging", []):
            try:
                await MessageRouter.route(page_id, event, platform="facebook")
            except Exception:
                logger.exception("Error routing FB event page=%s", page_id)

        for event in entry.get("standby", []):
            logger.debug("Standby event on page %s (handover protocol)", page_id)


async def _process_instagram_events(body: dict):
    """Handle Instagram DM events — same entry structure, different object type."""
    for entry in body.get("entry", []):
        page_id = entry.get("id")

        for event in entry.get("messaging", []):
            try:
                await MessageRouter.route(page_id, event, platform="instagram")
            except Exception:
                logger.exception("Error routing IG event page=%s", page_id)
