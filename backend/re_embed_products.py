import asyncio
import uuid
from sqlalchemy import select
from app.database import async_session
from app.models.inventory import Product
from app.services.rag_service import RAGService

async def re_embed_all_products():
    async with async_session() as db:
        # Fetch all products
        stmt = select(Product)
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        print(f"Found {len(products)} products to re-embed.")
        
        count = 0
        for product in products:
            try:
                await RAGService.embed_product(db, product)
                count += 1
                if count % 10 == 0:
                    print(f"Embedded {count}/{len(products)}...")
            except Exception as e:
                print(f"Failed to embed {product.name}: {e}")
        
        await db.commit()
        print(f"Successfully re-embedded {count} products.")

if __name__ == "__main__":
    asyncio.run(re_embed_all_products())
