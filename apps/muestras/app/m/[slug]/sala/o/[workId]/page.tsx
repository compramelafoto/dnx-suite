import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workPath } from "@repo/muestras";
import { ContarVisita } from "@/components/estadisticas/contar-visita";
import { ObraDeSala } from "@/components/sala/obra-de-sala";
import { AvisoDeSala } from "@/components/sala/aviso-de-sala";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { MUCHAS_CONSULTAS, MUCHA_GENTE_EN_LA_RED, frenarEnSala } from "@/lib/sala/freno";
import { paseDeSala, vistaDeSala } from "@/lib/sala/consultas";

// Lee la cookie del pase: dinámica y privada. Nunca en caché, nunca indexada.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; workId: string }> };

// Título fijo: los metadatos no vuelven a leer el pase ni la base (y no esquivan el freno de la
// página). Sin `openGraph` con imagen: compartir la dirección no adelanta la obra.
export const metadata: Metadata = { title: "En la sala", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * La obra con el pase de sala (spec D31). Sin pase (o vencido, de otra muestra, o la obra fuera de
 * lo que deja ver): a la página pública de la obra, que respeta la sorpresa.
 */
export default async function ObraEnLaSala({ params }: Props) {
  const { slug, workId } = await params;
  const publica = workPath(slug, workId);
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("vistaSalaRed", ip).allowed) return <AvisoDeSala texto={MUCHA_GENTE_EN_LA_RED} volver={`/m/${encodeURIComponent(slug)}`} />;
  const p = await paseDeSala(slug);
  if (p && !frenarEnSala("vistaSala", p, ip)) return <AvisoDeSala texto={MUCHAS_CONSULTAS} volver={`/m/${encodeURIComponent(slug)}`} />;
  const v = p ? await vistaDeSala(p, workId) : null;
  if (!v) redirect(publica);
  return (
    <main className="mf-marco space-y-8 py-8 sm:py-12">
      <ContarVisita actividad={v.muestra.id} obra={v.obra.id} />
      <p className="text-sm text-[var(--mf-muted)]">En la sala · {v.muestra.title}</p>
      <ObraDeSala d={v} />
    </main>
  );
}
