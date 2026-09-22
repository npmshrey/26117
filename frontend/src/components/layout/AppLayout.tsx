import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-bg)] text-[var(--color-ink)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
