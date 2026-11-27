import { notFound, redirect } from "next/navigation";
import { AVISOS_ERROR, avisoDeCodigo } from "@/lib/avisos";
import { isNoticeForItem } from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import { EquipoError, getItem, KIND_LABELS } from "@/lib/inventario/equipos";
import { fotosOpcionales } from "@/lib/publicaciones/fotos-opcionales";
import { requiresSerial } from "@/lib/publicaciones/reglas";
import { Aviso, Boton, BotonEnlace, Campo, Pagina } from "@/app/_ui";
import { CamposPublicacion } from "../../../mis-publicaciones/CamposPublicacion";
import { publicarEquipo } from "../../../mis-publicaciones/actions";

export const dynamic = "force-dynamic";

export default async function PublicarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; pedido?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await requireLevel("identidad", `/mi-equipo/${id}/publicar`);
  // Por la URL viaja un código; el texto sale siempre del mapa fijo (texto libre: sin aviso).
  const sp = await searchParams;
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  let item;
  try {
    item = await getItem(user.id, id);
  } catch (err) {
    if (err instanceof EquipoError && err.code === "NO_ENCONTRADO") notFound();
    throw err;
  }
  if (item.status !== "IN_USE" && item.status !== "RECOVERED") redirect(`/mi-equipo/${id}`);

  // Viene de un aviso «Busco»: la leyenda sale sólo si el aviso es suyo y de este equipo.
  const conPedido = sp.pedido ? await isNoticeForItem(user.id, Number(sp.pedido), item.id) : false;
  const conSerie = requiresSerial(item.kind);
  const opcionales = fotosOpcionales();

  return (
    <Pagina
      titulo="Publicar a la venta"
      bajada={`${item.make} ${item.model}, ${KIND_LABELS[item.kind].toLowerCase()}`}
      volver={{ href: `/mi-equipo/${id}`, texto: "Volver al equipo" }}
    >
      <div className="pila">
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        {conPedido ? (
          <Aviso tipo="exito">
            Un comprador verificado busca este equipo. Cuando lo publiques, le mandamos el enlace.
          </Aviso>
        ) : null}
        {opcionales ? (
          <Aviso tipo="revision">
            Vista de prueba: las fotos son opcionales porque el almacenamiento no está configurado.
          </Aviso>
        ) : null}
        {conSerie && !item.serialNormalized ? (
          <Aviso tipo="error">
            Para cámaras y lentes el número de serie es obligatorio. Cargalo en la ficha del equipo.
          </Aviso>
        ) : null}
        {item.photoKeys.length === 0 && !opcionales ? (
          <Aviso tipo="error">Subí al menos una foto del equipo desde su ficha antes de publicar.</Aviso>
        ) : null}

        <form action={publicarEquipo} className="superficie formulario">
          <input type="hidden" name="gearItemId" value={item.id} />
          <CamposPublicacion conMontura={conSerie} />

          {conSerie ? (
            <Campo
              etiqueta="Foto del número de serie"
              ayuda="Una foto del número grabado en el equipo. JPG, PNG o WEBP, hasta 4 MB."
            >
              <input
                className="control-archivo"
                type="file"
                name="serialPhoto"
                accept="image/jpeg,image/png,image/webp"
                required={!opcionales}
              />
            </Campo>
          ) : null}
          {conSerie ? (
            <Campo
              etiqueta="Foto de prueba (opcional)"
              ayuda={`Subí una foto tomada con este equipo: si su número de serie coincide, la publicación muestra el sello "Serie comprobada".`}
            >
              <input
                className="control-archivo"
                type="file"
                name="proofPhoto"
                accept="image/jpeg,image/png,image/webp"
              />
            </Campo>
          ) : null}

          <label className="opcion">
            <input type="checkbox" name="socialConsent" required />
            <span className="opcion-texto">
              Acepto que mi equipo pueda salir en las redes del portal.
            </span>
          </label>

          <div className="acciones">
            <Boton>Publicar a la venta</Boton>
            <BotonEnlace variante="secundario" href={`/mi-equipo/${id}`}>
              Cancelar
            </BotonEnlace>
          </div>
        </form>
      </div>
    </Pagina>
  );
}
