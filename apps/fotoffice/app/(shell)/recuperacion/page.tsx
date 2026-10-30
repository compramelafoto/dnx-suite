import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { NuevoCaso } from "@/components/recuperacion/nuevo-caso";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { ETIQUETA_ESTADO, RECUPERACION_LABEL, RECUPERACION_PANEL_ROUTE, type EstadoRecuperacion } from "@/lib/recuperacion/constantes";

export const dynamic = "force-dynamic";

function fecha(d: Date): string {
  return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
}

/**
 * Recuperación de tarjetas: el estudio abre un caso por tarjeta, la persona corre el programa en su
 * computadora con el código del caso y acá se ve, a distancia, todo lo que se encontró.
 */
export default async function RecuperacionPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const nivel = await getModuleLevel(user.id, workspace.id, SALES_MODULE_KEY);
  if (!hasLevel(nivel, "VIEW")) redirect("/dashboard");

  const casos = await prisma.fotofficeRecuperacion.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, titulo: true, estado: true, encontrados: true, dispositivo: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={RECUPERACION_LABEL}
        description="Rescatá fotos y videos borrados o de tarjetas formateadas. Abrí un caso, pasale el código a quien tiene la tarjeta (o usalo vos en el mostrador) y mirá desde acá lo que se va encontrando. La tarjeta sólo se lee: nunca se escribe ni se borra nada en ella."
      />
      {hasLevel(nivel, "MANAGE") ? <NuevoCaso /> : null}

      <section className="fo-card p-5" aria-labelledby="rec-casos">
        <h2 id="rec-casos" className="mb-3 text-base font-semibold">Casos</h2>
        {casos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no abriste ningún caso.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {casos.map((c) => (
              <li key={c.id}>
                <Link href={`${RECUPERACION_PANEL_ROUTE}/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:opacity-80">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.titulo}</span>
                    <span className="block text-xs text-[var(--fo-muted)]">
                      {fecha(c.createdAt)}
                      {c.dispositivo ? ` · ${c.dispositivo}` : ""}
                    </span>
                  </span>
                  <span className="text-sm text-[var(--fo-muted)]">
                    {ETIQUETA_ESTADO[c.estado as EstadoRecuperacion] ?? c.estado}
                    {c.encontrados > 0 ? ` · ${c.encontrados.toLocaleString("es-AR")} archivos` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
