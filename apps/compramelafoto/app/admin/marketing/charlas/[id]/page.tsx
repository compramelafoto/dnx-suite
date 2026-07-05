"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import { CHARLAS_FPR_TALK_SLUG } from "@/lib/charlasfpr";

type TalkDetail = {
  id: number;
  title: string;
  subtitle: string | null;
  slug: string;
  status: string;
  eventDate: string | null;
  eventTime: string | null;
  timezone: string;
  calendarUrl: string | null;
  whatsappGroupUrl: string | null;
  badgeText: string | null;
  primaryCtaText: string | null;
  secondaryCtaText: string | null;
  reminderTemplate: string | null;
  groupInviteTemplate: string | null;
  followUpTemplate: string | null;
  _count: { leads: number };
  metrics?: { calendarClicks: number; whatsappClicks: number };
};

type TalkLead = {
  id: number;
  name: string;
  whatsapp: string;
  email: string;
  city: string | null;
  photographyType: string | null;
  createdAt: string;
  calendarClickedAt: string | null;
  whatsappClickedAt: string | null;
  attendedAt: string | null;
  interestedAt: string | null;
  contactedAt: string | null;
};

const tabs = [
  { id: "summary", label: "Resumen" },
  { id: "leads", label: "Inscriptos" },
  { id: "messages", label: "Mensajes" },
  { id: "landing", label: "Landing" },
  { id: "settings", label: "Configuración" },
];

function normalizePhone(value: string): string {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("54")) return digits;
  if (digits.length <= 11) return `54${digits.replace(/^0+/, "")}`;
  return digits;
}

function formatEventDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function getReminderTemplate(talk: TalkDetail) {
  if (talk.reminderTemplate?.trim()) return talk.reminderTemplate;
  return "Hola {{nombre}}, ¿cómo estás? Falta poco para la charla \"{{titulo}}\": nos vemos {{fecha}} a las {{hora}}. Si todavía no la agendaste, hacelo acá: {{calendarUrl}}";
}

function getGroupInviteTemplate(talk: TalkDetail) {
  if (talk.groupInviteTemplate?.trim()) return talk.groupInviteTemplate;
  return "Hola {{nombre}}, ¿cómo estás? Te comparto el grupo de WhatsApp de la charla \"{{titulo}}\" para que recibas recordatorio y novedades: {{whatsappGroupUrl}}";
}

function WhatsAppIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.15 6.42 2.15 11.88c0 1.75.46 3.45 1.33 4.95L2 22l5.33-1.4a9.86 9.86 0 0 0 4.7 1.2h.01c5.46 0 9.89-4.43 9.89-9.9A9.88 9.88 0 0 0 12.04 2Zm0 18.07h-.01c-1.49 0-2.95-.4-4.22-1.14l-.3-.18-3.16.83.84-3.08-.2-.32a8.17 8.17 0 0 1-1.26-4.3c0-4.5 3.68-8.17 8.2-8.17 2.18 0 4.22.85 5.76 2.4a8.1 8.1 0 0 1 2.4 5.78c0 4.51-3.67 8.18-8.05 8.18Zm4.48-6.12c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06a6.67 6.67 0 0 1-1.96-1.21 7.37 7.37 0 0 1-1.35-1.68c-.14-.24 0-.37.1-.5.1-.12.24-.3.36-.44.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.13 3.64.58.25 1.04.4 1.4.52.58.18 1.1.16 1.52.1.46-.06 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function formatTemplate(template: string, lead: TalkLead, talk: TalkDetail) {
  return template
    .replace(/\{\{\s*nombre\s*\}\}/gi, lead.name)
    .replace(/\{\{\s*titulo\s*\}\}/gi, talk.title)
    .replace(/\{\{\s*fecha\s*\}\}/gi, formatEventDate(talk.eventDate))
    .replace(/\{\{\s*hora\s*\}\}/gi, talk.eventTime || "")
    .replace(/\{\{\s*calendarUrl\s*\}\}/gi, talk.calendarUrl || "")
    .replace(/\{\{\s*whatsappGroupUrl\s*\}\}/gi, talk.whatsappGroupUrl || "");
}

