"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";

type LabRecommendationRow = {
  id: number;
  photographerName: string;
  labName: string;
  labEmail: string;
  labWhatsapp: string | null;
  createdAt: string;
  emailSentAt: string | null;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(s);
  }
}

export default function AdminRecomendadosPage() {
  const [list, setList] = useState<LabRecommendationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/recommended-labs", { cache: "no-store" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Error cargando lista");
        }
        const data = await res.json();
        setList(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "Error cargando laboratorios recomendados");
        setList([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
        Laboratorios recomendados
      </h1>
      <p className="text-[#6b7280] mb-6">
        Listado de laboratorios que fotógrafos o visitantes recomendaron desde el formulario. Al enviar el formulario se guarda aquí y se envía un email al laboratorio invitándolo a sumarse.
      </p>

      {loading ? (
        <p className="text-[#6b7280]">Cargando…</p>
      ) : error ? (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-700">{error}</p>
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-6 text-center text-[#6b7280]">
          No hay recomendaciones todavía.
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#e5e7eb]">
            <thead>
              <tr className="bg-[#f9fafb]">
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">ID</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">Fotógrafo</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">Laboratorio</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">Email</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">WhatsApp</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">Fecha</th>
                <th className="text-left p-3 border-b border-[#e5e7eb] font-semibold text-[#374151]">Email enviado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} className="border-b border-[#e5e7eb] hover:bg-[#f9fafb]">
                  <td className="p-3 text-[#374151]">#{row.id}</td>
                  <td className="p-3 text-[#374151]">{row.photographerName}</td>
                  <td className="p-3 text-[#374151]">{row.labName}</td>
                  <td className="p-3 text-[#374151]">
                    <a href={`mailto:${row.labEmail}`} className="text-[#2563eb] hover:underline">
                      {row.labEmail}
                    </a>
                  </td>
                  <td className="p-3 text-[#374151]">{row.labWhatsapp || "—"}</td>
                  <td className="p-3 text-[#6b7280] text-sm">{formatDate(row.createdAt)}</td>
                  <td className="p-3 text-[#6b7280] text-sm">
                    {row.emailSentAt ? formatDate(row.emailSentAt) : "—"}
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
