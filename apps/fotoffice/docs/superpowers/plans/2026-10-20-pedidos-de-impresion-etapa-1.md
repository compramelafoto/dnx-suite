# Pedidos de impresión — Etapa 1 (retiro, desde carpetas) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un cliente, desde el enlace de su carpeta de trabajo (rollos/digitalizaciones), pida copias impresas eligiendo tamaño, cantidad, papel y recorte, pague con Mercado Pago, y que el sistema cree el/los trabajos, arme una carpeta ZIP ordenada por laboratorio y se la mande por correo «PARA MAÑANA».

**Architecture:** Módulo nuevo `print-orders` en `apps/fotoffice`. Funciones puras en `lib/impresiones/*` (precios, orientación/recorte, resolución, días hábiles, armado de carpeta, correo) con pruebas unitarias; servidor en `lib/impresiones/*-servidor.ts` (configuración, pedido, pago, acreditación, preparación). El pago copia el patrón de compras de galería (preferencia con la cuenta MP del workspace, webhook propio, idempotencia por `providerPaymentRef`, Caja con `recordCashMovement`). La preparación de archivos corre en un cron (`/api/cron/impresiones`) con `sharp` + el ZIP propio `lib/galerias/zip.ts` y subida multiparte al bucket privado.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma (`@repo/db`), Vitest, sharp 0.34, R2 (S3 SDK vía `lib/ficha/adjuntos-r2.ts`), Mercado Pago (`@repo/payments/mercado-pago`), feriados de `@repo/cuanto-cobro-core`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-pedidos-de-impresion-design.md`

## Global Constraints

- Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (AGENTS.md: «This is NOT the Next.js you know»).
- Clave del módulo: `print-orders`. Apagado por defecto (`WorkspaceFeatureModule.enabled = false`).
- Textos de cara al usuario en español rioplatense (vos), sin tecnicismos.
- Montos en pesos con `Decimal(14,2)` en la base; cálculos internos en centavos enteros (`*Cents: number`).
- Estados como texto, no enum de Prisma.
- Plazo prometido: **2 días hábiles** desde el pago (sin sábados, domingos ni feriados nacionales).
- Asunto del correo al laboratorio: `Pedido <n> – PARA MAÑANA – <Cliente>`.
- Ruta de cada archivo en el ZIP: `Pedido <n> - <Cliente>/<Tamaño> <Papel>/<N> copia(s)/<archivo>.jpg`.
- JPG de salida: calidad 95, sRGB, sin redimensionar (sólo recorte).
- Aviso de baja resolución bajo **150 ppp**.
- Un tamaño sin `priceArs` no se ofrece.
- Modo prueba: los correos «al laboratorio» van al correo de contacto del workspace.
- El enlace del laboratorio vence a los 30 días (`DIAS_CARPETA` de `lib/carpetas/reglas.ts`).
- Las tablas nuevas se aplican a mano en la base de FOTOFFICE (Neon `divine-hall-10689679`, rama `br-old-rain-adwthzng`) **antes** de fusionar, y se registran en `_prisma_migrations`.
- Correr pruebas desde `apps/fotoffice`: `pnpm exec vitest run --config vitest.config.ts <archivo>`.

## Review Focus

- **Aviso de Mercado Pago repetido o fuera de orden** → un solo pedido pagado, un solo movimiento de Caja y un solo juego de trabajos (Task 7: prueba «acreditar dos veces»).
- **Foto vertical pedida en un tamaño apaisado (o al revés)** → el tamaño se orienta como la foto antes de proponer el recorte, sin recortes absurdos (Task 2: prueba de orientación).
- **El laboratorio no tiene correo cargado o Resend falla** → el pedido queda `PAGADO_SIN_ENVIAR`, aviso al estudio, «Reintentar» funciona (Task 9: prueba de falla de envío).
- **Pago aprobado por un monto menor al total, o en otra moneda** → no se acredita (Task 7: prueba de importe menor).
- **Archivo de la carpeta que no es imagen o es un TIFF gigante** → no se ofrece / se procesa con tope de píxeles, sin tirar el cron (Task 5 y Task 9: pruebas de filtro y de foto no procesable).

---

## Mapa de archivos

Crear (todo bajo `apps/fotoffice/` salvo la migración):

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/migrations/20261020120000_fotoffice_pedidos_impresion/migration.sql` | Tablas nuevas |
| `lib/impresiones/constantes.ts` | Clave del módulo, estados, prefijo de referencia MP, tamaños iniciales |
| `lib/impresiones/precios.ts` (+ `.test.ts`) | Cotizar el carrito: subtotal, costo, ganancia |
| `lib/impresiones/recorte.ts` (+ `.test.ts`) | Orientar tamaño, recorte inicial centrado, resolución en ppp |
| `lib/impresiones/dias-habiles.ts` (+ `.test.ts`) | Sumar días hábiles con feriados AR |
| `lib/impresiones/carpeta-lab.ts` (+ `.test.ts`) | Agrupar por laboratorio y armar rutas del ZIP |
| `lib/impresiones/correo-lab.ts` (+ `.test.ts`) | Asunto/cuerpo del correo al laboratorio |
| `lib/impresiones/carrito.ts` (+ `.test.ts`) | Validar el carrito que manda el navegador |
| `lib/impresiones/configuracion-servidor.ts` (+ `.test.ts`) | Leer/guardar ajustes y tamaños; sembrar tamaños iniciales |
| `lib/impresiones/fuentes-servidor.ts` (+ `.test.ts`) | Fotos aptas de la carpeta + miniaturas y medidas |
| `lib/impresiones/pago-servidor.ts` (+ `.test.ts`) | Crear pedido pendiente y preferencia MP; verificar vuelta |
| `lib/impresiones/acreditar-servidor.ts` (+ `.test.ts`) | Pago aprobado → PAGADO, trabajos, Caja |
| `lib/impresiones/preparar-servidor.ts` (+ `.test.ts`) | Cron: recortar, ZIP, carpeta del lab, correo |
| `lib/carpetas/subir-servidor.ts` | Subir un buffer / un flujo multiparte a una clave `trabajos/…` |
| `app/workspace/configuracion/impresiones/page.tsx`, `actions.ts`, `formulario-tamanos.tsx` | Pantalla de configuración |
| `app/w/[workspaceSlug]/archivos/[token]/imprimir/page.tsx`, `pedido-cliente.tsx`, `actions.ts` | Pantalla del cliente |
| `components/impresiones/editor-recorte.tsx` | Arrastre y zoom del recorte |
| `app/w/[workspaceSlug]/impresion/[seguimiento]/page.tsx` | Seguimiento del pedido |
| `app/api/w/[workspaceSlug]/archivos/[token]/mini/[archivoId]/route.ts` | Miniatura bajo demanda |
| `app/api/payments/mp/impresiones-webhook/route.ts` | Webhook MP |
| `app/api/cron/impresiones/route.ts` | Cron de preparación |

Modificar:

| Archivo | Cambio |
|---|---|
| `packages/db/prisma/schema.prisma` | Modelos nuevos + relaciones inversas |
| `lib/modules/registry.ts` | Entrada `print-orders` |
| `lib/cash/constants.ts` | `MovementSource` suma `"impresiones"` |
| `lib/proyectos/crear.ts` | Exportar `crearProyectoDeSistema` |
| `components/carpetas/carpeta-publica.tsx` + `app/w/[workspaceSlug]/archivos/[token]/page.tsx` | Botón «Pedir copias impresas» |
| `components/shell/shell-nav.tsx` | Entrada Configuración → Impresiones |
| `vercel.json` | Cron `*/5 * * * *` a `/api/cron/impresiones` |
| `app/(shell)/proyectos/**` (detalle del trabajo) | Botón «Reintentar envío» si el pedido está `PAGADO_SIN_ENVIAR` |

---

### Task 1: Tablas y módulo

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar al final de los modelos Fotoffice*; relaciones inversas en `Workspace`, `FotofficeProveedor`, `FotofficeProyecto`, `FotofficeArchivoTrabajo`, `Client`, `CashMovement`)
- Create: `packages/db/prisma/migrations/20261020120000_fotoffice_pedidos_impresion/migration.sql`
- Create: `apps/fotoffice/lib/impresiones/constantes.ts`
- Modify: `apps/fotoffice/lib/modules/registry.ts`, `apps/fotoffice/lib/cash/constants.ts`

**Interfaces:**
- Produces: modelos `FotofficePrintSettings`, `FotofficePrintSize`, `FotofficePrintOrder`, `FotofficePrintOrderItem`, `FotofficePrintSourceImage`; constantes `PRINT_ORDERS_MODULE_KEY`, `ESTADOS_PEDIDO`, `PREFIJO_REFERENCIA_IMPRESION`, `TAMANOS_INICIALES`, `PAPELES`.

- [ ] **Step 1: Agregar los modelos a `schema.prisma`**

```prisma
model FotofficePrintSettings {
  id               String   @id @default(cuid())
  workspaceId      String   @unique
  testMode         Boolean  @default(true)
  paperGlossy      Boolean  @default(true)
  paperMatte       Boolean  @default(true)
  shippingEnabled  Boolean  @default(false)
  shippingBaseArs  Decimal? @db.Decimal(14, 2)
  shippingPerKmArs Decimal? @db.Decimal(14, 2)
  shippingMaxKm    Int?
  circuitId        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model FotofficePrintSize {
  id          String   @id @default(cuid())
  workspaceId String
  widthCm     Decimal  @db.Decimal(6, 1)
  heightCm    Decimal  @db.Decimal(6, 1)
  proveedorId String?
  costArs     Decimal? @db.Decimal(14, 2)
  priceArs    Decimal? @db.Decimal(14, 2)
  active      Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  proveedor FotofficeProveedor? @relation(fields: [proveedorId], references: [id], onDelete: SetNull)

  @@unique([workspaceId, widthCm, heightCm])
  @@index([workspaceId, active])
}

model FotofficePrintOrder {
  id                 String    @id @default(cuid())
  workspaceId        String
  number             Int
  source             String    @default("CARPETA")
  proyectoOrigenId   String?
  clientId           String?
  nombre             String
  email              String
  telefono           String?
  paper              String
  delivery           String    @default("RETIRO")
  subtotalArs        Decimal   @db.Decimal(14, 2)
  shippingArs        Decimal   @default(0) @db.Decimal(14, 2)
  totalArs           Decimal   @db.Decimal(14, 2)
  costTotalArs       Decimal   @db.Decimal(14, 2)
  status             String    @default("PENDIENTE_PAGO")
  promisedAt         DateTime? @db.Date
  pricingSnapshot    Json
  mpPreferenceId     String?
  providerPaymentRef String?   @unique
  paidAt             DateTime?
  feeArs             Decimal?  @db.Decimal(14, 2)
  netArs             Decimal?  @db.Decimal(14, 2)
  cashMovementId     String?   @unique
  trackingToken      String    @unique
  lastError          String?
  attempts           Int       @default(0)
  lockedAt           DateTime?
  sentAt             DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  workspace      Workspace                 @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  proyectoOrigen FotofficeProyecto?        @relation("PrintOrderOrigen", fields: [proyectoOrigenId], references: [id], onDelete: SetNull)
  client         Client?                   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  cashMovement   CashMovement?             @relation("FotofficePrintOrderMovimiento", fields: [cashMovementId], references: [id], onDelete: SetNull)
  items          FotofficePrintOrderItem[]

  @@unique([workspaceId, number])
  @@index([workspaceId, status])
}

model FotofficePrintOrderItem {
  id            String   @id @default(cuid())
  orderId       String
  archivoId     String?
  sourceKey     String
  sourceName    String
  sizeId        String?
  widthCm       Decimal  @db.Decimal(6, 1)
  heightCm      Decimal  @db.Decimal(6, 1)
  quantity      Int
  unitPriceArs  Decimal  @db.Decimal(14, 2)
  unitCostArs   Decimal  @db.Decimal(14, 2)
  cropX         Float
  cropY         Float
  cropW         Float
  cropH         Float
  proveedorId   String?
  proyectoId    String?
  createdAt     DateTime @default(now())

  order    FotofficePrintOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  proyecto FotofficeProyecto?  @relation("PrintOrderItemTrabajo", fields: [proyectoId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([proyectoId])
}

model FotofficePrintSourceImage {
  id        String   @id @default(cuid())
  archivoId String   @unique
  thumbKey  String
  width     Int
  height    Int
  createdAt DateTime @default(now())

  archivo FotofficeArchivoTrabajo @relation(fields: [archivoId], references: [id], onDelete: Cascade)
}
```

Agregar las relaciones inversas: en `Workspace` → `printSettings FotofficePrintSettings?`, `printSizes FotofficePrintSize[]`, `printOrders FotofficePrintOrder[]`; en `FotofficeProveedor` → `printSizes FotofficePrintSize[]`; en `FotofficeProyecto` → `printOrdersOrigen FotofficePrintOrder[] @relation("PrintOrderOrigen")`, `printItems FotofficePrintOrderItem[] @relation("PrintOrderItemTrabajo")`; en `FotofficeArchivoTrabajo` → `printSource FotofficePrintSourceImage?`; en `Client` → `printOrders FotofficePrintOrder[]`; en `CashMovement` → `printOrder FotofficePrintOrder? @relation("FotofficePrintOrderMovimiento")`.

- [ ] **Step 2: Generar el SQL de la migración**

Run (desde `packages/db`): `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` no sirve sin base; usar en cambio:
`git stash -- prisma/schema.prisma && cp prisma/schema.prisma /tmp/schema-antes.prisma && git stash pop && npx prisma migrate diff --from-schema-datamodel /tmp/schema-antes.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261020120000_fotoffice_pedidos_impresion/migration.sql`
Expected: el archivo tiene sólo `CREATE TABLE "FotofficePrint…"`, sus índices y claves foráneas. **Si aparece cualquier `ALTER`/`DROP` sobre tablas existentes, borrarlo** (son desfasajes ajenos).

- [ ] **Step 3: Crear `lib/impresiones/constantes.ts`**

