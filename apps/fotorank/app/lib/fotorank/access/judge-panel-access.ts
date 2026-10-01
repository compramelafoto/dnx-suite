import { cache } from "react";
import { prisma } from "@repo/db";

import { cuentaDeJuradoAbreElPanel } from "./judge-panel-entry";

/**
 * ¿Esta persona, además de lo que ya es en el sitio, tiene cuenta de jurado?
 *
 * Existe aparte de `resolveHomeCapabilities` a propósito: aquella resuelve las
 * tres capacidades juntas (inscripciones, organizaciones y jurado) porque el
 * hub personal las muestra todas. Los paneles sólo necesitan esta, y traer
 * hasta 40 inscripciones con sus concursos en cada navegación del panel sería
 * pagar por datos que nadie mira.
 *
 * Fail-closed: si la consulta falla, la entrada no aparece. Es un atajo del
 * menú, no una puerta — quien la necesite siempre puede ir a `/jurado/panel`,
 * y ahí la autorización se decide de verdad.
 *
 * `cache()` la deduplica dentro del mismo request, igual que en
 * `home-capabilities.ts`, y recibe un primitivo por la misma razón.
 */
export const tieneCuentaDeJurado = cache(async (email: string): Promise<boolean> => {
  const limpio = email.trim().toLowerCase();
  if (!limpio) return false;

  try {
    const cuenta = await prisma.fotorankJudgeAccount.findUnique({
      where: { email: limpio },
      select: { accountStatus: true },
    });
    return cuentaDeJuradoAbreElPanel(cuenta?.accountStatus);
  } catch (err: unknown) {
    console.error("FOTORANK JUDGE PANEL ENTRY ERROR", err);
    return false;
  }
});
