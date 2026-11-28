import { MessageCircle } from "lucide-react";
import { PanelDeLista } from "@/components/bandeja/panel-de-lista";
import { RefrescoPeriodico } from "@/components/bandeja/refresco-periodico";
import { leerFiltros } from "@/lib/bandeja/filtros";
import { requireBandeja } from "@/lib/bandeja/pagina";

export const dynamic = "force-dynamic";

/**
 * Bandeja (estilo WhatsApp Web): en escritorio, la lista a la izquierda y el lugar del chat a la
 * derecha; en el teléfono, sólo la lista. Los filtros van en la URL. Se refresca cada 10 segundos.
 */
export default async function BandejaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { ctx } = await requireBandeja();
  const filtros = leerFiltros(await searchParams, ctx.userId);
  const ahora = new Date();
  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-9rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
      <h1 className="sr-only">Bandeja de WhatsApp</h1>
      <div className="flex min-h-0 flex-col max-lg:h-[calc(100dvh-8rem)]">
        <PanelDeLista ctx={ctx} filtros={filtros} base="/bandeja" ahora={ahora} />
      </div>
      <div className="hidden min-h-0 items-center justify-center rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border)] text-center lg:flex">
        <div className="space-y-2 p-6 text-[var(--fo-muted)]">
          <MessageCircle aria-hidden="true" className="mx-auto h-8 w-8" />
          <p className="text-sm">Elegí un chat de la lista para verlo y responder.</p>
        </div>
      </div>
      <RefrescoPeriodico segundos={10} />
    </div>
  );
}