```ts
export const PRINT_ORDERS_MODULE_KEY = "print-orders";

/** Estados del pedido. Texto y no enum: el schema lo comparten varias bases. */
export const ESTADOS_PEDIDO = [
  "PENDIENTE_PAGO",
  "PAGADO",
  "PREPARANDO",
  "ENVIADO",
  "PAGADO_SIN_ENVIAR",
  "CANCELADO",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const PREFIJO_REFERENCIA_IMPRESION = "fo-impresion:";
export const PAPELES = ["BRILLO", "MATE"] as const;
export type Papel = (typeof PAPELES)[number];
export const ETIQUETA_PAPEL: Record<Papel, string> = { BRILLO: "Brillo", MATE: "Mate" };

/** Lista inicial: hasta 20x30 Fotolag, más grande La Isla (nombres de `FotofficeProveedor`). */
export const TAMANOS_INICIALES: readonly { widthCm: number; heightCm: number; proveedor: string }[] = [
  { widthCm: 10, heightCm: 15, proveedor: "Fotolag" },
  { widthCm: 13, heightCm: 18, proveedor: "Fotolag" },
  { widthCm: 15, heightCm: 21, proveedor: "Fotolag" },
  { widthCm: 20, heightCm: 25, proveedor: "Fotolag" },
  { widthCm: 20, heightCm: 30, proveedor: "Fotolag" },
  { widthCm: 30, heightCm: 40, proveedor: "La Isla" },
  { widthCm: 30, heightCm: 45, proveedor: "La Isla" },
  { widthCm: 40, heightCm: 50, proveedor: "La Isla" },
  { widthCm: 50, heightCm: 70, proveedor: "La Isla" },
];

export const PPP_MINIMO = 150;
export const DIAS_HABILES_PROMETIDOS = 2;
export const CIRCUITO_POR_OMISION = "Impresiones a laboratorio";
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/tiff"] as const;
```

- [ ] **Step 4: Registrar el módulo y la fuente de Caja**

En `lib/modules/registry.ts`, agregar a `MODULE_REGISTRY` (mismo formato que la entrada de galerías):

```ts
{ key: PRINT_ORDERS_MODULE_KEY, label: "Pedidos de impresión", description: "Tus clientes piden copias impresas desde el enlace de sus fotos, pagan online y el pedido sale solo al laboratorio.",
  category: "BUSINESS", order: 95, route: "/workspace/configuracion/impresiones", status: "AVAILABLE", family: "negocio", dependsOn: ["projects"] },
```

(Usar el mismo valor de `category` que tiene la entrada de galerías; si no es `"BUSINESS"`, copiar el de galerías.)

En `lib/cash/constants.ts`, sumar `"impresiones"` a la unión `MovementSource` (y a la lista/etiquetas si existen al lado: etiqueta `"Pedidos de impresión"`).

- [ ] **Step 5: Verificar tipos y generar cliente**

Run (raíz del repo): `pnpm --filter @repo/db exec prisma generate && cd apps/fotoffice && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma apps/fotoffice/lib/impresiones/constantes.ts apps/fotoffice/lib/modules/registry.ts apps/fotoffice/lib/cash/constants.ts
git commit -m "Agregar las tablas y el módulo de pedidos de impresión"
```

---

### Task 2: Recorte, orientación y resolución (puro)

**Files:**
- Create: `apps/fotoffice/lib/impresiones/recorte.ts`
- Test: `apps/fotoffice/lib/impresiones/recorte.test.ts`

**Interfaces:**
- Produces:
  - `type Recorte = { x: number; y: number; w: number; h: number }` (proporciones 0–1 de la foto)
  - `orientarTamano(fotoW: number, fotoH: number, tamW: number, tamH: number): { w: number; h: number }`
  - `recorteInicial(fotoW: number, fotoH: number, tamW: number, tamH: number): Recorte`
  - `coincideProporcion(fotoW: number, fotoH: number, tamW: number, tamH: number, tolerancia?: number): boolean`
  - `pppDelRecorte(fotoW: number, fotoH: number, r: Recorte, tamW: number, tamH: number): number`
  - `recorteValido(r: unknown): r is Recorte`
  - `recorteEnPixeles(fotoW: number, fotoH: number, r: Recorte): { left: number; top: number; width: number; height: number }`

- [ ] **Step 1: Escribir las pruebas**

```ts
import { describe, expect, it } from "vitest";
import { coincideProporcion, orientarTamano, pppDelRecorte, recorteEnPixeles, recorteInicial, recorteValido } from "./recorte";

describe("orientarTamano", () => {
  it("una foto apaisada pide el tamaño apaisado", () => {
    expect(orientarTamano(6000, 4000, 13, 18)).toEqual({ w: 18, h: 13 });
  });
  it("una foto vertical pide el tamaño vertical", () => {
    expect(orientarTamano(4000, 6000, 18, 13)).toEqual({ w: 13, h: 18 });
  });
  it("una foto cuadrada deja el tamaño como viene", () => {
    expect(orientarTamano(3000, 3000, 13, 18)).toEqual({ w: 13, h: 18 });
  });
});

describe("recorteInicial", () => {
  it("35 mm (3:2) en 10x15 no recorta", () => {
    expect(recorteInicial(6000, 4000, 10, 15)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
  it("35 mm apaisada en 13x18 recorta los costados, centrado", () => {
    const r = recorteInicial(6000, 4000, 13, 18);
    // 18x13 => 1.3846; alto completo, ancho = 4000*1.3846/6000 = 0.923
    expect(r.h).toBe(1);
    expect(r.y).toBe(0);
    expect(r.w).toBeCloseTo(0.9231, 3);
    expect(r.x).toBeCloseTo((1 - r.w) / 2, 6);
  });
  it("vertical en 20x25 recorta arriba y abajo", () => {
    const r = recorteInicial(4000, 6000, 20, 25);
    expect(r.w).toBe(1);
    expect(r.h).toBeCloseTo((4000 / 0.8) / 6000, 4);
    expect(r.y).toBeCloseTo((1 - r.h) / 2, 6);
  });
});

describe("coincideProporcion", () => {
  it("3:2 coincide con 10x15 y no con 13x18", () => {
    expect(coincideProporcion(6000, 4000, 10, 15)).toBe(true);
    expect(coincideProporcion(6000, 4000, 13, 18)).toBe(false);
  });
});

describe("pppDelRecorte", () => {
  it("6000 px de lado largo en 15 cm dan ~1016 ppp", () => {
    expect(Math.round(pppDelRecorte(6000, 4000, { x: 0, y: 0, w: 1, h: 1 }, 10, 15))).toBe(1016);
  });
  it("una foto chica en 50x70 da poca resolución", () => {
    expect(pppDelRecorte(1500, 1000, { x: 0, y: 0, w: 1, h: 1 }, 50, 70)).toBeLessThan(150);
  });
});

describe("recorteValido y recorteEnPixeles", () => {
  it("rechaza recortes fuera de la foto", () => {
    expect(recorteValido({ x: 0.5, y: 0, w: 0.6, h: 1 })).toBe(false);
    expect(recorteValido({ x: 0, y: 0, w: 0, h: 1 })).toBe(false);
    expect(recorteValido("x")).toBe(false);
    expect(recorteValido({ x: 0.1, y: 0, w: 0.8, h: 1 })).toBe(true);
  });
  it("convierte a píxeles enteros dentro de la foto", () => {
    expect(recorteEnPixeles(6000, 4000, { x: 0.1, y: 0, w: 0.8, h: 1 })).toEqual({ left: 600, top: 0, width: 4800, height: 4000 });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/recorte.test.ts`
Expected: FAIL (no existe `./recorte`).

- [ ] **Step 3: Implementar**

```ts
/** Recorte en proporciones de la foto (0–1). Puro: lo usan el navegador, el servidor y el cron. */
export type Recorte = { x: number; y: number; w: number; h: number };

/** El tamaño se gira para acompañar a la foto: una apaisada pide 18x13, no 13x18. */
export function orientarTamano(fotoW: number, fotoH: number, tamW: number, tamH: number): { w: number; h: number } {
  const largo = Math.max(tamW, tamH);
  const corto = Math.min(tamW, tamH);
  if (fotoW > fotoH) return { w: largo, h: corto };
  if (fotoH > fotoW) return { w: corto, h: largo };
  return { w: tamW, h: tamH };
}

export function recorteInicial(fotoW: number, fotoH: number, tamW: number, tamH: number): Recorte {
  const t = orientarTamano(fotoW, fotoH, tamW, tamH);
  const objetivo = t.w / t.h;
  const foto = fotoW / fotoH;
  if (Math.abs(foto - objetivo) < 1e-6) return { x: 0, y: 0, w: 1, h: 1 };
  if (foto > objetivo) {
    const w = (fotoH * objetivo) / fotoW;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = fotoW / objetivo / fotoH;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export function coincideProporcion(fotoW: number, fotoH: number, tamW: number, tamH: number, tolerancia = 0.01): boolean {
  const t = orientarTamano(fotoW, fotoH, tamW, tamH);
  return Math.abs(fotoW / fotoH - t.w / t.h) <= tolerancia * (t.w / t.h);
}

/** Puntos por pulgada que da el recorte sobre el lado largo del tamaño. */
export function pppDelRecorte(fotoW: number, fotoH: number, r: Recorte, tamW: number, tamH: number): number {
  const ladoLargoPx = Math.max(r.w * fotoW, r.h * fotoH);
  const ladoLargoPulgadas = Math.max(tamW, tamH) / 2.54;
  return ladoLargoPx / ladoLargoPulgadas;
}

export function recorteValido(r: unknown): r is Recorte {
  if (!r || typeof r !== "object") return false;
  const { x, y, w, h } = r as Record<string, unknown>;
  const nums = [x, y, w, h];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  const [X, Y, W, H] = nums as number[];
  const eps = 1e-6;
  return X >= -eps && Y >= -eps && W > 0.01 && H > 0.01 && X + W <= 1 + eps && Y + H <= 1 + eps;
}

export function recorteEnPixeles(fotoW: number, fotoH: number, r: Recorte) {
  const left = Math.max(0, Math.round(r.x * fotoW));
  const top = Math.max(0, Math.round(r.y * fotoH));
  const width = Math.min(fotoW - left, Math.round(r.w * fotoW));
  const height = Math.min(fotoH - top, Math.round(r.h * fotoH));
  return { left, top, width, height };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/recorte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresiones/recorte.ts apps/fotoffice/lib/impresiones/recorte.test.ts
git commit -m "Calcular orientación, recorte y resolución de las copias"
```

---

### Task 3: Precios, carrito y días hábiles (puro)

**Files:**
- Create: `apps/fotoffice/lib/impresiones/precios.ts`, `carrito.ts`, `dias-habiles.ts`
- Test: `precios.test.ts`, `carrito.test.ts`, `dias-habiles.test.ts` (mismo directorio)

**Interfaces:**
- Consumes: `Recorte`, `recorteValido` (Task 2); `Papel`, `PAPELES` (Task 1).
- Produces:
  - `type TamanoOferta = { id: string; widthCm: number; heightCm: number; proveedorId: string | null; priceCents: number; costCents: number }`
  - `type LineaCarrito = { archivoId: string; sizeId: string; quantity: number; recorte: Recorte }`
  - `type Cotizacion = { lineas: (LineaCarrito & { unitPriceCents: number; unitCostCents: number; proveedorId: string | null; widthCm: number; heightCm: number })[]; subtotalCents: number; costCents: number; gananciaCents: number; copias: number }`
  - `cotizar(lineas: LineaCarrito[], tamanos: TamanoOferta[]): Cotizacion | { error: string }`
  - `aCentavos(v: { toString(): string } | number | null): number | null`
  - `validarCarrito(raw: unknown, archivosPermitidos: ReadonlySet<string>, papelesActivos: readonly Papel[]): { ok: true; lineas: LineaCarrito[]; papel: Papel } | { ok: false; error: string }`
  - `sumarDiasHabiles(desdeYmd: string, dias: number): string`

- [ ] **Step 1: Pruebas de precios**

```ts
import { describe, expect, it } from "vitest";
import { aCentavos, cotizar } from "./precios";

const T = [
  { id: "t10", widthCm: 10, heightCm: 15, proveedorId: "fotolag", priceCents: 50000, costCents: 20000 },
  { id: "t30", widthCm: 30, heightCm: 40, proveedorId: "isla", priceCents: 900000, costCents: 400000 },
];
const R = { x: 0, y: 0, w: 1, h: 1 };

describe("cotizar", () => {
  it("suma precio, costo y ganancia por cantidad", () => {
    const c = cotizar([
      { archivoId: "a", sizeId: "t10", quantity: 2, recorte: R },
      { archivoId: "b", sizeId: "t30", quantity: 1, recorte: R },
    ], T);
    if ("error" in c) throw new Error(c.error);
    expect(c.subtotalCents).toBe(2 * 50000 + 900000);
    expect(c.costCents).toBe(2 * 20000 + 400000);
    expect(c.gananciaCents).toBe(c.subtotalCents - c.costCents);
    expect(c.copias).toBe(3);
    expect(c.lineas[1].proveedorId).toBe("isla");
  });
  it("un tamaño que no se ofrece es error", () => {
    expect(cotizar([{ archivoId: "a", sizeId: "nope", quantity: 1, recorte: R }], T)).toEqual({ error: "Uno de los tamaños elegidos ya no está disponible." });
  });
  it("carrito vacío es error", () => {
    expect(cotizar([], T)).toEqual({ error: "Elegí al menos una copia." });
  });
});

describe("aCentavos", () => {
  it("convierte decimales de Prisma y nulos", () => {
    expect(aCentavos({ toString: () => "1234.50" })).toBe(123450);
    expect(aCentavos(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/precios.test.ts`

- [ ] **Step 3: Implementar `precios.ts`**

