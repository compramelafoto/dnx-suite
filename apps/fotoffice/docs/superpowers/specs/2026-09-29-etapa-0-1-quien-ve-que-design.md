# Etapa 0.1 — Quién ve qué: equipo, roles, tipo de organización y módulos

> Fecha: 2026-09-29 · Estado: **diseño aprobado por Daniel en conversación, pendiente de revisión escrita**
> Contexto: primera pieza de la Etapa 0 (cimientos) del plan de migración de Alboom a FOTOFFICE
> (`docs/alboom/00-mapa-general-y-plan.md`) y de la propuesta de módulos por tipo de workspace
> (`docs/negocio/2026-09-29-modulos-por-tipo-de-workspace.md`).

## 1. Problema

- Los módulos de un workspace sólo los enciende el Super Admin (`/admin/workspace-modules`,
  `WorkspaceFeatureModule`). El dueño no puede.
- No hay forma de sumar gente al equipo desde el propio workspace: las membresías se crean en
  `lib/ensure-workspace.ts` o desde el Super Admin.
- Cada módulo decide sus permisos por su cuenta (`lib/*/access.ts`, `lib/members/role-policy.ts`,
  `lib/workspace-settings-access.ts`, `lib/payments/connect/authz.ts`), y en varios el personal (STAFF)
  queda afuera de tareas operativas.
- La portada pregunta el tipo de organización (`lib/landing/tipos.ts`) pero la respuesta no se guarda ni
  decide nada.
- El CRM que viene (consultas, pedidos, proyectos) necesita saber **quién es responsable** de cada registro
  y qué ve cada persona.

## 2. Caso real que guía el diseño (DNX Estudio)

| Persona | Rol | Qué necesita |
|---|---|---|
| Daniel | Dueño | Todo |
| Sabi y Cami | Equipo (atención al público) | Usar todo el sistema (consultas, presupuestos, pedidos, caja, ventas, agenda, clientes, proyectos) **menos cambiar la configuración** |

La edición de fotos de eventos no es un permiso: se resuelve asignando a Daniel como **responsable** de los
proyectos de edición. Los otros cuatro usuarios de Alboom (Gianfranco, Julián, Lucila, Mariano) ya no
trabajan en DNX y **no se migran**.

## 3. Decisiones

1. **Roles fijos** (opción A), construidos para poder pasar a roles personalizados más adelante sin rehacer.
2. Cuatro roles. Tres ya existen en `WorkspaceRole`; se agrega uno:

| Rol visible | Valor en `WorkspaceRole` | Nuevo |
|---|---|---|
| Dueño | `WORKSPACE_OWNER` | — |
| Administrador | `WORKSPACE_ADMIN` | — |
| Equipo | `STAFF` (sólo cambia la etiqueta visible) | — |
| Colaborador | `COLLABORATOR` | ✓ |

3. **Matriz de permisos** (única fuente de verdad):

| Capacidad | Dueño | Admin | Equipo | Colaborador |
|---|:-:|:-:|:-:|:-:|
| `usarModulo` — operar cualquier módulo encendido | ✓ | ✓ | ✓ | — (sólo lo asignado) |
| `verDinero` — caja, cobranzas, precios, informes | ✓ | ✓ | ✓ | — |
| `configurar` — Configuración y Módulos | ✓ | ✓ | — | — |
| `gestionarEquipo` — invitar, cambiar roles, dar de baja | ✓ | ✓ | — | — |
| `transferirPropiedad` — traspasar dueño, dar de baja el workspace | ✓ | — | — | — |
| `verSoloAsignado` — filtra registros por responsable | — | — | — | ✓ |

4. **Colaborador oculto hasta que exista Proyectos**: el valor existe en la base y en la matriz, pero la
   pantalla de invitación no lo ofrece mientras el módulo Proyectos no esté `AVAILABLE`.
5. **Tipo de organización guardado** en el workspace. A los 7 tipos de la portada se suma
   **`estudio` — "Tengo un estudio o productora con equipo"** (DNX). El tipo **sugiere**, no prohíbe.
