import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  SendHorizontal,
  Sparkles,
  CheckCircle2,
  Loader2,
  Circle,
  Cpu,
  BookMarked,
  ShieldAlert,
  FileDown,
  ListChecks,
} from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../lib/api";
import clsx from "clsx";

interface Step {
  id: number;
  label: string;
  detail: string;
  tool: string;
  status: "done" | "active" | "pending" | "error";
  duration_ms: number | null;
}

interface Citation {
  doc_name: string;
  page: number;
  snippet: string;
}

const STATUS_ICON = {
  done: <CheckCircle2 className="h-4 w-4 text-[#3ecf7e]" />,
  active: <Loader2 className="h-4 w-4 animate-spin text-[#e8a33d]" />,
  pending: <Circle className="h-4 w-4 text-[var(--color-ink-faint)]" />,
  error: <ShieldAlert className="h-4 w-4 text-[#e5484d]" />,
};

export default function Workspace() {
  const [prompt, setPrompt] = useState(
    "Review the pressure vessel corrosion findings against SOP thresholds and draft an approval note.",
  );
  const [file, setFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [deliverable, setDeliverable] = useState<{ id: string; name: string; size_kb: number } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  async function runTask() {
    setSteps([]);
    setCitations([]);
    setModelId(null);
    setConfidence(null);
    setDeliverable(null);
    setStatus("running");

    if (file) {
      try {
        await api.documents.upload(file);
      } catch {
        /* non-fatal — task still runs on the text prompt */
      }
    }

    const { id } = await api.tasks.create(prompt);
    setTaskId(id);

    esRef.current?.close();
    const es = new EventSource(api.tasks.streamUrl(id));
    es.onmessage = (ev) => {
      const step: Step = JSON.parse(ev.data);
      setSteps((prev) => [...prev.filter((s) => s.id !== step.id), step].sort((a, b) => a.id - b.id));
      if (step.tool === "Model Router" && step.status === "done") {
        const match = step.detail.match(/Routed to ([^\s(]+)/);
        if (match) setModelId(match[1]);
      }
    };
    es.addEventListener("done", async () => {
      es.close();
      setStatus("done");
      const full = await api.tasks.get(id);
      setCitations(full.citations ?? []);
      setConfidence(full.task.confidence ?? null);
      setDeliverable(full.deliverable);
    });
    esRef.current = es;
  }

  useEffect(() => () => esRef.current?.close(), []);

  const running = status === "running";

  return (
    <AppLayout title="Workspace" subtitle={taskId ? `Goal → plan → execute → validate — task ${taskId.slice(0, 8)}` : "Describe a goal to begin"}>
      <div className="grid h-full grid-cols-1 gap-5 p-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="flex min-h-0 flex-col gap-5">
          <Card>
            <CardHeader title="Task" subtitle="Describe the goal — the router picks the model & tools" icon={<Sparkles className="h-4 w-4" />} />
            <div className="p-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={running}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3.5 text-[13.5px] leading-relaxed text-white placeholder:text-[var(--color-ink-faint)] focus:border-[#e8a33d]/50 focus:outline-none focus:ring-2 focus:ring-[#e8a33d]/10 disabled:opacity-60"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--color-ink-dim)] hover:border-white/20 hover:text-white">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach document
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {file && (
                    <span className="rounded-md border border-[#e8a33d]/25 bg-[#e8a33d]/[0.07] px-2 py-1 text-[11px] text-[#e8a33d]">
                      {file.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={runTask}
                  disabled={running || !prompt.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#e8a33d] px-4 py-2 text-[12.5px] font-semibold text-[#1a1206] hover:bg-[#f0ad4a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? "Running…" : "Run task"}
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader
              title="Agent execution"
              subtitle={taskId ? `LangGraph-style state machine — ${steps.length} step(s) so far` : "Waiting for a task"}
              icon={<ListChecks className="h-4 w-4" />}
              right={status !== "idle" && <Badge tone={status === "running" ? "amber" : "green"}>{status}</Badge>}
            />
            <div className="flex-1 space-y-0 overflow-y-auto px-5 py-4">
              {steps.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="No task running"
                  detail="Submit a task above — each agent step will stream in here live from the backend."
                />
              ) : (
                steps.map((step, i) => (
                  <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < steps.length - 1 && (
                      <div
                        className={clsx(
                          "absolute left-[9px] top-6 h-full w-px",
                          step.status === "done" ? "bg-[#3ecf7e]/30" : "bg-[var(--color-border)]",
                        )}
                      />
                    )}
                    <div className="z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)]">
                      {STATUS_ICON[step.status]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-white">{step.label}</span>
                        {step.duration_ms != null && (
                          <span className="mono shrink-0 text-[10.5px] text-[var(--color-ink-faint)]">{step.duration_ms}ms</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">{step.detail}</p>
                      {step.tool && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10.5px] text-[var(--color-ink-faint)]">
                          <Cpu className="h-2.5 w-2.5" />
                          {step.tool}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          <Card>
            <CardHeader title="Model router" subtitle="Selected for this task's profile" icon={<Cpu className="h-4 w-4" />} />
            <div className="p-5">
              {modelId ? (
                <div className="flex items-center justify-between rounded-lg border border-[#e8a33d]/25 bg-[#e8a33d]/[0.06] p-3.5">
                  <div>
                    <div className="text-[13px] font-semibold text-white">{modelId}</div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-dim)]">selected by live routing</div>
                  </div>
                  <Badge tone="amber">active</Badge>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--color-ink-faint)]">No model selected yet — run a task to see live routing.</p>
              )}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader title="Grounding & citations" subtitle="Private RAG — evidence-linked" icon={<BookMarked className="h-4 w-4" />} />
            {citations.length > 0 ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {citations.map((c, i) => (
                  <div key={i} className="rounded-lg border border-[var(--color-border)] bg-white/[0.015] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">{c.doc_name}</span>
                      <span className="text-[10px] text-[var(--color-ink-faint)]">page {c.page}</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-ink-dim)]">&ldquo;{c.snippet}&rdquo;</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BookMarked className="h-5 w-5" />}
                title="No citations yet"
                detail="Upload documents in Document Intelligence so the agent can ground its answers."
              />
            )}
          </Card>

          {status === "done" && (
            <Card className={confidence != null && confidence > 0.5 ? "border-[#3ecf7e]/20 bg-[#3ecf7e]/[0.04]" : "border-[#e5484d]/20 bg-[#e5484d]/[0.04]"}>
              <div className="flex items-center gap-3 p-4">
                {confidence != null && confidence > 0.5 ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3ecf7e]" />
                ) : (
                  <ShieldAlert className="h-5 w-5 shrink-0 text-[#e5484d]" />
                )}
                <div className="flex-1 text-[12px] text-[var(--color-ink-dim)]">
                  Confidence <span className="font-semibold text-white">{confidence?.toFixed(2) ?? "n/a"}</span> — computed from
                  citation count & response depth.
                </div>
              </div>
              {deliverable && (
                <a
                  href={api.outputs.downloadUrl(deliverable.id)}
                  className="flex items-center gap-2 border-t border-[var(--color-border-soft)] px-4 py-3 text-[12px] font-medium text-[#e8a33d] hover:bg-white/[0.03]"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Download {deliverable.name} ({deliverable.size_kb} KB)
                </a>
              )}
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
