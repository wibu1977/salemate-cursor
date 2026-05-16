"""Phase 3: AI-powered product categorization.

Batch-classifies product names into Vietnamese categories using OpenAI.
Reuses existing workspace categories when available so the AI produces
consistent labels across multiple import sessions.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.inventory import Product

settings = get_settings()
logger = logging.getLogger("salemate.categorizer")

_openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

CATEGORIZE_SYSTEM = (
    "Bạn là trợ lý phân loại sản phẩm. "
    "Trả lời ĐÚNG định dạng JSON, KHÔNG thêm markdown, giải thích, hay ký tự ngoài JSON."
)

CATEGORIZE_USER = """\
Phân loại các sản phẩm sau vào danh mục phù hợp.
Trả về JSON array, mỗi phần tử là {{"name": "...", "category": "..."}}.
Dùng danh mục ngắn gọn bằng tiếng Việt (ví dụ: "Điện thoại", "Phụ kiện", "Thực phẩm", "Mỹ phẩm").
Nếu đã có danh mục gợi ý trong danh sách, **ưu tiên dùng lại** danh mục đó thay vì tạo mới.
Nếu không chắc chắn, dùng "Chưa phân loại".

Danh mục đã có trong hệ thống: {existing}

Sản phẩm cần phân loại:
{products}"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MAX_BATCH = 80  # max products per API call (token budget)


async def get_workspace_categories(
    db: AsyncSession,
    workspace_id: Any,
) -> list[str]:
    """Return distinct non-null category values for a workspace."""
    stmt = (
        select(Product.category)
        .where(
            Product.workspace_id == workspace_id,
            Product.category.isnot(None),
            Product.category != "",
        )
        .distinct()
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all() if row[0]]


# ---------------------------------------------------------------------------
# Core service
# ---------------------------------------------------------------------------

class CategorizerService:
    @staticmethod
    async def categorize_products(
        product_names: list[str],
        existing_categories: list[str] | None = None,
    ) -> dict[str, str]:
        """Return ``{product_name: suggested_category}`` for every name.

        Batches products in groups of ~80 to stay within token limits.
        """
        if not product_names:
            return {}

        existing = existing_categories or []
        all_results: dict[str, str] = {}

        # chunk into batches
        for start in range(0, len(product_names), _MAX_BATCH):
            batch = product_names[start : start + _MAX_BATCH]
            product_list = "\n".join(f"- {n}" for n in batch)

            prompt = CATEGORIZE_USER.format(
                existing=", ".join(existing) if existing else "(chưa có)",
                products=product_list,
            )

            try:
                completion = await _openai.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": CATEGORIZE_SYSTEM},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                    max_tokens=2048,
                )
                raw = (completion.choices[0].message.content or "").strip()

                # Strip markdown fences if the model wraps JSON anyway
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[-1]
                if raw.endswith("```"):
                    raw = raw.rsplit("```", 1)[0]
                raw = raw.strip()

                items = json.loads(raw)
                if isinstance(items, list):
                    for item in items:
                        name = item.get("name", "")
                        cat = item.get("category", "Chưa phân loại")
                        if name:
                            all_results[name] = cat
                            # Feed new categories back so subsequent batches reuse them
                            if cat not in existing:
                                existing.append(cat)
                else:
                    logger.warning("AI returned non-list JSON: %s", raw[:200])

            except json.JSONDecodeError:
                logger.warning("Failed to parse AI categorization JSON", exc_info=True)
                for n in batch:
                    all_results.setdefault(n, "Chưa phân loại")
            except Exception:
                logger.warning("AI categorization API call failed", exc_info=True)
                for n in batch:
                    all_results.setdefault(n, "Chưa phân loại")

        # Ensure every input name has an entry
        for n in product_names:
            all_results.setdefault(n, "Chưa phân loại")

        return all_results
