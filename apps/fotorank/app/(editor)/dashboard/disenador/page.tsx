import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DESIGNER_RETURN_COOKIE, safeReturnPath } from "../../../lib/fotorank/design/return-path";

export const dynamic = "force-dynamic";

/**
 * A donde va el diseñador al cerrarse. No hay una lista de plantillas propia: cada diseño vive
 * en su concurso (Diplomas o Imágenes de ganadores), así que se vuelve a la pantalla desde la
 * que se abrió.
 */
export default async function DisenadorVueltaPage() {
  const jar = await cookies();
  const vuelta = safeReturnPath(jar.get(DESIGNER_RETURN_COOKIE)?.value);
  redirect(vuelta ?? "/dashboard");
}
