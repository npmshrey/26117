import { Users, KeyRound, Server, Cpu, MemoryStick } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

export default function Admin() {
  const { data: users } = usePoll(() => api.admin.users(), 8000);
  const { data: policies } = usePoll(() => api.admin.policies(), 20000);
  const { data: nodes } = usePoll(() => api.admin.nodes(), 4000);
  const { data: sys } = usePoll(() => api.system.status(), 3000);

  return (
    <AppLayout title="Admin & Governance" subtitle="RBAC directory, policy engine, and real host telemetry">
      <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Role-based access control" subtitle="Directory-backed roles" icon={<Users className="h-4 w-4" />} />
          <div className="divide-y divide-[var(--color-border-soft)]">
            {(users ?? []).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4c8dff] to-[#2a5fc7] text-[10.5px] font-bold text-white">
                  {u.name.split(" ").map((w: string) => w[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-white">{u.name}</div>
                  <div className="text-[11px] text-[var(--color-ink-faint)]">{u.access}</div>
                </div>
                <Badge tone="blue">{u.role}</Badge>
                <span className="mono text-[10.5px] text-[var(--color-ink-faint)]">{u.auth_provider}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Policy engine" subtitle="Outbound & data-handling rules" icon={<KeyRound className="h-4 w-4" />} />
            <div className="space-y-2.5 p-5 text-[12px]">
              {(policies?.policies ?? []).map((p) => (
                <div key={p} className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white/[0.015] px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf7e]" />
                  <span className="text-[var(--color-ink-dim)]">{p}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Cluster nodes" subtitle="Live telemetry from this host" icon={<Server className="h-4 w-4" />} />
            <div className="divide-y divide-[var(--color-border-soft)]">
              {(nodes?.nodes ?? []).map((n: any) => (
                <div key={n.name} className="flex items-center gap-3 px-5 py-3">
                  <Server className="h-4 w-4 text-[var(--color-ink-faint)]" />
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[12px] font-medium text-white">{n.name}</div>
                    <div className="text-[11px] text-[var(--color-ink-faint)]">{n.role} · {n.detail}</div>
                  </div>
                  <Badge tone={n.status === "healthy" ? "green" : "amber"}>{n.status}</Badge>
                </div>
              ))}
            </div>
            {sys && (
              <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border-soft)] p-5">
                <div className="flex items-center gap-2.5">
                  <Cpu className="h-4 w-4 text-[#e8a33d]" />
                  <div>
                    <div className="text-[13px] font-semibold text-white">{sys.cpu_percent}%</div>
                    <div className="text-[10.5px] text-[var(--color-ink-faint)]">{sys.cpu_cores} vCPU load</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <MemoryStick className="h-4 w-4 text-[#4c8dff]" />
                  <div>
                    <div className="text-[13px] font-semibold text-white">{sys.memory_used_gb} / {sys.memory_total_gb} GB</div>
                    <div className="text-[10.5px] text-[var(--color-ink-faint)]">memory in use</div>
                  </div>
                </div>
              </div>
            )}
            {nodes?.gpus && nodes.gpus.length === 0 && (
              <p className="border-t border-[var(--color-border-soft)] px-5 py-3 text-[11px] text-[var(--color-ink-faint)]">
                No discrete GPU detected via nvidia-smi on this host — inference will run CPU-bound or on the deployment target's GPU node.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
