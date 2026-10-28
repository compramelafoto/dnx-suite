# El bot vende copias e impresiones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el bot de WhatsApp arme un pedido de copias/ampliaciones con las fotos del chat, cobre la seña del 50 % o el total por Mercado Pago y que, al acreditarse, el pedido salga solo al laboratorio con las fotos originales.

**Architecture:** Se reusa el módulo de impresiones (`lib/impresiones`): el pedido es un `FotofficePrintOrder` con `source = "WHATSAPP"` cuyos ítems apuntan (`sourceKey`) a los archivos de la Bandeja. Precios del catálogo (`Product`, por nombre), plazo y papel por ítem, seña y pagos sumados en el pedido, trabajos por laboratorio y plazo, ZIP sin recorte, y un paso nuevo del cron que programa el retiro del cadete por ganancia acumulada.

**Tech Stack:** Next.js, Prisma 6, Mercado Pago Checkout Pro (`createMercadoPagoCheckoutProLiveAdapter`), sharp (sólo para lo que no es WhatsApp), `@repo/dnx-bot`, vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-28-bot-pedidos-impresion-design.md`

## Global Constraints

- Seña = **50 %** (configurable `depositPct`); el cliente elige seña o total. Sale al laboratorio con la seña acreditada.
- Fotos de WhatsApp: **originales, sin recorte ni recompresión** (bytes tal cual).
- Papel por ítem: `BRILLO` (omisión) o `MATE`.
- Plazos: `INSTANTANEA` (mostrador, sin laboratorio), `MANANA` (siguiente día hábil, `sumarDiasHabiles(hoy,1)`), `SEMANA` (máximo 7 días corridos; incluye La Isla).
- Escalón: "más de N" vale si **cantidad ≥ N**; menos de 10 → precio de "Copia instantánea {medida}" con plazo `MANANA` y laboratorio de la medida.
- Retiro programado: por laboratorio, cuando la ganancia (precio − costo) de los ítems `SEMANA` esperando retiro **supera $12.000** (`retiroUmbralArs`) → retiro el siguiente día hábil; si un ítem cumple 7 días corridos, se programa ese día.
- Envío: opcional, `cotizarEnvio` desde el estudio (`pricingExtras.studioLatitude/Longitude`) con `porKmCents = 300000` ($3.000/km), `baseCents = 0`; más de 30 km → pasa a persona.
- Sin correo del cliente: avisos por WhatsApp (`enviarAvisoPorWhatsapp`, ventana de 24 h).
- Montos en pesos (Decimal 12,2); textos al cliente en castellano rioplatense; nunca loguear datos personales.
- Migraciones FOTOFFICE a mano en `br-old-rain-adwthzng` + registro con sha256.

## Rulings del plan

- **R1 — Dos preferencias de MP** por pedido (seña y total) con la misma `externalReference`. Al acreditar: si el pedido está `PENDIENTE_PAGO` y lo pagado ≥ seña → `PAGADO`. Un segundo pago aprobado (otra `id` de MP) **suma a `paidArs`** (pago del saldo) y registra otro movimiento de Caja (`sourceRef = "<id>:<n>"`); lo que pase del total queda en `lastError = "PAGO_DE_MAS"` y avisa al estudio. Idempotencia de pagos extra por `pagosExtra` (Json con las `id` de MP).
- **R2 — Pedido reemplazado:** al armar uno nuevo para el mismo chat, el pendiente anterior pasa a `CANCELADO` con `lastError = "REEMPLAZADO"`. Si después se paga, **no** se crean trabajos ni sale al laboratorio: queda `CANCELADO`, `lastError = "PAGADO_REEMPLAZADO"` y aviso al estudio.
- **R3 — Candado de saldo:** `exigirPedidoPagado` busca, cuando el trabajo no tiene `pedidoId`, el pedido de impresión del trabajo (`items.some.proyectoId`) y bloquea si `totalArs − paidArs > 0`.
- **R4 — Fotos referenciadas por número:** el historial numera las fotos del cliente ("foto 1", "foto 2"…) desde el último pedido armado; la herramienta recibe números y el servidor los traduce a mensajes con `descarga = "LISTO"`.

## Review Focus

- El cliente paga el link de la seña y después el del total: el pedido no sale dos veces al laboratorio y el saldo queda en 0.
- Una foto todavía bajándose o con `FALLO` al armar: no entra al pedido; la herramienta lo dice.
- Precio de una medida sin producto en el catálogo (p. ej. 13x13): no se inventa; pasa a persona.
- Pedido con instantáneas y copias de laboratorio mezcladas: sólo las de laboratorio van por correo.
- Webhook repetido de Mercado Pago (mismo pago): idempotente, no suma dos veces.

---

## Estructura de archivos

| Archivo | Qué hace |
|---|---|
| `packages/db/prisma/migrations/20270102120000_fotoffice_impresion_whatsapp/migration.sql` + schema | Columnas nuevas (Task 1) |
| `lib/impresiones/catalogo-copias.ts` (PURO) | Leer productos de copia por nombre y cotizar |
| `lib/impresiones/plazos.ts` (PURO) | Fechas por plazo y regla del retiro programado |
| `lib/impresiones/whatsapp-servidor.ts` | Alta del pedido desde el bot + preferencias MP |
| `lib/impresiones/acreditar-servidor.ts` | Seña, segundo pago, reemplazado, trabajos por lab y plazo |
| `lib/impresiones/preparar-servidor.ts`, `carpeta-lab.ts`, `correo-lab.ts` | Sin recorte, papel y plazo por ítem, asunto por plazo, instantáneas sin correo |
| `lib/impresiones/retiro-servidor.ts` | Retiro programado + aviso al cliente |
| `lib/pedidos/candado-saldo.ts`, `lib/impresiones/trabajo-servidor.ts`, `components/impresiones/pedido-del-trabajo.tsx` | Saldo del pedido de impresión |
| `lib/bandeja/aviso-sistema.ts` | `autorLabel` parametrizable |
| `lib/bandeja/bot/historial.ts`, `responder.ts`, `herramientas.ts`, `guia.ts` | Fotos numeradas, `armar_pedido_impresion`, `estado_de_mi_pedido` |
| `lib/impresiones/configuracion-servidor.ts`, `app/workspace/configuracion/impresiones/*` | Seña % y umbral del retiro |

---

### Task 1: Migración

**Files:** schema.prisma (`FotofficePrintOrder`, `FotofficePrintOrderItem`, `FotofficePrintSettings`); `migrations/20270102120000_fotoffice_impresion_whatsapp/migration.sql`; Test `lib/impresiones/migracion-whatsapp.test.ts`.

Columnas (todas `IF NOT EXISTS`, ninguna obligatoria sin omisión):
- `FotofficePrintOrder`: `email` pasa a NULL (`ALTER COLUMN "email" DROP NOT NULL`); `depositArs DECIMAL(12,2)`; `paidArs DECIMAL(12,2) NOT NULL DEFAULT 0`; `pagosExtra JSONB`; `waChatId TEXT`; `waId TEXT`; índice `(workspaceId, waChatId, status)`.
- `FotofficePrintOrderItem`: `paper TEXT`, `plazo TEXT`, `sinRecorte BOOLEAN NOT NULL DEFAULT false`, `calidadBaja BOOLEAN NOT NULL DEFAULT false`, `retiroProgramadoPara DATE`.
- `FotofficePrintSettings`: `depositPct INTEGER NOT NULL DEFAULT 50`, `retiroUmbralArs DECIMAL(12,2) NOT NULL DEFAULT 12000`.

- [ ] Test: es la última carpeta; contiene esas sentencias; no tiene `DROP TABLE`, `DELETE`, `UPDATE "`.
- [ ] FAIL → escribir SQL + schema → `prisma generate` → PASS → commit "Impresiones por WhatsApp: migración".

---

### Task 2: Cotizar con el catálogo (PURO)

**Files:** Create `lib/impresiones/catalogo-copias.ts`; Test `catalogo-copias.test.ts`.

**Produces:**
```ts
export type Plazo = "INSTANTANEA" | "MANANA" | "SEMANA";
export type ProductoCopia = { id: string; medida: string /* "10x15" */; plazo: Plazo; desde: number /* 0 o N de "más de N" */; precio: number; costo: number | null; proveedorId: string | null };
export function leerProductosDeCopia(productos: { id: string; name: string; priceArs: number; costArs: number | null; preferredProveedorId: string | null }[]): ProductoCopia[];
export type PedidoLinea = { medida: string; plazo: Exclude<Plazo, "INSTANTANEA"> | "INSTANTANEA"; cantidad: number };
export type LineaCotizada = { medida: string; plazo: Plazo; cantidad: number; precioUnitario: number; costoUnitario: number | null; proveedorId: string | null; productoId: string };
export function cotizarCopias(lineas: PedidoLinea[], catalogo: ProductoCopia[]): { ok: true; lineas: LineaCotizada[]; subtotal: number } | { ok: false; falta: string /* "13x13 para mañana" */ };
```
Formatos (regex sobre el nombre normalizado, medida `\d+x\d+`): "Copia instantánea M" → INSTANTANEA desde 0; "Copia para mañana M · más de N" → MANANA desde N; "Copia próxima semana M · más de N" → SEMANA; "Ampliación M para mañana" / "Ampliación M próxima semana" → desde 0; "Ampliación M" (sin plazo) → SEMANA desde 0. Escalón: la cantidad total de esa medida+plazo elige el mayor `desde ≤ cantidad`; si no hay (copias con menos de 10), usa "Copia instantánea M" con plazo `MANANA` y `proveedorId` del producto MANANA de esa medida (si no hay, null → falta).

- [ ] Tests con el catálogo real de DNX (copiar los nombres de la spec): 9 × 10x15 MANANA → $5.000 c/u, plazo MANANA, proveedor Fotolag; 10 → $3.000; 50 → $2.000; 100 → $1.500; 3 × 30x40 → $11.700, SEMANA, La Isla; 2 × 20x30 MANANA → $4.500; 13x13 → `{ok:false, falta:"13x13 para mañana"}`; INSTANTANEA 13x18 → $7.000 sin proveedor.
- [ ] FAIL → implementar → PASS → commit.

---

### Task 3: Plazos y retiro (PURO)

**Files:** Create `lib/impresiones/plazos.ts`; Test `plazos.test.ts`.

**Produces:**
```ts
export function fechaPorPlazo(plazo: Plazo, hoyYmd: string): { exacta: string | null; maxima: string }; // MANANA/INSTANTANEA: exacta = maxima = sumarDiasHabiles(hoy,1) (INSTANTANEA: hoy); SEMANA: exacta null, maxima = hoy + 7 corridos
export type ItemEsperando = { proveedorId: string; ganancia: number; pagadoYmd: string };
export function retirosAProgramar(items: ItemEsperando[], hoyYmd: string, umbral: number): Map<string /*proveedorId*/, string /*fecha*/>; // por proveedor: si Σganancia > umbral → sumarDiasHabiles(hoy,1); si algún pagadoYmd + 7 ≤ hoy+1 → esa fecha máxima; si no, nada
```
- [ ] Tests: viernes 30/10/2026 MANANA → lunes 02/11; SEMANA desde 28/10 → máxima 04/11; ganancia 12.000 exacta no alcanza, 12.001 sí; ítem pagado hace 6 días sin umbral → se programa para su día 7.
- [ ] FAIL → implementar (usar `sumarDiasHabiles`) → PASS → commit.

---

### Task 4: Alta del pedido desde el bot

**Files:** Create `lib/impresiones/whatsapp-servidor.ts`; Modify `pago-servidor.ts` (extraer `abrirPreferencia(d: { workspaceId; pedidoId; montoCents; descripcion; collectorToken; origen; slug; tracking }): Promise<string /*checkoutUrl*/>` y usarla en `iniciarPagoImpresion`); Test `whatsapp-servidor.test.ts` (mocks a mano como `pago-servidor.test.ts`).

**Produces:**
```ts
export type FotoDelPedido = { mensajeId: string };
export type RenglonBot = { fotos: FotoDelPedido[]; medida: string; cantidad: number; plazo: Plazo; papel: "BRILLO" | "MATE" };
export type DatosPedidoBot = { renglones: RenglonBot[]; envio: { direccion: string } | null; nombre: string };
export type ResultadoPedidoBot =
  | { ok: true; numero: number; subtotal: number; envio: number; total: number; sena: number; linkSena: string; linkTotal: string; lineas: LineaCotizada[]; fechaMaxima: string }
  | { ok: false; motivo: "MODULO" | "SIN_MP" | "FOTO_NO_LISTA" | "PRECIO" | "ENVIO_LEJOS" | "SIN_DIRECCION" | "ERROR"; detalle?: string };
