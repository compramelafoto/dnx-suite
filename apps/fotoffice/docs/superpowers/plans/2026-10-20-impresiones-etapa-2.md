# Impresiones — Etapa 2: copias instantáneas en la Kodak (10x15, 13x18 y 15x20)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que desde el Mostrador se carguen las fotos que trae un cliente, cada una quede recortada o encajada (con borde) sobre el papel real de la Kodak 305, se revise de a una o en lote, y salgan todas las hojas en un solo documento de impresión, con la cantidad del ticket igual al total de copias y cada hoja registrada.

**Architecture:** se extiende la **receta** de la etapa 1 con `modo` (RECORTAR / ENCAJAR), `orientacion` y `colorBorde`, con un único modelo de encuadre: en ENCAJAR el encuadre puede salirse de la foto y lo que queda afuera es borde. Un módulo puro (`lib/impresion/encuadre.ts`) concentra la propuesta automática y todas las operaciones del editor (mover, zoom, girar, orientar); otro (`planDeRecorte` en `geometria.ts`) dice qué parte de la foto va en qué lugar del papel, y lo usan igual el servidor (`sharp`) y la vista previa (CSS y `canvas`). Cada foto de la preparación es una **pieza** `COPIA` y tiene su propia **hoja** (`copias` = cantidad de esa foto); las hojas se arman de a una por llamada y se imprimen todas juntas en `/imprimir/preparacion/[preparacionId]`.

**Tech Stack:** Next.js 16.2.1 (App Router; `params` y `searchParams` son `Promise` — leer `node_modules/next/dist/docs/01-app/` antes de tocar rutas, ver `AGENTS.md`), Prisma + Postgres (Neon), `sharp` ^0.34.5, `zod` ^3.25, `lucide-react`, Vitest. Sin dependencias nuevas.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-impresiones-recorte-revelado-design.md` (§4, §5.1–§5.5, §6, §8, §9, §14 y §15, etapa 2). Plan anterior, con su estilo y sus restricciones: `apps/fotoffice/docs/superpowers/plans/2026-10-20-impresiones-etapa-1.md`. **El código de la etapa 1 ya fusionado manda sobre ese plan** (hay diferencias: por ejemplo `registrarImpresion`, `estadoPreparacion`, `versionDeHoja`, `EXT` y `procesarOriginalSubido` no estaban en el plan).

## Decisiones (tomadas por el coordinador; son obligatorias)

1. **Alcance:** productos con `tipoPieza = COPIA` en la Kodak 305 (hojas 10x15, 13x18 y 15x20). El producto fija el tamaño (`tamanoHojaId`) y la impresora. Un producto COPIA se cobra **por copia** (`unidad = COPIA`): `guardarProduccion` rechaza otras unidades para COPIA; el carnet sigue sólo por HOJA. La cantidad de la línea del ticket = **total de copias** de todas las fotos de la preparación.
2. **Un único modelo de encuadre.** `encuadre` está en proporciones de la caja de la foto girada y **puede salirse de [0,1]** (x/y negativos, ancho/alto > 1) cuando `modo = "ENCAJAR"`; lo de afuera se llena con `colorBorde` (por omisión `"#ffffff"`). RECORTAR conserva la restricción [0,1]. La receta suma `modo`, `orientacion` y `colorBorde`. **Compatibilidad:** las recetas de la etapa 1 (sin `orientacion` ni `colorBorde`, modo RECORTAR) siguen validando y dan **exactamente el mismo archivo** (hay una prueba byte a byte). El campo `ubicacion` del spec §5.1 no se usa: lo reemplaza el encuadre extendido.
3. **Motor:** girar → recortar la parte del encuadre que cae en la foto → Lanczos a su lugar en el papel → ajustes en 16 bits → nitidez → **recién ahí** se compone sobre el papel del color del borde. Así el borde queda exactamente `colorBorde`, sin exposición ni nitidez encima. La vista previa hace lo mismo (`planDeRecorte`) y la prueba de coincidencia (ΔE < 2) se extiende a ENCAJAR.
4. **Propuesta automática (§5.5):** `propuestaAutomatica(fotoAncho, fotoAlto, papelMm)` — la orientación sigue a la foto; si recortar pierde ≤ 8 % del área, RECORTAR centrado; si no, ENCAJAR centrado con borde blanco. "Volver a la propuesta" la restablece (conserva los ajustes).
5. **Editor nuevo de copias** (no se sobrecarga el de carnet): grilla de todas las fotos sobre la silueta real del papel (lo recortado, sombreado; el borde, visible), con tamaño, cantidad, aviso de calidad (§5.4) y "Revisada" en cada tarjeta; acciones en lote (recortar todas, encajar todas, cantidad para todas, y "usar este modo y cantidad en todas" desde una foto); editor de una foto con arrastre, rueda o deslizador de zoom, girar 90°, enderezar ±10°, papel parado/acostado, "Volver a la propuesta", guías (tercios y zona de seguridad de 3 mm), teclado ← → R E Enter y el panel de ajustes de la etapa 1 (`components/foto-carnet/ajustes.tsx`). Carga de varias fotos a la vez, de a 3 en paralelo. Todo se guarda como proporciones.
6. **Hojas:** una hoja por foto (pieza) con `copias` = cantidad de esa foto. Cada hoja se arma en **su propia llamada** a una acción de servidor (nada de pedidos largos). La página nueva `/imprimir/preparacion/[preparacionId]` imprime **todas las hojas vigentes** en un solo documento (cada hoja repetida `copias` veces como páginas consecutivas, todas del mismo `@page`), con el mismo "¿Cómo salió?" y un registro por hoja (NORMAL / DESCARTADA). La página de una sola hoja (`/imprimir/hoja/[hojaId]`) queda como está.
7. **Mostrador:** "Preparar" también en productos COPIA, que abre el editor de copias en el mismo diálogo de pantalla completa; al volver, la cantidad de la línea = total de copias; "Editar fotos" reabre con lo guardado (`estadoCopias`, hermana de `estadoPreparacion`). La cola de Impresiones muestra cuántas fotos tiene la preparación y enlaza a imprimir todo.
8. **Fuera de alcance (YAGNI):** margen sin bordes (`margenSinBordesMm` no se usa), laboratorio, polaroid, planchas escolares, consumibles, y los extras de revelado de la etapa 3 (Auto, B/N, Sepia, copiar/pegar ajustes, Espacio para antes/después). Sí entra "pegar modo y cantidad a todas".
9. **Sin staging ni pruebas en navegador** en las tareas de los subagentes. **Sin dependencias nuevas.** **Sin migración:** las tablas de la etapa 1 alcanzan (`FotofficePiezaImpresion` con `tipo = COPIA` y `tamanoId`; `FotofficeHojaImpresion` con `disposicion` Json).

### Decisiones de este plan (más allá de la lista del coordinador)

- **Superficie de encuadre propia (CSS + funciones puras), no `react-easy-crop`**, para las copias. Es el "equivalente" que permite la decisión 5: `react-easy-crop` con `restrictPosition={false}` calcula el recuadro desde el tamaño de la foto en pantalla, y con una panorámica 3:1 el papel quedaba diminuto. La superficie nueva dibuja el papel fijo y mueve la foto con `transform`; la cuenta vive en `colocacionEnPantalla` (probada).
- **Regla de ENCAJAR por eje** (al arrastrar y hacer zoom): en cada eje la foto **o entra entera en el papel** (hay borde, no se corta) **o lo cubre** (se corta, no hay borde). Nunca borde y corte en el mismo eje. El zoom de ENCAJAR va de "llena el papel" a "la foto ocupa 1/4 del lado". La validación del servidor es más amplia (cualquier encuadre que toque la foto, con lados ≤ 20).
- **La hoja final siempre está en la orientación nativa del papel** (10x15 = 102 × 152 mm, parada). Una copia acostada se arma acostada y se gira 90° al componer la hoja. Así todas las páginas del documento tienen el mismo `@page`.
- **Vínculo hoja ↔ foto sin migración:** `disposicion = { tipo: "COPIA", piezaId, piezaHuella, acostada }`. Una hoja es **vigente** si es la última de su pieza, `piezaHuella` coincide con la huella actual de la pieza y sus `copias` coinciden con la cantidad. En carnet, la vigente sigue siendo la última hoja.
- **Estado de la preparación en copias:** PREPARANDO mientras falte armar alguna hoja vigente; LISTA cuando están todas; IMPRESA cuando cada hoja vigente sumó registros NORMAL por al menos sus copias. La regla de IMPRESA de `registrarImpresion` se generaliza a esto (en carnet da lo mismo que en la etapa 1: hay pruebas que lo cuidan).
- **Reimpresión parcial:** en "Alguna salió mal" se indica, por hoja, **cuántas** copias salieron mal; esas se registran DESCARTADA y se reimprimen sólo esas páginas; el resto queda NORMAL.
- **"Imprimir lo que falta":** `?solo=pendientes` en la página de la preparación imprime sólo las hojas vigentes que no salieron enteras (para editar una foto después de imprimir sin reimprimir las 30).
- **"Revisada":** se marca al confirmar (Enter). Un guardado sin confirmar la **borra si cambió la receta** y la conserva si sólo cambió la cantidad.
- **Girar, enderezar o cambiar la orientación recentran** el encuadre en el modo actual (como en la etapa 1, `react-easy-crop` también recentraba).
- **Tope:** 60 fotos por preparación y 50 copias por foto.
- **Sin selector de cliente** en el editor de copias: la preparación ya nace con el cliente del ticket (`crearPreparacion`) y al cobrar manda el de la venta. Las copias no van a la ficha del cliente (eso es sólo carnet, §10.1).

## Global Constraints

- **Sin dependencias nuevas.** El lockfile es de todo el monorepo.
- **El archivo que se imprime nunca sale del `canvas` del navegador.** Siempre de `lib/impresion/render.ts` en el servidor, desde el original en R2.
- **Medidas reales (mm):** 10x15 = 102×152 · 13x18 = 127×180 · 15x20 = 152×203. Todo se calcula desde los mm, nunca desde el nombre.
- **Kodak 305:** LOCAL, 300 ppp, nitidez SUAVE, hojas 10x15/13x18/15x20, admite copias. **Epson L800:** no admite copias (ya lo controla `guardarProduccion`).
- **JPG final:** calidad 95, `chromaSubsampling: "4:4:4"`, perfil sRGB embebido, densidad = ppp de la salida.
- **Propuesta:** umbral de pérdida **8 %** (≤ 8 % → RECORTAR). **Aviso de calidad:** ≥ 200 ppp sin aviso; 150–199 "Puede verse algo blanda en {tamaño}"; < 150 "Se va a ver pixelada en {tamaño}" (se puede imprimir igual, con confirmación).
- **Borde:** `colorBorde` por omisión `"#ffffff"`, formato `#rrggbb` en minúscula. El borde final es exactamente ese color.
- **Topes:** 60 fotos por preparación (`FOTOS_MAX`), 50 copias por foto (`CANTIDAD_MAX`), originales de hasta 60 MB y 60 megapíxeles (los de la etapa 1), subidas de a 3 en paralelo (`SUBIDAS_A_LA_VEZ`).
- **Una hoja por llamada:** `generarHojaCopiaAction(preparacionId, originalId)`; el editor las pide de a una y muestra el avance.
- **Permisos:** todo lo de copias = `requireSalesStaff()` (como preparar carnet). Configurar el producto = `requireSalesAdmin()`.
- **Textos de pantalla en español rioplatense** ("Elegí", "Probá de nuevo"), como el resto de FOTOFFICE.
- **Migraciones:** ninguna en esta etapa. Si una tarea creyera necesitarla, se detiene y lo consulta.
- **Pruebas:** `pnpm --filter fotoffice test` (Vitest, entorno node). Typecheck: `pnpm --filter fotoffice typecheck` (si se queda sin memoria devuelve éxito igual: mirar que la salida no diga "heap out of memory"). Lint: `pnpm --filter fotoffice lint`. Build: `pnpm --filter fotoffice build` (chequea tipos).
- **Todos los comandos se corren desde la raíz del worktree** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-impresiones-2`. Las rutas de archivo del plan son relativas a `apps/fotoffice/` salvo que digan otra cosa.

## Review Focus

1. **Foto de celular girada por EXIF (orientación 6) en ENCAJAR:** la foto tiene que quedar derecha dentro del papel y el borde a los costados, no la foto acostada. → prueba en Task 4 ("ENCAJAR con una foto de celular girada por EXIF").
2. **Panorámica 3:1:** la propuesta es ENCAJAR, la receta es válida y el archivo final es una franja centrada con borde arriba y abajo, del tamaño exacto. → pruebas en Task 2 ("una panorámica 3:1 se encaja…") y Task 4 ("panorámica 3:1 encajada…").
3. **Foto chiquita de baja resolución:** se agranda a la medida exacta sin romper y la tarjeta avisa "Se va a ver pixelada en …". → pruebas en Task 3 ("una foto chica avisa pixelada") y Task 4 ("una foto chiquita se agranda…"); el aviso pide confirmación en Task 15.
4. **30 fotos en una preparación:** se guardan en una sola llamada, se reabren completas, y el documento de impresión tiene una página por copia; más de 60 se rechazan. → pruebas en Task 7 ("30 fotos en una preparación…") y Task 9 ("imprimir todo…").
5. **Editar una foto después de imprimir:** la hoja impresa no se pisa (sus registros la nombran), se arma otra, la preparación vuelve a LISTA y "lo que falta" imprime sólo esa. → prueba en Task 9 ("editar una foto después de imprimir…").

---

## Mapa de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `lib/impresion/receta.ts` (+ test) | receta con `modo`, `orientacion`, `colorBorde`; validación compatible con la etapa 1 | 1 |
| `lib/impresion/encuadre.ts` (+ test) | PURO: propuesta automática, papel orientado, mover, zoom, girar, enderezar, orientar, aspecto, colocación en pantalla | 2 |
| `lib/impresion/geometria.ts` (+ test) | PURO: `planDeRecorte` (qué parte de la foto va dónde en el papel) y `calidadDeCopia` | 3 |
| `lib/impresion/render.ts` (+ test) | `sharp`: ENCAJAR con borde exacto y `componerCopia` (hoja parada) | 4 |
| `lib/impresion/coincidencia.test.ts` | vista previa contra final, también en ENCAJAR | 5 |
| `lib/impresion/configuracion.ts`, `app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx` | COPIA se cobra por copia | 6 |
| `lib/impresion/preparaciones.ts` | `crearPreparacion` acepta COPIA; hojas vigentes, estado, registro múltiple, datos para imprimir la preparación, colas | 6, 7, 9, 10 |
| `lib/circuitos/base-en-memoria.ts` | valores por omisión de `fotofficePiezaImpresion` (pruebas) | 7 |
| `lib/impresion/copias.ts` (+ `copias.test.ts`) | guardar piezas en lote, estado para reabrir, quitar foto, armar la hoja de una foto | 7, 8 |
| `lib/impresion/impresion-multiple.ts` (+ test) | PURO: páginas, pendientes y registros de "¿Cómo salió?" | 9 |
| `app/(shell)/ventas/impresion/actions.ts` | acciones de servidor nuevas | 7, 8, 9 |
| `app/(shell)/ventas/impresiones/page.tsx`, `fila-acciones.tsx` | la cola muestra fotos y enlaza a imprimir todo | 10 |
| `app/imprimir/preparacion/[preparacionId]/page.tsx`, `hojas-para-imprimir.tsx` | todas las hojas en un documento y "¿Cómo salió?" por hoja | 11 |
| `lib/impresion/subidas.ts`, `lib/impresion/lote.ts` (+ tests) | PURO: validar archivos, subir de a 3, cambios en lote, total, textos de aviso | 12 |
| `components/copias/papel-con-foto.tsx`, `components/copias/vista-pieza.tsx` | la foto sobre el papel (CSS, arrastrable) y la vista con ajustes (`canvas`) | 13 |
| `components/foto-carnet/vistas.tsx`, `components/foto-carnet/ajustes.tsx` | exportar `useImagen`; texto del panel de ajustes configurable | 13 |
| `components/copias/editor-una-foto.tsx` | editor de una foto | 14 |
| `components/copias/tarjeta-foto.tsx`, `components/copias/editor-copias.tsx` | grilla, carga múltiple, lote, armar hojas, listo | 15 |
| `app/(shell)/ventas/dialogo-preparar.tsx`, `app/(shell)/ventas/pos.tsx` | "Preparar" para copias en el Mostrador | 16 |

**Qué tareas traen el código completo (modelo económico) y cuáles piden criterio:**
- Código completo, copiar y probar: **1, 2, 3, 4, 5, 6, 10, 12**.
- Código completo pero tocan base y transacciones (leer con cuidado el código de la etapa 1 antes): **7, 8, 9**.
- Interfaz: código completo, pero piden criterio para ajustar clases, accesibilidad y detalles que el typecheck o el lint marquen: **11, 13, 14, 15, 16**.
- Cierre: **17**.

---
### Task 1: La receta aprende ENCAJAR, orientación y color de borde (sin romper la etapa 1)

**Files:**
- Modify: `lib/impresion/receta.ts` (archivo entero)
- Test: `lib/impresion/receta.test.ts`

**Interfaces:**
- Produces:
  - `type Modo = "RECORTAR" | "ENCAJAR"`, `type Orientacion = "VERTICAL" | "HORIZONTAL"`, `type Encuadre` (igual que antes).
  - `type Receta = { version: 1; modo: Modo; orientacion?: Orientacion; rotacion90: 0|90|180|270; enderezar: number; encuadre: Encuadre; colorBorde?: string; ajustes: Ajustes; nitidez: Nitidez | null }`.
  - `COLOR_BORDE_POR_OMISION = "#ffffff"`, `LADO_MAX_ENCAJAR = 20`.
  - `encuadreValido(modo: Modo, e: Encuadre): boolean`, `colorBordeDe(r: Receta): string`.
  - Sin cambios: `validarReceta(x: unknown): Receta | null`, `recetaInicial(): Receta` (sigue sin `orientacion` ni `colorBorde`), `anguloTotal(r: Receta): number`.

- [ ] **Step 1: Pruebas que fallan**

En `lib/impresion/receta.test.ts`, cambiar la línea
```ts
    expect(validarReceta({ ...r, modo: "ENCAJAR" })).toBeNull();
```
por
```ts
    expect(validarReceta({ ...r, modo: "OTRO" })).toBeNull();
