import type { Aviso } from "./aviso";

/** La tarjeta «aviso»: texto fijo de la app y, si hay, un botón a la pantalla del enlace. */
export function AvisoCard({ aviso }: { aviso: Aviso }) {
  return (
    <div role="note" style={{ border: "1px solid #e8e0f5", background: "#f8f5fd", borderRadius: 12, padding: 10 }}>
      <div>{aviso.texto}</div>
      {aviso.enlace && (
        <a
          href={aviso.enlace.ruta}
          style={{ display: "inline-block", marginTop: 8, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "4px 10px", fontSize: 13, color: "#111", textDecoration: "none" }}
        >
          {aviso.enlace.etiqueta}
        </a>
      )}
    </div>
  );
}
