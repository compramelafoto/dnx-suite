import type { Metadata } from "next";
import { PartnerOnboardingClient } from "./PartnerOnboardingClient";

export const metadata: Metadata = {
  title: "Completar datos | Partners Clickatón",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/**
 * Página pública de onboarding de partner (token opaco).
 * No indexable. Mensajes genéricos si el token es inválido.
 */
export default async function PartnerCompletarDatosPage({ params }: Props) {
  const { token } = await params;
  return <PartnerOnboardingClient token={token} />;
}
