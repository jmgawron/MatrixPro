"""One-shot migration CLI: convert legacy HTML user_level_content rows to Markdown.

Usage (run from `backend/` directory):

    python -m app.migrations_html_to_md                # dry-run (default)
    python -m app.migrations_html_to_md --apply        # commit conversions
    python -m app.migrations_html_to_md --db path.db   # override DB path

Idempotent: re-running with --apply after a successful conversion is a no-op,
because every converted row has description_format='markdown'.

See AGENTS.md §16 (Decision 4A) for context.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import List


BATCH_SIZE = 100


def _convert(html: str) -> str:
    """Convert an HTML string to Markdown via markdownify (ATX heading style)."""
    from markdownify import markdownify as md_convert

    return md_convert(html, heading_style="ATX").strip()


def _run(apply: bool, db_path: str | None) -> int:
    if db_path:
        # Must be set BEFORE importing app.database so settings picks it up.
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    # Imports deferred so --db override above takes effect.
    from app.database import SessionLocal  # noqa: E402
    from app.models.plan import UserLevelContent  # noqa: E402

    prefix = "[apply]" if apply else "[dry-run]"
    db = SessionLocal()
    try:
        rows: List[UserLevelContent] = (
            db.query(UserLevelContent)
            .filter(UserLevelContent.description_format == "legacy_html")
            .all()
        )
        total = len(rows)
        print(f"{prefix} found {total} legacy_html row(s) to convert")

        if total == 0:
            return 0

        if not apply:
            print(f"{prefix} sample (up to 3):")
            for row in rows[:3]:
                src = row.description or ""
                if not src.strip():
                    preview = "(empty description — would skip)"
                else:
                    try:
                        converted = _convert(src)
                        preview = converted[:120].replace("\n", " ")
                    except Exception as exc:  # noqa: BLE001
                        preview = f"(conversion error: {exc})"
                print(f"  id={row.id}: {preview}")
            print(f"{prefix} re-run with --apply to commit conversions.")
            return 0

        converted = 0
        skipped_empty = 0
        errors = 0
        for idx, row in enumerate(rows, start=1):
            src = row.description or ""
            if not src.strip():
                # Empty/None → just flip the format flag so it stops re-matching.
                row.description_format = "markdown"
                skipped_empty += 1
            else:
                try:
                    row.description = _convert(src)
                    row.description_format = "markdown"
                    converted += 1
                except Exception as exc:  # noqa: BLE001
                    errors += 1
                    print(f"{prefix} ERROR id={row.id}: {exc}", file=sys.stderr)
                    continue

            if idx % BATCH_SIZE == 0:
                db.commit()
                print(f"{prefix} committed batch — {idx}/{total}")

        db.commit()
        print(
            f"{prefix} done: converted={converted}, "
            f"empty_flipped={skipped_empty}, errors={errors}, total={total}"
        )
        return 0 if errors == 0 else 1
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"{prefix} FATAL: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.migrations_html_to_md",
        description=(
            "Convert legacy_html user_level_content rows to Markdown. "
            "Default is dry-run; pass --apply to commit."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually update rows. Without this flag, runs read-only.",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help=(
            "Optional SQLite path override (e.g. data/matrixpro.db). "
            "Sets DATABASE_URL before loading settings."
        ),
    )
    args = parser.parse_args(argv)
    return _run(apply=args.apply, db_path=args.db)


if __name__ == "__main__":
    sys.exit(main())
