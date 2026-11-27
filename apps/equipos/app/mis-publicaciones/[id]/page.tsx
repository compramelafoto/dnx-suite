import { notFound } from "next/navigation";
import { listInterested } from "@/lib/contacto/contactar";
import { requireLevel } from "@/lib/guards";
import { fechaHoraAr } from "@/lib/inventario/formato";
import { getItem, KIND_LABELS } from "@/lib/inventario/equipos";
import { computeTrust, declaredItems } from "@/lib/publicaciones/confianza";
import { findActiveReportForSerial } from "@/lib/publicaciones/denuncia-activa";
import { listSellerListings } from "@/lib/publicaciones/publicar";
import { maskSerial, requiresSerial } from "@/lib/publicaciones/reglas";
import { Aviso, Boton, EstadoPublicacion, FichaConfianza, Pagina } from "@/app/_ui";
import { CamposPublicacion } from "../CamposPublicacion";
import {
  cerrarPublicacion,
  guardarPublicacion,
  pausarPublicacion,
  reanudarPublicacion,
} from "../actions";
import { TEXTO_EN_REVISION } from "../textos";

export const dynamic = "force-dynamic";

export default async function PublicacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await requireLevel("identidad", `/mis-publicaciones/${id}`);
  const { ok, error } = await searchParams;

  const listing = (await listSellerListings(user.id)).find((l) => l.id === id);
  if (!listing) notFound();

  // El equipo puede haber dejado de existir para este usuario: la ficha sigue sin factura ni serie.
  const item = await getItem(user.id, listing.gearItemId).catch(() => null);
  // «Sin denuncias…» sólo si se revisó de verdad: una retenida (o un equipo que ya no se puede
  // leer) no muestra esa línea.
  const serial = item?.serialNormalized ?? null;
  const noActiveReport = item
    ? serial
      ? !(await findActiveReportForSerial(serial, user.id))
      : true
    : false;
  const trust = computeTrust({
    usageSeal: listing.usageSeal,
    hasPurchaseProof: !!item?.purchaseProofKey,
    shutterVerified: false,
    noActiveReport,
  });

  const interesados = await listInterested(user.id, id);

  const abierta = listing.status !== "CLOSED" && listing.status !== "SOLD";
  const editable = listing.status === "PUBLISHED" || listing.status === "PAUSED";

  return (
    <Pagina
      titulo={`${listing.make} ${listing.model}`}
      bajada={KIND_LABELS[listing.kind]}
      volver={{ href: "/mis-publicaciones", texto: "Mis publicaciones" }}
    >
      <div className="pila">
        <div className="acciones">
          <EstadoPublicacion status={listing.status} />
        </div>
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        {listing.status === "IN_REVIEW" ? <Aviso tipo="revision">{TEXTO_EN_REVISION}</Aviso> : null}
      </div>

      <section className="seccion" aria-labelledby="confianza">
        <h2 id="confianza">Confianza de la publicación</h2>
        <FichaConfianza
          level={trust.level}
          verified={trust.verified}
          declared={declaredItems(listing)}
          shutterText={null}
          serialMasked={maskSerial(item?.serialNormalized ?? null)}
        />
      </section>

      <section className="seccion" aria-labelledby="interesados">
        <h2 id="interesados">Interesados</h2>
        <dl className="documento-datos">
          <dt>Visitas</dt>
          <dd className="cifra">{interesados.views}</dd>
          <dt>Personas distintas</dt>
          <dd className="cifra">{interesados.viewers}</dd>
          <dt>Consultas</dt>
          <dd className="cifra">{interesados.contacts.length}</dd>
        </dl>
        {interesados.contacts.length > 0 ? (
          <ul className="lista-texto">
            {interesados.contacts.map((c) => (
              <li key={`${c.name}-${c.at.getTime()}`}>
                {c.name} — {fechaHoraAr(c.at)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="texto-secundario">Todavía nadie pidió tu contacto.</p>
        )}
      </section>

      {editable ? (
        <section className="seccion" aria-labelledby="datos">
          <h2 id="datos">Datos de la publicación</h2>
          <form action={guardarPublicacion} className="superficie formulario">
            <input type="hidden" name="id" value={listing.id} />
            <CamposPublicacion valores={listing} conMontura={requiresSerial(listing.kind)} />
            <div className="acciones">
              <Boton>Guardar cambios</Boton>
            </div>
          </form>
        </section>
      ) : null}

      {abierta ? (
        <section className="seccion" aria-labelledby="acciones">
          <h2 id="acciones">Administrar</h2>
          <div className="acciones">
            {listing.status === "PUBLISHED" ? (
              <form action={pausarPublicacion}>
                <input type="hidden" name="id" value={listing.id} />
                <Boton variante="secundario">Pausar publicación</Boton>
              </form>
            ) : null}
            {listing.status === "PAUSED" ? (
              <form action={reanudarPublicacion}>
                <input type="hidden" name="id" value={listing.id} />
                <Boton>Reanudar publicación</Boton>
              </form>
            ) : null}
          </div>
          <details className="desplegable">
            <summary className="desplegable-titulo">Cerrar publicación</summary>
            <form action={cerrarPublicacion} className="pila">
              <input type="hidden" name="id" value={listing.id} />
              <p>
                Si la cerrás, la publicación deja de verse y no se puede reabrir. Para volver a
                venderlo, tenés que publicarlo de nuevo.
              </p>
              <div className="acciones">
                <Boton variante="peligro">Sí, cerrar publicación</Boton>
              </div>
            </form>
          </details>
        </section>
      ) : null}
    </Pagina>
  );
}
