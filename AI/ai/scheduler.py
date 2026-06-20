# ai/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from ai.vector_store import rebuild_vector_db

scheduler = BackgroundScheduler()

def start_scheduler():
    scheduler = BackgroundScheduler()

    scheduler.add_job(
        func=rebuild_vector_db,
        trigger="cron",
        hour=3,   # 3 AM daily
        args=["SYSTEM_TOKEN"]
    )

    scheduler.start()