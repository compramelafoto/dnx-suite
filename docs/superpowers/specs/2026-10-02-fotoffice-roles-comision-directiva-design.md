# FotoOffice — Roles, áreas y Comisión directiva

**Fecha:** 2026-10-02
**Estado:** diseño aprobado (todas las decisiones tomadas el 2026-10-02, sección 11), pendiente de plan de implementación
**Institución de referencia:** Sociedad de Fotógrafos Profesionales de Rosario (SFPR)

---

## 1. El problema

Hoy un workspace de FotoOffice distingue solo tres roles (`WorkspaceRole`):

| Rol | Qué puede |
|---|---|
| `WORKSPACE_OWNER` | Todo |
| `WORKSPACE_ADMIN` | Todo menos lo reservado al dueño |
| `STAFF` | Consultar; en algunos módulos, operar lo básico (agenda de reservas, entregar premios) |

Eso no alcanza para una institución real:

- El **tesorero** necesita manejar cuotas y cobros, pero no tiene por qué editar el sitio web.
- **Comunicación** necesita el blog y los correos, pero no tiene que ver dinero.
- El **revisor de cuentas** tiene que ver la caja, pero nunca modificarla.
- Cada institución organiza su comisión distinto, y una asociación chica concentra todo en dos o tres personas.

El propio código ya marca la deuda: `lib/members/role-policy.ts` dice *"No hay roles granulares (SECRETARIO/TESORERO/PRESIDENTE) todavía — eso viene después."*

Además, quien integra la comisión **ya es socio**: tiene su usuario y entra al portal. Hay que darle un acceso extra sin crearle otra cuenta.

## 2. La respuesta corta

- **Sí, el admin del workspace va a poder crear roles propios** y elegir, módulo por módulo, qué puede hacer cada uno.
- FotoOffice trae **roles de plantilla** (Tesorería, Secretaría, Comunicación…) para no arrancar de cero. Se pueden usar tal cual, editar o borrar.
- A una persona se le asignan **uno o varios roles** y un **cargo** opcional (con fechas de mandato).
- Quien es socio y además tiene un rol ve en su encabezado un selector **"Portal del socio ⇄ Administración"**. En Administración el menú muestra **solo** los módulos que su rol le habilita.

## 3. Tres conceptos separados

Separarlos es la decisión central del diseño.

| Concepto | Qué es | Quién lo ve | Ejemplo |
|---|---|---|---|
| **Rol** (área) | Paquete de permisos sobre módulos. Lo define el admin. | Solo el equipo | "Tesorería": Cuotas = Gestionar, Caja = Gestionar, Socios = Ver |
| **Cargo** | Título institucional con mandato. No da permisos por sí solo. | Público (Transparencia, Gobierno) | "Tesorero, 01/2026 → 12/2027" |
| **Asignación** | Une a una persona con un rol (y, si corresponde, un cargo) por un período | El admin | Ana Pérez → Tesorería, cargo Tesorera, hasta 31/12/2027 |

Por qué separados:

- Una persona puede tener **varios roles** (Secretaría + Comunicación).
- Un cargo puede ser **solo honorífico**: un vocal tiene cargo y quizás ningún permiso.
- Un permiso puede no tener cargo: por ejemplo, una **empleada administrativa** con rol "Atención al socio".
- Al **vencer el mandato** se cortan los permisos solos, y el cargo queda en el historial de autoridades.

## 4. Niveles de permiso por módulo

Para cada módulo, un rol tiene uno de tres niveles:

| Nivel | Significa |
|---|---|
| **Sin acceso** | El módulo no aparece en su menú y sus pantallas lo rechazan |
| **Ver** | Entra y consulta; no crea ni modifica |
| **Gestionar** | Crea, edita y opera el módulo |

Esto encaja con lo que ya existe: cada submódulo en `lib/modules/submodules.ts` tiene la marca `requiresManage`. "Ver" muestra los submódulos sin esa marca; "Gestionar" los muestra todos. **No hace falta rediseñar el menú, solo cambiar de dónde sale la decisión.**

