"""Agent orchestration as an explicit LangGraph state machine.

Each node does one step of the classify -> route -> retrieve -> generate ->
score -> synthesize -> audit pipeline, writes a task_steps row (so the SSE
endpoint can stream progress), and hands a typed state dict to the next node.
"""
import re
import time
import uuid
from typing import TypedDict

from langgraph.graph import StateGraph, END

from ..db import get_db, log_audit
from . import ollama, docgen, rag
from .network import snapshot as network_snapshot


class AgentState(TypedDict, total=False):
    task_id: str
    prompt: str
    task_type: str
    model: dict | None
    citations: list[dict]
    response_text: str
    confidence: float
    deliverable: dict | None


TASK_TYPE_KEYWORDS = {
    "coding": ["code", "script", "function", "sandbox", "python", "calculate", "compute", "algorithm"],
    "multimodal": ["image", "scan", "photo", "drawing", "p&id", "pid", "diagram", "picture", "handwritten"],
    "document": ["report", "note", "document", "sop", "manual", "summary", "approval", "docx", "memo"],
}


def add_step(task_id: str, label: str, detail: str, tool: str, status: str, duration_ms: int | None = None):
    with get_db() as db:
        db.execute(
            "INSERT INTO task_steps (task_id, label, detail, tool, status, started_at, duration_ms) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (task_id, label, detail, tool, status, time.time(), duration_ms),
        )
        db.commit()


def set_task(task_id: str, **fields):
    fields["updated_at"] = time.time()
    cols = ", ".join(f"{k}=%s" for k in fields)
    with get_db() as db:
        db.execute(f"UPDATE tasks SET {cols} WHERE id=%s", (*fields.values(), task_id))
        db.commit()


