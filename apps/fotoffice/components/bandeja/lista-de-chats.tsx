import Link from "next/link";
import { Instagram, MessageCircle } from "lucide-react";
import { hrefBandeja, type FiltrosBandeja } from "@/lib/bandeja/filtros";
import type { ChatDeLista } from "@/lib/bandeja/lecturas";
import { ChipEspera } from "./chip-espera";
import { horaDeLista } from "./formato";

/** Ícono del canal a la izquierda del título (con el nombre para lectores de pantalla). */
export function IconoDeCanal({ canal }: { canal: ChatDeLista["canal"] }) {
  const instagram = canal === "INSTAGRAM";
  const Icono = instagram ? Instagram : MessageCircle;
  return (
    <span className={`shrink-0 ${instagram ? "text-[#C13584]" : "text-[#25D366]"}`}>
      <Icono aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{instagram ? "Instagram: " : "WhatsApp: "}</span>
    </span>
  );
}

const CHIP = "inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-medium";

/** Quién atiende, en corto: Bot, el nombre, «Sin asignar» o Resuelto. */
export function ChipQuienAtiende({ chat }: { chat: Pick<ChatDeLista, "estado" | "atiendeElBot" | "asignadoNombre"> }) {
  if (chat.estado === "RESUELTO") return <span className={`${CHIP} border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]`}>Resuelto</span>;
  if (chat.atiendeElBot) return <span className={`${CHIP} border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]`}>Bot</span>;
  if (chat.asignadoNombre) return <span className={`${CHIP} border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]`}>{chat.asignadoNombre}</span>;
  return <span className={`${CHIP} border-[var(--fo-border)] bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]`}>Sin asignar</span>;
}

/** La lista de chats: un enlace por chat que conserva los filtros. `activoId` resalta el chat abierto. */
export function ListaDeChats({
  chats,
  ahora,
  filtros,
  activoId,
  extras,
}: {
  chats: ChatDeLista[];
  ahora: Date;
  filtros: FiltrosBandeja;
  activoId?: string;
  /** Lo que cada etapa suma a la fila (tiempo de espera, campaña, «Nuevo para vos»). */
  extras?: (c: ChatDeLista) => React.ReactNode;
}) {
  if (chats.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--fo-muted)]" role="status">
        No hay chats para mostrar con estos filtros.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--fo-border)]">
      {chats.map((c) => {
        const activo = c.id === activoId;
        return (
          <li key={c.id}>
            <Link
              href={hrefBandeja(filtros, `/bandeja/${c.id}`)}
              aria-current={activo ? "page" : undefined}
              className={`flex flex-col gap-1 px-4 py-3 hover:bg-[var(--fo-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--fo-accent)] ${activo ? "bg-[var(--fo-accent-soft)]" : ""}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <IconoDeCanal canal={c.canal} />
                  <span className={`min-w-0 truncate text-sm ${c.noLeidos > 0 ? "font-semibold" : "font-medium"} text-[var(--fo-text)]`}>{c.titulo}</span>
                </span>
                <time dateTime={c.ultimoMensajeEn.toISOString()} className="shrink-0 text-xs text-[var(--fo-muted)]">
                  {horaDeLista(c.ultimoMensajeEn, ahora)}
                </time>
              </span>
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-[var(--fo-muted)]">
                  {c.fragmento ? (
                    <>
                      {c.fragmento.antes}
                      <mark className="rounded-sm bg-[var(--fo-warning-soft)] px-0.5 text-[var(--fo-text)]">{c.fragmento.coincide}</mark>
                      {c.fragmento.despues}
                    </>
                  ) : (
                    (c.ultimoMensaje ?? "Sin mensajes")
                  )}
                </span>
                {c.noLeidos > 0 ? (
                  <span className="shrink-0 rounded-full bg-[var(--fo-accent)] px-2 py-0.5 text-xs font-semibold text-white">
                    {c.noLeidos}
                    <span className="sr-only"> sin leer</span>
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {c.nuevoParaMi ? (
                  <span className="inline-block rounded-full bg-[var(--fo-warning)] px-2 py-0.5 text-[11px] font-semibold text-white">Nuevo para vos</span>
                ) : null}
                <ChipQuienAtiende chat={c} />
                <ChipEspera chat={c} ahora={ahora} />
                {extras?.(c)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
