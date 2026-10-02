"use client";

import { useActionState, useState } from "react";
import { claseDeColorEtiqueta, NOMBRES_DE_COLOR } from "@/lib/ficha/formato";
import {
  borrarEtiquetaAction,
  colorEtiquetaAction,
  renombrarEtiquetaAction,
  unirEtiquetasAction,
  type EstadoCatalogo,
} from "./actions";
import { Mensaje } from "./mensaje";

export type EtiquetaFila = { id: string; name: string; color: string; personas: number };

const INICIAL: EstadoCatalogo = { error: null };
const COLORES = Object.keys(NOMBRES_DE_COLOR);

function personas(n: number): string {
  return n === 1 ? "1 persona" : `${n} personas`;
}

async function despachar(prev: EstadoCatalogo, fd: FormData): Promise<EstadoCatalogo> {
  switch (fd.get("_accion")) {
    case "renombrar":
      return renombrarEtiquetaAction(prev, fd);
    case "color":
      return colorEtiquetaAction(prev, fd);
    case "unir":
      return unirEtiquetasAction(prev, fd);
    case "borrar":
      return borrarEtiquetaAction(prev, fd);
    default:
      return { error: "Los datos no son válidos." };
  }
}

function Fila({ t, otras }: { t: EtiquetaFila; otras: EtiquetaFila[] }) {
  const [estado, enviar, pendiente] = useActionState(despachar, INICIAL);
  const [confirmar, setConfirmar] = useState<null | "borrar" | "unir">(null);
  const [destino, setDestino] = useState("");
  const destinoNombre = otras.find((o) => o.id === destino)?.name ?? "";

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${claseDeColorEtiqueta(t.color)}`}>{t.name}</span>
        <span className="text-xs text-[var(--fo-muted)]">{personas(t.personas)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={enviar} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={t.id} />
          <label className="sr-only" htmlFor={`tag-${t.id}`}>
            Nombre de la etiqueta
          </label>
          <input id={`tag-${t.id}`} name="nombre" defaultValue={t.name} maxLength={40} required className="fo-input min-w-0 flex-1" />
          <button type="submit" name="_accion" value="renombrar" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Guardar
          </button>
        </form>
        <form action={enviar} className="flex items-center gap-2">
          <input type="hidden" name="id" value={t.id} />
          <label className="sr-only" htmlFor={`color-${t.id}`}>
            Color de {t.name}
          </label>
          <select id={`color-${t.id}`} name="color" defaultValue={t.color} className="fo-input">
            {COLORES.map((c) => (
              <option key={c} value={c}>
                {NOMBRES_DE_COLOR[c]}
              </option>
            ))}
          </select>
          <button type="submit" name="_accion" value="color" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente}>
            Cambiar color
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {otras.length > 0 ? (
          <>
            <label className="sr-only" htmlFor={`unir-${t.id}`}>
              Unir {t.name} con
            </label>
            <select
              id={`unir-${t.id}`}
              value={destino}
              onChange={(e) => {
                setDestino(e.target.value);
                setConfirmar(null);
              }}
              className="fo-input max-w-56"
            >
              <option value="">Unir con…</option>
              {otras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={!destino || pendiente} onClick={() => setConfirmar("unir")}>
              Unir
            </button>
          </>
        ) : null}
        <button type="button" className="fo-btn fo-btn-danger-outline text-xs" disabled={pendiente} onClick={() => setConfirmar("borrar")}>
          Borrar
        </button>
      </div>

      {confirmar ? (
        <form action={enviar} className="space-y-2 rounded-lg bg-[var(--fo-surface-muted)] p-3 text-sm" aria-label="Confirmar">
          {confirmar === "borrar" ? (
            <>
              <input type="hidden" name="id" value={t.id} />
              <p>
                ¿Borrar «{t.name}»? Se va a quitar de {personas(t.personas)} y queda registrado en la historia de cada una.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="origenId" value={t.id} />
              <input type="hidden" name="destinoId" value={destino} />
              <p>
                ¿Unir «{t.name}» con «{destinoNombre}»? {t.personas > 0 ? `${personas(t.personas)} pasan a «${destinoNombre}» y ` : ""}
                «{t.name}» deja de existir.
              </p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmar(null)} disabled={pendiente}>
              Cancelar
            </button>
            <button type="submit" name="_accion" value={confirmar} className="fo-btn fo-btn-danger text-xs" disabled={pendiente}>
              {confirmar === "borrar" ? "Borrar etiqueta" : "Unir etiquetas"}
            </button>
          </div>
        </form>
      ) : null}
      <Mensaje estado={estado} />
    </li>
  );
}

export function EtiquetasCatalogo({ etiquetas }: { etiquetas: EtiquetaFila[] }) {
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="tag-titulo">
      <div className="space-y-1">
        <h2 id="tag-titulo" className="text-base font-semibold">
          Etiquetas
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Se crean desde la ficha al escribirlas. Acá podés renombrarlas, cambiarles el color, unir dos repetidas o borrarlas.
        </p>
      </div>
      {etiquetas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay etiquetas.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {etiquetas.map((t) => (
            <Fila key={t.id} t={t} otras={etiquetas.filter((o) => o.id !== t.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
