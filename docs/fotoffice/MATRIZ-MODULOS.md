# FotoOffice — Matriz de módulos (Etapa 2)

**Fecha:** 2026-09-30
**Base:** `main` en `d942deb3` (2026-09-29).
**Método:** los 61 puntos del alcance de [CONTEXTO-SFPR.md](CONTEXTO-SFPR.md) §2, contrastados uno por uno contra el código. Solo lectura. No se corrieron tests ni se consultó la base.
**Autor:** Claude Code.

> Esta matriz es el entregable de la **Etapa 2 — Consolidación del inventario de módulos** del plan de trabajo de CONTEXTO-SFPR.md §11.
> Actualiza la "Matriz de etapas" de [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) §4, que es del 2026-08-27 y quedó atrás: después de esa fecha se construyeron Reservas, Sorteos, Caja, Clientes, Coberturas, Recomendados y Cursos grabados.

## Cómo leer los estados

Se usan los estados que pide la Etapa 2:

| Estado | Significa, en esta matriz |
|---|---|
| `PUBLICADO` | Está en `main` **y** se verificó que responde en producción. |
| `IMPLEMENTADO LOCALMENTE` | Está en `main`, con rutas, modelos, migración y tests, pero **no se verificó** que esté en producción. |
| `EN DESARROLLO` | Hay una parte construida y otra no. La columna "Falta" dice qué. |
| `APROBADO` | No hay código, pero sí un diseño o plan escrito en `docs/superpowers` o `apps/fotoffice/docs/superpowers`. |
| `PROPUESTO` | Solo figura en CONTEXTO-SFPR.md o en un roadmap. Sin diseño ni código. |
| `PENDIENTE` | Figura como "PENDIENTE DE DEFINIR": no se puede construir sin una decisión previa. |
| `DESCARTADO` | Se decidió no hacerlo, o quedó fuera de alcance de forma explícita. |
| `REQUIERE VERIFICACIÓN` | No se puede afirmar nada desde el código. |

### Por qué casi nada figura como `PUBLICADO`

Producción de FotoOffice **no se publica sola desde `main`**: según ESTADO-ACTUAL.md ("La causa raíz"), cada deployment de producción se promueve a mano con `vercel promote`. Por eso estar en `main` no prueba que algo esté en el aire.

Solo figura como `PUBLICADO` lo que ESTADO-ACTUAL.md verificó en producción el 2026-08-27: rutas del socio respondiendo 200 y la primera invitación real completada. Todo lo construido después figura como `IMPLEMENTADO LOCALMENTE` hasta que alguien lo compruebe en `fotoffice.com`.

Tampoco se sabe qué módulos tiene **encendidos** la SFPR: eso vive en la tabla `WorkspaceFeatureModule` de producción y no se consultó.

### Convenciones de las rutas de archivos

- `FO/` = `apps/fotoffice/`.
- Modelos: `packages/db/prisma/schema.prisma`.
- Migraciones: `packages/db/prisma/migrations/`.
- `specs/` y `plans/` sin prefijo = `docs/superpowers/…`; con `FO/docs/` = `apps/fotoffice/docs/superpowers/…`.

## Resumen

Puntos 1 a 56 del alcance:

| Estado | Cantidad | Puntos |
|---|---:|---|
| `PUBLICADO` (verificado el 2026-08-27) | 8 | 1, 4, 6, 7, 11, 12, 13, 15 |
| `IMPLEMENTADO LOCALMENTE` | 10 | 2, 5, 8, 16, 19, 30, 43, 45, 46, 48 |
| `EN DESARROLLO` | 15 | 3, 10, 14, 17, 20, 23, 26, 27, 28, 29, 31, 32, 39, 40, 42 |
| `APROBADO` | 1 | 18 |
| `PROPUESTO` | 18 | 21, 22, 24, 25, 33–38, 41, 44, 50–54, 56 |
| `PENDIENTE` | 3 | 9, 49, 55 |
| `DESCARTADO` | 1 | 47 |

Los puntos 57 a 60 no son de código y se tratan en §10; el 61 (reutilización), en §11.

---

