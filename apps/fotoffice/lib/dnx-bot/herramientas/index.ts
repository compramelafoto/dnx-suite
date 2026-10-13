import type { BotTool } from "@repo/dnx-bot";
import type { CtxBot } from "../acceso";
import { herramientasDePerfil } from "./perfil";

/**
 * Las herramientas de DNX Bot se arman por persona (spec §8): quien no tiene el permiso no recibe
 * la herramienta (el modelo ni la ve), y cada `run` vuelve a chequear con las funciones de
 * `lib/presupuestos` y `lib/precios`. Los esquemas se escriben con la `z` de `@repo/dnx-bot`
 * (zod 4). Ninguna recibe `workspaceId`: sale de `ctx`, que sale de la sesión. No hay ni habrá
 * herramienta de envío.
 *
 * - Etapa 1 (perfil de precios): sólo con `configurar`.
 * - Etapas 2 y 3: las suman los PR siguientes.
 */
export function herramientasPara(ctx: CtxBot): BotTool[] {
  return [...(ctx.capacidades.configurar ? herramientasDePerfil(ctx) : [])];
}
