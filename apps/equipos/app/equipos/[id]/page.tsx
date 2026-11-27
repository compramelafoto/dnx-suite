import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { contactedBefore } from "@/lib/contacto/contactar";
import { getPortalUser } from "@/lib/guards";
import { formatDolares, formatPesos, getPublicListing, recordView } from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import {
  BotonEnlace,
  FichaConfianza,
  GuiaCompraSegura,
  Pagina,
  SelloIdentidad,
  SinFoto,
} from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";

export const dynamic = "force-dynamic";

/** La metadata y la página piden la misma publicación: una sola consulta por pedido. */
const cargar = cache(async (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getPublicListing(id);
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await cargar((await params).id);
  if (!l) return { title: `Publicación no encontrada — ${MARCA}` };
  return {
    title: `${l.make} ${l.model} usado — ${MARCA}`,
    description: `${KIND_LABELS[l.kind]} usado a ${formatPesos(l.priceArs)}, en ${l.city}, ${l.province}.`,
  };
}

export default async function FichaEquipoPage({ params }: Props) {
  const l = await cargar((await params).id);
  if (!l) notFound();

  const usuario = await getPortalUser();
  if (usuario) await recordView(l.id, usuario.id);
  const yaContacto = usuario ? await contactedBefore(usuario.id, l.id) : false;

  const titulo = `${l.make} ${l.model}`;
  const [principal, ...resto] = l.photoUrls;

  return (
    <Pagina
      titulo={titulo}
      bajada={KIND_LABELS[l.kind]}
      ancho="ancha"
      volver={{ href: "/equipos", texto: "Equipos en venta" }}
    >
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
            <BotonEnlace href={`/equipos/${l.id}/contactar`} className="boton-ancho">
              {yaContacto ? "Ver datos del vendedor" : "Contactar al vendedor"}
            </BotonEnlace>
            <GuiaCompraSegura />
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
