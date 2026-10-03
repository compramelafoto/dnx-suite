import Link from "next/link";
import { prisma } from "@repo/db";
import { requireCommissionAdmin } from "@/lib/commission/access";
import { isCurrentOrUpcoming } from "@/lib/commission/rules";
import { loadPeriodosComision } from "../personas";
import { RolAcciones } from "./roles-list";

export const dynamic = "force-dynamic";

const BASE = "/workspace/configuracion/comision/roles";

/** Roles: qué puede ver y hacer cada persona en el panel. */
export default async function RolesPage() {
  const { workspaceId } = await requireCommissionAdmin();
  const now = new Date();

  const [roles, periodos] = await Promise.all([
    prisma.workspaceCustomRole.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    loadPeriodosComision(workspaceId),
  ]);

  // Personas distintas con cada rol, vigente o por empezar (el mismo criterio que archivar).
  const personasPorRol = new Map<string, Map<string, string>>();
  for (const p of periodos) {
    if (p.tipo !== "rol" || !isCurrentOrUpcoming(p, now)) continue;
    const m = personasPorRol.get(p.refId) ?? new Map<string, string>();
    m.set(p.persona.key, p.persona.nombre);
    personasPorRol.set(p.refId, m);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm leading-relaxed text-[var(--fo-muted)]">
          Un rol es un paquete de permisos: en qué partes del panel entra la persona y si sólo mira
          o también puede cambiar cosas. Una persona puede tener varios.
        </p>
        <Link href={`${BASE}/nuevo`} className="fo-btn fo-btn-primary min-h-11">
          Nuevo rol
        </Link>
      </div>

      {roles.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">Todavía no hay roles. Creá el primero.</p>
      ) : (
        <ul className="space-y-3">
          {roles.map((r) => {
            const personas = Array.from(personasPorRol.get(r.id)?.values() ?? []).sort((a, b) =>
              a.localeCompare(b, "es"),
            );
            return (
              <li key={r.id} className="fo-card space-y-3 p-4 sm:p-5">
                <div className="space-y-1">
                  <Link href={`${BASE}/${r.id}`} className="font-semibold text-[var(--fo-text)] hover:underline">
                    {r.name}
                  </Link>
                  {r.description ? <p className="text-sm text-[var(--fo-text-secondary)]">{r.description}</p> : null}
                  <p className="text-xs text-[var(--fo-muted)]">
                    {personas.length === 0
                      ? "Nadie lo tiene ahora."
                      : personas.length === 1
                        ? "Lo tiene 1 persona."
                        : `Lo tienen ${personas.length} personas.`}
                  </p>
                </div>
                <RolAcciones roleId={r.id} nombre={r.name} personas={personas} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
