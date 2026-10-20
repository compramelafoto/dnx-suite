# Impresiones — Etapa 1: motor de calidad, salidas Kodak/Epson y Foto carnet en el Mostrador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una foto carnet se prepare (encuadre + ajustes), se imprima en la Kodak 305 o la Epson L800 desde el navegador sin perder calidad y se cobre desde el Mostrador en cualquier orden, con el original guardado en la ficha del cliente y cada hoja impresa registrada.

**Architecture:** el navegador sólo guarda una **receta** (encuadre en proporciones, giro y ajustes) y muestra una vista previa; el archivo que se imprime lo genera el servidor con `sharp` desde el original en R2 (perfil de color → sRGB, Lanczos, ajustes en 16 bits, JPG 95 4:4:4 a 300 ppp). Una **preparación** guardada en la base (no en el carrito, que vive en memoria) junta originales, piezas y la hoja; al cobrar se ata al renglón de venta. Cada hoja que sale queda en `FotofficeRegistroImpresion`.

**Tech Stack:** Next.js (App Router, versión del repo — leer `node_modules/next/dist/docs/` antes de tocar rutas, ver `AGENTS.md`), Prisma + Postgres (Neon), `sharp` ^0.34.5 (ya instalado), `react-easy-crop` (ya instalado), `zod` (ya instalado), Vitest, R2 privado (`lib/ficha/adjuntos-r2.ts`).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-impresiones-recorte-revelado-design.md` (§3.1, §4, §5, §7, §8, §9, §10, §10.1, §12.1, §14). Leerlo entero antes de empezar.

## Global Constraints

- **Sin dependencias nuevas.** El lockfile es de todo el monorepo; `sharp`, `zod` y `react-easy-crop` ya están en `apps/fotoffice/package.json`.
- **El archivo que se imprime nunca sale del `canvas` del navegador.** Siempre de `lib/impresion/render.ts` en el servidor.
- **Medidas reales (mm):** 10x15 = 102×152 · 13x18 = 127×180 · 15x20 = 152×203 (Kodak) · 15x21 = 152×210 (laboratorio) · 20x30 = 203×300 · 25x38 = 254×380 · A4 = 210×297.
- **Kodak 305:** LOCAL, 300 ppp, nitidez SUAVE, hojas 10x15/13x18/15x20, admite copias. **Epson L800:** LOCAL, 300 ppp, nitidez FUERTE, hojas 10x15/A4, **no** admite copias fotográficas.
- **JPG final:** calidad 95, `chromaSubsampling: "4:4:4"`, perfil sRGB embebido, densidad = ppp de la salida.
- **Límite de original:** 60 megapíxeles y 60 MB; formatos JPG, PNG, WebP (HEIC: se intenta; si `sharp` no lo lee, mensaje "Convertí la foto a JPG").
- **Vencimientos:** preparaciones (originales, vistas y finales) a los **30 días** de creadas; subidas sin confirmar a las 24 h; archivos de la carpeta de un trabajo a los **30 días** de subido el primero (compartir lo extiende); **la copia del original de carnet en la ficha del cliente no vence**; el registro de impresión no se borra.
- **Permisos:** preparar, imprimir y registrar = `requireSalesStaff()` (nivel MANAGE de Ventas). Configurar tamaños, salidas, escala y producción del producto = `requireSalesAdmin()` (acción `sales.catalog`).
- **Textos de pantalla en español rioplatense**, como el resto de FOTOFFICE ("Elegí", "Probá de nuevo").
- **Migraciones a mano:** el deploy nunca corre `migrate deploy`. Cada migración se aplica con SQL contra la rama `development` del proyecto Neon `compramelafoto` (producción de FOTOFFICE) y se registra con `npx prisma migrate resolve --applied <nombre>` desde `packages/db`, **antes** de fusionar el código. SQL idempotente (`IF NOT EXISTS`).
- **Pruebas:** `pnpm --filter fotoffice test` (Vitest, entorno node). Typecheck: `pnpm --filter fotoffice typecheck` (si se queda sin memoria devuelve éxito igual: mirar que la salida termine sin "heap out of memory").

## Review Focus

1. **Foto de celular girada por EXIF (orientación 6/8):** el encuadre que se ve tiene que ser el que sale; la vista previa y el final se arman desde la foto ya derecha. → prueba en Task 6 ("respeta la orientación EXIF").
2. **Foto Display P3 de iPhone/Samsung:** el rojo saturado no se apaga en el final. → prueba en Task 6 ("convierte P3 a sRGB sin apagar el color").
3. **Doble cobro de la misma preparación** (dos pestañas del Mostrador, o reintento tras error de red): la segunda venta no puede quedarse con la preparación. → prueba en Task 10 ("no vincula una preparación ya cobrada") y Task 14.
4. **Encuadre con enderezado (±10°) al borde de la foto:** `sharp.extract` no puede fallar por un píxel. → prueba en Task 6 ("enderezar al borde no revienta").
5. **Recargar el Mostrador antes de cobrar:** la preparación aparece en "Preparado sin cobrar" y se puede retomar. → prueba en Task 10 ("colas") y verificación manual en Task 17.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/carpetas/reglas.ts`, `lib/carpetas/carpeta.ts` | (Task 1) vencimiento de carpetas al subir |
| `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/2026112612000{0,1}_…/migration.sql` | (Tasks 1–2) tablas nuevas |
| `lib/impresion/medidas.ts` | mm↔px, tamaños y salidas iniciales, escala por regla (puro) |
| `lib/impresion/ajustes.ts` | fórmulas de revelado compartidas navegador/servidor (puro) |
| `lib/impresion/receta.ts` | tipo y validación de la receta (puro) |
| `lib/impresion/geometria.ts` | caja rotada, encuadre↔píxeles, resolución efectiva (puro) |
| `lib/impresion/plancha.ts` | disposición de carnet en la hoja y líneas de corte (puro) |
| `lib/impresion/huella.ts` | SHA-256 de JSON canónico (servidor) |
| `lib/impresion/render.ts` | `sharp`: leer original, vista previa, pieza, hoja (servidor) |
| `lib/impresion/almacen.ts` | claves y objetos R2 de impresión (servidor) |
| `lib/impresion/configuracion.ts` | tamaños, salidas, producción del producto (servidor) |
| `lib/impresion/preparaciones.ts` | preparación: originales, pieza, hoja, registro, colas, vínculo con venta, purga (servidor) |
| `lib/impresion/ficha-carnet.ts` | original de carnet ↔ ficha del cliente (servidor) |
| `app/(shell)/ventas/impresion/actions.ts` | acciones de servidor de todo lo anterior |
| `app/(shell)/ventas/impresion/configuracion/page.tsx` | Configuración → Impresión |
| `app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx` | "Se produce en el local" en la ficha del producto |
| `app/api/impresion/vista/[originalId]/route.ts`, `app/api/impresion/hoja/[hojaId]/route.ts` | sirven vista previa y JPG final (mismo origen, sin CORS) |
| `app/imprimir/hoja/[hojaId]/page.tsx` + `hoja-para-imprimir.tsx` | página de impresión al tamaño exacto |
| `app/imprimir/prueba/[salidaId]/page.tsx` | hoja de prueba con regla |
| `components/foto-carnet/*` | editor migrado al motor nuevo |
| `app/(shell)/ventas/pos.tsx`, `app/(shell)/ventas/dialogo-preparar.tsx` | "Preparar" en el carrito |
| `lib/sales/checkout.ts`, `lib/sales/record-sale.ts`, `app/(shell)/ventas/actions.ts` | cobrar ata la preparación |
| `app/(shell)/ventas/impresiones/page.tsx` | colas "Para imprimir / Preparado sin cobrar / Impreso hoy" |
| `app/api/cron/adjuntos/route.ts` | purga a 30 días |

Todas las rutas de archivo de este plan son relativas a `apps/fotoffice/` salvo las de `packages/db/`.

---

### Task 1: Los archivos de la carpeta de un trabajo vencen a los 30 días aunque no se compartan

Independiente del resto: puede salir sola en su propio PR.

**Files:**
- Modify: `lib/carpetas/reglas.ts` (agregar `vencimientoAlSubir`)
- Modify: `lib/carpetas/carpeta.ts:89-98` (`confirmarSubida`)
- Test: `lib/carpetas/reglas.test.ts`
- Create: `packages/db/prisma/migrations/20261126120000_fotoffice_carpetas_vencen/migration.sql`

**Interfaces:**
- Produces: `vencimientoAlSubir(actual: Date | null, ahora: Date): Date`

- [ ] **Step 1: Prueba que falla**

Agregar al final de `lib/carpetas/reglas.test.ts` (sumar `vencimientoAlSubir` al import existente):

```ts
describe("vencimientoAlSubir", () => {
  const ahora = new Date("2026-10-20T15:00:00.000Z");
  it("sin vencimiento, vence a los 30 días de subido", () => {
    expect(vencimientoAlSubir(null, ahora).toISOString()).toBe("2026-11-19T15:00:00.000Z");
  });
  it("con vencimiento ya puesto (aunque sea más corto), no lo toca", () => {
    const antes = new Date("2026-10-25T00:00:00.000Z");
    expect(vencimientoAlSubir(antes, ahora)).toBe(antes);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/carpetas/reglas.test.ts`
Expected: FAIL, `vencimientoAlSubir is not a function` (o error de import).

- [ ] **Step 3: Implementar**

En `lib/carpetas/reglas.ts`, debajo de `nuevoVencimiento`:

```ts
/**
 * Al confirmar un archivo: si la carpeta todavía no vence (nunca se compartió), vence a los
 * `DIAS_CARPETA` de hoy. Si ya tiene fecha, la deja: compartir la extiende con `nuevoVencimiento`.
 * Sin esto, una carpeta que nunca se compartía quedaba en R2 para siempre.
 */
export function vencimientoAlSubir(actual: Date | null, ahora: Date): Date {
  return actual ?? new Date(ahora.getTime() + DIAS_CARPETA * 86_400_000);
}
```

En `lib/carpetas/carpeta.ts`, importar `vencimientoAlSubir` desde `./reglas` y reemplazar el final de `confirmarSubida` (desde `const a = await prisma.fotofficeArchivoTrabajo.findFirst(` hasta `return { ok: true };`) por:

```ts
  const a = await prisma.fotofficeArchivoTrabajo.findFirst({
    where: { id: archivoId, workspaceId: ctx.workspaceId },
    select: { id: true, key: true, proyectoId: true },
  });
  if (!a) return { ok: false, error: "Ese archivo no existe." };
  const real = await tamanoDeArchivo(a.key);
  if (real === null) return { ok: false, error: "El archivo no llegó a subirse. Probá de nuevo." };
  await prisma.fotofficeArchivoTrabajo.update({ where: { id: a.id }, data: { estado: "LISTO", bytes: BigInt(real) } });
  const p = await prisma.fotofficeProyecto.findFirst({ where: { id: a.proyectoId, workspaceId: ctx.workspaceId }, select: { carpetaVence: true } });
  if (p && !p.carpetaVence) {
    await prisma.fotofficeProyecto.updateMany({
      where: { id: a.proyectoId, workspaceId: ctx.workspaceId, carpetaVence: null },
      data: { carpetaVence: vencimientoAlSubir(null, new Date()) },
    });
  }
  return { ok: true };
```

- [ ] **Step 4: Migración de datos (trabajos que ya tienen archivos y no vencen)**

`packages/db/prisma/migrations/20261126120000_fotoffice_carpetas_vencen/migration.sql`:

```sql
-- FOTOFFICE: las carpetas de trabajos con archivos y sin vencimiento vencen dentro de 30 días
-- (un mes de aviso: nada se borra de golpe). Idempotente: sólo toca las que siguen sin fecha.
UPDATE "FotofficeProyecto" p
SET "carpetaVence" = NOW() + INTERVAL '30 days'
WHERE p."carpetaVence" IS NULL
  AND EXISTS (SELECT 1 FROM "FotofficeArchivoTrabajo" a WHERE a."proyectoId" = p."id");
```

- [ ] **Step 5: Correr pruebas**

Run: `pnpm --filter fotoffice test -- lib/carpetas`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/carpetas packages/db/prisma/migrations/20261126120000_fotoffice_carpetas_vencen
git commit -m "Carpetas de trabajos: vencen a los 30 días aunque nunca se compartan"
```

---

### Task 2: Esquema y migración de impresión

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos nuevos al final de la sección de Ventas; relaciones inversas en `Workspace`, `Product`, `Client`, `SaleItem`, `FotofficeProveedor`, `FotofficeProyecto`, `FotofficeArchivoTrabajo`, `FotofficeAttachment`)
- Create: `packages/db/prisma/migrations/20261126120001_fotoffice_impresion/migration.sql`
- Modify: `lib/circuitos/base-en-memoria.ts` (registrar tablas para pruebas)

**Interfaces:**
- Produces (nombres de cliente Prisma usados en tareas siguientes): `fotofficeTamanoImpresion`, `fotofficeSalidaImpresion`, `fotofficeSalidaTamano`, `fotofficeProductoProduccion`, `fotofficePreparacionImpresion`, `fotofficeOriginalImpresion`, `fotofficePiezaImpresion`, `fotofficeHojaImpresion`, `fotofficeRegistroImpresion`; columna `FotofficeAttachment.origen`.

- [ ] **Step 1: Modelos en `schema.prisma`**

```prisma
// ---------------------------------------------------------------------------
// Impresión (etapa 1): tamaños, salidas (Kodak, Epson, laboratorio), producción de productos,
// preparaciones del mostrador y registro de hojas impresas. Diseño:
// apps/fotoffice/docs/superpowers/specs/2026-10-20-impresiones-recorte-revelado-design.md
// ---------------------------------------------------------------------------

/// Tamaño de papel con su medida real (10x15 = 102 × 152 mm). Editable por espacio de trabajo.
model FotofficeTamanoImpresion {
  id          String   @id @default(cuid())
  workspaceId String
  nombre      String
  anchoMm     Decimal  @db.Decimal(6, 1)
  altoMm      Decimal  @db.Decimal(6, 1)
  orden       Int      @default(0)
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace                     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  salidas     FotofficeSalidaTamano[]
  productos   FotofficeProductoProduccion[]
  hojas       FotofficeHojaImpresion[]
  registros   FotofficeRegistroImpresion[]

  @@unique([workspaceId, nombre])
  @@index([workspaceId, activo, orden])
}

/// Por dónde sale una hoja: impresora del local (LOCAL) o laboratorio (LABORATORIO).
/// `escalaXMil`/`escalaYMil`: corrección medida con la hoja de prueba (1000 = sin corrección).
model FotofficeSalidaImpresion {
  id                String   @id @default(cuid())
  workspaceId       String
  nombre            String
  /// LOCAL | LABORATORIO (CHECK en el SQL)
  tipo              String
  proveedorId       String?
  ppp               Int      @default(300)
  /// SUAVE | NORMAL | FUERTE (CHECK en el SQL)
  nitidez           String   @default("NORMAL")
  escalaXMil        Int      @default(1000)
  escalaYMil        Int      @default(1000)
  /// Se usa desde la etapa 2 (copias a sangre).
  margenSinBordesMm Decimal  @default(0) @db.Decimal(4, 1)
  /// false en la Epson: nunca copias ni ampliaciones fotográficas.
  admiteCopias      Boolean  @default(true)
  activo            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  workspace  Workspace                     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  proveedor  FotofficeProveedor?           @relation(fields: [proveedorId], references: [id], onDelete: SetNull)
  tamanos    FotofficeSalidaTamano[]
  productos  FotofficeProductoProduccion[]
  hojas      FotofficeHojaImpresion[]
  registros  FotofficeRegistroImpresion[]

  @@unique([workspaceId, nombre])
  @@index([workspaceId, activo])
}

/// Qué tamaños admite cada salida.
model FotofficeSalidaTamano {
  salidaId String
  tamanoId String

  salida FotofficeSalidaImpresion @relation(fields: [salidaId], references: [id], onDelete: Cascade)
  tamano FotofficeTamanoImpresion @relation(fields: [tamanoId], references: [id], onDelete: Cascade)

  @@id([salidaId, tamanoId])
  @@index([tamanoId])
}

/// Un producto que se produce en el local: qué pieza es, por dónde sale y qué hoja usa.
model FotofficeProductoProduccion {
  id           String   @id @default(cuid())
  workspaceId  String
  productId    String   @unique
  /// COPIA | CARNET | POLAROID (CHECK en el SQL). En la etapa 1 sólo se prepara CARNET.
  tipoPieza    String
  salidaId     String
  tamanoHojaId String
  /// HOJA | COPIA | PIEZA (CHECK en el SQL): qué cuenta la cantidad del renglón.
  unidad       String   @default("HOJA")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workspace  Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  product    Product                  @relation(fields: [productId], references: [id], onDelete: Cascade)
  salida     FotofficeSalidaImpresion @relation(fields: [salidaId], references: [id], onDelete: Restrict)
  tamanoHoja FotofficeTamanoImpresion @relation(fields: [tamanoHojaId], references: [id], onDelete: Restrict)

  @@index([workspaceId])
  @@index([salidaId])
  @@index([tamanoHojaId])
}

/// Lo que se arma para imprimir. Vive aparte del carrito (que está sólo en la pantalla) y se ata
/// al renglón de venta al cobrar. CHECK en el SQL: a lo sumo uno de saleItemId / proyectoId.
model FotofficePreparacionImpresion {
  id              String   @id @default(cuid())
  workspaceId     String
  productId       String?
  clientId        String?
  saleItemId      String?  @unique
  proyectoId      String?
  /// PREPARANDO | LISTA | IMPRESA | ANULADA (CHECK en el SQL)
  estado          String   @default("PREPARANDO")
  createdByUserId Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace  Workspace                   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  product    Product?                    @relation(fields: [productId], references: [id], onDelete: SetNull)
  client     Client?                     @relation(fields: [clientId], references: [id], onDelete: SetNull)
  saleItem   SaleItem?                   @relation(fields: [saleItemId], references: [id], onDelete: SetNull)
  proyecto   FotofficeProyecto?          @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  originales FotofficeOriginalImpresion[]
  piezas     FotofficePiezaImpresion[]
  hojas      FotofficeHojaImpresion[]

  @@index([workspaceId, estado, createdAt])
  @@index([workspaceId, saleItemId])
  @@index([createdAt])
}

/// El archivo que trajo el cliente, tal cual. Nunca se modifica.
model FotofficeOriginalImpresion {
  id               String   @id @default(cuid())
  workspaceId      String
  preparacionId    String
  key              String   @unique
  previewKey       String?
  nombre           String
  tipo             String
  bytes            Int      @default(0)
  anchoPx          Int      @default(0)
  altoPx           Int      @default(0)
  /// Descripción del perfil de color embebido (p. ej. "Display P3"), o null.
  perfilColor      String?
  /// PENDIENTE (pidió la subida) | LISTO (confirmado y con vista previa)
  estado           String   @default("PENDIENTE")
  /// Si viene de la carpeta de un trabajo: apunta a ese archivo y no se copia ni se borra.
  archivoTrabajoId String?
  /// La copia guardada en la ficha del cliente (sólo carnet).
  adjuntoId        String?
  createdAt        DateTime @default(now())

  workspace   Workspace                     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  preparacion FotofficePreparacionImpresion @relation(fields: [preparacionId], references: [id], onDelete: Cascade)
  archivo     FotofficeArchivoTrabajo?      @relation(fields: [archivoTrabajoId], references: [id], onDelete: SetNull)
  adjunto     FotofficeAttachment?          @relation(fields: [adjuntoId], references: [id], onDelete: SetNull)
  piezas      FotofficePiezaImpresion[]

  @@index([preparacionId, createdAt])
  @@index([workspaceId, estado, createdAt])
}

/// Una foto en una medida, con su receta (JSON chico: encuadre en proporciones, giro, ajustes).
model FotofficePiezaImpresion {
  id            String    @id @default(cuid())
  workspaceId   String
  preparacionId String
  originalId    String
  /// COPIA | CARNET | POLAROID (CHECK en el SQL)
  tipo          String
  tamanoId      String?
  /// Medida de la pieza de carnet (las copias usan `tamanoId`).
  anchoMm       Decimal?  @db.Decimal(6, 1)
  altoMm        Decimal?  @db.Decimal(6, 1)
  receta        Json
  huella        String
  cantidad      Int       @default(1)
  revisadaAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  workspace   Workspace                     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  preparacion FotofficePreparacionImpresion @relation(fields: [preparacionId], references: [id], onDelete: Cascade)
  original    FotofficeOriginalImpresion    @relation(fields: [originalId], references: [id], onDelete: Cascade)

  @@index([preparacionId])
  @@index([originalId])
}

