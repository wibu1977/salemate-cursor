from pydantic_settings import BaseSettings
from functools import lru_cache
from pydantic import model_validator


class Settings(BaseSettings):
    APP_NAME: str = "Salemate V1"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Supabase / PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/salemate"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/salemate"
    # Chỉ True nếu TLS Supabase báo CERTIFICATE_VERIFY_FAILED (proxy/antivirus). Không dùng trên production công khai.
    DATABASE_SSL_INSECURE: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Meta / Facebook
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_VERIFY_TOKEN: str = "salemate_verify_token"
    SALEMATE_PAGE_ID: str = ""
    SALEMATE_PAGE_ACCESS_TOKEN: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Toss Payments
    TOSS_CLIENT_KEY: str = ""
    TOSS_SECRET_KEY: str = ""
    TOSS_WEBHOOK_SECRET: str = ""

    # Google Cloud Vision
    GOOGLE_CLOUD_CREDENTIALS: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Google Sheets
    GOOGLE_SHEETS_CREDENTIALS: str = ""

    # JWT Auth
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://127.0.0.1:3000",
        "https://127.0.0.1:3000",
        "http://localhost:3002",
        "https://localhost:3002",
        "http://127.0.0.1:3002",
        "https://127.0.0.1:3002",
        "https://salemate.vercel.app",
        # Vercel preview/production (dự án frontend — cập nhật nếu đổi tên project)
        "https://frontend-ivory-ten-93.vercel.app",
        "https://frontend-k52ygbxh1-wibu1977s-projects.vercel.app",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def jwt_secret_nonempty(self) -> "Settings":
        # .env có JWT_SECRET_KEY= (rỗng) sẽ ghi đè default → PyJWT ném InvalidKeyError khi đăng nhập.
        if not (self.JWT_SECRET_KEY or "").strip():
            object.__setattr__(
                self,
                "JWT_SECRET_KEY",
                "insecure-dev-only-set-JWT_SECRET_KEY-in-env-for-production",
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
