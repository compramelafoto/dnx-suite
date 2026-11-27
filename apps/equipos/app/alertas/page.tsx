import type { Metadata } from "next";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { describeAlert, listAlerts, MAX_ALERTS } from "@/lib/catalogo/alertas";
import { requireLevel } from "@/lib/guards";
import { fechaAr } from "@/lib/inventario/formato";
import { Aviso, Boton, BotonEnlace, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { borrarAlerta } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Alertas — ${MARCA}` };

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("registrado", "/alertas");
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const alertas = await listAlerts(user.id);

  return (
    <Pagina
      titulo="Alertas"
      bajada={`Te avisamos por correo, una vez por día, cuando se publica un equipo que coincide con tus búsquedas. Podés tener hasta ${MAX_ALERTS} alertas.`}
      volver={{ href: "/cuenta", texto: "Mi cuenta" }}
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      {alertas.length === 0 ? (
        <div className="pila">
          <p className="texto-secundario">
            Todavía no creaste ninguna alerta. Buscá en el catálogo con los filtros que quieras y
            tocá «Avisarme cuando aparezca».
          </p>
          <div className="acciones">
            <BotonEnlace href="/equipos">Buscar equipos</BotonEnlace>
          </div>
        </div>
      ) : (
        <ul className="registro">
          {alertas.map((a) => (
            <li key={a.id} className="registro-fila">
              <div className="registro-principal">
                <span className="registro-titulo">{describeAlert(a)}</span>
                <span className="registro-detalle">Creada el {fechaAr(a.createdAt)}</span>
              </div>
              <div className="registro-lado">
                <form action={borrarAlerta}>
                  <input type="hidden" name="alertId" value={a.id} />
                  <Boton variante="secundario">Borrar</Boton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
