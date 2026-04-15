import json
import logging
import uuid
from datetime import datetime

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.conversation import Conversation, ConversationState
from app.models.customer import Customer
from app.models.inventory import Product
from app.services.meta_service import MetaService
from app.services.order_service import OrderService
from app.services.rag_service import RAGService
from app.services.conversation_cache import ConversationCache

settings = get_settings()
logger = logging.getLogger("salemate.ai")
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT_TEMPLATE = """Bạn là trợ lý bán hàng AI của cửa hàng "{shop_name}".
Ngôn ngữ: Tiếng Việt. Trả lời ngắn gọn, thân thiện, dùng emoji vừa phải.

NHIỆM VỤ:
1. Chào hỏi thân thiện. Hỏi khách cần gì.
2. Tư vấn sản phẩm ĐÚNG danh sách bên dưới — KHÔNG bịa sản phẩm không có.
3. Thu thập đầy đủ: sản phẩm + số lượng + SĐT + địa chỉ giao hàng.
4. Xác nhận lại toàn bộ đơn hàng cho khách duyệt, SAU ĐÓ mới gọi submit_order.
5. Nếu thiếu thông tin, hỏi tiếp. KHÔNG gọi submit_order khi thiếu dữ liệu.

QUY TẮC BẮT BUỘC:
- KHÔNG BAO GIỜ tự sinh mã đơn hàng (memo_code). Hệ thống tự tạo.
- KHÔNG trả lời câu hỏi không liên quan mua hàng. Lịch sự từ chối.
- Nếu sản phẩm hết hàng (quantity=0), thông báo và gợi ý sản phẩm thay thế.
- Khi khách muốn hủy/bắt đầu lại, gọi reset_conversation.
- Giá hiển thị dùng dấu phẩy ngăn cách hàng nghìn.

{custom_prompt}

SẢN PHẨM CÓ SẴN:
{product_list}"""

# ---------------------------------------------------------------------------
# Function Calling tools
# ---------------------------------------------------------------------------
ORDER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "submit_order",
            "description": (
                "Gọi SAU KHI khách xác nhận đầy đủ: sản phẩm, số lượng, SĐT, địa chỉ. "
                "KHÔNG gọi nếu thiếu bất kỳ trường nào hoặc khách chưa xác nhận."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "products": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "quantity": {"type": "integer", "minimum": 1},
                                "price": {"type": "integer"},
                            },
                            "required": ["name", "quantity", "price"],
                        },
                    },
                    "phone": {"type": "string"},
                    "address": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["products", "phone", "address"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_order_draft",
            "description": "Cập nhật thông tin đơn hàng đang thu thập (chưa xác nhận). Gọi mỗi khi khách cung cấp thêm info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "products": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "quantity": {"type": "integer", "minimum": 1},
                                "price": {"type": "integer"},
                            },
                            "required": ["name", "quantity", "price"],
                        },
                    },
                    "phone": {"type": "string"},
                    "address": {"type": "string"},
                    "note": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reset_conversation",
            "description": "Khách muốn bắt đầu lại / hủy đơn hàng đang thu thập.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


