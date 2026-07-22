import { redirect } from "next/navigation";
import { routes } from "@/config/navigation";

/** Compatibilidad: Aliados Fundadores vive en `/formar-parte`. */
export default function AliadosFundadoresRedirectPage() {
  redirect(routes.joinUs);
}
