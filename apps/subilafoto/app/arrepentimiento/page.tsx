import Link from "next/link";
import { DIAS_PARA_ARREPENTIRSE } from "@/lib/legal/arrepentimiento";
import { PieLegal } from "@/app/components/pie-legal";
import { FormularioArrepentimiento } from "./formulario";

export const metadata = { title: "Botón de arrepentimiento — SubiLaFoto" };

/**
 * Botón de arrepentimiento (Resolución 424/2020).
 *
 * La norma pide un enlace **visible en la portada** que lleve directo a este formulario, y
 * una constancia de la solicitud. El derecho de fondo es el artículo 34 de la Ley 24.240:
 * diez días corridos para revocar, sin explicar por qué y sin costo.
 *
 * **Los textos están pendientes de revisión legal.**
 */
export default function Arrepentimiento() {
  return (
    <>
      <main className="sobre-claro mx-auto max-w-xl px-6 py-14">
        <Link
          href="/"
          className="text-sm font-extrabold"
          style={{ color: "var(--slf-violeta)" }}
        >
          ← SubiLaFoto
        </Link>

        <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em]">
          Botón de arrepentimiento
        </h1>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: "var(--slf-tinta-suave)" }}
        >
          Si compraste y te arrepentiste, tenés{" "}
          <strong>{DIAS_PARA_ARREPENTIRSE} días corridos</strong> para cancelar
          sin costo y sin tener que explicar por qué. Es un derecho: el artículo
          34 de la Ley 24.240 de Defensa del Consumidor.
        </p>

        <p
          className="mt-3 leading-relaxed"
          style={{ color: "var(--slf-tinta-suave)" }}
        >
          Completá esto y te damos un número de constancia en la misma pantalla.
          Después te escribimos al correo que dejes.
        </p>

        <FormularioArrepentimiento />

        <div
          className="mt-12 rounded-xl px-5 py-4 text-sm leading-relaxed"
          style={{ background: "var(--slf-purpura)", color: "var(--slf-lila)" }}
        >
          Si preferís hacer el reclamo ante el Estado, podés usar el{" "}
          <a
            href="https://autogestion.produccion.gob.ar/consumidores"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold underline underline-offset-4"
            style={{ color: "var(--slf-amarillo)" }}
          >
            Libro de Quejas Online
          </a>{" "}
          de la Secretaría de Comercio.
        </div>
      </main>
      <PieLegal />
    </>
  );
}
