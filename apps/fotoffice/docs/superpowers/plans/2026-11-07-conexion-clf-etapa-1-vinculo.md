# Conexión FOTOFFICE ↔ CLF · Etapa 1: vínculo con el álbum — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un pedido (o un proyecto sin pedido) de FOTOFFICE quede unido a un álbum de CompraMeLaFoto, se vea en su ficha y alimente la variable `[preventa_enlace]` en contratos y mensajes.

**Architecture:** CLF suma una ruta pública chica de sólo lectura (`/api/public/album/[slug]/resumen`). FOTOFFICE interpreta el enlace pegado, consulta esa ruta de servidor a servidor y guarda una foto del álbum en la tabla nueva `FotofficeClfVinculo`. La variable sale de esa tabla y no se consulta CLF al completar un contrato.

**Tech Stack:** Next.js (versión del repo; leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma con `@repo/db`, vitest (FOTOFFICE), `node:test` vía tsx (CLF).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-07-conexion-fotoffice-clf-design.md` (§4).

## Global Constraints

- Todo texto de pantalla va en español rioplatense claro; decir «dinero», nunca «plata».
- La ruta de CLF devuelve **sólo** `{ id, titulo, slug, tienePreventa, preventaCierraEl }`: ningún dato de compradores ni de alumnos.
- Los álbumes de prueba (`isTest`) y los borrados (`deletedAt`) responden 404.
- Dominios aceptados: `compramelafoto.com` y `www.compramelafoto.com`, con `https`. Rutas aceptadas: `/album/<slug>`, `/album/<slug>/preventa` (y cualquier subruta de `/album/<slug>/…`) y `/a/<id>`.
- `[preventa_enlace]` = `https://www.compramelafoto.com/album/<slug>/preventa` si el álbum tiene o tuvo packs de preventa; si no, `https://www.compramelafoto.com/album/<slug>`; vacía sin vínculo.
- Un vínculo por pedido. Un proyecto tiene vínculo propio **sólo si no tiene pedido**; si tiene, muestra el del pedido sin poder editarlo.
- Permisos: ver la tarjeta = «ver» en Pedidos (o Proyectos); vincular o quitar = «Gestionar» en ese módulo. No se muestra dinero.
- La URL base de CLF sale de `CLF_PUBLIC_BASE_URL` (por omisión, `https://www.compramelafoto.com`). Tiempo máximo de la consulta: 8 s.
- Migración de FOTOFFICE: `packages/db/prisma/migrations/20270128090000_fotoffice_clf_vinculo/migration.sql`, escrita a mano. Se aplica en la rama Neon `development` (`br-old-rain-adwthzng`) y se registra en `_prisma_migrations` **antes** de fusionar. El esquema es compartido: la tabla también se crea, vacía, en las otras bases que aplican migraciones `fotoffice_` (ver `packages/db/docs/MIGRACION-*.md`).
- El contrato 2026-0001 ya firmado no se toca.

## Review Focus

1. Enlace pegado con espacios, sin `https://`, con `?utm=…` o `#…` → se acepta igual y se normaliza.
2. Enlace de otro dominio que contiene «compramelafoto.com» (por ejemplo, `compramelafoto.com.evil.io` o `evil.io/?u=compramelafoto.com`) → se rechaza.
3. CLF caído o lento → el vínculo no se guarda y el mensaje dice que no se pudo consultar CLF, no que el álbum no existe.
4. Preventa ya cerrada (todos los packs vencidos o inactivos) → se vincula igual y la variable sigue dando `/preventa`.
5. Una persona sin «Gestionar» llama a la acción directamente → «No tenés permiso» y no se escribe nada.

---

### Task 1: Ruta pública de resumen del álbum en CLF

**Files:**
- Create: `apps/compramelafoto/lib/public-album/resumen.ts`
- Create: `apps/compramelafoto/lib/public-album/resumen.test.ts`
- Create: `apps/compramelafoto/app/api/public/album/[slug]/resumen/route.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:fotoffice-vinculo`)
- Modify: `.github/workflows/chequeos.yml` (paso que corre ese script, junto a los demás `pnpm --filter compramelafoto test:*`)

