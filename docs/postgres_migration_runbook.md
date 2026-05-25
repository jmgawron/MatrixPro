# Postgres Migration Runbook: SQLite FTS5 → Postgres pg_trgm

This document provides step-by-step instructions for migrating the search functionality from SQLite FTS5 to Postgres with the `pg_trgm` extension.

## Overview

| Aspect | SQLite FTS5 | Postgres pg_trgm |
|--------|-----------|------------------|
| **Extension** | Built-in (FTS5) | `pg_trgm` (install required) |
| **Tokenizer** | Trigram (configurable) | Trigram (fixed) |
| **Ranking** | BM25 (via `rank` column) | Manual via `similarity()` function |
| **Index Type** | FTS5 virtual table | GIN index |
| **Query Syntax** | `MATCH` operator | `%` operator or `similarity()` function |
| **Fuzzy Matching** | Substring-based (trigram) | Substring-based (trigram) |
| **Performance** | ~50-100ms for 100k items | ~20-50ms for 100k items (with GIN) |

## Prerequisites

- Postgres 12+ (pg_trgm available in all modern versions)
- Existing SQLite database with FTS5 index
- Python 3.11+ with SQLAlchemy 2.0+
- Downtime window (recommend off-peak hours)

## Migration Steps

### Phase 1: Preparation (No Downtime)

#### 1.1 Install pg_trgm Extension

