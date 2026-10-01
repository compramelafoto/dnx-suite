"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { cambiarColaboradoresEnTandaAction, type TandaColaboradoresState } from "./actions";

const inicial: TandaColaboradoresState = { error: null, resumen: null };

/**
 * El identificador del formulario de la tanda.
 *
 * Las casillas de cada fila NO están adentro de ese formulario: viven en la tabla, y cada fila
 * abre abajo su propio formulario de edición del perfil. Un `<form>` que envolviera la tabla
 * dejaría un formulario adentro de otro, que el navegador directamente descarta al leer el HTML,
 * y la edición de a uno dejaría de funcionar. Por eso cada casilla se asocia al formulario de la
 * barra con el atributo `form=`: es HTML válido, no anida nada, y los campos igual viajan juntos
 * al enviar.
 */
export const TANDA_FORM_ID = "tanda-colaboradores";

const CASILLA_FILA = `input[name="memberIds"][form="${TANDA_FORM_ID}"]`;
const CASILLA_TODOS = 'input[name="seleccionarTodos"]';

function casillas(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(CASILLA_FILA));
}

function desmarcarTodo() {
  for (const c of casillas()) c.checked = false;
  const maestra = document.querySelector<HTMLInputElement>(CASILLA_TODOS);
  if (maestra) maestra.checked = false;
}

/**
 * La barra de acciones en tanda.
 *
 * Lo único que vive en el cliente es la cuenta de seleccionados y el resultado. Quién puede
 * hacer esto se decide en el servidor, adentro de `cambiarColaboradoresEnTandaAction`: esconder
 * los botones no es el control.
 *
 * La selección no se guarda en ningún lado: es lo que está marcado en pantalla en este momento,
 * y después de cada tanda se limpia. Mostrar "23 seleccionados" de personas que ya no se ven —o
 * que la tanda anterior ya tocó— es la forma más fácil de habilitar a quien no se quería.
 */
export function TandaColaboradoresBarra() {
  const [seleccionados, setSeleccionados] = useState(0);

  const recontar = useCallback(() => {
    setSeleccionados(casillas().filter((c) => c.checked).length);
  }, []);

  const [state, action, pendiente] = useActionState(
    async (previo: TandaColaboradoresState, formData: FormData) => {
      const resultado = await cambiarColaboradoresEnTandaAction(previo, formData);
      // Esa selección ya se usó. Si quedara marcada, el botón de al lado aplicaría la otra
      // acción a la misma gente de un solo clic, y la tabla que se está mirando ya es otra.
      desmarcarTodo();
      setSeleccionados(0);
      return resultado;
    },
    inicial,
  );

  useEffect(() => {
    // Las casillas están fuera de este formulario (ver `TANDA_FORM_ID`), así que su evento no
    // burbujea hasta él: se escucha en el documento y se filtra por nombre. La cuenta arranca en
    // cero porque así arranca la tabla, sin nada marcado.
    const alCambiar = (e: Event) => {
      const destino = e.target as HTMLInputElement | null;
      if (destino?.name === "memberIds" || destino?.name === "seleccionarTodos") recontar();
    };
    document.addEventListener("change", alCambiar);
    return () => document.removeEventListener("change", alCambiar);
  }, [recontar]);

  const limpiar = useCallback(() => {
    desmarcarTodo();
    setSeleccionados(0);
  }, []);

  const sinSeleccion = seleccionados === 0 || pendiente;

  return (
    <div className="space-y-3">
      <form
        id={TANDA_FORM_ID}
        action={action}
        className="fo-card !p-4 flex flex-wrap items-center gap-3"
      >
        <button
          type="submit"
          name="accion"
          value="habilitar"
          disabled={sinSeleccion}
          className="fo-btn fo-btn-primary text-sm min-h-10"
        >
          {pendiente
            ? "Guardando…"
            : seleccionados === 0
              ? "Habilitar a los seleccionados"
              : `Habilitar a ${seleccionados}`}
        </button>
        <button
          type="submit"
          name="accion"
          value="quitar"
          disabled={sinSeleccion}
          className="fo-btn fo-btn-secondary text-sm min-h-10"
        >
          {seleccionados === 0 ? "Quitar a los seleccionados" : `Quitar a ${seleccionados}`}
        </button>
        {seleccionados > 0 ? (
          <button type="button" onClick={limpiar} className="fo-btn fo-btn-ghost text-sm min-h-10">
            Limpiar selección
          </button>
        ) : null}
        <p className="text-xs text-[var(--fo-muted)]">
          Habilitar sólo enciende el perfil y quitar sólo lo apaga: las zonas, el equipo y todo lo
          demás que hayan cargado se conserva. A quien no está activo en el padrón no se lo
          habilita, porque no podría anotarse igual.
        </p>
      </form>

      {state.error ? (
        <p className="fo-card !p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.resumen ? (
        <p className="fo-card !p-4 text-sm text-[var(--fo-text)]" role="status">
          {state.resumen}
        </p>
      ) : null}
    </div>
  );
}

/**
 * La casilla del encabezado: marca o desmarca todo lo que hay en la tabla.
 *
 * Alcanza a lo que está en pantalla, que hoy es el padrón entero porque esta lista no pagina. Si
 * alguna vez paginara, seguiría alcanzando sólo a lo visible: es lo que quien coordina puede
 * mirar antes de apretar un botón.
 */
export function SeleccionarTodosCasilla() {
  return (
    <input
      type="checkbox"
      name="seleccionarTodos"
      aria-label="Seleccionar a todos los de la lista"
      className="size-5 accent-[var(--fo-accent)]"
      onChange={(e) => {
        const marcar = e.currentTarget.checked;
        for (const c of casillas()) c.checked = marcar;
      }}
    />
  );
}
