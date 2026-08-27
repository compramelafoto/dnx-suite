# FotoOffice — Estado real verificado

**Fecha de la auditoría:** 2026-08-27
**Método:** inspección de solo lectura del repositorio `dnx-suite` con `git` (ramas, commits, árbol de archivos, esquema Prisma y migraciones).
**Autor:** Claude Code.

> Este documento registra **evidencia verificada en el código**.
> No reemplaza a [CONTEXTO-SFPR.md](CONTEXTO-SFPR.md), que describe la visión, las decisiones y el plan.
> Cuando ambos se contradigan, manda este.

## Advertencia sobre el alcance

Esta auditoría cubre **únicamente el código del repositorio**.

**No fue verificado:**

- Qué versión está publicada hoy en producción.
- El estado real de la base de datos (los 152 socios y demás conteos del documento de contexto siguen sin confirmar).
- El estado de Vercel, Resend, dominios y variables de entorno.
- Si los tests efectivamente pasan (no se ejecutaron).

Por lo tanto este documento dice **qué está construido**, no **qué está publicado ni funcionando**.

## 1. Hallazgo principal

El trabajo de FotoOffice está **completo en buena medida pero sin integrar**. Vive en una sola rama larga que nunca se fusionó a `main`.

| Dato | Valor |
|---|---|
| Rama con el trabajo de FotoOffice | `feat/socios-alta-cobros` |
| Último commit de esa rama | `59ccf582` — 2026-08-26 23:29 |
| Commits que esa rama tiene y `main` no | **120** |
| De esos, que tocan `apps/fotoffice` | **71** |
| Commits que `main` tiene y esa rama no | 53 |
| HEAD de `main` | `d573a39b` — 2026-08-26 20:45 |

### Riesgo

Cada día que pasa, `main` y la rama se separan más y reintegrar el trabajo se vuelve más difícil y más riesgoso. Es el problema más urgente del proyecto, por encima de cualquier módulo pendiente.

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

1. **Resolver los 131 archivos sin commitear.** Conservarlos o descartarlos, con decisión explícita de Daniel.
2. **Verificar producción y base de datos.** Requiere autorización: qué está publicado en `fotoffice.com` y si los conteos del documento de contexto siguen vigentes.
3. **Definir cómo integrar `feat/socios-alta-cobros` a `main`.** Es el riesgo más alto del proyecto.
4. **Ejecutar los tests** para saber si las 98 suites de FotoOffice efectivamente pasan.
5. Recién después, retomar módulos pendientes (reservas, sorteos, tesorería, gobierno).

## 9. Cómo mantener este documento

Debe actualizarse cada vez que se verifique el estado real, no cada vez que se converse sobre el proyecto. Si una fila queda sin confirmar, marcarla como `SIN VERIFICAR` en lugar de suponer.
