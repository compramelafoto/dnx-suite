import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { LoginForm } from "./login-form";
import { redirectIfAlreadySignedIn } from "./actions";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DENIED: Record<string, string> = {
  login: "Necesitás iniciar sesión para continuar.",
  "infospot-redaccion":
    "Acceso denegado a Redacción. Tu usuario no tiene rol INFOSPOT_DIRECTOR o INFOSPOT_REDACTOR activo.",
  "infospot-admin":
    "Acceso denegado al Admin. Solo el Director (o SUPER_ADMIN) puede entrar.",
  "infospot-events": "Acceso denegado al panel de eventos.",
};

type SearchParams = Promise<{ next?: string; forbidden?: string }>;

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/redaccion";
  await redirectIfAlreadySignedIn(next);

  const deniedMessage = params.forbidden ? DENIED[params.forbidden] ?? null : null;

  return (
    <PageShell
      title="Ingresar a Info Spot"
      description="Acceso para Director y Redacción. Sesión segura compartida con DNX Suite."
    >
      <LoginForm next={next} deniedMessage={deniedMessage} />
    </PageShell>
  );
}