```ts
import type { Recorte } from "./recorte";

export type TamanoOferta = { id: string; widthCm: number; heightCm: number; proveedorId: string | null; priceCents: number; costCents: number };
export type LineaCarrito = { archivoId: string; sizeId: string; quantity: number; recorte: Recorte };
export type LineaCotizada = LineaCarrito & { unitPriceCents: number; unitCostCents: number; proveedorId: string | null; widthCm: number; heightCm: number };
export type Cotizacion = { lineas: LineaCotizada[]; subtotalCents: number; costCents: number; gananciaCents: number; copias: number };

export function aCentavos(v: { toString(): string } | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(typeof v === "number" ? v : v.toString());
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function cotizar(lineas: LineaCarrito[], tamanos: TamanoOferta[]): Cotizacion | { error: string } {
  if (lineas.length === 0) return { error: "Elegí al menos una copia." };
  const porId = new Map(tamanos.map((t) => [t.id, t]));
  const cotizadas: LineaCotizada[] = [];
  for (const l of lineas) {
    const t = porId.get(l.sizeId);
    if (!t) return { error: "Uno de los tamaños elegidos ya no está disponible." };
    cotizadas.push({ ...l, unitPriceCents: t.priceCents, unitCostCents: t.costCents, proveedorId: t.proveedorId, widthCm: t.widthCm, heightCm: t.heightCm });
  }
  const subtotalCents = cotizadas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const costCents = cotizadas.reduce((s, l) => s + l.unitCostCents * l.quantity, 0);
  const copias = cotizadas.reduce((s, l) => s + l.quantity, 0);
  return { lineas: cotizadas, subtotalCents, costCents, gananciaCents: subtotalCents - costCents, copias };
}
```

- [ ] **Step 4: Pruebas de carrito**

```ts
import { describe, expect, it } from "vitest";
import { validarCarrito } from "./carrito";

const OK = new Set(["a", "b"]);
const R = { x: 0, y: 0, w: 1, h: 1 };

describe("validarCarrito", () => {
  it("acepta un carrito correcto", () => {
    const r = validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 2, recorte: R }] }, OK, ["BRILLO", "MATE"]);
    expect(r).toEqual({ ok: true, papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 2, recorte: R }] });
  });
  it("rechaza fotos que no son de la carpeta", () => {
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "zzz", sizeId: "t", quantity: 1, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
  });
  it("rechaza cantidades raras y papeles apagados", () => {
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 0, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
    expect(validarCarrito({ papel: "BRILLO", lineas: [{ archivoId: "a", sizeId: "t", quantity: 1000, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
    expect(validarCarrito({ papel: "MATE", lineas: [{ archivoId: "a", sizeId: "t", quantity: 1, recorte: R }] }, OK, ["BRILLO"]).ok).toBe(false);
  });
  it("rechaza más de 500 líneas", () => {
    const lineas = Array.from({ length: 501 }, () => ({ archivoId: "a", sizeId: "t", quantity: 1, recorte: R }));
    expect(validarCarrito({ papel: "BRILLO", lineas }, OK, ["BRILLO"]).ok).toBe(false);
  });
});
```

- [ ] **Step 5: Implementar `carrito.ts`**

```ts
import { PAPELES, type Papel } from "./constantes";
import type { LineaCarrito } from "./precios";
import { recorteValido } from "./recorte";

const MAX_LINEAS = 500;
const MAX_CANTIDAD = 99;

export function validarCarrito(
  raw: unknown,
  archivosPermitidos: ReadonlySet<string>,
  papelesActivos: readonly Papel[],
): { ok: true; lineas: LineaCarrito[]; papel: Papel } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Pedido inválido." };
  const { papel, lineas } = raw as { papel?: unknown; lineas?: unknown };
  if (typeof papel !== "string" || !(PAPELES as readonly string[]).includes(papel) || !papelesActivos.includes(papel as Papel)) {
    return { ok: false, error: "Elegí un papel disponible." };
  }
  if (!Array.isArray(lineas) || lineas.length === 0) return { ok: false, error: "Elegí al menos una copia." };
  if (lineas.length > MAX_LINEAS) return { ok: false, error: "El pedido es demasiado grande. Dividilo en dos." };
  const salida: LineaCarrito[] = [];
  for (const l of lineas) {
    const { archivoId, sizeId, quantity, recorte } = (l ?? {}) as Record<string, unknown>;
    if (typeof archivoId !== "string" || !archivosPermitidos.has(archivoId)) return { ok: false, error: "Una de las fotos no es de esta carpeta." };
    if (typeof sizeId !== "string" || sizeId.length === 0) return { ok: false, error: "Falta el tamaño de una copia." };
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CANTIDAD) return { ok: false, error: "Revisá las cantidades (de 1 a 99)." };
    if (!recorteValido(recorte)) return { ok: false, error: "Uno de los recortes no es válido." };
    salida.push({ archivoId, sizeId, quantity, recorte });
  }
  return { ok: true, lineas: salida, papel: papel as Papel };
}
```

- [ ] **Step 6: Pruebas de días hábiles**

```ts
import { describe, expect, it } from "vitest";
import { sumarDiasHabiles } from "./dias-habiles";

describe("sumarDiasHabiles", () => {
  it("de lunes a miércoles", () => {
    expect(sumarDiasHabiles("2026-10-19", 2)).toBe("2026-10-21");
  });
  it("de jueves salta el fin de semana", () => {
    expect(sumarDiasHabiles("2026-10-22", 2)).toBe("2026-10-26");
  });
  it("salta un feriado nacional (25/12/2026 es viernes)", () => {
    expect(sumarDiasHabiles("2026-12-23", 2)).toBe("2026-12-28");
  });
  it("un pago en sábado cuenta desde el lunes", () => {
    expect(sumarDiasHabiles("2026-10-24", 2)).toBe("2026-10-27");
  });
});
```

- [ ] **Step 7: Implementar `dias-habiles.ts`**

```ts
import { eventDayType } from "@repo/cuanto-cobro-core";

/** Suma días hábiles (sin sábados, domingos ni feriados nacionales). Fechas `AAAA-MM-DD`. */
export function sumarDiasHabiles(desdeYmd: string, dias: number): string {
  const d = new Date(`${desdeYmd}T12:00:00Z`);
  let restantes = Math.max(0, Math.floor(dias));
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const ymd = d.toISOString().slice(0, 10);
    const info = eventDayType(ymd);
    if (info && !info.isSaturday && !info.isSunday && !info.nonWorkingDay && info.dayType !== "holiday") restantes--;
  }
  return d.toISOString().slice(0, 10);
}
```

(Si `eventDayType` no se exporta desde la raíz de `@repo/cuanto-cobro-core`, importarlo de la ruta que use `lib/precios`; verificar con `grep -rn "eventDayType" apps/fotoffice/lib`.)

- [ ] **Step 8: Correr las tres pruebas → PASS**

Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/precios.test.ts lib/impresiones/carrito.test.ts lib/impresiones/dias-habiles.test.ts`

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/impresiones/{precios,carrito,dias-habiles}*.ts
git commit -m "Cotizar el pedido, validar el carrito y calcular la fecha prometida"
```

---

### Task 4: Carpeta del laboratorio y correo (puro)

**Files:**
- Create: `apps/fotoffice/lib/impresiones/carpeta-lab.ts`, `correo-lab.ts`
- Test: `carpeta-lab.test.ts`, `correo-lab.test.ts`

**Interfaces:**
- Consumes: `Papel`, `ETIQUETA_PAPEL` (Task 1).
- Produces:
  - `type ItemParaLab = { itemId: string; proveedorId: string | null; widthCm: number; heightCm: number; quantity: number; sourceName: string }`
  - `agruparPorLaboratorio<T extends { proveedorId: string | null }>(items: T[]): Map<string | null, T[]>`
  - `etiquetaTamano(w: number, h: number): string` → `"13x18"`
  - `rutasDelZip(numero: number, cliente: string, papel: Papel, items: ItemParaLab[]): { itemId: string; ruta: string }[]`
  - `resumenParaLab(items: ItemParaLab[], papel: Papel): { tamano: string; papel: string; cantidad: number }[]`
  - `correoPedidoLab(d: DatosCorreoLab): { subject: string; text: string; html: string }` con `DatosCorreoLab = { estudio: string; laboratorio: string; numero: number; cliente: string; enlace: string; vence: string; resumen: { tamano: string; papel: string; cantidad: number }[]; prueba: boolean }`

- [ ] **Step 1: Pruebas**

```ts
// carpeta-lab.test.ts
import { describe, expect, it } from "vitest";
import { agruparPorLaboratorio, etiquetaTamano, resumenParaLab, rutasDelZip } from "./carpeta-lab";

const items = [
  { itemId: "1", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 1, sourceName: "rollo-01.tif" },
  { itemId: "2", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 2, sourceName: "rollo-03.jpg" },
  { itemId: "3", proveedorId: "f", widthCm: 13, heightCm: 18, quantity: 1, sourceName: "rollo-07.jpg" },
  { itemId: "4", proveedorId: "i", widthCm: 30, heightCm: 40, quantity: 1, sourceName: "rollo-01.tif" },
];

describe("agruparPorLaboratorio", () => {
  it("separa por proveedor", () => {
    const g = agruparPorLaboratorio(items);
    expect(g.get("f")?.map((i) => i.itemId)).toEqual(["1", "2", "3"]);
    expect(g.get("i")?.map((i) => i.itemId)).toEqual(["4"]);
  });
});

describe("rutasDelZip", () => {
  it("ordena por tamaño, papel y cantidad, y pasa todo a .jpg", () => {
    expect(rutasDelZip(123, "Juan Pérez", "BRILLO", items.slice(0, 3))).toEqual([
      { itemId: "1", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/1 copia/rollo-01.jpg" },
      { itemId: "2", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/2 copias/rollo-03.jpg" },
      { itemId: "3", ruta: "Pedido 123 - Juan Pérez/13x18 Brillo/1 copia/rollo-07.jpg" },
    ]);
  });
  it("no repite nombres dentro de la misma carpeta", () => {
    const r = rutasDelZip(1, "Ana", "MATE", [
      { itemId: "a", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "x.jpg" },
      { itemId: "b", proveedorId: "f", widthCm: 10, heightCm: 15, quantity: 1, sourceName: "x.png" },
    ]);
    expect(new Set(r.map((x) => x.ruta)).size).toBe(2);
  });
  it("limpia barras del nombre del cliente", () => {
    expect(rutasDelZip(1, "A/B", "MATE", items.slice(0, 1))[0].ruta.startsWith("Pedido 1 - A-B/")).toBe(true);
  });
  it("muestra medidas con decimales sin ceros de más", () => {
    expect(etiquetaTamano(15, 21)).toBe("15x21");
    expect(etiquetaTamano(10.5, 15)).toBe("10.5x15");
  });
});

describe("resumenParaLab", () => {
  it("suma copias por tamaño", () => {
    expect(resumenParaLab(items.slice(0, 3), "BRILLO")).toEqual([{ tamano: "13x18", papel: "Brillo", cantidad: 4 }]);
  });
});
```

```ts
// correo-lab.test.ts
import { describe, expect, it } from "vitest";
import { correoPedidoLab } from "./correo-lab";

const base = { estudio: "DNX Estudio", laboratorio: "Fotolag", numero: 12, cliente: "Juan Pérez", enlace: "https://x/archivos/t", vence: "2026-11-19", resumen: [{ tamano: "13x18", papel: "Brillo", cantidad: 4 }], prueba: false };

describe("correoPedidoLab", () => {
  it("asunto con PARA MAÑANA", () => {
    expect(correoPedidoLab(base).subject).toBe("Pedido 12 – PARA MAÑANA – Juan Pérez");
  });
  it("incluye enlace, total y tabla", () => {
    const c = correoPedidoLab(base);
    expect(c.text).toContain("https://x/archivos/t");
    expect(c.text).toContain("Total: 4 copias");
    expect(c.html).toContain("13x18");
  });
  it("en modo prueba lo avisa en el asunto", () => {
    expect(correoPedidoLab({ ...base, prueba: true }).subject.startsWith("[PRUEBA] ")).toBe(true);
  });
  it("escapa HTML del nombre del cliente", () => {
    expect(correoPedidoLab({ ...base, cliente: "<b>x</b>" }).html).not.toContain("<b>x</b>");
  });
});
```

- [ ] **Step 2: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/carpeta-lab.test.ts lib/impresiones/correo-lab.test.ts`

- [ ] **Step 3: Implementar `carpeta-lab.ts`**

```ts
import { ETIQUETA_PAPEL, type Papel } from "./constantes";

export type ItemParaLab = { itemId: string; proveedorId: string | null; widthCm: number; heightCm: number; quantity: number; sourceName: string };

export function agruparPorLaboratorio<T extends { proveedorId: string | null }>(items: T[]): Map<string | null, T[]> {
  const g = new Map<string | null, T[]>();
  for (const i of items) g.set(i.proveedorId, [...(g.get(i.proveedorId) ?? []), i]);
  return g;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));
export function etiquetaTamano(w: number, h: number): string {
  return `${num(Math.min(w, h))}x${num(Math.max(w, h))}`;
}

const limpio = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Cliente";
const baseSinExtension = (n: string) => limpio(n.replace(/\.[^.]+$/, ""));

export function rutasDelZip(numero: number, cliente: string, papel: Papel, items: ItemParaLab[]): { itemId: string; ruta: string }[] {
  const raiz = `Pedido ${numero} - ${limpio(cliente)}`;
  const usados = new Map<string, number>();
  return items.map((i) => {
    const carpeta = `${raiz}/${etiquetaTamano(i.widthCm, i.heightCm)} ${ETIQUETA_PAPEL[papel]}/${i.quantity} ${i.quantity === 1 ? "copia" : "copias"}`;
    let nombre = `${baseSinExtension(i.sourceName)}.jpg`;
    const clave = `${carpeta}/${nombre}`.toLowerCase();
    const n = usados.get(clave) ?? 0;
    usados.set(clave, n + 1);
    if (n > 0) nombre = `${baseSinExtension(i.sourceName)} (${n + 1}).jpg`;
    return { itemId: i.itemId, ruta: `${carpeta}/${nombre}` };
  });
}

