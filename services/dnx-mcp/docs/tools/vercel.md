# MCP Tools — Vercel

Herramientas MCP de alto nivel para operaciones de release en Vercel. **No exponen la API CRUD** — orquestan `VercelProvider` con lógica de negocio.

## Principios

- Solo consumen `VercelProvider`
- Sin `fetch` directo
- Sin lógica de autenticación en tools
- Validación con Zod
- Auditoría en cada invocación
- `dryRun` para simular
- `confirm` requerido en operaciones mutables

## Flujo recomendado

```
vercel_status
    ↓
vercel_prepare_staging
    ↓
vercel_validate_staging
    ↓
vercel_prepare_production_release
    ↓
vercel_deploy_release (confirm: true)
    ↓
(rollback si necesario)
vercel_rollback_release (confirm: true)
```

## Parámetros comunes

| Parámetro   | Tipo    | Default      | Descripción                              |
| ----------- | ------- | ------------ | ---------------------------------------- |
| `project`   | string  | —            | Nombre o ID del proyecto Vercel          |
| `dryRun`    | boolean | `false`      | Simula sin efectos secundarios           |
| `confirm`   | boolean | `false`      | Requerido en deploy/rollback             |
| `timeoutMs` | number  | `600000`     | Timeout para esperar deployments         |
| `target`    | enum    | `production` | Target: production, preview, development |

---

## 1. `vercel_status`

Panorama inteligente de la cuenta y proyectos.

### Input

```json
{
  "project": "my-app",
  "dryRun": false
}
```

`project` es opcional. Sin él, lista todos los proyectos visibles.

### Output

- Usuario autenticado
- Team activo
- Proyectos con producción, preview, dominios, aliases
- Último deploy, estado y salud

### Ejemplo

```json
{
  "project": "compramelafoto",
  "dryRun": false
}
```

---

## 2. `vercel_prepare_staging`

Audita staging sin desplegar.

### Verifica

- Proyecto existe
- Variables preview vs production
- Diferencias de envs
- Dominios y aliases
- Recomendaciones

### Input

```json
{
  "project": "my-app",
  "dryRun": false
}
```

### Ejemplo dryRun

```json
{
  "project": "my-app",
  "dryRun": true
}
```

---

## 3. `vercel_validate_staging`

Genera informe de readiness del staging.

### Verifica

- Deployment listo y healthy
- Build correcta (logs + estado)
- Runtime (logs)
- Aliases
- Variables de entorno

### Input

```json
{
  "project": "my-app",
  "deploymentId": "dpl_xxx",
  "dryRun": false
}
```

`deploymentId` es opcional — usa el preview actual por defecto.

### Output

```json
{
  "passed": true,
  "issues": [],
  "summary": "Staging validado correctamente..."
}
```

---

## 4. `vercel_prepare_production_release`

Genera plan de salida a producción **sin deployar**.

### Incluye

- Riesgos (low/medium/high)
- Diferencias de envs y dominios
- Deployment candidato (preview)
- Rollback disponible
- Checklist de release

### Input

```json
{
  "project": "my-app",
  "dryRun": false
}
```

### Ejemplo

```json
{
  "project": "my-app",
  "dryRun": true
}
```

---

## 5. `vercel_deploy_release`

Despliega, espera, monitorea y valida.

### Requisitos

- `confirm: true` para ejecutar
- `dryRun: true` para ver el plan sin ejecutar

### No modifica dominios.

### Input — simulación

```json
{
  "project": "my-app",
  "target": "production",
  "dryRun": true,
  "confirm": false
}
```

### Input — ejecución

```json
{
  "project": "my-app",
  "target": "production",
  "confirm": true,
  "timeoutMs": 600000
}
```

### Input — redeploy específico

```json
{
  "project": "my-app",
  "redeployFrom": "dpl_abc123",
  "target": "production",
  "confirm": true
}
```

---

## 6. `vercel_rollback_release`

Rollback al último deployment sano anterior.

### Requisitos

- `confirm: true` para ejecutar

### Input — simulación

```json
{
  "project": "my-app",
  "target": "production",
  "dryRun": true
}
```

### Input — ejecución

```json
{
  "project": "my-app",
  "target": "production",
  "confirm": true,
  "timeoutMs": 600000
}
```

---

## Auditoría

Cada tool escribe entradas estructuradas:

```json
{
  "timestamp": "2026-07-06T03:00:00.000Z",
  "service": "dnx-mcp",
  "tool": "vercel_deploy_release",
  "action": "deploy_release",
  "project": "my-app",
  "dryRun": false,
  "confirmed": true,
  "outcome": "success",
  "durationMs": 125000
}
```

Los logs van a stderr para no interferir con el transporte MCP stdio.

## Errores comunes

| Error                           | Causa                           | Solución                              |
| ------------------------------- | ------------------------------- | ------------------------------------- |
| `ProviderNotConfiguredError`    | Sin `VERCEL_TOKEN`              | Configurar `.env`                     |
| `ToolConfirmationRequiredError` | Deploy/rollback sin `confirm`   | Usar `confirm: true` o `dryRun: true` |
| `VercelNotFoundError`           | Proyecto/deployment inexistente | Verificar nombre con `vercel_status`  |

## Configuración MCP en Cursor

```json
{
  "mcpServers": {
    "dnx-mcp": {
      "command": "node",
      "args": ["/ruta/a/dnx-mcp/dist/index.js"],
      "env": {
        "VERCEL_TOKEN": "tu-token",
        "VERCEL_TEAM_ID": "team_xxx",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Archivos

```
src/tools/
├── shared/           # audit, guards, schemas, response
└── vercel/
    ├── index.ts      # Registro automático
    ├── vercel-status.ts
    ├── vercel-prepare-staging.ts
    ├── vercel-validate-staging.ts
    ├── vercel-prepare-production-release.ts
    ├── vercel-deploy-release.ts
    └── vercel-rollback-release.ts
```
