# Clickatón — Panel administrativo MVP

Documento de la **Etapa 10B**: shell `/admin`, autenticación DNX Identity y menú MVP.

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

Fuera de alcance MVP: comunicaciones, comunidad interna, academia, reportes avanzados, logística, voluntarios, portal sponsor/prensa, centro de comando, franquicias, permisos complejos por sede.

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

## Rutas

| Ruta | Notas |
|------|--------|
| `/admin` | Dashboard honesto (sin métricas inventadas) |
| `/admin/ediciones` … `/admin/integraciones` | Empty states / configuración lectura |
| `/admin/login` | Acceso |
| `/admin/acceso-denegado` | Autenticado sin permiso |

El chrome público (`SiteHeader` / `SiteFooter`) vive solo en `app/(public)/`.

## Variables de entorno

Ver `apps/clickaton/.env.example`:

- `DATABASE_URL` — requerida para login/sesión
- `CLICKATON_FOTORANK_ADMIN_URL` / `FOTORANK_PUBLIC_WEB_BASE_URL` — enlace FotoRank (opcional)
- `CLICKATON_PAYMENTS_ADMIN_URL` — enlace Payments (opcional)
- `COOKIE_DOMAIN` — opcional, alineado al resto de la suite

## Próxima etapa

**10C — Modelo y CRUD mínimo de ediciones y sedes** (sin comenzar en este documento).
