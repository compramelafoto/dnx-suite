import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

/** Alias legacy → login unificado Cuenta DNX. */
export default async function LabLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const redirectTo =
    sp.redirect?.startsWith("/") && !sp.redirect.startsWith("//")
      ? sp.redirect
      : "/lab/dashboard";
  redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
}
