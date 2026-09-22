import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Bell, Wifi, WifiOff } from "lucide-react";
import { useRole } from "../../lib/RoleContext";
import { ROLES } from "../../lib/mock";
import { api } from "../../lib/api";
import { usePoll } from "../../lib/usePoll";
import clsx from "clsx";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { role, setRole, info } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: net } = usePoll(() => api.audit.network(), 4000);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div>
        <h1 className="text-[15px] font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-[12px] text-[var(--color-ink-dim)]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-1.5 text-[12px] text-[var(--color-ink-faint)] md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Search tasks, documents, models…</span>
          <kbd className="ml-3 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-2.5 py-1.5">
          {net?.zero_egress ? (
            <Wifi className="h-3.5 w-3.5 text-[#3ecf7e]" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-[#e5484d]" />
          )}
          <span className="text-[11px] font-medium text-[var(--color-ink-dim)]">
            {net ? `${net.external_connections} external` : "…"}
          </span>
        </div>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-dim)] hover:bg-white/[0.04]">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e8a33d]" />
        </button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-white/[0.02] py-1.5 pl-1.5 pr-2.5 hover:bg-white/[0.04]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#e8a33d] to-[#c77b1f] text-[11px] font-bold text-[#12161c]">
              {info.label
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="text-left leading-tight">
              <div className="text-[12px] font-semibold text-white">{info.label}</div>
              <div className="text-[10.5px] text-[var(--color-ink-faint)]">{info.blurb}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" />
          </button>

          {open && (
            <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#171c23] shadow-2xl">
              <div className="border-b border-[var(--color-border-soft)] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-faint)]">
                Switch role view
              </div>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRole(r.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between px-3 py-2.5 text-left text-[12.5px] hover:bg-white/[0.04]",
                    role === r.id ? "text-[#e8a33d]" : "text-[var(--color-ink)]",
                  )}
                >
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[11px] text-[var(--color-ink-faint)]">{r.blurb}</div>
                  </div>
                  {role === r.id && <div className="h-1.5 w-1.5 rounded-full bg-[#e8a33d]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
