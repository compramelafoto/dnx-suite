"use client";

/**
 * Cómo se usa el visor, para quien lo abre por primera vez.
 *
 * Un jurado entra una vez cada varios meses y nadie le explicó nada: las
 * pistas de abajo alcanzan para recordar, no para aprender. Acá está lo mismo
 * en orden, con el porqué de cada cosa.
 */
import { useEffect } from "react";

type Colores = {
  fondo: string;
  panel: string;
  linea: string;
  tinta: string;
  suave: string;
  chip: string;
};

/** En letras, que es como lo diría una persona. Más de diez no pasa nunca. */
const EN_LETRAS = [
  "cero",
  "un",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
];

function cuantos(n: number): string {
  return EN_LETRAS[n] ?? String(n);
}

function pasos(
  cantidadDeCriterios: number,
  notaMaxima: number,
): Array<{ titulo: string; texto: string }> {
  return [
    {
      titulo: "Una consigna por vez",
      texto:
        "Arriba están las consignas que te tocaron. Calificás las de una y después pasás a " +
        "la siguiente: comparar entre sí fotos que compiten entre sí es lo que hace que una " +
        "nota signifique algo.",
    },
    {
      titulo: "Primero mirá, después puntuá",
      texto:
        "Con las flechas recorrés las fotos sin calificar ninguna. Sirve para hacerte una " +
        "idea del nivel de la consigna antes de poner la primera nota.",
    },
    {
      titulo:
        cantidadDeCriterios === 1
          ? "Una nota por foto"
          : `${cuantos(cantidadDeCriterios).replace(/^./, (c) => c.toUpperCase())} notas por foto`,
      texto:
        cantidadDeCriterios === 1
          ? `Cada fotografía lleva una sola nota, del 1 al ${notaMaxima}.`
          : `Cada fotografía se califica con ${cuantos(cantidadDeCriterios)} criterios, del 1 al ` +
            `${notaMaxima}. Al elegir una nota el visor pasa solo al criterio siguiente, así que ` +
            `una foto son ${cuantos(cantidadDeCriterios)} teclas.`,
    },
    {
      titulo: "Se guarda solo",
      texto:
        "Cada nota queda guardada apenas la ponés y podés cambiarla cuando quieras. Si " +
        "cerrás la pestaña no perdés nada.",
    },
    {
      titulo: "Enviar es otra cosa",
      texto:
        "Guardar no es enviar. Cuando termines, el botón Enviar calificaciones cierra tu " +
        "trabajo. Las fotos que tengan alguna nota faltando no se envían y no cuentan: el " +
        "visor te avisa cuántas quedaron así.",
    },
    {
      titulo: "El fondo cambia lo que ves",
      texto:
        "Sobre negro una foto oscura parece más contrastada de lo que es; sobre blanco una " +
        "foto clara se apaga. Por eso el gris viene elegido, y por eso conviene no andar " +
        "cambiándolo en el medio de una consigna.",
    },
    {
      titulo: "Nadie sabe de quién es cada foto",
      texto:
        "Las obras se muestran con un código y sin el nombre de quien las tomó. Si igual " +
        "reconocés una, avisale a la organización antes de calificarla.",
    },
  ];
}

function teclas(notaMaxima: number): Array<{ tecla: string; hace: string }> {
  return [
    { tecla: "→", hace: "Foto siguiente, sin calificar" },
    { tecla: "←", hace: "Foto anterior, sin calificar" },
    {
      tecla: `1 … ${Math.min(9, notaMaxima)}`,
      hace: "La nota del criterio en el que estás",
    },
    ...(notaMaxima === 10 ? [{ tecla: "0", hace: "Vale 10" }] : []),
    { tecla: "Tab", hace: "Criterio siguiente; en el último, pasa de foto" },
    {
      tecla: "⇧ Tab",
      hace: "Criterio anterior; en el primero, vuelve de foto",
    },
    { tecla: "F", hace: "Pantalla completa: esconde todo menos la foto" },
    { tecla: "H", hace: "Abrir y cerrar esta ayuda" },
    { tecla: "Esc", hace: "Cerrar lo que esté abierto" },
  ];
}

export function AyudaDelVisor({
  colores,
  cantidadDeCriterios,
  notaMaxima,
  onCerrar,
}: {
  colores: Colores;
  cantidadDeCriterios: number;
  notaMaxima: number;
  onCerrar: () => void;
}) {
  const PASOS = pasos(cantidadDeCriterios, notaMaxima);
  const TECLAS = teclas(notaMaxima);
  // Escape cierra la ayuda antes que cualquier otra cosa: es lo último que se abrió.
  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCerrar();
      }
    }
    window.addEventListener("keydown", alPresionar, true);
    return () => window.removeEventListener("keydown", alPresionar, true);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.72)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Cómo se usa el visor"
      onClick={onCerrar}
    >
      <div
        className="mx-auto my-8 w-[min(46rem,calc(100%-2rem))] p-6 sm:p-8"
        style={{
          background: colores.panel,
          color: colores.tinta,
          border: `1px solid ${colores.linea}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">Cómo se usa</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-9 px-3 text-sm"
            style={{
              border: `1px solid ${colores.linea}`,
              color: colores.suave,
            }}
          >
            Cerrar
          </button>
        </div>

        <ol className="mt-6 grid gap-4">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs"
                style={{ background: colores.chip, color: colores.suave }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{p.titulo}</p>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: colores.suave }}
                >
                  {p.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <h3 className="mt-8 text-sm font-semibold">El teclado</h3>
        <table className="mt-3 w-full text-left text-sm">
          <tbody>
            {TECLAS.map((t) => (
              <tr
                key={t.tecla}
                style={{ borderTop: `1px solid ${colores.linea}` }}
              >
                <td className="w-28 py-2 pr-4 align-top">
                  <kbd
                    className="inline-block px-2 py-1 font-mono text-xs"
                    style={{
                      background: colores.chip,
                      border: `1px solid ${colores.linea}`,
                    }}
                  >
                    {t.tecla}
                  </kbd>
                </td>
                <td className="py-2 align-top" style={{ color: colores.suave }}>
                  {t.hace}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-8 text-sm font-semibold">Los filtros</h3>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: colores.suave }}
        >
          <b style={{ color: colores.tinta }}>Me faltan</b> son las que todavía
          no tienen todas las notas, hayas empezado o no.{" "}
          <b style={{ color: colores.tinta }}>A medias</b> son las que empezaste
          y dejaste por la mitad — esas son las que conviene revisar antes de
          enviar, porque no cuentan. Cambiar de filtro rearma la lista; mientras
          calificás, ninguna foto se te va de la pantalla sola.
        </p>
      </div>
    </div>
  );
}
