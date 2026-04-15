import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.inventory import Product
from app.schemas.inventory import ProductCreate, ProductUpdate, SyncGoogleSheetsRequest, SyncResult
from app.services.notification_service import NotificationService


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
    async def sync_from_sheets(
        db: AsyncSession, workspace_id: uuid.UUID, payload: SyncGoogleSheetsRequest
    ) -> SyncResult:
        """Sync products from Google Sheets."""
        from app.utils.sheets_sync import read_google_sheet

        rows = await read_google_sheet(payload.spreadsheet_id, payload.sheet_name)

        created, updated, errors = 0, 0, []

        for i, row in enumerate(rows):
            try:
                name = row.get("name") or row.get("tên sản phẩm") or row.get("product")
                if not name:
                    continue

                price = int(row.get("price") or row.get("giá") or 0)
                quantity = int(row.get("quantity") or row.get("số lượng") or 0)
                threshold = int(row.get("threshold") or row.get("ngưỡng") or 5)

                stmt = select(Product).where(
                    Product.workspace_id == workspace_id,
                    Product.name == name,
                )
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.price = price
                    existing.quantity = quantity
                    existing.stock_threshold = threshold
                    updated += 1

                    if existing.quantity <= existing.stock_threshold:
                        await NotificationService.notify_low_stock(
                            workspace_id, existing.name, existing.quantity, existing.stock_threshold
                        )
                else:
                    product = Product(
                        workspace_id=workspace_id,
                        name=name,
                        description=row.get("description") or row.get("mô tả") or "",
                        price=price,
                        quantity=quantity,
                        stock_threshold=threshold,
                    )
                    db.add(product)
                    created += 1

            except Exception as e:
                errors.append(f"Row {i + 2}: {str(e)}")

        await db.commit()

        # Trigger async embedding for new/updated products
        from app.workers.embeddings import embed_workspace_products
        embed_workspace_products.delay(str(workspace_id))

        return SyncResult(total_rows=len(rows), created=created, updated=updated, errors=errors)

    @staticmethod
    async def _update_embedding(db: AsyncSession, product: Product):
        """Generate and store product embedding for RAG search."""
        try:
            from app.services.rag_service import RAGService
            await RAGService.embed_product(db, product)
        except Exception:
            pass
