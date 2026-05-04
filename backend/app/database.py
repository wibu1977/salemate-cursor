import ssl

import certifi
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()


def _asyncpg_ssl() -> ssl.SSLContext | bool:
    """asyncpg không dùng ?sslmode= trong URL; TLS qua connect_args.ssl.

    Priority order:
    1. DATABASE_SSL_INSECURE=true → skip verification (MITM proxy / self-signed DB / Supabase pooler)
    2. certifi CA bundle → comprehensive public root certs (Supabase, Railway, AWS, etc.)
    3. Fallback → system default context
    """
    if settings.DATABASE_SSL_INSECURE:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    # Production: use certifi CA bundle (covers most cloud providers).
    # Falls back to system default if certifi is unavailable.
    try:
        ctx = ssl.create_default_context(cafile=certifi.where())
    except (FileNotFoundError, OSError):
        ctx = ssl.create_default_context()
    return ctx


# Supabase:
# - Direct host db.<ref>.supabase.co:5432 — requires IPv4 add-on or allowlisting.
# - Transaction Pooler: aws-0-<region>.pooler.supabase.com:6543 — bypasses IP restrictions,
#   requires DATABASE_SSL_INSECURE=true due to self-signed cert chain (or provide sslrootcert).
# - Session Pooler: same host, port 5432 — use for Alembic/psycopg2 (DATABASE_URL_SYNC).
# PgBouncer / Supavisor requires statement_cache_size=0 (already set below).
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "ssl": _asyncpg_ssl(),
        # Seconds — avoid hanging on slow network (asyncpg)
        "timeout": 30,
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
