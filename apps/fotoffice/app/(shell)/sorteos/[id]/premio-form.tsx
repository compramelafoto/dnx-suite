"use client";

import { useState, useTransition } from "react";
import { savePrizeAction } from "../actions";
import { buscarAliadosAction } from "../actions-partners";

/**
 * Alta de un premio, con buscador de aliados.
 *
 * Es de cliente sólo por el buscador. Lo demás es un formulario común que postea a una acción
 * de servidor: si el JavaScript no carga, el premio se puede cargar igual escribiendo el
 * nombre del aliado a mano.
 *
 * El aliado tiene tres formas válidas y las tres importan: una ficha de Partners elegida de
 * la lista, un nombre suelto para la marca que todavía no tiene ficha, o nada — la
 * institución también pone premios propios.
 */

type Aliado = { id: string; name: string; logoUrl: string | null };

export function PremioForm({
  raffleId,
  siguienteOrden,
}: {
  raffleId: string;
  siguienteOrden: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Aliado[]>([]);
  const [elegido, setElegido] = useState<Aliado | null>(null);
  const [buscando, empezarBusqueda] = useTransition();

  function buscar(texto: string) {
    setBusqueda(texto);
    setElegido(null);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    empezarBusqueda(async () => {
      setResultados(await buscarAliadosAction(texto));
    });
  }

  return (
    <form action={savePrizeAction} className="fo-card space-y-6 p-6">
      <h3 className="text-base font-semibold">Agregar un premio</h3>
      <input type="hidden" name="raffleId" value={raffleId} />

      <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="order">
            Orden
          </label>
          <input
            id="order"
            name="order"
            type="number"
            min={1}
            step={1}
            defaultValue={siguienteOrden}
            className="fo-input"
            required
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="title">
            Premio
          </label>
          <input id="title" name="title" className="fo-input" required />
        </div>
      </div>
      <p className="fo-helper -mt-4">
        El orden decide qué se sortea primero y entra en el cálculo del ganador. No es
        cosmético.
      </p>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="description">
          Descripción
        </label>
        <input id="description" name="description" className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="partnerName">
          Marca que lo dona
        </label>
        <input
          id="partnerName"
          name="partnerName"
          className="fo-input"
          value={elegido?.name ?? busqueda}
          onChange={(e) => buscar(e.target.value)}
          autoComplete="off"
          placeholder="Escribí para buscar entre los aliados"
        />
        <input type="hidden" name="partnerId" value={elegido?.id ?? ""} />
        <p className="fo-helper">
          Si la marca ya tiene ficha, elegila de la lista. Si no, escribí el nombre igual.
          También podés dejarlo vacío: hay premios que pone la institución.
        </p>

        {buscando ? <p className="fo-helper">Buscando…</p> : null}

        {resultados.length > 0 && !elegido ? (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)] text-sm">
            {resultados.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-[var(--fo-surface-hover)]"
                  onClick={() => {
                    setElegido(a);
                    setResultados([]);
                  }}
                >
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {elegido ? (
          <p className="fo-helper">
            Ficha elegida: {elegido.name}.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setElegido(null);
                setBusqueda("");
              }}
            >
              Quitar
            </button>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="estimatedValue">
            Valor estimado
          </label>
          <input id="estimatedValue" name="estimatedValue" className="fo-input" inputMode="decimal" />
          <p className="fo-helper">Informativo. No se cobra nada.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pickupDeadline">
            Retirar hasta
          </label>
          <input id="pickupDeadline" name="pickupDeadline" type="date" className="fo-input" />
        </div>
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="conditions">
          Condiciones
        </label>
        <input id="conditions" name="conditions" className="fo-input" />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="pickupInstructions">
          Dónde y cuándo se retira
        </label>
        <input id="pickupInstructions" name="pickupInstructions" className="fo-input" />
      </div>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Agregar premio
        </button>
      </div>
    </form>
  );
}
