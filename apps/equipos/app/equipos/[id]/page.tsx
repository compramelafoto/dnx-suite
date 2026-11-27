import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { isFavorite } from "@/lib/catalogo/favoritos";
import { contactoMailto } from "@/lib/contacto-publico";
import { contactedBefore, isSellerOf } from "@/lib/contacto/contactar";
import { getPortalUser } from "@/lib/guards";
import { formatDolares, formatPesos, getPublicListing, recordView } from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import {
  Aviso,
  Boton,
  BotonEnlace,
  Estrellas,
  FichaConfianza,
  GuiaCompraSegura,
  Pagina,
  SelloIdentidad,
  SinFoto,
} from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { alternarFavorito } from "./favorito/actions";

export const dynamic = "force-dynamic";

/** La metadata y la página piden la misma publicación: una sola consulta por pedido. */
const cargar = cache(async (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getPublicListing(id);
});

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await cargar((await params).id);
  if (!l) return { title: `Publicación no encontrada — ${MARCA}` };
  return {
    title: `${l.make} ${l.model} usado — ${MARCA}`,
    description: `${KIND_LABELS[l.kind]} usado a ${formatPesos(l.priceArs)}, en ${l.city}, ${l.province}.`,
  };
}

export default async function FichaEquipoPage({ params, searchParams }: Props) {
  const l = await cargar((await params).id);
  if (!l) notFound();

  const usuario = await getPortalUser();
  if (usuario) await recordView(l.id, usuario.id);
  const [esVendedor, yaContacto, guardada] = usuario
    ? await Promise.all([
        isSellerOf(usuario.id, l.id),
        contactedBefore(usuario.id, l.id),
        isFavorite(usuario.id, l.id),
      ])
    : [false, false, false];
  // Por la URL viajan códigos; el texto sale siempre del mapa fijo.
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  const titulo = `${l.make} ${l.model}`;
  const [principal, ...resto] = l.photoUrls;

  return (
    <Pagina
      titulo={titulo}
      bajada={KIND_LABELS[l.kind]}
      ancho="ancha"
      volver={{ href: "/equipos", texto: "Equipos en venta" }}
    >
      {ok || error ? (
        <div className="pila">
          {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      ) : null}
      <div className="ficha-equipo">
        <div className="ficha-equipo-fotos">
          {principal ? (
            // Las URL firmadas vencen: no pasan por el optimizador de imágenes.
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ficha-foto-principal" src={principal} alt={`Foto de ${titulo}`} />
              {resto.length > 0 ? (
                <ul className="ficha-miniaturas">
                  {resto.map((url, i) => (
                    <li key={url}>
                      <a href={url}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="foto"
                          src={url}
                          alt={`Otra foto de ${titulo} (${i + 2})`}
                          loading="lazy"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <SinFoto tipo={KIND_LABELS[l.kind]} titulo={titulo} className="ficha-foto-principal" />
          )}
        </div>

        <section className="ficha-equipo-precio" aria-label="Precio y vendedor">
          <p className="ficha-precio">{formatPesos(l.priceArs)}</p>
          {l.priceUsdRef ? (
            <p className="texto-secundario">Referencia: {formatDolares(l.priceUsdRef)}</p>
          ) : null}
          <p>
            {l.city}, {l.province}
          </p>
          <div className="ficha-vendedor">
            <span>Vende {l.sellerFirstName}</span>
            <SelloIdentidad />
            <Estrellas valor={l.sellerRating} />
          </div>
          {l.usageSealText ? (
            <p className="sello-uso">
              <span className="marca-comprobado" aria-hidden="true">
                ✔
              </span>
              <span>{l.usageSealText}</span>
            </p>
          ) : null}
        </section>

        <div className="ficha-equipo-lateral">
          <div className="ficha-equipo-fija">
            <FichaConfianza
              level={l.trust.level}
              verified={l.trust.verified}
              declared={l.declared}
              shutterText={l.shutterText}
              serialMasked={l.serialMasked}
            />
            {esVendedor ? (
              <BotonEnlace href={`/mis-publicaciones/${l.id}`} className="boton-ancho">
                Administrar mi publicación
              </BotonEnlace>
            ) : (
              <BotonEnlace href={`/equipos/${l.id}/contactar`} className="boton-ancho">
                {yaContacto ? "Ver datos del vendedor" : "Contactar al vendedor"}
              </BotonEnlace>
            )}
            {esVendedor ? null : usuario ? (
              <form action={alternarFavorito} className="ficha-favorito">
                <input type="hidden" name="listingId" value={l.id} />
                <Boton variante="secundario" className="boton-ancho" aria-pressed={guardada}>
                  {guardada ? "Quitar de favoritos" : "Guardar en favoritos"}
                </Boton>
              </form>
            ) : (
              <BotonEnlace
                variante="secundario"
                className="boton-ancho"
                href={`/login?returnTo=${encodeURIComponent(`/equipos/${l.id}`)}`}
              >
                Guardar en favoritos
              </BotonEnlace>
            )}
            <GuiaCompraSegura contacto={contactoMailto("Consulta sobre una compra")} />
            <a className="ficha-reportar" href={`/equipos/${l.id}/reportar`}>
              Reportar publicación
            </a>
          </div>
        </div>

        <section className="ficha-equipo-detalle" aria-labelledby="datos-titulo">
          <h2 id="datos-titulo">Datos del equipo</h2>
          <dl className="documento-datos">
            <dt>Estado</dt>
            <dd>{CONDITION_LABELS[l.condition]}</dd>
            {l.mount ? (
              <>
                <dt>Montura</dt>
                <dd>{l.mount}</dd>
              </>
            ) : null}
            <dt>Incluye</dt>
            <dd>{l.accessories ?? "El vendedor no detalló accesorios."}</dd>
            <dt>Publicado</dt>
            <dd>{fechaAr(l.publishedAt)}</dd>
          </dl>
          {l.description ? (
            <div className="ficha-descripcion">
              <h3>Descripción del vendedor</h3>
              <p>{l.description}</p>
            </div>
          ) : null}
        </section>
      </div>
    </Pagina>
  );
}
