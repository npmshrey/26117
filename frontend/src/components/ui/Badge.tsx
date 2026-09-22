import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "amber" | "teal" | "blue" | "red" | "green" | "neutral";

const toneClasses: Record<Tone, string> = {
  amber: "bg-[#e8a33d]/10 text-[#e8a33d] border-[#e8a33d]/25",
  teal: "bg-[#3fb8af]/10 text-[#3fb8af] border-[#3fb8af]/25",
  blue: "bg-[#4c8dff]/10 text-[#4c8dff] border-[#4c8dff]/25",
  red: "bg-[#e5484d]/10 text-[#e5484d] border-[#e5484d]/25",
  green: "bg-[#3ecf7e]/10 text-[#3ecf7e] border-[#3ecf7e]/25",
  neutral: "bg-white/5 text-[#9aa4b2] border-white/10",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
