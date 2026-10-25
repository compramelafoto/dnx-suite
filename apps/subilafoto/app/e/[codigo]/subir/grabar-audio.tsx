"use client";

import { useEffect, useRef, useState } from "react";
import { DURACION_MAXIMA_S, validarAudio } from "@/lib/audios";

/**
 * Grabar un saludo con la voz.
 *
 * Para alguien que no se lleva bien con el teclado —o que está en una pista a oscuras—
 * es la diferencia entre dejar un saludo y no dejar nada.
 *
 * **No suena en el salón**: el DJ tiene la música puesta y el parlante de un televisor
 * no se escucha. El saludo se guarda, el fotógrafo lo escucha en Control en vivo y va en
 * la descarga que se llevan los anfitriones. El invitado lo sabe antes de grabar: creer
 * que va a sonar y no escucharlo nunca es peor que no poder grabar.
 *
 * **Se corta solo a los veinte segundos.** No es por el peso: un audio largo deja la
 * proyección congelada en un solo saludo mientras la fiesta sigue. Y en la práctica
 * nadie mira el reloj mientras graba.
 *
 * El permiso del micrófono se pide **al tocar grabar**, no al cargar la pantalla: un
 * cartel del navegador pidiendo el micrófono apenas entrás, sin haber pedido nada, lo
 * rechaza casi todo el mundo.
 */
export function GrabarAudio({ codigo, acento }: { codigo: string; acento: string }) {
  const [estado, setEstado] = useState<"quieto" | "grabando" | "subiendo" | "listo">("quieto");
  const [segundos, setSegundos] = useState(0);
  const [mandados, setMandados] = useState(0);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  // Si se sale de la pantalla a mitad de una grabación, se apaga el micrófono.
  useEffect(() => {
    return () => {
      if (reloj.current) clearInterval(reloj.current);
      grabadora.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function parar() {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    grabadora.current?.stop();
  }

  async function arrancar() {
    setError(null);

    if (typeof MediaRecorder === "undefined") {
      setError("Tu teléfono no permite grabar desde el navegador. Podés dejar un mensaje escrito.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // No se distingue "dijo que no" de "no hay micrófono": al invitado le da igual.
      setError("No pudimos usar el micrófono. Fijate que le hayas dado permiso.");
      return;
    }

    trozos.current = [];
    const rec = new MediaRecorder(stream);
    grabadora.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void subir(new Blob(trozos.current, { type: rec.mimeType }));
    };

    rec.start();
    setEstado("grabando");
    setSegundos(0);

    reloj.current = setInterval(() => {
      setSegundos((s) => {
        // Se corta solo: nadie mira el reloj mientras graba.
        if (s + 1 >= DURACION_MAXIMA_S) parar();
        return s + 1;
      });
    }, 1000);
  }

  async function subir(audio: Blob) {
    setEstado("subiendo");

    const revision = validarAudio({ tipo: audio.type, bytes: audio.size, segundos: null });
    if (!revision.ok) {
      setError(revision.motivo ?? "Esa grabación no sirve.");
      setEstado("quieto");
      return;
    }

    try {
      const permiso = await fetch(`/api/e/${codigo}/audio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: audio.type, bytes: audio.size, segundos }),
      });
      const datos = (await permiso.json()) as { url?: string; mediaId?: string; error?: string };
      if (!permiso.ok || !datos.url) throw new Error(datos.error ?? "No pudimos preparar el envío.");

      const puesta = await fetch(datos.url, {
        method: "PUT",
        headers: { "content-type": audio.type },
        body: audio,
      });
      if (!puesta.ok) throw new Error("La subida se cortó. Probá de nuevo.");

      await fetch(`/api/e/${codigo}/audio/confirmar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaId: datos.mediaId, nombre }),
      });

      setMandados((n) => n + 1);
      setEstado("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos mandar tu saludo.");
      setEstado("quieto");
    }
  }

  const grabando = estado === "grabando";

  return (
    <section className="mt-10 w-full max-w-sm text-left">
      <p className="text-[0.95rem] font-semibold opacity-80">O grabá un saludo</p>
      <p className="mt-1 text-sm opacity-65">
        No suena en la pantalla —hay música— pero se lo llevan los anfitriones.
      </p>

      <button
        type="button"
        onClick={() => (grabando ? parar() : void arrancar())}
        disabled={estado === "subiendo"}
        className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl text-base font-extrabold disabled:opacity-60"
        style={{
          background: grabando ? "#D7263D" : "rgba(255,255,255,0.12)",
          border: `1px solid ${acento}44`,
          color: grabando ? "#fff" : "inherit",
        }}
      >
        {estado === "subiendo" ? (
          "Mandando…"
        ) : grabando ? (
          <>
            <span aria-hidden="true">●</span>
            Parar · {DURACION_MAXIMA_S - segundos}s
          </>
        ) : (
          <>
            <span aria-hidden="true">🎤</span>
            Grabar saludo
          </>
        )}
      </button>

      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value.slice(0, 40))}
        placeholder="Tu nombre (opcional)"
        aria-label="Tu nombre, opcional"
        className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
        style={{
          background: "rgba(255,255,255,0.12)",
          border: `1px solid ${acento}33`,
          color: "inherit",
        }}
      />

      <p className="mt-3 text-sm opacity-75" aria-live="polite">
        {error ??
          (mandados > 0
            ? `Listo. ${mandados === 1 ? "Tu saludo queda" : "Tus saludos quedan"} guardado para los anfitriones.`
            : `Hasta ${DURACION_MAXIMA_S} segundos. Se corta solo.`)}
      </p>
    </section>
  );
}
