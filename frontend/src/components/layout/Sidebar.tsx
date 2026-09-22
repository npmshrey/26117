import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutGrid,
  FileSearch,
  Cpu,
  TerminalSquare,
  ShieldCheck,
  FileOutput,
  Settings2,
  Radio,
} from "lucide-react";
import { api } from "../../lib/api";
import { usePoll } from "../../lib/usePoll";

const NAV = [
  { to: "/", label: "Workspace", icon: LayoutGrid, end: true },
  { to: "/documents", label: "Document Intelligence", icon: FileSearch },
  { to: "/router", label: "Model Router", icon: Cpu },
  { to: "/sandbox", label: "Code Sandbox", icon: TerminalSquare },
  { to: "/audit", label: "Audit & Network", icon: ShieldCheck },
  { to: "/outputs", label: "Deliverables", icon: FileOutput },
  { to: "/admin", label: "Admin & RBAC", icon: Settings2 },
];

export function Sidebar() {
  const { data: net } = usePoll(() => api.audit.network(), 4000);
  const clean = net?.zero_egress;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--color-border-soft)] px-5 py-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8a33d]/30 bg-[#e8a33d]/10">
          <svg viewBox="0 0 32 32" className="h-5 w-5">
            <path
              d="M16 4 L27 10 V22 L16 28 L5 22 V10 Z"
              stroke="#e8a33d"
              strokeWidth="1.8"
              fill="none"
            />
            <circle cx="16" cy="16" r="3.4" fill="#e8a33d" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold leading-none tracking-tight text-white">
            FORGE
          </div>
          <div className="mt-1 text-[10.5px] font-medium uppercase tracking-widest text-[var(--color-ink-faint)]">
            Sovereign AI Workbench
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[#e8a33d]/[0.09] text-[#e8a33d]"
                  : "text-[var(--color-ink-dim)] hover:bg-white/[0.04] hover:text-[var(--color-ink)]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={clsx(
                    "h-[17px] w-[17px] shrink-0",
                    isActive ? "text-[#e8a33d]" : "text-[var(--color-ink-faint)] group-hover:text-[var(--color-ink-dim)]",
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-soft)] p-4">
        <NavLink
          to="/audit"
          className={clsx(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
            clean
              ? "border-[#3ecf7e]/20 bg-[#3ecf7e]/[0.06] hover:bg-[#3ecf7e]/[0.09]"
              : "border-[#e5484d]/20 bg-[#e5484d]/[0.06] hover:bg-[#e5484d]/[0.09]",
          )}
        >
          <span className="relative flex h-2 w-2">
            {clean && <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-[#3ecf7e]" />}
            <span className={clsx("relative inline-flex h-2 w-2 rounded-full", clean ? "bg-[#3ecf7e]" : "bg-[#e5484d]")} />
          </span>
          <div className="leading-tight">
            <div className={clsx("text-[11.5px] font-semibold", clean ? "text-[#3ecf7e]" : "text-[#e5484d]")}>
              {net === null ? "Checking…" : clean ? "Zero-egress verified" : "External traffic detected"}
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-[var(--color-ink-faint)]">
              <Radio className="h-2.5 w-2.5" />
              {net ? `${net.external_connections} external connection(s) now` : "querying network monitor"}
            </div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