/// Lo que se imprime: una o más piezas acomodadas en el papel de una salida.
model FotofficeHojaImpresion {
  id            String   @id @default(cuid())
  workspaceId   String
  preparacionId String
  salidaId      String
  tamanoId      String
  disposicion   Json
  finalKey      String?
  finalHuella   String?
  finalAnchoPx  Int      @default(0)
  finalAltoPx   Int      @default(0)
  /// Cuántas hojas iguales se imprimen.
  copias        Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace   Workspace                     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  preparacion FotofficePreparacionImpresion @relation(fields: [preparacionId], references: [id], onDelete: Cascade)
  salida      FotofficeSalidaImpresion      @relation(fields: [salidaId], references: [id], onDelete: Restrict)
  tamano      FotofficeTamanoImpresion      @relation(fields: [tamanoId], references: [id], onDelete: Restrict)
  registros   FotofficeRegistroImpresion[]

  @@index([preparacionId])
  @@index([salidaId])
  @@index([tamanoId])
}

/// Cada vez que salen hojas de una impresora. Contable: NO se borra (la purga deja hojaId en null).
model FotofficeRegistroImpresion {
  id          String   @id @default(cuid())
  workspaceId String
  hojaId      String?
  salidaId    String
  tamanoId    String
  hojas       Int
  productId   String?
  saleItemId  String?
  proyectoId  String?
  /// NORMAL | DESCARTADA | PRUEBA (CHECK en el SQL)
  motivo      String
  userId      Int?
  createdAt   DateTime @default(now())

  workspace Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  hoja      FotofficeHojaImpresion?  @relation(fields: [hojaId], references: [id], onDelete: SetNull)
  salida    FotofficeSalidaImpresion @relation(fields: [salidaId], references: [id], onDelete: Restrict)
  tamano    FotofficeTamanoImpresion @relation(fields: [tamanoId], references: [id], onDelete: Restrict)

  @@index([workspaceId, createdAt])
  @@index([workspaceId, salidaId, createdAt])
  @@index([hojaId])
  @@index([saleItemId])
}
```

Agregar en `model FotofficeAttachment`, debajo de `purgeAfter`:

```prisma
  /// "FOTO_CARNET" en la copia del original de una foto carnet; null en lo subido a mano.
  origen           String?
```

y la relación inversa `fotofficeOriginalesImpresion FotofficeOriginalImpresion[]`. Agregar las relaciones inversas que pida `prisma validate` en `Workspace`, `Product` (`fotofficeProduccion FotofficeProductoProduccion?`, `fotofficePreparaciones FotofficePreparacionImpresion[]`), `Client`, `SaleItem` (`fotofficePreparacion FotofficePreparacionImpresion?`), `FotofficeProveedor`, `FotofficeProyecto`, `FotofficeArchivoTrabajo`. Agregar también `@@index([workspaceId, clientId, origen])` en `FotofficeAttachment`.

- [ ] **Step 2: Validar y generar**

Run: `cd packages/db && npx prisma validate && npx prisma generate`
Expected: "The schema … is valid" y cliente generado.

- [ ] **Step 3: SQL de la migración**

Generar el SQL base con:

```bash
cd packages/db && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > /tmp/impresion.sql
```

Si `--from-migrations` falla porque las migraciones no se reproducen desde cero (pasa en este repo), usar `--from-schema-datamodel` con el `schema.prisma` de `origin/main` guardado en un archivo temporal (`git show origin/main:packages/db/prisma/schema.prisma > /tmp/schema-main.prisma`). Copiar a `packages/db/prisma/migrations/20261126120001_fotoffice_impresion/migration.sql` **sólo** las sentencias de las tablas/columnas/índices/FK de impresión, volverlas idempotentes (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, FKs dentro de `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`) y agregar al final:

```sql
DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_tipo_check" CHECK ("tipo" IN ('LOCAL','LABORATORIO'));
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_nitidez_check" CHECK ("nitidez" IN ('SUAVE','NORMAL','FUERTE'));
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_ppp_check" CHECK ("ppp" BETWEEN 72 AND 1200);
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_escala_check" CHECK ("escalaXMil" BETWEEN 900 AND 1100 AND "escalaYMil" BETWEEN 900 AND 1100);
  ALTER TABLE "FotofficeTamanoImpresion" ADD CONSTRAINT "FotofficeTamanoImpresion_medida_check" CHECK ("anchoMm" > 0 AND "altoMm" > 0);
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_tipo_check" CHECK ("tipoPieza" IN ('COPIA','CARNET','POLAROID'));
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_unidad_check" CHECK ("unidad" IN ('HOJA','COPIA','PIEZA'));
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_estado_check" CHECK ("estado" IN ('PREPARANDO','LISTA','IMPRESA','ANULADA'));
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_destino_check" CHECK ("saleItemId" IS NULL OR "proyectoId" IS NULL);
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_tipo_check" CHECK ("tipo" IN ('COPIA','CARNET','POLAROID'));
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_cantidad_check" CHECK ("cantidad" > 0);
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_copias_check" CHECK ("copias" > 0);
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_hojas_check" CHECK ("hojas" > 0);
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_motivo_check" CHECK ("motivo" IN ('NORMAL','DESCARTADA','PRUEBA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

(Cada `ADD CONSTRAINT` en su propio bloque `DO` si se quiere que uno ya existente no saltee los demás; recomendado.)

- [ ] **Step 4: Registrar las tablas en la base en memoria de pruebas**

En `lib/circuitos/base-en-memoria.ts`, agregar al arreglo `TABLAS`:

```ts
  // Impresión (etapa 1).
  "fotofficeTamanoImpresion", "fotofficeSalidaImpresion", "fotofficeSalidaTamano", "fotofficeProductoProduccion",
  "fotofficePreparacionImpresion", "fotofficeOriginalImpresion", "fotofficePiezaImpresion", "fotofficeHojaImpresion",
  "fotofficeRegistroImpresion", "fotofficeAttachment", "saleItem",
```

(si `fotofficeAttachment` o `saleItem` ya están, no duplicarlos) y en el mapa de valores por omisión (donde está `fotofficeAttachment: () => …`):

```ts
  fotofficePreparacionImpresion: () => ({ productId: null, clientId: null, saleItemId: null, proyectoId: null, estado: "PREPARANDO", createdAt: new Date(), updatedAt: new Date() }),
  fotofficeOriginalImpresion: () => ({ previewKey: null, bytes: 0, anchoPx: 0, altoPx: 0, perfilColor: null, estado: "PENDIENTE", archivoTrabajoId: null, adjuntoId: null, createdAt: new Date() }),
  fotofficeHojaImpresion: () => ({ finalKey: null, finalHuella: null, finalAnchoPx: 0, finalAltoPx: 0, copias: 1, createdAt: new Date(), updatedAt: new Date() }),
  fotofficeRegistroImpresion: () => ({ hojaId: null, productId: null, saleItemId: null, proyectoId: null, userId: null, createdAt: new Date() }),
```

y sumar `origen: null` al valor por omisión de `fotofficeAttachment`.

- [ ] **Step 5: Correr todas las pruebas y el typecheck**

Run: `pnpm --filter fotoffice test && pnpm --filter fotoffice typecheck`
Expected: PASS (nada usa todavía las tablas nuevas).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma apps/fotoffice/lib/circuitos/base-en-memoria.ts
git commit -m "Impresión: tablas de tamaños, salidas, preparaciones y registro de hojas"
```

---

### Task 3: Medidas, tamaños y salidas iniciales (puro)

**Files:**
- Create: `lib/impresion/medidas.ts`
- Test: `lib/impresion/medidas.test.ts`

**Interfaces:**
- Produces:
  - `MM_POR_PULGADA = 25.4`
  - `mmAPx(mm: number, ppp: number): number`
  - `pixelesDeHoja(t: { anchoMm: number; altoMm: number }, ppp: number): { ancho: number; alto: number }`
  - `medidaImpresaMm(mm: number, escalaMil: number): number`
  - `escalaDesdeRegla(medidaImpresaMm: number): number | null` (regla de 100 mm; null si fuera de 90–110)
  - `type Nitidez = "SUAVE" | "NORMAL" | "FUERTE"`
  - `TAMANOS_INICIALES: readonly { nombre: string; anchoMm: number; altoMm: number; orden: number }[]`
  - `SALIDAS_INICIALES: readonly { nombre: string; ppp: number; nitidez: Nitidez; admiteCopias: boolean; tamanos: readonly string[] }[]`

- [ ] **Step 1: Prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { SALIDAS_INICIALES, TAMANOS_INICIALES, escalaDesdeRegla, medidaImpresaMm, mmAPx, pixelesDeHoja } from "./medidas";

describe("medidas de impresión", () => {
  it("10x15 a 300 ppp son 1205 × 1795 px (desde los mm reales, no del nombre)", () => {
    expect(pixelesDeHoja({ anchoMm: 102, altoMm: 152 }, 300)).toEqual({ ancho: 1205, alto: 1795 });
  });
  it("A4 a 300 ppp son 2480 × 3508 px", () => {
    expect(pixelesDeHoja({ anchoMm: 210, altoMm: 297 }, 300)).toEqual({ ancho: 2480, alto: 3508 });
  });
  it("mmAPx redondea al píxel más cercano", () => {
    expect(mmAPx(40, 300)).toBe(472);
  });
  it("la escala corrige lo que mide la regla impresa", () => {
    expect(escalaDesdeRegla(100)).toBe(1000);
    expect(escalaDesdeRegla(99)).toBe(1010);
    expect(escalaDesdeRegla(101)).toBe(990);
    expect(escalaDesdeRegla(80)).toBeNull();
    expect(escalaDesdeRegla(Number.NaN)).toBeNull();
  });
  it("medidaImpresaMm aplica la escala con un decimal", () => {
    expect(medidaImpresaMm(102, 1010)).toBe(103);
    expect(medidaImpresaMm(152, 1000)).toBe(152);
  });
  it("los tamaños iniciales son las medidas reales que dio Daniel", () => {
    const m = Object.fromEntries(TAMANOS_INICIALES.map((t) => [t.nombre, [t.anchoMm, t.altoMm]]));
    expect(m).toEqual({
      "10x15": [102, 152], "13x18": [127, 180], "15x20": [152, 203], "15x21": [152, 210],
      "20x30": [203, 300], "25x38": [254, 380], A4: [210, 297],
    });
  });
  it("la Epson no admite copias y la Kodak sólo hace 10x15, 13x18 y 15x20", () => {
    const kodak = SALIDAS_INICIALES.find((s) => s.nombre === "Kodak 305")!;
    const epson = SALIDAS_INICIALES.find((s) => s.nombre === "Epson L800")!;
    expect(kodak.tamanos).toEqual(["10x15", "13x18", "15x20"]);
    expect(kodak.admiteCopias).toBe(true);
    expect(epson.admiteCopias).toBe(false);
    expect(epson.tamanos).toEqual(["10x15", "A4"]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/medidas.test.ts`
Expected: FAIL (no existe el módulo).

- [ ] **Step 3: Implementar `lib/impresion/medidas.ts`**

```ts
/**
 * Medidas de impresión. Módulo PURO (lo usan el navegador y el servidor).
 * Todo se calcula desde los milímetros reales del papel, nunca desde el nombre ("10x15").
 */

export const MM_POR_PULGADA = 25.4;

export type Nitidez = "SUAVE" | "NORMAL" | "FUERTE";

export function mmAPx(mm: number, ppp: number): number {
  return Math.round((mm / MM_POR_PULGADA) * ppp);
}

export function pixelesDeHoja(t: { anchoMm: number; altoMm: number }, ppp: number): { ancho: number; alto: number } {
  return { ancho: mmAPx(t.anchoMm, ppp), alto: mmAPx(t.altoMm, ppp) };
}

/** El tamaño que se le pide al navegador para que, con la corrección, salga a la medida real. */
export function medidaImpresaMm(mm: number, escalaMil: number): number {
  return Math.round(((mm * escalaMil) / 1000) * 10) / 10;
}

/**
 * La hoja de prueba trae una regla de 100 mm. Si impresa mide 99 mm, hay que pedir un 1,0 %
 * más (1010 por mil). Fuera de 90–110 mm es un error de medición, no una corrección.
 */
export function escalaDesdeRegla(medidaImpresaMm: number): number | null {
  if (!Number.isFinite(medidaImpresaMm) || medidaImpresaMm < 90 || medidaImpresaMm > 110) return null;
  return Math.round((100 / medidaImpresaMm) * 1000);
}

export const TAMANOS_INICIALES = [
  { nombre: "10x15", anchoMm: 102, altoMm: 152, orden: 1 },
  { nombre: "13x18", anchoMm: 127, altoMm: 180, orden: 2 },
  { nombre: "15x20", anchoMm: 152, altoMm: 203, orden: 3 },
  { nombre: "15x21", anchoMm: 152, altoMm: 210, orden: 4 },
  { nombre: "20x30", anchoMm: 203, altoMm: 300, orden: 5 },
  { nombre: "25x38", anchoMm: 254, altoMm: 380, orden: 6 },
  { nombre: "A4", anchoMm: 210, altoMm: 297, orden: 7 },
] as const;

/** Las dos impresoras de DNX Estudio. Los laboratorios se agregan después desde Configuración. */
export const SALIDAS_INICIALES = [
  { nombre: "Kodak 305", ppp: 300, nitidez: "SUAVE", admiteCopias: true, tamanos: ["10x15", "13x18", "15x20"] },
  { nombre: "Epson L800", ppp: 300, nitidez: "FUERTE", admiteCopias: false, tamanos: ["10x15", "A4"] },
] as const satisfies readonly { nombre: string; ppp: number; nitidez: Nitidez; admiteCopias: boolean; tamanos: readonly string[] }[];
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/medidas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/medidas.ts apps/fotoffice/lib/impresion/medidas.test.ts
git commit -m "Impresión: medidas reales, tamaños y salidas iniciales"
```

---

### Task 4: Ajustes de revelado (puro, compartido navegador/servidor)

**Files:**
- Create: `lib/impresion/ajustes.ts`
- Test: `lib/impresion/ajustes.test.ts`

**Interfaces:**
- Produces:
  - `CLAVES_AJUSTE` (tupla readonly de 10 claves), `type ClaveAjuste`, `type Ajustes = Record<ClaveAjuste, number>`
  - `AJUSTES_NEUTROS: Ajustes`, `esquemaAjustes` (zod, enteros −50..50)
  - `TOPES` (efecto máximo con ±50)
  - `esNeutro(a: Ajustes): boolean`
  - `ajustarPixel(r: number, g: number, b: number, a: Ajustes): [number, number, number]` (0..1 → 0..1)
  - `aplicarAjustes(px: Uint8Array | Uint8ClampedArray | Uint16Array, canales: 3 | 4, a: Ajustes): void` (en el lugar)

- [ ] **Step 1: Prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, TOPES, ajustarPixel, aplicarAjustes, esNeutro, esquemaAjustes, type Ajustes } from "./ajustes";

