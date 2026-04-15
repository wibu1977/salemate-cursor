from pydantic import BaseModel
import uuid


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


class SyncGoogleSheetsRequest(BaseModel):
    spreadsheet_id: str
    sheet_name: str = "Sheet1"


class SyncResult(BaseModel):
    total_rows: int
    created: int
    updated: int
    errors: list[str] = []
