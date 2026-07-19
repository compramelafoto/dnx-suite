import { redirect } from "next/navigation";
import { routes } from "@/config/navigation";

/** Compatibilidad: la propuesta para empresas vive en Aliados Fundadores. */
export default function SponsorsRedirectPage() {
  redirect(routes.foundingAllies);
}
