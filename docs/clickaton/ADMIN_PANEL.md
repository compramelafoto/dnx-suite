# Clickatón — Panel administrativo MVP

Documento del panel `/admin`: shell (10B), autenticación DNX Identity y CRUD de ediciones/sedes (10C).

## Fronteras

| Capacidad | Dueño |
|-----------|--------|
| Marca, ediciones, sedes, inscripciones operativas, sponsors | **Clickatón** (este panel) |
| Consignas, fotos, validaciones, jurados, rankings, resultados | **FotoRank** |
| Órdenes, cobros, webhooks, conciliación, reembolsos, split | **DNX Payments** |
| Email marketing / comunicaciones masivas | **DNX Communications** — pendiente Etapa 2 (fuera del MVP) |

Clickatón **no** duplica las UIs internas de FotoRank ni de Payments. La sección Integraciones solo muestra estado y enlaces operativos.

## Menú MVP

1. Dashboard  
2. Ediciones  
3. Sedes  
4. Inscripciones  
5. Sponsors  
6. Configuración  
7. Integraciones  

Fuera de alcance MVP: comunicaciones, comunidad interna, academia, reportes avanzados, logística, voluntarios, portal sponsor/prensa, centro de comando, **franquicias**, permisos complejos por sede.

## Autenticación

- Cookie compartida `dnx_session` (`@repo/auth`).
- Login en `/admin/login` (email/contraseña DNX Identity).
- Guard server-side: `requireClickatonAdmin()` en `apps/clickaton/lib/admin/auth.ts`.
- Decisión única: `hasClickatonAdminAccess()` en `apps/clickaton/lib/admin/access.ts`.

### Administradores iniciales (acceso completo)

- `dnxfotografia@gmail.com`
- `rodrigorincon40@gmail.com`
- `tammytamerph@gmail.com`

Fuente única: `apps/clickaton/config/admin/admins.ts` (comparación case-insensitive + trim).  
También se permite `SUPER_ADMIN` (rol DNX).

### Deuda Identity / `CLICKATON` appAccess

`WorkspaceAppAccess` está en migraciones históricas y seed, pero **no** figura en el `schema.prisma` activo. Por eso 10B usa política centralizada por email en lugar de improvisar una migración amplia.

Cuando el modelo unificado vuelva al schema:

1. Introducir app `CLICKATON` de forma aditiva.
2. Asignar acceso a los tres administradores.
3. Hacer que `hasClickatonAdminAccess` consulte `appAccess` y retire la allowlist.

## Rutas (10B + 10C)

| Ruta | Notas |
|------|--------|
| `/admin` | Dashboard con métricas reales de ediciones/sedes o aviso migración pendiente |
| `/admin/ediciones` … | CRUD ediciones — ver [EDITIONS_AND_VENUES.md](./EDITIONS_AND_VENUES.md) |
| `/admin/sedes` … | CRUD sedes — filtros por edición y estado activo |
| `/admin/inscripciones` … `/admin/integraciones` | Empty states / configuración lectura |
| `/admin/login` | Acceso |
| `/admin/acceso-denegado` | Autenticado sin permiso |

El chrome público (`SiteHeader` / `SiteFooter`) vive solo en `app/(public)/`.

## Componentes admin reutilizables

- `AdminStatusBadge` — estado edición / sede activa
- `AdminDataTable` — tabla desktop + cards móvil
- `AdminForm` / `AdminFormSection` — layouts de formulario
- `AdminFlashMessage` — feedback post-acción (`?flash=`)
- `AdminMigrationNotice` — tablas Clickatón no aplicadas

## Variables de entorno

Ver `apps/clickaton/.env.example`:

- `DATABASE_URL` — requerida para login/sesión y CRUD
- `CLICKATON_FOTORANK_ADMIN_URL` / `FOTORANK_PUBLIC_WEB_BASE_URL` — enlace FotoRank (opcional)
- `CLICKATON_PAYMENTS_ADMIN_URL` — enlace Payments (opcional)
- `COOKIE_DOMAIN` — opcional, alineado al resto de la suite

## Validación de acceso (Etapa 10B1)

| Email | En Identity | Notas |
|-------|-------------|--------|
| `dnxfotografia@gmail.com` | Sí | Allowlist + password/Google; login real del panel = prueba manual del propietario |
| `rodrigorincon40@gmail.com` | No | Pendiente de alta manual en DNX Identity |
| `tammytamerph@gmail.com` | No | Pendiente de alta manual en DNX Identity |

No se inventan usuarios ni contraseñas. No se envían invitaciones automáticas.  
Deuda `WorkspaceAppAccess` / app `CLICKATON` permanece abierta.

Auditoría local: `pnpm --filter clickaton audit:admin-identity`

## Etapa 10C — Ediciones y sedes

Implementado:

- Modelos Prisma + migración SQL aditiva (`20260718120000_clickaton_editions_and_venues`)
- Dominio `lib/admin/editions/` y `lib/admin/venues/`
- CRUD completo en panel con empty states y tolerancia a migración no aplicada
- Autochecks de validación sin BD

Detalle: [EDITIONS_AND_VENUES.md](./EDITIONS_AND_VENUES.md)

**Migración:** preparada en repo; **no aplicada** a Neon shared en esta entrega.

## Scripts de calidad

```bash
pnpm --filter clickaton selfcheck:admin-auth
pnpm --filter clickaton selfcheck:admin-editions-validation
pnpm --filter clickaton selfcheck:admin-venues-validation
pnpm --filter clickaton check-types
pnpm --filter clickaton lint
pnpm --filter clickaton build
```
