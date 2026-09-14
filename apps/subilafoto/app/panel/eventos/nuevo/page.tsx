import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { FormularioEvento } from "./formulario";

export const dynamic = "force-dynamic";

export default async function NuevoEvento() {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Feventos%2Fnuevo");

  return (
    <main className="sobre-claro mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-extrabold leading-tight">Nuevo evento</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        Con estos datos alcanza para empezar. La plantilla, la portada y el QR se configuran
        después.
      </p>

      <FormularioEvento zonaPorDefecto="America/Argentina/Buenos_Aires" />
    </main>
  );
}
