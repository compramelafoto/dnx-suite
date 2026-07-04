"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";

type UpsellStrategyStatus = "DRAFT" | "QA" | "BETA" | "APPROVED";

interface UpsellStrategyRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  status: UpsellStrategyStatus;
  enabledGlobally: boolean;
  requiresCapabilities: string[];
  requiresConfigKeys: string[];
  rolloutPercent: number;
  rolloutAllowlist: string[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<UpsellStrategyStatus, string> = {
  DRAFT: "Borrador",
  QA: "QA",
  BETA: "Beta",
  APPROVED: "Aprobada",
};

export default function AdminUpsellingPage() {
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<UpsellStrategyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStrategies();
  }, []);

  async function loadStrategies() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/upsell-strategies", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error al cargar estrategias");
        return;
      }
      const data = await res.json();
      setStrategies(data.strategies ?? []);
    } catch (err) {
      console.error("Error cargando estrategias de upsell:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upselling</h1>
      <p className="text-sm text-gray-600 mb-6">
        Estrategias de upsell de la plataforma. Los fotógrafos las ven en Configuración → Upselling según sus capabilities (Qué ofrecés). Para crear o editar estrategias usá el seed o migraciones.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando estrategias…</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">Slug</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Nombre</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Estado</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Activada</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Rollout %</th>
                  <th className="px-4 py-3 font-medium text-gray-700">Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {strategies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <p className="text-gray-600 mb-2">Aún no hay estrategias cargadas.</p>
                      <p className="text-sm text-gray-500">Para cargar las estrategias MVP, ejecutá en la terminal del proyecto:</p>
                      <code className="mt-2 inline-block bg-gray-100 px-2 py-1 rounded text-sm">npx ts-node scripts/seed-upsell-strategies.ts</code>
                      <p className="text-xs text-gray-400 mt-2">Si usás la base de producción, configurá <code className="bg-gray-100 px-1 rounded">DATABASE_URL</code> antes de ejecutar.</p>
                    </td>
                  </tr>
                ) : (
                  strategies.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-gray-800">{s.slug}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{s.name}</span>
                        {s.description && (
                          <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]" title={s.description}>
                            {s.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            s.status === "APPROVED"
                              ? "text-green-600"
                              : s.status === "BETA"
                                ? "text-blue-600"
                                : s.status === "QA"
                                  ? "text-amber-600"
                                  : "text-gray-500"
                          }
                        >
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.enabledGlobally ? (
                          <span className="text-green-600">Sí</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{s.rolloutPercent}%</td>
                      <td className="px-4 py-3 text-gray-600">
                        {(s.requiresCapabilities ?? []).length > 0
                          ? (s.requiresCapabilities ?? []).join(", ")
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
