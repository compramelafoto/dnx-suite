import { EnlaceCliente } from "@/components/entidades/enlace-cliente";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonesDelChat } from "@/components/bandeja/botones-del-chat";
import { ChipEspera } from "@/components/bandeja/chip-espera";
import { BurbujaDeMensaje } from "@/components/bandeja/burbuja-de-mensaje";
import { CajaDeRespuesta } from "@/components/bandeja/caja-de-respuesta";
import { DesplazarAlFinal } from "@/components/bandeja/desplazar-al-final";
import { EnviarPlantilla } from "@/components/bandeja/enviar-plantilla";
import { InsigniaEstado } from "@/components/bandeja/insignia-estado";
import { MarcarLeido } from "@/components/bandeja/marcar-leido";
import { PanelDeLista } from "@/components/bandeja/panel-de-lista";
import { TarjetaResumen } from "@/components/bandeja/tarjeta-resumen";
import { PanelDelCliente } from "@/components/bandeja/panel-del-cliente";
import { RefrescoPeriodico } from "@/components/bandeja/refresco-periodico";
import { personasDeLaBandeja } from "@/lib/bandeja/equipo";
import { hrefBandeja, leerFiltros } from "@/lib/bandeja/filtros";
import { detalleChat } from "@/lib/bandeja/lecturas";
import { requireBandeja } from "@/lib/bandeja/pagina";
import { plantillasDelChat } from "@/lib/bandeja/plantillas";
import { listarRespuestas } from "@/lib/bandeja/respuestas-rapidas";

export const dynamic = "force-dynamic";

/** «hace 3 min», «hace 2 h», «hace 4 días». */
function haceCuanto(d: Date, ahora: Date): string {
  const min = Math.max(0, Math.floor((ahora.getTime() - d.getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.floor(min / 60)} h`;
  const dias = Math.floor(min / (60 * 24));
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/**
 * Una conversación, con la lista al costado en escritorio (estilo WhatsApp Web). Encabezado fijo con
 * las acciones, conversación con su propio desplazamiento y la caja de respuesta siempre abajo. En
 * el teléfono, sólo el chat con «← Volver» (que conserva los filtros). Se refresca cada 5 segundos.
 */
export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx, puedeOperar, puedeOperarClientes } = await requireBandeja();
  const { chatId } = await params;
  const filtros = leerFiltros(await searchParams, ctx.userId);
  const ahora = new Date();
  const chat = await detalleChat(ctx, chatId, ahora);
  if (!chat) notFound();

  const ultimo = chat.mensajes[chat.mensajes.length - 1];
  // Plantillas aprobadas de Meta (sólo WhatsApp): fuera de las 24 h es la única forma de escribir.
  const [plantillas, personas, respuestas] = await Promise.all([
    puedeOperar && chat.canal !== "INSTAGRAM" ? plantillasDelChat(ctx, chat.id) : Promise.resolve([]),
    puedeOperar ? personasDeLaBandeja(ctx.workspaceId) : Promise.resolve([]),
    puedeOperar ? listarRespuestas(ctx) : Promise.resolve([]),
  ]);
  const panelCliente = (
    <PanelDelCliente
      chatId={chat.id}
      cliente={chat.cliente}
      clienteOculto={chat.clienteOculto}
      puedeOperar={puedeOperar}
      puedeCrearContacto={puedeOperarClientes}
      nombrePerfil={chat.nombrePerfil}
      waId={chat.waId}
      canal={chat.canal}
      usuarioInstagram={chat.usuarioInstagram}
    />
  );

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-9rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="hidden min-h-0 flex-col lg:flex">
        <PanelDeLista ctx={ctx} filtros={filtros} base={`/bandeja/${chat.id}`} activoId={chat.id} ahora={ahora} />
      </div>

      <section aria-label="Chat" className="flex min-h-0 flex-col overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] max-lg:h-[calc(100dvh-8rem)]">
        <header className="space-y-2 border-b border-[var(--fo-border)] p-3 sm:p-4">
          <Link href={hrefBandeja(filtros)} className="text-sm text-[var(--fo-accent-hover)] underline lg:hidden">
            ← Volver
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="break-words text-lg font-semibold tracking-tight text-[var(--fo-text)]">
                {/* Con un cliente vinculado, el título es su nombre: lleva a su ficha. */}
                <EnlaceCliente clientId={chat.cliente?.id}>{chat.titulo}</EnlaceCliente>
              </h1>
              <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--fo-muted)]">
                {chat.canal === "INSTAGRAM" ? (
                  <span>
                    Instagram
                    {chat.usuarioInstagram ? (
                      <>
                        {" · "}
                        <a href={`https://instagram.com/${encodeURIComponent(chat.usuarioInstagram)}`} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent-hover)] underline">
                          @{chat.usuarioInstagram}
                        </a>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span>+{chat.waId}</span>
                )}
                <InsigniaEstado estado={chat.estado} atiendeElBot={chat.atiendeElBot} asignadoNombre={chat.asignadoNombre} />
                <ChipEspera chat={chat} ahora={ahora} />
              </p>
            </div>
            {puedeOperar && ctx.userId !== null ? (
              <BotonesDelChat
                chatId={chat.id}
                yo={ctx.userId}
                asignadoUserId={chat.asignadoUserId}
                estado={chat.estado}
                atiendeElBot={chat.atiendeElBot}
                botExcluido={chat.botExcluido}
                personas={personas.filter((p) => p.puedeOperar).map((p) => ({ userId: p.userId, nombre: p.nombre }))}
              />
            ) : null}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--fo-accent-hover)]">Datos del cliente</summary>
            <div className="mt-2">{panelCliente}</div>
          </details>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3 sm:p-4" aria-label="Conversación">
          <TarjetaResumen chatId={chat.id} resumen={chat.resumen} haceTexto={chat.resumenEn ? haceCuanto(chat.resumenEn, ahora) : null} puedeActualizar={puedeOperar} />
          {chat.mensajes.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay mensajes.</p>
          ) : (
            <ol className="space-y-2">
              {chat.mensajes.map((m) => (
                <BurbujaDeMensaje key={m.id} mensaje={m} verificarEn={puedeOperar ? chat.id : undefined} />
              ))}
            </ol>
          )}
          <DesplazarAlFinal clave={ultimo?.id ?? "vacio"} />
        </div>

        <footer className="space-y-2 border-t border-[var(--fo-border)] p-3 sm:p-4">
          {puedeOperar ? (
            <>
              <CajaDeRespuesta
                chatId={chat.id}
                dentroDeVentana={chat.dentroDeVentana}
                ultimoMensajeId={ultimo?.id ?? null}
                canal={chat.canal}
                respuestas={respuestas ?? []}
                nombreCliente={chat.cliente?.nombre ?? chat.nombrePerfil}
              />
              {chat.canal !== "INSTAGRAM" ? (
                <details open={!chat.dentroDeVentana} className="text-sm">
                  <summary className="cursor-pointer text-[var(--fo-accent-hover)]">Enviar una plantilla</summary>
                  <div className="mt-2">
                    <EnviarPlantilla chatId={chat.id} plantillas={plantillas} abierta={!chat.dentroDeVentana} />
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <p role="status" className="text-sm text-[var(--fo-muted)]">
              Tenés permiso para ver la bandeja, pero no para responder.
            </p>
          )}
        </footer>
      </section>

      <MarcarLeido chatId={chat.id} noLeidos={chat.noLeidos} />
      <RefrescoPeriodico segundos={5} />
    </div>
  );
}