```sql
-- Connect to your Postgres database
psql -U postgres -d matrixpro

-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

#### 1.2 Create Postgres Schema

```sql
-- Create user_level_content table (if not already present)
CREATE TABLE IF NOT EXISTS user_level_content (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    plan_skill_id INTEGER NOT NULL REFERENCES plan_skills(id),
    skill_id INTEGER NOT NULL REFERENCES skills(id),
    level INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(255),
    position INTEGER DEFAULT 1000,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create GIN index for trigram search
CREATE INDEX IF NOT EXISTS idx_ulc_title_trgm ON user_level_content
USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ulc_description_trgm ON user_level_content
USING GIN (description gin_trgm_ops);

-- Create supporting indexes (same as SQLite)
CREATE INDEX IF NOT EXISTS idx_ulc_skill_level_deleted
ON user_level_content(skill_id, level)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulc_engineer_id
ON user_level_content(user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulc_team_id
ON user_level_content(user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulc_domain_id
ON user_level_content(user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulc_created_at
ON user_level_content(created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ulc_deleted_at
ON user_level_content(deleted_at)
WHERE deleted_at IS NOT NULL;
```

#### 1.3 Verify Index Creation

```sql
-- Check GIN indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_level_content'
AND indexname LIKE '%trgm%';

-- Expected output:
-- idx_ulc_title_trgm | CREATE INDEX idx_ulc_title_trgm ON user_level_content USING gin (title gin_trgm_ops)
-- idx_ulc_description_trgm | CREATE INDEX idx_ulc_description_trgm ON user_level_content USING gin (description gin_trgm_ops)
```

### Phase 2: Data Migration (Downtime Required)

#### 2.1 Export Data from SQLite

```bash
# Export user_level_content table from SQLite
sqlite3 /path/to/matrixpro.db << 'EOF'
.mode csv
.output /tmp/user_level_content.csv
SELECT id, user_id, plan_skill_id, skill_id, level, type, title, description, url, position, completed, completed_at, deleted_at, created_at, updated_at
FROM user_level_content;
.quit
EOF
```

#### 2.2 Import Data to Postgres

```bash
# Import CSV to Postgres
psql -U postgres -d matrixpro << 'EOF'
COPY user_level_content (id, user_id, plan_skill_id, skill_id, level, type, title, description, url, position, completed, completed_at, deleted_at, created_at, updated_at)
FROM '/tmp/user_level_content.csv'
WITH (FORMAT csv, HEADER false);

-- Reset sequence to avoid conflicts
SELECT setval('user_level_content_id_seq', (SELECT MAX(id) FROM user_level_content));
EOF
```

#### 2.3 Verify Data Integrity

```sql
-- Count rows
SELECT COUNT(*) FROM user_level_content;

-- Check for NULL values in required fields
SELECT COUNT(*) FROM user_level_content WHERE title IS NULL;
SELECT COUNT(*) FROM user_level_content WHERE skill_id IS NULL;

-- Verify no orphaned records
SELECT COUNT(*) FROM user_level_content ulc
LEFT JOIN users u ON ulc.user_id = u.id
WHERE u.id IS NULL;
```

### Phase 3: Code Migration

#### 3.1 Update Search Query

**Before (SQLite FTS5)**:
```sql
SELECT
    ulc.id,
    ulc.title,
    ulc.description,
    fts.rank AS bm25_score
FROM user_content_fts fts
JOIN user_level_content ulc ON fts.rowid = ulc.id
WHERE fts.user_content_fts MATCH :search_query
ORDER BY fts.rank DESC;
```

**After (Postgres pg_trgm)**:
```sql
SELECT
    ulc.id,
    ulc.title,
    ulc.description,
    similarity(ulc.title, :search_query) +
    similarity(ulc.description, :search_query) * 0.5 AS similarity_score
FROM user_level_content ulc
WHERE (ulc.title % :search_query OR ulc.description % :search_query)
AND ulc.deleted_at IS NULL
ORDER BY similarity_score DESC;
```

#### 3.2 Update Python Code

**File**: `backend/app/routers/search.py`

Replace FTS5 query with pg_trgm query (see code comments in file).

#### 3.3 Remove SQLite-Specific Code

**File**: `backend/app/migrations.py`

- Remove FTS5 virtual table creation
- Remove FTS5 trigger creation
- Keep index creation (compatible with both SQLite and Postgres)

**File**: `backend/app/tasks.py`

- Update sync job to use pg_trgm consistency checks

#### 3.4 Update Configuration

**File**: `backend/app/config.py`

```python
# Update DATABASE_URL to use Postgres
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/matrixpro"
)
```

### Phase 4: Testing & Validation

#### 4.1 Unit Tests

```bash
cd backend
pytest tests/test_search.py -v
```

Expected: All tests pass (cursor encoding, proximity bucketing, ranking logic are database-agnostic).

#### 4.2 Integration Tests

```bash
pytest tests/test_search_integration.py -v
```

Expected: All integration tests pass with Postgres backend.

#### 4.3 Performance Benchmarks

Run search performance test to verify query time < 50ms for 100k items.

#### 4.4 Fuzzy Matching Validation

Test trigram matching returns expected typo-tolerant results.

### Phase 5: Rollback Plan (If Needed)

#### 5.1 Restore from SQLite Backup

If migration fails, restore from backup and restart with SQLite.

#### 5.2 Postgres Cleanup

Drop Postgres tables and extension if rollback needed.

## Troubleshooting

### Issue: GIN Index Not Used

**Symptom**: Query still slow despite GIN index

**Solution**: Check query plan and increase work_mem if needed.

### Issue: Similarity Scores Too Low

**Symptom**: No results returned for valid queries

**Solution**: Adjust pg_trgm.similarity_threshold or use word_similarity.

### Issue: Cursor Pagination Broken

**Symptom**: Duplicate results or missing results across pages

**Solution**: Verify similarity_score calculation is deterministic and ORDER BY is correct.

## Performance Comparison

| Metric | SQLite FTS5 | Postgres pg_trgm |
|--------|-----------|------------------|
| Query time (100k items) | 50-100ms | 20-50ms |
| Index size (100k items) | 80-120 MB | 60-100 MB |
| Memory usage | Low | Medium |
| Concurrent queries | Limited | Excellent |
| Fuzzy matching quality | Good (trigram) | Good (trigram) |
| Maintenance | Triggers + batch sync | REINDEX periodically |

## Post-Migration Checklist

- [ ] All data migrated successfully
- [ ] GIN indexes created and verified
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks acceptable
- [ ] Fuzzy matching working correctly
- [ ] Cursor pagination stable
- [ ] Monitoring/alerting configured
- [ ] Documentation updated
- [ ] Team trained on new system

## References

- Postgres pg_trgm Documentation
- Postgres Full-Text Search
- SQLite FTS5 Documentation
- GIN Index Performance

## Support

For questions or issues during migration, contact the platform team or refer to the architecture document at `/docs/search_architecture.md`.