### Acciones sensibles (segunda etapa)

Algunas acciones son más delicadas que "gestionar" y conviene poder darlas aparte:

| Módulo | Acción sensible |
|---|---|
| Sorteos | Sellar y resolver el sorteo |
| Cuotas | Registrar pago manual, anular un pago, condonar deuda |
| Caja | Anular un movimiento, cerrar el mes |
| Socios | Dar de baja, reactivar |
| Configuración | Conectar Mercado Pago, cambiar datos de cobro |

En la etapa 1 quedan incluidas en "Gestionar". En la etapa 2 se agregan como casillas extra dentro del rol.

### Lo que nunca se delega

Reservado al dueño y a los admins del workspace, sin importar el rol:

- Crear, editar y asignar roles.
- Activar o apagar módulos del workspace.
- Datos de cobro e integraciones (Mercado Pago, Google).
- Borrar el workspace o transferir la titularidad.

## 5. Roles de plantilla

Al activar la función, cada workspace recibe estos roles ya armados. Se pueden editar, renombrar o borrar. Los nombres pasan por **Configuración → Palabras**, así una empresa puede llamar "Equipo" a lo que una asociación llama "Comisión directiva".

| Rol | Gestiona | Ve | Nota |
|---|---|---|---|
| **Presidencia** | — | Todo | No carga datos; las aprobaciones se deciden en comisión |
| **Secretaría** | Socios, Carnets, Gobierno (actas, asambleas) | Cuotas | Maneja el padrón y las altas |
| **Tesorería** | Cuotas, Caja | Socios | Lo más sensible: todo queda registrado |
| **Revisor de cuentas** | — | Cuotas, Caja, Transparencia | Órgano fiscalizador; solo lectura, como piden los estatutos |
| **Comunicación** | Sitio web y blog, Comunicación (correos) | Socios (ficha completa: contacto y redes sociales), Sorteos | Nunca ve dinero: Cuotas y Caja quedan en Sin acceso |
| **Formación** | Cursos, Evaluaciones | — | Docentes e inscripciones |
| **Cultura y eventos** | Eventos, Muestras, Sorteos | Socios | Puente con concursos de FotoRank |
| **Espacios** | Reservas | — | Agenda, espacios y tarifas |
| **Alianzas y beneficios** | Recomendados, Partners | Sorteos | Premios y sponsors |
| **Atención al socio** | — | Socios, Cuotas, Reservas | Para personal administrativo |
| **Vocal** | — | Panel general | Sin edición |

Para un **estudio o empresa** (no asociación) se ofrece otro juego: **Comercial** (Clientes, presupuestos, ventas), **Producción** (coberturas, entregas) y **Administración** (Caja).

Los módulos que todavía están en estado `PLANNED` (Caja, Comunicación, Eventos, Clientes, Gobierno, Muestras, Transparencia) aparecen en las plantillas **ya previstos**: cuando cada módulo se active, el rol lo incluye sin tocar nada.

## 6. Cómo lo usa el admin

### 6.1 Pantalla "Roles" (Configuración → Comisión directiva → Roles)

- Lista de roles con su cantidad de personas.
- Botón **"Nuevo rol"**: nombre, descripción, color e ícono.
- Una **grilla de permisos**: una fila por módulo **activado en el workspace** y tres opciones por fila (Sin acceso / Ver / Gestionar).
- Los módulos apagados en el workspace no se ofrecen. Si después se apagan, el permiso queda guardado pero sin efecto.
- **Duplicar rol**, para crear una variante sin empezar de cero.
- Antes de borrar un rol con personas asignadas, se pide confirmación y se avisa a quiénes afecta.

### 6.2 Pantalla "Integrantes" (Configuración → Comisión directiva)

