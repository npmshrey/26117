export type Role = "engineer" | "operations" | "safety" | "management" | "admin";

export interface RoleInfo {
  id: Role;
  label: string;
  blurb: string;
}

export type TaskType = "document" | "coding" | "multimodal" | "analysis" | "general";

export interface ModelSpec {
  id: string;
  name: string;
  family: string;
  params: string;
  quant: string;
  vramGb: number;
  specialties: TaskType[];
  status: "loaded" | "standby" | "cold";
  avgLatencyMs: number;
  score: number;
}

export interface AgentStep {
  id: string;
  label: string;
  detail: string;
  status: "done" | "active" | "pending" | "error";
  tool?: string;
  durationMs?: number;
}

export interface Citation {
  doc: string;
  revision: string;
  page: number;
  hash: string;
  snippet: string;
}

export interface AuditEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
  egress: "blocked" | "n/a";
  severity: "info" | "warn";
}

export interface Deliverable {
  id: string;
  name: string;
  kind: "docx" | "xlsx" | "pptx" | "code" | "pdf";
  task: string;
  createdAt: string;
  sizeKb: number;
  sourceModel: string;
}
