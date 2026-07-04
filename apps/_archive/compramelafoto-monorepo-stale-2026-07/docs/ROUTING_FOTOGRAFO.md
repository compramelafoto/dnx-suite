# Routing público del fotógrafo

## URL canónica

La página pública del fotógrafo se sirve desde la **raíz** del sitio:

- **Canónica:** `/{handler}` (ej: `https://ejemplo.com/mi-estudio`)
- **Subpaths:** `/{handler}/imprimir`, `/{handler}/imprimir/datos`, `/{handler}/imprimir/resumen`, `/{handler}/imprimir/confirmacion`, `/{handler}/albums`

Las rutas dinámicas viven en `app/[handler]/` (y subcarpetas). Next.js da prioridad a las rutas estáticas; si el primer segmento coincide con una carpeta estática (p. ej. `admin`, `cliente`), se usa esa ruta y no `[handler]`.

## Lista negra (slugs reservados)

Los siguientes segmentos **no** pueden usarse como `handler` de fotógrafo porque están reservados para rutas del sistema. La validación está en `lib/photographer-slugs.ts` y se aplica en el layout `app/[handler]/layout.tsx`.

| Slug reservado | Uso |
|----------------|-----|
| `a` | Álbumes públicos (`/a/[id]`) |
| `admin` | Panel admin |
| `api` | Rutas API |
| `ayuda` | Ayuda |
| `cliente` | Área cliente |
| `dashboard` | Dashboard fotógrafo |
| `demo-ui` | Demo UI |
| `f` | Prefijo legacy `/f/[handler]` |
| `fotografo` | Área fotógrafo (login, config, etc.) |
| `forgot-password` | Recuperar contraseña |
| `imprimir` | Flujo imprimir genérico |
| `imprimir-publico` | Imprimir público |
| `invite` | Invitaciones |
| `l` | Rutas lab público |
| `lab` | Área laboratorio |
| `login` | Login |
| `pago` | Pago (success, pending, failure) |
| `registro` | Registro |
| `reset-password` | Reset contraseña |
| `terminos` | Términos |
| `verify-email` | Verificación email |
| `support`, `public`, `demo`, `app` | Reservados |

Al crear o validar un `publicPageHandler` (p. ej. en configuración del fotógrafo), se debe usar `isReservedPhotographerSlug()` para rechazar estos valores.

## Legacy `/f/[handler]`

**Subpaths:** `middleware.ts` redirige **301** cualquier ruta `/f/[handler]/...` hacia la canónica `/{handler}/...` (misma query string). Así enlaces viejos como `/f/mi-estudio/imprimir` resuelven sin 404 por falta de página bajo `app/f/`.

**Raíz `/f/[handler]`:** además existe `app/f/[handler]/page.tsx`, que comprueba en base al fotógrafo y hace **redirect 301** a `/{handler}` o **404** si no aplica.

Si un slug no existe como página pública, el destino `/{handler}/...` puede ser 404 igual que sin el prefijo `/f/` (comportamiento esperado).

## Monitoreo

- Revisar logs de **404** tras el cambio: si aparecen rutas que antes funcionaban, puede que falte un segmento en la lista negra o que un slug de fotógrafo colisione con una ruta nueva.
- Si se añaden nuevas rutas estáticas en `app/`, hay que registrar el primer segmento en `RESERVED_PHOTOGRAPHER_ROOTS` en `lib/photographer-slugs.ts` para evitar colisiones con handlers de fotógrafo.
