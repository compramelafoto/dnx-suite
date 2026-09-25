"use client";

/**
 * Cómo se usa el visor.
 *
 * Quien lee esto entró una vez hace meses, o es la primera. No necesita que le
 * expliquen por qué el visor está bien pensado: necesita saber qué apretar,
 * qué pasa si se equivoca y cuándo termina. Eso, en ese orden, y nada más.
 */
import { formaDeLaNota } from "../../../../lib/fotorank/jury/formaDeLaNota";
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

/**
 * Los pasos, con la variante del teléfono donde cambia.
 *
 * `enElTelefono` existe sólo para lo que se hace distinto con el dedo. Donde
 * falta, el texto es el mismo en los dos lados.
 */
function pasos(
  criterios: number,
  maxima: number,
  minima: number,
): Array<{ titulo: string; texto: string; enElTelefono?: string }> {
  const varios = criterios !== 1;
  const forma = formaDeLaNota({ min: minima, max: maxima });
  return [
    {
      titulo: "Calificás una consigna por vez",
      texto:
        "Arriba están las consignas que te tocaron. Terminás una y pasás a la siguiente. " +
        "Las fotos vienen mezcladas y sin el nombre de quien las tomó.",
    },
    {
      titulo: varios
        ? `Cada foto lleva ${cuantas(criterios)} calificaciones`
        : "Cada foto lleva una calificación",
      texto: varios
        ? `Ponés ${cuantas(criterios)} calificaciones del 1 al ${maxima}, una por criterio. ` +
          "Apretás el número y el visor pasa solo al criterio siguiente."
        : forma === "SI_NO"
          ? "Marcás sí o no en cada foto: sí si merece seguir, no si no."
          : forma === "CAMPO"
            ? `Escribís una calificación del ${minima} al ${maxima}.`
            : `Ponés una calificación del ${minima} al ${maxima}.`,
      enElTelefono: varios
        ? `Ponés ${cuantas(criterios)} calificaciones del 1 al ${maxima}, una por criterio. ` +
          "Tocás el número y el criterio se queda donde está: para pasar al siguiente " +
          "deslizás con el dedo."
        : forma === "SI_NO"
          ? "Tocás Sí o No en cada foto."
          : forma === "CAMPO"
            ? `Escribís una calificación del ${minima} al ${maxima}.`
            : `Tocás una calificación del ${minima} al ${maxima}.`,
    },
    {
      titulo: "Podés mirar antes de puntuar",
      texto:
        "Con las flechas ← y → recorrés las fotos sin calificar ninguna. Sirve para ver cómo " +
        "viene la consigna antes de decidir la primera calificación.",
      enElTelefono:
        "Deslizando sobre la fotografía pasás de obra sin calificar ninguna. Sirve para ver " +
        "cómo viene la consigna antes de decidir la primera calificación.",
    },
    {
      titulo: "Equivocarse no cuesta nada",
      texto:
        "Escape borra la calificación donde estás parado. Suprimir deja la foto entera en " +
        "blanco. ⌘Z deshace lo último que hiciste, aunque haya sido en otra foto. Y podés " +
        "cambiar cualquier calificación hasta que envíes.",
      enElTelefono:
        "Tocá de nuevo el número que elegiste y esa calificación se borra. Y podés cambiar " +
        "cualquiera hasta que envíes.",
    },
    {
      titulo: "Se guarda solo, aunque se corte internet",
      texto:
        "Cada calificación se guarda en tu propio aparato apenas la ponés, y de ahí viaja a " +
        "la organización. Si te quedás sin señal, queda esperando y se manda sola cuando " +
        "volvés a tener: abajo vas a leer cuántas obras están en esa situación. Podés cerrar " +
        "la pestaña y volver otro día sin perder nada.",
    },
    {
      titulo: "Guardar no es enviar",
      texto: varios
        ? "Cuando termines, el botón Enviar cierra tu trabajo. Las fotos a las que les falte " +
          "alguna calificación no se envían y no cuentan para el resultado. El visor te avisa " +
          "cuántas " +
          "quedaron así antes de mandar nada."
        : "Cuando termines, el botón Enviar cierra tu trabajo. Las fotos sin calificación no " +
          "se envían " +
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

function teclas(maxima: number, minima: number): Array<{ tecla: string; hace: string }> {
  const forma = formaDeLaNota({ min: minima, max: maxima });
  const deLaNota =
    forma === "SI_NO"
      ? [
          { tecla: "S o 1", hace: "Sí, la elijo" },
          { tecla: "N o 0", hace: "No la elijo" },
        ]
      : forma === "CAMPO"
        ? [{ tecla: "Números seguidos", hace: `Escribir la calificación: 7 y 5 es 75 (del ${minima} al ${maxima})` }]
        : [
            { tecla: maxima === 10 ? `${minima} … 9 · 0` : `${minima} … ${Math.min(9, maxima)}`, hace: "Poner esa calificación" },
                      ];
  return [
    ...deLaNota,
    { tecla: "Tab", hace: "Criterio siguiente. En el último, pasa de foto" },
    {
      tecla: "⇧ Tab",
      hace: "Criterio anterior. En el primero, vuelve de foto",
    },
    { tecla: "→", hace: "Foto siguiente, sin calificar" },
    { tecla: "←", hace: "Foto anterior, sin calificar" },
    { tecla: "Esc", hace: "Borrar la calificación del criterio donde estás" },
    { tecla: "Supr", hace: "Borrar todas las calificaciones de esta foto" },
    { tecla: "⌘Z", hace: "Deshacer lo último. En Windows, Ctrl+Z" },
    { tecla: "F", hace: "Ver la foto sola, en toda la pantalla" },
    { tecla: "H", hace: "Abrir y cerrar esta ayuda" },
  ];
}

const FILTROS: Array<{ nombre: string; texto: string }> = [
  { nombre: "Todas", texto: "Las que te tocaron en esta consigna." },
  {
    nombre: "Me faltan",
    texto: "Las que todavía no tienen todas las calificaciones.",
  },
  { nombre: "Completas", texto: "Las que ya tienen todas." },
  {
    nombre: "Empezadas",
    texto:
      "Las que tienen alguna calificación y alguna faltando. Conviene revisarlas antes de " +
      "enviar, " +
      "porque así no cuentan.",
  },
];

export function AyudaDelVisor({
  colores,
  cantidadDeCriterios,
  notaMaxima,
  notaMinima = 1,
  onCerrar,
}: {
  colores: Colores;
  cantidadDeCriterios: number;
  notaMaxima: number;
  notaMinima?: number;
  onCerrar: () => void;
}) {
  const PASOS = pasos(cantidadDeCriterios, notaMaxima, notaMinima);
  const TECLAS = teclas(notaMaxima, notaMinima);

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
              <span className="hidden sm:inline">
                Se maneja con el teclado.
              </span>
              <span className="sm:hidden">
                Se maneja deslizando con el dedo.
              </span>
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
                  className={`mt-1 text-sm leading-relaxed ${p.enElTelefono ? "hidden sm:block" : ""}`}
                  style={{ color: colores.suave }}
                >
                  {p.texto}
                </p>
                {p.enElTelefono ? (
                  <p
                    className="mt-1 text-sm leading-relaxed sm:hidden"
                    style={{ color: colores.suave }}
                  >
                    {p.enElTelefono}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <h3 className="mt-8 hidden text-sm font-semibold sm:block">Teclas</h3>
        <table className="mt-2 hidden w-full text-left text-sm sm:table">
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

        <h3 className="mt-8 text-sm font-semibold">Con el dedo</h3>
        <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed">
          <li>
            <b>Sobre la fotografía</b>
            <span style={{ color: colores.suave }}>
              {" "}
              — deslizá para pasar a la obra siguiente, o a la anterior.
            </span>
          </li>
          <li>
            <b>Sobre los criterios</b>
            <span style={{ color: colores.suave }}>
              {" "}
              — deslizá para pasar al criterio siguiente. Después del último
              seguís en la obra que viene, con el primero.
            </span>
          </li>
          <li>
            <b>Tocando un número</b>
            <span style={{ color: colores.suave }}>
              {" "}
              — queda puesto y el criterio no se mueve. Tocá el mismo de nuevo
              para borrarlo.
            </span>
          </li>
        </ul>

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
