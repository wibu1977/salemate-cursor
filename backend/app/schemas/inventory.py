import re
import uuid

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DuplicateStrategy = Literal["skip", "update", "create_all"]


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
    metadata_json: dict[str, Any] | None = None

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
    duplicate_strategy: DuplicateStrategy = Field(
        "update",
        description="skip | update | create_all",
    )
    ai_categories: dict[str, str] | None = Field(
        None, description="Gợi ý danh mục từ AI (product_name -> category)"
    )
    default_overrides: dict[str, Any] | None = Field(
        None, description="Giá trị mặc định người dùng nhập cho các cột thiếu"
    )
    manual_overrides: dict[str, dict[str, Any]] | None = Field(
        None, description="Ghi đè thủ công từng dòng (product_name -> {field: value})"
    )

    @field_validator("spreadsheet_id", mode="before")
    @classmethod
    def normalize_spreadsheet_id(cls, v: object) -> str:
        return _normalize_spreadsheet_id(v)


class SheetImportSummary(BaseModel):
    total_rows: int
    created: int
    updated: int
    skipped: int = 0
    errors: list[str] = []
    errors_total: int | None = None
    error_csv: str | None = None
    dry_run: bool | None = None
    # Phase 1: smart-defaults metadata
    missing_fields: list[str] | None = None
    auto_filled_fields: dict[str, Any] | None = None


class ColumnSuggestRequest(BaseModel):
    headers: list[str]
    entity: str = "products"


class ColumnSuggestEntry(BaseModel):
    header: str | None = None
    confidence: float = 0.0


class ColumnSuggestResponse(BaseModel):
    suggestions: dict[str, ColumnSuggestEntry]


class ImportTemplateCreate(BaseModel):
    entity: str = "products"
    name: str = "default"
    column_mapping: dict[str, str] = Field(default_factory=dict)
    duplicate_strategy: DuplicateStrategy = "update"


class ImportTemplateResponse(BaseModel):
    """ORM cột mapping_json được trả ra API dưới tên column_mapping."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity: str
    name: str
    column_mapping: dict[str, str] = Field(validation_alias="mapping_json")
    duplicate_strategy: str = Field(default="update")


class GridImportValidateRequest(BaseModel):
    entity: str = "products"
    rows: list[list[Any]]
    header_row: int = Field(1, ge=1)
    data_start_row: int = Field(2, ge=1)
    column_mapping: dict[str, str] | None = None
    duplicate_strategy: DuplicateStrategy = "update"
    ai_categories: dict[str, str] | None = Field(
        None, description="Gợi ý danh mục từ AI hoặc ghi đè từ người dùng"
    )
    default_overrides: dict[str, Any] | None = Field(
        None, description="Giá trị mặc định người dùng nhập cho các cột thiếu"
    )
    manual_overrides: dict[str, dict[str, Any]] | None = Field(
        None, description="Ghi đè thủ công từng dòng (product_name -> {field: value})"
    )


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
    header_row: int = Field(1, ge=1, description="Gợi ý dòng tiêu đề (1-based)")
    data_start_row: int = Field(2, ge=1, description="Gợi ý dòng dữ liệu đầu (1-based)")


class ImportAnalysisMatchedField(BaseModel):
    header: str | None = None
    confidence: float = 0.0


class ImportAnalysisResponse(BaseModel):
    """Response for POST /import/analyze — Phase 1 Smart Gaps."""
    matched_fields: dict[str, ImportAnalysisMatchedField]
    missing_fields: list[str] = []
    defaults_applied: dict[str, Any] = {}
    total_rows: int = 0
    has_embedded_images: bool = False
    embedded_image_count: int = 0


# --- Phase 3: AI Categorization ---

class CategorizeRequest(BaseModel):
    """Request body for POST /import/categorize."""
    product_names: list[str] = Field(..., min_length=1, max_length=500)


class CategorizeResponse(BaseModel):
    """Response for POST /import/categorize."""
    suggestions: dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of product_name → suggested_category",
    )

