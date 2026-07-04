"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { getSupportStatusLabel } from "@/lib/support-url";

const REASON_OPTIONS = [
  { value: "NO_DOWNLOAD", label: "No puedo descargar mis fotos" },
  { value: "PAYMENT_FAILED", label: "Problema con el pago" },
  { value: "PRINT_COMPLAINT", label: "Reclamo sobre impresión" },
  { value: "DELIVERY_ISSUE", label: "Problema con la entrega" },
  { value: "ORDER_STATUS", label: "Consulta sobre estado del pedido" },
  { value: "OTHER", label: "Otro" },
];

export default function SoporteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
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
    const saved = sessionStorage.getItem("client");
    if (!saved) {
      router.push("/login");
      return;
    }

    const clientData = JSON.parse(saved);
    setClient(clientData);

    // Obtener orderId de la URL si existe
    const orderId = searchParams?.get("orderId") || "";

    // Pre-llenar datos del cliente
    setFormData((prev) => ({
      ...prev,
      printOrderId: orderId,
      requesterName: clientData.name || "",
      requesterEmail: clientData.email || "",
      requesterPhone: clientData.phone || "",
    }));

    // Cargar pedidos del cliente
    fetch(`/api/cliente/pedidos?clientId=${clientData.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setOrders(data);
        }
      })
      .catch((err) => {
        console.error("Error cargando pedidos:", err);
      });

    loadTickets();
    fetch("/api/support/mark-read", { method: "POST", credentials: "include" }).catch(() => {});
  }, [router, searchParams]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          requesterRole: "CUSTOMER",
          printOrderId: formData.printOrderId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error creando ticket");
      }

      setSuccess(true);
      setFormData({
        printOrderId: "",
        reason: "",
        description: "",
        requesterName: client?.name || "",
        requesterEmail: client?.email || "",
        requesterPhone: client?.phone || "",
      });

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push("/cliente/pedidos");
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-normal text-[#1a1a1a] mb-2">
                Contactar Soporte
              </h1>
              <p className="text-[#6b7280]">
                Contanos qué problema tenés y te ayudamos a resolverlo.
              </p>
            </div>
            <Link href="/cliente/pedidos">
              <Button variant="secondary">Volver</Button>
            </Link>
          </div>

          {success ? (
            <Card className="p-6 text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-[#10b981]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">
                ¡Ticket creado exitosamente!
              </h2>
              <p className="text-[#6b7280]">
                Te contactaremos pronto. Redirigiendo a tus pedidos...
              </p>
            </Card>
          ) : (
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-[#991b1b]">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Pedido relacionado (opcional)
                  </label>
                  <Select
                    value={formData.printOrderId}
                    onChange={(e) =>
                      setFormData({ ...formData, printOrderId: e.target.value })
                    }
                  >
                    <option value="">Seleccionar pedido...</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        Pedido #{order.id} - {order.createdAtText} -{" "}
                        {order.total} {order.currency}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-[#6b7280] mt-1">
                    Si tu consulta está relacionada con un pedido específico,
                    seleccioná el pedido.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Motivo <span className="text-[#ef4444]">*</span>
                  </label>
                  <Select
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    required
                  >
                    <option value="">Seleccionar motivo...</option>
                    {REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Descripción <span className="text-[#ef4444]">*</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent transition-all duration-200"
                    rows={6}
                    placeholder="Contanos en detalle qué problema tenés..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Nombre
                  </label>
                  <Input
                    type="text"
                    value={formData.requesterName}
                    onChange={(e) =>
                      setFormData({ ...formData, requesterName: e.target.value })
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
                      setFormData({ ...formData, requesterEmail: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Teléfono
                  </label>
                  <Input
                    type="tel"
                    value={formData.requesterPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, requesterPhone: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? "Enviando..." : "Enviar ticket"}
                  </Button>
                  <Link href="/cliente/pedidos">
                    <Button type="button" variant="secondary">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </form>
            </Card>
          )}

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
  );
}
