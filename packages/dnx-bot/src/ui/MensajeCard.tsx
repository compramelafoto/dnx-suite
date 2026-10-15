import { useState } from "react";
import { guardarMensajePrecargado, type TarjetaMensaje } from "./mensaje";

/** La tarjeta «mensaje»: el texto propuesto, «Abrir para enviar» y «Copiar». Nunca envía. */
export function MensajeCard({ tarjeta }: { tarjeta: TarjetaMensaje }) {
  const [copiado, setCopiado] = useState(false);
  const abrir = () => {
    let almacen: Storage | null = null;
    try {
      almacen = window.sessionStorage;
    } catch {
      almacen = null;
    }
    guardarMensajePrecargado(almacen, tarjeta.destino, { canal: tarjeta.canal, asunto: tarjeta.asunto, cuerpo: tarjeta.cuerpo });
    window.location.assign(tarjeta.destino.ruta);
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(tarjeta.asunto ? `${tarjeta.asunto}\n\n${tarjeta.cuerpo}` : tarjeta.cuerpo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };
  const boton = { border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13 } as const;
  return (
    <div role="group" aria-label="Mensaje propuesto" style={{ border: "1px solid #d8f0dd", background: "#f4fbf5", borderRadius: 12, padding: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Mensaje para {tarjeta.canal === "EMAIL" ? "correo" : "WhatsApp"}</div>
      {tarjeta.asunto && <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Asunto: {tarjeta.asunto}</div>}
      <div style={{ whiteSpace: "pre-wrap" }}>{tarjeta.cuerpo}</div>
      {tarjeta.avisos.map((a) => <div key={a} style={{ marginTop: 6, fontSize: 12, color: "#8a5a00" }}>{a}</div>)}
      <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>Lo que va entre corchetes, como [nombre], se completa al enviar desde FOTOFFICE.</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={abrir} style={{ ...boton, background: "#111", color: "#fff", borderColor: "#111" }}>Abrir para enviar</button>
        <button type="button" onClick={copiar} style={boton}>{copiado ? "Copiado" : "Copiar"}</button>
      </div>
    </div>
  );
}