const con = (p: Partial<Ajustes>): Ajustes => ({ ...AJUSTES_NEUTROS, ...p });
const cerca = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe("ajustes de revelado", () => {
  it("todo en 0 no cambia ni un valor (8 y 16 bits)", () => {
    const ocho = Uint8ClampedArray.from([0, 17, 128, 255, 1, 2, 250, 255]);
    const copia8 = ocho.slice();
    aplicarAjustes(ocho, 4, AJUSTES_NEUTROS);
    expect([...ocho]).toEqual([...copia8]);
    const dieciseis = Uint16Array.from([0, 1000, 65535, 32768, 12, 40000]);
    const copia16 = dieciseis.slice();
    aplicarAjustes(dieciseis, 3, AJUSTES_NEUTROS);
    expect([...dieciseis]).toEqual([...copia16]);
    expect(esNeutro(AJUSTES_NEUTROS)).toBe(true);
  });
  it("exposición +50 es un paso: un gris de 0,25 pasa a 0,5", () => {
    const [r] = ajustarPixel(0.25, 0.25, 0.25, con({ exposicion: 50 }));
    cerca(r, 0.5);
  });
  it("temperatura +50 calienta: sube el rojo y baja el azul en el tope", () => {
    const [r, g, b] = ajustarPixel(0.5, 0.5, 0.5, con({ temperatura: 50 }));
    cerca(r, 0.5 + TOPES.temperatura);
    cerca(g, 0.5);
    cerca(b, 0.5 - TOPES.temperatura);
  });
  it("saturación no cambia un gris", () => {
    const [r, g, b] = ajustarPixel(0.4, 0.4, 0.4, con({ saturacion: 50, intensidad: 50 }));
    cerca(r, 0.4); cerca(g, 0.4); cerca(b, 0.4);
  });
  it("contraste deja quietos el negro, el gris medio y el blanco", () => {
    for (const v of [0, 0.5, 1]) {
      const [r] = ajustarPixel(v, v, v, con({ contraste: 50 }));
      cerca(r, v);
    }
    const [claro] = ajustarPixel(0.75, 0.75, 0.75, con({ contraste: 50 }));
    expect(claro).toBeGreaterThan(0.75);
  });
  it("negros +50 levanta el negro puro sin pasarse del tope", () => {
    const [r] = ajustarPixel(0, 0, 0, con({ negros: 50 }));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(TOPES.blancosNegros);
  });
  it("con todo al máximo, nada se sale de 0..1", () => {
    const max = con({ exposicion: 50, contraste: 50, luces: 50, sombras: 50, blancos: 50, negros: 50, temperatura: 50, tinte: 50, saturacion: 50, intensidad: 50 });
    for (const v of [0, 0.1, 0.5, 0.9, 1]) {
      for (const x of ajustarPixel(v, v * 0.8, v * 0.3, max)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
    }
  });
  it("la intensidad satura menos un tono de piel que un azul igual de apagado", () => {
    const a = con({ intensidad: 50 });
    const piel = ajustarPixel(0.8, 0.6, 0.5, a);
    const azul = ajustarPixel(0.5, 0.6, 0.8, a);
    const sat = ([r, g, b]: number[]) => Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
    expect(sat(piel)).toBeLessThan(sat(azul));
  });
  it("el esquema sólo acepta enteros de −50 a 50 en las 10 claves", () => {
    expect(esquemaAjustes.safeParse(AJUSTES_NEUTROS).success).toBe(true);
    expect(esquemaAjustes.safeParse(con({ contraste: 51 })).success).toBe(false);
    expect(esquemaAjustes.safeParse(con({ contraste: 1.5 })).success).toBe(false);
    expect(esquemaAjustes.safeParse({ ...AJUSTES_NEUTROS, otra: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/ajustes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/impresion/ajustes.ts`**

```ts
import { z } from "zod";

/**
 * Revelado básico para JPG. Módulo PURO: la MISMA función corre en el navegador (vista previa,
 * 8 bits) y en el servidor (archivo final, 16 bits), así lo que se ve es lo que sale.
 * Cada control va de −50 a +50; `TOPES` es el efecto real con el control a fondo.
 */

export const CLAVES_AJUSTE = [
  "exposicion", "contraste", "luces", "sombras", "blancos", "negros", "temperatura", "tinte", "saturacion", "intensidad",
] as const;
export type ClaveAjuste = (typeof CLAVES_AJUSTE)[number];
export type Ajustes = Record<ClaveAjuste, number>;

export const AJUSTES_NEUTROS: Ajustes = {
  exposicion: 0, contraste: 0, luces: 0, sombras: 0, blancos: 0, negros: 0, temperatura: 0, tinte: 0, saturacion: 0, intensidad: 0,
};

const control = z.number().int().min(-50).max(50);
export const esquemaAjustes = z
  .object({
    exposicion: control, contraste: control, luces: control, sombras: control, blancos: control,
    negros: control, temperatura: control, tinte: control, saturacion: control, intensidad: control,
  })
  .strict();

export const TOPES = {
  /** Pasos de exposición (EV). */
  exposicionEv: 1,
  /** Fuerza de la curva S. */
  contraste: 0.25,
  /** Desplazamiento máximo en su zona (≈30 % de media escala). */
  lucesSombras: 0.15,
  /** Cuánto se mueve el punto blanco o negro. */
  blancosNegros: 0.08,
  /** ≈ ±1500 K. */
  temperatura: 0.08,
  tinte: 0.06,
  saturacion: 0.35,
  intensidad: 0.35,
} as const;

export function esNeutro(a: Ajustes): boolean {
  return CLAVES_AJUSTE.every((k) => a[k] === 0);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function suave(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
/** Curva S que deja fijos 0, 0,5 y 1. Con |k| ≤ 0,5 es siempre creciente. */
function curvaS(v: number, k: number): number {
  const c = clamp01(v);
  return c + k * (c - 0.5) * 4 * c * (1 - c);
}

/** Un píxel en 0..1. El orden es fijo y es el mismo en la vista previa y en el final. */
export function ajustarPixel(r0: number, g0: number, b0: number, a: Ajustes): [number, number, number] {
  let r = r0, g = g0, b = b0;
  if (a.exposicion !== 0) {
    const f = 2 ** ((a.exposicion / 50) * TOPES.exposicionEv);
    r *= f; g *= f; b *= f;
  }
  if (a.negros !== 0 || a.blancos !== 0) {
    const bp = -(a.negros / 50) * TOPES.blancosNegros;
    const wp = 1 - (a.blancos / 50) * TOPES.blancosNegros;
    const d = wp - bp;
    r = (r - bp) / d; g = (g - bp) / d; b = (b - bp) / d;
  }
  if (a.contraste !== 0) {
    const k = (a.contraste / 50) * TOPES.contraste * 2;
    r = curvaS(r, k); g = curvaS(g, k); b = curvaS(b, k);
  }
  if (a.sombras !== 0 || a.luces !== 0) {
    const L = clamp01(lum(r, g, b));
    const d =
      (a.sombras / 50) * TOPES.lucesSombras * (1 - suave(0, 0.5, L)) +
      (a.luces / 50) * TOPES.lucesSombras * suave(0.5, 1, L);
    r += d; g += d; b += d;
  }
  if (a.temperatura !== 0) {
    const t = (a.temperatura / 50) * TOPES.temperatura;
    r += t; b -= t;
  }
  if (a.tinte !== 0) {
    const m = (a.tinte / 50) * TOPES.tinte;
    g -= m; r += m / 2; b += m / 2;
  }
  if (a.saturacion !== 0) {
    const L = lum(r, g, b);
    const s = 1 + (a.saturacion / 50) * TOPES.saturacion;
    r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s;
  }
  if (a.intensidad !== 0) {
    const L = lum(r, g, b);
    const satActual = clamp01(Math.max(r, g, b) - Math.min(r, g, b));
    const piel = r > g && g > b ? 0.5 : 1;
    const f = 1 + (a.intensidad / 50) * TOPES.intensidad * (1 - satActual) * piel;
    r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
  }
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/** En el lugar. RGBA (canales 4, el alfa no se toca) o RGB (3). 8 o 16 bits. */
export function aplicarAjustes(px: Uint8Array | Uint8ClampedArray | Uint16Array, canales: 3 | 4, a: Ajustes): void {
  if (esNeutro(a)) return;
  const max = px instanceof Uint16Array ? 65535 : 255;
  for (let i = 0; i + 2 < px.length; i += canales) {
    const [r, g, b] = ajustarPixel(px[i]! / max, px[i + 1]! / max, px[i + 2]! / max, a);
    px[i] = Math.round(r * max);
    px[i + 1] = Math.round(g * max);
    px[i + 2] = Math.round(b * max);
  }
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/ajustes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/ajustes.ts apps/fotoffice/lib/impresion/ajustes.test.ts
git commit -m "Impresión: ajustes de revelado con topes, iguales en pantalla y en el archivo"
```

---

### Task 5: Receta, geometría, plancha y huella

**Files:**
- Create: `lib/impresion/receta.ts`, `lib/impresion/geometria.ts`, `lib/impresion/plancha.ts`, `lib/impresion/huella.ts`
- Test: `lib/impresion/geometria.test.ts`, `lib/impresion/plancha.test.ts`, `lib/impresion/receta.test.ts`

**Interfaces:**
- Consumes: `Ajustes`, `esquemaAjustes`, `AJUSTES_NEUTROS` (Task 4); `Nitidez`, `mmAPx` (Task 3); `calcularGrilla`, `MARGEN_CM`, `SEPARACION_CM` de `lib/foto-carnet/medidas.ts` (existente).
- Produces:
  - `type Encuadre = { x: number; y: number; ancho: number; alto: number }` (proporciones 0..1 de la caja rotada)
  - `type Receta = { version: 1; modo: "RECORTAR"; rotacion90: 0 | 90 | 180 | 270; enderezar: number; encuadre: Encuadre; ajustes: Ajustes; nitidez: Nitidez | null }`
  - `validarReceta(x: unknown): Receta | null`, `recetaInicial(): Receta`, `anguloTotal(r: Receta): number`
  - `cajaRotada(ancho: number, alto: number, grados: number): { ancho: number; alto: number }`
  - `rectanguloEnPixeles(e: Encuadre, caja: { ancho: number; alto: number }, margen?: number): { left: number; top: number; width: number; height: number }`
  - `encuadreDesdePixeles(px: { x: number; y: number; width: number; height: number }, caja: { ancho: number; alto: number }): Encuadre`
  - `resolucionEfectiva(px: { width: number; height: number }, mm: { anchoMm: number; altoMm: number }): number`
  - `avisoDeCalidad(ppp: number): "OK" | "BLANDA" | "PIXELADA"`
  - `type DisposicionCarnet = { pieza: { ancho: number; alto: number }; posiciones: { left: number; top: number }[]; lineas: { xs: number[]; ys: number[] } }`
  - `disposicionCarnet(medida: { anchoMm: number; altoMm: number }, hoja: { anchoMm: number; altoMm: number }, ppp: number, maxTotal?: number): DisposicionCarnet`
  - `huellaDe(valor: unknown): string` (sólo servidor)

- [ ] **Step 1: Pruebas que fallan**

`lib/impresion/geometria.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avisoDeCalidad, cajaRotada, encuadreDesdePixeles, rectanguloEnPixeles, resolucionEfectiva } from "./geometria";

describe("geometría", () => {
  it("la caja rotada 90° invierte lados y 0° no cambia", () => {
    expect(cajaRotada(4000, 3000, 0)).toEqual({ ancho: 4000, alto: 3000 });
    expect(cajaRotada(4000, 3000, 90)).toEqual({ ancho: 3000, alto: 4000 });
  });
  it("la caja rotada 10° es más grande que la foto", () => {
    const c = cajaRotada(4000, 3000, 10);
    expect(c.ancho).toBe(Math.round(4000 * Math.cos(Math.PI / 18) + 3000 * Math.sin(Math.PI / 18)));
    expect(c.alto).toBeGreaterThan(3000);
  });
  it("ida y vuelta entre píxeles de la vista previa y proporciones", () => {
    const caja = { ancho: 1600, alto: 1200 };
    const e = encuadreDesdePixeles({ x: 400, y: 300, width: 800, height: 600 }, caja);
    expect(e).toEqual({ x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 });
    expect(rectanguloEnPixeles(e, { ancho: 4000, alto: 3000 })).toEqual({ left: 1000, top: 750, width: 2000, height: 1500 });
  });
  it("nunca se sale de la caja, ni siquiera con margen de seguridad", () => {
    const r = rectanguloEnPixeles({ x: 0.9, y: 0.9, ancho: 0.1, alto: 0.1 }, { ancho: 1001, alto: 1001 }, 2);
    expect(r.left + r.width).toBeLessThanOrEqual(1001 - 2);
    expect(r.top + r.height).toBeLessThanOrEqual(1001 - 2);
    expect(r.width).toBeGreaterThanOrEqual(1);
  });
  it("encuadreDesdePixeles recorta valores fuera de rango", () => {
    const e = encuadreDesdePixeles({ x: -5, y: -5, width: 2000, height: 2000 }, { ancho: 1000, alto: 1000 });
    expect(e).toEqual({ x: 0, y: 0, ancho: 1, alto: 1 });
  });
  it("resolución efectiva y aviso", () => {
    expect(resolucionEfectiva({ width: 1205, height: 1795 }, { anchoMm: 102, altoMm: 152 })).toBe(300);
    expect(avisoDeCalidad(200)).toBe("OK");
    expect(avisoDeCalidad(199)).toBe("BLANDA");
    expect(avisoDeCalidad(150)).toBe("BLANDA");
    expect(avisoDeCalidad(149)).toBe("PIXELADA");
  });
});
```

`lib/impresion/plancha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { disposicionCarnet } from "./plancha";

describe("plancha de carnet", () => {
  it("4×4 en 10x15 a 300 ppp entran 6, de 472 px, todas dentro de la hoja", () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(d.pieza).toEqual({ ancho: 472, alto: 472 });
    expect(d.posiciones).toHaveLength(6);
    for (const p of d.posiciones) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.left + 472).toBeLessThanOrEqual(1205);
      expect(p.top + 472).toBeLessThanOrEqual(1795);
    }
  });
  it("respeta el tope pedido", () => {
    expect(disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300, 4).posiciones).toHaveLength(4);
  });
  it("las líneas de corte marcan los bordes de cada columna y fila, sin repetir", () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(new Set(d.lineas.xs).size).toBe(d.lineas.xs.length);
    expect(d.lineas.xs.length).toBe(4); // 2 columnas × 2 bordes
    expect(d.lineas.ys.length).toBe(6); // 3 filas × 2 bordes
  });
});
```

`lib/impresion/receta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anguloTotal, recetaInicial, validarReceta } from "./receta";

describe("receta", () => {
  it("la inicial es válida, neutra y sin giro", () => {
    const r = recetaInicial();
    expect(validarReceta(r)).toEqual(r);
    expect(anguloTotal(r)).toBe(0);
  });
  it("rechaza encuadres fuera de la foto, giros raros y enderezados de más", () => {
    const r = recetaInicial();
    expect(validarReceta({ ...r, encuadre: { x: 0.6, y: 0, ancho: 0.5, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...r, rotacion90: 45 })).toBeNull();
    expect(validarReceta({ ...r, enderezar: 11 })).toBeNull();
    expect(validarReceta({ ...r, modo: "ENCAJAR" })).toBeNull();
    expect(validarReceta("no")).toBeNull();
  });
  it("el ángulo total suma giro y enderezado", () => {
    expect(anguloTotal({ ...recetaInicial(), rotacion90: 90, enderezar: -3.5 })).toBe(86.5);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/impresion/geometria.test.ts lib/impresion/plancha.test.ts lib/impresion/receta.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`lib/impresion/receta.ts`:

```ts
import { z } from "zod";
import { AJUSTES_NEUTROS, esquemaAjustes, type Ajustes } from "./ajustes";
import type { Nitidez } from "./medidas";

/**
 * La receta de una pieza: todo lo que se decidió en pantalla, en proporciones (nunca píxeles de
 * pantalla). El servidor la aplica sobre el original completo. Módulo PURO.
 * Etapa 1: sólo RECORTAR. ENCAJAR, orientación y color de borde llegan en la etapa 2.
 */

export type Encuadre = { x: number; y: number; ancho: number; alto: number };
export type Receta = {
  version: 1;
  modo: "RECORTAR";
  rotacion90: 0 | 90 | 180 | 270;
  /** −10 a +10 grados. */
  enderezar: number;
  /** Proporciones 0..1 de la caja de la foto ya girada (`cajaRotada`). */
  encuadre: Encuadre;
  ajustes: Ajustes;
  /** null = la de la salida. */
  nitidez: Nitidez | null;
};

const fraccion = z.number().min(0).max(1);
const esquema = z
  .object({
    version: z.literal(1),
    modo: z.literal("RECORTAR"),
    rotacion90: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    enderezar: z.number().min(-10).max(10),
    encuadre: z
      .object({ x: fraccion, y: fraccion, ancho: z.number().gt(0).max(1), alto: z.number().gt(0).max(1) })
      .strict()
      .refine((e) => e.x + e.ancho <= 1.0001 && e.y + e.alto <= 1.0001),
    ajustes: esquemaAjustes,
    nitidez: z.enum(["SUAVE", "NORMAL", "FUERTE"]).nullable(),
  })
  .strict();

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
```

`lib/impresion/geometria.ts`:

```ts
import { MM_POR_PULGADA } from "./medidas";
import type { Encuadre } from "./receta";

/** Módulo PURO. Las cuentas que tienen que dar igual en la pantalla y en el servidor. */

/** El rectángulo que ocupa una foto girada `grados` (lo mismo que calculan react-easy-crop y sharp). */
export function cajaRotada(ancho: number, alto: number, grados: number): { ancho: number; alto: number } {
  const r = (grados * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { ancho: Math.round(ancho * c + alto * s), alto: Math.round(ancho * s + alto * c) };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * De proporciones a píxeles de una caja concreta. `margen` deja píxeles libres en los bordes:
 * con un giro no múltiplo de 90°, sharp puede redondear la caja un píxel distinto y `extract`
 * fallaría por uno.
 */
export function rectanguloEnPixeles(
  e: Encuadre,
  caja: { ancho: number; alto: number },
  margen = 0,
): { left: number; top: number; width: number; height: number } {
  const W = caja.ancho - margen;
  const H = caja.alto - margen;
  const left = Math.min(Math.max(0, Math.round(e.x * caja.ancho)), W - 1);
  const top = Math.min(Math.max(0, Math.round(e.y * caja.alto)), H - 1);
  const width = Math.max(1, Math.min(W - left, Math.round(e.ancho * caja.ancho)));
  const height = Math.max(1, Math.min(H - top, Math.round(e.alto * caja.alto)));
  return { left, top, width, height };
}

/** De lo que devuelve react-easy-crop (píxeles de la vista previa girada) a proporciones. */
export function encuadreDesdePixeles(
  px: { x: number; y: number; width: number; height: number },
  caja: { ancho: number; alto: number },
): Encuadre {
  const x = clamp01(px.x / caja.ancho);
  const y = clamp01(px.y / caja.alto);
  return { x, y, ancho: clamp01(Math.min(px.width / caja.ancho, 1 - x)), alto: clamp01(Math.min(px.height / caja.alto, 1 - y)) };
}

/** Píxeles reales del original que caen en cada pulgada del papel (el lado más débil). */
export function resolucionEfectiva(px: { width: number; height: number }, mm: { anchoMm: number; altoMm: number }): number {
  return Math.round(Math.min(px.width / (mm.anchoMm / MM_POR_PULGADA), px.height / (mm.altoMm / MM_POR_PULGADA)));
}

export function avisoDeCalidad(ppp: number): "OK" | "BLANDA" | "PIXELADA" {
  if (ppp >= 200) return "OK";
  if (ppp >= 150) return "BLANDA";
  return "PIXELADA";
}
```

`lib/impresion/plancha.ts`:

```ts
import { MARGEN_CM, SEPARACION_CM, calcularGrilla } from "@/lib/foto-carnet/medidas";
import { mmAPx } from "./medidas";

/** Módulo PURO: dónde va cada foto carnet en la hoja y por dónde se corta. */

export type DisposicionCarnet = {
  pieza: { ancho: number; alto: number };
  posiciones: { left: number; top: number }[];
  lineas: { xs: number[]; ys: number[] };
};

export function disposicionCarnet(
  medida: { anchoMm: number; altoMm: number },
  hoja: { anchoMm: number; altoMm: number },
  ppp: number,
  maxTotal?: number,
): DisposicionCarnet {
  const pieza = { ancho: mmAPx(medida.anchoMm, ppp), alto: mmAPx(medida.altoMm, ppp) };
  const gap = mmAPx(SEPARACION_CM * 10, ppp);
  const g = calcularGrilla({
    sheetWidthPx: mmAPx(hoja.anchoMm, ppp),
    sheetHeightPx: mmAPx(hoja.altoMm, ppp),
    photoWidthPx: pieza.ancho,
    photoHeightPx: pieza.alto,
    marginPx: mmAPx(MARGEN_CM * 10, ppp),
    gapPx: gap,
    maxTotal,
  });
  const posiciones: { left: number; top: number }[] = [];
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (let fila = 0; fila < g.rows; fila++) {
    for (let col = 0; col < g.cols; col++) {
      if (maxTotal && posiciones.length >= maxTotal) break;
      const left = g.startX + col * (pieza.ancho + gap);
      const top = g.startY + fila * (pieza.alto + gap);
      posiciones.push({ left, top });
      xs.add(left); xs.add(left + pieza.ancho - 1);
      ys.add(top); ys.add(top + pieza.alto - 1);
    }
  }
  return { pieza, posiciones, lineas: { xs: [...xs].sort((a, b) => a - b), ys: [...ys].sort((a, b) => a - b) } };
}
```

`lib/impresion/huella.ts`:

```ts
import "server-only";
import { createHash } from "node:crypto";

/** JSON con las claves ordenadas: el mismo contenido da siempre la misma huella. */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
}

export function huellaDe(valor: unknown): string {
  return createHash("sha256").update(canonico(valor)).digest("hex");
}
```

Agregar a `lib/impresion/receta.test.ts`:

```ts
import { huellaDe } from "./huella";
it("la huella no depende del orden de las claves", () => {
  expect(huellaDe({ a: 1, b: { c: 2, d: 3 } })).toBe(huellaDe({ b: { d: 3, c: 2 }, a: 1 }));
  expect(huellaDe({ a: 1 })).not.toBe(huellaDe({ a: 2 }));
});
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion
git commit -m "Impresión: receta en proporciones, geometría del encuadre y plancha de carnet"
```

---

### Task 6: Motor de archivos finales con `sharp`

**Files:**
- Create: `lib/impresion/render.ts`
- Test: `lib/impresion/render.test.ts`

**Interfaces:**
- Consumes: `Receta`, `anguloTotal` (Task 5); `cajaRotada`, `rectanguloEnPixeles` (Task 5); `aplicarAjustes` (Task 4); `Nitidez` (Task 3); `DisposicionCarnet` (Task 5).
- Produces:
  - `MAX_PIXELES_ORIGINAL = 60_000_000`, `LADO_VISTA_PREVIA = 1600`
  - `class ImagenNoProcesable extends Error { definitivo: boolean }`
  - `leerOriginal(buf: Buffer): Promise<{ ancho: number; alto: number; perfilColor: string | null; formato: string }>` (medidas ya derechas)
  - `generarVistaPrevia(buf: Buffer): Promise<{ jpg: Buffer; ancho: number; alto: number }>`
  - `type PiezaRaw = { data: Buffer; ancho: number; alto: number }` (RGB 8 bits)
  - `renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw>`
  - `componerHoja(hoja: { ancho: number; alto: number }, pieza: PiezaRaw, disp: Pick<DisposicionCarnet, "posiciones" | "lineas">, ppp: number, conLineas: boolean): Promise<Buffer>` (JPG final)

- [ ] **Step 1: Pruebas que fallan**

`lib/impresion/render.test.ts`. Las imágenes de prueba se fabrican con `sharp` en la prueba (no hace falta subir archivos al repo):

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import { recetaInicial, type Receta } from "./receta";
import { componerHoja, generarVistaPrevia, leerOriginal, renderizarPieza } from "./render";
import { disposicionCarnet } from "./plancha";

async function foto(ancho: number, alto: number, color = { r: 200, g: 40, b: 40 }) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } }).jpeg({ quality: 95 }).toBuffer();
}
/** Mitad izquierda negra, mitad derecha blanca: sirve para ver orientación y nitidez. */
async function mitades(ancho: number, alto: number) {
  const px = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) px.fill(x < ancho / 2 ? 0 : 255, (y * ancho + x) * 3, (y * ancho + x) * 3 + 3);
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}
const promedio = async (data: Buffer) => {
  const s = await sharp(data, { raw: { width: 1, height: data.length / 3, channels: 3 } }).stats();
  return s.channels.map((c) => c.mean);
};

describe("motor de impresión", () => {
  it("lee las medidas ya derechas (orientación EXIF 6 = girada 90°)", async () => {
    const girada = await sharp(await foto(400, 300)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const info = await leerOriginal(girada);
    expect([info.ancho, info.alto]).toEqual([300, 400]);
  });

  it("la vista previa queda en 1600 px de lado mayor y no agranda fotos chicas", async () => {
    expect((await generarVistaPrevia(await foto(4000, 3000))).ancho).toBe(1600);
    expect((await generarVistaPrevia(await foto(800, 600))).ancho).toBe(800);
  });

  it("la pieza sale exactamente del tamaño pedido", async () => {
    const p = await renderizarPieza(await foto(3000, 2000), recetaInicial(), { ancho: 472, alto: 472 }, "NORMAL");
    expect([p.ancho, p.alto, p.data.length]).toEqual([472, 472, 472 * 472 * 3]);
  });

  it("respeta la orientación EXIF al recortar la mitad izquierda", async () => {
    // Original 400×300 negro|blanco, marcado como girado 180°: derecho, la izquierda es BLANCA.
    const base = await mitades(400, 300);
    const girada = await sharp(base).withMetadata({ orientation: 3 }).jpeg({ quality: 100 }).toBuffer();
    const r: Receta = { ...recetaInicial(), encuadre: { x: 0, y: 0, ancho: 0.4, alto: 1 } };
    const p = await renderizarPieza(girada, r, { ancho: 100, alto: 100 }, "SUAVE");
    const [rr] = await promedio(p.data);
    expect(rr).toBeGreaterThan(230);
  });

  it("convierte P3 a sRGB sin apagar el color", async () => {
    const p3 = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .withIccProfile("p3")
      .jpeg({ quality: 100 })
      .toBuffer();
    const p = await renderizarPieza(p3, recetaInicial(), { ancho: 50, alto: 50 }, "SUAVE");
    const [r, g, b] = await promedio(p.data);
    // El rojo P3 puro queda fuera de sRGB: tiene que seguir siendo un rojo a fondo, no rosado.
    expect(r).toBeGreaterThan(245);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(40);
  });

  it("enderezar al borde no revienta", async () => {
    const r: Receta = { ...recetaInicial(), enderezar: 7.3, encuadre: { x: 0.5, y: 0.5, ancho: 0.5, alto: 0.5 } };
    await expect(renderizarPieza(await foto(1001, 777), r, { ancho: 120, alto: 90 }, "NORMAL")).resolves.toBeTruthy();
  });

  it("los ajustes se aplican en el archivo final (exposición +50 aclara)", async () => {
    const gris = await foto(200, 200, { r: 64, g: 64, b: 64 });
    const normal = await promedio((await renderizarPieza(gris, recetaInicial(), { ancho: 50, alto: 50 }, "SUAVE")).data);
    const clara = await promedio(
      (await renderizarPieza(gris, { ...recetaInicial(), ajustes: { ...AJUSTES_NEUTROS, exposicion: 50 } }, { ancho: 50, alto: 50 }, "SUAVE")).data,
    );
    expect(clara[0]!).toBeGreaterThan(normal[0]! * 1.5);
  });

  it("no desenfoca: el borde negro|blanco sigue siendo un salto de pocos píxeles", async () => {
    const p = await renderizarPieza(await mitades(1200, 1200), recetaInicial(), { ancho: 600, alto: 600 }, "SUAVE");
    const fila = 300;
    const v = (x: number) => p.data[(fila * 600 + x) * 3]!;
    // Entre el 20 % y el 80 % del salto tiene que haber como mucho 4 píxeles.
    let desde = -1, hasta = -1;
    for (let x = 280; x < 320; x++) {
      if (desde < 0 && v(x) > 51) desde = x;
      if (hasta < 0 && v(x) > 204) hasta = x;
    }
    expect(hasta - desde).toBeLessThanOrEqual(4);
  });

  it("la hoja final: medidas exactas, 300 ppp grabados, sRGB embebido y fondo blanco", async () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    const pieza = await renderizarPieza(await foto(1000, 1000), recetaInicial(), d.pieza, "SUAVE");
    const jpg = await componerHoja({ ancho: 1205, alto: 1795 }, pieza, d, 300, true);
    const meta = await sharp(jpg).metadata();
    expect([meta.width, meta.height, meta.format, meta.density, meta.chromaSubsampling]).toEqual([1205, 1795, "jpeg", 300, "4:4:4"]);
    expect(meta.hasProfile).toBe(true);
    const { data } = await sharp(jpg).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer({ resolveWithObject: true });
    expect(Math.min(...data)).toBeGreaterThan(250);
  });

  it("rechaza lo que no es imagen y lo que pasa los 60 megapíxeles", async () => {
    await expect(leerOriginal(Buffer.from("hola"))).rejects.toMatchObject({ definitivo: true });
    const enorme = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(leerOriginal(enorme)).rejects.toMatchObject({ definitivo: true });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/impresion/render.test.ts`
Expected: FAIL (no existe `render.ts`).

- [ ] **Step 3: Implementar `lib/impresion/render.ts`**

```ts
import "server-only";
import sharp from "sharp";
import { aplicarAjustes } from "./ajustes";
import { cajaRotada, rectanguloEnPixeles } from "./geometria";
import type { Nitidez } from "./medidas";
import type { DisposicionCarnet } from "./plancha";
import { anguloTotal, type Receta } from "./receta";

/**
 * El motor: del original al JPG que se imprime. Lo que se corrige respecto del editor de
 * CompraMeLaFoto (spec §3.1): no hay desenfoque, se achica con Lanczos desde el original y el
 * perfil de color se convierte a sRGB en vez de perderse. Los ajustes van en 16 bits.
 * De a una imagen por llamada y sin caché: la memoria de la función es limitada.
 */
sharp.cache(false);
sharp.concurrency(1);

export const MAX_PIXELES_ORIGINAL = 60_000_000;
export const LADO_VISTA_PREVIA = 1600;
const FORMATOS = new Set(["jpeg", "png", "webp", "heif"]);
const BLANCO = { r: 255, g: 255, b: 255 };
const SIGMA: Record<Nitidez, number> = { SUAVE: 0.5, NORMAL: 0.8, FUERTE: 1.1 };

export class ImagenNoProcesable extends Error {
  constructor(message: string, readonly definitivo: boolean) {
    super(message);
  }
}

const esLimite = (e: unknown) => e instanceof Error && /pixel limit/i.test(e.message);

function abrir(buf: Buffer) {
  return sharp(buf, { limitInputPixels: MAX_PIXELES_ORIGINAL, failOn: "error" });
}

export async function leerOriginal(buf: Buffer): Promise<{ ancho: number; alto: number; perfilColor: string | null; formato: string }> {
  let meta: sharp.Metadata;
  try {
    meta = await abrir(buf).metadata();
  } catch (e) {
    if (esLimite(e)) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
    throw new ImagenNoProcesable("El archivo no es una imagen que se pueda abrir. Probá con un JPG.", true);
  }
  if (!meta.format || !FORMATOS.has(meta.format)) throw new ImagenNoProcesable("La foto tiene que ser JPG, PNG o WebP. Convertí la foto a JPG.", true);
  if (!meta.width || !meta.height) throw new ImagenNoProcesable("No se pudo leer el tamaño de la foto.", true);
  if (meta.width * meta.height > MAX_PIXELES_ORIGINAL) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
  const girada = (meta.orientation ?? 1) >= 5;
  return {
    ancho: girada ? meta.height : meta.width,
    alto: girada ? meta.width : meta.height,
    perfilColor: meta.icc ? describirPerfil(meta.icc) : null,
    formato: meta.format,
  };
}

/** El nombre del perfil está en la etiqueta 'desc' del ICC; si no se entiende, "Embebido". */
function describirPerfil(icc: Buffer): string {
  const i = icc.indexOf("desc");
  if (i < 0) return "Embebido";
  const texto = icc.subarray(i + 12, i + 80).toString("latin1").replace(/[^\x20-\x7e]/g, "").trim();
  return texto.slice(0, 40) || "Embebido";
}

export async function generarVistaPrevia(buf: Buffer): Promise<{ jpg: Buffer; ancho: number; alto: number }> {
  try {
    const { data, info } = await abrir(buf)
      .autoOrient()
      .flatten({ background: BLANCO })
      .resize({ width: LADO_VISTA_PREVIA, height: LADO_VISTA_PREVIA, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .toColourspace("srgb")
      .jpeg({ quality: 88 })
      .withIccProfile("srgb")
      .toBuffer({ resolveWithObject: true });
    return { jpg: data, ancho: info.width, alto: info.height };
  } catch (e) {
    if (esLimite(e)) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
    throw new ImagenNoProcesable("No se pudo preparar la vista previa.", false);
  }
}

export type PiezaRaw = { data: Buffer; ancho: number; alto: number };

export async function renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw> {
  const info = await leerOriginal(original);
  const angulo = anguloTotal(receta);
  const caja = cajaRotada(info.ancho, info.alto, angulo);
  const rect = rectanguloEnPixeles(receta.encuadre, caja, angulo % 90 === 0 ? 0 : 2);

  // 1-4: derecha, a sRGB (sharp usa el perfil embebido), girada, recortada y llevada a la medida exacta.
  let p = abrir(original).autoOrient().flatten({ background: BLANCO });
  if (angulo !== 0) p = p.rotate(angulo, { background: BLANCO });
  const { data: crudo16, info: i16 } = await p
    .extract(rect)
    .resize(destino.ancho, destino.alto, { fit: "fill", kernel: "lanczos3" })
    .pipelineColourspace("rgb16")
    .toColourspace("rgb16")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (i16.channels !== 3) throw new ImagenNoProcesable("La foto tiene un formato de color que no se puede imprimir.", true);

  // 5: ajustes en 16 bits (la misma función que la vista previa).
  const u16 = new Uint16Array(crudo16.buffer, crudo16.byteOffset, crudo16.length / 2);
  aplicarAjustes(u16, 3, receta.ajustes);

  // 6: a 8 bits y nitidez de salida.
  const { data, info: i8 } = await sharp(u16, { raw: { width: i16.width, height: i16.height, channels: 3 } })
    .toColourspace("srgb")
    .sharpen({ sigma: SIGMA[receta.nitidez ?? nitidez] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, ancho: i8.width, alto: i8.height };
}

function franja(ancho: number, alto: number): Buffer {
  return Buffer.alloc(ancho * alto * 3, 0xc8);
}

export async function componerHoja(
  hoja: { ancho: number; alto: number },
  pieza: PiezaRaw,
  disp: Pick<DisposicionCarnet, "posiciones" | "lineas">,
  ppp: number,
  conLineas: boolean,
): Promise<Buffer> {
  const capas: sharp.OverlayOptions[] = [];
  if (conLineas) {
    for (const x of disp.lineas.xs) capas.push({ input: franja(1, hoja.alto), raw: { width: 1, height: hoja.alto, channels: 3 }, left: x, top: 0 });
    for (const y of disp.lineas.ys) capas.push({ input: franja(hoja.ancho, 1), raw: { width: hoja.ancho, height: 1, channels: 3 }, left: 0, top: y });
  }
  for (const pos of disp.posiciones) {
    capas.push({ input: pieza.data, raw: { width: pieza.ancho, height: pieza.alto, channels: 3 }, left: pos.left, top: pos.top });
  }
  return sharp({ create: { width: hoja.ancho, height: hoja.alto, channels: 3, background: BLANCO } })
    .composite(capas)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withIccProfile("srgb")
    .withMetadata({ density: ppp })
    .toBuffer();
}
```

Notas para quien implementa:
- Las líneas van **antes** que las fotos en `capas`: así la foto tapa la línea y la línea sólo se ve en el borde de corte.
- Si la prueba "convierte P3 a sRGB" falla, mirar en la salida de `sharp.versions` que `lcms` esté presente y probar quitando `.pipelineColourspace("rgb16")` (dejando sólo `.toColourspace("rgb16")`). Es el único punto del motor que depende de cómo `sharp` encadena la conversión de perfil. No dar la tarea por terminada con esa prueba en rojo.
- Si `withMetadata({ density })` y `withIccProfile("srgb")` se pisan en la versión instalada (la prueba de la hoja lo detecta), poner `withMetadata({ density: ppp, icc: "srgb" })` en su lugar.

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter fotoffice test -- lib/impresion/render.test.ts`
Expected: PASS (las 10 pruebas).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/render.ts apps/fotoffice/lib/impresion/render.test.ts
git commit -m "Impresión: motor de archivos finales con perfil de color, Lanczos y 16 bits"
```

---

### Task 7: Lo que se ve es lo que sale (prueba de coincidencia)

**Files:**
- Test: `lib/impresion/coincidencia.test.ts`

**Interfaces:**
- Consumes: `generarVistaPrevia`, `renderizarPieza` (Task 6); `aplicarAjustes`, `AJUSTES_NEUTROS` (Task 4); `recetaInicial` (Task 5).

- [ ] **Step 1: Escribir la prueba**

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, aplicarAjustes, type Ajustes } from "./ajustes";
import { recetaInicial } from "./receta";
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

async function deltaPromedio(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  const final = await renderizarPieza(original, { ...recetaInicial(), ajustes }, { ancho: 600, alto: 400 }, "SUAVE");
  // La vista previa como la arma el navegador: la vista previa del servidor + aplicarAjustes en 8 bits.
  const vista = await generarVistaPrevia(original);
  const { data } = await sharp(vista.jpg).resize(600, 400, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  const a = zonas(final.data, 600, 400).map(aLab);
  const b = zonas(ocho, 600, 400).map(aLab);
  return a.reduce((acc, la, i) => acc + Math.hypot(la[0] - b[i]![0], la[1] - b[i]![1], la[2] - b[i]![2]), 0) / a.length;
}

describe("vista previa contra archivo final", () => {
  it("sin ajustes, la diferencia promedio es menor a 2 (ΔE)", async () => {
    expect(await deltaPromedio(AJUSTES_NEUTROS)).toBeLessThan(2);
  });
  it("con ajustes fuertes, también", async () => {
    expect(await deltaPromedio({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40, sombras: 30 })).toBeLessThan(2);
  });
});
```

- [ ] **Step 2: Correr**

Run: `pnpm --filter fotoffice test -- lib/impresion/coincidencia.test.ts`
Expected: PASS. Si falla, **no** subir el umbral: buscar la diferencia de orden de operaciones entre `renderizarPieza` y la vista previa (el orden tiene que ser recortar → achicar → ajustar en los dos).

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/lib/impresion/coincidencia.test.ts
git commit -m "Impresión: prueba de que la vista previa coincide con el archivo final"
```

---

### Task 8: Almacén R2 de impresión

**Files:**
- Create: `lib/impresion/almacen.ts`
- Test: `lib/impresion/almacen.test.ts` (sólo lo puro: claves)

**Interfaces:**
- Consumes: `clienteR2Privado`, `bucketR2Privado`, `esNoEncontrado` de `lib/ficha/adjuntos-r2.ts`; `urlDeSubidaArchivo`, `urlDeLecturaArchivo`, `tamanoDeArchivo`, `borrarArchivoGuardado` de `lib/carpetas/almacen.ts`.
- Produces:
  - `MAX_BYTES_ORIGINAL = 60 * 1024 * 1024`, `TIPOS_ORIGINAL: readonly string[]`
  - `claveImpresion(workspaceId: string, preparacionId: string, tipo: "original" | "vista" | "final", id: string, ext: string): string`
  - `urlDeSubidaOriginal(clave: string, tipo: string, bytes: number): Promise<string>`
  - `leerObjeto(clave: string): Promise<Buffer>`
  - `guardarObjeto(clave: string, cuerpo: Buffer, tipo: string): Promise<void>`
  - `copiarObjeto(origen: string, destino: string): Promise<void>`
  - re-exporta `tamanoDeArchivo as tamanoDeObjeto`, `borrarArchivoGuardado as borrarObjetoImpresion`, `urlDeLecturaArchivo`

- [ ] **Step 1: Prueba que falla**

```ts
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));
const { claveImpresion } = await import("./almacen");

describe("claves de impresión", () => {
  it("arma la ruta por workspace, preparación y tipo", () => {
    expect(claveImpresion("ws1", "prep1", "original", "abc", "jpg")).toBe("fotoffice/impresion/ws1/prep1/original/abc.jpg");
  });
  it("no deja meter rutas en los ids", () => {
    expect(() => claveImpresion("ws1", "../x", "final", "abc", "jpg")).toThrow();
    expect(() => claveImpresion("ws1", "p", "final", "a/b", "jpg")).toThrow();
    expect(() => claveImpresion("ws1", "p", "final", "a", "j/pg")).toThrow();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/impresion/almacen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import "server-only";
import { CopyObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { borrarArchivoGuardado, tamanoDeArchivo, urlDeLecturaArchivo, urlDeSubidaArchivo } from "@/lib/carpetas/almacen";

/** Originales, vistas previas y finales de impresión, en el bucket privado de FOTOFFICE. */

export const MAX_BYTES_ORIGINAL = 60 * 1024 * 1024;
export const TIPOS_ORIGINAL = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

const SEGURO = /^[A-Za-z0-9_-]{1,64}$/;

export function claveImpresion(workspaceId: string, preparacionId: string, tipo: "original" | "vista" | "final", id: string, ext: string): string {
  for (const parte of [workspaceId, preparacionId, id]) if (!SEGURO.test(parte)) throw new Error("Parte de clave inválida");
  if (!/^[a-z0-9]{2,5}$/.test(ext)) throw new Error("Extensión inválida");
  return `fotoffice/impresion/${workspaceId}/${preparacionId}/${tipo}/${id}.${ext}`;
}

export async function urlDeSubidaOriginal(clave: string, tipo: string, bytes: number): Promise<string> {
  if (!(TIPOS_ORIGINAL as readonly string[]).includes(tipo)) throw new Error("Tipo no permitido");
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES_ORIGINAL) throw new Error("Tamaño no permitido");
  return urlDeSubidaArchivo(clave, tipo, bytes);
}

export async function leerObjeto(clave: string): Promise<Buffer> {
  const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
  if (!r.Body) throw new Error("Objeto vacío");
  return Buffer.from(await r.Body.transformToByteArray());
}

export async function guardarObjeto(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
  await clienteR2Privado().send(new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, Body: cuerpo, ContentType: tipo, ContentLength: cuerpo.length }));
}

export async function copiarObjeto(origen: string, destino: string): Promise<void> {
  const b = bucketR2Privado();
  await clienteR2Privado().send(new CopyObjectCommand({ Bucket: b, Key: destino, CopySource: `${b}/${encodeURI(origen)}` }));
}

export { tamanoDeArchivo as tamanoDeObjeto, borrarArchivoGuardado as borrarObjetoImpresion, urlDeLecturaArchivo };
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice test -- lib/impresion/almacen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/impresion/almacen.ts apps/fotoffice/lib/impresion/almacen.test.ts
git commit -m "Impresión: almacén de originales, vistas y finales en R2 privado"
```

---

### Task 9: Configuración — tamaños, salidas, escala y "Se produce en el local"

**Files:**
- Create: `lib/impresion/configuracion.ts`
- Test: `lib/impresion/configuracion.test.ts`
- Create: `app/(shell)/ventas/impresion/actions.ts` (acciones de configuración; las de preparación se suman en Task 10)
- Create: `app/(shell)/ventas/impresion/configuracion/page.tsx`
- Create: `app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx`
- Modify: `app/(shell)/ventas/catalogo/[productId]/page.tsx` (montar la sección)

**Interfaces:**
- Consumes: `TAMANOS_INICIALES`, `SALIDAS_INICIALES`, `escalaDesdeRegla`, `Nitidez` (Task 3).
- Produces:
  - `type TamanoVista = { id: string; nombre: string; anchoMm: number; altoMm: number }`
  - `type SalidaVista = { id: string; nombre: string; tipo: "LOCAL" | "LABORATORIO"; ppp: number; nitidez: Nitidez; escalaXMil: number; escalaYMil: number; admiteCopias: boolean; tamanos: TamanoVista[] }`
  - `type ProduccionVista = { tipoPieza: "COPIA" | "CARNET" | "POLAROID"; salidaId: string; tamanoHojaId: string; unidad: "HOJA" | "COPIA" | "PIEZA" }`
  - `asegurarConfiguracion(workspaceId: string): Promise<void>` (idempotente: crea los iniciales si no hay ningún tamaño)
  - `listarSalidas(workspaceId: string): Promise<SalidaVista[]>` (activas, con sus tamaños activos, por nombre)
  - `guardarEscala(workspaceId: string, salidaId: string, medidaXmm: number, medidaYmm: number): Promise<{ ok: true } | { ok: false; error: string }>`
  - `leerProduccion(workspaceId: string, productId: string): Promise<ProduccionVista | null>`
  - `guardarProduccion(workspaceId: string, productId: string, datos: ProduccionVista | null): Promise<{ ok: true } | { ok: false; error: string }>` (null = deja de producirse)
  - `produccionDeProductos(workspaceId: string): Promise<Record<string, { tipoPieza: ProduccionVista["tipoPieza"] }>>`

- [ ] **Step 1: Pruebas que fallan**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
const C = await import("./configuracion");

describe("configuración de impresión", () => {
  beforeEach(() => {
    B.limpiar?.();
    B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
    B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "Otro", priceArs: "1", isActive: true });
  });

  it("crea las dos impresoras y los siete tamaños una sola vez", async () => {
    await C.asegurarConfiguracion("ws-1");
    await C.asegurarConfiguracion("ws-1");
    const salidas = await C.listarSalidas("ws-1");
    expect(salidas.map((s) => s.nombre)).toEqual(["Epson L800", "Kodak 305"]);
    expect(salidas.find((s) => s.nombre === "Kodak 305")!.tamanos.map((t) => t.nombre)).toEqual(["10x15", "13x18", "15x20"]);
  });

  it("la escala sale de lo que midió la regla y rechaza medidas absurdas", async () => {
    await C.asegurarConfiguracion("ws-1");
    const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
    expect(await C.guardarEscala("ws-1", kodak.id, 99, 100)).toEqual({ ok: true });
    const otra = (await C.listarSalidas("ws-1")).find((s) => s.id === kodak.id)!;
    expect([otra.escalaXMil, otra.escalaYMil]).toEqual([1010, 1000]);
    expect((await C.guardarEscala("ws-1", kodak.id, 50, 100)).ok).toBe(false);
    expect((await C.guardarEscala("ws-2", kodak.id, 99, 100)).ok).toBe(false);
  });

  it("un carnet en la Kodak usa hoja 10x15; la Epson no acepta copias; otro negocio no puede", async () => {
    await C.asegurarConfiguracion("ws-1");
    const s = await C.listarSalidas("ws-1");
    const kodak = s.find((x) => x.nombre === "Kodak 305")!;
    const epson = s.find((x) => x.nombre === "Epson L800")!;
    const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!;
    expect(await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10.id, unidad: "HOJA" })).toEqual({ ok: true });
    expect(await C.leerProduccion("ws-1", "carnet")).toMatchObject({ tipoPieza: "CARNET", salidaId: kodak.id });
    expect((await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "COPIA", salidaId: epson.id, tamanoHojaId: t10.id, unidad: "COPIA" })).ok).toBe(false);
    const a4 = epson.tamanos.find((t) => t.nombre === "A4")!;
    expect((await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: a4.id, unidad: "HOJA" })).ok).toBe(false);
    expect((await C.guardarProduccion("ws-2", "ajeno", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10.id, unidad: "HOJA" })).ok).toBe(false);
    expect(await C.produccionDeProductos("ws-1")).toEqual({ carnet: { tipoPieza: "CARNET" } });
    expect(await C.guardarProduccion("ws-1", "carnet", null)).toEqual({ ok: true });
    expect(await C.leerProduccion("ws-1", "carnet")).toBeNull();
  });
});
```

(Si la base en memoria no tiene `limpiar`, crear una base nueva por prueba con `crearBaseEnMemoria()` en un `beforeEach`, como hacen otras pruebas del repo.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/impresion/configuracion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/impresion/configuracion.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { SALIDAS_INICIALES, TAMANOS_INICIALES, escalaDesdeRegla, type Nitidez } from "./medidas";

export type TamanoVista = { id: string; nombre: string; anchoMm: number; altoMm: number };
export type SalidaVista = {
  id: string; nombre: string; tipo: "LOCAL" | "LABORATORIO"; ppp: number; nitidez: Nitidez;
  escalaXMil: number; escalaYMil: number; admiteCopias: boolean; tamanos: TamanoVista[];
};
export type ProduccionVista = { tipoPieza: "COPIA" | "CARNET" | "POLAROID"; salidaId: string; tamanoHojaId: string; unidad: "HOJA" | "COPIA" | "PIEZA" };
type R = { ok: true } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const TIPOS = new Set(["COPIA", "CARNET", "POLAROID"]);
const UNIDADES = new Set(["HOJA", "COPIA", "PIEZA"]);

/** La primera vez que se usa Impresión en un negocio: las dos impresoras de DNX y los tamaños reales. */
export async function asegurarConfiguracion(workspaceId: string): Promise<void> {
  const hay = await prisma.fotofficeTamanoImpresion.count({ where: { workspaceId } });
  if (hay > 0) return;
  await prisma.$transaction(async (tx) => {
    if ((await tx.fotofficeTamanoImpresion.count({ where: { workspaceId } })) > 0) return;
    const ids = new Map<string, string>();
    for (const t of TAMANOS_INICIALES) {
      const c = await tx.fotofficeTamanoImpresion.create({ data: { workspaceId, nombre: t.nombre, anchoMm: t.anchoMm, altoMm: t.altoMm, orden: t.orden }, select: { id: true } });
      ids.set(t.nombre, c.id);
    }
    for (const s of SALIDAS_INICIALES) {
      const c = await tx.fotofficeSalidaImpresion.create({
        data: { workspaceId, nombre: s.nombre, tipo: "LOCAL", ppp: s.ppp, nitidez: s.nitidez, admiteCopias: s.admiteCopias },
        select: { id: true },
      });
      for (const n of s.tamanos) await tx.fotofficeSalidaTamano.create({ data: { salidaId: c.id, tamanoId: ids.get(n)! } });
    }
  });
}

export async function listarSalidas(workspaceId: string): Promise<SalidaVista[]> {
  const [salidas, tamanos] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findMany({
      where: { workspaceId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true, ppp: true, nitidez: true, escalaXMil: true, escalaYMil: true, admiteCopias: true },
    }),
    prisma.fotofficeTamanoImpresion.findMany({
      where: { workspaceId, activo: true },
      orderBy: { orden: "asc" },
      select: { id: true, nombre: true, anchoMm: true, altoMm: true },
    }),
  ]);
  const puentes = await prisma.fotofficeSalidaTamano.findMany({ where: { salidaId: { in: salidas.map((s) => s.id) } }, select: { salidaId: true, tamanoId: true } });
  const porId = new Map(tamanos.map((t) => [t.id, { id: t.id, nombre: t.nombre, anchoMm: Number(t.anchoMm), altoMm: Number(t.altoMm) }]));
  return salidas.map((s) => ({
    ...s,
    tipo: s.tipo as SalidaVista["tipo"],
    nitidez: s.nitidez as Nitidez,
    tamanos: tamanos.filter((t) => puentes.some((p) => p.salidaId === s.id && p.tamanoId === t.id)).map((t) => porId.get(t.id)!),
  }));
}

export async function guardarEscala(workspaceId: string, salidaId: string, medidaXmm: number, medidaYmm: number): Promise<R> {
  if (!ID.test(salidaId)) return { ok: false, error: "Esa impresora no existe." };
  const x = escalaDesdeRegla(medidaXmm);
  const y = escalaDesdeRegla(medidaYmm);
  if (x === null || y === null) return { ok: false, error: "La regla tiene que medir entre 90 y 110 mm. Volvé a medirla." };
  const r = await prisma.fotofficeSalidaImpresion.updateMany({ where: { id: salidaId, workspaceId }, data: { escalaXMil: x, escalaYMil: y } });
  return r.count === 1 ? { ok: true } : { ok: false, error: "Esa impresora no existe." };
}

export async function leerProduccion(workspaceId: string, productId: string): Promise<ProduccionVista | null> {
  const p = await prisma.fotofficeProductoProduccion.findFirst({ where: { workspaceId, productId }, select: { tipoPieza: true, salidaId: true, tamanoHojaId: true, unidad: true } });
  return p ? (p as ProduccionVista) : null;
}

export async function guardarProduccion(workspaceId: string, productId: string, datos: ProduccionVista | null): Promise<R> {
  if (!ID.test(productId)) return { ok: false, error: "Ese producto no existe." };
  const producto = await prisma.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } });
  if (!producto) return { ok: false, error: "Ese producto no existe." };
  if (datos === null) {
    await prisma.fotofficeProductoProduccion.deleteMany({ where: { workspaceId, productId } });
    return { ok: true };
  }
  if (!TIPOS.has(datos.tipoPieza) || !UNIDADES.has(datos.unidad) || !ID.test(datos.salidaId) || !ID.test(datos.tamanoHojaId)) {
    return { ok: false, error: "Faltan datos de producción." };
  }
  const salida = await prisma.fotofficeSalidaImpresion.findFirst({ where: { id: datos.salidaId, workspaceId, activo: true }, select: { id: true, admiteCopias: true, nombre: true } });
  if (!salida) return { ok: false, error: "Esa impresora no existe." };
  if (datos.tipoPieza === "COPIA" && !salida.admiteCopias) return { ok: false, error: `${salida.nombre} no hace copias fotográficas.` };
  const admite = await prisma.fotofficeSalidaTamano.count({ where: { salidaId: salida.id, tamanoId: datos.tamanoHojaId } });
  if (admite === 0) return { ok: false, error: `${salida.nombre} no imprime en esa hoja.` };
  const existente = await prisma.fotofficeProductoProduccion.findFirst({ where: { workspaceId, productId }, select: { id: true } });
  if (existente) await prisma.fotofficeProductoProduccion.update({ where: { id: existente.id }, data: { ...datos } });
  else await prisma.fotofficeProductoProduccion.create({ data: { workspaceId, productId, ...datos } });
  return { ok: true };
}

export async function produccionDeProductos(workspaceId: string): Promise<Record<string, { tipoPieza: ProduccionVista["tipoPieza"] }>> {
  const filas = await prisma.fotofficeProductoProduccion.findMany({ where: { workspaceId }, select: { productId: true, tipoPieza: true } });
  return Object.fromEntries(filas.map((f) => [f.productId, { tipoPieza: f.tipoPieza as ProduccionVista["tipoPieza"] }]));
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter fotoffice test -- lib/impresion/configuracion.test.ts`
Expected: PASS.

- [ ] **Step 5: Acciones y pantallas**

`app/(shell)/ventas/impresion/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/sales/access";
import { guardarEscala, guardarProduccion, type ProduccionVista } from "@/lib/impresion/configuracion";

export async function guardarEscalaAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const salidaId = String(formData.get("salidaId") ?? "");
  const r = await guardarEscala(workspace.id, salidaId, Number(String(formData.get("x")).replace(",", ".")), Number(String(formData.get("y")).replace(",", ".")));
  revalidatePath("/ventas/impresion/configuracion");
  redirect(`/ventas/impresion/configuracion?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}

export async function guardarProduccionAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const productId = String(formData.get("productId") ?? "");
  const activo = formData.get("activo") === "on";
  const datos: ProduccionVista | null = activo
    ? {
        tipoPieza: String(formData.get("tipoPieza")) as ProduccionVista["tipoPieza"],
        salidaId: String(formData.get("salidaId")),
        tamanoHojaId: String(formData.get("tamanoHojaId")),
        unidad: String(formData.get("unidad")) as ProduccionVista["unidad"],
      }
    : null;
  const r = await guardarProduccion(workspace.id, productId, datos);
  revalidatePath(`/ventas/catalogo/${productId}`);
  redirect(`/ventas/catalogo/${productId}?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}
```

`app/(shell)/ventas/impresion/configuracion/page.tsx` (server component, sigue el estilo de `app/workspace/configuracion/proveedores/page.tsx`):

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { asegurarConfiguracion, listarSalidas } from "@/lib/impresion/configuracion";
import { guardarEscalaAction } from "../actions";

export const dynamic = "force-dynamic";

/** Las impresoras del local: qué hojas imprimen y la corrección de escala medida con la hoja de prueba. */
export default async function ImpresionConfiguracionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace } = await requireSalesAdmin();
  const q = await searchParams;
  await asegurarConfiguracion(workspace.id);
  const salidas = await listarSalidas(workspace.id);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Impresión" description="Las impresoras del local, sus hojas y la prueba de medida." />
      {q.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">{q.error}</p> : null}
      {q.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      {salidas.map((s) => (
        <section key={s.id} className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">{s.nombre}</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {s.ppp} ppp · hojas: {s.tamanos.map((t) => t.nombre).join(", ")}
            {s.admiteCopias ? "" : " · sólo carnet, planchas e impresiones color (no copias fotográficas)"}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>En el cuadro de impresión de esta impresora dejá fijo: el papel de la hoja, «sin bordes», escala 100 % y calidad máxima.</li>
            <li>
              Imprimí la{" "}
              {s.tamanos.map((t, i) => (
                <span key={t.id}>
                  {i > 0 ? " · " : ""}
                  <Link className="underline" href={`/imprimir/prueba/${s.id}?tamano=${t.id}`} target="_blank">
                    hoja de prueba {t.nombre}
                  </Link>
                </span>
              ))}
              .
            </li>
            <li>Medí con una regla las dos líneas de 100 mm y anotá lo que miden.</li>
          </ol>
          <form action={guardarEscalaAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="salidaId" value={s.id} />
            <label className="text-sm">
              Horizontal (mm)
              <input name="x" required inputMode="decimal" defaultValue={(100000 / s.escalaXMil).toFixed(1).replace(".", ",")} className="fo-input mt-1 w-28" />
            </label>
            <label className="text-sm">
              Vertical (mm)
              <input name="y" required inputMode="decimal" defaultValue={(100000 / s.escalaYMil).toFixed(1).replace(".", ",")} className="fo-input mt-1 w-28" />
            </label>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar medida</button>
          </form>
        </section>
      ))}
    </div>
  );
}
```

`app/(shell)/ventas/catalogo/[productId]/produccion-section.tsx`:

```tsx
import type { ProduccionVista, SalidaVista } from "@/lib/impresion/configuracion";
import { guardarProduccionAction } from "../../impresion/actions";

/** "Se produce en el local": qué pieza es, por qué impresora sale y qué hoja gasta. */
export function ProduccionSection({ productId, produccion, salidas }: { productId: string; produccion: ProduccionVista | null; salidas: SalidaVista[] }) {
  return (
    <form action={guardarProduccionAction} className="fo-card space-y-3 p-5">
      <input type="hidden" name="productId" value={productId} />
      <h2 className="text-base font-semibold">Producción en el local</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={produccion !== null} /> Se produce en el local (carnet, copias instantáneas)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Qué es
          <select name="tipoPieza" defaultValue={produccion?.tipoPieza ?? "CARNET"} className="fo-input mt-1">
            <option value="CARNET">Foto carnet</option>
            <option value="COPIA">Copia</option>
            <option value="POLAROID">Polaroid</option>
          </select>
        </label>
        <label className="text-sm">Se cobra por
          <select name="unidad" defaultValue={produccion?.unidad ?? "HOJA"} className="fo-input mt-1">
            <option value="HOJA">Hoja / plancha</option>
            <option value="COPIA">Copia</option>
            <option value="PIEZA">Pieza</option>
          </select>
        </label>
        <label className="text-sm">Impresora
          <select name="salidaId" defaultValue={produccion?.salidaId ?? salidas[0]?.id} className="fo-input mt-1">
            {salidas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">Hoja que gasta
          <select name="tamanoHojaId" defaultValue={produccion?.tamanoHojaId} className="fo-input mt-1">
            {salidas.flatMap((s) => s.tamanos.map((t) => <option key={`${s.id}-${t.id}`} value={t.id}>{s.nombre} · {t.nombre}</option>))}
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">Ejemplo: «Foto carnet» en la Kodak 305 con hoja 10x15, y «Foto carnet económica» en la Epson L800. Así cada uno registra lo que gasta en su impresora.</p>
      <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar producción</button>
    </form>
  );
}
```

En `app/(shell)/ventas/catalogo/[productId]/page.tsx`: importar `asegurarConfiguracion`, `leerProduccion`, `listarSalidas` y `ProduccionSection`; después de `if (!producto) notFound();` agregar:

```ts
  await asegurarConfiguracion(workspace.id);
  const [produccion, salidasImpresion] = await Promise.all([leerProduccion(workspace.id, producto.id), listarSalidas(workspace.id)]);
```

y renderizar `<ProduccionSection productId={producto.id} produccion={produccion} salidas={salidasImpresion} />` debajo del formulario del producto (antes de las secciones de tienda/presupuestos).

- [ ] **Step 6: Typecheck y pruebas**

Run: `pnpm --filter fotoffice test -- lib/impresion && pnpm --filter fotoffice typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/impresion/configuracion.ts apps/fotoffice/lib/impresion/configuracion.test.ts "apps/fotoffice/app/(shell)/ventas/impresion" "apps/fotoffice/app/(shell)/ventas/catalogo/[productId]"
git commit -m "Impresión: configuración de impresoras y producción del producto en el local"
```

---

### Task 10: Preparaciones — originales, pieza de carnet, hoja, registro, colas, vínculo con la venta y purga

**Files:**
- Create: `lib/impresion/preparaciones.ts`
- Test: `lib/impresion/preparaciones.test.ts`
- Modify: `app/(shell)/ventas/impresion/actions.ts` (acciones de preparación)

**Interfaces:**
- Consumes: Tasks 3–9.
- Produces:
  - `type CtxImpresion = { workspaceId: string; userId: number; userLabel: string }`
  - `type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string }`
  - `crearPreparacion(ctx, d: { productId: string | null; clientId: string | null }): Promise<R<{ id: string }>>`
  - `pedirSubidaOriginal(ctx, preparacionId: string, a: { nombre: string; tipo: string; bytes: number }): Promise<R<{ originalId: string; url: string }>>`
  - `confirmarOriginal(ctx, originalId: string): Promise<R<{ originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number }>>`
  - `guardarPiezaCarnet(ctx, preparacionId: string, d: { originalId: string; anchoMm: number; altoMm: number; receta: unknown }): Promise<R<{ piezaId: string; ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" }>>`
  - `generarHojaCarnet(ctx, preparacionId: string, d: { salidaId: string | null; tamanoId: string | null; fotos: number | null; copias: number; conLineas: boolean }): Promise<R<{ hojaId: string; fotosPorHoja: number }>>`
  - `registrarImpresion(ctx, hojaId: string, d: { motivo: "NORMAL" | "DESCARTADA"; hojas: number }): Promise<R>`
  - `registrarPrueba(ctx, salidaId: string, tamanoId: string): Promise<R>`
  - `anularPreparacion(ctx, preparacionId: string): Promise<R>`
  - `class PreparacionNoVinculable extends Error`
  - `validarParaCobrar(workspaceId: string, items: { preparacionId: string; productId: string | null }[]): Promise<R>`
  - `vincularConVenta(tx: Prisma.TransactionClient, workspaceId: string, pares: { preparacionId: string; saleItemId: string }[], clientId: string | null): Promise<void>`
  - `type FilaCola = { preparacionId: string; producto: string | null; cliente: string | null; estado: string; hojaId: string | null; creada: string }`
  - `colas(workspaceId: string, ahora: Date): Promise<{ paraImprimir: FilaCola[]; sinCobrar: FilaCola[]; impresoHoy: { registroId: string; salida: string; tamano: string; hojas: number; motivo: string; hora: string; hojaId: string | null }[] }>`
  - `datosParaImprimir(workspaceId: string, hojaId: string): Promise<{ finalKey: string; anchoMm: number; altoMm: number; escalaXMil: number; escalaYMil: number; copias: number; salida: string; tamano: string } | null>`
  - `purgarPreparaciones(ahora: Date, tope?: number): Promise<number>`
  - constantes `DIAS_PREPARACION = 30`

Reglas que implementa (cada una con su prueba):
1. Todo filtra por `workspaceId`; ids con `/^[A-Za-z0-9_-]{1,64}$/`.
2. `crearPreparacion`: si viene `productId`, tiene que tener producción y ser `CARNET` (etapa 1). `clientId` ajeno → se ignora (queda null).
3. `pedirSubidaOriginal`: preparación no `ANULADA`; tipo en `TIPOS_ORIGINAL`; bytes ≤ `MAX_BYTES_ORIGINAL`; crea el original `PENDIENTE` con `claveImpresion(..., "original", id, ext)`.
4. `confirmarOriginal`: tamaño real en R2 = declarado (si no, borra objeto y fila); `leerOriginal`; guarda vista previa (`claveImpresion(..., "vista", id, "jpg")`); marca `LISTO` con medidas y perfil. Si `leerOriginal` lanza `ImagenNoProcesable`, borra objeto y fila y devuelve su mensaje.
5. `guardarPiezaCarnet`: original `LISTO` de esa preparación; `validarReceta` ≠ null; medida entre 20 y 100 mm por lado; reemplaza la pieza CARNET anterior (una por preparación en la etapa 1); `huella = huellaDe({ receta, originalKey, anchoMm, altoMm })`; borra las hojas de la preparación que **no** tengan registros (y sus finales en R2); estado → `PREPARANDO`. Devuelve la resolución efectiva (`resolucionEfectiva(rectanguloEnPixeles(encuadre, cajaRotada(anchoPx, altoPx, ángulo)), medida)`) y su aviso.
6. `generarHojaCarnet`: la salida y la hoja salen de la producción del producto; sin producto (pantalla suelta) se usan `d.salidaId`/`d.tamanoId`, que tienen que existir, ser del workspace y la salida admitir la hoja. `disposicionCarnet(medida, hoja, ppp, fotos ?? undefined)`. `finalHuella = huellaDe({ pieza: huella, salidaId, tamanoId, ppp, nitidez, fotos: posiciones.length, conLineas })`: si la hoja existente tiene esa huella y `finalKey`, sólo actualiza `copias`. Si no: `leerObjeto(original.key)` → `renderizarPieza(…, disp.pieza, salida.nitidez)` → `componerHoja` → `guardarObjeto(claveImpresion(..., "final", hojaId, "jpg"), jpg, "image/jpeg")`; borra el final anterior. `copias` entre 1 y 50. Estado → `LISTA`.
7. `registrarImpresion`: hoja del workspace con `finalKey`; `hojas` entre 1 y 100; crea el registro con `salidaId`, `tamanoId`, `productId`, `saleItemId`, `proyectoId` de la preparación; `NORMAL` → estado `IMPRESA`.
8. `validarParaCobrar`: cada preparación existe en el workspace, no está `ANULADA`, `saleItemId` es null, y su `productId` coincide con el del renglón. Ids repetidos en el mismo ticket → error.
9. `vincularConVenta` (dentro de la transacción de la venta): `updateMany where { id, workspaceId, saleItemId: null, estado: { not: "ANULADA" } }` → `{ saleItemId, clientId: (clientId de la preparación ?? clientId de la venta) }`. Si `count !== 1` → `throw new PreparacionNoVinculable()` (deshace la venta entera).
10. `colas`: `paraImprimir` = `saleItemId` no null y estado en `PREPARANDO | LISTA`; `sinCobrar` = `saleItemId` null y estado en `PREPARANDO | LISTA | IMPRESA`; `impresoHoy` = registros desde las 00:00 de hoy **en Argentina** (UTC−3) hasta `ahora`.
11. `purgarPreparaciones`: preparaciones con `createdAt < ahora − 30 días`, y originales `PENDIENTE` con más de 24 h: borra de R2 los originales (salvo los que tienen `archivoTrabajoId`), las vistas y los finales; borra las filas (en cascada). Los registros quedan con `hojaId = null`. Si un objeto falla, sigue con los demás. Devuelve cuántas preparaciones borró.

- [ ] **Step 1: Pruebas que fallan**

`lib/impresion/preparaciones.test.ts` — R2 simulado con un `Map`, el motor real (sharp) con fotos chicas:

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
const { recetaInicial } = await import("./receta");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro" };
let kodakId = "", t10 = "";

async function jpg(ancho = 1200, alto = 1600) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
/** Crea preparación + original LISTO, como lo dejaría el editor. */
async function conOriginal(productId: string | null = "carnet") {
  const p = await P.crearPreparacion(CTX, { productId, clientId: null });
  if (!p.ok) throw new Error(p.error);
  const foto = await jpg();
  const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "cara.jpg", tipo: "image/jpeg", bytes: foto.length });
  if (!s.ok) throw new Error(s.error);
  R2.set(new URL(s.url).pathname.slice(1), foto);
  const c = await P.confirmarOriginal(CTX, s.originalId);
  if (!c.ok) throw new Error(c.error);
  return { prep: p.id, original: s.originalId };
}

beforeEach(async () => {
  R2.clear();
  B.limpiar?.();
  B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
  B.agregar("product", { id: "remera", workspaceId: "ws-1", name: "Remera", priceArs: "1", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  kodakId = kodak.id;
  t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
  await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodakId, tamanoHojaId: t10, unidad: "HOJA" });
});

describe("preparaciones de impresión", () => {
  it("sólo se prepara un producto con producción de carnet", async () => {
    expect((await P.crearPreparacion(CTX, { productId: "remera", clientId: null })).ok).toBe(false);
    expect((await P.crearPreparacion(CTX, { productId: "carnet", clientId: null })).ok).toBe(true);
    expect((await P.crearPreparacion(CTX, { productId: null, clientId: null })).ok).toBe(true);
  });

  it("rechaza tipos y tamaños de archivo no permitidos", async () => {
    const p = await P.crearPreparacion(CTX, { productId: "carnet", clientId: null });
    if (!p.ok) throw new Error();
    expect((await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.pdf", tipo: "application/pdf", bytes: 10 })).ok).toBe(false);
    expect((await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: 61 * 1024 * 1024 })).ok).toBe(false);
    expect((await P.pedirSubidaOriginal(OTRO, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: 10 })).ok).toBe(false);
  });

  it("confirmar un archivo que no es imagen lo borra y avisa", async () => {
    const p = await P.crearPreparacion(CTX, { productId: "carnet", clientId: null });
    if (!p.ok) throw new Error();
    const basura = Buffer.from("no soy una foto");
    const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: basura.length });
    if (!s.ok) throw new Error();
    const clave = new URL(s.url).pathname.slice(1);
    R2.set(clave, basura);
    const c = await P.confirmarOriginal(CTX, s.originalId);
    expect(c.ok).toBe(false);
    expect(R2.has(clave)).toBe(false);
  });

  it("de la foto a la hoja final: 6 carnets 4×4 en una 10x15 de la Kodak", async () => {
    const { prep, original } = await conOriginal();
    const pieza = await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: { ...recetaInicial(), encuadre: { x: 0, y: 0.1, ancho: 1, alto: 0.75 } } });
    expect(pieza).toMatchObject({ ok: true, aviso: "OK" });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 2, conLineas: true });
    expect(h).toMatchObject({ ok: true, fotosPorHoja: 6 });
    if (!h.ok) return;
    const datos = await P.datosParaImprimir("ws-1", h.hojaId);
    expect(datos).toMatchObject({ anchoMm: 102, altoMm: 152, copias: 2, salida: "Kodak 305", tamano: "10x15" });
    const meta = await sharp(R2.get(datos!.finalKey)!).metadata();
    expect([meta.width, meta.height, meta.density]).toEqual([1205, 1795, 300]);
  });

  it("generar dos veces sin cambios no vuelve a armar el archivo", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const a = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    const b = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 3, conLineas: true });
    if (!a.ok || !b.ok) throw new Error();
    expect(b.hojaId).toBe(a.hojaId);
    expect((await P.datosParaImprimir("ws-1", b.hojaId))!.copias).toBe(3);
  });

  it("una receta inválida no se guarda", async () => {
    const { prep, original } = await conOriginal();
    expect((await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: { hola: 1 } })).ok).toBe(false);
    expect((await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 5, altoMm: 40, receta: recetaInicial() })).ok).toBe(false);
  });

  it("registrar: NORMAL deja la preparación IMPRESA; DESCARTADA no; otro negocio no puede", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error();
    expect((await P.registrarImpresion(OTRO, h.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(false);
    expect((await P.registrarImpresion(CTX, h.hojaId, { motivo: "DESCARTADA", hojas: 1 })).ok).toBe(true);
    let c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.find((f) => f.preparacionId === prep)?.estado).toBe("LISTA");
    expect((await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);
    c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.find((f) => f.preparacionId === prep)?.estado).toBe("IMPRESA");
    expect(c.impresoHoy.map((r) => r.motivo).sort()).toEqual(["DESCARTADA", "NORMAL"]);
    expect(c.impresoHoy.every((r) => r.salida === "Kodak 305" && r.tamano === "10x15")).toBe(true);
  });

  it("colas: lo preparado sin cobrar aparece aunque se haya recargado el Mostrador", async () => {
    const { prep } = await conOriginal();
    const c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.map((f) => f.preparacionId)).toContain(prep);
    expect(c.paraImprimir).toHaveLength(0);
  });

  it("validarParaCobrar: producto distinto, repetida o anulada no se cobra", async () => {
    const { prep } = await conOriginal();
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "remera" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }, { preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-2", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(true);
    await P.anularPreparacion(CTX, prep);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
  });

  it("no vincula una preparación ya cobrada (dos pestañas, mismo carnet)", async () => {
    const { prep } = await conOriginal();
    await B.prisma.$transaction((tx: never) => P.vincularConVenta(tx, "ws-1", [{ preparacionId: prep, saleItemId: "item-1" }], null));
    await expect(
      B.prisma.$transaction((tx: never) => P.vincularConVenta(tx, "ws-1", [{ preparacionId: prep, saleItemId: "item-2" }], null)),
    ).rejects.toBeInstanceOf(P.PreparacionNoVinculable);
    const c = await P.colas("ws-1", new Date());
    expect(c.paraImprimir.map((f) => f.preparacionId)).toEqual([prep]);
  });

  it("la purga borra a los 30 días archivos y filas, pero deja el registro", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error();
    await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas: 1 });
    expect(await P.purgarPreparaciones(new Date(Date.now() + 29 * 86_400_000))).toBe(0);
    expect(await P.purgarPreparaciones(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    expect(R2.size).toBe(0);
    const regs = await B.prisma.fotofficeRegistroImpresion.findMany({ where: { workspaceId: "ws-1" } });
    expect(regs).toHaveLength(1);
  });
});
```

Nota: si la base en memoria no aplica `onDelete: Cascade` ni `SetNull`, `purgarPreparaciones` tiene que borrar explícitamente en este orden: `fotofficeRegistroImpresion.updateMany({ where: { hojaId: { in } }, data: { hojaId: null } })`, piezas, hojas, originales, preparación. Hacerlo así igual (no depender de la cascada): es lo que se prueba.

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/impresion/preparaciones.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/impresion/preparaciones.ts`**

