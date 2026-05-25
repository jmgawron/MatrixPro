"""
Database migrations for search + library functionality.

Runs idempotently on app startup. Handles:
  - Adding `is_private`, `source_user_content_id`, `description_format` columns
    to existing user_level_content tables (preserves seeded LANSW data).
  - Making `plan_skill_id` nullable (Decision 5A).
  - Creating FTS5 virtual table + sync triggers for typo-tolerant search.
  - Creating supporting indexes.

No `deleted_at` column: Decision 3A is hard delete, FTS DELETE trigger handles
index removal.
"""

import logging
from sqlalchemy import text
from app.database import engine

logger = logging.getLogger(__name__)


def _table_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {r[1] for r in rows}


def _ensure_user_level_content_columns(conn):
    cols = _table_columns(conn, "user_level_content")
    if not cols:
        return

    if "is_private" not in cols:
        logger.info("ALTER user_level_content ADD is_private")
        conn.execute(text(
            "ALTER TABLE user_level_content "
            "ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0"
        ))

    if "source_user_content_id" not in cols:
        logger.info("ALTER user_level_content ADD source_user_content_id")
        conn.execute(text(
            "ALTER TABLE user_level_content "
            "ADD COLUMN source_user_content_id INTEGER REFERENCES user_level_content(id) ON DELETE SET NULL"
        ))

    if "description_format" not in cols:
        logger.info("ALTER user_level_content ADD description_format (backfill='legacy_html')")
        conn.execute(text(
            "ALTER TABLE user_level_content "
            "ADD COLUMN description_format VARCHAR(16) NOT NULL DEFAULT 'legacy_html'"
        ))


def run_migrations():
    """Execute all pending migrations idempotently."""
    with engine.connect() as conn:
        _ensure_user_level_content_columns(conn)

        logger.info("Creating user_content_fts virtual table...")
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS user_content_fts USING fts5(
                title,
                description,
                content='user_level_content',
                content_rowid='id',
                tokenize = 'trigram case_sensitive 0'
            );
        """))

        logger.info("Dropping legacy deleted_at-filtered indexes if present...")
        for legacy in (
            "idx_ulc_skill_level_deleted",
            "idx_ulc_team_id",
            "idx_ulc_domain_id",
            "idx_ulc_deleted_at",
        ):
            conn.execute(text(f"DROP INDEX IF EXISTS {legacy};"))

        logger.info("Creating indexes on user_level_content...")
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_ulc_skill_level "
            "ON user_level_content(skill_id, level);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_ulc_engineer_id "
            "ON user_level_content(user_id);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_ulc_plan_skill_id "
            "ON user_level_content(plan_skill_id);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_ulc_source_user_content_id "
            "ON user_level_content(source_user_content_id);"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_ulc_created_at "
            "ON user_level_content(created_at DESC);"
        ))

        logger.info("Creating FTS5 sync triggers...")
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_insert
            AFTER INSERT ON user_level_content BEGIN
                INSERT INTO user_content_fts(rowid, title, description)
                VALUES (new.id, new.title, new.description);
            END;
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_update
            AFTER UPDATE ON user_level_content BEGIN
                INSERT INTO user_content_fts(user_content_fts, rowid, title, description)
                VALUES('delete', old.id, old.title, old.description);
                INSERT INTO user_content_fts(rowid, title, description)
                VALUES (new.id, new.title, new.description);
            END;
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_delete
            AFTER DELETE ON user_level_content BEGIN
                INSERT INTO user_content_fts(user_content_fts, rowid, title, description)
                VALUES('delete', old.id, old.title, old.description);
            END;
        """))

        logger.info("Backfilling FTS5 index for pre-existing rows (if empty)...")
        fts_count = conn.execute(text("SELECT COUNT(*) FROM user_content_fts")).scalar()
        ulc_count = conn.execute(text("SELECT COUNT(*) FROM user_level_content")).scalar()
        if fts_count == 0 and ulc_count and ulc_count > 0:
            logger.info(f"Backfilling {ulc_count} rows into user_content_fts...")
            conn.execute(text(
                "INSERT INTO user_content_fts(rowid, title, description) "
                "SELECT id, title, description FROM user_level_content"
            ))

        conn.commit()
        logger.info("✅ All migrations completed successfully")


def rollback_migrations():
    """Remove all migration artifacts (for testing/cleanup)."""
    with engine.connect() as conn:
        logger.info("Rolling back migrations...")

        for trigger in (
            "user_content_fts_insert",
            "user_content_fts_update",
            "user_content_fts_delete",
        ):
            conn.execute(text(f"DROP TRIGGER IF EXISTS {trigger};"))

        conn.execute(text("DROP TABLE IF EXISTS user_content_fts;"))

        for idx in (
            "idx_ulc_skill_level",
            "idx_ulc_skill_level_deleted",
            "idx_ulc_engineer_id",
            "idx_ulc_team_id",
            "idx_ulc_domain_id",
            "idx_ulc_created_at",
            "idx_ulc_deleted_at",
            "idx_ulc_plan_skill_id",
            "idx_ulc_source_user_content_id",
        ):
            conn.execute(text(f"DROP INDEX IF EXISTS {idx};"))

        conn.commit()
        logger.info("✅ Rollback completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()
