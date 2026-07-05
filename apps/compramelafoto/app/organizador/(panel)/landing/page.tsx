"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";
import { DsDashboardInner, DsInfoPanel, DsPageShell } from "@/components/ui/DsLayout";
import OrganizerLandingMediaSection from "@/components/organizer/OrganizerLandingMediaSection";
import OrganizerLandingFeaturedManager from "@/components/organizer/OrganizerLandingFeaturedManager";
import OrganizerLandingOfficialPhotographersManager from "@/components/organizer/OrganizerLandingOfficialPhotographersManager";
import OrganizerLandingSponsorsManager from "@/components/organizer/OrganizerLandingSponsorsManager";
import OrganizerPublicLandingShare from "@/components/organizer/OrganizerPublicLandingShare";
import OrganizerLandingColorSelect from "@/components/organizer/OrganizerLandingColorSelect";
import {
  ORGANIZER_LANDING_PRIMARY_COLORS,
  ORGANIZER_LANDING_SECONDARY_COLORS,
} from "@/lib/organizer-landing-colors";
import {
  ORGANIZER_LANDING_MODULE_IDS,
  defaultOrganizerLandingModules,
  getOrganizerLandingModuleLabel,
  isModuleEnabled,
  type OrganizerLandingModulesConfig,
} from "@/lib/organizer-landing-modules";

type LandingProfile = {
  publicSlug: string;
  isPublished: boolean;
  displayName: string;
  tagline: string | null;
  description: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  city: string | null;
  zone: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
  modulesJson: OrganizerLandingModulesConfig;
  seoTitle: string | null;
  seoDescription: string | null;
  publicUrl: string | null;
};

const SITE_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || "https://compramelafoto.com";

function emptyForm(defaults?: Partial<LandingProfile>): LandingProfile {
  return {
    publicSlug: defaults?.publicSlug ?? "",
    isPublished: defaults?.isPublished ?? false,
    displayName: defaults?.displayName ?? "",
    tagline: defaults?.tagline ?? "",
    description: defaults?.description ?? "",
    primaryColor: defaults?.primaryColor ?? "#c27b3d",
    secondaryColor: defaults?.secondaryColor ?? "#1f2937",
    city: defaults?.city ?? "",
    zone: defaults?.zone ?? "",
    website: defaults?.website ?? "",
    instagram: defaults?.instagram ?? "",
    whatsapp: defaults?.whatsapp ?? "",
    publicEmail: defaults?.publicEmail ?? "",
    modulesJson: defaults?.modulesJson ?? defaultOrganizerLandingModules(),
    seoTitle: defaults?.seoTitle ?? "",
    seoDescription: defaults?.seoDescription ?? "",
    publicUrl: null,
  };
}

