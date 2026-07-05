import { Role } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import PlantillasLegacyClient from "./PlantillasLegacyClient";

export const dynamic = "force-dynamic";

/**
 * Solo admin ve el listado legacy; fotógrafos/lab solo usan Template V2.
 */
export default async function PlantillasPage() {
  const user = await getAuthUser();
  const allowed: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];
  if (!user || !allowed.includes(user.role)) {
    redirect("/fotografo/dashboard");
  }
  if (user.role !== Role.ADMIN) {
    redirect("/fotografo/diseno/plantillas/v2");
  }
  return <PlantillasLegacyClient />;
}
