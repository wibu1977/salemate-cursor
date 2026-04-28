import ssl

import certifi
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()


def _asyncpg_ssl() -> ssl.SSLContext | bool:
    """asyncpg không dùng ?sslmode= trong URL; TLS qua connect_args.ssl."""
    if settings.DATABASE_SSL_INSECURE:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context(cafile=certifi.where())


# Supabase:
# - Host dạng db.<ref>.supabase.co:5432 = kết nối trực tiếp Postgres (thường dùng cho asyncpg).
# - Pooler: hostname chứa pooler.supabase / supavisor, hoặc port 6543 (transaction) — PgBouncer
#   hay yêu cầu statement_cache_size=0 (đã bật).
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "statement_cache_size": 0,
        "ssl": _asyncpg_ssl(),
        # Giây — tránh treo khi mạng chậm (asyncpg)
        "timeout": 30,
        # Đảm bảo UTF-8 encoding cho tiếng Việt
        "client_encoding": "UTF8",
    },
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
