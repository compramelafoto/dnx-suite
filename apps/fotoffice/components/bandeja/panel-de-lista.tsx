import { campanasRecientes } from "@/lib/bandeja/campanas";
import { contarAbiertosPorPersona, personasDeLaBandeja } from "@/lib/bandeja/equipo";
import type { FiltrosBandeja as Filtros } from "@/lib/bandeja/filtros";
import { listarChats } from "@/lib/bandeja/lecturas";
import type { CtxBandeja } from "@/lib/bandeja/acceso";
import { FiltrosBandeja } from "./filtros-bandeja";
import { ListaDeChats } from "./lista-de-chats";

/**
 * Columna izquierda de la Bandeja: filtros arriba y la lista con su propio desplazamiento. La
 * dibujan las dos páginas (`/bandeja` y `/bandeja/[chatId]`) con los filtros de la URL, porque los
 * layouts no reciben `searchParams`.
 */
export async function PanelDeLista({ ctx, filtros, base, activoId, ahora }: { ctx: CtxBandeja; filtros: Filtros; base: string; activoId?: string; ahora: Date }) {
  const [chats, personas, abiertos, campanas] = await Promise.all([
    listarChats(ctx, { ...filtros, ahora }),
    personasDeLaBandeja(ctx.workspaceId),
    contarAbiertosPorPersona(ctx.workspaceId),
    campanasRecientes(ctx.workspaceId, ahora),
  ]);
  return (
    <section aria-label="Chats" className="flex min-h-0 flex-col overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
      <div className="border-b border-[var(--fo-border)] p-3">
        <FiltrosBandeja
          filtros={filtros}
          base={base}
          yo={ctx.userId ?? 0}
          personas={personas.map((p) => ({ userId: p.userId, nombre: p.nombre, abiertos: abiertos.get(p.userId) ?? 0 }))}
          campanas={campanas}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ListaDeChats chats={chats ?? []} ahora={ahora} filtros={filtros} activoId={activoId} />
      </div>
    </section>
  );
}
