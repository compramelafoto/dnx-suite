import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workPath } from "@repo/muestras";
import { ContarVisita } from "@/components/estadisticas/contar-visita";
import { ObraDeSala } from "@/components/sala/obra-de-sala";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { paseDeSala, vistaDeSala } from "@/lib/sala/consultas";

// Lee la cookie del pase: dinámica y privada. Nunca en caché, nunca indexada.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; workId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, workId } = await params;
  const p = await paseDeSala(slug).catch(() => null);
  const v = p ? await vistaDeSala(p, workId).catch(() => null) : null;
  // Sin `openGraph` con imagen: compartir la dirección no adelanta la obra.
  return { title: v ? `${v.obra.title} · en la sala` : "En la sala", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * La obra con el pase de sala (spec D31). Sin pase (o vencido, de otra muestra, o la obra fuera de
 * lo que deja ver): a la página pública de la obra, que respeta la sorpresa.
 */
export default async function ObraEnLaSala({ params }: Props) {
  const { slug, workId } = await params;
  const publica = workPath(slug, workId);
  if (!frenarPorIp("vistaSala", ipDeLaPeticion(await headers())).allowed) redirect(publica);
  const p = await paseDeSala(slug);
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
