import { cajaRotada, encuadreDesdePixeles } from "@/lib/impresion/geometria";
import type { Ajustes } from "@/lib/impresion/ajustes";
import { recetaInicial, type Receta } from "@/lib/impresion/receta";

/**
 * react-easy-crop da un único ángulo y el recorte en píxeles de la vista previa ya girada.
 * La receta guarda el giro de 90° aparte del enderezado (±10°) y el encuadre en proporciones.
 */
export function recetaDesdeEditor(d: {
  cropPx: { x: number; y: number; width: number; height: number };
  vista: { ancho: number; alto: number };
  rotacion: number;
  ajustes: Ajustes;
}): Receta {
  const normal = ((d.rotacion % 360) + 360) % 360;
  const cuarto = (Math.round(normal / 90) * 90) % 360;
  let enderezar = normal - cuarto;
  if (enderezar > 180) enderezar -= 360;
  const caja = cajaRotada(d.vista.ancho, d.vista.alto, d.rotacion);
  return {
    ...recetaInicial(),
    rotacion90: cuarto as Receta["rotacion90"],
    enderezar: Math.max(-10, Math.min(10, Math.round(enderezar * 10) / 10)),
    encuadre: encuadreDesdePixeles(d.cropPx, caja),
    ajustes: { ...d.ajustes },
  };
}
