# FotoOffice — Estado real verificado

**Fecha de la auditoría:** 2026-08-27 (actualizado esa misma tarde con la verificación de producción)
**Método:** inspección de solo lectura del repositorio `dnx-suite` con `git` (ramas, commits, árbol de archivos, esquema Prisma y migraciones).
**Autor:** Claude Code.

> Este documento registra **evidencia verificada en el código**.
> No reemplaza a [CONTEXTO-SFPR.md](CONTEXTO-SFPR.md), que describe la visión, las decisiones y el plan.
> Cuando ambos se contradigan, manda este.

## Advertencia sobre el alcance

Esta auditoría cubre **únicamente el código del repositorio**.

**Verificado en la actualización del 2026-08-27 (tarde):** el deployment productivo de Vercel y las rutas que responde `fotoffice.com`. Ver la sección 1.

**Sigue sin verificar:**

- El estado real de la base de datos (los 152 socios y demás conteos del documento de contexto).
- Resend y las variables de entorno.

## 1. Hallazgo principal

**Producción corre desde una rama de trabajo, no desde `main`.**

`fotoffice.com` sirve hoy el código de `feat/socios-alta-cobros`. No es que el trabajo haya quedado sin publicar: **está publicado y funcionando**. Lo que no ocurrió es el regreso a `main`.

### Evidencia

El deployment productivo `dpl_A9EGEsv5GusWMnUtDTYtzLL9mfFi`, creado el 2026-08-27 a las 04:38, tiene entre sus alias:

```
https://fotoffice-dnxsuite-git-feat-soc-99e0a0-compramelafotos-projects.vercel.app
```

Ese alias identifica la rama de origen. Además responde rutas que **solo existen en esa rama** y no en `main`:

| Ruta en `fotoffice.com` | Respuesta |
|---|---|
| `/portal/carnet` | 200 |
| `/portal/cuotas` | 200 |
| `/members/carnets` | 200 |
| `/invitacion/xxx` | 200 |
| `/portal` | 200 |
| `/no-existe-xyz` (control) | 404 |

El 404 del control confirma que los 200 anteriores son reales y no una respuesta genérica.

### Dominios servidos por ese deployment

`fotoffice.com`, `www.fotoffice.com`, `fotoffice.com.ar`, `www.fotoffice.com.ar` y `fotoffice-dnxsuite.vercel.app`.

### La rama

| Dato | Valor |
|---|---|
| Rama publicada | `feat/socios-alta-cobros` |
| Último commit | `59ccf582` — 2026-08-26 23:29 |
| Commits que tiene y `main` no | **120** |
| De esos, que tocan `apps/fotoffice` | **71** |
| Commits que `main` tiene y ella no | 53 |
| HEAD de `main` | `d573a39b` — 2026-08-26 20:45 |

### El riesgo real

No es que el trabajo se pierda: está publicado. **El riesgo es un rollback accidental.**

`main` no contiene el portal del socio, ni las cuotas, ni los carnets. Si alguien publica FotoOffice desde `main` —creyendo razonablemente que es la rama buena— **produciría un retroceso de semanas en producción**, dejando a los socios sin portal, sin carnet y sin pago de cuotas.

Mientras `main` y producción no coincidan, la rama principal del repositorio es una trampa.

## 2. Contradicciones con el documento de contexto

| Afirmación en CONTEXTO-SFPR.md | Realidad verificada |
|---|---|
| `c07d6432` fue publicado en producción | El commit **existe**, pero **no está en `main`**. Solo aparece en `feat/socios-alta-cobros`. |
| `apps/fotoffice` tiene 156 archivos | Tiene **462** archivos. |
| Rama productiva: `release/sponsor-global-technical-deploy` | Esa rama quedó detenida el 2026-08-18 y **no contiene** `c07d6432`. |
| Una sola migración (la de invitaciones) | Hay **19 migraciones** de socios/FotoOffice, la más vieja de mayo de 2026. |

Además: las rutas `/portal` y `/invitacion` **no existen en `main`**. El portal del socio no está integrado.

## 3. Nomenclatura de ramas

`dnx-suite` es un monorepo con 7 aplicaciones:

