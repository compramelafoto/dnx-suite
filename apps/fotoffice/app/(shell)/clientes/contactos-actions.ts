"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireClientsEditor } from "@/lib/clients/access";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { GOOGLE_CONTACTS_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { setContactSyncEnabled } from "@/lib/contacts/settings";
import { syncWorkspaceContacts } from "@/lib/contacts/sync";

const PANTALLA = "/clientes";

/**
 * Enciende o apaga el agendado de clientes en Google. Misma regla que el de socios
 * (`members/contactos-actions.ts`): lo hace quien gestiona Clientes, no se enciende sin cuenta
 * conectada y apagarlo no borra nada en Google.
 */
export async function toggleClientsGoogleContactsAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireClientsEditor();
  const encender = String(formData.get("enabled") ?? "") === "true";

  if (encender) {
    const cuenta = await getIntegrationSummary(workspace.id, GOOGLE_CONTACTS_INTEGRATION_KEY);
    if (cuenta?.status !== "ACTIVE") redirect(`${PANTALLA}?error=sin_cuenta_google`);
  }

  await setContactSyncEnabled({
    workspaceId: workspace.id,
    moduleKey: CLIENTS_MODULE_KEY,
    enabled: encender,
    userId: user.id,
  });

  if (encender) {
    const workspaceId = workspace.id;
    after(async () => {
      try {
        await syncWorkspaceContacts(workspaceId);
      } catch (error) {
        console.error("[fotoffice][contactos] falló la primera sincronización de clientes", {
          workspaceId,
          detalle: error instanceof Error ? error.message : "error desconocido",
        });
      }
    });
  }

  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ok=${encender ? "contactos_encendido" : "contactos_apagado"}`);
}