class AIService:
    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------
    @staticmethod
    async def handle_customer_message(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        page_access_token: str,
        sender_psid: str,
        message: dict,
        postback: dict,
        platform: str = "facebook",
    ):
        # Bill image → OCR pipeline
        image_attachments = [
            a for a in message.get("attachments", []) if a.get("type") == "image"
        ]
        if image_attachments:
            image_url = image_attachments[0].get("payload", {}).get("url")
            await AIService._handle_bill_image(db, workspace_id, sender_psid, image_url, page_access_token)
            return

        text_content = message.get("text", "")
        postback_payload = postback.get("payload", "")

        if not text_content and not postback_payload:
            return

        await MetaService.mark_seen(page_access_token, sender_psid)

        # Postback buttons from persistent menu / Get Started
        if postback_payload:
            await AIService._handle_postback(
                db, workspace_id, page_access_token, sender_psid,
                postback_payload, platform,
            )
            return

        await MetaService.send_typing_on(page_access_token, sender_psid)

        conversation = await AIService._get_or_create_conversation(
            db, workspace_id, sender_psid, platform, page_access_token,
        )

        # Awaiting payment — only accept bill images
        if conversation.state == ConversationState.AWAITING_PAYMENT:
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Đơn hàng đang chờ thanh toán. Gửi ảnh bill chuyển khoản hoặc thanh toán qua link đã gửi nhé! 📸"
            )
            return

        # GPT with Function Calling
        completion = await AIService._call_with_tools(
            db, workspace_id, conversation, text_content
        )

        response_message = completion.choices[0].message
        tool_calls = response_message.tool_calls

        if tool_calls:
            for tc in tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)

                if fn_name == "submit_order":
                    await AIService._handle_submit_order(
                        db, workspace_id, conversation,
                        fn_args, page_access_token, sender_psid,
                    )
                elif fn_name == "update_order_draft":
                    AIService._merge_draft(conversation, fn_args)
                    reply = response_message.content or "Đã ghi nhận! Bạn còn muốn thêm gì không?"
                    await MetaService.send_text(page_access_token, sender_psid, reply)
                elif fn_name == "reset_conversation":
                    await AIService._reset_conversation(
                        db, workspace_id, conversation, page_access_token, sender_psid,
                    )
        else:
            reply = response_message.content or ""
            if reply:
                await MetaService.send_text(page_access_token, sender_psid, reply)

        AIService._save_turn(conversation, text_content, response_message)
        conversation.last_message_at = datetime.utcnow()
        await db.commit()

        # Write-through to Redis
        await ConversationCache.set(
            workspace_id, sender_psid,
            str(conversation.id), str(conversation.customer_id),
            conversation.state.value,
            (conversation.context or {}).get("messages", []),
            (conversation.context or {}).get("order_draft"),
            str(conversation.order_id) if conversation.order_id else None,
        )

    # ------------------------------------------------------------------
    # Postback handlers
    # ------------------------------------------------------------------
    @staticmethod
    async def _handle_postback(
        db: AsyncSession, workspace_id: uuid.UUID,
        page_access_token: str, sender_psid: str,
        payload: str, platform: str,
    ):
        if payload == "GET_STARTED":
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Chào bạn! 👋 Mình là trợ lý bán hàng AI.\nBạn muốn xem sản phẩm hay đặt hàng ngay?"
            )
            await MetaService.send_quick_replies(
                page_access_token, sender_psid,
                "Chọn nhanh:",
                [
                    {"content_type": "text", "title": "🛍 Xem sản phẩm", "payload": "VIEW_PRODUCTS"},
                    {"content_type": "text", "title": "📝 Đặt hàng", "payload": "START_ORDER"},
                ],
            )

        elif payload == "VIEW_PRODUCTS":
            await MetaService.send_typing_on(page_access_token, sender_psid)
            products = await RAGService._all_products(db, workspace_id, limit=10)
            if not products:
                await MetaService.send_text(page_access_token, sender_psid, "Cửa hàng chưa có sản phẩm nào. Vui lòng quay lại sau!")
                return
            elements = AIService._build_product_carousel(products)
            await MetaService.send_generic_template(page_access_token, sender_psid, elements)

        elif payload == "START_ORDER":
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Bạn muốn đặt gì? Cho mình biết tên sản phẩm và số lượng nhé! 📝"
            )

        elif payload == "MY_ORDERS":
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Tính năng xem đơn hàng sẽ ra mắt sớm! Liên hệ cửa hàng qua chat nếu cần kiểm tra nhé."
            )

        elif payload == "CONTACT_SUPPORT":
            await MetaService.send_text(
                page_access_token, sender_psid,
                "Bạn cần hỗ trợ gì? Gõ câu hỏi, mình sẽ cố gắng giúp bạn! 💬"
            )

        elif payload.startswith("ORDER_PRODUCT:"):
            product_name = payload.replace("ORDER_PRODUCT:", "")
            await MetaService.send_text(
                page_access_token, sender_psid,
                f"Bạn muốn đặt {product_name}! Cho mình biết số lượng nhé?"
            )

        elif payload.startswith("BANK_TRANSFER:"):
            memo = payload.replace("BANK_TRANSFER:", "")
            await MetaService.send_text(
                page_access_token, sender_psid,
                f"🏦 Hướng dẫn chuyển khoản:\n\n"
                f"Ghi nội dung chuyển khoản:\n👉 {memo}\n\n"
                f"Sau khi chuyển, gửi ảnh bill cho mình để xác nhận nhé! 📸"
            )

        else:
            # Unknown postback — treat as text
            await MetaService.send_typing_on(page_access_token, sender_psid)
            conversation = await AIService._get_or_create_conversation(
                db, workspace_id, sender_psid, platform, page_access_token,
            )
            completion = await AIService._call_with_tools(
                db, workspace_id, conversation, payload
            )
            reply = completion.choices[0].message.content or ""
            if reply:
                await MetaService.send_text(page_access_token, sender_psid, reply)
            AIService._save_turn(conversation, payload, completion.choices[0].message)
            await db.commit()

    @staticmethod
    def _build_product_carousel(products: list[Product]) -> list[dict]:
        elements = []
        for p in products[:10]:
            stock_label = f"Còn {p.quantity}" if p.quantity > 0 else "Hết hàng"
            element: dict = {
                "title": p.name,
                "subtitle": f"💰 {p.price:,} {p.currency} — {stock_label}",
                "buttons": [
                    {
                        "type": "postback",
                        "title": "🛒 Đặt mua",
                        "payload": f"ORDER_PRODUCT:{p.name}",
                    },
                ],
            }
            if p.image_url:
                element["image_url"] = p.image_url
            elements.append(element)
        return elements

    # ------------------------------------------------------------------
    # GPT call with tools
    # ------------------------------------------------------------------
    @staticmethod
    async def _call_with_tools(
        db: AsyncSession, workspace_id: uuid.UUID,
        conversation: Conversation, user_text: str,
    ):
        from app.models.workspace import Workspace
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one()

        products = await RAGService.search_products(db, workspace_id, user_text)
        product_list = "\n".join(
            f"- {p.name}: {p.price:,} {p.currency} (còn {p.quantity})"
            for p in products
        ) or "Chưa có sản phẩm nào."

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            shop_name=workspace.name,
            custom_prompt=workspace.ai_system_prompt or "",
            product_list=product_list,
        )

        ctx = conversation.context or {}
        messages_history = list(ctx.get("messages", []))
        messages_history.append({"role": "user", "content": user_text})

        draft = ctx.get("order_draft")
        if draft and any(draft.values()):
            system_prompt += (
                f"\n\n[ĐƠN HÀNG ĐANG THU THẬP: {json.dumps(draft, ensure_ascii=False)}]\n"
                "Dùng update_order_draft để cập nhật, submit_order khi khách xác nhận, "
                "reset_conversation nếu khách muốn hủy."
            )

        chat_messages = [{"role": "system", "content": system_prompt}] + messages_history[-12:]

        return await openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=chat_messages,
            tools=ORDER_TOOLS,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=500,
        )

    # ------------------------------------------------------------------
    # Order submission with stock validation
    # ------------------------------------------------------------------
    @staticmethod
    async def _handle_submit_order(
        db: AsyncSession, workspace_id: uuid.UUID,
        conversation: Conversation, order_data: dict,
        page_access_token: str, sender_psid: str,
    ):
        # Stock validation
        stock_errors = []
        for item in order_data.get("products", []):
            stmt = select(Product).where(
                Product.workspace_id == workspace_id,
                Product.name == item["name"],
                Product.is_active == True,
            )
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                stock_errors.append(f"❌ '{item['name']}' không tìm thấy trong danh sách sản phẩm.")
            elif product.quantity < item.get("quantity", 1):
                stock_errors.append(f"❌ '{item['name']}' chỉ còn {product.quantity}, bạn đặt {item['quantity']}.")
            else:
                item["product_id"] = str(product.id)
                item["price"] = product.price

        if stock_errors:
            error_msg = "Không thể tạo đơn hàng:\n" + "\n".join(stock_errors) + "\n\nBạn muốn chỉnh lại không?"
            await MetaService.send_text(page_access_token, sender_psid, error_msg)
            return

        total = sum(it.get("price", 0) * it.get("quantity", 1) for it in order_data["products"])
        order_data["total_amount"] = total

        # SCV merge
        phone = order_data.get("phone")
        if phone:
            from app.services.customer_service import CustomerService
            merged = await CustomerService.merge_by_phone(db, workspace_id, conversation.customer_id, phone)
            conversation.customer_id = merged.id

        if conversation.context is None:
            conversation.context = {}
        conversation.context["order_data"] = order_data
        conversation.state = ConversationState.COLLECTING_ORDER

        order = await OrderService.create_from_conversation(db, workspace_id, conversation)

        # Stock is deducted centrally at order confirmation time
        # (Toss/OCR/admin approve) via stock_service.deduct_stock_and_alert

        # Order confirmation receipt
        items_text = "\n".join(
            f"  • {it['name']} x{it['quantity']} = {it['price'] * it['quantity']:,} {order.currency}"
            for it in order_data["products"]
        )

        confirmation = (
            f"✅ Đơn hàng đã tạo thành công!\n\n"
            f"📋 Mã đơn: {order.memo_code}\n"
            f"━━━━━━━━━━━━━━━\n"
            f"{items_text}\n"
            f"━━━━━━━━━━━━━━━\n"
            f"💰 Tổng: {order.total_amount:,} {order.currency}\n"
            f"📞 SĐT: {order_data.get('phone', '—')}\n"
            f"📍 Địa chỉ: {order_data.get('address', '—')}"
        )
        await MetaService.send_text(page_access_token, sender_psid, confirmation)

        # Payment options: Toss button + bank transfer instructions
        frontend_base = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"
        payment_url = f"{frontend_base}/webview/payment?order_id={order.id}"

        await MetaService.send_button_template(
            page_access_token, sender_psid,
            "Chọn cách thanh toán:",
            [
                {
                    "type": "web_url",
                    "url": payment_url,
                    "title": "💳 Thanh toán Toss",
                    "webview_height_ratio": "tall",
                    "messenger_extensions": True,
                },
                {
                    "type": "postback",
                    "title": "🏦 Chuyển khoản",
                    "payload": f"BANK_TRANSFER:{order.memo_code}",
                },
            ],
        )

        conversation.state = ConversationState.AWAITING_PAYMENT
        conversation.order_id = order.id
        conversation.context.pop("order_draft", None)

        logger.info("Order created: %s total=%d customer=%s", order.memo_code, order.total_amount, conversation.customer_id)

    # ------------------------------------------------------------------
    # Reset conversation
    # ------------------------------------------------------------------
    @staticmethod
    async def _reset_conversation(
        db: AsyncSession, workspace_id: uuid.UUID,
        conversation: Conversation,
        page_access_token: str, sender_psid: str,
    ):
        conversation.state = ConversationState.COMPLETED
        if conversation.context:
            conversation.context["order_draft"] = {}
        await db.commit()

        await ConversationCache.delete(workspace_id, sender_psid)

        await MetaService.send_text(
            page_access_token, sender_psid,
            "Đã bắt đầu lại! 🔄 Bạn muốn mình giúp gì?"
        )

    # ------------------------------------------------------------------
    # Draft merge
    # ------------------------------------------------------------------
    @staticmethod
    def _merge_draft(conversation: Conversation, partial: dict):
        if conversation.context is None:
            conversation.context = {}
        draft = conversation.context.get("order_draft", {})

        if partial.get("products"):
            draft["products"] = partial["products"]
        if partial.get("phone"):
            draft["phone"] = partial["phone"]
        if partial.get("address"):
            draft["address"] = partial["address"]
        if partial.get("note"):
            draft["note"] = partial["note"]

        conversation.context["order_draft"] = draft

        if conversation.state == ConversationState.GREETING:
            conversation.state = ConversationState.CONSULTING

    # ------------------------------------------------------------------
    # Persist turns
    # ------------------------------------------------------------------
    @staticmethod
    def _save_turn(conversation: Conversation, user_text: str, response_message):
        if conversation.context is None:
            conversation.context = {}
        messages = list(conversation.context.get("messages", []))
        messages.append({"role": "user", "content": user_text})
        assistant_text = response_message.content or "[đã xử lý]"
        messages.append({"role": "assistant", "content": assistant_text})
        conversation.context["messages"] = messages[-20:]

    # ------------------------------------------------------------------
    # Conversation lookup
    # ------------------------------------------------------------------
    @staticmethod
    async def _get_or_create_conversation(
        db: AsyncSession, workspace_id: uuid.UUID, sender_psid: str,
        platform: str, page_access_token: str | None = None,
    ) -> Conversation:
        # Check Redis first
        cached = await ConversationCache.get(workspace_id, sender_psid)
        if cached and cached.get("state") not in ("completed", None):
            stmt = select(Conversation).where(Conversation.id == cached["conversation_id"])
            result = await db.execute(stmt)
            conv = result.scalar_one_or_none()
            if conv and conv.state != ConversationState.COMPLETED:
                return conv

        # DB fallback
        psid_field = Customer.facebook_psid if platform == "facebook" else Customer.instagram_psid
        stmt = (
            select(Conversation)
            .join(Customer)
            .where(
                Conversation.workspace_id == workspace_id,
                psid_field == sender_psid,
                Conversation.state != ConversationState.COMPLETED,
            )
            .order_by(Conversation.last_message_at.desc())
        )
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()

        # Stale conversation (>2 hours idle) → complete it, start fresh
        if conversation and conversation.last_message_at:
            age = (datetime.utcnow() - conversation.last_message_at).total_seconds()
            if age > 7200:
                conversation.state = ConversationState.COMPLETED
                await db.flush()
                conversation = None

        if not conversation:
            customer = await AIService._get_or_create_customer(
                db, workspace_id, sender_psid, platform, page_access_token,
            )
            conversation = Conversation(
                workspace_id=workspace_id,
                customer_id=customer.id,
                page_id="",
                platform=platform,
                context={"messages": [], "order_draft": {}},
            )
            db.add(conversation)
            await db.flush()

        return conversation

    @staticmethod
    async def _get_or_create_customer(
        db: AsyncSession, workspace_id: uuid.UUID, sender_psid: str, platform: str,
        page_access_token: str | None = None,
    ) -> Customer:
        from app.services.customer_service import CustomerService
        return await CustomerService.get_or_create(
            db, workspace_id, sender_psid, platform, page_access_token,
        )

    @staticmethod
    async def _handle_bill_image(
        db: AsyncSession, workspace_id: uuid.UUID,
        sender_psid: str, image_url: str, page_access_token: str
    ):
        from app.services.ocr_service import OCRService
        await OCRService.verify_bill_from_messenger(
            db, workspace_id, sender_psid, image_url, page_access_token
        )
