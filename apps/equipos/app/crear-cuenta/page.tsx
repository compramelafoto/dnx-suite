import { redirect } from "next/navigation";
import { sanitizeReturnTo } from "@repo/auth";
import { getCurrentUser } from "@repo/auth-guards";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ returnTo?: string }> };

export default async function CrearCuentaPage({ searchParams }: Props) {
  const { returnTo } = await searchParams;
  const destino = returnTo ? sanitizeReturnTo(returnTo, { fallback: "" }) || undefined : undefined;

  if (await getCurrentUser()) redirect(destino ?? "/cuenta/verificacion");

  return (
    <main id="contenido">
      <RegisterForm returnTo={destino} />
    </main>
  );
}
