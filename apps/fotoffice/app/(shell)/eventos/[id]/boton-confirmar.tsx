"use client";

/**
 * Botón de envío que pregunta antes, si hace falta. Lo usa el interruptor de acreditación: apagarlo
 * con el evento en curso deja al escáner rechazando a todo el mundo, y eso no puede ser un clic al
 * descuido (Clickatón, `presentarInterruptorDeAcreditacion`).
 */
export function BotonConfirmar({ texto, confirmacion, className }: { texto: string; confirmacion: string | null; className?: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (confirmacion && !window.confirm(confirmacion)) e.preventDefault();
      }}
    >
      {texto}
    </button>
  );
}
