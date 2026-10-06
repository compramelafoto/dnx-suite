import Link from "next/link";
import { countMembersByStatus, listMemberCategories } from "@repo/db/fotoffice-members";
import { requireMembersContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { cargarListadoSocios } from "@/lib/members/listado";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { GoogleContactsCard } from "@/components/members/google-contacts-card";
import { getContactSyncSetting } from "@/lib/contacts/settings";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { GOOGLE_CONTACTS_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

// Mensajes de `toggleGoogleContactsAction` (contactos-actions.ts). Igual criterio que
// `lib/integrations/messages.ts`: nada de detalle técnico, solo lo que el dueño puede hacer.
const CONTACTOS_ERRORES: Record<string, string> = {
  sin_permiso: "No tenés permiso para cambiar esto.",
  sin_cuenta_google:
    "Todavía no hay una cuenta de Google conectada. Conectala en Integraciones antes de empezar a agendar.",
};

const CONTACTOS_OK: Record<string, string> = {
  contactos_encendido: "Listo. Los socios se van a empezar a agendar en Google.",
  contactos_apagado: "Listo. Se dejó de agendar a los socios en Google. Lo ya agendado no se borró.",
};

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Encender el agendado en Google dispara la primera carga, que tarda unos minutos, y las
 * acciones en lote (hasta 5.000 cambios de categoría, de a uno) corren como Server Actions de
 * esta página: las dos heredan este tope.
 */
export const maxDuration = 300;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, canManage } = await requireMembersContext();
  const sp = await searchParams;
  const error = uno(sp.error);
  const ok = uno(sp.ok);
  const contactosError = error ? (CONTACTOS_ERRORES[error] ?? null) : null;
  const contactosOk = ok ? (CONTACTOS_OK[ok] ?? null) : null;
  const [v, counts, categories, ctx, contactSync, cuentaGoogle] = await Promise.all([
    loadPersonVocabulary(workspace.id),
    countMembersByStatus(workspace.id),
    listMemberCategories(workspace.id),
    contextoListadoDePagina(user, workspace, MEMBERS_MODULE_KEY),
    getContactSyncSetting(workspace.id, MEMBERS_MODULE_KEY),
    getIntegrationSummary(workspace.id, GOOGLE_CONTACTS_INTEGRATION_KEY),
  ]);

  const noMembersAtAll = counts.total === 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title={v.Plural}
        description={`Padrón de ${v.plural} de este workspace: alta, edición, categorías y estado.`}
        actions={
          canManage ? (
            <>
              <Link href="/members/categories" className="fo-btn fo-btn-secondary text-sm">
                Categorías
              </Link>
              <Link href="/members/import" className="fo-btn fo-btn-secondary text-sm">
                {`Importar ${v.plural}`}
              </Link>
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                {`Agregar ${v.singular}`}
              </Link>
            </>
          ) : undefined
        }
      />

      {contactosOk ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{contactosOk}</p>
      ) : null}

      {contactosError ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {contactosError}
        </p>
      ) : null}

      {noMembersAtAll ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            {/* Reformulado para no depender del género: "cargados" concordaba en masculino
                con "socios" y no con la palabra que configure cada workspace. */}
            <p className="text-base font-semibold text-[var(--fo-text)]">{`El padrón de ${v.plural} todavía está vacío`}</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {categories.length === 0
                ? `Primero creá al menos una categoría de ${v.singular}, después vas a poder cargar ${v.plural}.`
                : `Empezá cargando ${v.plural} al padrón de este workspace.`}
            </p>
          </div>
          {canManage ? (
            categories.length === 0 ? (
              <Link href="/members/categories/new" className="fo-btn fo-btn-primary text-sm">
                Crear primera categoría
              </Link>
            ) : (
              <Link href="/members/new" className="fo-btn fo-btn-primary text-sm">
                {`Agregar ${v.singular}`}
              </Link>
            )
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Total</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.total}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Activos</p>
              <p className="text-2xl font-semibold text-[var(--fo-success)] mt-1">{counts.ACTIVE}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Suspendidos</p>
              <p className="text-2xl font-semibold text-[var(--fo-text)] mt-1">{counts.SUSPENDED}</p>
            </div>
            <div className="fo-card !p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Inactivos</p>
              <p className="text-2xl font-semibold text-[var(--fo-muted)] mt-1">{counts.INACTIVE}</p>
            </div>
          </div>

          <Listado def={await cargarListadoSocios(ctx, v)} ctx={ctx} ruta="/members" searchParams={searchParams} />
        </>
      )}

      {canManage ? (
        <GoogleContactsCard
          enabled={contactSync?.enabled ?? false}
          account={
            cuentaGoogle ? { email: cuentaGoogle.accountEmail, status: cuentaGoogle.status } : null
          }
          lastSyncAt={contactSync?.lastSyncAt ?? null}
          lastSyncOk={contactSync?.lastSyncOk ?? null}
          lastSyncMessage={contactSync?.lastSyncMessage ?? null}
          syncedContacts={contactSync?.syncedContacts ?? 0}
        />
      ) : null}
    </div>
  );
}
