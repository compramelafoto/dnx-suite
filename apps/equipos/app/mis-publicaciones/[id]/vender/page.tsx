import { notFound, redirect } from "next/navigation";
import { AVISOS_ERROR, avisoDeCodigo } from "@/lib/avisos";
import { listInterested } from "@/lib/contacto/contactar";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { listSellerListings } from "@/lib/publicaciones/publicar";
import { getUserRatings } from "@/lib/ventas/calificaciones";
import { SALE_DAYS } from "@/lib/ventas/ventas";
import { Aviso, Boton, BotonEnlace, Campo, Estrellas, Pagina } from "@/app/_ui";
import { marcarVendido } from "../../actions";

export const dynamic = "force-dynamic";

export default async function VenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const ruta = `/mis-publicaciones/${id}/vender`;
  const user = await requireLevel("identidad", ruta);
  const error = avisoDeCodigo(AVISOS_ERROR, (await searchParams).error);

  const listing = (await listSellerListings(user.id)).find((l) => l.id === id);
  if (!listing) notFound();
  // Sólo una publicación activa (publicada o pausada) se marca como vendida.
  if (listing.status !== "PUBLISHED" && listing.status !== "PAUSED") {
    redirect(`/mis-publicaciones/${id}`);
  }

  const { contacts } = await listInterested(user.id, id);
  const ratings = await getUserRatings(contacts.map((c) => c.buyerId));

  return (
    <Pagina
      titulo="Marcar como vendido"
      bajada={`${listing.make} ${listing.model} · ${KIND_LABELS[listing.kind]}`}
      volver={{ href: `/mis-publicaciones/${id}`, texto: "Volver a la publicación" }}
    >
      <div className="pila">{error ? <Aviso tipo="error">{error}</Aviso> : null}</div>

      {contacts.length === 0 ? (
        <section className="seccion seccion-primera">
          <Aviso tipo="revision">
            Todavía nadie consultó por esta publicación. Sólo podés marcarla como vendida a alguien
            que te haya escrito desde el portal.
          </Aviso>
          <div className="acciones">
            <BotonEnlace variante="secundario" href={`/mis-publicaciones/${id}`}>
              Volver a la publicación
            </BotonEnlace>
          </div>
        </section>
      ) : (
        <form action={marcarVendido} className="superficie formulario">
          <input type="hidden" name="id" value={listing.id} />
          <fieldset className="grupo">
            <legend className="campo-etiqueta">¿A quién se lo vendiste?</legend>
            <p className="campo-ayuda">
              Son las personas con identidad verificada que te consultaron desde el portal.
            </p>
            <ul className="lista-opciones">
              {contacts.map((c, i) => (
                <li key={c.buyerId}>
                  <label className="opcion opcion-tarjeta">
                    <input type="radio" name="buyerId" value={c.buyerId} required defaultChecked={i === 0 && contacts.length === 1} />
                    <span className="opcion-texto opcion-detalle">
                      <strong>{c.name}</strong>
                      <Estrellas valor={ratings.get(c.buyerId) ?? { average: null, count: 0 }} />
                      <span className="texto-secundario texto-chico">Consultó el {fechaAr(c.at)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <Campo etiqueta="Precio final, en pesos" ayuda="El precio al que cerraron la venta. Sin decimales.">
            <input
              className="control cifra"
              name="priceArs"
              inputMode="numeric"
              defaultValue={listing.priceArs}
              required
            />
          </Campo>

          <Aviso tipo="revision">
            El comprador tiene {SALE_DAYS} días para confirmar. Si no confirma, la publicación se cierra
            y el equipo sigue siendo tuyo.
          </Aviso>

          <div className="acciones">
            <Boton>Marcar como vendido</Boton>
            <BotonEnlace variante="secundario" href={`/mis-publicaciones/${id}`}>
              Cancelar
            </BotonEnlace>
          </div>
        </form>
      )}
    </Pagina>
  );
}
