import Link from "next/link";
import { PieLegal } from "./pie-legal";
import { ULTIMA_ACTUALIZACION, type SeccionLegal } from "@/lib/legal/contenido";

/**
 * La pantalla de un texto legal.
 *
 * Pública y sin sesión a propósito: cualquiera tiene que poder leerla antes de
 * decidir si acepta, incluido el invitado que llega por el QR y todavía no
 * aceptó nada.
 *
 * Medida angosta y con **negrita en el markdown mínimo** (`**así**`): estos
 * textos se leen en un celular, parado en la puerta de un salón.
 */
export function PaginaLegal({
  titulo,
  entrada,
  secciones,
  otroHref,
  otroTexto,
}: {
  titulo: string;
  entrada: string;
  secciones: readonly SeccionLegal[];
  otroHref: string;
  otroTexto: string;
}) {
  return (
    <>
      <main className="sobre-claro min-h-[100svh] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[42rem]">
          <Link
            href="/"
            className="text-sm font-extrabold"
            style={{ color: "var(--slf-violeta)" }}
          >
            Subí la Foto
          </Link>

          <h1 className="mt-6 text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">
            {titulo}
          </h1>
          <p
            className="mt-4 text-lg leading-relaxed"
            style={{ color: "var(--slf-tinta-suave)" }}
          >
            {entrada}
          </p>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--slf-tinta-suave)" }}
          >
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>

          <div className="mt-14 space-y-12">
            {secciones.map((seccion) => (
              <section key={seccion.titulo}>
                <h2 className="text-xl font-extrabold leading-snug">
                  {seccion.titulo}
                </h2>
                {seccion.parrafos.map((parrafo, i) => (
                  <p
                    key={i}
                    className="mt-4 leading-relaxed"
                    style={{ color: "var(--slf-tinta-suave)" }}
                  >
                    {conNegritas(parrafo)}
                  </p>
                ))}
                {seccion.puntos ? (
                  <ul
                    className="mt-4 space-y-2 pl-5"
                    style={{
                      color: "var(--slf-tinta-suave)",
                      listStyleType: "disc",
                    }}
                  >
                    {seccion.puntos.map((punto) => (
                      <li key={punto} className="leading-relaxed">
                        {conNegritas(punto)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div
            className="mt-16 border-t pt-8"
            style={{ borderColor: "var(--slf-borde)" }}
          >
            <Link
              href={otroHref}
              className="font-extrabold underline underline-offset-4"
              style={{ color: "var(--slf-violeta)" }}
            >
              {otroTexto}
            </Link>
          </div>
        </div>
      </main>
      <PieLegal />
    </>
  );
}

/**
 * Convierte `**esto**` en negrita.
 *
 * Lo mínimo indispensable: en un texto legal hay tres o cuatro frases que tienen
 * que saltar a la vista —el 15%, el borrado a los 30 días— y meter una librería
 * de markdown para eso sería desproporcionado.
 */
function conNegritas(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith("**") && trozo.endsWith("**") ? (
      <strong
        key={i}
        className="font-extrabold"
        style={{ color: "var(--slf-tinta)" }}
      >
        {trozo.slice(2, -2)}
      </strong>
    ) : (
      trozo
    ),
  );
}
