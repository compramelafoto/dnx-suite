"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import {
  labelPreCompraOrderStatus,
} from "@/lib/preventa-canjeable/preventa-status-labels";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

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
  items?: Array<{
    id: number;
    status: string;
    designProjectId: number | null;
    designProjectStatus: string | null;
  }>;
};

function labelEntregaFisica(status: string): string | null {
  if (status === "EXPORTED") return "Listo para impresión";
  if (status === "PHYSICAL_IN_PROGRESS") return "En impresión";
  if (status === "AT_SCHOOL") return "En la escuela";
  if (status === "DELIVERED") return "Entregado";
  return null;
}

export default function FotografoEscuelasPedidosPage() {
  const router = useRouter();
  const uxV2 = isPreventaUxV2EnabledClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);
  const [filterSchool, setFilterSchool] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  /** Tras POST exitoso, evita refetch: muestra 1 diseño + link con este id */
  const [localDesignProjectByOrderId, setLocalDesignProjectByOrderId] = useState<Record<number, number>>({});
  const [generateLoadingByOrderId, setGenerateLoadingByOrderId] = useState<Record<number, boolean>>({});
  /** POST cadena física (start / mark-at-school / mark-delivered) por pedido */
  const [physicalActionLoadingByOrderId, setPhysicalActionLoadingByOrderId] = useState<Record<number, boolean>>({});
  /** Tras POST exitoso: estado del primer ítem sin refetch */
  const [localItemStatusByItemId, setLocalItemStatusByItemId] = useState<Record<number, string>>({});

  async function handlePhysicalChain(
    orderId: number,
    itemId: number,
    pathSegment: "start-physical-fulfillment" | "mark-at-school" | "mark-delivered",
    nextStatus: "PHYSICAL_IN_PROGRESS" | "AT_SCHOOL" | "DELIVERED",
    genericError: string
  ) {
    setPhysicalActionLoadingByOrderId((s) => ({ ...s, [orderId]: true }));
    try {
      const res = await fetch(`/api/fotografo/school-order-items/${itemId}/${pathSegment}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok === true) {
        setLocalItemStatusByItemId((s) => ({ ...s, [itemId]: nextStatus }));
        return;
      }
      const msg =
        (typeof data.message === "string" && data.message.trim() !== "")
          ? data.message
          : (typeof data.reason === "string" && data.reason.trim() !== "")
            ? data.reason
            : (typeof data.error === "string" && data.error.trim() !== "")
              ? data.error
              : !res.ok
                ? `Error (${res.status})`
                : genericError;
      alert(msg);
    } catch {
      alert("Error de red");
    } finally {
      setPhysicalActionLoadingByOrderId((s) => ({ ...s, [orderId]: false }));
    }
  }

  async function handleGenerateDesign(orderId: number, itemId: number) {
    setGenerateLoadingByOrderId((s) => ({ ...s, [orderId]: true }));
    try {
      const res = await fetch(`/api/fotografo/school-order-items/${itemId}/generate-design`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok === true && data.outcome === "created" && typeof data.designProjectId === "number") {
        setLocalDesignProjectByOrderId((s) => ({ ...s, [orderId]: data.designProjectId }));
        return;
      }

      const msg =
        (typeof data.message === "string" && data.message.trim() !== "")
          ? data.message
          : (typeof data.reason === "string" && data.reason.trim() !== "")
            ? data.reason
            : (typeof data.error === "string" && data.error.trim() !== "")
              ? data.error
              : !res.ok
                ? `Error (${res.status})`
                : "No se pudo generar el diseño";
      alert(msg);
    } catch {
      alert("Error de red");
    } finally {
      setGenerateLoadingByOrderId((s) => ({ ...s, [orderId]: false }));
    }
  }

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
      <DsPageShell className="py-8">
        <DsDashboardInner className="space-y-6">
          <div className="ds-split-panel sm:items-start sm:justify-between">
            <div className="ds-split-panel__main">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Pedidos escolares
              </h1>
              <p className="ds-readable-text ds-readable-text--fluid text-gray-600">
                {uxV2
                  ? "Pedidos de preventa escolar con datos de adulto y alumno"
                  : "Pedidos de pre-venta con datos de adulto y alumno"}
              </p>
            </div>
            <div className="ds-split-panel__aside shrink-0">
            <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
              ← Volver a Escolar
            </Link>
            </div>
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
            <Card className="overflow-hidden p-0">
              <DsEmptyState variant="tight">
                {uxV2
                  ? "Todavía no hay pedidos de preventa escolar con estos filtros. Cuando las familias compren, los verás acá."
                  : "No hay pedidos escolares que coincidan con los filtros."}
              </DsEmptyState>
            </Card>
          ) : (
            <div className="ds-table-scroll rounded-xl border border-gray-100">
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
                    <th className="text-left py-3 px-3 font-medium">Diseño</th>
                    <th className="text-left py-3 px-3 font-medium">Estado</th>
                    <th className="text-left py-3 px-3 font-medium">Etiquetas</th>
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
                      <td className="py-3 px-3 align-top">
                        {(() => {
                          const items = o.items ?? [];
                          const designIds = items
                            .map((i) => i.designProjectId)
                            .filter((id): id is number => id != null);
                          const localPid = localDesignProjectByOrderId[o.id];
                          const uniqueDesignIds = [...new Set(
                            localPid != null ? [...designIds, localPid] : designIds
                          )];
                          if (uniqueDesignIds.length === 0) {
                            const firstItem = items[0];
                            const loading = generateLoadingByOrderId[o.id];
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-gray-600">Sin diseños</span>
                                {loading ? (
                                  <span className="text-gray-500 text-xs">Generando...</span>
                                ) : firstItem ? (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateDesign(o.id, firstItem.id)}
                                    className="text-left text-[#c27b3d] hover:underline text-xs"
                                  >
                                    Generar diseño
                                  </button>
                                ) : null}
                              </div>
                            );
                          }
                          if (uniqueDesignIds.length === 1) {
                            const pid = uniqueDesignIds[0];
                            const firstItem = items[0];
                            const effectiveFirstItemStatus =
                              firstItem != null && localItemStatusByItemId[firstItem.id] != null
                                ? localItemStatusByItemId[firstItem.id]!
                                : firstItem?.status ?? "";
                            const physicalLoading = physicalActionLoadingByOrderId[o.id] === true;
                            const chain = effectiveFirstItemStatus;
                            const entregaTexto = labelEntregaFisica(chain);
                            const showPhysical =
                              firstItem != null &&
                              (chain === "EXPORTED" ||
                                chain === "PHYSICAL_IN_PROGRESS" ||
                                chain === "AT_SCHOOL" ||
                                chain === "DELIVERED");
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-gray-800">1 diseño</span>
                                {entregaTexto ? (
                                  <span className="text-xs text-gray-700">Entrega: {entregaTexto}</span>
                                ) : null}
                                <Link
                                  href={`/dashboard/design-projects/${pid}`}
                                  className="text-[#c27b3d] hover:underline text-xs"
                                >
                                  Abrir diseño
                                </Link>
                                {showPhysical ? (
                                  <>
                                    {chain === "EXPORTED" ? (
                                      <button
                                        type="button"
                                        disabled={physicalLoading}
                                        onClick={() =>
                                          handlePhysicalChain(
                                            o.id,
                                            firstItem.id,
                                            "start-physical-fulfillment",
                                            "PHYSICAL_IN_PROGRESS",
                                            "No se pudo iniciar la impresión"
                                          )
                                        }
                                        className="text-left text-[#c27b3d] hover:underline text-xs disabled:opacity-60 disabled:no-underline"
                                      >
                                        {physicalLoading ? "Iniciando..." : "Iniciar impresión"}
                                      </button>
                                    ) : null}
                                    {chain === "PHYSICAL_IN_PROGRESS" ? (
                                      <>
                                        <span className="text-xs text-emerald-700">En impresión</span>
                                        <button
                                          type="button"
                                          disabled={physicalLoading}
                                          onClick={() =>
                                            handlePhysicalChain(
                                              o.id,
                                              firstItem.id,
                                              "mark-at-school",
                                              "AT_SCHOOL",
                                              "No se pudo marcar como en escuela"
                                            )
                                          }
                                          className="text-left text-[#c27b3d] hover:underline text-xs disabled:opacity-60 disabled:no-underline"
                                        >
                                          {physicalLoading ? "Marcando..." : "Marcar en escuela"}
                                        </button>
                                      </>
                                    ) : null}
                                    {chain === "AT_SCHOOL" ? (
                                      <>
                                        <span className="text-xs text-sky-800">En escuela</span>
                                        <button
                                          type="button"
                                          disabled={physicalLoading}
                                          onClick={() =>
                                            handlePhysicalChain(
                                              o.id,
                                              firstItem.id,
                                              "mark-delivered",
                                              "DELIVERED",
                                              "No se pudo marcar como entregado"
                                            )
                                          }
                                          className="text-left text-[#c27b3d] hover:underline text-xs disabled:opacity-60 disabled:no-underline"
                                        >
                                          {physicalLoading ? "Marcando..." : "Marcar entregado"}
                                        </button>
                                      </>
                                    ) : null}
                                    {chain === "DELIVERED" ? (
                                      <span className="text-xs text-gray-700">Entregado</span>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-gray-800">
                                {uniqueDesignIds.length} diseños
                              </span>
                              <Link
                                href="/dashboard/design-projects"
                                className="text-[#c27b3d] hover:underline text-xs"
                              >
                                Ver diseños
                              </Link>
                            </div>
                          );
                        })()}
                      </td>
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
                          {uxV2
                            ? labelPreCompraOrderStatus(o.status)
                            : statusLabel[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <a
                          href={`/api/fotografo/escuelas/pedidos/${o.id}/labels`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#c27b3d] hover:underline text-xs"
                        >
                          Imprimir etiquetas
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
