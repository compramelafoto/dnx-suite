import { NextResponse } from "next/server";
import { syncWorkspaceContacts } from "@/lib/contacts/sync";
import { listWorkspacesWithContactSync } from "@/lib/contacts/settings";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Espeja las personas de cada módulo con Google Contacts, en las dos direcciones.
 *
 * Corre una vez por día, de madrugada (además, la tarea de sorteos la dispara al cerrar un
 * padrón: ver `lib/contacts/after-raffle.ts`). Es idempotente: una persona cuyos datos no cambiaron
 * no se vuelve a escribir, y una que ya tiene contacto no se duplica.
 *
 * **Nunca falla por Google.** Si una institución no conectó su cuenta, o el permiso fue
 * revocado, esa institución se saltea con su motivo y las demás siguen.
 */
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
    const workspaces = await listWorkspacesWithContactSync();

    const reportes = [];
    for (const workspaceId of workspaces) {
      try {
        const r = await syncWorkspaceContacts(workspaceId);
        reportes.push({ workspaceId, ...r });
      } catch (error) {
        // Segunda red: `syncWorkspaceContacts` ya atrapa lo suyo, pero esta
        // capa de afuera garantiza que si mañana lanza, esa institución no frena a las demás.
        console.error("[fotoffice][contactos] error sincronizando institución", {
          workspaceId,
          detalle: sanitizeError(error),
        });
        reportes.push({ workspaceId, ok: false, error: "fallo durante la sincronización" });
      }
    }

    // El `ok` global refleja si hubo alguna falla REAL (el catch).
    // Un `motivo` (institución que no conectó Google, permiso revocado, etc.)
    // no es falla del cron: es el caso esperado de instituciones sin contactos activados.
    const ok = !reportes.some(r => r.ok === false);
    return NextResponse.json({ ok, workspaces: reportes.length, reportes });
  } catch (error) {
    console.error("[fotoffice][contactos] falló la corrida de sincronización", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la sincronización" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
