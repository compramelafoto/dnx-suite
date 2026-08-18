import { redirect } from "next/navigation";

/**
 * Reemplazada por la administración por-workspace en /admin/workspaces/[id]:
 * la matriz horizontal no escala a muchos módulos. Redirect para no romper
 * bookmarks existentes.
 */
export default function LegacyWorkspaceModulesPage() {
  redirect("/admin/workspaces");
}
