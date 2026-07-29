"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { DNX_FOTO_BASICA_FUNES_SLUG } from "@/lib/dnx-foto-basica-funes-public";

type LeadRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  message: string | null;
};

type EnrollRow = {
  id: number;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  amountArs: number;
  mpPaymentId: string | null;
  paidAt: string | null;
  mpPreferenceId: string | null;
};

type Payload = {
  stats: {
    interesados: number;
    enProcesoPago: number;
    inscriptosPagos: number;
    canceladosORechazados: number;
    totalInscripcIntentos: number;
  };
  leads: LeadRow[];
  enrollments: {
    pendientePago: EnrollRow[];
    aprobados: EnrollRow[];
    cancelados: EnrollRow[];
  };
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AdminDnxCursoFotografiaFunesPage() {
  const slug = DNX_FOTO_BASICA_FUNES_SLUG;
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/dnx-course/${slug}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Error al cargar");
      setData(json as Payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  function downloadCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push("tipo,id,fecha,apellido,nombre,email,telefono,estado_o_nota,pago_id,extra");
    for (const l of data.leads) {
      lines.push(
        [
          "interesado",
          l.id,
          l.updatedAt,
          l.lastName,
          l.firstName,
          l.email,
          l.phone ?? "",
          "",
          "",
          (l.message ?? "").replace(/\r?\n/g, " "),
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
    const allEnroll = [
      ...data.enrollments.pendientePago.map((e) => ({ ...e, bucket: "pendiente_pago" })),
      ...data.enrollments.aprobados.map((e) => ({ ...e, bucket: "aprobado" })),
      ...data.enrollments.cancelados.map((e) => ({ ...e, bucket: "cancelado" })),
    ];
    for (const e of allEnroll) {
      lines.push(
        [
          "inscripcion",
          e.id,
          e.updatedAt,
          e.lastName,
          e.firstName,
          e.email,
          e.phone,
          e.status,
          e.mpPaymentId ?? "",
          e.bucket,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curso-foto-funes-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statClass =
    "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";

  return (
    <div className="ds-content-container mx-auto max-w-7xl px-4 py-8 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Curso Fotografía Básica — Funes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Interesados, pagos pendientes e inscriptos confirmados · <code className="text-xs">/{slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cursos/${slug}`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Abrir landing pública</Button>
          </Link>
          <Button variant="secondary" type="button" onClick={() => void load()} disabled={loading}>
            Actualizar
          </Button>
          <Button variant="primary" type="button" onClick={downloadCsv} disabled={!data}>
            Descargar CSV
          </Button>
        </div>
      </div>

      {err ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {loading && !data ? (
        <p className="mt-8 text-gray-500">Cargando…</p>
      ) : data ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className={statClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Interesados</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {data.stats.interesados}
              </p>
              <p className="mt-1 text-xs text-gray-500">Formulario “más info” en la landing</p>
            </div>
            <div className={statClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">En proceso de pago</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {data.stats.enProcesoPago}
              </p>
              <p className="mt-1 text-xs text-gray-500">Iniciaron checkout (MP pendiente / abandonado)</p>
            </div>
            <div className={statClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inscriptos pagos</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {data.stats.inscriptosPagos}
              </p>
              <p className="mt-1 text-xs text-gray-500">Pago aprobado en Mercado Pago</p>
            </div>
            <div className={statClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cancelados / rechazados</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-600 dark:text-gray-300">
                {data.stats.canceladosORechazados}
              </p>
            </div>
            <div className={statClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Intentos inscripción</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {data.stats.totalInscripcIntentos}
              </p>
            </div>
          </div>

          <section className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Interesados (sin pago obligatorio)</h2>
            <div className="ds-table-scroll mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Actualizado</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Mensaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.leads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="ds-readable-text px-4 py-8 text-center text-gray-500">
                        Todavía no hay interesados registrados desde la landing.
                      </td>
                    </tr>
                  ) : (
                    data.leads.map((l) => (
                      <tr key={l.id} className="bg-white dark:bg-gray-900">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtDate(l.updatedAt)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {l.firstName} {l.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{l.email}</td>
                        <td className="px-4 py-3 text-gray-600">{l.phone ?? "—"}</td>
                        <td className="max-w-xs px-4 py-3 text-gray-600">
                          <span className="line-clamp-2">{l.message ?? "—"}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inscripciones pendientes de pago</h2>
            <div className="ds-table-scroll mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-[800px] w-full text-left text-sm">
                <thead className="bg-amber-50 text-xs font-semibold uppercase text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <tr>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">MP pref.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.enrollments.pendientePago.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="ds-readable-text px-4 py-8 text-center text-gray-500">
                        Nadie con pago pendiente en este momento.
                      </td>
                    </tr>
                  ) : (
                    data.enrollments.pendientePago.map((e) => (
                      <tr key={e.id} className="bg-white dark:bg-gray-900">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtDate(e.createdAt)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {e.firstName} {e.lastName}
                        </td>
                        <td className="px-4 py-3">{e.email}</td>
                        <td className="px-4 py-3">{e.phone}</td>
                        <td className="px-4 py-3 tabular-nums">${e.amountArs.toLocaleString("es-AR")}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-xs text-gray-500">
                          {e.mpPreferenceId ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inscriptos — pago aprobado</h2>
            <div className="ds-table-scroll mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-[880px] w-full text-left text-sm">
                <thead className="bg-emerald-50 text-xs font-semibold uppercase text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <tr>
                    <th className="px-4 py-3">Pagado</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">ID pago MP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.enrollments.aprobados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="ds-readable-text px-4 py-8 text-center text-gray-500">
                        Aún no hay pagos aprobados.
                      </td>
                    </tr>
                  ) : (
                    data.enrollments.aprobados.map((e) => (
                      <tr key={e.id} className="bg-white dark:bg-gray-900">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {e.paidAt ? fmtDate(e.paidAt) : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {e.firstName} {e.lastName}
                        </td>
                        <td className="px-4 py-3">{e.email}</td>
                        <td className="px-4 py-3">{e.phone}</td>
                        <td className="px-4 py-3 tabular-nums">${e.amountArs.toLocaleString("es-AR")}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-gray-600">
                          {e.mpPaymentId ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {data.enrollments.cancelados.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cancelados / rechazados</h2>
              <div className="ds-table-scroll mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs font-semibold uppercase text-gray-600 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3">Actualizado</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.enrollments.cancelados.map((e) => (
                      <tr key={e.id} className="bg-white dark:bg-gray-900">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtDate(e.updatedAt)}</td>
                        <td className="px-4 py-3">
                          {e.firstName} {e.lastName}
                        </td>
                        <td className="px-4 py-3">{e.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <Link
            href="/admin/marketing/charlas"
            className="mt-10 inline-block text-sm font-medium text-[#c27b3d] hover:underline"
          >
            ← Volver a Charlas
          </Link>
        </>
      ) : null}
    </div>
  );
}
