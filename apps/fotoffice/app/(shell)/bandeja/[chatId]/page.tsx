import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonesDelChat } from "@/components/bandeja/botones-del-chat";
import { BurbujaDeMensaje } from "@/components/bandeja/burbuja-de-mensaje";
import { CajaDeRespuesta } from "@/components/bandeja/caja-de-respuesta";
import { DesplazarAlFinal } from "@/components/bandeja/desplazar-al-final";
import { InsigniaEstado } from "@/components/bandeja/insignia-estado";
import { MarcarLeido } from "@/components/bandeja/marcar-leido";
import { PanelDelCliente } from "@/components/bandeja/panel-del-cliente";
import { RefrescoPeriodico } from "@/components/bandeja/refresco-periodico";
import { detalleChat } from "@/lib/bandeja/lecturas";
import { requireBandeja } from "@/lib/bandeja/pagina";

export const dynamic = "force-dynamic";

/** Una conversación: burbujas por autor, caja de respuesta, acciones y panel del cliente. Se refresca cada 5 segundos. */
export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { ctx, puedeOperar } = await requireBandeja();
  const { chatId } = await params;
  const chat = await detalleChat(ctx, chatId);
  if (!chat) notFound();

  const esMio = chat.estado === "HUMANO" && chat.asignadoUserId === ctx.userId;
  const ultimo = chat.mensajes[chat.mensajes.length - 1];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link href="/bandeja" className="text-sm text-[var(--fo-accent-hover)] underline">
          ← Volver a la bandeja
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--fo-text)]">{chat.titulo}</h1>
            <p className="text-sm text-[var(--fo-muted)]">+{chat.waId}</p>
            <InsigniaEstado estado={chat.estado} atiendeElBot={chat.atiendeElBot} asignadoNombre={chat.asignadoNombre} />
          </div>
          {puedeOperar ? (
            <BotonesDelChat
              chatId={chat.id}
              puedeTomar={!esMio}
              puedeDevolver={chat.estado !== "BOT"}
              puedeResolver={chat.estado !== "RESUELTO"}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Conversación" className="fo-card max-h-[60vh] overflow-y-auto overflow-x-hidden !p-3 sm:!p-4">
            {chat.mensajes.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">Todavía no hay mensajes.</p>
            ) : (
              <ol className="space-y-2">
                {chat.mensajes.map((m) => (
                  <BurbujaDeMensaje key={m.id} mensaje={m} />
                ))}
              </ol>
            )}
            <DesplazarAlFinal clave={ultimo?.id ?? "vacio"} />
          </section>
          {puedeOperar ? (
            <CajaDeRespuesta chatId={chat.id} dentroDeVentana={chat.dentroDeVentana} />
          ) : (
            <p role="status" className="text-sm text-[var(--fo-muted)]">
              Tenés permiso para ver la bandeja, pero no para responder.
            </p>
          )}
        </div>
        <aside className="min-w-0">
          <PanelDelCliente
            chatId={chat.id}
            cliente={chat.cliente}
            clienteOculto={chat.clienteOculto}
            puedeOperar={puedeOperar}
            nombrePerfil={chat.nombrePerfil}
            waId={chat.waId}
          />
        </aside>
      </div>

      <MarcarLeido chatId={chat.id} noLeidos={chat.noLeidos} />
      <RefrescoPeriodico segundos={5} />
    </div>
  );
}
