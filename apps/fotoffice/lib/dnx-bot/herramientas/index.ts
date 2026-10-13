import type { BotTool } from "@repo/dnx-bot";
import type { CtxBot } from "../acceso";

/**
 * Las herramientas de DNX Bot se arman por persona (spec §8): quien no tiene el permiso no recibe
 * la herramienta, y cada `run` vuelve a chequear con las funciones de `lib/presupuestos` y
 * `lib/precios`. Los esquemas se escriben con la `z` de `@repo/dnx-bot` (zod 4), nunca con la de
 * FOTOFFICE. Ninguna recibe `workspaceId`: sale de `ctx`, que sale de la sesión.
 *
 * Base (PR 1): todavía ninguna. Las suman las etapas 1 (perfil), 2 (cotizar → presupuesto) y 3
 * (consultas y seguimientos). No hay ni habrá herramienta de envío.
 */
export function herramientasPara(ctx: CtxBot): BotTool[] {
  void ctx;
  return [];
}
