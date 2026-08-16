import { requireMembersContext } from "@/lib/members/access";

/**
 * Gate de todo `/members/*`: auth + workspace activo + módulo `members`
 * habilitado. No exige rol OWNER/ADMIN acá — STAFF puede consultar padrón
 * y ficha. Las rutas de alta/edición/categorías exigen el rol extra ellas
 * mismas (`requireMembersManageContext`), no en este layout.
 */
export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  await requireMembersContext();
  return <div className="space-y-8">{children}</div>;
}
