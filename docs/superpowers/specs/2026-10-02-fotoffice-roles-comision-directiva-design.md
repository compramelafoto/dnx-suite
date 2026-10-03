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