```
y sumar `COLOR_BORDE_POR_OMISION`, `colorBordeDe` y `type Receta` al import de `./receta`:
```ts
import { COLOR_BORDE_POR_OMISION, anguloTotal, colorBordeDe, recetaInicial, validarReceta, type Receta } from "./receta";
```
Al final del archivo agregar:
```ts
describe("receta de la etapa 2", () => {
  it("una receta guardada en la etapa 1 (sin orientación ni color) sigue siendo válida e igual", () => {
    // Tal cual la guardó el carnet en la base: sin `orientacion` ni `colorBorde`.
    const etapa1 = {
      version: 1,
      modo: "RECORTAR",
      rotacion90: 90,
      enderezar: -2.5,
      encuadre: { x: 0.1, y: 0.2, ancho: 0.5, alto: 0.6 },
      ajustes: { exposicion: 5, contraste: 0, luces: 0, sombras: 0, blancos: 0, negros: 0, temperatura: 0, tinte: 0, saturacion: 0, intensidad: 0 },
      nitidez: null,
    };
    expect(validarReceta(etapa1)).toEqual(etapa1);
    expect(colorBordeDe(validarReceta(etapa1)!)).toBe("#ffffff");
  });

  it("ENCAJAR acepta un encuadre que se sale de la foto; RECORTAR no", () => {
    const encajar: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "HORIZONTAL", colorBorde: "#ffffff", encuadre: { x: 0, y: -0.0965, ancho: 1, alto: 1.193 } };
    expect(validarReceta(encajar)).toEqual(encajar);
    expect(validarReceta({ ...encajar, modo: "RECORTAR" })).toBeNull();
  });

  it("ENCAJAR rechaza un encuadre que no toca la foto o que la deja diminuta", () => {
    const base: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL" };
    expect(validarReceta({ ...base, encuadre: { x: 1.5, y: 0, ancho: 1, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: -12, y: 0, ancho: 25, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: 0, y: 0, ancho: 0, alto: 1 } })).toBeNull();
  });

  it("color de borde: #rrggbb en minúscula; si falta, blanco", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", colorBorde: "#102030" };
    expect(validarReceta(r)).toEqual(r);
    expect(colorBordeDe(r)).toBe("#102030");
    expect(validarReceta({ ...r, colorBorde: "red" })).toBeNull();
    expect(validarReceta({ ...r, colorBorde: "#FFF" })).toBeNull();
    expect(colorBordeDe(recetaInicial())).toBe(COLOR_BORDE_POR_OMISION);
  });

  it("rechaza una orientación desconocida", () => {
    expect(validarReceta({ ...recetaInicial(), orientacion: "DIAGONAL" })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/receta.test.ts`
Expected: FAIL (`colorBordeDe` no existe; "ENCAJAR acepta…" devuelve null).

- [ ] **Step 3: Implementar**

Reemplazar `lib/impresion/receta.ts` entero por:
```ts
import { z } from "zod";
import { AJUSTES_NEUTROS, esquemaAjustes, type Ajustes } from "./ajustes";
import type { Nitidez } from "./medidas";

/**
 * La receta de una pieza: todo lo que se decidió en pantalla, en proporciones (nunca píxeles de
 * pantalla). El servidor la aplica sobre el original completo. Módulo PURO.
 *
 * Un único modelo de encuadre: proporciones de la caja de la foto ya girada (`cajaRotada`).
 * En RECORTAR cae dentro de la foto (0..1). En ENCAJAR puede salirse (x/y negativos,
 * ancho/alto mayores que 1): lo que queda afuera de la foto es borde del color `colorBorde`.
 * Las recetas de la etapa 1 (carnet) no traen orientación ni color y se arman igual que antes.
 */

export type Encuadre = { x: number; y: number; ancho: number; alto: number };
export type Modo = "RECORTAR" | "ENCAJAR";
export type Orientacion = "VERTICAL" | "HORIZONTAL";
export type Receta = {
  version: 1;
  modo: Modo;
  /** Cómo va el papel. Falta en las recetas de carnet: la medida ya dice cómo es la pieza. */
  orientacion?: Orientacion;
  rotacion90: 0 | 90 | 180 | 270;
  /** −10 a +10 grados. */
  enderezar: number;
  encuadre: Encuadre;
  /** Sólo cuenta en ENCAJAR. Si falta, blanco. */
  colorBorde?: string;
  ajustes: Ajustes;
  /** null = la de la salida. */
  nitidez: Nitidez | null;
};

export const COLOR_BORDE_POR_OMISION = "#ffffff";
/** En ENCAJAR la foto puede achicarse hasta 1/20 del lado del papel: más chica no tiene sentido. */
export const LADO_MAX_ENCAJAR = 20;
const TOLERANCIA = 0.0001;

/** Si el encuadre tiene sentido para el modo (también lo usa el editor antes de guardar). */
export function encuadreValido(modo: Modo, e: Encuadre): boolean {
  if (modo === "RECORTAR") {
    return e.x >= 0 && e.y >= 0 && e.ancho <= 1 && e.alto <= 1 && e.x + e.ancho <= 1 + TOLERANCIA && e.y + e.alto <= 1 + TOLERANCIA;
  }
  if (e.ancho > LADO_MAX_ENCAJAR || e.alto > LADO_MAX_ENCAJAR) return false;
  // Algo de la foto tiene que caer en el papel.
  const dentroX = Math.min(1, e.x + e.ancho) - Math.max(0, e.x);
  const dentroY = Math.min(1, e.y + e.alto) - Math.max(0, e.y);
  return dentroX > 0.001 && dentroY > 0.001;
}

const esquema = z
  .object({
    version: z.literal(1),
    modo: z.enum(["RECORTAR", "ENCAJAR"]),
    orientacion: z.enum(["VERTICAL", "HORIZONTAL"]).optional(),
    rotacion90: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    enderezar: z.number().min(-10).max(10),
    encuadre: z
      .object({ x: z.number().finite(), y: z.number().finite(), ancho: z.number().finite().gt(0), alto: z.number().finite().gt(0) })
      .strict(),
    colorBorde: z.string().regex(/^#[0-9a-f]{6}$/).optional(),
    ajustes: esquemaAjustes,
    nitidez: z.enum(["SUAVE", "NORMAL", "FUERTE"]).nullable(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (!encuadreValido(r.modo, r.encuadre)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["encuadre"], message: "Encuadre fuera de rango" });
  });

export function validarReceta(x: unknown): Receta | null {
  const r = esquema.safeParse(x);
  return r.success ? (r.data as Receta) : null;
}

export function recetaInicial(): Receta {
  return { version: 1, modo: "RECORTAR", rotacion90: 0, enderezar: 0, encuadre: { x: 0, y: 0, ancho: 1, alto: 1 }, ajustes: { ...AJUSTES_NEUTROS }, nitidez: null };
}

export function anguloTotal(r: Receta): number {
  return r.rotacion90 + r.enderezar;
}

export function colorBordeDe(r: Receta): string {
  return r.colorBorde ?? COLOR_BORDE_POR_OMISION;
}
```

- [ ] **Step 4: Correr las pruebas de impresión (la etapa 1 no se rompe)**

Run: `pnpm --filter fotoffice test -- lib/impresion components/foto-carnet`
Expected: PASS (todas, incluidas las de `render`, `coincidencia` y `preparaciones`).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/receta.ts apps/fotoffice/lib/impresion/receta.test.ts
git commit -m "Impresión: la receta admite ENCAJAR, orientación y color de borde"
```

---

### Task 2: Propuesta automática y operaciones de encuadre (módulo puro)

**Files:**
- Create: `lib/impresion/encuadre.ts`
- Test: `lib/impresion/encuadre.test.ts`

**Interfaces:**
- Consumes: `cajaRotada` (geometria), `AJUSTES_NEUTROS`, `COLOR_BORDE_POR_OMISION`, `anguloTotal`, tipos `Encuadre`, `Modo`, `Orientacion`, `Receta` (Task 1).
- Produces:
  - `UMBRAL_PERDIDA = 0.08`, `ZOOM_MAX_RECORTAR = 6`, `ACHIQUE_MAX_ENCAJAR = 4`.
  - `type Papel = { anchoMm: number; altoMm: number }`; `type Contexto = { foto: { ancho: number; alto: number }; papel: Papel }` (la foto ya derecha, en píxeles del original; el papel como está guardado).
  - `papelOrientado(p: Papel, o: Orientacion): Papel`, `orientacionDeFoto(ancho, alto): Orientacion`, `perdidaAlRecortar(af, ap): number`.
  - `encuadreQueLlena(af, ap): Encuadre`, `encuadreQueContiene(af, ap): Encuadre`.
  - `propuestaAutomatica(fotoAncho: number, fotoAlto: number, papel: Papel): Receta` (siempre con `orientacion` y `colorBorde`).
  - `aspectosDe(r: Receta, c: Contexto): { af: number; ap: number }`.
  - `cambiarModo(r, modo, c)`, `cambiarOrientacion(r, c)`, `girar90(r, c)`, `enderezarA(r, grados, c)`, `volverALaPropuesta(r, c)` → `Receta`.
  - `limitarEncuadre(e, modo)`, `moverEncuadre(e, dxPapel, dyPapel, modo)`, `zoomEncuadre(e, factor, modo, af, ap)`, `conZoom(e, nivel, modo, af, ap)` → `Encuadre`; `nivelDeZoom(e, af, ap): number`; `rangoDeZoom(modo, af, ap): { min: number; max: number }`.
  - `aspectoCoincide(foto: { ancho: number; alto: number }, r: Receta, papel: Papel): boolean`.
  - `colocacionEnPantalla(r: Receta, foto: { ancho: number; alto: number }, papelPx: { ancho: number; alto: number }): { caja: { left: number; top: number; width: number; height: number }; foto: { width: number; height: number; rotacion: number } }`.

- [ ] **Step 1: Pruebas que fallan**

Crear `lib/impresion/encuadre.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import {
  aspectoCoincide,
  cambiarModo,
  cambiarOrientacion,
  colocacionEnPantalla,
  conZoom,
  encuadreQueContiene,
  encuadreQueLlena,
  enderezarA,
  girar90,
  limitarEncuadre,
  moverEncuadre,
  nivelDeZoom,
  papelOrientado,
  propuestaAutomatica,
  rangoDeZoom,
  volverALaPropuesta,
  zoomEncuadre,
} from "./encuadre";
import { recetaInicial, validarReceta, type Receta } from "./receta";

const P10 = { anchoMm: 102, altoMm: 152 };
const ctx = (ancho: number, alto: number) => ({ foto: { ancho, alto }, papel: P10 });

describe("propuesta automática (§5.5)", () => {
  it("una foto 3:2 acostada se recorta, centrada y en papel acostado", () => {
    const r = propuestaAutomatica(6000, 4000, P10);
    expect([r.modo, r.orientacion, r.colorBorde, r.rotacion90, r.enderezar]).toEqual(["RECORTAR", "HORIZONTAL", "#ffffff", 0, 0]);
    expect(r.encuadre.alto).toBe(1);
    expect(r.encuadre.ancho).toBeCloseTo(152 / 102 / 1.5, 6);
    expect(r.encuadre.x).toBeCloseTo((1 - 152 / 102 / 1.5) / 2, 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("16:9 pierde más del 8 %: se encaja con borde arriba y abajo", () => {
    const r = propuestaAutomatica(1920, 1080, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "HORIZONTAL"]);
    expect(r.encuadre.ancho).toBe(1);
    expect(r.encuadre.alto).toBeCloseTo(16 / 9 / (152 / 102), 6);
    expect(r.encuadre.y).toBeCloseTo(-(r.encuadre.alto - 1) / 2, 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("una foto de celular parada 3:4 se encaja en papel parado", () => {
    const r = propuestaAutomatica(3000, 4000, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "VERTICAL"]);
    expect(r.encuadre.alto).toBeCloseTo(0.75 / (102 / 152), 6);
  });

  it("el umbral es 8 % o menos para recortar", () => {
    const cuadrado = { anchoMm: 100, altoMm: 100 };
    expect(propuestaAutomatica(100, 92, cuadrado).modo).toBe("RECORTAR");
    expect(propuestaAutomatica(100, 91, cuadrado).modo).toBe("ENCAJAR");
  });

  it("una panorámica 3:1 se encaja y la receta es válida", () => {
    const r = propuestaAutomatica(9000, 3000, P10);
    expect([r.modo, r.orientacion]).toEqual(["ENCAJAR", "HORIZONTAL"]);
    expect(r.encuadre.alto).toBeCloseTo(3 / (152 / 102), 6);
    expect(validarReceta(r)).toEqual(r);
  });

  it("una foto cuadrada va en papel parado", () => {
    expect(propuestaAutomatica(2000, 2000, P10).orientacion).toBe("VERTICAL");
  });

  it("el papel se orienta sin importar cómo está guardado", () => {
    expect(papelOrientado(P10, "HORIZONTAL")).toEqual({ anchoMm: 152, altoMm: 102 });
    expect(papelOrientado({ anchoMm: 152, altoMm: 102 }, "VERTICAL")).toEqual(P10);
  });
});

describe("mover y hacer zoom", () => {
  const vertical = cambiarOrientacion(propuestaAutomatica(6000, 4000, P10), ctx(6000, 4000));

  it("cambiar la orientación recentra en el modo actual", () => {
    expect([vertical.orientacion, vertical.modo]).toEqual(["VERTICAL", "RECORTAR"]);
    expect(vertical.encuadre.ancho).toBeCloseTo((102 / 152) / 1.5, 6);
    expect(vertical.encuadre.x).toBeCloseTo((1 - (102 / 152) / 1.5) / 2, 6);
  });

  it("RECORTAR: arrastrar mueve el encuadre al revés y no deja salir de la foto", () => {
    const e = vertical.encuadre;
    expect(moverEncuadre(e, 0.1, 0, "RECORTAR").x).toBeCloseTo(e.x - 0.1 * e.ancho, 6);
    expect(moverEncuadre(e, 5, 0, "RECORTAR").x).toBe(0);
    expect(moverEncuadre(e, -5, 0, "RECORTAR").x).toBeCloseTo(1 - e.ancho, 6);
  });

  it("ENCAJAR: en el eje con borde, la foto queda entera dentro del papel", () => {
    const e = propuestaAutomatica(1920, 1080, P10).encuadre;
    expect(moverEncuadre(e, 0, 1, "ENCAJAR").y).toBeCloseTo(1 - e.alto, 6);
    expect(moverEncuadre(e, 0, -1, "ENCAJAR").y).toBe(0);
    expect(moverEncuadre(e, 1, 0, "ENCAJAR").x).toBe(0);
  });

  it("limitar no toca un encuadre que ya está bien", () => {
    const e = { x: 0.1, y: 0.2, ancho: 0.5, alto: 0.5 };
    expect(limitarEncuadre(e, "RECORTAR")).toEqual(e);
  });

  it("RECORTAR: el zoom acerca hasta 6× y no achica más que llenar el papel; conserva centro y proporción", () => {
    const af = 1.5, ap = 102 / 152;
    const e = vertical.encuadre;
    const z = zoomEncuadre(e, 2, "RECORTAR", af, ap);
    expect(z.ancho).toBeCloseTo(e.ancho / 2, 6);
    expect(z.alto).toBeCloseTo(0.5, 6);
    expect(z.x + z.ancho / 2).toBeCloseTo(0.5, 6);
    expect(z.alto / z.ancho).toBeCloseTo(af / ap, 6);
    expect(zoomEncuadre(e, 0.1, "RECORTAR", af, ap).ancho).toBeCloseTo(e.ancho, 6);
    expect(zoomEncuadre(e, 100, "RECORTAR", af, ap).ancho).toBeCloseTo(e.ancho / 6, 6);
  });

  it("ENCAJAR: se achica hasta 1/4 del papel y se agranda hasta llenarlo", () => {
    const af = 16 / 9, ap = 152 / 102;
    const e = encuadreQueContiene(af, ap);
    const chica = zoomEncuadre(e, 0.1, "ENCAJAR", af, ap);
    expect(chica.ancho).toBeCloseTo(4, 6);
    expect(chica.x).toBeCloseTo(-1.5, 6);
    const llena = zoomEncuadre(e, 100, "ENCAJAR", af, ap);
    expect(llena.y).toBeCloseTo(0, 6);
    expect(llena.alto).toBeCloseTo(1, 6);
    expect(llena.ancho).toBeCloseTo(encuadreQueLlena(af, ap).ancho, 6);
  });

  it("el nivel de zoom: 1 = llena el papel; el rango depende del modo", () => {
    const af = 16 / 9, ap = 152 / 102;
    expect(nivelDeZoom(encuadreQueLlena(af, ap), af, ap)).toBeCloseTo(1, 6);
    expect(rangoDeZoom("RECORTAR", af, ap)).toEqual({ min: 1, max: 6 });
    const r = rangoDeZoom("ENCAJAR", af, ap);
    expect(r.max).toBe(1);
    expect(r.min).toBeCloseTo(ap / af / 4, 6);
    expect(nivelDeZoom(conZoom(encuadreQueContiene(af, ap), 0.5, "ENCAJAR", af, ap), af, ap)).toBeCloseTo(0.5, 6);
  });
});

describe("girar, enderezar, modo y propuesta", () => {
  const c = ctx(6000, 4000);
  const base = propuestaAutomatica(6000, 4000, P10);

  it("girar 90° recentra con la caja girada", () => {
    const r = girar90(base, c);
    expect(r.rotacion90).toBe(90);
    expect(r.encuadre.ancho).toBe(1);
    expect(r.encuadre.alto).toBeCloseTo((4000 / 6000) / (152 / 102), 6);
  });

  it("enderezar se acota a ±10° y la receta sigue válida", () => {
    const r = enderezarA(base, 15, c);
    expect(r.enderezar).toBe(10);
    expect(validarReceta(r)).toEqual(r);
    expect(enderezarA(base, -3.46, c).enderezar).toBe(-3.5);
  });

  it("cambiar de modo recentra; al mismo modo no cambia nada", () => {
    expect(cambiarModo(base, "RECORTAR", c)).toBe(base);
    const e = cambiarModo(base, "ENCAJAR", c);
    expect(e.modo).toBe("ENCAJAR");
    expect(e.colorBorde).toBe("#ffffff");
    expect(e.encuadre.ancho).toBe(1);
  });

  it("volver a la propuesta deshace giro y encuadre pero conserva los ajustes", () => {
    const tocada: Receta = { ...girar90(base, c), enderezar: 3, ajustes: { ...AJUSTES_NEUTROS, exposicion: 10 } };
    const r = volverALaPropuesta(tocada, c);
    expect([r.rotacion90, r.enderezar, r.orientacion, r.modo]).toEqual([0, 0, "HORIZONTAL", "RECORTAR"]);
    expect(r.ajustes.exposicion).toBe(10);
    expect(r.encuadre).toEqual(base.encuadre);
  });

  it("aspectoCoincide: el encuadre tiene la proporción del papel en la foto donde se usa", () => {
    const r = propuestaAutomatica(600, 400, P10);
    expect(aspectoCoincide({ ancho: 600, alto: 400 }, r, P10)).toBe(true);
    expect(aspectoCoincide({ ancho: 400, alto: 600 }, r, P10)).toBe(false);
  });
});

describe("colocación en pantalla", () => {
  it("ENCAJAR 2:1 en papel cuadrado: la foto ocupa la mitad del alto, centrada", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } };
    const c = colocacionEnPantalla(r, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(c.caja.left).toBeCloseTo(0, 6);
    expect(c.caja.top).toBeCloseTo(50, 6);
    expect(c.caja.width).toBeCloseTo(200, 6);
    expect(c.caja.height).toBeCloseTo(100, 6);
    expect(c.foto).toEqual({ width: 200, height: 100, rotacion: 0 });
  });

  it("con la foto girada 90° la imagen se dibuja girada dentro de la caja", () => {
    const r: Receta = { ...recetaInicial(), rotacion90: 90, modo: "ENCAJAR", orientacion: "VERTICAL", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } };
    const c = colocacionEnPantalla(r, { ancho: 1000, alto: 2000 }, { ancho: 200, alto: 200 });
    expect(c.caja.height).toBeCloseTo(100, 6);
    expect(c.foto).toEqual({ width: 100, height: 200, rotacion: 90 });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/encuadre.test.ts`
Expected: FAIL ("Failed to resolve import ./encuadre").

- [ ] **Step 3: Implementar**

Crear `lib/impresion/encuadre.ts`:
```ts
import { AJUSTES_NEUTROS } from "./ajustes";
import { cajaRotada } from "./geometria";
import { COLOR_BORDE_POR_OMISION, anguloTotal, type Encuadre, type Modo, type Orientacion, type Receta } from "./receta";

/**
 * Módulo PURO: las decisiones de encuadre de una copia (spec §5.5 y §6). Lo usan el editor (al
 * arrastrar, hacer zoom, girar) y el servidor (para validar). Todo en proporciones de la caja de
 * la foto ya girada (`cajaRotada`), igual que la receta.
 * `af` = ancho/alto de esa caja; `ap` = ancho/alto del papel ya orientado.
 *
 * Regla de ENCAJAR al mover y hacer zoom: en cada eje la foto o entra entera en el papel (hay
 * borde) o lo cubre (se corta). Nunca borde y corte en el mismo eje.
 */

export const UMBRAL_PERDIDA = 0.08;
export const ZOOM_MAX_RECORTAR = 6;
/** En ENCAJAR la foto se puede achicar hasta ocupar 1/4 del lado del papel. */
export const ACHIQUE_MAX_ENCAJAR = 4;
const TOLERANCIA_ASPECTO = 0.02;

export type Papel = { anchoMm: number; altoMm: number };
/** La foto ya derecha (EXIF aplicado), en píxeles del original; el papel como está guardado. */
export type Contexto = { foto: { ancho: number; alto: number }; papel: Papel };

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function papelOrientado(p: Papel, o: Orientacion): Papel {
  const corto = Math.min(p.anchoMm, p.altoMm);
  const largo = Math.max(p.anchoMm, p.altoMm);
  return o === "HORIZONTAL" ? { anchoMm: largo, altoMm: corto } : { anchoMm: corto, altoMm: largo };
}

export function orientacionDeFoto(ancho: number, alto: number): Orientacion {
  return ancho > alto ? "HORIZONTAL" : "VERTICAL";
}

/** Qué fracción del área de la foto se pierde si se recorta para llenar el papel. */
export function perdidaAlRecortar(af: number, ap: number): number {
  return 1 - Math.min(af / ap, ap / af);
}

/** Centrado y llenando el papel: se corta lo que sobra. */
export function encuadreQueLlena(af: number, ap: number): Encuadre {
  if (af > ap) {
    const ancho = ap / af;
    return { x: (1 - ancho) / 2, y: 0, ancho, alto: 1 };
  }
  const alto = af / ap;
  return { x: 0, y: (1 - alto) / 2, ancho: 1, alto };
}

/** Centrado y con la foto entera: lo que sobra del papel es borde. */
export function encuadreQueContiene(af: number, ap: number): Encuadre {
  if (af > ap) {
    const alto = af / ap;
    return { x: 0, y: (1 - alto) / 2, ancho: 1, alto };
  }
  const ancho = ap / af;
  return { x: (1 - ancho) / 2, y: 0, ancho, alto: 1 };
}

/** §5.5: la orientación sigue a la foto; si recortar pierde 8 % o menos, se recorta; si no, se encaja con borde blanco. */
export function propuestaAutomatica(fotoAncho: number, fotoAlto: number, papel: Papel): Receta {
  const orientacion = orientacionDeFoto(fotoAncho, fotoAlto);
  const p = papelOrientado(papel, orientacion);
  const af = fotoAncho / fotoAlto;
  const ap = p.anchoMm / p.altoMm;
  const modo: Modo = perdidaAlRecortar(af, ap) <= UMBRAL_PERDIDA ? "RECORTAR" : "ENCAJAR";
  return {
    version: 1,
    modo,
    orientacion,
    rotacion90: 0,
    enderezar: 0,
    encuadre: modo === "RECORTAR" ? encuadreQueLlena(af, ap) : encuadreQueContiene(af, ap),
    colorBorde: COLOR_BORDE_POR_OMISION,
    ajustes: { ...AJUSTES_NEUTROS },
    nitidez: null,
  };
}

export function aspectosDe(r: Receta, c: Contexto): { af: number; ap: number } {
  const caja = cajaRotada(c.foto.ancho, c.foto.alto, anguloTotal(r));
  const p = papelOrientado(c.papel, r.orientacion ?? "VERTICAL");
  return { af: caja.ancho / caja.alto, ap: p.anchoMm / p.altoMm };
}

function centrar(r: Receta, c: Contexto): Receta {
  const { af, ap } = aspectosDe(r, c);
  return { ...r, encuadre: r.modo === "RECORTAR" ? encuadreQueLlena(af, ap) : encuadreQueContiene(af, ap) };
}

/** Al mismo modo devuelve la MISMA receta (no recentra: tocar R estando en RECORTAR no pierde el encuadre). */
export function cambiarModo(r: Receta, modo: Modo, c: Contexto): Receta {
  if (r.modo === modo) return r;
  return centrar({ ...r, modo, colorBorde: r.colorBorde ?? COLOR_BORDE_POR_OMISION }, c);
}

export function cambiarOrientacion(r: Receta, c: Contexto): Receta {
  return centrar({ ...r, orientacion: r.orientacion === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL" }, c);
}

export function girar90(r: Receta, c: Contexto): Receta {
  return centrar({ ...r, rotacion90: ((r.rotacion90 + 90) % 360) as Receta["rotacion90"] }, c);
}

export function enderezarA(r: Receta, grados: number, c: Contexto): Receta {
  return centrar({ ...r, enderezar: acotar(Math.round(grados * 10) / 10, -10, 10) }, c);
}

/** Restablece modo, orientación, giro y encuadre; conserva ajustes y nitidez. */
export function volverALaPropuesta(r: Receta, c: Contexto): Receta {
  const p = propuestaAutomatica(c.foto.ancho, c.foto.alto, c.papel);
  return { ...p, ajustes: { ...r.ajustes }, nitidez: r.nitidez };
}

function limitarEje(pos: number, lado: number, modo: Modo): number {
  // RECORTAR, o ENCAJAR en un eje donde la foto cubre el papel: el papel queda dentro de la foto.
  if (modo === "RECORTAR" || lado <= 1) return acotar(pos, 0, Math.max(0, 1 - lado));
  // ENCAJAR en un eje con borde: la foto queda entera dentro del papel.
  return acotar(pos, 1 - lado, 0);
}

export function limitarEncuadre(e: Encuadre, modo: Modo): Encuadre {
  return { ...e, x: limitarEje(e.x, e.ancho, modo), y: limitarEje(e.y, e.alto, modo) };
}

/** `dx`/`dy`: cuánto se arrastró la FOTO, en fracciones del papel (positivo = derecha / abajo). */
export function moverEncuadre(e: Encuadre, dx: number, dy: number, modo: Modo): Encuadre {
  return limitarEncuadre({ ...e, x: e.x - dx * e.ancho, y: e.y - dy * e.alto }, modo);
}

/** `factor` > 1 acerca (el encuadre se achica), < 1 aleja. Mantiene el centro del papel y la proporción. */
export function zoomEncuadre(e: Encuadre, factor: number, modo: Modo, af: number, ap: number): Encuadre {
  const lleno = encuadreQueLlena(af, ap).ancho;
  const min = modo === "RECORTAR" ? lleno / ZOOM_MAX_RECORTAR : lleno;
  const max = modo === "RECORTAR" ? lleno : encuadreQueContiene(af, ap).ancho * ACHIQUE_MAX_ENCAJAR;
  const ancho = acotar(e.ancho / factor, min, max);
  const alto = (ancho * af) / ap;
  const cx = e.x + e.ancho / 2;
  const cy = e.y + e.alto / 2;
  return limitarEncuadre({ x: cx - ancho / 2, y: cy - alto / 2, ancho, alto }, modo);
}

/** 1 = la foto llena el papel; más de 1 acerca; menos de 1 (sólo ENCAJAR) achica. */
export function nivelDeZoom(e: Encuadre, af: number, ap: number): number {
  return encuadreQueLlena(af, ap).ancho / e.ancho;
}

export function conZoom(e: Encuadre, nivel: number, modo: Modo, af: number, ap: number): Encuadre {
  return zoomEncuadre(e, nivel / nivelDeZoom(e, af, ap), modo, af, ap);
}

export function rangoDeZoom(modo: Modo, af: number, ap: number): { min: number; max: number } {
  if (modo === "RECORTAR") return { min: 1, max: ZOOM_MAX_RECORTAR };
  return { min: encuadreQueLlena(af, ap).ancho / (encuadreQueContiene(af, ap).ancho * ACHIQUE_MAX_ENCAJAR), max: 1 };
}

/** El encuadre, sobre ESTA foto, tiene la proporción del papel (si no, el archivo saldría deformado). */
export function aspectoCoincide(foto: { ancho: number; alto: number }, r: Receta, papel: Papel): boolean {
  const caja = cajaRotada(foto.ancho, foto.alto, anguloTotal(r));
  const p = papelOrientado(papel, r.orientacion ?? "VERTICAL");
  const delEncuadre = (r.encuadre.ancho * caja.ancho) / (r.encuadre.alto * caja.alto);
  return Math.abs(delEncuadre / (p.anchoMm / p.altoMm) - 1) <= TOLERANCIA_ASPECTO;
}

/**
 * Dónde dibujar la foto (CSS, en px) para que el encuadre caiga justo sobre un papel de
 * `papelPx`. `caja` es la caja girada, relativa al papel; la imagen va centrada en la caja y
 * girada `rotacion` grados. Con la foto del tamaño que sea (la vista previa sirve igual).
 */
export function colocacionEnPantalla(
  r: Receta,
  foto: { ancho: number; alto: number },
  papelPx: { ancho: number; alto: number },
): { caja: { left: number; top: number; width: number; height: number }; foto: { width: number; height: number; rotacion: number } } {
  const rotacion = anguloTotal(r);
  const caja = cajaRotada(foto.ancho, foto.alto, rotacion);
  const width = papelPx.ancho / r.encuadre.ancho;
  const height = papelPx.alto / r.encuadre.alto;
  const escala = width / caja.ancho;
  return {
    caja: { left: -r.encuadre.x * width, top: -r.encuadre.y * height, width, height },
    foto: { width: foto.ancho * escala, height: foto.alto * escala, rotacion },
  };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/encuadre.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/encuadre.ts apps/fotoffice/lib/impresion/encuadre.test.ts
git commit -m "Impresión: propuesta automática y operaciones de encuadre para copias"
```

---
### Task 3: Qué parte de la foto va dónde en el papel, y el aviso de calidad de una copia

**Files:**
- Modify: `lib/impresion/geometria.ts` (agregar al final; cambiar el import de `./receta`)
- Test: `lib/impresion/geometria.test.ts`

**Interfaces:**
- Consumes: `rectanguloEnPixeles`, `resolucionEfectiva`, `avisoDeCalidad`, `cajaRotada` (ya existen); `anguloTotal`, `type Receta`, `type Encuadre` (Task 1).
- Produces:
  - `type Rect = { left: number; top: number; width: number; height: number }`.
  - `type AvisoCalidad = "OK" | "BLANDA" | "PIXELADA"`.
  - `interseccionConFoto(e: Encuadre): Encuadre | null`.
  - `planDeRecorte(r: Pick<Receta, "modo" | "encuadre">, caja: { ancho: number; alto: number }, destino: { ancho: number; alto: number }, margen = 0): { recorte: Rect; colocacion: Rect; completo: boolean }` — `recorte` en píxeles de la caja girada; `colocacion` en píxeles del destino; `completo` = la foto ocupa todo el destino (RECORTAR siempre).
  - `calidadDeCopia(foto: { ancho: number; alto: number }, r: Receta, papel: { anchoMm: number; altoMm: number } /* ya orientado */): { ppp: number; aviso: AvisoCalidad }`.

- [ ] **Step 1: Pruebas que fallan**

En `lib/impresion/geometria.test.ts`, sumar `calidadDeCopia`, `interseccionConFoto` y `planDeRecorte` al import de `./geometria`, y arriba del archivo, junto a los demás imports:
```ts
import { encuadreQueContiene, encuadreQueLlena } from "./encuadre";
import { recetaInicial, type Receta } from "./receta";
```
Al final del archivo agregar:
```ts
describe("plan de recorte", () => {
  it("RECORTAR: el encuadre entero a todo el destino (igual que la etapa 1)", () => {
    const e = { x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 };
    expect(planDeRecorte({ modo: "RECORTAR", encuadre: e }, { ancho: 4000, alto: 3000 }, { ancho: 600, alto: 450 })).toEqual({
      recorte: rectanguloEnPixeles(e, { ancho: 4000, alto: 3000 }),
      colocacion: { left: 0, top: 0, width: 600, height: 450 },
      completo: true,
    });
  });

  it("ENCAJAR 2:1 en papel cuadrado: la foto entera, centrada, con borde arriba y abajo", () => {
    const plan = planDeRecorte({ modo: "ENCAJAR", encuadre: { x: 0, y: -0.5, ancho: 1, alto: 2 } }, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(plan).toEqual({
      recorte: { left: 0, top: 0, width: 2000, height: 1000 },
      colocacion: { left: 0, top: 50, width: 200, height: 100 },
      completo: false,
    });
  });

  it("ENCAJAR que corta los costados: sólo la parte de la foto que cae en el papel", () => {
    const plan = planDeRecorte({ modo: "ENCAJAR", encuadre: { x: 0.1, y: -0.5, ancho: 0.8, alto: 2 } }, { ancho: 2000, alto: 1000 }, { ancho: 200, alto: 200 });
    expect(plan.recorte).toEqual({ left: 200, top: 0, width: 1600, height: 1000 });
    expect(plan.colocacion).toEqual({ left: 0, top: 50, width: 200, height: 100 });
  });

  it("la vista previa y el original dan la misma colocación (la pantalla no cambia el resultado)", () => {
    const r = { modo: "ENCAJAR" as const, encuadre: encuadreQueContiene(1.5, 127 / 180) };
    const final = planDeRecorte(r, { ancho: 3000, alto: 2000 }, { ancho: 400, alto: 567 });
    const vista = planDeRecorte(r, { ancho: 1600, alto: 1067 }, { ancho: 400, alto: 567 });
    expect(vista.colocacion).toEqual(final.colocacion);
    expect(final.colocacion).toEqual({ left: 0, top: 150, width: 400, height: 267 });
  });

  it("la intersección con la foto: null si no la toca", () => {
    expect(interseccionConFoto({ x: -0.5, y: 0, ancho: 2, alto: 1 })).toEqual({ x: 0, y: 0, ancho: 1, alto: 1 });
    expect(interseccionConFoto({ x: 1.2, y: 0, ancho: 1, alto: 1 })).toBeNull();
  });
});

describe("calidad de una copia", () => {
  it("una foto justa para 10x15 a 300 ppp no avisa", () => {
    const r: Receta = { ...recetaInicial(), orientacion: "VERTICAL", encuadre: encuadreQueLlena(1205 / 1795, 102 / 152) };
    expect(calidadDeCopia({ ancho: 1205, alto: 1795 }, r, { anchoMm: 102, altoMm: 152 })).toEqual({ ppp: 300, aviso: "OK" });
  });

  it("una foto chica avisa pixelada", () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(400 / 300, 180 / 127) };
    expect(calidadDeCopia({ ancho: 400, alto: 300 }, r, { anchoMm: 180, altoMm: 127 })).toEqual({ ppp: 56, aviso: "PIXELADA" });
  });

  it("en ENCAJAR cuenta sólo el lugar que ocupa la foto en el papel", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "HORIZONTAL", encuadre: encuadreQueContiene(2, 152 / 102) };
    expect(calidadDeCopia({ ancho: 2000, alto: 1000 }, r, { anchoMm: 152, altoMm: 102 })).toEqual({ ppp: 334, aviso: "OK" });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/geometria.test.ts`
Expected: FAIL (`planDeRecorte is not a function` o error de import).

- [ ] **Step 3: Implementar**

En `lib/impresion/geometria.ts` cambiar
```ts
import type { Encuadre } from "./receta";
```
por
```ts
import { anguloTotal, type Encuadre, type Receta } from "./receta";
```
y cambiar la firma de `avisoDeCalidad` para que devuelva el tipo con nombre:
```ts
export type AvisoCalidad = "OK" | "BLANDA" | "PIXELADA";

export function avisoDeCalidad(ppp: number): AvisoCalidad {
```
Al final del archivo agregar:
```ts
export type Rect = { left: number; top: number; width: number; height: number };

/** La parte del encuadre que cae dentro de la foto (0..1), o null si no la toca. */
export function interseccionConFoto(e: Encuadre): Encuadre | null {
  const x0 = Math.max(0, e.x);
  const y0 = Math.max(0, e.y);
  const x1 = Math.min(1, e.x + e.ancho);
  const y1 = Math.min(1, e.y + e.alto);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Qué píxeles de la caja girada se toman (`recorte`) y dónde van en el destino (`colocacion`).
 * RECORTAR: el encuadre entero a todo el destino (lo mismo que hacía la etapa 1). ENCAJAR: sólo
 * la parte del encuadre que cae en la foto, en su lugar del papel; el resto es borde.
 * La usan el servidor (`renderizarPieza`) y la vista previa (`VistaPieza`), así coinciden.
 */
export function planDeRecorte(
  r: Pick<Receta, "modo" | "encuadre">,
  caja: { ancho: number; alto: number },
  destino: { ancho: number; alto: number },
  margen = 0,
): { recorte: Rect; colocacion: Rect; completo: boolean } {
  const e = r.encuadre;
  if (r.modo === "RECORTAR") {
    return { recorte: rectanguloEnPixeles(e, caja, margen), colocacion: { left: 0, top: 0, width: destino.ancho, height: destino.alto }, completo: true };
  }
  // `validarReceta` no deja pasar un encuadre que no toque la foto; por las dudas, la foto entera.
  const i = interseccionConFoto(e) ?? { x: 0, y: 0, ancho: 1, alto: 1 };
  const left = entre(Math.round(((i.x - e.x) / e.ancho) * destino.ancho), 0, destino.ancho - 1);
  const right = entre(Math.round(((i.x + i.ancho - e.x) / e.ancho) * destino.ancho), left + 1, destino.ancho);
  const top = entre(Math.round(((i.y - e.y) / e.alto) * destino.alto), 0, destino.alto - 1);
  const bottom = entre(Math.round(((i.y + i.alto - e.y) / e.alto) * destino.alto), top + 1, destino.alto);
  const colocacion = { left, top, width: right - left, height: bottom - top };
  return {
    recorte: rectanguloEnPixeles(i, caja, margen),
    colocacion,
    completo: left === 0 && top === 0 && colocacion.width === destino.ancho && colocacion.height === destino.alto,
  };
}

/**
 * §5.4 para una copia: píxeles reales del original que caen en cada pulgada del lugar que ocupa
 * la foto en el papel (`papel` ya orientado como la receta). Se calcula en décimas de mm.
 */
export function calidadDeCopia(
  foto: { ancho: number; alto: number },
  r: Receta,
  papel: { anchoMm: number; altoMm: number },
): { ppp: number; aviso: AvisoCalidad } {
  const caja = cajaRotada(foto.ancho, foto.alto, anguloTotal(r));
  const plan = planDeRecorte(r, caja, { ancho: Math.round(papel.anchoMm * 10), alto: Math.round(papel.altoMm * 10) });
  const ppp = resolucionEfectiva(plan.recorte, { anchoMm: plan.colocacion.width / 10, altoMm: plan.colocacion.height / 10 });
  return { ppp, aviso: avisoDeCalidad(ppp) };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/geometria.test.ts lib/impresion/encuadre.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/geometria.ts apps/fotoffice/lib/impresion/geometria.test.ts
git commit -m "Impresión: plan de recorte para encajar y aviso de calidad de copias"
```

---

### Task 4: El motor arma ENCAJAR con borde exacto y la hoja de una copia

**Files:**
- Modify: `lib/impresion/render.ts` (`renderizarPieza`, imports; agregar `rgbDe` y `componerCopia`)
- Test: `lib/impresion/render.test.ts`

**Interfaces:**
- Consumes: `planDeRecorte` (Task 3), `colorBordeDe` (Task 1), `encuadreQueContiene`/`encuadreQueLlena` (Task 2, sólo en pruebas).
- Produces:
  - `renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw>` — misma firma; ahora también ENCAJAR.
  - `rgbDe(hex: string): { r: number; g: number; b: number }`.
  - `componerCopia(pieza: PiezaRaw, acostada: boolean, ppp: number): Promise<Buffer>` — JPG de la hoja; si `acostada`, la gira 90° para dejarla parada.

- [ ] **Step 1: Pruebas que fallan**

En `lib/impresion/render.test.ts`, cambiar el import de `./render` por
```ts
import { MENSAJE_HEIC, componerCopia, componerHoja, esHeicSinSoporte, generarVistaPrevia, leerOriginal, renderizarPieza, type PiezaRaw } from "./render";
```
y sumar estos imports:
```ts
import { aplicarAjustes } from "./ajustes";
import { encuadreQueContiene, encuadreQueLlena } from "./encuadre";
import { cajaRotada, rectanguloEnPixeles } from "./geometria";
import { anguloTotal } from "./receta";
```
(`AJUSTES_NEUTROS` ya se importa de `./ajustes`: dejar un solo import con `{ AJUSTES_NEUTROS, aplicarAjustes }`; `tamanoVistaPrevia` ya se importa de `./geometria`: dejar `{ cajaRotada, rectanguloEnPixeles, tamanoVistaPrevia }`.)

Al final del archivo agregar:
```ts
const pixel = (p: PiezaRaw, x: number, y: number) => {
  const i = (y * p.ancho + x) * 3;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!];
};
const encajar = (encuadre: Receta["encuadre"], extra: Partial<Receta> = {}): Receta => ({
  ...recetaInicial(),
  modo: "ENCAJAR",
  orientacion: "HORIZONTAL",
  colorBorde: "#ffffff",
  encuadre,
  ...extra,
});

/** El pipeline de la etapa 1, copiado tal cual: una receta vieja tiene que dar el mismo archivo. */
async function piezaComoEnLaEtapa1(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, sigma: number) {
  const meta = await sharp(original).metadata();
  const girada = (meta.orientation ?? 1) >= 5;
  const ancho = girada ? meta.height! : meta.width!;
  const alto = girada ? meta.width! : meta.height!;
  const angulo = anguloTotal(receta);
  const rect = rectanguloEnPixeles(receta.encuadre, cajaRotada(ancho, alto, angulo), angulo % 90 === 0 ? 0 : 2);
  const blanco = { r: 255, g: 255, b: 255 };
  let p = sharp(original).autoOrient().flatten({ background: blanco });
  if (angulo !== 0) p = p.rotate(angulo, { background: blanco });
  const { data, info } = await p
    .extract(rect)
    .resize(destino.ancho, destino.alto, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  const u16 = new Uint16Array(data.length / 2);
  Buffer.from(u16.buffer).set(data);
  aplicarAjustes(u16, 3, receta.ajustes);
  return sharp(u16, { raw: { width: info.width, height: info.height, channels: 3 } }).toColourspace("srgb").sharpen({ sigma }).raw().toBuffer();
}

describe("motor de impresión: copias (etapa 2)", () => {
  it("una receta de la etapa 1 da exactamente el mismo archivo que antes", async () => {
    const r: Receta = { ...recetaInicial(), enderezar: 3, encuadre: { x: 0.1, y: 0.05, ancho: 0.6, alto: 0.7 }, ajustes: { ...AJUSTES_NEUTROS, exposicion: 12, saturacion: -8 } };
    const original = await mitades(900, 700);
    const nuevo = await renderizarPieza(original, r, { ancho: 240, alto: 280 }, "NORMAL");
    const viejo = await piezaComoEnLaEtapa1(original, r, { ancho: 240, alto: 280 }, 0.8);
    expect(nuevo.data.equals(viejo)).toBe(true);
  });

  it("ENCAJAR: la foto entera sobre el papel y el borde blanco puro", async () => {
    const p = await renderizarPieza(await foto(2000, 1000), encajar({ x: 0, y: -0.5, ancho: 1, alto: 2 }), { ancho: 300, alto: 300 }, "SUAVE");
    expect([p.ancho, p.alto, p.data.length]).toEqual([300, 300, 300 * 300 * 3]);
    // Filas 0–74 y 225–299: borde; 75–224: foto.
    for (const y of [0, 40, 74, 225, 299]) expect(pixel(p, 150, y)).toEqual([255, 255, 255]);
    const [r, g] = pixel(p, 150, 150);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(80);
  });

  it("el borde conserva su color exacto aunque se aclare la foto", async () => {
    const r = encajar({ x: 0, y: -0.5, ancho: 1, alto: 2 }, { colorBorde: "#102030", ajustes: { ...AJUSTES_NEUTROS, exposicion: 50 } });
    const p = await renderizarPieza(await foto(2000, 1000, { r: 64, g: 64, b: 64 }), r, { ancho: 300, alto: 300 }, "FUERTE");
    expect(pixel(p, 150, 5)).toEqual([16, 32, 48]);
    expect(pixel(p, 150, 294)).toEqual([16, 32, 48]);
    expect(pixel(p, 150, 150)[0]!).toBeGreaterThan(100);
  });

  it("ENCAJAR con una foto de celular girada por EXIF: queda derecha, con borde a los costados", async () => {
    // Guardada 400×300 negro|blanco con orientación 6: derecha es 300×400, ARRIBA negra y ABAJO blanca.
    const girada = await sharp(await mitades(400, 300)).withMetadata({ orientation: 6 }).jpeg({ quality: 100 }).toBuffer();
    const r = encajar(encuadreQueContiene(300 / 400, 300 / 200));
    const p = await renderizarPieza(girada, r, { ancho: 300, alto: 200 }, "SUAVE");
    // Columnas 0–74 y 225–299: borde; la foto, en el medio.
    for (const [x, y] of [[20, 30], [20, 170], [280, 100]] as const) expect(pixel(p, x, y)).toEqual([255, 255, 255]);
    for (const x of [110, 190]) {
      expect(pixel(p, x, 30)[0]!).toBeLessThan(40);
      expect(pixel(p, x, 170)[0]!).toBeGreaterThan(215);
    }
  });

  it("panorámica 3:1 encajada en 10x15: una franja centrada con borde arriba y abajo", async () => {
    const r = encajar(encuadreQueContiene(3, 447 / 300));
    const p = await renderizarPieza(await foto(900, 300), r, { ancho: 447, alto: 300 }, "SUAVE");
    expect([p.ancho, p.alto]).toEqual([447, 300]);
    expect(pixel(p, 223, 10)).toEqual([255, 255, 255]);
    expect(pixel(p, 223, 290)).toEqual([255, 255, 255]);
    expect(pixel(p, 223, 150)[0]!).toBeGreaterThan(180);
  });

  it("una foto chiquita se agranda a la medida exacta sin romper", async () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(40 / 30, 1795 / 1205) };
    const p = await renderizarPieza(await foto(40, 30), r, { ancho: 1795, alto: 1205 }, "SUAVE");
    expect([p.ancho, p.alto, p.data.length]).toEqual([1795, 1205, 1795 * 1205 * 3]);
  });

  it("la hoja de una copia acostada sale parada: medida exacta, 300 ppp, sRGB y 4:4:4", async () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(1.5, 1795 / 1205) };
    const pieza = await renderizarPieza(await foto(600, 400), r, { ancho: 1795, alto: 1205 }, "SUAVE");
    const meta = await sharp(await componerCopia(pieza, true, 300)).metadata();
    expect([meta.width, meta.height, meta.density, meta.chromaSubsampling, meta.hasProfile]).toEqual([1205, 1795, 300, "4:4:4", true]);
    const parada = await sharp(await componerCopia(pieza, false, 300)).metadata();
    expect([parada.width, parada.height]).toEqual([1795, 1205]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/render.test.ts`
Expected: FAIL (`componerCopia` no existe; las de ENCAJAR fallan).

- [ ] **Step 3: Implementar**

En `lib/impresion/render.ts`:

Cambiar los imports de `./geometria` y `./receta` por:
```ts
import { cajaRotada, planDeRecorte, tamanoVistaPrevia } from "./geometria";
import { anguloTotal, colorBordeDe, type Receta } from "./receta";
```
Debajo de `const SIGMA…` agregar:
```ts
/** "#rrggbb" → { r, g, b } (la receta ya validó el formato). */
export function rgbDe(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
```
Reemplazar la función `renderizarPieza` entera por:
```ts
export async function renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw> {
  const info = await leerOriginal(original);
  const angulo = anguloTotal(receta);
  const caja = cajaRotada(info.ancho, info.alto, angulo);
  // RECORTAR: el encuadre entero, a toda la pieza (como en la etapa 1).
  // ENCAJAR: sólo la parte del encuadre que cae en la foto, en su lugar del papel.
  const plan = planDeRecorte(receta, caja, destino, angulo % 90 === 0 ? 0 : 2);
  const borde = receta.modo === "ENCAJAR" ? rgbDe(colorBordeDe(receta)) : BLANCO;

  // 1-4: derecha, a sRGB (sharp usa el perfil embebido), girada, recortada y llevada a su medida.
  let p = abrir(original).autoOrient().flatten({ background: BLANCO });
  if (angulo !== 0) p = p.rotate(angulo, { background: borde });
  const { data: crudo16, info: i16 } = await p
    .extract(plan.recorte)
    .resize(plan.colocacion.width, plan.colocacion.height, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  if (i16.channels !== 3) throw new ImagenNoProcesable("La foto tiene un formato de color que no se puede imprimir.", true);

  // 5: ajustes en 16 bits (la misma función que la vista previa).
  const u16 = new Uint16Array(crudo16.length / 2);
  Buffer.from(u16.buffer).set(crudo16);
  aplicarAjustes(u16, 3, receta.ajustes);

  // 6: a 8 bits y nitidez de salida.
  const { data: foto, info: i8 } = await sharp(u16, { raw: { width: i16.width, height: i16.height, channels: 3 } })
    .toColourspace("srgb")
    .sharpen({ sigma: SIGMA[receta.nitidez ?? nitidez] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (plan.completo) return { data: foto, ancho: i8.width, alto: i8.height };

  // 7 (ENCAJAR): la foto, ya ajustada y enfocada, sobre el papel del color del borde. El borde no
  // pasa por los ajustes ni por la nitidez: queda exactamente del color elegido.
  const { data, info: ih } = await sharp({ create: { width: destino.ancho, height: destino.alto, channels: 3, background: borde } })
    .composite([{ input: foto, raw: { width: i8.width, height: i8.height, channels: 3 }, left: plan.colocacion.left, top: plan.colocacion.top }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, ancho: ih.width, alto: ih.height };
}
```
Al final del archivo agregar:
```ts
/**
 * La hoja de una copia: la copia ocupa el papel entero. La hoja siempre va en la orientación en
 * que está guardado el papel (10x15 parada): una copia acostada se gira 90° para que todas las
 * páginas del documento de impresión tengan el mismo `@page`.
 */
export async function componerCopia(pieza: PiezaRaw, acostada: boolean, ppp: number): Promise<Buffer> {
  let p = sharp(pieza.data, { raw: { width: pieza.ancho, height: pieza.alto, channels: 3 } });
  if (acostada) p = p.rotate(90);
  return p.jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).withIccProfile("srgb").withMetadata({ density: ppp }).toBuffer();
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/render.test.ts lib/impresion/preparaciones.test.ts lib/impresion/coincidencia.test.ts`
Expected: PASS (las de carnet siguen igual).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/render.ts apps/fotoffice/lib/impresion/render.test.ts
git commit -m "Impresión: el motor encaja con borde exacto y arma la hoja de una copia"
```

---

### Task 5: La vista previa coincide con el archivo final también en ENCAJAR

**Files:**
- Modify: `lib/impresion/coincidencia.test.ts` (archivo entero)

**Interfaces:**
- Consumes: `renderizarPieza`, `generarVistaPrevia` (Task 4), `planDeRecorte`, `cajaRotada` (Task 3), `encuadreQueContiene` (Task 2).

- [ ] **Step 1: Escribir la prueba**

Reemplazar `lib/impresion/coincidencia.test.ts` entero por:
```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, aplicarAjustes, type Ajustes } from "./ajustes";
import { encuadreQueContiene } from "./encuadre";
import { cajaRotada, planDeRecorte } from "./geometria";
import { recetaInicial, type Receta } from "./receta";
import { generarVistaPrevia, renderizarPieza } from "./render";

/** Un degradé con color: cubre sombras, medios y luces en los tres canales. */
async function degrade(ancho: number, alto: number) {
  const px = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3;
      px[i] = Math.round((x / ancho) * 255);
      px[i + 1] = Math.round((y / alto) * 255);
      px[i + 2] = 128;
    }
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 98 }).toBuffer();
}