6. **Módulos por familia**: Base, Negocio fotográfico, Institución, Coberturas, Formación, Espacios.
7. **El dueño/admin enciende y apaga módulos** desde Configuración → Módulos, con dependencias explícitas.
   **Apagar nunca borra datos.**
8. **Módulos con comisión de plataforma** (hoy `membership-dues`, `bookings`, `courses-sales`; los que
   tienen `WorkspaceModuleFee`) no se autoactivan: "Pedir activación", los habilita el Super Admin.
9. **Fuera de alcance**: límites por plan comercial (no hay cobro de suscripciones aún), roles
   personalizados, permisos por módulo, interruptor "no ve dinero" para Equipo, portal del cliente.

## 4. Diseño

### 4.1 Política central de acceso — `lib/access/`

- `lib/access/roles.ts`: etiquetas visibles por rol y orden de jerarquía.
- `lib/access/policy.ts`: función pura `puede(rol, capacidad): boolean` con la matriz de §3.3. Sin Prisma.
- `lib/access/require.ts`: guardas de servidor que combinan workspace activo + módulo encendido + capacidad:
  `requireCapacidad(capacidad, { moduleKey? })`. Redirige o lanza igual que las guardas actuales.
- `lib/access/responsable.ts`: `filtroSoloAsignado(rol, userId)` que devuelve el `where` para los listados
  (vacío si el rol ve todo). Se usa recién cuando existan entidades con responsable; en 0.1 queda probado
  con tests.

**Migración de las guardas existentes** (auditoría incluida en el plan): cada `lib/*/access.ts`,
`lib/members/role-policy.ts`, `lib/workspace-settings-access.ts` y `lib/payments/connect/authz.ts` pasa a
delegar en `puede()`. Regla de la auditoría: **toda acción operativa queda para Equipo; sólo
Configuración, Módulos, Equipo y lo que hoy es explícitamente de configuración (p. ej. conectar Mercado
Pago, diseñar carnets, editar tarifas/categorías maestras) queda para Dueño y Administrador.** Cada cambio
de comportamiento se anota en el plan con el antes y el después. El `ADMIN` legacy de `Membership` sigue
aceptado donde hoy se acepta.

### 4.2 Equipo — Configuración → Equipo

Ruta nueva bajo `app/workspace/configuracion/equipo/` (Dueño y Admin).

- **Listado**: nombre, correo, rol, último ingreso, estado (activo / invitación pendiente / vencida /
  dado de baja).
- **Invitar**: correo + rol (Administrador o Equipo; Colaborador cuando exista Proyectos).
- **Acciones**: cambiar rol, dar de baja, reenviar o revocar invitación.
- **Reglas**:
  - Siempre queda al menos un Dueño; nadie se quita a sí mismo el último rol de Dueño.
  - Un Administrador no puede modificar ni dar de baja a un Dueño, ni nombrar Dueños.
  - Dar de baja borra la fila de `WorkspaceMembership` (corta el acceso en el próximo pedido) y **no borra
    nada** de lo que la persona hizo: el `User` sigue existiendo y su nombre sigue en historiales.
  - Toda invitación, aceptación, cambio de rol y baja deja una fila en `WorkspaceTeamEvent` (quién, a quién,
    qué, rol anterior y nuevo, cuándo). La pantalla de Equipo muestra ese historial.
  - Si el usuario invitado ya pertenece al workspace, no se crea invitación duplicada.

**Modelo nuevo `WorkspaceInvitation`** (mismo patrón probado que `MemberInvitation`):

```prisma
model WorkspaceInvitation {
  id              String        @id @default(cuid())
  workspaceId     String
  email           String        /// normalizado; la aceptación exige el mismo email autenticado
  role            WorkspaceRole
  tokenHash       String        @unique /// SHA-256; el token crudo nunca se guarda
  expiresAt       DateTime      /// 7 días
  acceptedAt      DateTime?
  acceptedUserId  Int?
  revokedAt       DateTime?
  sentAt          DateTime?     /// cuando el proveedor aceptó el correo
  invitedByUserId Int
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  workspace       Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, email])
}
```

