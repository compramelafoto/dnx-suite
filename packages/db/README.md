# @repo/db

Paquete compartido de base de datos para DNX Suite. Utiliza Prisma con PostgreSQL.

## Configuración

1. Copia el archivo de ejemplo de variables de entorno:

```sh
cp .env.example .env
```

2. Configura `DATABASE_URL` en `.env` con tu conexión PostgreSQL:

```
DATABASE_URL="postgresql://user:password@localhost:5432/dnx_suite"
```

## Uso desde las apps

```ts
import { prisma } from "@repo/db";

// Ejemplo
const users = await prisma.user.findMany();
```

## Comandos

```sh
# Generar cliente Prisma (se ejecuta automáticamente en postinstall)
pnpm db:generate

# Crear y aplicar migraciones (desarrollo)
pnpm db:migrate

# Aplicar migraciones (producción)
pnpm db:migrate:deploy

# Sincronizar schema sin migraciones (prototipado)
pnpm db:push

# Poblar datos (E2E + usuarios @fotorank.com de prueba)
pnpm db:seed
# o: pnpm exec prisma db seed

# Abrir Prisma Studio
pnpm db:studio
```

### Usuarios @fotorank.com (testing manual en Fotorank)

Tras migraciones, desde **`packages/db`** con `DATABASE_URL` configurado:

```sh
pnpm db:seed
```

#### Dos URLs de login (no mezclar)

| Sistema | Ruta en la app | Tabla Prisma |
|---------|----------------|--------------|
| **Organizador / admin / participante (User)** | **`/login`** | `User` + `passwordHash` |
| **Jurado** | **`/jurado/login`** | `FotorankJudgeAccount` + `passwordHash` |

Las cuentas `jurado*@fotorank.com` **no** pueden iniciar sesión en `/login` y los `User` **no** en `/jurado/login`: son credenciales y filas distintas.

Contraseña común de prueba: **`123456`**. Los hashes en BD usan **scrypt** (`salt:digest`), igual que `apps/fotorank/app/lib/security/password.ts` — **no** bcrypt.

*(En local, la app suele ser `http://localhost:3000`; anteponé ese origen a las rutas.)*

#### Tabla de cuentas

| Usuario | Contraseña | Rol funcional | URL de login | Qué conviene probar |
|---------|------------|---------------|--------------|---------------------|
| `admin@fotorank.com` | `123456` | Admin de workspace + dueño de org seed | **`/login`** | Dashboard, org `seed-ft-com-admin`, permisos elevados en `Membership` (ADMIN). |
| `organizador@fotorank.com` | `123456` | Dueño de organización Fotorank + creador del concurso seed | **`/login`** | Flujo organizador: org **Org organizador @fotorank.com (seed)**, concurso publicado **Concurso de prueba (seed @fotorank.com)**, categoría **General**, jurados ya asignados. |
| `participante1@fotorank.com` | `123456` | Participante (User con obra en el seed) | **`/login`** | Sesión como usuario con `FotorankContestEntry` en el concurso seed (obra “Participante 1”). |
| `participante2@fotorank.com` | `123456` | Participante (User con obra en el seed) | **`/login`** | Igual que participante1, segunda obra de prueba. |
| `jurado1@fotorank.com` | `123456` | Jurado | **`/jurado/login`** | Panel jurado, asignación **ACCEPTED**, evaluación **CRITERIA_BASED** sobre entradas del concurso seed. |
| `jurado2@fotorank.com` | `123456` | Jurado | **`/jurado/login`** | Mismo concurso/categoría que jurado1; útil para probar dos jurados en paralelo. |

El modelo `User` **no** tiene campo `role` global; el “rol” funcional se refleja en `Membership`, `ContestOrganizationMember` o en ser cuenta jurado.

#### Datos mínimos que deja el seed (organizador + concurso + jurados + entries)

| Dato | Valor |
|------|--------|
| Organización del organizador | slug **`seed-ft-com-organizador`**, nombre *Org organizador @fotorank.com (seed)* |
| Concurso | slug **`concurso-prueba-seed-ft-com`**, estado **PUBLISHED** |
| Categoría | slug **`general`**, nombre *General* |
| Jurados | `jurado1` / `jurado2`: membresía en la org del organizador + asignación aceptada a esa categoría |
| Obras | 2 `FotorankContestEntry` (autores participante1 y participante2) en ese concurso/categoría |

Org adicional del admin (solo para pruebas de otro contexto): slug **`seed-ft-com-admin`**.

## Desde la raíz del monorepo

```sh
pnpm --filter @repo/db db:generate
pnpm --filter @repo/db db:migrate
pnpm --filter @repo/db db:studio
```