function aLab([r, g, b]: number[]): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r!), lin(g!), lin(b!)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** Promedio de color de 20 zonas (5 × 4) de una imagen RGB cruda. */
function zonas(data: Uint8Array | Buffer, ancho: number, alto: number): number[][] {
  const out: number[][] = [];
  for (let zy = 0; zy < 4; zy++)
    for (let zx = 0; zx < 5; zx++) {
      const s = [0, 0, 0];
      let n = 0;
      for (let y = Math.floor((zy * alto) / 4); y < Math.floor(((zy + 1) * alto) / 4); y++)
        for (let x = Math.floor((zx * ancho) / 5); x < Math.floor(((zx + 1) * ancho) / 5); x++) {
          const i = (y * ancho + x) * 3;
          s[0] += data[i]!; s[1] += data[i + 1]!; s[2] += data[i + 2]!; n++;
        }
      out.push(s.map((v) => v / n));
    }
  return out;
}

function deltaZonas(a: Uint8Array | Buffer, b: Uint8Array | Buffer, ancho: number, alto: number): number {
  const la = zonas(a, ancho, alto).map(aLab);
  const lb = zonas(b, ancho, alto).map(aLab);
  return la.reduce((acc, x, i) => acc + Math.hypot(x[0] - lb[i]![0], x[1] - lb[i]![1], x[2] - lb[i]![2]), 0) / la.length;
}

async function deltaPromedio(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  const final = await renderizarPieza(original, { ...recetaInicial(), ajustes }, { ancho: 600, alto: 400 }, "SUAVE");
  // La vista previa como la arma el navegador: la vista previa del servidor + aplicarAjustes en 8 bits.
  const vista = await generarVistaPrevia(original);
  const { data } = await sharp(vista.jpg).resize(600, 400, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  return deltaZonas(final.data, ocho, 600, 400);
}

/**
 * ENCAJAR como lo arma `VistaPieza` en el navegador: el mismo `planDeRecorte` sobre la vista
 * previa, ajustes en 8 bits sólo sobre la foto, y la foto sobre el papel del color del borde.
 */
async function encajado(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  // 13x18 parada (127 × 180 mm): la foto acostada entra con borde arriba y abajo.
  const receta: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", colorBorde: "#ffffff", encuadre: encuadreQueContiene(1.5, 127 / 180), ajustes };
  const destino = { ancho: 400, alto: 567 };
  const final = await renderizarPieza(original, receta, destino, "SUAVE");
  const vista = await generarVistaPrevia(original);
  const plan = planDeRecorte(receta, cajaRotada(vista.ancho, vista.alto, 0), destino);
  const { data } = await sharp(vista.jpg)
    .extract(plan.recorte)
    .resize(plan.colocacion.width, plan.colocacion.height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  const { data: vistaHoja } = await sharp({ create: { width: destino.ancho, height: destino.alto, channels: 3, background: "#ffffff" } })
    .composite([{ input: Buffer.from(ocho), raw: { width: plan.colocacion.width, height: plan.colocacion.height, channels: 3 }, left: plan.colocacion.left, top: plan.colocacion.top }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { delta: deltaZonas(final.data, vistaHoja, destino.ancho, destino.alto), final: final.data, vista: vistaHoja, ancho: destino.ancho };
}

describe("vista previa contra archivo final", () => {
  it("sin ajustes, la diferencia promedio es menor a 2 (ΔE)", async () => {
    expect(await deltaPromedio(AJUSTES_NEUTROS)).toBeLessThan(2);
  });
  it("con ajustes fuertes, también", async () => {
    expect(await deltaPromedio({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40, sombras: 30 })).toBeLessThan(2);
  });
  it("ENCAJAR sin ajustes: ΔE menor a 2 y el borde es idéntico en los dos", async () => {
    const e = await encajado(AJUSTES_NEUTROS);
    expect(e.delta).toBeLessThan(2);
    const fila = (d: Uint8Array | Buffer, y: number) => Array.from(d.subarray(y * e.ancho * 3, (y + 1) * e.ancho * 3));
    for (const y of [0, 100, 149, 417, 566]) {
      expect(fila(e.final, y).every((v) => v === 255)).toBe(true);
      expect(fila(e.vista, y)).toEqual(fila(e.final, y));
    }
  });
  it("ENCAJAR con ajustes fuertes: ΔE menor a 2", async () => {
    expect((await encajado({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40 })).delta).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Correr**

Run: `pnpm --filter fotoffice test -- lib/impresion/coincidencia.test.ts`
Expected: PASS (las 4). Si "ENCAJAR … ΔE" diera 2 o más, NO subir el umbral: revisar que `renderizarPieza` y el plan usen la misma colocación (Task 3) y avisar.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/lib/impresion/coincidencia.test.ts
git commit -m "Impresión: la prueba de coincidencia cubre ENCAJAR y el borde"
```

---

### Task 6: Las copias se cobran por copia y se pueden preparar

**Files:**
- Modify: `lib/impresion/configuracion.ts` (`guardarProduccion`)
- Modify: `lib/impresion/preparaciones.ts` (`crearPreparacion`)
- Modify: `app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx`
- Test: `lib/impresion/configuracion.test.ts`, `lib/impresion/preparaciones.test.ts`

**Interfaces:**
- Produces: `guardarProduccion` rechaza `{ tipoPieza: "COPIA", unidad ≠ "COPIA" }` con `"Las copias se cobran por copia."`; `crearPreparacion` acepta productos con producción `COPIA` además de `CARNET`.

- [ ] **Step 1: Pruebas que fallan**

En `lib/impresion/configuracion.test.ts`, dentro del `describe`, agregar:
```ts
  it("las copias se cobran por copia (no por hoja ni por pieza)", async () => {
    await C.asegurarConfiguracion("ws-1");
    const kodak = (await C.listarSalidas("ws-1")).find((x) => x.nombre === "Kodak 305")!;
    const t13 = kodak.tamanos.find((t) => t.nombre === "13x18")!;
    for (const unidad of ["HOJA", "PIEZA"] as const) {
      expect(await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "COPIA", salidaId: kodak.id, tamanoHojaId: t13.id, unidad })).toEqual({
        ok: false,
        error: "Las copias se cobran por copia.",
      });
    }
    expect(await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "COPIA", salidaId: kodak.id, tamanoHojaId: t13.id, unidad: "COPIA" })).toEqual({ ok: true });
  });
```
En `lib/impresion/preparaciones.test.ts`, dentro del `describe`, agregar:
```ts
  it("un producto de copias también se prepara", async () => {
    B.agregar("product", { id: "copia10", workspaceId: "ws-1", name: "Copia 10x15", priceArs: "900", isActive: true });
    expect(await C.guardarProduccion("ws-1", "copia10", { tipoPieza: "COPIA", salidaId: kodakId, tamanoHojaId: t10, unidad: "COPIA" })).toEqual({ ok: true });
    expect((await P.crearPreparacion(CTX, { productId: "copia10", clientId: null })).ok).toBe(true);
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/configuracion.test.ts lib/impresion/preparaciones.test.ts`
Expected: FAIL en las dos pruebas nuevas.

- [ ] **Step 3: Implementar**

En `lib/impresion/configuracion.ts`, en `guardarProduccion`, justo después del bloque
```ts
  if (datos.tipoPieza === "CARNET" && datos.unidad !== "HOJA")
    return { ok: false, error: "La foto carnet se cobra por hoja (plancha). Cobrarla por foto llega más adelante." };
```
agregar:
```ts
  // Etapa 2: la cantidad del renglón es el total de copias de la preparación.
  if (datos.tipoPieza === "COPIA" && datos.unidad !== "COPIA")
    return { ok: false, error: "Las copias se cobran por copia." };
```
En `lib/impresion/preparaciones.ts`, en `crearPreparacion`, reemplazar
```ts
    // Etapa 1: sólo carnet.
    if (prod?.tipoPieza !== "CARNET") return { ok: false, error: "Ese producto no se prepara para imprimir." };
```
por
```ts
    // Carnet (etapa 1) y copias (etapa 2). Polaroid llega después.
    if (prod?.tipoPieza !== "CARNET" && prod?.tipoPieza !== "COPIA") return { ok: false, error: "Ese producto no se prepara para imprimir." };
```
En `app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx`:
- Debajo de `const soloHoja = tipoPieza === "CARNET";` agregar `const soloCopia = tipoPieza === "COPIA";`.
- En el `onChange` del select `tipoPieza`, después de `if (e.target.value === "CARNET") setUnidad("HOJA");` agregar `if (e.target.value === "COPIA") setUnidad("COPIA");`.
- Reemplazar el select de unidad y su aviso por:
```tsx
          <select name="unidad" value={soloHoja ? "HOJA" : soloCopia ? "COPIA" : unidad} onChange={(e) => setUnidad(e.target.value)} className="fo-input mt-1">
            <option value="HOJA" disabled={soloCopia}>Hoja / plancha</option>
            <option value="COPIA" disabled={soloHoja}>Copia</option>
            <option value="PIEZA" disabled={soloHoja || soloCopia}>Pieza</option>
          </select>
          {soloHoja ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">La foto carnet se cobra por hoja.</span> : null}
          {soloCopia ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">Las copias se cobran por copia: la cantidad del ticket es el total de copias.</span> : null}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/configuracion.ts apps/fotoffice/lib/impresion/configuracion.test.ts apps/fotoffice/lib/impresion/preparaciones.ts apps/fotoffice/lib/impresion/preparaciones.test.ts "apps/fotoffice/app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx"
git commit -m "Impresión: las copias se cobran por copia y se preparan en el Mostrador"
```

---
### Task 7: Guardar las fotos de una preparación de copias y reabrirla

Antes de empezar, leer `lib/impresion/preparaciones.ts` entero (es el de la etapa 1, ya fusionado) y `lib/impresion/preparaciones.test.ts` (cómo se arma la base en memoria y R2 de mentira).

**Files:**
- Modify: `lib/impresion/preparaciones.ts` (exportar `borrarObjetos` y `enteroEntre`; agregar `disposicionDeCopia`, `hojasConRegistro`, `normalesPorHoja`, `hojasVigentes`, `estadoSegunHojas`, `recalcularEstado`)
- Create: `lib/impresion/lote.ts` (sólo las constantes en esta tarea; el resto en Task 12)
- Create: `lib/impresion/copias.ts`
- Modify: `lib/circuitos/base-en-memoria.ts` (valores por omisión de `fotofficePiezaImpresion`)
- Modify: `app/(shell)/ventas/impresion/actions.ts`
- Test: `lib/impresion/copias.test.ts`

**Interfaces:**
- Consumes: `preparacionPropia`, `esId`, `versionDeHoja`, `CtxImpresion`, `R` (preparaciones, etapa 1); `validarReceta` (Task 1); `papelOrientado`, `aspectoCoincide`, `propuestaAutomatica` (Task 2); `calidadDeCopia`, `AvisoCalidad` (Task 3); `huellaDe`.
- Produces (preparaciones.ts):
  - `type Db = Prisma.TransactionClient`.
  - `disposicionDeCopia(d: unknown): { piezaId: string; piezaHuella: string; acostada: boolean } | null`.
  - `hojasConRegistro(db: Db, workspaceId: string, ids: string[]): Promise<Set<string>>`.
  - `normalesPorHoja(db: Db, workspaceId: string, ids: string[]): Promise<Map<string, number>>` (suma de `hojas` de los registros NORMAL).
  - `type HojaVigente = { id: string; copias: number; version: string; salidaId: string; tamanoId: string; piezaId: string | null }`.
  - `hojasVigentes(db: Db, workspaceId: string, preparacionId: string): Promise<{ hojas: HojaVigente[]; faltan: number }>`.
  - `estadoSegunHojas(v: { hojas: { id: string; copias: number }[]; faltan: number }, impresas: ReadonlyMap<string, number>): "PREPARANDO" | "LISTA" | "IMPRESA"`.
  - `recalcularEstado(db: Db, workspaceId: string, preparacionId: string): Promise<void>`.
- Produces (lote.ts): `FOTOS_MAX = 60`, `CANTIDAD_MAX = 50`.
- Produces (copias.ts):
  - `type PiezaCopiaEntrada = { originalId: string; cantidad: number; receta: unknown; revisada: boolean }`.
  - `type FotoCopia = { originalId: string; nombre: string; ancho: number; alto: number; pieza: { receta: Receta; cantidad: number; revisada: boolean; ppp: number; aviso: AvisoCalidad } | null; hoja: { id: string; version: string; copias: number } | null }`.
  - `type EstadoCopias = { papel: { nombre: string; anchoMm: number; altoMm: number }; salida: string; fotos: FotoCopia[] }`.
  - `guardarPiezasCopia(ctx, preparacionId, items: PiezaCopiaEntrada[]): Promise<R<{ guardadas: number }>>`.
  - `estadoCopias(ctx, preparacionId): Promise<EstadoCopias | null>`.
  - `quitarFotoCopia(ctx, preparacionId, originalId): Promise<R>`.
  - Interno, lo usa Task 8: `preparacionDeCopias(ctx, preparacionId)`.
- Produces (acciones): `estadoCopiasAction(preparacionId)`, `guardarPiezasCopiaAction(preparacionId, items)`, `quitarFotoCopiaAction(preparacionId, originalId)`.

- [ ] **Step 1: Pruebas que fallan**

Crear `lib/impresion/copias.test.ts`:
```ts
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const R2 = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", async () => {
  const real = await vi.importActual<typeof import("./almacen")>("./almacen");
  return {
    ...real,
    urlDeSubidaOriginal: async (clave: string) => `https://r2.test/${clave}`,
    leerObjeto: async (k: string) => { const b = R2.get(k); if (!b) throw new Error("no está"); return b; },
    guardarObjeto: async (k: string, b: Buffer) => void R2.set(k, b),
    copiarObjeto: async (a: string, b: string) => void R2.set(b, R2.get(a)!),
    tamanoDeObjeto: async (k: string) => R2.get(k)?.length ?? null,
    borrarObjetoImpresion: async (k: string) => void R2.delete(k),
  };
});
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const C = await import("./configuracion");
const P = await import("./preparaciones");
const K = await import("./copias");
const { cambiarModo, propuestaAutomatica } = await import("./encuadre");
const { recetaInicial } = await import("./receta");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro" };
const P10 = { anchoMm: 102, altoMm: 152 };

async function jpg(ancho: number, alto: number) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
/** Preparación de copias 10x15 con las fotos ya subidas y confirmadas (sin piezas). */
async function prepConFotos(medidas: [number, number][], productId = "copia10") {
  const p = await P.crearPreparacion(CTX, { productId, clientId: null });
  if (!p.ok) throw new Error(p.error);
  const ids: string[] = [];
  for (const [ancho, alto] of medidas) {
    const foto = await jpg(ancho, alto);
    const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: `foto-${ids.length + 1}.jpg`, tipo: "image/jpeg", bytes: foto.length });
    if (!s.ok) throw new Error(s.error);
    R2.set(new URL(s.url).pathname.slice(1), foto);
    const c = await P.confirmarOriginal(CTX, s.originalId);
    if (!c.ok) throw new Error(c.error);
    ids.push(s.originalId);
  }
  return { prep: p.id, ids };
}
/** Guarda la propuesta automática de cada foto, con la cantidad pedida (1 si no se dice). */
async function guardarPropuestas(prep: string, ids: string[], medidas: [number, number][], cantidades: number[] = ids.map(() => 1)) {
  const r = await K.guardarPiezasCopia(
    CTX,
    prep,
    ids.map((originalId, i) => ({ originalId, cantidad: cantidades[i]!, receta: propuestaAutomatica(medidas[i]![0], medidas[i]![1], P10), revisada: false })),
  );
  if (!r.ok) throw new Error(r.error);
}
const estadoDe = (prep: string) => B.datos.fotofficePreparacionImpresion.find((p) => p.id === prep)!.estado;

beforeEach(async () => {
  R2.clear();
  B.vaciar();
  B.agregar("product", { id: "copia10", workspaceId: "ws-1", name: "Copia 10x15", priceArs: "900", isActive: true });
  B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
  await C.guardarProduccion("ws-1", "copia10", { tipoPieza: "COPIA", salidaId: kodak.id, tamanoHojaId: t10, unidad: "COPIA" });
  await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10, unidad: "HOJA" });
});

describe("copias: guardar y reabrir", () => {
  it("guarda la receta de cada foto y la devuelve para reabrir el editor", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1]);
    const e = await K.estadoCopias(CTX, prep);
    expect(e).toMatchObject({ papel: { nombre: "10x15", anchoMm: 102, altoMm: 152 }, salida: "Kodak 305" });
    expect(e!.fotos.map((f) => [f.originalId, f.nombre, f.ancho, f.alto])).toEqual([
      [ids[0], "foto-1.jpg", 600, 400],
      [ids[1], "foto-2.jpg", 400, 600],
    ]);
    expect(e!.fotos[0]!.pieza).toMatchObject({ receta: propuestaAutomatica(600, 400, P10), cantidad: 2, revisada: false, aviso: "PIXELADA" });
    expect(e!.fotos[0]!.hoja).toBeNull();
    expect(estadoDe(prep)).toBe("PREPARANDO");
    expect(await K.estadoCopias(OTRO, prep)).toBeNull();
  });

  it("rechaza cantidades fuera de rango, recetas inválidas o de otra proporción, y preparaciones que no son de copias", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const ok = { originalId: ids[0]!, cantidad: 1, receta: propuestaAutomatica(600, 400, P10), revisada: false };
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, cantidad: 0 }])).ok).toBe(false);
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, cantidad: 51 }])).ok).toBe(false);
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: { hola: 1 } }])).ok).toBe(false);
    // Sin orientación (una receta de carnet) no sirve para una copia.
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: recetaInicial() }])).ok).toBe(false);
    // La receta de una foto parada sobre esta foto acostada: saldría deformada.
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: propuestaAutomatica(400, 600, P10) }])).ok).toBe(false);
    expect((await K.guardarPiezasCopia(CTX, prep, [ok, ok])).ok).toBe(false);
    expect((await K.guardarPiezasCopia(OTRO, prep, [ok])).ok).toBe(false);
    const carnet = await prepConFotos([[600, 400]], "carnet");
    expect((await K.guardarPiezasCopia(CTX, carnet.prep, [{ ...ok, originalId: carnet.ids[0]! }])).ok).toBe(false);
    // Una foto de otra preparación.
    const otra = await prepConFotos([[600, 400]]);
    expect((await K.guardarPiezasCopia(CTX, prep, [{ ...ok, originalId: otra.ids[0]! }])).ok).toBe(false);
    expect((await K.guardarPiezasCopia(CTX, prep, [ok])).ok).toBe(true);
  });

  it("«Revisada» se marca al confirmar; un cambio de receta sin confirmar la borra, uno de cantidad no", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const receta = propuestaAutomatica(600, 400, P10);
    const revisada = async () => (await K.estadoCopias(CTX, prep))!.fotos[0]!.pieza!.revisada;
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta, revisada: true }]);
    expect(await revisada()).toBe(true);
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 3, receta, revisada: false }]);
    expect(await revisada()).toBe(true);
    const encajada = cambiarModo(receta, "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 3, receta: encajada, revisada: false }]);
    expect(await revisada()).toBe(false);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(1);
  });

  it("30 fotos en una preparación se guardan en una sola llamada; más de 60 no", async () => {
    const medidas = Array.from({ length: 30 }, () => [300, 200] as [number, number]);
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, ids.map(() => 2));
    const e = await K.estadoCopias(CTX, prep);
    expect(e!.fotos).toHaveLength(30);
    expect(e!.fotos.every((f) => f.pieza?.cantidad === 2)).toBe(true);
    const demasiadas = Array.from({ length: 61 }, (_, i) => ({ originalId: `x${i}`, cantidad: 1, receta: propuestaAutomatica(300, 200, P10), revisada: false }));
    expect(await K.guardarPiezasCopia(CTX, prep, demasiadas)).toEqual({ ok: false, error: "Una preparación admite hasta 60 fotos." });
  });

  it("quitar una foto borra su original, su vista previa y su pieza", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const antes = R2.size;
    expect(await K.quitarFotoCopia(CTX, prep, ids[0]!)).toEqual({ ok: true });
    expect(R2.size).toBe(antes - 2);
    expect((await K.estadoCopias(CTX, prep))!.fotos.map((f) => f.originalId)).toEqual([ids[1]]);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(1);
    expect((await K.quitarFotoCopia(OTRO, prep, ids[1]!)).ok).toBe(false);
  });
});

