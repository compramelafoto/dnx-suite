import type { Metadata } from "next";
import { friendlyGoogleLoginError } from "@/lib/google-oauth-start";
import { LoginForm } from "./login-form";
import { redirectIfAlreadySignedIn } from "./actions";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DENIED: Record<string, string> = {
  login: "Para continuar, ingresá con tu Cuenta DNX.",
  "infospot-redaccion":
    "Estás autenticado, pero no tenés rol editorial activo (Director, Redactor o Colaborador).",
  "infospot-admin":
    "Estás autenticado, pero solo el Director (o SUPER_ADMIN) puede entrar al Admin.",
  "infospot-events": "Estás autenticado, pero no tenés acceso al panel de eventos.",
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
      : params.forbidden?.startsWith("infospot-")
        ? params.forbidden === "infospot-admin"
          ? "/admin"
          : "/redaccion"
        : "/";
  await redirectIfAlreadySignedIn(next);

  const deniedMessage = params.forbidden ? DENIED[params.forbidden] ?? null : null;
  const oauthError = friendlyGoogleLoginError(params.error);

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-6 py-16 md:px-10">
      <LoginForm next={next} deniedMessage={deniedMessage} oauthError={oauthError} />
    </main>
  );
}
