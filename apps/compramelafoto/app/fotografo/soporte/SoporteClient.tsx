"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import { TERMS_TEXT } from "@/lib/terms/photographerTerms";
import { REFERRAL_TERMS_TEXT } from "@/lib/terms/referralTerms";
import { FAQ_CATEGORIES } from "@/components/FaqSection";
import TutorialCard from "@/components/tutorials/TutorialCard";
import { getSupportStatusLabel } from "@/lib/support-url";

const REASON_OPTIONS = [
  { value: "PAYMENT_FAILED", label: "Problema con el pago" },
  { value: "ORDER_STATUS", label: "Consulta sobre estado del pedido" },
  { value: "LAB_ISSUE", label: "Problema con el laboratorio" },
  { value: "COMMISSION_ISSUE", label: "Consulta sobre comisiones" },
  { value: "TECHNICAL_ISSUE", label: "Problema técnico" },
  { value: "OTHER", label: "Otro" },
];

const VALID_TABS = ["incidencias", "politicas", "tutoriales", "faqs"] as const;
type TabId = (typeof VALID_TABS)[number];

function useActiveTab() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const tab: TabId = (tabParam && VALID_TABS.includes(tabParam as TabId)) ? (tabParam as TabId) : "incidencias";
  return tab;
}

export default function SoporteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useActiveTab();

  // Asegurar que la URL tenga ?tab= para que el sidebar marque el ítem correcto (terminos legacy → politicas)
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "terminos") {
      router.replace("/fotografo/soporte?tab=politicas", { scroll: false });
      return;
    }
    if (!tab || !VALID_TABS.includes(tab as TabId)) {
      router.replace("/fotografo/soporte?tab=incidencias", { scroll: false });
    }
  }, [searchParams, router]);

  const [photographer, setPhotographer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [messageByTicket, setMessageByTicket] = useState<Record<number, string>>({});
  const [tutorials, setTutorials] = useState<{ title: string; description?: string; youtubeId: string; thumbnailUrl: string }[]>([]);
  const [tutorialsLoading, setTutorialsLoading] = useState(false);
  const [faqOpenCategory, setFaqOpenCategory] = useState<number | null>(null);
  const [faqOpenQuestion, setFaqOpenQuestion] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    printOrderId: "",
    reason: "",
    description: "",
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
  });

  useEffect(() => {
    if (activeTab === "incidencias") {
      fetch("/api/support/mark-read", { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/fotografo/login");
          return;
        }
        const data = await res.json();
        if (data.user?.role !== "PHOTOGRAPHER") {
          router.push("/fotografo/login");
          return;
        }
        setPhotographer(data.user);
        fetch(`/api/fotografo/${data.user.id}`)
          .then((r) => r.json())
          .then((info) => setPhotographer(info))
          .catch(() => {});
        setFormData((prev) => ({
          ...prev,
          requesterName: data.user.name || "",
          requesterEmail: data.user.email || "",
          requesterPhone: data.user.phone || "",
        }));
        const orderId = searchParams?.get("orderId") || "";
        if (orderId) setFormData((prev) => ({ ...prev, printOrderId: orderId }));
        fetch(`/api/fotografo/pedidos`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => { if (!d.error) setOrders(Array.isArray(d) ? d : (d.orders || [])); })
          .catch(() => {});
        loadTickets();
      } catch {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router, searchParams]);

  useEffect(() => {
    if (activeTab === "tutoriales") {
      setTutorialsLoading(true);
      fetch("/api/tutorials")
        .then((r) => r.json())
        .then((d) => setTutorials(Array.isArray(d?.items) ? d.items : []))
        .catch(() => setTutorials([]))
        .finally(() => setTutorialsLoading(false));
    }
  }, [activeTab]);

  async function loadTickets() {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch {
      setTickets([]);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Error");
      setMessageByTicket((prev) => ({ ...prev, [ticketId]: "" }));
      await loadTickets();
    } catch (err) {
      console.error(err);
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
          requesterRole: "PHOTOGRAPHER",
          printOrderId: formData.printOrderId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error creando ticket");
      setSuccess(true);
      setFormData({
        printOrderId: "",
        reason: "",
        description: "",
        requesterName: photographer?.name || "",
        requesterEmail: photographer?.email || "",
        requesterPhone: photographer?.phone || "",
      });
      setTimeout(() => router.push("/fotografo/soporte?tab=incidencias"), 2000);
    } catch (err: any) {
      setError(err?.message || "Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  }

  if (!photographer) {
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
          <div>
            <h1 className="text-3xl font-normal text-[#1a1a1a] mb-2">Soporte</h1>
            <p className="text-[#6b7280]">
              {activeTab === "incidencias" && "Contactá al equipo y revisá tus incidencias."}
              {activeTab === "politicas" && "Términos, condiciones y políticas para fotógrafos."}
              {activeTab === "tutoriales" && "Videos para aprender a usar la plataforma."}
              {activeTab === "faqs" && "Preguntas frecuentes."}
            </p>
          </div>

          {/* Incidencias */}
          {activeTab === "incidencias" && (
            <>
              {success ? (
                <Card className="p-6 text-center">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">¡Ticket creado exitosamente!</h2>
                  <p className="text-[#6b7280]">Te contactaremos pronto.</p>
                </Card>
              ) : (
                <Card className="p-6">
                  <h2 className="text-xl font-medium text-[#1a1a1a] mb-4">Contactar soporte</h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="p-4 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-[#991b1b]">{error}</div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Pedido relacionado (opcional)</label>
                      <Select value={formData.printOrderId} onChange={(e) => setFormData({ ...formData, printOrderId: e.target.value })}>
                        <option value="">Seleccionar pedido...</option>
                        {orders.map((order) => (
                          <option key={order.id} value={order.id}>Pedido #{order.id} - {order.createdAtText}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Motivo <span className="text-[#ef4444]">*</span></label>
                      <Select value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required>
                        <option value="">Seleccionar motivo...</option>
                        {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Descripción <span className="text-[#ef4444]">*</span></label>
                      <textarea
                        className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                        rows={6}
                        placeholder="Contanos en detalle..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit" variant="primary" disabled={loading} className="flex-1">
                        {loading ? "Enviando..." : "Enviar ticket"}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <Card className="p-6 space-y-4">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Mis incidencias</h2>
                {ticketsLoading ? (
                  <p className="text-sm text-[#6b7280]">Cargando...</p>
                ) : tickets.length === 0 ? (
                  <p className="text-sm text-[#6b7280]">Todavía no tenés incidencias abiertas.</p>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-lg border border-[#e5e7eb] p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[#1a1a1a]">Ticket #{ticket.id} · {ticket.reason}</span>
                          <span className="text-[#6b7280]">{getSupportStatusLabel(ticket.status)}</span>
                        </div>
                        <p className="text-sm text-[#1a1a1a] whitespace-pre-wrap">{ticket.description}</p>
                        {ticket.messages?.length > 0 && (
                          <div className="space-y-2 border-t border-[#e5e7eb] pt-3">
                            {ticket.messages.map((msg: any) => (
                              <div key={msg.id} className="text-sm">
                                <div className="text-xs text-[#6b7280] mb-1">
                                  {msg.authorName || msg.authorEmail || "Soporte"} · {new Date(msg.createdAt).toLocaleString("es-AR")}
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
                            onChange={(e) => setMessageByTicket((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                          />
                          <Button variant="secondary" onClick={() => sendMessage(ticket.id)}>Enviar mensaje</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Políticas: Términos + Programa de referidos */}
          {activeTab === "politicas" && (
            <div className="space-y-6">
              <Card className="space-y-4">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Términos y condiciones</h2>
                <p className="text-sm text-[#6b7280]">Vigentes para fotógrafos en ComprameLaFoto.</p>
                <pre className="whitespace-pre-wrap text-sm text-[#1a1a1a] bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[50vh] overflow-y-auto">
                  {TERMS_TEXT}
                </pre>
                <Link href="/terminos#fotografo" className="text-[#c27b3d] hover:underline text-sm">Ver en página completa →</Link>
              </Card>
              <Card className="space-y-4">
                <h2 className="text-xl font-medium text-[#1a1a1a]">Condiciones del programa de referidos</h2>
                <p className="text-sm text-[#6b7280]">Podés recomendar siendo fotógrafo, laboratorio, organizador o cliente; solo los fotógrafos referidos que venden generan comisión.</p>
                <pre className="whitespace-pre-wrap text-sm text-[#1a1a1a] bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {REFERRAL_TERMS_TEXT}
                </pre>
                <Link href="/fotografo/configuracion?tab=referidos" className="text-[#c27b3d] hover:underline text-sm">Ir a Referidos en Configuración →</Link>
              </Card>
            </div>
          )}

          {/* Tutoriales */}
          {activeTab === "tutoriales" && (
            <Card className="p-6">
              <h2 className="text-xl font-medium text-[#1a1a1a] mb-4">Tutoriales</h2>
              <p className="text-sm text-[#6b7280] mb-6">Videos para aprender a usar ComprameLaFoto.</p>
              {tutorialsLoading ? (
                <p className="text-[#6b7280]">Cargando tutoriales...</p>
              ) : tutorials.length === 0 ? (
                <p className="text-[#6b7280]">Todavía no hay tutoriales publicados.</p>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {tutorials.map((item, i) => (
                    <TutorialCard
                      key={`${item.youtubeId}-${i}`}
                      title={item.title}
                      description={item.description}
                      youtubeId={item.youtubeId}
                      thumbnailUrl={item.thumbnailUrl}
                    />
                  ))}
                </div>
              )}
              <div className="mt-6">
                <Link href="/tutoriales" className="text-[#c27b3d] hover:underline text-sm">Ver página de tutoriales →</Link>
              </div>
            </Card>
          )}

          {/* FAQs */}
          {activeTab === "faqs" && (
            <Card className="p-6">
              <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">Preguntas frecuentes</h2>
              <p className="text-sm text-[#6b7280] mb-6">Las mismas que en la página principal.</p>
              <div className="space-y-4">
                {FAQ_CATEGORIES.map((category, categoryIndex) => {
                  const isCategoryOpen = faqOpenCategory === categoryIndex;
                  return (
                    <div key={category.title} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-5 py-4 flex items-center justify-between font-semibold text-[#111827]"
                        onClick={() => {
                          setFaqOpenCategory(isCategoryOpen ? null : categoryIndex);
                          setFaqOpenQuestion(null);
                        }}
                      >
                        {category.title}
                        <span className="text-[#6b7280] text-xl">{isCategoryOpen ? "−" : "+"}</span>
                      </button>
                      {isCategoryOpen && (
                        <div className="px-5 pb-5 space-y-3">
                          {category.items.map((item, questionIndex) => {
                            const isQuestionOpen = faqOpenQuestion === questionIndex;
                            return (
                              <div key={questionIndex} className="border border-[#e5e7eb] rounded-xl">
                                <button
                                  type="button"
                                  className="w-full text-left px-4 py-3 flex items-center justify-between text-sm font-medium text-[#1a1a1a]"
                                  onClick={() => setFaqOpenQuestion(isQuestionOpen ? null : questionIndex)}
                                >
                                  {item.q}
                                  <span className="text-[#6b7280] text-lg">{isQuestionOpen ? "−" : "+"}</span>
                                </button>
                                {isQuestionOpen && (
                                  <div className="px-4 pb-4 text-sm text-[#4b5563]">{item.a}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-8 p-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg text-center">
                <p className="text-sm text-[#1a1a1a]">
                  ¿Te quedó alguna duda?{" "}
                  <Link href="/fotografo/soporte?tab=incidencias" className="text-[#c27b3d] font-semibold underline">
                    Escribinos (Incidencias)
                  </Link>
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