export function resumenParaLab(items: ItemParaLab[], papel: Papel) {
  const m = new Map<string, number>();
  for (const i of items) {
    const t = etiquetaTamano(i.widthCm, i.heightCm);
    m.set(t, (m.get(t) ?? 0) + i.quantity);
  }
  return [...m.entries()].map(([tamano, cantidad]) => ({ tamano, papel: ETIQUETA_PAPEL[papel], cantidad }));
}
```

- [ ] **Step 4: Implementar `correo-lab.ts`**

```ts
export type DatosCorreoLab = {
  estudio: string; laboratorio: string; numero: number; cliente: string; enlace: string; vence: string;
  resumen: { tamano: string; papel: string; cantidad: number }[]; prueba: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fecha = (ymd: string) => ymd.split("-").reverse().join("/");

export function correoPedidoLab(d: DatosCorreoLab) {
  const total = d.resumen.reduce((s, r) => s + r.cantidad, 0);
  const subject = `${d.prueba ? "[PRUEBA] " : ""}Pedido ${d.numero} – PARA MAÑANA – ${d.cliente}`;
  const filas = d.resumen.map((r) => `- ${r.tamano} ${r.papel}: ${r.cantidad}`).join("\n");
  const text = [
    `Hola, ${d.laboratorio}:`,
    "",
    `${d.estudio} les envía el pedido ${d.numero}, para entregar MAÑANA.`,
    `Rotular el sobre: ${d.cliente}`,
    "",
    filas,
    `Total: ${total} ${total === 1 ? "copia" : "copias"}`,
    "",
    `Descargar los archivos (una carpeta ya ordenada por tamaño, papel y cantidad):`,
    d.enlace,
    `El enlace vence el ${fecha(d.vence)}.`,
    "",
    "Gracias.",
  ].join("\n");
  const html = `<p>Hola, ${esc(d.laboratorio)}:</p>
<p>${esc(d.estudio)} les envía el pedido <strong>${d.numero}</strong>, para entregar <strong>MAÑANA</strong>.<br>Rotular el sobre: <strong>${esc(d.cliente)}</strong></p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
<tr><th align="left">Tamaño</th><th align="left">Papel</th><th align="right">Copias</th></tr>
${d.resumen.map((r) => `<tr><td>${esc(r.tamano)}</td><td>${esc(r.papel)}</td><td align="right">${r.cantidad}</td></tr>`).join("")}
<tr><td colspan="2"><strong>Total</strong></td><td align="right"><strong>${total}</strong></td></tr>
</table>
<p><a href="${esc(d.enlace)}">Descargar los archivos</a> — una carpeta ya ordenada por tamaño, papel y cantidad. Vence el ${fecha(d.vence)}.</p>
<p>Gracias.</p>`;
  return { subject, text, html };
}
```

- [ ] **Step 5: Correr → PASS.** Mismo comando que el Step 2.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/impresiones/{carpeta-lab,correo-lab}*.ts
git commit -m "Armar la carpeta ordenada y el correo para el laboratorio"
```

---

### Task 5: Configuración (servidor + pantalla) y fotos de la carpeta

**Files:**
- Create: `apps/fotoffice/lib/impresiones/configuracion-servidor.ts` (+ `.test.ts`)
- Create: `apps/fotoffice/lib/impresiones/fuentes-servidor.ts` (+ `.test.ts`)
- Create: `apps/fotoffice/app/workspace/configuracion/impresiones/page.tsx`, `actions.ts`, `formulario-tamanos.tsx`
- Create: `apps/fotoffice/app/api/w/[workspaceSlug]/archivos/[token]/mini/[archivoId]/route.ts`
- Create: `apps/fotoffice/lib/carpetas/subir-servidor.ts`
- Modify: `apps/fotoffice/components/shell/shell-nav.tsx` (entrada junto a Proveedores, `href: "/workspace/configuracion/impresiones"`, visible si el módulo está encendido, igual que las entradas vecinas que dependen de módulo)

**Interfaces:**
- Consumes: constantes (Task 1), `aCentavos`, `TamanoOferta` (Task 3), `abrirCarpeta` lógica de token (`lib/carpetas/carpeta.ts`: token → hash con `hashDeToken` de `@/lib/presupuestos/enlace`), `urlDeLecturaArchivo` (`lib/carpetas/almacen.ts`), `clienteR2Privado`, `bucketR2Privado` (`lib/ficha/adjuntos-r2.ts`).
- Produces:
  - `leerAjustes(workspaceId: string): Promise<AjustesImpresion>` con `AjustesImpresion = { encendido: boolean; testMode: boolean; papeles: Papel[]; circuitId: string | null; tamanos: (TamanoOferta & { active: boolean; proveedorNombre: string | null })[] }`
  - `ofertaPublica(workspaceId: string): Promise<{ papeles: Papel[]; tamanos: TamanoOferta[] } | null>` (null = módulo apagado o sin tamaños con precio)
  - `sembrarTamanos(workspaceId: string): Promise<void>` (idempotente; mapea `proveedor` por nombre a `FotofficeProveedor`)
  - `guardarAjustes(workspaceId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }>`
  - `guardarTamanos(workspaceId: string, filas: unknown): Promise<{ ok: true } | { ok: false; error: string }>`
  - `proyectoDeTokenCliente(workspaceId: string, token: unknown): Promise<{ proyectoId: string; clientId: string; vence: Date | null } | null>` (sólo audiencia CLIENTE y carpeta vigente)
  - `fotosAptas(workspaceId: string, proyectoId: string): Promise<FotoApta[]>` con `FotoApta = { archivoId: string; nombre: string; key: string; width: number | null; height: number | null }`
  - `asegurarMiniatura(archivo: { id: string; key: string; tipo: string }): Promise<{ thumbKey: string; width: number; height: number }>`
  - `subirBuffer(clave: string, cuerpo: Buffer, tipo: string): Promise<void>` y `subirFlujo(clave: string, flujo: AsyncIterable<Buffer>, tipo: string): Promise<number>` (bytes) en `lib/carpetas/subir-servidor.ts`; ambos rechazan claves que no empiecen con `trabajos/` o `impresiones-mini/`.

- [ ] **Step 1: Pruebas de configuración** (`configuracion-servidor.test.ts`, con Prisma simulado a mano)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficePrintSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  fotofficePrintSize: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  fotofficeProveedor: { findMany: vi.fn() },
  workspaceFeatureModule: { findUnique: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
const C = await import("./configuracion-servidor");

beforeEach(() => vi.clearAllMocks());

describe("ofertaPublica", () => {
  it("sólo ofrece tamaños activos con precio", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: false });
    db.fotofficePrintSize.findMany.mockResolvedValue([
      { id: "a", widthCm: 10, heightCm: 15, proveedorId: "f", priceArs: "500", costArs: "200", active: true },
      { id: "b", widthCm: 13, heightCm: 18, proveedorId: "f", priceArs: null, costArs: "300", active: true },
    ]);
    const o = await C.ofertaPublica("ws");
    expect(o?.papeles).toEqual(["BRILLO"]);
    expect(o?.tamanos.map((t) => t.id)).toEqual(["a"]);
    expect(o?.tamanos[0].priceCents).toBe(50000);
  });
  it("sin tamaños con precio no hay oferta", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true });
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    expect(await C.ofertaPublica("ws")).toBeNull();
  });
});

describe("sembrarTamanos", () => {
  it("no siembra dos veces", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(3);
    await C.sembrarTamanos("ws");
    expect(db.fotofficePrintSize.createMany).not.toHaveBeenCalled();
  });
  it("asigna Fotolag y La Isla por nombre", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(0);
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "f", name: "Fotolag" }, { id: "i", name: "La Isla" }]);
    await C.sembrarTamanos("ws");
    const data = db.fotofficePrintSize.createMany.mock.calls[0][0].data;
    expect(data.find((d: { widthCm: number }) => d.widthCm === 20 && true)?.proveedorId).toBe("f");
    expect(data.find((d: { widthCm: number }) => d.widthCm === 50)?.proveedorId).toBe("i");
  });
});

describe("guardarTamanos", () => {
  it("rechaza precios negativos", async () => {
    expect((await C.guardarTamanos("ws", [{ id: "a", costArs: "-1", priceArs: "100", proveedorId: null, active: true }])).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/configuracion-servidor.test.ts`

- [ ] **Step 3: Implementar `configuracion-servidor.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PRINT_ORDERS_MODULE_KEY, TAMANOS_INICIALES, type Papel } from "./constantes";
import { aCentavos, type TamanoOferta } from "./precios";

const papelesDe = (s: { paperGlossy: boolean; paperMatte: boolean } | null): Papel[] =>
  [...((s?.paperGlossy ?? true) ? (["BRILLO"] as const) : []), ...((s?.paperMatte ?? true) ? (["MATE"] as const) : [])];

type FilaTamano = { id: string; widthCm: unknown; heightCm: unknown; proveedorId: string | null; priceArs: unknown; costArs: unknown; active: boolean };
const aOferta = (t: FilaTamano): TamanoOferta | null => {
  const priceCents = aCentavos(t.priceArs as never);
  if (priceCents === null || priceCents <= 0) return null;
  return { id: t.id, widthCm: Number(t.widthCm), heightCm: Number(t.heightCm), proveedorId: t.proveedorId, priceCents, costCents: aCentavos(t.costArs as never) ?? 0 };
};

export async function ofertaPublica(workspaceId: string): Promise<{ papeles: Papel[]; tamanos: TamanoOferta[] } | null> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY))) return null;
  const [ajustes, filas] = await Promise.all([
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({ where: { workspaceId, active: true }, orderBy: [{ order: "asc" }, { widthCm: "asc" }] }),
  ]);
  const tamanos = (filas as FilaTamano[]).map(aOferta).filter((t): t is TamanoOferta => t !== null);
  const papeles = papelesDe(ajustes);
  if (tamanos.length === 0 || papeles.length === 0) return null;
  return { papeles, tamanos };
}

export async function sembrarTamanos(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficePrintSize.count({ where: { workspaceId } })) > 0) return;
  const proveedores = await prisma.fotofficeProveedor.findMany({ where: { workspaceId }, select: { id: true, name: true } });
  const porNombre = new Map(proveedores.map((p) => [p.name.trim().toLowerCase(), p.id]));
  await prisma.fotofficePrintSize.createMany({
    data: TAMANOS_INICIALES.map((t, i) => ({ workspaceId, widthCm: t.widthCm, heightCm: t.heightCm, proveedorId: porNombre.get(t.proveedor.toLowerCase()) ?? null, order: i, active: true })),
    skipDuplicates: true,
  });
}

const monto = (v: unknown): number | null | "malo" => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "malo";
};

export async function guardarTamanos(workspaceId: string, filas: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(filas)) return { ok: false, error: "Datos inválidos." };
  const cambios = [];
  for (const f of filas as Record<string, unknown>[]) {
    const cost = monto(f.costArs);
    const price = monto(f.priceArs);
    if (cost === "malo" || price === "malo") return { ok: false, error: "Revisá los montos: tienen que ser números positivos." };
    if (typeof f.id !== "string") return { ok: false, error: "Datos inválidos." };
    cambios.push({ id: f.id, costArs: cost, priceArs: price, proveedorId: typeof f.proveedorId === "string" && f.proveedorId ? f.proveedorId : null, active: f.active === true });
  }
  for (const c of cambios) {
    await prisma.fotofficePrintSize.update({ where: { id: c.id, workspaceId }, data: { costArs: c.costArs, priceArs: c.priceArs, proveedorId: c.proveedorId, active: c.active } });
  }
  return { ok: true };
}

export type AjustesImpresion = {
  encendido: boolean; testMode: boolean; papeles: Papel[]; circuitId: string | null;
  tamanos: { id: string; widthCm: number; heightCm: number; proveedorId: string | null; proveedorNombre: string | null; costArs: string; priceArs: string; active: boolean }[];
};

export async function leerAjustes(workspaceId: string): Promise<AjustesImpresion> {
  await sembrarTamanos(workspaceId);
  const [encendido, s, filas] = await Promise.all([
    isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY),
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId } }),
    prisma.fotofficePrintSize.findMany({ where: { workspaceId }, orderBy: [{ order: "asc" }], include: { proveedor: { select: { name: true } } } }),
  ]);
  return {
    encendido, testMode: s?.testMode ?? true, papeles: papelesDe(s), circuitId: s?.circuitId ?? null,
    tamanos: filas.map((t) => ({ id: t.id, widthCm: Number(t.widthCm), heightCm: Number(t.heightCm), proveedorId: t.proveedorId, proveedorNombre: t.proveedor?.name ?? null, costArs: t.costArs?.toString() ?? "", priceArs: t.priceArs?.toString() ?? "", active: t.active })),
  };
}

export async function guardarAjustes(workspaceId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const paperGlossy = r.paperGlossy === true;
  const paperMatte = r.paperMatte === true;
  if (!paperGlossy && !paperMatte) return { ok: false, error: "Dejá al menos un papel encendido." };
  const circuitId = typeof r.circuitId === "string" && r.circuitId ? r.circuitId : null;
  const data = { testMode: r.testMode === true, paperGlossy, paperMatte, circuitId };
  await prisma.fotofficePrintSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  return { ok: true };
}
```

- [ ] **Step 4: Correr → PASS.**

- [ ] **Step 5: Implementar `lib/carpetas/subir-servidor.ts`**

```ts
import "server-only";
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, PutObjectCommand, UploadPartCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { enBloques } from "@/lib/galerias/zip";

const PERMITIDAS = ["trabajos/", "impresiones-mini/"];
function exigirClave(clave: string) {
  if (!PERMITIDAS.some((p) => clave.startsWith(p)) || clave.includes("..")) throw new Error(`Clave no permitida: ${clave}`);
}

export async function subirBuffer(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
  exigirClave(clave);
  await clienteR2Privado().send(new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, Body: cuerpo, ContentType: tipo }));
}

/** Sube un flujo en partes de 8 MB (mínimo de S3/R2: 5 MB salvo la última). Devuelve los bytes subidos. */
export async function subirFlujo(clave: string, flujo: AsyncIterable<Buffer>, tipo: string): Promise<number> {
  exigirClave(clave);
  const s3 = clienteR2Privado();
  const Bucket = bucketR2Privado();
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket, Key: clave, ContentType: tipo }));
  const partes: { ETag: string; PartNumber: number }[] = [];
  let bytes = 0;
  try {
    let n = 1;
    for await (const bloque of enBloques(flujo, 8 * 1024 * 1024)) {
      const r = await s3.send(new UploadPartCommand({ Bucket, Key: clave, UploadId, PartNumber: n, Body: bloque }));
      partes.push({ ETag: r.ETag!, PartNumber: n });
      bytes += bloque.length;
      n++;
    }
    await s3.send(new CompleteMultipartUploadCommand({ Bucket, Key: clave, UploadId, MultipartUpload: { Parts: partes } }));
    return bytes;
  } catch (e) {
    await s3.send(new AbortMultipartUploadCommand({ Bucket, Key: clave, UploadId })).catch(() => {});
    throw e;
  }
}
```

(Verificar los nombres exactos que exporta `lib/ficha/adjuntos-r2.ts` y cómo `lib/carpetas/almacen.ts` arma el cliente; usar los mismos.)

- [ ] **Step 6: Pruebas de fuentes** (`fuentes-servidor.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  fotofficeArchivoTrabajo: { findMany: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/presupuestos/enlace", () => ({ hashDeToken: (t: string) => `h:${t}` }));
const F = await import("./fuentes-servidor");

describe("proyectoDeTokenCliente", () => {
  it("sólo acepta el enlace del cliente y vigente", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await F.proyectoDeTokenCliente("ws", "tok")).toBeNull();
    expect(db.fotofficeProyecto.findFirst.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws", carpetaClienteHash: "h:tok" });
  });
  it("rechaza tokens que no son texto", async () => {
    expect(await F.proyectoDeTokenCliente("ws", 123)).toBeNull();
  });
});

