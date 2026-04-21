import httpx
import jwt
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.app_user import AppUser
from app.models.workspace import Workspace, ShopPage
from app.schemas.auth import TokenResponse, WorkspaceSetup

settings = get_settings()


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

        for page_id in payload.page_ids:
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

        return {"status": "ok", "workspace_id": str(workspace_id)}

    @staticmethod
    async def _verify_facebook_token(access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://graph.facebook.com/me",
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
