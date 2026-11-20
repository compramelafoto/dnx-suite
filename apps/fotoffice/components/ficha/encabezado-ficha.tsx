import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { waIdDe } from "@/lib/bandeja/telefono";
import type { DestinoWhatsapp } from "@/lib/bandeja/destino-whatsapp";
import { VentanaEdicion } from "./ventana-edicion";

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
  /** Botones de cada módulo (Volver, Cambiar estado…). */
  acciones?: ReactNode;
  /** Las etiquetas de la persona (el componente `Etiquetas`). */
  etiquetas?: ReactNode;
  /**
   * A dónde lleva «Enviar WhatsApp» (la Bandeja si hay chat abierto, o WhatsApp Web). Sin esto,
   * WhatsApp Web; con `null`, el teléfono no sirve para WhatsApp y no hay botón.
   */
  whatsapp?: DestinoWhatsapp | null;
  /**
   * Más botones de ícono al lado de llamar y WhatsApp (correo desde el sistema, plantillas,
   * testimonio, cuestionarios…). Si trae el correo, no se agrega el `mailto:`.
   */
  herramientas?: ReactNode;
  /** `herramientas` ya incluye un botón de correo: no mostrar el `mailto:`. */
  correoEnHerramientas?: boolean;
  /** Contenido de la ventana del lápiz (todos los datos para editar). Sin esto, no hay lápiz. */
  edicion?: ReactNode;
  /** La ventana del lápiz se abre sola al entrar (un guardado volvió con error). */
  edicionAbierta?: boolean;
};

function telParaLlamar(telefono: string): string {
  return telefono.replace(/[^\d+]/g, "");
}

/**
 * Nombre con su lápiz (abre la ventana de datos), contacto directo como botones de ícono con su
 * leyenda al pasar el mouse (llamar, WhatsApp, correo y lo que sume cada módulo), etiquetas y
 * acciones del módulo.
 */
export function EncabezadoFicha({
  titulo,
  subtitulo,
  iniciales,
  insignias,
  telefono,
  correo,
  acciones,
  etiquetas,
  whatsapp: destino,
  herramientas,
  correoEnHerramientas = false,
  edicion,
  edicionAbierta = false,
}: EncabezadoFichaProps) {
  const tel = telefono?.trim() ? telParaLlamar(telefono) : "";
  // `waIdDe` entiende los números argentinos escritos a mano ("3402560626", "0341 15 …"):
  // los teléfonos de las fichas casi nunca traen el +54.
  const waId = waIdDe(telefono);
  const whatsapp: DestinoWhatsapp | null =
    destino !== undefined ? destino : waId ? { tipo: "web", href: `https://wa.me/${waId}` } : null;
  const mail = correo?.trim() ?? "";
  const hayContacto = Boolean(tel || whatsapp || (mail && !correoEnHerramientas) || herramientas);

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
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">{titulo}</h1>
            {edicion ? (
              <VentanaEdicion titulo={`Datos de ${titulo}`} abiertaAlInicio={edicionAbierta}>
                {edicion}
              </VentanaEdicion>
            ) : null}
          </div>
          {subtitulo || (insignias && insignias.length > 0) ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fo-muted)]">
              {subtitulo ? <span>{subtitulo}</span> : null}
              {insignias?.map((i) => (
                <span key={i.texto} className="rounded-full bg-[var(--fo-surface-muted)] px-2.5 py-0.5 text-xs text-[var(--fo-text-secondary)]">
                  {i.href ? (
                    <Link href={i.href} className="hover:underline">
                      {i.texto}
                    </Link>
                  ) : (
                    i.texto
                  )}
                </span>
              ))}
            </div>
          ) : null}
          {hayContacto ? (
            <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Contacto">
              {tel ? (
                <a href={`tel:${tel}`} className="fo-icon-btn" data-tip={`Llamar al ${telefono}`} aria-label={`Llamar al ${telefono}`}>
                  <Phone className="size-4" aria-hidden />
                </a>
              ) : null}
              {whatsapp ? (
                <a
                  href={whatsapp.href}
                  {...(whatsapp.tipo === "web" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="fo-icon-btn !border-transparent !bg-[#1f9d55] !text-white hover:!brightness-110"
                  data-tip={whatsapp.tipo === "bandeja" ? "Enviar WhatsApp (abre el chat en la Bandeja)" : "Enviar WhatsApp"}
                  aria-label="Enviar WhatsApp"
                >
                  <MessageCircle className="size-4" aria-hidden />
                </a>
              ) : null}
              {mail && !correoEnHerramientas ? (
                <a href={`mailto:${mail}`} className="fo-icon-btn" data-tip={`Escribir a ${mail}`} aria-label={`Escribir a ${mail}`}>
                  <Mail className="size-4" aria-hidden />
                </a>
              ) : null}
              {herramientas}
            </div>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>

      {etiquetas}
    </header>
  );
}
