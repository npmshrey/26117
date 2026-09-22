from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import models, documents, tasks, sandbox, audit, outputs, admin, system

app = FastAPI(title="Forge — Sovereign AI Workbench API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(models.router)
app.include_router(documents.router)
app.include_router(tasks.router)
app.include_router(sandbox.router)
app.include_router(audit.router)
app.include_router(outputs.router)
app.include_router(admin.router)
app.include_router(system.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
