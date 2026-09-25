/**
 * Imprime los correos del jurado tal como se leerían, sin mandar nada.
 *
 * Un correo se revisa leyéndolo, no mirando el código que lo arma. Esto existe
 * para poder aprobar el texto antes de que salga hacia una persona real.
 *
 *   pnpm --filter @repo/db exec tsx \
 *     ../../apps/fotorank/app/lib/fotorank/jury/correosDelJurado.muestra.ts
 */
import {
  avisoDeJuzgamientoAbierto,
  recordatorioDeJuzgamiento,
} from "./correosDelJurado";

const DATOS = {
  concurso: "Clickatón — Día del Fotógrafo Primavera 2026 — 1º Edición",
  obras: 170,
  consignas: 7,
  criterios: 4,
  enlace: "https://www.fotorank.com/jurado/panel",
};

function mostrar(titulo: string, c: { asunto: string; texto: string }) {
  console.log("\n" + "═".repeat(74));
  console.log(titulo);
  console.log("═".repeat(74));
  console.log("Asunto: " + c.asunto);
  console.log("─".repeat(74));
  console.log(c.texto);
}

mostrar("AVISO DE JUZGAMIENTO ABIERTO", avisoDeJuzgamientoAbierto(DATOS));
mostrar(
  "RECORDATORIO, PARA QUIEN NO ENTRÓ",
  recordatorioDeJuzgamiento({ ...DATOS, faltan: 170 }),
);
