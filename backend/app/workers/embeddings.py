import asyncio
import logging
from sqlalchemy import select

from app.workers import celery_app
from app.database import async_session
from app.models.workspace import Workspace
from app.services.rag_service import RAGService

logger = logging.getLogger("salemate.embeddings")


@celery_app.task
def embed_workspace_products(workspace_id: str):
    """Embed all products missing embeddings for a specific workspace."""
    asyncio.get_event_loop().run_until_complete(_embed(workspace_id))


async def _embed(workspace_id: str):
    async with async_session() as db:
        count = await RAGService.embed_all_products(db, workspace_id)
        logger.info("Embedded %d products for workspace %s", count, workspace_id)


@celery_app.task
def embed_all_workspaces():
    """Periodic job: embed products across all active workspaces."""
    asyncio.get_event_loop().run_until_complete(_embed_all())


async def _embed_all():
    async with async_session() as db:
        stmt = select(Workspace).where(Workspace.is_active == True)
        result = await db.execute(stmt)
        workspaces = result.scalars().all()

        total = 0
        for ws in workspaces:
            count = await RAGService.embed_all_products(db, ws.id)
            total += count

        if total:
            logger.info("Total embedded across all workspaces: %d", total)
