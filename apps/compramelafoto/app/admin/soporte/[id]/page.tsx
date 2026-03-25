"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("es-AR");
}

export default function AdminSoporteDetallePage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = Number(params?.id);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const STATUS_OPTIONS = [
    { value: "OPEN", label: "Abierto" },
    { value: "IN_PROGRESS", label: "En progreso" },
    { value: "RESOLVED", label: "Resuelto" },
    { value: "CLOSED", label: "Finalizado" },
  ];

  useEffect(() => {
    if (!Number.isFinite(ticketId)) {
      setError("Ticket inválido");
      setLoading(false);
      return;
    }
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error cargando ticket");
      }
      setTicket(data.ticket);
    } catch (err: any) {
      setError(err?.message || "Error cargando ticket");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error actualizando estado");
      }
      setTicket((prev: any) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err: any) {
      setError(err?.message || "Error actualizando estado");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSendMessage(markAsResolved: boolean) {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, markAsResolved }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error enviando mensaje");
      }
      setMessage("");
      await loadTicket();
    } catch (err: any) {
      setError(err?.message || "Error enviando mensaje");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-[#6b7280]">Cargando ticket...</p>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-[#6b7280]">Ticket no encontrado.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket #{ticket.id}</h1>
          <p className="text-gray-600 mt-1">
            {ticket.reason} • {formatDate(ticket.createdAt)}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/admin/soporte")}>
          Volver
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-[#fee2e2] border border-[#fecaca]">
          <p className="text-[#991b1b] text-sm">{error}</p>
        </Card>
      )}

      <Card className="p-6 space-y-3">
        <div className="text-sm text-[#6b7280]">
          <span className="font-medium text-[#1a1a1a]">Estado:</span>{" "}
          {STATUS_OPTIONS.find((o) => o.value === ticket.status)?.label ?? ticket.status}
        </div>
        <div className="text-sm text-[#6b7280]">
          <span className="font-medium text-[#1a1a1a]">Solicitante:</span>{" "}
          {ticket.requesterName || "Sin nombre"} · {ticket.requesterEmail || "Sin email"}
        </div>
        {ticket.printOrder && (
          <div className="text-sm text-[#6b7280]">
            <span className="font-medium text-[#1a1a1a]">Pedido:</span> #{ticket.printOrder.id}
          </div>
        )}
        <div className="text-sm text-[#1a1a1a] whitespace-pre-wrap border-t border-[#e5e7eb] pt-4">
          {ticket.description}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Mensajes</h2>
        {ticket.messages?.length ? (
          <div className="space-y-4">
            {ticket.messages.map((msg: any) => (
              <div key={msg.id} className="rounded-lg border border-[#e5e7eb] p-4">
                <div className="flex items-center justify-between text-xs text-[#6b7280] mb-2">
                  <span>{msg.authorName || msg.authorEmail || "Sistema"}</span>
                  <span>{formatDate(msg.createdAt)}</span>
                </div>
                <div className="text-sm text-[#1a1a1a] whitespace-pre-wrap">{msg.message}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6b7280]">Sin mensajes todavía.</p>
        )}
        <div className="space-y-4 border-t border-[#e5e7eb] pt-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#1a1a1a]">Cambiar estado del incidente</label>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="rounded-md border border-[#d1d5db] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {updatingStatus && <span className="text-xs text-[#6b7280]">Actualizando...</span>}
              {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
                <span className="text-xs text-emerald-600 font-medium">Incidente finalizado</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#1a1a1a]">Responder</label>
            <textarea
              className="w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribí una respuesta para el usuario..."
            />
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => handleSendMessage(false)}
                disabled={sending}
              >
                {sending ? "Enviando..." : "Enviar mensaje"}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSendMessage(true)}
                disabled={sending}
              >
                {sending ? "Enviando..." : "Enviar y marcar como resuelto"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
