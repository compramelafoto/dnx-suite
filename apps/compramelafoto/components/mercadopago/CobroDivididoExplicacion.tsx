"use client";

import { useState } from "react";

type Rol = "fotografo" | "organizador";

type Ejemplo = { titulo: string; texto: string };

function ejemplos(rol: Rol): Ejemplo[] {
  const lista: Ejemplo[] = [
    {
      titulo: "Vendés fotos de un álbum",
      texto:
        "Ponés tus fotos a $10.000 y la familia paga $11.500 con tarjeta. En ese mismo momento Mercado Pago te deposita tus $10.000 y manda los $1.500 de comisión a ComprameLaFoto. No tenés que esperar la liquidación ni pedir un retiro.",
    },
    {
      titulo: "Un evento con organizador",
      texto:
        "Un club, una liga o una escuela de danza organiza el evento y se queda con una comisión. Con el cobro dividido, en cada venta el fotógrafo recibe su parte y el organizador la suya, cada uno en su propia cuenta. Nadie le tiene que transferir nada a nadie.",
    },
    {
      titulo: "Un evento con varios fotógrafos",
      texto:
        "En una maratón o un torneo trabajan varios fotógrafos. Cada venta se reparte sola: a cada fotógrafo le llega lo de sus fotos, sin cuentas a mano al final del evento.",
    },
    {
      titulo: "Te recomendó alguien",
      texto:
        "Si entraste a ComprameLaFoto por un referido, su parte también se separa en el momento y le llega a su cuenta. A vos no te cambia lo que cobrás.",
    },
  ];
  // Al organizador le importa primero el caso del organizador.
  return rol === "organizador" ? [lista[1], lista[2], lista[0], lista[3]] : lista;
}

/**
 * Explica qué es el cobro dividido, en qué situaciones se usa y por qué conviene activarlo.
 * Se muestra dentro del cartel de aceptación, antes de los dos pasos.
 */
export default function CobroDivididoExplicacion({ rol }: { rol: Rol }) {
  const [verEjemplos, setVerEjemplos] = useState(false);
  const tuParte = rol === "organizador" ? "tu comisión" : "lo que cobrás por tus fotos";

  return (
    <section className="mt-5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 text-sm text-[#374151]">
      <h3 className="font-semibold text-[#1a1a1a]">¿Qué es el cobro dividido?</h3>
      <p className="mt-1">
        Es una función de Mercado Pago que reparte cada pago en el momento en que se hace. Cuando
        alguien compra, Mercado Pago separa el dinero y deposita cada parte en la cuenta de quien
        corresponde: {tuParte} va directo a tu cuenta, y la comisión de la plataforma, a la de
        ComprameLaFoto.
      </p>

      <h3 className="mt-4 font-semibold text-[#1a1a1a]">¿Por qué es importante activarlo?</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          <strong>Cobrás al instante.</strong> El dinero te llega en el momento de cada venta, sin
          esperar liquidaciones ni pedir retiros.
        </li>
        <li>
          <strong>Ves todo en tu Mercado Pago.</strong> Cada venta queda registrada en tu cuenta, con
          su comprobante.
        </li>
        <li>
          <strong>No hay que pasarse dinero entre personas.</strong> Cuando en una venta cobran varios
          (fotógrafos, organizador, referidos), a cada uno le llega lo suyo solo.
        </li>
        <li>
          <strong>Si te falta activarlo, la venta no se puede dividir.</strong> En un evento
          compartido, si una de las personas que cobra no lo autorizó, esa venta se cobra como antes
          y la liquidación vuelve a ser la de siempre.
        </li>
        <li>
          <strong>No cambia cuánto cobrás.</strong> Los precios y las comisiones son los mismos que ya
          ves en tu panel: cambia cómo y cuándo te llega el dinero.
        </li>
      </ul>

      <button
        type="button"
        onClick={() => setVerEjemplos((v) => !v)}
        aria-expanded={verEjemplos}
        className="mt-4 text-sm font-medium text-[#2563eb] underline"
      >
        {verEjemplos ? "Ocultar los ejemplos" : "Ver ejemplos: ¿cuándo se usa?"}
      </button>
      {verEjemplos ? (
        <ul className="mt-3 space-y-3">
          {ejemplos(rol).map((e) => (
            <li key={e.titulo} className="rounded-lg bg-white p-3 ring-1 ring-[#e5e7eb]">
              <p className="font-medium text-[#1a1a1a]">{e.titulo}</p>
              <p className="mt-1">{e.texto}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-[#6b7280]">
        El reparto en el momento funciona cuando el comprador paga con tarjeta. Si paga con el dinero
        de su cuenta de Mercado Pago, la venta se cobra como siempre.
      </p>
    </section>
  );
}
