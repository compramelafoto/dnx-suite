"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type QueueItem = {
  templateId: string;
  name: string;
  description: string | null;
  owner: { id: number; name: string | null; email: string } | null;
  reviewStatus: string;
  visibility: string;
  updatedAt: string;
};

export default function AdminTemplateV2RevisionPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/template-v2/review-queue", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setQueue(data.queue ?? []);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-1">Revisión TemplateV2</h1>
      <p className="text-sm text-[#6b7280] mb-6">Templates enviados por fotógrafos para revisión.</p>

      {message ? (
        <Card className="p-3 mb-4">
          <p className="text-sm text-[#374151]">{message}</p>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : queue.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#6b7280]">No hay templates en revisión.</p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {queue.map((q) => (
            <li key={q.templateId}>
              <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[#1a1a1a]">{q.name}</p>
                  <p className="text-xs text-[#6b7280]">
                    Autor: {q.owner?.name?.trim() || q.owner?.email || "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={actionId === q.templateId}
                    onClick={async () => {
                      setActionId(q.templateId);
                      setMessage(null);
                      try {
                        const res = await fetch(
                          `/api/admin/template-v2/templates/${encodeURIComponent(q.templateId)}/approve`,
                          { method: "POST", credentials: "include" }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.ok) {
                          setMessage("Template aprobado.");
                          await loadQueue();
                        } else {
                          setMessage(data?.error || "No se pudo aprobar.");
                        }
                      } catch {
                        setMessage("Error de red al aprobar.");
                      } finally {
                        setActionId(null);
                      }
                    }}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={actionId === q.templateId}
                    onClick={async () => {
                      setActionId(q.templateId);
                      setMessage(null);
                      try {
                        const res = await fetch(
                          `/api/admin/template-v2/templates/${encodeURIComponent(q.templateId)}/reject`,
                          { method: "POST", credentials: "include" }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.ok) {
                          setMessage("Template rechazado.");
                          await loadQueue();
                        } else {
                          setMessage(data?.error || "No se pudo rechazar.");
                        }
                      } catch {
                        setMessage("Error de red al rechazar.");
                      } finally {
                        setActionId(null);
                      }
                    }}
                  >
                    Rechazar
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