describe("estado según las hojas", () => {
  const sin = new Map<string, number>();
  it("sin hojas, o con alguna foto sin armar: PREPARANDO", () => {
    expect(P.estadoSegunHojas({ hojas: [], faltan: 0 }, sin)).toBe("PREPARANDO");
    expect(P.estadoSegunHojas({ hojas: [{ id: "a", copias: 1 }], faltan: 1 }, sin)).toBe("PREPARANDO");
  });
  it("todas armadas: LISTA hasta que cada una salió entera; después IMPRESA", () => {
    const v = { hojas: [{ id: "a", copias: 2 }, { id: "b", copias: 1 }], faltan: 0 };
    expect(P.estadoSegunHojas(v, sin)).toBe("LISTA");
    expect(P.estadoSegunHojas(v, new Map([["a", 1], ["b", 1]]))).toBe("LISTA");
    expect(P.estadoSegunHojas(v, new Map([["a", 2], ["b", 3]]))).toBe("IMPRESA");
  });
  it("lee la disposición de una hoja de copia y descarta la de carnet", () => {
    expect(P.disposicionDeCopia({ tipo: "COPIA", piezaId: "p1", piezaHuella: "h", acostada: true })).toEqual({ piezaId: "p1", piezaHuella: "h", acostada: true });
    expect(P.disposicionDeCopia({ pieza: { ancho: 1, alto: 1 }, posiciones: [] })).toBeNull();
    expect(P.disposicionDeCopia(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/copias.test.ts`
Expected: FAIL ("Failed to resolve import ./copias").

- [ ] **Step 3: Valores por omisión de la pieza en la base de pruebas**

En `lib/circuitos/base-en-memoria.ts`, en `DEFECTOS`, debajo de la línea de `fotofficeOriginalImpresion`, agregar:
```ts
  fotofficePiezaImpresion: () => ({ tamanoId: null, anchoMm: null, altoMm: null, cantidad: 1, revisadaAt: null, createdAt: new Date(), updatedAt: new Date() }),
```

- [ ] **Step 4: Ayudas de hojas y estado en `preparaciones.ts`**

En `lib/impresion/preparaciones.ts`:
- Cambiar `const enteroEntre = …` por `export const enteroEntre = …` (misma expresión).
- Cambiar `async function borrarObjetos(` por `export async function borrarObjetos(`.
- Debajo de `versionDeHoja`, agregar:
```ts
type Db = Prisma.TransactionClient;

/** La hoja de una copia guarda qué pieza lleva y con qué huella se armó (sin migración: va en `disposicion`). */
export function disposicionDeCopia(d: unknown): { piezaId: string; piezaHuella: string; acostada: boolean } | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (o.tipo !== "COPIA" || typeof o.piezaId !== "string" || typeof o.piezaHuella !== "string") return null;
  return { piezaId: o.piezaId, piezaHuella: o.piezaHuella, acostada: o.acostada === true };
}

/** Las hojas que ya tienen algún registro: salieron de la impresora y no se pisan ni se borran. */
export async function hojasConRegistro(db: Db, workspaceId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await db.fotofficeRegistroImpresion.findMany({ where: { workspaceId, hojaId: { in: ids } }, select: { hojaId: true } });
  return new Set(filas.map((r) => r.hojaId).filter((x): x is string => x !== null));
}

/** Cuántas hojas salieron bien (registros NORMAL) de cada hoja. */
export async function normalesPorHoja(db: Db, workspaceId: string, ids: string[]): Promise<Map<string, number>> {
  const suma = new Map<string, number>();
  if (ids.length === 0) return suma;
  const filas = await db.fotofficeRegistroImpresion.findMany({
    where: { workspaceId, hojaId: { in: ids }, motivo: "NORMAL" },
    select: { hojaId: true, hojas: true },
  });
  for (const r of filas) if (r.hojaId) suma.set(r.hojaId, (suma.get(r.hojaId) ?? 0) + r.hojas);
  return suma;
}

export type HojaVigente = { id: string; copias: number; version: string; salidaId: string; tamanoId: string; piezaId: string | null };

/**
 * Las hojas que valen hoy. En copias: por cada foto, la última hoja armada con la receta y la
 * cantidad actuales (`faltan` = fotos sin hoja vigente). En carnet: la última hoja armada.
 */
export async function hojasVigentes(db: Db, workspaceId: string, preparacionId: string): Promise<{ hojas: HojaVigente[]; faltan: number }> {
  const [piezas, hojas] = await Promise.all([
    db.fotofficePiezaImpresion.findMany({
      where: { workspaceId, preparacionId, tipo: "COPIA" },
      orderBy: { createdAt: "asc" },
      select: { id: true, huella: true, cantidad: true },
    }),
    db.fotofficeHojaImpresion.findMany({
      where: { workspaceId, preparacionId, finalKey: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, copias: true, finalHuella: true, disposicion: true, salidaId: true, tamanoId: true },
    }),
  ]);
  const vista = (h: (typeof hojas)[number], piezaId: string | null): HojaVigente => ({
    id: h.id, copias: h.copias, version: versionDeHoja(h.finalHuella), salidaId: h.salidaId, tamanoId: h.tamanoId, piezaId,
  });
  if (piezas.length === 0) {
    const ultima = hojas.at(-1);
    return { hojas: ultima ? [vista(ultima, null)] : [], faltan: 0 };
  }
  const out: HojaVigente[] = [];
  let faltan = 0;
  for (const p of piezas) {
    const h = [...hojas].reverse().find((x) => {
      const d = disposicionDeCopia(x.disposicion);
      return d?.piezaId === p.id && d.piezaHuella === p.huella;
    });
    if (h && h.copias === p.cantidad) out.push(vista(h, p.id));
    else faltan++;
  }
  return { hojas: out, faltan };
}

/** PREPARANDO si falta armar alguna hoja; IMPRESA si cada hoja vigente salió entera; si no, LISTA. */
export function estadoSegunHojas(
  v: { hojas: { id: string; copias: number }[]; faltan: number },
  impresas: ReadonlyMap<string, number>,
): "PREPARANDO" | "LISTA" | "IMPRESA" {
  if (v.faltan > 0 || v.hojas.length === 0) return "PREPARANDO";
  return v.hojas.every((h) => (impresas.get(h.id) ?? 0) >= h.copias) ? "IMPRESA" : "LISTA";
}

/** Copias: el estado de la preparación sale de sus hojas (una anulada no se toca). */
export async function recalcularEstado(db: Db, workspaceId: string, preparacionId: string): Promise<void> {
  const v = await hojasVigentes(db, workspaceId, preparacionId);
  const estado = estadoSegunHojas(v, await normalesPorHoja(db, workspaceId, v.hojas.map((h) => h.id)));
  await db.fotofficePreparacionImpresion.updateMany({
    where: { id: preparacionId, workspaceId, estado: { not: "ANULADA" } },
    data: { estado },
  });
}
```

- [ ] **Step 5: Constantes compartidas con el navegador**

Crear `lib/impresion/lote.ts` (Task 12 le agrega el resto):
```ts
/**
 * Módulo PURO de las copias en lote: lo usan el editor (navegador) y `copias.ts` (servidor).
 */

/** Fotos por preparación: más que esto no es una copia instantánea, es un trabajo de laboratorio. */
export const FOTOS_MAX = 60;
/** Copias de una misma foto. */
export const CANTIDAD_MAX = 50;
```

- [ ] **Step 6: `lib/impresion/copias.ts`**

Crear `lib/impresion/copias.ts`:
```ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { aspectoCoincide, papelOrientado } from "./encuadre";
import { calidadDeCopia, type AvisoCalidad } from "./geometria";
import { huellaDe } from "./huella";
import { CANTIDAD_MAX, FOTOS_MAX } from "./lote";
import {
  borrarObjetos,
  disposicionDeCopia,
  enteroEntre,
  esId,
  hojasConRegistro,
  hojasVigentes,
  preparacionPropia,
  recalcularEstado,
  type CtxImpresion,
  type R,
} from "./preparaciones";
import { validarReceta, type Receta } from "./receta";

/**
 * Copias instantáneas (etapa 2): cada foto de la preparación es una pieza COPIA con su receta y
 * su cantidad. El papel y la impresora los fija el producto. Las hojas se arman en `generarHojaCopia`.
 */

const NO_EXISTE = { ok: false as const, error: "Esa preparación no existe." };
const FOTO_NO_EXISTE = { ok: false as const, error: "Esa foto no existe." };
const RECORTE_INVALIDO = { ok: false as const, error: "El recorte de una foto no es válido. Volvé a armarla." };

export type PiezaCopiaEntrada = { originalId: string; cantidad: number; receta: unknown; revisada: boolean };

export type FotoCopia = {
  originalId: string;
  nombre: string;
  /** La foto ya derecha, en píxeles del original. */
  ancho: number;
  alto: number;
  pieza: { receta: Receta; cantidad: number; revisada: boolean; ppp: number; aviso: AvisoCalidad } | null;
  /** La hoja vigente (armada con la receta y la cantidad actuales), o null. */
  hoja: { id: string; version: string; copias: number } | null;
};

export type EstadoCopias = {
  papel: { nombre: string; anchoMm: number; altoMm: number };
  salida: string;
  fotos: FotoCopia[];
};

type PrepCopias = {
  id: string;
  papel: { tamanoId: string; nombre: string; anchoMm: number; altoMm: number };
  salida: { id: string; nombre: string; ppp: number; nitidez: string };
};

/** La preparación, si es de un producto de copias, con el papel y la impresora que fija el producto. */
export async function preparacionDeCopias(ctx: CtxImpresion, preparacionId: string): Promise<PrepCopias | null> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA" || !prep.productId) return null;
  const prod = await prisma.fotofficeProductoProduccion.findFirst({
    where: { workspaceId: ctx.workspaceId, productId: prep.productId },
    select: { tipoPieza: true, salidaId: true, tamanoHojaId: true },
  });
  if (prod?.tipoPieza !== "COPIA") return null;
  const [tamano, salida] = await Promise.all([
    prisma.fotofficeTamanoImpresion.findFirst({ where: { id: prod.tamanoHojaId, workspaceId: ctx.workspaceId }, select: { id: true, nombre: true, anchoMm: true, altoMm: true } }),
    prisma.fotofficeSalidaImpresion.findFirst({ where: { id: prod.salidaId, workspaceId: ctx.workspaceId, activo: true }, select: { id: true, nombre: true, ppp: true, nitidez: true } }),
  ]);
  if (!tamano || !salida) return null;
  return {
    id: prep.id,
    papel: { tamanoId: tamano.id, nombre: tamano.nombre, anchoMm: Number(tamano.anchoMm), altoMm: Number(tamano.altoMm) },
    salida,
  };
}

/**
 * Guarda (crea o actualiza) la pieza de cada foto. Una sola llamada para una foto o para todas
 * (acciones en lote). «Revisada»: `revisada: true` la marca; un guardado sin marcar la borra si
 * cambió la receta y la deja si sólo cambió la cantidad.
 */
export async function guardarPiezasCopia(ctx: CtxImpresion, preparacionId: string, items: PiezaCopiaEntrada[]): Promise<R<{ guardadas: number }>> {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "No hay fotos para guardar." };
  if (items.length > FOTOS_MAX) return { ok: false, error: `Una preparación admite hasta ${FOTOS_MAX} fotos.` };
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  const ids = items.map((i) => i.originalId);
  if (!ids.every(esId) || new Set(ids).size !== ids.length) return FOTO_NO_EXISTE;
  const originales = await prisma.fotofficeOriginalImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", id: { in: ids } },
    select: { id: true, key: true, anchoPx: true, altoPx: true },
  });
  if (originales.length !== ids.length) return FOTO_NO_EXISTE;

  const filas: { originalId: string; receta: Receta; cantidad: number; revisada: boolean; huella: string }[] = [];
  for (const it of items) {
    if (!enteroEntre(it.cantidad, 1, CANTIDAD_MAX)) return { ok: false, error: `Las copias de cada foto tienen que ser entre 1 y ${CANTIDAD_MAX}.` };
    const receta = validarReceta(it.receta);
    const o = originales.find((x) => x.id === it.originalId)!;
    if (!receta || !receta.orientacion || !aspectoCoincide({ ancho: o.anchoPx, alto: o.altoPx }, receta, prep.papel)) return RECORTE_INVALIDO;
    filas.push({
      originalId: o.id,
      receta,
      cantidad: it.cantidad,
      revisada: it.revisada === true,
      huella: huellaDe({ receta, originalKey: o.key, tamanoId: prep.papel.tamanoId }),
    });
  }

  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    const existentes = await tx.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId: { in: ids } },
      select: { id: true, originalId: true, huella: true, revisadaAt: true },
    });
    for (const f of filas) {
      const e = existentes.find((x) => x.originalId === f.originalId);
      const revisadaAt = f.revisada ? (e?.revisadaAt ?? ahora) : e && e.huella === f.huella ? e.revisadaAt : null;
      const data = {
        tamanoId: prep.papel.tamanoId,
        receta: f.receta as unknown as Prisma.InputJsonValue,
        huella: f.huella,
        cantidad: f.cantidad,
        revisadaAt,
      };
      if (e) await tx.fotofficePiezaImpresion.update({ where: { id: e.id }, data });
      else await tx.fotofficePiezaImpresion.create({ data: { workspaceId: ctx.workspaceId, preparacionId: prep.id, originalId: f.originalId, tipo: "COPIA", ...data } });
    }
  });
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true, guardadas: filas.length };
}

/** Lo ya armado, para abrir o reabrir el editor de copias ("Editar fotos" del Mostrador). null si no es de copias. */
export async function estadoCopias(ctx: CtxImpresion, preparacionId: string): Promise<EstadoCopias | null> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return null;
  const [originales, piezas, vigentes] = await Promise.all([
    prisma.fotofficeOriginalImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, nombre: true, anchoPx: true, altoPx: true },
    }),
    prisma.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA" },
      select: { id: true, originalId: true, receta: true, cantidad: true, revisadaAt: true },
    }),
    hojasVigentes(prisma, ctx.workspaceId, prep.id),
  ]);
  const hojaDe = new Map(vigentes.hojas.filter((h) => h.piezaId !== null).map((h) => [h.piezaId!, h]));
  const fotos = originales.map((o): FotoCopia => {
    const foto = { ancho: o.anchoPx, alto: o.altoPx };
    const p = piezas.find((x) => x.originalId === o.id);
    const receta = p ? validarReceta(p.receta) : null;
    const pieza =
      p && receta?.orientacion
        ? { receta, cantidad: p.cantidad, revisada: p.revisadaAt !== null, ...calidadDeCopia(foto, receta, papelOrientado(prep.papel, receta.orientacion)) }
        : null;
    const h = p ? hojaDe.get(p.id) : undefined;
    return { originalId: o.id, nombre: o.nombre, ...foto, pieza, hoja: pieza && h ? { id: h.id, version: h.version, copias: h.copias } : null };
  });
  return { papel: { nombre: prep.papel.nombre, anchoMm: prep.papel.anchoMm, altoMm: prep.papel.altoMm }, salida: prep.salida.nombre, fotos };
}

/**
 * Saca una foto de la preparación: su pieza, su original, su vista previa y las hojas que no se
 * imprimieron. Las ya impresas quedan (sus registros las nombran) hasta la purga.
 */
export async function quitarFotoCopia(ctx: CtxImpresion, preparacionId: string, originalId: string): Promise<R> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id },
    select: { id: true, key: true, previewKey: true, archivoTrabajoId: true },
  });
  if (!o) return FOTO_NO_EXISTE;
  const piezas = new Set(
    (await prisma.fotofficePiezaImpresion.findMany({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, originalId: o.id }, select: { id: true } })).map((p) => p.id),
  );
  const hojas = (
    await prisma.fotofficeHojaImpresion.findMany({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id }, select: { id: true, finalKey: true, disposicion: true } })
  ).filter((h) => {
    const d = disposicionDeCopia(h.disposicion);
    return d !== null && piezas.has(d.piezaId);
  });
  const impresas = await hojasConRegistro(prisma, ctx.workspaceId, hojas.map((h) => h.id));
  const libres = hojas.filter((h) => !impresas.has(h.id));
  await prisma.$transaction(async (tx) => {
    if (libres.length > 0) await tx.fotofficeHojaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { in: libres.map((h) => h.id) } } });
    await tx.fotofficePiezaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, originalId: o.id } });
    await tx.fotofficeOriginalImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: o.id } });
  });
  // El original que vino de la carpeta de un trabajo no es nuestro: no se borra.
  await borrarObjetos([...libres.map((h) => h.finalKey), o.archivoTrabajoId ? null : o.key, o.previewKey]);
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true };
}
```

- [ ] **Step 7: Acciones de servidor**

En `app/(shell)/ventas/impresion/actions.ts`, sumar el import:
```ts
import { estadoCopias, guardarPiezasCopia, quitarFotoCopia, type PiezaCopiaEntrada } from "@/lib/impresion/copias";
```
y al final del archivo:
```ts
/** Copias: lo ya armado, para abrir o reabrir el editor. */
export async function estadoCopiasAction(preparacionId: string) {
  const ctx = await ctxImpresion();
  return estadoCopias(ctx, preparacionId);
}

export async function guardarPiezasCopiaAction(preparacionId: string, items: PiezaCopiaEntrada[]) {
  const ctx = await ctxImpresion();
  const r = await guardarPiezasCopia(ctx, preparacionId, items);
  revalidatePath("/ventas/impresiones");
  return r;
}

export async function quitarFotoCopiaAction(preparacionId: string, originalId: string) {
  const ctx = await ctxImpresion();
  const r = await quitarFotoCopia(ctx, preparacionId, originalId);
  revalidatePath("/ventas/impresiones");
  return r;
}
```

- [ ] **Step 8: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS (las de `copias.test.ts` y todas las de la etapa 1).

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/impresion/preparaciones.ts apps/fotoffice/lib/impresion/lote.ts apps/fotoffice/lib/impresion/copias.ts apps/fotoffice/lib/impresion/copias.test.ts apps/fotoffice/lib/circuitos/base-en-memoria.ts "apps/fotoffice/app/(shell)/ventas/impresion/actions.ts"
git commit -m "Impresión: guardar, reabrir y quitar las fotos de una preparación de copias"
```

---
### Task 8: Armar la hoja de una foto (una llamada por foto)

**Files:**
- Modify: `lib/impresion/copias.ts` (agregar `generarHojaCopia`)
- Modify: `app/(shell)/ventas/impresion/actions.ts`
- Test: `lib/impresion/copias.test.ts`

**Interfaces:**
- Consumes: `preparacionDeCopias` (Task 7); `hojasConRegistro`, `recalcularEstado`, `disposicionDeCopia`, `borrarObjetos`, `nuevoId`, `versionDeHoja` (preparaciones); `renderizarPieza`, `componerCopia` (Task 4); `pixelesDeHoja`, `Nitidez` (medidas); `claveImpresion`, `guardarObjeto`, `leerObjeto` (almacen); `papelOrientado` (Task 2).
- Produces:
  - `generarHojaCopia(ctx: CtxImpresion, preparacionId: string, originalId: string): Promise<R<{ hojaId: string; version: string; copias: number }>>`.
  - `generarHojaCopiaAction(preparacionId: string, originalId: string)`.
  - Hoja de copia en la base: `disposicion = { tipo: "COPIA", piezaId, piezaHuella, acostada }`, `copias = cantidad` de la foto, `finalAnchoPx`/`finalAltoPx` = papel parado (10x15 a 300 ppp = 1205 × 1795).

- [ ] **Step 1: Pruebas que fallan**

Al final de `lib/impresion/copias.test.ts` agregar:
```ts
describe("copias: la hoja de cada foto", () => {
  it("arma una hoja por foto, del tamaño exacto y parada aunque la foto vaya acostada", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    const b = await K.generarHojaCopia(CTX, prep, ids[1]!);
    if (!a.ok || !b.ok) throw new Error("no armó");
    expect([a.copias, b.copias]).toEqual([2, 1]);
    for (const h of [a, b]) {
      const d = (await P.datosParaImprimir("ws-1", h.hojaId))!;
      expect(d).toMatchObject({ anchoMm: 102, altoMm: 152, salida: "Kodak 305", tamano: "10x15" });
      const meta = await sharp(R2.get(d.finalKey)!).metadata();
      expect([meta.width, meta.height, meta.density]).toEqual([1205, 1795, 300]);
    }
    const hoja = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!;
    expect(P.disposicionDeCopia(hoja.disposicion)).toMatchObject({ acostada: true });
  });

  it("PREPARANDO hasta que todas las fotos tienen hoja; después LISTA", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    await K.generarHojaCopia(CTX, prep, ids[0]!);
    expect(estadoDe(prep)).toBe("PREPARANDO");
    await K.generarHojaCopia(CTX, prep, ids[1]!);
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await K.estadoCopias(CTX, prep))!.fotos.every((f) => f.hoja !== null)).toBe(true);
  });

  it("sin cambios no vuelve a armar el archivo; si cambia la cantidad, sólo cambian las copias", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    await guardarPropuestas(prep, ids, [[600, 400]]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!a.ok) throw new Error(a.error);
    const clave = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!.finalKey;
    await guardarPropuestas(prep, ids, [[600, 400]], [4]);
    expect((await K.estadoCopias(CTX, prep))!.fotos[0]!.hoja).toBeNull();
    expect(estadoDe(prep)).toBe("PREPARANDO");
    const b = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!b.ok) throw new Error(b.error);
    expect(b).toMatchObject({ hojaId: a.hojaId, version: a.version, copias: 4 });
    expect(B.datos.fotofficeHojaImpresion.find((h) => h.id === b.hojaId)!.finalKey).toBe(clave);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(1);
  });

  it("cambiar la receta rehace la misma hoja (sin imprimir) y borra el archivo viejo", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const receta = propuestaAutomatica(600, 400, P10);
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta, revisada: false }]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!a.ok) throw new Error(a.error);
    const vieja = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!.finalKey as string;
    const encajada = cambiarModo(receta, "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta: encajada, revisada: false }]);
    const b = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!b.ok) throw new Error(b.error);
    expect(b.hojaId).toBe(a.hojaId);
    expect(b.version).not.toBe(a.version);
    expect(R2.has(vieja)).toBe(false);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(1);
  });

  it("sin pieza, de otra preparación o de otro negocio: no arma nada", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    expect(await K.generarHojaCopia(CTX, prep, ids[0]!)).toEqual({ ok: false, error: "Primero armá la foto." });
    await guardarPropuestas(prep, ids, [[600, 400]]);
    expect((await K.generarHojaCopia(OTRO, prep, ids[0]!)).ok).toBe(false);
    const otra = await prepConFotos([[600, 400]]);
    expect((await K.generarHojaCopia(CTX, otra.prep, ids[0]!)).ok).toBe(false);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/copias.test.ts`