**Interfaces:**
- Produces: `GET /api/public/album/[slug]/resumen` → 200 `ResumenAlbumPublico` o 404 `{ error }`. Si `slug` es sólo dígitos, se busca por `Album.id`.
- Produces: `type ResumenAlbumPublico = { id: number; titulo: string; slug: string; tienePreventa: boolean; preventaCierraEl: string | null }` (ISO).
- Produces: `armarResumen(album: { id: number; title: string; publicSlug: string; isTest: boolean; deletedAt: Date | null }, packs: { validUntil: Date | null }[]): ResumenAlbumPublico | null`.

- [ ] **Step 1: Write the failing tests** en `resumen.test.ts` (`node:test`):
  - `armarResumen` con 3 packs (`validUntil` 10/11, 15/11 y null) → `tienePreventa: true` y `preventaCierraEl` = el ISO del 15/11.
  - Sin packs → `tienePreventa: false` y `preventaCierraEl: null`.
  - Con `isTest: true` o `deletedAt` cargado → `null`.
  - Las claves del resultado son exactamente `["id","preventaCierraEl","slug","tienePreventa","titulo"]` (ordenadas). Esto fija la lista blanca de campos.
- [ ] **Step 2: Run** `pnpm --filter compramelafoto test:fotoffice-vinculo` → FAIL (no existe `armarResumen`).
- [ ] **Step 3: Implement `armarResumen`.** La ruta lee `prisma.album.findFirst({ where: slug numérico ? { id } : { publicSlug }, select: { id, title, publicSlug, isTest, deletedAt } })` y `prisma.packDefinition.findMany({ where: { albumId }, select: { validUntil: true } })`. Cuenta **todos** los packs, activos o no. Si `armarResumen` da `null`, responde 404. Cabecera `Cache-Control: public, max-age=60`. Se ejecuta con `runtime = "nodejs"` y `dynamic = "force-dynamic"`, igual que `precompra/route.ts`.
- [ ] **Step 4: Run** `pnpm --filter compramelafoto test:fotoffice-vinculo` → PASS.
- [ ] **Step 5: Commit** «Sumar a CLF la ruta pública de resumen del álbum».

### Task 2: Interpretar el enlace y consultar CLF desde FOTOFFICE

**Files:**
- Create: `apps/fotoffice/lib/clf/enlace.ts` (puro)
- Create: `apps/fotoffice/lib/clf/enlace.test.ts`
- Create: `apps/fotoffice/lib/clf/resumen.ts`
- Create: `apps/fotoffice/lib/clf/resumen.test.ts`

**Interfaces:**
- Consumes: la ruta de la Task 1.
- Produces (`enlace.ts`):
  - `type ReferenciaAlbumClf = { tipo: "slug"; slug: string } | { tipo: "id"; id: number }`
  - `interpretarEnlaceClf(texto: string): ReferenciaAlbumClf | null`
  - `enlaceDelAlbumClf(a: { slug: string; tienePreventa: boolean }, base?: string): string`. La base por omisión es `https://www.compramelafoto.com`.
- Produces (`resumen.ts`):
  - `type ResumenAlbumClf = { id: number; titulo: string; slug: string; tienePreventa: boolean; preventaCierraEl: Date | null }`
  - `leerResumenAlbumClf(ref: ReferenciaAlbumClf, deps?: { fetch?: typeof fetch; baseUrl?: string }): Promise<{ ok: true; resumen: ResumenAlbumClf } | { ok: false; codigo: "NO_EXISTE" | "SIN_CONEXION" }>`

- [ ] **Step 1: Write the failing tests** en `enlace.test.ts`:
  - `"https://www.compramelafoto.com/album/escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92/preventa"` → `{ tipo:"slug", slug:"escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92" }`.
  - `"  compramelafoto.com/album/abc-1?utm_source=wa#x "` → `{ tipo:"slug", slug:"abc-1" }`.
  - `"https://www.compramelafoto.com/a/1283"` → `{ tipo:"id", id:1283 }`.
  - Dan `null`: `"https://compramelafoto.com.evil.io/album/x"`, `"https://evil.io/?u=compramelafoto.com/album/x"`, `"http://www.compramelafoto.com/album/x"` (sin `https`), `"https://www.compramelafoto.com/"` y `"texto cualquiera"`.
  - `enlaceDelAlbumClf({ slug:"abc", tienePreventa:true })` → `"https://www.compramelafoto.com/album/abc/preventa"`; con `false` → `"https://www.compramelafoto.com/album/abc"`.

  En `resumen.test.ts`, con un `fetch` falso:
  - Un 200 se convierte en `ok:true`, con `preventaCierraEl` como `Date`.
  - Un 404 da `NO_EXISTE`.
  - Un 500, una excepción o un JSON sin `slug` dan `SIN_CONEXION`.
  - La URL pedida es `<base>/api/public/album/<slug|id>/resumen`, con el slug codificado.
