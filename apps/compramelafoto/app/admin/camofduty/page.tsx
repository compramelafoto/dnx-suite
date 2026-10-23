"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type { CamOfDutyMemberAdminRow } from "@/app/api/admin/camofduty-members/route";
import { formatDate } from "@/lib/admin/helpers";

export default function AdminCamOfDutyPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CamOfDutyMemberAdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/camofduty-members", { credentials: "include" });
        if (!res.ok) throw new Error("Error cargando usuarios de Cam Of Duty");
        const data = await res.json();
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } catch (error) {
        console.error(error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return rows;
    return rows.filter((row) => `${row.name ?? ""} ${row.email}`.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="ds-dashboard-inner mx-auto w-full min-w-0 space-y-6">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold text-[var(--ds-color-text)]">Usuarios de Cam Of Duty</h1>
        <p className="mt-1 text-sm text-[var(--ds-color-muted)]">
          Cuentas de CompraMeLaFoto que entraron al simulador o al estudio de luz. Cam Of Duty es gratis, pero
          para usarlo hay que registrarse.
        </p>
      </header>

      <Card className="!p-4 sm:!p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 w-full max-w-md flex-1">
            <label htmlFor="camofduty-search" className="mb-1 block text-sm font-medium">
              Buscar por nombre o email
            </label>
            <Input
              id="camofduty-search"
              type="search"
              className="min-h-[44px] w-full"
              placeholder="Mínimo 2 caracteres"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="m-0 shrink-0 text-sm text-[var(--ds-color-muted)] sm:text-right">
            {loading ? "Cargando…" : `${total} usuario${total === 1 ? "" : "s"} en total`}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--ds-color-muted)]">Cargando usuarios…</p>
        ) : filtered.length === 0 ? (
          <div className="ds-fill-width w-full min-w-0 rounded-lg border border-dashed border-[var(--ds-color-border)] px-4 py-10 text-center">
            <p className="m-0 text-sm text-[var(--ds-color-muted)]">
              {rows.length === 0 ? "Todavía nadie entró a Cam Of Duty." : "No hay resultados para esa búsqueda."}
            </p>
          </div>
        ) : (
          <div className="ds-table-scroll overflow-x-auto">
            <table className="ds-table w-full min-w-[48rem]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Usuario</th>
                  <th>Primera entrada</th>
                  <th>Última entrada</th>
                  <th>Entradas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.userId}>
                    <td>{row.name || "—"}</td>
                    <td>{row.email}</td>
                    <td>#{row.userId}</td>
                    <td>{formatDate(row.firstVisitAt)}</td>
                    <td>{formatDate(row.lastVisitAt)}</td>
                    <td>{row.visits}</td>
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
