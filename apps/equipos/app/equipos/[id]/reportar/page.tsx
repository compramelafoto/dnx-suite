import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListing } from "@/lib/catalogo/buscar";
import { requireLevel } from "@/lib/guards";
import { textoDeAvisoReporte } from "@/lib/publicaciones/avisos-reporte";
import { Aviso, Boton, Campo, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { reportarPublicacion } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Reportar publicación — ${MARCA}` };

export default async function ReportarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await requireLevel("registrado", `/equipos/${id}/reportar`);
  const { error, enviado } = await searchParams;

  const listing = await getPublicListing(id);
  if (!listing) notFound();
  const aviso = textoDeAvisoReporte(error);

  return (
    <Pagina
      titulo="Reportar publicación"
      bajada={`${listing.make} ${listing.model}`}
      volver={{ href: `/equipos/${id}`, texto: "Volver a la publicación" }}
    >
      <div className="pila">
        {enviado === "1" ? (
          <Aviso tipo="exito">
            Gracias. Revisamos el reporte y, si hace falta, damos de baja la publicación.
          </Aviso>
        ) : (
          <form action={reportarPublicacion} className="formulario">
            {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}
            <input type="hidden" name="id" value={id} />
            <Campo etiqueta="Motivo" ayuda="Entre 10 y 500 caracteres. Sólo lo vemos nosotros.">
              <textarea
                className="control control-texto"
                name="motivo"
                rows={5}
                minLength={10}
                maxLength={500}
                required
              />
            </Campo>
            <div className="acciones">
              <Boton>Enviar reporte</Boton>
            </div>
          </form>
        )}
      </div>
    </Pagina>
  );
}