describe("fotosAptas", () => {
  it("deja sólo imágenes listas", async () => {
    db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([
      { id: "1", nombre: "a.jpg", key: "k1", tipo: "image/jpeg", printSource: { width: 6000, height: 4000 } },
      { id: "2", nombre: "v.mp4", key: "k2", tipo: "video/mp4", printSource: null },
      { id: "3", nombre: "s.tif", key: "k3", tipo: "image/tiff", printSource: null },
    ]);
    const r = await F.fotosAptas("ws", "p");
    expect(r.map((x) => x.archivoId)).toEqual(["1", "3"]);
    expect(r[0]).toMatchObject({ width: 6000, height: 4000 });
    expect(r[1]).toMatchObject({ width: null, height: null });
  });
});
```

- [ ] **Step 7: Implementar `fuentes-servidor.ts`**

```ts
import "server-only";
import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { hashDeToken } from "@/lib/presupuestos/enlace";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { subirBuffer } from "@/lib/carpetas/subir-servidor";
import { TIPOS_IMAGEN } from "./constantes";

sharp.cache(false);
sharp.concurrency(1);
const MAX_PIXELES = 200_000_000;

export async function proyectoDeTokenCliente(workspaceId: string, token: unknown) {
  if (typeof token !== "string" || token.length < 16 || token.length > 200) return null;
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { workspaceId, carpetaClienteHash: hashDeToken(token) },
    select: { id: true, clientId: true, carpetaVence: true },
  });
  if (!p || (p.carpetaVence && p.carpetaVence < new Date())) return null;
  return { proyectoId: p.id, clientId: p.clientId, vence: p.carpetaVence };
}

export type FotoApta = { archivoId: string; nombre: string; key: string; width: number | null; height: number | null };

export async function fotosAptas(workspaceId: string, proyectoId: string): Promise<FotoApta[]> {
  const filas = await prisma.fotofficeArchivoTrabajo.findMany({
    where: { workspaceId, proyectoId, estado: "LISTO" },
    orderBy: { createdAt: "asc" },
    select: { id: true, nombre: true, key: true, tipo: true, printSource: { select: { width: true, height: true } } },
  });
  return filas
    .filter((f) => (TIPOS_IMAGEN as readonly string[]).includes(f.tipo))
    .map((f) => ({ archivoId: f.id, nombre: f.nombre, key: f.key, width: f.printSource?.width ?? null, height: f.printSource?.height ?? null }));
}

export async function leerOriginal(key: string): Promise<Buffer> {
  const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

/** Miniatura de 1000 px y medidas reales (ya rotadas por EXIF). Se guarda la primera vez. */
export async function asegurarMiniatura(archivo: { id: string; key: string }) {
  const ya = await prisma.fotofficePrintSourceImage.findUnique({ where: { archivoId: archivo.id } });
  if (ya) return { thumbKey: ya.thumbKey, width: ya.width, height: ya.height };
  const original = await leerOriginal(archivo.key);
  const img = sharp(original, { limitInputPixels: MAX_PIXELES }).rotate();
  const { width, height } = await img.metadata().then((m) => {
    const girada = (m.orientation ?? 1) >= 5;
    return { width: (girada ? m.height : m.width) ?? 0, height: (girada ? m.width : m.height) ?? 0 };
  });
  const mini = await sharp(original, { limitInputPixels: MAX_PIXELES }).rotate().resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const thumbKey = `impresiones-mini/${archivo.id}.jpg`;
  await subirBuffer(thumbKey, mini, "image/jpeg");
  await prisma.fotofficePrintSourceImage.upsert({ where: { archivoId: archivo.id }, create: { archivoId: archivo.id, thumbKey, width, height }, update: {} });
  return { thumbKey, width, height };
}
```

Agregar `impresiones-mini/` a la limpieza: en `purgarCarpetas` no hace falta (la fila se borra en cascada con el archivo, pero el objeto R2 queda). Anotar en el JSDoc de `asegurarMiniatura` que la miniatura se borra junto con el archivo en `borrarArchivoGuardado` — **modificar** `purgarCarpetas` en `lib/carpetas/carpeta.ts` para borrar también `impresiones-mini/<archivoId>.jpg` de cada archivo que purga (una línea `await borrarArchivoGuardado(\`impresiones-mini/${a.id}.jpg\`).catch(() => {})` en el mismo bucle).

- [ ] **Step 8: Ruta de miniatura** (`app/api/w/[workspaceSlug]/archivos/[token]/mini/[archivoId]/route.ts`)

```ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { workspaceDelSlug } from "@/lib/website/workspace-del-slug"; // usar el mismo helper que importa app/w/[workspaceSlug]/archivos/[token]/page.tsx
import { proyectoDeTokenCliente, asegurarMiniatura } from "@/lib/impresiones/fuentes-servidor";
import { urlDeLecturaArchivo } from "@/lib/carpetas/almacen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string; token: string; archivoId: string }> }) {
  const { workspaceSlug, token, archivoId } = await params;
  const ws = await workspaceDelSlug(workspaceSlug);
  if (!ws) return new NextResponse(null, { status: 404 });
  const p = await proyectoDeTokenCliente(ws.id, token);
  if (!p) return new NextResponse(null, { status: 404 });
  const archivo = await prisma.fotofficeArchivoTrabajo.findFirst({ where: { id: archivoId, proyectoId: p.proyectoId, estado: "LISTO" }, select: { id: true, key: true } });
  if (!archivo) return new NextResponse(null, { status: 404 });
  try {
    const m = await asegurarMiniatura(archivo);
    return NextResponse.redirect(await urlDeLecturaArchivo(m.thumbKey, `${archivo.id}.jpg`, "ver"), 302);
  } catch {
    return new NextResponse(null, { status: 422 });
  }
}
```

(Copiar el import exacto de `workspaceDelSlug` desde `app/w/[workspaceSlug]/archivos/[token]/page.tsx`; si devuelve otra forma, adaptar `ws.id`.)

- [ ] **Step 9: Pantalla de configuración**

`app/workspace/configuracion/impresiones/page.tsx` (patrón de `configuracion/proveedores/page.tsx`): `requireActiveWorkspaceRole()`, si `!puede(role, "configurar")` mostrar aviso; si no, `leerAjustes(workspace.id)` + `prisma.fotofficeProveedor.findMany({ where: { workspaceId, active: true } })` + circuitos `prisma.fotofficeCircuit.findMany({ where: { workspaceId, kind: "TRABAJO", isActive: true } })`. Render:
- Aviso si el módulo está apagado, con enlace a Configuración → Módulos.
- Formulario de ajustes: casillas «Brillo», «Mate», «Modo prueba (los correos al laboratorio te llegan a vos)», selector de circuito (por omisión el llamado `CIRCUITO_POR_OMISION`).
- `<FormularioTamanos>` (cliente): tabla con medida, selector de laboratorio, costo, precio de venta, ganancia calculada en vivo (`precio - costo`, en rojo si es negativa), activo. Botón «Guardar».

`actions.ts`: `guardarAjustesAction(formData)` y `guardarTamanosAction(filas)` con el helper `contexto()` del patrón de proveedores, `revalidatePath("/workspace/configuracion/impresiones")` y `redirect("…?ok=1")` / `?error=`.

- [ ] **Step 10: Verificar en el navegador** (con `next dev --webpack` en el worktree): la página carga, siembra 9 tamaños, guardar precios funciona, ganancia se recalcula.

- [ ] **Step 11: Commit**

```bash
git add apps/fotoffice/lib/impresiones apps/fotoffice/lib/carpetas apps/fotoffice/app/workspace/configuracion/impresiones apps/fotoffice/app/api/w apps/fotoffice/components/shell/shell-nav.tsx
git commit -m "Configurar tamaños y precios de impresión y servir miniaturas de la carpeta"
```

---

### Task 6: Crear el pedido y cobrar (servidor + pantalla del cliente)

**Files:**
- Create: `apps/fotoffice/lib/impresiones/pago-servidor.ts` (+ `.test.ts`)
- Create: `apps/fotoffice/app/w/[workspaceSlug]/archivos/[token]/imprimir/page.tsx`, `pedido-cliente.tsx`, `actions.ts`
- Create: `apps/fotoffice/components/impresiones/editor-recorte.tsx`
- Modify: `apps/fotoffice/components/carpetas/carpeta-publica.tsx` (prop opcional `enlaceImprimir?: string`; si viene, botón destacado «Pedir copias impresas» arriba de la lista) y `app/w/[workspaceSlug]/archivos/[token]/page.tsx` (si `vista.audiencia === "CLIENTE"` y `ofertaPublica(workspaceId)` no es null, pasar `enlaceImprimir={\`./${token}/imprimir\`}` — usar la ruta absoluta `/w/${slug}/archivos/${token}/imprimir`, que en dominio propio se reescribe sola)

**Interfaces:**
- Consumes: `validarCarrito`, `cotizar` (Task 3); `ofertaPublica`, `proyectoDeTokenCliente`, `fotosAptas` (Task 5); `resolveWorkspaceCollector` (`lib/payments/connect/collector.ts`); `createMercadoPagoCheckoutProLiveAdapter` (`@repo/payments/mercado-pago`); `PREFIJO_REFERENCIA_IMPRESION` (Task 1).
- Produces:
  - `referenciaPedido(id: string): string` / `pedidoDeReferencia(raw: unknown): string | null`
  - `iniciarPagoImpresion(workspaceId: string, token: unknown, datos: unknown): Promise<{ ok: true; checkoutUrl: string; pedidoId: string } | { ok: false; error: string }>` donde `datos = { carrito: { papel, lineas }, nombre, email, telefono }`
  - `verificarVueltaImpresion(workspaceId: string, pedidoId: unknown, paymentId: unknown): Promise<{ estado: "PAGADO" | "PENDIENTE" | "RECHAZADO"; seguimiento: string | null }>`

- [ ] **Step 1: Pruebas de `pago-servidor`** (mismo esquema de mocks que `lib/galerias/pago.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  preferencia: vi.fn(async () => ({ providerPreferenceId: "pref-1", checkoutUrl: "https://mp.test/checkout" })),
  collector: vi.fn(async () => ({ ok: true, collector: { accessToken: "tok" } })),
  oferta: vi.fn(),
  proyecto: vi.fn(),
  fotos: vi.fn(),
  db: {
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(H.db)),
    $executeRaw: vi.fn(),
    fotofficePrintOrder: { aggregate: vi.fn(async () => ({ _max: { number: 7 } })), create: vi.fn(async ({ data }: { data: { id?: string } }) => ({ id: "ord1", ...data })), update: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: H.db, Prisma: { JsonNull: null } }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@repo/payments/mercado-pago", () => ({ createMercadoPagoCheckoutProLiveAdapter: () => ({ createPreference: H.preferencia }) }));
vi.mock("./configuracion-servidor", () => ({ ofertaPublica: H.oferta }));
vi.mock("./fuentes-servidor", () => ({ proyectoDeTokenCliente: H.proyecto, fotosAptas: H.fotos }));
const P = await import("./pago-servidor");

const R = { x: 0, y: 0, w: 1, h: 1 };
const datos = { carrito: { papel: "BRILLO", lineas: [{ archivoId: "a1", sizeId: "t10", quantity: 2, recorte: R }] }, nombre: "Juan", email: "juan@test.com", telefono: "" };

beforeEach(() => {
  vi.clearAllMocks();
  H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }] });
  H.proyecto.mockResolvedValue({ proyectoId: "p1", clientId: "c1", vence: null });
  H.fotos.mockResolvedValue([{ archivoId: "a1", nombre: "a.jpg", key: "k", width: 6000, height: 4000 }]);
});

describe("iniciarPagoImpresion", () => {
  it("crea el pedido con el total del servidor y la preferencia con la cuenta del estudio", async () => {
    const r = await P.iniciarPagoImpresion("ws", "token-largo-0000000", datos);
    expect(r).toEqual({ ok: true, checkoutUrl: "https://mp.test/checkout", pedidoId: "ord1" });
    const creado = H.db.fotofficePrintOrder.create.mock.calls[0][0].data;
    expect(creado.number).toBe(8);
    expect(String(creado.totalArs)).toBe("1000");
    expect(H.preferencia.mock.calls[0][0]).toMatchObject({ amountMinor: 100000, externalReference: "fo-impresion:ord1", accessTokenOverride: "tok" });
  });
  it("sin oferta (módulo apagado) no cobra", async () => {
    H.oferta.mockResolvedValue(null);
    expect((await P.iniciarPagoImpresion("ws", "token-largo-0000000", datos)).ok).toBe(false);
  });
  it("correo inválido no cobra", async () => {
    expect((await P.iniciarPagoImpresion("ws", "token-largo-0000000", { ...datos, email: "x" })).ok).toBe(false);
  });
  it("sin Mercado Pago conectado avisa", async () => {
    H.collector.mockResolvedValue({ ok: false });
    expect(await P.iniciarPagoImpresion("ws", "token-largo-0000000", datos)).toEqual({ ok: false, error: "El estudio todavía no puede cobrar online. Escribile para hacer el pedido." });
  });
});

describe("referencias", () => {
  it("ida y vuelta", () => {
    expect(P.pedidoDeReferencia(P.referenciaPedido("abc"))).toBe("abc");
    expect(P.pedidoDeReferencia("fo-galcompra:abc")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/pago-servidor.test.ts`

- [ ] **Step 3: Implementar `pago-servidor.ts`**

```ts
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { PREFIJO_REFERENCIA_IMPRESION } from "./constantes";
import { validarCarrito } from "./carrito";
import { cotizar } from "./precios";
import { ofertaPublica } from "./configuracion-servidor";
import { fotosAptas, proyectoDeTokenCliente } from "./fuentes-servidor";

export const referenciaPedido = (id: string) => `${PREFIJO_REFERENCIA_IMPRESION}${id}`;
export function pedidoDeReferencia(raw: unknown): string | null {
  return typeof raw === "string" && raw.startsWith(PREFIJO_REFERENCIA_IMPRESION) && raw.length > PREFIJO_REFERENCIA_IMPRESION.length
    ? raw.slice(PREFIJO_REFERENCIA_IMPRESION.length) : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const base = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
const pesos = (cents: number) => (cents / 100).toFixed(2);

export async function iniciarPagoImpresion(workspaceId: string, token: unknown, datos: unknown) {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 120) : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  const telefono = typeof d.telefono === "string" ? d.telefono.trim().slice(0, 40) : "";
  if (!nombre) return { ok: false as const, error: "Escribí tu nombre." };
  if (!EMAIL.test(email)) return { ok: false as const, error: "Revisá tu correo." };

  const [oferta, proyecto] = await Promise.all([ofertaPublica(workspaceId), proyectoDeTokenCliente(workspaceId, token)]);
  if (!oferta || !proyecto) return { ok: false as const, error: "Este enlace ya no permite pedir copias." };
  const fotos = await fotosAptas(workspaceId, proyecto.proyectoId);
  const porId = new Map(fotos.map((f) => [f.archivoId, f]));
  const carrito = validarCarrito(d.carrito, new Set(porId.keys()), oferta.papeles);
  if (!carrito.ok) return { ok: false as const, error: carrito.error };
  const c = cotizar(carrito.lineas, oferta.tamanos);
  if ("error" in c) return { ok: false as const, error: c.error };

  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return { ok: false as const, error: "El estudio todavía no puede cobrar online. Escribile para hacer el pedido." };

  const pedido = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-impresion-numero:${workspaceId}`}))`;
    const max = await tx.fotofficePrintOrder.aggregate({ where: { workspaceId }, _max: { number: true } });
    return tx.fotofficePrintOrder.create({
      data: {
        workspaceId, number: (max._max.number ?? 0) + 1, source: "CARPETA", proyectoOrigenId: proyecto.proyectoId, clientId: proyecto.clientId,
        nombre, email, telefono: telefono || null, paper: carrito.papel, delivery: "RETIRO",
        subtotalArs: pesos(c.subtotalCents), shippingArs: "0", totalArs: pesos(c.subtotalCents), costTotalArs: pesos(c.costCents),
        pricingSnapshot: { tamanos: oferta.tamanos, gananciaCents: c.gananciaCents },
        trackingToken: randomBytes(18).toString("base64url"),
        items: { create: c.lineas.map((l) => {
          const f = porId.get(l.archivoId)!;
          return { archivoId: l.archivoId, sourceKey: f.key, sourceName: f.nombre, sizeId: l.sizeId, widthCm: l.widthCm, heightCm: l.heightCm, quantity: l.quantity,
            unitPriceArs: pesos(l.unitPriceCents), unitCostArs: pesos(l.unitCostCents), cropX: l.recorte.x, cropY: l.recorte.y, cropW: l.recorte.w, cropH: l.recorte.h, proveedorId: l.proveedorId };
        }) },
      },
    });
  });

  const vuelta = (estado: string) => `${base()}/w/_/impresion/${pedido.trackingToken}?pago=${estado}&pedido=${pedido.id}`;
  const adapter = createMercadoPagoCheckoutProLiveAdapter({});
  const pref = await adapter.createPreference({
    amountMinor: c.subtotalCents, currency: "ARS", description: `Copias impresas · pedido ${pedido.number}`,
    externalReference: referenciaPedido(pedido.id), idempotencyKey: randomUUID(),
    successUrl: vuelta("ok"), pendingUrl: vuelta("pendiente"), failureUrl: vuelta("error"),
    notificationUrl: `${base()}/api/payments/mp/impresiones-webhook?ws=${encodeURIComponent(workspaceId)}`,
    accessTokenOverride: collector.collector.accessToken, itemId: `impresion-${pedido.id}`, sourceApp: "FOTOFFICE",
    metadata: { pedidoId: pedido.id, workspaceId }, payerEmail: email,
  });
  await prisma.fotofficePrintOrder.update({ where: { id: pedido.id }, data: { mpPreferenceId: pref.providerPreferenceId } });
  return { ok: true as const, checkoutUrl: pref.checkoutUrl, pedidoId: pedido.id };
}
```

