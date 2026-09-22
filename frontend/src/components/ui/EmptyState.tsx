import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[var(--color-ink-faint)]">
        {icon}
      </div>
      <div>
        <p className="text-[13px] font-medium text-white">{title}</p>
        {detail && <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--color-ink-faint)]">{detail}</p>}
      </div>
      {action}
    </div>
  );
}
