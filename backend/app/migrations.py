"""
Database migrations for search functionality.

This module provides migration functions to set up FTS5 virtual tables,
indexes, and triggers for the user_level_content search feature.

Usage:
    python -c "from app.migrations import run_migrations; run_migrations()"
"""

import logging
from sqlalchemy import text
from app.database import engine

logger = logging.getLogger(__name__)


def run_migrations():
    """Execute all pending migrations."""
    with engine.connect() as conn:
        # Enable FTS5 extension
        logger.info("Enabling FTS5 extension...")
        conn.execute(text("PRAGMA compile_options;"))
        
        # Create FTS5 virtual table
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
        
        # Create indexes on user_level_content
        logger.info("Creating indexes on user_level_content...")
        
        # Primary composite index for filtering
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_skill_level_deleted
            ON user_level_content(skill_id, level, deleted_at)
            WHERE deleted_at IS NULL;
        """))
        
        # Proximity join indexes
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_engineer_id
            ON user_level_content(user_id)
            WHERE deleted_at IS NULL;
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_team_id
            ON user_level_content(user_id)
            WHERE deleted_at IS NULL;
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_domain_id
            ON user_level_content(user_id)
            WHERE deleted_at IS NULL;
        """))
        
        # Sorting index
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_created_at
            ON user_level_content(created_at DESC)
            WHERE deleted_at IS NULL;
        """))
        
        # Soft-delete partial index
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ulc_deleted_at
            ON user_level_content(deleted_at)
            WHERE deleted_at IS NOT NULL;
        """))
        
        # Create triggers for FTS5 sync
        logger.info("Creating FTS5 sync triggers...")
        
        # INSERT trigger
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_insert
            AFTER INSERT ON user_level_content BEGIN
                INSERT INTO user_content_fts(rowid, title, description)
                VALUES (new.id, new.title, new.description);
            END;
        """))
        
        # UPDATE trigger
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_update
            AFTER UPDATE ON user_level_content BEGIN
                INSERT INTO user_content_fts(user_content_fts, rowid, title, description)
                VALUES('delete', old.id, old.title, old.description);
                INSERT INTO user_content_fts(rowid, title, description)
                VALUES (new.id, new.title, new.description);
            END;
        """))
        
        # DELETE trigger
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS user_content_fts_delete
            AFTER DELETE ON user_level_content BEGIN
                INSERT INTO user_content_fts(user_content_fts, rowid, title, description)
                VALUES('delete', old.id, old.title, old.description);
            END;
        """))
        
        conn.commit()
        logger.info("✅ All migrations completed successfully")


def rollback_migrations():
    """Remove all migration artifacts (for testing/cleanup)."""
    with engine.connect() as conn:
        logger.info("Rolling back migrations...")
        
        # Drop triggers
        conn.execute(text("DROP TRIGGER IF EXISTS user_content_fts_insert;"))
        conn.execute(text("DROP TRIGGER IF EXISTS user_content_fts_update;"))
        conn.execute(text("DROP TRIGGER IF EXISTS user_content_fts_delete;"))
        
        # Drop FTS5 table
        conn.execute(text("DROP TABLE IF EXISTS user_content_fts;"))
        
        # Drop indexes
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_skill_level_deleted;"))
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_engineer_id;"))
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_team_id;"))
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_domain_id;"))
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_created_at;"))
        conn.execute(text("DROP INDEX IF EXISTS idx_ulc_deleted_at;"))
        
        conn.commit()
        logger.info("✅ Rollback completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migrations()
