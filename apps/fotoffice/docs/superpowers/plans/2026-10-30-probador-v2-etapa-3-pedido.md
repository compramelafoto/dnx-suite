# Probador de cuadros v2 — Etapa 3 (Pedido pago y paso a paso) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cliente arme sus cuadros desde el celular con un paso a paso muy simple, suba sus fotos, pague con Mercado Pago, y que el estudio reciba en el laboratorio los archivos ya recortados (con la envoltura del canvas) y un mapa de armado.

**Architecture:**
- El pedido es un `FotofficePrintOrder` con `source = "PROBADOR"`. Cada cuadro es un `FotofficePrintOrderItem` con su receta en una columna Json nueva, `probador`.
- Pago, webhook, acreditación, Caja, trabajo y ZIP son los de Pedidos de impresión. En la preparación se suma una rama: los ítems con `probador` se renderizan con sharp a su medida.
- Las fotos del cliente suben directo al R2 privado con PUT firmado, sin sesión.
- La página pública pasa a ser un asistente de 6 pasos. Usa el mismo motor del editor, mostrando solo los controles de cada paso.

**Tech Stack:** Next.js (app de FOTOFFICE), Prisma, sharp, R2 (S3), Mercado Pago Checkout Pro y Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-30-probador-de-cuadros-v2-design.md` (secciones 5.5, 7.2, 7.3, 7.5 y 8), más el pedido de Daniel del 30/10: "un entorno público tipo wizard, muy simple, todo desde el celular".

## Global Constraints

- **Envoltura del canvas:** 5 cm por lado, con la misma imagen agrandada y desenfocada (decisión del spec; Daniel no la cambió).
- **Contabilidad:** Caja, igual que Pedidos de impresión. No se crea `Sale`.
- **PPP de salida:**

  | Lado largo del cuadro | PPP |
  |---|---|
  | Hasta 45 cm | 300 |
  | Hasta 90 cm | 200 |
  | Más de 90 cm | 150 |

- **Subida:**
  - hasta 10 fotos, de hasta 40 MB cada una;
  - formatos JPEG, PNG, WebP o HEIC;
  - clave `fotoffice/probador/<workspaceId>/<borrador>/<n>.<ext>`;
  - firma de 600 s.
- **Límites de uso:** 20 pedidos de subida y 10 pedidos de compra por IP cada 10 minutos.
- **Precios:** el servidor los recalcula siempre con `cargarCatalogoProbador`. Un cuadro sin precio (por ejemplo, "Con marco") no se puede pedir.
- **Cuándo se puede pedir:** solo con el módulo Pedidos de impresión encendido y Mercado Pago conectado. Si no, el asistente termina en "Escribinos para encargarlo".
- **Muestras:** no se pueden pedir cuadros con las fotos de muestra.
- **Dominio propio:** `probador-de-cuadros` se abre siempre en fotoffice.com (`SITE_SEGMENTS_ON_FOTOFFICE`), así la subida no choca con el CORS del bucket.
- **Purga:** el cron de impresiones borra los originales del probador de pedidos sin pagar a las 72 h, y los de pedidos pagados a los 60 días.
- **Migración:** a mano en la base de producción, antes de fusionar (regla de FOTOFFICE).
- **Textos:** español rioplatense, cortos, para cualquier persona.

## Review Focus

1. **El cliente sale del asistente a mitad de camino y vuelve.** No tiene que haber datos a medias en la base: el pedido se crea recién en el último paso. Prueba en Task 2: `validarPedido` rechaza un pedido sin fotos subidas.
2. **El precio cambió entre que armó y pagó.** El servidor cobra el precio vigente y avisa si difiere del que vio el cliente. Prueba en Task 2.
3. **Una foto chica en un cuadro grande.** El render no falla y el asistente avisa la calidad baja. Prueba en Task 1: el plan de salida con escala > 1.
4. **Inclinación con envoltura de canvas.** El borde nunca queda negro ni transparente, porque la envoltura sale del frente desenfocado. Prueba en Task 1: dimensiones con envoltura.
5. **Una foto HEIC del iPhone.** Si sharp no la lee, el pedido queda PAGADO_SIN_ENVIAR con un motivo claro (ya lo hace la preparación). El asistente convierte a JPEG en el navegador antes de subir cuando el navegador puede leerla.

---

### Task 1: Archivo final de cada cuadro (puro, con pruebas)

**Files:**
- Create: `lib/probador/salida.ts`
- Test: `lib/probador/salida.test.ts`

**Interfaces:**
- `pppPara(w: number, h: number): 300 | 200 | 150`.
- `type RecetaProbador = { tipo; marco: {w,h}; ventana: {x,y,w,h}; encuadre: Encuadre; envolturaCm: number; orden: number; total: number }`. `ventana` es la posición del cuadro dentro del marco del encuadre, en cm.
- `planDeSalida(r: RecetaProbador, foto: {w,h}) → { ppp; frente: {w,h} px; total: {w,h} px; escala: number; theta: number; origen: {x,y} }`.
  - `frente` es la medida del cuadro a ese ppp; `total` es esa medida más la envoltura de los dos lados.
  - `escala` son px de salida por px de la foto (ya girada de a 90°).
  - `origen` es el punto de la foto girada, en px, que cae en la esquina superior izquierda del frente.
- `origenTrasGirar(origen, escala, theta, escalada: {w,h}, girada: {w,h}) → {x,y}`: dónde queda ese punto después de escalar la foto y girarla `theta` con sharp (girar sobre el centro, lienzo agrandado).
- `rutaEnZip(numero, cliente, receta) → string`, por ejemplo `Pedido 12 - Ana/Canvas 30x40/Cuadro 2 de 5.jpg`.
- `mapaDeArmado(comp: { cuadros: {x,y,w,h,tipo}[] }, numero, cliente) → { svg: string; texto: string }`.

Pruebas:
- `pppPara`: 30×45 da 300, 50×70 da 200, 70×100 da 150.
- Sin inclinación y con escala 1: `origen = (fx − W/2/s, fy − H/2/s)`, y `origenTrasGirar` con theta 0 da `origen × escala`.
- El canvas 30×40 a 300 ppp mide `frente = 3543×4724` y `total = 4724×5906`, por los 5 cm por lado.
- `rutaEnZip` limpia caracteres raros en el nombre del cliente.
- El texto del mapa dice "Cuadro 1 · Canvas 30 × 40 cm · a 0 cm de la izquierda".

### Task 2: Validar el pedido (puro, con pruebas)

**Files:**
- Create: `lib/probador/pedido.ts`
- Test: `lib/probador/pedido.test.ts`

**Interfaces:**
- `validarPedido(raw: unknown, catalogo: PrecioProbador[], fotosSubidas: Set<number>) → { ok: true; renglones: { receta: RecetaProbador; foto: number; precio: PrecioProbador }[]; totalArs: number } | { ok: false; error: string }`.
- Reglas:
  - entre 1 y 12 cuadros;
  - cada cuadro con un tipo que tenga precio;
  - foto subida;
  - encuadre normalizado;
  - números finitos;
  - `totalVisto` (lo que vio el cliente) distinto del total del servidor da el error "El precio cambió: ahora el total es $ X. Revisalo y volvé a pedir."

### Task 3: Migración, subida y creación del pedido

**Files:**
- Create: `packages/db/prisma/migrations/20261130150000_fotoffice_probador_pedido/migration.sql`. Agrega `composicion JSONB` a `FotofficePrintOrder` y `probador JSONB` a `FotofficePrintOrderItem`, las dos opcionales. También se suman al `schema.prisma`.
- Create: `lib/probador/pedido.server.ts`:
  - `pedirSubidas(workspaceId, archivos: {tipo, bytes}[]) → { borrador, subidas: {n, url, clave}[] }`;
  - `crearPedidoProbador(workspaceId, slug, datos) → ResultadoIniciarPagoImpresion`, que valida con HEAD, crea el pedido con un ítem por cuadro y abre la preferencia de Mercado Pago con la referencia `fo-impresion:<id>` y el webhook de impresiones;
  - `puedePedir(workspaceId)`.
- Create: `app/w/[workspaceSlug]/probador-de-cuadros/actions.ts`, con límite por IP.
- Modify: `lib/website/domain/routing.ts`, para sumar `probador-de-cuadros` a `SITE_SEGMENTS_ON_FOTOFFICE`, con su prueba.

### Task 4: Laboratorio, mapa y purga

**Files:**
- Create: `lib/probador/render.server.ts` → `renderProbador(original: Buffer, receta) → Buffer`, con sharp:
  1. rotate según EXIF y luego el giro de 90°;
  2. escalar;
  3. girar `theta`;
  4. extraer el frente;
  5. para el canvas, fondo con el frente agrandado al total y desenfocado (`blur(40)`), y el frente compuesto encima;
  6. JPEG 95, `density = ppp`.
- Modify: `lib/impresiones/preparar-servidor.ts`:
  - los ítems con `probador` usan `renderProbador` y `rutaEnZip`;
  - los pedidos `PROBADOR` suman al ZIP `00 Mapa de armado.svg` y `00 Mapa de armado.txt`.
- Modify: el cron de impresiones, para llamar a `purgarOriginalesProbador(ahora)`.
- Test: una prueba de `renderProbador` con una imagen de 600×400 generada con sharp: un canvas 30×40 sale con las dimensiones de `planDeSalida` y la esquina de la envoltura no es negra.

### Task 5: Paso a paso público

**Files:**
- Modify: `components/probador/motor.ts`:
  - devuelve también una API para el asistente: `fijarReferencia(w, h, piso)`, `modoPared(bool)`, `composicion()`, `fotosParaSubir()`, `esMuestra()` y `alCambiar(cb)`;
  - conserva el `File` original de cada foto.
- Create: `components/probador/asistente.tsx`. Envuelve el mismo marcado y muestra un paso por vez:
  1. **Tu pared:** cómo sacar la foto (de frente, a la altura del pecho, con buena luz y la pared entera), con los botones "Sacar foto" (cámara trasera) y "Elegir de la galería", más "Probar con un living de ejemplo".
  2. **Una medida:** elegir entre "Una hoja A4 pegada en la pared" (21 × 29,7), "Una puerta" (80 × 200, del piso) u "Otra cosa"; después arrastrar las 4 esquinas.
  3. **Elegí el estilo:** plantillas, tipo y medida base, con el precio a la vista.
  4. **Tus fotos:** "Una foto para todo el conjunto" o "Una foto por cuadro", y subir las fotos.
  5. **Mirá cómo queda:** la vista grande, tocar un cuadro para ajustar y el presupuesto.
  6. **Pedido:** nombre, correo y teléfono, retiro en el estudio, subida con barra de progreso y "Pagar con Mercado Pago".
- Modify: `components/probador/probador-cuadros.tsx`. Con `modo = "asistente"` se ve el asistente; el panel del fotógrafo sigue con el editor completo.
- Modify: `app/w/[workspaceSlug]/probador-de-cuadros/page.tsx`. Usa el asistente y le pasa `puedePedir`.
- Verificación en el navegador a 375 px: los 6 pasos con el living de ejemplo, el paso 6 sin pagar (no se crean pedidos de prueba en producción) y la consola limpia.

### Task 6: Entrega

- Pruebas de `lib/probador`, `lib/impresiones` y `lib/website` en verde; `tsc` acotado y `eslint`.
- Aplicar el SQL en producción, registrar con `migrate resolve` y verificar en `_prisma_migrations`.
- Abrir el PR, fusionar en verde y verificar en producción que el asistente carga sin errores.
