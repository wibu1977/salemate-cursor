import json
import logging
import uuid
from datetime import datetime

import redis.asyncio as aioredis

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("salemate.cache")

CONV_TTL = 60 * 60  # 1 hour — idle conversations expire
CONV_PREFIX = "conv:"

_pool: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _pool


def _key(workspace_id: uuid.UUID, psid: str) -> str:
    return f"{CONV_PREFIX}{workspace_id}:{psid}"


class ConversationCache:
    """
    Hot cache for conversation context in Redis.
    All methods are fault-tolerant: if Redis is down,
    they log a warning and return None/pass silently
    so the bot falls back to PostgreSQL automatically.
    """

    @staticmethod
    async def get(workspace_id: uuid.UUID, psid: str) -> dict | None:
        try:
            r = _get_redis()
            data = await r.get(_key(workspace_id, psid))
            if data:
                await r.expire(_key(workspace_id, psid), CONV_TTL)
                return json.loads(data)
        except Exception as e:
            logger.warning("Redis GET failed (falling back to DB): %s", e)
        return None

    @staticmethod
    async def set(
        workspace_id: uuid.UUID,
        psid: str,
        conversation_id: str,
        customer_id: str,
        state: str,
        messages: list,
        order_draft: dict | None = None,
        order_id: str | None = None,
    ):
        try:
            r = _get_redis()
            payload = {
                "conversation_id": conversation_id,
                "customer_id": customer_id,
                "state": state,
                "messages": messages[-20:],
                "order_draft": order_draft or {},
                "order_id": order_id,
                "updated_at": datetime.utcnow().isoformat(),
            }
            await r.set(
                _key(workspace_id, psid),
                json.dumps(payload, ensure_ascii=False),
                ex=CONV_TTL,
            )
        except Exception as e:
            logger.warning("Redis SET failed (DB is still source-of-truth): %s", e)

    @staticmethod
    async def update_state(workspace_id: uuid.UUID, psid: str, state: str):
        try:
            cached = await ConversationCache.get(workspace_id, psid)
            if cached:
                cached["state"] = state
                r = _get_redis()
                await r.set(
                    _key(workspace_id, psid),
                    json.dumps(cached, ensure_ascii=False),
                    ex=CONV_TTL,
                )
        except Exception as e:
            logger.warning("Redis UPDATE_STATE failed: %s", e)

    @staticmethod
    async def append_turn(workspace_id: uuid.UUID, psid: str, role: str, content: str):
        try:
            cached = await ConversationCache.get(workspace_id, psid)
            if cached:
                cached["messages"].append({"role": role, "content": content})
                cached["messages"] = cached["messages"][-20:]
                r = _get_redis()
                await r.set(
                    _key(workspace_id, psid),
                    json.dumps(cached, ensure_ascii=False),
                    ex=CONV_TTL,
                )
        except Exception as e:
            logger.warning("Redis APPEND_TURN failed: %s", e)

    @staticmethod
    async def delete(workspace_id: uuid.UUID, psid: str):
        try:
            r = _get_redis()
            await r.delete(_key(workspace_id, psid))
        except Exception as e:
            logger.warning("Redis DELETE failed: %s", e)

    @staticmethod
    async def exists(workspace_id: uuid.UUID, psid: str) -> bool:
        try:
            r = _get_redis()
            return bool(await r.exists(_key(workspace_id, psid)))
        except Exception as e:
            logger.warning("Redis EXISTS failed: %s", e)
            return False