```
apps/  clickaton  compramelafoto  compramelafoto-workers
       dnx-sales-assistant  fotoffice  fotorank  infospot
```

Las ramas se nombran por la tarea del momento, **no por módulo ni por aplicación**. Por eso hay nombres que parecen no tener relación con FotoOffice:

- `feat/fotorank-el-pais-que-miramos` → un concurso en **FotoRank**.
- `release/sponsor-global-technical-deploy` → sponsors en **Clickaton / Partners**.
- `feat/socios-alta-cobros` → **este sí es FotoOffice**.

## 4. Matriz de etapas

Estados posibles: `CONSTRUIDO` / `PARCIAL` / `NO EXISTE` / `SIN VERIFICAR`.

| Etapa del plan | Estado | Evidencia en el código |
|---|---|---|
| 5 — Núcleo de socios | `CONSTRUIDO` | Rutas `/members`, `/members/import`, `/members/categories`, `/members/solicitudes`. Modelos `Member`, `MemberCategory`, `MemberAudit`, `MembershipApplication`. |
| 6 — Cuotas y Mercado Pago | `CONSTRUIDO` | Rutas `/members/cuotas`, `/members/cuotas/configuracion`, `/portal/cuotas`, `/workspace/configuracion/cobros`. Modelos `MembershipDuesSettings`, `MembershipFeeValue`, `MembershipCharge`, `MembershipPayment`, `MembershipAllocation`, `WorkspaceModuleFee`. |
| 7 — Carnets | `CONSTRUIDO` | Rutas `/members/carnets`, `/members/carnets/permisos`, `/portal/carnet`, `c/[token]` (verificación pública por QR). Modelos `MemberCard`, `MemberCardEvent`, `MemberCardOperator`. |
| 8 — Web pública y Website Builder | `PARCIAL` | Rutas `/website`, `/website/historial`, `/website/navegacion`, `/website/preview`, `/website/seo`. Modelos `FotofficeWorkspaceWebsite` y `FotofficeWorkspaceWebsiteVersion`. **Falta el blog.** |
| 10 — Cursos | `CONSTRUIDO` | Rutas de cursos, docentes, leads e inscripción con desenlaces éxito/pendiente/fallo. 9 modelos de curso. |
| 3 y 4 — Primera invitación real | `SIN VERIFICAR` | El flujo existe (`/invitacion/[token]`, `/recuperar/[token]`). Si se probó con un socio real no se puede saber desde el código. |
| 9 — Reservas | `NO EXISTE` | Cero archivos y cero modelos de reserva, espacio o salón. |
| 11 — Beneficios y sponsors | `NO EXISTE` en FotoOffice | Los modelos de sponsor del esquema pertenecen a otras aplicaciones. |
| 12 — Tesorería y gobierno institucional | `NO EXISTE` | Sin proyectos, orden del día, votaciones ni actas. |
| 13 — Comunicación institucional | `PARCIAL` | Solo la firma por workspace (`emailSignatureNote`, migración `20260822120000`). El módulo no existe. |
| 14 — Sorteos | `NO EXISTE` | Cero. |
| 15 — Expansiones | `NO EXISTE` | Sin tienda, portfolio, subsidios ni muestras. |
| 16 — Presentación institucional | Fuera del código | — |

## 5. Módulos construidos que el documento de contexto no menciona

Se descubrieron durante la auditoría. Ninguno figura en `CONTEXTO-SFPR.md`:

1. **Evaluaciones** — rutas `/evaluaciones/[contextId]/[activityId]`.
2. **Service leads** — formularios configurables y compartibles (`/dashboard/service-leads/forms`).
3. **Solicitudes de asociación** — ruta pública `/w/[workspaceSlug]/asociarse` con modelo `MembershipApplication`. Permite pedir el ingreso desde la web pública.
4. **Panel de Super Admin** — `/admin/owners`, `/admin/workspaces`, `/admin/workspace-modules`. Permite activar módulos por workspace.
5. **Perfil de fotógrafo individual** — modelo `FotofficePhotographerProfile` y migración `20260718140000_fotoffice_photographer_onboarding`. En el documento de contexto figura como idea futura; ya tiene modelo de datos.
6. **Selector de perfil** — ruta `/elegir-perfil`.

