# Google Cloud — Fase 1 (DNX MCP)

Integración segura de Google Cloud vía CLI `gcloud` dentro de `@dnx/dnx-mcp`.

Ubicación: `services/dnx-mcp`

## Alcance de Fase 1

Incluye:

- Diagnóstico de instalación y autenticación
- Proyectos (listar, describir, proyecto activo, set local, billing read-only)
- APIs / services (listar, planificar, habilitar con controles)
- Service accounts (listar, planificar, crear sin keys ni roles)
- Secret Manager (listar, metadatos, planificar, crear, agregar versión **sin exponer valores**)

No incluye (Fase 2+):

- Cloud Run, Artifact Registry, Cloud Storage
- Despliegues
- Creación completa de proyectos
- OAuth / Calendar / Drive
- Claves JSON permanentes de service account
- Eliminación de recursos
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

## Confirmaciones en production

Ejemplos exactos:

```text
ENABLE SERVICES IN dnx-example
CREATE SERVICE ACCOUNT dnx-app-runtime IN dnx-example
CREATE SECRET database-url IN dnx-example
ADD SECRET VERSION database-url IN dnx-example
SET PROJECT dnx-example
```

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
- Posible creación acotada de proyectos

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
