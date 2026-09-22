"""Document text extraction: native PDF text via PyMuPDF, with a real
on-device OCR fallback (RapidOCR — ONNX runtime, no system binary needed)
for scanned pages and images.
"""
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np

_engine = None
_engine_failed = False


def _get_engine():
    global _engine, _engine_failed
    if _engine is not None or _engine_failed:
        return _engine
    try:
        from rapidocr_onnxruntime import RapidOCR
        _engine = RapidOCR()
    except Exception:
        _engine_failed = True
        _engine = None
    return _engine


def ocr_engine_available() -> bool:
    return _get_engine() is not None


def _ocr_array(img_array: np.ndarray) -> str:
    engine = _get_engine()
    if engine is None:
        return ""
    result, _ = engine(img_array)
    if not result:
        return ""
    return "\n".join(line[1] for line in result)


def extract_pdf(path: Path) -> dict:
    doc = fitz.open(path)
    pages = []
    ocr_used = False
    engine_ok = ocr_engine_available()

    for i, page in enumerate(doc):
        text = page.get_text().strip()
        scanned = len(text) < 20
        if scanned and engine_ok:
            pix = page.get_pixmap(dpi=200)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 4:
                img = img[:, :, :3]
            text = _ocr_array(img).strip()
            ocr_used = True
        elif scanned:
            text = ""
        pages.append({"page": i + 1, "text": text, "scanned": scanned})

    doc.close()
    return {
        "page_count": len(pages),
        "pages": pages,
        "ocr_used": ocr_used,
        "ocr_available": engine_ok,
    }


def extract_image(path: Path) -> dict:
    engine_ok = ocr_engine_available()
    if not engine_ok:
        return {
            "page_count": 1,
            "pages": [{"page": 1, "text": "", "scanned": True}],
            "ocr_used": False,
            "ocr_available": False,
        }
    from PIL import Image
    img = np.array(Image.open(path).convert("RGB"))
    text = _ocr_array(img).strip()
    return {
        "page_count": 1,
        "pages": [{"page": 1, "text": text, "scanned": True}],
        "ocr_used": True,
        "ocr_available": True,
    }


def extract_text_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="ignore")
    return {
        "page_count": 1,
        "pages": [{"page": 1, "text": text, "scanned": False}],
        "ocr_used": False,
        "ocr_available": ocr_engine_available(),
    }
