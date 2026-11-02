import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { puedeAdministrarDemos } from "@/lib/demos/identidad";
import PresentacionEscolar from "@/components/demos/presentacion-escolar/PresentacionEscolar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Foto escolar en 8 placas",
  robots: { index: false, follow: false },
};

/** Versión corta de la presentación escolar: una idea por placa, sin datos. */
export default async function PresentacionEscolarResumidaPage() {
  const user = await getAuthUser();
  if (!puedeAdministrarDemos(user ? { id: user.id, role: String(user.role) } : null)) {
    redirect("/admin");
  }
  return <PresentacionEscolar version="resumida" />;
}
