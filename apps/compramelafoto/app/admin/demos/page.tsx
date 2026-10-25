import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { puedeAdministrarDemos } from "@/lib/demos/identidad";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import DemosClient from "./DemosClient";

export const dynamic = "force-dynamic";

export default async function DemosPage() {
  const user = await getAuthUser();
  if (!puedeAdministrarDemos(user ? { id: user.id, role: String(user.role) } : null)) {
    redirect("/admin");
  }
  const ctx = await getContextoDemoEscolar();
  return <DemosClient preparada={Boolean(ctx)} albumSlug={ctx?.albumSlug ?? null} />;
}
