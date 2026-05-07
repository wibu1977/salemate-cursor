"""Đọc Google Sheets (OAuth) và import sản phẩm / khách hàng — validation + upsert."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

import asyncio
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.customer import Customer
from app.models.inventory import Product
from app.models.workspace import Workspace
from app.services.google_oauth_service import ensure_valid_access_token
from app.services.notification_service import NotificationService

logger = logging.getLogger("salemate.sheets_import")

# Khớp tiêu đề cột (không phân biệt hoa thường, có dấu / không dấu đơn giản)
NAME_KEYS = (
    "name",
    "tên",
    "ten",
    "product",
    "sản phẩm",
    "san pham",
    "tên sản phẩm",
)
PRICE_KEYS = ("price", "giá", "gia", "gia ban")
QTY_KEYS = ("quantity", "số lượng", "so luong", "stock", "ton", "tồn")
THRESHOLD_KEYS = ("threshold", "ngưỡng", "nguong", "stock_threshold")
DESC_KEYS = ("description", "mô tả", "mo ta")
PHONE_KEYS = ("phone", "sđt", "sdt", "tel", "mobile", "điện thoại", "dien thoai")
EMAIL_KEYS = ("email", "e-mail", "mail")
NOTE_KEYS = ("note", "ghi chú", "ghichu", "ghi chu", "comments")


def _norm_key(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def _build_header_index(headers: list[str]) -> dict[str, int]:
    idx: dict[str, int] = {}
    for i, h in enumerate(headers):
        k = _norm_key(str(h))
        if k:
            idx[k] = i
    return idx


def _find_col(header_idx: dict[str, int], key_map: tuple[str, ...]) -> int | None:
    for key in key_map:
        nk = _norm_key(key)
        if nk in header_idx:
            return header_idx[nk]
    for hk, col in header_idx.items():
        for key in key_map:
            nk = _norm_key(key)
            if nk and (nk in hk or hk in nk):
                return col
    return None


def _cell(row: list[Any], i: int | None) -> str:
    if i is None or i >= len(row):
        return ""
    v = row[i]
    if v is None:
        return ""
    return str(v).strip()


_SAFE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    if _SAFE_EMAIL.match(s):
        return s.lower()
    return None


def normalize_phone(raw: str) -> str | None:
    """Chuẩn hóa tối thiểu: chỉ số +, độ dài hợp lý."""
    s = re.sub(r"[^\d+]", "", (raw or "").strip())
    if not s:
        return None
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("0") and not s.startswith("0+"):
        s = "+84" + s[1:]  # mặc định VN khi bắt đầu 0
    if len(s) < 8:
        return None
    return s


async def _get_sheets_service(workspace: Workspace, access_token: str):
    def _build():
        creds = Credentials(token=access_token)
        return build("sheets", "v4", credentials=creds, cache_discovery=False)

    return await asyncio.to_thread(_build)


def _extract_spreadsheet_id(raw: str) -> str:
    raw = (raw or "").strip()
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", raw)
    if m:
        return m.group(1)
    return raw


async def list_sheet_titles(db: AsyncSession, workspace: Workspace, spreadsheet_id: str) -> list[str]:
    spreadsheet_id = _extract_spreadsheet_id(spreadsheet_id)
    access = await ensure_valid_access_token(db, workspace)
    service = await _get_sheets_service(workspace, access)

    def _call():
        meta = (
            service.spreadsheets()
            .get(spreadsheetId=spreadsheet_id, fields="sheets(properties(title))")
            .execute()
        )
        sheets = meta.get("sheets") or []
        return [s.get("properties", {}).get("title") or "" for s in sheets]

    try:
        return await asyncio.to_thread(_call)
    except HttpError as e:
        logger.warning("Sheets metadata error: %s", e)
        raise ValueError(_http_error_message(e)) from e


async def fetch_sheet_values(
    db: AsyncSession,
    workspace: Workspace,
    spreadsheet_id: str,
    sheet_name: str,
    range_a1: str | None = None,
) -> list[list[Any]]:
    spreadsheet_id = _extract_spreadsheet_id(spreadsheet_id)
    access = await ensure_valid_access_token(db, workspace)
    service = await _get_sheets_service(workspace, access)
    rng = f"'{sheet_name.replace(chr(39), chr(39) * 2)}'!{range_a1}" if range_a1 else f"'{sheet_name.replace(chr(39), chr(39) * 2)}'"

    def _call():
        resp = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=rng, majorDimension="ROWS")
            .execute()
        )
        return resp.get("values") or []

    try:
        return await asyncio.to_thread(_call)
    except HttpError as e:
        raise ValueError(_http_error_message(e)) from e


def _http_error_message(e: HttpError) -> str:
    msg = str(e)
    if e.resp.status == 403:
        return "Google từ chối truy cập. Đảm bảo đã chọn đúng file và tài khoản có quyền xem."
    if e.resp.status == 404:
        return "Không tìm thấy spreadsheet hoặc sheet."
    return f"Lỗi Google Sheets API: {msg}"


async def import_products_from_values(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    rows_2d: list[list[Any]],
    header_row_index: int = 0,
    data_start_index: int = 1,
) -> dict[str, Any]:
    """rows_2d: toàn bộ các dòng; header_row_index là chỉ số 0-based của dòng tiêu đề."""
    if header_row_index >= len(rows_2d):
        raise ValueError("Không có dòng tiêu đề.")

    headers_raw = rows_2d[header_row_index]
    headers = [str(h or "") for h in headers_raw]
    hidx = _build_header_index(headers)

    col_name = _find_col(hidx, NAME_KEYS)
    col_price = _find_col(hidx, PRICE_KEYS)
    col_qty = _find_col(hidx, QTY_KEYS)
    col_thr = _find_col(hidx, THRESHOLD_KEYS)
    col_desc = _find_col(hidx, DESC_KEYS)

    if col_name is None:
        raise ValueError("Không tìm thấy cột tên sản phẩm (name / tên sản phẩm ...).")

    created, updated, errors = 0, 0, []

    for offset, row in enumerate(rows_2d[data_start_index:], start=data_start_index + 1):
        excel_row = offset + 1  # 1-based cho người dùng
        try:
            name = _cell(row, col_name)
            if not name:
                continue
            price_s = _cell(row, col_price) or "0"
            qty_s = _cell(row, col_qty) or "0"
            thr_s = _cell(row, col_thr) or "5"
            try:
                price = int(float(re.sub(r"[^\d.-]", "", price_s) or 0))
            except ValueError:
                price = 0
            try:
                quantity = int(float(re.sub(r"[^\d.-]", "", qty_s) or 0))
            except ValueError:
                quantity = 0
            try:
                threshold = int(float(re.sub(r"[^\d.-]", "", thr_s) or 5))
            except ValueError:
                threshold = 5
            desc = _cell(row, col_desc) if col_desc is not None else ""

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
                if desc:
                    existing.description = desc
                updated += 1
                if existing.quantity <= existing.stock_threshold:
                    await NotificationService.notify_low_stock(
                        workspace_id,
                        existing.name,
                        existing.quantity,
                        existing.stock_threshold,
                    )
            else:
                product = Product(
                    workspace_id=workspace_id,
                    name=name,
                    description=desc or "",
                    price=price,
                    quantity=quantity,
                    stock_threshold=threshold,
                )
                db.add(product)
                created += 1
        except Exception as e:
            errors.append(f"Dòng {excel_row}: {e}")

    await db.commit()

    try:
        from app.workers.embeddings import embed_workspace_products

        embed_workspace_products.delay(str(workspace_id))
    except Exception as e:
        logger.warning("embed_workspace_products: %s", e)

    data_rows = max(0, len(rows_2d) - data_start_index)
    return {
        "total_rows": data_rows,
        "created": created,
        "updated": updated,
        "errors": errors,
    }


async def import_customers_from_values(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    rows_2d: list[list[Any]],
    header_row_index: int = 0,
    data_start_index: int = 1,
) -> dict[str, Any]:
    if header_row_index >= len(rows_2d):
        raise ValueError("Không có dòng tiêu đề.")

    headers_raw = rows_2d[header_row_index]
    hidx = _build_header_index([str(h or "") for h in headers_raw])

    col_name = _find_col(hidx, NAME_KEYS + ("họ tên", "ho ten", "fullname", "full name"))
    col_phone = _find_col(hidx, PHONE_KEYS)
    col_email = _find_col(hidx, EMAIL_KEYS)
    col_note = _find_col(hidx, NOTE_KEYS)

    if col_phone is None and col_email is None:
        raise ValueError("Cần ít nhất một cột số điện thoại hoặc email để khớp khách hàng.")

    created, updated, errors = 0, 0, []

    for offset, row in enumerate(rows_2d[data_start_index:], start=data_start_index + 1):
        excel_row = offset + 1
        try:
            phone = normalize_phone(_cell(row, col_phone)) if col_phone is not None else None
            email = normalize_email(_cell(row, col_email)) if col_email is not None else None
            name = _cell(row, col_name) if col_name is not None else ""
            note = _cell(row, col_note) if col_note is not None else ""

            if not phone and not email:
                errors.append(f"Dòng {excel_row}: thiếu SĐT và email hợp lệ")
                continue

            existing = None
            if phone:
                r = await db.execute(
                    select(Customer).where(
                        Customer.workspace_id == workspace_id,
                        Customer.phone == phone,
                    )
                )
                existing = r.scalar_one_or_none()
            if not existing and email:
                r = await db.execute(
                    select(Customer).where(
                        Customer.workspace_id == workspace_id,
                        Customer.email == email,
                    )
                )
                existing = r.scalar_one_or_none()

            meta_patch = {"import_note": note} if note else None
            if existing:
                if name:
                    existing.name = name
                if email and not existing.email:
                    existing.email = email
                if phone and not existing.phone:
                    existing.phone = phone
                if meta_patch:
                    md = dict(existing.metadata_json or {})
                    md.update({k: v for k, v in meta_patch.items() if v})
                    existing.metadata_json = md
                updated += 1
            else:
                cust = Customer(
                    workspace_id=workspace_id,
                    phone=phone,
                    email=email,
                    name=name or None,
                    metadata_json=meta_patch,
                )
                db.add(cust)
                created += 1
        except Exception as e:
            errors.append(f"Dòng {excel_row}: {e}")

    await db.commit()
    data_rows = max(0, len(rows_2d) - data_start_index)
    return {
        "total_rows": data_rows,
        "created": created,
        "updated": updated,
        "errors": errors,
    }


async def run_import_for_workspace(
    db: AsyncSession,
    workspace: Workspace,
    spreadsheet_id: str,
    sheet_name: str,
    entity: str,
    header_row_1based: int = 1,
    data_start_row_1based: int = 2,
    range_a1: str | None = None,
) -> dict[str, Any]:
    spreadsheet_id = _extract_spreadsheet_id(spreadsheet_id)
    values = await fetch_sheet_values(
        db, workspace, spreadsheet_id, sheet_name, range_a1
    )
    h_idx = max(0, header_row_1based - 1)
    d_idx = max(h_idx + 1, data_start_row_1based - 1)

    entity_norm = (entity or "products").lower()
    if entity_norm in ("customer", "customers", "khach", "khách"):
        return await import_customers_from_values(db, workspace.id, values, h_idx, d_idx)
    return await import_products_from_values(db, workspace.id, values, h_idx, d_idx)
