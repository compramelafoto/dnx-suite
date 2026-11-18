import Link from "next/link";
import { Instagram, MessageCircle } from "lucide-react";
import type { ChatDeLista } from "@/lib/bandeja/lecturas";
import { horaDeLista } from "./formato";
import { InsigniaEstado } from "./insignia-estado";

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

/** La lista de chats: un enlace por chat, sin tabla ancha (se apila en el teléfono). */
export function ListaDeChats({ chats, ahora }: { chats: ChatDeLista[]; ahora: Date }) {
  if (chats.length === 0) {
    return (
      <p className="fo-card text-sm text-[var(--fo-muted)]" role="status">
        No hay chats para mostrar con este filtro.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--fo-border)] overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
      {chats.map((c) => (
        <li key={c.id}>
          <Link
            href={`/bandeja/${c.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--fo-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
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
              <span className="min-w-0 truncate text-sm text-[var(--fo-muted)]">{c.ultimoMensaje ?? "Sin mensajes"}</span>
              {c.noLeidos > 0 ? (
                <span className="shrink-0 rounded-full bg-[var(--fo-accent)] px-2 py-0.5 text-xs font-semibold text-white">
                  {c.noLeidos}
                  <span className="sr-only"> sin leer</span>
                </span>
              ) : null}
            </span>
            <span>
              <InsigniaEstado estado={c.estado} atiendeElBot={c.atiendeElBot} asignadoNombre={c.asignadoNombre} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
