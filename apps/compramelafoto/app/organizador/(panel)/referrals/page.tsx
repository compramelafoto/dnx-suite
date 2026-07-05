import { redirect } from "next/navigation";

/**
 * Ruta legada unificada con el dashboard: los organizadores usan Comisiones en eventos;
 * esta URL solo redirige sin exponer otros flujos.
 */
export default function OrganizadorReferralsLegacyRedirectPage() {
  redirect("/organizador/dashboard");
}
