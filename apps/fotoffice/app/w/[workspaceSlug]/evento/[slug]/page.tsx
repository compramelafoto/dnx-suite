import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicSite } from "@/lib/website/public-site";
import { BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { FormularioInscripcion } from "@/components/eventos/formulario-inscripcion";
import { EVENTOS_MODULE_KEY } from "@/lib/eventos/constants";
import { textoTerminos, textoUsoDeImagen } from "@/lib/eventos/inscripcion";
import { fechaDeEvento } from "@/lib/eventos/reglas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; slug: string }> };

async function cargar(workspaceSlug: string, slug: string) {
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(EVENTOS_MODULE_KEY)) return null;
  const evento = await prisma.fotofficeEvento.findFirst({ where: { workspaceId: site.workspaceId, slug, archivado: false } });
  return evento ? { site, evento } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, slug } = await params;
  const c = await cargar(workspaceSlug, slug);
  if (!c) return { title: "Inscripción" };
  return { title: `Inscripción · ${c.evento.nombre}`, description: `Inscribite a ${c.evento.nombre} de ${c.site.commercialName}.` };
}

/**
 * La página pública de inscripción de un evento (`/evento/<slug>`): el asistente de inscripción de
 * Clickatón, sin el pago. Quien se anota queda con el pago pendiente (la organización lo cobra o lo
 * marca como cortesía) y va directo a su entrada.
 */
export default async function EventoInscripcionPage({ params }: Props) {
  const { workspaceSlug, slug } = await params;
  const c = await cargar(workspaceSlug, slug);
  if (!c) notFound();
  const { site, evento } = c;
  const cuando = [fechaDeEvento(evento.fechaInicio, evento.fechaFin), evento.lugar].filter(Boolean).join(" · ");
  const lleno =
    evento.cupo != null &&
    (await prisma.fotofficeEventoInscripto.count({ where: { eventoId: evento.id, estadoPago: { not: "ANULADO" } } })) >= evento.cupo;

  return (
    <BlogFrame>
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <BlogListHeader eyebrow="Inscripción" title={evento.nombre} description={cuando || null} />
        {!evento.inscripcionPublica ? (
          <p className="rounded border p-5" style={{ borderColor: "var(--wsite-primary)" }}>
            La inscripción a este evento está cerrada.
          </p>
        ) : lleno ? (
          <p className="rounded border p-5" style={{ borderColor: "var(--wsite-primary)" }}>
            No quedan lugares para este evento.
          </p>
        ) : (
          <FormularioInscripcion
            modo="publica"
            workspaceSlug={site.workspaceSlug}
            eventoSlug={slug}
            pideFoto={evento.pideFoto}
            textoTerminos={textoTerminos(site.commercialName, evento.nombre)}
            textoImagen={textoUsoDeImagen(site.commercialName)}
          />
        )}
      </div>
    </BlogFrame>
  );
}
