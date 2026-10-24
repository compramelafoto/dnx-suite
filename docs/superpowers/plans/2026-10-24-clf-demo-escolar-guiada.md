# Demo escolar guiada: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (núcleo, tareas 1-9) y
> superpowers:subagent-driven-development (piezas de producto, tareas 10-13, independientes entre sí).
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el super admin de CLF pueda preparar, recorrer y reiniciar una demo escolar completa en
producción con datos falsos, con un cuadro guía y cambio de vista fotógrafo/familia/colegio.

**Architecture:** Todo lo demo vive en `apps/compramelafoto/lib/demos/` (lógica pura testeable y
acciones con Prisma), con rutas de admin (`/admin/demos`, `/api/admin/demos/escolar/*`), una ruta de
cambio de vista (`/api/demo/vista`) y un cuadro guía montado en `app/layout.tsx`. Lo existente se toca
solo con guardas angostas: etiqueta `DEMO_PRESENTACION` y dominio `.test`.

**Tech Stack:** Next.js 16 (app router, `--webpack`), Prisma, pdf-lib, qrcode, sharp, tests con
`node:test` vía tsx (patrón de `package.json`).

**Spec:** `docs/superpowers/specs/2026-10-24-clf-demo-escolar-guiada-design.md`

## Global Constraints

- Etiqueta demo: `DEMO_PRESENTACION` en `User.tags`. Dominio de correos demo: `demo.compramelafoto.test`.
- Solo administra demos el usuario ADMIN con id `1` (`cuart.daniel@gmail.com`).
- Cookie de vuelta: `dnx_demo_vuelta`, httpOnly, mismas opciones base que `dnx_session`.
- Ningún destinatario `*.test` recibe correo (los tres caminos de envío).
- Nada flotante de la demo a la derecha; el cuadro guía va abajo a la izquierda.
- Textos al usuario en español rioplatense, "pesos" y no "$" en textos de guion.
- Sin migraciones de base: todo con columnas existentes (`User.tags`, `isTest`).
- Usar sólo APIs de Next 16 ya presentes en el repo (`cookies()` async, route handlers).

## Review Focus

1. Un usuario no admin (o un admin que no es el id 1) llama a `/api/demo/vista` o a
   `/api/admin/demos/*` → 403, sin crear sesión.
2. La cookie `dnx_demo_vuelta` apunta a una sesión vencida o revocada → la demo se considera
   inactiva, el cuadro guía no aparece y `vista` responde 403.
3. Un álbum de prueba de un fotógrafo común sigue bloqueando la preventa como hoy (el pago simulado
   no se habilita).
4. Pedidos de prueba de usuarios demo no aparecen en informes, finanzas ni liquidaciones de admin; sí
   con monto en los paneles del dueño demo.
5. «Reiniciar» dos veces seguidas, o antes de «Preparar», no falla.

---

### Task 1: Identidad demo, guardas puras y filtro de correos

**Files:**
- Create: `apps/compramelafoto/lib/demos/identidad.ts`
- Create: `apps/compramelafoto/lib/demos/identidad.test.ts`
- Modify: `apps/compramelafoto/lib/email.ts` (`sendEmail`), `apps/compramelafoto/emails/send.ts` (`sendEmail`), `apps/compramelafoto/lib/email-queue.ts` (`queueEmail`)
- Modify: `apps/compramelafoto/package.json` (script `test:demos`)

**Interfaces — Produces:**
- `DEMO_TAG = "DEMO_PRESENTACION"`, `DEMO_EMAIL_DOMAIN = "demo.compramelafoto.test"`, `DEMO_ADMIN_USER_ID = 1`
- `esUsuarioDemo(u: { tags?: string[] | null } | null | undefined): boolean`
- `esCorreoDePrueba(email: string): boolean` (true si el dominio termina en `.test`)
- `puedeAdministrarDemos(u: { id: number; role: string } | null): boolean` (role ADMIN y id 1)
- `filtrarDestinatariosDePrueba(to: string | string[]): { enviar: string[]; descartados: string[] }`

- [ ] Tests: `esCorreoDePrueba("x@demo.compramelafoto.test") === true`, `("a@gmail.com") === false`,
  `("A@FOO.TEST") === true`; `puedeAdministrarDemos({id:1,role:"ADMIN"})` true, `{id:521,role:"ADMIN"}`
  false, `{id:1,role:"PHOTOGRAPHER"}` false, `null` false; `esUsuarioDemo({tags:["DEMO_PRESENTACION"]})`
  true, `{tags:null}` false; `filtrarDestinatariosDePrueba(["a@x.test","b@gmail.com"])` →
  `{enviar:["b@gmail.com"],descartados:["a@x.test"]}`.
