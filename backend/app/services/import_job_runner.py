"""Chạy ImportJob trong FastAPI BackgroundTasks (phiên async riêng)."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select

from app.database import async_session
from app.models.import_job import ImportJob, ImportJobStatus
from app.models.workspace import Workspace
from app.services.sheets_import_service import run_import_for_workspace

logger = logging.getLogger("salemate.import_job")


async def run_sheets_import_job(
    job_id: uuid.UUID,
    workspace_id: uuid.UUID,
    spreadsheet_id: str,
    sheet_name: str,
    entity: str,
    header_row: int,
    data_start_row: int,
    range_a1: str | None,
    column_mapping: dict[str, str] | None = None,
) -> None:
    async with async_session() as session:
        job = await session.get(ImportJob, job_id)
        if not job:
            logger.error("ImportJob %s không tồn tại", job_id)
            return

        stmt = select(Workspace).where(Workspace.id == workspace_id)
        res = await session.execute(stmt)
        ws = res.scalar_one_or_none()
        if not ws:
            job.status = ImportJobStatus.failed.value
            job.error_message = "Workspace không tồn tại."
            await session.commit()
            return

        job.status = ImportJobStatus.processing.value
        job.progress_percent = 10
        await session.commit()

        try:
            result = await run_import_for_workspace(
                session,
                ws,
                spreadsheet_id,
                sheet_name,
                entity,
                header_row_1based=header_row,
                data_start_row_1based=data_start_row,
                range_a1=range_a1,
                column_mapping=column_mapping,
            )
            job_row = await session.get(ImportJob, job_id)
            if not job_row:
                return
            job_row.status = ImportJobStatus.completed.value
            job_row.progress_percent = 100
            job_row.result_json = result
            job_row.error_message = None
        except Exception as e:
            logger.exception("Import job %s thất bại", job_id)
            job_row = await session.get(ImportJob, job_id)
            if job_row:
                job_row.status = ImportJobStatus.failed.value
                job_row.error_message = str(e)
                job_row.result_json = None
        await session.commit()