export default function AdminTalkDetailPage() {
  const params = useParams();
  const talkId = Number(params?.id);
  const [talk, setTalk] = useState<TalkDetail | null>(null);
  const [leads, setLeads] = useState<TalkLead[]>([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editForm, setEditForm] = useState<TalkDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(talkId)) return;
    loadTalk();
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkId]);

  async function loadTalk() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/talks/${talkId}`);
      const data = await res.json().catch(() => ({}));
      setTalk(data.talk || null);
      setEditForm(data.talk || null);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeads() {
    const res = await fetch(`/api/admin/talks/${talkId}/leads`);
    const data = await res.json().catch(() => ({}));
    setLeads(data.leads || []);
  }

  const metrics = useMemo(() => {
    const total = leads.length;
    const calendar = talk?.metrics?.calendarClicks ?? leads.filter((l) => l.calendarClickedAt).length;
    const whatsapp = talk?.metrics?.whatsappClicks ?? leads.filter((l) => l.whatsappClickedAt).length;
    const attended = leads.filter((l) => l.attendedAt).length;
    const interested = leads.filter((l) => l.interestedAt).length;
    const lastLead = leads[0]?.createdAt || null;
    return { total, calendar, whatsapp, attended, interested, lastLead };
  }, [leads, talk]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === leads.length) return new Set();
      return new Set(leads.map((l) => l.id));
    });
  }

  function copyText(value: string) {
    navigator.clipboard.writeText(value);
  }

  function buildWhatsAppLink(lead: TalkLead, template: string) {
    const phone = normalizePhone(lead.whatsapp);
    const message = encodeURIComponent(formatTemplate(template, lead, talk as TalkDetail));
    return `https://web.whatsapp.com/send?phone=${phone}&text=${message}`;
  }

  async function markLead(leadId: number, action: string, value: boolean = true) {
    await fetch(`/api/admin/talks/${talkId}/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, action, value }),
    });
    loadLeads();
  }

  function exportCsv() {
    const rows = [
      [
        "Nombre",
        "WhatsApp",
        "Email",
        "Ciudad",
        "Tipo de fotografía",
        "Inscripción",
        "Calendar",
        "WhatsApp grupo",
      ],
      ...leads.map((l) => [
        l.name,
        l.whatsapp,
        l.email,
        l.city ?? "",
        l.photographyType ?? "",
        new Date(l.createdAt).toLocaleString("es-AR"),
        l.calendarClickedAt ? "Sí" : "No",
        l.whatsappClickedAt ? "Sí" : "No",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${talk?.slug || "charla"}-leads.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveSettings() {
    if (!editForm) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/talks/${talkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar.");
      setTalk(data.talk);
      setEditForm(data.talk);
    } catch (err: any) {
      setSaveError(err?.message || "Error guardando.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !talk) {
    return <p className="text-gray-500">Cargando charla...</p>;
  }

  if (!talk) {
    return <p className="text-gray-500">Charla no encontrada.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{talk.title}</h1>
          <p className="text-sm text-gray-500">/{talk.slug}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {talk.slug === CHARLAS_FPR_TALK_SLUG ? (
            <a href="/charlasfpr" target="_blank" rel="noreferrer">
              <Button variant="secondary">Abrir /charlasfpr</Button>
            </a>
          ) : null}
          <a href={`/charlas/${talk.slug}`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Abrir landing</Button>
          </a>
          <Link href="/admin/marketing/charlas">
            <Button variant="secondary">Volver</Button>
          </Link>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "summary" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Inscriptos</p>
                <p className="text-xl font-semibold">{metrics.total}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Clicks Calendar</p>
                <p className="text-xl font-semibold">{metrics.calendar}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Clicks WhatsApp</p>
                <p className="text-xl font-semibold">{metrics.whatsapp}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">Asistieron</p>
                <p className="text-xl font-semibold">{metrics.attended}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-600">
                Última inscripción:{" "}
                {metrics.lastLead ? new Date(metrics.lastLead).toLocaleString("es-AR") : "Sin datos"}
              </p>
            </div>
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={toggleAll}>
                {selected.size === leads.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
              <Button variant="secondary" size="sm" onClick={exportCsv}>
                Exportar CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyText(leads.map((l) => l.email).join(", "))}
              >
                Copiar emails
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyText(leads.map((l) => l.whatsapp).join(", "))}
              >
                Copiar teléfonos
              </Button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ciudad</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rubro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calendar</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grupo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.whatsapp}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.email}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.city || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.photographyType || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.calendarClickedAt ? "Sí" : "No"}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.whatsappClickedAt ? "Sí" : "No"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={buildWhatsAppLink(lead, getReminderTemplate(talk))}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2 py-1 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20"
                            onClick={() => markLead(lead.id, "reminder")}
                          >
                            <WhatsAppIcon />
                            Recordar
                          </a>
                          <a
                            href={buildWhatsAppLink(lead, getGroupInviteTemplate(talk))}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2 py-1 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20"
                          >
                            <WhatsAppIcon />
                            Invitar grupo
                          </a>
                          <a
                            href={buildWhatsAppLink(lead, talk.followUpTemplate || "")}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gray-500 hover:underline"
                            onClick={() => markLead(lead.id, "contacted")}
                          >
                            Seguimiento
                          </a>
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:underline"
                            onClick={() => markLead(lead.id, "attended", !lead.attendedAt)}
                          >
                            {lead.attendedAt ? "Quitar asistió" : "Marcar asistió"}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:underline"
                            onClick={() => markLead(lead.id, "interested", !lead.interestedAt)}
                          >
                            {lead.interestedAt ? "Quitar interesado" : "Marcar interesado"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                        No hay inscriptos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-sm text-gray-600">Mensaje recordatorio</p>
              <pre className="text-xs bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{getReminderTemplate(talk)}</pre>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-sm text-gray-600">Mensaje invitación al grupo</p>
              <pre className="text-xs bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{getGroupInviteTemplate(talk)}</pre>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <p className="text-sm text-gray-600">Mensaje seguimiento post charla</p>
              <pre className="text-xs bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{talk.followUpTemplate}</pre>
            </div>
          </div>
        )}

        {activeTab === "landing" && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
            <p className="text-sm text-gray-600">Landing pública</p>
            {talk.slug === CHARLAS_FPR_TALK_SLUG ? (
              <p>
                <a href="/charlasfpr" target="_blank" rel="noreferrer" className="text-[#c27b3d] hover:underline">
                  Abrir /charlasfpr (landing dedicada Rosario)
                </a>
              </p>
            ) : null}
            <p>
              <a href={`/charlas/${talk.slug}`} target="_blank" rel="noreferrer" className="text-[#c27b3d] hover:underline">
                Abrir /charlas/{talk.slug}
              </a>
            </p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4 text-sm text-gray-600">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-500">Título</label>
                <input
                  value={editForm?.title ?? ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Slug</label>
                <input
                  value={editForm?.slug ?? ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Estado</label>
                <select
                  value={editForm?.status ?? "DRAFT"}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, status: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="PUBLISHED">Publicada</option>
                  <option value="CLOSED">Cerrada</option>
                  <option value="ARCHIVED">Archivada</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Fecha</label>
                <input
                  type="date"
                  value={editForm?.eventDate ? editForm.eventDate.slice(0, 10) : ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, eventDate: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Hora</label>
                <input
                  type="time"
                  value={editForm?.eventTime ?? ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, eventTime: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Calendar URL</label>
                <input
                  value={editForm?.calendarUrl ?? ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, calendarUrl: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">WhatsApp Group URL</label>
                <input
                  value={editForm?.whatsappGroupUrl ?? ""}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, whatsappGroupUrl: e.target.value } : prev))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </Tabs>
    </div>
  );
}
