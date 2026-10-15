import "server-only";
import { isSpotlightEnabled, loadCurrentSpotlight } from "./repository";
import { buildSpotlightCard } from "./view";
import { spotlightWeekLabel, spotlightWeekStart } from "./week";
import type { MemberOfWeekData } from "@/lib/website/dynamic-data";

/**
 * El socio de la semana para el sitio público.
 *
 * No elige: si nadie entró al panel y la tarea no corrió, el sitio muestra lo que haya. Elegir
 * desde una página que visita cualquiera abriría la rotación a los robots de búsqueda.
 *
 * `card: null` cuando no hay socio o no dio permiso para aparecer en público: el bloque no se
 * dibuja esa semana.
 */
export async function loadPublicMemberOfWeek(input: {
  workspaceId: string;
  institution: string;
  now?: Date;
}): Promise<MemberOfWeekData> {
  const now = input.now ?? new Date();
  const weekLabel = spotlightWeekLabel(spotlightWeekStart(now));
  if (!(await isSpotlightEnabled(input.workspaceId))) return { card: null, weekLabel };
  const destacado = await loadCurrentSpotlight(input.workspaceId, now);
  if (!destacado) return { card: null, weekLabel };
  const card = buildSpotlightCard({
    member: destacado.member,
    about: destacado.about,
    portfolioPath: destacado.portfolioPath,
    institution: input.institution,
    audience: "public",
  });
  return { card, weekLabel };
}
