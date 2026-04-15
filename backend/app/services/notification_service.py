from app.config import get_settings
from app.services.meta_service import MetaService
from app.models.order import Order

settings = get_settings()

FRONTEND_URL = "http://localhost:3000"


def _frontend_base() -> str:
    return settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else FRONTEND_URL


class NotificationService:
    """Send admin notifications via Salemate v1 Messenger page."""

    @staticmethod
    async def notify_order_update(order: Order):
        msg = (
            f"📦 Đơn hàng cập nhật\n"
            f"Mã: {order.memo_code}\n"
            f"Trạng thái: {order.status.value}\n"
            f"Số tiền: {order.total_amount:,} {order.currency}"
        )
        webview_url = f"{_frontend_base()}/webview/order/{order.id}"
        await NotificationService._send_to_admin_with_button(
            order.workspace_id, msg, "Xem chi tiết", webview_url
        )

    @staticmethod
    async def notify_fraud_alert(order: Order, checks: dict):
        failed = {k: v for k, v in checks.items() if v != "pass"}
        check_names = {"time": "Thời gian", "memo": "Mã GD", "amount": "Số tiền", "duplicate": "Trùng lặp"}
        failed_labels = ", ".join(check_names.get(k, k) for k in failed)

        msg = (
            f"🚨 CẢNH BÁO GIAN LẬN\n"
            f"Mã đơn: {order.memo_code}\n"
            f"Số tiền: {order.total_amount:,} {order.currency}\n"
            f"Lỗi: {failed_labels}"
        )
        webview_url = f"{_frontend_base()}/webview/fraud/{order.id}"
        await NotificationService._send_to_admin_with_button(
            order.workspace_id, msg, "Kiểm tra ngay", webview_url
        )

    @staticmethod
    async def notify_low_stock(workspace_id, product_name: str, quantity: int, threshold: int):
        msg = (
            f"⚠️ Cảnh báo tồn kho\n"
            f"Sản phẩm: {product_name}\n"
            f"Còn lại: {quantity} (ngưỡng: {threshold})"
        )
        await NotificationService._send_to_admin(workspace_id, msg)

    @staticmethod
    async def send_daily_report(workspace_id, report_data: dict):
        lines = [
            "📊 Báo cáo hàng ngày",
            "━━━━━━━━━━━━━━━",
            f"💰 Doanh thu hôm nay: {report_data.get('revenue_today', 0):,} KRW",
            f"   Tuần này: {report_data.get('revenue_week', 0):,}",
            f"   Tháng này: {report_data.get('revenue_month', 0):,}",
            "",
            f"📦 Đơn xác nhận: {report_data.get('orders_confirmed', 0)}",
            f"⏳ Đơn chờ xử lý: {report_data.get('orders_pending', 0)}",
            f"🚨 Đơn cảnh báo: {report_data.get('orders_flagged', 0)}",
        ]

        top = report_data.get("top_products") or []
        if top:
            lines.append("")
            lines.append("🏆 Sản phẩm bán chạy hôm nay:")
            for i, p in enumerate(top[:5], 1):
                lines.append(f"  {i}. {p['name']} — {p['quantity']} sp ({p['revenue']:,} KRW)")

        alerts = report_data.get("low_stock_alerts") or []
        if alerts:
            lines.append("")
            lines.append(f"⚠️ Tồn kho thấp ({len(alerts)} sản phẩm):")
            for a in alerts[:5]:
                lines.append(f"  • {a['name']}: còn {a['quantity']} (ngưỡng {a['threshold']})")
            if len(alerts) > 5:
                lines.append(f"  … và {len(alerts) - 5} sản phẩm khác")

        msg = "\n".join(lines)
        webview_url = f"{_frontend_base()}/dashboard"
        await NotificationService._send_to_admin_with_button(
            workspace_id, msg, "Mở Dashboard", webview_url
        )

    @staticmethod
    async def _send_to_admin(workspace_id, message: str):
        owner_psid = await NotificationService._get_owner_psid(workspace_id)
        if owner_psid:
            await MetaService.send_text(
                settings.SALEMATE_PAGE_ACCESS_TOKEN, owner_psid, message
            )

    @staticmethod
    async def _send_to_admin_with_button(workspace_id, message: str, button_title: str, url: str):
        owner_psid = await NotificationService._get_owner_psid(workspace_id)
        if owner_psid:
            await MetaService.send_webview_button(
                settings.SALEMATE_PAGE_ACCESS_TOKEN,
                owner_psid, message, button_title, url
            )

    @staticmethod
    async def _get_owner_psid(workspace_id) -> str | None:
        from sqlalchemy import select
        from app.database import async_session
        from app.models.workspace import Workspace

        async with async_session() as db:
            stmt = select(Workspace).where(Workspace.id == workspace_id)
            result = await db.execute(stmt)
            workspace = result.scalar_one_or_none()
            if workspace and workspace.owner_facebook_id:
                return workspace.owner_facebook_id
        return None
