"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { getSupportStatusLabel } from "@/lib/support-url";

const REASON_OPTIONS = [
  { value: "EVENT_ISSUE", label: "Consulta sobre eventos" },
  { value: "TECHNICAL_ISSUE", label: "Problema técnico" },
  { value: "OTHER", label: "Otro" },
];

export default function OrganizadorSoportePage() {
  const router = useRouter();
  const [organizer, setOrganizer] = useState<{ organizerId: number; name?: string | null; email?: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [messageByTicket, setMessageByTicket] = useState<Record<number, string>>({});

  const [formData, setFormData] = useState({
    reason: "",
    description: "",
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
  });

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/organizer/me", { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/");
            return;
          }
        } else {
          const data = await res.json();
          setOrganizer({
            organizerId: data.id ?? 0,
            name: data.name,
            email: data.email,
          });
          setFormData((prev) => ({
            ...prev,
            requesterName: data.name || "",
            requesterEmail: data.email || "",
          }));
        }
      } catch {
        // ignore
      } finally {
        setAuthLoading(false);
        loadTickets();
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      }
    } catch (err) {
      console.error("Error cargando tickets:", err);
    } finally {
      setTicketsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          requesterRole: "ORGANIZER",
          printOrderId: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error creando ticket");
      }
      setSuccess(true);
      setFormData((prev) => ({
        ...prev,
        reason: "",
        description: "",
      }));
      await loadTickets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(ticketId: number) {
    const message = (messageByTicket[ticketId] || "").trim();
    if (!message) return;
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error enviando mensaje");
      }
      setMessageByTicket((prev) => ({ ...prev, [ticketId]: "" }));
      await loadTickets();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganizerHeader organizer={organizer} />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OrganizerHeader organizer={organizer} />
      <section className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Soporte</h1>
          <p className="text-gray-600">Comunicate con el equipo y creá tickets de soporte</p>
        </div>

        <Card className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
          )}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              Ticket creado correctamente. Te responderemos por este canal.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Motivo</label>
              <Select
                value={formData.reason}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reason: e.target.value }))
                }
              >
                <option value="">Seleccionar motivo...</option>
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Descripción</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                rows={5}
                placeholder="Contanos qué pasó y cómo podemos ayudarte."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Nombre</label>
                <Input
                  type="text"
                  value={formData.requesterName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requesterName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.requesterEmail}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requesterEmail: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Teléfono</label>
                <Input
                  type="text"
                  value={formData.requesterPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requesterPhone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? "Enviando..." : "Crear ticket"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-medium text-gray-900">Mis incidencias</h2>
          {ticketsLoading ? (
            <p className="text-sm text-gray-600">Cargando tickets...</p>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-gray-600">Todavía no tenés incidencias abiertas.</p>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket: any) => (
                <div key={ticket.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      Ticket #{ticket.id} · {ticket.reason}
                    </span>
                    <span className="text-gray-500">{getSupportStatusLabel(ticket.status)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                  {ticket.messages?.length > 0 && (
                    <div className="space-y-2 border-t border-gray-200 pt-3">
                      {ticket.messages.map((msg: any) => (
                        <div key={msg.id} className="text-sm">
                          <div className="text-xs text-gray-500 mb-1">
                            {msg.authorName || msg.authorEmail || "Soporte"} ·{" "}
                            {new Date(msg.createdAt).toLocaleString("es-AR")}
                          </div>
                          <div className="text-gray-700 whitespace-pre-wrap">{msg.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                      rows={3}
                      placeholder="Escribí una respuesta..."
                      value={messageByTicket[ticket.id] || ""}
                      onChange={(e) =>
                        setMessageByTicket((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                    />
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => sendMessage(ticket.id)}>
                        Enviar mensaje
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
