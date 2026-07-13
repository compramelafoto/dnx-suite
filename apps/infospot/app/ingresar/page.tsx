import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { friendlyGoogleLoginError } from "@/lib/google-oauth-start";
import { LoginForm } from "./login-form";
import { redirectIfAlreadySignedIn } from "./actions";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DENIED: Record<string, string> = {
  login: "Para continuar, ingresá con tu cuenta.",
  "infospot-redaccion":
    "Acceso denegado a Redacción. Tu usuario no tiene rol Info Spot activo (Director, Redactor o Colaborador).",
  "infospot-admin":
    "Acceso denegado al Admin. Solo el Director (o SUPER_ADMIN) puede entrar.",
  "infospot-events": "Acceso denegado al panel de eventos.",
};

type SearchParams = Promise<{
  next?: string;
  forbidden?: string;
  error?: string;
}>;

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
  const oauthError = friendlyGoogleLoginError(params.error);

  return (
    <PageShell
      title="Bienvenido a Info Spot"
      description="Acceso con identidad DNX Suite (Google o email y contraseña)."
    >
      <LoginForm next={next} deniedMessage={deniedMessage} oauthError={oauthError} />
    </PageShell>
  );
}
