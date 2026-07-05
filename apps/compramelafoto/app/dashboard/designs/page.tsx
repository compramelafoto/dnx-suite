"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { CreateTemplateV2Button } from "@/components/template-v2/CreateTemplateV2Button";

type TemplatePublication = {
  reviewStatus: string;
  visibility: string;
};

type DashboardTemplate = {
  id: string;
  ownerUserId: number;
  isOwnedByViewer: boolean;
  name: string;
  description: string | null;
  status: string;
  currentVersionId: string | null;
  thumbnailUrl: string | null;
  preview: { width: number; height: number; background: string | null };
  tipoLabel: string;
  publication: TemplatePublication | null;
  isSystemCatalog: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
};

function TemplatePreviewThumb({
  name,
  thumbnailUrl,
  preview,
}: {
  name: string;
  thumbnailUrl: string | null;
  preview: DashboardTemplate["preview"];
}) {
  const ratioStyle = `${Math.max(preview.width, 1)} / ${Math.max(preview.height, 1)}`;
  if (thumbnailUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-[#f1f5f9]" style={{ aspectRatio: ratioStyle }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL externas o públicas conocidas */}
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover object-top" />
      </div>
    );
  }
  return (
    <div
      className="flex w-full items-center justify-center overflow-hidden rounded-lg text-center text-[11px] font-medium leading-tight text-[#475569] ring-1 ring-[#e2e8f0]"
      style={{
        aspectRatio: ratioStyle,
        backgroundColor: preview.background ?? "#f1f5f9",
      }}
    >
      <span className="line-clamp-3 px-3">{name.trim() || "Sin nombre"}</span>
    </div>
  );
}

function editorHrefFor(t: DashboardTemplate): string | null {
  return t.currentVersionId !== null
    ? `/fotografo/diseno/plantillas/v2/${t.id}/${t.currentVersionId}`
    : null;
}

