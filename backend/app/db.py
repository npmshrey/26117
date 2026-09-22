import time
import uuid
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DSN = "host=127.0.0.1 port=5432 dbname=forge user=postgres"

_conn = psycopg.connect(DSN, row_factory=dict_row, autocommit=False)


@contextmanager
def get_db():
    try:
        yield _conn
    finally:
        pass


def init_db():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                pages INTEGER DEFAULT 0,
                ocr_used INTEGER DEFAULT 0,
                status TEXT DEFAULT 'processing',
                created_at DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                task_type TEXT,
                model_id TEXT,
                status TEXT DEFAULT 'running',
                confidence DOUBLE PRECISION,
                created_at DOUBLE PRECISION NOT NULL,
                updated_at DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS task_steps (
                id SERIAL PRIMARY KEY,
                task_id TEXT NOT NULL,
                label TEXT NOT NULL,
                detail TEXT,
                tool TEXT,
                status TEXT NOT NULL,
                started_at DOUBLE PRECISION,
                duration_ms INTEGER
            );

            CREATE TABLE IF NOT EXISTS citations (
                id SERIAL PRIMARY KEY,
                task_id TEXT NOT NULL,
                doc_name TEXT,
                page INTEGER,
                snippet TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                time DOUBLE PRECISION NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                detail TEXT,
                egress TEXT DEFAULT 'n/a',
                severity TEXT DEFAULT 'info'
            );

            CREATE TABLE IF NOT EXISTS deliverables (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                size_kb DOUBLE PRECISION,
                source_model TEXT,
                created_at DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                access TEXT NOT NULL,
                auth_provider TEXT NOT NULL,
                created_at DOUBLE PRECISION NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sandbox_runs (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                stdout TEXT,
                stderr TEXT,
                exit_code INTEGER,
                duration_ms INTEGER,
                isolation_mode TEXT,
                created_at DOUBLE PRECISION NOT NULL
            );
            """
        )
        db.commit()
        _seed_users(db)


def _seed_users(db):
    count = db.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    if count > 0:
        return
    defaults = [
        ("R. Rao", "engineer", "Documents, Sandbox, Workspace", "LDAP"),
        ("S. Kulkarni", "safety", "Documents, Audit, Alerts", "LDAP"),
        ("A. Mehta", "operations", "Workspace, Documents", "LDAP"),
        ("N. Pillai", "management", "Outputs, Dashboards", "SSO (SAML)"),
        ("V. Iyer", "admin", "Full system", "SSO (SAML)"),
    ]
    for name, role, access, provider in defaults:
        db.execute(
            "INSERT INTO users (id, name, role, access, auth_provider, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
            (str(uuid.uuid4()), name, role, access, provider, time.time()),
        )
    db.commit()


def log_audit(actor: str, action: str, detail: str = "", egress: str = "n/a", severity: str = "info"):
    with get_db() as db:
        db.execute(
            "INSERT INTO audit_log (time, actor, action, detail, egress, severity) VALUES (%s,%s,%s,%s,%s,%s)",
            (time.time(), actor, action, detail, egress, severity),
        )
        db.commit()
