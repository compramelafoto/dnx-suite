# Subí la Foto

Aplicación de DNX Suite para eventos: los invitados escanean un QR, suben fotos sin instalar
nada, la IA las modera y las aprobadas aparecen en la pantalla del salón y en el álbum digital.

- **Dominio:** `subilafoto.com` (registrado el 2026-09-11 en Dattatec)
- **Fecha objetivo:** 10 de octubre de 2026
- **Identificador técnico:** `subilafoto` / `SUBILAFOTO` / prefijo de modelos `Slf`
- **Ubicación en el monorepo:** `apps/subilafoto`

## Documentos

| Doc | Contenido |
|---|---|
| [00-documento-maestro.md](./00-documento-maestro.md) | Definición de producto del titular. Fuente de verdad funcional |
| [01-arquitectura-y-reutilizacion.md](./01-arquitectura-y-reutilizacion.md) | Qué se reutiliza, qué se extiende, qué se crea. Con evidencia en el repo |
| [02-modelo-de-datos.md](./02-modelo-de-datos.md) | Entidades nuevas en el schema compartido |
| [03-roles-y-permisos.md](./03-roles-y-permisos.md) | Matriz de roles y la regla anti-bypass de la descarga |
| [04-mapa-de-pantallas.md](./04-mapa-de-pantallas.md) | Rutas, pantallas y recorridos críticos |
| [05-backlog-y-cronograma.md](./05-backlog-y-cronograma.md) | Backlog por etapas con criterios de aceptación y cronograma al 10/10 |
| [06-migraciones-pruebas-y-despliegue.md](./06-migraciones-pruebas-y-despliegue.md) | Las 5 bases, el plan de pruebas y el rollback |
| [07-riesgos-y-decisiones-abiertas.md](./07-riesgos-y-decisiones-abiertas.md) | Riesgos vivos y las decisiones que faltan resolver |

## Decisiones tomadas el 2026-09-11

1. **Schema Prisma compartido.** Subí la Foto usa `packages/db` como el resto de la suite.
   Login, DNX Partners, DNX Payments y los módulos compartidos se reutilizan sin duplicar.
2. **Tiempo real propio con SSE.** Sin proveedor externo ni factura nueva.

## La regla que ordena todo el trabajo

> Primero, hacer impecable el recorrido QR → carga → moderación → pantalla → álbum.
> Después, ampliar.

Lo que no entra en ese recorrido se pospone antes que arriesgar la fecha.
