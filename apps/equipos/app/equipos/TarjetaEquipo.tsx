import Link from "next/link";
import type { ReactNode } from "react";
import { formatPesos, type PublicListing } from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import { MedidorConfianza, SelloIdentidad, SinFoto } from "@/app/_ui";

/** Tarjeta de una publicación en un listado (catálogo, favoritos). `extra` va bajo el precio. */
export function TarjetaEquipo({ l, extra }: { l: PublicListing; extra?: ReactNode }) {
  const href = `/equipos/${l.id}`;
  return (
    <li className="resultado">
      <Link className="resultado-imagen" href={href} tabIndex={-1} aria-hidden="true">
        {l.photoUrls[0] ? (
          // Las URL firmadas vencen: no pasan por el optimizador de imágenes.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="resultado-foto" src={l.photoUrls[0]} alt="" loading="lazy" />
        ) : (
          <SinFoto
            tipo={KIND_LABELS[l.kind]}
            titulo={`${l.make} ${l.model}`}
            className="resultado-foto"
          />
        )}
      </Link>
      <div className="resultado-cuerpo">
        <h2 className="resultado-titulo">
          <Link href={href}>
            {l.make} {l.model}
          </Link>
        </h2>
        <p className="resultado-detalle">
          {KIND_LABELS[l.kind]} · {CONDITION_LABELS[l.condition]}
          {l.mount ? ` · ${l.mount}` : ""}
        </p>
        <p className="resultado-zona">
          {l.city}, {l.province}
        </p>
      </div>
      <div className="resultado-lado">
        <p className="resultado-precio">{formatPesos(l.priceArs)}</p>
        <MedidorConfianza level={l.trust.level} size="chico" />
        <SelloIdentidad />
        {extra}
      </div>
    </li>
  );
}