export default function OrganizadorLandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ organizerId: number; name?: string | null; email?: string | null } | null>(
    null
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [form, setForm] = useState<LandingProfile>(() => emptyForm());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function auth() {
      const s = await ensureOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      setAuthLoading(false);
    }
    void auth();
    return () => {
      active = false;
    };
  }, [router]);

  const loadLanding = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organizer/landing", { credentials: "include" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.profile) {
        setLogoUrl(data.profile.logoUrl ?? null);
        setBannerUrl(data.profile.bannerUrl ?? null);
        setForm({
          publicSlug: data.profile.publicSlug,
          isPublished: data.profile.isPublished,
          displayName: data.profile.displayName,
          tagline: data.profile.tagline ?? "",
          description: data.profile.description ?? "",
          primaryColor: data.profile.primaryColor ?? "#c27b3d",
          secondaryColor: data.profile.secondaryColor ?? "#1f2937",
          city: data.profile.city ?? "",
          zone: data.profile.zone ?? "",
          website: data.profile.website ?? "",
          instagram: data.profile.instagram ?? "",
          whatsapp: data.profile.whatsapp ?? "",
          publicEmail: data.profile.publicEmail ?? "",
          modulesJson: data.profile.modulesJson,
          seoTitle: data.profile.seoTitle ?? "",
          seoDescription: data.profile.seoDescription ?? "",
          publicUrl: data.profile.publicUrl,
        });
      } else if (data.defaults) {
        setLogoUrl(null);
        setBannerUrl(null);
        setForm(
          emptyForm({
            publicSlug: data.defaults.publicSlug,
            displayName: data.defaults.displayName,
            city: data.defaults.city ?? "",
            zone: data.defaults.zone ?? "",
            modulesJson: data.defaults.modulesJson,
            isPublished: false,
          })
        );
      }
    } catch {
      setFeedback({ type: "error", text: "No se pudo cargar la configuración." });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadLanding();
  }, [authLoading, session, loadLanding]);

  function updateField<K extends keyof LandingProfile>(key: K, value: LandingProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleModule(id: (typeof ORGANIZER_LANDING_MODULE_IDS)[number], enabled: boolean) {
    setForm((prev) => {
      const base = { ...defaultOrganizerLandingModules(), ...prev.modulesJson };
      return {
        ...prev,
        modulesJson: {
          ...base,
          [id]: { ...base[id], enabled },
        },
      };
    });
  }

  async function checkSlug() {
    if (!form.publicSlug.trim()) return;
    setSlugChecking(true);
    setSlugStatus(null);
    try {
      const res = await fetch(
        `/api/organizer/landing/slug-check?slug=${encodeURIComponent(form.publicSlug)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.normalizedSlug) {
        updateField("publicSlug", data.normalizedSlug);
      }
      setSlugStatus({
        available: Boolean(data.available),
        message: data.available ? "URL disponible." : data.reason || "No disponible.",
      });
    } catch {
      setSlugStatus({ available: false, message: "Error al verificar." });
    } finally {
      setSlugChecking(false);
    }
  }

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/organizer/landing", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tagline: form.tagline || null,
          description: form.description || null,
          city: form.city || null,
          zone: form.zone || null,
          website: form.website || null,
          instagram: form.instagram || null,
          whatsapp: form.whatsapp || null,
          publicEmail: form.publicEmail || null,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      if (data.profile) {
        setLogoUrl(data.profile.logoUrl ?? null);
        setBannerUrl(data.profile.bannerUrl ?? null);
        setForm({
          publicSlug: data.profile.publicSlug,
          isPublished: data.profile.isPublished,
          displayName: data.profile.displayName,
          tagline: data.profile.tagline ?? "",
          description: data.profile.description ?? "",
          primaryColor: data.profile.primaryColor ?? "#c27b3d",
          secondaryColor: data.profile.secondaryColor ?? "#1f2937",
          city: data.profile.city ?? "",
          zone: data.profile.zone ?? "",
          website: data.profile.website ?? "",
          instagram: data.profile.instagram ?? "",
          whatsapp: data.profile.whatsapp ?? "",
          publicEmail: data.profile.publicEmail ?? "",
          modulesJson: data.profile.modulesJson,
          seoTitle: data.profile.seoTitle ?? "",
          seoDescription: data.profile.seoDescription ?? "",
          publicUrl: data.profile.publicUrl,
        });
      }
      setFeedback({ type: "success", text: "Página pública guardada correctamente." });
    } catch {
      setFeedback({ type: "error", text: "Error de conexión al guardar." });
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = form.isPublished
    ? `${SITE_BASE.replace(/\/$/, "")}/${form.publicSlug}`
    : null;

  const modules = useMemo(
    () => ({ ...defaultOrganizerLandingModules(), ...form.modulesJson }),
    [form.modulesJson]
  );

  if (!session && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader
        organizer={session ? { organizerId: session.organizerId, name: session.name, email: session.email } : null}
      />
      <DsPageShell className="py-6 md:py-8 flex-1">
        <DsDashboardInner className="ds-stack-section min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Mi página pública</h1>
            <p className="ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm">
              Configurá la página que verán visitantes en{" "}
              <strong>compramelafoto.com/tu-slug</strong>. Los cambios no afectan pagos ni comisiones.
            </p>
          </div>

          {loading ? (
            <p className="text-gray-600 text-sm">Cargando…</p>
          ) : (
            <>
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Módulos visibles</h2>
                <p className="ds-readable-text text-sm text-gray-600 m-0">
                  Activá las secciones de tu página pública. Al marcar o desmarcar, aparece abajo el
                  panel para configurar esa sección. El orden se respeta en la versión publicada.
                </p>
                <ul className="space-y-3 m-0 p-0 list-none">
                  {ORGANIZER_LANDING_MODULE_IDS.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <span className="text-sm text-gray-800">{getOrganizerLandingModuleLabel(id)}</span>
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={modules[id]?.enabled ?? false}
                          onChange={(e) => toggleModule(id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-500">Visible</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">A. Estado y URL pública</h2>
                <DsInfoPanel title="Publicación">
                  <p className="ds-readable-text text-sm text-gray-700 m-0">
                    Mientras esté en borrador, nadie verá tu página en la URL pública.
                  </p>
                </DsInfoPanel>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => updateField("isPublished", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-800">Publicar página</span>
                </label>
                <div>
                  <label htmlFor="public-slug" className="block text-sm font-medium text-gray-700 mb-1">
                    Slug (URL)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <span className="text-sm text-gray-500 sm:pt-2 whitespace-nowrap">compramelafoto.com/</span>
                    <Input
                      id="public-slug"
                      value={form.publicSlug}
                      onChange={(e) => {
                        updateField("publicSlug", e.target.value);
                        setSlugStatus(null);
                      }}
                      className="flex-1 min-w-0 w-full"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void checkSlug()}
                      disabled={slugChecking || !form.publicSlug.trim()}
                      className="whitespace-nowrap shrink-0"
                    >
                      {slugChecking ? "Verificando…" : "Verificar URL"}
                    </Button>
                  </div>
                  {slugStatus ? (
                    <p
                      className={`text-xs mt-2 m-0 ${slugStatus.available ? "text-green-800" : "text-red-700"}`}
                    >
                      {slugStatus.message}
                    </p>
                  ) : null}
                </div>
                {previewUrl ? (
                  <OrganizerPublicLandingShare url={previewUrl} primaryColor={form.primaryColor} />
                ) : (
                  <p className="text-xs text-gray-500 m-0">Publicá la página para habilitar el enlace y compartir el QR.</p>
                )}
              </Card>

              {isModuleEnabled(modules, "hero") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card">
                <h2 className="text-lg font-semibold text-gray-900 m-0 mb-4">B. Identidad (portada)</h2>
                <div className="ds-form-stack max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre público</label>
                    <Input
                      value={form.displayName}
                      onChange={(e) => updateField("displayName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                    <Input
                      value={form.tagline ?? ""}
                      onChange={(e) => updateField("tagline", e.target.value)}
                      placeholder="Ej: Torneos y eventos deportivos en Rosario"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      rows={5}
                      className="min-h-[120px]"
                      placeholder="Contá qué hace tu organización…"
                    />
                  </div>
                </div>
              </Card>
              ) : null}

              {isModuleEnabled(modules, "hero") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Logo y portada</h2>
                <OrganizerLandingMediaSection
                  logoUrl={logoUrl}
                  bannerUrl={bannerUrl}
                  onLogoChange={setLogoUrl}
                  onBannerChange={setBannerUrl}
                />
              </Card>
              ) : null}

              {isModuleEnabled(modules, "upcomingEvents") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Próximos eventos</h2>
                <DsInfoPanel title="Contenido automático">
                  <p className="ds-readable-text text-sm text-gray-700 m-0">
                    Se listan tus eventos publicados con fecha futura. Creálos o editálos desde{" "}
                    <Link href="/organizador/events" className="text-[#c27b3d] font-medium hover:underline">
                      Eventos
                    </Link>
                    .
                  </p>
                </DsInfoPanel>
              </Card>
              ) : null}

              {isModuleEnabled(modules, "pastEvents") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Eventos anteriores</h2>
                <DsInfoPanel title="Contenido automático">
                  <p className="ds-readable-text text-sm text-gray-700 m-0">
                    Se muestran eventos ya finalizados. No requiere configuración adicional en esta página.
                  </p>
                </DsInfoPanel>
              </Card>
              ) : null}

              {isModuleEnabled(modules, "featuredGalleries") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Galerías destacadas</h2>
                <OrganizerLandingFeaturedManager />
              </Card>
              ) : null}

              {isModuleEnabled(modules, "photographerCall") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Convocatoria para fotógrafos</h2>
                <DsInfoPanel title="Vinculada al próximo evento">
                  <p className="ds-readable-text text-sm text-gray-700 m-0">
                    El bloque de convocatoria usa tu próximo evento publicado. Configurá visibilidad e
                    inscripción en cada evento desde{" "}
                    <Link href="/organizador/events" className="text-[#c27b3d] font-medium hover:underline">
                      Eventos
                    </Link>
                    .
                  </p>
                </DsInfoPanel>
              </Card>
              ) : null}

              {isModuleEnabled(modules, "sponsors") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Auspiciantes</h2>
                <OrganizerLandingSponsorsManager />
              </Card>
              ) : null}

              {isModuleEnabled(modules, "officialPhotographers") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Fotógrafos oficiales</h2>
                <OrganizerLandingOfficialPhotographersManager />
              </Card>
              ) : null}

              {isModuleEnabled(modules, "frequentPhotographers") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Fotógrafos frecuentes</h2>
                <DsInfoPanel title="Listado público">
                  <p className="ds-readable-text text-sm text-gray-700 m-0">
                    Mostrá fotógrafos con los que trabajás seguido. Podés revisar tu red en{" "}
                    <Link href="/organizador/comunidad" className="text-[#c27b3d] font-medium hover:underline">
                      Comunidad
                    </Link>
                    .
                  </p>
                </DsInfoPanel>
              </Card>
              ) : null}

              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">C. Colores</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OrganizerLandingColorSelect
                    label="Color principal"
                    value={form.primaryColor ?? "#c27b3d"}
                    defaultHex="#c27b3d"
                    options={ORGANIZER_LANDING_PRIMARY_COLORS}
                    onChange={(hex) => updateField("primaryColor", hex)}
                  />
                  <OrganizerLandingColorSelect
                    label="Color secundario"
                    value={form.secondaryColor ?? "#1f2937"}
                    defaultHex="#1f2937"
                    options={ORGANIZER_LANDING_SECONDARY_COLORS}
                    onChange={(hex) => updateField("secondaryColor", hex)}
                  />
                </div>
              </Card>

              {isModuleEnabled(modules, "contact") ? (
              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">D. Contacto y redes</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                    <Input value={form.city ?? ""} onChange={(e) => updateField("city", e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                    <Input value={form.zone ?? ""} onChange={(e) => updateField("zone", e.target.value)} className="w-full" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email público</label>
                    <Input
                      type="email"
                      value={form.publicEmail ?? ""}
                      onChange={(e) => updateField("publicEmail", e.target.value)}
                      className="w-full"
                      placeholder="contacto@tuevento.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                    <Input value={form.website ?? ""} onChange={(e) => updateField("website", e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                    <Input
                      value={form.instagram ?? ""}
                      onChange={(e) => updateField("instagram", e.target.value)}
                      className="w-full"
                      placeholder="@cuenta o URL"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                    <Input
                      value={form.whatsapp ?? ""}
                      onChange={(e) => updateField("whatsapp", e.target.value)}
                      className="w-full"
                      placeholder="5493412345678"
                    />
                  </div>
                </div>
              </Card>
              ) : null}

              <Card className="p-4 sm:p-6 border border-gray-200 shadow-sm ds-card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">E. SEO básico</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título SEO</label>
                  <Input
                    value={form.seoTitle ?? ""}
                    onChange={(e) => updateField("seoTitle", e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción SEO</label>
                  <Textarea
                    value={form.seoDescription ?? ""}
                    onChange={(e) => updateField("seoDescription", e.target.value)}
                    rows={3}
                  />
                </div>
              </Card>

              {feedback ? (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    feedback.type === "success"
                      ? "bg-green-50 border-green-200 text-green-900"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {feedback.text}
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving}
                  onClick={() => void save()}
                  className="whitespace-nowrap"
                >
                  {saving ? "Guardando…" : "Guardar página"}
                </Button>
              </div>
            </>
          )}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
