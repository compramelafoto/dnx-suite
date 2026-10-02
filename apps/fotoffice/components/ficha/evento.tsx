import Link from "next/link";
import { History, IdCard, Mail, MessageCircle, Paperclip, StickyNote, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { MensajeRegistrado } from "@/components/mensajes/mensaje-registrado";
import type { EventoFichaWire, TipoEvento } from "@/lib/ficha/linea-de-tiempo";
import { fechaHoraBA } from "@/lib/ficha/formato";

const ICONOS: Record<TipoEvento, LucideIcon> = {
  notas: StickyNote,
  cambios: History,
  mensajes: Mail,
  plata: Wallet,
  portal: UserRound,
  carnets: IdCard,
  adjuntos: Paperclip,
};

/** Un hecho de la línea de tiempo que no es una nota: título, quién y cuándo, y el detalle. */
export function Evento({ evento }: { evento: EventoFichaWire }) {
  // Los mensajes llevan el ícono de su canal.
  const Icono = evento.mensaje?.canal === "WHATSAPP" ? MessageCircle : (ICONOS[evento.tipo] ?? History);
  return (
    <div className="flex gap-3 py-3">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
        aria-hidden
      >
        <Icono className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-[var(--fo-text)]">{evento.titulo}</p>
        <p className="text-xs text-[var(--fo-muted)]">
          {evento.actor ? `${evento.actor} · ` : ""}
          <time dateTime={evento.fecha}>{fechaHoraBA(evento.fecha)}</time>
        </p>
        {evento.mensaje ? (
          <div className="mt-1">
            <MensajeRegistrado mensaje={evento.mensaje} />
          </div>
        ) : null}
        {evento.detalle ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-[var(--fo-text-secondary)]">{evento.detalle}</p>
        ) : null}
        {evento.cambios && evento.cambios.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-[var(--fo-text-secondary)]">
            {evento.cambios.map((c, i) => (
              <li key={`${c.campo}-${i}`} className="break-words">
                <span className="text-[var(--fo-muted)]">{c.campo}:</span> {c.antes || "—"} → {c.despues || "—"}
              </li>
            ))}
          </ul>
        ) : null}
        {evento.enlace ? (
          <Link href={evento.enlace} className="mt-1 inline-block text-xs font-medium text-[var(--fo-accent)] hover:underline">
            Ver detalle
          </Link>
        ) : null}
      </div>
    </div>
  );
}
