"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MENSAJE_ALTO } from "@/lib/service-leads/insertar";

/**
 * Envuelve el formulario insertado en otra web y le avisa a esa web cuánto mide, cada vez que
 * cambia (al cargar, al elegir un tipo de presupuesto que suma campos, al mostrar el "gracias").
 * El script opcional `/insertar.js` escucha el aviso y ajusta el alto del marco.
 *
 * Se manda con `"*"` porque no sabemos en qué web está insertado; el aviso sólo lleva un número.
 * Sin script, nadie lo escucha y el marco queda con su alto fijo.
 */
export function AltoInsertado({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || window.parent === window) return;
    let ultimo = 0;
    const avisar = () => {
      const alto = Math.ceil(nodo.getBoundingClientRect().height);
      if (alto === ultimo) return;
      ultimo = alto;
      window.parent.postMessage({ type: MENSAJE_ALTO, height: alto }, "*");
    };
    avisar();
    const observador = new ResizeObserver(avisar);
    observador.observe(nodo);
    window.addEventListener("load", avisar);
    return () => {
      observador.disconnect();
      window.removeEventListener("load", avisar);
    };
  }, []);

  return (
    <div ref={ref} className="flow-root">
      {children}
    </div>
  );
}
