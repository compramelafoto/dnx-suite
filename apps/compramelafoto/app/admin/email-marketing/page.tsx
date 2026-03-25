"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

type Campaign = {
  id: number;
  name: string;
  subject: string;
  status: string;
  createdAt: string;
  _count: { sends: number };
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SCHEDULED: "Programada",
  SENDING: "Enviando",
  SENT: "Enviada",
  PAUSED: "Pausada",
  CANCELED: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  SENDING: "bg-amber-100 text-amber-800",
  SENT: "bg-green-100 text-green-800",
  PAUSED: "bg-orange-100 text-orange-800",
  CANCELED: "bg-red-100 text-red-800",
};

export default function AdminEmailMarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/admin/email-campaigns${q}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
        <Link href="/admin/email-marketing/new">
          <Button>Nueva campaña</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando campañas...</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-600 mb-4">No hay campañas. Creá una para empezar.</p>
          <Link href="/admin/email-marketing/new">
            <Button>Crear campaña</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asunto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envíos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creada</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]">{c.subject}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c._count.sends}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(c.createdAt).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/email-marketing/${c.id}`} className="text-[#c27b3d] hover:underline text-sm font-medium">
                      Ver / Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