Nota: en `vuelta`, reemplazar `/w/_/` por el slug real del workspace (leer `fotofficeWorkspaceBranding.publicSlug` una vez al principio); se dejó `_` para que la prueba no dependa de él — ajustar la prueba agregando el mock de `fotofficeWorkspaceBranding.findUnique` si se lee de la base.

`verificarVueltaImpresion`: copiar `verificarVueltaGaleria` (`lib/galerias/pago.ts:163`): con `adapter.getPayment(paymentId)` o `searchPaymentsByExternalReference(referenciaPedido(id))`, si el pago es aprobado llamar `acreditarPagoImpresion` (Task 7) y devolver `{ estado: "PAGADO", seguimiento }`; si no, `PENDIENTE`/`RECHAZADO`.

- [ ] **Step 4: Correr → PASS.**

- [ ] **Step 5: Pantalla del cliente**

`imprimir/page.tsx` (server): resuelve workspace por slug, `proyectoDeTokenCliente`, `ofertaPublica`, `fotosAptas`; si falta algo → `notFound()`. Pasa a `<PedidoCliente>`: fotos `{ archivoId, nombre, mini: \`/api/w/${slug}/archivos/${token}/mini/${archivoId}\`, width, height }`, tamaños, papeles, datos del cliente precargados (`prisma.client.findUnique({ where: { id: clientId } })` → nombre, email, teléfono), plazo «dentro de 48 horas hábiles desde el pago». `metadata: { robots: { index: false } }`.

`pedido-cliente.tsx` ("use client"), estado `Map<archivoId, { sizeId, quantity, recorte }[]>` y `papel`:
1. **Elegir**: grilla `grid-cols-2 md:grid-cols-4 xl:grid-cols-5`, cada miniatura `<img loading="lazy">` con contador de copias encima. Clic → panel con la foto grande, lista de copias (selector de tamaño con precio, cantidad − / +, quitar), «Agregar otra copia». Arriba: «Aplicar a todas las fotos» (tamaño + cantidad). Barra fija abajo: copias y total (usa `cotizar` en el navegador sólo para mostrar).
2. **Recorte**: lista de copias donde `!coincideProporcion(...)` (si `width`/`height` son null, la miniatura trae `naturalWidth/Height` al cargar: guardarlos en estado y usar esa proporción). Cada una con `<EditorRecorte>`. Aviso «Puede verse pixelada» si `pppDelRecorte(...) < PPP_MINIMO` (sólo si se conocen las medidas reales).
3. **Datos**: nombre, correo, teléfono; «Retiro en el local»; plazo.
4. **Pagar**: llama `iniciarPagoImpresionAction(token, datos)` y hace `window.location.href = checkoutUrl`. Errores en línea.

`components/impresiones/editor-recorte.tsx` ("use client"): props `{ src, fotoW, fotoH, tamW, tamH, valor: Recorte, onCambio(r) }`. Marco con la proporción de `orientarTamano`, imagen detrás; arrastre con Pointer Events mueve `x/y`; rueda o control deslizante «Zoom» (1×–3×) achica `w/h` manteniendo la proporción y el centro; siempre se recorta a límites para que `recorteValido` dé true.

`actions.ts` ("use server"): `iniciarPagoImpresionAction(slug: string, token: string, datos: unknown)` → resuelve workspace y llama `iniciarPagoImpresion`.

- [ ] **Step 6: Verificar en el navegador** con datos reales de un trabajo de DNX con carpeta de cliente: se ven miniaturas, se arman copias, el recorte se mueve, el total coincide. (No pagar todavía.)

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/impresiones/pago-servidor* apps/fotoffice/app/w apps/fotoffice/components
git commit -m "Pantalla del cliente para pedir copias y cobro con Mercado Pago"
```

---

### Task 7: Acreditar el pago (webhook, trabajos, Caja)

**Files:**
- Create: `apps/fotoffice/lib/impresiones/acreditar-servidor.ts` (+ `.test.ts`)
- Create: `apps/fotoffice/app/api/payments/mp/impresiones-webhook/route.ts`
- Modify: `apps/fotoffice/lib/proyectos/crear.ts` (exportar `crearProyectoDeSistema`)

**Interfaces:**
- Consumes: `pedidoDeReferencia` (Task 6); `sumarDiasHabiles` (Task 3); `agruparPorLaboratorio` (Task 4); `hechosDelPago`, `pagoAprobado` (`lib/galerias/venta-publica.ts`, reexportan de `lib/pedidos/mp-puro.ts`); `recordCashMovement` (`lib/cash/record-movement.ts`); `resolveDepositTarget` (`lib/cash/auto-deposit`); `CASH_MODULE_KEY`; `contextoDeSistema` (`lib/circuitos/acceso.ts`); `extractPaymentId` (`lib/bookings/webhook-payload`).
- Produces:
  - `crearProyectoDeSistema(tx: Tx, workspaceId: string, d: { clientId: string; circuitId: string; nombre: string; baseDate: string; proveedorId: string | null; ahora: Date }): Promise<{ id: string; number: string }>`
  - `type PagoMp = { providerPaymentId: string; status: string; amountMinor: number; currency: string; externalReference: string | null; rawSanitized: Record<string, unknown> }` (mismo tipo que `lib/galerias/acreditar.ts`; importarlo de ahí)
  - `acreditarPagoImpresion(workspaceId: string, pago: PagoMp): Promise<{ ok: true; yaEstaba: boolean } | { ok: false; error: "NO_ES_IMPRESION" | "NO_APROBADO" | "MONEDA" | "IMPORTE_MENOR" | "NO_EXISTE" }>`

- [ ] **Step 1: Exportar `crearProyectoDeSistema` en `lib/proyectos/crear.ts`**

```ts
/** Crea un trabajo sin usuario (pagos automáticos). Mismo camino que `insertarProyecto`. */
export async function crearProyectoDeSistema(
  tx: Tx,
  workspaceId: string,
  d: { clientId: string; circuitId: string; nombre: string; baseDate: string; proveedorId: string | null; ahora: Date },
): Promise<{ id: string; number: string }> {
  const ctx = contextoDeSistema(workspaceId);
  const etapas = await tx.fotofficeStage.findMany({ where: { circuitId: d.circuitId }, orderBy: { order: "asc" }, select: { id: true, days: true } });
  return insertarProyecto(tx, ctx, {
    workspaceId, clientId: d.clientId, pedidoId: null, pedidoItemIndex: null, productId: null, circuitId: d.circuitId,
    nombre: d.nombre, eventDate: null, baseDate: d.baseDate, finalDueDate: null, ownerUserId: null,
    etapas, createdByUserId: null, ahora: d.ahora, proveedorId: d.proveedorId ?? undefined,
  });
}
```

(Ajustar: si `insertarProyecto` devuelve otra forma, devolver `{ id, number }` leyendo el proyecto creado; si las etapas se leen con otro nombre de campo que `days`, copiar cómo lo hace `crearProyectoManual`.)

- [ ] **Step 2: Pruebas de acreditación** (`acreditar-servidor.test.ts`, Prisma simulado)

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  const pedido = {
    id: "ord1", workspaceId: "ws", number: 8, status: "PENDIENTE_PAGO", totalArs: "1000", nombre: "Juan", email: "j@t.com", telefono: null, clientId: "c1",
    items: [
      { id: "i1", proveedorId: "f", quantity: 2, unitCostArs: "200" },
      { id: "i2", proveedorId: "isla", quantity: 1, unitCostArs: "600" },
    ],
  };
  const db: Record<string, unknown> = {};
  Object.assign(db, {
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(db)),
    fotofficePrintOrder: {
      findUnique: vi.fn(async () => pedido),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(),
    },
    fotofficePrintOrderItem: { updateMany: vi.fn() },
    fotofficePrintSettings: { findUnique: vi.fn(async () => ({ circuitId: "circ" })) },
    fotofficeCircuit: { findFirst: vi.fn(async () => ({ id: "circ" })) },
    fotofficeProyecto: { update: vi.fn() },
  });
  return { db, pedido, crear: vi.fn(async (_tx: unknown, _ws: string, d: { proveedorId: string }) => ({ id: `p-${d.proveedorId}`, number: "T-1" })), caja: vi.fn(async () => ({ id: "mov1", created: true })) };
});
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (f: () => unknown) => void f() }));
vi.mock("@repo/db", () => ({ prisma: H.db }));
vi.mock("@/lib/proyectos/crear", () => ({ crearProyectoDeSistema: H.crear }));
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement: H.caja }));
vi.mock("@/lib/cash/auto-deposit", () => ({ resolveDepositTarget: vi.fn(async () => ({ accountId: "acc" })) }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
vi.mock("./avisos-servidor", () => ({ avisarPedidoConfirmado: vi.fn() }));
const A = await import("./acreditar-servidor");

const pago = (o: Partial<{ status: string; amountMinor: number; currency: string; externalReference: string }> = {}) => ({
  providerPaymentId: "mp-1", status: "approved", amountMinor: 100000, currency: "ARS", externalReference: "fo-impresion:ord1",
  rawSanitized: { status: "approved", fee_details: [{ type: "mercadopago_fee", amount: 61 }], date_approved: "2026-10-20T15:00:00.000-03:00" }, ...o,
});

beforeEach(() => { vi.clearAllMocks(); H.pedido.status = "PENDIENTE_PAGO"; });

describe("acreditarPagoImpresion", () => {
  it("pasa a PAGADO, crea un trabajo por laboratorio y registra Caja", async () => {
    const r = await A.acreditarPagoImpresion("ws", pago());
    expect(r).toEqual({ ok: true, yaEstaba: false });
    expect(H.crear).toHaveBeenCalledTimes(2);
    expect(H.caja).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceModule: "impresiones", sourceRef: "ord1", amountMinor: 100000, kind: "INGRESO" }));
  });
  it("un aviso repetido no duplica nada", async () => {
    (H.db.fotofficePrintOrder as { updateMany: ReturnType<typeof vi.fn> }).updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await A.acreditarPagoImpresion("ws", pago());
    expect(r).toEqual({ ok: true, yaEstaba: true });
    expect(H.crear).not.toHaveBeenCalled();
    expect(H.caja).not.toHaveBeenCalled();
  });
  it("importe menor no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ amountMinor: 50000 }))).toEqual({ ok: false, error: "IMPORTE_MENOR" });
  });
  it("otra moneda no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ currency: "USD" }))).toEqual({ ok: false, error: "MONEDA" });
  });
  it("pago no aprobado no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ status: "rejected" }))).toEqual({ ok: false, error: "NO_APROBADO" });
  });
  it("referencia ajena se ignora", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ externalReference: "fo-galcompra:x" }))).toEqual({ ok: false, error: "NO_ES_IMPRESION" });
  });
});
```