def node_classify(state: AgentState) -> AgentState:
    s0 = time.time()
    lower = state["prompt"].lower()
    scores = {t: sum(1 for kw in kws if kw in lower) for t, kws in TASK_TYPE_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    task_type = best if scores[best] > 0 else "general"
    add_step(state["task_id"], "Classify task", f"Keyword-scored task profile -> {task_type}",
              "Task Classifier", "done", int((time.time() - s0) * 1000))
    set_task(state["task_id"], task_type=task_type)
    return {"task_type": task_type}


def node_select_model(state: AgentState) -> AgentState:
    s0 = time.time()
    online = ollama.is_online()
    models = ollama.list_models() if online else []
    chosen = ollama.pick_model(models, state["task_type"])
    if chosen:
        add_step(state["task_id"], "Select model",
                  f"Routed to {chosen['name']} ({chosen['params']}, {chosen['quant']})",
                  "Model Router", "done", int((time.time() - s0) * 1000))
        set_task(state["task_id"], model_id=chosen["id"])
    else:
        add_step(state["task_id"], "Select model",
                 "No local model reachable — start Ollama and pull a model (e.g. `ollama pull llama3`) to enable generation.",
                 "Model Router", "error", int((time.time() - s0) * 1000))
    return {"model": chosen}


def node_retrieve(state: AgentState) -> AgentState:
    s0 = time.time()
    terms = re.findall(r"[a-zA-Z]{4,}", state["prompt"])
    query = " ".join(terms[:12]) or state["prompt"]
    results = rag.search(query, limit=3)

    citations = []
    for r in results:
        citations.append({"doc_name": r["doc_name"], "page": r["page"], "snippet": r["content"][:280], "score": r["score"]})
        with get_db() as db:
            db.execute(
                "INSERT INTO citations (task_id, doc_name, page, snippet) VALUES (%s,%s,%s,%s)",
                (state["task_id"], r["doc_name"], r["page"], r["content"][:500]),
            )
            db.commit()

    if citations:
        add_step(state["task_id"], "Retrieve grounding context",
                  f"Qdrant semantic search — {len(citations)} chunk(s), top score {citations[0]['score']}",
                  "Qdrant + FastEmbed", "done", int((time.time() - s0) * 1000))
    else:
        add_step(state["task_id"], "Retrieve grounding context",
                  "No indexed chunks scored above threshold — proceeding without grounding",
                  "Qdrant + FastEmbed", "done", int((time.time() - s0) * 1000))
    return {"citations": citations}


def node_generate(state: AgentState) -> AgentState:
    s0 = time.time()
    chosen = state.get("model")
    response_text = ""
    if chosen:
        context_block = "\n\n".join(
            f"[{c['doc_name']} p.{c['page']}] {c['snippet']}" for c in state.get("citations", [])
        )
        full_prompt = (
            f"Context from internal documents:\n{context_block}\n\nTask: {state['prompt']}\n\n"
            "Respond with concrete findings as short bullet points."
        ) if context_block else state["prompt"]
        result = ollama.generate(chosen["id"], full_prompt,
                                  system="You are an on-premise industrial analysis assistant. Be concise and factual.")
        if result["ok"]:
            response_text = result["text"]
            add_step(state["task_id"], "Generate response", f"{len(response_text)} chars generated",
                      chosen["name"], "done", result["latency_ms"])
        else:
            add_step(state["task_id"], "Generate response", f"Model call failed: {result.get('error', 'unknown error')}",
                      chosen["name"], "error", result["latency_ms"])
    else:
        add_step(state["task_id"], "Generate response", "Skipped — no model available", "Model Router", "error", 0)
    return {"response_text": response_text}


def node_score(state: AgentState) -> AgentState:
    s0 = time.time()
    confidence = 0.0
    response_text = state.get("response_text", "")
    citations = state.get("citations", [])
    if response_text:
        confidence = min(0.99, 0.5 + 0.1 * len(citations) + min(0.25, len(response_text) / 2000))
    add_step(state["task_id"], "Score confidence",
              f"Confidence {confidence:.2f} — derived from citation count & response depth",
              "Safety & Risk Engine", "done", int((time.time() - s0) * 1000))
    return {"confidence": confidence}


def node_artifact(state: AgentState) -> AgentState:
    s0 = time.time()
    deliverable = None
    response_text = state.get("response_text", "")
    chosen = state.get("model")
    if response_text:
        out_path = docgen.build_approval_note(
            state["task_id"], state["prompt"], response_text, state.get("citations", []),
            chosen["name"] if chosen else "n/a",
        )
        size_kb = round(out_path.stat().st_size / 1024, 1)
        deliverable_id = str(uuid.uuid4())
        with get_db() as db:
            db.execute(
                "INSERT INTO deliverables (id, task_id, name, kind, path, size_kb, source_model, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (deliverable_id, state["task_id"], out_path.name, "docx", str(out_path), size_kb,
                 chosen["name"] if chosen else "n/a", time.time()),
            )
            db.commit()
        deliverable = {"id": deliverable_id, "name": out_path.name, "size_kb": size_kb}
        add_step(state["task_id"], "Generate artifact", f"{out_path.name} ({size_kb} KB)",
                  "Document Synthesizer", "done", int((time.time() - s0) * 1000))
    else:
        add_step(state["task_id"], "Generate artifact", "Skipped — no generated content",
                  "Document Synthesizer", "error", 0)
    return {"deliverable": deliverable}


def node_audit(state: AgentState) -> AgentState:
    s0 = time.time()
    net = network_snapshot()
    add_step(state["task_id"], "Audit + egress check",
              f"{net['external_connections']} external connection(s) observed during run",
              "Audit & Governance", "done", int((time.time() - s0) * 1000))
    chosen = state.get("model")
    log_audit("agent", "Task completed",
               f"task {state['task_id']} · type={state['task_type']} · model={chosen['name'] if chosen else 'none'}",
               egress="blocked" if net["zero_egress"] else "n/a")
    set_task(state["task_id"], status="done", confidence=state.get("confidence", 0.0))
    return {}


_graph = StateGraph(AgentState)
_graph.add_node("classify", node_classify)
_graph.add_node("select_model", node_select_model)
_graph.add_node("retrieve", node_retrieve)
_graph.add_node("generate", node_generate)
_graph.add_node("score", node_score)
_graph.add_node("artifact", node_artifact)
_graph.add_node("audit", node_audit)

_graph.set_entry_point("classify")
_graph.add_edge("classify", "select_model")
_graph.add_edge("select_model", "retrieve")
_graph.add_edge("retrieve", "generate")
_graph.add_edge("generate", "score")
_graph.add_edge("score", "artifact")
_graph.add_edge("artifact", "audit")
_graph.add_edge("audit", END)

compiled_graph = _graph.compile()


def run(task_id: str, prompt: str):
    compiled_graph.invoke({"task_id": task_id, "prompt": prompt})
