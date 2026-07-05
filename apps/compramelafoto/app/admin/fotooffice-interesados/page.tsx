"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type { FotoOfficeInterestAdminRow } from "@/app/api/admin/fotooffice-interests/route";
import { formatDate } from "@/lib/admin/helpers";

function formatMetadataPreview(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const parts: string[] = [];
  if (typeof metadata.minimumSustainablePrice === "number") {
    parts.push(`Mín. ${metadata.minimumSustainablePrice.toLocaleString("es-AR")}`);
  }
  if (typeof metadata.recommendedBusinessPrice === "number") {
    parts.push(`Rec. ${metadata.recommendedBusinessPrice.toLocaleString("es-AR")}`);
  }
  if (typeof metadata.commercialPositioningLabel === "string" && metadata.commercialPositioningLabel.trim()) {
    parts.push(metadata.commercialPositioningLabel.trim());
  }
  if (typeof metadata.jobType === "string" && metadata.jobType.trim()) {
    parts.push(metadata.jobType.trim());
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default function AdminFotoOfficeInteresadosPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FotoOfficeInterestAdminRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fotooffice-interests", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Error cargando interesados");
      }
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (error) {
      console.error(error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.name,
        row.email,
        row.userName,
        row.userEmail,
        row.source,
        row.interestType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="ds-dashboard-inner mx-auto w-full min-w-0 space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-[var(--ds-color-text)]">Interesados en FotoOffice</h1>
        <p className="mt-1 text-sm text-[var(--ds-color-muted)]">
          Registros de usuarios que quieren recibir novedades y asesoramiento desde ¿Cuánto Cobro?
        </p>
      </header>

      <Card className="!p-4 sm:!p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 w-full max-w-md flex-1">
            <label htmlFor="fotooffice-search" className="mb-1 block text-sm font-medium">
              Buscar por nombre o email
            </label>
            <Input
              id="fotooffice-search"
              type="search"
              className="min-h-[44px] w-full"
              placeholder="Mínimo 2 caracteres"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="m-0 shrink-0 text-sm text-[var(--ds-color-muted)] sm:text-right">
            {loading ? "Cargando…" : `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--ds-color-muted)]">Cargando interesados…</p>
        ) : filtered.length === 0 ? (
          <div className="ds-fill-width w-full min-w-0 rounded-lg border border-dashed border-[var(--ds-color-border)] px-4 py-10 text-center">
            <p className="m-0 text-sm text-[var(--ds-color-muted)]">
              {rows.length === 0
                ? "Todavía no hay interesados registrados desde ¿Cuánto Cobro?."
                : "No hay resultados para esa búsqueda."}
            </p>
          </div>
        ) : (
          <div className="ds-table-scroll overflow-x-auto">
            <table className="ds-table w-full min-w-[56rem]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Usuario</th>
                  <th>Origen</th>
                  <th>Tipo</th>
                  <th>Metadata</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name || row.userName || "—"}</td>
                    <td>{row.email || row.userEmail || "—"}</td>
                    <td>
                      {row.userId
                        ? `#${row.userId}${row.userEmail ? ` · ${row.userEmail}` : ""}`
                        : "—"}
                    </td>
                    <td>{row.source}</td>
                    <td>{row.interestType}</td>
                    <td className="max-w-[18rem] truncate" title={formatMetadataPreview(row.metadata)}>
                      {formatMetadataPreview(row.metadata)}
                    </td>
                    <td>{formatDate(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
