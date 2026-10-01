"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  asignarJuradoAction,
  quitarAsignacionAction,
  type ResultadoDeLaPantalla,
} from "@/lib/jury-assignment/actions";
import type { JuradoDelPadron } from "@/lib/jury-assignment/assign-judge";
import {
  CUPO_POR_OMISION,
  METODOS_DE_CALIFICACION,
  METODO_POR_OMISION,
  QUE_HACE_CADA_METODO,
  type MetodoDeCalificacion,
} from "@/lib/jury-assignment/metodos";

type Asignada = {
  id: string;
  judgeAccountId: string;
  email: string;
  categoria: string;
  estado: string;
  votos: number;
};

type Props = {
  editionId: string;
  disponibles: JuradoDelPadron[];
  categorias: Array<{ id: string; name: string }>;
  asignadas: Asignada[];
};

function nombreVisible(j: JuradoDelPadron): string {
  return j.nombre ?? j.email;
}

export function JuradosDeLaEdicion({ editionId, disponibles, categorias, asignadas }: Props) {
  const [aviso, setAviso] = useState<ResultadoDeLaPantalla | null>(null);
  const [metodo, setMetodo] = useState<MetodoDeCalificacion>(METODO_POR_OMISION);
  const [trabajando, iniciar] = useTransition();

  const yaAsignados = new Set(asignadas.map((a) => a.judgeAccountId));
  const sinAsignar = disponibles.filter((j) => !yaAsignados.has(j.id));

  return (
    <div className="space-y-6">
      {aviso ? (
        <Card variant="outlined" className="p-4">
          <p
            className={`text-sm leading-relaxed ${aviso.ok ? "text-ck-text" : "text-ck-text-secondary"}`}
            role="status"
          >
            {aviso.mensaje}
          </p>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">Asignados a esta maratón</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Ven las obras anónimas en su panel de jurado, dentro de FotoRank.
          </p>
        </div>

        {asignadas.length === 0 ? (
          <p className="text-sm text-ck-text-muted">
            Todavía no asignaste a nadie. Sin jurados, las obras no se califican.
          </p>
        ) : (
          <ul className="space-y-3">
            {asignadas.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ck-radius-sm)] border border-ck-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ck-text">{a.email}</p>
                  <p className="text-xs text-ck-text-muted">
                    {a.categoria}
                    {a.votos > 0
                      ? ` · ${a.votos === 1 ? "1 obra calificada" : `${a.votos} obras calificadas`}`
                      : " · sin calificar todavía"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{a.estado}</Badge>
                  <form
                    action={(fd) =>
                      iniciar(async () => {
                        setAviso(await quitarAsignacionAction(editionId, fd));
                      })
                    }
                  >
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <Button type="submit" variant="outline" size="sm" disabled={trabajando}>
                      Quitar
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="outlined" className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ck-text">Asignar un jurado</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            La lista sale del padrón de FotoRank, que es común a toda la suite. Sólo aparecen
            los jurados aprobados y activos.
          </p>
        </div>

        {sinAsignar.length === 0 ? (
          <p className="text-sm text-ck-text-muted">
            {disponibles.length === 0
              ? "No hay jurados aprobados en el padrón todavía."
              : "Ya asignaste a todos los jurados disponibles."}
          </p>
        ) : (
          <form
            action={(fd) =>
              iniciar(async () => {
                setAviso(await asignarJuradoAction(editionId, fd));
              })
            }
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="judgeAccountId" className="text-sm font-medium text-ck-text">
                Jurado
              </label>
              <select
                id="judgeAccountId"
                name="judgeAccountId"
                required
                className="w-full rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text"
              >
                {sinAsignar.map((j) => (
                  <option key={j.id} value={j.id}>
                    {nombreVisible(j)} · {j.email}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ck-text">Categorías</legend>
              {categorias.length === 0 ? (
                <p className="text-sm text-ck-text-muted">
                  Esta maratón no tiene categorías activas.
                </p>
              ) : (
                <div className="space-y-2">
                  {categorias.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-ck-text">
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={c.id}
                        defaultChecked={categorias.length === 1}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="methodType" className="text-sm font-medium text-ck-text">
                Cómo califica
              </label>
              <select
                id="methodType"
                name="methodType"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoDeCalificacion)}
                className="w-full rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text"
              >
                {METODOS_DE_CALIFICACION.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-ck-text-muted">
                {QUE_HACE_CADA_METODO[metodo]}
              </p>
            </div>

            {/* El cupo sólo aparece cuando significa algo. */}
            {metodo === "SELECTION_WITH_QUOTA" ? (
              <div className="space-y-2">
                <label htmlFor="quota" className="text-sm font-medium text-ck-text">
                  Cuántas obras elige cada jurado
                </label>
                <input
                  id="quota"
                  name="quota"
                  type="number"
                  min={1}
                  defaultValue={CUPO_POR_OMISION}
                  className="w-full rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text sm:max-w-[12rem]"
                />
              </div>
            ) : null}

            {/*
              Dicho al asignar y no después: la regla se aplica sola en el portal,
              pero si nadie lo avisa acá, el organizador cree que asignó a alguien
              que en realidad no va a poder calificar.
            */}
            <p className="text-xs leading-relaxed text-ck-text-muted">
              Si esta persona tiene obras compitiendo en alguna de estas categorías, no va a
              poder calificarlas: nadie juzga donde compite.
            </p>

            <Button type="submit" variant="primary" disabled={trabajando || categorias.length === 0}>
              {trabajando ? "Asignando…" : "Asignar"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
