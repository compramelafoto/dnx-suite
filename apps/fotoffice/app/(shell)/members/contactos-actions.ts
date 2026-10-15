"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { GOOGLE_CONTACTS_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { setContactSyncEnabled } from "@/lib/contacts/settings";
import { syncWorkspaceContacts } from "@/lib/contacts/sync";

const PANTALLA = "/members";

/**
 * Enciende o apaga el agendado de socios en Google.
 *
 * Encenderlo sube datos personales de los socios a una cuenta de Google, así que lo hace
 * solo quien gestiona el padrón (nivel MANAGE en Socios, la misma regla con la que la
 * pantalla muestra la tarjeta) y queda registrado quién fue. Conectar la cuenta de Google,
 * en cambio, sigue siendo de Configuración.
 *
 * Apagarlo NO borra nada en Google: solo deja de sincronizar.
 */
export async function toggleGoogleContactsAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE"))) {
    redirect(`${PANTALLA}?error=sin_permiso`);
  }

  const encender = String(formData.get("enabled") ?? "") === "true";

  // No se puede encender sin cuenta conectada: el interruptor quedaría encendido y sin
  // efecto, que es la peor combinación —el dueño cree que está agendando y no.
  if (encender) {
    const cuenta = await getIntegrationSummary(workspace.id, GOOGLE_CONTACTS_INTEGRATION_KEY);
    if (cuenta?.status !== "ACTIVE") redirect(`${PANTALLA}?error=sin_cuenta_google`);
  }

  await setContactSyncEnabled({
    workspaceId: workspace.id,
    moduleKey: MEMBERS_MODULE_KEY,
    enabled: encender,
    userId: user.id,
  });

  // La corrida de todos los días es de madrugada: sin esto, quien enciende el agendado no
  // ve nada hasta el día siguiente. Corre después de responder, para no dejar la pantalla
  // esperando los minutos que tarda la primera carga.
  if (encender) {
    const workspaceId = workspace.id;
    after(async () => {
      try {
        await syncWorkspaceContacts(workspaceId);
      } catch (error) {
        console.error("[fotoffice][contactos] falló la primera sincronización", {
          workspaceId,
          detalle: error instanceof Error ? error.message : "error desconocido",
        });
      }
    });
  }

  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ok=${encender ? "contactos_encendido" : "contactos_apagado"}`);
}
