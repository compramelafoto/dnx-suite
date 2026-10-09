# Aplicar la migración de Informes (FOTOFFICE, etapa 6, Entrega A)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto.

**Estas pantallas usan la tabla nueva. Publicar el código antes que el SQL las rompe:**

- **Informes → Ajustes** (saldo mínimo y monotributo).
- **Informes → Flujo de caja** (saldo mínimo) y **Informes → Monotributo** (tope y aviso).
- **Informes → Tablero** (semáforo del monotributo y alerta de saldo mínimo).

| | |
|---|---|
| Migración | `20261028120000_fotoffice_etapa_6_informes` |
| Archivo | `packages/db/prisma/migrations/20261028120000_fotoffice_etapa_6_informes/migration.sql` |
| Qué hace | Crea `FotofficeInformesAjustes` (una fila por workspace) con cuatro CHECK. No toca tablas existentes, no borra ni actualiza filas. |

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción (todo junto, en una transacción).
2. Registrarla sin volver a correrla: `prisma migrate resolve --applied 20261028120000_fotoffice_etapa_6_informes`
   (con el checksum del archivo tal como está en `main`).
3. Comprobar: `SELECT count(*) FROM "FotofficeInformesAjustes";` devuelve 0 y los cuatro CHECK existen.

## Deshacer

`DROP TABLE "FotofficeInformesAjustes";` (la tabla es nueva y el módulo `reports` todavía no la usa en otro lado).
