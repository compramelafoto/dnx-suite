import { redirect } from "next/navigation";
import { routes } from "@/config/navigation";

/** Compatibilidad: la experiencia vive en `/sponsors`. */
export default function AliadosFundadoresRedirectPage() {
  redirect(routes.sponsors);
}
