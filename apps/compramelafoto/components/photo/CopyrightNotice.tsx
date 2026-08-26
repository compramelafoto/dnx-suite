"use client";

/**
 * Aviso amable sobre el uso de las fotografías.
 *
 * Acompaña a las protecciones anti-copia: explica en lenguaje claro por qué las
 * fotos están protegidas, sin tono amenazante. Se muestra en las pantallas que
 * tienen protección activa.
 */

export type CopyrightNoticeVariant = "panel" | "compact";

const LEY_PROPIEDAD_INTELECTUAL = "Ley 11.723 de Propiedad Intelectual";
const DERECHO_IMAGEN = "artículo 53 del Código Civil y Comercial";

export default function CopyrightNotice({
  variant = "panel",
  className = "",
}: {
  variant?: CopyrightNoticeVariant;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p
        className={`pointer-events-none max-w-[42rem] text-center text-[11px] leading-snug text-white/55 ${className}`}
        data-copyright-notice="compact"
      >
        Fotografías protegidas por la {LEY_PROPIEDAD_INTELECTUAL}. Copiarlas o compartirlas
        sin autorización no está permitido. Gracias por acompañar el trabajo de quien las hizo.
      </p>
    );
  }

  return (
    <aside
      className={`rounded-2xl border border-black/10 bg-black/[0.03] px-5 py-4 text-[13px] leading-relaxed text-black/70 ${className}`}
      data-copyright-notice="panel"
      aria-label="Aviso sobre el uso de las fotografías"
    >
      <p className="mb-1.5 font-semibold text-black/80">Estas fotos tienen autor</p>
      <p>
        Están protegidas por la <strong className="font-semibold">{LEY_PROPIEDAD_INTELECTUAL}</strong> y,
        cuando aparecen personas, también por el derecho a la propia imagen ({DERECHO_IMAGEN}).
        Descargarlas, capturarlas o compartirlas sin autorización no está permitido.
      </p>
      <p className="mt-2">
        Si te gustaron, comprarlas es la mejor forma de acompañar a quien las hizo.
        ¡Gracias por cuidar su trabajo!
      </p>
    </aside>
  );
}
