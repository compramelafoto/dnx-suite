import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { vistaDeDescargas } from "@/lib/galerias/descargas";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { visitanteDelEnlace } from "../visitante";
import { DescargarPartes } from "./descargar-partes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Tu descarga", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * La descarga completa de una galería de entrega (sin sesión; el token es la llave y es personal del cliente): las
 * partes del ZIP que armamos, cada una con un botón que firma un enlace de 5 minutos al hacer clic. Sólo se lee la
 * descarga de ESTE cliente. Vencida (7 días) o sin armar: se explica y se vuelve a la galería para pedirla de nuevo.
 */
export default async function DescargasPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDelEnlace();
  if (!visitante.permitido) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const vista = await vistaDeDescargas(workspaceId, token);
  if (!vista) notFound();
  const rutaGaleria = `/w/${encodeURIComponent(workspaceSlug)}/galeria/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 md:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{vista.galeria.nombre}</h1>
        <p className="text-sm opacity-70">Hola, {vista.cliente.nombre}.</p>
      </header>

      {vista.estado === "LISTA" && vista.descargaId ? (
        <section className="space-y-3">
          <p>
            Tu descarga está lista{vista.partes.length > 1 ? ` y viene en ${vista.partes.length} partes` : ""}. Descargá todas las partes y abrilas juntas: cada una es un ZIP con sus archivos en calidad original.
          </p>
          <DescargarPartes slug={workspaceSlug} token={token} descargaId={vista.descargaId} partes={vista.partes} />
          <p className="text-sm opacity-70">Estas descargas están disponibles hasta el {vista.venceEl}. Después tenés que pedirlas de nuevo.</p>
        </section>
      ) : vista.estado === "ARMANDO" ? (
        <p>Estamos armando tu descarga. Cuando termine te mandamos un correo con el enlace. Puede tardar unos minutos.</p>
      ) : vista.estado === "ERROR" ? (
        <p>No pudimos armar tu descarga. Probá pedirla de nuevo desde tu galería o escribile al estudio.</p>
      ) : (
        <p>{vista.estado === "VENCIDA" ? "Esta descarga venció. Pedí la descarga de nuevo desde tu galería." : "Todavía no pediste ninguna descarga completa."}</p>
      )}

      <p>
        <Link href={rutaGaleria} className="text-sm font-medium underline">
          Volver a mi galería
        </Link>
      </p>
    </main>
  );
}
