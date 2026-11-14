# Cursos compartidos entre espacios — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el dueño de un curso grabado lo comparta con espacios elegidos (con su %, hasta 100%, y "gratis para tus socios"), además del Mercado público que ya existe.

**Architecture:** se amplía `CourseResaleAgreement` con `invitedByOwner` y `membersFree`. Las reglas puras (`lib/course-marketplace/reventa.ts`, `venta.ts`, `lib/course-classroom/beneficio.ts`) deciden; acciones del servidor y páginas del panel/portal sólo las aplican.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma, Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-13-cursos-compartidos-design.md`

## Global Constraints

- Textos en español rioplatense claro; "dinero", nunca "plata".
- Sin dependencias nuevas.
- Migración aditiva (sin DROP/RENAME/ALTER COLUMN), aplicada a mano en la rama Neon `br-old-rain-adwthzng` y registrada con `prisma migrate resolve --applied`.
- 100% o `membersFree` sólo si el dueño es el único beneficiario (`esSinReparto`).
- Con el split apagado, sólo se vende sin reparto: curso propio sin beneficiarios ajenos, o reventa al 100% de un curso sin beneficiarios ajenos.
- No tocar Clickatón. Comandos: `pnpm --filter fotoffice test`, `pnpm --filter fotoffice typecheck`.

## Review Focus

1. Socio de SFPR deja de ser socio activo → el curso gratis compartido deja de verse (vigencia contra `CourseAccess.workspaceId`, no contra el dueño).
2. Socio de dos espacios que comparten el mismo curso → un solo acceso (`@@unique([userId, courseId])`), sin error.
3. Invitar al 100% un curso con docente/productor beneficiario → rechazado en el servidor.
4. Reventa al 100% → cobra el que vende con su Mercado Pago; al 10% → "Disponible próximamente".
5. Invitado acepta una invitación cuyo curso ya no está publicado → no se activa.

---

### Task 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (model `CourseResaleAgreement`)
- Create: `packages/db/prisma/migrations/20270208090000_fotoffice_cursos_compartidos/migration.sql`
- Test: `apps/fotoffice/lib/course-marketplace/migracion-compartidos.test.ts`

- [ ] Agregar `invitedByOwner Boolean @default(false)` y `membersFree Boolean @default(false)` con comentario `///`.
- [ ] SQL: `ALTER TABLE "CourseResaleAgreement" ADD COLUMN "invitedByOwner" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "membersFree" BOOLEAN NOT NULL DEFAULT false;`
- [ ] Test con el patrón de `migracion-reventa.test.ts`: carpeta existe y es la última, marca única, sin DROP/RENAME/ALTER COLUMN, contiene ambas columnas, el esquema las declara.
- [ ] `pnpm --filter @repo/db exec prisma generate` y correr el test. Commit.

### Task 2: Reglas puras de la invitación y del acuerdo

**Files:** Modify `lib/course-marketplace/reventa.ts`; Test `lib/course-marketplace/reventa.test.ts`

**Produces:**
- `validarInvitacion(input: { porcentajeBps: number | null; gratisSocios: boolean; esPropio: boolean; invitadoEsDueno: boolean; sinReparto: boolean; grabadoPublicadoConPrecio: boolean; acuerdoVigente: boolean }): string[]` — % de 1 a 100 (`> 0 && <= BPS_TOTAL`); 100% o `gratisSocios` exigen `sinReparto`.
- `estadoAlPedir(pedidoBps, sugeridoBps, pideGratis = false)`: `PENDIENTE` si pide gratis.
- `validarPedidoDeReventa` suma `pideGratis: boolean` y `sinReparto: boolean`: pedir gratis exige `sinReparto`.
- `aplicarAccion(acuerdo: { status; pausadoPor; invitadoPorDueno: boolean }, accion, lado)`: APROBAR/RECHAZAR los hace `REVENDEDOR` si `invitadoPorDueno`, si no `DUENO`. El código de error sigue `no-es-dueno` (mensaje: "Sólo puede responder la otra parte.").
- Textos nuevos en `MENSAJES_DE_ACUERDOS`: `invitado` ("Invitación enviada."), `aceptado`, `curso-no-disponible`.

- [ ] Tests: invitación 100% sin reparto ok; 100% con beneficiario ajeno rechaza; gratis con beneficiario ajeno rechaza; 0% y 101% rechazan; invitar a sí mismo rechaza; en invitación el revendedor aprueba y el dueño no; en pedido normal sigue igual; pedir gratis → PENDIENTE.
- [ ] Implementar, correr `vitest run lib/course-marketplace/reventa.test.ts`. Commit.

### Task 3: Venta sin reparto al 100%

**Files:** Modify `lib/course-marketplace/venta.ts`, `lib/course-marketplace/vitrina.ts`, `app/actions/public-course-enrollment.ts`, `lib/presential-courses/checkout.ts`; Test `lib/course-marketplace/venta.test.ts`

- [ ] `decidirVenta` suma `reventaBps: number | null`: `revendido && reventaBps === BPS_TOTAL && estado.tipo === "SIN_REPARTO"` → `SIN_REPARTO`. Tests: 100% sin beneficiarios → SIN_REPARTO; 100% con beneficiario ajeno → PROXIMAMENTE (split apagado); 10% → PROXIMAMENTE.
- [ ] Inscripción pública: pasar `reventaBps: acuerdo?.shareBps ?? null`; en SIN_REPARTO, `owner` = `cargarDueno(branding.workspaceId)` (quien vende); guardar `resaleAgreementId: acuerdo?.id ?? null` siempre.
- [ ] Checkout: cargar `resaleAgreement: { select: { shareBps: true } }`; rechazar si `decidirVenta({ estado, revendido: Boolean(resaleAgreementId), reventaBps, splitHabilitado: false })` no es SIN_REPARTO; `owner` = `cargarDueno(inscripcion.workspaceId)`.
- [ ] Vitrina: pasar `reventaBps: a.shareBps`. Typecheck + tests. Commit.

