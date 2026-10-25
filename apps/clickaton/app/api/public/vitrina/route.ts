import { NextResponse } from "next/server";
import { listPublicMarathons } from "@/data/public-marathons";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import type { PublicMarathon } from "@/types/marathon";

/**
 * Las ediciones de Clickatón para la vitrina de concursos de otras plataformas de la suite
 * (FOTOFFICE la muestra en el portal de cada institución).
 *
 * Sólo lo que ya es público: lo mismo que lista `/maratones`, sin demos ni ediciones ocultas,
 * y sólo las que todavía le sirven a un fotógrafo (anunciadas, con inscripción abierta o en
 * curso). No expone nada que la ficha pública no muestre.
 */

/**
 * Dinámica a propósito: si Next la prerenderiza al compilar, consulta la base en el build, y los
 * builds de vista previa no tienen `DATABASE_URL` (se cortaban todos desde el PR 392). El caché
 * de 5 minutos lo da el CDN con el `Cache-Control` de la respuesta, igual que antes.
 */
export const dynamic = "force-dynamic";

const VIGENTES: ReadonlySet<PublicMarathon["status"]> = new Set([
  "announced",
  "registration_open",
  "registration_closed",
  "in_progress",
]);

function absoluta(origen: string, url: string | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${origen}${url}`;
  return null;
}

export async function GET() {
  const origen = resolveClickatonPublicOrigin();
  const maratones = await listPublicMarathons();
  const ediciones = maratones
    .filter((m) => !m.isDemo && !m.isUnlisted && VIGENTES.has(m.status))
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      editionName: m.editionName,
      shortDescription: m.shortDescription,
      city: m.city,
      startAt: m.startAt,
      registrationCloseAt: m.registrationCloseAt ?? null,
      status: m.status,
      registrationStatus: m.registrationStatus,
      coverImage: absoluta(origen, m.coverImage),
      url: `${origen}/maratones/${m.slug}`,
    }));
  return NextResponse.json(
    { editions: ediciones },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
