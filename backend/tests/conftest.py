"""Shared pytest fixtures — isolated temp SQLite DB (never touches data/matrixpro.db)."""

from __future__ import annotations

import os
import tempfile
from typing import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.migrations import run_migrations


@pytest.fixture(scope="function")
def isolated_db() -> Generator[Session, None, None]:
    fd, path = tempfile.mkstemp(prefix="matrixpro_test_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    import app.migrations as mig

    original_engine = mig.engine
    mig.engine = engine
    try:
        run_migrations()
    finally:
        mig.engine = original_engine

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        try:
            os.unlink(path)
        except OSError:
            pass
