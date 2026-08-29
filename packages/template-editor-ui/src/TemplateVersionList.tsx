"use client";

import {
  DEFAULT_TEMPLATE_V2_BASE_PATH,
  templateV2EditorPath,
} from "./template-v2-base-path";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "./primitives/Card";

export type TemplateVersionListRow = {
  id: string;
  versionNumber: number;
  updatedAt: string;
  isCurrent: boolean;
};

type VersionsApiResponse = {
  ok?: boolean;
  currentVersionId?: string | null;
  versions?: TemplateVersionListRow[];
  error?: string;
};

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function badgeClass(kind: "current" | "open"): string {
  if (kind === "current") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  return "bg-sky-50 text-sky-800 ring-sky-200";
}

type TemplateVersionListProps = {
  templateId: string;
  /** Dónde vive el editor en esta app. */
  basePath?: string;
  activeVersionId: string;
};

export function TemplateVersionList({
  templateId,
  activeVersionId,
  basePath = DEFAULT_TEMPLATE_V2_BASE_PATH,
}: TemplateVersionListProps) {
  const [rows, setRows] = useState<TemplateVersionListRow[] | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows(null);

    fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/versions`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as VersionsApiResponse;
        if (!r.ok || data.ok !== true) {
          const msg = typeof data.error === "string" ? data.error : `Error (${r.status})`;
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setCurrentVersionId(data.currentVersionId ?? null);
        setRows(Array.isArray(data.versions) ? data.versions : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudieron cargar las versiones.");
        setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId, activeVersionId]);

  const viewingIsNotCurrent = useMemo(() => {
    if (currentVersionId === undefined || currentVersionId === null) return false;
    return activeVersionId !== currentVersionId;
  }, [currentVersionId, activeVersionId]);

  return (
    <Card className="mb-4 p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--te-ink)]">Versiones del template</h2>
          <p className="mt-1 text-xs text-[color:var(--te-ink-muted)]">
            Abrí una versión para editarla o revisarla. La versión marcada como <span className="font-medium">Actual</span>{" "}
            es la vigente del template.
          </p>
        </div>
      </div>

      {viewingIsNotCurrent ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Estás viendo una versión que no es la actual. Podés seguir editando; al guardar se actualiza esta versión.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

      {rows === null && !error ? (
        <p className="mt-3 text-xs text-[color:var(--te-ink-muted)]">Cargando versiones…</p>
      ) : rows && rows.length === 0 && !error ? (
        <p className="mt-3 text-xs text-[color:var(--te-ink-muted)]">No hay versiones registradas.</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-[color:var(--te-line)]">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="sticky top-0 z-[1] border-b border-[color:var(--te-line)] bg-[color:var(--te-chrome)] text-[color:var(--te-ink-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Versión</th>
                <th className="px-3 py-2 font-semibold">ID</th>
                <th className="px-3 py-2 font-semibold">Actualizado</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = row.id === activeVersionId;
                const href = templateV2EditorPath(basePath, templateId, row.id);
                return (
                  <tr key={row.id} className="border-b border-[color:var(--te-chrome-sunken)] last:border-b-0 align-middle">
                    <td className="px-3 py-2 font-semibold text-[color:var(--te-ink)]">v{row.versionNumber}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[color:var(--te-ink-muted)] break-all max-w-[200px]">
                      {row.id}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--te-ink)] whitespace-nowrap">{formatUpdatedAt(row.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.isCurrent ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeClass("current")}`}
                          >
                            Actual
                          </span>
                        ) : null}
                        {isOpen ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeClass("open")}`}
                          >
                            Abierta
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isOpen ? (
                        <span className="text-[11px] text-[color:var(--te-ink-faint)]">Vista actual</span>
                      ) : (
                        <Link
                          href={href}
                          className="inline-flex rounded-full border border-[color:var(--te-ink-faint)] bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--te-ink)] shadow-sm transition hover:border-[color:var(--te-ink-faint)] hover:shadow-md"
                        >
                          Abrir
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
