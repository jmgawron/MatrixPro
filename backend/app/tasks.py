"""
Background tasks for search functionality.

Provides nightly batch sync job to ensure FTS5 index consistency
and detect/repair any index corruption.
"""

import logging
from datetime import datetime
from sqlalchemy import text
from app.database import engine

logger = logging.getLogger(__name__)


def sync_fts5_index():
    """
    Nightly batch sync job for FTS5 index consistency.
    
    This job:
    1. Detects orphaned FTS5 entries (rowid not in user_level_content)
    2. Detects missing FTS5 entries (user_level_content not in FTS5)
    3. Rebuilds the entire FTS5 index if corruption detected
    4. Logs statistics for monitoring
    
    Should be scheduled to run nightly (e.g., via APScheduler or Celery).
    """
    
    logger.info("Starting FTS5 index sync job...")
    
    with engine.connect() as conn:
        try:
            # Step 1: Check for orphaned FTS5 entries
            orphaned_count = conn.execute(text("""
                SELECT COUNT(*)
                FROM user_content_fts fts
                LEFT JOIN user_level_content ulc ON fts.rowid = ulc.id
                WHERE ulc.id IS NULL;
            """)).scalar()
            
            if orphaned_count > 0:
                logger.warning(f"Found {orphaned_count} orphaned FTS5 entries, cleaning up...")
                conn.execute(text("""
                    DELETE FROM user_content_fts
                    WHERE rowid NOT IN (SELECT id FROM user_level_content);
                """))
                conn.commit()
            
            # Step 2: Check for missing FTS5 entries
            missing_count = conn.execute(text("""
                SELECT COUNT(*)
                FROM user_level_content ulc
                LEFT JOIN user_content_fts fts ON ulc.id = fts.rowid
                WHERE ulc.deleted_at IS NULL AND fts.rowid IS NULL;
            """)).scalar()
            
            if missing_count > 0:
                logger.warning(f"Found {missing_count} missing FTS5 entries, rebuilding...")
                conn.execute(text("""
                    INSERT INTO user_content_fts(rowid, title, description)
                    SELECT id, title, description
                    FROM user_level_content
                    WHERE deleted_at IS NULL
                    AND id NOT IN (SELECT rowid FROM user_content_fts);
                """))
                conn.commit()
            
            # Step 3: Verify index integrity
            total_content = conn.execute(text("""
                SELECT COUNT(*) FROM user_level_content WHERE deleted_at IS NULL;
            """)).scalar()
            
            total_fts = conn.execute(text("""
                SELECT COUNT(*) FROM user_content_fts;
            """)).scalar()
            
            logger.info(f"FTS5 sync complete: {total_content} content items, {total_fts} FTS entries")
            
            if total_content != total_fts:
                logger.error(f"Index mismatch detected: {total_content} content vs {total_fts} FTS entries")
                # Trigger full rebuild
                logger.info("Triggering full FTS5 index rebuild...")
                conn.execute(text("DELETE FROM user_content_fts;"))
                conn.execute(text("""
                    INSERT INTO user_content_fts(rowid, title, description)
                    SELECT id, title, description
                    FROM user_level_content
                    WHERE deleted_at IS NULL;
                """))
                conn.commit()
                logger.info("Full rebuild complete")
            
            return {
                "status": "success",
                "orphaned_cleaned": orphaned_count,
                "missing_added": missing_count,
                "total_content": total_content,
                "total_fts": total_fts,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"FTS5 sync job failed: {e}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


def schedule_fts5_sync():
    """
    Schedule the FTS5 sync job to run nightly.
    
    Example using APScheduler:
    
        from apscheduler.schedulers.background import BackgroundScheduler
        from app.tasks import schedule_fts5_sync
        
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            sync_fts5_index,
            'cron',
            hour=2,  # Run at 2 AM UTC
            minute=0,
            id='fts5_sync'
        )
        scheduler.start()
    
    Example using Celery:
    
        from celery import Celery
        from celery.schedules import crontab
        from app.tasks import sync_fts5_index
        
        app = Celery('matrixpro')
        app.conf.beat_schedule = {
            'fts5-sync': {
                'task': 'app.tasks.sync_fts5_index',
                'schedule': crontab(hour=2, minute=0),
            },
        }
    """
    pass


# Example: Manual trigger for testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = sync_fts5_index()
    print(result)
