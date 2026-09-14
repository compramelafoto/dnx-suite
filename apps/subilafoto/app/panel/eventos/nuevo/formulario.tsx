"use client";

import { useActionState, useMemo, useState } from "react";
import { crearEventoAction, type EstadoAlta } from "@/app/actions/eventos";
import { calcularVentana } from "@/lib/ventana-evento";

const TIPOS = [
  ["BODA", "Boda"],
  ["QUINCE", "Fiesta de quince"],
  ["CUMPLEANOS", "Cumpleaños"],
  ["ANIVERSARIO", "Aniversario"],
  ["BAUTISMO_COMUNION", "Bautismo o comunión"],
  ["EGRESO_ACTO_ESCOLAR", "Egreso o acto escolar"],
  ["FIESTA_EMPRESARIAL", "Fiesta empresarial"],
  ["CONGRESO", "Congreso"],
  ["CONFERENCIA", "Conferencia"],
  ["EXPOSICION_FERIA", "Exposición o feria"],
  ["RECITAL", "Recital"],
  ["OTRO", "Otro"],
] as const;

const ETIQUETA = "block text-sm font-extrabold";
const CAMPO =
  "mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]";

export function FormularioEvento({ zonaPorDefecto }: { zonaPorDefecto: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAlta, FormData>(
    crearEventoAction,
    {},
  );
  const [fechaHora, setFechaHora] = useState("");

  // La vista previa del cierre se calcula acá con la misma función que usa el servidor.
  // El capítulo 7.4 pide que la hora de desactivación se vea ANTES de confirmar.
  const cierre = useMemo(() => {
    if (!fechaHora) return null;
    try {
      return calcularVentana({ fechaHoraLocal: fechaHora, zonaHoraria: zonaPorDefecto })
        .desactivacionLocal;
    } catch {
      return null;
    }
  }, [fechaHora, zonaPorDefecto]);

  return (
    <form action={accion} className="mt-10 space-y-7">
      <div>
        <label htmlFor="nombre" className={ETIQUETA}>
          Nombre del evento
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          minLength={3}
          placeholder="Casamiento de Ana y Julián"
          className={CAMPO}
          style={{ borderColor: "var(--slf-borde)" }}
        />
      </div>

      <div>
        <label htmlFor="tipo" className={ETIQUETA}>
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          defaultValue="BODA"
          className={CAMPO}
          style={{ borderColor: "var(--slf-borde)" }}
        >
          {TIPOS.map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="lugar" className={ETIQUETA}>
          Lugar <span className="font-medium opacity-60">(opcional)</span>
        </label>
        <input
          id="lugar"
          name="lugar"
          placeholder="Salón Los Robles"
          className={CAMPO}
          style={{ borderColor: "var(--slf-borde)" }}
        />
      </div>

      <div>
        <label htmlFor="fechaHora" className={ETIQUETA}>
          Cuándo se abre para los invitados
        </label>
        <input
          id="fechaHora"
          name="fechaHora"
          type="datetime-local"
          required
          value={fechaHora}
          onChange={(e) => setFechaHora(e.target.value)}
          className={CAMPO}
          style={{ borderColor: "var(--slf-borde)" }}
        />
        <input type="hidden" name="zona" value={zonaPorDefecto} />

        <div
          className="mt-4 rounded-xl px-5 py-4 text-sm"
          style={{ background: "var(--slf-purpura)", color: "var(--slf-lila)" }}
          aria-live="polite"
        >
          {cierre ? (
            <>
              Los invitados van a poder subir fotos durante{" "}
              <strong className="text-white">12 horas</strong>. Cierra el{" "}
              <strong style={{ color: "var(--slf-amarillo)" }}>
                {cierre.fecha} a las {cierre.hora}
              </strong>
              {cierre.esDiaSiguiente ? ", al día siguiente." : "."}
            </>
          ) : (
            "Elegí la fecha y la hora, y acá te muestro cuándo se cierra."
          )}
        </div>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl px-7 py-4 font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)" }}
      >
        {enviando ? "Creando…" : "Crear evento"}
      </button>
    </form>
  );
}
