import { redirect } from "next/navigation";
import { getAuthUser } from "../lib/auth";
import { safeNextPath } from "../lib/safe-next-path";
import { RegisterForm } from "./RegisterForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function CrearCuentaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getAuthUser();
  if (user) redirect(next ?? "/participaciones");

  return <RegisterForm nextPath={next} />;
}
