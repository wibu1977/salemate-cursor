import httpx
import jwt
import uuid
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.app_user import AppUser
from app.services.meta_service import GRAPH_URL
from app.models.workspace import Workspace, ShopPage
from app.schemas.auth import TokenResponse, WorkspaceSetup

settings = get_settings()
logger = logging.getLogger("salemate.auth")


class AuthService:
    @staticmethod
    async def ensure_workspace_for_supabase_user(
        db: AsyncSession,
        user_id: uuid.UUID,
        email: str | None,
        name: str | None,
    ) -> uuid.UUID:
        """Tạo app_users + workspace mặc định nếu chưa có; trả về workspace.id."""
        r = await db.execute(select(AppUser).where(AppUser.id == user_id))
        user = r.scalar_one_or_none()
        if not user:
            user = AppUser(
                id=user_id,
                email=(email or None),
                display_name=(name or None),
            )
            db.add(user)
            await db.flush()

        r2 = await db.execute(select(Workspace).where(Workspace.owner_user_id == user_id))
        ws = r2.scalar_one_or_none()
        if ws:
            return ws.id

        display = (name or email or "User").strip() or "User"
        ws = Workspace(
            name=f"{display} — Salemate",
            owner_user_id=user_id,
            owner_facebook_id=None,
            owner_name=display[:255],
            owner_email=(email or None),
        )
        db.add(ws)
        await db.flush()
        return ws.id

    @staticmethod
    async def facebook_login(db: AsyncSession, access_token: str) -> TokenResponse:
        """Verify Facebook token and create/get workspace."""
        fb_user = await AuthService._verify_facebook_token(access_token)
        fb_id = fb_user.get("id")
        fb_name = fb_user.get("name") or ""
        # Email chỉ có khi app có quyền email + user cấp; cột DB nullable — an toàn khi thiếu.
        fb_email = fb_user.get("email")

        if not fb_id:
            raise ValueError("Invalid Facebook token")

        stmt = select(Workspace).where(Workspace.owner_facebook_id == fb_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one_or_none()

        if not workspace:
            workspace = Workspace(
                name=f"{fb_name}'s Shop",
                owner_facebook_id=fb_id,
                owner_name=fb_name,
                owner_email=fb_email,
            )
            db.add(workspace)
            await db.flush()

        # DB: flush/select ở trên có thể ném SQLAlchemyError; commit do get_db().
        token = AuthService._create_jwt(workspace.id, fb_id)
        # Không commit ở đây — get_db() sẽ commit một lần.

        return TokenResponse(access_token=token, workspace_id=workspace.id)

    @staticmethod
    async def setup_workspace(
        db: AsyncSession, workspace_id: uuid.UUID, payload: WorkspaceSetup
    ):
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await db.execute(stmt)
        workspace = result.scalar_one_or_none()

        if not workspace:
            raise ValueError("Workspace not found")

        workspace.name = payload.name
        workspace.language = payload.language
        workspace.report_hour = payload.report_hour

        # Nếu có user_access_token: tự động exchange + lấy page tokens từ Meta Graph API
        if payload.user_access_token:
            try:
                count = await AuthService._sync_page_tokens(
                    db=db,
                    workspace_id=workspace_id,
                    user_access_token=payload.user_access_token,
                    page_ids_filter=payload.page_ids or None,
                )
                logger.info("setup_workspace: synced %d pages for workspace %s", count, workspace_id)
            except Exception as e:
                logger.warning("setup_workspace: page token sync failed: %s", e)
                # Fallback: tạo entries rỗng thay vì fail hoàn toàn
                await AuthService._create_empty_page_entries(db, workspace_id, payload.page_ids)
        elif payload.page_ids:
            # Không có user token: tạo entries rỗng (backward compat)
            await AuthService._create_empty_page_entries(db, workspace_id, payload.page_ids)

        return {"status": "ok", "workspace_id": str(workspace_id)}

    @staticmethod
    async def reconnect_pages(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_access_token: str,
    ) -> dict:
        """
        Gọi khi page token hết hạn. User đăng nhập lại FB từ Dashboard,
        frontend gửi token mới về đây. Backend tự exchange + cập nhật tất cả pages.
        """
        updated = await AuthService._sync_page_tokens(
            db=db,
            workspace_id=workspace_id,
            user_access_token=user_access_token,
            page_ids_filter=None,  # cập nhật tất cả pages
        )
        logger.info("reconnect_pages: updated %d pages for workspace %s", updated, workspace_id)
        return {"status": "ok", "pages_updated": updated}

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    async def _sync_page_tokens(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        user_access_token: str,
        page_ids_filter: list[str] | None,
    ) -> int:
        """
        1. Exchange short-lived user token → long-lived user token (60 ngày)
        2. Lấy danh sách pages + long-lived page tokens từ /me/accounts
           (Page token lấy từ long-lived user token sẽ KHÔNG BAO GIỜ hết hạn)
        3. Upsert vào bảng shop_pages
        Trả về số pages đã cập nhật.
        """
        ll_user_token = await AuthService._exchange_long_lived_token(user_access_token)
        pages = await AuthService._fetch_managed_pages(ll_user_token)

        updated = 0
        for page in pages:
            pid = page.get("id")
            pname = page.get("name", f"Page {pid}")
            ptoken = page.get("access_token", "")

            if not pid or not ptoken:
                continue

            # Filter nếu user chỉ chọn một số pages
            if page_ids_filter and pid not in page_ids_filter:
                continue

            existing = await db.execute(
                select(ShopPage).where(ShopPage.page_id == pid)
            )
            shop_page = existing.scalar_one_or_none()

            if shop_page:
                # Cập nhật token và tên page
                shop_page.page_access_token = ptoken
                shop_page.page_name = pname
                logger.info("Updated token for page %s (%s)", pid, pname)
            else:
                shop_page = ShopPage(
                    workspace_id=workspace_id,
                    page_id=pid,
                    page_name=pname,
                    page_access_token=ptoken,
                    is_active=True,
                )
                db.add(shop_page)
                logger.info("Created page entry for %s (%s)", pid, pname)

            updated += 1

        return updated

    @staticmethod
    async def _create_empty_page_entries(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        page_ids: list[str],
    ) -> None:
        """Fallback: tạo ShopPage entries rỗng (không có token) — chỉ dùng khi không có user token."""
        for page_id in page_ids:
            existing = await db.execute(
                select(ShopPage).where(ShopPage.page_id == page_id)
            )
            if not existing.scalar_one_or_none():
                page = ShopPage(
                    workspace_id=workspace_id,
                    page_id=page_id,
                    page_name=f"Page {page_id}",
                    page_access_token="",
                )
                db.add(page)

    @staticmethod
    async def _exchange_long_lived_token(short_lived_token: str) -> str:
        """
        Exchange short-lived user token → long-lived user token (hết hạn sau 60 ngày).
        Khi dùng long-lived user token để lấy page token, page token sẽ KHÔNG BAO GIỜ hết hạn.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{GRAPH_URL}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "fb_exchange_token": short_lived_token,
                },
            )
            data = resp.json()
            if "error" in data:
                raise ValueError(f"Token exchange failed: {data['error'].get('message')}")
            return data["access_token"]

    @staticmethod
    async def _fetch_managed_pages(long_lived_user_token: str) -> list[dict]:
        """
        Lấy danh sách Pages mà user quản lý + long-lived page tokens.
        /me/accounts với long-lived user token trả về page tokens không hết hạn.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{GRAPH_URL}/me/accounts",
                params={
                    "access_token": long_lived_user_token,
                    "fields": "id,name,access_token,tasks",
                },
            )
            data = resp.json()
            if "error" in data:
                raise ValueError(f"Failed to fetch pages: {data['error'].get('message')}")
            return data.get("data", [])

    @staticmethod
    async def _verify_facebook_token(access_token: str) -> dict:
        async with httpx.AsyncClient(
            verify=True,
            trust_env=False,
            timeout=20.0,
        ) as client:
            response = await client.get(
                f"{GRAPH_URL}/me",
                params={"access_token": access_token, "fields": "id,name,email"},
            )
            if response.status_code != 200:
                try:
                    body = response.json()
                except Exception:
                    body = response.text
                raise ValueError(f"Facebook token verification failed: {body}")
            return response.json()

    @staticmethod
    def _create_jwt(workspace_id: uuid.UUID, facebook_id: str) -> str:
        payload = {
            "workspace_id": str(workspace_id),
            "facebook_id": facebook_id,
            "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