## 6. Inventario técnico

| Elemento | Cantidad |
|---|---|
| Archivos en `apps/fotoffice` | 462 |
| Archivos de test en `apps/fotoffice` | 98 |
| Modelos Prisma en todo el monorepo | 441 |
| Migraciones totales | 144 |
| Migraciones de socios / FotoOffice | 19 |

### Migraciones de FotoOffice, en orden

```
20260501130000_add_members_registry
20260501141000_add_membership_fees
20260501143000_add_member_charges_payments
20260501152000_add_member_cards
20260501184500_add_member_card_validity
20260713020000_event_member_terms_columns
20260718140000_fotoffice_photographer_onboarding
20260815120000_reconcile_member_domain_base
20260817130000_fotoffice_workspace_website
20260819120000_fotoffice_website_versioning
20260819150000_fotoffice_website_design_presets
20260819160000_fotoffice_branding_favicon
20260820170000_fotoffice_member_audit
20260821120000_fotoffice_member_invitation
20260822120000_fotoffice_email_signature_note
20260823120000_member_invitation_delivery
20260824120000_workspace_module_fee
20260824180000_membership_applications_and_dues
20260826120000_member_cards
```

## 7. Estado del área de trabajo

Al momento de la auditoría:

- Rama activa: `feat/fotorank-el-pais-que-miramos` (**no** es la de FotoOffice).
- **131 archivos modificados sin commitear**, en `clickaton`, `fotorank` e `infospot`.

Ese trabajo no está guardado en ninguna rama. Debe decidirse si se conserva o se descarta antes de cualquier cambio de rama.

## 8. Próximos pasos sugeridos

### Hecho el 2026-08-27

1. **Rescate del trabajo sin commitear.** Commit `257abb1a` en `feat/fotorank-el-pais-que-miramos`, subido a GitHub: 128 archivos, 7.068 líneas. Se borraron 33 logs sueltos de sesiones MCP y se agregaron al `.gitignore` `packages/e2e/artifacts/` y `packages/db/.data/`.
2. **Rama de integración.** `integration/socios-main`, commit de fusión `2b7ef3af`: `main` integrado en la línea de socios, cuotas y carnets. No toca `main` ni `feat/socios-alta-cobros`, que sigue sirviendo producción.

### Cómo se resolvió la fusión

13 archivos en conflicto:

| Grupo | Resolución |
|---|---|
| `packages/db/prisma/schema.prisma` | Unión. **449 modelos, ninguno perdido**: 429 comunes, 8 propios de `main`, 12 de socios. De 5 bloques en conflicto, 1 y 5 tomaron socios por ser superconjunto; 2, 3 y 4 tomaron `main`, donde solo cambiaba la alineación. |
| `packages/editor` (4 archivos) y editor visual de InfoSpot (3) | Se tomó socios, verificado como superconjunto estricto: conserva todo lo de `main` y suma el rediseño de la arquitectura visual y el bloque de galería. |
| `apps/fotoffice/app/actions/website.ts` | Se tomó socios: Diseño dejó de ser ruta propia y pasó a ser pestaña del builder. |
| 3 `package.json` | Unión de dependencias, exports y archivos de test. |
| `pnpm-lock.yaml` | Regenerado con `pnpm install`. |

### Verificaciones sobre `integration/socios-main`

| Verificación | Resultado |
|---|---|
| `prisma validate` | Válido |
| Tests de FotoOffice | **1.204 / 1.204** en 98 archivos |
| Build de FotoOffice | `exit 0` |
| Build de InfoSpot | `exit 0` |
| Typecheck del monorepo | 20 de 25 paquetes pasan. Falla `dnx-sales-assistant`, **preexistente desde el 2026-07-19** y ajeno a la fusión |

El único fallo del typecheck viene de `packages/cuanto-cobro-core`, donde se quitaron las extensiones `.js` para que Turbopack resolviera los módulos. Es una decisión previa, no una regresión.

### Integración de FotoRank — `c2b46b30`