export async function crearPedidoDesdeWhatsapp(workspaceId: string, chat: { id: string; waId: string; clientId: string | null; nombre: string | null }, datos: DatosPedidoBot, deps?: { ahora?: () => Date; abrir?: typeof abrirPreferencia; geocodificar?: (dir: string) => Promise<Punto | null> }): Promise<ResultadoPedidoBot>;
```
Pasos: módulo `print-orders` encendido y collector MP; mensajes del chat con `claveDeMedia` (si falta alguno → `FOTO_NO_LISTA` con el número); catálogo → `cotizarCopias` (agrupando cantidades = fotos × cantidad); calidad: `medidasQueAlcanzan` → `calidadBaja`; envío: `geocodificarLugar` + `cotizarEnvio({…, porKmCents: settings.shippingPerKmArs*100, baseCents:0, maxKm:30})`; transacción con candado: cancelar pendientes del mismo `waChatId` (`lastError:"REEMPLAZADO"`), numerar, crear pedido (`source:"WHATSAPP"`, `email:null`, `telefono:+waId`, `paper` del primer renglón, `depositArs = round(total × depositPct/100)`, `waChatId`, `waId`, `clientId`, ítems con `sourceKey`, `sourceName`, `paper`, `plazo`, `sinRecorte:true`, crop 0,0,1,1, `calidadBaja`, `proveedorId`); dos preferencias (seña y total).
- [ ] Tests: arma con 2 fotos × 2 copias 13x18 MANANA → total 4 × $7.000 (menos de 10 → instantánea) = $28.000, seña $14.000, dos links; foto con `FALLO` → `FOTO_NO_LISTA`; un segundo pedido del chat cancela el primero (`REEMPLAZADO`); envío a 10 km → $30.000; a 40 km → `ENVIO_LEJOS`; `iniciarPagoImpresion` sigue pasando sus pruebas.
- [ ] FAIL → implementar → PASS (`vitest run lib/impresiones`) → commit.

---

### Task 5: Acreditar seña, saldo y reemplazados

**Files:** Modify `lib/impresiones/acreditar-servidor.ts`; Test `acreditar-servidor.test.ts`.

- `IMPORTE_MENOR` compara contra `depositArs ?? totalArs`.
- Primer pago (`PENDIENTE_PAGO`): `PAGADO`, `paidArs = monto`, Caja por el monto pagado.
- `CANCELADO` con `lastError = "REEMPLAZADO"` → no pasa a PAGADO; `lastError = "PAGADO_REEMPLAZADO"`, Caja igual (el dinero entró), aviso al estudio (`avisarFallaAlEstudio`), resultado `{ok:true, yaEstaba:false}`.
- Ya `PAGADO`/`PREPARANDO`/`ENVIADO` con otra `id` de MP: si la `id` no está en `pagosExtra`, suma a `paidArs`, la agrega, otro movimiento de Caja `sourceRef:"<pedido>:<n>"`; si `paidArs > totalArs` → `lastError:"PAGO_DE_MAS"` + aviso.
- Trabajos: agrupar por **laboratorio y plazo** (`proveedorId ?? "MOSTRADOR"` + plazo); nombre "Copias impresas · pedido N · para mañana" / "· próxima semana" / "Copias instantáneas · pedido N"; `entregaPrometida` = `fechaPorPlazo(...).exacta` (SEMANA: null).
- Después del primer pago, si `source = "WHATSAPP"`: `enviarAvisoPorWhatsapp(ws, waId, texto, {autor: "Pedidos de impresión"})` con "¡Recibimos tu pago! Tu pedido N ya está en preparación. {para mañana: Va a estar el {fecha}. | semana: Va a estar como máximo el {fecha}; te avisamos el día exacto.} Te avisamos cuando esté listo para retirar." (sin correo: no llama a `avisarPedidoConfirmado` si no hay email).
- [ ] Tests: seña acreditada → PAGADO, paidArs = seña; total después → paidArs = total, no crea trabajos de nuevo; mismo pago repetido → no suma; pago de reemplazado → sin trabajos, PAGADO_REEMPLAZADO; mezcla MANANA + SEMANA + INSTANTANEA → 3 trabajos; WHATSAPP → aviso enviado con la fecha.
- [ ] FAIL → implementar → PASS → commit.

---

### Task 6: Preparar para el laboratorio

**Files:** Modify `preparar-servidor.ts`, `carpeta-lab.ts`, `correo-lab.ts`; Tests de los tres.

- `ItemParaLab` suma `paper: Papel`, `plazo: Plazo`, `calidadBaja: boolean`; `rutasDelZip(numero, cliente, papelPorOmision, items)` usa el papel del ítem; `resumenParaLab(items, papelPorOmision)` agrupa por medida y papel.
- `DatosCorreoLab` suma `plazo: Plazo` y `calidadBaja: string[]` (nombres); asunto "PARA MAÑANA" o "PARA LA PRÓXIMA SEMANA"; si hay calidad baja, un párrafo "Fotos con resolución baja: …".
- `prepararPedido`: ítem `sinRecorte` → los bytes de `leer(sourceKey)` tal cual (sin `recortar`); trabajos sin proveedor (instantáneas) → no se arma ZIP ni correo, el trabajo queda en su fase para el mostrador.
- [ ] Tests: ZIP de un ítem sinRecorte contiene exactamente los bytes leídos; dos papeles → dos carpetas "10x15 Brillo" y "10x15 Mate"; asunto con "PARA LA PRÓXIMA SEMANA"; pedido sólo instantáneas → ENVIADO sin correo.
- [ ] FAIL → implementar → PASS → commit.

---

### Task 7: Saldo visible y candado

**Files:** Modify `lib/pedidos/candado-saldo.ts` (`exigirPedidoPagado`), `lib/impresiones/trabajo-servidor.ts` (`PedidoDelTrabajo` suma `pagadoCents`, `saldoCents`, `copias[].papel` por renglón, `plazo`), `components/impresiones/pedido-del-trabajo.tsx` (muestra "Pagado $X · Saldo $Y"); Tests `candado-saldo.test.ts`, `trabajo-servidor.test.ts`.

- [ ] Tests: trabajo sin `pedidoId` cuyo pedido de impresión tiene saldo → mensaje de candado; sin saldo → null; `pedidoDelTrabajo` devuelve pagado y saldo.
- [ ] FAIL → implementar → PASS → commit.

---

### Task 8: Retiro programado

**Files:** Create `lib/impresiones/retiro-servidor.ts`; Modify `app/api/cron/impresiones/route.ts` (llamar después de `procesarPedidosDeImpresion`), `lib/bandeja/aviso-sistema.ts` (`opciones.autor`, omisión "Presupuesto automático"); Test `retiro-servidor.test.ts`.

**Produces:** `programarRetiros(deps?: { ahora?: () => Date; avisar?: typeof enviarAvisoPorWhatsapp }): Promise<{ programados: number }>` — ítems `plazo = "SEMANA"`, pedido `ENVIADO`, `retiroProgramadoPara = null`; ganancia = (unit − cost) × cantidad; `retirosAProgramar` por workspace con su `retiroUmbralArs`; al programar: `retiroProgramadoPara` en los ítems, `entregaPrometida` en sus trabajos, aviso por WhatsApp a cada pedido WHATSAPP: "Tus copias del pedido N van a estar el {día dd/mm}. Te esperamos en el estudio."
- [ ] Tests: umbral superado → programa y avisa una vez; segunda corrida no repite; sin umbral pero día 7 → programa.
- [ ] FAIL → implementar → PASS → commit.

---

### Task 9: El bot arma el pedido

**Files:** Modify `lib/bandeja/bot/historial.ts` (`MensajeChat.id?`, numerar fotos del cliente "foto N" en la etiqueta; devolver `fotos: Map<number, string /*mensajeId*/>`), `responder.ts` (select `id`; pasar `fotos` a herramientas), `herramientas.ts` (`DepsAtencion.armarPedido`, `estadoPedido`; tools `armar_pedido_impresion`, `estado_de_mi_pedido`; texto de `pasar_a_persona` sin "todavía no podés armar pedidos"), `guia.ts`; Tests `historial.test.ts`, `herramientas.test.ts`, `guia.test.ts`.

`armar_pedido_impresion` input: `{ renglones: { fotos: "todas" | number[]; medida: string; cantidad: number (1..500); plazo: "instantanea"|"para mañana"|"proxima semana"; papel?: "brillante"|"mate" }[]; envio?: { direccion: string } }`. Responde con el resumen en pesos (`precioDeLista`), seña, total, fecha y los dos links, o el motivo para el bot ("La 13x13 no está en el catálogo: usá pasar_a_persona").
Guía: pedir medida, cantidad, plazo (explicar instantánea / para mañana / próxima semana con sus precios de `buscar_productos`), papel (brillante si no dice), retiro o envío; no repetir; mandar los dos links ("seña del 50 % o el total"); calidad baja → pedir Documento antes de armar; si insiste, armar igual.
- [ ] Tests: historial etiqueta "foto 1" y "foto 2" y devuelve sus ids; la herramienta traduce "todas" y [2] a mensajeIds; resultado con links en el texto; guía contiene "armar_pedido_impresion" y "seña del 50 %".
- [ ] FAIL → implementar → PASS → commit.

---

### Task 10: Configuración → Impresiones

**Files:** `lib/impresiones/configuracion-servidor.ts` (`AjustesImpresion.depositPct`, `retiroUmbralArs`), `app/workspace/configuracion/impresiones/{actions.ts,page.tsx}`; Test de `configuracion-servidor`.
- [ ] Test: guardar 50 y 12000 los persiste; fuera de rango (0–100) → error. FAIL → implementar → PASS → commit.

---

### Task 11: Producción

- [ ] `tsc` y suite completa en verde; revisión final independiente.
- [ ] SQL en `development` + registro; PR; CI; fusionar; deploy Ready.
- [ ] DNX: `shippingPerKmArs = 3000`, `depositPct = 50`, `retiroUmbralArs = 12000`; verificar `studioLatitude/Longitude` de San José 1672 en el perfil; correos de Fotolag y La Isla (ya cargados); dejar `testMode = true` para la primera prueba.
- [ ] Prueba real con Daniel: 2 copias 13x18 para mañana, pagar la seña → correo [PRUEBA] al estudio, trabajo con saldo, aviso por WhatsApp. Después apagar el modo prueba.
