"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import EscolarQuickLinks from "@/components/photographer/workspace/EscolarQuickLinks";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import {
  formatLeadDateAR,
  schoolLeadStatusLabel,
  type EscolarLandingStatus,
} from "@/lib/schools/photographer-escolar-landing";

type SchoolLeadRow = {
  id: number;
  schoolName: string;
  city: string;
  contactName: string;
  contactRole: string | null;
  email: string | null;
  whatsapp: string;
  approxStudents: number | null;
  message: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

type PanelData = {
  landing: EscolarLandingStatus;
  profile: { publicPageHandler: string | null; companyName: string | null };
  leads: SchoolLeadRow[];
};

function whatsappHref(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export default function FotografoLandingEscolarPage() {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<any>(null);
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((p) => p && active && setPhotographer(p))
        .catch(() => {});
      try {
        const res = await fetch("/api/fotografo/school-leads", { credentials: "include", cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !json) {
          setLoadError(json?.error || "No pudimos cargar tu landing escolar.");
        } else {
          setData(json as PanelData);
        }
      } catch {
        if (active) setLoadError("No pudimos cargar tu landing escolar.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  const landingUrl = data?.landing.available ? data.landing.url : null;

  useEffect(() => {
    if (!landingUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(landingUrl, { width: 512, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [landingUrl]);

  async function copyUrl() {
    if (!landingUrl) return;
    try {
      await navigator.clipboard.writeText(landingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-8">
        <DsDashboardInner className="space-y-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Mi landing escolar</h1>
            <p className="ds-readable-text ds-readable-text--fluid text-gray-600">
              Es una página lista para mandarle a los colegios: presenta tu servicio de fotografía escolar con
              preventa para las familias y cuidado de los datos de los chicos, sin que tengas que armar nada a mano.
              Las consultas que dejan los colegios te aparecen acá abajo.
            </p>
          </div>

          <EscolarQuickLinks />

          {loading ? (
            <p className="text-gray-600">Cargando…</p>
          ) : loadError || !data ? (
            <Card className="p-6">
              <p className="text-red-700 m-0">{loadError || "No pudimos cargar tu landing escolar."}</p>
            </Card>
          ) : (
            <>
              {/* a) Dirección de la landing */}
              <Card className="p-5 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">Dirección de tu landing</h2>
                {data.landing.available && landingUrl ? (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="flex-1 min-w-0 space-y-3">
                      <p className="font-mono text-sm break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 m-0">
                        {landingUrl}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={copyUrl}>
                          {copied ? "¡Copiada!" : "Copiar dirección"}
                        </Button>
                        <a href={landingUrl} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="primary">
                            Ver mi landing
                          </Button>
                        </a>
                        {qrDataUrl ? (
                          <a href={qrDataUrl} download={`qr-landing-escolar-${data.profile.publicPageHandler ?? "fotografo"}.png`}>
                            <Button type="button" variant="secondary">
                              Descargar QR
                            </Button>
                          </a>
                        ) : null}
                      </div>
                    </div>
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Código QR de tu landing escolar"
                        className="h-36 w-36 shrink-0 rounded-lg border border-gray-200 bg-white p-2"
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p
                      className="font-mono text-sm break-all rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-gray-400 m-0"
                      aria-disabled="true"
                    >
                      {data.landing.url ?? "https://www.compramelafoto.com/<tu-dirección>/escolar"}
                    </p>
                    <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2 m-0">
                      Tu landing todavía no está disponible. {data.landing.unavailableReason}
                    </p>
                  </div>
                )}
              </Card>

              {/* b) Checklist */}
              <Card className="p-5 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 m-0">
                  Qué le falta a tu landing{" "}
                  <span className="text-sm font-normal text-gray-500">
                    {data.landing.pendingCount === 0
                      ? "(¡está completa!)"
                      : `(${data.landing.pendingCount} pendiente${data.landing.pendingCount === 1 ? "" : "s"})`}
                  </span>
                </h2>
                <ul className="divide-y divide-gray-100 m-0 p-0 list-none">
                  {data.landing.checklist.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          item.done ? "bg-green-100 text-green-700" : item.required ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}
                        aria-hidden="true"
                      >
                        {item.done ? "✓" : "!"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-medium text-gray-900">
                          {item.label}
                          {!item.done && item.required ? (
                            <span className="ml-2 text-xs font-normal text-red-700">(sin esto la landing no se ve)</span>
                          ) : null}
                        </p>
                        <p className="m-0 mt-0.5 text-xs text-gray-500">{item.hint}</p>
                      </div>
                      {!item.done ? (
                        <Link href={item.href} className="shrink-0 text-sm font-medium text-[#c27b3d] hover:underline">
                          Completar →
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>

              {/* c) Consultas de colegios */}
              <Card className="p-5 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 m-0">
                  Consultas de colegios{" "}
                  <span className="text-sm font-normal text-gray-500">({data.leads.length})</span>
                </h2>
                {data.leads.length === 0 ? (
                  <p className="text-sm text-gray-600 m-0">
                    Todavía no llegaron consultas. Compartí la dirección de tu landing con los colegios para empezar a
                    recibirlas.
                  </p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-3">
                    {data.leads.map((lead) => {
                      const wa = whatsappHref(lead.whatsapp);
                      return (
                        <li key={lead.id} className="rounded-lg border border-gray-200 bg-white p-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="m-0 font-semibold text-gray-900">{lead.schoolName}</p>
                              <p className="m-0 text-sm text-gray-600">{lead.city}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-xs">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                {schoolLeadStatusLabel(lead.status)}
                              </span>
                              <span className="text-gray-500">{formatLeadDateAR(lead.createdAt)}</span>
                            </div>
                          </div>
                          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            <div className="min-w-0">
                              <dt className="inline text-gray-500">Contacto: </dt>
                              <dd className="inline m-0 text-gray-900">
                                {lead.contactName}
                                {lead.contactRole ? ` (${lead.contactRole})` : ""}
                              </dd>
                            </div>
                            <div className="min-w-0 break-all">
                              <dt className="inline text-gray-500">Email: </dt>
                              <dd className="inline m-0">
                                {lead.email ? (
                                  <a href={`mailto:${lead.email}`} className="text-[#c27b3d] hover:underline">
                                    {lead.email}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="inline text-gray-500">WhatsApp: </dt>
                              <dd className="inline m-0">
                                {wa ? (
                                  <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[#c27b3d] hover:underline">
                                    {lead.whatsapp}
                                  </a>
                                ) : (
                                  lead.whatsapp || "—"
                                )}
                              </dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="inline text-gray-500">Alumnos aprox.: </dt>
                              <dd className="inline m-0 text-gray-900">{lead.approxStudents ?? "—"}</dd>
                            </div>
                          </dl>
                          {lead.message ? (
                            <p className="mt-3 mb-0 whitespace-pre-line rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                              {lead.message}
                            </p>
                          ) : null}
                          {lead.notes ? (
                            <p className="mt-2 mb-0 whitespace-pre-line text-xs text-gray-500">{lead.notes}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </>
          )}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
