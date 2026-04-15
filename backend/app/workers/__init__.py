from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "salemate",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "daily-report": {
            "task": "app.workers.daily_report.generate_daily_reports",
            "schedule": crontab(minute=0),  # every hour, check if it's the shop's report hour
        },
        "weekly-clustering": {
            "task": "app.workers.clustering.run_clustering",
            "schedule": crontab(hour=3, minute=0, day_of_week=1),  # Monday 03:00 KST
        },
        "daily-embeddings": {
            "task": "app.workers.embeddings.embed_all_workspaces",
            "schedule": crontab(hour=2, minute=0),  # Daily 02:00 KST
        },
    },
)

celery_app.autodiscover_tasks(["app.workers"])
