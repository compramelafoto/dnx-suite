"use client";

import { useState } from "react";
import { CierreBrick, type CierreResultado } from "@/components/cierre-split-1n/CierreBrick";

type Props = {
  publicKey: string;
  amountMinor: number;
  payerEmail: string;
  /**
   * Si el correo del pagador se declaró por variable de entorno. Cuando es false, el
   * pagador sería el admin con sesión — y Mercado Pago pide expresamente un tercero.
   */
  pagadorDeclarado: boolean;
  repartoBps: { owner: number; fotografo: number; organizador: number };
};

function pesos(centavos: number) {
  return `$${(centavos / 100).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CierreClient(props: Props) {
  const [resultado, setResultado] = useState<CierreResultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const reparto = [
    { nombre: "Plataforma (owner)", bps: props.repartoBps.owner },
    { nombre: "Fotógrafo (partner)", bps: props.repartoBps.fotografo },
    { nombre: "Organizador (partner)", bps: props.repartoBps.organizador },
  ];

  if (resultado?.providerOrderId) {
    const aprobada = resultado.uiState === "APPROVED";
    return (
      <section className="space-y-6">
        <div
          className={
            aprobada
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-6"
              : "rounded-xl border border-amber-200 bg-amber-50 p-6"
          }
          role="status"
        >
          <p className="text-sm font-medium text-neutral-900">{resultado.message}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-neutral-600">Order ID</dt>
              <dd className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs text-neutral-900 ring-1 ring-neutral-200">
                  {resultado.providerOrderId}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(resultado.providerOrderId ?? "")
                      .then(() => setCopiado(true));
                  }}
                  className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-white"
                >
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </dd>
            </div>
            <div className="flex gap-6">
              <div>
                <dt className="text-neutral-600">Estado</dt>
                <dd className="font-mono text-xs">{resultado.status}</dd>
              </div>
              <div>
                <dt className="text-neutral-600">live_mode</dt>
                <dd className="font-mono text-xs">
                  {resultado.liveMode === null ? "—" : String(resultado.liveMode)}
                </dd>
              </div>
            </div>
            {resultado.statusDetail ? (
              <div>
                <dt className="text-neutral-600">Detalle</dt>
                <dd className="font-mono text-xs">{resultado.statusDetail}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {resultado.evidenciaPath ? (
          <p className="text-xs text-neutral-500">
            Comprobante guardado en{" "}
            <code className="font-mono">{resultado.evidenciaPath}</code>
          </p>
        ) : null}

        {aprobada ? (
          <p className="text-sm text-neutral-700">
            Este es el Order ID productivo que pide Mercado Pago para cerrar la
            homologación. Apagá la bandera cuando termines.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-red-300 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-900">
          Esto cobra dinero real y lo reparte entre tres cuentas.
        </p>
        <p className="mt-1 text-sm text-red-800">
          No es una prueba. El dinero sale de la tarjeta que ingreses y entra en las
          cuentas de Mercado Pago de los partners. No se puede deshacer con un botón.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">
            Orden de cierre
          </h2>
          <span className="text-lg font-semibold">{pesos(props.amountMinor)}</span>
        </div>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {reparto.map((r) => (
              <tr key={r.nombre} className="border-t border-neutral-100">
                <td className="py-2 text-neutral-700">{r.nombre}</td>
                <td className="py-2 text-right text-neutral-500">{r.bps / 100}%</td>
                <td className="py-2 text-right font-medium">
                  {pesos(Math.floor((props.amountMinor * r.bps) / 10_000))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-neutral-500">
          3 receptores. El monto y el reparto los fija el servidor: el navegador no los
          puede cambiar.
        </p>
      </div>

      {props.pagadorDeclarado ? (
        <p className="text-xs text-neutral-600">
          Paga <strong className="font-medium">{props.payerEmail}</strong>, declarado por
          variable de entorno.
        </p>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            El pagador sería {props.payerEmail || "el admin con sesión"}.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Mercado Pago pide para esta validación un tercero con tarjeta propia, distinto de
            quienes reciben el reparto. Declará{" "}
            <code className="font-mono text-xs">DNX_CLF_SPLIT_1N_CIERRE_PAYER_EMAIL</code>{" "}
            con el correo de quien va a pagar.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold tracking-tight text-neutral-900">
          Pagar con tarjeta
        </h2>
        <CierreBrick
          publicKey={props.publicKey}
          amountMinor={props.amountMinor}
          payerEmail={props.payerEmail}
          onResult={setResultado}
        />
      </div>
    </section>
  );
}
