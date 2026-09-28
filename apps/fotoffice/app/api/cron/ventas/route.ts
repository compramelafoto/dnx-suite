import { NextResponse } from "next/server";
import { sincronizarWorkspace } from "@/lib/sales-assistant/sync";
import { workspacesConAlboomActivo } from "@/lib/sales-assistant/alboom/credentials";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { SALES_ASSISTANT_MODULE_KEY } from "@/lib/sales-assistant/constants";
import { presupuestoPorWorkspace } from "@/lib/sales-assistant/budget";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sincronización diaria del Asistente de ventas. Lee oportunidades de Alboom de los
 * workspaces que tienen credencial activa y módulo encendido. Reparte los 270 s de
 * presupuesto entre todos.
 *
 * Un workspace que falla no corta a los demás: se trata con try/catch individual y se
 * registra el error sin detener el cron.
 */

type ResumenWorkspace = {
  workspaceId: string;
  estado: string;
  leidas: number;
  analizadas: number;
};

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const inicio = Date.now();
    const PRESUPUESTO_TOTAL_MS = 270_000;
    const MINIMO_PARA_INICIAR = 15_000;

    const workspaces = await workspacesConAlboomActivo();
    const resultados: ResumenWorkspace[] = [];

    for (const workspaceId of workspaces) {
      const transcurrido = Date.now() - inicio;
      const restante = PRESUPUESTO_TOTAL_MS - transcurrido;
      const pendientes = workspaces.length - resultados.length;

      const deadlineMs = presupuestoPorWorkspace(restante, pendientes);

      // Omitir si no hay tiempo suficiente.
      if (deadlineMs < MINIMO_PARA_INICIAR) {
        resultados.push({ workspaceId, estado: "OMITIDO", leidas: 0, analizadas: 0 });
        continue;
      }

      try {
        // Verificar que el módulo esté habilitado para este workspace.
        const habilitado = await isModuleEnabledForWorkspace(
          workspaceId,
          SALES_ASSISTANT_MODULE_KEY,
        );
        if (!habilitado) {
          resultados.push({
            workspaceId,
            estado: "DESHABILITADO",
            leidas: 0,
            analizadas: 0,
          });
          continue;
        }

        // Sincronizar.
        const resumen = await sincronizarWorkspace(workspaceId, { deadlineMs });
        resultados.push({
          workspaceId,
          estado: resumen.estado,
          leidas: resumen.leidas,
          analizadas: resumen.analizadas,
        });
      } catch (error) {
        console.error("[fotoffice][cron/ventas] falló la sincronización del workspace", {
          workspaceId,
          detalle: sanitizeError(error),
        });
        resultados.push({
          workspaceId,
          estado: "ERROR",
          leidas: 0,
          analizadas: 0,
        });
      }
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (error) {
    console.error("[fotoffice][cron/ventas] falló la tarea programada", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json(
      { ok: false, error: "falló la tarea del asistente de ventas" },
      { status: 500 },
    );
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