### Task 4: Gratis para socios del que recibe

**Files:** Modify `lib/course-classroom/beneficio.ts`, `lib/course-classroom/mis-cursos.ts`; Tests `beneficio.test.ts`, `mis-cursos.test.ts`

- [ ] `puedeAnotarseGratis` suma `compartidoGratisCon: ReadonlySet<string>` (espacios con acuerdo `ACTIVO` + `membersFree` para ese curso). Vale si es propio (regla actual) **o** `compartidoGratisCon.has(workspaceDelSocio)` (con el curso publicado y grabado). Tests de ambos casos y de "otra-institucion" cuando no hay acuerdo.
- [ ] `anotarseGratis`: cargar los acuerdos; crear `CourseEnrollment` y `CourseAccess` con `workspaceId = socio.workspace.id` y `resaleAgreementId` del acuerdo cuando es compartido.
- [ ] `cursosGratisParaSocio(workspaceId, userId)`: OR con `resaleAgreements: { some: { resellerWorkspaceId: workspaceId, status: "ACTIVO", membersFree: true } }` (más las condiciones de publicado/grabado).
- [ ] `mis-cursos`: seleccionar `workspace: { select: { id, name } }` del acceso; la vigencia `MEMBER_BENEFIT` y la agrupación usan **`a.workspace`** (en `agruparMisCursos` y `cargarAccesoVigente`). `AccesoParaMisCursos` suma `workspace`. Test: acceso gratis dado por SFPR con socia activa en SFPR y no en el dueño → VIGENTE; al revés → oculto.
- [ ] Tests + commit.

### Task 5: Acción de invitar y respuesta del invitado

**Files:** Modify `app/actions/course-resale.ts`, `lib/course-marketplace/aviso-reventa.ts` (+ test), `lib/course-marketplace/acuerdos.ts`, `app/(shell)/dashboard/mercado-de-cursos/acuerdos/page.tsx`

- [ ] `invitarAEspacioAction(courseId, prev: EstadoFormulario, formData)`: campos `workspaceId`, `porcentaje`, `gratis` ("on"). Exige `gestion()` y curso propio con `CURSO_REVENDIBLE`; destino con módulo de cursos encendido; `validarInvitacion`; crea o reabre (RECHAZADO/TERMINADO) el acuerdo con `invitedByOwner: true`, `membersFree`, `status: "PENDIENTE"`, `memberDiscountBps: 0`. Avisa por correo a los dueños del invitado (`buildAvisoInvitacionACompartirEmail({ dueno, curso, porcentaje, gratis, enlace })`).
- [ ] `cambiarEstadoDeReventaAction`: pasar `invitadoPorDueno`; para APROBAR/REANUDAR de una invitación no exigir `offeredToResellers`, sí que el curso siga `CURSO_REVENDIBLE` (si no, `curso-no-disponible`). El correo de respuesta va a los dueños del **otro** lado.
- [ ] `pedirReventaAction`: leer `gratis`, pasar `pideGratis`/`sinReparto`, guardar `membersFree`.
- [ ] `AcuerdoVista` suma `invitadoPorDueno`, `membersFree`, `alumnos` (cantidad de `CourseAccess` con `workspaceId` del revendedor o `enrollment.resaleAgreementId`). Página de acuerdos: en "Cursos que vendés", una invitación PENDIENTE muestra Aceptar/Rechazar; en "Quién vende tus cursos", una invitación PENDIENTE muestra "Esperando respuesta" y Cancelar; "Gratis para sus socios" y alumnos en el resumen; enlace "Ver curso" a la vista del Task 6. Renombrar títulos a "Cursos compartidos".
- [ ] Test del correo nuevo, typecheck, commit.

### Task 6: Pantallas del dueño y del que recibe

**Files:**
- Create: `components/course-marketplace/compartir-curso-form.tsx` (client, `useActionState(invitarAEspacioAction.bind(null, courseId))`)
- Modify: `app/(shell)/dashboard/courses/[courseId]/page.tsx` (sección "Compartir")
- Create: `app/(shell)/dashboard/mercado-de-cursos/acuerdos/[agreementId]/page.tsx`
- Create: `lib/course-marketplace/compartidos.ts` (`espaciosParaCompartir(workspaceId)`, `cargarCursoCompartido(agreementId, workspaceId)`)

- [ ] Sección "Compartir" en la ficha: visibilidad (Privado / Público / Compartido con N espacios), la oferta pública existente, la lista de acuerdos del curso (espacio, %, gratis, estado, alumnos) y el formulario: selector de espacio (los que tienen el módulo de cursos encendido, menos el propio y los con acuerdo vigente), % y casilla "Gratis para sus socios". Si el curso tiene beneficiarios ajenos, la casilla y el 100% se deshabilitan con la explicación.
- [ ] Vista de solo lectura para cualquiera de los dos lados del acuerdo: ficha, precio, su parte por venta, lista de clases (título, duración, muestra) y alumnos de ese espacio (nombre, correo, origen, % visto). 404 si el espacio activo no es parte.
- [ ] Typecheck, lint, tests. Commit.

### Task 7: Verificación y entrega

- [ ] `pnpm --filter fotoffice test`, `typecheck`, `lint` en verde.
- [ ] Probar en local con la base de producción **sólo lectura** de pantallas (sin server actions a ciegas).
- [ ] PR; CI verde; aplicar la migración a mano + `migrate resolve`; fusionar sin `--auto`; verificar en `fotoffice.com` el panel de acuerdos y la ficha del curso.