## 1. Socios, cuotas y carnets — núcleo del MVP

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 1 | Gestión de socios y padrón | `PUBLICADO` | Alta, edición, ficha, listado, roles, deduplicación por documento. | Rutas `/members`, `/members/new`, `/members/[id]`. `FO/lib/members/{schema,access,audit,role-policy}.ts`, `FO/app/actions/members.ts`. Modelo `Member`. Migraciones `20260501130000_add_members_registry`, `20260815120000_reconcile_member_domain_base`. Tests `FO/lib/members/{schema,role-policy,link-isolation}.test.ts`. Doc `docs/fotoffice/ANALISIS-PADRON-SFPR.md`. Verificado en producción: ESTADO-ACTUAL.md §8.bis (152 socios). |
| 2 | Importación y exportación CSV | `IMPLEMENTADO LOCALMENTE` | **Importación:** se pega el CSV, se valida y se confirma; incluye un generador de prompt para ordenar datos desprolijos. Hay también importación del historial de pagos. **Exportación:** CSV filtrado, solo OWNER/ADMIN. | Ruta `/members/import`, `GET /api/members/export`. `FO/lib/members/import/*`, `FO/lib/members/export.ts`, `FO/lib/membership/history-import/*`. Tests `FO/lib/members/import/{parse,prompt,isolation}.test.ts`, `FO/lib/members/{export,export-isolation}.test.ts`. Script usado para la SFPR: `packages/db/scripts/sfpr-import-padron.mts`. |
| 3 | Normalización de DNI, CUIT y CUIL | `EN DESARROLLO` | Normaliza con o sin puntos y guiones y deduplica. **Falta:** validar el dígito verificador de CUIT/CUIL; hoy solo se cuentan dígitos, y CUIL se guarda como "CUIT". | `FO/lib/members/documents.ts`. Tests `FO/lib/members/documents.test.ts`. |
| 4 | Estados y categorías | `PUBLICADO` | Estados `ACTIVE` / `SUSPENDED` / `INACTIVE`, motivo de baja (deuda, sanción, renuncia), categorías libres por workspace y escala de cuota (plena, reducida, exenta). | Rutas `/members/categories`. Enums `MemberStatus`, `MemberLeftReason`, `MemberFeeScale`; modelo `MemberCategory`. Migración `20260824180000_membership_applications_and_dues`. Tests `FO/lib/members/category-options.test.ts`, `FO/lib/membership/category-for-scale.test.ts`. |
| 5 | Cuenta corriente del socio | `IMPLEMENTADO LOCALMENTE` | Cargos, pagos, imputaciones, saldo, saldo a favor, conciliación. | Visible en `/members/[id]` y `/portal/cuotas`. `FO/lib/membership/{balance,allocate,apply-credit,credit,reconcile}.ts`. Modelos `MembershipCharge`, `MembershipPayment`, `MembershipAllocation`. Tests `FO/lib/membership/{allocate,apply-credit,credit,reconcile-policy}.test.ts`. Diseño `FO/docs/specs/2026-09-06-cuenta-del-socio-conciliacion-y-saldo-a-favor-design.md`. |
| 6 | Cobro de cuotas | `PUBLICADO` | Pagos a mano, configuración (día de vencimiento, gracia, interés, umbrales de mora), valores de cuota con vigencia. | Rutas `/members/cuotas`, `/members/cuotas/configuracion`, `/members/cuotas/historial`. Modelos `MembershipDuesSettings`, `MembershipFeeValue`. Diseño `specs/2026-08-24-fotoffice-alta-socios-cobros-design.md`. Verificado 2026-08-27, aunque **sin uso**: 0 cuotas generadas en ese momento (ESTADO-ACTUAL.md §8.bis). |
| 7 | Mercado Pago | `PUBLICADO` | Checkout Pro sobre la cuenta de Mercado Pago de la propia institución (OAuth), con `marketplace_fee`. Webhook idempotente que vuelve a consultar el pago y conciliación cada hora. El Split 1:N sigue apagado. | `/api/payments/mp/webhook`, `/api/payments/mercadopago/connect/*`, cron `/api/cron/conciliar-cuotas`. `FO/lib/payments/connect/*`, `FO/app/actions/dues-payment.ts`. Tests `FO/lib/payments/connect/*.test.ts`, `FO/lib/membership/payment-outcome.test.ts`. Hubo correcciones del webhook entre el 29/09 y el 30/09 (PRs #280–#287). |
| 8 | Pago mensual | `IMPLEMENTADO LOCALMENTE` | Generación mensual automática y pago adelantado de hasta 6 meses al valor vigente de cada mes. | Cron `/api/cron/generar-cuotas` (06:00). `FO/lib/membership/{generate-monthly,monthly-plan,periods,advance}.ts`, `FO/app/actions/advance-dues.ts`. Tests `FO/lib/membership/{monthly-plan,periods,advance}.test.ts`. |
| 9 | Pago anual con bonificación | `PENDIENTE` | No existe. El adelanto tiene un tope deliberado de 6 meses y se cobra a precio pleno (`MAX_ADVANCE_MONTHS` en `FO/lib/membership/advance.ts`). La regla "10 cuotas y 2 meses bonificados" figura en CONTEXTO-SFPR.md, pero su tratamiento contable está "PENDIENTE DE DEFINIR". | CONTEXTO-SFPR.md, requisito 17 y preguntas abiertas. |
| 10 | Fee de FotoOffice / Super Admin | `EN DESARROLLO` | Comisión por workspace y módulo (5% por defecto). Con Mercado Pago se retiene por `marketplace_fee`; en pagos a mano queda como deuda. El Super Admin la edita y registra liquidaciones. Se aplica a cuotas, reservas y cursos presenciales. **Falta:** reportes de comisión más allá del libro. | `/admin/workspaces/[id]`, `FO/app/actions/platform-fee-admin.ts`. `FO/lib/platform-fee/*`. Modelos `WorkspaceModuleFee`, `WorkspaceFeeLedgerEntry`. Migraciones `20260824120000_workspace_module_fee`, `20260827120000_workspace_fee_ledger`, `20260910000000_fee_ledger_booking`. Tests `FO/lib/platform-fee/*.test.ts`. Plan `plans/2026-08-24-comision-de-plataforma.md`. |
| 11 | Carnets y credenciales | `PUBLICADO` | Carnet digital, verificación pública por QR, reimpresión, carnet impreso pago con cola de producción y entrega, operadores de impresión, PDF y diseñador de plantillas. | Rutas `/members/carnets`, `/members/carnets/permisos`, `/members/disenador`, `/portal/carnet`, `/c/[token]`, `/api/members/carnets/[cardId]/pdf`. `FO/lib/carnet/*` (14 archivos de test). Modelos `MemberCard`, `MemberCardEvent`, `MemberCardOperator`. Migración `20260826120000_member_cards`. Diseño `specs/2026-08-26-carnet-de-socio-design.md`. Verificado 2026-08-27, pero con **0 carnets emitidos**. |

## 2. Usuarios, portal y panel

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 12 | Usuarios, autenticación e invitaciones | `PUBLICADO` | La invitación guarda el token solo como hash SHA-256, vence, es de un solo uso, se puede revocar y registra si se entregó. Activación con contraseña, login con Google y recuperación de contraseña. | Rutas `/invitacion/[token]`, `/login`, `/recuperar/[token]`. `FO/lib/members/{invitations,invitation-tokens,invitation-email}.ts`, `FO/app/actions/{member-activation,accept-invitation}.ts`. Modelo `MemberInvitation`. Migraciones `20260821120000_fotoffice_member_invitation`, `20260823120000_member_invitation_delivery`. Tests `FO/lib/members/invitations.test.ts`, `FO/app/actions/member-activation.test.ts`. Doc `FO/docs/AUTH.md`. Primera invitación real completada: ESTADO-ACTUAL.md §8.bis. |
| 13 | Vinculación segura socio ↔ usuario | `PUBLICADO` | Todo en una transacción: toma la invitación con condiciones, rechaza si el socio ya está vinculado o si el usuario ya pertenece a otro socio, fija `Member.userId` solo si estaba vacío y compara el email de la sesión con el invitado. | `acceptMemberInvitation` en `packages/db/src/fotoffice-member-invitations.ts`. Tests `packages/db/src/fotoffice-member-invitations.test.ts`, `FO/lib/members/link-isolation.test.ts`. |
| 14 | Portal del socio | `EN DESARROLLO` | **Hecho:** inicio, carnet, cuotas, perfil, reservas, coberturas, sorteos, recomendados. **Aparecen como "Próximamente":** Beneficios, Cursos, Institucional. | `/portal/*`. `FO/lib/portal/{access,user-kind,menu,…}.ts` con tests. Flag `built` en `FO/lib/portal/menu.ts`. Roadmap `docs/fotoffice/ROADMAP-PORTAL-SOCIO.md`. `/portal` verificado 200 el 2026-08-27. |
| 15 | Panel separado del portal | `PUBLICADO` | La guarda real está en el layout del panel: un socio que entra ahí va al portal, y el equipo que entra al portal va al panel. | `FO/app/(shell)/layout.tsx`, `FO/lib/shell/require-fotoffice-access.ts`, `FO/app/portal/layout.tsx`. Tests `FO/lib/workspace-role-consistency.test.ts`, `FO/lib/portal/user-kind.test.ts`. **Observación:** `/reservas`, `/coberturas`, `/caja`, `/clientes` y `/sorteos` no están en la lista de `FO/middleware.ts`; dependen solo de la guarda del layout. |

## 3. Web pública

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 16 | Página web pública | `IMPLEMENTADO LOCALMENTE` | `/w/[slug]` con portada, menú, páginas de módulos (cursos, reservas, asociarse, coberturas) y atajo `/{slug}`. **Falta:** que el dueño cree páginas propias (etapa 2 del diseño). | `FO/lib/website/{public-site,public-modules,site-nav}.ts`. Modelos `FotofficeWorkspaceWebsite`, `FotofficeWorkspaceBranding`. Migración `20260817130000_fotoffice_workspace_website`. Diseño `FO/docs/specs/2026-09-20-sitio-publico-website-design.md`, plan `FO/docs/plans/2026-09-21-sitio-publico-etapa-1.md`. |
| 17 | Website Builder | `EN DESARROLLO` | Editor con autoguardado, versiones publicadas inmutables, historial, SEO, navegación, 5 estilos de diseño y plantillas. Solo 5 bloques: portada, texto, imagen, llamada a la acción y separador. **Falta:** varias páginas, bloques que muestren contenido de los módulos, galería, sponsors. | Rutas `/website`, `/website/{navegacion,seo,historial,preview}`. `FO/lib/website/blocks.ts`, `FO/components/website/*`. Modelo `FotofficeWorkspaceWebsiteVersion`. Migraciones `20260819120000_fotoffice_website_versioning`, `20260819150000_fotoffice_website_design_presets`. Tests `FO/lib/website/*.test.ts`. |
| 18 | Blog y novedades | `APROBADO` | Sin código en FotoOffice (los modelos `BlogPost` del esquema son de otras apps). El diseño del sitio público lo deja para la "obra 3". | `FO/docs/specs/2026-09-20-sitio-publico-website-design.md`. `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`: `/website/blog` ⬜. |

## 4. Servicios a socios

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 19 | Reservas de salón, estudio y espacios | `IMPLEMENTADO LOCALMENTE` | Agenda, espacios, extras con inventario, tarifa distinta para socios y no socios, horas bonificadas por mes, aprobación, vencimiento de reservas sin pagar, cobro por Mercado Pago, sincronización en los dos sentidos con Google Calendar, ingreso automático en Caja. | Rutas `/reservas/*`, `/w/[slug]/reservas`, `/portal/reservas`; crons `reservas-vencimientos` y `reservas-calendar-sync`. `FO/lib/bookings/*` (unos 20 tests). 11 modelos `Booking*`. Migraciones `20260909000000_bookings`, `20260911000000_booking_calendar_block`. Diseño `FO/docs/specs/2026-09-07-reservas-e-integraciones-design.md`. |
| 20 | Coworking | `EN DESARROLLO` | Hoy se puede ofrecer como un espacio común de un turno a la vez. **Falta:** puestos compartidos con capacidad y modo exclusivo; la migración `20260912000000_booking_capacidad` del plan no existe. | Diseño `FO/docs/specs/2026-09-10-coworking-compartido-y-exclusivo-design.md`, plan `FO/docs/plans/2026-09-10-coworking-compartido-y-exclusivo.md`. |
| 21 | Laboratorio fotográfico | `PROPUESTO` | Nada en FotoOffice. Los modelos `Lab*` son de CompraMeLaFoto. | — |
| 22 | Streaming | `PROPUESTO` | No hay transmisión en vivo. `CourseDeliveryMode.LIVE` existe solo como etiqueta. | `FO/lib/courses-video/stream.ts` es para video grabado (ver 23). |
| 23 | Cursos y actividades educativas | `EN DESARROLLO` | **Hecho:** cursos presenciales con docentes, cupos, página pública e inscripción paga por Mercado Pago; evaluaciones. **Cursos grabados:** solo la carga de clases por el administrador (etapas 0 y 1). **Falta:** que el alumno vea las clases, y `/portal/cursos`. | Rutas `/courses/*`, `/dashboard/courses`, `/evaluaciones/*`, `/w/[slug]/cursos`. `FO/lib/presential-courses/*`, `FO/lib/courses-sales/*`, `FO/lib/courses-video/*`. Migraciones `20260424162000_add_presential_courses_mvp`, `20260428192455_add_evaluaciones_engine`, `20260921120000_cursos_grabados`. Diseño `FO/docs/specs/2026-09-21-cursos-grabados-design.md`. |
| 24 | Tienda y merchandising | `PROPUESTO` | Nada en FotoOffice. | ESTADO-ACTUAL.md §4, etapa 15. |
| 25 | Eventos institucionales | `PROPUESTO` | Clave `events` en estado `PLANNED`, sin ruta. | `FO/lib/modules/registry.ts`. |

## 5. Beneficios, sponsors y empresas

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 26 | Beneficios y convenios | `EN DESARROLLO` | El único beneficio que existe es el descuento por **Recomendados** (ver §9). **Falta:** un catálogo de beneficios y convenios. `/portal/beneficios` figura como `built: false`. | `FO/lib/portal/menu.ts`. `docs/fotoffice/ROADMAP-PORTAL-SOCIO.md` §2. |
| 27 | Sponsors y empresas aliadas | `EN DESARROLLO` | Solo dentro de Sorteos: un premio se puede asociar a un aliado de `DnxPartner`. **Falta:** gestión de sponsors, logos en el portal y un bloque de sponsors en la web. La categoría "Comercial / Sponsors" del builder está vacía. | `FO/app/(shell)/sorteos/actions-partners.ts`, `FO/lib/raffles/repository.ts` (`searchPartners`). Modelo `RafflePrize.partnerId`. `FO/lib/website/blocks.ts`. |
| 28 | Integración con DNX Partners | `EN DESARROLLO` | `@repo/partners` figura como dependencia pero **ningún archivo de FotoOffice lo importa**. Los espacios publicitarios de FotoOffice ya están definidos en el paquete (`FOTOFFICE_AD_PLACEMENT_KEYS`), pero nada los muestra. | `packages/partners/src/campaigns.ts`. Migración `20260802120000_dnx_partners_domain`. Diseño `specs/2026-08-27-mapa-inventario-partners-design.md`. |
| 29 | Base global de empresas | `EN DESARROLLO` | `DnxPartner` ya es global (sin `workspaceId`), pero FotoOffice solo la lee y no puede crear ni editar registros. `Client` guarda empresas, pero cada workspace tiene su propia lista. | Modelos `DnxPartner`, `Client`. Migración `20260913000000_cash_and_clients`. |

## 6. Tesorería

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 30 | Tesorería | `IMPLEMENTADO LOCALMENTE` | Módulo **Caja**: cuentas, categorías, turnos con arqueo, pases entre cuentas, anulación por contraasiento e ingreso automático desde cuotas y reservas. **Falta:** rol de Tesorería con aprobaciones y un presupuesto. | Rutas `/caja`, `/caja/{movimientos,turnos,pases,reportes,configuracion}`. `FO/lib/cash/*` (13 tests). Modelos `CashAccount`, `CashTransfer`, `CashCategory`, `CashShift`, `CashMovement`. Migración `20260913000000_cash_and_clients`. Plan `FO/docs/plans/2026-09-13-caja-y-clientes.md`. |
| 31 | Facturas y comprobantes | `EN DESARROLLO` | Solo un número de comprobante en texto libre. **Falta:** emitir facturas (ARCA), subir el archivo del comprobante y un recibo para el socio. | `CashMovement.receiptRef`, `FO/app/(shell)/caja/movement-form.tsx`. El diseño de Caja §11 deja la facturación electrónica para la última etapa. |
| 32 | Cierres y reportes anuales | `EN DESARROLLO` | Cierre por turno y reportes de ingresos y egresos por categoría y período. **Falta:** cierre de ejercicio, balance anual y exportación a PDF. | `FO/lib/cash/{shift,period,category-report}.ts`, `/caja/reportes`. |

## 7. Gobierno institucional

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 33 | Gobierno institucional | `PROPUESTO` | Solo la clave `governance`, en estado `PLANNED`. | `FO/lib/modules/registry.ts`. |
| 34 | Proyectos | `PROPUESTO` | Nada. | — |
| 35 | Orden del día | `PROPUESTO` | Nada. | — |
| 36 | Votaciones internas | `PROPUESTO` | Nada. Los modelos de votos del esquema son de FotoRank y Clickatón. | — |
| 37 | Actas digitales | `PROPUESTO` | Nada. | `docs/fotoffice/ROADMAP-PORTAL-SOCIO.md`. |
| 38 | Archivo institucional | `PROPUESTO` | Nada. La clave `transparency` está en estado `PLANNED`. | `FO/lib/modules/registry.ts`. |
| 39 | Auditoría y trazabilidad | `EN DESARROLLO` | **Completa en el padrón** (`MemberAudit`: quién, cuándo, qué cambió y motivo obligatorio para suspender o dar de baja). Hay historial de eventos propio en carnets, sorteos, coberturas, comisiones y caja. **Falta:** un registro único para todos los módulos; Clientes y la configuración de Caja no guardan historial de cambios. | Migración `20260820170000_fotoffice_member_audit`. `FO/lib/members/audit.ts` + test. Modelos `MemberCardEvent`, `RaffleEvent`, `CoverageEvent`, `WorkspaceFeeLedgerEntry`, `CashMovement`. |

## 8. Comunicación

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 40 | Comunicación institucional | `EN DESARROLLO` | Solo correos transaccionales (invitaciones, solicitudes, carnets, cursos, coberturas), un registro de envíos y un correo de prueba. **Falta:** envíos masivos; la clave `communications` sigue en `PLANNED`. | `FO/lib/communications/*` con tests. `packages/communications/src/{campaigns,automation,segments}` son solo tipos. Doc `docs/fotoffice/DECISION-CORREO-SALIENTE.md`. |
| 41 | Equipo interno de comunicación | `PROPUESTO` | No hay rol de comunicación: `WorkspaceRole` tiene OWNER, ADMIN y STAFF. | `FO/lib/fotoffice-roles.ts`. |
| 42 | Automatización de piezas | `EN DESARROLLO` | El motor de diseño (template-v2, design-studio) está conectado, pero solo para carnets. **Falta:** flyers y piezas para redes. `@repo/social-pieces` lo usan Clickatón y CompraMeLaFoto, no FotoOffice. | `FO/lib/template-v2/`, `FO/lib/carnet/{template,render,bridge}.ts`. Migraciones `20260827200000_template_v2_workspace`, `20260827210000_template_v2_tables`. Diseño `specs/2026-08-26-modulo-de-diseno-design.md`. |
| 43 | Bienvenida automática | `IMPLEMENTADO LOCALMENTE` | Se envía sola cuando el pago de la solicitud completa el alta. Si el socio se carga a mano, recibe en cambio el mail de invitación. | `FO/lib/membership/{application-emails,complete-application}.ts` + tests. |
| 44 | Aviso automático de beneficios y sponsors | `PROPUESTO` | Depende de los puntos 26 y 27, que todavía no existen. | — |
| 45 | Firma institucional por workspace | `IMPLEMENTADO LOCALMENTE` | Pie institucional con nombre, logo, contacto, redes y nota, con vista previa. La firma personal de quien envía queda para después. | Campo `FotofficeWorkspaceBranding.emailSignatureNote`, migración `20260822120000_fotoffice_email_signature_note`. `FO/lib/communications/workspace-signature.ts`, `packages/communications/src/signature/*` + tests. Plan `plans/2026-08-21-firma-email-workspace.md`. |

## 9. Sorteos y expansiones

| # | Punto | Estado | Qué hay / qué falta | Evidencia |
|---:|---|---|---|---|
| 46 | Sorteos gratuitos para socios al día | `IMPLEMENTADO LOCALMENTE` | Participa quien esté `ACTIVE` y sin cuotas vencidas al cierre de la lista. Premios con aliado opcional. **Pendiente de salida** (ESTADO-ACTUAL.md §4): aplicar la migración en las bases de Neon, encender el módulo para la SFPR y resolver el punto legal `L-09`. | Rutas `/sorteos/*`, `/portal/sorteos/*`, cron `/api/cron/sorteos`. `FO/lib/raffles/*` con tests. Modelos `Raffle`, `RaffleEntry`, `RafflePrize`, `RafflePrizeAward`, `RaffleEvent`. Migración `20260911000000_sorteos`. Plan `plans/2026-09-08-sorteos-verificables.md`. |
| 47 | Sorteos con bono contribución | `DESCARTADO` (en esta etapa) | Quedó fuera de alcance de forma explícita: el módulo nunca cobra. Su definición sigue abierta en CONTEXTO-SFPR.md. | ESTADO-ACTUAL.md §4, fila 14. |
| 48 | Resultado inmutable y auditable | `IMPLEMENTADO LOCALMENTE` | El azar sale de drand. La lista de participantes se sella y su huella se publica antes de que exista el número, y cualquiera puede rehacer la cuenta. La inmutabilidad la garantiza la aplicación, no triggers de la base. | `FO/lib/raffles/{seal,drand,verification}.ts` + tests (incluye `verificacion-independiente.test.ts`). Ruta `/portal/sorteos/[id]/verificacion`. |
| 49 | Muestras itinerantes | `PENDIENTE` | Clave `exhibitions` en estado `PLANNED`. El alcance está "PENDIENTE DE DEFINIR". | CONTEXTO-SFPR.md, preguntas abiertas. |
| 50 | Alianzas educativas | `PROPUESTO` | Nada. | — |
| 51 | Beneficios para estudiantes del ISET 18 | `PROPUESTO` | Nada. Lo más cercano es la escala `REDUCIDA`, que sirve para una categoría de estudiante. | — |
| 52 | Red de recomendaciones tipo BNI | `PROPUESTO` | `/portal/recomendados` **no** es BNI: es un programa de referidos con descuento en la cuota. Existe un perfil profesional con consentimiento para aparecer en un directorio (`directoryOptIn`), pero ningún directorio lo usa. `packages/recommendations` no está conectado. | `FO/lib/membership/professional-profile.ts`, migración `20260828120000_presencia_profesional`. |
| 53 | Calificaciones y alertas de esa red | `PROPUESTO` | Nada. | — |
| 54 | Subsidios y seguimiento de proyectos | `PROPUESTO` | Nada. | — |
| 55 | Portfolio | `PENDIENTE` | Nada en FotoOffice. El sitio no tiene bloque de galería y `public-modules.ts` no tiene entrada de portfolio. Hay lugar reservado en la navegación (`/portfolios` en el panel, `/w/[slug]/socios` en la web). El alcance está "PENDIENTE DE DEFINIR". Como referencia técnica sirve el portfolio de jurados de FotoRank. | `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`, `FO/lib/website/block-contract.ts`. Modelo de referencia `FotorankJudgePortfolioImage`, diseño `specs/2026-09-21-fotorank-portfolio-y-galeria-de-jurados-design.md`. |
| 56 | Beneficios para clientes de fotógrafos | `PROPUESTO` | El módulo Clientes existe, pero no tiene beneficios. | Ruta `/clientes`, `FO/lib/clients/*`. |

## 10. Puntos que no son de código

| # | Punto | Estado |
|---:|---|---|
| 57 | Modelo comercial de FotoOffice | `EN DESARROLLO` en lo técnico, porque la comisión existe (punto 10). El modelo comercial en sí está fuera del código y figura `PENDIENTE DE DEFINIR` en CONTEXTO-SFPR.md. |
| 58 | Presentación ante la Comisión Directiva | Fuera del código. |
| 59 | Narrativa y materiales de presentación | Fuera del código. |
| 60 | Implementación inicial para la SFPR | `REQUIERE VERIFICACIÓN`. El 2026-08-27 había 152 socios, 1 con portal, 0 cuotas generadas y 0 carnets emitidos. No se sabe cómo está hoy. |

## 11. Reutilización en otros workspaces (punto 61)

`IMPLEMENTADO LOCALMENTE`. Hay un catálogo central de módulos (`AVAILABLE` / `PLANNED`), un interruptor por workspace que maneja el Super Admin, y el menú lateral se arma según lo que esté encendido. El vocabulario es configurable por workspace ("socio", "voluntario", etc.) y la comisión se define por módulo. En el código ya aparece una segunda institución, Foto Positiva, en coberturas.

Evidencia: `FO/lib/modules/{registry,gating,nav,submodules}.ts` + tests. `/admin/workspace-modules`. Modelos `WorkspaceFeatureModule`, `WorkspaceVocabulary` (migración `20260915150000_vocabulario_por_workspace`), `WorkspaceModuleFee`. Configuración de palabras en `/workspace/configuracion/palabras`.

## 12. Módulos construidos que el alcance no menciona

| Módulo | Estado | Evidencia |
|---|---|---|
| Solicitudes de ingreso (asociarse desde la web) | `PUBLICADO` en su versión del 2026-08-27 | `/w/[slug]/asociarse`, `/members/solicitudes`, cron `/api/cron/solicitudes`. Modelo `MembershipApplication`. `FO/lib/membership/{application,approve,complete-application}.ts` + tests. |
| Recomendados (referidos con descuento) | `IMPLEMENTADO LOCALMENTE` | `/portal/recomendados`. Modelo `MembershipRecommendationBenefit`, migración `20260907120000_fotoffice_recomendados`. Diseño `FO/docs/specs/2026-09-07-recomendados-design.md`. |
| Solicitudes y Coberturas | `IMPLEMENTADO LOCALMENTE` | `/coberturas/*`, `/w/[slug]/coberturas/solicitar`, `/sc/[token]`, `/portal/coberturas`. 11 modelos `Coverage*`. Migraciones `20260914120000_coberturas` y siguientes. `FO/lib/coverages/*` (unos 35 tests). |
| Clientes | `IMPLEMENTADO LOCALMENTE` | `/clientes/*`, modelo `Client`, migración `20260913000000_cash_and_clients`. |
| Captación de presupuestos | `IMPLEMENTADO LOCALMENTE` | `/dashboard/service-leads`, `/w/[slug]/xv`. |
| Evaluaciones | `IMPLEMENTADO LOCALMENTE` | `/evaluaciones/*`, migración `20260428192455_add_evaluaciones_engine`. |

## 13. Qué falta para cerrar la Etapa 2

1. **Pasar a `PUBLICADO` lo que corresponda.** Comprobar en `fotoffice.com` qué rutas responden, y conocer el deployment y el commit en producción. Todo lo construido después del 2026-08-27 depende de esto.
2. **Leer `WorkspaceFeatureModule` del workspace SFPR en producción**, para saber qué módulos tiene encendidos la institución, además de cuáles existen.
3. **Confirmar las migraciones aplicadas en producción**, en particular `20260911000000_sorteos`, `20260913000000_cash_and_clients` y las de coberturas y cursos grabados. En este proyecto ningún build ejecuta `prisma migrate deploy`.
4. **Actualizar ESTADO-ACTUAL.md §4** con esta matriz o con un enlace a ella.
