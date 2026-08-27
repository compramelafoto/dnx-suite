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

En orden de urgencia:

1. ~~Resolver los archivos sin commitear.~~ **Hecho** el 2026-08-27: commit `257abb1a`, subido a GitHub.
2. **Integrar `feat/socios-alta-cobros` a `main`.** Es lo más urgente que queda. Hasta que ocurra, `main` no refleja lo que está publicado y cualquier despliegue desde ahí es un rollback.
3. **Correr las verificaciones sobre esa rama.** Las que se corrieron el 2026-08-27 fueron sobre `feat/fotorank-el-pais-que-miramos`, donde FotoOffice es la versión vieja: 230 tests en 31 archivos. Esa rama tiene 98 archivos de test que siguen sin ejecutarse.
4. **Verificar la base de datos de producción.** Confirmar los conteos del documento de contexto.
5. **Definir una rama de producción estable** en Vercel, para no depender de ramas de trabajo.
6. Recién después, retomar módulos pendientes (reservas, sorteos, tesorería, gobierno).

### Verificaciones corridas el 2026-08-27

Sobre `feat/fotorank-el-pais-que-miramos`, tras el commit `257abb1a`:

| Verificación | Resultado |
|---|---|
| `prisma validate` | Válido |
| Tests de FotoOffice | 230/230 en 31 archivos |
| Test de separación de secretos de webhook (Clickaton) | 3/3 |
| Build de FotoOffice | `exit 0` |
| Build de FotoRank | `exit 0` |
| Typecheck del monorepo | Falla en `dnx-sales-assistant`, **preexistente desde el 2026-07-19** |

Dos cosas detectadas y corregidas: faltaba correr `pnpm install` (había dependencias declaradas y no instaladas en `packages/editor`), y el build de FotoRank registra que la tabla `FotorankContestMediaAsset` no existe todavía. Esa migración (`20260827000000`) es aditiva y segura, pero **debe aplicarse a mano**: en este proyecto ningún build ejecuta `prisma migrate deploy`.

## 9. Cómo mantener este documento

Debe actualizarse cada vez que se verifique el estado real, no cada vez que se converse sobre el proyecto. Si una fila queda sin confirmar, marcarla como `SIN VERIFICAR` en lugar de suponer.
