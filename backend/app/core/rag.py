"""Private RAG knowledge base — Qdrant (local/embedded mode, on-disk, no
server process) with FastEmbed (BGE-family) embeddings, matching the
architecture's "Qdrant + BGE" retrieval layer without needing a running
Qdrant server or a torch-heavy embedding stack.
"""
import time
import uuid
from pathlib import Path
from threading import Lock

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

QDRANT_PATH = Path(__file__).resolve().parent.parent.parent / "storage" / "qdrant"
QDRANT_PATH.mkdir(parents=True, exist_ok=True)

COLLECTION = "doc_chunks"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
EMBED_DIM = 384

_lock = Lock()
_client: QdrantClient | None = None
_embedder = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(path=str(QDRANT_PATH))
        if not _client.collection_exists(COLLECTION):
            _client.create_collection(
                COLLECTION, vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE)
            )
    return _client


def _get_embedder():
    global _embedder
    if _embedder is None:
        from fastembed import TextEmbedding
        _embedder = TextEmbedding(model_name=EMBED_MODEL)
    return _embedder


def embed(texts: list[str]) -> list[list[float]]:
    return [v.tolist() for v in _get_embedder().embed(texts)]


def index_chunks(doc_id: str, doc_name: str, chunks: list[dict]) -> int:
    """chunks: [{"page": int, "content": str}, ...]. Returns number indexed."""
    if not chunks:
        return 0
    with _lock:
        client = _get_client()
        vectors = embed([c["content"] for c in chunks])
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={
                    "doc_id": doc_id,
                    "doc_name": doc_name,
                    "page": c["page"],
                    "content": c["content"],
                    "indexed_at": time.time(),
                },
            )
            for vec, c in zip(vectors, chunks)
        ]
        client.upsert(COLLECTION, points=points)
    return len(points)


def search(query: str, limit: int = 5) -> list[dict]:
    if not query.strip():
        return []
    with _lock:
        client = _get_client()
        vector = embed([query])[0]
        results = client.query_points(COLLECTION, query=vector, limit=limit).points
    return [
        {
            "doc_id": r.payload["doc_id"],
            "doc_name": r.payload["doc_name"],
            "page": r.payload["page"],
            "content": r.payload["content"],
            "score": round(r.score, 4),
        }
        for r in results
    ]


def stats() -> dict:
    with _lock:
        client = _get_client()
        info = client.get_collection(COLLECTION)
    return {
        "chunks_indexed": info.points_count,
        "vector_dim": EMBED_DIM,
        "embedding_model": EMBED_MODEL,
        "distance": "cosine",
    }
