import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.database import async_session

async def test_conn():
    print("Testing database connection...")
    try:
        async with async_session() as db:
            result = await db.execute(text("SELECT 1"))
            print(f"Success: {result.scalar()}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
