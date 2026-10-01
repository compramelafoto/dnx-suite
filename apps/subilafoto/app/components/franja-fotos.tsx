import { FOTOS_INICIO, duplicarParaBucle } from "@/lib/fotos-inicio";

/**
 * Franja de fotos que se desplaza sola en la portada.
 *
 * Muestra en dos segundos lo que el texto tarda un párrafo en explicar: alguien
 * apunta el celular a un código y su foto termina en la pantalla del salón.
 *
 * Es un componente de servidor y no lleva JavaScript: el movimiento es una
 * animación de CSS (`slf-desfile`). No se usa `next/image` a propósito — cada
 * foto se pinta dos veces por el bucle y el optimizador serviría dos variantes
 * del mismo archivo sin ganancia; los JPG ya vienen al tamaño en que se ven.
 */
export function FranjaFotos() {
  const pista = duplicarParaBucle(FOTOS_INICIO);

  return (
    <div
      className="slf-franja relative w-full overflow-hidden"
      style={{ background: "var(--slf-purpura)" }}
    >
      {/* Difumina los dos extremos para que las fotos entren y salgan sin corte. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28"
        style={{
          background:
            "linear-gradient(to right, var(--slf-purpura), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28"
        style={{
          background:
            "linear-gradient(to left, var(--slf-purpura), transparent)",
        }}
      />

      {/*
        Sin `gap`: la separación va como padding de cada foto.
        Con `gap`, veinte fotos dejan diecinueve espacios, así que el 50% que
        recorre la animación no cae justo en el borde de la copia y cada vuelta
        pega un saltito de medio espacio. Metiendo el espacio dentro de la caja
        de cada foto, la mitad del ancho es exactamente una copia.
      */}
      <ul className="slf-franja-pista flex w-max items-center">
        {pista.map((foto, i) => (
          <li
            key={`${foto.src}-${i}`}
            className="h-[6.5rem] shrink-0 pr-2 sm:h-[8rem] sm:pr-3 lg:h-[9rem]"
            /* La segunda vuelta es la misma lista: si se anuncia, el lector de
               pantalla lee diez fotos dos veces. */
            aria-hidden={foto.duplicada || undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.src}
              alt={foto.duplicada ? "" : foto.alt}
              width={1200}
              height={800}
              loading={i < 4 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-auto rounded-lg object-cover"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
