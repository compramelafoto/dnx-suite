import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { formatPesos } from "@/lib/catalogo/buscar";
import { getNoticeForOwner } from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import { Aviso, Boton, BotonEnlace, Estrellas, Pagina, SelloIdentidad } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { responderAviso } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Un comprador busca tu equipo — ${MARCA}` };

/**
 * El aviso de un pedido «Busco», sólo para el dueño que lo recibió (de cualquier otra persona:
 * 404). Recién acá ve el nombre verificado y la calificación del comprador.
 */
export default async function AvisoPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireLevel("registrado", `/busco/avisos/${id}`);
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  const aviso = await getNoticeForOwner(user.id, id);
  if (!aviso) notFound();
  const p = aviso.request;

  return (
    <Pagina
      titulo="Un comprador busca un equipo como el tuyo"
      bajada={`Tu ${aviso.gearItem.make} ${aviso.gearItem.model}`}
      volver={{ href: "/mi-equipo", texto: "Mi equipo" }}
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}

        <section className="superficie pila" aria-labelledby="pedido">
          <h2 id="pedido">El pedido</h2>
          <dl className="documento-datos">
            <dt>Busca</dt>
            <dd>
              {p.make} {p.model} ({KIND_LABELS[p.kind].toLowerCase()})
            </dd>
            <dt>Precio máximo</dt>
            <dd className={p.maxPriceArs != null ? "cifra" : undefined}>
              {p.maxPriceArs != null ? formatPesos(p.maxPriceArs) : "Sin indicar"}
            </dd>
            <dt>Estado mínimo</dt>
            <dd>{p.minCondition ? CONDITION_LABELS[p.minCondition] : "Cualquiera"}</dd>
            <dt>Zona</dt>
            <dd>{p.province ?? "Sin indicar"}</dd>
            <dt>Comprador</dt>
            <dd>
              {aviso.buyerName} {aviso.buyerVerified ? <SelloIdentidad /> : null}
            </dd>
            <dt>Calificación</dt>
            <dd>
              <Estrellas valor={aviso.buyerRating} />
            </dd>
            <dt>Aviso recibido</dt>
            <dd>{fechaAr(aviso.sentAt)}</dd>
          </dl>
          <p className="texto-secundario texto-chico">
            No le dijimos al comprador quién sos ni que tenés este equipo.
          </p>
        </section>

        {aviso.response === "INTERESTED" ? (
          <div className="pila">
            <Aviso tipo="exito">
              Respondiste que te interesa vender
              {aviso.respondedAt ? ` (el ${fechaAr(aviso.respondedAt)})` : ""}.{" "}
              {aviso.publicado
                ? "Ya le mandamos el enlace de tu publicación al comprador."
                : p.abierto
                  ? "Cuando publiques el equipo, le mandamos el enlace al comprador."
                  : "Este pedido ya no está activo, así que no le vamos a mandar el enlace al comprador."}
            </Aviso>
            {!aviso.publicado && p.abierto ? (
              <div className="acciones">
                <BotonEnlace href={`/mi-equipo/${aviso.gearItemId}/publicar?pedido=${aviso.id}`}>
                  Publicar mi equipo
                </BotonEnlace>
              </div>
            ) : null}
          </div>
        ) : aviso.response === "DECLINED" ? (
          <Aviso tipo="revision">
            Respondiste «No, gracias»{aviso.respondedAt ? ` el ${fechaAr(aviso.respondedAt)}` : ""}.
            El comprador no se entera de nada.
          </Aviso>
        ) : !p.abierto ? (
          <Aviso tipo="revision">Este pedido ya no está activo.</Aviso>
        ) : (
          <div className="pila">
            <p className="texto-secundario">
              Si te interesa, te llevamos a publicar este equipo. Si ya está publicado, le mandamos el
              enlace al comprador.
            </p>
            <div className="acciones">
              <form action={responderAviso}>
                <input type="hidden" name="noticeId" value={aviso.id} />
                <input type="hidden" name="response" value="INTERESTED" />
                <Boton>Me interesa vender</Boton>
              </form>
              <form action={responderAviso}>
                <input type="hidden" name="noticeId" value={aviso.id} />
                <input type="hidden" name="response" value="DECLINED" />
                <Boton variante="secundario">No, gracias</Boton>
              </form>
            </div>
          </div>
        )}
      </div>
    </Pagina>
  );
}
