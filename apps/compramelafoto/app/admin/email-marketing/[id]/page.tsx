"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { renderTemplate } from "@/lib/email-marketing/render-template";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Campaign = {
  id: number;
  name: string;
  subject: string;
  previewText: string | null;
  fromName: string;
  fromEmail: string;
  html: string;
  status: string;
  audienceJson: Record<string, unknown> | null;
  _count?: { sends: number };
};

type AudienceFilters = {
  roles?: string[];
  country?: string;
  province?: string;
  isActive?: boolean;
  hasOrders?: boolean;
  isVerifiedEmail?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
};

const ROLES = [
  { value: "PHOTOGRAPHER", label: "Fotógrafos" },
  { value: "LAB", label: "Laboratorios" },
  { value: "CLIENT", label: "Clientes" },
];

export default function CampaignEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id === "new" ? null : parseInt(String(params.id), 10);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "sends">("editor");

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [fromName, setFromName] = useState(process.env.NEXT_PUBLIC_EMAIL_FROM_NAME || "Compramelafoto");
  const [fromEmail, setFromEmail] = useState(process.env.NEXT_PUBLIC_EMAIL_FROM || "info@compramelafoto.com");
  const [html, setHtml] = useState("<p>Hola {{firstName}},</p><p>Contenido.</p>");
  const [audience, setAudience] = useState<AudienceFilters>({ roles: ["PHOTOGRAPHER", "LAB", "CLIENT"] });

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSample, setPreviewSample] = useState<{ email: string; firstName: string; role: string }[]>([]);

  const [testEmails, setTestEmails] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [sendLoading, setSendLoading] = useState(false);
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const [sends, setSends] = useState<{ toEmail: string; status: string; error?: string | null; sentAt?: string | null }[]>([]);
  const [sendsLoading, setSendsLoading] = useState(false);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const previewHtml = useMemo(() => {
    const ctx = {
      firstName: "Juan",
      lastName: "Pérez",
      email: "juan@ejemplo.com",
      workspaceName: "Mi Estudio",
      role: "PHOTOGRAPHER",
      referralCode: "REF123",
      unsubscribeUrl: "https://compramelafoto.com/unsubscribe?token=preview",
    };
    return renderTemplate(html, ctx);
  }, [html]);

  useEffect(() => {
    if (id) loadCampaign();
    else setLoading(false);
  }, [id]);

  async function loadCampaign() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const c = data.campaign;
      setCampaign(c);
      setName(c.name);
      setSubject(c.subject);
      setPreviewText(c.previewText || "");
      setFromName(c.fromName);
      setFromEmail(c.fromEmail);
      setHtml(c.html);
      setAudience((c.audienceJson as AudienceFilters) || { roles: ["PHOTOGRAPHER", "LAB", "CLIENT"] });
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          previewText: previewText || null,
          fromName,
          fromEmail,
          html,
          audienceJson: audience,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setCampaign(data.campaign);
      setStatusMsg("Guardado correctamente");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function loadPreviewRecipients() {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/preview-recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceJson: audience }),
      });
      const data = await res.json();
      setPreviewCount(data.count);
      setPreviewSample(data.sample || []);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSendTest() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: testEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult(`Error: ${data.error || "Desconocido"}`);
        return;
      }
      const ok = data.results?.filter((r: { ok: boolean }) => r.ok).length ?? 0;
      const fail = data.results?.filter((r: { ok: boolean }) => !r.ok).length ?? 0;
      setTestResult(`Enviados: ${ok}. Fallidos: ${fail}.`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : String(e));
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSendCampaign() {
    if (!sendConfirm) {
      setSendConfirm(true);
      return;
    }
    setSendLoading(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setSendConfirm(false);
      setStatusMsg(data.message || "Envío encolado");
      loadCampaign();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendLoading(false);
    }
  }

  async function loadSends() {
    setSendsLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/sends?perPage=50`);
      const data = await res.json();
      setSends(data.sends || []);
      setByStatus(data.byStatus || {});
    } finally {
      setSendsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "sends" && id) loadSends();
  }, [activeTab, id]);

  function toggleRole(r: string) {
    setAudience((a) => {
      const roles = a.roles || [];
      const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
      return { ...a, roles: next };
    });
  }

  async function handleDuplicate() {
    setDuplicateLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      router.push(`/admin/email-marketing/${data.campaign.id}`);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDuplicateLoading(false);
    }
  }

  async function handlePause() {
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      });
      if (!res.ok) throw new Error("Error al pausar");
      loadCampaign();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading && id) {
    return <p className="text-gray-600">Cargando campaña...</p>;
  }

  if (!id) {
    return (
      <div>
        <Link href="/admin/email-marketing" className="text-[#c27b3d] hover:underline mb-4 inline-block">← Volver</Link>
        <p>ID inválido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/email-marketing" className="text-[#c27b3d] hover:underline">← Campañas</Link>
          <h1 className="text-2xl font-bold text-gray-900">{campaign?.name || name || "Editar campaña"}</h1>
          <Button variant="secondary" onClick={handleDuplicate} disabled={duplicateLoading}>
            {duplicateLoading ? "..." : "Duplicar"}
          </Button>
          {campaign?.status === "SENDING" && (
            <Button variant="secondary" onClick={handlePause}>Pausar</Button>
          )}
          {campaign?.status && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              campaign.status === "DRAFT" ? "bg-gray-100" :
              campaign.status === "SENT" ? "bg-green-100 text-green-800" :
              campaign.status === "SENDING" ? "bg-amber-100 text-amber-800" : "bg-blue-100"
            }`}>
              {campaign.status}
            </span>
          )}
        </div>
        {statusMsg && <p className="text-sm text-green-600">{statusMsg}</p>}
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("editor")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "editor" ? "border-b-2 border-[#c27b3d] text-[#c27b3d]" : "text-gray-600"}`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab("sends")}
          className={`px-4 py-2 text-sm font-medium ${activeTab === "sends" ? "border-b-2 border-[#c27b3d] text-[#c27b3d]" : "text-gray-600"}`}
        >
          Envíos
        </button>
      </div>

      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre (interno)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi campaña" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview text (opcional)</label>
              <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Vista previa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From (nombre)</label>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From (email)</label>
                <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} type="email" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Audiencia - Roles</label>
              <div className="flex gap-4">
                {ROLES.map((r) => (
                  <label key={r.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(audience.roles || []).includes(r.value)}
                      onChange={() => toggleRole(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
              <Button variant="secondary" onClick={loadPreviewRecipients} disabled={previewLoading}>
                {previewLoading ? "..." : "Vista previa destinatarios"}
              </Button>
            </div>

            {previewCount !== null && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium">Destinatarios elegibles: {previewCount}</p>
                {previewSample.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600">
                    {previewSample.slice(0, 5).map((s, i) => (
                      <li key={i}>{s.email} ({s.role})</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enviar test a emails (separados por coma)</label>
              <textarea
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
                placeholder="email1@test.com, email2@test.com"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={2}
              />
              <Button className="mt-2" onClick={handleSendTest} disabled={testLoading}>
                {testLoading ? "Enviando..." : "Enviar test"}
              </Button>
              {testResult && <p className="mt-2 text-sm text-gray-600">{testResult}</p>}
            </div>

            {["DRAFT", "PAUSED"].includes(campaign?.status || "") && (
              <div>
                <Button
                  onClick={handleSendCampaign}
                  disabled={sendLoading}
                  className={sendConfirm ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  {sendConfirm ? "¿Confirmar envío masivo?" : "Enviar campaña"}
                </Button>
                {sendConfirm && (
                  <button
                    onClick={() => setSendConfirm(false)}
                    className="ml-2 text-sm text-gray-600 hover:underline"
                  >
                    Cancelar
                  </button>
                )}
                {sendError && <p className="mt-2 text-sm text-red-600">{sendError}</p>}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Editor HTML. Variables: firstName, lastName, email, workspaceName, role, referralCode, unsubscribeUrl (con doble llave)
            </label>
            <div className="border rounded-lg overflow-hidden" style={{ minHeight: 300 }}>
              <MonacoEditor
                height="300px"
                defaultLanguage="html"
                value={html}
                onChange={(v) => setHtml(v ?? "")}
                theme="vs-light"
                options={{ minimap: { enabled: false } }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vista previa</label>
              <iframe
                srcDoc={previewHtml}
                title="Preview"
                className="w-full border rounded-lg bg-white"
                style={{ minHeight: 300 }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "sends" && (
        <div>
          <div className="flex gap-4 mb-4">
            {Object.entries(byStatus).map(([s, c]) => (
              <span key={s} className="px-3 py-1 bg-gray-100 rounded text-sm">
                {s}: {c}
              </span>
            ))}
          </div>
          {sendsLoading ? (
            <p>Cargando envíos...</p>
          ) : (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Estado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Error</th>
                  <th className="px-4 py-2 text-left text-xs font-medium">Enviado</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => (
                  <tr key={s.toEmail + s.sentAt} className="border-t">
                    <td className="px-4 py-2">{s.toEmail}</td>
                    <td className="px-4 py-2">{s.status}</td>
                    <td className="px-4 py-2 text-sm text-red-600">{s.error || "-"}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{s.sentAt ? new Date(s.sentAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
