"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

type Order = {
  id: number;
  buyerEmail: string;
  buyerName: string | null;
  buyerPhone: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
  album: { id: number; title: string; publicSlug: string; school: { id: number; name: string } | null };
  schoolCourse: { id: number; name: string; division: string | null } | null;
};

export default function FotografoEscuelasPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);
  const [filterSchool, setFilterSchool] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
      const schoolsRes = await fetch("/api/fotografo/schools", { credentials: "include" });
      if (schoolsRes.ok) {
        const data = await schoolsRes.json();
        setSchools(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : []);
      }
      if (active) setLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterSchool) params.set("schoolId", filterSchool);
    if (filterStatus) params.set("status", filterStatus);
    fetch(`/api/fotografo/school-orders?${params}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOrders(Array.isArray(data) ? data : []));
  }, [filterSchool, filterStatus]);

  const formatARS = (cents: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(cents / 100);

  const statusLabel: Record<string, string> = {
    CREATED: "Pendiente pago",
    PAID_HELD: "Pagado",
    CANCELED: "Cancelado",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Pedidos escolares
              </h1>
              <p className="text-gray-600">
                Pedidos de pre-venta con datos de adulto y alumno
              </p>
            </div>
            <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
              ← Volver a escuelas
            </Link>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Escuela</label>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todas</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Todos</option>
                <option value="CREATED">Pendiente pago</option>
                <option value="PAID_HELD">Pagado</option>
                <option value="CANCELED">Cancelado</option>
              </select>
            </div>
          </div>

          {orders.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">No hay pedidos escolares que coincidan con los filtros.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-3 font-medium">Fecha</th>
                    <th className="text-left py-3 px-3 font-medium">Escuela</th>
                    <th className="text-left py-3 px-3 font-medium">Álbum</th>
                    <th className="text-left py-3 px-3 font-medium">Adulto</th>
                    <th className="text-left py-3 px-3 font-medium">Email</th>
                    <th className="text-left py-3 px-3 font-medium">Teléfono</th>
                    <th className="text-left py-3 px-3 font-medium">Alumno</th>
                    <th className="text-left py-3 px-3 font-medium">Curso</th>
                    <th className="text-right py-3 px-3 font-medium">Total</th>
                    <th className="text-left py-3 px-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        {new Date(o.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3">{o.album?.school?.name ?? "—"}</td>
                      <td className="py-3 px-3">
                        <Link href={`/dashboard/albums/${o.album?.id}`} className="text-[#c27b3d] hover:underline">
                          {o.album?.title ?? "—"}
                        </Link>
                      </td>
                      <td className="py-3 px-3">{o.buyerName ?? "—"}</td>
                      <td className="py-3 px-3">{o.buyerEmail}</td>
                      <td className="py-3 px-3">{o.buyerPhone ?? "—"}</td>
                      <td className="py-3 px-3">
                        {[o.studentFirstName, o.studentLastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-3 px-3">
                        {o.schoolCourse
                          ? `${o.schoolCourse.name}${o.schoolCourse.division ? ` ${o.schoolCourse.division}` : ""}`
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right">{formatARS(o.totalCents)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            o.status === "PAID_HELD"
                              ? "bg-green-100 text-green-800"
                              : o.status === "CANCELED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {statusLabel[o.status] ?? o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
