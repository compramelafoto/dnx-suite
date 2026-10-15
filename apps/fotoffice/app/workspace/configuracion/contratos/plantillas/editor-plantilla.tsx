"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearPlantillaContratoAction, editarPlantillaContratoAction, eliminarPlantillaContratoAction } from "@/app/actions/contratos";
import { VistaContrato } from "@/components/contratos/vista-contrato";
import { vistaPreviaDePlantilla, type EmpresaMuestra } from "@/lib/contratos/muestra";
import { VARIABLES_CONTRATO } from "@/lib/contratos/variables";

type Plantilla = { id: string; name: string; body: string; isActive: boolean; order: number };

const GRUPOS = [...new Set(VARIABLES_CONTRATO.map((v) => v.grupo))];

/**
 * Editor de una plantilla: nombre, activa, orden y texto, con un selector que inserta variables en el
 * cursor, avisos de variables que no existen y vista previa en vivo sobre un pedido de ejemplo (datos
 * inventados; sólo la empresa sale de los ajustes).
 */
export function EditorPlantilla({ plantilla, empresa, hoy }: { plantilla: Plantilla | null; empresa: EmpresaMuestra; hoy: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const [nombre, setNombre] = useState(plantilla?.name ?? "");
  const [cuerpo, setCuerpo] = useState(plantilla?.body ?? "");
  const [activa, setActiva] = useState(plantilla?.isActive ?? true);
  const [orden, setOrden] = useState(String(plantilla?.order ?? 0));
  const [variable, setVariable] = useState(VARIABLES_CONTRATO[0]?.clave ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);

  const vista = useMemo(() => vistaPreviaDePlantilla(cuerpo, empresa, new Date(hoy)), [cuerpo, empresa, hoy]);

  function insertar() {
    const a = area.current;
    const texto = `[${variable}]`;
    if (!a) return setCuerpo((c) => c + texto);
    const desde = a.selectionStart ?? cuerpo.length;
    const hasta = a.selectionEnd ?? desde;
    const nuevo = cuerpo.slice(0, desde) + texto + cuerpo.slice(hasta);
    setCuerpo(nuevo);
    requestAnimationFrame(() => {
      a.focus();
      a.setSelectionRange(desde + texto.length, desde + texto.length);
    });
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        if (plantilla) {
          const r = await editarPlantillaContratoAction(plantilla.id, { name: nombre, body: cuerpo, isActive: activa, order: orden });
          if (!r.ok) return setError(r.error);
          setOk("Guardado.");
          router.refresh();
        } else {
          const r = await crearPlantillaContratoAction({ name: nombre, body: cuerpo, isActive: activa });
          if (!r.ok) return setError(r.error);
          router.push(`/workspace/configuracion/contratos/plantillas?editar=${encodeURIComponent(r.id)}`);
        }
      } catch {
        setError("No pudimos guardar los cambios. Probá de nuevo en un rato.");
      }
    });
  }

  function borrar() {
    if (!plantilla) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await eliminarPlantillaContratoAction(plantilla.id);
        if (!r.ok) return setError(r.error);
        router.push("/workspace/configuracion/contratos/plantillas");
      } catch {
        setError("No pudimos borrar la plantilla. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={guardar} className="fo-card space-y-5 p-5" aria-label={plantilla ? "Editar plantilla" : "Nueva plantilla"}>
      <h2 className="text-base font-semibold">{plantilla ? "Editar plantilla" : "Nueva plantilla"}</h2>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pl-nombre">Nombre</label>
          <input id="pl-nombre" className="fo-input" maxLength={120} required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        {plantilla ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="pl-orden">Orden</label>
            <input id="pl-orden" type="number" min={0} max={9999} step={1} className="fo-input" value={orden} onChange={(e) => setOrden(e.target.value)} />
          </div>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Activa (se ofrece al armar un contrato)
      </label>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="fo-field-stack min-w-0 flex-1">
              <label className="fo-label" htmlFor="pl-variable">Variable</label>
              <select id="pl-variable" className="fo-input" value={variable} onChange={(e) => setVariable(e.target.value)}>
                {GRUPOS.map((g) => (
                  <optgroup key={g} label={g}>
                    {VARIABLES_CONTRATO.filter((v) => v.grupo === g).map((v) => (
                      <option key={v.clave} value={v.clave}>{`[${v.clave}] · ${v.etiqueta}`}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={insertar}>
              Insertar
            </button>
          </div>
          <p className="text-xs text-[var(--fo-muted)]">{VARIABLES_CONTRATO.find((v) => v.clave === variable)?.descripcion}</p>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="pl-cuerpo">Texto del contrato</label>
            <textarea
              id="pl-cuerpo"
              ref={area}
              className="fo-input min-h-96 font-mono text-sm"
              maxLength={100000}
              required
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              aria-describedby="pl-ayuda"
            />
            <p id="pl-ayuda" className="text-xs text-[var(--fo-muted)]">
              Usá <code># Título</code> y <code>## Subtítulo</code> al principio de la línea, <code>**negrita**</code> y una línea en blanco entre párrafos.
              Con <code>[si:variable]…[/si]</code> el texto aparece sólo si la variable tiene dato.
            </p>
          </div>
          {!vista.ok ? (
            <div role="alert" className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-danger)] p-3 text-sm text-[var(--fo-danger)]">
              <p className="font-medium">Hay cosas para corregir antes de guardar:</p>
              <ul className="list-disc pl-5">
                {vista.errores.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Vista previa con un pedido de ejemplo</h3>
          <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-[var(--fo-border)] bg-white p-4 text-black">
            {vista.ok ? <VistaContrato bloques={vista.bloques} /> : <p className="text-sm text-[var(--fo-muted)]">Corregí el texto para ver la vista previa.</p>}
          </div>
          <p className="text-xs text-[var(--fo-muted)]">Los datos de las personas y del pedido son inventados.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !vista.ok}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {plantilla ? (
          confirmaBorrar ? (
            <>
              <span className="text-sm">¿Borrar esta plantilla? Los contratos ya armados no cambian.</span>
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={borrar} disabled={pendiente}>Sí, borrarla</button>
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setConfirmaBorrar(false)}>No</button>
            </>
          ) : (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setConfirmaBorrar(true)} disabled={pendiente}>
              Borrar
            </button>
          )
        ) : null}
      </div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p>
        ) : ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">{ok}</p>
        ) : null}
      </div>
    </form>
  );
}
