from pydantic import BaseModel
import uuid


class FacebookLoginRequest(BaseModel):
    access_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    workspace_id: uuid.UUID


class AuthMeResponse(BaseModel):
    workspace_id: uuid.UUID
    auth: str  # "supabase" | "legacy"
    email: str | None = None
    onboarding_completed: bool = False


class WorkspaceSetup(BaseModel):
    name: str | None = None
    page_ids: list[str] = []
    language: str = "vi"
    report_hour: int = 9
    # Bank Details (optional, collected during onboarding)
    bank_account: str | None = None
    bank_name: str | None = None
    bank_holder: str | None = None
    # Short-lived user token from Facebook Login — backend tự exchange lấy page tokens
    user_access_token: str | None = None


class ReconnectPagesRequest(BaseModel):
    """Dùng khi page token hết hạn — user đăng nhập lại FB để cấp token mới."""
    user_access_token: str
