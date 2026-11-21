import { notFound } from "next/navigation";

/**
 * Cualquier URL que no sea una página cae acá (las rutas concretas tienen prioridad sobre este
 * comodín). El layout raíz vive en `[marca]`, así que sin esta página el 404 de Next se mostraba
 * suelto, sin encabezado, pie ni fuente; con ella se muestra dentro del sitio de cada marca.
 */
export default function NoEncontrada(): never {
  notFound();
}
