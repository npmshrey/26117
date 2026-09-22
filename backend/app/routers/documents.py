import time
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from ..db import get_db, log_audit
from ..core import ocr

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_SIZE = 700
_retrieval_latencies: list[float] = []


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    text = text.strip()
    if not text:
        return []
    return [text[i : i + size] for i in range(0, len(text), size)]


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    doc_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix.lower()
    dest = UPLOAD_DIR / f"{doc_id}{ext}"

    contents = await file.read()
    dest.write_bytes(contents)

    if ext == ".pdf":
        result = ocr.extract_pdf(dest)
        kind = "Scanned PDF" if result["ocr_used"] else "PDF"
    elif ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff"):
        result = ocr.extract_image(dest)
        kind = "Image / Scan"
    elif ext in (".txt", ".md", ".csv"):
        result = ocr.extract_text_file(dest)
        kind = "Text"
    else:
        result = {"page_count": 0, "pages": [], "ocr_used": False, "ocr_available": ocr.ocr_engine_available()}
        kind = ext.lstrip(".").upper() or "Unknown"

    with get_db() as db:
        db.execute(
            "INSERT INTO documents (id, name, kind, path, pages, ocr_used, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
            (doc_id, file.filename, kind, str(dest), result["page_count"], int(result["ocr_used"]), "indexed", time.time()),
        )
        chunk_count = 0
        for page in result["pages"]:
            for chunk in chunk_text(page["text"]):
                db.execute(
                    "INSERT INTO doc_chunks (doc_id, doc_name, page, content) VALUES (?,?,?,?)",
                    (doc_id, file.filename, page["page"], chunk),
                )
                chunk_count += 1
        db.commit()

    log_audit(
        "user", "Document upload",
        f"{file.filename} — {result['page_count']} page(s), {chunk_count} chunk(s) indexed"
        + (" (OCR applied)" if result["ocr_used"] else ""),
    )

    return {
        "id": doc_id,
        "name": file.filename,
        "kind": kind,
        "pages": result["page_count"],
        "ocr_used": result["ocr_used"],
        "ocr_available": result["ocr_available"],
        "chunks_indexed": chunk_count,
        "status": "indexed",
    }


@router.get("")
def list_documents():
    with get_db() as db:
        rows = db.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@router.get("/stats")
def stats():
    with get_db() as db:
        doc_count = db.execute("SELECT COUNT(*) c FROM documents").fetchone()["c"]
        chunk_count = db.execute("SELECT COUNT(*) c FROM doc_chunks").fetchone()["c"]
        ocr_pages = db.execute("SELECT COALESCE(SUM(pages),0) c FROM documents WHERE ocr_used=1").fetchone()["c"]
    avg_latency = round(sum(_retrieval_latencies[-50:]) / len(_retrieval_latencies[-50:]), 1) if _retrieval_latencies else None
    return {
        "documents_indexed": doc_count,
        "chunks_indexed": chunk_count,
        "ocr_pages_processed": ocr_pages,
        "avg_retrieval_latency_ms": avg_latency,
        "ocr_available": ocr.ocr_engine_available(),
    }


@router.get("/search")
def search(q: str, limit: int = 5):
    started = time.time()
    with get_db() as db:
        try:
            rows = db.execute(
                "SELECT doc_id, doc_name, page, content FROM doc_chunks WHERE doc_chunks MATCH ? LIMIT ?",
                (q, limit),
            ).fetchall()
        except Exception:
            rows = []
    latency_ms = (time.time() - started) * 1000
    _retrieval_latencies.append(latency_ms)
    return {
        "query": q,
        "latency_ms": round(latency_ms, 1),
        "results": [dict(r) for r in rows],
    }
