import logging
import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Product
from app.models.order import OrderItem
from app.schemas.inventory import ProductCreate, ProductUpdate
from app.services.notification_service import NotificationService

logger = logging.getLogger("salemate.inventory")


class InventoryService:
    @staticmethod
    async def list_products(db: AsyncSession, workspace_id: uuid.UUID) -> list:
        stmt = (
            select(Product)
            .where(Product.workspace_id == workspace_id)
            .order_by(Product.name)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_product(
        db: AsyncSession, workspace_id: uuid.UUID, payload: ProductCreate
    ) -> Product:
        product = Product(workspace_id=workspace_id, **payload.model_dump())
        db.add(product)
        await db.flush()

        await InventoryService._update_embedding(db, product)
        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def update_product(
        db: AsyncSession, workspace_id: uuid.UUID,
        product_id: uuid.UUID, payload: ProductUpdate
    ) -> Product:
        stmt = select(Product).where(
            Product.id == product_id,
            Product.workspace_id == workspace_id,
        )
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            raise ValueError("Product not found")

        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)

        if "name" in update_data or "description" in update_data:
            await InventoryService._update_embedding(db, product)

        if product.quantity <= product.stock_threshold:
            await NotificationService.notify_low_stock(
                workspace_id, product.name, product.quantity, product.stock_threshold
            )

        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def upload_product_photo(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        product_id: uuid.UUID,
        image_bytes: bytes,
    ) -> Product:
        """Push bytes to Cloudinary and set ``product.image_url``."""
        stmt = select(Product).where(
            Product.id == product_id,
            Product.workspace_id == workspace_id,
        )
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            raise ValueError("Product not found")

        from app.services.storage_service import StorageService

        url = await StorageService.upload_product_image_for_id(
            image_bytes,
            str(workspace_id),
            str(product_id),
        )
        if not (url or "").strip():
            raise ValueError(
                "Tải ảnh thất bại. Kiểm tra CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, "
                "CLOUDINARY_API_SECRET trên máy chủ."
            )

        product.image_url = url.strip()
        await db.commit()
        await db.refresh(product)
        return product

    @staticmethod
    async def delete_product(
        db: AsyncSession,
        workspace_id: uuid.UUID,
        product_id: uuid.UUID,
    ) -> None:
        stmt = select(Product.id).where(
            Product.id == product_id,
            Product.workspace_id == workspace_id,
        )
        exists = await db.execute(stmt)
        if exists.scalar_one_or_none() is None:
            raise ValueError("Product not found")

        await db.execute(
            update(OrderItem)
            .where(OrderItem.product_id == product_id)
            .values(product_id=None),
        )
        await db.execute(
            delete(Product).where(
                Product.id == product_id,
                Product.workspace_id == workspace_id,
            ),
        )
        await db.commit()

    @staticmethod
    async def _update_embedding(db: AsyncSession, product: Product):
        """Generate and store product embedding for RAG search."""
        try:
            from app.services.rag_service import RAGService
            await RAGService.embed_product(db, product)
        except Exception:
            pass