Expected: FAIL (`K.generarHojaCopia is not a function`).

- [ ] **Step 3: Implementar**

En `lib/impresion/copias.ts`, sumar a los imports:
```ts
import { claveImpresion, guardarObjeto, leerObjeto } from "./almacen";
import { pixelesDeHoja, type Nitidez } from "./medidas";
import { componerCopia, renderizarPieza } from "./render";
```
y sumar `nuevoId` y `versionDeHoja` al import de `./preparaciones`. Al final del archivo agregar:
```ts
/**
 * La hoja de UNA foto: la copia a papel entero, a los píxeles exactos de la salida (300 ppp), y
 * la hoja siempre parada (una copia acostada se gira al componer). Una llamada por foto: el
 * editor las pide de a una, así ningún pedido tarda demasiado.
 * Sin cambios en la receta, no se vuelve a armar: sólo se actualizan las copias. Una hoja ya
 * impresa no se pisa (sus registros dicen qué salió): se arma otra. La que no salió se rehace.
 */
export async function generarHojaCopia(
  ctx: CtxImpresion,
  preparacionId: string,
  originalId: string,
): Promise<R<{ hojaId: string; version: string; copias: number }>> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const pieza = await prisma.fotofficePiezaImpresion.findFirst({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId },
    select: { id: true, receta: true, huella: true, cantidad: true },
  });
  const receta = pieza ? validarReceta(pieza.receta) : null;
  if (!pieza || !receta?.orientacion) return { ok: false, error: "Primero armá la foto." };
  const original = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
    select: { key: true },
  });
  if (!original) return FOTO_NO_EXISTE;

  const papelPieza = papelOrientado(prep.papel, receta.orientacion);
  const destino = pixelesDeHoja(papelPieza, prep.salida.ppp);
  const hojaPx = pixelesDeHoja(prep.papel, prep.salida.ppp);
  const acostada = (papelPieza.anchoMm > papelPieza.altoMm) !== (prep.papel.anchoMm > prep.papel.altoMm);
  const finalHuella = huellaDe({ pieza: pieza.huella, salidaId: prep.salida.id, tamanoId: prep.papel.tamanoId, ppp: prep.salida.ppp, nitidez: prep.salida.nitidez });

  const hojas = (
    await prisma.fotofficeHojaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, finalKey: true, finalHuella: true, disposicion: true },
    })
  ).filter((h) => disposicionDeCopia(h.disposicion)?.piezaId === pieza.id);

  // Sin cambios: el archivo ya está; sólo cambian cuántas hojas se imprimen.
  const igual = [...hojas].reverse().find((h) => h.finalHuella === finalHuella && h.finalKey);
  if (igual) {
    await prisma.fotofficeHojaImpresion.update({ where: { id: igual.id }, data: { copias: pieza.cantidad } });
    await recalcularEstado(prisma, ctx.workspaceId, prep.id);
    return { ok: true, hojaId: igual.id, version: versionDeHoja(finalHuella), copias: pieza.cantidad };
  }

  const piezaRaw = await renderizarPieza(await leerObjeto(original.key), receta, destino, prep.salida.nitidez as Nitidez);
  const jpg = await componerCopia(piezaRaw, acostada, prep.salida.ppp);

  const impresas = await hojasConRegistro(prisma, ctx.workspaceId, hojas.map((h) => h.id));
  const libres = hojas.filter((h) => !impresas.has(h.id));
  const existente = libres.at(-1) ?? null;
  const hojaId = existente?.id ?? nuevoId();
  const finalKey = claveImpresion(ctx.workspaceId, prep.id, "final", `${hojaId}-${finalHuella.slice(0, 12)}`, "jpg");
  await guardarObjeto(finalKey, jpg, "image/jpeg");

  const datos = {
    salidaId: prep.salida.id,
    tamanoId: prep.papel.tamanoId,
    disposicion: { tipo: "COPIA", piezaId: pieza.id, piezaHuella: pieza.huella, acostada } as Prisma.InputJsonValue,
    finalKey,
    finalHuella,
    finalAnchoPx: hojaPx.ancho,
    finalAltoPx: hojaPx.alto,
    copias: pieza.cantidad,
  };
  if (existente) await prisma.fotofficeHojaImpresion.update({ where: { id: existente.id }, data: datos });
  else await prisma.fotofficeHojaImpresion.create({ data: { id: hojaId, workspaceId: ctx.workspaceId, preparacionId: prep.id, ...datos } });

  // Otras hojas sin imprimir de esta foto (de recetas viejas): ya no sirven.
  const sobrantes = libres.filter((h) => h.id !== hojaId);
  if (sobrantes.length > 0) await prisma.fotofficeHojaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { in: sobrantes.map((h) => h.id) } } });
  await borrarObjetos([...sobrantes.map((h) => h.finalKey), existente?.finalKey && existente.finalKey !== finalKey ? existente.finalKey : null]);
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true, hojaId, version: versionDeHoja(finalHuella), copias: pieza.cantidad };
}
```
En `app/(shell)/ventas/impresion/actions.ts`, sumar `generarHojaCopia` al import de `@/lib/impresion/copias` y agregar:
```ts
/** Arma la hoja de UNA foto. El editor la llama de a una foto por vez. */
export async function generarHojaCopiaAction(preparacionId: string, originalId: string) {
  const ctx = await ctxImpresion();
  const r = await generarHojaCopia(ctx, preparacionId, originalId);
  revalidatePath("/ventas/impresiones");
  return r;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/copias.ts apps/fotoffice/lib/impresion/copias.test.ts "apps/fotoffice/app/(shell)/ventas/impresion/actions.ts"
git commit -m "Impresión: armar la hoja de cada copia, de a una foto por llamada"
```

---
### Task 9: Imprimir toda la preparación y registrar cada hoja

**Files:**
- Create: `lib/impresion/impresion-multiple.ts`
- Test: `lib/impresion/impresion-multiple.test.ts`
- Modify: `lib/impresion/preparaciones.ts` (`registrarImpresion` pasa a usar `registrarImpresiones`; agregar `registrarImpresiones` y `datosParaImprimirPreparacion`)
- Modify: `app/(shell)/ventas/impresion/actions.ts`
- Test: `lib/impresion/copias.test.ts`

**Interfaces:**
- Consumes: `hojasVigentes`, `normalesPorHoja`, `estadoSegunHojas` (Task 7); `generarHojaCopia` (Task 8).
- Produces (impresion-multiple.ts, PURO):
  - `type HojaAImprimir = { hojaId: string; version: string; copias: number }`.
  - `type RegistroDeHoja = { hojaId: string; motivo: "NORMAL" | "DESCARTADA"; hojas: number }`.
  - `paginas(hojas: HojaAImprimir[]): { hojaId: string; version: string; copia: number }[]` (cada hoja repetida `copias` veces, en orden).
  - `pendientes(hojas: HojaAImprimir[], impresas: ReadonlyMap<string, number>): HojaAImprimir[]`.
  - `registrosDeRespuesta(hojas: HojaAImprimir[], malas: Readonly<Record<string, number>>): { registros: RegistroDeHoja[]; reimprimir: HojaAImprimir[] }`.
- Produces (preparaciones.ts):
  - `registrarImpresiones(ctx: CtxImpresion, preparacionId: string, items: RegistroDeHoja[]): Promise<R>` (todas las hojas tienen que ser de esa preparación; una transacción; IMPRESA según `estadoSegunHojas`).
  - `registrarImpresion(ctx, hojaId, d)` — misma firma y mismos errores que en la etapa 1.
  - `type DatosPreparacionParaImprimir = { hojas: HojaAImprimir[]; faltan: number; papel: { anchoMm: number; altoMm: number; escalaXMil: number; escalaYMil: number; salida: string; tamano: string } | null }`.
  - `datosParaImprimirPreparacion(workspaceId: string, preparacionId: string, soloPendientes: boolean): Promise<DatosPreparacionParaImprimir | null>`.
- Produces (acciones): `registrarImpresionesAction(preparacionId: string, items: RegistroDeHoja[])`.

- [ ] **Step 1: Pruebas puras que fallan**

Crear `lib/impresion/impresion-multiple.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { paginas, pendientes, registrosDeRespuesta } from "./impresion-multiple";

const H = [
  { hojaId: "a", version: "v1", copias: 2 },
  { hojaId: "b", version: "v2", copias: 1 },
];

describe("imprimir varias hojas", () => {
  it("cada hoja se repite tantas veces como copias, en orden", () => {
    expect(paginas(H)).toEqual([
      { hojaId: "a", version: "v1", copia: 1 },
      { hojaId: "a", version: "v1", copia: 2 },
      { hojaId: "b", version: "v2", copia: 1 },
    ]);
  });

  it("pendientes: descuenta lo que ya salió bien y saca lo que salió entero", () => {
    expect(pendientes(H, new Map([["a", 1]]))).toEqual([{ hojaId: "a", version: "v1", copias: 1 }, H[1]]);
    expect(pendientes(H, new Map([["a", 2], ["b", 5]]))).toEqual([]);
  });

  it("todas bien: un registro NORMAL por hoja, nada que reimprimir", () => {
    expect(registrosDeRespuesta(H, {})).toEqual({
      registros: [{ hojaId: "a", motivo: "NORMAL", hojas: 2 }, { hojaId: "b", motivo: "NORMAL", hojas: 1 }],
      reimprimir: [],
    });
  });

  it("una copia mal: esa va DESCARTADA y se reimprime sólo esa", () => {
    expect(registrosDeRespuesta(H, { a: 1 })).toEqual({
      registros: [
        { hojaId: "a", motivo: "NORMAL", hojas: 1 },
        { hojaId: "a", motivo: "DESCARTADA", hojas: 1 },
        { hojaId: "b", motivo: "NORMAL", hojas: 1 },
      ],
      reimprimir: [{ hojaId: "a", version: "v1", copias: 1 }],
    });
  });

  it("las malas se acotan a las copias de la hoja", () => {
    expect(registrosDeRespuesta(H, { a: 9, b: -3 }).registros).toEqual([
      { hojaId: "a", motivo: "DESCARTADA", hojas: 2 },
      { hojaId: "b", motivo: "NORMAL", hojas: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/impresion-multiple.test.ts`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 3: Implementar el módulo puro**

Crear `lib/impresion/impresion-multiple.ts`:
```ts
/**
 * Módulo PURO: imprimir varias hojas en un documento (una página por copia) y convertir la
 * respuesta de "¿Cómo salió?" en registros. Lo usan la página de impresión y el servidor.
 */

export type HojaAImprimir = { hojaId: string; version: string; copias: number };
export type RegistroDeHoja = { hojaId: string; motivo: "NORMAL" | "DESCARTADA"; hojas: number };

export function paginas(hojas: HojaAImprimir[]): { hojaId: string; version: string; copia: number }[] {
  return hojas.flatMap((h) => Array.from({ length: h.copias }, (_, i) => ({ hojaId: h.hojaId, version: h.version, copia: i + 1 })));
}

/** Lo que falta imprimir: a cada hoja se le descuentan las que ya salieron bien. */
export function pendientes(hojas: HojaAImprimir[], impresas: ReadonlyMap<string, number>): HojaAImprimir[] {
  return hojas.map((h) => ({ ...h, copias: h.copias - (impresas.get(h.hojaId) ?? 0) })).filter((h) => h.copias > 0);
}

/**
 * `malas`: por hoja, cuántas copias salieron mal (falta = 0). Las buenas van NORMAL; las malas,
 * DESCARTADA (el desperdicio también cuenta en el gasto) y se vuelven a imprimir.
 */
export function registrosDeRespuesta(
  hojas: HojaAImprimir[],
  malas: Readonly<Record<string, number>>,
): { registros: RegistroDeHoja[]; reimprimir: HojaAImprimir[] } {
  const registros: RegistroDeHoja[] = [];
  const reimprimir: HojaAImprimir[] = [];
  for (const h of hojas) {
    const m = Math.min(h.copias, Math.max(0, Math.round(malas[h.hojaId] ?? 0)));
    if (h.copias - m > 0) registros.push({ hojaId: h.hojaId, motivo: "NORMAL", hojas: h.copias - m });
    if (m > 0) {
      registros.push({ hojaId: h.hojaId, motivo: "DESCARTADA", hojas: m });
      reimprimir.push({ ...h, copias: m });
    }
  }
  return { registros, reimprimir };
}
```

- [ ] **Step 4: Pruebas de base que fallan**

Al final de `lib/impresion/copias.test.ts` agregar (sumar al principio del archivo `const M = await import("./impresion-multiple");` debajo de `const K = …`):
```ts
describe("copias: imprimir todo y registrar", () => {
  async function armadas(medidas: [number, number][], cantidades: number[]) {
    const r = await prepConFotos(medidas);
    await guardarPropuestas(r.prep, r.ids, medidas, cantidades);
    for (const id of r.ids) {
      const h = await K.generarHojaCopia(CTX, r.prep, id);
      if (!h.ok) throw new Error(h.error);
    }
    return r;
  }

  it("imprimir todo: cada foto su hoja con sus copias; avisa las que faltan armar", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600], [500, 500]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1, 3]);
    await K.generarHojaCopia(CTX, prep, ids[0]!);
    await K.generarHojaCopia(CTX, prep, ids[1]!);
    let d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    expect(d.faltan).toBe(1);
    expect(d.hojas.map((h) => h.copias)).toEqual([2, 1]);
    expect(d.papel).toEqual({ anchoMm: 102, altoMm: 152, escalaXMil: 1000, escalaYMil: 1000, salida: "Kodak 305", tamano: "10x15" });
    await K.generarHojaCopia(CTX, prep, ids[2]!);
    d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    expect(d.faltan).toBe(0);
    expect(M.paginas(d.hojas)).toHaveLength(6);
    expect(await P.datosParaImprimirPreparacion("ws-2", prep, false)).toBeNull();
  });

  it("registrar varias: con una copia mal queda LISTA y sólo esa falta; al reimprimirla, IMPRESA", async () => {
    const { prep } = await armadas([[600, 400], [400, 600]], [2, 1]);
    const d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    const primera = d.hojas[0]!.hojaId;
    const x = M.registrosDeRespuesta(d.hojas, { [primera]: 1 });
    expect(await P.registrarImpresiones(CTX, prep, x.registros)).toEqual({ ok: true });
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas).toEqual([{ hojaId: primera, version: d.hojas[0]!.version, copias: 1 }]);
    expect(await P.registrarImpresiones(CTX, prep, [{ hojaId: primera, motivo: "NORMAL", hojas: 1 }])).toEqual({ ok: true });
    expect(estadoDe(prep)).toBe("IMPRESA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas).toEqual([]);
    expect(B.datos.fotofficeRegistroImpresion.map((r) => r.motivo).sort()).toEqual(["DESCARTADA", "NORMAL", "NORMAL", "NORMAL"]);
    expect(B.datos.fotofficeRegistroImpresion.every((r) => r.productId === "copia10")).toBe(true);
  });

  it("editar una foto después de imprimir: arma otra hoja, no pisa la impresa y sólo esa queda pendiente", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await armadas(medidas, [1, 1]);
    const d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    await P.registrarImpresiones(CTX, prep, M.registrosDeRespuesta(d.hojas, {}).registros);
    expect(estadoDe(prep)).toBe("IMPRESA");
    const impresa = B.datos.fotofficeHojaImpresion.find((h) => h.id === d.hojas[0]!.hojaId)!;
    const claveImpresa = impresa.finalKey as string;

    const encajada = cambiarModo(propuestaAutomatica(600, 400, P10), "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta: encajada, revisada: true }]);
    expect(estadoDe(prep)).toBe("PREPARANDO");
    const nueva = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!nueva.ok) throw new Error(nueva.error);

    expect(nueva.hojaId).not.toBe(impresa.id);
    expect(B.datos.fotofficeHojaImpresion.find((h) => h.id === impresa.id)).toMatchObject({ finalKey: claveImpresa });
    expect(R2.has(claveImpresa)).toBe(true);
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas.map((h) => h.hojaId)).toEqual([nueva.hojaId]);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(2);
  });

  it("no registra hojas de otra preparación ni de otro negocio, ni respuestas raras", async () => {
    const a = await armadas([[600, 400]], [1]);
    const b = await armadas([[600, 400]], [1]);
    const hojaA = (await P.datosParaImprimirPreparacion("ws-1", a.prep, false))!.hojas[0]!.hojaId;
    expect((await P.registrarImpresiones(OTRO, a.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, b.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [{ hojaId: hojaA, motivo: "PRUEBA" as "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 0 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [])).ok).toBe(false);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/copias.test.ts`
Expected: FAIL (`P.datosParaImprimirPreparacion is not a function`).

- [ ] **Step 6: Implementar en `preparaciones.ts`**

Sumar el import:
```ts
import { pendientes, type HojaAImprimir, type RegistroDeHoja } from "./impresion-multiple";
```
Reemplazar la función `registrarImpresion` entera por estas dos:
```ts
export async function registrarImpresion(ctx: CtxImpresion, hojaId: string, d: { motivo: "NORMAL" | "DESCARTADA"; hojas: number }): Promise<R> {
  if (d.motivo !== "NORMAL" && d.motivo !== "DESCARTADA") return { ok: false, error: "Elegí cómo salió." };
  if (!enteroEntre(d.hojas, 1, HOJAS_MAX)) return { ok: false, error: `Las hojas tienen que ser entre 1 y ${HOJAS_MAX}.` };
  if (!esId(hojaId)) return HOJA_NO_EXISTE;
  const hoja = await prisma.fotofficeHojaImpresion.findFirst({
    where: { id: hojaId, workspaceId: ctx.workspaceId },
    select: { preparacionId: true, finalKey: true },
  });
  if (!hoja?.finalKey) return HOJA_NO_EXISTE;
  return registrarImpresiones(ctx, hoja.preparacionId, [{ hojaId, motivo: d.motivo, hojas: d.hojas }]);
}

const REGISTROS_MAX = 200;

/**
 * Lo que salió de la impresora, de una o varias hojas de UNA preparación, en una transacción.
 * La preparación queda IMPRESA cuando cada hoja vigente salió entera (copias: una por foto;
 * carnet: la última armada). Reimprimir una hoja vieja no esconde una más nueva sin imprimir.
 */
export async function registrarImpresiones(ctx: CtxImpresion, preparacionId: string, items: RegistroDeHoja[]): Promise<R> {
  if (!Array.isArray(items) || items.length === 0 || items.length > REGISTROS_MAX) return { ok: false, error: "No hay hojas para registrar." };
  for (const it of items) {
    if (it.motivo !== "NORMAL" && it.motivo !== "DESCARTADA") return { ok: false, error: "Elegí cómo salió." };
    if (!enteroEntre(it.hojas, 1, HOJAS_MAX)) return { ok: false, error: `Las hojas tienen que ser entre 1 y ${HOJAS_MAX}.` };
    if (!esId(it.hojaId)) return HOJA_NO_EXISTE;
  }
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return NO_EXISTE;
  const ids = [...new Set(items.map((i) => i.hojaId))];
  const hojas = await prisma.fotofficeHojaImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, id: { in: ids }, finalKey: { not: null } },
    select: { id: true, salidaId: true, tamanoId: true },
  });
  if (hojas.length !== ids.length) return HOJA_NO_EXISTE;
  await prisma.$transaction(async (tx) => {
    for (const it of items) {
      const hoja = hojas.find((h) => h.id === it.hojaId)!;
      await tx.fotofficeRegistroImpresion.create({
        data: {
          workspaceId: ctx.workspaceId,
          hojaId: hoja.id,
          salidaId: hoja.salidaId,
          tamanoId: hoja.tamanoId,
          hojas: it.hojas,
          productId: prep.productId,
          saleItemId: prep.saleItemId,
          proyectoId: prep.proyectoId,
          motivo: it.motivo,
          userId: ctx.userId,
        },
      });
    }
    if (!items.some((i) => i.motivo === "NORMAL")) return;
    const v = await hojasVigentes(tx, ctx.workspaceId, prep.id);
    if (estadoSegunHojas(v, await normalesPorHoja(tx, ctx.workspaceId, v.hojas.map((h) => h.id))) !== "IMPRESA") return;
    await tx.fotofficePreparacionImpresion.updateMany({
      where: { id: prep.id, workspaceId: ctx.workspaceId, estado: { not: "ANULADA" } },
      data: { estado: "IMPRESA" },
    });
  });
  return { ok: true };
}
```
Debajo de `datosParaImprimir`, agregar:
```ts
export type DatosPreparacionParaImprimir = {
  hojas: HojaAImprimir[];
  /** Fotos sin hoja vigente: no entran en este documento (hay que armarlas). */
  faltan: number;
  papel: { anchoMm: number; altoMm: number; escalaXMil: number; escalaYMil: number; salida: string; tamano: string } | null;
};

/**
 * Todas las hojas vigentes de una preparación, para imprimirlas en un solo documento.
 * `soloPendientes`: sólo lo que todavía no salió entero (después de editar una foto ya impresa).
 */
export async function datosParaImprimirPreparacion(
  workspaceId: string,
  preparacionId: string,
  soloPendientes: boolean,
): Promise<DatosPreparacionParaImprimir | null> {
  const prep = await preparacionPropia(workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return null;
  const v = await hojasVigentes(prisma, workspaceId, prep.id);
  const primera = v.hojas[0];
  if (!primera) return { hojas: [], faltan: v.faltan, papel: null };
  // Todas las páginas van en el mismo papel. Si el producto cambió de hoja a mitad de camino, las otras se vuelven a armar.
  const mismas = v.hojas.filter((h) => h.salidaId === primera.salidaId && h.tamanoId === primera.tamanoId);
  const [salida, tamano] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findFirst({ where: { id: primera.salidaId, workspaceId }, select: { nombre: true, escalaXMil: true, escalaYMil: true } }),
    prisma.fotofficeTamanoImpresion.findFirst({ where: { id: primera.tamanoId, workspaceId }, select: { nombre: true, anchoMm: true, altoMm: true } }),
  ]);
  if (!salida || !tamano) return null;
  let hojas: HojaAImprimir[] = mismas.map((h) => ({ hojaId: h.id, version: h.version, copias: h.copias }));
  if (soloPendientes) hojas = pendientes(hojas, await normalesPorHoja(prisma, workspaceId, hojas.map((h) => h.hojaId)));
  return {
    hojas,
    faltan: v.faltan + v.hojas.length - mismas.length,
    papel: {
      anchoMm: Number(tamano.anchoMm),
      altoMm: Number(tamano.altoMm),
      escalaXMil: salida.escalaXMil,
      escalaYMil: salida.escalaYMil,
      salida: salida.nombre,
      tamano: tamano.nombre,
    },
  };
}
```

- [ ] **Step 7: Acción de servidor**

En `app/(shell)/ventas/impresion/actions.ts`, sumar `registrarImpresiones` al import de `@/lib/impresion/preparaciones`, sumar `import type { RegistroDeHoja } from "@/lib/impresion/impresion-multiple";` y agregar:
```ts
/** "¿Cómo salió?" de la página que imprime toda la preparación: un registro por hoja. */
export async function registrarImpresionesAction(preparacionId: string, items: RegistroDeHoja[]) {
  const ctx = await ctxImpresion();
  const r = await registrarImpresiones(ctx, preparacionId, items);
  revalidatePath("/ventas/impresiones");
  return r;
}
```

- [ ] **Step 8: Correr y ver que pasa (incluidas las de carnet de la etapa 1)**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS. En especial siguen pasando en `preparaciones.test.ts`: "registrar: NORMAL deja la preparación IMPRESA…", "reimprimir una hoja vieja no marca IMPRESA…" y "editar la foto después de imprimir…".

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/impresion/impresion-multiple.ts apps/fotoffice/lib/impresion/impresion-multiple.test.ts apps/fotoffice/lib/impresion/preparaciones.ts apps/fotoffice/lib/impresion/copias.test.ts "apps/fotoffice/app/(shell)/ventas/impresion/actions.ts"
git commit -m "Impresión: imprimir toda la preparación y registrar cada hoja"
```

---

### Task 10: La cola de Impresiones muestra las fotos y enlaza a imprimir todo

**Files:**
- Modify: `lib/impresion/preparaciones.ts` (`FilaCola` y `colas`)
- Modify: `app/(shell)/ventas/impresiones/page.tsx`, `app/(shell)/ventas/impresiones/fila-acciones.tsx`
- Test: `lib/impresion/copias.test.ts`, `lib/impresion/preparaciones.test.ts`

**Interfaces:**
- Produces: `FilaCola` suma `fotos: number` (piezas COPIA; 0 en carnet) e `imprimirHref: string | null` (copias: `/imprimir/preparacion/{id}` y, si no está IMPRESA, `?solo=pendientes`; carnet: `/imprimir/hoja/{hojaId}?v={version}`; sin hoja: null). `hojaId` y `hojaVersion` siguen igual.
- `FilaAcciones` pasa de `{ preparacionId, hojaId, hojaVersion, cobrada }` a `{ preparacionId, imprimirHref, cobrada }`.

- [ ] **Step 1: Pruebas que fallan**

Al final de `lib/impresion/copias.test.ts`:
```ts
describe("copias en la cola de Impresiones", () => {
  it("muestra cuántas fotos tiene y enlaza a imprimir lo que falta de toda la preparación", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const fila = (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)!;
    expect(fila).toMatchObject({ fotos: 2, estado: "PREPARANDO", imprimirHref: `/imprimir/preparacion/${prep}?solo=pendientes` });
  });
});
```
En `lib/impresion/preparaciones.test.ts`, dentro del `describe`:
```ts
  it("colas: el carnet enlaza a su hoja y no cuenta fotos de copias", async () => {
    const { prep, original } = await conOriginal();
    expect((await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)).toMatchObject({ fotos: 0, imprimirHref: null });
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error(h.error);
    const fila = (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)!;
    expect(fila).toMatchObject({ fotos: 0, imprimirHref: `/imprimir/hoja/${h.hojaId}?v=${h.version}` });
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/copias.test.ts lib/impresion/preparaciones.test.ts`
Expected: FAIL (`fotos` e `imprimirHref` no existen).

- [ ] **Step 3: Implementar**

En `lib/impresion/preparaciones.ts`, en `FilaCola`, debajo de `cobrada: boolean;` agregar:
```ts
  /** Copias: cuántas fotos tiene la preparación (0 en carnet). */
  fotos: number;
  /** Adónde lleva "Imprimir": toda la preparación (copias) o su hoja (carnet). null si no hay nada armado. */
  imprimirHref: string | null;
```
En `colas`, reemplazar el segundo `Promise.all` (el que empieza con `const [productos, clientes, hojas, salidas, tamanos, hojasRegistradas] = await Promise.all([`) entero por este, que suma las piezas de copias:
```ts
  const [productos, clientes, hojas, salidas, tamanos, hojasRegistradas, piezasCopia] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, id: { in: ids(preps.map((p) => p.productId)) } }, select: { id: true, name: true } }),
    prisma.client.findMany({
      where: { workspaceId, id: { in: ids(preps.map((p) => p.clientId)) } },
      select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    }),
    prisma.fotofficeHojaImpresion.findMany({
      where: { workspaceId, preparacionId: { in: preps.map((p) => p.id) } },
      orderBy: { createdAt: "asc" },
      select: { id: true, preparacionId: true, finalHuella: true },
    }),
    prisma.fotofficeSalidaImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.salidaId)) } }, select: { id: true, nombre: true } }),
    prisma.fotofficeTamanoImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.tamanoId)) } }, select: { id: true, nombre: true } }),
    prisma.fotofficeHojaImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.hojaId)) } }, select: { id: true, finalHuella: true } }),
    prisma.fotofficePiezaImpresion.findMany({ where: { workspaceId, preparacionId: { in: preps.map((p) => p.id) }, tipo: "COPIA" }, select: { preparacionId: true } }),
  ]);
