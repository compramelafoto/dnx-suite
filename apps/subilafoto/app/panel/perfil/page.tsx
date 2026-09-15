import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { perfilDeVenta } from "@/lib/perfil-de-venta";
import { FormularioPerfil } from "./formulario";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

/**
 * La ficha de venta: lo que ve el cliente del fotógrafo.
 *
 * Es la pantalla que faltaba para que alguien pudiera vender. El perfil ya existía —nacía
 * solo con el primer evento— pero sin nombre, sin precio y sin publicar, así que el enlace
 * de venta daba 404 para siempre.
 */
export default async function Perfil() {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Fperfil");

  const id = await perfilDeVenta(usuario.id, usuario.name);
  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { id },
    select: {
      slug: true,
      displayName: true,
      headline: true,
      description: true,
      logoUrl: true,
      brandColor: true,
      basePriceCents: true,
      termsText: true,
      isPublished: true,
      mpConnected: true,
    },
  });
  if (!perfil) redirect("/panel");

  return (
    <main className="sobre-claro mx-auto max-w-xl px-6 py-14">
      <Link href="/panel" className="text-sm font-extrabold" style={{ color: "var(--slf-violeta)" }}>
        ← Panel
      </Link>

      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em]">Tu ficha de venta</h1>
      <p className="mt-3 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        Es lo que ve tu cliente cuando le pasás tu enlace. Tu nombre y tu logo, no los
        nuestros.
      </p>

      <FormularioPerfil perfil={perfil} enlace={`${baseUrl()}/v/${perfil.slug}`} />
    </main>
  );
}
