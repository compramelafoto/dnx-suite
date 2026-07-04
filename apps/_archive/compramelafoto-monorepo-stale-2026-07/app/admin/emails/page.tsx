"use client";

import { useEffect, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type SentLog = {
  id: number;
  to: string;
  subject: string;
  templateKey: string;
  status: string;
  error?: string | null;
  createdAt: string;
};

type ContactItem = {
  type: string;
  id: number;
  email: string;
  name?: string | null;
  meta?: string | null;
};

type AlertItem = {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
};

type EmailTemplateItem = {
  id: number;
  key: string;
  name: string;
  subject: string;
  variables: string[];
};

type OrderOption = {
  id: number;
  type: "ALBUM" | "PRINT";
  label: string;
};

const tabs = [
  { id: "sent", label: "Enviados" },
  { id: "compose", label: "Redactar" },
  { id: "contacts", label: "Contactos" },
  { id: "alerts", label: "Alertas" },
  { id: "test", label: "Probar templates" },
];

export default function AdminEmailsPage() {
  const [activeTab, setActiveTab] = useState("sent");

  const [sentLogs, setSentLogs] = useState<SentLog[]>([]);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentLoading, setSentLoading] = useState(false);

  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeStatus, setComposeStatus] = useState<string | null>(null);

  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [templateDataJson, setTemplateDataJson] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrderType, setSelectedOrderType] = useState<"ALBUM" | "PRINT" | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "sent") return;
    loadSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sentPage]);

  useEffect(() => {
    if (activeTab !== "alerts") return;
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "test") {
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadSent() {
    setSentLoading(true);
    try {
      const res = await fetch(`/api/admin/emails/sent?page=${sentPage}&pageSize=20`);
      const data = await res.json();
      setSentLogs(data.items || []);
      setSentTotal(data.total || 0);
    } finally {
      setSentLoading(false);
    }
  }

  async function loadAlerts() {
    setAlertsLoading(true);
    try {
      const res = await fetch("/api/admin/emails/alerts?status=all");
      const data = await res.json();
      setAlerts(data.items || []);
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setComposeStatus(null);
    const res = await fetch("/api/admin/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      }),
    });
    if (res.ok) {
      setComposeStatus("Email enviado.");
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      if (activeTab === "sent") loadSent();
    } else {
      const data = await res.json().catch(() => ({}));
      setComposeStatus(data?.error || "No se pudo enviar el email.");
    }
  }

  async function handleSearchContacts(e: React.FormEvent) {
    e.preventDefault();
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/admin/emails/contacts?q=${encodeURIComponent(contactQuery)}`);
      const data = await res.json();
      setContacts(data.items || []);
    } finally {
      setContactsLoading(false);
    }
  }

  async function markAlertRead(id: number) {
    await fetch(`/api/admin/emails/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    loadAlerts();
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/admin/emails/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
      if (!selectedTemplate && data.templates?.length) {
        setSelectedTemplate(data.templates[0].key);
      }
    } catch (err) {
      console.error("Error cargando templates", err);
    }
  }

  async function loadOrders() {
    const q = orderQuery.trim();
    try {
      const res = await fetch(`/api/admin/emails/orders?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Status ${res.status}`);
      }
      const text = await res.text();
      let data: { orders?: OrderOption[] } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          console.warn("No se pudo parsear la respuesta de pedidos", text);
        }
      }
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Error cargando pedidos", err);
    }
  }

  async function handleTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || !recipientEmail) {
      setTestStatus("Completa template y email destinatario.");
      return;
    }
    setTestLoading(true);
    setTestStatus(null);
    try {
      const body: Record<string, any> = {
        templateKey: selectedTemplate,
        recipientEmail,
      };
      if (selectedOrderId && selectedOrderType) {
        body.orderId = selectedOrderId;
        body.orderType = selectedOrderType;
      }
      if (templateDataJson.trim()) {
        try {
          body.templateData = JSON.parse(templateDataJson);
        } catch { 
          setTestStatus("JSON inválido en datos adicionales.");
          setTestLoading(false);
          return;
        }
      }
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestStatus(data.error || "No se pudo enviar el email.");
      } else {
        setTestStatus("Email encolado para prueba.");
      }
    } catch (err) {
      console.error("Error enviando email de prueba", err);
      setTestStatus("Error enviando email de prueba.");
    } finally {
      setTestLoading(false);
    }
  }

  function handleSearchOrders(e?: React.MouseEvent) {
    e?.preventDefault();
    loadOrders();
  }

  function handleOrderSelect(orderId: number | null, type: "ALBUM" | "PRINT" | null) {
    setSelectedOrderId(orderId);
    setSelectedOrderType(type);
  }

  return (
    <div className="w-full max-w-none">
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">Emails</h1>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "sent" && (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4">
            {sentLoading ? (
              <p className="text-sm text-[#6b7280]">Cargando...</p>
            ) : sentLogs.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No hay emails enviados todavía.</p>
            ) : (
              <div className="space-y-3">
                {sentLogs.map((log) => (
                  <div key={log.id} className="border border-[#e5e7eb] rounded-lg p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">{log.subject}</div>
                        <div className="text-xs text-[#6b7280]">{log.to}</div>
                      </div>
                      <div className="text-xs text-[#6b7280]">
                        {new Date(log.createdAt).toLocaleString("es-AR")}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-[#6b7280]">
                      {log.templateKey} · {log.status}
                      {log.error ? ` · ${log.error}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <Button
                variant="secondary"
                className="text-sm"
                disabled={sentPage <= 1}
                onClick={() => setSentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-[#6b7280]">
                Página {sentPage} · {sentTotal} resultados
              </span>
              <Button
                variant="secondary"
                className="text-sm"
                disabled={sentPage * 20 >= sentTotal}
                onClick={() => setSentPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {activeTab === "compose" && (
          <form
            onSubmit={handleSendEmail}
            className="bg-white border border-[#e5e7eb] rounded-xl p-4 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Para</label>
              <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Asunto</label>
              <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Contenido</label>
              <textarea
                className="w-full min-h-[180px] border border-[#e5e7eb] rounded-lg p-3 text-sm"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary">
              Enviar
            </Button>
            {composeStatus && <p className="text-sm text-[#6b7280]">{composeStatus}</p>}
          </form>
        )}

        {activeTab === "contacts" && (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 space-y-4">
            <form onSubmit={handleSearchContacts} className="flex gap-2">
              <Input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Buscar por email o nombre"
              />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
            {contactsLoading ? (
              <p className="text-sm text-[#6b7280]">Buscando...</p>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-[#6b7280]">Sin resultados.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="border border-[#e5e7eb] rounded-lg p-3">
                    <div className="text-sm font-medium text-[#111827]">
                      {item.name || "Sin nombre"} · {item.email}
                    </div>
                    <div className="text-xs text-[#6b7280]">{item.type} {item.meta ? `· ${item.meta}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4">
            {alertsLoading ? (
              <p className="text-sm text-[#6b7280]">Cargando...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-[#6b7280]">No hay alertas.</p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 ${alert.isRead ? "border-[#e5e7eb]" : "border-[#f59e0b] bg-[#fffbeb]"}`}
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">{alert.title}</div>
                        {alert.body && (
                          <pre className="text-xs text-[#6b7280] whitespace-pre-wrap mt-2">{alert.body}</pre>
                        )}
                      </div>
                      <div className="text-xs text-[#6b7280]">
                        {new Date(alert.createdAt).toLocaleString("es-AR")}
                      </div>
                    </div>
                    {!alert.isRead && (
                      <div className="mt-2">
                        <Button variant="secondary" className="text-xs" onClick={() => markAlertRead(alert.id)}>
                          Marcar como leído
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === "test" && (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Template</label>
              <select
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.key}>
                    {template.name} · {template.subject}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Email destinatario</label>
              <Input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Pedido (opcional)</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="Buscar por id, correo o nombre"
                />
                <Button variant="secondary" type="button" onClick={handleSearchOrders}>
                  Buscar
                </Button>
              </div>
              <div className="max-h-36 overflow-y-auto border border-[#e5e7eb] rounded-lg p-1 space-y-1">
                {orders.length === 0 ? (
                  <p className="text-xs text-[#6b7280] px-3">Sin pedidos. Podés ignorar este paso.</p>
                ) : (
                  orders.map((order) => (
                    <button
                      key={`${order.type}-${order.id}`}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg ${selectedOrderId === order.id ? "bg-[#c27b3d]/10 border border-[#c27b3d]" : "border border-transparent"}`}
                      onClick={() => handleOrderSelect(order.id, order.type)}
                    >
                      {order.label}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Datos adicionales (JSON)</label>
              <textarea
                className="w-full min-h-[140px] border border-[#e5e7eb] rounded-lg p-2 text-sm"
                value={templateDataJson}
                onChange={(e) => setTemplateDataJson(e.target.value)}
                placeholder='{"orderSource":"admin"}'
              />
            </div>
            <Button type="button" variant="primary" onClick={handleTestEmail} disabled={testLoading}>
              {testLoading ? "Enviando..." : "Enviar email de prueba"}
            </Button>
            {testStatus && <p className="text-sm text-[#1f2937]">{testStatus}</p>}
          </div>
        )}
      </Tabs>
    </div>
  );
}
