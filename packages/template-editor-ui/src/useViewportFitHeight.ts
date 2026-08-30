"use client";

import { useEffect, useState, type RefObject } from "react";

/** Por debajo de esto el editor no es usable; mejor que asome scroll a que se aplaste. */
const MIN_EDITOR_HEIGHT = 320;

/**
 * El alto que le queda al editor desde donde arranca hasta el pie de la ventana.
 *
 * El editor tiene que entrar en una pantalla, y cuánto espacio tiene depende de la aplicación
 * que lo monta: FotOffice lo abre sin su menú, Clickatón y CLF debajo de la cabecera de su
 * panel. En vez de que cada una le pase su alto —y que la cuenta quede desactualizada cuando
 * alguna cambie su cabecera—, el editor mide dónde empieza y se queda con el resto.
 *
 * `visualViewport` antes que `innerHeight`: en el teléfono `innerHeight` no descuenta las
 * barras del navegador y el pie del editor queda cortado.
 *
 * Devuelve `null` hasta la primera medición; hasta entonces conviene usar `100dvh`, que es la
 * respuesta correcta cuando el editor ocupa la ventana entera.
 */
export function useViewportFitHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const next = Math.max(MIN_EDITOR_HEIGHT, Math.round(viewport - top));
      // Idempotente a propósito: aplicar el alto cambia el layout y vuelve a disparar al
      // observador. Si el valor no cambió, no hay render y la realimentación se corta sola.
      setHeight((prev) => (prev === next ? prev : next));
    };

    /**
     * Se mide en el acto, sin `requestAnimationFrame`.
     *
     * Diferirlo un cuadro parecía más prolijo —durante un resize el layout todavía se está
     * acomodando— pero el cuadro no se ejecuta con la pestaña en segundo plano: la medición
     * quedaba pendiente para siempre y el editor se congelaba en el alto que tenía al
     * esconderse. Tanto `resize` como el observador ya avisan con el layout resuelto, y si
     * alguna lectura sale adelantada, la siguiente la corrige sin costo.
     */
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    // El techo del editor puede moverse sin que la ventana cambie de tamaño: una cabecera que
    // se pliega, un aviso que aparece. Se observa el contenedor que lo monta, no el documento:
    // el documento incluye al editor y observarlo sería observar el propio efecto de medir.
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);

    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [ref]);

  return height;
}
