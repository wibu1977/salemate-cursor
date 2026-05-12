import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.models.import_job import ImportJob, ImportJobStatus
from app.models.workspace import Workspace
from app.schemas.inventory import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    SheetImportRequest,
    ImportJobCreateResponse,
    ImportJobStatusResponse,
    SheetImportSummary,
    SheetTabsResponse,
    SheetPreviewResponse,
)
from app.services.import_job_runner import run_sheets_import_job
from app.services.inventory_service import InventoryService
from app.services.sheets_import_service import list_sheet_titles, fetch_sheet_preview

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


@router.get("/google/spreadsheets/tabs", response_model=SheetTabsResponse)
async def spreadsheet_tabs(
    spreadsheet_id: str,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws or not (ws.google_refresh_token or "").strip():
        raise HTTPException(status_code=400, detail="Chưa kết nối Google. Dùng /admin/auth/google/login trước.")
    try:
        titles = await list_sheet_titles(db, ws, spreadsheet_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SheetTabsResponse(titles=titles)


@router.get("/google/spreadsheets/preview", response_model=SheetPreviewResponse)
async def spreadsheet_preview(
    spreadsheet_id: str,
    sheet_name: str,
    limit: int = 10,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws or not (ws.google_refresh_token or "").strip():
        raise HTTPException(status_code=400, detail="Chưa kết nối Google.")
    try:
        rows = await fetch_sheet_preview(db, ws, spreadsheet_id, sheet_name, limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SheetPreviewResponse(rows=rows)


@router.post("/import/sheets", response_model=ImportJobCreateResponse)
async def enqueue_sheet_import(
    payload: SheetImportRequest,
    background_tasks: BackgroundTasks,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws or not (ws.google_refresh_token or "").strip():
        raise HTTPException(status_code=400, detail="Chưa kết nối Google.")

    job = ImportJob(
        workspace_id=workspace_id,
        status=ImportJobStatus.pending.value,
        kind=f"sheets_{payload.entity}",
        progress_percent=0,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    background_tasks.add_task(
        run_sheets_import_job,
        job.id,
        workspace_id,
        payload.spreadsheet_id,
        payload.sheet_name,
        payload.entity,
        payload.header_row,
        payload.data_start_row,
        payload.range_a1,
        payload.column_mapping,
    )
    return ImportJobCreateResponse(job_id=job.id)


@router.get("/import/jobs/{job_id}", response_model=ImportJobStatusResponse)
async def get_import_job(
    job_id: uuid.UUID,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ImportJob).where(
        ImportJob.id == job_id,
        ImportJob.workspace_id == workspace_id,
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job.")

    summary = None
    if job.result_json:
        try:
            summary = SheetImportSummary.model_validate(job.result_json)
        except Exception:
            summary = None

    return ImportJobStatusResponse(
        id=job.id,
        status=job.status,
        progress_percent=job.progress_percent,
        result=summary,
        error_message=job.error_message,
    )
