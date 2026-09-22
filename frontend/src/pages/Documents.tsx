import { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  ScanEye,
  Layers,
  Database,
  CheckCircle2,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { api } from "../lib/api";
import { usePoll } from "../lib/usePoll";

const KIND_ICON: Record<string, typeof FileText> = {
  "Scanned PDF": ImageIcon,
  PDF: FileText,
  Text: FileText,
  "Image / Scan": ImageIcon,
};

function iconFor(kind: string) {
  return KIND_ICON[kind] ?? FileSpreadsheet;
}

export default function Documents() {
  const { data: stats } = usePoll(() => api.documents.stats(), 4000);
  const { data: docs, loading: docsLoading } = usePoll(() => api.documents.list(), 4000);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        await api.documents.upload(file);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  const STATS = [
    { label: "Documents indexed", value: stats?.documents_indexed ?? "—", icon: Database },
    { label: "Vector chunks", value: stats?.chunks_indexed ?? "—", icon: Layers },
    { label: "OCR pages processed", value: stats?.ocr_pages_processed ?? "—", icon: ScanEye },
    {
      label: "Avg. retrieval latency",
      value: stats?.avg_retrieval_latency_ms != null ? `${stats.avg_retrieval_latency_ms}ms` : "no queries yet",
      icon: CheckCircle2,
    },
  ];

  return (
    <AppLayout title="Document Intelligence" subtitle="OCR + Vision-LM extraction → private RAG knowledge base">
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[#3fb8af]">
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-white">{s.value}</div>
                  <div className="text-[11px] text-[var(--color-ink-faint)]">{s.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {stats && !stats.ocr_available && (
          <Card className="border-[#e8a33d]/25 bg-[#e8a33d]/[0.05]">
            <div className="flex items-center gap-3 p-3.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#e8a33d]" />
              <p className="text-[12px] text-[var(--color-ink-dim)]">
                No OCR engine detected on this host (Tesseract not installed). Native-text PDFs and
                text files still index normally — scanned pages will show as unextracted until an
                OCR engine is available.
              </p>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.3fr]">
          <Card>
            <CardHeader title="Ingest" subtitle="Drop files or click to browse" icon={<UploadCloud className="h-4 w-4" />} />
            <div className="p-5">
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  dragOver ? "border-[#e8a33d]/60 bg-[#e8a33d]/[0.04]" : "border-[var(--color-border)] bg-white/[0.015] hover:border-[#e8a33d]/40"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-[#e8a33d]" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-[var(--color-ink-faint)]" />
                )}
                <p className="text-[13px] font-medium text-white">
                  {uploading ? "Processing on-device…" : "Drag files here or click to browse"}
                </p>
                <p className="text-[11.5px] text-[var(--color-ink-faint)]">
                  PDF · TXT · scans — extracted and indexed entirely on this machine
                </p>
              </div>
              {uploadError && <p className="mt-2 text-[11.5px] text-[#e5484d]">{uploadError}</p>}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-ink-dim)]">Text extraction</span>
                  <span className="mono text-white">PyMuPDF</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-ink-dim)]">Vector index</span>
                  <span className="mono text-white">SQLite FTS5 · local · on disk</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-ink-dim)]">OCR engine</span>
                  <span className="mono text-white">{stats?.ocr_available ? "Tesseract — available" : "not installed on this host"}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Knowledge base" subtitle="Live — reflects what's actually indexed" icon={<Database className="h-4 w-4" />} />
            {docsLoading && !docs ? (
              <div className="p-5 text-[12px] text-[var(--color-ink-faint)]">Loading…</div>
            ) : docs && docs.length > 0 ? (
              <div className="divide-y divide-[var(--color-border-soft)]">
                {docs.map((doc) => {
                  const Icon = iconFor(doc.kind);
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-white">{doc.name}</div>
                        <div className="text-[11px] text-[var(--color-ink-faint)]">
                          {doc.kind} · {doc.pages} {doc.pages === 1 ? "page" : "pages"}
                          {!!doc.ocr_used && " · OCR applied"}
                        </div>
                      </div>
                      <Badge tone="green">{doc.status}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Database className="h-5 w-5" />}
                title="No documents indexed yet"
                detail="Upload a PDF, scan, or text file to build the private knowledge base."
              />
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
