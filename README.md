# DNX Suite

Monorepo para la suite de aplicaciones de fotografía DNX.

## Estructura

```
dnx-suite/
├── apps/
│   ├── fotorank/       # App Fotorank
│   └── compramelafoto/ # App CompraMeLaFoto
├── packages/
│   ├── ui/             # Componentes UI compartidos
│   ├── eslint-config/  # Configuración ESLint
│   └── typescript-config/ # Configuración TypeScript
```

## Requisitos

- Node.js >= 18
- pnpm 9.x
- Docker (para la base de datos PostgreSQL)

## Base de datos

FotoRank usa PostgreSQL. Para iniciar la base de datos:

1. **Inicia Docker Desktop** (si usas Docker).

2. **Inicia PostgreSQL:**
```sh
pnpm db:up
```

3. **Aplica las migraciones:**
```sh
pnpm --filter @repo/db db:migrate
```

**Si no usas Docker:** instala PostgreSQL localmente y crea la base `dnx_suite` con usuario `dnx` y contraseña `dnx123`, o ajusta `DATABASE_URL` en `packages/db/.env` y `apps/fotorank/.env`.

Tras migrar, **`pnpm --filter @repo/db db:seed`** carga también usuarios **`@fotorank.com`** (contraseña `123456`) para pruebas manuales: **organizador y participantes entran por `/login`**; **jurados por `/jurado/login`**. Tabla completa y fixture (concurso, categoría, asignaciones) en **[`packages/db/README.md`](packages/db/README.md#usuarios-fotorankcom-testing-manual-en-fotorank)**.

## Comandos

```sh
# Instalar dependencias
pnpm install

# Desarrollo (todas las apps)
pnpm dev

# Desarrollo de una app específica
pnpm --filter fotorank dev
pnpm --filter compramelafoto dev

# Build de todo el monorepo
pnpm build

# Lint
pnpm lint

# Verificación de tipos
pnpm check-types
```

## Tecnologías

- **Turborepo** - Orquestación del monorepo
- **pnpm workspaces** - Gestión de paquetes
- **Next.js 16** - Framework para las apps (App Router)
- **TypeScript** - Tipado estático

## Tests E2E (Fotorank — módulo Jurados)

Herramienta: **Playwright** (`@playwright/test`), configuración en `apps/fotorank/playwright.config.ts`.

### Requisitos

- Base migrada y **seed** ejecutado (los datos del jurado demo, concurso `e2e-demo-contest` e invitación fija están en `packages/db/prisma/seed.ts`).
- `DATABASE_URL` válido en el entorno (p. ej. `apps/fotorank/.env` y/o `packages/db/.env`).
- **Navegadores de Playwright:** el comando `pnpm --filter fotorank test:e2e` ejecuta antes `playwright install` (incluye **Chromium headless shell** de Playwright 1.51+). Si fallara la descarga, corré solo: `pnpm --filter fotorank test:e2e:install`.

### Cómo correrlos

Desde la raíz del monorepo. **No pegues comentarios `# ...` en la misma línea del comando:** en zsh puede fallar (p. ej. `unknown file attribute: C`) y **pnpm** puede pasar argumentos extra a Prisma.

```sh
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:seed
pnpm --filter fotorank test:e2e
```

**Smoke (4 tests críticos, tag `@smoke`):** `pnpm --filter fotorank test:e2e:smoke` (o `test:e2e:smoke:only` sin `playwright install`). Detalle en `apps/fotorank/e2e/README.md`.

El script `test:e2e` de Fotorank corre `playwright install` automáticamente antes de los tests. Opcional manual: `pnpm --filter fotorank test:e2e:install`. En CI con navegadores ya en caché: `pnpm --filter fotorank test:e2e:only`.


`playwright.config.ts` levanta `pnpm dev` en el puerto **3000** salvo que exista ya el servidor (`reuseExistingServer` fuera de CI). Para otra URL: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm --filter fotorank test:e2e`.

**Nota:** el spec de invitación deja la invitación en estado aceptado; para repetir la suite completa en local, volvé a ejecutar `db:seed`.

### Qué cubren los archivos en `apps/fotorank/e2e/`

| Archivo | Flujo |
|--------|--------|
| `admin-results.spec.ts` | Admin: login, org activa, concursos, detalle, vista **resultados** / tabla de ranking |
| `admin-judges.spec.ts` | Admin: login, crear jurado (archivo avatar + bio enriquecida), editar y guardar |
| `judge-invite.spec.ts` | Jurado: registro con token `/jurado/registro`, panel; login con credenciales sembradas |
| `judge-evaluacion.spec.ts` | Jurado: login, panel, evaluación **CRITERIA_BASED**, “Voto guardado” |
| `public-judges.spec.ts` | Público: lista `/concursos/e2e-demo-contest/jurados` y perfil `/jurados/publico/jurado-demo-e2e` |

Credenciales y slugs están documentados en `apps/fotorank/e2e/constants.ts` (alineado con el seed).
