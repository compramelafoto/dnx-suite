# Google Cloud — Fase 1 (DNX MCP)

Integración segura de Google Cloud vía CLI `gcloud` dentro de `@dnx/dnx-mcp`.

Ubicación: `services/dnx-mcp`

## Alcance de Fase 1

Incluye:

- Diagnóstico de instalación y autenticación
- Proyectos (listar, describir, proyecto activo, set local, billing read-only)
- **Planificación y creación acotada de proyectos** (con prefijo, labels, parent opcional)
- **Billing accounts** (listar) y **vinculación de facturación** (plan + link con HIGH_RISK)
- APIs / services (listar, planificar, habilitar con controles)
- Service accounts (listar, planificar, crear sin keys ni roles)
- Secret Manager (listar, metadatos, planificar, crear, agregar versión **sin exponer valores**)

No incluye (Fase 2+):

- Cloud Run, Artifact Registry, Cloud Storage
- Despliegues
- OAuth / Calendar / Drive
- Claves JSON permanentes de service account
- Eliminación de recursos / desvincular billing / cerrar billing accounts
- Comandos arbitrarios de terminal
- Roles IAM grant/revoke (tipados, no registrados)

## Tools disponibles

### Diagnóstico (READ_ONLY)

| Tool | Descripción |
| --- | --- |
| `gcp_check_installation` | ¿Está `gcloud`? Versión y ruta |
| `gcp_get_auth_status` | ¿Hay sesión? (sin tokens) |
| `gcp_list_accounts` | Emails + status |
| `gcp_get_active_account` | Cuenta activa |
| `gcp_run_doctor` | Diagnóstico combinado + flags del módulo |

### Proyectos

| Tool | Riesgo |
| --- | --- |
| `gcp_list_projects` | READ_ONLY |
| `gcp_get_project` | READ_ONLY |
| `gcp_get_active_project` | READ_ONLY |
| `gcp_set_project` | LOW_RISK_WRITE (solo config local gcloud) |
| `gcp_check_billing` | READ_ONLY |
| `gcp_plan_project` | LOW_RISK_WRITE (solo plan) |
| `gcp_create_project` | HIGH_RISK_WRITE |

### Facturación

| Tool | Riesgo |
| --- | --- |
| `gcp_list_billing_accounts` | READ_ONLY |
| `gcp_plan_link_billing` | LOW_RISK_WRITE (solo plan) |
| `gcp_link_billing` | HIGH_RISK_WRITE |

### APIs

| Tool | Riesgo |
| --- | --- |
| `gcp_list_enabled_services` | READ_ONLY |
| `gcp_list_available_services` | READ_ONLY |
| `gcp_plan_enable_services` | READ_ONLY (plan) |
| `gcp_enable_services` | LOW_RISK_WRITE |

### Service accounts

| Tool | Riesgo |
| --- | --- |
| `gcp_list_service_accounts` | READ_ONLY |
| `gcp_plan_service_account` | READ_ONLY (plan) |
| `gcp_create_service_account` | LOW_RISK_WRITE |

### Secret Manager

| Tool | Riesgo |
| --- | --- |
| `gcp_list_secrets` | READ_ONLY |
| `gcp_get_secret_metadata` | READ_ONLY |
| `gcp_plan_secret` | READ_ONLY (plan) |
| `gcp_create_secret` | LOW_RISK_WRITE |
| `gcp_add_secret_version` | HIGH_RISK_WRITE |

**Prohibido:** tools para leer valores de secretos.

## Instalación de `gcloud`

