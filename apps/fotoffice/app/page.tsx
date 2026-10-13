import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { FotofficeLanding } from "@/components/landing/fotoffice-landing";
import {
  BASE_DEL_SISTEMA,
  MODULOS_DE_LA_SUITE,
  MODULOS_DISPONIBLES,
} from "@/lib/landing/catalogo";
import { leerSeleccion } from "@/lib/landing/enlace";

const CLAVES = new Set(
  [...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA, ...MODULOS_DE_LA_SUITE].map((m) => m.key),
);

export const metadata: Metadata = {
  title: "FOTOFFICE — el sistema para la parte del oficio que no es sacar fotos",
  description:
    "Consultas y presupuestos, agenda de espacios, cursos, cobros con Mercado Pago, padrón de socios, cuotas, carnets y sitio web. Encendés sólo los módulos que usás.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  if (user) {
    const dest = await resolveFotofficePostLoginDestination({ userId: user.id });
    redirect(dest.path);
  }
  // Quien no entró todavía ve la portada pública: qué es el sistema y todo lo que hace.
  // El enlace puede traer la respuesta ya dada (`?tipo=…&modulos=…`, ver `lib/landing/enlace.ts`).
  return <FotofficeLanding seleccion={leerSeleccion(await searchParams, CLAVES)} />;
}
