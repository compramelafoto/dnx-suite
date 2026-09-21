#!/usr/bin/env node
/**
 * Estado de obra — cuánto lleva de verdad cada proyecto de la suite.
 *
 * El nombre no es decorativo: en una obra nada cuenta como terminado hasta que pasa la
 * inspección. Acá igual — un criterio llega al 100% sólo si está **implementado y probado en
 * producción**. Las reglas completas están en `docs/estado-de-obra/LEEME.md`.
 *
 * Lee `docs/estado-de-obra/<plataforma>/*.json` y genera el tablero. El tablero **nunca** se
 * escribe a mano: si se pudiera editar, volvería a pudrirse, que es el problema que vino a
 * resolver.
 *
 * Sin dependencias a propósito: el lockfile es de todo el monorepo y agregar un paquete acá le
 * rompería el build a las otras aplicaciones.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARPETA = join(RAIZ, "docs", "estado-de-obra");

const args = new Set(process.argv.slice(2));
const VERIFICAR = args.has("--verificar");
const HTML = args.has("--html");

/** Implementado sin probar vale la mitad: el código existe, pero nadie sabe si funciona. */
const VALOR_IMPLEMENTADO = 0.5;

/** El orden de las solapas. Las que no figuren acá van al final, alfabéticas. */
const ORDEN = [
  "fotoffice",
  "compramelafoto",
  "clickaton",
  "fotorank",
  "subilafoto",
  "infospot",
  "transversal",
];

const NOMBRES = {
  fotoffice: "FOTOFFICE",
  compramelafoto: "CompraMeLaFoto",
  clickaton: "Clickatón",
  fotorank: "FotoRank",
  subilafoto: "SubiLaFoto",
  infospot: "InfoSpot",
  transversal: "Transversal",
};

export function valorDeCriterio(c) {
  if (c.probado) return 1;
  if (c.implementado) return VALOR_IMPLEMENTADO;
  return 0;
}

export function porcentaje(criterios) {
  if (criterios.length === 0) return 0;
  const suma = criterios.reduce((acc, c) => acc + valorDeCriterio(c), 0);
  return Math.round((suma / criterios.length) * 100);
}

export function queFalta(c) {
  if (c.probado) return null;
  if (c.bloqueado) return `bloqueado: ${c.bloqueado}`;
  if (c.implementado) return "falta probarlo en producción";
  return "falta implementarlo";
}

/** Todos los criterios de un proyecto, aplanados. */
export function criteriosDe(p) {
  return (p.etapas ?? []).flatMap((e) => e.criterios ?? []);
}

/**
 * Un proyecto sin auditar no tiene criterios escritos todavía.
 *
 * Se lista igual, con su nota, en vez de omitirlo: una plataforma que aparece vacía se lee como
 * "no hay nada que hacer acá", y lo que pasa es que nadie lo midió. Pero **no entra en ningún
 * promedio** — un cero inventado ensuciaría el número tanto como un cien inventado.
 */
export function estaSinAuditar(p) {
  return p.sinAuditar === true || criteriosDe(p).length === 0;
}

