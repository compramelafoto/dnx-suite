"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import LabHeader from "@/components/lab/LabDashboardHeader";
import { ensureLabSession } from "@/lib/lab-session-client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { getSupportStatusLabel } from "@/lib/support-url";

const REASON_OPTIONS = [
  { value: "ORDER_STATUS", label: "Consulta sobre estado del pedido" },
  { value: "PAYMENT_FAILED", label: "Problema con el pago" },
  { value: "TECHNICAL_ISSUE", label: "Problema técnico" },
  { value: "COMMISSION_ISSUE", label: "Consulta sobre comisiones" },
  { value: "OTHER", label: "Otro" },
];

export default function LabSoportePage() {
  const router = useRouter();
  const [labId, setLabId] = useState<number | null>(null);
  const [lab, setLab] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [messageByTicket, setMessageByTicket] = useState<Record<number, string>>({});

  const [formData, setFormData] = useState({
    printOrderId: "",
    reason: "",
    description: "",
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
  });

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      setLabId(session.labId);
      try {
        const res = await fetch(`/api/lab/${session.labId}`);
        if (res.ok) {
          const data = await res.json();
          setLab({
            id: data.id,
            name: data.name,
            logoUrl: data.logoUrl,
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            email: data.email,
            phone: data.phone,
          });
          setFormData((prev) => ({
            ...prev,
            requesterName: data.name || "",
            requesterEmail: data.email || "",
            requesterPhone: data.phone || "",
          }));
        }
      } catch {
        // Ignorar errores de carga de lab
      } finally {
        setAuthLoading(false);
        loadTickets();
        fetch("/api/support/mark-read", { method: "POST", credentials: "include" }).catch(() => {});
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LabHeader lab={lab} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets", {
        credentials: "include",
      });
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
          requesterRole: "LAB",
          printOrderId: formData.printOrderId || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error creando ticket");
      }

      setSuccess(true);
      setFormData((prev) => ({
        ...prev,
        printOrderId: "",
        reason: "",
        description: "",
      }));
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || "Error al crear el ticket");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-2">
                Soporte
              </h1>
              <p className="text-[#6b7280] text-lg">
                Comunicate con el equipo de administración y creá tickets de soporte
              </p>
            </div>

            <Card className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-[#991b1b]">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-[#dcfce7] border border-[#86efac] rounded-lg text-[#166534]">
                  Ticket creado correctamente. Te responderemos por este canal.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Pedido relacionado (opcional)
                  </label>
                  <Input
                    type="text"
                    placeholder="ID de pedido"
                    value={formData.printOrderId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, printOrderId: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Motivo
                  </label>
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
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Descripción
                  </label>
                  <textarea
                    className="w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
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
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Nombre de contacto
                    </label>
                    <Input
                      type="text"
                      value={formData.requesterName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, requesterName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.requesterEmail}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, requesterEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Teléfono
                    </label>
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
              <h2 className="text-xl font-medium text-[#1a1a1a]">Políticas</h2>
              <p className="text-sm text-[#6b7280]">
                Términos y condiciones vigentes para laboratorios en ComprameLaFoto.
              </p>
              <Link
                href="/terminos#laboratorio"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#3b82f6] hover:underline"
              >
                Ver Términos y condiciones (laboratorio) →
              </Link>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-xl font-medium text-[#1a1a1a]">Mis incidencias</h2>
              {ticketsLoading ? (
                <p className="text-sm text-[#6b7280]">Cargando tickets...</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-[#6b7280]">Todavía no tenés incidencias abiertas.</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-lg border border-[#e5e7eb] p-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-[#1a1a1a]">
                          Ticket #{ticket.id} · {ticket.reason}
                        </span>
                        <span className="text-[#6b7280]">{getSupportStatusLabel(ticket.status)}</span>
                      </div>
                      <p className="text-sm text-[#1a1a1a] whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                      {ticket.messages?.length > 0 && (
                        <div className="space-y-2 border-t border-[#e5e7eb] pt-3">
                          {ticket.messages.map((msg: any) => (
                            <div key={msg.id} className="text-sm">
                              <div className="text-xs text-[#6b7280] mb-1">
                                {msg.authorName || msg.authorEmail || "Soporte"} ·{" "}
                                {new Date(msg.createdAt).toLocaleString("es-AR")}
                              </div>
                              <div className="text-[#1a1a1a] whitespace-pre-wrap">{msg.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        <textarea
                          className="w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
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
          </div>
        </div>
      </section>
    </div>
  );
}