1. Instalá [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Verificá: `gcloud version`
3. Autenticá localmente: `gcloud auth login`
4. (Opcional) `gcloud config set project dnx-example`

El MCP **no** ejecuta `gcloud auth login` por vos.

## Variables

Ver `.env.example`. Claves principales:

```env
DNX_GCP_ENABLED=false
DNX_GCP_DEFAULT_PROJECT=
DNX_GCP_DEFAULT_REGION=southamerica-east1
DNX_GCP_ALLOWED_PROJECT_PREFIXES=dnx-
DNX_GCP_ALLOW_WRITES=false
DNX_GCP_ALLOW_PRODUCTION_WRITES=false
DNX_GCP_ALLOW_HIGH_RISK_WRITES=false
DNX_GCP_ALLOW_DESTRUCTIVE_ACTIONS=false
DNX_GCP_ALLOW_SERVICE_ACCOUNT_KEYS=false
DNX_GCP_COMMAND_TIMEOUT_MS=120000
DNX_GCP_MAX_OUTPUT_BYTES=1048576
DNX_GCP_AUDIT_LOG_ENABLED=true
```

Ubicación de secretos locales: `services/dnx-mcp/.env.local` (ignorado por Git).

**No** habilitar el módulo automáticamente en `.env.local` durante la integración.

## Política de riesgo

| Nivel | Requisitos |
| --- | --- |
| READ_ONLY | `DNX_GCP_ENABLED=true` |
| LOW_RISK_WRITE | `dryRun=false` + `DNX_GCP_ALLOW_WRITES=true` (+ confirmation en production) |
| HIGH_RISK_WRITE | además `DNX_GCP_ALLOW_HIGH_RISK_WRITES=true` + confirmation |
| DESTRUCTIVE | **siempre bloqueado** en Fase 1 |

Entornos válidos (obligatorios en escrituras): `development` | `staging` | `production`.

No se infiere el entorno por el nombre del proyecto.

## Prefijos de proyecto

`DNX_GCP_ALLOWED_PROJECT_PREFIXES=dnx-` (lista separada por comas).

Proyectos fuera del prefijo → `GCP_PROJECT_NOT_ALLOWED`.

## Confirmaciones exactas

Ejemplos:

```text
ENABLE SERVICES IN dnx-example
CREATE SERVICE ACCOUNT dnx-app-runtime IN dnx-example
CREATE SECRET database-url IN dnx-example
ADD SECRET VERSION database-url IN dnx-example
SET PROJECT dnx-example
CREATE PROJECT dnx-platform-dev
LINK BILLING 000000-000000-000000 TO dnx-platform-dev
```

`gcp_create_project` y `gcp_link_billing` exigen confirmation exacta en **toda** ejecución real (`dryRun=false`), no solo en production.

## Flujo recomendado (proyecto nuevo)

```text
gcp_plan_project
  → gcp_create_project (dryRun / luego real con flags + confirmation)
  → gcp_list_billing_accounts
  → gcp_plan_link_billing
  → gcp_link_billing (dryRun / luego real con flags + confirmation)
  → gcp_plan_enable_services / gcp_enable_services
```

Reglas de producto:

1. Crear un proyecto **no** activa APIs.
2. Crear un proyecto **no** vincula facturación.
3. Vincular billing **nunca** es automático.
4. No reutilizar proyectos históricos (`compramelafoto-*`, etc.) sin decisión explícita.
5. Parent (`organization` / `folder`) es **opcional** y nunca se elige automáticamente.
6. Labels: solo metadatos seguros (sin secretos, emails ni tokens).

### Flags para creación / link reales

```env
DNX_GCP_ENABLED=true
DNX_GCP_ALLOW_WRITES=true
DNX_GCP_ALLOW_HIGH_RISK_WRITES=true
```

Más `dryRun=false` y confirmation exacta. Production también requiere `DNX_GCP_ALLOW_PRODUCTION_WRITES=true`.

## Secret Manager — reglas

1. Valor solo por stdin (`--data-file=-`).
2. Nunca en argv, logs, auditoría ni respuestas.
3. En dry run: `{ "valueProvided": true }` sin longitud/hash/fragmentos.
4. No existe tool de lectura de valores.

## Dry run

Las tools mutables usan `dryRun` con **default true**.

Ejemplo seguro:

```json
{
  "projectId": "dnx-example",
  "environment": "development",
  "services": ["secretmanager.googleapis.com"],
  "dryRun": true
}
```

## Operaciones bloqueadas

- Destructivas
- Claves JSON de SA
- Lectura de secret values
- Shell arbitrario / `gcloud` libre
- Desactivación de APIs
- Roles Owner/Editor assignment
- Desvincular / cerrar billing accounts
- Crear billing accounts
- Cambiar el proyecto activo local al crear un proyecto

## Errores

Códigos estructurados (`GCP_*`): ver `src/providers/google-cloud/types.ts`.

Cada error incluye mensaje seguro + acción recomendada. Sin secretos ni dumps completos.

## Deshabilitar el módulo

```env
DNX_GCP_ENABLED=false
```

Todas las tools GCP fallan con `GCP_DISABLED`.

## Fase 2 (pendiente)

- Cloud Run / Artifact Registry / GCS
- Roles IAM (grant/revoke) con controles estrictos
- Workload Identity helpers
- Orquestación multi-paso de release sobre GCP

## Ejemplos seguros

Doctor:

```json
{ "dryRun": false }
```

Plan APIs:

```json
{
  "projectId": "dnx-example",
  "environment": "development",
  "services": ["iam.googleapis.com", "secretmanager.googleapis.com"],
  "dryRun": true
}
```
