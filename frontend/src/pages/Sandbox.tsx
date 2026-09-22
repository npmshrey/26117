import { useState } from "react";
import { TerminalSquare, ShieldOff, ShieldCheck, Play, Loader2, Box } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

const DEFAULT_CODE = `import numpy as np

def hoop_stress(pressure_mpa, radius_mm, thickness_mm):
    """ASME BPVC thin-wall hoop stress check."""
    return (pressure_mpa * radius_mm) / thickness_mm

p, r, t = 1.6, 450.0, 12.0
sigma = hoop_stress(p, r, t)
allowable = 137.0

print(f"Hoop stress: {sigma:.2f} MPa")
print(f"Allowable:   {allowable:.2f} MPa")
print(f"Margin:      {(1 - sigma/allowable) * 100:.1f}%")
assert sigma < allowable, "Exceeds allowable stress"
`;

export default function Sandbox() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { data: status } = usePoll(() => api.sandbox.status(), 6000);

  async function run() {
    setRunning(true);
    try {
      const r = await api.sandbox.run(code);
      setResult(r);
    } finally {
      setRunning(false);
    }
  }

  const isolated = result?.isolation_mode?.startsWith("docker");

  return (
    <AppLayout title="Code Sandbox" subtitle="Isolated execution — verified before results reach the task">
      <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="task.py"
              subtitle="Edit and run — executes on this machine's sandbox"
              icon={<TerminalSquare className="h-4 w-4" />}
              right={
                <button
                  onClick={run}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-md bg-[#e8a33d] px-3 py-1.5 text-[11.5px] font-semibold text-[#1a1206] hover:bg-[#f0ad4a] disabled:opacity-50"
                >
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {running ? "Running" : "Run"}
                </button>
              }
            />
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="mono h-72 w-full resize-none bg-transparent p-5 text-[12.5px] leading-relaxed text-[#c9d1d9] outline-none"
            />
          </Card>

          <Card>
            <CardHeader
              title="Execution output"
              subtitle={result ? `Captured stdout / stderr — ${result.duration_ms}ms` : "Run the code to see output"}
              icon={result ? <ShieldCheck className="h-4 w-4 text-[#3ecf7e]" /> : <TerminalSquare className="h-4 w-4" />}
              right={result && <Badge tone={result.exit_code === 0 ? "green" : "red"}>exit {result.exit_code}</Badge>}
            />
            <pre className="mono min-h-[100px] overflow-x-auto whitespace-pre-wrap bg-black/20 p-5 text-[12.5px] leading-relaxed">
              {result ? (
                <>
                  <span className="text-[#3ecf7e]">{result.stdout}</span>
                  {result.stderr && <span className="text-[#e5484d]">{result.stderr}</span>}
                </>
              ) : (
                <span className="text-[var(--color-ink-faint)]">No output yet</span>
              )}
            </pre>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Isolation profile" subtitle="Detected live from this host" icon={<Box className="h-4 w-4" />} />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-ink-dim)]">Docker daemon</span>
                <Badge tone={status?.docker_available ? "green" : "red"}>
                  {status?.docker_available ? "reachable" : "unreachable"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-ink-dim)]">Last run mode</span>
                <span className="mono text-right text-[11px] text-white">{result?.isolation_mode ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--color-ink-dim)]">Timeout</span>
                <Badge tone="neutral">20s wall clock</Badge>
              </div>
            </div>
          </Card>

          <Card className={isolated ? "border-[#3ecf7e]/25 bg-[#3ecf7e]/[0.05]" : "border-[#e8a33d]/25 bg-[#e8a33d]/[0.05]"}>
            <div className="flex items-start gap-3 p-4">
              {isolated ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#3ecf7e]" />
              ) : (
                <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-[#e8a33d]" />
              )}
              <div>
                <div className="text-[12.5px] font-semibold text-white">
                  {result
                    ? isolated
                      ? "Ran with no network namespace"
                      : "Docker unavailable — subprocess fallback used"
                    : "Awaiting first run"}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-dim)]">
                  {status?.docker_available
                    ? "Code executes inside a --network none container — sockets fail at the kernel level."
                    : "This dev host has no reachable Docker daemon, so execution fell back to a local subprocess without network isolation. On the deployment target, start Docker to get true kernel-level isolation."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
