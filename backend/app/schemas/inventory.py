import re
import uuid

from typing import Any
from pydantic import BaseModel, Field, field_validator


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    price: int = 0
    currency: str = "KRW"
    quantity: int = 0
    stock_threshold: int = 5
    image_url: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    price: int | None = None
    quantity: int | None = None
    stock_threshold: int | None = None
    image_url: str | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str | None
    price: int
    currency: str
    quantity: int
    stock_threshold: int
    image_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


def _normalize_spreadsheet_id(v: object) -> str:
    if not isinstance(v, str):
        return str(v)
    s = v.strip()
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", s)
    if m:
        return m.group(1)
    return s


class SheetImportRequest(BaseModel):
    spreadsheet_id: str
    sheet_name: str = "Sheet1"
    entity: str = Field("products", description="products | customers")
    header_row: int = Field(1, ge=1)
    data_start_row: int = Field(2, ge=1)
    range_a1: str | None = Field(None, description="VD: A1:Z999 — tùy chọn")
    column_mapping: dict[str, str] | None = Field(None, description="Ánh xạ trường Salemate -> Tên cột trong sheet")

    @field_validator("spreadsheet_id", mode="before")
    @classmethod
    def normalize_spreadsheet_id(cls, v: object) -> str:
        return _normalize_spreadsheet_id(v)


class SheetImportSummary(BaseModel):
    total_rows: int
    created: int
    updated: int
    errors: list[str] = []


class ImportJobCreateResponse(BaseModel):
    job_id: uuid.UUID


class ImportJobStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    progress_percent: int
    result: SheetImportSummary | None = None
    error_message: str | None = None


class SheetTabsResponse(BaseModel):
    titles: list[str]


class SheetPreviewResponse(BaseModel):
    rows: list[list[Any]]
