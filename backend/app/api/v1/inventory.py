from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.schemas.inventory import (
    ProductCreate, ProductUpdate, ProductResponse,
    SyncGoogleSheetsRequest, SyncResult,
)
from app.services.inventory_service import InventoryService

router = APIRouter()


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    return await InventoryService.list_products(db, workspace_id)


@router.post("/products", response_model=ProductResponse)
async def create_product(
    payload: ProductCreate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    return await InventoryService.create_product(db, workspace_id, payload)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    return await InventoryService.update_product(db, workspace_id, product_id, payload)


@router.post("/sync", response_model=SyncResult)
async def sync_google_sheets(
    payload: SyncGoogleSheetsRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Sync inventory from Google Sheets."""
    return await InventoryService.sync_from_sheets(db, workspace_id, payload)
