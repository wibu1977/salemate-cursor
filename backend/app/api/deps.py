from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
import uuid
import logging

logger = logging.getLogger("salemate.auth")

from app.database import get_db
from app.config import get_settings
from app.services.auth_service import AuthService

security = HTTPBearer()
settings = get_settings()


# Khởi tạo JWKS Client nếu có SUPABASE_URL để hỗ trợ Asymmetric Keys (ECC/RS256)
jwks_client = None
if settings.SUPABASE_URL:
    jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    jwks_client = jwt.PyJWKClient(jwks_url)


def _decode_supabase_payload(token: str) -> dict | None:
    # 1. Thử giải mã bằng Asymmetric Keys (JWKS) — Chuẩn mới của Supabase (ES256)
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                options={"verify_aud": False},
            )
        except Exception as e:
            # Chỉ log debug nếu cần, vì có thể token này dùng HS256
            pass

    # 2. Thử giải mã bằng Symmetric Secret (HS256) — Chuẩn cũ/Legacy
    sup_secret = (settings.SUPABASE_JWT_SECRET or "").strip()
    if sup_secret:
        # Loại bỏ dấu nháy nếu người dùng lỡ copy cả vào env
        sup_secret = sup_secret.strip("'").strip('"')
        
        # Thử giải mã với chuỗi gốc và chuỗi đã decode base64 (Supabase thường dùng base64)
        secrets_to_try = [sup_secret]
        import base64
        try:
            # Thêm padding nếu thiếu để b64decode không lỗi
            missing_padding = len(sup_secret) % 4
            if missing_padding:
                padded_secret = sup_secret + ('=' * (4 - missing_padding))
                secrets_to_try.append(base64.b64decode(padded_secret))
            else:
                secrets_to_try.append(base64.b64decode(sup_secret))
        except Exception:
            pass

        for secret in secrets_to_try:
            try:
                return jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
            except jwt.PyJWTError:
                continue
    
    logger.warning("[Auth] Token decoding failed for all methods.")
    return None


async def get_current_workspace_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    token = credentials.credentials
    payload = _decode_supabase_payload(token)

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
