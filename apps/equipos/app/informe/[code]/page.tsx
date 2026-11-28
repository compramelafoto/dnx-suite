import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/inventario/equipos";
import { fechaHoraAr } from "@/lib/inventario/formato";
import { formatMoney, maskDni } from "@/lib/informe/formato";
import { getPublicReport } from "@/lib/informe/snapshot";

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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Informe de equipamiento fotográfico</h1>
      <p role="status">
        <strong>
          {r.holderVerified
            ? "Titular con identidad verificada"
            : "El titular ya no está verificado"}
        </strong>
      </p>
      <p>
        Emitido el {fechaHoraAr(r.issuedAt)}.<br />
        Titular: {s.holder.legalName} · DNI {maskDni(s.holder.documentLast3)}
      </p>

      <h2>Equipos declarados</h2>
      <ol>
        {s.items.map((it, i) => (
          <li key={i} style={{ marginBottom: 10 }}>
            <strong>
              {it.make} {it.model}
            </strong>{" "}
            ({KIND_LABELS[it.kind as keyof typeof KIND_LABELS] ?? it.kind}) · Serie:{" "}
            {it.serialRaw ?? "sin número de serie"}
            <br />
            Estado al emitir: {STATUS_LABELS[it.status as keyof typeof STATUS_LABELS] ?? it.status} ·
            Valor: $ {formatMoney(it.valueArs)} / USD {formatMoney(it.valueUsd)}
            <br />
            {it.purchaseDate ? `Compra: ${it.purchaseDate.split("-").reverse().join("/")} · ` : ""}
            {it.hasPurchaseProof ? "Con comprobante de compra" : "Sin comprobante de compra"}
            {it.seal
              ? ` · Sello CompraMeLaFoto: serie vista en ${it.seal.photosCount} ${
                  it.seal.photosCount === 1 ? "foto" : "fotos"
                } desde ${it.seal.since.split("-").reverse().join("/")}`
              : ""}
          </li>
        ))}
      </ol>
      <p>
        <strong>
          Total declarado: $ {formatMoney(s.totalArs)} / USD {formatMoney(s.totalUsd)}
        </strong>
      </p>

      <p style={{ fontSize: 13, color: "#555" }}>
        Huella del contenido (SHA-256): <code style={{ wordBreak: "break-all" }}>{r.contentHash}</code>
        <br />
        {r.hashOk
          ? "La huella coincide con el contenido: el informe no fue alterado."
          : "Atención: la huella no coincide con el contenido guardado."}
      </p>
    </main>
  );
}
