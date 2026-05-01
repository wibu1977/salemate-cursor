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
