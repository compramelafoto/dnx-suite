"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COLA_ELEGIR_KEY, leerCola, siguienteDeLaCola } from "@/lib/schools/cola-de-eleccion";

const VOLVER = "/fotografo/escuelas/pedidos?paso=POR_CANJEAR";

function guardar(cola: number[]) {
  try {
    if (cola.length) sessionStorage.setItem(COLA_ELEGIR_KEY, JSON.stringify(cola));
    else sessionStorage.removeItem(COLA_ELEGIR_KEY);
  } catch {
    /* sin almacenamiento: la cola termina acá */
  }
}

/**
 * «Elegir de corrido»: toma el próximo pack de la cola, pide su link de canje y lo abre. El
 * canje del fotógrafo vuelve acá con `?hecho=<pack>` al confirmar, y así sigue hasta vaciarla.
 */
export default function ElegirDeCorridoPage() {
  const [estado, setEstado] = useState<{ texto: string; error?: boolean }>({ texto: "Abriendo el próximo pedido…" });

  useEffect(() => {
    let activo = true;
    async function seguir() {
      const hecho = Number(new URLSearchParams(window.location.search).get("hecho")) || null;
      let cola = leerCola((() => {
        try {
          return sessionStorage.getItem(COLA_ELEGIR_KEY);
        } catch {
          return null;
        }
      })());
      let saltados = 0;
      for (;;) {
        const { siguiente, resto } = siguienteDeLaCola(cola, hecho);
        cola = resto;
        guardar(cola);
        if (siguiente == null) {
          if (!activo) return;
          setEstado({ texto: saltados ? "Listo. Algunos ya estaban elegidos." : "Listo: no quedan pedidos para elegir." });
          window.location.replace(VOLVER);
          return;
        }
        const r = await fetch("/api/fotografo/escolar/elegir", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packOrderId: siguiente }),
        });
        const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (r.ok && data.url) {
          window.location.assign(data.url);
          return;
        }
        // Ya elegido (por la familia, o en otra pestaña): se saltea y sigue con el próximo.
        if (r.status === 409) {
          saltados += 1;
          continue;
        }
        if (activo) setEstado({ texto: data.error || "No pudimos abrir el pedido.", error: true });
        return;
      }
    }
    void seguir();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-[#e7e1da] bg-white p-6">
        <h1 className="m-0 text-xl font-semibold text-[#1f2328]">Elegir de corrido</h1>
        <p role="status" className={`m-0 mt-2 ${estado.error ? "text-red-700" : "text-[#4b4f56]"}`}>
          {estado.texto}
        </p>
        <p className="m-0 mt-5">
          <Link href={VOLVER} className="font-medium text-[#a8652e] underline">
            Volver a Pedidos escolares
          </Link>
        </p>
      </div>
    </section>
  );
}
