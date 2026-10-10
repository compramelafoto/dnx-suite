"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ESPERA_ENTRE_MIRADAS_MS, textoDeFrescura } from "@/lib/frescura";

/**
 * Lo que mantiene despierto al control en vivo.
 *
 * La página es un componente de servidor: se arma una vez, cuando se abre, y se queda así.
 * `revalidate = 0` evita que la respuesta quede en caché, pero nadie volvía a pedirla. En
 * una fiesta eso significa mirar toda la noche la lista de las 21:05.
 *
 * Y como sacar algo de acá es la única forma de frenar lo que no corresponde, una lista
 * congelada no frena nada. Peor: se ve exactamente igual que una lista al día.
 *
 * Por eso además del refresco va el cartel con la hora. Es lo único que distingue "no subió
 * nadie" de "esto está colgado".
 */
export function Vigilancia() {
  const router = useRouter();
  const [ultima, setUltima] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const mirar = () => {
      // Con la pantalla tapada no tiene sentido pedir: nadie lo está mirando y cada
      // pedido vuelve a firmar las direcciones de todas las fotos de la lista.
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setUltima(Date.now());
    };

    const reloj = setInterval(() => setAhora(Date.now()), 1_000);
    const vigilante = setInterval(mirar, ESPERA_ENTRE_MIRADAS_MS);

    // Al volver a la pantalla se mira de una, sin esperar el turno.
    const alVolver = () => {
      if (document.visibilityState === "visible") mirar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearInterval(reloj);
      clearInterval(vigilante);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router]);

  const desde = ahora - ultima;
  const colgado = desde >= 10 * 60_000;

  return (
    <p
      className="text-[0.7rem] font-bold uppercase tracking-[0.06em]"
      aria-live="polite"
      style={{ color: colgado ? "#B3261E" : "var(--slf-tinta-suave)" }}
    >
      {colgado ? "⚠ " : "● "}
      {textoDeFrescura(desde)}
    </p>
  );
}
