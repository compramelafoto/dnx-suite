"use client";

/**
 * Cómo se usa el visor.
 *
 * Quien lee esto entró una vez hace meses, o es la primera. No necesita que le
 * expliquen por qué el visor está bien pensado: necesita saber qué apretar,
 * qué pasa si se equivoca y cuándo termina. Eso, en ese orden, y nada más.
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

const EN_LETRAS = [
  "cero",
  "una",
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

function cuantas(n: number): string {
  return EN_LETRAS[n] ?? String(n);
}

function pasos(
  criterios: number,
  maxima: number,
): Array<{ titulo: string; texto: string }> {
  const varios = criterios !== 1;
  return [
    {
      titulo: "Calificás una consigna por vez",
      texto:
        "Arriba están las consignas que te tocaron. Terminás una y pasás a la siguiente. " +
        "Las fotos vienen mezcladas y sin el nombre de quien las tomó.",
    },
    {
      titulo: varios
        ? `Cada foto lleva ${cuantas(criterios)} notas`
        : "Cada foto lleva una nota",
      texto: varios
        ? `Ponés ${cuantas(criterios)} notas del 1 al ${maxima}, una por criterio. Apretás el ` +
          "número y el visor pasa solo al criterio siguiente."
        : `Ponés una nota del 1 al ${maxima}.`,
    },
    {
      titulo: "Podés mirar antes de puntuar",
      texto:
        "Con las flechas ← y → recorrés las fotos sin calificar ninguna. Sirve para ver cómo " +
        "viene la consigna antes de decidir la primera nota.",
    },
    {
      titulo: "Equivocarse no cuesta nada",
      texto:
        "Escape borra la nota donde estás parado. Suprimir deja la foto entera en blanco. " +
        "⌘Z deshace lo último que hiciste, aunque haya sido en otra foto. Y podés cambiar " +
        "cualquier nota hasta que envíes.",
    },
    {
      titulo: "Se guarda solo",
      texto:
        "Cada nota queda guardada apenas la ponés. Podés cerrar la pestaña y volver otro día: " +
        "no se pierde nada.",
    },
    {
      titulo: "Guardar no es enviar",
      texto: varios
        ? "Cuando termines, el botón Enviar cierra tu trabajo. Las fotos a las que les falte " +
          "alguna nota no se envían y no cuentan para el resultado. El visor te avisa cuántas " +
          "quedaron así antes de mandar nada."
        : "Cuando termines, el botón Enviar cierra tu trabajo. Las fotos sin nota no se envían " +
          "y no cuentan para el resultado.",
    },
    {
      titulo: "Si reconocés una foto, avisá",
      texto:
        "Las obras se muestran con un código y sin autor. Si aun así sabés de quién es alguna, " +
        "escribile a la organización antes de calificarla.",
    },
    {
      titulo: "El fondo cambia lo que ves",
      texto:
        "Sobre negro una foto oscura parece más contrastada de lo que es; sobre blanco una " +
        "foto clara se apaga. Por eso viene el gris. Si lo cambiás, cambialo entre consignas " +
        "y no en el medio de una.",
    },
  ];
}

function teclas(maxima: number): Array<{ tecla: string; hace: string }> {
  return [
    { tecla: `1 … ${Math.min(9, maxima)}`, hace: "Poner esa nota" },
    ...(maxima === 10 ? [{ tecla: "0", hace: "Poner un 10" }] : []),
    { tecla: "Tab", hace: "Criterio siguiente. En el último, pasa de foto" },
    {
      tecla: "⇧ Tab",
      hace: "Criterio anterior. En el primero, vuelve de foto",
    },
    { tecla: "→", hace: "Foto siguiente, sin calificar" },
    { tecla: "←", hace: "Foto anterior, sin calificar" },
    { tecla: "Esc", hace: "Borrar la nota del criterio donde estás" },
    { tecla: "Supr", hace: "Borrar todas las notas de esta foto" },
    { tecla: "⌘Z", hace: "Deshacer lo último. En Windows, Ctrl+Z" },
    { tecla: "F", hace: "Ver la foto sola, en toda la pantalla" },
    { tecla: "H", hace: "Abrir y cerrar esta ayuda" },
  ];
}

const FILTROS: Array<{ nombre: string; texto: string }> = [
  { nombre: "Todas", texto: "Las que te tocaron en esta consigna." },
  { nombre: "Me faltan", texto: "Las que todavía no tienen todas las notas." },
  { nombre: "Completas", texto: "Las que ya tienen todas." },
  {
    nombre: "Empezadas",
    texto:
      "Las que tienen alguna nota y alguna faltando. Conviene revisarlas antes de enviar, " +
      "porque así no cuentan.",
  },
];

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

  // Escape cierra la ayuda antes que cualquier otra cosa: es lo último que se
  // abrió, y acá no tiene que borrar ninguna nota.
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
        className="mx-auto my-8 w-[min(44rem,calc(100%-2rem))] p-6 sm:p-8"
        style={{
          background: colores.panel,
          color: colores.tinta,
          border: `1px solid ${colores.linea}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Cómo se usa</h2>
            <p className="mt-1.5 text-sm" style={{ color: colores.suave }}>
              Se maneja con el teclado. En el teléfono, deslizando con el dedo.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-9 shrink-0 px-3 text-sm"
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
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center font-mono text-[10px]"
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

        <h3 className="mt-8 text-sm font-semibold">Teclas</h3>
        <table className="mt-2 w-full text-left text-sm">
          <tbody>
            {TECLAS.map((t) => (
              <tr
                key={t.tecla}
                style={{ borderTop: `1px solid ${colores.linea}` }}
              >
                <td className="w-24 py-1.5 pr-4 align-top">
                  <kbd
                    className="inline-block px-1.5 py-0.5 font-mono text-[11px]"
                    style={{
                      background: colores.chip,
                      border: `1px solid ${colores.linea}`,
                    }}
                  >
                    {t.tecla}
                  </kbd>
                </td>
                <td
                  className="py-1.5 align-top"
                  style={{ color: colores.suave }}
                >
                  {t.hace}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-8 text-sm font-semibold">En el teléfono</h3>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: colores.suave }}
        >
          Los criterios aparecen de a uno, sobre la foto. Deslizá hacia la
          izquierda para pasar al siguiente; después del último, el visor te
          lleva a la foto que sigue. Deslizá hacia la derecha para volver.
        </p>

        <h3 className="mt-8 text-sm font-semibold">Los filtros</h3>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: colores.suave }}
        >
          El botón del embudo elige qué fotos ves.
        </p>
        <ul className="mt-2 grid gap-1.5">
          {FILTROS.map((f) => (
            <li key={f.nombre} className="text-sm leading-relaxed">
              <b>{f.nombre}</b>
              <span style={{ color: colores.suave }}> — {f.texto}</span>
            </li>
          ))}
        </ul>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: colores.suave }}
        >
          Mientras calificás, la lista no se mueve: ninguna foto desaparece de
          abajo de tus manos. Se rearma cuando vos cambiás de filtro o de
          consigna.
        </p>
      </div>
    </div>
  );
}
