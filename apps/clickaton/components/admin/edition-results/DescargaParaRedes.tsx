"use client";

/**
 * "Descargar para redes": baja un ZIP con una carpeta por consigna, la foto y
 * la ficha de cada obra filtrada y el copy listo para pegar.
 *
 * El ZIP se arma acá, en el navegador: el servidor entrega la lista y cada
 * imagen por separado porque una función de Vercel no puede responder más de
 * 4,5 MB.
 */
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { PaqueteParaRedes } from "@/lib/edition-results/redes-paquete";
import { armarZip, type ArchivoDelZip } from "@/lib/edition-results/redes-zip";

const EN_PARALELO = 3;

function limpiarNombreDeZip(texto: string): string {
  return texto.replace(/[/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

export function DescargaParaRedes({
  editionId,
  query,
  obras,
}: {
  editionId: string;
  /** El filtro de la pantalla, tal cual está en la URL. */
  query: string;
  /** Cuántas obras publicables entran con el filtro actual. */
  obras: number;
}) {
  const [estado, setEstado] = useState<
    | { fase: "quieto" }
    | { fase: "bajando"; hechas: number; total: number }
    | { fase: "listo"; mensaje: string }
    | { fase: "error"; mensaje: string }
  >({ fase: "quieto" });

  async function descargar() {
    const base = `/api/admin/ediciones/${editionId}/redes`;
    try {
      setEstado({ fase: "bajando", hechas: 0, total: obras * 2 });
      const respuesta = await fetch(`${base}${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!respuesta.ok) throw new Error("No se pudo armar la lista de obras.");
      const { paquete } = (await respuesta.json()) as { paquete: PaqueteParaRedes };

      const pendientes = paquete.carpetas.flatMap((c) =>
        c.archivos.map((a) => ({ ...a, ruta: `${c.carpeta}/${a.nombre}` })),
      );
      if (pendientes.length === 0) {
        setEstado({ fase: "error", mensaje: "Con este filtro no hay obras publicables para descargar." });
        return;
      }

      const bajados: (ArchivoDelZip | null)[] = new Array(pendientes.length).fill(null);
      const fallidos: string[] = [];
      let hechas = 0;
      let siguiente = 0;
      const trabajador = async () => {
        while (siguiente < pendientes.length) {
          const i = siguiente++;
          const p = pendientes[i]!;
          const r = await fetch(`${base}/${p.snapshotId}?tipo=${p.tipo}`, { cache: "no-store" });
          if (r.ok) {
            bajados[i] = { nombre: p.ruta, datos: new Uint8Array(await r.arrayBuffer()) };
          } else {
            fallidos.push(p.nombre);
          }
          hechas++;
          setEstado({ fase: "bajando", hechas, total: pendientes.length });
        }
      };
      await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));

      const codificador = new TextEncoder();
      const textos: ArchivoDelZip[] = paquete.carpetas.flatMap((c) => {
        const archivos = [{ nombre: `${c.carpeta}/copy.txt`, datos: codificador.encode(`${c.copy}\n`) }];
        if (c.notas.length > 0) {
          archivos.push({
            nombre: `${c.carpeta}/LEEME - avisos (no publicar).txt`,
            datos: codificador.encode(`${c.notas.map((n) => `• ${n}`).join("\n")}\n`),
          });
        }
        return archivos;
      });

      const zip = armarZip([
        ...bajados.filter((a): a is ArchivoDelZip => a != null),
        ...textos,
      ]);
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      enlace.download = `${limpiarNombreDeZip(paquete.edicion)} - para redes.zip`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 60_000);

      setEstado({
        fase: "listo",
        mensaje:
          fallidos.length > 0
            ? `Listo, pero ${fallidos.length} imagen(es) no se pudieron generar: ${fallidos.join(", ")}.`
            : `Listo: ${paquete.carpetas.length} consigna(s), ${pendientes.length / 2} obra(s).`,
      });
    } catch (e) {
      setEstado({ fase: "error", mensaje: e instanceof Error ? e.message : "No se pudo descargar." });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        onClick={descargar}
        loading={estado.fase === "bajando"}
        disabled={obras === 0}
        size="sm"
      >
        {estado.fase === "bajando"
          ? `Preparando ${estado.hechas} de ${estado.total}…`
          : `Descargar para redes (${obras} ${obras === 1 ? "obra" : "obras"})`}
      </Button>
      {estado.fase === "listo" ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          {estado.mensaje}
        </p>
      ) : null}
      {estado.fase === "error" ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {estado.mensaje}
        </p>
      ) : null}
    </div>
  );
}
