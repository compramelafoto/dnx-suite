"use client";

import { useDeferredValue, useMemo, useRef } from "react";
import { MAX_ASUNTO, MAX_CUERPO, type Canal, type TipoPlantilla } from "@/lib/plantillas/constantes";
import { variablesPara, type GrupoVariable } from "@/lib/plantillas/variables";
import type { ErrorDeCampo } from "./actions";
import { armarVistaPrevia, documentoDeCorreo, type CampoDeEjemplo } from "./vista-previa";

/** Campos personalizados activos de cada tipo de ficha (GENERAL nunca tiene). */
export type CamposPorTipo = Record<TipoPlantilla, CampoDeEjemplo[]>;
/** Un tipo de ficha que se ofrece en el selector, con su nombre (Socios con el vocabulario). */
export type OpcionTipo = { valor: TipoPlantilla; etiqueta: string };

type Campo = "asunto" | "cuerpo";

/** Errores del servidor de un campo, con la posición en base 1 y un botón para ir a ella. */
function ErroresDe({
  errores,
  campo,
  irA,
}: {
  errores: ErrorDeCampo[] | undefined;
  campo: Campo;
  irA: (campo: Campo, e: ErrorDeCampo) => void;
}) {
  const propios = (errores ?? []).filter((e) => e.campo === campo);
  if (propios.length === 0) return null;
  return (
    <ul role="alert" className="space-y-1 text-sm text-[var(--fo-danger)]">
      {propios.map((e, i) => (
        <li key={`${e.posicion}-${i}`}>
          <button type="button" className="underline underline-offset-2" onClick={() => irA(campo, e)}>
            Carácter {e.posicion + 1}
          </button>
          : {e.mensaje}
        </li>
      ))}
    </ul>
  );
}

/**
 * Asunto (sólo Correo) y cuerpo con su lista de variables al costado y la vista previa en vivo con
 * datos de ejemplo. Los textos son controlados por el padre; los `name` van en el formulario del padre.
 */
