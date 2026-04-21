from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
import uuid

from app.database import get_db
from app.config import get_settings
from app.services.auth_service import AuthService

security = HTTPBearer()
settings = get_settings()


def _decode_supabase_payload(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        return None


async def get_current_workspace_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    token = credentials.credentials

    sup_secret = (settings.SUPABASE_JWT_SECRET or "").strip()
    if sup_secret:
        payload = _decode_supabase_payload(token, sup_secret)
        if payload and payload.get("sub"):
            try:
                uid = uuid.UUID(str(payload["sub"]))
            except ValueError:
                uid = None
            if uid:
                meta = payload.get("user_metadata") or {}
                name = meta.get("full_name") or meta.get("name")
                ws_id = await AuthService.ensure_workspace_for_supabase_user(
                    db,
                    user_id=uid,
                    email=payload.get("email"),
                    name=name if isinstance(name, str) else None,
                )
                return ws_id

    try:
        legacy = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        wid = legacy.get("workspace_id")
        if wid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return uuid.UUID(str(wid))
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from e
