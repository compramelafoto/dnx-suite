import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { requireClientsViewer } from "@/lib/clients/access";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { cargarListadoClientes } from "@/lib/clients/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { GoogleContactsCard } from "@/components/members/google-contacts-card";
import { getContactSyncSetting } from "@/lib/contacts/settings";
import { GOOGLE_CONTACTS_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { toggleClientsGoogleContactsAction } from "./contactos-actions";

// Mensajes de `toggleClientsGoogleContactsAction`. Mismo criterio que en Socios.
const CONTACTOS_ERRORES: Record<string, string> = {
  sin_cuenta_google:
    "Todavía no hay una cuenta de Google conectada. Conectala en Integraciones antes de empezar a agendar.",
};
const CONTACTOS_OK: Record<string, string> = {
  contactos_encendido: "Listo. Los clientes se van a empezar a agendar en Google.",
  contactos_apagado: "Listo. Se dejó de agendar a los clientes en Google. Lo ya agendado no se borró.",
};

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export const dynamic = "force-dynamic";
// Las acciones en lote (server actions) corren bajo la configuración de esta página.
export const maxDuration = 300;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Ver el padrón pide VIEW en Clientes; crear y las acciones en lote, MANAGE (`canEdit`).
  const { user, workspace, canEdit } = await requireClientsViewer();
  const [ctx, total, contactSync, cuentaGoogle, params] = await Promise.all([
    contextoListadoDePagina(user, workspace, CLIENTS_MODULE_KEY),
    prisma.client.count({ where: { workspaceId: workspace.id } }),
    getContactSyncSetting(workspace.id, CLIENTS_MODULE_KEY),
    getIntegrationSummary(workspace.id, GOOGLE_CONTACTS_INTEGRATION_KEY),
    searchParams,
  ]);
  const contactosError = CONTACTOS_ERRORES[primero(params.error) ?? ""] ?? null;
  const contactosOk = CONTACTOS_OK[primero(params.ok) ?? ""] ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Padrón de clientes del negocio: ficha, contacto y datos fiscales."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/clientes/importar" className="fo-btn fo-btn-secondary text-sm">
                Importar
              </Link>
              <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
                Nuevo cliente
              </Link>
            </div>
          ) : undefined
        }
      />
      {contactosOk ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{contactosOk}</p> : null}
      {contactosError ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {contactosError}
        </p>
      ) : null}
      {total === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay clientes cargados</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Cargá el primero con su nombre, su contacto y —si hace falta facturarle— sus
              datos fiscales.
            </p>
          </div>
          {canEdit ? (
            <Link href="/clientes/nuevo" className="fo-btn fo-btn-primary text-sm">
              Crear el primer cliente
            </Link>
          ) : null}
        </div>
      ) : (
        <Listado def={await cargarListadoClientes(ctx)} ctx={ctx} ruta="/clientes" searchParams={searchParams} />
      )}
      {canEdit && total > 0 ? (
        <GoogleContactsCard
          copy={{
            titulo: "Agendar los clientes en Google",
            descripcion:
              "Cada cliente activo se agenda en tus contactos de Google, con su número, su categoría y sus etiquetas, y las correcciones que hagas desde el celular vuelven a su ficha.",
            plural: "clientes",
            grupo: "Clientes",
          }}
          action={toggleClientsGoogleContactsAction}
          enabled={contactSync?.enabled ?? false}
          account={cuentaGoogle ? { email: cuentaGoogle.accountEmail, status: cuentaGoogle.status } : null}
          lastSyncAt={contactSync?.lastSyncAt ?? null}
          lastSyncOk={contactSync?.lastSyncOk ?? null}
          lastSyncMessage={contactSync?.lastSyncMessage ?? null}
          syncedContacts={contactSync?.syncedContacts ?? 0}
        />
      ) : null}
    </div>
  );
}
