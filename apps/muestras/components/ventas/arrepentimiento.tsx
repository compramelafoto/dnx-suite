"use client";

import { useActionState } from "react";
import { pedirArrepentimiento } from "@/lib/ventas/arrepentimiento";
import { alerta, botonLleno, campo, etiqueta, nota } from "./estilos";

export function FormularioArrepentimiento({ publicId }: { publicId: string }) {
  const [r, accion, pendiente] = useActionState(pedirArrepentimiento, null);
  if (r?.ok) return <p className="text-lg">{r.mensaje}</p>;
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="publicId" value={publicId} />
      <p className="text-[15px]">
        Podés arrepentirte de la compra dentro de los 10 días corridos. Si hay una devolución, el certificado queda anulado y el número no se vuelve a usar.
      </p>
      <label className={etiqueta}>
        <span>Motivo (optativo)</span>
        <textarea name="motivo" maxLength={500} rows={4} className={campo} />
      </label>
      <p className={nota}>La organización y la plataforma lo revisan y te devuelven el dinero según los términos.</p>
      {r && !r.ok ? <p role="alert" className={alerta}>{r.error}</p> : null}
      <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Enviando…" : "Quiero arrepentirme de la compra"}</button>
    </form>
  );
}
