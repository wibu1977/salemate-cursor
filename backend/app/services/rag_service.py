import uuid
import logging
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, cast, String

from app.config import get_settings
from app.models.inventory import Product

settings = get_settings()
logger = logging.getLogger("salemate.rag")

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


class RAGService:
    """
    Hybrid product search:
    1. Try pgvector cosine similarity (semantic)
    2. Fallback to ILIKE text search (keyword)
    3. Final fallback: return all active products
    """

    @staticmethod
    async def search_products(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        query: str,
        limit: int = 8,
    ) -> list[Product]:
        # Strategy 1: Vector similarity
        vector_results = await RAGService._vector_search(db, workspace_id, query, limit)
        if vector_results:
            return vector_results

        # Strategy 2: Text keyword search
        text_results = await RAGService._text_search(db, workspace_id, query, limit)
        if text_results:
            return text_results

        # Strategy 3: All active products
        return await RAGService._all_products(db, workspace_id, limit)

    @staticmethod
    async def _vector_search(
        db: AsyncSession, workspace_id: uuid.UUID, query: str, limit: int
    ) -> list[Product]:
        try:
            embedding = await RAGService.get_embedding(query)
            stmt = (
                select(Product)
                .where(
                    Product.workspace_id == workspace_id,
                    Product.is_active == True,
                    Product.embedding.isnot(None),
                )
                .order_by(Product.embedding.cosine_distance(embedding))
                .limit(limit)
            )
            result = await db.execute(stmt)
            products = list(result.scalars().all())
            if products:
                logger.debug("Vector search returned %d products for '%s'", len(products), query[:50])
            return products
        except Exception as e:
            logger.warning("Vector search failed: %s", e)
            return []

    @staticmethod
    async def _text_search(
        db: AsyncSession, workspace_id: uuid.UUID, query: str, limit: int
    ) -> list[Product]:
        keywords = [kw.strip() for kw in query.split() if len(kw.strip()) >= 2]
        if not keywords:
            return []

        conditions = []
        for kw in keywords[:5]:
            pattern = f"%{kw}%"
            conditions.append(Product.name.ilike(pattern))
            conditions.append(Product.description.ilike(pattern))
            conditions.append(Product.category.ilike(pattern))

        stmt = (
            select(Product)
            .where(
                Product.workspace_id == workspace_id,
                Product.is_active == True,
                or_(*conditions),
            )
            .limit(limit)
        )
        result = await db.execute(stmt)
        products = list(result.scalars().all())
        if products:
            logger.debug("Text search returned %d products for '%s'", len(products), query[:50])
        return products

    @staticmethod
    async def _all_products(
        db: AsyncSession, workspace_id: uuid.UUID, limit: int
    ) -> list[Product]:
        stmt = (
            select(Product)
            .where(Product.workspace_id == workspace_id, Product.is_active == True)
            .order_by(Product.name)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_embedding(text: str) -> list[float]:
        response = await openai_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text[:8000],
        )
        return response.data[0].embedding

    @staticmethod
    async def embed_product(db: AsyncSession, product: Product):
        """Generate and store embedding for a single product."""
        text = f"{product.name}. {product.description or ''} Danh mục: {product.category or 'chung'}"
        try:
            embedding = await RAGService.get_embedding(text)
            product.embedding = embedding
            logger.debug("Embedded product: %s", product.name)
        except Exception as e:
            logger.error("Failed to embed product %s: %s", product.id, e)

    @staticmethod
    async def embed_all_products(db: AsyncSession, workspace_id: uuid.UUID) -> int:
        """Batch embed all products missing embeddings."""
        stmt = select(Product).where(
            Product.workspace_id == workspace_id,
            Product.is_active == True,
            Product.embedding.is_(None),
        )
        result = await db.execute(stmt)
        products = list(result.scalars().all())

        count = 0
        for product in products:
            await RAGService.embed_product(db, product)
            count += 1

        if count > 0:
            await db.commit()
            logger.info("Embedded %d products for workspace %s", count, workspace_id)

        return count
