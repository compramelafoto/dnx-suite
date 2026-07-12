# Provider Vercel

Provider empresarial y reutilizable para la API de Vercel. Diseñado para ser consumido por tools MCP, scripts de CI/CD y automatizaciones internas.

## Características

- Autenticación por token con scope de team
- Servicios desacoplados por dominio
- Helpers de alto nivel para operaciones frecuentes
- Retry exponencial con jitter
- Rate limiting por ventana deslizante
- Tipado fuerte con Zod
- Manejo de errores específicos de Vercel

## Configuración

Variables de entorno:

| Variable                          | Requerida | Descripción                                                              |
| --------------------------------- | --------- | ------------------------------------------------------------------------ |
| `VERCEL_TOKEN`                    | Sí*       | Token de acceso de Vercel                                                |
| `VERCEL_TEAM_ID`                  | No        | ID del team para operar en contexto de equipo                            |
| `VERCEL_TEAM_SLUG`                | No        | Slug del team (alternativa a teamId)                                     |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | No        | Protection Bypass for Automation (HTTP probes a preview). Nunca loguear. |

\*Requerido para llamar a la API; los probes de deployment solo necesitan el bypass secret si el preview está protegido.

```typescript
import { createVercelProvider } from "./providers/vercel/index.js";

const vercel = createVercelProvider({
  config: {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID,
  },
});

vercel.assertConfigured();
```

## Arquitectura interna

```
vercel/
├── provider.ts          # Facade principal
├── config.ts            # Schema de configuración
├── errors.ts            # Errores tipados
├── client/              # HTTP + retry + rate limit
├── services/            # Operaciones por dominio
├── helpers/             # Métodos de alto nivel
└── types/               # Tipos y schemas Zod
```

## Servicios

### Auth (`vercel.auth`)

```typescript
const user = await vercel.auth.getUser();
const teams = await vercel.auth.listTeams();
const team = await vercel.auth.getTeam("team_xxx");
```

### Projects (`vercel.projects`)

```typescript
const projects = await vercel.projects.list({ search: "my-app" });
const project = await vercel.projects.get("my-app");
const match = await vercel.projects.findOne("my-app");
const domains = await vercel.projects.listDomains("my-app");
const aliases = await vercel.projects.getAliases("my-app");
```

### Deployments (`vercel.deployments`)

```typescript
const deployments = await vercel.deployments.list({
  projectId: "prj_xxx",
  target: "production",
  state: "READY",
});

const current = await vercel.deployments.getCurrent("my-app", "production");
const latestOk = await vercel.deployments.getLatestSuccessful("my-app");
const latestFail = await vercel.deployments.getLatestFailed("my-app");

const redeployed = await vercel.deployments.redeploy({ deploymentId: "dpl_xxx" });
await vercel.deployments.cancel("dpl_xxx");
```

### Environment Variables (`vercel.envVars`)

```typescript
const envs = await vercel.envVars.list("my-app");
const secret = await vercel.envVars.getByKey("my-app", "API_KEY", { decrypt: true });

await vercel.envVars.create("my-app", {
  key: "NEW_VAR",
  value: "value",
  target: ["production"],
});

await vercel.envVars.update("my-app", "env_id", { value: "new-value" });
await vercel.envVars.deleteByKey("my-app", "OLD_VAR");
```

### Domains (`vercel.domains`)

```typescript
const domains = await vercel.domains.list("my-app", { production: true });
await vercel.domains.add("my-app", { name: "app.example.com" });
const result = await vercel.domains.verify("my-app", "app.example.com");
const config = await vercel.domains.getConfig("app.example.com");
```

### Logs (`vercel.logs`)

```typescript
const buildLogs = await vercel.logs.getBuildLogs("dpl_xxx");
const runtimeLogs = await vercel.logs.getRuntimeLogs("prj_xxx", "dpl_xxx");
const edgeLogs = await vercel.logs.getEdgeLogs("dpl_xxx");

const text = vercel.logs.formatLogs(buildLogs);
```

## Helpers de alto nivel

```typescript
// Deployment de producción actual
const prod = await vercel.getProductionDeployment("my-app");

// Preparar contexto de staging
const staging = await vercel.prepareStaging("my-app");

// Comparar envs entre preview y production
const diff = await vercel.compareEnvironmentVariables("my-app", "my-app", "preview", "production");

// Salud del deployment
const health = vercel.getDeploymentHealth(deployment);

// Esperar a que termine el build
const ready = await vercel.waitUntilDeploymentReady("dpl_xxx", { timeoutMs: 300_000 });

// Redeploy y esperar
const deployed = await vercel.deployAndWait("my-app", { target: "production" });

// Rollback al deployment anterior
const rolledBack = await vercel.rollbackToPreviousDeployment("my-app");
```

## Errores

| Error                          | Cuándo ocurre                           |
| ------------------------------ | --------------------------------------- |
| `VercelAuthError`              | Token inválido o sin permisos (401/403) |
| `VercelNotFoundError`          | Recurso no encontrado (404)             |
| `VercelRateLimitError`         | Rate limit excedido (429)               |
| `VercelApiError`               | Error genérico de la API                |
| `VercelDeploymentTimeoutError` | Timeout esperando deployment            |
| `ProviderNotConfiguredError`   | Token no configurado                    |

## Resiliencia

### Retry

Reintenta automáticamente en status `408, 425, 429, 500, 502, 503, 504` con backoff exponencial y jitter. Respeta el header `Retry-After`.

### Rate Limit

Ventana deslizante configurable (default: 100 req/min). Las requests esperan automáticamente cuando se alcanza el límite.

## Tests

```bash
pnpm test
pnpm test src/providers/vercel
```

Los tests usan mocks de `fetch` — no requieren credenciales reales.

## Próximos pasos

- Crear MCP tools que consuman este provider
- Agregar paginación automática en listados
- Soporte para custom environments de Vercel
