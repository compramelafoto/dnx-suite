import { notFound, redirect } from "next/navigation";
import { requireLevel } from "@/lib/guards";
import { EquipoError, getItem, KIND_LABELS } from "@/lib/inventario/equipos";
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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p>
        <a href={`/mi-equipo/${id}`}>← Volver al equipo</a>
      </p>
      <h1>Denunciar robo o pérdida</h1>
      <p>
        {item.make} {item.model} · {KIND_LABELS[item.kind]}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        {conSerie
          ? "Vamos a revisar la denuncia antes de activarla. Mientras tanto, el equipo figura como robado o perdido en tu inventario."
          : "Este equipo no tiene número de serie, así que sólo cambiamos su estado en tu inventario."}
      </p>

      <form action={denunciarEquipo} style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="id" value={item.id} />
        <label>
          ¿Qué pasó?
          <select name="incident" required defaultValue="">
            <option value="" disabled>
              Elegí una opción
            </option>
            <option value="THEFT">Me lo robaron</option>
            <option value="LOST">Lo perdí</option>
          </select>
        </label>
        <label>
          Fecha del hecho (horario de Argentina) <input name="occurredAt" type="date" required />
        </label>
        <label>
          Lugar <input name="place" maxLength={200} />
        </label>
        <label>
          Descripción <textarea name="description" maxLength={1000} />
        </label>
        {conSerie ? (
          <>
            <label>
              Número de denuncia policial <input name="policeReportNumber" maxLength={80} />
            </label>
            <label>
              Denuncia policial (opcional)
              <input
                type="file"
                name="policeReport"
                accept="image/jpeg,image/png,image/webp,application/pdf"
              />
            </label>
            {tieneComprobante ? (
              <p>Usaremos el comprobante de compra que ya cargaste.</p>
            ) : (
              <label>
                Comprobante de compra (obligatorio si fue un robo)
                <input
                  type="file"
                  name="invoice"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                />
              </label>
            )}
            <p>JPG, PNG, WEBP o PDF, hasta 4 MB cada archivo.</p>
          </>
        ) : null}
        <button type="submit">Enviar denuncia</button>
      </form>
    </main>
  );
}
