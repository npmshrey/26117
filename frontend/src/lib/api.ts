const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  params: string;
  quant: string;
  vram_gb: number;
  specialties: string[];
  status: string;
}

export interface ModelsResponse {
  ollama_online: boolean;
  count: number;
  models: ModelInfo[];
}

export const api = {
  health: () => req<{ status: string }>("/health"),

  models: () => req<ModelsResponse>("/models"),

  documents: {
    list: () => req<any[]>("/documents"),
    stats: () =>
      req<{
        documents_indexed: number;
        chunks_indexed: number;
        ocr_pages_processed: number;
        avg_retrieval_latency_ms: number | null;
        ocr_available: boolean;
        embedding_model?: string;
        vector_dim?: number;
      }>("/documents/stats"),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return req<any>("/documents/upload", { method: "POST", body: fd });
    },
    search: (q: string) => req<any>(`/documents/search?q=${encodeURIComponent(q)}`),
  },

  tasks: {
    create: (prompt: string) =>
      req<{ id: string; status: string }>("/tasks", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      }),
    get: (id: string) => req<any>(`/tasks/${id}`),
    list: () => req<any[]>("/tasks"),
    streamUrl: (id: string) => `${BASE}/tasks/${id}/stream`,
  },

  sandbox: {
    run: (code: string) =>
      req<any>("/sandbox/run", { method: "POST", body: JSON.stringify({ code }) }),
    status: () => req<{ docker_available: boolean }>("/sandbox/status"),
    runs: () => req<any[]>("/sandbox/runs"),
  },

  audit: {
    list: () => req<any[]>("/audit"),
    network: () => req<any>("/audit/network"),
  },

  outputs: {
    list: () => req<any[]>("/outputs"),
    downloadUrl: (id: string) => `${BASE}/outputs/${id}/download`,
  },

  admin: {
    users: () => req<any[]>("/admin/users"),
    policies: () => req<{ policies: string[] }>("/admin/policies"),
    nodes: () => req<{ nodes: any[]; gpus: any[] }>("/admin/nodes"),
  },

  system: {
    status: () => req<any>("/system/status"),
  },
};
