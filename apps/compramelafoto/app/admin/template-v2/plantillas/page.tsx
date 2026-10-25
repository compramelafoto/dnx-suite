"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TemplateV2NameEditor from "@/components/template-v2/TemplateV2NameEditor";

type Owner = { id: number; name: string | null; email: string | null; role: string | null };

type TemplateRow = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  currentVersionId: string | null;
  versionNumber: number | null;
  reviewStatus: string;
  visibility: string;
  packCount: number;
  owner: Owner;
};

type TransferMode = "move" | "copy";

function ownerLabel(owner: Owner | null | undefined): string {
  if (!owner) return "—";
  return owner.name?.trim() || owner.email || `Usuario #${owner.id}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "slate" | "amber" | "sky" | "emerald" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Buscador de fotógrafo destino + confirmación de mover o copiar. */
function TransferPanel({
  template,
  onDone,
  onClose,
}: {
  template: TemplateRow;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Owner[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<Owner | null>(null);
  const [mode, setMode] = useState<TransferMode>(template.packCount > 0 ? "copy" : "move");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/template-v2/photographers?q=${encodeURIComponent(q)}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        setResults(data.users ?? []);
      } catch {
        // búsqueda cancelada o caída de red: se queda la lista anterior
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function submit() {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/template-v2/templates/${encodeURIComponent(template.id)}/transfer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: target.id, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo completar la operación.");
        return;
      }
      onDone(
        mode === "move"
          ? `"${template.name}" ahora es de ${ownerLabel(target)}.`
          : `Se creó una copia de "${template.name}" para ${ownerLabel(target)}.`
      );
    } catch {
      setError("No se pudo completar la operación. Revisá tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <label className={`flex items-center gap-2 ${template.packCount > 0 ? "opacity-50" : ""}`}>
          <input
            type="radio"
            name={`mode-${template.id}`}
            checked={mode === "move"}
            disabled={template.packCount > 0}
            onChange={() => setMode("move")}
          />
          Mover (deja de ser de {ownerLabel(template.owner)})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={`mode-${template.id}`} checked={mode === "copy"} onChange={() => setMode("copy")} />
          Copiar (cada uno queda con la suya)
        </label>
      </div>
      {template.packCount > 0 ? (
        <p className="mb-3 text-xs text-amber-700">
          Se usa en {template.packCount} pack(s) de álbum de su dueño actual: sólo se puede copiar.
        </p>
      ) : null}

      {target ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[#111827]">
            Destino: <span className="font-semibold">{ownerLabel(target)}</span>
            {target.email && target.name ? <span className="text-[#6b7280]"> · {target.email}</span> : null}
          </p>
          <button type="button" className="text-xs text-[#6b7280] underline" onClick={() => setTarget(null)}>
            Cambiar
          </button>
        </div>
      ) : (
        <div>
          <Input
            placeholder="Buscar fotógrafo por nombre, email o ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching ? <p className="mt-2 text-xs text-[#6b7280]">Buscando…</p> : null}
          {results.length > 0 ? (
            <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white">
              {results
                .filter((u) => !(mode === "move" && u.id === template.owner.id))
                .map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setTarget(u)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#f3f4f6]"
                    >
                      <span className="font-medium text-[#111827]">{ownerLabel(u)}</span>
                      <span className="text-[#6b7280]">
                        {" "}
                        · {u.email} · #{u.id}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : query.trim().length >= 2 && !searching ? (
            <p className="mt-2 text-xs text-[#6b7280]">No hay fotógrafos que coincidan.</p>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="primary" disabled={!target || submitting} onClick={() => void submit()}>
          {submitting ? "Procesando…" : mode === "move" ? "Mover plantilla" : "Copiar plantilla"}
        </Button>
        <Button size="sm" variant="secondary" disabled={submitting} onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function AdminTemplateV2PlantillasPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (ownerId) params.set("ownerId", String(ownerId));
      else if (owner.trim()) params.set("owner", owner.trim());
      const res = await fetch(`/api/admin/template-v2/templates?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setTemplates(data.templates ?? []);
      setTruncated(Boolean(data.truncated));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [q, owner, ownerId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const filteredOwner = ownerId ? templates.find((t) => t.owner.id === ownerId)?.owner : null;

  return (
    <div className="max-w-6xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-[#1a1a1a]">Plantillas de los fotógrafos</h1>
      <p className="mb-6 text-sm text-[#6b7280]">
        Todas las plantillas del diseñador V2. Podés renombrarlas, abrirlas en el editor y pasarlas de un fotógrafo a
        otro.
      </p>

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Fotógrafo</label>
          {ownerId ? (
            <div className="flex items-center gap-2 py-2 text-sm">
              <span className="font-medium text-[#111827]">{ownerLabel(filteredOwner) || `#${ownerId}`}</span>
              <button
                type="button"
                className="text-xs text-[#6b7280] underline"
                onClick={() => {
                  setOwnerId(null);
                  setOwner("");
                }}
              >
                Ver todos
              </button>
            </div>
          ) : (
            <Input placeholder="Nombre, email o ID" value={owner} onChange={(e) => setOwner(e.target.value)} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Plantilla</label>
          <Input placeholder="Nombre o ID de la plantilla" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      {message ? (
        <Card className="mb-4 flex items-center justify-between gap-3 border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-800">{message}</p>
          <button type="button" className="text-xs text-emerald-800 underline" onClick={() => setMessage(null)}>
            Cerrar
          </button>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[#6b7280]">No hay plantillas que coincidan con la búsqueda.</p>
        </Card>
      ) : (
        <>
          <p className="mb-2 text-xs text-[#6b7280]">
            {templates.length} plantilla(s){truncated ? " — se muestran las 200 más recientes; afiná la búsqueda" : ""}
          </p>
          <ul className="grid gap-3">
            {templates.map((t) => {
              const editorHref = t.currentVersionId
                ? `/fotografo/diseno/plantillas/v2/${t.id}/${t.currentVersionId}`
                : null;
              return (
                <li key={t.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <TemplateV2NameEditor key={`${t.id}:${t.name}`} templateId={t.id} initialName={t.name} />
                        <p className="mt-1 text-xs text-[#6b7280]">
                          De{" "}
                          <button
                            type="button"
                            className="font-medium text-[#374151] underline decoration-dotted hover:text-[#c27b3d]"
                            onClick={() => setOwnerId(t.owner.id)}
                            title="Ver todas las plantillas de este fotógrafo"
                          >
                            {ownerLabel(t.owner)}
                          </button>
                          {t.owner.email && t.owner.name ? ` · ${t.owner.email}` : ""} · actualizada{" "}
                          {formatDate(t.updatedAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone="slate">{t.status}</Badge>
                          <Badge tone="amber">{t.reviewStatus}</Badge>
                          <Badge tone="sky">{t.visibility}</Badge>
                          {t.versionNumber != null ? <Badge tone="slate">v{t.versionNumber}</Badge> : null}
                          {t.packCount > 0 ? <Badge tone="emerald">En {t.packCount} pack(s)</Badge> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {editorHref ? (
                          <Link href={editorHref}>
                            <Button size="sm" variant="primary">
                              Editar
                            </Button>
                          </Link>
                        ) : (
                          <Button size="sm" variant="secondary" disabled title="No tiene una versión actual válida">
                            Editar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setTransferId(transferId === t.id ? null : t.id)}
                        >
                          Asignar a otro fotógrafo
                        </Button>
                      </div>
                    </div>
                    {transferId === t.id ? (
                      <TransferPanel
                        template={t}
                        onClose={() => setTransferId(null)}
                        onDone={(msg) => {
                          setTransferId(null);
                          setMessage(msg);
                          void load();
                        }}
                      />
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