Implementar las 11 reglas de arriba con las firmas de **Interfaces**. Esqueleto con las partes delicadas resueltas (el resto son lecturas y escrituras planas con `select` de columnas sueltas: la base en memoria no hace relaciones anidadas):

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { MAX_BYTES_ORIGINAL, TIPOS_ORIGINAL, borrarObjetoImpresion, claveImpresion, guardarObjeto, leerObjeto, tamanoDeObjeto, urlDeSubidaOriginal } from "./almacen";
import { avisoDeCalidad, cajaRotada, rectanguloEnPixeles, resolucionEfectiva } from "./geometria";
import { huellaDe } from "./huella";
import { pixelesDeHoja, type Nitidez } from "./medidas";
import { disposicionCarnet } from "./plancha";
import { anguloTotal, validarReceta, type Receta } from "./receta";
import { ImagenNoProcesable, componerHoja, generarVistaPrevia, leerOriginal, renderizarPieza } from "./render";

export const DIAS_PREPARACION = 30;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

export type CtxImpresion = { workspaceId: string; userId: number; userLabel: string };
export type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
export class PreparacionNoVinculable extends Error {
  constructor() { super("Esa preparación ya se cobró en otra venta."); }
}

const NO_EXISTE = { ok: false as const, error: "Esa preparación no existe." };

