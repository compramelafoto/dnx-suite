"use client";

import { createContext, useContext, type ReactNode } from "react";
import { pesos } from "@/lib/presupuestos/editor";
import { enPesos } from "@/lib/precios/pesos";

/**
 * Cómo se escriben los importes en lo que cuelga de acá: con el signo («$ 193.900», lo de siempre
 * en el panel) o con la palabra («193.900 pesos», el portal del socio).
 *
 * Es un contexto y no una prop porque el asistente de ¿Cuánto Cobro? muestra importes en una
 * docena de componentes anidados que comparten el panel y el portal: pasarlo de mano en mano los
 * obligaba a todos a conocer una decisión que es de la pantalla.
 */
export type ModoPesos = "signo" | "palabra";

const Contexto = createContext<ModoPesos>("signo");

export function FormatoPesos({ modo, children }: { modo: ModoPesos; children: ReactNode }) {
  return <Contexto.Provider value={modo}>{children}</Contexto.Provider>;
}

export function useModoPesos(): ModoPesos {
  return useContext(Contexto);
}

/** El formateador que corresponde acá. */
export function useFormatearPesos(): (n: number) => string {
  return useModoPesos() === "palabra" ? enPesos : pesos;
}