- [ ] Run `pnpm test:demos` → FAIL. Implement. Run → PASS.
- [ ] En los tres caminos de envío: si después de filtrar no queda destinatario, loguear
  `[DEMO] correo descartado` y devolver como enviado sin llamar al proveedor (misma forma de retorno
  que el camino "sin API key"). `queueEmail` no encola.
- [ ] Commit.

### Task 2: Sesión demo y cambio de vista

**Files:**
- Create: `apps/compramelafoto/lib/demos/sesion-demo.ts`
- Create: `apps/compramelafoto/lib/demos/vistas.ts` + `vistas.test.ts`
- Create: `apps/compramelafoto/app/api/demo/vista/route.ts`
- Create: `apps/compramelafoto/app/api/demo/estado/route.ts`

**Interfaces — Produces:**
- `type VistaDemo = "fotografo" | "familia" | "colegio"`
- `DEMO_RETURN_COOKIE = "dnx_demo_vuelta"`
- `getDemoActiva(): Promise<{ adminUserId: number; demo: "escolar" } | null>`: lee la cookie, valida la
  sesión con `getSessionUserByRawToken` y `puedeAdministrarDemos`.
- `entrarADemo(adminRawToken: string, destinoUserId: number): Promise<void>`: guarda la cookie de vuelta
  con el token del admin y emite sesión del destino con `setAuthCookie`.
- `salirDeDemo(): Promise<void>`: destruye la sesión demo actual, restaura `dnx_session` con el token
  guardado y borra la cookie.
- `usuarioParaVista(vista: VistaDemo, ids: { fotografoId: number; colegioUserId: number }): number`
  (familia → fotógrafo).
- `GET /api/demo/estado` → `{ activa: boolean, vista?: VistaDemo, guion?: "escolar" }` (vista según el
  rol del usuario de la sesión actual: SCHOOL_ORGANIZER → colegio; si no, el cliente decide entre
  fotógrafo y familia por la ruta).
- `POST /api/demo/vista` body `{ vista: VistaDemo | "salir" }` → `{ ok: true, destino: string }`;
  403 si `getDemoActiva()` es null o el destino no es `esUsuarioDemo`.

- [ ] Tests de `usuarioParaVista` (las tres vistas).
- [ ] Implementar. Los ids de destino se buscan por correo fijo de `lib/demos/escolar/datos.ts` (Task 3)
  y se verifica la etiqueta.
- [ ] Commit.

### Task 3: Datos y acciones de la demo escolar

**Files:**
- Create: `apps/compramelafoto/lib/demos/escolar/datos.ts` (constantes)
- Create: `apps/compramelafoto/lib/demos/escolar/fotos-provisorias.ts` + test
- Create: `apps/compramelafoto/lib/demos/escolar/preparar.ts`
- Create: `apps/compramelafoto/lib/demos/escolar/reiniciar.ts`
- Create: `apps/compramelafoto/app/api/admin/demos/escolar/[accion]/route.ts`
- Create: `apps/compramelafoto/app/admin/demos/page.tsx` + `DemosClient.tsx`
- Create: `apps/compramelafoto/scripts/demos/escolar/reemplazar-fotos.ts`

**Interfaces — Produces:**
- `DEMO_ESCOLAR` con: correos del fotógrafo (`fotografo@demo.compramelafoto.test`) y del colegio
  (`colegio@demo.compramelafoto.test`), handler `estudiodemo`, nombre de escuela
  `Escuela Demo Los Aromos`, slug de álbum `demo-escolar-los-aromos`, cursos
  `[{codigo:"S5", nombre:"Sala de 5 Naranja"}, {codigo:"6A", nombre:"6º grado A"}]` con los 20 alumnos
  de `docs/compramelafoto/demo-escolar/PROMPTS-FOTOS.md`, comisión del colegio 10 %, plantilla de
  sistema base `sys_librito_primaria_fin_de_ano_confeti`.
- `generarFotoProvisoria(opts: { nombre: string; curso: string; tipo: "retrato" | "grupal" }): Promise<Buffer>` (JPG por sharp desde SVG; 1200×1500 o 1800×1200)
- `prepararDemoEscolar(): Promise<ResumenDemo>` idempotente: usuarios (con `tags` demo, contraseña
  aleatoria no comunicada, `mpConnected` simulado si `ensureMpConnected` lo exige para subir), escuela,
  cursos, alumnos, organizer, álbum (`isTest`, `hiddenPhotosEnabled`, identificación por listado,
  comisión), copia de la plantilla de sistema al fotógrafo, packs y beneficio con `templateV2Id`,
  fotos que falten (vía `finalizeAlbumPhotoFromRaw`, incluida la del profesor desde
  `public/demos/escolar/profe.jpg`) y `runAnalysisPipeline` del álbum.