```prisma
model WorkspaceTeamEvent {
  id            String   @id @default(cuid())
  workspaceId   String
  actorUserId   Int?     /// null = sistema
  targetUserId  Int?
  targetEmail   String?
  kind          String   /// INVITED | INVITE_REVOKED | ACCEPTED | ROLE_CHANGED | REMOVED
  fromRole      String?
  toRole        String?
  createdAt     DateTime @default(now())
  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
}
```

- **Aceptación**: `/equipo/aceptar?token=…`. Exige sesión; si no hay, lleva a iniciar sesión o registrarse
  y vuelve. Valida token (hash), vigencia, no usada, no revocada y **email de la sesión = email invitado**.
  Crea la `WorkspaceMembership` con el rol y marca `acceptedAt` en la misma transacción.
- **Correo**: por `lib/communications/send-and-log.ts` con la firma del workspace. Una invitación creada
  no es una invitación enviada: `sentAt` sólo se llena cuando Resend la acepta.

### 4.3 Tipo de organización

- Campo nuevo `Workspace.organizationType String?` (texto, sin enum nuevo, igual criterio que
  `activityType`). Valores = ids de `lib/landing/tipos.ts` + `estudio`.
- `lib/landing/tipos.ts` suma el tipo `estudio` con sus 3 destacados; el test existente sigue exigiendo
  que apunten a módulos que existen.
- Al crear un workspace (flujo de entrada / `ensure-workspace`), si viene el tipo desde la portada se
  guarda y se ofrece el **paquete sugerido** (§4.4) para confirmar.
- Workspaces existentes: se asigna a mano en la publicación — DNX Estudio `estudio`, SFPR `sociedad`,
  Foto Positiva `ong`. **Sin cambiar módulos encendidos.**

### 4.4 Catálogo de módulos con familias y dependencias

`lib/modules/registry.ts` suma a cada `ModuleDefinition`:

- `family: "base" | "negocio" | "institucion" | "coberturas" | "formacion" | "espacios"`
- `dependsOn?: string[]` (claves de módulo)
- `platformFee?: boolean` (requiere activación del Super Admin)

Asignación inicial para los módulos que existen:

| Módulo | Familia | Depende de | Comisión |
|---|---|---|:-:|
| clients | base | — | |
| cash | base | — | |
| website | base | — | |
| service-leads | negocio | — | |
| coverages | coberturas | — | |
| members | institucion | — | |
| membership-dues | institucion | members | ✓ |
| raffles | institucion | — | |
| courses-sales | formacion | — | ✓ |
| evaluaciones | formacion | courses-sales | |
| bookings | espacios | — | ✓ |

(`sales` y `sales-assistant`, cuando se fusionen, van a `negocio`.) Los módulos del CRM se registran como
`PLANNED` con su familia para que aparezcan como "Próximamente".

- `lib/modules/suggested.ts`: `paqueteSugerido(tipo): string[]` derivado de `tipos.ts` (destacados +
  además) filtrado a `AVAILABLE` y sin los de comisión.
- `lib/modules/dependencies.ts` (puro): `alEncender(clave, encendidos)` → faltantes a ofrecer;
  `alApagar(clave, encendidos)` → dependientes que dejan de funcionar.

### 4.5 Configuración → Módulos

Ruta nueva `app/workspace/configuracion/modulos/` (Dueño y Admin).

- Agrupado por familia; orden de familias según el tipo de organización.
- Cada módulo: nombre (con vocabulario), el "por qué" escrito para el tipo (de `tipos.ts`; si no hay, la
  descripción del catálogo), interruptor.
