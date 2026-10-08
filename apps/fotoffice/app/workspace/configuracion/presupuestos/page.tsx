import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { leerAjustes } from "@/lib/presupuestos/ajustes";
import { asegurarAjustesDnx } from "@/lib/presupuestos/semillas";
import { AjustesForm } from "./ajustes-form";
import { PestanasPresupuestos } from "./pestanas";

export const dynamic = "force-dynamic";

/**
 * Configuración → Presupuestos (spec §3.4): validez, condiciones, propuesta y opciones de pago y seguimiento.
 * Permiso: `configurar`. Se puede configurar con el módulo apagado, para dejarlo listo antes de
 * encenderlo; sólo cambia el aviso de arriba.
 */
export default async function ConfiguracionPresupuestosPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Presupuestos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los presupuestos.</p>
      </div>
    );
  }

  // DNX Estudio arranca con sus ajustes (15 días de validez, seguimiento a 3 días apagado). Nunca pisa una fila.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  const slug = branding?.publicSlug ?? "";
  await asegurarAjustesDnx(workspace.id, slug);

  const [ajustes, encendido] = await Promise.all([
    leerAjustes(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Validez, condiciones generales, propuesta y opciones de pago de los presupuestos nuevos, y el seguimiento."
      />
      <PestanasPresupuestos activa="ajustes" />
      {!encendido ? (
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Presupuestos todavía no está encendido. Podés dejar los ajustes listos; para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      ) : null}
      <AjustesForm ajustes={ajustes} />
      <section className="fo-card space-y-2 p-5 text-sm" aria-labelledby="numeracion-presupuesto-titulo">
        <h2 id="numeracion-presupuesto-titulo" className="text-base font-semibold">
          Numeración
        </h2>
        <p className="text-[var(--fo-muted)]">
          El número de cada presupuesto (prefijo, año y próximo número) se configura en{" "}
          <Link href="/workspace/configuracion/numeracion" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Numeración
          </Link>
          , en la fila «Presupuestos».
        </p>
        <p className="text-[var(--fo-muted)]">
          Por omisión el número lleva el año y cuatro dígitos (2026-0001) y vuelve a 0001 cada 1° de enero.
        </p>
      </section>
    </div>
  );
}
