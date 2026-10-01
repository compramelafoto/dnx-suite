"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { ETIQUETA_CANAL, ETIQUETA_TIPO_PLANTILLA, type Canal, type TipoPlantilla } from "@/lib/plantillas/constantes";
import { Mensaje } from "../ficha/mensaje";
import { guardarAutomaticoAction, type EstadoPlantillas } from "./actions";
import { EditorTexto } from "./editor-texto";
import type { CampoDeEjemplo } from "./vista-previa";

const INICIAL: EstadoPlantillas = { error: null };

/** "Respuesta automática a una consulta nueva": interruptor, asunto, cuerpo y vista previa. */
export function AutomaticoForm({
  clave,
  nombre,
  canal,
  tipo,
  encendido: encendidoGuardado,
  actualizado,
  asunto: asuntoGuardado,
  cuerpo: cuerpoGuardado,
  campos,
}: {
  clave: string;
  nombre: string;
  canal: Canal;
  tipo: TipoPlantilla;
  encendido: boolean;
  /** Última vez que se guardó (ISO): si cambia, el formulario muestra lo guardado. */
  actualizado: string;
  asunto: string;
  cuerpo: string;
  campos: CampoDeEjemplo[];
}) {
  const [encendido, setEncendido] = useState(encendidoGuardado);
  const [asunto, setAsunto] = useState(asuntoGuardado);
  const [cuerpo, setCuerpo] = useState(cuerpoGuardado);
  // Al guardar, la página se revalida: el formulario pasa a mostrar lo que quedó guardado (recortado).
  const [version, setVersion] = useState(actualizado);
  if (version !== actualizado) {
    setVersion(actualizado);
    setEncendido(encendidoGuardado);
    setAsunto(asuntoGuardado);
    setCuerpo(cuerpoGuardado);
  }
  const [estado, enviar, pendiente] = useActionState(async (prev: EstadoPlantillas, fd: FormData) => {
    const r = await guardarAutomaticoAction(prev, fd);
    // Si no se guardó, el interruptor vuelve a lo que está guardado.
    if (r.error) setEncendido(encendidoGuardado);
    return r;
  }, INICIAL);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Controlado: sin el reseteo automático del formulario de React.
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => enviar(fd));
  }

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="automatico-titulo">
      <div className="space-y-1">
        <h2 id="automatico-titulo" className="text-base font-semibold">
          {nombre}
        </h2>
        <p className="text-xs font-medium text-[var(--fo-muted)]">
          {ETIQUETA_TIPO_PLANTILLA[tipo]} · {ETIQUETA_CANAL[canal]}
        </p>
        <p className="text-sm text-[var(--fo-muted)]">
          Cuando llega una consulta por el formulario público y trae correo, se le manda este correo después de guardarla.
          No se manda en las consultas cargadas a mano ni en las inscripciones presenciales. Si el envío falla, la consulta
          queda igual y el fallo queda en su historial.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="clave" value={clave} />
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            name="enabled"
            value="1"
            checked={encendido}
            onChange={(e) => setEncendido(e.target.checked)}
            className="size-4"
          />
          Mandar automáticamente
        </label>
        <EditorTexto
          idBase={`auto-${clave}`}
          canal={canal}
          tipo={tipo}
          campos={campos}
          asunto={asunto}
          setAsunto={setAsunto}
          cuerpo={cuerpo}
          setCuerpo={setCuerpo}
          errores={estado.errores}
        />
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          Guardar
        </button>
        {estado.errores?.length ? null : <Mensaje estado={estado} />}
      </form>
    </section>
  );
}
