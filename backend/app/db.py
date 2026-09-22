import sqlite3
import time
import uuid
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).resolve().parent.parent / "storage" / "forge.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


_conn = _connect()


@contextmanager
def get_db():
    try:
        yield _conn
    finally:
        pass


def init_db():
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                pages INTEGER DEFAULT 0,
                ocr_used INTEGER DEFAULT 0,
                status TEXT DEFAULT 'processing',
                created_at REAL NOT NULL
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS doc_chunks USING fts5(
                doc_id UNINDEXED,
                doc_name UNINDEXED,
                page UNINDEXED,
                content
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                task_type TEXT,
                model_id TEXT,
                status TEXT DEFAULT 'running',
                confidence REAL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS task_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                label TEXT NOT NULL,
                detail TEXT,
                tool TEXT,
                status TEXT NOT NULL,
                started_at REAL,
                duration_ms INTEGER
            );

            CREATE TABLE IF NOT EXISTS citations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                doc_name TEXT,
                page INTEGER,
                snippet TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time REAL NOT NULL,
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
                size_kb REAL,
                source_model TEXT,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                access TEXT NOT NULL,
                auth_provider TEXT NOT NULL,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sandbox_runs (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                stdout TEXT,
                stderr TEXT,
                exit_code INTEGER,
                duration_ms INTEGER,
                isolation_mode TEXT,
                created_at REAL NOT NULL
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
            "INSERT INTO users (id, name, role, access, auth_provider, created_at) VALUES (?,?,?,?,?,?)",
            (str(uuid.uuid4()), name, role, access, provider, time.time()),
        )
    db.commit()


def log_audit(actor: str, action: str, detail: str = "", egress: str = "n/a", severity: str = "info"):
    with get_db() as db:
        db.execute(
            "INSERT INTO audit_log (time, actor, action, detail, egress, severity) VALUES (?,?,?,?,?,?)",
            (time.time(), actor, action, detail, egress, severity),
        )
        db.commit()
