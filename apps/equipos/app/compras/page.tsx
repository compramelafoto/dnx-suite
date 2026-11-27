import { AVISOS_ERROR, avisoDeCodigo } from "@/lib/avisos";
import { formatPesos } from "@/lib/catalogo/buscar";
import { requireLevel } from "@/lib/guards";
import { fechaAr } from "@/lib/inventario/formato";
import type { Rol } from "@/lib/ventas/estado";
import { listMyPurchases, listMySales, type SaleSummary } from "@/lib/ventas/ventas";
import { Aviso, Pagina } from "@/app/_ui";
import { EstadoVenta } from "./PartesVenta";

export const dynamic = "force-dynamic";

function Operaciones({ items, rol }: { items: SaleSummary[]; rol: Rol }) {
  const base = rol === "COMPRADOR" ? "/compras" : "/ventas";
  const conQuien = rol === "COMPRADOR" ? "Vendedor:" : "Comprador:";
  return (
    <ul className="registro">
      {items.map((v) => (
        <li key={v.id} className="registro-fila">
          <div className="registro-principal">
            <a className="registro-titulo" href={`${base}/${v.id}`}>
              {v.equipo}
            </a>
            <span className="registro-detalle">
              {conQuien} {v.otraParte}, <span className="cifra">{formatPesos(v.priceArs)}</span>, el{" "}
              {fechaAr(v.createdAt)}
            </span>
          </div>
          <div className="registro-lado">
            <EstadoVenta status={v.status} rol={rol} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireLevel("identidad", "/compras");
  const error = avisoDeCodigo(AVISOS_ERROR, (await searchParams).error);
  const [compras, ventas] = await Promise.all([listMyPurchases(user.id), listMySales(user.id)]);
  const ahora = Date.now();
  const porConfirmar = compras.filter(
    (c) => c.status === "PENDING_BUYER" && c.expiresAt.getTime() >= ahora,
  ).length;

  return (
    <Pagina
      titulo="Mis compras y ventas"
      bajada="Las operaciones que cerraste en el portal, con su estado."
      ancho="ancha"
      volver={{ href: "/cuenta", texto: "Mi cuenta" }}
    >
      <div className="pila">
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        {porConfirmar > 0 ? (
          <Aviso tipo="revision">
            {porConfirmar === 1
              ? "Tenés una compra para confirmar."
              : `Tenés ${porConfirmar} compras para confirmar.`}{" "}
            Abrila para confirmar que la recibiste o avisar que no la compraste.
          </Aviso>
        ) : null}
      </div>

      <section className="seccion" aria-labelledby="compras">
        <h2 id="compras">Compras</h2>
        {compras.length > 0 ? (
          <Operaciones items={compras} rol="COMPRADOR" />
        ) : (
          <p className="texto-secundario">
            Todavía no compraste nada. Cuando un vendedor te marque como comprador, la compra aparece
            acá para que la confirmes.
          </p>
        )}
      </section>

      <section className="seccion" aria-labelledby="ventas">
        <h2 id="ventas">Ventas</h2>
        {ventas.length > 0 ? (
          <Operaciones items={ventas} rol="VENDEDOR" />
        ) : (
          <p className="texto-secundario">
            Todavía no vendiste nada. Cuando vendas un equipo, marcalo como vendido desde «Mis
            publicaciones».
          </p>
        )}
      </section>
    </Pagina>
  );
}
