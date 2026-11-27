import { notFound, redirect } from "next/navigation";
import { requireLevel } from "@/lib/guards";
import { EquipoError, getItem, KIND_LABELS } from "@/lib/inventario/equipos";
import { Aviso, Boton, Campo, Pagina } from "@/app/_ui";
import { denunciarEquipo } from "../../actions";

export const dynamic = "force-dynamic";

export default async function DenunciarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await requireLevel("identidad", `/mi-equipo/${id}/denunciar`);
  const { error } = await searchParams;

  let item;
  try {
    item = await getItem(user.id, id);
  } catch (err) {
    if (err instanceof EquipoError && err.code === "NO_ENCONTRADO") notFound();
    throw err;
  }
  if (!["IN_USE", "FOR_SALE", "RECOVERED"].includes(item.status)) redirect(`/mi-equipo/${id}`);

  const conSerie = (item.kind === "BODY" || item.kind === "LENS") && !!item.serialNormalized;
  const tieneComprobante = !!item.purchaseProofKey;

  return (
    <Pagina
      titulo="Denunciar robo o pérdida"
      bajada={`${item.make} ${item.model}, ${KIND_LABELS[item.kind].toLowerCase()}`}
      volver={{ href: `/mi-equipo/${id}`, texto: "Volver al equipo" }}
    >
      <div className="pila">
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <p>
          {conSerie
            ? "Vamos a revisar la denuncia antes de activarla. Mientras tanto, el equipo figura como robado o perdido en tu inventario."
            : "Este equipo no tiene número de serie, así que sólo cambiamos su estado en tu inventario."}
        </p>

        <form action={denunciarEquipo} className="superficie formulario">
          <input type="hidden" name="id" value={item.id} />
          <Campo etiqueta="¿Qué pasó?">
            <select className="control" name="incident" required defaultValue="">
              <option value="" disabled>
                Elegí una opción
              </option>
              <option value="THEFT">Me lo robaron</option>
              <option value="LOST">Lo perdí</option>
            </select>
          </Campo>
          <Campo etiqueta="Fecha del hecho" ayuda="Horario de Argentina.">
            <input className="control" name="occurredAt" type="date" required />
          </Campo>
          <Campo etiqueta="Lugar">
            <input className="control" name="place" maxLength={200} />
          </Campo>
          <Campo etiqueta="Descripción">
            <textarea className="control control-texto" name="description" maxLength={1000} />
          </Campo>
          {conSerie ? (
            <>
              <Campo etiqueta="Número de denuncia policial">
                <input className="control" name="policeReportNumber" maxLength={80} />
              </Campo>
              <Campo
                etiqueta="Denuncia policial (opcional)"
                ayuda="JPG, PNG, WEBP o PDF, hasta 4 MB."
              >
                <input
                  className="control-archivo"
                  type="file"
                  name="policeReport"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                />
              </Campo>
              {tieneComprobante ? (
                <p className="texto-secundario">Usaremos el comprobante de compra que ya cargaste.</p>
              ) : (
                <Campo
                  etiqueta="Comprobante de compra (obligatorio si fue un robo)"
                  ayuda="JPG, PNG, WEBP o PDF, hasta 4 MB."
                >
                  <input
                    className="control-archivo"
                    type="file"
                    name="invoice"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                </Campo>
              )}
            </>
          ) : null}
          <div className="acciones">
            <Boton>Enviar denuncia</Boton>
          </div>
        </form>
      </div>
    </Pagina>
  );
}
