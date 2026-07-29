import { redirect } from "next/navigation";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { sanitizeClickatonReturnPath } from "@/lib/auth/return-path";
import { RegisterForm } from "./RegisterForm";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function CrearCuentaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextPath = sanitizeClickatonReturnPath(sp.next);
  const user = await getClickatonAuthUser();
  if (user) redirect(nextPath);

  return <RegisterForm nextPath={nextPath} />;
}
