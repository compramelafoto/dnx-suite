import { redirect } from "next/navigation";
import { sanitizeReturnTo } from "@repo/auth";
import { getCurrentUser } from "@repo/auth-guards";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ returnTo?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { returnTo } = await searchParams;
  const destino = returnTo ? sanitizeReturnTo(returnTo, { fallback: "" }) || undefined : undefined;

  // Quien ya tiene la sesión abierta no tiene nada que hacer acá.
  if (await getCurrentUser()) redirect(destino ?? "/cuenta/verificacion");

  return (
    <main id="contenido">
      <LoginForm returnTo={destino} />
    </main>
  );
}
