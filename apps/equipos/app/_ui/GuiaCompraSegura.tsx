/** Recuadro con el texto fijo de compra segura. Lo usan la ficha del equipo y el contacto. */
export function GuiaCompraSegura() {
  return (
    <aside className="guia" aria-labelledby="guia-titulo">
      <h2 id="guia-titulo" className="guia-titulo">
        Compra segura
      </h2>
      <p>
        Antes de pagar: revisá el equipo en persona y probalo; comprobá que el número de serie del
        equipo coincida con el de la publicación; no pagues por adelantado a alguien que no
        conocés; si algo no te cierra, consultá la serie en el portal o escribinos. &quot;Identidad
        verificada&quot; significa que sabemos quién es el vendedor; no garantiza la operación.
      </p>
    </aside>
  );
}