Los 2 commits de `feat/fotorank-el-pais-que-miramos` también entraron. El conflicto estaba en `apps/infospot/lib/markdown.tsx`, donde el **bloque de galería** (línea de socios) y el **video incrustado** (línea de FotoRank) son funciones distintas sobre el mismo archivo. Se resolvió con **unión, no elección**: imports de las dos, atributos del sanitizador de las dos —incluido el fallback de video en los enlaces— y una lógica de render que evalúa galería, después video y por último la foto.

Un primer intento se abortó a propósito antes de entender bien el archivo. Se retomó con el análisis hecho y verificando con typecheck, tests y build de InfoSpot.

### El guard de Split 1:N — `85bd8cb0`

La integración hizo fallar 2 tests de `apps/fotoffice/lib/payments/split-1n.test.ts`. El test se escribió cuando FotOffice no cobraba nada, y usaba "cualquier import de `@repo/payments`" como señal de consumo de Split (1 a N). Esa señal dejó de servir al entrar las cuotas de socios.

Se verificó archivo por archivo: **cero referencias** a `buildMercadoPagoSplitOrderRequest`, `createSplitPaymentOrder`, `observeOrdersWebhook`, `parseMercadoPagoOrdersNotification`, `split_rules`, `receiver_type` o las banderas `DNX_MP_ORDERS_1N`, en los 10 archivos que sí usan `@repo/payments`.

Esos 10 archivos usan Checkout Pro con `marketplace_fee` y el consentimiento OAuth del cobrador: modelo marketplace clásico, no Orders API. **La decisión no cambió** — Split (1 a N) sigue desactivado a la espera de Mercado Pago, con `FOTOFFICE_SPLIT_1N_ENABLED` en `false` y el guard fallando cerrado. Lo que cambió es qué mira el test.

### Estado final de `main` — `85bd8cb0`

| Verificación | Resultado |
|---|---|
| Tests de FotoOffice | **1.209 / 1.209** en 99 archivos |
| Build de FotoOffice | `exit 0` |
| Build de InfoSpot | `exit 0` |
| Build de FotoRank | `exit 0` |
| `prisma validate` | Válido |
| Typecheck del monorepo | 20 de 25. Falla `dnx-sales-assistant`, preexistente desde el 2026-07-19 |

`main` contiene ahora todo: lo que sirve producción, el trabajo rescatado y la documentación.

### Lo que queda

1. **Definir la estrategia de despliegue.** Producción de FotoOffice se publica hoy desde ramas de trabajo, a mano: los últimos deployments salieron de `feat/socios-alta-cobros` y antes de una rama `release/…`. Ahora que `main` refleja lo publicado, conviene decidir si pasa a ser la rama de producción. **Esto no se hizo**: cambiarlo dispara un despliegue real y es una decisión operativa, no de orden del repositorio.
2. **Aplicar la migración `20260827000000_fotorank_contest_media_assets`.** Es aditiva y segura —solo crea un enum y una tabla, sin filas—, pero en este proyecto ningún build ejecuta `prisma migrate deploy`. Hasta que se aplique, el build de FotoRank registra que la tabla no existe.
3. **Verificar la base de datos de producción.** Los conteos del documento de contexto siguen sin confirmar.
4. Recién después, retomar módulos pendientes (reservas, sorteos, tesorería, gobierno).

## 8.bis Base de datos de producción — verificada el 2026-08-27

Consulta de solo lectura sobre la base de Neon de producción. Solo agregados: no se leyeron datos personales.

**Nota:** `packages/db/.env` y `.vercel/.env.production.local` apuntan a la **misma base**. Desarrollar en local implica estar conectado a producción.

### Workspaces

Siete workspaces, uno solo con datos reales:

| Workspace | Socios |
|---|---:|
| **SFPR** | **152** |
| DNX Owner, DNX Estudio, Workspace Demo, QA FotoOffice Smoke, CK11D Jury WS, Sociedad de Fotógrafos | 0 cada uno |

Daniel confirmó que el único válido es el de `sfprosario@gmail.com`; el resto son de prueba y podrían eliminarse. **No se eliminó ninguno**: es una decisión aparte.

### El padrón

Los 152 socios del documento de contexto **se confirman**.

