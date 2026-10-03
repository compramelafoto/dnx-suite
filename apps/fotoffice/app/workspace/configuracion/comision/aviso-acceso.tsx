/**
 * Aviso transitorio (etapa 2): Caja, Clientes y Coberturas todavía no miran la grilla de roles y
 * dejan entrar a cualquier integrante del equipo. Se saca cuando la etapa 2b los migre.
 */
export const AVISO_ACCESO_TRANSITORIO =
  "Por ahora, cualquier integrante con un rol puede usar Caja, Clientes y Coberturas aunque la grilla diga 'Sin acceso'. Esto se corrige en la próxima actualización; hasta entonces, sumá sólo personas de confianza.";

export function AvisoAccesoTransitorio() {
  return (
    <p role="note" className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
      {AVISO_ACCESO_TRANSITORIO}
    </p>
  );
}
