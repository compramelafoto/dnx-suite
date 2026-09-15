/**
 * Por qué no cargó el módulo nativo del canvas.
 *
 * Existe porque diagnosticar esto en el servidor cuesta un despliegue por intento: el mensaje
 * de la librería ("Cannot find native binding") no dice **qué** falta, y desde afuera no se ve
 * qué archivos llegaron. En vez de adivinar de a un despliegue por vez, el error se explica
 * solo: mira dónde debería estar el binario y cuenta lo que encuentra.
 *
 * Es información de infraestructura —rutas y nombres de archivo—, sin datos de nadie.
 */
import { readdirSync } from "node:fs";

function listar(ruta: string): string {
  try {
    const entradas = readdirSync(ruta);
    if (entradas.length === 0) return `${ruta} → vacío`;
    return `${ruta} → ${entradas.slice(0, 8).join(", ")}`;
  } catch (e) {
    const codigo =
      e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "?";
    return `${ruta} → ${codigo}`;
  }
}

/** Un resumen corto de qué hay alrededor del canvas, para pegar en el mensaje de error. */
export function diagnosticarCanvas(): string {
  const raiz = process.env.LAMBDA_TASK_ROOT || process.cwd();
  const pnpm = `${raiz}/node_modules/.pnpm`;
  return [
    listar(pnpm).slice(0, 300),
    listar(`${raiz}/node_modules/@napi-rs`),
    listar(`${raiz}/node_modules/.pnpm/@napi-rs+canvas@0.1.97/node_modules/@napi-rs`),
  ].join(" · ");
}
