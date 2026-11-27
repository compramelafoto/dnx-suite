import type { Metadata } from "next";
import Link from "next/link";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { formatPesos } from "@/lib/catalogo/buscar";
import {
  MAX_ACTIVE_REQUESTS,
  REQUEST_DAYS,
  listMyRequests,
  type MyPurchaseRequest,
} from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import { Aviso, Boton, BotonEnlace, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { cancelarPedido, renovarPedido } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Busco — ${MARCA}` };

const ESTADO: Record<MyPurchaseRequest["status"], { texto: string; clase: string }> = {
  ACTIVE: { texto: "Activo", clase: "estado estado-publicada" },
  FULFILLED: { texto: "Cumplido", clase: "estado estado-vendida" },
  EXPIRED: { texto: "Vencido", clase: "estado estado-revision" },
  CANCELLED: { texto: "Cancelado", clase: "estado" },
};

function detalle(p: MyPurchaseRequest): string {
  const partes = [KIND_LABELS[p.kind]];
  if (p.maxPriceArs != null) partes.push(`hasta ${formatPesos(p.maxPriceArs)}`);
  if (p.minCondition) partes.push(`estado ${CONDITION_LABELS[p.minCondition].toLowerCase()} o mejor`);
  if (p.province) partes.push(p.province);
  return partes.join(" · ");
}

function plazo(p: MyPurchaseRequest): string {
  if (p.status === "ACTIVE") return `Vence el ${fechaAr(p.expiresAt)}`;
  if (p.status === "EXPIRED") return `Venció el ${fechaAr(p.expiresAt)}`;
  if (p.status === "CANCELLED" && p.cancelledAt) return `Lo cancelaste el ${fechaAr(p.cancelledAt)}`;
  return `Lo pediste el ${fechaAr(p.createdAt)}`;
}

export default async function BuscoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("registrado", "/busco");
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const pedidos = await listMyRequests(user.id);
  const verificado = user.level === "identidad";

  return (
    <Pagina
      titulo="Busco"
      bajada="Contanos qué equipo buscás. Si alguien lo tiene en su inventario, le avisamos sin decirte quién es. Esa persona ve tu nombre verificado sólo si responde que le interesa vender."
      volver={{ href: "/cuenta", texto: "Mi cuenta" }}
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      <section className="seccion pila" aria-labelledby="como-busco">
        <h2 id="como-busco">Cómo funciona</h2>
        <p className="texto-secundario">
          Cuando una persona con ese equipo decide venderlo y lo publica, te mandamos el enlace por
          correo. Cada pedido dura {REQUEST_DAYS} días y lo podés renovar. Podés tener hasta{" "}
          {MAX_ACTIVE_REQUESTS} pedidos activos.
        </p>
        {verificado ? (
          <div className="acciones">
            <BotonEnlace href="/busco/nuevo">Nuevo pedido</BotonEnlace>
          </div>
        ) : (
          <Aviso tipo="revision">
            Para crear un pedido necesitás tener tu identidad verificada: así quien tiene el equipo
            sabe que del otro lado hay una persona real.{" "}
            <Link href="/cuenta/verificacion">Verificar mi identidad</Link>
          </Aviso>
        )}
      </section>

      <section className="seccion" aria-labelledby="mis-pedidos">
        <h2 id="mis-pedidos">Mis pedidos</h2>
        {pedidos.length === 0 ? (
          <p className="texto-secundario">Todavía no creaste ningún pedido.</p>
        ) : (
          <ul className="registro">
            {pedidos.map((p) => {
              const e = ESTADO[p.status];
              return (
                <li key={p.id} className="registro-fila">
                  <div className="registro-principal">
                    <span className="registro-titulo">
                      {p.make} {p.model}
                    </span>
                    <span className="registro-detalle">{detalle(p)}</span>
                    <span className="registro-detalle">{plazo(p)}</span>
                  </div>
                  <div className="registro-lado">
                    <span className={e.clase}>{e.texto}</span>
                    {p.status === "FULFILLED" && p.listingId ? (
                      <BotonEnlace href={`/equipos/${p.listingId}`}>Ver el equipo publicado</BotonEnlace>
                    ) : null}
                    {p.status === "ACTIVE" || p.status === "EXPIRED" ? (
                      <form action={renovarPedido}>
                        <input type="hidden" name="requestId" value={p.id} />
                        <Boton variante="secundario">Renovar</Boton>
                      </form>
                    ) : null}
                    {p.status === "ACTIVE" ? (
                      <form action={cancelarPedido}>
                        <input type="hidden" name="requestId" value={p.id} />
                        <Boton variante="secundario">Cancelar</Boton>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Pagina>
  );
}
