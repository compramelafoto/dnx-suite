import Link from "next/link";

import { listDailyReportSnapshots } from "@repo/db/daily-report-repository";

import { prisma } from "@/lib/prisma";
import { formatReportDate } from "@/lib/daily-report/render-blocks";

export const dynamic = "force-dynamic";

const STATUS_PRESENTATION = {
  COMPLETE: { label: "Completo", className: "bg-emerald-100 text-emerald-800" },
  PARTIAL: { label: "Parcial", className: "bg-amber-100 text-amber-800" },
  FAILED: { label: "Fallido", className: "bg-red-100 text-red-800" },
} as const;

export default async function InformeDiarioPage() {
  const snapshots = await listDailyReportSnapshots(prisma, 60);

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0">Informe diario</h1>
        <p className="text-gray-600 mt-1 m-0">
          Estadísticas de todas las plataformas, generadas cada noche a las 00:00 de Argentina y
          enviadas por correo.
        </p>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
          Todavía no se generó ningún informe. El primero llega esta noche a las 00:00.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Día</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Alertas críticas</th>
                <th className="px-4 py-3 font-medium">Secciones caídas</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map((snapshot) => {
                const presentation = STATUS_PRESENTATION[snapshot.status];
                return (
                  <tr key={snapshot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatReportDate(snapshot.reportDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${presentation.className}`}
                      >
                        {presentation.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {snapshot.criticalAlerts > 0 ? (
                        <span className="font-semibold text-red-700">
                          {snapshot.criticalAlerts}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {snapshot.failedSections.length === 0
                        ? "—"
                        : snapshot.failedSections.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/informe-diario/${snapshot.reportDate}`}
                        className="text-[#c27b3d] underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
