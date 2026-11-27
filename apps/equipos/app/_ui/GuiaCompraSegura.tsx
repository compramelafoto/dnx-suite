/**
 * Recuadro con el texto fijo de compra segura. Lo usan la ficha del equipo y el contacto.
 * `contacto` es el `mailto:` de MercadoFotoRaw; sin él, se omite la invitación a escribirnos.
 */
export function GuiaCompraSegura({ contacto }: { contacto: string | null }) {
  return (
    <aside className="guia" aria-labelledby="guia-titulo">
      <h2 id="guia-titulo" className="guia-titulo">
        Compra segura
      </h2>
      <p>
        Antes de pagar: revisá el equipo en persona y probalo; comprobá que los últimos 4
        caracteres del número de serie coincidan con los de la publicación; no pagues por
        adelantado a alguien que no conocés; si algo no te cierra, consultá la serie en el portal
        {contacto ? (
          <>
            {" "}
            o <a href={contacto}>escribinos</a>
          </>
        ) : null}
        . &quot;Identidad verificada&quot; significa que sabemos quién es el vendedor; no garantiza
        la operación.
      </p>
    </aside>
  );
}