- [ ] **Step 2: Run** `pnpm --filter fotoffice exec vitest run lib/clf` → FAIL.
- [ ] **Step 3: Implement.**
  - `interpretarEnlaceClf`: si al texto, ya recortado, le falta el esquema, se le antepone `https://`. Se parsea con `new URL`. Se exige `protocol === "https:"` y `hostname` exactamente igual a uno de los dos dominios. El slug tiene que cumplir `/^[a-z0-9-]{1,200}$/i`.
  - `leerResumenAlbumClf`: usa `signal: AbortSignal.timeout(8000)` y la base de `deps.baseUrl ?? process.env.CLF_PUBLIC_BASE_URL ?? "https://www.compramelafoto.com"`. Valida la forma de la respuesta antes de aceptarla.
- [ ] **Step 4: Run** `pnpm --filter fotoffice exec vitest run lib/clf` → PASS.
- [ ] **Step 5: Commit** «Interpretar enlaces de CLF y leer el resumen del álbum».

### Task 3: Tabla del vínculo, lógica con permisos y acciones

**Files:**
- Create: `packages/db/prisma/migrations/20270128090000_fotoffice_clf_vinculo/migration.sql`
- Modify: `packages/db/prisma/schema.prisma` (modelo nuevo y relaciones inversas en `Workspace`, `FotofficePedido` y `FotofficeProyecto`)
- Create: `apps/fotoffice/lib/clf/vinculo.ts`
- Create: `apps/fotoffice/lib/clf/vinculo.test.ts`
- Create: `apps/fotoffice/app/actions/clf-vinculo.ts`

**Interfaces:**
- Consumes: `interpretarEnlaceClf`, `leerResumenAlbumClf` y `enlaceDelAlbumClf` (Task 2); `puedeGestionarPedidos`/`puedeVerPedidos` de `lib/pedidos/acceso`; `puedeGestionarProyectos`/`puedeVerProyectos` de `lib/proyectos/acceso`; el contexto de cada módulo (`contextoDePedidos` y su par en Proyectos).
- Produces:
  - Modelo `FotofficeClfVinculo { id String @id @default(cuid()); workspaceId String; pedidoId String? @unique; proyectoId String? @unique; clfAlbumId Int; albumSlug String; tituloSnapshot String; tienePreventa Boolean; preventaCierraEl DateTime?; creadoPorUserId Int?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }`, con FK en cascada a workspace, pedido y proyecto, `@@index([workspaceId])` y un CHECK en SQL: exactamente uno de `pedidoId`/`proyectoId` no nulo.
  - `type DestinoVinculo = { pedidoId: string } | { proyectoId: string }`
  - `type VinculoVista = { titulo: string; enlace: string; albumId: number; tienePreventa: boolean; preventaCierraEl: Date | null; heredadoDelPedido: boolean }`
  - `vinculoDe(workspaceId: string, destino: DestinoVinculo): Promise<VinculoVista | null>`. Para un proyecto con pedido, devuelve el del pedido con `heredadoDelPedido: true`.
  - `enlacePreventaDelPedido(workspaceId: string, pedidoId: string): Promise<string | null>`
  - `vincularAlbum(workspaceId: string, userId: number, destino: DestinoVinculo, texto: string, deps?): Promise<{ ok: true; vinculo: VinculoVista } | { ok: false; error: string }>`
  - `quitarVinculo(workspaceId: string, destino: DestinoVinculo): Promise<{ ok: true } | { ok: false; error: string }>`
  - Acciones `"use server"`: `vincularAlbumClfAction(destino: unknown, texto: unknown)` y `quitarVinculoClfAction(destino: unknown)`. Siguen el orden de `app/actions/pedidos.ts`: forma → contexto con «Gestionar» en el módulo del destino → lib → `revalidatePath` de la ficha.

