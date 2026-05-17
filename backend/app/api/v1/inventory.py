import json
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_workspace_id
from app.models.import_job import ImportJob, ImportJobStatus
from app.models.import_template import ImportTemplate
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
    ColumnSuggestRequest,
    ColumnSuggestResponse,
    ColumnSuggestEntry,
    ImportTemplateCreate,
    ImportTemplateResponse,
    GridImportValidateRequest,
    ImportAnalysisResponse,
    ImportAnalysisMatchedField,
    CategorizeRequest,
    CategorizeResponse,
)
from app.services.import_job_runner import run_file_import_job, run_sheets_import_job
from app.services.inventory_service import InventoryService
from app.services.sheets_import_service import (
    guess_header_data_rows_1based,
    list_sheet_titles,
    fetch_sheet_preview,
    parse_upload_to_rows,
    suggest_column_mapping,
    analyze_file_structure,
    import_products_from_values,
    import_customers_from_values,
    run_import_for_workspace,
)
from app.services.categorizer_service import (
    CategorizerService,
    get_workspace_categories,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_UPLOAD_BYTES = 12 * 1024 * 1024


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


_MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024


@router.post("/products/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    product_id: uuid.UUID,
    file: UploadFile = File(...),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a catalog product image (multipart) → Cloudinary → ``image_url``."""
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Chỉ chấp nhận file ảnh (image/*).",
        )
    raw = await file.read()
    if len(raw) > _MAX_PRODUCT_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Ảnh quá lớn (tối đa ~10 MB).",
        )
    if not raw:
        raise HTTPException(status_code=400, detail="File trống.")
    try:
        return await InventoryService.upload_product_photo(
            db, workspace_id, product_id, raw
        )
    except ValueError as e:
        detail = str(e)
        status = 404 if detail == "Product not found" else 503
        raise HTTPException(status_code=status, detail=detail) from e


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
    except Exception:
        logger.exception("spreadsheet_tabs failed workspace=%s", workspace_id)
        raise HTTPException(
            status_code=400,
            detail="Không đọc được danh sách tab Google Sheet. Thử lại hoặc kết nối lại Google.",
        ) from None
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
    except Exception:
        logger.exception(
            "spreadsheet_preview failed workspace=%s sheet=%s",
            workspace_id,
            sheet_name,
        )
        raise HTTPException(
            status_code=400,
            detail="Không xem trước được sheet. Kiểm tra tên tab và quyền truy cập, rồi thử lại.",
        ) from None
    ent = "products"
    h1, d1 = guess_header_data_rows_1based(rows, ent)
    return SheetPreviewResponse(rows=rows, header_row=h1, data_start_row=d1)


@router.post("/import/sheets/validate", response_model=SheetImportSummary)
async def validate_sheet_import(
    payload: SheetImportRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workspace).where(Workspace.id == workspace_id)
    result = await db.execute(stmt)
    ws = result.scalar_one_or_none()
    if not ws or not (ws.google_refresh_token or "").strip():
        raise HTTPException(status_code=400, detail="Chưa kết nối Google.")
    try:
        result_dict = await run_import_for_workspace(
            db,
            ws,
            payload.spreadsheet_id,
            payload.sheet_name,
            payload.entity,
            header_row_1based=payload.header_row,
            data_start_row_1based=payload.data_start_row,
            range_a1=payload.range_a1,
            column_mapping=payload.column_mapping,
            duplicate_strategy=payload.duplicate_strategy,
            ai_categories=payload.ai_categories,
            default_overrides=payload.default_overrides,
            dry_run=True,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SheetImportSummary.model_validate(result_dict)


@router.post("/import/columns/suggest", response_model=ColumnSuggestResponse)
async def import_columns_suggest(payload: ColumnSuggestRequest):
    raw = suggest_column_mapping(payload.headers, payload.entity)
    suggestions: dict[str, ColumnSuggestEntry] = {}
    for k, v in raw.items():
        suggestions[k] = ColumnSuggestEntry(
            header=v.get("header"),
            confidence=float(v.get("confidence") or 0.0),
        )
    return ColumnSuggestResponse(suggestions=suggestions)


@router.post("/import/file/preview", response_model=SheetPreviewResponse)
async def import_file_preview(
    file: UploadFile = File(...),
    entity: str = Form("products"),
    max_rows: int = Form(200),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
):
    _ = workspace_id
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa ~12MB).")
    try:
        rows = parse_upload_to_rows(content, file.filename or "upload.csv", max_rows=max_rows)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    h1, d1 = guess_header_data_rows_1based(rows, entity)
    return SheetPreviewResponse(rows=rows, header_row=h1, data_start_row=d1)


@router.post("/import/analyze", response_model=ImportAnalysisResponse)
async def analyze_import_file(
    file: UploadFile = File(...),
    entity: str = Form("products"),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
):
    """Analyze uploaded file: detect columns, missing fields, smart defaults, embedded images."""
    _ = workspace_id
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa ~12MB).")
    try:
        result = analyze_file_structure(content, file.filename or "upload.csv", entity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    matched = {
        k: ImportAnalysisMatchedField(header=v.get("header"), confidence=v.get("confidence", 0.0))
        for k, v in result.get("matched_fields", {}).items()
    }
    return ImportAnalysisResponse(
        matched_fields=matched,
        missing_fields=result.get("missing_fields", []),
        defaults_applied=result.get("defaults_applied", {}),
        total_rows=result.get("total_rows", 0),
        has_embedded_images=result.get("has_embedded_images", False),
        embedded_image_count=result.get("embedded_image_count", 0),
    )


@router.post("/import/categorize", response_model=CategorizeResponse)
async def categorize_products(
    payload: CategorizeRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """AI-powered product categorization — Phase 3."""
    existing = await get_workspace_categories(db, workspace_id)
    suggestions = await CategorizerService.categorize_products(
        payload.product_names, existing
    )
    return CategorizeResponse(suggestions=suggestions)

@router.post("/import/validate", response_model=SheetImportSummary)
async def import_validate(
    payload: GridImportValidateRequest,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    h_idx = max(0, payload.header_row - 1)
    d_idx = max(h_idx + 1, payload.data_start_row - 1)
    entity_norm = (payload.entity or "products").lower()
    try:
        if entity_norm in ("customer", "customers", "khach", "khách"):
            result = await import_customers_from_values(
                db,
                workspace_id,
                payload.rows,
                h_idx,
                d_idx,
                payload.column_mapping,
                duplicate_strategy=payload.duplicate_strategy,
                default_overrides=payload.default_overrides,
                dry_run=True,
            )
        else:
            result = await import_products_from_values(
                db,
                workspace_id,
                payload.rows,
                h_idx,
                d_idx,
                payload.column_mapping,
                duplicate_strategy=payload.duplicate_strategy,
                ai_categories=payload.ai_categories,
                default_overrides=payload.default_overrides,
                manual_overrides=payload.manual_overrides,
                dry_run=True,
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SheetImportSummary.model_validate(result)


@router.post("/import/file", response_model=ImportJobCreateResponse)
async def enqueue_file_import(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    entity: str = Form("products"),
    header_row: int = Form(1),
    data_start_row: int = Form(2),
    column_mapping_json: str = Form("{}"),
    duplicate_strategy: str = Form("update"),
    ai_categories_json: str = Form("{}"),
    default_overrides_json: str = Form("{}"),
    manual_overrides_json: str = Form("{}"),
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    if duplicate_strategy not in ("skip", "update", "create_all"):
        raise HTTPException(status_code=400, detail="duplicate_strategy không hợp lệ.")
    try:
        column_mapping = json.loads(column_mapping_json) if column_mapping_json.strip() else {}
        if not isinstance(column_mapping, dict):
            raise ValueError("column_mapping phải là object JSON.")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"column_mapping_json không phải JSON: {e}") from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        ai_categories = json.loads(ai_categories_json) if ai_categories_json.strip() else {}
        if not isinstance(ai_categories, dict):
            ai_categories = {}
    except json.JSONDecodeError:
        ai_categories = {}

    try:
        default_overrides = json.loads(default_overrides_json) if default_overrides_json.strip() else {}
        if not isinstance(default_overrides, dict):
            default_overrides = {}
    except json.JSONDecodeError:
        default_overrides = {}

    try:
        manual_overrides = json.loads(manual_overrides_json) if manual_overrides_json.strip() else {}
        if not isinstance(manual_overrides, dict):
            manual_overrides = {}
    except json.JSONDecodeError:
        manual_overrides = {}

    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File quá lớn (tối đa ~12MB).")

    job = ImportJob(
        workspace_id=workspace_id,
        status=ImportJobStatus.pending.value,
        kind=f"file_{entity}",
        progress_percent=0,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)

    background_tasks.add_task(
        run_file_import_job,
        job.id,
        workspace_id,
        content,
        file.filename or "upload.csv",
        entity,
        header_row,
        data_start_row,
        column_mapping,
        duplicate_strategy,  # type: ignore[arg-type]
        ai_categories or None,
        default_overrides or None,
        manual_overrides or None,
    )
    return ImportJobCreateResponse(job_id=job.id)


@router.get("/import/templates", response_model=list[ImportTemplateResponse])
async def list_import_templates(
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ImportTemplate)
        .where(ImportTemplate.workspace_id == workspace_id)
        .order_by(ImportTemplate.updated_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/import/templates", response_model=ImportTemplateResponse)
async def create_import_template(
    payload: ImportTemplateCreate,
    workspace_id: uuid.UUID = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    tpl = ImportTemplate(
        workspace_id=workspace_id,
        name=payload.name,
        entity=payload.entity,
        mapping_json=payload.column_mapping or {},
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


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
        payload.duplicate_strategy,
        payload.ai_categories,
        payload.default_overrides,
        payload.manual_overrides,
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
