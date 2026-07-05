import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import CuantoCobroAppChrome from "@/components/cuantocobro/CuantoCobroAppChrome";
import { getAuthUser } from "@/lib/auth";
import { getCuantoCobroLoginUrl } from "@/lib/cuantocobro/constants";
import { markCuantoCobroUserAccess } from "@/lib/cuantocobro/user-access";

const ALLOWED_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

export default async function CuantoCobroAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  if (!user) {
    redirect(getCuantoCobroLoginUrl());
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    redirect("/cuantocobro?error=acceso");
  }

  try {
    await markCuantoCobroUserAccess(user.id);
  } catch (err) {
    console.error("[cuantocobro] No se pudo registrar acceso de usuario:", err);
  }

  return <CuantoCobroAppChrome>{children}</CuantoCobroAppChrome>;
}
