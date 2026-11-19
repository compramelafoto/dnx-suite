import { CLASE_PUNTO, ETIQUETA_SEMAFORO, type Semaforo } from "@/lib/consultas/semaforo-puro";

/**
 * El semáforo de la fecha de una consulta: un punto de color con el detalle al pasar el mouse (y
 * para lectores de pantalla). Sin estado ni datos de servidor: lo usan la tarjeta del tablero
 * (cliente), el listado y la ficha. Con `conTexto`, muestra también la etiqueta («Ocupada»…).
 */
export function PuntoSemaforo({ semaforo, conTexto = false }: { semaforo: Semaforo; conTexto?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={semaforo.texto}>
      <span className={`inline-block size-2.5 rounded-full ring-2 ring-[var(--fo-surface)] ${CLASE_PUNTO[semaforo.color]}`} aria-hidden="true" />
      {conTexto ? <span className="text-xs font-medium text-[var(--fo-text)]">{ETIQUETA_SEMAFORO[semaforo.color]}</span> : null}
      <span className="sr-only">{semaforo.texto}</span>
    </span>
  );
}
