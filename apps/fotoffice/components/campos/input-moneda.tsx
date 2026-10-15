"use client";

import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import {
  leerEscrito,
  leerValor,
  posicionCursor,
  significativosAntesDe,
  textoEnvio,
  textoVisible,
  type SeparadorEnvio,
} from "@/lib/moneda/entrada";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode" | "name"
> & {
  /** Si se pasa, el número sin adornos viaja en un campo oculto con este nombre (para `FormData`). */
  name?: string;
  /** Controlado: el número en cualquier formato ("200000", "200000.50", "200.000,50", 200000). */
  value?: string | number | null;
  /** No controlado: valor inicial. */
  defaultValue?: string | number | null;
  /** Recibe el número sin adornos, con el separador decimal de `envio`. Vacío si el campo quedó vacío. */
  onChange?: (valor: string) => void;
  /** Si acepta centavos. Por omisión, sí. */
  decimales?: boolean;
  /**
   * Cómo se escribe el decimal en lo que se envía: "coma" para los parsers argentinos
   * (`parseArsToMinor`, `leerImporte`) y "punto" para los que hacen `Number(...)`.
   */
  envio?: SeparadorEnvio;
  /** Clases del contenedor (ancho, márgenes). `className` va al `<input>`. */
  wrapperClassName?: string;
};

function mismoNumero(a: string, b: string): boolean {
  // Vaciar un campo que guarda número deja un 0: no hay que volver a escribirlo en pantalla.
  if (a === "" || b === "") return Number((a || b).replace(",", ".")) === 0;
  return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
}

/**
 * Campo de importe en pesos: muestra el signo $ y el punto de miles mientras se escribe
 * ("$ 200.000,50") y entrega el número limpio ("200000,50") a quien lo use.
 */
export function InputMoneda({
  name,
  value,
  defaultValue,
  onChange,
  decimales = true,
  envio = "coma",
  wrapperClassName,
  className = "fo-input",
  placeholder,
  ...resto
}: Props) {
  const controlado = value !== undefined;
  const [visible, setVisible] = useState(() => textoVisible(leerValor(controlado ? value : defaultValue, decimales)));
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  // Si el valor controlado cambia desde afuera (p. ej. se vacía el formulario), se refleja.
  const envioActual = textoEnvio(leerEscrito(visible, decimales), envio);
  const envioExterno = controlado ? textoEnvio(leerValor(value, decimales), envio) : envioActual;
  // Se compara el número, no el texto: "1500,0" a medio escribir y un 1500 guardado son lo mismo.
  if (controlado && !mismoNumero(envioExterno, envioActual)) {
    setVisible(textoVisible(leerValor(value, decimales)));
  }

  useLayoutEffect(() => {
    if (cursor.current === null || !ref.current || document.activeElement !== ref.current) return;
    ref.current.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  });

  const placeholderVisible = placeholder ? placeholder.replace(/^\$\s*/, "") : undefined;

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--fo-muted)]"
      >
        $
      </span>
      <input
        {...resto}
        ref={ref}
        type="text"
        inputMode={decimales ? "decimal" : "numeric"}
        autoComplete="off"
        className={`${className} !pl-7 tabular-nums`}
        placeholder={placeholderVisible}
        value={visible}
        onChange={(e) => {
          let escrito = e.target.value;
          let pos = e.target.selectionStart ?? escrito.length;
          // Borrar sobre un punto de miles no cambia el número: se borra el dígito de antes.
          const borroPunto =
            escrito.length === visible.length - 1 && visible[pos] === "." && escrito === visible.slice(0, pos) + visible.slice(pos + 1);
          if (borroPunto && pos > 0) {
            escrito = escrito.slice(0, pos - 1) + escrito.slice(pos);
            pos -= 1;
          }
          const agregoPunto = escrito.length > visible.length && escrito.endsWith(".") && pos === escrito.length;
          const partes = leerEscrito(escrito, decimales, agregoPunto);
          const nuevo = textoVisible(partes);
          const normalizado = agregoPunto ? `${escrito.slice(0, -1)},` : escrito;
          cursor.current = posicionCursor(nuevo, significativosAntesDe(normalizado, pos));
          setVisible(nuevo);
          onChange?.(textoEnvio(partes, envio));
        }}
      />
      {name ? <input type="hidden" name={name} value={envioActual} /> : null}
    </div>
  );
}