- Botón **"Sumar integrante"**: se busca entre los **socios** por nombre o número. También se puede invitar por correo a alguien que no es socio, como una empleada.
- Se elige uno o varios **roles**, un **cargo** opcional y las **fechas del mandato** (opcional; sin fecha, no vence).
- La persona recibe un correo: *"Te sumaron a la Comisión directiva como Tesorera"*.
- Vista de **historial**: quién ocupó cada cargo y en qué período. Alimenta Transparencia y Gobierno.

### 6.3 Resguardos

- **Nadie se puede dar a sí mismo más permisos** de los que tiene.
- **El último dueño no puede perder el acceso.**
- **Registro de acciones**: toda asignación, cambio de rol y operación sobre dinero queda anotada (quién, qué y cuándo).
- Al **vencer un mandato**, un proceso diario quita los permisos y avisa al admin una semana antes.

## 7. Cómo lo vive el integrante

FotoOffice ya distingue dos perfiles por cuenta (`lib/portal/profiles.ts`): **MEMBER** (socio de una institución) y **TEAM** (equipo de un workspace), y ya existe `/elegir-perfil`. Este diseño se apoya en eso.

1. Ana es socia y entra al **portal** como siempre: carnet, cuotas, reservas, sorteos.
2. Cuando la suman a Tesorería, pasa a tener también un perfil **TEAM** en ese workspace.
3. En el encabezado del portal aparece un selector **"Portal del socio ⇄ Administración"**, el mismo patrón que el selector de rol de FotoRank (PR 267).
4. En **Administración**, el menú lateral muestra solo Cuotas, Caja y Socios (en modo lectura). Nada más.
5. El último modo elegido se recuerda en una cookie, igual que hoy la preferencia del menú (`fo_nav`).
6. Al iniciar sesión **no se le pregunta** a dónde ir si solo administra la institución de la que es socia. Entra al portal y cambia con el selector. `/elegir-perfil` queda para quien tiene perfiles en instituciones distintas.

**Regla de seguridad:** ocultar un botón del menú no protege nada. Cada página y cada acción del servidor vuelve a comprobar el permiso con la misma función.

## 8. Modelo de datos

Tablas nuevas en `packages/db/prisma/schema.prisma`:

```prisma
/// Rol definido por el workspace (o creado desde una plantilla).
model WorkspaceCustomRole {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?
  color       String?
  templateKey String?  /// "treasury", "secretary"… si nació de una plantilla
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  permissions WorkspaceRolePermission[]
  assignments WorkspaceRoleAssignment[]
  @@unique([workspaceId, name])
}

enum ModulePermissionLevel {
  NONE
  VIEW
  MANAGE
}

/// Nivel de un rol sobre un módulo del registry (`moduleKey`).
model WorkspaceRolePermission {
  id        String                @id @default(cuid())
  roleId    String
  moduleKey String
  level     ModulePermissionLevel
  /// Etapa 2: acciones sensibles extra, p. ej. ["dues.manual_payment"]
  actions   String[]              @default([])
  @@unique([roleId, moduleKey])
}

/// Persona ↔ rol, con cargo y mandato opcionales.
model WorkspaceRoleAssignment {
  id          String    @id @default(cuid())
  workspaceId String
  userId      Int
  roleId      String
  positionTitle String? /// Cargo: "Tesorera", "Presidente"…
  startsAt    DateTime?
  endsAt      DateTime? /// null = no vence
  assignedById Int
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?
  @@index([workspaceId, userId])
}
```

Relación con lo existente:

- Quien recibe una asignación también tiene (o se le crea) una fila en `WorkspaceMembership` con rol `STAFF`. Así sigue funcionando todo lo que hoy pregunta "¿es del equipo?".
- `WORKSPACE_OWNER` y `WORKSPACE_ADMIN` **no se tocan**: siguen valiendo "Gestionar en todo" sin necesidad de un rol.
- Un `STAFF` **sin** asignaciones conserva exactamente los permisos de hoy. Nadie pierde acceso el día que esto sale.

## 9. La función única de permisos

Hoy hay más de 40 archivos que deciden permisos, cada uno con su variante (`canManageMembers`, `requireRafflesAdmin`, `requireBookingsStaff`, `canManageWorkspaceSettings`…). Se reemplazan por una sola:

```ts
// lib/permissions/module-access.ts
getModuleLevel(userId, workspaceId, moduleKey): Promise<"NONE" | "VIEW" | "MANAGE">
requireModuleLevel(moduleKey, "VIEW" | "MANAGE")   // para páginas y acciones del servidor
```

Cómo resuelve:

1. Si el módulo está apagado en el workspace → `NONE`.
2. Si es `WORKSPACE_OWNER` o `WORKSPACE_ADMIN` → `MANAGE`.
3. Si tiene asignaciones vigentes → el **máximo** nivel entre sus roles.
4. Si es `STAFF` sin asignaciones → el nivel que tiene hoy (tabla de compatibilidad).
5. Si no → `NONE`.

El menú (`resolveEnabledNavModules` y `submodules.ts`) usa la misma función, así **el menú y las páginas no pueden discrepar**: es el mismo problema que ya se resolvió una vez con `resolveWorkspaceRole`.

## 10. Etapas

| Etapa | Contenido | Resultado visible |
|---|---|---|
| **1** | Tablas, función única de permisos, compatibilidad con `STAFF`. Se migran Socios, Cuotas, Reservas y Sorteos | Nada cambia para nadie (red de seguridad) |
| **2** | Pantallas Roles e Integrantes, plantillas y correo de aviso | El admin arma su comisión |
| **3** | Selector "Portal ⇄ Administración" y menú filtrado por rol | El tesorero entra y ve solo lo suyo |
| **4** | Resto de los módulos (Cursos, Evaluaciones, Sitio web, Recomendados, Blog, Portfolio) | Cobertura completa |
| **5** | Acciones sensibles, registro de acciones, vencimiento de mandatos y aviso al admin si un integrante queda inactivo como socio | Control fino y auditoría |
| **6** | Cargos públicos en Transparencia y Gobierno, historial de autoridades | Autoridades visibles en el sitio |

## 11. Decisiones

Resueltas el 2026-10-02:

1. **Quién crea roles:** el **dueño y los admins** del workspace.
2. **Integrante que no es socio** (empleada, contador externo): **sí**, entra directo a Administración, sin portal.
3. **Comunicación y los datos de los socios:** **sí**, ve la ficha completa del socio, incluidos contacto y redes sociales. Los datos de pago no los ve porque viven en Cuotas y Caja, que en su plantilla quedan en Sin acceso. No hace falta una regla especial: sale de la grilla de permisos.

**Todo es configurable por workspace:** el **nombre** de cada rol (una institución dice "Tesorería", otra "Finanzas", un estudio "Administración") y los **módulos habilitados** con su nivel. Un cambio en un workspace no afecta a ningún otro: las plantillas se copian al workspace, no se comparten.

Todo lo anterior describe **plantillas y valores por defecto**. Cada workspace puede cambiar cualquier rol desde la grilla, salvo lo indicado en "Lo que nunca se delega" (sección 4).

4. **Doble firma:** **no**. Las aprobaciones de gastos se deciden en reunión de comisión, no en el sistema. Presidencia queda con permiso de ver todo y sin aprobaciones.
5. **Socio con rol que queda inactivo** (por ejemplo, por deuda): **mantiene el rol** y se **notifica al admin** del workspace.

No quedan decisiones abiertas.

## 12. Integración con Gobierno institucional (2026-10-03)

El diseño de Gobierno (`apps/fotoffice/docs/superpowers/specs/2026-10-03-fotoffice-gobierno-proyectos-design.md`, rama `docs/fotoffice-gobierno-proyectos`) usa esta etapa 2 como su "etapa 0". De ahí salen estos cambios.

### 12.1 Decisiones del 2026-10-03

