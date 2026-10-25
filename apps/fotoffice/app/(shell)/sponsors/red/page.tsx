import { requireSponsorsViewer } from "@/lib/sponsors/access";
import { sponsorsWriteBlockedReason } from "@/lib/sponsors/clients";
import { searchDirectory } from "@/lib/sponsors/directory";
import { DirectorioDeLaRed } from "./directorio";

export const dynamic = "force-dynamic";

/**
 * El directorio de marcas de la red DNX. Se lee en el servidor con los filtros de la dirección;
 * sumar una marca la vincula (no la copia) y lleva a su ficha para elegir los espacios.
 */
export default async function RedDeSponsorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace, canManage } = await requireSponsorsViewer();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const puedeSumar = canManage && !sponsorsWriteBlockedReason();
  const resultado = await searchDirectory(workspace.id, params);
  return <DirectorioDeLaRed r={resultado} puedeSumar={puedeSumar} error={error} />;
}