- [ ] **Step 1: Write the failing tests** en `vinculo.test.ts` (Prisma y fetch falsos, como en los tests vecinos de `lib/pedidos`). Mensajes exactos:
  - Texto que no es enlace de CLF → `"Pegá el enlace del álbum o de la preventa de CompraMeLaFoto."`
  - `NO_EXISTE` → `"Ese álbum no existe en CompraMeLaFoto o no está publicado."`
  - `SIN_CONEXION` → `"No pudimos consultar CompraMeLaFoto. Probá de nuevo en un rato."`
  - Pedido de otro workspace → `"No encontramos el pedido."`
  - Proyecto con pedido → `"Este proyecto toma el álbum de su pedido. Vinculalo desde el pedido."`
  - Vincular dos veces el mismo pedido reemplaza el vínculo (upsert por `pedidoId`), no crea otro.
  - `enlacePreventaDelPedido` con un vínculo `tienePreventa:true` → `/album/<slug>/preventa`; sin vínculo → `null`.
  - En `app/actions/proyectos.test.ts` o en un `clf-vinculo.test.ts` nuevo: un usuario con «ver» pero sin «Gestionar» recibe `MENSAJES_PEDIDO.sinPermiso` y no se llama a la lib.
- [ ] **Step 2: Run** `pnpm --filter fotoffice exec vitest run lib/clf app/actions/clf-vinculo` → FAIL.
- [ ] **Step 3: Write the migration and the model;** después, `pnpm --filter @repo/db exec prisma generate`. El SQL crea la tabla, los índices únicos, el índice por workspace, las FK con `ON DELETE CASCADE` y `CHECK (("pedidoId" IS NULL) <> ("proyectoId" IS NULL))`.
- [ ] **Step 4: Implement `lib/clf/vinculo.ts` and the actions.**
- [ ] **Step 5: Run** los tests del Step 2 y `pnpm --filter fotoffice typecheck` → PASS.
- [ ] **Step 6: Commit** «Guardar el vínculo de pedidos y proyectos con su álbum de CLF».

### Task 4: Tarjeta «CompraMeLaFoto» en las fichas

**Files:**
- Create: `apps/fotoffice/components/clf/tarjeta-clf.tsx` (cliente)
- Modify: `apps/fotoffice/app/(shell)/pedidos/[id]/page.tsx` (tarjeta después de «Contratos», alrededor de la línea 492)
- Modify: `apps/fotoffice/app/(shell)/proyectos/[id]/page.tsx` (después de «Pedido vinculado», alrededor de la línea 153)

**Interfaces:**
- Consumes: `vinculoDe`, las acciones de la Task 3 y `VinculoVista`.
- Produces: `TarjetaClf({ destino: DestinoVinculo; vinculo: VinculoVista | null; puedeEditar: boolean })`.

- [ ] **Step 1: Implement the card**, con el mismo marco que las demás: `<section className="fo-card space-y-3">` y título `h2` «CompraMeLaFoto».
  - **Sin vínculo y con permiso:** campo «Enlace del álbum o de la preventa» y botón «Vincular». Sin permiso: «Este pedido no está vinculado con un álbum de CompraMeLaFoto.»
  - **Con vínculo:** título del álbum; «Preventa: cierra el dd/mm/aaaa» o «Preventa cerrada» si la fecha ya pasó (hora de Buenos Aires); botones «Abrir en CLF» (pestaña nueva, `rel="noopener noreferrer"`), «Copiar enlace» y, con permiso y sin herencia, «Quitar vínculo», que pide confirmación.
  - **Heredado del pedido:** la leyenda «Tomado del pedido» y sin botones de edición.
  - Los errores de la acción se muestran debajo del campo. Usa `useTransition` y `router.refresh()`, como `ContratosDelPedido`.
- [ ] **Step 2: Mount it.**
  - En el pedido, siempre que se pueda ver el pedido; `puedeEditar = puedeGestionarPedidos(ctx) && !cancelado`.
  - En el proyecto, con `puedeEditar = puedeGestionarProyectos(ctx) && !ficha.pedido`.
