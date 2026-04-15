from app.config import get_settings
from app.services.meta_service import MetaService

settings = get_settings()


class AdminCommandService:
    """Handle admin commands sent via Salemate v1 Messenger page."""

    COMMANDS = {
        "baocao": "Xem báo cáo nhanh",
        "donhang": "Xem đơn hàng gần nhất",
        "tonkho": "Kiểm tra tồn kho",
        "chiendich": "Chiến dịch outreach (webview duyệt qua Messenger khi có chiến dịch mới)",
        "help": "Danh sách lệnh",
    }

    @staticmethod
    async def handle(sender_id: str, message: dict, postback: dict):
        await MetaService.mark_seen(settings.SALEMATE_PAGE_ACCESS_TOKEN, sender_id)

        text = message.get("text", "").strip().lower()
        postback_payload = postback.get("payload", "")

        command = text or postback_payload

        if command in ("help", "menu", "start", "bắt đầu", "GET_STARTED"):
            welcome = (
                "Chào mừng bạn đến với Salemate! 🎉\n\n"
                "Đây là kênh quản trị cửa hàng của bạn.\n"
                "📋 Danh sách lệnh:\n"
            ) + "\n".join(
                f"• {k} — {v}" for k, v in AdminCommandService.COMMANDS.items()
            )
            await MetaService.send_text(
                settings.SALEMATE_PAGE_ACCESS_TOKEN, sender_id, welcome
            )
        elif command == "baocao":
            await AdminCommandService._send_report(sender_id)
        elif command == "donhang":
            await AdminCommandService._send_recent_orders(sender_id)
        elif command == "tonkho":
            await AdminCommandService._send_inventory_status(sender_id)
        elif command == "chiendich":
            await AdminCommandService._send_campaigns(sender_id)
        else:
            await MetaService.send_text(
                settings.SALEMATE_PAGE_ACCESS_TOKEN, sender_id,
                "Lệnh không hợp lệ. Gõ 'help' để xem danh sách lệnh."
            )

    @staticmethod
    async def _send_report(sender_id: str):
        from app.services.admin_service import AdminService
        from app.database import async_session
        from app.models.workspace import Workspace
        from sqlalchemy import select

        async with async_session() as db:
            stmt = select(Workspace).where(Workspace.owner_facebook_id == sender_id)
            result = await db.execute(stmt)
            workspace = result.scalar_one_or_none()
            if not workspace:
                await MetaService.send_text(
                    settings.SALEMATE_PAGE_ACCESS_TOKEN, sender_id,
                    "Không tìm thấy workspace."
                )
                return

            summary = await AdminService.get_summary(db, workspace.id)
            msg = (
                f"📊 Báo cáo nhanh\n"
                f"Doanh thu hôm nay: {summary.total_revenue_today:,}\n"
                f"Doanh thu tuần: {summary.total_revenue_week:,}\n"
                f"Đơn chờ: {summary.orders_pending}\n"
                f"Đơn cảnh báo: {summary.orders_flagged}"
            )
            await MetaService.send_text(
                settings.SALEMATE_PAGE_ACCESS_TOKEN, sender_id, msg
            )

    @staticmethod
    async def _send_recent_orders(sender_id: str):
        await MetaService.send_webview_button(
            settings.SALEMATE_PAGE_ACCESS_TOKEN,
            sender_id,
            "Xem đơn hàng gần nhất:",
            "Mở Dashboard",
            f"{settings.CORS_ORIGINS[0]}/dashboard/orders",
        )

    @staticmethod
    async def _send_inventory_status(sender_id: str):
        await MetaService.send_webview_button(
            settings.SALEMATE_PAGE_ACCESS_TOKEN,
            sender_id,
            "Kiểm tra tồn kho:",
            "Mở Dashboard",
            f"{settings.CORS_ORIGINS[0]}/dashboard/inventory",
        )

    @staticmethod
    async def _send_campaigns(sender_id: str):
        await MetaService.send_webview_button(
            settings.SALEMATE_PAGE_ACCESS_TOKEN,
            sender_id,
            "Chiến dịch mới sẽ gửi link duyệt webview vào đây. Mở dashboard để tạo hoặc xem lại:",
            "Mở Campaigns",
            f"{settings.CORS_ORIGINS[0]}/dashboard/campaigns",
        )