```
Debajo de `const versionRegistrada = …` agregar:
```ts
  const fotosDe = new Map<string, number>();
  for (const p of piezasCopia) fotosDe.set(p.preparacionId, (fotosDe.get(p.preparacionId) ?? 0) + 1);
```
y reemplazar la función `fila` por:
```ts
  const fila = (p: (typeof preps)[number]): FilaCola => {
    const ultima = ultimaHoja.get(p.id) ?? null;
    const fotos = fotosDe.get(p.id) ?? 0;
    const imprimirHref =
      fotos > 0
        ? `/imprimir/preparacion/${p.id}${p.estado === "IMPRESA" ? "" : "?solo=pendientes"}`
        : ultima
          ? `/imprimir/hoja/${ultima.id}?v=${versionDeHoja(ultima.finalHuella)}`
          : null;
    return {
      preparacionId: p.id,
      producto: p.productId ? (nombreProducto.get(p.productId) ?? null) : null,
      cliente: p.clientId ? (nombreCliente.get(p.clientId) ?? null) : null,
      estado: p.estado,
      hojaId: ultima?.id ?? null,
      hojaVersion: ultima ? versionDeHoja(ultima.finalHuella) : null,
      cobrada: p.saleItemId !== null,
      creada: p.createdAt.toISOString(),
      fotos,
      imprimirHref,
    };
  };
```
Reemplazar `app/(shell)/ventas/impresiones/fila-acciones.tsx` entero por:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularPreparacionAction } from "../impresion/actions";

/** Imprimir (la hoja de carnet o todas las copias) y Anular (sólo lo que no se cobró: lo cobrado se libera anulando la venta). */
export function FilaAcciones({ preparacionId, imprimirHref, cobrada }: { preparacionId: string; imprimirHref: string | null; cobrada: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function anular() {
    if (!confirm("¿Anular esta preparación?")) return;
    setError(null);
    empezar(async () => {
      try {
        const r = await anularPreparacionAction(preparacionId);
        if (!r.ok) {
          setError(r.error);
          return;
        }
      } catch {
        setError("No se pudo anular. Revisá la conexión y probá de nuevo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={!imprimirHref} onClick={() => imprimirHref && window.open(imprimirHref, "_blank")}>
          Imprimir
        </button>
        {cobrada ? null : (
          <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={anular}>
            Anular
          </button>
        )}
      </span>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
```
En `app/(shell)/ventas/impresiones/page.tsx`, dentro de `Seccion`, reemplazar el `<li>` por:
```tsx
            <li key={f.preparacionId} className="flex items-center justify-between gap-3 py-2">
              <span>
                {f.producto ?? (f.fotos > 0 ? "Copias" : "Foto carnet")}
                {f.fotos > 0 ? ` · ${f.fotos} ${f.fotos === 1 ? "foto" : "fotos"}` : ""} · {f.cliente ?? "sin cliente"} ·{" "}
                {f.estado === "IMPRESA" ? "impresa" : f.estado === "LISTA" ? "lista" : "a medio preparar"} · {hora(f.creada)}
              </span>
              <FilaAcciones preparacionId={f.preparacionId} imprimirHref={f.imprimirHref} cobrada={f.cobrada} />
            </li>
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/preparaciones.ts apps/fotoffice/lib/impresion/copias.test.ts apps/fotoffice/lib/impresion/preparaciones.test.ts "apps/fotoffice/app/(shell)/ventas/impresiones"
git commit -m "Impresiones: la cola muestra las fotos de las copias y enlaza a imprimir todo"
```

---
### Task 11: Página que imprime toda la preparación con "¿Cómo salió?" por hoja

Tarea de interfaz: antes de escribirla, leer `node_modules/next/dist/docs/01-app/` en lo que toca a páginas dinámicas (`params` y `searchParams` son `Promise`) y la página de una hoja de la etapa 1 (`app/imprimir/hoja/[hojaId]/`), que es el modelo.

**Files:**
- Create: `app/imprimir/preparacion/[preparacionId]/page.tsx`
- Create: `app/imprimir/preparacion/[preparacionId]/hojas-para-imprimir.tsx`

**Interfaces:**
- Consumes: `datosParaImprimirPreparacion` (Task 9), `registrarImpresionesAction` (Task 9), `paginas`, `registrosDeRespuesta`, `HojaAImprimir`, `RegistroDeHoja` (Task 9), `medidaImpresaMm` (etapa 1), `requireSalesStaff`.
- Produces: la ruta `/imprimir/preparacion/[preparacionId]` (con `?solo=pendientes` opcional), que usan la cola (Task 10) y el editor (Task 15).

- [ ] **Step 1: La página (servidor)**

Crear `app/imprimir/preparacion/[preparacionId]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSalesStaff } from "@/lib/sales/access";
import { datosParaImprimirPreparacion } from "@/lib/impresion/preparaciones";
import { medidaImpresaMm } from "@/lib/impresion/medidas";
import { HojasParaImprimir } from "./hojas-para-imprimir";

export const dynamic = "force-dynamic";

/**
 * Todas las hojas vigentes de una preparación de copias en un solo documento: cada hoja repetida
 * tantas veces como copias, en páginas consecutivas del mismo tamaño. `?solo=pendientes` imprime
 * sólo lo que todavía no salió entero (por ejemplo, después de editar una foto ya impresa).
 */
export default async function PreparacionParaImprimirPage({
  params,
  searchParams,
}: {
  params: Promise<{ preparacionId: string }>;
  searchParams: Promise<{ solo?: string }>;
}) {
  const { workspace } = await requireSalesStaff();
  const { preparacionId } = await params;
  const { solo } = await searchParams;
  const soloPendientes = solo === "pendientes";
  const d = await datosParaImprimirPreparacion(workspace.id, preparacionId, soloPendientes);
  if (!d) notFound();
  if (!d.papel || d.hojas.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-6 text-sm">
        {d.faltan > 0 ? (
          <p>
            Faltan armar {d.faltan} {d.faltan === 1 ? "foto" : "fotos"}. Abrí la preparación en el Mostrador y tocá «Armar hojas».
          </p>
        ) : (
          <p>No queda nada por imprimir: todo salió.</p>
        )}
        {soloPendientes && d.papel ? (
          <Link className="underline" href={`/imprimir/preparacion/${preparacionId}`}>
            Imprimir todo otra vez
          </Link>
        ) : null}
      </div>
    );
  }
  const totalHojas = d.hojas.reduce((s, h) => s + h.copias, 0);
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${d.papel.anchoMm}mm ${d.papel.altoMm}mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; } .pagina { break-after: page; } .pagina:last-child { break-after: auto; } @media print { .no-imprimir { display: none !important; } }`,
        }}
      />
      <HojasParaImprimir
        preparacionId={preparacionId}
        hojas={d.hojas}
        faltan={d.faltan}
        anchoMm={medidaImpresaMm(d.papel.anchoMm, d.papel.escalaXMil)}
        altoMm={medidaImpresaMm(d.papel.altoMm, d.papel.escalaYMil)}
        paginaAnchoMm={d.papel.anchoMm}
        paginaAltoMm={d.papel.altoMm}
        titulo={`${d.papel.salida} · ${d.papel.tamano} · ${totalHojas} ${totalHojas === 1 ? "hoja" : "hojas"}${soloPendientes ? " (lo que falta)" : ""}`}
      />
    </>
  );
}
```

- [ ] **Step 2: El componente que imprime y pregunta**

Crear `app/imprimir/preparacion/[preparacionId]/hojas-para-imprimir.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { registrarImpresionesAction } from "@/app/(shell)/ventas/impresion/actions";
import { paginas, registrosDeRespuesta, type HojaAImprimir, type RegistroDeHoja } from "@/lib/impresion/impresion-multiple";

type Fase = "cargando" | "imprimiendo" | "preguntar" | "detalle" | "guardando" | "listo" | "error";

/**
 * Imprime una tanda de páginas (todas las hojas, o sólo las que salieron mal) y después pregunta
 * "¿Cómo salió?": todas bien, o cuántas copias de cada hoja salieron mal. Las malas se registran
 * DESCARTADA y se vuelven a imprimir solas.
 */
