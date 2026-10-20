import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

/**
 * Interruptor del bot de la Bandeja, por workspace: fila `WorkspaceFeatureModule` "whatsapp-bot"
 * (como el piloto "dnx-bot", a propósito fuera de `lib/modules/registry.ts`). Además hace falta el
 * bot de FOTOFFICE encendido y con clave (`FOTOFFICE_BOT_ENABLED`, `ANTHROPIC_API_KEY`).
 */

export const MODULO_BOT_WHATSAPP = "whatsapp-bot";

export function botEncendido(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, MODULO_BOT_WHATSAPP);
}

export async function cambiarBot(ctx: CtxConsultas, encendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: "Sólo un administrador puede cambiar las respuestas automáticas." };
  await prisma.workspaceFeatureModule.upsert({
    where: { workspaceId_moduleKey: { workspaceId: ctx.workspaceId, moduleKey: MODULO_BOT_WHATSAPP } },
    create: { workspaceId: ctx.workspaceId, moduleKey: MODULO_BOT_WHATSAPP, enabled: encendido },
    update: { enabled: encendido },
  });
  return { ok: true };
}
