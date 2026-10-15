"use client";

import { useState, useTransition } from "react";
import type { PaginaDeCompra } from "@/lib/ventas/compra";
import { reservarCopia, type ResultadoReserva } from "@/lib/ventas/reservar";
import { BrickTarjeta } from "./brick-tarjeta";
import { alerta, aviso, botonLleno, campo, etiqueta, nota } from "./estilos";

type Disponible = Extract<PaginaDeCompra, { estado: "AVAILABLE" }>;

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

const TEXTO_DIGITAL = "Recibís el archivo original con su certificado de autenticidad firmado. El valor de la copia está en el certificado registrado.";
const TEXTO_IMPRESA = "Impresión Fine Art / premium hecha por la organización. Lleva al dorso una etiqueta con el QR de su certificado.";

/**
 * Elegir el formato, la entrega y los datos; "Continuar al pago" reserva el número por 20 minutos y
 * muestra el total, la cuenta regresiva y el formulario de la tarjeta de Mercado Pago.
 */
export function FormularioDeCompra({ d }: { d: Disponible }) {
  const [elegido, setElegido] = useState<string | null>(d.formatos.length === 1 ? d.formatos[0]!.id : null);
  const formato = d.formatos.find((f) => f.id === elegido) ?? null;
  const [entrega, setEntrega] = useState<string | null>(null);
  const entregaElegida = formato?.entregas.find((e) => e.valor === entrega) ?? (formato?.entregas.length === 1 ? formato.entregas[0]! : null);
  const [errores, setErrores] = useState<string[]>([]);
  const [reserva, setReserva] = useState<Extract<ResultadoReserva, { ok: true }> | null>(null);
  const [nombre, setNombre] = useState("");
  const [pendiente, empezar] = useTransition();

  if (reserva) {
    return (
      <section className="space-y-4 border-t border-[var(--mf-line)] pt-6">
        <h2 className="text-xl">Pagar</h2>
        <p className={nota}>
          Tu pedido quedó guardado. Si cerrás esta página, volvés con <a className="underline underline-offset-[6px]" href={`/compras/${reserva.publicId}?t=${encodeURIComponent(reserva.token)}`}>este enlace</a>.
        </p>
        <BrickTarjeta
          publicKey={d.publicKey}
          publicId={reserva.publicId}
          token={reserva.token}
          totalArs={reserva.totalArs}
          holdExpiresAt={reserva.holdExpiresAt}
          nombreComprador={nombre}
          modoPrueba={d.modoPrueba}
        />
      </section>
    );
  }

  // Con `onSubmit` (no `action`): si algo falla, el formulario conserva lo que escribió la persona.
  const enviar = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setErrores([]);
    if (formato) fd.set("offerId", formato.id);
    if (entregaElegida) fd.set("entrega", entregaElegida.valor);
    fd.set("termsVersion", d.termsVersion);
    setNombre(String(fd.get("nombre") ?? ""));
    empezar(async () => {
      const r = await reservarCopia(fd);
      if (r.ok) setReserva(r);
      else setErrores(r.errores);
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-6 border-t border-[var(--mf-line)] pt-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xl">Elegí el formato</legend>
        {d.formatos.map((f) => (
          <label key={f.id} className={`block cursor-pointer rounded-[2px] border p-4 ${elegido === f.id ? "border-[var(--mf-ink)]" : "border-[var(--mf-line)]"}`}>
            <span className="flex items-start gap-3">
              <input type="radio" name="formato" value={f.id} checked={elegido === f.id} onChange={() => { setElegido(f.id); setEntrega(null); }} className="mt-1.5" />
              <span className="space-y-1">
                <span className="block font-medium">{f.titulo}</span>
                <span className="block text-[15px]">{f.detalle}</span>
                <span className="block text-lg">{pesos(f.priceArs)}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {formato ? (
        <>
          <p className={nota}>{formato.digital ? TEXTO_DIGITAL : TEXTO_IMPRESA}</p>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg">Entrega</legend>
            {formato.entregas.map((e) => (
              <label key={e.valor} className="flex items-start gap-3 text-[15px]">
                <input type="radio" name="entregaVisible" value={e.valor} checked={entregaElegida?.valor === e.valor} onChange={() => setEntrega(e.valor)} className="mt-1" />
                <span>{e.texto}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-lg">Tus datos</legend>
            <label className={etiqueta}><span>Nombre y apellido</span><input name="nombre" required maxLength={120} autoComplete="name" className={campo} /></label>
            <label className={etiqueta}><span>Email</span><input name="email" type="email" required maxLength={200} autoComplete="email" className={campo} /></label>
            {d.modoPrueba ? <p className={nota}>En modo prueba el email tiene que terminar en @testuser.com.</p> : null}
            <label className={etiqueta}><span>Teléfono (optativo)</span><input name="telefono" maxLength={40} autoComplete="tel" className={campo} /></label>
            {entregaElegida?.valor === "SHIPPING" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={etiqueta}><span>Calle</span><input name="calle" required maxLength={120} className={campo} /></label>
                <label className={etiqueta}><span>Número</span><input name="numero" required maxLength={120} className={campo} /></label>
                <label className={etiqueta}><span>Piso y departamento (optativo)</span><input name="pisoDepto" maxLength={120} className={campo} /></label>
                <label className={etiqueta}><span>Ciudad</span><input name="ciudad" required maxLength={120} className={campo} /></label>
                <label className={etiqueta}><span>Provincia</span><input name="provincia" required maxLength={120} className={campo} /></label>
                <label className={etiqueta}><span>Código postal</span><input name="codigoPostal" required maxLength={120} className={campo} /></label>
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" name="nombreEnCertificado" className="mt-1" />
              <span>Quiero que mi nombre figure en el certificado.</span>
            </label>
          </fieldset>

          <details className={aviso}>
            <summary className="cursor-pointer">Términos de la venta</summary>
            <div className="mt-3 space-y-3 whitespace-pre-line text-[15px]">
              <p>{d.terminos}</p>
              {d.terminosExtra ? <p><strong>Condiciones de la organización:</strong> {d.terminosExtra}</p> : null}
            </div>
          </details>
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" name="terminos" required className="mt-1" />
            <span>Leí y acepto los términos de la venta.</span>
          </label>

          {entregaElegida ? (
            <p className="text-[15px]">
              Total: <strong>{pesos(formato.priceArs + entregaElegida.costoArs)}</strong>
              {entregaElegida.costoArs > 0 ? ` (incluye envío ${pesos(entregaElegida.costoArs)})` : ""}
            </p>
          ) : null}
          {errores.length ? <div role="alert" className={alerta}>{errores.map((e) => <p key={e}>{e}</p>)}</div> : null}
          <button type="submit" className={botonLleno} disabled={pendiente || !entregaElegida}>
            {pendiente ? "Reservando tu copia…" : "Continuar al pago"}
          </button>
        </>
      ) : null}
    </form>
  );
}
