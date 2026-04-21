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


class WorkspaceSetup(BaseModel):
    name: str
    page_ids: list[str] = []
    language: str = "vi"
    report_hour: int = 9
