import type { Metadata } from "next";

import { PublicShell } from "../../components/public-ui";
import {
  DIRECTORIO_ES_DE_TODA_LA_PLATAFORMA,
  QUE_PASA_DESPUES_DE_POSTULARSE,
} from "../../lib/fotorank/judges/legalCopy";
import { PostulacionForm } from "./PostulacionForm";

export const metadata: Metadata = {
  title: "Postulate como jurado — FotoRank",
  description:
    "Presentá tu ficha para que los organizadores de concursos de FotoRank puedan convocarte como jurado.",
};

/**
 * Los tres pasos se numeran porque SON una secuencia: cada uno habilita al
 * siguiente. No es decoración.
 */
const PASOS = [
  "Confirmás tu correo con el enlace que te mandamos. Vence a las 48 horas.",
  "Revisamos tu ficha. Si falta algo, te lo decimos y podés corregirlo.",
  "Aparecés en el directorio, con tu página pública y tu portfolio.",
];

function QuePasaDespues() {
  return (
    <>
      <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
        {QUE_PASA_DESPUES_DE_POSTULARSE}
      </p>

      <ol className="mt-5 space-y-4">
        {PASOS.map((paso, i) => (
          <li
            key={paso}
            className="flex gap-3 text-sm leading-relaxed text-[var(--foreground-muted)]"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xs font-medium text-[var(--foreground)]"
            >
              {i + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function PostulacionDeJuradoPage() {
  return (
    <PublicShell header={{ variant: "contest", panelHref: "/jurado/panel" }}>
      <div className="mx-auto w-full max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        {/*
         * Escritorio: dos columnas, el contexto a la izquierda y el formulario
         * a la derecha. Teléfono: una sola columna.
         *
         * La columna de contexto NO es sticky: `html` y `body` tienen overflow
         * propio en el CSS global del sitio, y eso anula `position: sticky` en
         * cualquier descendiente. Cambiar ese overflow afectaría a todas las
         * páginas públicas, así que no vale la pena por una columna fija.
         */}
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
          <aside className="lg:self-start">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--foreground)] lg:text-4xl">
              Postulate como jurado
            </h1>

            <p className="mt-4 max-w-prose leading-relaxed text-[var(--foreground-muted)]">
              Contanos quién sos y qué hacés. Si aprobamos tu ficha, los organizadores de
              concursos van a poder encontrarte y proponerte que integres su jurado.
            </p>

            <p className="mt-6 border-l-2 border-[var(--primary)] pl-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
              {DIRECTORIO_ES_DE_TODA_LA_PLATAFORMA}
            </p>

            {/*
             * En el teléfono los pasos van plegados: si no, ocupan la primera
             * pantalla entera y el formulario queda debajo del pliegue. En el
             * escritorio están siempre a la vista, en la columna fija.
             */}
            <details className="group mt-6 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <span
                  aria-hidden="true"
                  className="text-[var(--primary)] transition-transform group-open:rotate-90"
                >
                  ›
                </span>
                Qué pasa después
              </summary>
              <div className="mt-4">
                <QuePasaDespues />
              </div>
            </details>

            <div className="mt-8 hidden lg:block">
              <p className="text-sm font-medium text-[var(--foreground)]">Qué pasa después</p>
              <div className="mt-1.5">
                <QuePasaDespues />
              </div>
            </div>
          </aside>

          <div className="mt-10 lg:mt-0">
            <PostulacionForm />
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
