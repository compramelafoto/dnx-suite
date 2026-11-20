import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { waIdDe } from "@/lib/bandeja/telefono";
import type { DestinoWhatsapp } from "@/lib/bandeja/destino-whatsapp";

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
  /**
   * A dónde lleva «Enviar WhatsApp» (la Bandeja si hay chat abierto, o WhatsApp Web). Sin esto,
   * WhatsApp Web; con `null`, el teléfono no sirve para WhatsApp y no hay botón.
   */
  whatsapp?: DestinoWhatsapp | null;
};

function telParaLlamar(telefono: string): string {
  return telefono.replace(/[^\d+]/g, "");
}

/** Nombre, tipo, etiquetas, contacto directo (llamar, WhatsApp, correo) y acciones. */
export function EncabezadoFicha({ titulo, subtitulo, iniciales, insignias, telefono, correo, acciones, etiquetas, whatsapp: destino }: EncabezadoFichaProps) {
  const tel = telefono?.trim() ? telParaLlamar(telefono) : "";
  // `waIdDe` entiende los números argentinos escritos a mano ("3402560626", "0341 15 …"):
  // los teléfonos de las fichas casi nunca traen el +54.
  const waId = waIdDe(telefono);
  const whatsapp: DestinoWhatsapp | null =
    destino !== undefined ? destino : waId ? { tipo: "web", href: `https://wa.me/${waId}` } : null;
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
            <a
              href={whatsapp.href}
              {...(whatsapp.tipo === "web" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              title={whatsapp.tipo === "bandeja" ? "Abrir el chat en la Bandeja" : "Abrir WhatsApp Web"}
              className="fo-btn !min-h-8 border border-transparent bg-[#1f9d55] text-xs text-white hover:brightness-110"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Enviar WhatsApp
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