- Encender con dependencias faltantes → diálogo "También hay que encender X" (enciende ambos).
- Apagar con dependientes → diálogo "X deja de funcionar" (los dependientes quedan ocultos, no se borran).
- Módulos con comisión → botón **Pedir activación** que avisa al Super Admin por correo (no enciende).
- `PLANNED` → "Próximamente", sin interruptor.
- Cada cambio escribe `WorkspaceFeatureModule` con `updatedByUserId` (columna nueva, §5).
- El panel del Super Admin sigue funcionando igual.

### 4.6 Menú lateral

`lib/modules/nav.ts` agrupa los ítems habilitados por familia, con el orden de familias del tipo de
organización (sin tipo: orden actual). Los ítems de Configuración (Equipo, Módulos) sólo se muestran a
quien `puede(rol, "configurar")`/`"gestionarEquipo"`. El rol visible "Equipo" reemplaza a "Staff" donde se
muestre.

## 5. Datos y migración

Migración nueva (SQL a mano en las bases con dominio FOTOFFICE + `migrate resolve`, **antes** del código):

1. `ALTER TYPE "WorkspaceRole" ADD VALUE 'COLLABORATOR';`
2. `CREATE TABLE "WorkspaceInvitation" …` y `CREATE TABLE "WorkspaceTeamEvent" …` con índices y FK.
3. `ALTER TABLE "Workspace" ADD COLUMN "organizationType" TEXT;`
4. `ALTER TABLE "WorkspaceFeatureModule" ADD COLUMN "updatedByUserId" INTEGER;` (hoy no existe).

Todo es aditivo. Bases: las mismas de la etapa 1b de Ventas (`compramelafoto/development` = producción de
FOTOFFICE, `compramelafoto/production`, `clickaton-production`, `dnx-suite-staging`). InfoSpot queda
afuera si no tiene `Workspace` (verificar). Checksum registrado contra el archivo.

## 6. Riesgos

1. **Equipo gana permisos en workspaces existentes**: antes de publicar, listar los `STAFF` de SFPR, Foto
   Positiva y otros, y mostrárselos a Daniel para decidir.
2. **`ALTER TYPE … ADD VALUE`** no se puede usar dentro de la misma transacción en que se usa el valor:
   aplicar esa sentencia sola.
3. **Otras apps que leen `WorkspaceRole`**: `packages/auth-guards/src/index.ts` define su propia unión
   `"WORKSPACE_OWNER" | "WORKSPACE_ADMIN" | "STAFF"`; hay que sumarle `"COLLABORATOR"` y correr el chequeo
   de tipos de todas las apps que usan el paquete. Buscar además `switch` exhaustivos sobre el rol.
4. **Invitación a correo sin cuenta**: el registro tiene que volver al enlace de aceptación sin perder el
   token.

## 7. Pruebas

- `policy.test.ts`: la matriz completa, rol × capacidad.
- `dependencies.test.ts`: encender/apagar con y sin dependencias, cadenas (evaluaciones → courses-sales).
- `suggested.test.ts`: cada tipo produce un paquete de módulos `AVAILABLE`, sin comisión.
- `registry.test.ts`: todo módulo tiene familia; `dependsOn` apunta a claves existentes; no hay ciclos.
- `tipos.test.ts` (existente): incluye `estudio`.
- Invitaciones: vencida, usada, revocada, email distinto, duplicada, último dueño, admin contra dueño;
  cada acción deja su `WorkspaceTeamEvent`.
- Auditoría de guardas: un test por módulo que fije qué puede Equipo.
- **Prueba manual antes de fusionar**: Daniel invita una cuenta de prueba como Equipo en DNX Estudio y
  verifica que entra, usa Caja y Ventas, y no ve Configuración, Módulos ni Equipo.

## 8. Publicación

1. SQL en las bases + `migrate resolve` con checksum.
2. PR y fusión.
3. Asignar tipo a DNX (`estudio`), SFPR (`sociedad`), Foto Positiva (`ong`).
4. Daniel invita a Sabi y Cami como Equipo en DNX Estudio.
