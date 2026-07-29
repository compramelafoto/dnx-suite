import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

/** Alias legacy → login unificado Cuenta DNX (rol se resuelve post-login). */
export default async function PhotographerLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const redirectTo =
    sp.redirect?.startsWith("/") && !sp.redirect.startsWith("//")
      ? sp.redirect
      : "/fotografo/dashboard";
  redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
}
