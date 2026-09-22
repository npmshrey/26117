import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={clsx(
        "card relative rounded-xl",
        glow &&
          "before:pointer-events-none before:absolute before:-inset-px before:rounded-xl before:bg-gradient-to-br before:from-[#e8a33d]/[0.06] before:to-transparent",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  icon,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-soft)] px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[#e8a33d]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink)]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-dim)]">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}
