import Link from "next/link";
import { EMAIL_LEGAL, RESPONSABLE } from "@/lib/legal/contenido";

/**
 * El pie con los datos de quien vende.
 *
 * La Resolución 424/2020 y el artículo 4 de la Ley 24.240 piden que el consumidor pueda
 * saber con quién contrató sin tener que buscarlo, y que el botón de arrepentimiento y el
 * Libro de Quejas estén a la vista. Va en todas las páginas públicas por eso, no por
 * prolijidad.
 */
export function PieLegal({ claro = false }: { claro?: boolean }) {
  const tinta = claro ? "var(--slf-lila)" : "var(--slf-tinta-suave)";

  return (
    <footer className="px-6 pb-16 pt-12" style={{ color: tinta }}>
      <div className="mx-auto max-w-5xl text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/terminos" className="underline underline-offset-4">
            Términos y condiciones
          </Link>
          <Link href="/privacidad" className="underline underline-offset-4">
            Política de privacidad
          </Link>
          <Link href="/arrepentimiento" className="underline underline-offset-4">
            Botón de arrepentimiento
          </Link>
          <a
            href="https://autogestion.produccion.gob.ar/consumidores"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Libro de Quejas Online
          </a>
        </div>

        <p className="mt-6 leading-relaxed">
          SubiLaFoto es parte de DNX Suite. Responsable: {RESPONSABLE.nombre} · CUIT{" "}
          {RESPONSABLE.cuit} · {RESPONSABLE.domicilio} ·{" "}
          <a href={`mailto:${EMAIL_LEGAL}`} className="underline underline-offset-4">
            {EMAIL_LEGAL}
          </a>
        </p>
      </div>
    </footer>
  );
}