function leerPlataformas() {
  if (!existsSync(CARPETA)) return [];
  const carpetas = readdirSync(CARPETA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  carpetas.sort((a, b) => {
    const ia = ORDEN.indexOf(a);
    const ib = ORDEN.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return carpetas.map((carpeta) => {
    const dir = join(CARPETA, carpeta);
    const proyectos = readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => {
        try {
          return { archivo: n, ...JSON.parse(readFileSync(join(dir, n), "utf8")) };
        } catch (e) {
          throw new Error(`No se pudo leer ${carpeta}/${n}: ${e.message}`);
        }
      })
      .sort((a, b) => a.proyecto.localeCompare(b.proyecto));
    return { carpeta, nombre: NOMBRES[carpeta] ?? carpeta, proyectos };
  });
}

/** El porcentaje de una plataforma ignora los proyectos sin auditar. */
export function porcentajeDePlataforma(plataforma) {
  const criterios = plataforma.proyectos.filter((p) => !estaSinAuditar(p)).flatMap(criteriosDe);
  return { pct: porcentaje(criterios), criterios: criterios.length };
}

/**
 * Verifica contra GitHub que los PR anotados estén realmente mergeados.
 *
 * Es la mentira más fácil de cometer sin querer: anotar el número de un PR que todavía está
 * abierto, o que se cerró sin mergear.
 */
function verificarPRs(plataformas) {
  const numeros = new Set();
  for (const pl of plataformas) {
    for (const p of pl.proyectos) {
      for (const c of criteriosDe(p)) if (c.implementado?.pr) numeros.add(c.implementado.pr);
    }
  }
  const estados = new Map();
  for (const n of numeros) {
    try {
      const salida = execFileSync("gh", ["pr", "view", String(n), "--json", "state"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      estados.set(n, JSON.parse(salida).state);
    } catch {
      estados.set(n, "SIN RESPUESTA");
    }
  }
  return estados;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function barra(pct) {
  const color = pct === 100 ? "var(--ok)" : pct >= 50 ? "var(--medio)" : "var(--bajo)";
  return `<div class="barra"><span style="width:${pct}%;background:${color}"></span></div>`;
}

/**
 * Si esto lo está usando alguien de verdad, hoy, en producción.
 *
 * Es la pregunta que el porcentaje no contesta. Un proyecto puede estar al 100% y no haberle
 * servido a nadie: en esta suite el modo de falla más caro no es dejar cosas a medias, es
 * terminarlas y no encenderlas nunca. Sorteos quedó en verde sin interruptor, FotoRank tiene
 * cero jurados, la venta escolar de CLF cero diseños. Todo eso figura como trabajo hecho.
 *
 * Valores: "si" | "no" | "parcial". Sin declarar, no se muestra nada — es mejor el silencio que
 * un dato inventado.
 */
const USO = {
  si: { texto: "en uso", clase: "uso-si" },
  parcial: { texto: "uso parcial", clase: "uso-parcial" },
  no: { texto: "nadie lo usa todavía", clase: "uso-no" },
};

function chapaDeUso(p) {
  const u = USO[p.enUso];
  if (!u) return "";
  const detalle = p.usoNota ? ` — ${esc(p.usoNota)}` : "";
  return `<p class="uso ${u.clase}">${u.texto}${detalle}</p>`;
}

function proyectoHtml(p) {
  if (estaSinAuditar(p)) {
    return `<section class="sin-auditar">
      <div class="cab"><h2>${esc(p.proyecto)}</h2><b class="gris">sin auditar</b></div>
      <p class="nota">${esc(p.nota ?? "Todavía nadie escribió sus criterios. No entra en el promedio.")}</p>
    </section>`;
  }

  const todos = criteriosDe(p);
  const etapas = (p.etapas ?? [])
    .map((e) => {
      const cs = e.criterios ?? [];
      const filas = cs
        .map((c) => {
          const falta = queFalta(c);
          const marca = c.probado ? "✓" : c.implementado ? "◐" : "○";
          const clase = c.probado ? "ok" : c.implementado ? "medio" : "bajo";
          const nota = falta
            ? `<span class="falta">${esc(falta)}</span>`
            : `<span class="evidencia">${esc(c.probado.evidencia)}</span>`;
          return `<li><span class="marca ${clase}">${marca}</span><span>${esc(c.que)}<br>${nota}</span></li>`;
        })
        .join("");
      return `<div class="etapa"><div class="cab"><h3>${esc(e.nombre)}</h3><b>${porcentaje(cs)}%</b></div>${barra(porcentaje(cs))}<ul>${filas}</ul></div>`;
    })
    .join("");

  return `<section>
    <div class="cab"><h2>${esc(p.proyecto)}</h2><b>${porcentaje(todos)}%</b></div>
    ${chapaDeUso(p)}
    ${barra(porcentaje(todos))}
    ${etapas}
  </section>`;
}

function generarHtml(plataformas, generadoEl) {
  const conCriterios = plataformas.flatMap((pl) =>
    pl.proyectos.filter((p) => !estaSinAuditar(p)).flatMap(criteriosDe),
  );
  const global = porcentaje(conCriterios);

  const solapas = plataformas
    .map((pl, i) => {
      const { pct, criterios } = porcentajeDePlataforma(pl);
      const etiqueta = criterios === 0 ? "—" : `${pct}%`;
      return `<button class="solapa${i === 0 ? " activa" : ""}" data-p="${esc(pl.carpeta)}">
        ${esc(pl.nombre)}<span class="pct">${etiqueta}</span>
      </button>`;
    })
    .join("");

  const paneles = plataformas
    .map((pl, i) => {
      const { pct, criterios } = porcentajeDePlataforma(pl);
      const cuerpo = pl.proyectos.length
        ? pl.proyectos.map(proyectoHtml).join("")
        : `<section class="sin-auditar"><p class="nota">Todavía no hay ningún proyecto cargado para esta plataforma.</p></section>`;
      const cabecera =
        criterios === 0
          ? `<p class="sub">Sin criterios cargados todavía.</p>`
          : `<div class="resumen-plat"><b>${pct}%</b>${barra(pct)}<span class="sub">${criterios} criterios</span></div>`;
      return `<div class="panel${i === 0 ? " activo" : ""}" id="p-${esc(pl.carpeta)}">${cabecera}${cuerpo}</div>`;
    })
    .join("");

  return `<title>Estado de obra — DNX Suite</title>
<style>
  :root{--fondo:#f7f8fa;--tarjeta:#fff;--texto:#101828;--suave:#667085;--borde:#e4e7ec;
        --ok:#12b76a;--medio:#f79009;--bajo:#d0d5dd;--acento:#155eef;--rojo:#d92d20}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
        --fondo:#0d1117;--tarjeta:#161b22;--texto:#e6edf3;--suave:#8b949e;--borde:#30363d;
        --bajo:#30363d;--acento:#4d8bff;--rojo:#ff6b6b}}
  :root[data-theme="dark"]{--fondo:#0d1117;--tarjeta:#161b22;--texto:#e6edf3;--suave:#8b949e;
        --borde:#30363d;--bajo:#30363d;--acento:#4d8bff;--rojo:#ff6b6b}
  body{background:var(--fondo);color:var(--texto);margin:0;padding:20px 14px 48px;
       font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{max-width:860px;margin:0 auto}
  h1{font-size:1.45rem;margin:0 0 2px;letter-spacing:-.01em}
  .sub{color:var(--suave);font-size:.8rem;margin:0}
  .global{background:var(--tarjeta);border:1px solid var(--borde);border-radius:14px;
          padding:18px;margin:16px 0 18px}
  .num{font-size:2.6rem;font-weight:700;line-height:1;letter-spacing:-.03em}
  .leyenda{color:var(--suave);font-size:.78rem;margin:10px 0 0}
  nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:14px;
      scrollbar-width:none}
  nav::-webkit-scrollbar{display:none}
  .solapa{flex:none;display:flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;
          border-radius:99px;border:1px solid var(--borde);background:var(--tarjeta);
          color:var(--texto);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer}
  .solapa .pct{color:var(--suave);font-weight:500;font-size:.78rem}
  .solapa.activa{background:var(--acento);border-color:var(--acento);color:#fff}
  .solapa.activa .pct{color:rgba(255,255,255,.75)}
  .panel{display:none}.panel.activo{display:block}
  .resumen-plat{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .resumen-plat b{font-size:1.3rem;min-width:3.2rem}
  .resumen-plat .barra{flex:1;margin:0}
  section{background:var(--tarjeta);border:1px solid var(--borde);border-radius:14px;
          padding:16px;margin-bottom:14px}
  section.sin-auditar{border-style:dashed}
  .cab{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
  h2{font-size:1.02rem;margin:0}
  h3{font-size:.88rem;margin:0;font-weight:600}
  .gris{color:var(--suave);font-weight:500;font-size:.8rem}
  .nota{color:var(--suave);font-size:.84rem;margin:6px 0 0}
  .uso{font-size:.78rem;margin:5px 0 0;font-weight:600}
  .uso-si{color:var(--ok)}
  .uso-parcial{color:var(--medio)}
  .uso-no{color:var(--rojo)}
  .barra{background:var(--borde);border-radius:99px;height:7px;overflow:hidden;margin:8px 0}
  .barra span{display:block;height:100%;border-radius:99px}
  .etapa{margin-top:16px;padding-top:13px;border-top:1px solid var(--borde)}
  ul{list-style:none;padding:0;margin:9px 0 0}
  li{display:flex;gap:9px;align-items:flex-start;padding:5px 0;font-size:.86rem}
  .marca{flex:none;width:1.1em;font-weight:700}
  .marca.ok{color:var(--ok)}.marca.medio{color:var(--medio)}.marca.bajo{color:var(--suave)}
  .falta{color:var(--medio);font-size:.79rem}
  .evidencia{color:var(--suave);font-size:.79rem}
  footer{color:var(--suave);font-size:.78rem;margin-top:26px;text-align:center}
</style>
<main>
  <h1>Estado de obra</h1>
  <p class="sub">DNX Suite · generado el ${esc(generadoEl)}</p>

  <div class="global">
    <div class="num">${global}%</div>
    ${barra(global)}
    <p class="leyenda">
      Un criterio llega al 100% sólo si está implementado <b>y</b> probado en producción.<br>
      ✓ probado · ◐ implementado, sin probar · ○ sin implementar
    </p>
  </div>

  <nav>${solapas}</nav>
  ${paneles}

  <footer>Generado desde <code>docs/estado-de-obra/</code> con <code>pnpm estado</code>.<br>No se edita a mano.</footer>
</main>
<script>
  const solapas = document.querySelectorAll(".solapa");
  for (const s of solapas) {
    s.addEventListener("click", () => {
      for (const otra of solapas) otra.classList.remove("activa");
      for (const panel of document.querySelectorAll(".panel")) panel.classList.remove("activo");
      s.classList.add("activa");
      document.getElementById("p-" + s.dataset.p)?.classList.add("activo");
      // La solapa elegida sobrevive a recargar la página. Es un gusto por visor, no un dato
      // compartido: por eso va en el navegador y no en ningún lado más.
      try { localStorage.setItem("estado-de-obra:solapa", s.dataset.p); } catch {}
    });
  }
  try {
    const guardada = localStorage.getItem("estado-de-obra:solapa");
    if (guardada) document.querySelector('.solapa[data-p="' + guardada + '"]')?.click();
  } catch {}
</script>`;
}

function resumenConsola(plataformas, estadosPR) {
  const lineas = [];
  const conCriterios = plataformas.flatMap((pl) =>
    pl.proyectos.filter((p) => !estaSinAuditar(p)).flatMap(criteriosDe),
  );
  lineas.push(`Estado de obra: ${porcentaje(conCriterios)}%  (${conCriterios.length} criterios)`);

  for (const pl of plataformas) {
    const { pct, criterios } = porcentajeDePlataforma(pl);
    lineas.push(`\n${pl.nombre}  —  ${criterios === 0 ? "sin criterios" : pct + "%"}`);
    for (const p of pl.proyectos) {
      if (estaSinAuditar(p)) {
        lineas.push(`   ---  ${p.proyecto}  (sin auditar)`);
        continue;
      }
      lineas.push(`  ${String(porcentaje(criteriosDe(p))).padStart(3)}%  ${p.proyecto}`);
      for (const e of p.etapas ?? []) {
        for (const c of e.criterios ?? []) {
          const falta = queFalta(c);
          if (falta) lineas.push(`         · ${c.que} — ${falta}`);
        }
      }
    }
  }

  if (estadosPR) {
    for (const pl of plataformas) {
      for (const p of pl.proyectos) {
        for (const c of criteriosDe(p)) {
          const pr = c.implementado?.pr;
          if (pr && estadosPR.get(pr) !== "MERGED") {
            lineas.push(`\n⚠ ${p.proyecto}: el PR #${pr} figura implementado pero está ${estadosPR.get(pr)}`);
          }
        }
      }
    }
  }
  return lineas.join("\n");
}

function principal() {
  const plataformas = leerPlataformas();
  const estadosPR = VERIFICAR ? verificarPRs(plataformas) : null;
  console.log(resumenConsola(plataformas, estadosPR));

  if (HTML) {
    const fecha = new Date().toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const destino = join(CARPETA, "tablero.html");
    writeFileSync(destino, generarHtml(plataformas, fecha));
    console.log(`\nTablero escrito en docs/estado-de-obra/tablero.html`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
