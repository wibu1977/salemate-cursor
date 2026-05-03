import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.config import get_settings
from app.api.v1 import webhook, payments, admin, campaigns, inventory, pages, webview_campaigns

settings = get_settings()
logger = logging.getLogger("salemate")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo database tables nếu chưa có (MVP mode)
    from app.database import engine, Base
    import app.models  # Đảm bảo models đã được load
    
    logger.info("Initializing database tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error("Failed to initialize database: %s", e)
        # Không raise lỗi ở đây để tránh làm chết service nếu lỗi không nghiêm trọng
        # Tuy nhiên trên Railway nên check logs nếu gặp lỗi 500 sau đó.

    try:
        from app.graph_tls import os_trusted_ssl_context

        _ctx = os_trusted_ssl_context(log_agent=False)
        logger.info("Startup: outbound TLS context OK (%s)", type(_ctx).__name__)
        try:
            import truststore  # noqa: F401

            logger.info("Startup: truststore import OK")
        except ImportError:
            logger.warning(
                "Startup: package truststore missing — pip install truststore "
                "(see requirements.txt) or Graph TLS may fall back to certifi only."
            )
    except Exception as e:
        logger.error("Startup: outbound TLS context failed: %s", e)

    if settings.META_GRAPH_SSL_INSECURE:
        logger.warning(
            "META_GRAPH_SSL_INSECURE=true — HTTPS tới graph.facebook.com không xác minh chứng chỉ."
        )

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_admin_requests(request: Request, call_next):
    if request.url.path.startswith("/admin"):
        logger.info("%s %s", request.method, request.url.path)
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Lỗi không bắt được → JSON {detail} thay vì text 'Internal Server Error' (axios đọc được message)."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    msg = (
        str(exc)
        if settings.DEBUG
        else "Lỗi máy chủ. Xem cửa sổ terminal uvicorn (traceback) hoặc bật DEBUG=true trong backend .env."
    )
    return JSONResponse(
        status_code=500,
        content={"detail": {"error": "internal", "message": msg}},
    )


app.include_router(webhook.router, prefix="/webhook", tags=["Meta Webhook"])
app.include_router(payments.router, prefix="/payments", tags=["Payments & OCR"])
app.include_router(admin.router, prefix="/admin", tags=["Admin Dashboard"])
app.include_router(campaigns.router, prefix="/admin/campaigns", tags=["Campaigns"])
app.include_router(inventory.router, prefix="/admin/inventory", tags=["Inventory"])
app.include_router(pages.router, prefix="/admin/pages", tags=["Page Management"])
app.include_router(
    webview_campaigns.router,
    prefix="/webview/campaigns",
    tags=["Webview — Campaign approve"],
)


@app.get("/")
async def root():
    """Railway / nhiều load balancer mặc định ping `/` — tránh 404 làm health fail."""
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/health/tls")
async def health_tls():
    """
    Chẩn đoán TLS tới graph.facebook.com (cùng trust store với MetaService).
    HTTP 200 luôn; xem graph_facebook.tls_ok và http_status (400 = handshake OK, token sai).
    """
    import httpx

    from app.graph_tls import graph_https_verify

    try:
        async with httpx.AsyncClient(
            verify=graph_https_verify(),
            trust_env=False,
            timeout=httpx.Timeout(20.0, connect=15.0),
        ) as client:
            r = await client.get(
                f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/me",
                params={"access_token": "invalid"},
            )
        return {
            "service": settings.APP_NAME,
            "graph_facebook": {
                "tls_ok": True,
                "http_status": r.status_code,
                "note": "HTTP 400 từ Meta là bình thường (token invalid); quan trọng là không lỗi SSL.",
            },
        }
    except Exception as e:
        chain = []
        cur: BaseException | None = e
        while cur is not None and len(chain) < 8:
            chain.append(f"{type(cur).__name__}: {str(cur)[:400]}")
            cur = cur.__cause__
        logger.exception("health/tls: Graph API probe failed")
        return {
            "service": settings.APP_NAME,
            "graph_facebook": {
                "tls_ok": False,
                "error_type": type(e).__name__,
                "message": str(e)[:800],
                "exception_chain": chain,
            },
        }


@app.get("/health/outbound-tls")
async def health_outbound_tls():
    """
    Một lần gọi: TLS/HTTP tới graph.facebook.com + kết nối DB (SELECT 1).
    Dùng để phân biệt lỗi SSL Meta vs Postgres trên cùng process production.
    """
    import httpx
    from sqlalchemy import text

    from app.database import async_session
    from app.graph_tls import graph_https_verify

    out: dict = {"service": settings.APP_NAME}

    try:
        async with httpx.AsyncClient(
            verify=graph_https_verify(),
            trust_env=False,
            timeout=httpx.Timeout(20.0, connect=15.0),
        ) as client:
            r = await client.get(
                f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/me",
                params={"access_token": "invalid"},
            )
        out["graph_facebook"] = {
            "tls_ok": True,
            "http_status": r.status_code,
        }
    except Exception as e:
        chain: list[str] = []
        cur: BaseException | None = e
        while cur is not None and len(chain) < 8:
            chain.append(f"{type(cur).__name__}: {str(cur)[:400]}")
            cur = cur.__cause__
        logger.exception("health/outbound-tls: Graph probe failed")
        out["graph_facebook"] = {
            "tls_ok": False,
            "error_type": type(e).__name__,
            "message": str(e)[:800],
            "exception_chain": chain,
        }

    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        out["database"] = {"reach_ok": True}
    except Exception as e:
        chain_db: list[str] = []
        cur_db: BaseException | None = e
        while cur_db is not None and len(chain_db) < 8:
            chain_db.append(f"{type(cur_db).__name__}: {str(cur_db)[:400]}")
            cur_db = cur_db.__cause__
        logger.exception("health/outbound-tls: database probe failed")
        out["database"] = {
            "reach_ok": False,
            "error_type": type(e).__name__,
            "message": str(e)[:800],
            "exception_chain": chain_db,
        }

    return out