async function preparacionPropia(workspaceId: string, id: unknown) {
  if (typeof id !== "string" || !ID.test(id)) return null;
  return prisma.fotofficePreparacionImpresion.findFirst({
    where: { id, workspaceId },
    select: { id: true, productId: true, clientId: true, saleItemId: true, proyectoId: true, estado: true },
  });
}

/** 00:00 de hoy en Argentina (UTC−3, sin horario de verano). */
export function inicioDelDiaArgentina(ahora: Date): Date {
  const local = new Date(ahora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
}

export async function confirmarOriginal(ctx: CtxImpresion, originalId: string): Promise<R<{ originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number }>> {
  if (!ID.test(originalId)) return { ok: false, error: "Esa foto no existe." };
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, estado: "PENDIENTE" },
    select: { id: true, key: true, bytes: true, preparacionId: true },
  });
  if (!o) return { ok: false, error: "Esa foto no existe." };
  const tirar = async (error: string) => {
    await borrarObjetoImpresion(o.key).catch(() => undefined);
    await prisma.fotofficeOriginalImpresion.deleteMany({ where: { id: o.id, workspaceId: ctx.workspaceId } });
    return { ok: false as const, error };
  };
  const real = await tamanoDeObjeto(o.key);
  if (real === null || real !== o.bytes) return tirar("La foto no terminó de subirse. Probá de nuevo.");
  try {
    const buf = await leerObjeto(o.key);
    const info = await leerOriginal(buf);
    const vista = await generarVistaPrevia(buf);
    const previewKey = claveImpresion(ctx.workspaceId, o.preparacionId, "vista", o.id, "jpg");
    await guardarObjeto(previewKey, vista.jpg, "image/jpeg");
    await prisma.fotofficeOriginalImpresion.update({
      where: { id: o.id },
      data: { estado: "LISTO", anchoPx: info.ancho, altoPx: info.alto, perfilColor: info.perfilColor, previewKey },
    });
    return { ok: true, originalId: o.id, ancho: info.ancho, alto: info.alto, vistaAncho: vista.ancho, vistaAlto: vista.alto };
  } catch (e) {
    if (e instanceof ImagenNoProcesable && e.definitivo) return tirar(e.message);
    console.error("[fotoffice][impresion] no se pudo confirmar el original", { id: o.id, error: e instanceof Error ? e.name : "?" });
    return { ok: false, error: "No se pudo abrir la foto. Probá de nuevo." };
  }
}

