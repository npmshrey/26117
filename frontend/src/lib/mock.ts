import type { RoleInfo } from "./types";

// Role-switcher configuration — UI wiring, not application data.
export const ROLES: RoleInfo[] = [
  { id: "engineer", label: "Engineer", blurb: "Analysis & reports" },
  { id: "operations", label: "Operations", blurb: "Process monitoring" },
  { id: "safety", label: "Safety Officer", blurb: "Compliance & alerts" },
  { id: "management", label: "Management", blurb: "Dashboards & KPIs" },
  { id: "admin", label: "IT / Admin", blurb: "Systems & governance" },
];
