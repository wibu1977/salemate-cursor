import logging
import ssl

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from app.debug_agent_log import agent_log

settings = get_settings()
logger = logging.getLogger("salemate.meta")

GRAPH_URL = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}"

_http_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(20.0),
            trust_env=False,
            verify=True,
            follow_redirects=True,
        )
    return _http_client


class MetaService:
    """Wrapper for Meta Graph API — Messenger + Instagram."""

    # ------------------------------------------------------------------
    # Core send helper with retry
    # ------------------------------------------------------------------

    @staticmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, max=4),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        reraise=True,
    )
    async def _send(page_access_token: str, payload: dict) -> dict:
        client = _get_client()
        response = await client.post(
            f"{GRAPH_URL}/me/messages",
            params={"access_token": page_access_token},
            json=payload,
        )
        data = response.json()
        if "error" in data:
            logger.error("Meta Send API error: %s", data["error"])
        return data

    # ------------------------------------------------------------------
    # Sender actions
    # ------------------------------------------------------------------

    @staticmethod
    async def send_typing_on(page_access_token: str, recipient_id: str):
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "sender_action": "typing_on",
        })

    @staticmethod
    async def send_typing_off(page_access_token: str, recipient_id: str):
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "sender_action": "typing_off",
        })

    @staticmethod
    async def mark_seen(page_access_token: str, recipient_id: str):
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "sender_action": "mark_seen",
        })

    # ------------------------------------------------------------------
    # Text
    # ------------------------------------------------------------------

    @staticmethod
    async def send_text(page_access_token: str, recipient_id: str, text: str) -> dict:
        # Auto-chunk messages > 2000 chars (Meta limit)
        chunks = [text[i:i + 2000] for i in range(0, len(text), 2000)]
        result = {}
        for chunk in chunks:
            result = await MetaService._send(page_access_token, {
                "recipient": {"id": recipient_id},
                "message": {"text": chunk},
            })
        return result

    # ------------------------------------------------------------------
    # Quick Replies
    # ------------------------------------------------------------------

    @staticmethod
    async def send_quick_replies(
        page_access_token: str, recipient_id: str, text: str, quick_replies: list[dict]
    ) -> dict:
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "message": {
                "text": text,
                "quick_replies": quick_replies[:13],  # Meta limit: 13
            },
        })

    # ------------------------------------------------------------------
    # Button template
    # ------------------------------------------------------------------

    @staticmethod
    async def send_button_template(
        page_access_token: str, recipient_id: str, text: str, buttons: list[dict]
    ) -> dict:
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": text,
                        "buttons": buttons[:3],  # Meta limit: 3
                    },
                }
            },
        })

    @staticmethod
    async def send_webview_button(
        page_access_token: str, recipient_id: str, text: str,
        button_title: str, webview_url: str
    ) -> dict:
        return await MetaService.send_button_template(
            page_access_token, recipient_id, text,
            [{
                "type": "web_url",
                "url": webview_url,
                "title": button_title,
                "webview_height_ratio": "tall",
                "messenger_extensions": True,
            }],
        )

    # ------------------------------------------------------------------
    # Generic template (carousel / single card)
    # ------------------------------------------------------------------

    @staticmethod
    async def send_generic_template(
        page_access_token: str, recipient_id: str, elements: list[dict]
    ) -> dict:
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": elements[:10],  # Meta limit: 10
                    },
                }
            },
        })

    # ------------------------------------------------------------------
    # Image attachment
    # ------------------------------------------------------------------

    @staticmethod
    async def send_image(page_access_token: str, recipient_id: str, image_url: str) -> dict:
        return await MetaService._send(page_access_token, {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": image_url, "is_reusable": True},
                }
            },
        })

    # ------------------------------------------------------------------
    # Recurring Notifications
    # ------------------------------------------------------------------

    @staticmethod
    async def send_recurring_notification(
        page_access_token: str, recipient_token: str, text: str
    ) -> dict:
        """Send via Recurring Notification token (not PSID)."""
        return await MetaService._send(page_access_token, {
            "recipient": {"notification_messages_token": recipient_token},
            "message": {"text": text},
        })

    @staticmethod
    async def request_recurring_optin(
        page_access_token: str, recipient_id: str,
        title: str, image_url: str | None = None,
        frequency: str = "DAILY",
    ) -> dict:
        """Prompt user to opt-in to Recurring Notifications."""
        payload: dict = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "notification_messages",
                        "title": title,
                        "notification_messages_frequency": frequency,
                    },
                }
            },
        }
        if image_url:
            payload["message"]["attachment"]["payload"]["image_url"] = image_url
        return await MetaService._send(page_access_token, payload)

    # ------------------------------------------------------------------
    # User profile
    # ------------------------------------------------------------------

    @staticmethod
    async def get_user_profile(page_access_token: str, psid: str) -> dict:
        client = _get_client()
        response = await client.get(
            f"{GRAPH_URL}/{psid}",
            params={
                "access_token": page_access_token,
                "fields": "first_name,last_name,profile_pic",
            },
        )
        return response.json()

    # ------------------------------------------------------------------
    # Page setup helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def set_get_started_button(page_access_token: str, payload: str = "GET_STARTED") -> dict:
        client = _get_client()
        response = await client.post(
            f"{GRAPH_URL}/me/messenger_profile",
            params={"access_token": page_access_token},
            json={"get_started": {"payload": payload}},
        )
        return response.json()

    @staticmethod
    async def set_persistent_menu(page_access_token: str, menu_items: list[dict]) -> dict:
        client = _get_client()
        response = await client.post(
            f"{GRAPH_URL}/me/messenger_profile",
            params={"access_token": page_access_token},
            json={
                "persistent_menu": [
                    {
                        "locale": "default",
                        "composer_input_disabled": False,
                        "call_to_actions": menu_items,
                    }
                ]
            },
        )
        return response.json()

    @staticmethod
    async def set_ice_breakers(page_access_token: str, questions: list[dict]) -> dict:
        """Set ice-breaker questions shown before first message."""
        client = _get_client()
        response = await client.post(
            f"{GRAPH_URL}/me/messenger_profile",
            params={"access_token": page_access_token},
            json={"ice_breakers": questions[:4]},  # Meta limit: 4
        )
        return response.json()

    @staticmethod
    async def subscribe_page_to_webhooks(page_access_token: str, page_id: str) -> dict:
        """Subscribe a page to receive messaging webhooks."""
        # #region agent log
        agent_log(
            "H3",
            "meta_service.py:subscribe_page_to_webhooks",
            "before_graph_post",
            {"graph_host": "graph.facebook.com", "page_id": page_id},
        )
        # #endregion
        client = _get_client()
        response = await client.post(
            f"{GRAPH_URL}/{page_id}/subscribed_apps",
            params={"access_token": page_access_token},
            json={
                "subscribed_fields": [
                    "messages", "messaging_postbacks", "messaging_optins",
                    "messaging_referrals", "message_deliveries", "message_reads",
                ],
            },
        )
        return response.json()