export async function vincularConVenta(tx: Prisma.TransactionClient, workspaceId: string, pares: { preparacionId: string; saleItemId: string }[], clientId: string | null): Promise<void> {
  for (const p of pares) {
    const prep = await tx.fotofficePreparacionImpresion.findFirst({ where: { id: p.preparacionId, workspaceId }, select: { clientId: true } });
    const r = await tx.fotofficePreparacionImpresion.updateMany({
      where: { id: p.preparacionId, workspaceId, saleItemId: null, estado: { not: "ANULADA" } },
      data: { saleItemId: p.saleItemId, clientId: prep?.clientId ?? clientId },
    });
    if (r.count !== 1) throw new PreparacionNoVinculable();
  }
}

// crearPreparacion, pedirSubidaOriginal, guardarPiezaCarnet, generarHojaCarnet, registrarImpresion,
// registrarPrueba, anularPreparacion, validarParaCobrar, colas, datosParaImprimir y
// purgarPreparaciones: con las reglas 2, 3, 5, 6, 7, 8, 10 y 11 de esta tarea, en el mismo estilo
// (validar ids → leer con workspaceId → escribir → devolver R).
```

Partes de `generarHojaCarnet` que no se pueden improvisar:

```ts
  const disp = disposicionCarnet({ anchoMm: Number(pieza.anchoMm), altoMm: Number(pieza.altoMm) }, { anchoMm: Number(tamano.anchoMm), altoMm: Number(tamano.altoMm) }, salida.ppp, d.fotos ?? undefined);
  const hojaPx = pixelesDeHoja({ anchoMm: Number(tamano.anchoMm), altoMm: Number(tamano.altoMm) }, salida.ppp);
  const finalHuella = huellaDe({ pieza: pieza.huella, salidaId: salida.id, tamanoId: tamano.id, ppp: salida.ppp, nitidez: salida.nitidez, fotos: disp.posiciones.length, conLineas: d.conLineas });
  // … si la hoja existente tiene finalHuella igual y finalKey: sólo actualizar copias y devolver.
  const receta = validarReceta(pieza.receta)!;
  const piezaRaw = await renderizarPieza(await leerObjeto(original.key), receta, disp.pieza, salida.nitidez as Nitidez);
  const jpg = await componerHoja(hojaPx, piezaRaw, disp, salida.ppp, d.conLineas);
  const hojaId = existente?.id ?? randomUUID().replace(/-/g, "");
  const finalKey = claveImpresion(ctx.workspaceId, prep.id, "final", `${hojaId}-${finalHuella.slice(0, 12)}`, "jpg");
  await guardarObjeto(finalKey, jpg, "image/jpeg");
  // … upsert de la hoja con disposicion: { pieza: disp.pieza, posiciones: disp.posiciones, lineas: d.conLineas ? disp.lineas : null }
  // … si había un finalKey anterior distinto, borrarlo de R2 después de guardar la fila.
```

Y de `guardarPiezaCarnet`, la resolución efectiva:

```ts
  const caja = cajaRotada(original.anchoPx, original.altoPx, anguloTotal(receta));
  const rect = rectanguloEnPixeles(receta.encuadre, caja);
  const ppp = resolucionEfectiva(rect, { anchoMm: d.anchoMm, altoMm: d.altoMm });
  return { ok: true, piezaId, ppp, aviso: avisoDeCalidad(ppp) };
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter fotoffice test -- lib/impresion/preparaciones.test.ts`
Expected: PASS (12 pruebas).

- [ ] **Step 5: Acciones de servidor**

Agregar a `app/(shell)/ventas/impresion/actions.ts` (todas con `requireSalesStaff()`; arman `ctx = { workspaceId: workspace.id, userId: user.id, userLabel: user.name ?? user.email }` —mirar qué campos trae `user` en `requireSalesStaff` y usar los mismos que `mostrador-actions.ts`—):

```ts
export async function crearPreparacionAction(d: { productId: string | null; clientId: string | null }) { const ctx = await ctxImpresion(); return crearPreparacion(ctx, d); }
export async function pedirSubidaOriginalAction(preparacionId: string, a: { nombre: string; tipo: string; bytes: number }) { … }
export async function confirmarOriginalAction(originalId: string) { … }
export async function guardarPiezaCarnetAction(preparacionId: string, d: { originalId: string; anchoMm: number; altoMm: number; receta: unknown }) { … }
export async function generarHojaCarnetAction(preparacionId: string, d: { salidaId: string | null; tamanoId: string | null; fotos: number | null; copias: number; conLineas: boolean }) { … revalidatePath("/ventas/impresiones"); }
export async function registrarImpresionAction(hojaId: string, d: { motivo: "NORMAL" | "DESCARTADA"; hojas: number }) { … revalidatePath("/ventas/impresiones"); }
export async function registrarPruebaAction(salidaId: string, tamanoId: string) { … }
export async function anularPreparacionAction(preparacionId: string) { … revalidatePath("/ventas/impresiones"); }
export async function produccionDeProductosAction() { const { workspace } = await requireSalesStaff(); return produccionDeProductos(workspace.id); }
```

Cada una con el cuerpo completo de una línea (`const ctx = await ctxImpresion(); return fn(ctx, …);`). `ctxImpresion()` es una función privada del archivo (no exportada: en un archivo `"use server"` todo lo exportado tiene que ser acción).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter fotoffice typecheck`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/impresion/preparaciones.ts apps/fotoffice/lib/impresion/preparaciones.test.ts "apps/fotoffice/app/(shell)/ventas/impresion/actions.ts"
git commit -m "Impresión: preparaciones con original, plancha, registro de hojas, colas y purga"
```

---

### Task 11: El original de la foto carnet queda en la ficha del cliente

**Files:**
- Create: `lib/impresion/ficha-carnet.ts`
- Test: `lib/impresion/ficha-carnet.test.ts`
- Modify: `lib/impresion/preparaciones.ts` (llamar a `guardarOriginalesEnFicha` al confirmar un original y al cambiar el cliente)
- Modify: `app/(shell)/ventas/impresion/actions.ts` (`fotosCarnetDelClienteAction`, `usarFotoAnteriorAction`, `asignarClienteAction`)

**Interfaces:**
- Consumes: `copiarObjeto`, `claveImpresion` (Task 8); `claveDeAdjunto` de `lib/ficha/adjuntos-reglas.ts`; `registrarEventoPersona` de `lib/ficha/eventos.ts` (kind `"ADJUNTO_SUBIDO"`, igual que `confirmarSubida` de adjuntos).
- Produces:
  - `ORIGEN_FOTO_CARNET = "FOTO_CARNET"`
  - `guardarOriginalesEnFicha(ctx: CtxImpresion, preparacionId: string): Promise<number>` (idempotente; devuelve cuántas copió)
  - `fotosCarnetDelCliente(workspaceId: string, clientId: string): Promise<{ adjuntoId: string; fecha: string; nombre: string }[]>` (LISTO, más nuevas primero, máx. 12)
  - `usarFotoAnterior(ctx: CtxImpresion, preparacionId: string, adjuntoId: string): Promise<R<{ originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number }>>`
  - `asignarCliente(ctx: CtxImpresion, preparacionId: string, clientId: string | null): Promise<R>`

Reglas:
1. Sólo copia si la preparación tiene `clientId` del workspace y su producto es `CARNET`, o no tiene producto (pantalla suelta de Foto carnet).
2. Por cada original `LISTO` sin `adjuntoId`: `copiarObjeto(original.key, claveDeAdjunto(ws, randomUUID()))`, crea `FotofficeAttachment` (`status: "LISTO"`, `origen: "FOTO_CARNET"`, `fileName: "Foto carnet original DD-MM-AAAA.<ext>"` con la fecha argentina, `contentType` y `sizeBytes` del original, `uploadedByUserId`/`uploadedByLabel` de ctx, **`purgeAfter: null`**), registra el evento en la ficha y guarda `adjuntoId` en el original. Si la copia falla, registra el error y sigue (no rompe la preparación).
3. `usarFotoAnterior`: el adjunto tiene que ser del mismo cliente que la preparación, `origen = "FOTO_CARNET"` y `LISTO`. Copia el objeto a `claveImpresion(..., "original", nuevoId, ext)`, crea el original con `adjuntoId` ya puesto (para no duplicar la ficha) y corre el mismo camino que `confirmarOriginal` (vista previa, medidas).
4. `asignarCliente`: cambia `clientId` (verificando que sea del workspace) y llama a `guardarOriginalesEnFicha`.
5. En `vincularConVenta` no se copia (está dentro de la transacción de la venta): `checkoutAction` llama a `guardarOriginalesEnFicha` **después** de la transacción (Task 14).

- [ ] **Step 1: Pruebas que fallan**

Mismo armado de mocks que `preparaciones.test.ts` (copiar el bloque de `vi.hoisted`/`vi.mock` y el helper `conOriginal`, agregando `clientId` al crear). Además `vi.mock("@/lib/ficha/eventos", () => ({ registrarEventoPersona: vi.fn(async () => undefined) }))`. Casos:

```ts
it("con cliente, el original queda en su ficha como FOTO_CARNET y sin vencimiento, una sola vez", async () => {
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
  const { prep } = await conOriginal("carnet", "cli-1");
  expect(await F.guardarOriginalesEnFicha(CTX, prep)).toBe(0); // ya se copió al confirmar
  const adj = await B.prisma.fotofficeAttachment.findMany({ where: { workspaceId: "ws-1", clientId: "cli-1" } });
  expect(adj).toHaveLength(1);
  expect(adj[0]).toMatchObject({ origen: "FOTO_CARNET", status: "LISTO", purgeAfter: null });
  expect(adj[0].fileName).toMatch(/^Foto carnet original \d{2}-\d{2}-\d{4}\.jpg$/);
  expect(R2.has(adj[0].storageKey)).toBe(true);
});

