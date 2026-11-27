import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/inventario/equipos";
import { fechaHoraAr } from "@/lib/inventario/formato";
import { formatMoney, maskDni } from "@/lib/informe/formato";
import { getPublicReport } from "@/lib/informe/snapshot";
import { Aviso, Pagina } from "@/app/_ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Validación de informe de equipamiento",
  robots: { index: false, follow: false },
};

/** Página pública: sólo el snapshot guardado y el estado ACTUAL de la verificación del titular. */
export default async function InformePublicoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const r = await getPublicReport(code);
  if (!r) notFound();
  const s = r.snapshot;

  return (
    <Pagina titulo="Informe de equipamiento fotográfico">
      <article className="superficie documento">
        <Aviso tipo={r.holderVerified ? "exito" : "revision"}>
          <strong>
            {r.holderVerified ? "Titular con identidad verificada" : "El titular ya no está verificado"}
          </strong>
        </Aviso>

        <dl className="documento-datos">
          <dt>Emitido el</dt>
          <dd>{fechaHoraAr(r.issuedAt)}</dd>
          <dt>Titular</dt>
          <dd>{s.holder.legalName}</dd>
          <dt>DNI</dt>
          <dd>
            <span className="cifra">{maskDni(s.holder.documentLast3)}</span>
          </dd>
        </dl>

        <section className="pila" aria-labelledby="equipos-declarados">
          <h2 id="equipos-declarados">Equipos declarados</h2>
          <ol className="documento-equipos">
            {s.items.map((it, i) => (
              <li key={i} className="documento-equipo">
                <span className="registro-titulo">
                  {it.make} {it.model}
                </span>
                <dl className="documento-datos">
                  <dt>Tipo</dt>
                  <dd>{KIND_LABELS[it.kind as keyof typeof KIND_LABELS] ?? it.kind}</dd>
                  <dt>Serie</dt>
                  <dd>
                    {it.serialRaw ? (
                      <span className="cifra">{it.serialRaw}</span>
                    ) : (
                      "sin número de serie"
                    )}
                  </dd>
                  <dt>Estado al emitir</dt>
                  <dd>{STATUS_LABELS[it.status as keyof typeof STATUS_LABELS] ?? it.status}</dd>
                  <dt>Valor</dt>
                  <dd>
                    $ {formatMoney(it.valueArs)} / USD {formatMoney(it.valueUsd)}
                  </dd>
                  {it.purchaseDate ? (
                    <>
                      <dt>Compra</dt>
                      <dd>{it.purchaseDate.split("-").reverse().join("/")}</dd>
                    </>
                  ) : null}
                  <dt>Comprobante</dt>
                  <dd>
                    {it.hasPurchaseProof ? "Con comprobante de compra" : "Sin comprobante de compra"}
                  </dd>
                  {it.seal ? (
                    <>
                      <dt>Sello CompraMeLaFoto</dt>
                      <dd>
                        Serie vista en <span className="cifra">{it.seal.photosCount}</span>{" "}
                        {it.seal.photosCount === 1 ? "foto" : "fotos"} desde{" "}
                        {it.seal.since.split("-").reverse().join("/")}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </li>
            ))}
          </ol>
          <p className="documento-total">
            Total declarado: $ {formatMoney(s.totalArs)} / USD {formatMoney(s.totalUsd)}
          </p>
        </section>

        <p className="huella">
          Huella del contenido (SHA-256): <code className="huella-valor">{r.contentHash}</code>
          <br />
          <span className={r.hashOk ? undefined : "campo-error"}>
            {r.hashOk
              ? "La huella coincide con el contenido: el informe no fue alterado."
              : "Atención: la huella no coincide con el contenido guardado."}
          </span>
        </p>
      </article>
    </Pagina>
  );
}
