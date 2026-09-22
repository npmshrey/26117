import { ShieldCheck, Activity, Lock, FileClock, ArrowDownToLine } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

export default function Audit() {
  const { data: net } = usePoll(() => api.audit.network(), 3000);
  const { data: log } = usePoll(() => api.audit.list(), 3000);

  const zeroEgress = net?.zero_egress;

  return (
    <AppLayout title="Audit & Network Monitor" subtitle="Live egress proof, measured on this machine right now">
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2" style={{ color: zeroEgress ? "#3ecf7e" : "#e5484d" }}>
              <Activity className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">External connections</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{net?.external_connections ?? "…"}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">right now, all interfaces, this process's view</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[#e8a33d]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Total connections</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{net?.total_connections ?? "…"}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">loopback + LAN + external, combined</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[#4c8dff]">
              <Lock className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Egress status</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{zeroEgress === undefined ? "…" : zeroEgress ? "clean" : "traffic seen"}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">on the deployment target this should read clean</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[#3fb8af]">
              <FileClock className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Audit entries</span>
            </div>
            <div className="mt-2 text-[22px] font-bold text-white">{log?.length ?? "…"}</div>
            <p className="text-[11.5px] text-[var(--color-ink-dim)]">recorded this session</p>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Network monitor"
            subtitle="Live interface capture, polled every 3s"
            icon={<Activity className="h-4 w-4" />}
            right={
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#3ecf7e]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-[#3ecf7e]" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3ecf7e]" />
                </span>
                live
              </span>
            }
          />
          <div className="mono grid grid-cols-1 gap-px overflow-hidden rounded-b-xl bg-black/20 text-[11.5px] sm:grid-cols-2">
            {(net?.interfaces ?? []).map((iface: any) => (
              <div key={iface.name} className="bg-[var(--color-surface)] px-5 py-3 text-[var(--color-ink-dim)]">
                {iface.name.padEnd(28)} rx {iface.bytes_recv.toLocaleString()} B tx {iface.bytes_sent.toLocaleString()} B
              </div>
            ))}
          </div>
          {net?.connections?.some((c: any) => c.class === "external") && (
            <div className="border-t border-[var(--color-border-soft)] p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                External connections detected on this host
              </p>
              <div className="mono space-y-1 text-[11px] text-[#e5484d]">
                {net.connections
                  .filter((c: any) => c.class === "external")
                  .slice(0, 6)
                  .map((c: any, i: number) => (
                    <div key={i}>
                      {c.laddr} → {c.raddr} ({c.status})
                    </div>
                  ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
                Expected on a developer workstation with a normal internet connection — the deployment
                target runs behind a deny-all egress policy where this list should be empty.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Audit log"
            subtitle="Every model call, tool invocation and egress check, in order"
            icon={<FileClock className="h-4 w-4" />}
            right={
              <button className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-ink-dim)] hover:text-white">
                <ArrowDownToLine className="h-3 w-3" /> Export
              </button>
            }
          />
          {log && log.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-wide text-[var(--color-ink-faint)]">
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Detail</th>
                    <th className="px-5 py-3 font-medium">Egress</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e: any) => (
                    <tr key={e.id} className="border-b border-[var(--color-border-soft)] last:border-0 hover:bg-white/[0.015]">
                      <td className="mono px-5 py-3 text-[var(--color-ink-faint)]">
                        {new Date(e.time * 1000).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-3 text-white">{e.actor}</td>
                      <td className="px-3 py-3 text-[var(--color-ink-dim)]">{e.action}</td>
                      <td className="max-w-md truncate px-3 py-3 text-[var(--color-ink-dim)]">{e.detail}</td>
                      <td className="px-5 py-3">
                        {e.egress === "blocked" ? <Badge tone="green">blocked</Badge> : <Badge tone="neutral">n/a</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<FileClock className="h-5 w-5" />} title="No audit events yet" detail="Upload a document or run a task to generate the first entries." />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