it("sin cliente no guarda nada; al asignarlo después, sí", async () => {
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
  const { prep } = await conOriginal("carnet", null);
  expect(await B.prisma.fotofficeAttachment.count({ where: { workspaceId: "ws-1" } })).toBe(0);
  expect(await F.asignarCliente(CTX, prep, "cli-1")).toEqual({ ok: true });
  expect(await B.prisma.fotofficeAttachment.count({ where: { workspaceId: "ws-1", clientId: "cli-1" } })).toBe(1);
});

it("la copia de la ficha sobrevive a la purga de la preparación", async () => {
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
  await conOriginal("carnet", "cli-1");
  await P.purgarPreparaciones(new Date(Date.now() + 31 * 86_400_000));
  const adj = await B.prisma.fotofficeAttachment.findMany({ where: { clientId: "cli-1" } });
  expect(R2.has(adj[0].storageKey)).toBe(true);
});

it("usar una foto anterior crea un original listo sin duplicar la ficha; la de otro cliente no", async () => {
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
  B.agregar("client", { id: "cli-2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Leo", lastName: "Paz", businessName: null });
  await conOriginal("carnet", "cli-1");
  const [anterior] = await F.fotosCarnetDelCliente("ws-1", "cli-1");
  const nueva = await P.crearPreparacion(CTX, { productId: "carnet", clientId: "cli-1" });
  if (!nueva.ok) throw new Error();
  expect(await F.usarFotoAnterior(CTX, nueva.id, anterior!.adjuntoId)).toMatchObject({ ok: true });
  expect(await B.prisma.fotofficeAttachment.count({ where: { clientId: "cli-1" } })).toBe(1);
  const ajena = await P.crearPreparacion(CTX, { productId: "carnet", clientId: "cli-2" });
  if (!ajena.ok) throw new Error();
  expect((await F.usarFotoAnterior(CTX, ajena.id, anterior!.adjuntoId)).ok).toBe(false);
});
```

(El helper `conOriginal(productId, clientId)` recibe el cliente y lo pasa a `crearPreparacion`.)

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/impresion/ficha-carnet.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** `lib/impresion/ficha-carnet.ts` con las 5 reglas, y en `preparaciones.ts`, al final del camino feliz de `confirmarOriginal`, agregar `await guardarOriginalesEnFicha(ctx, o.preparacionId).catch((e) => console.error("[fotoffice][impresion] no se guardó en la ficha", { error: e instanceof Error ? e.name : "?" }));`. Para evitar el import circular, `ficha-carnet.ts` importa de `preparaciones.ts` sólo tipos, y la parte común de "abrir original + vista previa + marcar LISTO" se extrae en `preparaciones.ts` como `export async function procesarOriginalSubido(ctx, originalId)` que usan los dos.

- [ ] **Step 4: Correr todas las pruebas de impresión**

Run: `pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 5: Acciones**

En `actions.ts`: `fotosCarnetDelClienteAction(clientId)`, `usarFotoAnteriorAction(preparacionId, adjuntoId)`, `asignarClienteAction(preparacionId, clientId | null)`, con `requireSalesStaff()`. `fotosCarnetDelClienteAction` además exige nivel VIEW del módulo de clientes (`getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY)`, igual que `app/(shell)/ventas/foto-carnet/page.tsx`); sin permiso devuelve `[]`.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/impresion "apps/fotoffice/app/(shell)/ventas/impresion/actions.ts"
git commit -m "Foto carnet: el original queda en la ficha del cliente y se puede reusar"
```

---

### Task 12: Servir vista previa y final, página de impresión y hoja de prueba

**Files:**
- Create: `app/api/impresion/vista/[originalId]/route.ts`
- Create: `app/api/impresion/hoja/[hojaId]/route.ts`
- Create: `app/imprimir/hoja/[hojaId]/page.tsx`, `app/imprimir/hoja/[hojaId]/hoja-para-imprimir.tsx`
- Create: `app/imprimir/prueba/[salidaId]/page.tsx`, `app/imprimir/prueba/[salidaId]/prueba-cliente.tsx`

**Interfaces:**
- Consumes: `datosParaImprimir`, `registrarImpresionAction`, `registrarPruebaAction`, `leerObjeto`, `medidaImpresaMm`, `listarSalidas`.

Antes de escribir las rutas, leer en `node_modules/next/dist/docs/` cómo se declaran los Route Handlers y los `params` (son `Promise` en esta versión, como en `app/imprimir/acta/[id]/page.tsx`).

- [ ] **Step 1: Rutas de imágenes (mismo origen, sin CORS para el `canvas`)**

`app/api/impresion/vista/[originalId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireSalesStaff } from "@/lib/sales/access";
import { leerObjeto } from "@/lib/impresion/almacen";

export const dynamic = "force-dynamic";

