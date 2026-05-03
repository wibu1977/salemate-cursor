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
    DATABASE_SSL_INSECURE: bool = True
    # Chỉ True nếu HTTPS tới graph.facebook.com vẫn CERTIFICATE_VERIFY_FAILED sau khi đã truststore+certifi (MITM nội bộ).
    # Rủi ro bảo mật — chỉ dev / máy bị proxy chèn chứng chỉ tự ký; ưu tiên SSL_CERT_FILE trỏ tới PEM đủ CA.
    META_GRAPH_SSL_INSECURE: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Meta / Facebook
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_VERIFY_TOKEN: str = "salemate_verify_token"
    # Meta Graph API — luôn dạng có phiên bản trong path, vd. v19.0/me?access_token=...
    META_GRAPH_API_VERSION: str = "v19.0"
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

    # JWT Auth (legacy / Facebook login)
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Supabase Auth — JWT Secret từ Dashboard → Settings → API (không phải anon key)
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_URL: str = ""

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
        "https://localhost:3005",
        "https://127.0.0.1:3005",
        "https://salemate.vercel.app",
        # Vercel preview/production (dự án frontend — cập nhật nếu đổi tên project)
        "https://frontend-ivory-ten-93.vercel.app",
        "https://frontend-k52ygbxh1-wibu1977s-projects.vercel.app",
        # Dashboard Railway cũ — có thể xóa khi không còn dùng; production nên bổ sung URL mới qua CORS_ORIGINS trong .env
        "https://pure-curiosity-production-f937.up.railway.app",
    ]

    # Railway / production: thêm nhanh CORS — các URL dashboard phân tách bởi dấu phẩy (vd. https://fe.up.railway.app)
    CORS_EXTRA_ORIGINS: str = ""

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

    @model_validator(mode="after")
    def sanitize_database_url(self) -> "Settings":
        url = self.DATABASE_URL or ""
        
        # 1. Đảm bảo driver là asyncpg cho SQLAlchemy Async
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # 2. Loại bỏ các query params gây lỗi cho asyncpg (như client_encoding)
        if "?" in url:
            base_url, query_params = url.split("?", 1)
            # Giữ lại các params quan trọng nếu cần, hoặc xóa sạch nếu Railway tự thêm rác
            # asyncpg thường cấu hình qua connect_args, không qua query string.
            # Ở đây ta xóa sạch query params để đảm bảo an toàn.
            url = base_url
            
        object.__setattr__(self, "DATABASE_URL", url)
        return self

    @model_validator(mode="after")
    def merge_cors_extra_origins(self) -> "Settings":
        raw = (self.CORS_EXTRA_ORIGINS or "").strip()
        if not raw:
            return self
        extra = [x.strip() for x in raw.split(",") if x.strip()]
        if not extra:
            return self
        merged: list[str] = list(dict.fromkeys([*self.CORS_ORIGINS, *extra]))
        object.__setattr__(self, "CORS_ORIGINS", merged)
        return self

    @model_validator(mode="after")
    def normalize_meta_graph_api_version(self) -> "Settings":
        v = (self.META_GRAPH_API_VERSION or "v19.0").strip()
        if not v:
            v = "v19.0"
        if not v.startswith("v"):
            v = f"v{v}"
        object.__setattr__(self, "META_GRAPH_API_VERSION", v)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
