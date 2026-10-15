import { prisma } from "@repo/db";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { ensureCommissionSetupOnce } from "@/lib/commission/seed";
import { isCurrentOrUpcoming } from "@/lib/commission/rules";
import { CargoFila, NuevoCargo } from "./cargos-form";

export const dynamic = "force-dynamic";

/** Cargos de la comisión, en el orden en que se muestran (Presidencia primero). */
export default async function CargosPage() {
  const { workspaceId } = await requireCommissionAdmin();
  // Antes de leer: el layout siembra en paralelo y la primera visita podía verse vacía.
  await ensureCommissionSetupOnce(workspaceId);
  const now = new Date();

  const offices = await prisma.workspaceOffice.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      votes: true,
      terms: { where: { revokedAt: null }, select: { startsAt: true, endsAt: true, revokedAt: true } },
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        Los cargos dicen quién es quién en la comisión. Los que tienen tildado “Integra la comisión y
        vota” cuentan para las votaciones; un Revisor de cuentas, por ejemplo, no vota. Lo que cada
        persona puede hacer en el panel se define con los roles, no con el cargo.
      </p>

      {offices.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">Todavía no hay cargos. Creá el primero abajo.</p>
      ) : (
        <ol className="space-y-3">
          {offices.map((o, i) => (
            <CargoFila
              key={o.id}
              office={{ id: o.id, name: o.name, votes: o.votes }}
              ocupantes={o.terms.filter((t) => isCurrentOrUpcoming(t, now)).length}
              primero={i === 0}
              ultimo={i === offices.length - 1}
            />
          ))}
        </ol>
      )}

      <NuevoCargo />
    </div>
  );
}
