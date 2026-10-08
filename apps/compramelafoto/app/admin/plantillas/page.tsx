"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type StatusRow = {
  legacyTemplateId: number;
  name: string;
  imageUrl: string;
  slots: number;
  templateV2Id: string | null;
};

type ResultRow = {
  legacyTemplateId: number;
  name: string;
  templateV2Id: string | null;
  created: boolean;
  benefitsRepointed: number;
  packsRepointed: number;
  error: string | null;
};

/**
 * Las plantillas del diseñador viejo y su paso al diseñador nuevo.
 *
 * El diseñador viejo ya no crea plantillas ni arma diseños: todo el circuito (probar, armar al
 * comprar o canjear, revisar y aprobar) usa el nuevo. Esta pantalla queda para migrar lo que
 * haya quedado y ver a qué plantilla nueva pasó cada una.
 */
export default function AdminLegacyTemplatesMigrationPage() {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/template-v2/migrate-legacy", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setRows(res.ok && data.ok ? data.templates : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function migrate() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/template-v2/migrate-legacy", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "La migración falló.");
      setResults(data.results);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "La migración falló.");
    } finally {
      setRunning(false);
    }
  }

  const pending = (rows ?? []).filter((r) => !r.templateV2Id).length;

  return (
    <div className="max-w-5xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-[#1a1a1a]">Migración del diseñador viejo</h1>
      <p className="mb-6 text-sm text-[#6b7280]">
        Las plantillas del diseñador viejo pasan al diseñador nuevo: la imagen queda de fondo y cada recuadro pasa
        a ser un hueco “Foto del cliente”. Lo que las usaba (beneficios de preventa, packs) pasa a usar la nueva. Se
        puede repetir: lo que ya se migró no se duplica.
      </p>

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-[#374151]">
          {rows == null
            ? "Cargando…"
            : rows.length === 0
              ? "No hay plantillas del diseñador viejo."
              : pending === 0
                ? `Las ${rows.length} plantillas ya están en el diseñador nuevo.`
                : `${pending} de ${rows.length} plantillas sin migrar.`}
        </p>
        <Button variant="primary" size="sm" onClick={() => void migrate()} disabled={running || rows == null || rows.length === 0}>
          {running ? "Migrando…" : pending > 0 ? "Migrar al diseñador nuevo" : "Volver a revisar referencias"}
        </Button>
      </Card>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {results ? (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 p-4">
          <ul className="space-y-1 text-sm text-emerald-900">
            {results.map((r) => (
              <li key={r.legacyTemplateId}>
                {r.error
                  ? `✗ ${r.name}: ${r.error}`
                  : `✓ ${r.name}: ${r.created ? "creada en el diseñador nuevo" : "ya estaba migrada"}` +
                    (r.benefitsRepointed || r.packsRepointed
                      ? ` · ${r.benefitsRepointed} beneficio(s) y ${r.packsRepointed} pack(s) actualizados`
                      : "")}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ul className="grid gap-3">
        {(rows ?? []).map((r) => (
          <li key={r.legacyTemplateId}>
            <Card className="flex items-center gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.imageUrl} alt="" className="h-16 w-16 rounded object-cover ring-1 ring-[#e5e7eb]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111827]">{r.name}</p>
                <p className="text-xs text-[#6b7280]">
                  #{r.legacyTemplateId} · {r.slots} recuadro(s) de foto
                </p>
              </div>
              {r.templateV2Id ? (
                <div className="flex shrink-0 gap-3 text-sm">
                  <Link
                    href={`/fotografo/diseno/plantillas/v2/${r.templateV2Id}/probar`}
                    className="font-medium text-[#c27b3d] underline"
                  >
                    Probar
                  </Link>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    Migrada
                  </span>
                </div>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  Sin migrar
                </span>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
