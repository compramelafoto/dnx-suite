import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { puedeAdministrarDemos } from "@/lib/demos/identidad";
import PresentacionEscolar from "@/components/demos/presentacion-escolar/PresentacionEscolar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Foto escolar paso a paso",
  robots: { index: false, follow: false },
};

/**
 * Presentación de la foto escolar en placas, sin datos: no lee ni escribe la base. Sirve para
 * charlas cuando no hace falta (o no conviene) entrar a la demo en vivo.
 */
export default async function PresentacionEscolarPage() {
  const user = await getAuthUser();
  if (!puedeAdministrarDemos(user ? { id: user.id, role: String(user.role) } : null)) {
    redirect("/admin");
  }
  return <PresentacionEscolar />;
}