- [ ] **Step 3: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/acreditar-servidor.test.ts`

- [ ] **Step 4: Implementar `acreditar-servidor.ts`**

```ts
import "server-only";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { crearProyectoDeSistema } from "@/lib/proyectos/crear";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { hechosDelPago, pagoAprobado } from "@/lib/galerias/venta-publica";
import type { PagoMp } from "@/lib/galerias/acreditar";
import { CIRCUITO_POR_OMISION, DIAS_HABILES_PROMETIDOS } from "./constantes";
import { agruparPorLaboratorio } from "./carpeta-lab";
import { sumarDiasHabiles } from "./dias-habiles";
import { pedidoDeReferencia } from "./pago-servidor";
import { avisarPedidoConfirmado } from "./avisos-servidor";

const hoyAr = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
const cents = (v: { toString(): string } | string) => Math.round(Number(String(v)) * 100);

export async function acreditarPagoImpresion(workspaceId: string, pago: PagoMp) {
  const id = pedidoDeReferencia(pago.externalReference);
  if (!id) return { ok: false as const, error: "NO_ES_IMPRESION" as const };
  if (!pagoAprobado(pago)) return { ok: false as const, error: "NO_APROBADO" as const };
  if (pago.currency !== "ARS") return { ok: false as const, error: "MONEDA" as const };
  const pedido = await prisma.fotofficePrintOrder.findUnique({ where: { id }, include: { items: true } });
  if (!pedido || pedido.workspaceId !== workspaceId) return { ok: false as const, error: "NO_EXISTE" as const };
  const totalCents = cents(pedido.totalArs);
  if (pago.amountMinor < totalCents) return { ok: false as const, error: "IMPORTE_MENOR" as const };

  const hechos = hechosDelPago(pago);
  const paidAt = hechos.paidAt ?? new Date();
  const promised = sumarDiasHabiles(hoyAr(paidAt), DIAS_HABILES_PROMETIDOS);

  const resultado = await prisma.$transaction(async (tx) => {
    const cambio = await tx.fotofficePrintOrder.updateMany({
      where: { id, status: { in: ["PENDIENTE_PAGO", "CANCELADO"] }, providerPaymentRef: null },
      data: {
        status: "PAGADO", paidAt, providerPaymentRef: hechos.providerPaymentId, promisedAt: new Date(`${promised}T12:00:00Z`),
        feeArs: hechos.feeMinor === null ? null : (hechos.feeMinor / 100).toFixed(2),
        netArs: hechos.feeMinor === null ? null : ((hechos.amountMinor - hechos.feeMinor) / 100).toFixed(2),
      },
    });
    if (cambio.count === 0) return { yaEstaba: true };

    const ajustes = await tx.fotofficePrintSettings.findUnique({ where: { workspaceId } });
    const circuito = ajustes?.circuitId
      ? { id: ajustes.circuitId }
      : await tx.fotofficeCircuit.findFirst({ where: { workspaceId, name: CIRCUITO_POR_OMISION, kind: "TRABAJO", isActive: true }, select: { id: true } })
        ?? await tx.fotofficeCircuit.findFirst({ where: { workspaceId, kind: "TRABAJO", isActive: true, isDefault: true }, select: { id: true } });
    if (!circuito) throw new Error("No hay circuito de trabajo para el pedido de impresión.");
    if (!pedido.clientId) throw new Error("El pedido no tiene cliente.");

    for (const [proveedorId, items] of agruparPorLaboratorio(pedido.items)) {
      const costo = items.reduce((s, i) => s + cents(i.unitCostArs) * i.quantity, 0);
      const proyecto = await crearProyectoDeSistema(tx, workspaceId, {
        clientId: pedido.clientId, circuitId: circuito.id, nombre: `Copias impresas · pedido ${pedido.number}`,
        baseDate: hoyAr(paidAt), proveedorId, ahora: new Date(),
      });
      await tx.fotofficeProyecto.update({ where: { id: proyecto.id }, data: { entregaPrometida: new Date(`${promised}T12:00:00Z`), proveedorCostoArs: (costo / 100).toFixed(2) } });
      await tx.fotofficePrintOrderItem.updateMany({ where: { orderId: id, id: { in: items.map((i) => i.id) } }, data: { proyectoId: proyecto.id } });
    }

    if (await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY)) {
      const destino = await resolveDepositTarget(tx, workspaceId, "MERCADO_PAGO");
      if (destino?.accountId) {
        const mov = await recordCashMovement(tx, {
          workspaceId, accountId: destino.accountId, kind: "INGRESO", amountMinor: totalCents, occurredAt: paidAt,
          description: `Copias impresas · pedido ${pedido.number} · ${pedido.nombre}`, sourceModule: "impresiones", sourceRef: id,
          clientId: pedido.clientId, paymentMethod: "MERCADO_PAGO", createdByUserId: null,
        });
        await tx.fotofficePrintOrder.update({ where: { id }, data: { cashMovementId: mov.id } });
      }
    }
    return { yaEstaba: false };
  });

  if (!resultado.yaEstaba) after(() => avisarPedidoConfirmado(workspaceId, id));
  return { ok: true as const, yaEstaba: resultado.yaEstaba };
}
```

(Verificar la firma real de `resolveDepositTarget` en `lib/cash/auto-deposit.ts` y cómo la llama `lib/galerias/compras.ts`; copiar esa llamada exacta.)

- [ ] **Step 5: `avisos-servidor.ts`** (correo de confirmación al cliente)

```ts
import "server-only";
import { prisma } from "@repo/db";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";

export async function avisarPedidoConfirmado(workspaceId: string, pedidoId: string): Promise<void> {
  const p = await prisma.fotofficePrintOrder.findUnique({ where: { id: pedidoId }, include: { items: true } });
  if (!p) return;
  const ws = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { publicSlug: true, commercialName: true } });
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  const enlace = `${base}/w/${ws?.publicSlug}/impresion/${p.trackingToken}`;
  const copias = p.items.reduce((s, i) => s + i.quantity, 0);
  const fecha = p.promisedAt ? p.promisedAt.toISOString().slice(0, 10).split("-").reverse().join("/") : "";
  await sendTransactionalEmail({
    to: p.email, sender: await loadWorkspaceSender(workspaceId),
    subject: `Recibimos tu pedido de copias (${p.number})`,
    text: `¡Hola, ${p.nombre}!\n\nRecibimos tu pedido de ${copias} copias. Van a estar listas para retirar el ${fecha} (48 horas hábiles).\n\nSeguí tu pedido acá: ${enlace}\n\n${ws?.commercialName ?? ""}`,
    html: `<p>¡Hola, ${p.nombre}!</p><p>Recibimos tu pedido de <strong>${copias} copias</strong>. Van a estar listas para retirar el <strong>${fecha}</strong> (48 horas hábiles).</p><p><a href="${enlace}">Seguí tu pedido acá</a>.</p><p>${ws?.commercialName ?? ""}</p>`,
  });
}
```

(Escapar `p.nombre` en el HTML con el mismo `esc` de `correo-lab.ts` — exportarlo desde ahí.)

- [ ] **Step 6: Webhook** (`app/api/payments/mp/impresiones-webhook/route.ts`) — copiar `galerias-webhook/route.ts` reemplazando: `compraDeReferencia` → `pedidoDeReferencia`; la búsqueda por `providerPaymentRef` en `fotofficePrintOrder`; `acreditarPagoGaleria` → `acreditarPagoImpresion`; sin rama de devolución (sólo `console.warn` si el pago viene `refunded` para un pedido ya pagado). Siempre responde 200; `GET` llama a `POST`.

- [ ] **Step 7: Correr → PASS.**

- [ ] **Step 8: Commit**

```bash
git add apps/fotoffice/lib/impresiones apps/fotoffice/lib/proyectos/crear.ts apps/fotoffice/app/api/payments/mp/impresiones-webhook
git commit -m "Acreditar el pago del pedido de impresión: trabajos y Caja"
```

---

### Task 8: Seguimiento del pedido

**Files:**
- Create: `apps/fotoffice/app/w/[workspaceSlug]/impresion/[seguimiento]/page.tsx`
- Create: `apps/fotoffice/lib/impresiones/seguimiento.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: `FASES`, `faseDeEtapa` (`lib/proyectos/en-curso-puro.ts`); `verificarVueltaImpresion` (Task 6).
- Produces: `pasoDelPedido(estado: string, fases: Fase[]): "RECIBIDO" | "EN_LABORATORIO" | "LISTO" | "ENTREGADO"` (con varios trabajos, gana el más atrasado).

- [ ] **Step 1: Pruebas**

```ts
import { describe, expect, it } from "vitest";
import { pasoDelPedido } from "./seguimiento";

describe("pasoDelPedido", () => {
  it("pagado sin enviar sigue en Recibido", () => {
    expect(pasoDelPedido("PAGADO", [])).toBe("RECIBIDO");
    expect(pasoDelPedido("PAGADO_SIN_ENVIAR", ["RECIBIDO"])).toBe("RECIBIDO");
  });
  it("enviado es En el laboratorio", () => {
    expect(pasoDelPedido("ENVIADO", ["EN_PROVEEDOR"])).toBe("EN_LABORATORIO");
  });
  it("con dos trabajos manda el más atrasado", () => {
    expect(pasoDelPedido("ENVIADO", ["LISTO", "EN_PROVEEDOR"])).toBe("EN_LABORATORIO");
    expect(pasoDelPedido("ENVIADO", ["LISTO", "LISTO"])).toBe("LISTO");
    expect(pasoDelPedido("ENVIADO", ["ENTREGADO", "ENTREGADO"])).toBe("ENTREGADO");
  });
});
```

- [ ] **Step 2: Correr → FAIL.**

- [ ] **Step 3: Implementar**

```ts
import type { Fase } from "@/lib/proyectos/en-curso-puro";
export type Paso = "RECIBIDO" | "EN_LABORATORIO" | "LISTO" | "ENTREGADO";
const ORDEN: Paso[] = ["RECIBIDO", "EN_LABORATORIO", "LISTO", "ENTREGADO"];
const deFase = (f: Fase): Paso => (f === "ENTREGADO" ? "ENTREGADO" : f === "LISTO" ? "LISTO" : f === "EN_PROVEEDOR" ? "EN_LABORATORIO" : "RECIBIDO");

export function pasoDelPedido(estado: string, fases: Fase[]): Paso {
  if (estado !== "ENVIADO" || fases.length === 0) return "RECIBIDO";
  return fases.map(deFase).reduce((min, p) => (ORDEN.indexOf(p) < ORDEN.indexOf(min) ? p : min), "ENTREGADO" as Paso);
}
```

- [ ] **Step 4: Página** — busca `fotofficePrintOrder` por `trackingToken` (y `workspaceId` del slug). Si llega `?pago=ok&pedido=…` y el pedido sigue `PENDIENTE_PAGO`, llama `verificarVueltaImpresion` con `payment_id`/`collection_id` de la URL. Muestra: «¡Pedido confirmado!» o «Estamos esperando la confirmación del pago», número, copias por tamaño, fecha prometida, los 4 pasos con el actual resaltado (fases leídas de los trabajos con `faseDeEtapa` sobre la etapa actual de cada recorrido; copiar cómo lo calcula `lib/proyectos/en-curso*.ts`). `robots noindex`.