/** La vista previa (1600 px, sRGB) de un original, para el editor. Privada: sólo quien vende. */
export async function GET(_: Request, { params }: { params: Promise<{ originalId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { originalId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(originalId)) return new NextResponse(null, { status: 404 });
  const o = await prisma.fotofficeOriginalImpresion.findFirst({ where: { id: originalId, workspaceId: workspace.id, estado: "LISTO" }, select: { previewKey: true } });
  if (!o?.previewKey) return new NextResponse(null, { status: 404 });
  const buf = await leerObjeto(o.previewKey);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
```

`app/api/impresion/hoja/[hojaId]/route.ts`: igual, con `datosParaImprimir(workspace.id, hojaId)` → `leerObjeto(finalKey)`; si `?descargar=1`, agrega `Content-Disposition: attachment; filename="<salida>_<tamaño>_<hojaId>.jpg"` (nombre limpio de caracteres raros).

- [ ] **Step 2: Página de impresión**

`app/imprimir/hoja/[hojaId]/page.tsx` (fuera del panel, como el acta):

```tsx
import { notFound } from "next/navigation";
import { requireSalesStaff } from "@/lib/sales/access";
import { datosParaImprimir } from "@/lib/impresion/preparaciones";
import { medidaImpresaMm } from "@/lib/impresion/medidas";
import { HojaParaImprimir } from "./hoja-para-imprimir";

export const dynamic = "force-dynamic";

/** La hoja sola, al tamaño exacto en mm y sin márgenes. El cuadro de impresión se abre solo. */
export default async function HojaPage({ params }: { params: Promise<{ hojaId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { hojaId } = await params;
  const d = await datosParaImprimir(workspace.id, hojaId);
  if (!d) notFound();
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${d.anchoMm}mm ${d.altoMm}mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; } @media print { .no-imprimir { display: none !important; } }`,
        }}
      />
      <HojaParaImprimir
        hojaId={hojaId}
        src={`/api/impresion/hoja/${hojaId}`}
        anchoMm={medidaImpresaMm(d.anchoMm, d.escalaXMil)}
        altoMm={medidaImpresaMm(d.altoMm, d.escalaYMil)}
        copias={d.copias}
        titulo={`${d.salida} · ${d.tamano} · ${d.copias} ${d.copias === 1 ? "hoja" : "hojas"}`}
      />
    </>
  );
}
```

`hoja-para-imprimir.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { registrarImpresionAction } from "@/app/(shell)/ventas/impresion/actions";

type Fase = "cargando" | "imprimiendo" | "preguntar" | "guardando" | "listo" | "error";

export function HojaParaImprimir({ hojaId, src, anchoMm, altoMm, copias, titulo }: { hojaId: string; src: string; anchoMm: number; altoMm: number; copias: number; titulo: string }) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const faseRef = useRef<Fase>("cargando");
  faseRef.current = fase;

  useEffect(() => {
    const despues = () => { if (faseRef.current === "imprimiendo") setFase("preguntar"); };
    window.addEventListener("afterprint", despues);
    return () => window.removeEventListener("afterprint", despues);
  }, []);

  function imprimir() {
    setFase("imprimiendo");
    // Un tick para que React pinte antes de que el diálogo bloquee la pestaña.
    setTimeout(() => window.print(), 50);
  }

  async function responder(motivo: "NORMAL" | "DESCARTADA" | null) {
    if (motivo === null) return setFase("listo");
    setFase("guardando");
    const r = await registrarImpresionAction(hojaId, { motivo, hojas: copias });
    if (!r.ok) { setError(r.error); return setFase("error"); }
    if (motivo === "DESCARTADA") return imprimir();
    setFase("listo");
  }

  return (
    <div>
      <div className="no-imprimir mx-auto max-w-xl space-y-3 p-4 text-sm">
        <p className="font-medium">{titulo}</p>
        {fase === "preguntar" ? (
          <div className="flex flex-wrap gap-2">
            <span>¿Cómo salió?</span>
            <button className="fo-btn fo-btn-primary" onClick={() => responder("NORMAL")}>Salió bien</button>
            <button className="fo-btn" onClick={() => responder("DESCARTADA")}>Salió mal, reimprimir</button>
            <button className="fo-btn" onClick={() => responder(null)}>No la imprimí</button>
          </div>
        ) : null}
        {fase === "listo" ? (
          <div className="flex gap-2">
            <span>Listo.</span>
            <button className="fo-btn" onClick={imprimir}>Imprimir otra vez</button>
            <button className="fo-btn" onClick={() => window.close()}>Cerrar</button>
          </div>
        ) : null}
        {fase === "error" ? <p className="text-[var(--fo-danger)]">{error}</p> : null}
        <a className="underline" href={`${src}?descargar=1`}>Descargar JPG</a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- el tamaño en mm es el punto: no se optimiza */}
      <img
        src={src}
        alt=""
        onLoad={() => { if (faseRef.current === "cargando") imprimir(); }}
        onError={() => { setError("No se pudo cargar la hoja."); setFase("error"); }}
        style={{ width: `${anchoMm}mm`, height: `${altoMm}mm`, display: "block" }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Hoja de prueba**

`app/imprimir/prueba/[salidaId]/page.tsx`: `requireSalesAdmin()`, lee la salida y el tamaño (`?tamano=`) con `listarSalidas`; si no existen o la salida no admite el tamaño → `notFound()`. Mismo `<style>` de `@page` con la medida real **sin** corrección (la prueba mide justamente el error). Renderiza un SVG con `width={`${ancho}mm`} height={`${alto}mm`} viewBox={`0 0 ${ancho} ${alto}`}` (1 unidad = 1 mm) que contiene:
- una regla horizontal de 100 mm (línea de 0,3 mm, marcas cada 1 mm de 1,5 mm de alto y cada 10 mm de 4 mm con el número) centrada arriba;
- una regla vertical igual, centrada a la izquierda;
- un marco de 0,2 mm a 3 mm de cada borde (zona de seguridad);
- 11 parches de gris de 0 a 100 % de 8×8 mm y 6 parches de color (rojo, verde, azul, cian, magenta, amarillo) abajo;
- el texto "Medí las líneas de 100 mm y cargá lo que midan en Ventas → Impresión".

y el componente cliente `prueba-cliente.tsx` que abre el cuadro de impresión al cargar y, en `afterprint`, llama una sola vez a `registrarPruebaAction(salidaId, tamanoId)` (la hoja de prueba también gasta papel).

- [ ] **Step 4: Verificar en el navegador**

Levantar FOTOFFICE con `preview_start` (si no hay entrada en `.claude/launch.json`, crearla con `"runtimeExecutable": "pnpm", "runtimeArgs": ["--filter", "fotoffice", "dev"], "port": 3010`; en un worktree, `next dev --webpack`). Abrir `/ventas/impresion/configuracion`, luego la hoja de prueba 10x15: confirmar con `javascript_tool` que `getComputedStyle(document.querySelector("svg")).width` corresponde a 102 mm (≈ 385,5 px a 96 dpi) y que en la vista de impresión (`resize_window` no aplica: usar `emulate media print` de Playwright si está disponible, o revisar la regla `@page` con `document.styleSheets`) la página es de 102 × 152 mm.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/app/api/impresion apps/fotoffice/app/imprimir/hoja apps/fotoffice/app/imprimir/prueba
git commit -m "Impresión: página de impresión al tamaño exacto y hoja de prueba con regla"
```

---

### Task 13: Editor de Foto carnet con el motor nuevo

**Files:**
- Modify: `components/foto-carnet/editor-foto-carnet.tsx`
- Modify: `components/foto-carnet/ajustes.tsx` (controles de `Ajustes` de Task 4)
- Modify: `components/foto-carnet/vistas.tsx` (vista previa con `aplicarAjustes`)
- Modify: `components/foto-carnet/recorte.tsx` (devolver píxeles + medidas de la vista previa)
- Delete: `components/foto-carnet/procesar.ts`
- Modify: `app/(shell)/ventas/foto-carnet/page.tsx` (pasar salidas)
- Create: `components/foto-carnet/fotos-anteriores.tsx`
- Test: `components/foto-carnet/receta-desde-editor.test.ts`
- Create: `components/foto-carnet/receta-desde-editor.ts`

**Interfaces:**
- Consumes: acciones de Tasks 10–11; `recetaInicial`, `Receta` (Task 5); `encuadreDesdePixeles`, `cajaRotada` (Task 5); `aplicarAjustes`, `AJUSTES_NEUTROS`, `CLAVES_AJUSTE`, `Ajustes` (Task 4); `MEDIDAS_CARNET`, `LADO_MINIMO_CM` (existentes); `SalidaVista` (Task 9).
- Produces:
  - `recetaDesdeEditor(d: { cropPx: { x: number; y: number; width: number; height: number }; vista: { ancho: number; alto: number }; rotacion: number; ajustes: Ajustes }): Receta`
  - `EditorFotoCarnet` con props nuevas: `modo: { tipo: "suelto"; salidas: SalidaVista[] } | { tipo: "mostrador"; preparacionId: string; clienteInicial: ClienteBuscado | null; onListo: (r: { hojas: number; preparacionId: string }) => void; onCancelar: () => void }` además de las de permisos que ya tiene.

- [ ] **Step 1: Prueba de la conversión del editor a receta**

```ts
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "@/lib/impresion/ajustes";
import { recetaDesdeEditor } from "./receta-desde-editor";

describe("receta desde el editor", () => {
  it("separa el giro de 90° del enderezado y pasa el encuadre a proporciones de la caja girada", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 100, y: 200, width: 400, height: 400 }, vista: { ancho: 1200, alto: 1600 }, rotacion: 93, ajustes: AJUSTES_NEUTROS });
    expect(r.rotacion90).toBe(90);
    expect(r.enderezar).toBe(3);
  });
  it("−4° queda como enderezado −4 sin giro", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 0, y: 0, width: 10, height: 10 }, vista: { ancho: 100, alto: 100 }, rotacion: -4, ajustes: AJUSTES_NEUTROS });
    expect([r.rotacion90, r.enderezar]).toEqual([0, -4]);
  });
  it("el encuadre usa la caja girada de la vista previa", () => {
    const r = recetaDesdeEditor({ cropPx: { x: 400, y: 300, width: 800, height: 600 }, vista: { ancho: 1200, alto: 1600 }, rotacion: 90, ajustes: AJUSTES_NEUTROS });
    // Girada 90°, la caja es 1600 × 1200.
    expect(r.encuadre).toEqual({ x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 });
  });
});
```

- [ ] **Step 2: Implementar `receta-desde-editor.ts`**

```ts
import { cajaRotada, encuadreDesdePixeles } from "@/lib/impresion/geometria";
import type { Ajustes } from "@/lib/impresion/ajustes";
import { recetaInicial, type Receta } from "@/lib/impresion/receta";

/**
 * react-easy-crop da un único ángulo y el recorte en píxeles de la vista previa ya girada.
 * La receta guarda el giro de 90° aparte del enderezado (±10°) y el encuadre en proporciones.
 */
export function recetaDesdeEditor(d: { cropPx: { x: number; y: number; width: number; height: number }; vista: { ancho: number; alto: number }; rotacion: number; ajustes: Ajustes }): Receta {
  const normal = ((d.rotacion % 360) + 360) % 360;
  const cuarto = (Math.round(normal / 90) * 90) % 360;
  let enderezar = normal - cuarto;
  if (enderezar > 180) enderezar -= 360;
  const caja = cajaRotada(d.vista.ancho, d.vista.alto, d.rotacion);
  return {
    ...recetaInicial(),
    rotacion90: cuarto as Receta["rotacion90"],
    enderezar: Math.max(-10, Math.min(10, Math.round(enderezar * 10) / 10)),
    encuadre: encuadreDesdePixeles(d.cropPx, caja),
    ajustes: { ...d.ajustes },
  };
}
```

Run: `pnpm --filter fotoffice test -- components/foto-carnet/receta-desde-editor.test.ts`
Expected: PASS.

- [ ] **Step 3: Rehacer el editor sobre la preparación**

Cambios en `editor-foto-carnet.tsx` (se conservan los 4 pasos, la grilla con `grillaDe`, las medidas y el buscador de cliente):

1. **Estado nuevo:** `preparacionId: string | null` (en modo mostrador viene en props; en suelto se crea con `crearPreparacionAction({ productId: null, clientId: cliente?.id ?? null })` al elegir la primera foto), `original: { id: string; vista: { ancho: number; alto: number }; ancho: number; alto: number } | null`, `ajustes: Ajustes` (inicial `AJUSTES_NEUTROS`), `hoja: { id: string; fotosPorHoja: number } | null`, `subiendo: boolean`, `aviso: "OK" | "BLANDA" | "PIXELADA" | null`. Se borran `AdjustmentSettings`, `AJUSTES_INICIALES`, `TAMANO_MAXIMO_FOTO` (pasa a 60 MB) y todo uso de `procesar.ts`.
2. **Elegir foto** (`elegirFoto`): validar tipo (`image/jpeg|png|webp|heic|heif`) y tamaño ≤ 60 MB; `pedirSubidaOriginalAction` → `fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file })` → `confirmarOriginalAction(originalId)` → `setOriginal(...)` y `imageSrc = /api/impresion/vista/${originalId}`. Errores del servidor se muestran tal cual en `errorFoto`.
3. **Encuadre**: `Recorte` sigue con `react-easy-crop` sobre la vista previa; `onCropComplete={(_, px) => setCropPixels(px)}`. El aspecto sale de la medida elegida.
4. **Retoque**: `Ajustes` con los 10 controles de `CLAVES_AJUSTE` (−50..50, paso 1) agrupados como en la spec §7 (Luz / Color), y `VistaRecorte` dibuja el recorte de la vista previa en un `canvas` del tamaño de la pieza en pantalla (con `ctx.imageSmoothingQuality = "high"`), toma `getImageData`, aplica `aplicarAjustes(data.data, 4, ajustes)` y lo vuelve a poner. Recalcular con `requestAnimationFrame` al cambiar un control (no en cada evento).
5. **Plancha**: en modo suelto, un selector de impresora y hoja con `modo.salidas` (sólo las hojas de cada salida); en modo mostrador la impresora y la hoja vienen del producto y se muestran como texto. Botón **"Armar plancha"**: `guardarPiezaCarnetAction(preparacionId, { originalId, anchoMm: medida.anchoCm * 10, altoMm: medida.altoCm * 10, receta: recetaDesdeEditor({ cropPx: cropPixels, vista: original.vista, rotacion: rotation, ajustes }) })` → muestra el aviso de calidad si no es "OK" → `generarHojaCarnetAction(preparacionId, { salidaId, tamanoId, fotos: cantidad, copias, conLineas: true })` → muestra la hoja con `<img src={`/api/impresion/hoja/${hojaId}?v=${Date.now()}`}>`. Botones: **Imprimir** (`window.open(`/imprimir/hoja/${hojaId}`, "_blank")`), **Descargar JPG** (`/api/impresion/hoja/${hojaId}?descargar=1`) y, en modo mostrador, **Listo** → `modo.onListo({ hojas: copias, preparacionId })`. Un campo **"Hojas"** (1–50, por omisión 1) define `copias`.
6. **Cliente**: al elegir o cambiar el cliente con `ClienteBuscador`, si hay `preparacionId`, `asignarClienteAction(preparacionId, cliente?.id ?? null)`. Se quita "Guardar en la ficha" (`subirAdjuntoConId`): ahora el original se guarda solo (Task 11). Debajo del buscador, `<FotosAnteriores clientId preparacionId onElegir={...} />`.
7. Texto de ayuda bajo el paso 1: *"El original se guarda en la ficha del cliente para la próxima vez."*
8. **Guías de rostro** (spec §10) en el paso de encuadre: sobre el área de recorte de `react-easy-crop`, dos líneas horizontales punteadas que no se imprimen: **coronilla** al 10 % del alto y **mentón** al 85 % (la cabeza ocupa ~75 %, dentro del 70–80 % que piden los trámites), y una línea vertical al centro. Van en `components/foto-carnet/recorte.tsx` como un `div` absoluto encima del cropper (`pointer-events: none`), con las proporciones en una constante exportada `GUIAS_ROSTRO = { coronilla: 0.1, menton: 0.85 } as const` en `lib/foto-carnet/medidas.ts`, y un interruptor "Guías" (encendido por omisión). Agregar a `lib/foto-carnet/medidas.test.ts`: `expect(GUIAS_ROSTRO.menton - GUIAS_ROSTRO.coronilla).toBeGreaterThanOrEqual(0.7); expect(GUIAS_ROSTRO.menton - GUIAS_ROSTRO.coronilla).toBeLessThanOrEqual(0.8);`.

`fotos-anteriores.tsx`: si `puedeBuscarClientes` y hay cliente, llama a `fotosCarnetDelClienteAction(clientId)` y muestra miniaturas (`/api/impresion/...` no sirve para adjuntos: usar el nombre y la fecha como botones de texto, sin imagen, para no abrir una ruta nueva de adjuntos). Tocar una: `usarFotoAnteriorAction(preparacionId, adjuntoId)` (creando la preparación si todavía no existe) y sigue igual que una foto subida.

`app/(shell)/ventas/foto-carnet/page.tsx`: `await asegurarConfiguracion(workspace.id)`, `const salidas = await listarSalidas(workspace.id)` y pasar `modo={{ tipo: "suelto", salidas }}`. Cambiar la descripción a *"Encuadrá la foto a la medida del trámite, retocala e imprimí la plancha en la Kodak o la Epson."*

- [ ] **Step 4: Borrar `procesar.ts` y comprobar que nada lo usa**

Run: `git rm apps/fotoffice/components/foto-carnet/procesar.ts && grep -rn "foto-carnet/procesar\|from \"./procesar\"" apps/fotoffice || echo "sin usos"`
Expected: "sin usos".

- [ ] **Step 5: Typecheck, pruebas y prueba en el navegador**

Run: `pnpm --filter fotoffice typecheck && pnpm --filter fotoffice test -- components/foto-carnet lib/impresion lib/foto-carnet`
Expected: PASS.

En el navegador (`preview_start`), en *Ventas → Foto carnet*: subir una foto de celular vertical, encuadrar 4×4 con un giro de 3°, subir contraste y temperatura, armar plancha en Kodak 10x15 y confirmar: la plancha muestra 6 fotos, se ve igual que la vista previa y "Descargar JPG" baja un archivo de 1205 × 1795 px. Revisar `read_console_messages` sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A apps/fotoffice/components/foto-carnet "apps/fotoffice/app/(shell)/ventas/foto-carnet"
git commit -m "Foto carnet: encuadre y retoque como receta; la plancha la arma el servidor sin perder calidad"
```

---

### Task 14: "Preparar" en el carrito del Mostrador y la venta ata la preparación

**Files:**
- Modify: `lib/sales/checkout.ts:21-28` (`RawCheckoutLine.preparacionId`)
- Modify: `lib/sales/record-sale.ts` (ids de renglones pre-generados y devueltos, `clientId` devuelto)
- Test: `lib/sales/record-sale.test.ts`
- Modify: `app/(shell)/ventas/actions.ts:260-373` (`checkoutAction`)
- Create: `app/(shell)/ventas/dialogo-preparar.tsx`
- Modify: `app/(shell)/ventas/pos.tsx` (`TicketRow`, carga de producción, botón, cobro)

**Interfaces:**
- Consumes: `validarParaCobrar`, `vincularConVenta`, `PreparacionNoVinculable` (Task 10); `guardarOriginalesEnFicha` (Task 11); `EditorFotoCarnet` modo mostrador (Task 13); `produccionDeProductosAction`, `crearPreparacionAction` (Task 10).
- Produces: `recordSale(...)` devuelve `{ saleId: string; saleNumber: number; deposited: boolean; itemIds: string[]; clientId: string | null }` (`itemIds[i]` es el renglón de `input.lines[i]`).

- [ ] **Step 1: Prueba que falla en `record-sale.test.ts`**

```ts
it("devuelve el id de cada renglón en el orden del ticket, los mismos que escribió", async () => {
  const tx = saleTx();
  const input = { ...inputBase, lines: [inputBase.lines[0]!, { ...inputBase.lines[0]!, description: "segundo" }] };
  const r = await recordSale(tx as never, input);
  expect(r.itemIds).toHaveLength(2);
  const escritos = (tx.saleItem.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].data.map((d: { id: string }) => d.id);
  expect(escritos).toEqual(r.itemIds);
  expect(new Set(r.itemIds).size).toBe(2);
});
```

(Usar los nombres reales de `saleTx` e `inputBase` del archivo; si `inputBase.lines` tiene otra forma, adaptar sólo el armado del segundo renglón.)

Run: `pnpm --filter fotoffice test -- lib/sales/record-sale.test.ts`
Expected: FAIL (`r.itemIds` es undefined).

- [ ] **Step 2: Implementar en `record-sale.ts`**

Importar `randomUUID` de `node:crypto`. Antes de `await tx.saleItem.createMany(`: `const itemIds = input.lines.map(() => randomUUID());`, agregar `id: itemIds[i]` a cada elemento de `data` (`input.lines.map((line, i) => ({ id: itemIds[i], saleId, … }))`), y cambiar el `return` final a `return { saleId: creada.id, saleNumber: creada.saleNumber, deposited, itemIds, clientId };` (la variable del cliente resuelto que ya se usa en `depositarEnCaja`). Actualizar el tipo de retorno de la función. Comentario arriba de `itemIds`: *"Los ids se generan acá porque `createMany` no los devuelve, y la impresión necesita atar cada preparación a su renglón."*

Run: `pnpm --filter fotoffice test -- lib/sales`
Expected: PASS (todas las de ventas, no sólo la nueva).

- [ ] **Step 3: `RawCheckoutLine` y `checkoutAction`**

En `lib/sales/checkout.ts`, dentro de `RawCheckoutLine`:

```ts
  /** La preparación de impresión de este renglón (foto carnet). La valida y la ata el servidor. */
  preparacionId?: string | null;
```

En `checkoutAction` (`app/(shell)/ventas/actions.ts`), después de `validateTicket` y antes del pago verificado:

```ts
  const preparaciones = input.lines
    .map((l, i) => ({ i, preparacionId: l.preparacionId ?? null, productId: l.productId }))
    .filter((p): p is { i: number; preparacionId: string; productId: string | null } => typeof p.preparacionId === "string");
  if (preparaciones.length > 0) {
    const v = await validarParaCobrar(workspace.id, preparaciones);
    if (!v.ok) return { ok: false, error: v.error };
  }
```

Dentro de la transacción, reemplazar `recordSale(tx, {...})` por:

```ts
      async (tx) => {
        const v = await recordSale(tx, { /* lo mismo que antes */ });
        if (preparaciones.length > 0) {
          await vincularConVenta(tx, workspace.id, preparaciones.map((p) => ({ preparacionId: p.preparacionId, saleItemId: v.itemIds[p.i]! })), v.clientId);
        }
        return v;
      },
```

En el `catch`: si `e instanceof PreparacionNoVinculable`, devolver `{ ok: false, error: e.message }` (después de liberar el pago verificado, como el resto). Después de la transacción y antes del `return { ok: true, … }`:

```ts
    if (preparaciones.length > 0 && venta.clientId) {
      const ctx = { workspaceId: workspace.id, userId: user.id, userLabel: user.name ?? user.email };
      for (const p of preparaciones) await guardarOriginalesEnFicha(ctx, p.preparacionId).catch(() => undefined);
    }
    if (preparaciones.length > 0) revalidatePath("/ventas/impresiones");
```

(`userLabel`: usar el mismo campo que Task 10.) `cobrarConPedidoAction` **no** acepta preparaciones en la etapa 1: en `pos.tsx` se bloquea (Step 5).

- [ ] **Step 4: Diálogo "Preparar"**

`app/(shell)/ventas/dialogo-preparar.tsx`:

```tsx
"use client";

import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import type { ClienteBuscado } from "./mostrador-actions";

/** El editor de foto carnet a pantalla completa, sin salir del Mostrador (el ticket vive en esta pantalla). */
export function DialogoPreparar({ preparacionId, cliente, permisos, onListo, onCerrar }: {
  preparacionId: string;
  cliente: ClienteBuscado | null;
  permisos: { puedeBuscarClientes: boolean; puedeGuardarEnFicha: boolean; puedeAltaCliente: boolean };
  onListo: (r: { hojas: number; preparacionId: string }) => void;
  onCerrar: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Preparar foto carnet" className="fixed inset-0 z-50 overflow-y-auto bg-[var(--fo-bg)] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Preparar foto carnet</h2>
          <button type="button" className="fo-btn" onClick={onCerrar}>Volver al ticket</button>
        </div>
        <EditorFotoCarnet {...permisos} modo={{ tipo: "mostrador", preparacionId, clienteInicial: cliente, onListo, onCancelar: onCerrar }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `pos.tsx`**

1. `TicketRow` suma `preparacionId?: string | null`.
2. Al montar: `const [produccion, setProduccion] = useState<Record<string, { tipoPieza: string }>>({});` y un `useEffect` que llama una vez a `produccionDeProductosAction().then(setProduccion)`.
3. Estado `const [preparando, setPreparando] = useState<{ key: string; preparacionId: string } | null>(null);`.
4. En el renglón (dentro de `rows.map((r) => …)`, junto a la descripción), si `r.productId && produccion[r.productId]?.tipoPieza === "CARNET"`:

```tsx
<button
  type="button"
  className="fo-btn mt-1 h-7 px-2 text-xs"
  onClick={async (e) => {
    e.stopPropagation();
    let id = r.preparacionId ?? null;
    if (!id) {
      const c = await crearPreparacionAction({ productId: r.productId, clientId: cliente?.id ?? null });
      if (!c.ok) return setError(c.error);
      id = c.id;
      setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, preparacionId: id } : x)));
    }
    setPreparando({ key: r.key, preparacionId: id });
  }}
>
  {r.preparacionId ? "Editar fotos" : "Preparar"}
</button>
```

(usar el setter real de `rows`; si el archivo usa un reductor o `actualizarRenglon`, usar eso.)
5. Al final del JSX, si `preparando`: `<DialogoPreparar preparacionId={preparando.preparacionId} cliente={cliente} permisos={…} onListo={({ hojas }) => { setRows((rs) => rs.map((x) => (x.key === preparando.key ? { ...x, qty: hojas } : x))); setPreparando(null); }} onCerrar={() => setPreparando(null)} />`. Los permisos de cliente se pasan como props nuevas de `Pos` desde `app/(shell)/ventas/page.tsx`, calculados igual que en `foto-carnet/page.tsx`.
6. En `cobrar()`, en `lines: rows.map((r) => ({ …, preparacionId: r.preparacionId ?? null }))`.
7. En `cobrar()`, antes del bloque `if (pedido.hay && cliente)`: `if (pedido.hay && rows.some((r) => r.preparacionId)) { setError("Las fotos preparadas se cobran solas: sacá los trabajos de pedido a otro ticket."); return; }`.
8. Si el renglón con preparación se borra del ticket, no hace falta tocar la base: queda en "Preparado sin cobrar".

- [ ] **Step 6: Pruebas, typecheck y prueba en el navegador**

Run: `pnpm --filter fotoffice test && pnpm --filter fotoffice typecheck`
Expected: PASS.

En el navegador: crear el producto "Foto carnet" con producción Kodak 10x15 (Task 9), agregarlo al ticket, **Preparar**, subir foto, armar plancha con 2 hojas, **Listo** → el renglón queda con cantidad 2 y "Editar fotos"; **Cobrar** en efectivo → venta registrada. Verificar con una consulta (Neon, rama de desarrollo usada por `next dev`) que la preparación tiene `saleItemId` igual al id del renglón. Repetir con dos pestañas: cobrar el mismo ticket en la segunda debe dar "Esa preparación ya se cobró en otra venta."

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/sales "apps/fotoffice/app/(shell)/ventas"
git commit -m "Mostrador: preparar la foto carnet desde el ticket y atarla a la venta al cobrar"
```

---

### Task 15: Pantalla "Impresiones" (colas) y menú

**Files:**
- Create: `app/(shell)/ventas/impresiones/page.tsx`, `app/(shell)/ventas/impresiones/fila-acciones.tsx`
- Modify: `lib/modules/submodules.ts` (entradas "Impresiones" e "Impresión" bajo Ventas, junto a "Foto carnet")
- Modify: `lib/shell/nav-keywords.ts` (palabras: "imprimir", "kodak", "epson", "cola", "carnet")
- Modify: `components/shell/nav-icons.ts` (ícono `Printer` si no está)

**Interfaces:**
- Consumes: `colas` (Task 10), `anularPreparacionAction` (Task 10).

- [ ] **Step 1: Página**

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { colas } from "@/lib/impresion/preparaciones";
import { FilaAcciones } from "./fila-acciones";

export const dynamic = "force-dynamic";

const hora = (iso: string) => new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Lo que hay que imprimir, lo preparado sin cobrar y lo que salió hoy de cada impresora. */
export default async function ImpresionesPage() {
  const { workspace } = await requireSalesStaff();
  const c = await colas(workspace.id, new Date());
  return (
    <div className="space-y-6">
      <PageHeader title="Impresiones" description="Para imprimir, preparado sin cobrar e impreso hoy." />
      <Seccion titulo="Para imprimir" vacia="No hay nada cobrado esperando impresión." filas={c.paraImprimir} />
      <Seccion titulo="Preparado sin cobrar" vacia="Todo lo preparado está cobrado." filas={c.sinCobrar} />
      <section className="fo-card p-5">
        <h2 className="mb-3 text-base font-semibold">Impreso hoy</h2>
        {c.impresoHoy.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no salió ninguna hoja hoy.</p> : (
          <ul className="divide-y text-sm">
            {c.impresoHoy.map((r) => (
              <li key={r.registroId} className="flex justify-between py-2">
                <span>{r.salida} · {r.tamano} · {r.hojas} {r.hojas === 1 ? "hoja" : "hojas"}{r.motivo === "DESCARTADA" ? " · descartada" : r.motivo === "PRUEBA" ? " · prueba" : ""}</span>
                <span className="flex gap-3">
                  {r.hojaId ? <Link className="underline" href={`/imprimir/hoja/${r.hojaId}`} target="_blank">Reimprimir</Link> : null}
                  <span className="text-[var(--fo-muted)]">{hora(r.hora)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Seccion({ titulo, vacia, filas }: { titulo: string; vacia: string; filas: Awaited<ReturnType<typeof colas>>["paraImprimir"] }) {
  return (
    <section className="fo-card p-5">
      <h2 className="mb-3 text-base font-semibold">{titulo}</h2>
      {filas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">{vacia}</p> : (
        <ul className="divide-y text-sm">
          {filas.map((f) => (
            <li key={f.preparacionId} className="flex items-center justify-between gap-3 py-2">
              <span>{f.producto ?? "Foto carnet"} · {f.cliente ?? "sin cliente"} · {f.estado === "IMPRESA" ? "impresa" : f.estado === "LISTA" ? "lista" : "a medio preparar"}</span>
              <FilaAcciones preparacionId={f.preparacionId} hojaId={f.hojaId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

`fila-acciones.tsx` (cliente): botón **Imprimir** (`window.open(`/imprimir/hoja/${hojaId}`)`, deshabilitado sin `hojaId`) y **Anular** con `confirm("¿Anular esta preparación?")` → `anularPreparacionAction` → `router.refresh()` (en esta app `revalidate` no alcanza para refrescar la pantalla abierta).

- [ ] **Step 2: Menú**

En `lib/modules/submodules.ts`, después de la entrada de `/ventas/foto-carnet`:

```ts
  {
    href: "/ventas/impresiones",
    label: "Impresiones",
    icon: "Printer",
    description: "Lo que hay que imprimir, lo preparado sin cobrar y lo que salió hoy.",
    requiresManage: false,
    activeMatch: "under",
  },
```

y otra para `/ventas/impresion/configuracion` con `label: "Impresoras"`, `icon: "Settings2"` (o el que use el resto de configuraciones), `requiresManage: true`. Agregar `Printer` en `components/shell/nav-icons.ts` si no está, y las palabras clave en `nav-keywords.ts` siguiendo el formato del archivo.

- [ ] **Step 3: Typecheck y navegador**

Run: `pnpm --filter fotoffice typecheck`
Expected: PASS. En el navegador, `/ventas/impresiones` muestra las tres listas con lo hecho en Task 14.

- [ ] **Step 4: Commit**

```bash
git add "apps/fotoffice/app/(shell)/ventas/impresiones" apps/fotoffice/lib/modules/submodules.ts apps/fotoffice/lib/shell/nav-keywords.ts apps/fotoffice/components/shell/nav-icons.ts
git commit -m "Ventas → Impresiones: colas para imprimir, sin cobrar e impreso hoy"
```

---

### Task 16: Purga diaria de preparaciones

**Files:**
- Modify: `app/api/cron/adjuntos/route.ts`

- [ ] **Step 1: Sumar la purga**

Importar `purgarPreparaciones` y, junto a `purgarCarpetas(ahora)`:

```ts
    // Preparaciones de impresión de más de 30 días (originales, vistas y finales). La copia del
    // original de carnet en la ficha del cliente NO se toca: es un adjunto aparte.
    const preparaciones = await purgarPreparaciones(ahora);
```

y sumar `preparaciones` al JSON de respuesta.

- [ ] **Step 2: Typecheck y pruebas**

Run: `pnpm --filter fotoffice typecheck && pnpm --filter fotoffice test -- lib/impresion`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/app/api/cron/adjuntos/route.ts
git commit -m "Impresión: la purga diaria borra las preparaciones de más de 30 días"
```

---

### Task 17: Verificación completa, migraciones aplicadas y PR

- [ ] **Step 1: Todo en verde**

Run: `pnpm --filter fotoffice test && pnpm --filter fotoffice typecheck && pnpm --filter fotoffice lint && pnpm --filter fotoffice build`
Expected: todo PASS; el typecheck termina sin "heap out of memory".

- [ ] **Step 2: Recorrido completo en el navegador (con `next dev`, no con un Preview de Vercel)**

1. Configuración → Impresión: aparecen Kodak 305 y Epson L800; abrir la hoja de prueba 10x15 de la Kodak.
2. Ficha de producto: "Foto carnet" → Kodak · 10x15 · por hoja; "Foto carnet económica" → Epson · 10x15. Intentar "Copia" en la Epson → error.
3. Mostrador: Foto carnet al ticket → Preparar → foto vertical de celular → 4×4 → retoque → plancha → Listo → cantidad actualizada → **recargar la página** → ver la preparación en Impresiones → "Preparado sin cobrar".
4. Nuevo ticket con cliente → Preparar → Imprimir (se abre la página, sale el cuadro de impresión a 102 × 152 mm) → "Salió mal, reimprimir" → "Salió bien" → Cobrar → Impresiones muestra dos registros (descartada + normal) y la ficha del cliente tiene "Foto carnet original DD-MM-AAAA.jpg".
5. Nuevo carnet para el mismo cliente → "Fotos anteriores" → usar la anterior → plancha sin volver a subir.
6. Foto carnet suelta (sin Mostrador) → Epson A4 → registrar.

Capturar pantalla de la plancha y de Impresiones para el PR.

- [ ] **Step 3: Aplicar las migraciones antes de fusionar**

Primero mostrar el SQL a Daniel y aplicarlo con su visto bueno, en este orden, contra la rama `development` del proyecto Neon `compramelafoto`:
1. `20261126120000_fotoffice_carpetas_vencen` — avisar que deja con vencimiento a 30 días todas las carpetas de trabajos que hoy tienen archivos y no vencen.
2. `20261126120001_fotoffice_impresion`.

Registrar cada una:

```bash
cd packages/db && set -a && . ../../apps/fotoffice/.env.local && set +a && npx prisma migrate resolve --applied 20261126120000_fotoffice_carpetas_vencen && npx prisma migrate resolve --applied 20261126120001_fotoffice_impresion
```

(confirmar antes que `.env.local` apunta a la base de producción de FOTOFFICE y no a otra; si apunta a otra rama, usar la cadena correcta de la rama `development`). Aplicarlas también en las demás bases que tienen el dominio de FOTOFFICE (las mismas que la etapa 1b de Ventas), con el mismo checksum.

- [ ] **Step 4: PR**

```bash
git push -u origin HEAD
gh pr create --title "Impresiones etapa 1: foto carnet sin perder calidad, impresión directa y registro de hojas" --body "…"
```

El cuerpo resume, en español y para alguien que no programa: qué cambia en el Mostrador, en Foto carnet y en la ficha del cliente; las dos migraciones y que ya están aplicadas; el vencimiento de carpetas a 30 días; capturas; y cierra con la línea de atribución de Claude Code.
