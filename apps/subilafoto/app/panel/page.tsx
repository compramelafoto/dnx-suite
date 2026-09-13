import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";

export const dynamic = "force-dynamic";

/** Inicio del panel del profesional. Por ahora sólo confirma quién entró. */
export default async function Panel() {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;

  if (!usuario) redirect("/login?next=%2Fpanel");

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-extrabold">Hola{usuario.name ? `, ${usuario.name}` : ""}</h1>
      <p className="mt-4 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
        Entraste con {usuario.email}. El panel se construye en los próximos días: acá vas a
        crear tu enlace de venta y administrar tus eventos.
      </p>

      <form action="/api/auth/logout" method="post" className="mt-10">
        <button
          type="submit"
          className="rounded-xl px-6 py-3 font-extrabold text-white"
          style={{ background: "var(--slf-violeta)" }}
        >
          Salir
        </button>
      </form>
    </main>
  );
}
