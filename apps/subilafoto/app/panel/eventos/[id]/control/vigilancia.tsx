"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ESPERA_ENTRE_MIRADAS_MS } from "@/lib/frescura";
import { estadoDeVigilancia } from "@/lib/novedades";

/**
 * El vigía del control en vivo: mira si llegó algo, pero no mueve la lista.
 *
 * La página es un componente de servidor: se arma una vez, cuando se abre, y se queda así.
 * `revalidate = 0` evita que la respuesta quede en caché, pero nadie volvía a pedirla. En
 * una fiesta eso significa mirar toda la noche la lista de las 21:05 — y como sacar algo de
 * acá es la única forma de frenar lo que no corresponde, una lista congelada no frena nada.
 *
 * **Pero la lista tampoco se actualiza sola.** Está ordenada por lo último que llegó, así
 * que refrescarla corre las fotos de lugar, y en esta pantalla un toque saca algo de la
 * pared sin preguntar: una foto que aparece justo mientras el dedo baja hace que se saque
 * la de al lado. Entonces se pregunta cada ocho segundos nada más que **el número**, y la
 * lista se actualiza cuando el fotógrafo toca.
 *
 * El precio es que lo que se ve está deliberadamente viejo. Por eso el cartel de "hace
 * cuánto" no es un adorno: pasados diez minutos sin respuesta no sabemos qué hay, y eso
 * tiene que leerse como una falla y no como calma.
 */
/*
  El padre lo monta con `key={desde}`, así que cuando llega contenido nuevo a la lista este
  componente nace de cero: el contador vuelve a cero y la última mirada es ahora. Reiniciar
  el estado desde un efecto haría lo mismo pero con un render de más y con el estado viejo
  pintado en el medio.
*/
export function Vigilancia({ eventoId, desde }: { eventoId: string; desde: string | null }) {
  const router = useRouter();
  const [cuantas, setCuantas] = useState(0);
  const [ultimaMirada, setUltimaMirada] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const corte = new AbortController();

    const mirar = async () => {
      // Con la pantalla tapada no tiene sentido preguntar: nadie la está mirando.
      if (document.visibilityState !== "visible") return;

      const direccion = `/api/panel/eventos/${eventoId}/novedades${
        desde ? `?desde=${encodeURIComponent(desde)}` : ""
      }`;

      try {
        const r = await fetch(direccion, { signal: corte.signal, cache: "no-store" });
        if (!r.ok) return;
        const datos = (await r.json()) as { cuantas?: number };
        if (typeof datos.cuantas !== "number") return;

        setCuantas(datos.cuantas);
        // Sólo cuenta como mirada cuando el servidor contestó de verdad: si no, el cartel
        // diría "al día" con el teléfono sin señal.
        setUltimaMirada(Date.now());
      } catch {
        // Un corte suelto no se muestra: si se repite, el cartel lo va a decir solo.
      }
    };

    void mirar();

    const reloj = setInterval(() => setAhora(Date.now()), 1_000);
    const vigilante = setInterval(() => void mirar(), ESPERA_ENTRE_MIRADAS_MS);
    const alVolver = () => void mirar();
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      corte.abort();
      clearInterval(reloj);
      clearInterval(vigilante);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [eventoId, desde]);

  const mostrar = useCallback(() => {
    router.refresh();
    setCuantas(0);
    setUltimaMirada(Date.now());
  }, [router]);

  const estado = estadoDeVigilancia({ cuantas, msDesdeLaUltimaMirada: ahora - ultimaMirada });

  if (estado.tipo === "AL_DIA") {
    return (
      <p
        className="text-[0.7rem] font-bold uppercase tracking-[0.06em]"
        aria-live="polite"
        style={{ color: "var(--slf-tinta-suave)" }}
      >
        ● {estado.texto}
      </p>
    );
  }

  /*
    Con novedades o colgado, el cartel es un botón. Ancho completo y bien separado de las
    fotos: tiene que ser imposible confundirlo con un "Sacar", que es irreversible de
    hecho aunque se pueda deshacer desde Moderación.
  */
  const colgado = estado.tipo === "COLGADO";

  return (
    <button
      type="button"
      onClick={mostrar}
      aria-live="polite"
      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-extrabold"
      style={{
        background: colgado ? "#FBE9E7" : "var(--slf-violeta-texto)",
        color: colgado ? "#B3261E" : "white",
        border: colgado ? "1px solid #B3261E" : "none",
      }}
    >
      <span aria-hidden="true">{colgado ? "⚠" : "↓"}</span>
      {colgado ? `${estado.texto} · Actualizar` : `${estado.texto} · Mostrar`}
    </button>
  );
}