export function EditorTexto({
  idBase,
  canal,
  tipo,
  campos,
  asunto,
  setAsunto,
  cuerpo,
  setCuerpo,
  errores,
}: {
  idBase: string;
  canal: Canal;
  tipo: TipoPlantilla;
  campos: CampoDeEjemplo[];
  asunto: string;
  setAsunto: (v: string) => void;
  cuerpo: string;
  setCuerpo: (v: string) => void;
  errores?: ErrorDeCampo[];
}) {
  const asuntoRef = useRef<HTMLInputElement>(null);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  // Dónde estaba el cursor por última vez: ahí se inserta la variable elegida.
  const ultimo = useRef<Campo>("cuerpo");
  const esCorreo = canal === "EMAIL";

  const variables = useMemo(() => variablesPara(tipo, tipo === "GENERAL" ? [] : campos), [tipo, campos]);
  const grupos = useMemo(() => {
    const m = new Map<GrupoVariable, typeof variables>();
    for (const v of variables) m.set(v.grupo, [...(m.get(v.grupo) ?? []), v]);
    return [...m.entries()];
  }, [variables]);

  const asuntoDiferido = useDeferredValue(asunto);
  const cuerpoDiferido = useDeferredValue(cuerpo);
  const vista = useMemo(
    () => armarVistaPrevia(canal, tipo, campos, asuntoDiferido, cuerpoDiferido),
    [canal, tipo, campos, asuntoDiferido, cuerpoDiferido],
  );

  function elemento(c: Campo) {
    return c === "asunto" ? asuntoRef.current : cuerpoRef.current;
  }

  function insertar(clave: string) {
    const token = `[${clave}]`;
    const destino: Campo = esCorreo && ultimo.current === "asunto" ? "asunto" : "cuerpo";
    const el = elemento(destino);
    const valor = destino === "asunto" ? asunto : cuerpo;
    const desde = el?.selectionStart ?? valor.length;
    const hasta = el?.selectionEnd ?? desde;
    const nuevo = valor.slice(0, desde) + token + valor.slice(hasta);
    if (destino === "asunto") setAsunto(nuevo);
    else setCuerpo(nuevo);
    const cursor = desde + token.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  function irA(c: Campo, e: ErrorDeCampo) {
    const el = elemento(c);
    if (!el) return;
    const largo = e.variable ? e.variable.length + 2 : 1;
    el.focus();
    el.setSelectionRange(e.posicion, e.posicion + largo);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0 space-y-4">
        {esCorreo ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`${idBase}-asunto`}>
              Asunto
            </label>
            <input
              ref={asuntoRef}
              id={`${idBase}-asunto`}
              name="asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              onFocus={() => (ultimo.current = "asunto")}
              maxLength={MAX_ASUNTO}
              required
              className="fo-input"
              aria-invalid={errores?.some((e) => e.campo === "asunto") || undefined}
            />
            <ErroresDe errores={errores} campo="asunto" irA={irA} />
          </div>
        ) : null}
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`${idBase}-cuerpo`}>
            Texto
          </label>
          <textarea
            ref={cuerpoRef}
            id={`${idBase}-cuerpo`}
            name="cuerpo"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            onFocus={() => (ultimo.current = "cuerpo")}
            maxLength={MAX_CUERPO[canal]}
            rows={10}
            required
            className="fo-input font-mono text-sm"
            aria-invalid={errores?.some((e) => e.campo === "cuerpo") || undefined}
          />
          <p className="text-xs text-[var(--fo-muted)]">
            Texto plano: una línea en blanco separa párrafos
            {esCorreo ? " y los enlaces http(s) se vuelven clicables. Si no ponés [firma], va al final" : ". La firma sólo va si ponés [firma]"}.
            {" "}
            {cuerpo.length.toLocaleString("es-AR")} / {MAX_CUERPO[canal].toLocaleString("es-AR")}
          </p>
          <ErroresDe errores={errores} campo="cuerpo" irA={irA} />
        </div>

        <section aria-label="Vista previa" className="space-y-2">
          <h3 className="text-sm font-semibold">Vista previa con datos de ejemplo</h3>
          {!vista.ok ? (
            <ul className="space-y-1 rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm">
              {vista.errores.map((e, i) => (
                <li key={i}>
                  {e.campo === "asunto" ? "Asunto" : "Texto"}, carácter {e.posicion + 1}: {e.mensaje}
                </li>
              ))}
            </ul>
          ) : (
            <>
              {vista.vacias.length > 0 ? (
                <p className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-3 py-2 text-sm">
                  Quedan vacías: {vista.vacias.map((v) => `[${v}]`).join(", ")}
                </p>
              ) : null}
              {esCorreo ? (
                <div className="overflow-hidden rounded-lg border border-[var(--fo-border)] bg-white">
                  <p className="border-b border-[var(--fo-border)] bg-[var(--fo-surface-muted)] px-3 py-2 text-sm text-[var(--fo-text)]">
                    <span className="text-[var(--fo-muted)]">Asunto: </span>
                    {vista.asunto || <em className="text-[var(--fo-muted)]">sin asunto</em>}
                  </p>
                  <iframe
                    title="Vista previa del correo"
                    sandbox=""
                    srcDoc={documentoDeCorreo(vista.html ?? "")}
                    className="h-72 w-full"
                  />
                </div>
              ) : (
                <div className="rounded-lg bg-[var(--fo-surface-muted)] p-3">
                  <p className="max-w-md whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-[var(--fo-success-soft)] px-3 py-2 text-sm text-[var(--fo-text)] shadow-sm">
                    {vista.texto || <em className="text-[var(--fo-muted)]">sin texto</em>}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <aside aria-label="Variables disponibles" className="space-y-3 lg:max-h-[36rem] lg:overflow-y-auto">
        <div>
          <h3 className="text-sm font-semibold">Variables</h3>
          <p className="text-xs text-[var(--fo-muted)]">Un clic la pone donde está el cursor.</p>
        </div>
        {grupos.map(([grupo, lista]) => (
          <div key={grupo} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">{grupo}</p>
            <ul className="flex flex-wrap gap-1">
              {lista.map((v) => (
                <li key={v.clave}>
                  <button
                    type="button"
                    // Sin perder el foco ni la selección del campo de texto.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertar(v.clave)}
                    title={v.descripcion}
                    aria-label={`Insertar ${v.etiqueta}`}
                    className="rounded-md border border-[var(--fo-border)] bg-[var(--fo-surface)] px-2 py-0.5 font-mono text-xs hover:border-[var(--fo-accent)]"
                  >
                    [{v.clave}]
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-[var(--fo-muted)]">
          Para que una frase desaparezca si falta el dato: [si:clave]…[/si].
        </p>
      </aside>
    </div>
  );
}
