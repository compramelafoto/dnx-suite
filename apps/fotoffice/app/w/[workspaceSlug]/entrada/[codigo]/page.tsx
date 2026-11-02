import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { loadPublicSite } from "@/lib/website/public-site";
import { BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { FormularioInscripcion } from "@/components/eventos/formulario-inscripcion";
import { EVENTOS_MODULE_KEY, ESTADO_PAGO_LABEL } from "@/lib/eventos/constants";
import { leerEntrada } from "@/lib/eventos/entrada";
import { qrDeInscripto } from "@/lib/eventos/acreditacion/servicio";
import { textoTerminos, textoUsoDeImagen } from "@/lib/eventos/inscripcion";
import { fechaDeEvento, tieneDiploma } from "@/lib/eventos/reglas";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; codigo: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

// El enlace es personal: no se indexa y su token no sale en el `Referer` hacia otros sitios.
export const metadata: Metadata = { title: "Mi entrada", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * "Mi entrada": el enlace personal del inscripto (`/entrada/<código>?t=<token>`). Es la página de
 * la inscripción confirmada de Clickatón: completa sus datos y su foto, y una vez completos ve el QR
 * de su credencial (el que se escanea en la puerta), su placa de bienvenida y, si corresponde, su
 * diploma.
 */
export default async function EntradaPage({ params, searchParams }: Props) {
  const { workspaceSlug, codigo } = await params;
  const t = (await searchParams).t;
  const token = Array.isArray(t) ? t[0] : t;
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(EVENTOS_MODULE_KEY)) notFound();
  const entrada = await leerEntrada(site.workspaceId, codigo, token);

  if (!entrada || !token) {
    return (
      <BlogFrame>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Este enlace no es válido</h1>
          <p className="mt-3 opacity-75">Abrilo de nuevo desde el correo que te mandamos, o escribinos.</p>
        </div>
      </BlogFrame>
    );
  }

  const ev = entrada.evento;
  const anulada = entrada.estadoPago === "ANULADO";
  const completa = entrada.datosCompletosAt != null && (!ev.pideFoto || entrada.fotoUrl != null);
  const consent = (entrada.consentimientos ?? {}) as { terminos?: string | null; usoDeImagen?: string | null };
  const qrDataUrl = completa && !anulada ? await QRCode.toDataURL(await qrDeInscripto(entrada.id), { margin: 1, width: 520, errorCorrectionLevel: "M" }) : null;
  const base = `/w/${site.workspaceSlug}/entrada/${encodeURIComponent(entrada.codigo)}`;
  const tq = `t=${encodeURIComponent(token)}`;
  const cuando = [fechaDeEvento(ev.fechaInicio, ev.fechaFin), ev.lugar].filter(Boolean).join(" · ");
  const conDiploma = Boolean(ev.diplomaTemplateId) && tieneDiploma(entrada, ev.diplomaPara);

  return (
    <BlogFrame>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <BlogListHeader
          eyebrow={site.commercialName}
          title={ev.nombre}
          description={[cuando, entrada.tipo].filter(Boolean).join(" · ") || null}
        />

        {anulada ? (
          <p className="rounded border p-5" style={{ borderColor: "var(--wsite-primary)" }}>
            Esta entrada está anulada. Si creés que es un error, escribinos.
          </p>
        ) : null}

        {qrDataUrl ? (
          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 rounded-[var(--wsite-button-radius)] border p-5 text-center" style={{ borderColor: "var(--wsite-primary)" }}>
              <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--wsite-primary)" }}>
                Tu credencial
              </p>
              {entrada.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entrada.fotoUrl} alt="Tu foto" className="mx-auto size-24 rounded-full object-cover" />
              ) : null}
              <p className="text-xl font-semibold">{entrada.nombre}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR de tu entrada" className="mx-auto w-56 rounded bg-white p-2" />
              <p className="text-sm opacity-75">
                Código <strong>{entrada.codigo}</strong> · {ESTADO_PAGO_LABEL[entrada.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? entrada.estadoPago}
              </p>
              <p className="text-xs opacity-60">Mostrá este QR en la puerta. Si no tenés señal, sacale una captura.</p>
            </div>
            <div className="space-y-3 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--wsite-primary)" }}>
                Tu placa de bienvenida
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/placa?${tq}`} alt="Tu placa de bienvenida" className="w-full rounded-[var(--wsite-button-radius)]" />
              <a href={`${base}/placa?${tq}&descargar=1`} className="fo-btn fo-btn-primary inline-block" style={{ background: "var(--wsite-primary)" }}>
                Descargar placa
              </a>
              <p className="text-xs opacity-60">Compartila en tus redes y etiquetanos.</p>
              {conDiploma ? (
                <p>
                  <a href={`/w/${site.workspaceSlug}/diploma/${encodeURIComponent(entrada.codigo)}`} className="font-semibold underline" style={{ color: "var(--wsite-primary)" }}>
                    Descargar mi diploma
                  </a>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {!anulada ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{completa ? "Tus datos" : "Completá tu inscripción"}</h2>
            {!completa ? (
              <p className="opacity-75">
                Completá tus datos{ev.pideFoto ? " y subí una foto tuya" : ""}: con eso armamos tu credencial con QR y tu placa de bienvenida.
              </p>
            ) : null}
            <FormularioInscripcion
              modo="entrada"
              workspaceSlug={site.workspaceSlug}
              codigo={entrada.codigo}
              token={token}
              pideFoto={ev.pideFoto}
              textoTerminos={textoTerminos(site.commercialName, ev.nombre)}
              textoImagen={textoUsoDeImagen(site.commercialName)}
              previos={{
                nombre: entrada.nombre,
                email: entrada.email,
                telefono: entrada.telefono,
                dni: entrada.dni,
                instagram: entrada.instagram,
                fotoUrl: entrada.fotoUrl,
                aceptoTerminos: Boolean(consent.terminos),
                aceptoImagen: Boolean(consent.usoDeImagen),
              }}
            />
          </section>
        ) : null}
      </div>
    </BlogFrame>
  );
}
