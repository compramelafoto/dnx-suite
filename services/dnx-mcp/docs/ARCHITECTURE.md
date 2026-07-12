# Arquitectura de DNX-MCP

## Visión general

DNX-MCP es un servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) diseñado para ser el punto central de administración de infraestructura y proyectos DNX. No está acoplado a ningún proyecto específico.

## Capas

Cadena de dependencias (de abajo hacia arriba):

```
Providers → Tools → Orchestrators → Platform Catalog → Brain
```

```
┌─────────────────────────────────────────┐
│              MCP Client                 │
│         (Cursor, Claude, etc.)          │
└─────────────────┬───────────────────────┘
                  │ stdio / HTTP
┌─────────────────▼───────────────────────┐
│              server/                    │
│   Creación del servidor MCP             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              tools/                     │
│   Herramientas expuestas al cliente     │
│   (validación + orquestación ligera)    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           orchestrators/                │
│   Pipelines de alto nivel (release)     │
│   Solo invocan tools — sin HTTP         │
└───────┬─────────────────────┬─────────┘
        │                     │
        │ PlatformDefinition  │ señales estructuradas
        ▼                     ▼
┌───────────────┐     ┌───────────────────┐
│  platforms/   │     │      brain/       │
│ Platform      │     │  Motor de decisión│
│ Catalog       │     │  score · confianza│
└───────────────┘     └───────────────────┘
        │
┌───────▼─────────────────────────────────┐
│             providers/                  │
│   Integraciones con servicios externos  │
│   (toda la lógica de integración aquí)  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    git · vercel · docker · postgres     │
│    prisma · cloudflare · mercadopago    │
│    r2 · redis · gmail · google · cursor │
└─────────────────────────────────────────┘
```

| Capa                 | Rol                                                 | Depende de               |
| -------------------- | --------------------------------------------------- | ------------------------ |
| **Providers**        | Integración con servicios externos (HTTP, SDK)      | `config/`, `utils/`      |
| **Tools**            | Contrato MCP; valida input y delega a providers     | Providers                |
| **Orchestrators**    | Pipelines multi-step (prepare → validate → execute) | Tools, Platform Catalog  |
| **Platform Catalog** | Definición declarativa de cada producto DNX         | — (datos puros)          |
| **Brain**            | Evalúa riesgos, score, confianza y veredicto        | Señales del Orchestrator |

## Responsabilidades por capa

### `server/`

- Instancia el `McpServer` del SDK oficial.
- Registra tools y recursos.
- No contiene lógica de negocio.

### `tools/`

- Define las herramientas que el cliente MCP puede invocar.
- Valida inputs con Zod.
- Delega operaciones a uno o más providers.
- Formatea la respuesta para el protocolo MCP.

**Regla:** una tool nunca llama directamente a APIs externas. Siempre pasa por un provider.

### `providers/`

- Encapsula la comunicación con un servicio externo.
- Expone métodos tipados y reutilizables.
- Maneja autenticación, errores y configuración del servicio.
- Implementa `Provider` con `name` e `isConfigured()`.

**Regla:** si dos tools necesitan la misma operación, la lógica vive en el provider, no se duplica.

### `config/`

- Schema Zod de variables de entorno.
- Carga y validación centralizada.
- Una sola fuente de verdad para configuración.

### `utils/`

- Logger, errores base, helpers genéricos.
- Sin dependencias hacia providers o tools.

### `orchestrators/`

- Coordina múltiples MCP tools en pipelines de negocio.
- No conoce APIs externas ni importa providers.
- Usa `ToolInvoker` para invocar handlers de tools.
- Recibe `PlatformDefinition` del [Platform Catalog](./architecture/platform-catalog.md).
- Ver [release-orchestrator.md](./architecture/release-orchestrator.md).

### `platforms/`

- Catálogo declarativo de plataformas DNX.
- Sin hardcodeo de proyectos Vercel ni dominios en orquestadores.
- Los orchestrators reciben `PlatformDefinition`, no strings sueltos.
- Ver [platform-catalog.md](./architecture/platform-catalog.md).

### `brain/`

- Motor de decisión puro: evalúa información estructurada de orchestrators.
- Sin HTTP, providers ni MCP tools.
- Produce `BrainDecision` con score, confianza, reasoning, recommendation y nextActions.
- Puede rechazar operaciones peligrosas antes de ejecutarlas.
- Ver [dnx-brain.md](./architecture/dnx-brain.md).

### `types/`

- Interfaces y tipos compartidos entre capas.
- Evita imports circulares.

## Flujos

### Invocación (hacia abajo)

```
Cliente MCP
  → server (recibe request)
    → tool (valida input, orquesta)
      → provider (ejecuta operación)
        → servicio externo
      ← resultado tipado
    ← respuesta formateada
  ← MCP response
```

### Pipeline de release (orquestación)

```
Platform Catalog  →  ReleaseOrchestrator
                          │
                          ├─► vercel_status        (tool → provider)
                          ├─► vercel_prepare_staging
                          ├─► vercel_validate_staging
                          ├─► vercel_deploy_release
                          └─► vercel_rollback_release
```

### Decisión (hacia el Brain)

```
Orchestrator consolida resultados
  → BrainInput (context + signals)
    → DnxBrain.evaluate()
      ← BrainDecision (verdict, score, confidence, nextActions)
```

El Brain **no ejecuta** nada: informa si proceder, con precaución o rechazar.

## Convenciones de archivos

```
providers/<nombre>/
  index.ts          # Export público del provider
  client.ts         # Cliente HTTP/SDK (cuando aplique)
  types.ts          # Tipos específicos del provider
  operations/       # Operaciones agrupadas por dominio
```

```
tools/
  registry.ts       # Lista de registradores
  <dominio>/
    index.ts        # registerXTools(server)
    <tool-name>.ts  # Definición individual
```

## Extensibilidad

### Nuevo provider

1. Crear `src/providers/<nombre>/index.ts`
2. Implementar interfaz `Provider`
3. Registrar en `src/providers/index.ts`
4. Agregar variables al schema en `src/config/schema.ts`
5. Documentar en `docs/PROVIDERS.md`

### Nueva tool

1. Implementar lógica en el provider correspondiente
2. Crear tool en `src/tools/<dominio>/`
3. Registrar en `src/tools/registry.ts`
4. Documentar en `docs/TOOLS.md`

## Decisiones de diseño

| Decisión                                 | Razón                                                    |
| ---------------------------------------- | -------------------------------------------------------- |
| Providers como capa única de integración | Evita lógica duplicada entre tools                       |
| Platform Catalog separado del código     | Cada producto DNX se configura declarativamente          |
| Brain sin side-effects                   | Decisiones explicables sin acoplar ejecución             |
| Zod para config e inputs                 | Validación en runtime con tipos inferidos                |
| ESM + NodeNext                           | Compatibilidad nativa con Node 22 y MCP SDK              |
| Stubs iniciales                          | Permite crecer incrementalmente sin romper la estructura |
| Sin tests en el esqueleto                | Se agregan al implementar funcionalidad real             |
