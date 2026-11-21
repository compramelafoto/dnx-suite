import { openingIcs, rsvpState } from "@repo/muestras";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { eventoDeInauguracion, invitacionPublica } from "@/lib/inauguracion/consultas";

export const dynamic = "force-dynamic";

/** Archivo de calendario de la inauguración (D19). Lo abre cualquier teléfono. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await invitacionPublica(slug);
  const evento = a && rsvpState(a, new Date()) !== "UNAVAILABLE" ? eventoDeInauguracion(a, baseUrlPublica()) : null;
  if (!a || !evento) return new Response("No encontramos esta inauguración.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(openingIcs(evento), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="inauguracion-${a.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
