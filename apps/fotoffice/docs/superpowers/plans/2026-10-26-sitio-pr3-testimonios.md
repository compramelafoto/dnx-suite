# Sitio web PR 3 — Testimonios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada estudio reciba, modere y publique testimonios: enlace abierto, invitación personal desde la ficha del cliente/proyecto, pedido automático opcional, bloque TESTIMONIALS y página `/testimonios`.

**Architecture:** dos tablas nuevas (`FotofficeTestimonio`, `FotofficeTestimonioInvitacion`) + ajustes del workspace en JSON existente si hay uno de sitio (si no, tabla `FotofficeTestimonioAjustes`). Lógica en `apps/fotoffice/lib/testimonios/`, separada en dominio (reglas puras), repositorio, público e invitaciones, siguiendo la separación de `apps/clickaton/lib/testimonials/` (leerla como referencia; no importarla). Mensajes con el sistema de plantillas existente (`lib/plantillas`) con un tipo nuevo `TESTIMONIO` y la clave automática `TESTIMONIO_INVITACION`.

**Tech Stack:** Next.js del repo, Prisma, zod, vitest, R2 (foto del autor), `lib/plantillas`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md` (sección 6, PR 3). Depende del PR 1.

## Global Constraints

- SQL `packages/db/prisma/migrations/20261222120000_fotoffice_sitio_testimonios/migration.sql`, idempotente, sin FK a tablas existentes. Reemplaza el CHECK `FotofficeMessageTemplate_entityType` por **la lista vigente en producción** (leerla con `select pg_get_constraintdef(oid) from pg_constraint where conname='FotofficeMessageTemplate_entityType'`) más `'TESTIMONIO'`.
- Texto ≤1200; extracto ≤240; nombre ≤120; detalle ≤160; calificación 1–5 opcional.
- Estados: `PENDIENTE` | `PUBLICADO` | `RECHAZADO`. Orígenes: `IMPORTADO` | `FORMULARIO` | `INVITACION` | `CARGA_MANUAL`.
- Nada se publica sin `consentimiento = true`; publicar exige consentimiento (si es carga manual, el dueño marca «tengo permiso del autor»).
- El correo del autor nunca sale en ninguna lectura pública.
- Token de invitación: 32 bytes aleatorios en base64url; se guarda sólo el hash SHA-256; vence a los 90 días; un uso.
- Pedido automático: **apagado por omisión**; tope 30 por día por workspace; una sola invitación por (cliente, proyecto); días después de finalizar el proyecto: 7 por omisión (1–60).
- Freno del formulario abierto: campo trampa + 5 envíos por IP cada 10 minutos (patrón `checkRateLimit`).
- Foto del autor: JPG/PNG/WebP ≤5 MB, por `createFotofficeUploadUrl` con prefijo `fotoffice/<workspaceId>/sitio/testimonios/`.

## Review Focus

1. Invitación usada dos veces o vencida → página amable «Este enlace ya se usó / venció», nunca crea un segundo testimonio (Task 3).
2. Testimonio PENDIENTE o RECHAZADO → no sale en el bloque ni en `/testimonios` (Task 2).
3. Encender el automático con proyectos finalizados hace meses → sólo invita a los finalizados después de encenderlo (Task 5).
4. Cliente sin correo → el botón «Pedir testimonio» ofrece sólo WhatsApp con el enlace (Task 4).
5. Bloque con 0 publicados → no se dibuja (Task 2).

---

### Task 1: Tablas y tipo de plantilla

**Files:** `packages/db/prisma/schema.prisma`, migración, `apps/fotoffice/lib/plantillas/constantes.ts` (+ variables `[link_testimonio]`, `[nombre_estudio]` si no existe), `lib/plantillas/variables.ts`

**Interfaces:**
- `FotofficeTestimonio { id; workspaceId; texto; extracto String?; autorNombre; autorDetalle String?; autorFotoUrl String?; autorFotoKey String?; autorEnlace String?; autorEmail String?; calificacion Int?; estado String @default("PENDIENTE"); consentimiento Boolean @default(false); consentimientoAt DateTime?; consentimientoTexto String?; origen String; clientId String?; proyectoId String?; trabajoId String?; invitacionId String?; destacado Boolean @default(false); orden Int @default(0); moderadoPorUserId String?; moderadoAt DateTime?; origenExternoId String?; createdAt; updatedAt; @@index([workspaceId, estado, orden]); @@unique([workspaceId, origenExternoId]) }`
- `FotofficeTestimonioInvitacion { id; workspaceId; tokenHash String @unique; clientId String?; proyectoId String?; correo String?; nombreSugerido String?; detalleSugerido String?; estado String @default("ENVIADA") /* ENVIADA|RESPONDIDA|VENCIDA */; canal String?; enviadaAt DateTime @default(now()); respondidaAt DateTime?; venceAt DateTime; claveIdempotencia String? @unique; createdByUserId String?; @@index([workspaceId, estado]) }`
- `FotofficeTestimonioAjustes { workspaceId String @id; automaticoEncendido Boolean @default(false); diasDespues Int @default(7); encendidoAt DateTime?; avisarAlEquipo Boolean @default(true); updatedAt }`
- `TIPOS_PLANTILLA` suma `"TESTIMONIO"` (etiqueta «Testimonio»); `CLAVES_AUTOMATICO` suma `"TESTIMONIO_INVITACION"`; semilla de esa plantilla automática (correo y WhatsApp) con texto cálido en rioplatense que use `[link_testimonio]`.
- [ ] Tests existentes de `lib/plantillas` en verde (`constantes`, `semillas`, `definiciones`), más uno nuevo: la semilla de `TESTIMONIO_INVITACION` usa `[link_testimonio]`.
- [ ] Commit «FOTOFFICE: tablas de Testimonios y plantilla de invitación».

### Task 2: Dominio, repositorio y lectura pública + bloque TESTIMONIALS

**Files:** `apps/fotoffice/lib/testimonios/{dominio.ts,repositorio.ts,publico.ts}` + tests; `lib/website/blocks.ts`, `block-registry.tsx`, `dynamic-data(.server).ts`; `components/website/render/blocks/testimonials-block-view.tsx`; `app/w/[workspaceSlug]/testimonios/page.tsx`; `lib/website/public-modules.ts` (página `testimonios`, label «Testimonios», visible con ≥1 publicado)

**Interfaces:**
- `dominio.ts`: `validarTestimonio(input): { ok: true; datos } | { ok: false; errores: Record<string,string> }`; `puedePublicar(t): string | null`.
- `publico.ts`: `listarTestimoniosPublicos(workspaceId, { limite?: number; barajar?: boolean })` → `TestimonioPublico[] = { id, texto, extracto, autorNombre, autorDetalle, autorFotoUrl, autorEnlace, calificacion }` (destacados primero; resto barajado si `barajar`). `P2021` → vacío.
- Bloque `TESTIMONIALS` config `{ title?: string ("Lo que dicen de nosotros"); count: 3|6|9|12|0 (0 = todos); layout: "carousel"|"grid"; showCta: boolean (true); ctaLabel: string ("Dejá tu testimonio") }`, categoría COMUNICACION.
- [ ] Tests: dominio (largos, calificación fuera de rango, publicar sin consentimiento), público (sólo PUBLICADO, sin `autorEmail` en el objeto, destacados primero), bloque sin datos → null.
- [ ] Carrusel: tarjetas de alto natural (no estiradas a la más larga — lección de Clickatón), texto completo con «Leer más» si supera 400 caracteres.
- [ ] Commit «Sitio web: testimonios en el sitio».

### Task 3: Formulario público e invitación por enlace

**Files:** `app/w/[workspaceSlug]/testimonio/page.tsx` (+ `?t=<token>`), `app/actions/testimonio-publico.ts`, `app/api/w/[workspaceSlug]/testimonio/foto-url/route.ts`, `lib/testimonios/invitaciones.ts` + test

**Interfaces:**
- `crearInvitacion(workspaceId, { clientId?, proyectoId?, correo?, nombreSugerido?, detalleSugerido?, userId }): Promise<{ invitacionId: string; enlace: string }>`; `leerInvitacion(workspaceId, token): Promise<{ estado: "VALIDA"; inv } | { estado: "USADA" | "VENCIDA" | "INEXISTENTE" }>`; `enlaceDeTestimonio(workspaceSlug, token?)`.
- Acción `enviarTestimonio(prev, formData)`: con token válido → origen INVITACION, ata cliente/proyecto, marca RESPONDIDA en la misma transacción; sin token → FORMULARIO. Siempre PENDIENTE. Exige casilla de consentimiento con el texto «Acepto que [estudio] publique mi testimonio con mi nombre y foto en su sitio web.» Avisa al equipo (correo interno, mismo mecanismo que `CONSULTA_AVISO_EQUIPO`) si `avisarAlEquipo`.
- [ ] Tests de invitaciones: hash guardado ≠ token; segundo uso → USADA; vencida → VENCIDA; token de otro workspace → INEXISTENTE; uso concurrente (dos envíos) → uno solo crea.
- [ ] Commit «Sitio web: formulario de testimonio y enlace personal».

### Task 4: Panel — moderación y «Pedir testimonio»

**Files:** `app/(shell)/website/testimonios/page.tsx`, `app/actions/testimonios.ts`, `components/website/testimonios/*`; botón en la ficha del cliente y del proyecto (buscar dónde está hoy el botón «Mensaje» de `lib/plantillas/ficha.ts` y agregar al lado «Pedir testimonio»); `app/(shell)/website/testimonios/ajustes` (o pestaña) para el automático.

- [ ] Lista con pestañas Pendientes / Publicados / Rechazados, contador de pendientes en la sub-navegación; acciones publicar, rechazar, editar extracto y detalle, destacar, ordenar arrastrando, borrar; «Agregar testimonio» (carga manual con casilla «Tengo permiso del autor»).
- [ ] «Pedir testimonio»: crea la invitación y abre el compositor de mensajes existente con la plantilla `TESTIMONIO` preelegida (correo o WhatsApp), registrando el envío en la línea de tiempo como cualquier mensaje.
- [ ] Test de la acción: un usuario sin permiso de sitio no modera (`assertCanManageWebsite`).
- [ ] Commit «Sitio web: moderar y pedir testimonios».

### Task 5: Pedido automático

**Files:** `lib/testimonios/automatico.ts` + test, `app/api/cron/testimonios-invitaciones/route.ts`, `vercel.json` (cron diario `0 14 * * *`, 11 h AR)

- [ ] `candidatosParaInvitar(workspaceId, ahora)`: proyectos con estado finalizado (usar el estado real de `FotofficeProyecto` — leer `lib/proyectos`) cuya fecha de finalización ≥ `encendidoAt` y ≤ `ahora - diasDespues`, con cliente con correo, sin invitación previa para (cliente, proyecto); tope 30.
- [ ] Tests: proyectos finalizados antes de encender → excluidos; segundo día → no repite; tope 30.
- [ ] Envío con `TESTIMONIO_INVITACION` por `lib/plantillas/envio.ts` (respeta topes diarios de automáticos). Cron protegido como los demás (`CRON_SECRET`).
- [ ] Commit «Testimonios: pedido automático (apagado por omisión)».

### Task 6: Cierre

- [ ] Tipos, tests (`lib/testimonios`, `lib/plantillas`, `lib/website`), build.
- [ ] Aplicar SQL en la base de FOTOFFICE y `prisma migrate resolve --applied 20261222120000_fotoffice_sitio_testimonios` **antes de fusionar**.
- [ ] PR, CI verde, fusionar, verificar `/w/dnx-estudio/testimonio` (formulario) sin enviar nada real.
