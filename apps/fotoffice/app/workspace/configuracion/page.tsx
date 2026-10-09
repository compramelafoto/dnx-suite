import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { puede } from "@/lib/access/policy";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { WorkspaceSettingsForm } from "./settings-form";
import { EmailSignaturePreview } from "@/components/communications/email-signature-preview";
import { TestEmailPanel } from "@/components/communications/test-email-panel";
import { toEmailSignatureData } from "@/lib/communications/workspace-signature";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { collectionCopy } from "@/lib/payments/connect/messages";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { enumerar, tiposConModuloEncendido } from "@/lib/campos/modulos";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";

export default async function WorkspaceSettingsPage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);

  const [branding, profile, membership, workspace] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: ensured.workspaceId },
    }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
      select: { role: true },
    }),
    prisma.workspace.findUnique({
      where: { id: ensured.workspaceId },
      select: { name: true },
    }),
  ]);
  const canEdit = canManageWorkspaceSettings(membership?.role);
  // Estado de cobros, para que el acceso diga si hace falta hacer algo.
  const cobros = await getWorkspaceCollectionStatus(ensured.workspaceId);
  const cobrosCopy = collectionCopy(cobros.status);
  // El acceso a Palabras muestra la que rige hoy: sin eso, entrar es la única forma de saber
  // si alguien ya la cambió.
  const vocabulario = await loadPersonVocabulary(ensured.workspaceId);
  // La tarjeta de Campos nombra los mismos tipos que las pestañas de su página: cada uno con su módulo.
  const NOMBRE_TIPO = { CLIENTE: "clientes", SOCIO: vocabulario.plural, CONSULTA: "consultas", PROYECTO: "proyectos" } as const;
  const tiposConCampos = (await tiposConModuloEncendido(ensured.workspaceId)).map((t) => NOMBRE_TIPO[t]);
  // Configuración → Consultas, sólo con el módulo encendido (como su pantalla).
  const consultasEncendido = await isModuleEnabledForWorkspace(ensured.workspaceId, SERVICE_LEADS_MODULE_KEY);
  // Configuración → Presupuestos: con Consultas o Presupuestos encendido (los ajustes se dejan
  // listos antes de encender el módulo, como en el menú).
  const presupuestosVisible = consultasEncendido || (await isModuleEnabledForWorkspace(ensured.workspaceId, QUOTES_MODULE_KEY));
  // Configuración → Pedidos: con Presupuestos o Pedidos encendido (como en el menú).
  const pedidosVisible =
    (await isModuleEnabledForWorkspace(ensured.workspaceId, QUOTES_MODULE_KEY)) ||
    (await isModuleEnabledForWorkspace(ensured.workspaceId, ORDERS_MODULE_KEY));

  return (
    <div className="space-y-8 max-w-xl">
      {/*
        Acceso a Cobros. Va arriba y siempre visible: si la institución no conectó su cuenta
        no puede cobrar nada, y esa es la primera cosa que necesita resolver.
      */}
      <Link
        href="/workspace/configuracion/cobros"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Cobros</span>
          <span
            className={
              "block text-xs " +
              (cobros.canCharge ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]")
            }
          >
            {cobrosCopy.title}
          </span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>

      {/*
        Acceso a las palabras de la institución. Va acá y no adentro del módulo: la palabra se
        usa en el menú, en el portal y en varios módulos a la vez, así que es del workspace.
      */}
      <Link
        href="/workspace/configuracion/palabras"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Las palabras de tu institución</span>
          <span className="block text-xs text-[var(--fo-muted)]">
            Hoy a la gente de tu padrón le decís {vocabulario.plural}.
          </span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>

      {/* Equipo (etapa 0.1) no se muestra: el equipo y sus permisos se administran en Comisión
          directiva (roles por módulo de main). La pantalla y sus tablas quedan sin enlace. */}
      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/modulos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Módulos</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Encendé o apagá lo que usa tu organización.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/ficha"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Ficha</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Categorías de las notas y etiquetas de las fichas.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/circuitos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Circuitos</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Etapas de ventas y trabajos, tareas automáticas y motivos de pérdida.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") && tiposConCampos.length > 0 ? (
        <Link
          href="/workspace/configuracion/campos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Campos</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Datos propios para las fichas de {enumerar(tiposConCampos, "y")}.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") && consultasEncendido ? (
        <Link
          href="/workspace/configuracion/consultas"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Consultas</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Categorías, orígenes, roles de participante y avisos de consultas nuevas.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/precios"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Precios</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Tus costos, tus horas y el valor de tu hora para calcular presupuestos con ¿Cuánto Cobro?
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") && presupuestosVisible ? (
        <Link
          href="/workspace/configuracion/presupuestos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Presupuestos</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Validez, condiciones generales, propuesta de pago y seguimiento de los presupuestos.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/whatsapp"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">WhatsApp</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Conexión de la Bandeja, pausa del bot y simulador de mensajes.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") && pedidosVisible ? (
        <Link
          href="/workspace/configuracion/pedidos"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Pedidos</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Recordatorio de cuotas, rubro de ingreso por omisión y checklist de los pedidos.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/plantillas"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Plantillas</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Textos de correo y WhatsApp listos para mandar desde las fichas, y la respuesta automática.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      {membership?.role && puede(membership.role, "configurar") ? (
        <Link
          href="/workspace/configuracion/numeracion"
          className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
        >
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Numeración</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Prefijo, año y próximo número de consultas, presupuestos, pedidos, contratos y proyectos.
            </span>
          </span>
          <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
        </Link>
      ) : null}

      <Link
        href="/workspace/configuracion/concursos"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Vitrina de concursos</span>
          <span className="block text-xs text-[var(--fo-muted)]">
            Qué concursos de FotoRank y Clickatón ven tus socios en su portal.
          </span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>

      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
          Configuración del negocio
        </h1>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          El logo de FotOffice es la marca del producto. Acá editás los datos de{" "}
          <strong className="font-medium text-[var(--fo-text)]">tu</strong> negocio — nombre, slug
          público, logo, portada, contacto y ubicación. Estos datos son del workspace y se usan en
          todos sus módulos, no solo en Cursos.
        </p>
        {!canEdit ? (
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed" role="status">
            Tenés acceso de solo lectura a esta pantalla.
          </p>
        ) : null}
      </div>
      <WorkspaceSettingsForm
        canEdit={canEdit}
        initial={{
          commercialName: branding?.commercialName ?? "",
          publicSlug: branding?.publicSlug ?? "",
          contactEmail: branding?.contactEmail ?? user.email,
          phone: branding?.phone ?? profile?.phone ?? "",
          whatsapp: branding?.whatsapp ?? "",
          city: branding?.city ?? "",
          province: branding?.province ?? "",
          country: branding?.country ?? "",
          website: branding?.website ?? "",
          instagram: branding?.instagram ?? "",
          emailSignatureNote: branding?.emailSignatureNote ?? "",
          shortDescription: branding?.shortDescription ?? "",
          activityType: normalizeFotofficeOrganizationType(branding?.activityType),
          specialties: branding?.specialties ?? [],
          logoUrl: branding?.logoUrl ?? null,
          coverImageUrl: branding?.coverImageUrl ?? null,
          displayName: profile?.displayName ?? user.name ?? "",
        }}
      />
      {canEdit ? (
        <EmailSignaturePreview
          data={toEmailSignatureData(
            {
              commercialName: branding?.commercialName ?? null,
              logoUrl: branding?.logoUrl ?? null,
              contactEmail: branding?.contactEmail ?? null,
              phone: branding?.phone ?? null,
              whatsapp: branding?.whatsapp ?? null,
              instagram: branding?.instagram ?? null,
              website: branding?.website ?? null,
              city: branding?.city ?? null,
              accentColor: branding?.accentColor ?? null,
              emailSignatureNote: branding?.emailSignatureNote ?? null,
            },
            workspace?.name ?? "",
          )}
        />
      ) : null}
      {/* Solo OWNER/ADMIN. La server action vuelve a verificarlo: esto es presentación. */}
      {canEdit ? <TestEmailPanel /> : null}
    </div>
  );
}
