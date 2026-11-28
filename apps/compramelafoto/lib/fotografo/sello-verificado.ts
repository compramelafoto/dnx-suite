import { isVerifiedPhotographer } from "@repo/gear/verificado";

type DbConIdentidad = {
  identityVerification: {
    findUnique(args: {
      where: { userId: number };
      select: { status: true; reverifyRequiredAt: true };
    }): Promise<{ status: string; reverifyRequiredAt: Date | null } | null>;
  };
};

/**
 * ¿Muestra el perfil público el sello «Fotógrafo verificado»?
 * Nunca rompe la página: si la consulta falla (p. ej. la tabla todavía no existe) devuelve false.
 */
export async function loadVerifiedPhotographer(
  db: DbConIdentidad,
  userId: number,
  role: string,
): Promise<boolean> {
  if (role !== "PHOTOGRAPHER") return false;
  try {
    const identity = await db.identityVerification.findUnique({
      where: { userId },
      select: { status: true, reverifyRequiredAt: true },
    });
    return isVerifiedPhotographer({ role }, identity);
  } catch {
    console.error("sello-verificado: no se pudo consultar la verificación de identidad");
    return false;
  }
}
