"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

type RemovalRequest = {
  id: number;
  createdAt: string;
  decidedAt: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  reason: string;
  declarationOk: boolean;
  decisionNote: string | null;
  album: {
    id: number;
    title: string;
    publicSlug: string;
  };
  photo: {
    id: number;
    previewUrl: string;
    isRemoved: boolean;
  };
};

export default function FotografoRemocionesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photographerId, setPhotographerId] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [photographer, setPhotographer] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      setPhotographerId(session.photographerId);
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((photographerData) => {
          if (photographerData) {
            setPhotographer(photographerData);
          }
        })
        .catch(() => {});
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!photographerId) return;
    loadRequests();
  }, [photographerId, filterStatus, searchQuery]);

  async function loadRequests() {
    if (!photographerId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        photographerId: photographerId.toString(),
        status: filterStatus,
      });
      if (searchQuery.trim()) {
        params.append("query", searchQuery.trim());
      }
      const res = await fetch(`/api/dashboard/removal-requests?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error cargando solicitudes");
      }
      setRequests(data);
      // Calcular cantidad de solicitudes pendientes
      const pending = Array.isArray(data) ? data.filter((r: RemovalRequest) => r.status === "PENDING").length : 0;
      setPendingCount(pending);
    } catch (err: any) {
      setError(err?.message || "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(requestId: number, action: "APPROVE" | "REJECT", note?: string) {
    if (!photographerId) return;
    setProcessingId(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/removal-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          decisionNote: note || null,
          photographerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error procesando la solicitud");
      }
      // Recargar solicitudes
      await loadRequests();
      // Notificar a otras páginas que el conteo cambió (usando evento personalizado)
      window.dispatchEvent(new CustomEvent('removalRequestUpdated'));
    } catch (err: any) {
      setError(err?.message || "Error procesando la solicitud");
    } finally {
      setProcessingId(null);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusBadge(status: string) {
    const styles = {
      PENDING: "bg-amber-100 text-amber-800 border-amber-200",
      APPROVED: "bg-green-100 text-green-800 border-green-200",
      REJECTED: "bg-red-100 text-red-800 border-red-200",
    };
    const labels = {
      PENDING: "Pendiente",
      APPROVED: "Aprobada",
      REJECTED: "Rechazada",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  }

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando solicitudes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                Solicitudes de baja
              </h1>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-400 rounded-lg shadow-sm animate-pulse">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-red-700 font-bold text-base">
                    {pendingCount} {pendingCount === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} requieren atención
                  </span>
                </div>
              )}
            </div>
            {pendingCount > 0 ? (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-red-800 font-semibold text-base mb-1">
                      Atención requerida
                    </p>
                    <p className="text-red-700 text-sm">
                      Tenés <strong>{pendingCount}</strong> {pendingCount === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} que requieren tu revisión y decisión.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">
                Gestioná las solicitudes de remoción de fotografías recibidas
              </p>
            )}
          </div>

          {error && (
            <div className="p-4 bg-[#fee2e2] border border-[#fecaca] rounded-lg">
              <p className="text-sm text-[#dc2626]">{error}</p>
            </div>
          )}

          {/* Filtros */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Estado
                </label>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="ALL">Todas</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="APPROVED">Aprobadas</option>
                  <option value="REJECTED">Rechazadas</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Buscar (nombre, email, teléfono)
                </label>
                <Input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Tabla de solicitudes */}
          {requests.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[#6b7280]">
                {filterStatus !== "ALL" || searchQuery.trim()
                  ? "No se encontraron solicitudes con los filtros aplicados"
                  : "No hay solicitudes de remoción"}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Miniatura */}
                    <div className="md:col-span-2">
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[#f3f4f6]">
                        <img
                          src={request.photo.previewUrl}
                          alt={`Foto ${request.photo.id}`}
                          className="w-full h-full object-contain"
                        />
                        {request.photo.isRemoved && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <span className="text-xs font-medium text-red-800 bg-white px-2 py-1 rounded">
                              Removida
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Información */}
                    <div className="md:col-span-7 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-[#1a1a1a] mb-1">
                            {request.requesterName}
                          </h3>
                          <p className="text-sm text-[#6b7280]">
                            {request.requesterEmail}
                          </p>
                          <p className="text-sm text-[#6b7280]">
                            📱 {request.requesterPhone}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(request.status)}
                          <span className="text-xs text-[#6b7280]">
                            {formatDate(request.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-[#6b7280]">
                        <p>
                          <strong>Álbum:</strong> {request.album.title}
                        </p>
                        <p>
                          <strong>Foto ID:</strong> {request.photo.id}
                        </p>
                      </div>

                      <div className="mt-2">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-[#c27b3d] hover:text-[#a0652d] font-medium">
                            Ver motivo de la solicitud
                          </summary>
                          <p className="mt-2 text-[#6b7280] whitespace-pre-wrap">
                            {request.reason}
                          </p>
                        </details>
                      </div>

                      {request.decisionNote && (
                        <div className="mt-2 p-2 bg-[#f3f4f6] rounded text-sm">
                          <strong className="text-[#1a1a1a]">Nota de decisión:</strong>{" "}
                          <span className="text-[#6b7280]">{request.decisionNote}</span>
                        </div>
                      )}

                      {request.decidedAt && (
                        <p className="text-xs text-[#6b7280]">
                          Decidida el: {formatDate(request.decidedAt)}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="md:col-span-3 flex flex-col gap-2">
                      {request.status === "PENDING" && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => {
                              const note = prompt("Nota opcional (presiona Cancelar para omitir):");
                              if (note !== null) {
                                handleDecision(request.id, "APPROVE", note || undefined);
                              }
                            }}
                            disabled={processingId === request.id}
                            className="w-full"
                          >
                            {processingId === request.id ? "Procesando..." : "Aprobar y Eliminar"}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const note = prompt("Nota opcional (presiona Cancelar para omitir):");
                              if (note !== null) {
                                handleDecision(request.id, "REJECT", note || undefined);
                              }
                            }}
                            disabled={processingId === request.id}
                            className="w-full"
                          >
                            {processingId === request.id ? "Procesando..." : "Rechazar"}
                          </Button>
                        </>
                      )}
                      {request.status !== "PENDING" && (
                        <p className="text-xs text-[#6b7280] text-center">
                          Esta solicitud ya fue procesada
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
