const enlace = "underline underline-offset-[6px]";

/** Una fila de enlaces de descarga ("A3 · A2 · 50 × 70 cm"). Son descargas comunes: sin JavaScript. */
export function Descargas({ opciones }: { opciones: { etiqueta: string; href: string }[] }) {
  return (
    <p className="text-[15px]">
      Bajar en{" "}
      {opciones.map((o, i) => (
        <span key={o.href}>{i > 0 ? " · " : ""}<a href={o.href} className={enlace}>{o.etiqueta}</a></span>
      ))}
    </p>
  );
}
