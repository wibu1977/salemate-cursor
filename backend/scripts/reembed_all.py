import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.database import async_session
from app.models.inventory import Product
from app.services.rag_service import RAGService

async def reembed_all():
    print("Starting re-embedding all products...")
    async with async_session() as db:
        stmt = select(Product).where(Product.is_active == True)
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        print(f"Found {len(products)} active products.")
        
        count = 0
        for p in products:
            try:
                # Force re-embedding by calling embed_product (which updates product.embedding)
                await RAGService.embed_product(db, p)
                count += 1
                if count % 10 == 0:
                    print(f"Embedded {count}/{len(products)}...")
            except Exception as e:
                print(f"Failed to embed {p.name}: {e}")
        
        await db.commit()
        print(f"Successfully re-embedded {count} products.")

if __name__ == "__main__":
    asyncio.run(reembed_all())
