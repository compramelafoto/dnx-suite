/**
 * Prueba de carga contra un evento real, desde afuera.
 *
 * Recorre el camino completo del invitado tal como lo hace un teléfono: pide permiso,
 * sube la foto **derecho a R2** con la URL firmada, y confirma. Nada de atajos por la
 * base: si algo del camino está roto, esto se entera.
 *
 *   node scripts/prueba-de-carga.mjs <CODIGO> <token-invitado> [cantidad] [concurrencia]
 *
 * El token del invitado es el de una sesión que ya aceptó los términos. Se prepara con el
 * SQL que está en `docs/subilafoto/19-pruebas-de-carga.md`.
 *
 * Al terminar imprime los percentiles. El promedio no sirve: en una fiesta lo que se
 * siente es la foto que tardó más, no la que tardó el promedio.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

const [codigo, tokensTexto, cantidadTexto, concurrenciaTexto] = process.argv.slice(2);
/*
  Varios tokens separados por coma = varios invitados. Importa: cada sesión tiene su propio
  tope de subidas y su propio contador, y una fiesta son cien fotos de treinta teléfonos,
  no cien de uno.
*/
const TOKENS = (tokensTexto ?? "").split(",").map((t) => t.trim()).filter(Boolean);
const BASE = process.env.SLF_BASE ?? "https://subilafoto.com";
const CANTIDAD = Number(cantidadTexto ?? 1);
const CONCURRENCIA = Number(concurrenciaTexto ?? 10);

if (!codigo || TOKENS.length === 0) {
  console.error("Uso: node scripts/prueba-de-carga.mjs <CODIGO> <token1,token2,…> [cantidad] [concurrencia]");
  process.exit(1);
}

/**
 * Cada foto tiene que ser **distinta**.
 *
 * La base tiene única la combinación de evento y checksum: cien copias del mismo archivo
 * darían noventa y nueve repetidas y una subida, que no prueba nada. El número pintado
 * arriba alcanza para que el checksum cambie.
 */
async function fotoNumero(n) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="4000">` +
      `<rect x="150" y="300" width="2700" height="900" fill="#204030"/>` +
      `<text x="260" y="1000" font-size="420" fill="#ffffff" font-family="sans-serif">PRUEBA ${n}</text></svg>`,
  );
  return sharp({
    create: { width: 3000, height: 4000, channels: 3, background: { r: 170, g: 110 + (n % 60), b: 90 } },
  })
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function subirUna(n) {
  const arranque = Date.now();
  const tokenInvitado = TOKENS[(n - 1) % TOKENS.length];
  const bytes = await fotoNumero(n);
  const checksum = createHash("sha256").update(bytes).digest("hex");

  const permiso = await fetch(`${BASE}/api/e/${codigo}/subir`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `slf_invitado=${tokenInvitado}` },
    body: JSON.stringify({ tipo: "image/jpeg", bytes: bytes.length, checksum }),
  });

  if (!permiso.ok) {
    const cuerpo = await permiso.text();
    return { ok: false, paso: "permiso", estado: permiso.status, detalle: cuerpo.slice(0, 160) };
  }

  const { url, mediaId, duplicada } = await permiso.json();
  if (duplicada) return { ok: true, repetida: true, ms: Date.now() - arranque };

  const puesta = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: bytes,
  });
  if (!puesta.ok) return { ok: false, paso: "r2", estado: puesta.status };

  const confirmada = await fetch(`${BASE}/api/e/${codigo}/subir/confirmar`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `slf_invitado=${tokenInvitado}` },
    body: JSON.stringify({ mediaId, nombre: `Prueba ${n}` }),
  });
  if (!confirmada.ok) {
    const cuerpo = await confirmada.text();
    return { ok: false, paso: "confirmar", estado: confirmada.status, detalle: cuerpo.slice(0, 160) };
  }

  return { ok: true, ms: Date.now() - arranque, kb: Math.round(bytes.length / 1024) };
}

/** De a tandas, como diez teléfonos subiendo a la vez y no cien de golpe. */
async function enTandas(total, ancho, tarea) {
  const salida = [];
  for (let i = 0; i < total; i += ancho) {
    const tanda = [];
    for (let j = i; j < Math.min(i + ancho, total); j++) tanda.push(tarea(j + 1));
    salida.push(...(await Promise.all(tanda)));
    process.stdout.write(`\r  ${salida.length}/${total}`);
  }
  process.stdout.write("\n");
  return salida;
}

const percentil = (valores, p) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((orden.length * p) / 100))];
};

console.log(
  `Subiendo ${CANTIDAD} fotos a ${codigo} desde ${TOKENS.length} ${TOKENS.length === 1 ? "invitado" : "invitados"}, de a ${CONCURRENCIA}…`,
);
const arranque = Date.now();
const resultados = await enTandas(CANTIDAD, CONCURRENCIA, subirUna);
const total = Date.now() - arranque;

const bien = resultados.filter((r) => r.ok && !r.repetida);
const repetidas = resultados.filter((r) => r.repetida);
const mal = resultados.filter((r) => !r.ok);
const tiempos = bien.map((r) => r.ms);

console.log(`\nSubidas   ${bien.length}`);
console.log(`Repetidas ${repetidas.length}`);
console.log(`Fallidas  ${mal.length}`);
if (tiempos.length > 0) {
  console.log(`\nMediana   ${percentil(tiempos, 50)} ms`);
  console.log(`p90       ${percentil(tiempos, 90)} ms`);
  console.log(`Peor      ${Math.max(...tiempos)} ms`);
}
console.log(`Total     ${(total / 1000).toFixed(1)} s`);

for (const f of mal.slice(0, 5)) {
  console.log(`  falló en ${f.paso} (${f.estado}) ${f.detalle ?? ""}`);
}
