"use client";

/**
 * Cuántos jurados van a ser, y quién ocupa cada vacante.
 *
 * Declarar el número antes de saber los nombres es lo que deja que el jurado ya
 * confirmado empiece hoy: el reparto de obras se calcula sobre las vacantes, no
 * sobre las personas, así que sumar a alguien la semana que viene no le mueve el
 * lote a nadie.
 */
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ajustarTopeDeCargaAction,
  declararVacantesAction,
  redistribuirVacanteAction,
  type ResultadoDeLaPantalla,
} from "@/lib/jury-assignment/actions";
import type { Vacante } from "@/lib/jury-assignment/vacantes";

export type Recomendacion = { recomendados: number; motivo: string } | null;

type Props = {
  editionId: string;
  hayJuzgamiento: boolean;
  vacantes: Vacante[];
  recomendacion: Recomendacion;
  tope: number;
  obras: number;
  fotosPorJurado: number;
  sePuedeCambiar: { ok: boolean; motivo?: string };
  nombreDeConsigna: Record<string, string>;
};

export function EquipoDeJurado({
  editionId,
  hayJuzgamiento,
  vacantes,
  recomendacion,
  tope,
  obras,
  fotosPorJurado,
  sePuedeCambiar,
  nombreDeConsigna,
}: Props) {
  const [aviso, setAviso] = useState<ResultadoDeLaPantalla | null>(null);
  const [trabajando, iniciar] = useTransition();

  if (!hayJuzgamiento) {
    return (
      <Card variant="outlined" className="space-y-3 p-5">
        <h2 className="text-lg font-semibold text-ck-text">Equipo de jurado</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Para decidir cuántos jurados van a ser hace falta que el juzgamiento esté abierto.
          Cerrá y congelá el lote de admisión: ahí nace la sesión donde viven las vacantes.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="outlined" className="space-y-5 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ck-text">Equipo de jurado</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Decí cuántos van a ser aunque todavía no sepas quiénes. Las obras se reparten entre
          las vacantes, así que quien ya está puede empezar hoy y al que llegue después lo va
          a estar esperando su lote.
        </p>
      </div>

      {aviso ? (
        <p
          className={`text-sm leading-relaxed ${aviso.ok ? "text-ck-text" : "text-ck-text-secondary"}`}
          role="status"
        >
          {aviso.mensaje}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <form
          action={(fd) =>
            iniciar(async () => {
              setAviso(await declararVacantesAction(editionId, fd));
            })
          }
          className="space-y-2 rounded-[var(--ck-radius-sm)] border border-ck-border p-4"
        >
          <label htmlFor="cuantos" className="block text-sm font-medium text-ck-text">
            ¿Cuántos jurados van a ser?
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="cuantos"
              name="cuantos"
              type="number"
              min={1}
              max={99}
              defaultValue={vacantes.length || recomendacion?.recomendados || 3}
              disabled={!sePuedeCambiar.ok}
              className="min-h-11 w-24 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm"
            />
            <Button type="submit" variant="primary" size="sm" disabled={trabajando || !sePuedeCambiar.ok}>
              Guardar
            </Button>
          </div>
          {recomendacion ? (
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              {recomendacion.motivo}
            </p>
          ) : null}
          {!sePuedeCambiar.ok ? (
            <p className="text-sm leading-relaxed text-ck-text-muted">{sePuedeCambiar.motivo}</p>
          ) : null}
        </form>

        <form
          action={(fd) =>
            iniciar(async () => {
              setAviso(await ajustarTopeDeCargaAction(editionId, fd));
            })
          }
          className="space-y-2 rounded-[var(--ck-radius-sm)] border border-ck-border p-4"
        >
          <label htmlFor="tope" className="block text-sm font-medium text-ck-text">
            Tope de fotos por jurado
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="tope"
              name="tope"
              type="number"
              min={1}
              max={5000}
              defaultValue={tope}
              className="min-h-11 w-24 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm"
            />
            <Button type="submit" variant="outline" size="sm" disabled={trabajando}>
              Guardar
            </Button>
          </div>
          <p className="text-sm leading-relaxed text-ck-text-muted">
            Es cuánto trabajo se le pide a cada uno antes de sumar otro. Con {obras} obras y
            este equipo, a cada jurado le tocan {fotosPorJurado} fotos.
          </p>
        </form>
      </div>

      {vacantes.length === 0 ? (
        <p className="text-sm text-ck-text-muted">
          Todavía no declaraste cuántos jurados van a ser. Mientras tanto, cada jurado
          asignado ve todas las obras.
        </p>
      ) : (
        <ul className="space-y-2">
          {vacantes.map((v) => (
            <li
              key={v.seatNumber}
              className="rounded-[var(--ck-radius-sm)] border border-ck-border px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ck-text">
                  Vacante {v.seatNumber}
                  {v.nombre ? (
                    <span className="font-normal text-ck-text-secondary"> · {v.nombre}</span>
                  ) : (
                    <span className="font-normal text-ck-text-muted"> · libre</span>
                  )}
                </p>
                <p className="text-xs text-ck-text-muted">
                  {v.consignas.length} consigna{v.consignas.length === 1 ? "" : "s"}
                </p>
              </div>

              {v.consignas.length > 0 ? (
                <p className="mt-1 text-xs leading-relaxed text-ck-text-muted">
                  {v.consignas
                    .map((id) => nombreDeConsigna[id] ?? id)
                    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
                    .join(" · ")}
                </p>
              ) : null}

              {!v.judgeAccountId && v.consignas.length > 0 ? (
                <form
                  action={(fd) =>
                    iniciar(async () => {
                      setAviso(await redistribuirVacanteAction(editionId, fd));
                    })
                  }
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input type="hidden" name="seatNumber" value={v.seatNumber} />
                  <input
                    name="motivo"
                    placeholder="Por qué la repartís"
                    aria-label={`Motivo para repartir la vacante ${v.seatNumber}`}
                    className="min-h-11 flex-1 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm"
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={trabajando}>
                    Repartir entre los que están
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
