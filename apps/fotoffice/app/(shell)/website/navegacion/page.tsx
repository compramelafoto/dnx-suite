import { redirect } from "next/navigation";

/**
 * El menú se arma en la pestaña "Menú" del constructor, con vista previa en vivo. Esta ruta
 * queda para no romper enlaces viejos.
 */
export default function WebsiteNavigationPage() {
  redirect("/website?panel=menu");
}
