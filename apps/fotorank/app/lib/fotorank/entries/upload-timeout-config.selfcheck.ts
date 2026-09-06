/**
 * Selfcheck — mitad de SERVIDOR del fix del hang de upload (d4f0d4fe).
 *   pnpm --filter fotorank run test:entries:upload-timeout
 *
 * Contexto: el wizard quedaba pegado en "Estamos verificando…". El fix tiene
 * dos mitades. La de cliente vive en `ParticipantUploadWizard.tsx`
 * (AbortController + timeout de 55 s). La de servidor es esta: sin
 * `maxDuration`, las rutas caen al límite por defecto de la plataforma y la
 * función se corta antes de responder — el cliente nunca recibe nada y se
 * queda esperando.
 *
 * Este archivo fija los valores como contrato, porque son fáciles de perder en
 * un refactor de imports y su ausencia no rompe ni el build ni los tipos: sólo
 * reaparece el hang, en runtime y con el participante enfrente.
 *
 * Los valores NO son uniformes, y esa asimetría es intencional:
 *   - `upload` y `replace` ejecutan `processUploadedFile` (deriva miniaturas y
 *     versiones) sobre una fotografía de concurso → 60 s;
 *   - `confirm` sólo confirma en base y encola la notificación → 30 s.
 * Bajar `replace`/`upload` a 30 s reintroduciría el timeout justo en la
 * operación más pesada del flujo.
 *
 * Se lee el archivo fuente en vez de importar el módulo: importar una route de
 * App Router arrastraría `next/server`, Prisma y el cliente de R2, que no
 * corresponde inicializar en un selfcheck de lógica pura.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = join(
  process.cwd(),
  "../../apps/fotorank/app/api/fotorank/contests/[contestId]/entries/[entryId]",
);

/** Valor esperado por ruta, con el motivo por el que es ese y no otro. */
const EXPECTED: Array<{ route: string; seconds: number; why: string }> = [
  { route: "upload", seconds: 60, why: "procesa la imagen subida (processUploadedFile)" },
  { route: "replace", seconds: 60, why: "reprocesa la imagen al reemplazarla" },
  {
    route: "upload-direct",
    seconds: 60,
    why: "descarga el original del staging y lo procesa igual que upload",
  },
  { route: "confirm", seconds: 30, why: "sólo confirma en base; la notificación es asíncrona" },
];

/** Funciones que consumen la imagen: la autenticación va siempre antes. */
const PROCESADORES = ["processUploadedFile", "processStagedUpload"];

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

for (const { route, seconds, why } of EXPECTED) {
  const source = readFileSync(join(ROUTES_DIR, route, "route.ts"), "utf8");

  const matches = [...source.matchAll(/^export const maxDuration\s*=\s*(\d+)\s*;?\s*$/gm)];

  ok(matches.length === 1, `${route}: declara maxDuration exactamente una vez`);
  const declared = Number(matches[0]?.[1]);
  ok(declared === seconds, `${route}: maxDuration = ${seconds} (${why})`);

  // Debe ser una exportación estática de módulo: Next la lee en build, así que
  // un valor calculado o reasignado no tendría efecto.
  ok(
    !/maxDuration\s*=\s*(?!\d)/.test(source.replace(/^export const maxDuration\s*=\s*\d+\s*;?\s*$/gm, "")),
    `${route}: maxDuration no se reasigna ni se calcula en runtime`,
  );

  // `maxDuration` no aplica al runtime Edge; estas rutas deben quedar en Node.
  ok(
    !/export const runtime\s*=\s*["']edge["']/.test(source),
    `${route}: sigue en runtime Node, donde maxDuration tiene efecto`,
  );

  // El handler debe seguir existiendo: la línea agregada no reemplaza nada.
  ok(/export async function POST\s*\(/.test(source), `${route}: el handler POST sigue intacto`);

  // Y la autenticación debe seguir siendo lo primero que ocurre dentro del POST.
  // Se busca la *llamada* dentro del cuerpo, no el identificador suelto: el
  // import de `getAuthUser` está en la cabecera y aparecería antes del handler.
  const body = source.slice(source.indexOf("export async function POST"));
  ok(/await getAuthUser\(\)/.test(body), `${route}: el gate de autenticación sigue dentro del handler`);
  for (const procesador of PROCESADORES) {
    ok(
      !body.includes(procesador) || body.indexOf("await getAuthUser()") < body.indexOf(procesador),
      `${route}: la autenticación ocurre antes de ${procesador}`,
    );
  }
}

console.log("FINAL: PASS");
