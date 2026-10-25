import { redirect } from "next/navigation";
import { INITIAL_CUANTO_COBRO_PROFILE } from "@repo/cuanto-cobro-core";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { accesoCuantoCobroSocio, leerPerfilSocio } from "@/lib/cuanto-cobro-socio/perfil";
import { hasOwnBusiness, listUserProfiles } from "@/lib/portal/profiles";
import { guardarPerfilSocioAction } from "./actions";
import { CuantoCobroSocio } from "./cuanto-cobro-socio";

export const dynamic = "force-dynamic";

/**
 * ¿Cuánto Cobro? en el portal del socio: el mismo asistente de Configuración → Precios, con un perfil
 * que es de la persona y no de la institución. Sólo si la institución encendió el módulo.
 */
export default async function PortalCuantoCobroPage() {
  const user = await requireAuth();
  const context = await accesoCuantoCobroSocio(user.id);
  if (!context) redirect("/portal");

  const [guardado, perfiles, branding] = await Promise.all([
    leerPerfilSocio(user.id),
    listUserProfiles(user.id),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: context.workspace.id }, select: { commercialName: true } }),
  ]);
  const institucion = branding?.commercialName?.trim() || context.workspace.name;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">¿Cuánto Cobro?</h1>
        <p className="max-w-3xl text-sm text-[var(--fo-muted)]">
          Para no regalar tu trabajo, empezá por lo que necesitás ganar por mes para vivir de la fotografía y por tus gastos fijos. Con tus horas sale
          el valor de tu hora, y con él, el precio de cada trabajo sumando sus gastos variables.
        </p>
        <p className="max-w-3xl text-xs text-[var(--fo-muted)]">
          {`Lo que cargás acá es tuyo: ${institucion} no lo ve.`}
          {hasOwnBusiness(perfiles) ? "" : " Si algún día creás tu negocio en FotoOffice, podés llevarte este perfil a sus precios."}
        </p>
      </header>
      <CuantoCobroSocio
        inicial={guardado?.perfil ?? INITIAL_CUANTO_COBRO_PROFILE}
        version={guardado ? guardado.actualizado.toISOString() : null}
        accion={guardarPerfilSocioAction}
      />
    </div>
  );
}