- [ ] **Step 5: Correr pruebas → PASS; verificar la página con un pedido de prueba creado a mano en la base local.**

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/impresiones/seguimiento* apps/fotoffice/app/w/[workspaceSlug]/impresion
git commit -m "Página de seguimiento del pedido de impresión"
```

---

### Task 9: Preparar y mandar al laboratorio (cron) + reintentar

**Files:**
- Create: `apps/fotoffice/lib/impresiones/preparar-servidor.ts` (+ `.test.ts`)
- Create: `apps/fotoffice/app/api/cron/impresiones/route.ts`
- Modify: `apps/fotoffice/vercel.json` (cron `{ "path": "/api/cron/impresiones", "schedule": "*/5 * * * *" }`)
- Modify: detalle del trabajo en `app/(shell)/proyectos/**` (buscar con `grep -rn "proveedorEnviadoAt" app/(shell)`): si el trabajo tiene `printItems` y el pedido está `PAGADO_SIN_ENVIAR`, mostrar el error y el botón «Reintentar envío» → server action `reintentarEnvioAction(pedidoId)` que exige `contextoDeProyectos("operar")` y pone `status: "PAGADO", lastError: null, lockedAt: null`.

**Interfaces:**
- Consumes: `rutasDelZip`, `resumenParaLab`, `agruparPorLaboratorio` (Task 4); `correoPedidoLab` (Task 4); `recorteEnPixeles` (Task 2); `leerOriginal` (Task 5); `subirFlujo` (Task 5); `zipEnFlujo` (`lib/galerias/zip.ts`); `emitirEnlace` (`lib/carpetas/carpeta.ts`); `claveDeArchivo`, `DIAS_CARPETA` (`lib/carpetas/reglas.ts`); `moverAFase` (`lib/proyectos/avance.ts`) con `contextoDeSistema`; `sendTransactionalEmail`, `loadWorkspaceSender`.
- Produces: `procesarPedidosDeImpresion(deps?: DepsPreparar): Promise<{ procesados: number; enviados: number; fallidos: number }>`; `prepararPedido(pedidoId: string, deps?: DepsPreparar): Promise<"ENVIADO" | "PAGADO_SIN_ENVIAR">`. `DepsPreparar = { recortar?: (original: Buffer, item) => Promise<Buffer>; subir?: typeof subirFlujo; enviar?: typeof sendTransactionalEmail; ahora?: () => Date }`.

- [ ] **Step 1: Pruebas** (`preparar-servidor.test.ts`): Prisma simulado con un pedido `PAGADO` de 2 ítems Fotolag + 1 La Isla, `recortar` falso que devuelve `Buffer.from("jpg")`, `subir` falso que consume el flujo y devuelve los bytes, `enviar` falso.

```ts
// Casos:
// 1. Toma el pedido con un updateMany condicional (status PAGADO → PREPARANDO, lockedAt) y si count 0 no hace nada.
// 2. Sube un ZIP por laboratorio a una clave `trabajos/<ws>/<proyectoId>/<archivoId>/Pedido-8.zip`,
//    crea la fila FotofficeArchivoTrabajo (estado LISTO, tipo application/zip, bytes) y llama emitirEnlace(ws, proyectoId, "LABORATORIO").
// 3. Manda un correo por laboratorio al email del proveedor con subject "Pedido 8 – PARA MAÑANA – Juan".
// 4. En testMode el correo va al email de contacto del workspace y el asunto empieza con "[PRUEBA] ".
// 5. Marca proveedorEnviadoAt en cada trabajo, mueve a EN_PROVEEDOR y deja el pedido ENVIADO con sentAt.
// 6. Si el proveedor no tiene email → PAGADO_SIN_ENVIAR con lastError "Fotolag no tiene correo cargado", attempts+1, y avisa al estudio.
// 7. Si enviar devuelve status PROVIDER_REJECTED → PAGADO_SIN_ENVIAR.
// 8. Si recortar tira error para un ítem → PAGADO_SIN_ENVIAR con el nombre del archivo en lastError; el cron sigue con el próximo pedido.
// 9. Un pedido PREPARANDO con lockedAt de hace más de 15 minutos se vuelve a tomar.
```

Escribir cada caso como `it(...)` con sus `expect` concretos sobre los mocks (p. ej. caso 3: `expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "pedidos@fotolag.test", subject: "Pedido 8 – PARA MAÑANA – Juan" }))`).

- [ ] **Step 2: Correr → FAIL.** Run: `pnpm exec vitest run --config vitest.config.ts lib/impresiones/preparar-servidor.test.ts`

- [ ] **Step 3: Implementar `preparar-servidor.ts`**

```ts
import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { zipEnFlujo } from "@/lib/galerias/zip";
import { claveDeArchivo } from "@/lib/carpetas/reglas";
import { emitirEnlace } from "@/lib/carpetas/carpeta";
import { moverAFase } from "@/lib/proyectos/avance";
import { contextoDeSistema } from "@/lib/circuitos/acceso";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { subirFlujo } from "@/lib/carpetas/subir-servidor";
import { leerOriginal } from "./fuentes-servidor";
import { agruparPorLaboratorio, resumenParaLab, rutasDelZip } from "./carpeta-lab";
import { correoPedidoLab } from "./correo-lab";
import { recorteEnPixeles } from "./recorte";
import type { Papel } from "./constantes";

sharp.cache(false);
sharp.concurrency(1);
const BLOQUEO_VENCIDO_MS = 15 * 60 * 1000;
const MAX_PIXELES = 200_000_000;

type Item = { id: string; sourceKey: string; sourceName: string; widthCm: unknown; heightCm: unknown; quantity: number; cropX: number; cropY: number; cropW: number; cropH: number; proveedorId: string | null; proyectoId: string | null };

export async function recortarParaImprimir(original: Buffer, item: Pick<Item, "cropX" | "cropY" | "cropW" | "cropH">): Promise<Buffer> {
  const base = sharp(original, { limitInputPixels: MAX_PIXELES }).rotate();
  const { width = 0, height = 0, orientation = 1 } = await sharp(original, { limitInputPixels: MAX_PIXELES }).metadata();
  const [w, h] = orientation >= 5 ? [height, width] : [width, height];
  const px = recorteEnPixeles(w, h, { x: item.cropX, y: item.cropY, w: item.cropW, h: item.cropH });
  return base.extract(px).toColorspace("srgb").jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
}

export type DepsPreparar = {
  recortar?: (original: Buffer, item: Item) => Promise<Buffer>;
  leer?: (key: string) => Promise<Buffer>;
  subir?: typeof subirFlujo;
  enviar?: typeof sendTransactionalEmail;
  ahora?: () => Date;
};

async function tomar(pedidoId: string, ahora: Date): Promise<boolean> {
  const r = await prisma.fotofficePrintOrder.updateMany({
    where: { id: pedidoId, OR: [{ status: "PAGADO" }, { status: "PREPARANDO", lockedAt: { lt: new Date(ahora.getTime() - BLOQUEO_VENCIDO_MS) } }] },
    data: { status: "PREPARANDO", lockedAt: ahora },
  });
  return r.count === 1;
}

export async function prepararPedido(pedidoId: string, deps: DepsPreparar = {}): Promise<"ENVIADO" | "PAGADO_SIN_ENVIAR" | "OCUPADO"> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  if (!(await tomar(pedidoId, ahora))) return "OCUPADO";
  const recortar = deps.recortar ?? recortarParaImprimir;
  const leer = deps.leer ?? leerOriginal;
  const subir = deps.subir ?? subirFlujo;
  const enviar = deps.enviar ?? sendTransactionalEmail;

  const p = await prisma.fotofficePrintOrder.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } });
  const ws = p.workspaceId;
  const [ajustes, branding, proveedores] = await Promise.all([
    prisma.fotofficePrintSettings.findUnique({ where: { workspaceId: ws } }),
    prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId: ws }, select: { commercialName: true, contactEmail: true } }),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId: ws, id: { in: p.items.map((i) => i.proveedorId).filter((x): x is string => !!x) } } }),
  ]);
  const prueba = ajustes?.testMode ?? true;
  const porProveedor = new Map(proveedores.map((x) => [x.id, x]));

  try {
    for (const [proveedorId, items] of agruparPorLaboratorio(p.items as Item[])) {
      const prov = proveedorId ? porProveedor.get(proveedorId) : undefined;
      if (!prov) throw new Error("Hay copias sin laboratorio asignado.");
      const destino = prueba ? branding?.contactEmail : prov.email;
      if (!destino) throw new Error(prueba ? "El estudio no tiene correo de contacto para el modo prueba." : `${prov.name} no tiene correo cargado.`);
      const proyectoId = items[0].proyectoId;
      if (!proyectoId) throw new Error("El pedido no tiene trabajo creado.");

      const paraLab = items.map((i) => ({ itemId: i.id, proveedorId, widthCm: Number(i.widthCm), heightCm: Number(i.heightCm), quantity: i.quantity, sourceName: i.sourceName }));
      const rutas = new Map(rutasDelZip(p.number, p.nombre, p.paper as Papel, paraLab).map((r) => [r.itemId, r.ruta]));
      const archivos = items.map((i) => ({
        nombre: rutas.get(i.id)!,
        fecha: ahora,
        abrir: async () => {
          try {
            const jpg = await recortar(await leer(i.sourceKey), i);
            return (async function* () { yield new Uint8Array(jpg); })();
          } catch (e) {
            throw new Error(`No se pudo preparar ${i.sourceName}: ${(e as Error).message}`);
          }
        },
      }));

      const archivoId = randomUUID();
      const nombreZip = `Pedido-${p.number}.zip`;
      const clave = claveDeArchivo(ws, proyectoId, archivoId, nombreZip);
      const bytes = await subir(clave, zipEnFlujo(archivos), "application/zip");
      await prisma.fotofficeArchivoTrabajo.create({ data: { id: archivoId, workspaceId: ws, proyectoId, key: clave, nombre: nombreZip, tipo: "application/zip", bytes: BigInt(bytes), estado: "LISTO" } });
      const enlace = await emitirEnlace(ws, proyectoId, "LABORATORIO", ahora);
      if (!enlace.ok) throw new Error(enlace.error);

      const correo = correoPedidoLab({ estudio: branding?.commercialName ?? "El estudio", laboratorio: prov.name, numero: p.number, cliente: p.nombre, enlace: enlace.url, vence: enlace.vence.slice(0, 10), resumen: resumenParaLab(paraLab, p.paper as Papel), prueba });
      const r = await enviar({ to: destino, ...correo, sender: await loadWorkspaceSender(ws) });
      if (r.status !== "SENT") throw new Error(`El correo a ${prov.name} no salió (${r.status}).`);

      await prisma.fotofficeProyecto.update({ where: { id: proyectoId }, data: { proveedorEnviadoAt: ahora } });
      await moverAFase(contextoDeSistema(ws), proyectoId, "EN_PROVEEDOR", `Pedido de impresión ${p.number} enviado a ${prov.name}${prueba ? " (modo prueba)" : ""}.`).catch(() => {});
    }
    await prisma.fotofficePrintOrder.update({ where: { id: pedidoId }, data: { status: "ENVIADO", sentAt: ahora, lockedAt: null, lastError: null } });
    return "ENVIADO";
  } catch (e) {
    const lastError = (e as Error).message.slice(0, 500);
    await prisma.fotofficePrintOrder.update({ where: { id: pedidoId }, data: { status: "PAGADO_SIN_ENVIAR", lockedAt: null, lastError, attempts: { increment: 1 } } });
    await avisarFallaAlEstudio(ws, p.number, lastError, enviar).catch(() => {});
    return "PAGADO_SIN_ENVIAR";
  }
}

async function avisarFallaAlEstudio(workspaceId: string, numero: number, error: string, enviar: typeof sendTransactionalEmail) {
  const b = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { contactEmail: true } });
  if (!b?.contactEmail) return;
  await enviar({
    to: b.contactEmail, sender: await loadWorkspaceSender(workspaceId),
    subject: `El pedido de impresión ${numero} no se pudo mandar al laboratorio`,
    text: `El pedido ${numero} está pagado pero no salió al laboratorio.\n\nMotivo: ${error}\n\nAbrí el trabajo en FOTOFFICE y tocá «Reintentar envío».`,
    html: `<p>El pedido <strong>${numero}</strong> está pagado pero no salió al laboratorio.</p><p>Motivo: ${error.replace(/</g, "&lt;")}</p><p>Abrí el trabajo en FOTOFFICE y tocá «Reintentar envío».</p>`,
  });
}

export async function procesarPedidosDeImpresion(deps: DepsPreparar = {}) {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const pendientes = await prisma.fotofficePrintOrder.findMany({
    where: { OR: [{ status: "PAGADO" }, { status: "PREPARANDO", lockedAt: { lt: new Date(ahora.getTime() - BLOQUEO_VENCIDO_MS) } }] },
    orderBy: { paidAt: "asc" }, take: 3, select: { id: true },
  });
  let enviados = 0, fallidos = 0;
  for (const { id } of pendientes) {
    const r = await prepararPedido(id, deps);
    if (r === "ENVIADO") enviados++;
    if (r === "PAGADO_SIN_ENVIAR") fallidos++;
  }
  return { procesados: pendientes.length, enviados, fallidos };
}
```

Notas para el implementador:
- Verificar el nombre real del campo de correo de contacto en `FotofficeWorkspaceBranding` (`contactEmail` según la memoria del correo a socios); ajustar si difiere.
- Si `moverAFase` no acepta el contexto de `contextoDeSistema`, envolverlo como hace `archivosSubidosAction`.
- `zipEnFlujo` tolera `abrir` que devuelve `null` (omite); acá se tira error a propósito para que el pedido no salga incompleto.

- [ ] **Step 4: Cron** (`app/api/cron/impresiones/route.ts`) — copiar `app/api/cron/galerias-zip/route.ts`: `maxDuration = 300`, `isAuthorizedCronRequest`, chequeo de R2 configurado (`adjuntosR2Configurado()` o el equivalente que use `lib/carpetas`), `procesarPedidosDeImpresion()`.

- [ ] **Step 5: Correr → PASS.**

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/impresiones/preparar-servidor* apps/fotoffice/app/api/cron/impresiones apps/fotoffice/vercel.json apps/fotoffice/app/(shell)
git commit -m "Preparar la carpeta ordenada y mandar el pedido al laboratorio"
```

---

### Task 10: Verificación completa, base de datos y salida

**Files:** ninguno nuevo.

- [ ] **Step 1: Todas las pruebas y tipos**

Run (desde `apps/fotoffice`): `pnpm exec vitest run --config vitest.config.ts lib/impresiones lib/proyectos lib/carpetas lib/galerias` y `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`
Expected: todo en verde, `tsc` sin salida y código 0.

- [ ] **Step 2: Prueba en el navegador** con `next dev --webpack` contra la base real (el `.env.local` de FOTOFFICE apunta a producción: sólo lecturas + un pedido de prueba): configuración → precios cargados → carpeta de un trabajo de DNX → pedir copias → llegar hasta la pantalla de Mercado Pago (no pagar en local).

- [ ] **Step 3: Aplicar el SQL en la base de FOTOFFICE** (Neon `divine-hall-10689679`, rama `br-old-rain-adwthzng`) con `run_sql_transaction` (sentencias de `migration.sql`), verificar con `SELECT to_regclass('"FotofficePrintOrder"')`, y registrar la migración en `_prisma_migrations` con el SHA-256 del archivo (`shasum -a 256 migration.sql`), como indica la memoria «Registrar migraciones».

- [ ] **Step 4: PR, chequeos y fusión.** Descripción con: qué hace, que el SQL ya está aplicado, que el módulo nace apagado y en modo prueba.

- [ ] **Step 5: Encender sólo en DNX Estudio** (`WorkspaceFeatureModule` `print-orders` en `true` para ese workspace) con **modo prueba**, cargar precios reales (los pasa Daniel) y hacer un pedido chico real pagado con tarjeta propia: verificar pedido `PAGADO` → trabajo(s) creados → ZIP ordenado → correo «[PRUEBA] Pedido N – PARA MAÑANA – …» en el correo del estudio → seguimiento. Recién ahí Daniel apaga el modo prueba.