- [ ] **Step 3: Verify in the browser** con `next dev` contra una base local o de prueba (nunca producción):
  - Vincular el enlace de José Ingenieros desde un pedido de prueba: aparecen el título y «Preventa: cierra el 15/11/2026».
  - Copiar da `…/album/escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92/preventa`.
  - Al quitarlo, vuelve el campo.
  - La consola del navegador queda sin errores.
- [ ] **Step 4: Run** `pnpm --filter fotoffice typecheck` → PASS.
- [ ] **Step 5: Commit** «Mostrar el álbum de CLF en las fichas de pedido y proyecto».

### Task 5: Variable `[preventa_enlace]` en contratos y mensajes

**Files:**
- Modify: `apps/fotoffice/lib/contratos/variables.ts` (catálogo, `ContextoContratoEntrada.preventaEnlace: string | null` y `contextoContrato`)
- Modify: `apps/fotoffice/lib/contratos/contratos.ts` (`leerBaseDelTexto` suma `enlacePreventaDelPedido`)
- Modify: `apps/fotoffice/lib/contratos/muestra.ts` (entrada de muestra con un enlace de ejemplo)
- Modify: `apps/fotoffice/lib/plantillas/variables.ts` (`pedido.preventaEnlace` en el tipo y entrada `preventa_enlace` en el grupo «Pedido», tipos `PEDIDO`)
- Modify: `apps/fotoffice/lib/pedidos/recibos.ts` (`contextoDeMensajePedido` la carga sólo si `usa("preventa_enlace", textos)`)
- Test: `apps/fotoffice/lib/contratos/variables.test.ts`, `apps/fotoffice/lib/plantillas/variables.test.ts`

**Interfaces:**
- Consumes: `enlacePreventaDelPedido` (Task 3).
- Produces: la clave `preventa_enlace` en los dos catálogos. En los dos lleva la etiqueta «Enlace de la preventa en CLF» y la descripción «La dirección de la preventa (o del álbum) de CompraMeLaFoto vinculado al pedido. Vacía si el pedido no tiene álbum vinculado.»

- [ ] **Step 1: Write the failing tests.**
  - `completarContrato("Enlace: [preventa_enlace]", contextoContrato({...base, preventaEnlace: "https://www.compramelafoto.com/album/x/preventa"}))` → `texto === "Enlace: https://www.compramelafoto.com/album/x/preventa"`.
  - Con `preventaEnlace: null` y `"[si:preventa_enlace]Ver: [preventa_enlace][/si]"` → `texto === ""`.
  - `revisarPlantillaContrato("[preventa_enlace]")` → `{ ok: true }`.
  - En plantillas de mensajes, la variable existe, es de tipo `PEDIDO` y se completa con `pedido.preventaEnlace`.
- [ ] **Step 2: Run** `pnpm --filter fotoffice exec vitest run lib/contratos lib/plantillas` → FAIL.
- [ ] **Step 3: Implement.** En `contextoContrato`, el valor pasa por `limpio()`, igual que los demás textos.
- [ ] **Step 4: Run** `pnpm --filter fotoffice test` and `pnpm --filter fotoffice typecheck` → PASS.
- [ ] **Step 5: Commit** «Sumar la variable [preventa_enlace] a contratos y mensajes».

### Task 6: Producción

- [ ] **Step 1:** PR contra `main` con todas las tareas. Los controles de `chequeos.yml` tienen que dar verde.
- [ ] **Step 2:** Aplicar la migración en FOTOFFICE con `psql -v ON_ERROR_STOP=1` contra `DIRECT_URL` de `apps/fotoffice/.env.local` (rama `development`). Registrarla con `npx prisma migrate resolve --applied 20270128090000_fotoffice_clf_vinculo` desde `packages/db`. Verificar en `_prisma_migrations`.
- [ ] **Step 3:** Con todo en verde y el SQL aplicado, fusionar. Esperar que los dos deploys (CLF y FOTOFFICE) queden en Ready.
- [ ] **Step 4:** Verificar en producción:
  - `curl https://www.compramelafoto.com/api/public/album/escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92/resumen` devuelve el id 1283 y `tienePreventa: true`. Ojo con la caché del CDN (`age:`).
  - Vincular ese enlace en el pedido 2026-0030 de DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`).
  - Generar una vista de plantilla con `[preventa_enlace]` y comparar con la cláusula TERCERA del contrato 2026-0001: tiene que dar exactamente el mismo enlace.
