import { Cpu, GitBranch, Gauge, WifiOff, Terminal } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";
import { useMemo } from "react";

const SPECIALTY_TONE = { document: "amber", multimodal: "blue", coding: "teal", general: "neutral" } as const;

export default function ModelRouterPage() {
  const { data, loading } = usePoll(() => api.models(), 5000);
  const models = data?.models ?? [];
  const totalVram = useMemo(() => models.reduce((a, m) => a + (m.vram_gb || 0), 0), [models]);

  return (
    <AppLayout title="Model Router" subtitle="Task-aware routing across the local open-weight registry">
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[#3fb8af]">
              <GitBranch className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Registry</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{loading ? "…" : `${models.length} models`}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">Live from Ollama — pull models to grow this list</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[#e8a33d]">
              <Gauge className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">VRAM footprint</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{totalVram.toFixed(1)} GB</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">Sum of on-disk model weights currently pulled</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2" style={{ color: data?.ollama_online ? "#3ecf7e" : "#e5484d" }}>
              {data?.ollama_online ? <Cpu className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              <span className="text-[11px] font-semibold uppercase tracking-wide">Serving engine</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{data?.ollama_online ? "Ollama — online" : "Ollama — offline"}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">
              {data?.ollama_online ? "OpenAI-compatible local serving" : "127.0.0.1:11434 unreachable"}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Capability registry"
            subtitle="Specialty tags inferred from each model's real name & family"
            icon={<Cpu className="h-4 w-4" />}
          />
          {!data?.ollama_online ? (
            <EmptyState
              icon={<WifiOff className="h-5 w-5" />}
              title="Ollama is not running"
              detail="Start the local model server to populate the live registry."
              action={
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <Terminal className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" />
                  <code className="mono text-[11.5px] text-[#e8a33d]">ollama serve &amp;&amp; ollama pull llama3</code>
                </div>
              }
            />
          ) : models.length === 0 ? (
            <EmptyState
              icon={<Cpu className="h-5 w-5" />}
              title="No models pulled yet"
              detail="Ollama is online but the registry is empty."
              action={
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <Terminal className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" />
                  <code className="mono text-[11.5px] text-[#e8a33d]">ollama pull llama3</code>
                </div>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <th className="px-5 py-3 font-medium">Model</th>
                    <th className="px-3 py-3 font-medium">Specialties</th>
                    <th className="px-3 py-3 font-medium">Weights size</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--color-border-soft)] last:border-0 hover:bg-white/[0.015]">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{m.name}</div>
                        <div className="mono text-[10.5px] text-[var(--color-ink-faint)]">
                          {m.family} · {m.params} · {m.quant}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {m.specialties.map((s) => (
                            <Badge key={s} tone={SPECIALTY_TONE[s as keyof typeof SPECIALTY_TONE] ?? "neutral"}>
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[var(--color-ink-dim)]">{m.vram_gb} GB</td>
                      <td className="px-5 py-3.5">
                        <Badge tone="green">{m.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