1. **Quién vota:** cada **cargo** tiene la casilla **"integra la comisión y vota"**. Presidente, Vicepresidente, Secretario, Tesorero y vocales la traen marcada; Revisor de cuentas, no. Cada institución la ajusta. Votan quienes tienen un mandato vigente en un cargo con esa casilla.
2. **Plata de proyectos:** es un **permiso aparte** dentro de Caja (acción sensible `cash.project_money`), no un nivel nuevo. Tesorería lo trae marcado. El mostrador puede seguir cargando movimientos sin tocar la plata de proyectos.
3. **Socio inactivo con cargo:** **sigue votando** (coherente con mantener el rol); el admin recibe el aviso.
4. **Socio sin cuenta:** el cargo y los roles **se cargan igual** sobre la ficha del socio. Figura en la comisión, en las actas y en los avisos desde ese momento; entra al panel cuando active su cuenta.

### 12.2 Cambios al modelo (sobre las tablas de la etapa 1)

- **El cargo pasa a ser un dato propio**, con dos tablas nuevas:
  - `WorkspaceOffice` (cargo definido por la institución): nombre, orden, `votes` (sí/no).
  - `WorkspaceOfficeTerm` (mandato): cargo, socio (`memberId`) o usuario (`userId`), desde, hasta, revocado, quién lo cargó.
  - Sale `positionTitle` de `WorkspaceRoleAssignment`: un vocal puede tener cargo sin rol y una empleada puede tener rol sin cargo.
- **`WorkspaceRoleAssignment` admite socio sin cuenta:** `userId` pasa a opcional y se agrega `memberId`. Al menos uno de los dos es obligatorio. El nivel se calcula para el usuario directo o para el usuario vinculado a la ficha del socio.
- **`WorkspaceCustomRole.archivedAt`:** borrar un rol con personas lo archiva y revoca sus asignaciones. Nada se borra (igual que en Gobierno).

### 12.3 Corrección a la regla de la etapa 1

La etapa 1 vuelve a la compatibilidad de STAFF cuando todas las asignaciones están vencidas o revocadas. Eso le devolvería a un ex tesorero el acceso de "personal" (ver el padrón). **Desde la etapa 2:** quien tuvo alguna asignación alguna vez ya no usa la compatibilidad: sin asignaciones vigentes, su nivel es `NONE`. Al quitar a alguien de la comisión, si su membresía es `STAFF`, se la quita también. A dueño y admin nunca se los toca.

### 12.4 Plantillas ajustadas

- **Presidencia** y **Secretaría** gestionan Gobierno (proyectos, reuniones y actas).
- **Tesorería** gestiona Caja con `cash.project_money`.
- **Revisor de cuentas** ve Gobierno.
- **Cargos sembrados:** Presidente, Vicepresidente, Secretario, Prosecretario, Tesorero, Protesorero, Vocal titular, Vocal suplente (todos votan) y Revisor de cuentas (no vota).

### 12.5 Orden de etapas actualizado

| Etapa | Contenido |
|---|---|
| 2 | Cargos y mandatos, roles por workspace con plantillas, pantallas Roles · Cargos · Integrantes, correo "te sumaron", aviso al admin si un integrante queda inactivo, corrección §12.3 |
| 2b | Caja y Clientes pasan a niveles, con la acción `cash.project_money` (antes de la etapa 3 de Gobierno) |
| 3 | Selector "Portal ⇄ Administración" y menú filtrado por rol |
| 4 | Resto de los módulos |
| 5 | Resto de las acciones sensibles y registro de acciones |
| 6 | Cargos públicos en Transparencia |

### 12.6 Qué toma Gobierno de acá

- `listActiveOfficeHolders(workspaceId)`: integrantes con mandato vigente, con su cargo y si votan (asistentes y avisos).
- `canVote(userId, workspaceId)`: mandato vigente en un cargo que vota.
- `getModuleLevel(…, "governance")` para Ver/Gestionar, y la acción `cash.project_money` para reservas, gastos e ingresos.
- **El diseño de Gobierno tiene que ajustar dos frases.** §4.5 y §13: "cargo vigente" pasa a ser "cargo vigente que vota". §8.6: "Caja en Gestionar" pasa a ser "Caja con *Dinero de proyectos*".
