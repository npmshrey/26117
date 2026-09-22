import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "./types";
import { ROLES } from "./mock";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("engineer");
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  const info = ROLES.find((r) => r.id === ctx.role)!;
  return { ...ctx, info };
}