- `reiniciarDemoEscolar(): Promise<ResumenDemo>`: borra pedidos, preventas, selecciones, diseños,
  tokens, comisiones, consultas y grants del álbum o del fotógrafo demo; colegios, cursos y usuarios
  del colegio no sembrados; conserva plantillas, fotos, escuela y alumnos sembrados.
- `POST /api/admin/demos/escolar/{preparar|reiniciar|analizar|entrar}`: solo `puedeAdministrarDemos`.
  `entrar` llama a `entrarADemo` hacia el fotógrafo demo y devuelve `{ destino: "/fotografo/escuelas" }`.

- [ ] Test de `generarFotoProvisoria`: devuelve JPG (bytes `FF D8`) con el tamaño pedido.
- [ ] Implementar `datos.ts`, `preparar.ts`, `reiniciar.ts`, rutas y panel.
- [ ] Probar contra una rama Neon hija de producción con las secuencias de `Album` y `Photo`
  movidas a 9.000.000 (evita choques de claves R2). Correr preparar, reiniciar, reiniciar, preparar.
- [ ] Commit.

### Task 4: Cuadro guía reutilizable y guion escolar

**Files:**
- Create: `apps/compramelafoto/lib/demos/guiones/tipos.ts`, `navegacion.ts` + `navegacion.test.ts`, `escolar.ts`
- Create: `apps/compramelafoto/components/demos/CuadroGuia.tsx` (client), `components/demos/MontajeDemo.tsx` (server)
- Modify: `apps/compramelafoto/app/layout.tsx` (montar `<MontajeDemo />` al lado de `MainLayout`)
- Modify: `apps/compramelafoto/app/globals.css` (reglas `body[data-demo="1"]`)

**Interfaces — Produces:**
- `type PasoGuion = { id: string; vista: VistaDemo; ruta: string | ((ctx: CtxGuion) => string); titulo: string; texto: string; aclaracion?: { titulo: string; texto: string }; bot?: string }`
- `type CtxGuion = { albumSlug: string; albumId: number; schoolId: number; handler: string }`
- `GET /api/demo/estado` agrega `ctx: CtxGuion` cuando está activa.
- `siguientePaso(i, total)`, `pasoAnterior(i)`, `debeMostrarAclaracion(paso, yaVista: Set<string>)`

- [ ] Tests de navegación: no pasa de los bordes; la aclaración se muestra una sola vez por paso al
  avanzar y no al retroceder.
- [ ] `CuadroGuia`: abajo a la izquierda, minimizable, índice, anterior/siguiente, «Ir a la pantalla»,
  selector de vista (llama a `/api/demo/vista`, limpia `sessionStorage` de `photographer*` y
  `schoolOrganizer*`, recarga), «Salir de la demo». Teclas ← → (ignoradas si el foco está en un campo
  de texto). Paso actual en `localStorage` (try/catch). Tarjeta de aclaración centrada. Pone
  `document.body.dataset.demo = "1"`.
- [ ] CSS: con `body[data-demo="1"]`, la burbuja del bot (agregar `data-dnx-bot-bubble` en
  `packages/dnx-bot/src/ui/DnxBotBubble.tsx` y `components/bot/CompradorBotBubble.tsx`),
  `FloatingUploadBar` y los botones flotantes de `ClientAlbumView` pasan a la izquierda; ocultar los
  carteles de vista previa del dueño (agregar `data-demo-ocultar` a esos carteles).
- [ ] Guion `escolar.ts` con los 15 pasos del spec §10.
- [ ] Commit.

### Task 5: Pago simulado

**Files:**
- Create: `apps/compramelafoto/lib/demos/pago-simulado.ts` (`finalizeAlbumOrderSimulatedApproved`)
- Create: `apps/compramelafoto/app/pago-simulado/[orderId]/page.tsx` + `PagoSimuladoClient.tsx`
- Modify: `apps/compramelafoto/app/api/payments/simulated/confirm/route.ts`
- Modify: `apps/compramelafoto/app/api/precompra/order/test/route.ts` (sin cambios de contrato; solo si hace falta)
- Modify: `apps/compramelafoto/app/album/[slug]/preventa/PreventaPage.tsx` (rama de prueba)

**Interfaces:**
- Produces: `finalizeAlbumOrderSimulatedApproved(orderId: number): Promise<{ ok: boolean; error?: string }>`
  — copia el camino de `finalizeAlbumOrderMercadoPagoApproved` sin consulta a MP: comisión de
  plataforma, snapshot del pack, `ensureDigitalDelivery`, PAID + `mpPaymentId = "SIM-<orderId>"`,
  PAID_HELD, token del pack (sin correo), auditoría, `createOrganizerCommissionForPaidOrder`, espejo
  PrintOrder en PAID, `ensureAlbumPackDesignsForPaidOrder`. Sin referidos, sin correos, sin WhatsApp,
  sin `webhookEvent`.
