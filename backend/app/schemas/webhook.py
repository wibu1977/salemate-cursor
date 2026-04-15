from pydantic import BaseModel
from typing import Any


class MetaWebhookVerify(BaseModel):
    hub_mode: str | None = None
    hub_verify_token: str | None = None
    hub_challenge: str | None = None


class MetaMessageEntry(BaseModel):
    id: str
    time: int
    messaging: list[dict[str, Any]] | None = None


class MetaWebhookPayload(BaseModel):
    object: str
    entry: list[MetaMessageEntry]