export default function DashboardDesignsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemTemplates, setSystemTemplates] = useState<DashboardTemplate[]>([]);
  const [userTemplates, setUserTemplates] = useState<DashboardTemplate[]>([]);
  const [adminAllTemplates, setAdminAllTemplates] = useState<DashboardTemplate[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyCloneId, setBusyCloneId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/dashboard/designs/templates", { credentials: "include" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data?.error || "No se pudo cargar");
          return;
        }
        setSystemTemplates(Array.isArray(data.systemTemplates) ? data.systemTemplates : []);
        setUserTemplates(Array.isArray(data.userTemplates) ? data.userTemplates : []);
        setAdminAllTemplates(Array.isArray(data.adminAllTemplates) ? data.adminAllTemplates : []);
        setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => setError("Error de red"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runCloneSystem = async (templateId: string) => {
    setBusyCloneId(templateId);
    setMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.templateId && data.versionId) {
        router.push(
          `/fotografo/diseno/plantillas/v2/${encodeURIComponent(data.templateId)}/${encodeURIComponent(data.versionId)}`
        );
        return;
      }
      setMessage(data?.error || "No se pudo crear tu copia de la plantilla.");
    } catch {
      setMessage("Error de red al usar la plantilla.");
    } finally {
      setBusyCloneId(null);
    }
  };

  const runDuplicateOwn = async (templateId: string) => {
    setBusyCloneId(templateId);
    setMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage(`Duplicado: ${data.name || "copia creada"}.`);
        loadData();
      } else {
        setMessage(data?.error || "No se pudo duplicar.");
      }
    } catch {
      setMessage("Error de red al duplicar.");
    } finally {
      setBusyCloneId(null);
    }
  };

  const runDelete = async (templateId: string, nameLabel: string) => {
    if (!window.confirm(`¿Eliminar la plantilla "${nameLabel}"? Esta acción no se puede deshacer.`)) return;
    setBusyDeleteId(templateId);
    setMessage(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage("Plantilla eliminada.");
        loadData();
      } else {
        setMessage(data?.error || "No se pudo eliminar.");
      }
    } catch {
      setMessage("Error de red al eliminar.");
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-[#64748b]">Cargando plantillas…</p>;
  }

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-[#111827]">Diseños</h1>
          <p className="mt-2 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm text-gray-600 sm:text-[0.9375rem]">
            Plantillas del editor nuevo (solo V2 en este panel). Las plantillas clásicas siguen disponibles sólo donde haga
            falta en datos históricos; no aparecen acá ni en los listados públicos si no sos admin.
          </p>
        </div>
        <div className="shrink-0">
          <CreateTemplateV2Button />
        </div>
      </header>

      {message ? (
        <Card className="mt-4 border border-[#e5e7eb] p-4">
          <p className="text-sm text-[#374151]">{message}</p>
        </Card>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 w-full min-w-0">
          <h2 className="text-lg font-semibold text-[#111827]">Plantillas del sistema</h2>
          <p className="mt-2 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
            Marcadas como sistema en la plantilla, versión editor v2, publicadas (<span className="font-medium text-gray-800">PUBLIC</span>{" "}
            + <span className="font-medium text-gray-800">APPROVED</span>). Al tocar «Usar plantilla» se crea una copia en tu cuenta antes de
            abrir el editor: los cambios del catálogo no la sobreescriben.
          </p>
        </div>
        {systemTemplates.length === 0 ? (
          <Card className="border border-[#f1f5f9] p-8">
            <p className="text-center text-sm text-[#64748b]">No hay plantillas del sistema disponibles</p>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((t) => {
              const catalogEditorHref = editorHrefFor(t);
              return (
                <li key={t.id}>
                  <Card className="flex h-full flex-col overflow-hidden border border-[#eef2f6] p-4 shadow-sm">
                    <TemplatePreviewThumb name={t.name} thumbnailUrl={t.thumbnailUrl} preview={t.preview} />
                    <p className="mt-4 line-clamp-2 text-base font-semibold text-[#0f172a]">{t.name || "Sin nombre"}</p>
                    <div className="mt-5 flex flex-col gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="font-semibold"
                        disabled={busyCloneId !== null}
                        onClick={() => runCloneSystem(t.id)}
                      >
                        {busyCloneId === t.id ? "Preparando copia…" : "Usar plantilla"}
                      </Button>
                      {isAdmin && catalogEditorHref ? (
                        <Link
                          href={catalogEditorHref}
                          className="text-center text-xs font-medium text-[#64748b] underline underline-offset-2 hover:text-[#334155]"
                        >
                          Editar plantilla del catálogo (admin)
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="mb-1 text-lg font-semibold text-[#111827]">Mis plantillas</h2>
        <p className="mb-4 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
          Tus borradores y plantillas que no están marcadas como «sistema» (meta editor v2).
        </p>
        {userTemplates.length === 0 ? (
          <Card className="border border-[#f1f5f9] p-8">
            <p className="text-center text-sm text-[#64748b]">Todavía no tenés plantillas propias en el editor.</p>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userTemplates.map((t) => {
              const href = editorHrefFor(t);
              return (
                <li key={t.id}>
                  <Card className="flex h-full flex-col overflow-hidden border border-[#eef2f6] p-4 shadow-sm">
                    <TemplatePreviewThumb name={t.name} thumbnailUrl={t.thumbnailUrl} preview={t.preview} />
                    <p className="mt-4 line-clamp-2 text-base font-semibold text-[#0f172a]">{t.name || "Sin nombre"}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {href ? (
                        <Link href={href}>
                          <Button variant="primary" className="font-semibold">
                            Editar
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="primary" disabled>
                          Editar
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="font-semibold"
                        disabled={busyCloneId !== null}
                        onClick={() => runDuplicateOwn(t.id)}
                      >
                        {busyCloneId === t.id ? "Duplicando…" : "Duplicar"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="font-semibold text-red-700 ring-red-100 hover:bg-red-50"
                        disabled={busyDeleteId !== null}
                        onClick={() => runDelete(t.id, t.name || t.id)}
                      >
                        {busyDeleteId === t.id ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin && adminAllTemplates.length > 0 ? (
        <section className="mt-14">
          <h2 className="mb-1 text-lg font-semibold text-[#111827]">Todas las plantillas (Admin)</h2>
          <p className="mb-4 w-full min-w-0 ds-readable-text ds-readable-text--fluid ds-readable-text--sm ds-readable-text--muted">
            Todas las filas Template V2 con meta de versión editor v2 — incluye cuentas ajenas; usá eliminar con cuidado.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminAllTemplates.map((t) => {
              const href = editorHrefFor(t);
              const ownerLabel = `${t.ownerName?.trim() || t.ownerEmail || `Usuario ${t.ownerUserId}`}`;
              return (
                <li key={`admin-${t.id}`}>
                  <Card className="flex h-full flex-col overflow-hidden border border-[#fde68a]/80 bg-[#fffbeb] p-4 shadow-sm">
                    <TemplatePreviewThumb name={t.name} thumbnailUrl={t.thumbnailUrl} preview={t.preview} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.isSystemCatalog ? (
                        <span className="rounded-full bg-[#1e293b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Sistema
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#e2e8f0] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#475569]">
                          Usuario
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-2 text-base font-semibold text-[#0f172a]">{t.name || "Sin nombre"}</p>
                    <p className="mt-2 text-xs text-[#475569]">
                      Dueño: <span className="font-medium">{ownerLabel}</span>
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {href ? (
                        <Link href={href}>
                          <Button variant="primary" className="font-semibold">
                            Editar
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="primary" disabled>
                          Editar
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="font-semibold text-red-700 ring-red-100 hover:bg-red-50"
                        disabled={busyDeleteId !== null}
                        onClick={() => runDelete(t.id, t.name || t.id)}
                      >
                        {busyDeleteId === t.id ? "Eliminando…" : "Eliminar"}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {isAdmin && adminAllTemplates.length === 0 ? (
        <section className="mt-14">
          <h2 className="mb-2 text-lg font-semibold text-[#111827]">Todas las plantillas (Admin)</h2>
          <Card className="border border-[#f1f5f9] p-6">
            <p className="text-sm text-[#64748b]">No hay plantillas Template V2 en la base o ninguna coincide con meta v2.</p>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
