"""
Hybrid Clustering: K-Means on RFM features + LLM label translation.

Key design decisions:
1. pd.read_sql_query() via sync engine — data stays in C++/Pandas layer, no ORM
   objects loaded into Python RAM. Handles 100k+ customers without OOM.
2. INSERT NEW segments each run (never upsert). Prevents the "Shifting Cluster"
   bug where K-Means silently reassigns cluster meanings between runs.
3. is_latest flag: only latest run visible in Campaign UI. Old segments preserved
   so scheduled campaigns keep their original audience.
4. Fallback: < MIN_CUSTOMERS_FOR_KMEANS → simple RFM if/else rules.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select, update, text
from sqlalchemy import create_engine
from openai import AsyncOpenAI

from app.workers import celery_app
from app.database import async_session
from app.models.workspace import Workspace
from app.models.customer import Customer
from app.models.segment import CustomerSegment
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("salemate.clustering")
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

KST = timezone(timedelta(hours=9))
MIN_CUSTOMERS_FOR_KMEANS = 5
MAX_CLUSTERS = 6

_sync_engine = None


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_size=2, max_overflow=0)
    return _sync_engine


@celery_app.task
def run_clustering():
    asyncio.get_event_loop().run_until_complete(_cluster_all_workspaces())


async def _cluster_all_workspaces():
    async with async_session() as db:
        stmt = select(Workspace).where(Workspace.is_active == True)
        result = await db.execute(stmt)
        workspaces = result.scalars().all()

        for workspace in workspaces:
            try:
                await _cluster_workspace(db, workspace.id, workspace.name)
            except Exception:
                logger.exception("Clustering failed for workspace %s", workspace.id)


async def _notify_clustering_done(workspace_id: uuid.UUID, n_clusters: int, n_customers: int):
    """Send a Messenger notification to the shop owner after clustering finishes."""
    try:
        from app.services.notification_service import NotificationService
        msg = (
            f"🔄 Phân nhóm khách hàng hoàn tất\n"
            f"━━━━━━━━━━━━━━━\n"
            f"Số nhóm: {n_clusters}\n"
            f"Tổng khách hàng: {n_customers}\n\n"
            f"Vào Dashboard → Chiến dịch để xem nhóm mới và tạo chiến dịch nhắm mục tiêu."
        )
        await NotificationService._send_to_admin(workspace_id, msg)
    except Exception:
        logger.exception("Clustering notification failed for workspace %s", workspace_id)


async def _cluster_workspace(db, workspace_id: uuid.UUID, workspace_name: str):
    run_id = str(uuid.uuid4())
    now = datetime.now(KST)

    # --- Load RFM data via pd.read_sql_query (C++ layer, no ORM overhead) ---
    query = text("""
        SELECT
            id,
            total_orders,
            total_spent,
            EXTRACT(EPOCH FROM (:now - COALESCE(last_order_at, created_at))) / 86400.0 AS recency_days
        FROM customers
        WHERE workspace_id = :ws_id
    """)

    engine = _get_sync_engine()
    df = pd.read_sql_query(
        query,
        engine,
        params={"ws_id": str(workspace_id), "now": now.astimezone(timezone.utc).replace(tzinfo=None)},
    )

    if df.empty:
        logger.info("No customers for workspace %s, skipping", workspace_id)
        return

    # --- Fallback: too few customers for K-Means ---
    if len(df) < MIN_CUSTOMERS_FOR_KMEANS:
        await _fallback_rfm(db, workspace_id, df, run_id)
        return

    # --- K-Means clustering ---
    features = df[["recency_days", "total_orders", "total_spent"]].fillna(0)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    n_clusters = min(MAX_CLUSTERS, max(2, len(df) // 3))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster_label"] = kmeans.fit_predict(scaled)

    # --- Aggregate stats per cluster ---
    cluster_stats = df.groupby("cluster_label").agg(
        customer_count=("id", "count"),
        avg_orders=("total_orders", "mean"),
        avg_spent=("total_spent", "mean"),
        avg_recency=("recency_days", "mean"),
    ).reset_index()

    # --- LLM: translate cluster stats -> human-readable labels ---
    labels = await _llm_translate_clusters(workspace_name, cluster_stats)

    # --- Mark ALL old segments for this workspace as is_latest=False ---
    await db.execute(
        update(CustomerSegment)
        .where(
            CustomerSegment.workspace_id == workspace_id,
            CustomerSegment.is_latest == True,
        )
        .values(is_latest=False)
    )

    # --- INSERT NEW segment rows (never upsert) ---
    segment_map: dict[int, uuid.UUID] = {}

    for _, row in cluster_stats.iterrows():
        ckey = int(row["cluster_label"])
        llm_data = labels.get(ckey, {})

        segment = CustomerSegment(
            workspace_id=workspace_id,
            cluster_key=f"cluster_{ckey}",
            label=llm_data.get("label", f"Nhóm {ckey}"),
            description=llm_data.get("description", ""),
            recommendation=llm_data.get("recommendation", ""),
            customer_count=int(row["customer_count"]),
            avg_orders=round(float(row["avg_orders"]), 1),
            avg_spent=round(float(row["avg_spent"]), 0),
            avg_recency_days=round(float(row["avg_recency"]), 1),
            is_latest=True,
            run_id=run_id,
        )
        db.add(segment)
        await db.flush()
        segment_map[ckey] = segment.id

    # --- Update Customer.segment_id + Customer.cluster (sync both) ---
    for _, cust_row in df.iterrows():
        ckey = int(cust_row["cluster_label"])
        seg_id = segment_map[ckey]
        llm_data = labels.get(ckey, {})
        cluster_str = llm_data.get("label", f"cluster_{ckey}")

        await db.execute(
            update(Customer)
            .where(Customer.id == cust_row["id"])
            .values(segment_id=seg_id, cluster=cluster_str)
        )

    await db.commit()
    logger.info(
        "Clustering done: workspace=%s clusters=%d customers=%d run=%s",
        workspace_id, n_clusters, len(df), run_id,
    )
    await _notify_clustering_done(workspace_id, n_clusters, len(df))


async def _fallback_rfm(db, workspace_id: uuid.UUID, df: pd.DataFrame, run_id: str):
    """Simple RFM rules for small workspaces (< 5 customers)."""
    await db.execute(
        update(CustomerSegment)
        .where(
            CustomerSegment.workspace_id == workspace_id,
            CustomerSegment.is_latest == True,
        )
        .values(is_latest=False)
    )

    rfm_rules = {
        "new": lambda r: r["total_orders"] == 0,
        "dormant": lambda r: r["recency_days"] > 30 and r["total_orders"] > 0,
        "vip": lambda r: r["total_orders"] >= 5 and r["total_spent"] >= 500000,
        "regular": lambda r: True,
    }

    rfm_labels = {
        "new": {"label": "Khách Mới", "description": "Chưa đặt đơn nào", "recommendation": "Gửi khuyến mãi chào mừng"},
        "dormant": {"label": "Ngủ Đông", "description": "Không mua > 30 ngày", "recommendation": "Gửi ưu đãi kích hoạt lại"},
        "vip": {"label": "VIP Trung Thành", "description": "Mua nhiều, giá trị cao", "recommendation": "Ưu đãi độc quyền, mời event"},
        "regular": {"label": "Thường Xuyên", "description": "Mua hàng ổn định", "recommendation": "Gửi sản phẩm mới, cross-sell"},
    }

    segment_map: dict[str, uuid.UUID] = {}
    for key, meta in rfm_labels.items():
        segment = CustomerSegment(
            workspace_id=workspace_id,
            cluster_key=key,
            label=meta["label"],
            description=meta["description"],
            recommendation=meta["recommendation"],
            customer_count=0,
            is_latest=True,
            run_id=run_id,
        )
        db.add(segment)
        await db.flush()
        segment_map[key] = segment.id

    for _, row in df.iterrows():
        assigned = "regular"
        for key, rule_fn in rfm_rules.items():
            if key != "regular" and rule_fn(row):
                assigned = key
                break

        seg_id = segment_map[assigned]
        await db.execute(
            update(Customer)
            .where(Customer.id == row["id"])
            .values(segment_id=seg_id, cluster=rfm_labels[assigned]["label"])
        )

    for key, seg_id in segment_map.items():
        count_df = df[df.apply(lambda r, k=key: rfm_rules[k](r) if k != "regular" else True, axis=1)]
        await db.execute(
            update(CustomerSegment)
            .where(CustomerSegment.id == seg_id)
            .values(customer_count=len(count_df))
        )

    await db.commit()
    logger.info("Fallback RFM done: workspace=%s customers=%d", workspace_id, len(df))
    await _notify_clustering_done(workspace_id, len(rfm_labels), len(df))


async def _llm_translate_clusters(workspace_name: str, stats: pd.DataFrame) -> dict[int, dict]:
    """Ask GPT-4o mini to name each cluster based on its aggregate stats."""
    cluster_descriptions = []
    for _, row in stats.iterrows():
        cluster_descriptions.append(
            f"Cluster {int(row['cluster_label'])}: "
            f"avg_orders={row['avg_orders']:.1f}, "
            f"avg_spent={row['avg_spent']:.0f} KRW, "
            f"count={int(row['customer_count'])}, "
            f"avg_recency={row['avg_recency']:.0f} days"
        )

    prompt = (
        f"Cửa hàng '{workspace_name}' có {len(stats)} nhóm khách hàng từ K-Means:\n"
        + "\n".join(cluster_descriptions)
        + "\n\nVới mỗi cluster, trả về JSON array với các trường:\n"
        '- "cluster": số thứ tự (int)\n'
        '- "label": tên ngắn tiếng Việt có dấu (vd: "VIP Trung Thành", "Khách Mới")\n'
        '- "description": 1 câu mô tả hành vi\n'
        '- "recommendation": gợi ý hành động marketing\n\n'
        "Trả về ĐÚNG JSON array, không giải thích thêm."
    )

    try:
        completion = await openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content.strip()
        parsed = json.loads(raw)

        if isinstance(parsed, dict) and "clusters" in parsed:
            parsed = parsed["clusters"]
        if isinstance(parsed, dict) and not isinstance(parsed, list):
            parsed = list(parsed.values()) if all(isinstance(v, dict) for v in parsed.values()) else [parsed]

        result = {}
        for item in parsed:
            cid = item.get("cluster", 0)
            result[int(cid)] = {
                "label": item.get("label", f"Nhóm {cid}"),
                "description": item.get("description", ""),
                "recommendation": item.get("recommendation", ""),
            }
        return result

    except Exception as e:
        logger.error("LLM translation failed: %s — using fallback labels", e)
        result = {}
        for _, row in stats.iterrows():
            cid = int(row["cluster_label"])
            avg_spent = row["avg_spent"]
            avg_orders = row["avg_orders"]
            recency = row["avg_recency"]

            if avg_orders >= 5 and avg_spent >= 500000:
                label = "VIP Trung Thành"
            elif recency > 30:
                label = "Ngủ Đông"
            elif avg_orders <= 1:
                label = "Khách Mới"
            else:
                label = "Thường Xuyên"

            result[cid] = {"label": label, "description": "", "recommendation": ""}
        return result
