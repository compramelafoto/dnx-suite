import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";

export type InsigniaFicha = { texto: string; href?: string };

export type EncabezadoFichaProps = {
  titulo: string;
  /** "Cliente N° 12", "Socio N° 40 · Activo"… */
  subtitulo?: string;
  /** Iniciales para el círculo de la izquierda; sin ellas no se muestra. */
  iniciales?: string;
  /** Datos cortos con enlace opcional: "También es socio N° 40" → la otra ficha. */
  insignias?: InsigniaFicha[];
  telefono?: string | null;
  correo?: string | null;
  /** Botones de cada módulo (Volver, Editar, Cambiar estado…). */
  acciones?: ReactNode;
  /** Las etiquetas de la persona (el componente `Etiquetas`). */
  etiquetas?: ReactNode;
};

function telParaLlamar(telefono: string): string {
  return telefono.replace(/[^\d+]/g, "");
}

/** Nombre, tipo, etiquetas, contacto directo (llamar, WhatsApp, correo) y acciones. */
export function EncabezadoFicha({ titulo, subtitulo, iniciales, insignias, telefono, correo, acciones, etiquetas }: EncabezadoFichaProps) {
  const tel = telefono?.trim() ? telParaLlamar(telefono) : "";
  const whatsapp = buildWhatsappUrl(telefono);
  const mail = correo?.trim() ?? "";
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        {iniciales ? (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-xl font-semibold text-[var(--fo-accent)]"
            aria-hidden
          >
            {iniciales}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">{titulo}</h1>
          {subtitulo ? <p className="text-sm text-[var(--fo-muted)]">{subtitulo}</p> : null}
          {insignias && insignias.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {insignias.map((i) => (
                <li key={i.texto} className="rounded-full bg-[var(--fo-surface-muted)] px-2.5 py-0.5 text-[var(--fo-text-secondary)]">
                  {i.href ? (
                    <Link href={i.href} className="hover:underline">
                      {i.texto}
                    </Link>
                  ) : (
                    i.texto
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>

      {tel || mail ? (
        <div className="flex flex-wrap gap-2" aria-label="Contacto">
          {tel ? (
            <a href={`tel:${tel}`} className="fo-btn fo-btn-secondary !min-h-8 text-xs">
              <Phone className="size-3.5" aria-hidden />
              Llamar <span className="sr-only">al</span> {telefono}
            </a>
          ) : null}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-secondary !min-h-8 text-xs">
              <MessageCircle className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          {mail ? (
            <a href={`mailto:${mail}`} className="fo-btn fo-btn-secondary !min-h-8 text-xs">
              <Mail className="size-3.5" aria-hidden />
              {mail}
            </a>
          ) : null}
        </div>
      ) : null}

      {etiquetas}
    </header>
  );
}
