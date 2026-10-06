import { requireMembersManageContext } from "@/lib/members/access";

/** Administrar categorías es exclusivo de WORKSPACE_OWNER/WORKSPACE_ADMIN. STAFF no entra ni por URL directa. */
export default async function MemberCategoriesLayout({ children }: { children: React.ReactNode }) {
  await requireMembersManageContext();
  return <>{children}</>;
}