| Dimensión | Resultado |
|---|---|
| Estado | 152 `ACTIVE`. Ninguno suspendido ni dado de baja |
| Escala de cuota | 152 `PLENA`. Ninguno reducido ni exento |
| Categoría | 152 `Profesional`, aunque hay 4 definidas (Estudiante, Profesional, Aficionado, Honorario) |
| Con email cargado | 136 de 152. **16 sin email** |
| Con acceso al portal | **1** de 152 |

### Deuda: cero, pero no por estar al día

| | |
|---|---:|
| Cuotas generadas | **0** |
| Pagos registrados | **0** |
| Deuda total | **$0** |
| Carnets emitidos | **0** |

La deuda es cero porque **nunca se emitió una cuota**, no porque los socios hayan pagado. El cobro está configurado —existe la configuración del workspace y 3 valores de cuota cargados— pero nunca se corrió la generación.

### La primera invitación real: se hizo, y funcionó

El documento de contexto la daba como pendiente. La auditoría muestra que se completó:

| Auditoría | Veces |
|---|---:|
| `INVITE_CREATED` | 1 |
| `INVITE_RESENT` | 1 |
| `INVITE_ACCEPTED` | 1 |
| `USER_LINKED` | 1 |
| `UPDATED` | 1 |

Dos invitaciones en total: una aceptada, una revocada, ninguna con fallo de envío. La cadena `CREATED → RESENT → ACCEPTED → USER_LINKED` cerró correctamente, y coincide con el único socio que tiene acceso al portal.

**La Etapa 3 del plan está cumplida.** El recorrido completo —invitación, creación de contraseña, login, regreso, aceptación y vinculación— funciona en producción con un socio real.

### Conclusión

FotoOffice está **construido, publicado y probado, pero sin usar**. La distancia que queda no es de programación: es de puesta en marcha. Cargar los 16 emails faltantes, revisar si las 4 categorías deben aplicarse de verdad, generar la primera camada de cuotas e invitar al resto del padrón.

## 9. Cómo mantener este documento

Debe actualizarse cada vez que se verifique el estado real, no cada vez que se converse sobre el proyecto. Si una fila queda sin confirmar, marcarla como `SIN VERIFICAR` en lugar de suponer.

---

# La causa raíz: producción está desacoplada de git — 2026-08-27

## Qué se observó

Al publicar el portal mejorado, empujar la rama generó un **Preview**, no un despliegue de
producción. Revisando los últimos ocho deployments:

| Push | Resultado |
|---|---|
| A `main` (varios el mismo día) | preview |
| A `feat/socios-alta-cobros` | preview |
| El único de producción | promovido **a mano** con `vercel promote` |

**Ninguna de las dos ramas está configurada como rama de producción en Vercel.** Todo push
genera un preview, y producción solo ocurre cuando alguien promueve explícitamente.

## Por qué importa

Esto explica el problema que abrió toda la revisión: `main` llegó a estar 122 commits atrás de
lo que estaba publicado, y nadie lo notó.

Con producción desacoplada de git, **publicar no deja rastro en el repositorio**. No hay forma
de mirar una rama y saber qué está en el aire, ni de que el equipo se entere de que alguien
publicó. Cada despliegue depende de que una persona se acuerde de promover, desde la rama
correcta, en el momento correcto.

Los tres síntomas que encontramos son consecuencia de esto, no causas independientes:

1. `main` sin el portal del socio ni las cuotas ni los carnets.
2. Producción corriendo desde una rama de trabajo.
3. Una rama `release/…` abandonada que el documento de contexto daba por productiva.

## La corrección

Configurar `main` como **Production Branch** en Vercel: panel del proyecto
`fotoffice-dnxsuite` → Settings → Git → Production Branch.

**No se puede hacer desde el CLI.** `vercel project` solo ofrece `add`, `inspect`, `list` y
`checks`; `vercel git` solo conecta o desconecta el repositorio. Es una configuración del panel
web y la tiene que hacer alguien con acceso.

Una vez hecho, `git push origin main` publica, y la rama principal vuelve a ser la fuente de
verdad de lo que está en el aire. Hasta entonces, cada publicación necesita un
`vercel promote` manual.

## Estado al momento de escribir esto

`fotoffice.com` sirve el deployment `ke6tgwldh`, promovido manualmente, con el contenido de
`main`. Los cinco dominios responden y las rutas del socio dan 200.