export function HojasParaImprimir({
  preparacionId,
  hojas,
  faltan,
  anchoMm,
  altoMm,
  paginaAnchoMm,
  paginaAltoMm,
  titulo,
}: {
  preparacionId: string;
  hojas: HojaAImprimir[];
  faltan: number;
  /** Con la corrección de escala de la impresora. */
  anchoMm: number;
  altoMm: number;
  paginaAnchoMm: number;
  paginaAltoMm: number;
  titulo: string;
}) {
  const [tanda, setTanda] = useState<HojaAImprimir[]>(hojas);
  const [ronda, setRonda] = useState(0);
  const [fase, setFase] = useState<Fase>("cargando");
  const faseRef = useRef<Fase>("cargando");
  const [malas, setMalas] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState<{ registros: RegistroDeHoja[]; reimprimir: HojaAImprimir[] } | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const cargadas = useRef(new Set<string>());
  const lista = useMemo(() => paginas(tanda), [tanda]);

  function cambiarFase(f: Fase) {
    faseRef.current = f;
    setFase(f);
  }
  function imprimir() {
    cambiarFase("imprimiendo");
    // Un tick para que React pinte antes de que el diálogo bloquee la pestaña.
    setTimeout(() => window.print(), 50);
  }
  function alCargar(clave: string) {
    cargadas.current.add(clave);
    if (cargadas.current.size >= lista.length && faseRef.current === "cargando") imprimir();
  }

  useEffect(() => {
    const despues = () => {
      if (faseRef.current === "imprimiendo") cambiarFase("preguntar");
    };
    window.addEventListener("afterprint", despues);
    return () => window.removeEventListener("afterprint", despues);
  }, []);

  // En cada tanda: las imágenes que ya estaban en caché cargaron antes de hidratar y su onLoad no llega.
  useEffect(() => {
    cargadas.current = new Set();
    for (const img of Array.from(contenedor.current?.querySelectorAll<HTMLImageElement>("img[data-clave]") ?? [])) {
      if (img.complete && img.naturalWidth > 0) alCargar(img.dataset.clave!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al cambiar de tanda
  }, [ronda]);

  async function registrar(registros: RegistroDeHoja[], reimprimir: HojaAImprimir[]) {
    cambiarFase("guardando");
    setError(null);
    try {
      const r = await registrarImpresionesAction(preparacionId, registros);
      if (!r.ok) {
        setError(r.error);
        setReintento({ registros, reimprimir });
        return cambiarFase("error");
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      setReintento({ registros, reimprimir });
      return cambiarFase("error");
    }
    setReintento(null);
    setMalas({});
    if (reimprimir.length === 0) return cambiarFase("listo");
    // Las que salieron mal, de nuevo: otra tanda sólo con esas páginas.
    setTanda(reimprimir);
    setRonda((n) => n + 1);
    cambiarFase("cargando");
  }

  function responder(conMalas: Record<string, number>) {
    const x = registrosDeRespuesta(tanda, conMalas);
    void registrar(x.registros, x.reimprimir);
  }

  return (
    <div>
      <div className="no-imprimir mx-auto max-w-xl space-y-3 p-4 text-sm">
        <p className="font-medium">{titulo}</p>
        <details>
          <summary className="cursor-pointer underline">Descargar los JPG (para imprimir desde otro programa)</summary>
          <ul className="mt-1 list-disc pl-5">
            {hojas.map((h, i) => (
              <li key={h.hojaId}>
                <a className="underline" href={`/api/impresion/hoja/${h.hojaId}?descargar=1&v=${h.version}`}>
                  Hoja {i + 1} · {h.copias} {h.copias === 1 ? "copia" : "copias"}
                </a>
              </li>
            ))}
          </ul>
        </details>
        {faltan > 0 ? (
          <p className="fo-alert-warning">
            Faltan armar {faltan} {faltan === 1 ? "foto" : "fotos"}: no están en esta impresión.
          </p>
        ) : null}
        {fase === "cargando" ? (
          <div className="flex gap-2">
            <span>Cargando {lista.length} {lista.length === 1 ? "página" : "páginas"}…</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>
              Imprimir
            </button>
          </div>
        ) : null}
        {fase === "preguntar" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>¿Cómo salió?</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder({})}>
              Todas bien
            </button>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => cambiarFase("detalle")}>
              Alguna salió mal
            </button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => cambiarFase("listo")}>
              No las imprimí
            </button>
          </div>
        ) : null}
        {fase === "detalle" ? (
          <div className="space-y-3">
            <p>Marcá cuántas copias de cada hoja salieron mal: se descartan y se vuelven a imprimir sólo esas.</p>
            <ul className="space-y-2">
              {tanda.map((h, i) => (
                <li key={h.hojaId} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del archivo privado de la hoja */}
                  <img src={`/api/impresion/hoja/${h.hojaId}?v=${h.version}`} alt="" className="h-16 w-auto border border-[var(--fo-border)]" />
                  <span className="flex-1">
                    Hoja {i + 1} · {h.copias} {h.copias === 1 ? "copia" : "copias"}
                  </span>
                  <label className="flex items-center gap-1">
                    Mal
                    <input
                      type="number"
                      min={0}
                      max={h.copias}
                      value={malas[h.hojaId] ?? 0}
                      onChange={(e) => setMalas((m) => ({ ...m, [h.hojaId]: Math.min(h.copias, Math.max(0, Math.round(Number(e.target.value)) || 0)) }))}
                      className="fo-input h-8 w-16"
                    />
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder(malas)}>
                Guardar y reimprimir las malas
              </button>
              <button type="button" className="fo-btn fo-btn-secondary" onClick={() => cambiarFase("preguntar")}>
                Volver
              </button>
            </div>
          </div>
        ) : null}
        {fase === "guardando" ? <p>Guardando…</p> : null}
        {fase === "listo" ? (
          <div className="flex gap-2">
            <span>Listo.</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>
              Imprimir otra vez
            </button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => window.close()}>
              Cerrar
            </button>
          </div>
        ) : null}
        {fase === "error" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[var(--fo-danger)]">{error}</p>
            {reintento ? (
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => void registrar(reintento.registros, reintento.reimprimir)}>
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* Cada página es de tamaño fijo: con una escala mayor a 1000 la imagen se recorta, no pasa a otra hoja. */}
      <div ref={contenedor}>
        {lista.map((p, i) => (
          <div key={`${ronda}-${i}`} className="pagina" style={{ width: `${paginaAnchoMm}mm`, height: `${paginaAltoMm}mm`, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- el tamaño en mm es el punto: no se optimiza */}
            <img
              data-clave={`${ronda}-${i}`}
              src={`/api/impresion/hoja/${p.hojaId}?v=${p.version}`}
              alt=""
              onLoad={() => alCargar(`${ronda}-${i}`)}
              onError={() => {
                setError("No se pudo cargar una de las hojas.");
                cambiarFase("error");
              }}
              style={{ width: `${anchoMm}mm`, height: `${altoMm}mm`, display: "block", maxWidth: "none" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck y lint de lo nuevo**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores (y sin "heap out of memory").
Run: `pnpm --filter fotoffice exec eslint "app/imprimir/preparacion"`
Expected: sin errores. Si la regla `react-hooks/exhaustive-deps` no está activa, el comentario `eslint-disable-next-line` sobra: si eslint avisa "Unused eslint-disable directive", sacarlo.

- [ ] **Step 4: Commit**

```bash
git add "apps/fotoffice/app/imprimir/preparacion"
git commit -m "Impresión: página que imprime todas las copias de una preparación"
```

---

### Task 12: Ayudas puras del editor: subir de a 3, cambios en lote y textos de aviso

**Files:**
- Create: `lib/impresion/subidas.ts`
- Modify: `lib/impresion/lote.ts` (ya tiene `FOTOS_MAX` y `CANTIDAD_MAX`)
- Test: `lib/impresion/subidas.test.ts`, `lib/impresion/lote.test.ts`

**Interfaces:**
- Consumes: `cambiarModo`, `papelOrientado`, `Papel` (Task 2); `calidadDeCopia`, `AvisoCalidad` (Task 3); `FotoCopia` (Task 7, sólo el tipo).
- Produces (subidas.ts):
  - `SUBIDAS_A_LA_VEZ = 3`, `TAMANO_MAXIMO_FOTO = 60 * 1024 * 1024`.
  - `validarArchivoFoto(f: { name: string; type: string; size: number }): { ok: true; tipo: string } | { ok: false; error: string }`.
  - `conLimite<T, R>(items: readonly T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<PromiseSettledResult<R>[]>`.
- Produces (lote.ts):
  - `type PiezaAGuardar = { originalId: string; cantidad: number; receta: Receta; revisada: boolean }`.
  - `type CambioEnLote = { modo?: Modo; cantidad?: number }`.
  - `mismaReceta(a: Receta, b: Receta): boolean`.
  - `totalDeCopias(fotos: { pieza: { cantidad: number } | null }[]): number`.
  - `cambiosEnLote(fotos: FotoCopia[], elegidas: ReadonlySet<string>, cambio: CambioEnLote, papel: Papel): PiezaAGuardar[]` (sin elegidas = todas; sólo las que cambian).
  - `aplicarGuardado(fotos: FotoCopia[], items: PiezaAGuardar[], papel: Papel): FotoCopia[]` (lo que hizo el servidor, reflejado en pantalla: misma regla de "Revisada"; la hoja queda vencida si cambió algo).
  - `textoDeAviso(aviso: AvisoCalidad, papel: string): string | null`.

- [ ] **Step 1: Pruebas que fallan**

Crear `lib/impresion/subidas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { conLimite, validarArchivoFoto } from "./subidas";

describe("subir fotos", () => {
  it("acepta JPG, PNG y WebP de hasta 60 MB; avisa HEIC y lo demás", () => {
    expect(validarArchivoFoto({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toEqual({ ok: true, tipo: "image/jpeg" });
    expect(validarArchivoFoto({ name: "a.png", type: "image/png", size: 1000 })).toEqual({ ok: true, tipo: "image/png" });
    expect(validarArchivoFoto({ name: "IMG_1.HEIC", type: "", size: 1000 })).toEqual({
      ok: false,
      error: "Las fotos HEIC del iPhone no se pueden abrir acá: exportala como JPG (en WhatsApp sale así).",
    });
    expect(validarArchivoFoto({ name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({ ok: false, error: "La foto tiene que ser JPG, PNG o WebP." });
    expect(validarArchivoFoto({ name: "a.jpg", type: "image/jpeg", size: 61 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "La foto pesa 61.0 MB: el máximo es 60 MB.",
    });
  });

  it("de a 3 a la vez, con los resultados en orden y sin cortar por una que falla", async () => {
    let activas = 0;
    let maximo = 0;
    const r = await conLimite([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((ok) => setTimeout(ok, 5 + (n % 3)));
      activas--;
      if (n === 4) throw new Error("cuatro");
      return n * 10;
    });
    expect(maximo).toBe(3);
    expect(r.map((x) => (x.status === "fulfilled" ? x.value : "falló"))).toEqual([10, 20, 30, "falló", 50, 60, 70]);
  });

  it("sin nada para subir, no hace nada", async () => {
    expect(await conLimite([], 3, async () => 1)).toEqual([]);
  });
});
```
Crear `lib/impresion/lote.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import { propuestaAutomatica } from "./encuadre";
import { aplicarGuardado, cambiosEnLote, mismaReceta, textoDeAviso, totalDeCopias } from "./lote";
import type { FotoCopia } from "./copias";

const P10 = { anchoMm: 102, altoMm: 152 };
function foto(id: string, ancho: number, alto: number, cantidad = 1, revisada = false): FotoCopia {
  return {
    originalId: id,
    nombre: `${id}.jpg`,
    ancho,
    alto,
    pieza: { receta: propuestaAutomatica(ancho, alto, P10), cantidad, revisada, ppp: 300, aviso: "OK" },
    hoja: { id: `h-${id}`, version: "v", copias: cantidad },
  };
}
const FOTOS = [foto("a", 6000, 4000), foto("b", 1920, 1080, 2)];

describe("cambios en lote", () => {
  it("encajar todas: sólo cambia la que estaba recortada, y sin marcar revisada", () => {
    const c = cambiosEnLote(FOTOS, new Set(), { modo: "ENCAJAR" }, P10);
    expect(c.map((x) => [x.originalId, x.receta.modo, x.cantidad, x.revisada])).toEqual([["a", "ENCAJAR", 1, false]]);
  });

  it("cantidad para todas, o sólo para las elegidas", () => {
    expect(cambiosEnLote(FOTOS, new Set(), { cantidad: 3 }, P10).map((x) => [x.originalId, x.cantidad])).toEqual([["a", 3], ["b", 3]]);
    expect(cambiosEnLote(FOTOS, new Set(["b"]), { cantidad: 3 }, P10).map((x) => x.originalId)).toEqual(["b"]);
    expect(cambiosEnLote(FOTOS, new Set(), { cantidad: 2, modo: "ENCAJAR" }, P10).map((x) => x.originalId)).toEqual(["a"]);
  });

  it("el total de copias suma la cantidad de cada foto", () => {
    expect(totalDeCopias(FOTOS)).toBe(3);
    expect(totalDeCopias([{ pieza: null }])).toBe(0);
  });
});

describe("reflejar lo guardado en pantalla", () => {
  const revisada = foto("a", 6000, 4000, 1, true);

  it("sólo la cantidad: sigue revisada y la hoja queda vencida", () => {
    const [f] = aplicarGuardado([revisada], [{ originalId: "a", cantidad: 4, receta: revisada.pieza!.receta, revisada: false }], P10);
    expect(f!.pieza).toMatchObject({ cantidad: 4, revisada: true });
    expect(f!.hoja).toBeNull();
  });

  it("otra receta sin confirmar: deja de estar revisada", () => {
    const receta = { ...revisada.pieza!.receta, ajustes: { ...AJUSTES_NEUTROS, exposicion: 5 } };
    const [f] = aplicarGuardado([revisada], [{ originalId: "a", cantidad: 1, receta, revisada: false }], P10);
    expect(f!.pieza!.revisada).toBe(false);
  });

  it("sin cambios: la hoja sigue vigente; las fotos que no se tocaron quedan igual", () => {
    const fotos = [revisada, foto("b", 1920, 1080)];
    const r = aplicarGuardado(fotos, [{ originalId: "a", cantidad: 1, receta: revisada.pieza!.receta, revisada: true }], P10);
    expect(r[0]!.hoja).toEqual(revisada.hoja);
    expect(r[1]).toBe(fotos[1]);
  });

  it("dos recetas iguales con las claves en otro orden son la misma", () => {
    const r = revisada.pieza!.receta;
    const desordenada = JSON.parse(JSON.stringify({ nitidez: r.nitidez, ajustes: r.ajustes, encuadre: r.encuadre, ...r }));
    expect(mismaReceta(r, desordenada)).toBe(true);
  });

  it("textos del aviso de calidad (§5.4)", () => {
    expect(textoDeAviso("OK", "13x18")).toBeNull();
    expect(textoDeAviso("BLANDA", "13x18")).toBe("Puede verse algo blanda en 13x18");
    expect(textoDeAviso("PIXELADA", "13x18")).toBe("Se va a ver pixelada en 13x18");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/subidas.test.ts lib/impresion/lote.test.ts`
Expected: FAIL (no existen las funciones).

- [ ] **Step 3: Implementar**

Crear `lib/impresion/subidas.ts`:
```ts
/**
 * Módulo PURO: lo que el navegador controla antes de subir una foto y la cola de subidas.
 * Los topes y textos son los mismos que el servidor (`almacen.ts` y `render.ts`).
 */

export const SUBIDAS_A_LA_VEZ = 3;
export const TAMANO_MAXIMO_FOTO = 60 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MENSAJE_HEIC = "Las fotos HEIC del iPhone no se pueden abrir acá: exportala como JPG (en WhatsApp sale así).";

export function validarArchivoFoto(f: { name: string; type: string; size: number }): { ok: true; tipo: string } | { ok: false; error: string } {
  const nombre = f.name.toLowerCase();
  // Algunos navegadores dejan vacío el tipo de una HEIC: se mira también el nombre.
  if (f.type === "image/heic" || f.type === "image/heif" || nombre.endsWith(".heic") || nombre.endsWith(".heif")) return { ok: false, error: MENSAJE_HEIC };
  if (!TIPOS.includes(f.type)) return { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
  if (f.size > TAMANO_MAXIMO_FOTO) return { ok: false, error: `La foto pesa ${(f.size / 1024 / 1024).toFixed(1)} MB: el máximo es 60 MB.` };
  return { ok: true, tipo: f.type };
}

/** Corre `fn` sobre cada elemento, como mucho `limite` a la vez. Los resultados vuelven en el orden de entrada. */
export async function conLimite<T, R>(items: readonly T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const resultados: PromiseSettledResult<R>[] = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      try {
        resultados[i] = { status: "fulfilled", value: await fn(items[i]!, i) };
      } catch (reason) {
        resultados[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), items.length) }, trabajador));
  return resultados;
}
```
Reemplazar `lib/impresion/lote.ts` entero por:
```ts
import { cambiarModo, papelOrientado, type Papel } from "./encuadre";
import { calidadDeCopia, type AvisoCalidad } from "./geometria";
import type { Modo, Receta } from "./receta";
import type { FotoCopia } from "./copias";

/**
 * Módulo PURO de las copias en lote: lo usan el editor (navegador) y `copias.ts` (servidor).
 */

/** Fotos por preparación: más que esto no es una copia instantánea, es un trabajo de laboratorio. */
export const FOTOS_MAX = 60;
/** Copias de una misma foto. */
export const CANTIDAD_MAX = 50;

export type PiezaAGuardar = { originalId: string; cantidad: number; receta: Receta; revisada: boolean };
export type CambioEnLote = { modo?: Modo; cantidad?: number };

/** JSON con las claves ordenadas: la base devuelve el JSON con otro orden de claves. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
}

export function mismaReceta(a: Receta, b: Receta): boolean {
  return canonico(a) === canonico(b);
}

export function totalDeCopias(fotos: { pieza: { cantidad: number } | null }[]): number {
  return fotos.reduce((s, f) => s + (f.pieza?.cantidad ?? 0), 0);
}

/**
 * Lo que hay que guardar para aplicar un cambio a las fotos elegidas (o a todas si no hay
 * elegidas). Sólo devuelve las que cambian. Nunca marca "Revisada": eso es foto por foto.
 */
export function cambiosEnLote(fotos: FotoCopia[], elegidas: ReadonlySet<string>, cambio: CambioEnLote, papel: Papel): PiezaAGuardar[] {
  const destino = elegidas.size > 0 ? fotos.filter((f) => elegidas.has(f.originalId)) : fotos;
  const out: PiezaAGuardar[] = [];
  for (const f of destino) {
    if (!f.pieza) continue;
    const receta = cambio.modo ? cambiarModo(f.pieza.receta, cambio.modo, { foto: { ancho: f.ancho, alto: f.alto }, papel }) : f.pieza.receta;
    const cantidad = cambio.cantidad ?? f.pieza.cantidad;
    if (receta === f.pieza.receta && cantidad === f.pieza.cantidad) continue;
    out.push({ originalId: f.originalId, receta, cantidad, revisada: false });
  }
  return out;
}

/**
 * Refleja en pantalla lo que el servidor acaba de guardar (misma regla de "Revisada" que
 * `guardarPiezasCopia`). Si cambió la receta o la cantidad, la hoja queda vencida: hay que armarla.
 */
export function aplicarGuardado(fotos: FotoCopia[], items: PiezaAGuardar[], papel: Papel): FotoCopia[] {
  return fotos.map((f) => {
    const it = items.find((i) => i.originalId === f.originalId);
    if (!it) return f;
    const misma = f.pieza !== null && mismaReceta(f.pieza.receta, it.receta);
    const revisada = it.revisada || (misma && (f.pieza?.revisada ?? false));
    const calidad = calidadDeCopia({ ancho: f.ancho, alto: f.alto }, it.receta, papelOrientado(papel, it.receta.orientacion ?? "VERTICAL"));
    const hoja = misma && it.cantidad === f.pieza?.cantidad ? f.hoja : null;
    return { ...f, pieza: { receta: it.receta, cantidad: it.cantidad, revisada, ...calidad }, hoja };
  });
}

/** §5.4: el texto del aviso de calidad, con el nombre del papel. */
export function textoDeAviso(aviso: AvisoCalidad, papel: string): string | null {
  if (aviso === "BLANDA") return `Puede verse algo blanda en ${papel}`;
  if (aviso === "PIXELADA") return `Se va a ver pixelada en ${papel}`;
  return null;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/subidas.ts apps/fotoffice/lib/impresion/subidas.test.ts apps/fotoffice/lib/impresion/lote.ts apps/fotoffice/lib/impresion/lote.test.ts
git commit -m "Impresión: ayudas del editor de copias (subidas de a 3, lote y avisos)"
```

---
### Task 13: La foto sobre el papel (arrastrable) y la vista con ajustes

Tarea de interfaz. Las cuentas ya están probadas (`colocacionEnPantalla`, Task 2; `planDeRecorte`, Task 3): acá sólo se dibuja. Si el typecheck o el lint piden ajustes de detalle, hacerlos sin cambiar las cuentas.

**Files:**
- Create: `components/copias/papel-con-foto.tsx`
- Create: `components/copias/vista-pieza.tsx`
- Modify: `components/foto-carnet/vistas.tsx` (exportar `useImagen`)
- Modify: `components/foto-carnet/ajustes.tsx` (texto de ayuda configurable)

**Interfaces:**
- Consumes: `colocacionEnPantalla`, `Papel` (Task 2); `planDeRecorte`, `cajaRotada` (Task 3); `aplicarAjustes`; `anguloTotal`, `colorBordeDe`, `Receta` (Task 1).
- Produces:
  - `PapelConFoto(props: { src: string; foto: { ancho: number; alto: number }; receta: Receta; papelMm: Papel /* ya orientado */; lado: number; guias?: boolean; onArrastrar?: (dxPapel: number, dyPapel: number) => void; onZoom?: (factor: number) => void })`.
  - `VistaPieza(props: { src: string; receta: Receta; papelMm: Papel /* ya orientado */; ancho?: number })`.
  - `useImagen(src: string): HTMLImageElement | null` exportado desde `components/foto-carnet/vistas.tsx`.
  - `Ajustes` acepta `explicacion?: string` (si falta, el texto de siempre).

- [ ] **Step 1: Exportar `useImagen` y hacer configurable el texto de ajustes**

En `components/foto-carnet/vistas.tsx` cambiar `function useImagen(` por `export function useImagen(`.

En `components/foto-carnet/ajustes.tsx`:
- En las props agregar `explicacion,` a la desestructuración y `explicacion?: string;` al tipo.
- Reemplazar el párrafo
```tsx
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Ajustes suaves de luz y color. Lo que ves al lado es una vista previa: la plancha se arma desde la foto original, sin
          perder calidad.
        </p>
```
por
```tsx
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          {explicacion ??
            "Ajustes suaves de luz y color. Lo que ves al lado es una vista previa: la plancha se arma desde la foto original, sin perder calidad."}
        </p>
```

- [ ] **Step 2: `PapelConFoto`**

Crear `components/copias/papel-con-foto.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { colocacionEnPantalla, type Papel } from "@/lib/impresion/encuadre";
import { colorBordeDe, type Receta } from "@/lib/impresion/receta";

/** Zona de seguridad (spec §6): lo que queda a menos de 3 mm del borde puede perderse al cortar. */
const SEGURIDAD_MM = 3;

function Guias({ papelMm }: { papelMm: Papel }) {
  const mx = (SEGURIDAD_MM / papelMm.anchoMm) * 100;
  const my = (SEGURIDAD_MM / papelMm.altoMm) * 100;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`v${f}`} className="absolute bottom-0 top-0 border-l border-white/70" style={{ left: `${f * 100}%` }} />
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`h${f}`} className="absolute left-0 right-0 border-t border-white/70" style={{ top: `${f * 100}%` }} />
      ))}
      <div className="absolute border border-dashed border-sky-400/90" style={{ left: `${mx}%`, right: `${mx}%`, top: `${my}%`, bottom: `${my}%` }} />
    </div>
  );
}

/**
 * La foto sobre la silueta del papel real, sólo con CSS (rápido aunque haya 30 en la grilla).
 * En RECORTAR se ve la foto entera con lo que se corta sombreado; en ENCAJAR, el papel con su
 * borde. Con `onArrastrar`/`onZoom` se mueve con el mouse (o el dedo) y la rueda. Es para mirar
 * y para decidir: el archivo lo arma el servidor desde el original.
 */
export function PapelConFoto({
  src,
  foto,
  receta,
  papelMm,
  lado,
  guias = false,
  onArrastrar,
  onZoom,
}: {
  src: string;
  /** La foto ya derecha, en píxeles del original (sólo importa la proporción). */
  foto: { ancho: number; alto: number };
  receta: Receta;
  /** El papel ya orientado como la receta. */
  papelMm: Papel;
  /** Lado del cuadro que contiene al papel, en px de pantalla. */
  lado: number;
  guias?: boolean;
  onArrastrar?: (dxPapel: number, dyPapel: number) => void;
  onZoom?: (factor: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; id: number } | null>(null);
  const zoomRef = useRef(onZoom);
  useEffect(() => {
    zoomRef.current = onZoom;
  });
  const conZoom = Boolean(onZoom);
  // La rueda necesita `passive: false` para no mover la página mientras se hace zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el || !conZoom) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current?.(Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [conZoom]);

  const ap = papelMm.anchoMm / papelMm.altoMm;
  const util = lado * 0.82;
  const papel = ap >= 1 ? { ancho: util, alto: util / ap } : { ancho: util * ap, alto: util };
  const left = (lado - papel.ancho) / 2;
  const top = (lado - papel.alto) / 2;
  const c = colocacionEnPantalla(receta, foto, papel);

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden rounded-[var(--fo-radius-sm)] bg-black/10 ${onArrastrar ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
      style={{ width: lado, height: lado }}
      onPointerDown={
        onArrastrar
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              arrastre.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            }
          : undefined
      }
      onPointerMove={
        onArrastrar
          ? (e) => {
              const a = arrastre.current;
              if (!a || a.id !== e.pointerId) return;
              onArrastrar((e.clientX - a.x) / papel.ancho, (e.clientY - a.y) / papel.alto);
              arrastre.current = { ...a, x: e.clientX, y: e.clientY };
            }
          : undefined
      }
      onPointerUp={() => {
        arrastre.current = null;
      }}
      onPointerCancel={() => {
        arrastre.current = null;
      }}
    >
      {/* El papel. En ENCAJAR, lo que no tapa la foto es el borde. */}
      <div
        className="absolute"
        style={{ left, top, width: papel.ancho, height: papel.alto, background: receta.modo === "ENCAJAR" ? colorBordeDe(receta) : "#ffffff" }}
      />
      <div className="absolute" style={{ left: left + c.caja.left, top: top + c.caja.top, width: c.caja.width, height: c.caja.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa privada del original, servida por nuestra ruta */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          style={{ width: c.foto.width, height: c.foto.height, transform: `translate(-50%, -50%) rotate(${c.foto.rotacion}deg)` }}
        />
      </div>
      {/* Afuera del papel, sombreado: es lo que se corta. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left, top, width: papel.ancho, height: papel.alto, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", outline: "1px solid rgba(255,255,255,0.9)" }}
      >
        {guias ? <Guias papelMm={papelMm} /> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `VistaPieza`**

Crear `components/copias/vista-pieza.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { aplicarAjustes } from "@/lib/impresion/ajustes";
import type { Papel } from "@/lib/impresion/encuadre";
import { cajaRotada, planDeRecorte } from "@/lib/impresion/geometria";
import { anguloTotal, colorBordeDe, type Receta } from "@/lib/impresion/receta";
import { useImagen } from "@/components/foto-carnet/vistas";

/**
 * Así sale la copia, con los ajustes: el mismo `planDeRecorte` que usa el servidor, sobre la
 * vista previa (1600 px). Los ajustes se aplican sólo a la foto: el borde queda de su color.
 * Es SÓLO para mirar: el archivo que se imprime lo arma el servidor desde el original.
 */
export function VistaPieza({ src, receta, papelMm, ancho = 480 }: { src: string; receta: Receta; papelMm: Papel; ancho?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const img = useImagen(src);
  const alto = Math.max(1, Math.round((ancho * papelMm.altoMm) / papelMm.anchoMm));

  useEffect(() => {
    if (!img) return;
    // Un dibujo por cuadro como mucho: mover un control no recalcula en cada evento.
    const id = requestAnimationFrame(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;
      canvas.width = ancho;
      canvas.height = alto;
      const angulo = anguloTotal(receta);
      const caja = cajaRotada(img.naturalWidth, img.naturalHeight, angulo);
      const plan = planDeRecorte(receta, caja, { ancho, alto });
      const c = plan.colocacion;
      const r = plan.recorte;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = receta.modo === "ENCAJAR" ? colorBordeDe(receta) : "#ffffff";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.left, c.top, c.width, c.height);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Del recorte (px de la caja girada) a su lugar en el papel: lo mismo que extract + resize en el servidor.
      ctx.translate(c.left, c.top);
      ctx.scale(c.width / r.width, c.height / r.height);
      ctx.translate(-r.left + caja.ancho / 2, -r.top + caja.alto / 2);
      ctx.rotate((angulo * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
      const datos = ctx.getImageData(c.left, c.top, c.width, c.height);
      aplicarAjustes(datos.data, 4, receta.ajustes);
      ctx.putImageData(datos, c.left, c.top);
    });
    return () => cancelAnimationFrame(id);
  }, [img, receta, ancho, alto]);

  return (
    <div
      className="mx-auto w-full max-w-md rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-black/10 p-3"
      style={{ aspectRatio: `${papelMm.anchoMm} / ${papelMm.altoMm}` }}
    >
      <canvas ref={ref} className="h-full w-full" aria-label="Vista previa de la copia con los ajustes" />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, lint y pruebas**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores.
Run: `pnpm --filter fotoffice exec eslint components/copias components/foto-carnet`
Expected: sin errores.
Run: `pnpm --filter fotoffice test -- components/foto-carnet lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/components/copias apps/fotoffice/components/foto-carnet/vistas.tsx apps/fotoffice/components/foto-carnet/ajustes.tsx
git commit -m "Copias: la foto sobre el papel real y la vista previa con ajustes"
```

---

### Task 14: Editor de una foto

Tarea de interfaz. Todas las decisiones de encuadre salen de `lib/impresion/encuadre.ts` (probado): el componente no hace cuentas propias.

**Files:**
- Create: `components/copias/editor-una-foto.tsx`

**Interfaces:**
- Consumes: `aspectosDe`, `cambiarModo`, `cambiarOrientacion`, `conZoom`, `enderezarA`, `girar90`, `moverEncuadre`, `nivelDeZoom`, `papelOrientado`, `rangoDeZoom`, `volverALaPropuesta`, `zoomEncuadre`, `Contexto`, `Papel` (Task 2); `calidadDeCopia` (Task 3); `textoDeAviso`, `CANTIDAD_MAX` (Task 12); `FotoCopia` (Task 7); `PapelConFoto`, `VistaPieza` (Task 13); `Ajustes` (etapa 1); `AJUSTES_NEUTROS`; `colorBordeDe`, `Modo`, `Receta` (Task 1).
- Produces: `EditorUnaFoto(props: { foto: FotoCopia & { pieza: NonNullable<FotoCopia["pieza"]> }; papel: Papel & { nombre: string }; indice: number; total: number; onGuardar: (d: { receta: Receta; cantidad: number; revisada: boolean }) => Promise<boolean>; onIr: (delta: -1 | 1) => void; onPegarATodas: (d: { modo: Modo; cantidad: number }) => void; onCerrar: () => void })`. Quien lo usa lo monta con `key={foto.originalId}` (cada foto arranca con su estado).

- [ ] **Step 1: El componente**

Crear `components/copias/editor-una-foto.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RectangleHorizontal, RectangleVertical, RotateCw, Undo2 } from "lucide-react";
import { AJUSTES_NEUTROS } from "@/lib/impresion/ajustes";
import {
  aspectosDe,
  cambiarModo,
  cambiarOrientacion,
  conZoom,
  enderezarA,
  girar90,
  moverEncuadre,
  nivelDeZoom,
  papelOrientado,
  rangoDeZoom,
  volverALaPropuesta,
  zoomEncuadre,
  type Contexto,
  type Papel,
} from "@/lib/impresion/encuadre";
import { calidadDeCopia } from "@/lib/impresion/geometria";
import { CANTIDAD_MAX, mismaReceta, textoDeAviso } from "@/lib/impresion/lote";
import { colorBordeDe, type Modo, type Receta } from "@/lib/impresion/receta";
import type { FotoCopia } from "@/lib/impresion/copias";
import { Ajustes } from "@/components/foto-carnet/ajustes";
import { PapelConFoto } from "./papel-con-foto";
import { VistaPieza } from "./vista-pieza";

const coma = (v: number) => String(v).replace(".", ",");

/**
 * Una foto por vez (spec §6): arrastrar mueve la foto, la rueda o el deslizador hacen zoom,
 * girar 90°, enderezar ±10°, papel parado o acostado, "Volver a la propuesta", guías y ajustes.
 * Teclado: ← → foto anterior / siguiente (guarda), R recortar, E encajar, Enter confirma y la
 * marca "Revisada". Todo se guarda como receta (proporciones): la pantalla no cambia el resultado.
 */
export function EditorUnaFoto({
  foto,
  papel,
  indice,
  total,
  onGuardar,
  onIr,
  onPegarATodas,
  onCerrar,
}: {
  foto: FotoCopia & { pieza: NonNullable<FotoCopia["pieza"]> };
  papel: Papel & { nombre: string };
  indice: number;
  total: number;
  /** Guarda esta foto; false si el servidor no la aceptó (el error lo muestra quien llama). */
  onGuardar: (d: { receta: Receta; cantidad: number; revisada: boolean }) => Promise<boolean>;
  onIr: (delta: -1 | 1) => void;
  onPegarATodas: (d: { modo: Modo; cantidad: number }) => void;
  onCerrar: () => void;
}) {
  const [receta, setReceta] = useState<Receta>(foto.pieza.receta);
  const [cantidad, setCantidad] = useState(foto.pieza.cantidad);
  const [pestana, setPestana] = useState<"ENCUADRE" | "RETOQUE">("ENCUADRE");
  const [guias, setGuias] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(480);

  const ctx: Contexto = { foto: { ancho: foto.ancho, alto: foto.alto }, papel };
  const { af, ap } = aspectosDe(receta, ctx);
  const rango = rangoDeZoom(receta.modo, af, ap);
  const nivel = nivelDeZoom(receta.encuadre, af, ap);
  const papelPieza = papelOrientado(papel, receta.orientacion ?? "VERTICAL");
  const calidad = calidadDeCopia(ctx.foto, receta, papelPieza);
  const aviso = textoDeAviso(calidad.aviso, papel.nombre);
  const src = `/api/impresion/vista/${foto.originalId}`;
  const cambio = !mismaReceta(receta, foto.pieza.receta) || cantidad !== foto.pieza.cantidad;
  const ultima = indice === total - 1;

  // El papel ocupa el ancho disponible (entre 240 y 640 px).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setLado(Math.max(240, Math.min(640, Math.floor(e.contentRect.width))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Guarda (si hace falta) y después va a otra foto (`delta`) o vuelve a la grilla (0). */
  async function guardarEIr(delta: -1 | 0 | 1, revisada: boolean) {
    if (guardando) return;
    if (cambio || revisada) {
      setGuardando(true);
      const ok = await onGuardar({ receta, cantidad, revisada }).finally(() => setGuardando(false));
      if (!ok) return;
    }
    if (delta === 0) onCerrar();
    else onIr(delta);
  }
  const confirmar = () => guardarEIr(ultima ? 0 : 1, true);

  // Teclado: se lee la última versión de las funciones sin volver a suscribirse en cada cambio.
  const teclas = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    teclas.current = (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft" && indice > 0) {
        e.preventDefault();
        void guardarEIr(-1, false);
      } else if (e.key === "ArrowRight" && !ultima) {
        e.preventDefault();
        void guardarEIr(1, false);
      } else if (e.key === "r" || e.key === "R") {
        setReceta((r) => cambiarModo(r, "RECORTAR", ctx));
      } else if (e.key === "e" || e.key === "E") {
        setReceta((r) => cambiarModo(r, "ENCAJAR", ctx));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void confirmar();
      }
    };
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const pestanaClase = (p: "ENCUADRE" | "RETOQUE") =>
    `rounded-full border px-3 py-1.5 text-xs ${
      pestana === p ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]" : "border-[var(--fo-border)]"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className="fo-icon-btn" aria-label="Foto anterior" disabled={indice === 0 || guardando} onClick={() => void guardarEIr(-1, false)}>
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <span className="text-sm">
            Foto {indice + 1} de {total} · <span className="text-[var(--fo-muted)]">{foto.nombre}</span>
          </span>
          <button type="button" className="fo-icon-btn" aria-label="Foto siguiente" disabled={ultima || guardando} onClick={() => void guardarEIr(1, false)}>
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Qué editar">
          <button type="button" role="tab" aria-selected={pestana === "ENCUADRE"} className={pestanaClase("ENCUADRE")} onClick={() => setPestana("ENCUADRE")}>
            Encuadre
          </button>
          <button type="button" role="tab" aria-selected={pestana === "RETOQUE"} className={pestanaClase("RETOQUE")} onClick={() => setPestana("RETOQUE")}>
            Retoque
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div ref={contenedor} className="min-w-0 space-y-3">
          {pestana === "ENCUADRE" ? (
            <PapelConFoto
              src={src}
              foto={ctx.foto}
              receta={receta}
              papelMm={papelPieza}
              lado={lado}
              guias={guias}
              onArrastrar={(dx, dy) => setReceta((r) => ({ ...r, encuadre: moverEncuadre(r.encuadre, dx, dy, r.modo) }))}
              onZoom={(f) =>
                setReceta((r) => {
                  const a = aspectosDe(r, ctx);
                  return { ...r, encuadre: zoomEncuadre(r.encuadre, f, r.modo, a.af, a.ap) };
                })
              }
            />
          ) : (
            <VistaPieza src={src} receta={receta} papelMm={papelPieza} />
          )}
          {aviso ? (
            <p className={calidad.aviso === "PIXELADA" ? "fo-alert-error" : "fo-alert-warning"}>
              {aviso} ({calidad.ppp} ppp efectivos).
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {pestana === "ENCUADRE" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={receta.modo === "RECORTAR" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
                  onClick={() => setReceta((r) => cambiarModo(r, "RECORTAR", ctx))}
                >
                  Recortar (R)
                </button>
                <button
                  type="button"
                  className={receta.modo === "ENCAJAR" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
                  onClick={() => setReceta((r) => cambiarModo(r, "ENCAJAR", ctx))}
                >
                  Encajar (E)
                </button>
              </div>
              <label className="block space-y-1">
                <span className="flex justify-between text-sm">
                  <span>Zoom</span>
                  <span className="text-xs text-[var(--fo-muted)]">{coma(Math.round(nivel * 100) / 100)}×</span>
                </span>
                <input
                  type="range"
                  min={rango.min}
                  max={rango.max}
                  step={0.01}
                  value={nivel}
                  onChange={(e) => setReceta((r) => ({ ...r, encuadre: conZoom(r.encuadre, Number(e.target.value), r.modo, af, ap) }))}
                  className="w-full accent-[var(--fo-accent)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="flex justify-between text-sm">
                  <span>Enderezar</span>
                  <span className="text-xs text-[var(--fo-muted)]">{coma(receta.enderezar)}°</span>
                </span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.5}
                  value={receta.enderezar}
                  onChange={(e) => setReceta((r) => enderezarA(r, Number(e.target.value), ctx))}
                  className="w-full accent-[var(--fo-accent)]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => girar90(r, ctx))}>
                  <RotateCw className="size-4" aria-hidden />
                  Girar 90°
                </button>
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => cambiarOrientacion(r, ctx))}>
                  {receta.orientacion === "HORIZONTAL" ? <RectangleVertical className="size-4" aria-hidden /> : <RectangleHorizontal className="size-4" aria-hidden />}
                  {receta.orientacion === "HORIZONTAL" ? "Papel parado" : "Papel acostado"}
                </button>
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => volverALaPropuesta(r, ctx))}>
                  <Undo2 className="size-4" aria-hidden />
                  Volver a la propuesta
                </button>
              </div>
              {receta.modo === "ENCAJAR" ? (
                <label className="flex items-center gap-2 text-sm">
                  Color del borde
                  <input
                    type="color"
                    value={colorBordeDe(receta)}
                    onChange={(e) => setReceta((r) => ({ ...r, colorBorde: e.target.value.toLowerCase() }))}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--fo-border)]"
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={guias} onChange={(e) => setGuias(e.target.checked)} className="accent-[var(--fo-accent)]" />
                Guías (tercios y zona de seguridad de 3 mm)
              </label>
              <p className="text-xs text-[var(--fo-muted)]">
                Arrastrá la foto para moverla; con la rueda del mouse o el zoom la acercás o la achicás. Teclas: ← → foto anterior y
                siguiente, R recortar, E encajar, Enter confirma.
              </p>
            </>
          ) : (
            <Ajustes
              ajustes={receta.ajustes}
              onChange={(a) => setReceta((r) => ({ ...r, ajustes: a }))}
              onRestablecer={() => setReceta((r) => ({ ...r, ajustes: { ...AJUSTES_NEUTROS } }))}
              explicacion="Ajustes suaves de luz y color. Lo que ves al lado es una vista previa: la copia se arma desde la foto original, sin perder calidad."
            />
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-28">
              <span className="fo-label">Copias</span>
              <input
                type="number"
                min={1}
                max={CANTIDAD_MAX}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.min(CANTIDAD_MAX, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
                className="fo-input"
              />
            </label>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => onPegarATodas({ modo: receta.modo, cantidad })}>
              Usar este modo y cantidad en todas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-secondary" disabled={guardando} onClick={() => void guardarEIr(0, false)}>
              Volver a la grilla
            </button>
            <button type="button" className="fo-btn fo-btn-primary" disabled={guardando} onClick={() => void confirmar()}>
              <Check className="size-4" aria-hidden />
              {guardando ? "Guardando…" : ultima ? "Revisada (Enter)" : "Revisada, siguiente (Enter)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores.
Run: `pnpm --filter fotoffice exec eslint components/copias`
Expected: sin errores. Si la regla del compilador de React se queja de que `teclas.current` se asigna dentro de un efecto sin dependencias, dejarlo así (es el patrón documentado de "última versión de un callback") o, si da error, pasar las funciones a `useCallback`; no cambiar el comportamiento del teclado.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/components/copias/editor-una-foto.tsx
git commit -m "Copias: editor de una foto con arrastre, zoom, giro, guías, teclado y ajustes"
```

---
### Task 15: Grilla de copias: cargar varias fotos, lote, armar hojas y "Listo"

Tarea de interfaz. Las reglas (qué se guarda, "Revisada", total, avisos, subidas de a 3) ya están en módulos puros probados (Task 12); el componente sólo las usa.

**Files:**
- Create: `components/copias/tarjeta-foto.tsx`
- Create: `components/copias/editor-copias.tsx`

**Interfaces:**
- Consumes: acciones `estadoCopiasAction`, `guardarPiezasCopiaAction`, `quitarFotoCopiaAction` (Task 7), `generarHojaCopiaAction` (Task 8), `pedirSubidaOriginalAction`, `confirmarOriginalAction` (etapa 1); `propuestaAutomatica`, `papelOrientado`, `Papel` (Task 2); `calidadDeCopia` (Task 3); `EstadoCopias`, `FotoCopia` (Task 7); `aplicarGuardado`, `cambiosEnLote`, `totalDeCopias`, `textoDeAviso`, `FOTOS_MAX`, `CANTIDAD_MAX`, `CambioEnLote`, `PiezaAGuardar` (Task 12); `conLimite`, `validarArchivoFoto`, `SUBIDAS_A_LA_VEZ` (Task 12); `PapelConFoto` (Task 13); `EditorUnaFoto` (Task 14); `esNeutro` (ajustes).
- Produces:
  - `TarjetaFoto(props: { foto: FotoCopia; papel: Papel & { nombre: string }; salida: string; elegida: boolean; ocupado: boolean; onElegir: (v: boolean) => void; onAbrir: () => void; onCantidad: (n: number) => void; onQuitar: () => void })`.
  - `EditorCopias(props: { preparacionId: string; onListo: (r: { cantidad: number }) => void; onCancelar: () => void })` — lo usa el diálogo del Mostrador (Task 16) con `key={preparacionId}`.

- [ ] **Step 1: La tarjeta**

Crear `components/copias/tarjeta-foto.tsx`:
```tsx
"use client";

import { esNeutro } from "@/lib/impresion/ajustes";
import { papelOrientado, type Papel } from "@/lib/impresion/encuadre";
import { CANTIDAD_MAX, textoDeAviso } from "@/lib/impresion/lote";
import type { FotoCopia } from "@/lib/impresion/copias";
import { PapelConFoto } from "./papel-con-foto";

/** Una foto de la grilla (spec §6): sobre el papel real, con tamaño, impresora, cantidad, aviso, ajustes y "Revisada". */
export function TarjetaFoto({
  foto,
  papel,
  salida,
  elegida,
  ocupado,
  onElegir,
  onAbrir,
  onCantidad,
  onQuitar,
}: {
  foto: FotoCopia;
  papel: Papel & { nombre: string };
  salida: string;
  elegida: boolean;
  ocupado: boolean;
  onElegir: (v: boolean) => void;
  onAbrir: () => void;
  onCantidad: (n: number) => void;
  onQuitar: () => void;
}) {
  const p = foto.pieza;
  const aviso = p ? textoDeAviso(p.aviso, papel.nombre) : null;
  return (
    <li className="fo-card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={elegida} onChange={(e) => onElegir(e.target.checked)} className="accent-[var(--fo-accent)]" />
          Elegir
        </label>
        {p?.revisada ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Revisada</span> : null}
      </div>
      <button type="button" className="mx-auto block" onClick={onAbrir} aria-label={`Editar ${foto.nombre}`}>
        {p ? (
          <PapelConFoto
            src={`/api/impresion/vista/${foto.originalId}`}
            foto={{ ancho: foto.ancho, alto: foto.alto }}
            receta={p.receta}
            papelMm={papelOrientado(papel, p.receta.orientacion ?? "VERTICAL")}
            lado={176}
          />
        ) : (
          <span className="flex size-44 items-center justify-center rounded-[var(--fo-radius-sm)] bg-black/10 text-xs">Sin armar</span>
        )}
      </button>
      <p className="truncate text-xs text-[var(--fo-muted)]" title={foto.nombre}>
        {papel.nombre} · {salida} · {p?.receta.modo === "ENCAJAR" ? "encajada" : "recortada"}
        {p && !esNeutro(p.receta.ajustes) ? " · ● con ajustes" : ""}
      </p>
      {aviso ? <p className={p?.aviso === "PIXELADA" ? "text-xs font-medium text-[var(--fo-danger)]" : "text-xs text-amber-700"}>{aviso}</p> : null}
      <div className="flex items-end gap-2">
        <label className="text-xs">
          Copias
          <input
            key={p?.cantidad ?? 0}
            type="number"
            min={1}
            max={CANTIDAD_MAX}
            defaultValue={p?.cantidad ?? 1}
            disabled={!p || ocupado}
            onBlur={(e) => onCantidad(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="fo-input mt-0.5 h-8 w-16"
          />
        </label>
        <button type="button" className="fo-btn fo-btn-secondary ml-auto h-8 px-2 text-xs" onClick={onAbrir}>
          Editar
        </button>
        <button type="button" className="fo-btn fo-btn-danger-outline h-8 px-2 text-xs" disabled={ocupado} onClick={onQuitar}>
          Quitar
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: El editor de copias**

Crear `components/copias/editor-copias.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, LayoutGrid, Printer } from "lucide-react";
import { papelOrientado, propuestaAutomatica } from "@/lib/impresion/encuadre";
import { calidadDeCopia } from "@/lib/impresion/geometria";
import { CANTIDAD_MAX, FOTOS_MAX, aplicarGuardado, cambiosEnLote, totalDeCopias, type CambioEnLote, type PiezaAGuardar } from "@/lib/impresion/lote";
import { SUBIDAS_A_LA_VEZ, conLimite, validarArchivoFoto } from "@/lib/impresion/subidas";
import type { EstadoCopias, FotoCopia } from "@/lib/impresion/copias";
import {
  confirmarOriginalAction,
  estadoCopiasAction,
  generarHojaCopiaAction,
  guardarPiezasCopiaAction,
  pedirSubidaOriginalAction,
  quitarFotoCopiaAction,
} from "@/app/(shell)/ventas/impresion/actions";
import { EditorUnaFoto } from "./editor-una-foto";
import { TarjetaFoto } from "./tarjeta-foto";

/** Error con un texto que se le puede mostrar a quien atiende. */
class ErrorVisible extends Error {}

/**
 * Copias instantáneas (spec §6 y §9): se cargan las fotos que trae el cliente, cada una llega con
 * la propuesta automática, se revisan en la grilla o de a una, y se arman las hojas (una por foto,
 * de a una llamada). "Listo" vuelve al ticket con el total de copias. El navegador sólo guarda
 * recetas: los archivos los arma el servidor desde el original.
 */
export function EditorCopias({
  preparacionId,
  onListo,
  onCancelar,
}: {
  preparacionId: string;
  onListo: (r: { cantidad: number }) => void;
  onCancelar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoCopias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisosSubida, setAvisosSubida] = useState<string[]>([]);
  const [subida, setSubida] = useState<{ hechas: number; total: number } | null>(null);
  const [armado, setArmado] = useState<{ hechas: number; total: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [cantidadLote, setCantidadLote] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let vigente = true;
    estadoCopiasAction(preparacionId)
      .then((e) => {
        if (!vigente) return;
        if (!e) setError("Esa preparación ya no existe. Cerrá y volvé a tocar «Preparar».");
        else setEstado(e);
      })
      .catch(() => {
        if (vigente) setError("No se pudo leer lo ya preparado. Probá de nuevo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [preparacionId]);

  const fotos = estado?.fotos ?? [];
  const papel = estado ? { ...estado.papel } : null;
  const total = totalDeCopias(fotos);
  const todasArmadas = fotos.length > 0 && fotos.every((f) => f.hoja !== null);
  const trabajando = ocupado || subida !== null || armado !== null;

  async function guardar(items: PiezaAGuardar[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const r = await guardarPiezasCopiaAction(preparacionId, items);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      return false;
    }
    setError(null);
    setEstado((e) => (e ? { ...e, fotos: aplicarGuardado(e.fotos, items, e.papel) } : e));
    return true;
  }

  /** Una foto: pedir la subida, subirla directo a R2, confirmarla y guardar su propuesta automática. */
  async function subirUna(file: File, tipo: string): Promise<void> {
    if (!estado) return;
    const s = await pedirSubidaOriginalAction(preparacionId, { nombre: file.name, tipo, bytes: file.size });
    if (!s.ok) throw new ErrorVisible(s.error);
    const put = await fetch(s.url, { method: "PUT", headers: { "Content-Type": tipo }, body: file });
    if (!put.ok) throw new ErrorVisible("No se pudo subir. Probá de nuevo.");
    const c = await confirmarOriginalAction(s.originalId);
    if (!c.ok) throw new ErrorVisible(c.error);
    const receta = propuestaAutomatica(c.ancho, c.alto, estado.papel);
    const g = await guardarPiezasCopiaAction(preparacionId, [{ originalId: c.originalId, cantidad: 1, receta, revisada: false }]);
    if (!g.ok) throw new ErrorVisible(g.error);
    const calidad = calidadDeCopia({ ancho: c.ancho, alto: c.alto }, receta, papelOrientado(estado.papel, receta.orientacion ?? "VERTICAL"));
    const nueva: FotoCopia = {
      originalId: c.originalId,
      nombre: file.name,
      ancho: c.ancho,
      alto: c.alto,
      pieza: { receta, cantidad: 1, revisada: false, ...calidad },
      hoja: null,
    };
    setEstado((e) => (e ? { ...e, fotos: [...e.fotos, nueva] } : e));
  }

  async function subir(lista: File[]) {
    if (!estado || lista.length === 0) return;
    const avisos: string[] = [];
    const validos: { file: File; tipo: string }[] = [];
    const lugar = FOTOS_MAX - fotos.length;
    for (const file of lista) {
      const v = validarArchivoFoto(file);
      if (!v.ok) avisos.push(`${file.name}: ${v.error}`);
      else if (validos.length >= lugar) avisos.push(`${file.name}: una preparación admite hasta ${FOTOS_MAX} fotos.`);
      else validos.push({ file, tipo: v.tipo });
    }
    setAvisosSubida(avisos);
    if (validos.length === 0) return;
    setSubida({ hechas: 0, total: validos.length });
    const resultados = await conLimite(validos, SUBIDAS_A_LA_VEZ, async ({ file, tipo }) => {
      try {
        await subirUna(file, tipo);
      } finally {
        setSubida((s) => (s ? { ...s, hechas: s.hechas + 1 } : s));
      }
    });
    resultados.forEach((r, i) => {
      if (r.status === "rejected") {
        const motivo = r.reason instanceof ErrorVisible ? r.reason.message : "no se pudo subir. Probá de nuevo.";
        avisos.push(`${validos[i]!.file.name}: ${motivo}`);
      }
    });
    setAvisosSubida([...avisos]);
    setSubida(null);
  }

  async function enLote(cambio: CambioEnLote, soloElegidas: boolean) {
    if (!estado) return;
    setOcupado(true);
    await guardar(cambiosEnLote(estado.fotos, soloElegidas ? elegidas : new Set(), cambio, estado.papel));
    setOcupado(false);
  }

  async function cambiarCantidad(f: FotoCopia, n: number) {
    if (!f.pieza) return;
    const cantidad = Math.min(CANTIDAD_MAX, Math.max(1, Math.round(n) || 1));
    if (cantidad === f.pieza.cantidad) return;
    await guardar([{ originalId: f.originalId, receta: f.pieza.receta, cantidad, revisada: false }]);
  }

  async function quitar(f: FotoCopia) {
    if (!confirm(`¿Quitar «${f.nombre}» de la preparación?`)) return;
    setOcupado(true);
    try {
      const r = await quitarFotoCopiaAction(preparacionId, f.originalId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEstado((e) => (e ? { ...e, fotos: e.fotos.filter((x) => x.originalId !== f.originalId) } : e));
      setElegidas((s) => {
        const n = new Set(s);
        n.delete(f.originalId);
        return n;
      });
    } catch {
      setError("No se pudo quitar la foto. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  /** Una foto sin pieza (falló el guardado al subirla): se le guarda la propuesta antes de abrirla. */
  async function abrir(f: FotoCopia) {
    if (!estado) return;
    if (!f.pieza) {
      const receta = propuestaAutomatica(f.ancho, f.alto, estado.papel);
      if (!(await guardar([{ originalId: f.originalId, receta, cantidad: 1, revisada: false }]))) return;
    }
    setAbierta(f.originalId);
  }

  /** Arma las hojas que falten, de a una foto por llamada (nada de pedidos largos). */
  async function armarHojas(): Promise<boolean> {
    const faltan = fotos.filter((f) => f.pieza && !f.hoja);
    if (faltan.length === 0) return true;
    setArmado({ hechas: 0, total: faltan.length });
    try {
      for (const [i, f] of faltan.entries()) {
        const r = await generarHojaCopiaAction(preparacionId, f.originalId);
        if (!r.ok) {
          setError(`${f.nombre}: ${r.error}`);
          return false;
        }
        setEstado((e) =>
          e ? { ...e, fotos: e.fotos.map((x) => (x.originalId === f.originalId ? { ...x, hoja: { id: r.hojaId, version: r.version, copias: r.copias } } : x)) } : e,
        );
        setArmado({ hechas: i + 1, total: faltan.length });
      }
      return true;
    } catch {
      setError("No se pudieron armar todas las hojas. Probá de nuevo: las ya armadas no se rehacen.");
      return false;
    } finally {
      setArmado(null);
    }
  }

  async function listo() {
    if (fotos.length === 0) return;
    if (fotos.some((f) => f.pieza?.aviso === "PIXELADA") && !confirm("Hay fotos que se van a ver pixeladas. ¿Imprimirlas igual?")) return;
    if (await armarHojas()) onListo({ cantidad: total });
  }

  if (cargando) return <p className="text-sm text-[var(--fo-muted)]">Buscando lo ya preparado…</p>;
  if (!estado || !papel) {
    return (
      <div className="space-y-3">
        <p className="fo-alert-error">{error ?? "No se pudo abrir la preparación."}</p>
        <button type="button" className="fo-btn fo-btn-secondary" onClick={onCancelar}>
          Volver al ticket
        </button>
      </div>
    );
  }

  const indice = abierta ? fotos.findIndex((f) => f.originalId === abierta) : -1;
  const actual = indice >= 0 ? fotos[indice] : undefined;
  if (actual?.pieza) {
    return (
      <div className="space-y-4">
        {error ? <p className="fo-alert-error">{error}</p> : null}
        <EditorUnaFoto
          key={actual.originalId}
          foto={{ ...actual, pieza: actual.pieza }}
          papel={papel}
          indice={indice}
          total={fotos.length}
          onGuardar={({ receta, cantidad, revisada }) => guardar([{ originalId: actual.originalId, receta, cantidad, revisada }])}
          onIr={(d) => setAbierta(fotos[indice + d]?.originalId ?? null)}
          onPegarATodas={(c) => void enLote(c, false)}
          onCerrar={() => setAbierta(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="fo-alert-error">{error}</p> : null}

      <section className="fo-card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Copias {papel.nombre} · {estado.salida}
            </h2>
            <p className="text-xs text-[var(--fo-muted)]">
              {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} · {total} {total === 1 ? "copia" : "copias"}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const lista = Array.from(e.target.files ?? []);
              e.currentTarget.value = "";
              void subir(lista);
            }}
          />
          <button type="button" className="fo-btn fo-btn-primary" disabled={trabajando || fotos.length >= FOTOS_MAX} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
            {subida ? `Subiendo ${subida.hechas} de ${subida.total}…` : "Agregar fotos"}
          </button>
        </div>
        <p className="text-xs text-[var(--fo-muted)]">
          JPG, PNG o WebP de hasta 60 MB, hasta {FOTOS_MAX} fotos. Cada foto llega con una propuesta: si se pierde poco se recorta; si no,
          se encaja con borde blanco. Tocá una foto para moverla, hacer zoom o retocarla.
        </p>
        {avisosSubida.length > 0 ? (
          <ul className="fo-alert-warning list-disc space-y-1 pl-5 text-sm">
            {avisosSubida.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {fotos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{elegidas.size > 0 ? `${elegidas.size} ${elegidas.size === 1 ? "elegida" : "elegidas"}:` : "A todas:"}</span>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ modo: "RECORTAR" }, true)}>
              Recortar
            </button>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ modo: "ENCAJAR" }, true)}>
              Encajar
            </button>
            <label className="flex items-center gap-1 text-xs">
              Copias
              <input
                type="number"
                min={1}
                max={CANTIDAD_MAX}
                value={cantidadLote}
                onChange={(e) => setCantidadLote(Math.min(CANTIDAD_MAX, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
                className="fo-input h-8 w-16"
              />
            </label>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ cantidad: cantidadLote }, true)}>
              Aplicar copias
            </button>
            <button
              type="button"
              className="ml-auto text-xs underline"
              onClick={() => setElegidas(elegidas.size === fotos.length ? new Set() : new Set(fotos.map((f) => f.originalId)))}
            >
              {elegidas.size === fotos.length ? "Ninguna" : "Elegir todas"}
            </button>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {fotos.map((f) => (
              <TarjetaFoto
                key={f.originalId}
                foto={f}
                papel={papel}
                salida={estado.salida}
                elegida={elegidas.has(f.originalId)}
                ocupado={trabajando}
                onElegir={(v) =>
                  setElegidas((s) => {
                    const n = new Set(s);
                    if (v) n.add(f.originalId);
                    else n.delete(f.originalId);
                    return n;
                  })
                }
                onAbrir={() => void abrir(f)}
                onCantidad={(n) => void cambiarCantidad(f, n)}
                onQuitar={() => void quitar(f)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="fo-btn fo-btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="fo-btn fo-btn-secondary" disabled={trabajando || fotos.length === 0 || todasArmadas} onClick={() => void armarHojas()}>
            <LayoutGrid className="size-4" aria-hidden />
            {armado ? `Armando ${armado.hechas} de ${armado.total}…` : todasArmadas ? "Hojas armadas" : "Armar hojas"}
          </button>
          <button
            type="button"
            className="fo-btn fo-btn-secondary"
            disabled={!todasArmadas || trabajando}
            onClick={() => window.open(`/imprimir/preparacion/${preparacionId}`, "_blank")}
          >
            <Printer className="size-4" aria-hidden />
            Imprimir todo
          </button>
          <button type="button" className="fo-btn fo-btn-primary" disabled={fotos.length === 0 || trabajando} onClick={() => void listo()}>
            <Check className="size-4" aria-hidden />
            Listo · {total} {total === 1 ? "copia" : "copias"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint y pruebas**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores.
Run: `pnpm --filter fotoffice exec eslint components/copias`
Expected: sin errores.
Run: `pnpm --filter fotoffice test -- lib/impresion components`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/components/copias
git commit -m "Copias: grilla con carga múltiple, acciones en lote, armado de hojas y Listo"
```

---

### Task 16: "Preparar" copias desde el Mostrador

Tarea de interfaz sobre `pos.tsx` (1700 líneas, lo tocan otras sesiones): el cambio se limita al botón de la línea y al diálogo. No reordenar ni reformatear nada más.

**Files:**
- Modify: `app/(shell)/ventas/dialogo-preparar.tsx` (archivo entero)
- Modify: `app/(shell)/ventas/pos.tsx` (import de íconos, comentario de la línea ~184, mensaje de error de `abrirPreparacion`, botón de la línea ~1109 y diálogo de la línea ~1531)

**Interfaces:**
- Consumes: `EditorCopias` (Task 15), `EditorFotoCarnet` (etapa 1), `produccionDeProductosAction` (devuelve `tipoPieza` por producto).
- Produces: `DialogoPreparar(props: { preparacionId: string; tipoPieza: "CARNET" | "COPIA"; cliente: ClienteBuscado | null; produccion: { salida: string; hoja: string }; permisos: { puedeBuscarClientes: boolean; puedeAltaCliente: boolean }; onListo: (r: { cantidad: number; preparacionId: string }) => void; onCerrar: () => void })`.

- [ ] **Step 1: El diálogo**

Reemplazar `app/(shell)/ventas/dialogo-preparar.tsx` entero por:
```tsx
"use client";

import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import { EditorCopias } from "@/components/copias/editor-copias";
import type { ClienteBuscado } from "./mostrador-actions";

/**
 * El editor de la línea (foto carnet o copias) a pantalla completa, sin salir del Mostrador (el
 * ticket vive sólo en esta pantalla). `data-mostrador-modal` apaga los atajos de teclado del
 * Mostrador mientras está abierto: si no, Esc vaciaría el ticket y los números cambiarían cantidades.
 */
export function DialogoPreparar({
  preparacionId,
  tipoPieza,
  cliente,
  produccion,
  permisos,
  onListo,
  onCerrar,
}: {
  preparacionId: string;
  tipoPieza: "CARNET" | "COPIA";
  cliente: ClienteBuscado | null;
  produccion: { salida: string; hoja: string };
  permisos: { puedeBuscarClientes: boolean; puedeAltaCliente: boolean };
  /** `cantidad`: lo que pasa a la línea del ticket (planchas en carnet, total de copias en copias). */
  onListo: (r: { cantidad: number; preparacionId: string }) => void;
  onCerrar: () => void;
}) {
  const copias = tipoPieza === "COPIA";
  const titulo = copias ? `Preparar copias ${produccion.hoja}`.trim() : "Preparar foto carnet";
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} data-mostrador-modal className="fixed inset-0 z-50 overflow-y-auto bg-[var(--fo-bg)] p-4 sm:p-8">
      <div className={`mx-auto space-y-4 ${copias ? "max-w-6xl" : "max-w-5xl"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={onCerrar}>
            Volver al ticket
          </button>
        </div>
        {copias ? (
          <EditorCopias key={preparacionId} preparacionId={preparacionId} onListo={({ cantidad }) => onListo({ cantidad, preparacionId })} onCancelar={onCerrar} />
        ) : (
          <EditorFotoCarnet
            key={preparacionId}
            {...permisos}
            modo={{
              tipo: "mostrador",
              preparacionId,
              clienteInicial: cliente,
              produccion,
              onListo: ({ hojas }) => onListo({ cantidad: hojas, preparacionId }),
              onCancelar: onCerrar,
            }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: El Mostrador**

En `app/(shell)/ventas/pos.tsx`:

1. En el import de `lucide-react` (empieza en la línea 4), agregar `Images,` en la lista (por ejemplo, justo antes de `IdCard,`).

2. Cambiar el comentario
```ts
  // Impresión (foto carnet): qué productos se preparan, la preparación de cada renglón (por key,
```
por
```ts
  // Impresión (foto carnet y copias): qué productos se preparan, la preparación de cada renglón (por key,
```

3. En `abrirPreparacion`, cambiar
```ts
        return setError("No se pudo abrir la foto carnet. Probá de nuevo.");
```
por
```ts
        return setError("No se pudo abrir la preparación. Probá de nuevo.");
```

4. Reemplazar el bloque del botón (desde `{r.productId !== null && produccion[r.productId]?.tipoPieza === "CARNET" ? (` hasta su `) : null}`) por:
```tsx
                      {r.productId !== null && (produccion[r.productId]?.tipoPieza === "CARNET" || produccion[r.productId]?.tipoPieza === "COPIA") ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-secondary mt-1 h-7 px-2 text-xs"
                          disabled={abriendoPreparacion !== null || procesando}
                          onClick={(e) => {
                            e.stopPropagation();
                            void abrirPreparacion(r);
                          }}
                        >
                          {produccion[r.productId]?.tipoPieza === "COPIA" ? <Images className="size-3.5" aria-hidden /> : <IdCard className="size-3.5" aria-hidden />}
                          {abriendoPreparacion === r.key ? "Abriendo…" : preparaciones[r.key] ? "Editar fotos" : "Preparar"}
                        </button>
                      ) : null}
```

5. Reemplazar el bloque del diálogo (desde `{preparando ? (` hasta el `) : null}` que cierra `<DialogoPreparar … />`) por:
```tsx
      {preparando
        ? (() => {
            const pid = rows.find((x) => x.key === preparando.key)?.productId;
            const p = pid ? produccion[pid] : undefined;
            return (
              <DialogoPreparar
                preparacionId={preparando.preparacionId}
                tipoPieza={p?.tipoPieza === "COPIA" ? "COPIA" : "CARNET"}
                cliente={cliente}
                produccion={{ salida: p?.salida ?? "", hoja: p?.hoja ?? "" }}
                permisos={permisosCarnet}
                onListo={({ cantidad }) => {
                  // La cantidad del renglón: planchas (carnet) o el total de copias (se puede deshacer como cualquier cambio).
                  actualizarCantidad(preparando.key, cantidad);
                  setPreparando(null);
                }}
                onCerrar={() => setPreparando(null)}
              />
            );
          })()
        : null}
```

- [ ] **Step 3: Typecheck, lint y pruebas**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores.
Run: `pnpm --filter fotoffice exec eslint "app/(shell)/ventas/pos.tsx" "app/(shell)/ventas/dialogo-preparar.tsx"`
Expected: sin errores. Si `pos.tsx` ya tenía avisos antes de esta tarea (mirar con `git stash` o en `origin/main`), no son de esta tarea: no tocarlos.
Run: `pnpm --filter fotoffice test`
Expected: PASS (suite completa).

- [ ] **Step 4: Commit**

```bash
git add "apps/fotoffice/app/(shell)/ventas/dialogo-preparar.tsx" "apps/fotoffice/app/(shell)/ventas/pos.tsx"
git commit -m "Mostrador: Preparar copias abre el editor y la línea toma el total de copias"
```

---

### Task 17: Verificación final y PR

**Files:** ninguno nuevo (sólo arreglos que aparezcan).

- [ ] **Step 1: Suite completa**

Run: `pnpm --filter fotoffice test`
Expected: PASS, cero fallas.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores y sin "heap out of memory" en la salida (si aparece, el éxito es falso: correr con `NODE_OPTIONS=--max-old-space-size=8192`).

- [ ] **Step 3: Lint**

Run: `pnpm --filter fotoffice lint`
Expected: sin errores.

- [ ] **Step 4: Build**

Run: `pnpm --filter fotoffice build`
Expected: termina bien (el build también chequea tipos).

- [ ] **Step 5: Revisar el alcance**

Run: `git diff --stat origin/main...HEAD`
Expected: sólo archivos de este plan (`lib/impresion/*`, `components/copias/*`, `components/foto-carnet/{vistas,ajustes}.tsx`, `app/imprimir/preparacion/*`, `app/(shell)/ventas/{pos.tsx,dialogo-preparar.tsx,impresion/actions.ts,impresiones/*,catalogo/[productId]/produccion-section.tsx}`, `lib/circuitos/base-en-memoria.ts` y este plan). **Ninguna migración** en `packages/db/prisma/migrations` y ningún cambio en `package.json` ni en el lockfile.

- [ ] **Step 6: Push y PR**

```bash
git push -u origin feat/fotoffice-impresiones-etapa-2
gh pr create --title "FOTOFFICE · Impresiones etapa 2: copias instantáneas en la Kodak" --body "$(cat <<'EOF'
## Qué hace

- **Copias 10x15, 13x18 y 15x20 desde el Mostrador.** Un producto "Copia" (se cobra por copia) muestra **Preparar** en el ticket: se cargan varias fotos a la vez y cada una llega con una propuesta (recortar si se pierde 8 % o menos; si no, encajar con borde blanco).
- **Grilla sobre el papel real**: lo que se corta, sombreado; el borde, visible. Cantidad, aviso de calidad y "Revisada" por foto; recortar, encajar o poner la misma cantidad a todas (o a las elegidas).
- **Editor de una foto**: arrastrar, zoom con rueda o deslizador, girar 90°, enderezar ±10°, papel parado o acostado, volver a la propuesta, guías de tercios y zona de seguridad de 3 mm, teclado ← → R E Enter, y los ajustes de la etapa 1.
- **El archivo lo arma el servidor** desde el original: en ENCAJAR el borde queda exactamente del color elegido (los ajustes y la nitidez van sólo sobre la foto). La vista previa coincide con el final (ΔE < 2, también encajada).
- **Una hoja por foto**, armada de a una llamada; **Imprimir todo** saca todas en un documento (cada hoja tantas veces como copias) y pregunta "¿Cómo salió?" por hoja: las copias que salieron mal se registran descartadas y se reimprimen solas.
- La cola de **Impresiones** muestra cuántas fotos tiene cada preparación e imprime lo que falta.
- **Sin migración ni dependencias nuevas.** Las recetas de foto carnet dan exactamente el mismo archivo que antes (prueba byte a byte).

## Para probar en el local (Daniel)

1. Catálogo → un producto "Copia 10x15": Producción en el local → Copia · Kodak 305 · 10x15 · por copia.
2. Mostrador → agregarlo → Preparar → cargar 5 fotos del celular (una acostada, una parada, una panorámica, una de WhatsApp chiquita).
3. Revisar la grilla, encajar una, cambiar cantidades, abrir una foto y moverla.
4. Listo → la línea toma el total de copias → Imprimir todo en la Kodak → "¿Cómo salió?".
5. Editar una foto ya impresa → Impresiones → Imprimir (sólo sale esa).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: devuelve la URL del PR.

---
## Autorrevisión (hecha al escribir el plan)

**1. Cobertura del spec (etapa 2):**

| Spec | Dónde |
|---|---|
| §4.3 producto COPIA, salida y hoja fijas, se vende por copia | Task 6 |
| §5.1 receta con `modo`, `orientacion`, `colorBorde` (el `ubicacion` del spec lo reemplaza el encuadre extendido, decisión 2) | Task 1 |
| §5.2 pasos 1–8 con ENCAJAR (componer sobre el papel del borde; ajustes y nitidez sólo en la foto) | Task 4 |
| §5.3 vista previa con la misma cuenta y prueba de coincidencia ΔE < 2 | Tasks 3, 5, 13 |
| §5.4 aviso de calidad 200/150 ppp con el nombre del papel; pixelada pide confirmación | Tasks 3, 12, 14, 15 |
| §5.5 propuesta automática (8 %, orientación de la foto, "Volver a la propuesta") | Tasks 2, 14 |
| §6 grilla sobre el papel real, sombreado/borde, lote (modo y cantidad, todas o elegidas), tarjeta completa, "Revisada" | Tasks 12, 13, 15 |
| §6 editor: arrastre, rueda/deslizador, mínimo por modo, girar, enderezar, orientación, propuesta, guías, teclado ← → R E Enter | Tasks 2, 13, 14 |
| §8.1 varias hojas distintas en páginas consecutivas del mismo documento, `@page` exacto con corrección de escala, "Descargar JPG" | Tasks 4 (hoja parada), 9, 11 |
| §9.1–9.2 preparar antes o después de cobrar, la línea toma la cantidad, "Editar fotos" reabre | Tasks 7, 15, 16 |
| §9.3 colas (para imprimir, sin cobrar, impreso hoy) con copias | Task 10 |
| §9.4 registro por hoja, NORMAL/DESCARTADA, "Salió mal, reimprimir" | Tasks 9, 11 |
| §14 sin tablas nuevas (alcanzan las de la etapa 1) | Decisiones; Task 17 lo verifica |

Fuera de esta etapa, a propósito: Espacio para antes/después, Auto, B/N, Sepia y copiar/pegar ajustes (etapa 3); margen sin bordes; laboratorio (etapa 4); planchas escolares (etapa 5); polaroid (etapa 6).

**2. Marcadores:** no quedan "TBD", "TODO" ni pasos sin código; los pasos de interfaz traen el componente entero.

**3. Nombres y tipos entre tareas:** `propuestaAutomatica`, `papelOrientado`, `aspectosDe`, `cambiarModo`, `moverEncuadre`, `zoomEncuadre`, `conZoom`, `nivelDeZoom`, `rangoDeZoom`, `aspectoCoincide`, `colocacionEnPantalla` (Task 2); `planDeRecorte`, `calidadDeCopia`, `AvisoCalidad` (Task 3); `componerCopia` (Task 4); `hojasVigentes`, `estadoSegunHojas`, `recalcularEstado`, `disposicionDeCopia`, `normalesPorHoja`, `hojasConRegistro` (Task 7); `guardarPiezasCopia`, `estadoCopias`, `quitarFotoCopia`, `FotoCopia`, `EstadoCopias`, `PiezaCopiaEntrada` (Task 7); `generarHojaCopia` (Task 8); `registrarImpresiones`, `datosParaImprimirPreparacion`, `HojaAImprimir`, `RegistroDeHoja`, `paginas`, `pendientes`, `registrosDeRespuesta` (Task 9); `PiezaAGuardar`, `CambioEnLote`, `cambiosEnLote`, `aplicarGuardado`, `totalDeCopias`, `textoDeAviso`, `FOTOS_MAX`, `CANTIDAD_MAX`, `conLimite`, `validarArchivoFoto`, `SUBIDAS_A_LA_VEZ` (Tasks 7 y 12). Se usan con la misma firma en las tareas de interfaz.

**4. Review Focus:** cada uno de los cinco tiene su prueba en la tarea dueña del código (Tasks 2, 3, 4, 7 y 9).

**Ejecución recomendada:** subagentes (superpowers:subagent-driven-development), una tarea por subagente con revisión entre tareas: las tareas 7–9 comparten la lógica de hojas vigentes y estado, y un error ahí deja preparaciones mal marcadas en la cola.