- `simulated/confirm` con `approved`: si el dueño del álbum `esUsuarioDemo`, usa la función nueva;
  si no, el comportamiento actual.
- PreventaPage: si es vista de prueba **y** `catalog.album.demoPresentacion === true` (nuevo campo del
  catálogo público, calculado por el dueño), envía a `/api/precompra/order/test` y navega a
  `/pago-simulado/<orderId>`. Si no, igual que hoy.
- Página de pago simulado: monto, concepto, «Pagar» y «Rechazar». Pagar → confirm → igual que
  `SuccessClient`: `/cliente/pack/<orderId>` con preventa UX v2, o `/order/<pcoId>/selfies`.

- [ ] Test puro de la decisión: `usarPagoSimulado({ isTestPreview, demoPresentacion })`.
- [ ] Implementar y probar en local contra la rama.
- [ ] Commit.

### Task 6: Visibilidad por dueño demo, comisiones y cobros

**Files:**
- Create: `apps/compramelafoto/lib/demos/visibilidad.ts` + test
- Modify: `app/api/fotografo/school-orders/route.ts`, `app/api/fotografo/pedidos/route.ts`,
  `lib/school-organizer-commission-logic.ts`, `app/api/school-organizer/schools/[schoolId]/route.ts`,
  `.../operations/route.ts`, `.../commissions/request-payout/route.ts`, `lib/school-organizer-commission.ts`

**Interfaces — Produces:** `incluirPedidosDePrueba(viewer: { tags?: string[] | null } | null): boolean`

- [ ] Donde hoy se filtra `isTest: false` para el dueño o el colegio, usar el filtro solo si
  `!incluirPedidosDePrueba(viewer)`. En school-orders, para viewers demo, los pedidos de prueba se
  muestran con su estado y monto reales (no "DEMO" $0).
- [ ] `createOrganizerCommissionForPaidOrder`: si el pedido es `isTest` y el dueño del álbum no es demo,
  no crear comisión.
- [ ] `request-payout`: si el usuario es demo → 400 "En la demo no se solicitan cobros".
- [ ] Verificar que las listas de admin de comisiones/liquidaciones excluyen comisiones de pedidos de
  prueba (si no, agregar el filtro).
- [ ] Commit.

### Task 7: Guardas de correos reales para acciones de usuarios demo

**Files:** `lib/schools/invite-organizer.ts`, `app/api/admin/schools/[schoolId]/organizers/create-user/route.ts`

- [ ] Si el actor `esUsuarioDemo` y el correo no `esCorreoDePrueba` → error "En la demo usá un correo
  @demo.compramelafoto.test". Commit.

### Task 8: Verificación local de punta a punta

- [ ] `pnpm --filter compramelafoto typecheck` y `pnpm test:demos`.
- [ ] `next dev --webpack` contra la rama: recorrer el guion completo con el navegador.
- [ ] Commit, PR del núcleo, fusionar en verde.

### Task 9: Puesta en producción

- [ ] Tras el deploy: `/admin/demos` → Preparar → verificar álbum, fotos, análisis, selfie con la foto
  del profesor. Recorrer el guion en producción y reiniciar.

### Task 10: QR en etiquetas por lote (pieza de producto)

- `lib/design-v2/produccion.ts` `cargarLibritos` incluye el ítem de preventa; `etiquetas()` dibuja un
  QR a `/escolar/entrega/<token>` (token por `ensureFulfillmentQrTokenForPreCompraOrderItem`); para
  diseños sin ítem, sin QR (texto "sin QR") — test de layout de `etiquetas` con y sin token.

### Task 11: Pantalla de pedidos

- `app/fotografo/escuelas/pedidos/pantalla/page.tsx`: pantalla completa, contadores por paso de
  `embudo-pedidos-escolares`, grilla rotativa, refresco cada 15 s, botón «Pantalla completa». Enlace
  desde la página de pedidos. Reusar `/api/fotografo/school-orders`.

### Task 12: Probar plantilla con el listado de un curso

- En `TemplateSandboxClient.tsx`: selector colegio/curso (escuelas del fotógrafo), carga alumnos
  (`/api/fotografo/schools/[id]/roster-entries`), reemplaza `CLASS_LIST_SAMPLE` y deja pasar de alumno
  con ← → para `student.fullName`.

### Task 13: Perfil del colegio editable por su usuario

- `PATCH /api/school-organizer/schools/[schoolId]` (logo, teléfono, correo, dirección, descripción;
  nunca nombre ni dueño), con el acceso actual del organizer; formulario en `/escuela/[schoolId]`.
